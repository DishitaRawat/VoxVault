import uuid
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

class Transcript(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    media_id: str
    raw_transcript: str
    clean_transcript: Optional[str] = None
    language: str = "en"
    model: str = "whisper-large-v3-turbo"
    duration: Optional[float] = None
    processing_time: Optional[float] = None
    word_count: Optional[int] = None
    segments: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "76fa968e-73c3-4c92-ac8c-bc5efcd6a147",
                "media_id": "d3b07384-d113-4956-a5db-9c3f0c128f11",
                "raw_transcript": "Hello world, this is a transcript.",
                "clean_transcript": None,
                "language": "en",
                "model": "whisper-large-v3-turbo",
                "duration": 124.5,
                "processing_time": 3.45,
                "word_count": 7,
                "segments": [
                    {"id": 0, "start": 0.0, "end": 2.5, "text": "Hello world,"},
                    {"id": 1, "start": 2.5, "end": 5.0, "text": "this is a transcript."}
                ],
                "created_at": "2026-07-15T12:00:00Z"
            }
        }
