import os
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
import httpx
from fastapi import UploadFile, HTTPException, status
from urllib.parse import urlparse

from app.db import get_database
from app.models.media import Media
from app.auth_helper import get_supabase_client
from app.utils.source_detector import detect_source_type_async
from app.utils.validators import is_allowed_file_extension, is_allowed_mime_type
from app.utils.rss import scrape_rss_url_from_website, parse_rss_feed_episodes
from app.utils.audio import convert_to_mp3

# We resolve UPLOAD_DIR relative to the running app folder
UPLOAD_DIR = Path("app/uploads")

# Ensure upload directory exists
if not UPLOAD_DIR.exists():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def upload_file_to_supabase_storage(file_path: Path, owner_id: str, media_id: str) -> tuple[str, str]:
    """
    Uploads the processed MP3 file to Supabase Storage bucket 'media' under '{owner_id}/{media_id}.mp3'.
    Returns (storage_path, public_url).
    """
    storage_path = f"{owner_id}/{media_id}.mp3"
    supabase = get_supabase_client()
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()
        
    try:
        supabase.storage.from_("media").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "audio/mpeg", "upsert": "true"}
        )
    except Exception as e:
        print(f"[Supabase Storage Upload Note]: {e}")
        
    try:
        public_url = supabase.storage.from_("media").get_public_url(storage_path)
    except Exception:
        supabase_url = os.getenv("SUPABASE_URL", "https://kctpvrqrzdehqyskcqxt.supabase.co")
        public_url = f"{supabase_url}/storage/v1/object/public/media/{storage_path}"
        
    return storage_path, public_url


def download_youtube_audio(url: str, output_mp3_path: Path) -> str:
    """
    Downloads and extracts audio from a YouTube video URL directly to output_mp3_path using yt_dlp.
    Returns the video title extracted from YouTube metadata.
    """
    import yt_dlp
    from app.utils.audio import get_ffmpeg_path
    
    ffmpeg_bin = get_ffmpeg_path()
    ffmpeg_dir = os.path.dirname(ffmpeg_bin) if os.path.isabs(ffmpeg_bin) else None

    target_base = str(output_mp3_path.with_suffix(''))
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': target_base + '.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }
    
    if ffmpeg_dir:
        ydl_opts['ffmpeg_location'] = ffmpeg_dir
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        video_title = info.get('title', 'YouTube Video') + '.mp3'
        
    return video_title


async def discover_podcast_episodes(url: str) -> list:
    """
    Given a podcast website URL or RSS feed URL, detects its type,
    scrapes/resolves the RSS feed, and returns a parsed list of episodes.
    """
    source_type = await detect_source_type_async(url, is_file=False)
    
    if source_type == "rss_feed":
        rss_url = url
    elif source_type == "podcast_website":
        rss_url = await scrape_rss_url_from_website(url)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided URL is not a podcast website or direct RSS feed."
        )
        
    episodes = await parse_rss_feed_episodes(rss_url)
    return episodes


