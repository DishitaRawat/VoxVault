import os
import time
from datetime import datetime
from pathlib import Path
import httpx

from app.db import get_database
from app.models.transcript import Transcript
from app.utils.audio import get_audio_duration

async def transcribe_audio(audio_path_str: str, media_id: str) -> dict:
    """
    Sends the audio file directly to Groq's Whisper API,
    records the transcription metadata, saves it to the transcripts collection,
    and updates the media status to 'transcribed'.
    """
    audio_path = Path(audio_path_str)
    api_key = os.getenv("GROQ_API_KEY")
    
    if not api_key:
        if "storage/temp" in str(audio_path).replace("\\", "/") and audio_path.exists():
            audio_path.unlink()
        raise ValueError("GROQ_API_KEY is missing in your backend environment configuration (.env file).")
        
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found for transcription at {audio_path_str}")

    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    # Dynamically resolve MIME type
    ext = audio_path.suffix.lower()
    if ext in (".mp3", ".mpeg"):
        mime_type = "audio/mpeg"
    elif ext == ".mp4":
        mime_type = "audio/mp4"
    elif ext == ".wav":
        mime_type = "audio/wav"
    elif ext in (".m4a", ".aac"):
        mime_type = "audio/m4a"
    else:
        mime_type = "audio/mpeg"

    start_time = time.time()
    
    try:
        # Open and upload the file using httpx multipart streams
        with open(audio_path, "rb") as audio_file:
            files = {
                "file": (audio_path.name, audio_file, mime_type)
            }
            data = {
                "model": "whisper-large-v3-turbo",
                "response_format": "verbose_json"
            }
            
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(url, headers=headers, files=files, data=data)
                
                if response.status_code != 200:
                    error_detail = response.text or "Unknown Groq API Error."
                    raise RuntimeError(f"Groq API returned status {response.status_code}: {error_detail}")
                    
                result_json = response.json()
                
        processing_time = round(time.time() - start_time, 2)
        
        raw_transcript = result_json.get("text", "").strip()
        segments = result_json.get("segments", [])
        language = result_json.get("language", "en")
        duration = result_json.get("duration")
        if duration is not None:
            duration = float(duration)
        else:
            duration = get_audio_duration(audio_path)
            
        word_count = len(raw_transcript.split())
        
        # Instantiate model schema
        transcript_obj = Transcript(
            media_id=media_id,
            raw_transcript=raw_transcript,
            clean_transcript=None,
            language=language,
            model="whisper-large-v3-turbo",
            duration=duration,
            processing_time=processing_time,
            word_count=word_count,
            segments=segments,
            created_at=datetime.utcnow()
        )
        
        db = get_database()
        
        # Write to transcripts collection
        db.transcripts.update_one(
            {"media_id": media_id},
            {"$set": transcript_obj.model_dump()},
            upsert=True
        )
        
        # Update original media document status
        db.media.update_one(
            {"media_id": media_id},
            {"$set": {"status": "transcribed"}}
        )
        
        return transcript_obj.model_dump()
        
    finally:
        # Guarantee: ONLY delete temporary files in storage/temp/, NEVER delete permanent user uploads
        if "storage/temp" in str(audio_path).replace("\\", "/") and audio_path.exists():
            try:
                audio_path.unlink()
            except Exception as e:
                print(f"[Cleanup Error] Failed to delete temporary file {audio_path}: {e}")
