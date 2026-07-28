import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class Media(BaseModel):
    media_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str  # The Supabase user UUID who owns this media record
    source_type: str  # local_mp3, local_mp4, podcast_website, rss_feed
    original_filename: str
    stored_filename: str
    local_path: str
    audio_path: str
    audio_url: Optional[str] = None  # Supabase Storage public URL for audio stream
    storage_path: Optional[str] = None  # Supabase Storage object path (owner_id/media_id.mp3)
    upload_time: datetime = Field(default_factory=datetime.utcnow)
    status: str = "uploaded"
    sha256: str
    image_url: Optional[str] = None


    class Config:
        json_schema_extra = {
            "example": {
                "media_id": "d3b07384-d113-4956-a5db-9c3f0c128f11",
                "source_type": "local_mp3",
                "original_filename": "interview.mp3",
                "stored_filename": "d3b07384-d113-4956-a5db-9c3f0c128f11.mp3",
                "local_path": "app/uploads/d3b07384-d113-4956-a5db-9c3f0c128f11.mp3",
                "audio_path": "app/uploads/d3b07384-d113-4956-a5db-9c3f0c128f11.mp3",
                "upload_time": "2026-07-13T16:30:00Z",
                "status": "uploaded",
                "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            }
        }
