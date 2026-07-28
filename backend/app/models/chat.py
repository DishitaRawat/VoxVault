import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class Conversation(BaseModel):
    conversation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    media_id: str
    owner_id: str
    title: str = "New Chat"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "c1a2b3c4-d5e6-4f7g-8h9i-0j1k2l3m4n5o",
                "media_id": "d3b07384-d113-4956-a5db-9c3f0c128f11",
                "owner_id": "supabase-user-uuid",
                "title": "Understanding RAG Chat",
                "created_at": "2026-07-17T12:00:00Z",
                "updated_at": "2026-07-17T12:05:00Z"
            }
        }

class ChatMessage(BaseModel):
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    media_id: str
    owner_id: str
    role: str  # "user" or "assistant"
    content: str
    retrieval_sources: List[Dict[str, Any]] = Field(default_factory=list)
    model: Optional[str] = None
    tokens: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "m1a2b3c4-d5e6-4f7g-8h9i-0j1k2l3m4n5o",
                "conversation_id": "c1a2b3c4-d5e6-4f7g-8h9i-0j1k2l3m4n5o",
                "media_id": "d3b07384-d113-4956-a5db-9c3f0c128f11",
                "owner_id": "supabase-user-uuid",
                "role": "assistant",
                "content": "The speaker discussed vector databases [1].",
                "retrieval_sources": [
                    {
                        "type": "transcript",
                        "chunk_id": "chunk_d3b07384_0",
                        "start": 41.2,
                        "end": 48.7,
                        "score": 0.91,
                        "text": "We store embeddings in a vector database."
                    }
                ],
                "model": "gemini-2.5-flash",
                "tokens": 128,
                "created_at": "2026-07-17T12:05:00Z"
            }
        }