async def ingest_uploaded_file(file: UploadFile, owner_id: str, image_url: str = None) -> Media:
    """
    Ingests an uploaded local MP3 or MP4 file:
    - Validates file type and MIME type headers.
    - Saves the file to app/uploads/ under a unique UUID name.
    - If it's an MP4 video, uses FFmpeg to extract the audio track to an MP3 and deletes the original MP4.
    - Calculates the SHA-256 hash of the final audio track.
    - Uploads final MP3 to Supabase Storage bucket 'media'.
    - Saves the Media record in MongoDB with storage_path and public audio_url.
    """
    # 1. Validate extension
    if not is_allowed_file_extension(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension. Only .mp3 and .mp4 are allowed."
        )
        
    # 2. Validate MIME type
    if not is_allowed_mime_type(file.content_type):
        # Permissive check: sometimes browsers send MP3s with simple audio/ or custom headers
        if not (file.filename.lower().endswith(".mp3") and "audio/" in file.content_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file MIME type: {file.content_type}"
            )
            
    # 3. Detect type (local_mp3 or local_mp4)
    source_type = await detect_source_type_async(file.filename, is_file=True)
    
    media_id = str(uuid.uuid4())
    suffix = Path(file.filename).suffix.lower()
    stored_filename = f"{media_id}{suffix}"
    local_path = UPLOAD_DIR / stored_filename
    
    # 4. Save uploaded file to disk
    try:
        with open(local_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    except Exception as e:
        if local_path.exists():
            local_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write uploaded file to disk: {str(e)}"
        )
        
    # 5. Convert to MP3 if local_mp4 or local_wav
    if source_type in ("local_mp4", "local_wav"):
        audio_filename = f"{media_id}.mp3"
        audio_path = UPLOAD_DIR / audio_filename
        try:
            convert_to_mp3(local_path, audio_path)
            # Delete temporary source file
            if local_path.exists():
                local_path.unlink()
        except Exception as e:
            if audio_path.exists():
                audio_path.unlink()
            if local_path.exists():
                local_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to convert media file to MP3: {str(e)}"
            )
    else:
        audio_path = local_path
        
    # 6. Calculate SHA-256 hash of the final audio file
    sha256_hash = hashlib.sha256()
    try:
        with open(audio_path, "rb") as f:
            while chunk := f.read(1024 * 1024):
                sha256_hash.update(chunk)
        sha256_hex = sha256_hash.hexdigest()
    except Exception as e:
        if audio_path.exists():
            audio_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate file integrity hash: {str(e)}"
        )
        
    db = get_database()
    existing_record = db.media.find_one({"sha256": sha256_hex, "owner_id": owner_id})
    if existing_record:
        # Delete duplicate uploads to prevent storage leaks
        if audio_path.exists():
            audio_path.unlink()
        if local_path != audio_path and local_path.exists():
            local_path.unlink()
        return Media(**existing_record)

    # 7. Upload to Supabase Storage
    storage_path, public_url = upload_file_to_supabase_storage(audio_path, owner_id, media_id)

    # 8. Create Media object and save to MongoDB
    media_obj = Media(
        media_id=media_id,
        owner_id=owner_id,
        source_type=source_type,
        original_filename=file.filename,
        stored_filename=audio_path.name,
        local_path=str(local_path),
        audio_path=str(audio_path),
        audio_url=public_url,
        storage_path=storage_path,
        upload_time=datetime.utcnow(),
        status="uploaded",
        sha256=sha256_hex,
        image_url=image_url
    )
    
    try:
        db = get_database()
        db.media.update_one(
            {"media_id": media_id},
            {"$set": media_obj.model_dump()},
            upsert=True
        )
    except Exception as e:
        # Cleanup file on DB error
        if audio_path.exists():
            audio_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write metadata record to database: {str(e)}"
        )
        
    return media_obj


