import subprocess
from pathlib import Path
from app.db import get_database
from app.auth_helper import get_supabase_client
from app.utils.audio import is_ffmpeg_installed, get_ffmpeg_path, convert_to_mp3

TEMP_DIR = Path("storage/temp")

# Ensure temporary directory exists
if not TEMP_DIR.exists():
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

def preprocess_audio(media_id: str) -> str:
    """
    Finds the media record and resolves the path of the stored audio file.
    If the file exists locally in app/uploads/, uses it directly.
    Otherwise, downloads the file from Supabase Storage via storage_path (owner_id/media_id.mp3)
    into storage/temp/ for Groq Whisper transcription.
    """
    db = get_database()
    media_record = db.media.find_one({"media_id": media_id})
    
    if not media_record:
        raise ValueError(f"Media record with ID {media_id} not found in database.")
        
    app_dir = Path(__file__).parent.parent
    stored_filename = media_record.get("stored_filename", f"{media_id}.mp3")
    audio_path = app_dir / "uploads" / stored_filename

    # If local file does not exist, download from Supabase Storage using SDK
    if not audio_path.exists():
        storage_path = media_record.get("storage_path") or f"{media_record.get('owner_id')}/{media_id}.mp3"
        supabase = get_supabase_client()
        
        try:
            print(f"[Media Processing] Downloading {storage_path} from Supabase Storage 'media' bucket...")
            audio_bytes = supabase.storage.from_("media").download(storage_path)
            
            temp_mp3 = TEMP_DIR / f"{media_id}.mp3"
            with open(temp_mp3, "wb") as f:
                f.write(audio_bytes)
            audio_path = temp_mp3
        except Exception as e:
            # Secondary fallback: try loading from audio_path string if defined
            audio_path_str = media_record.get("audio_path")
            if audio_path_str:
                audio_path = Path(audio_path_str)
                if not audio_path.is_absolute():
                    backend_dir = app_dir.parent
                    audio_path = backend_dir / audio_path_str
                    
            if not audio_path.exists():
                raise FileNotFoundError(f"Failed to retrieve audio file for media ID {media_id} from Supabase Storage or local path. Error: {str(e)}")

    # Groq API limit is 25MB (26,214,400 bytes)
    MAX_BYTES = 24 * 1024 * 1024
    
    # If the stored file is MP3 and under 24MB, return it directly!
    if audio_path.suffix.lower() in (".mp3", ".mpeg") and audio_path.stat().st_size < MAX_BYTES:
        return str(audio_path)

    # Fallback: If oversized or non-MP3, compress to lightweight MP3 in storage/temp
    output_mp3_path = TEMP_DIR / f"{media_id}_compressed.mp3"
    convert_to_mp3(audio_path, output_mp3_path)
    return str(output_mp3_path)