async def ingest_media_from_url(url: str, owner_id: str, image_url: str = None) -> Media:
    """
    Downloads media file from a direct audio/video URL or YouTube video link:
    - Verifies the URL points to a direct stream or YouTube link.
    - Extracts/downloads MP3 audio.
    - Uploads final MP3 to Supabase Storage bucket 'media'.
    - Saves the Media record in MongoDB with storage_path and public audio_url.
    """
    source_type = await detect_source_type_async(url, is_file=False)
    
    if source_type not in ("direct_media_url", "rss_feed", "podcast_website"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The URL does not point to a direct audio/video stream or supported media link."
        )
        
    if source_type in ("rss_feed", "podcast_website"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URLs representing feeds must be sent to the podcast discovery route. Select a specific episode URL to upload here."
        )
        
    parsed_url = urlparse(url.lower())
    domain = parsed_url.netloc
    is_youtube = "youtube.com" in domain or "youtu.be" in domain

    media_id = str(uuid.uuid4())

    if is_youtube:
        audio_path = UPLOAD_DIR / f"{media_id}.mp3"
        local_path = audio_path
        try:
            video_title = download_youtube_audio(url, audio_path)
            original_filename = video_title
        except Exception as e:
            print(f"[YouTube Extraction Error]: {e}")
            import traceback
            traceback.print_exc()
            if audio_path.exists():
                audio_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to extract audio from YouTube URL: {str(e)}"
            )
            
        sha256_hash = hashlib.sha256()
        try:
            with open(audio_path, "rb") as f:
                while chunk := f.read(1024 * 1024):
                    sha256_hash.update(chunk)
            sha256_hex = sha256_hash.hexdigest()
        except Exception as e:
            if audio_path.exists():
                audio_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to calculate audio file hash: {str(e)}"
            )
    else:
        # Extract extension and filenames
        path_str = Path(parsed_url.path)
        original_filename = path_str.name or "remote_episode.mp3"
        suffix = path_str.suffix.lower()
        
        # If the URL doesn't have a recognizable suffix, default to .mp3
        if suffix not in (".mp3", ".mp4", ".wav"):
            suffix = ".mp3"
            original_filename += ".mp3"
            
        stored_filename = f"{media_id}{suffix}"
        local_path = UPLOAD_DIR / stored_filename
        
        # Stream download from remote URL, calculating SHA-256 simultaneously
        sha256_hash = hashlib.sha256()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
                async with client.stream("GET", url, headers=headers) as r:
                    r.raise_for_status()
                    with open(local_path, "wb") as f:
                        async for chunk in r.aiter_bytes(chunk_size=1024 * 1024):
                            f.write(chunk)
                            sha256_hash.update(chunk)
            sha256_hex = sha256_hash.hexdigest()
        except Exception as e:
            if local_path.exists():
                local_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to stream and download media from remote URL: {str(e)}"
            )
            
        # If video or WAV, convert to MP3 using FFmpeg
        if suffix in (".mp4", ".wav"):
            audio_filename = f"{media_id}.mp3"
            audio_path = UPLOAD_DIR / audio_filename
            try:
                convert_to_mp3(local_path, audio_path)
                # Delete temporary source file
                if local_path.exists():
                    local_path.unlink()
                    
                # Recalculate hash of final converted audio file
                sha256_hash = hashlib.sha256()
                with open(audio_path, "rb") as f:
                    while chunk := f.read(1024 * 1024):
                        sha256_hash.update(chunk)
                sha256_hex = sha256_hash.hexdigest()
            except Exception as e:
                if audio_path.exists():
                    audio_path.unlink()
                if local_path.exists():
                    local_path.unlink()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to convert media URL to MP3: {str(e)}"
                )
        else:
            audio_path = local_path
            
    db = get_database()
    existing_record = db.media.find_one({"sha256": sha256_hex, "owner_id": owner_id})
    if existing_record:
        # Delete duplicate downloaded URL stream files to prevent storage leaks
        if audio_path.exists():
            audio_path.unlink()
        if local_path != audio_path and local_path.exists():
            local_path.unlink()
        return Media(**existing_record)
 
    # Upload to Supabase Storage
    storage_path, public_url = upload_file_to_supabase_storage(audio_path, owner_id, media_id)

    # Save metadata record to MongoDB
    media_obj = Media(
        media_id=media_id,
        owner_id=owner_id,
        source_type="direct_media_url",
        original_filename=original_filename,
        stored_filename=audio_path.name,
        local_path=str(local_path),
        audio_path=str(audio_path),
        audio_url=public_url,
        storage_path=storage_path,
        upload_time=datetime.utcnow(),
        status="uploaded",
        sha256=sha256_hex,
        image_url=image_url
    )
    
    try:
        db = get_database()
        db.media.update_one(
            {"media_id": media_id},
            {"$set": media_obj.model_dump()},
            upsert=True
        )
    except Exception as e:
        if audio_path.exists():
            audio_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write metadata record to database: {str(e)}"
        )
        
    return media_obj
