from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form, status
from pydantic import BaseModel, HttpUrl
from typing import Optional, List

from app.auth_helper import get_current_user
from app.db import get_database
from app.models.media import Media
from app.models.transcript import Transcript
from app.services import media_ingestion_service, media_processing_service, transcription_service, transcript_cleaning_service, embedding_service, chat_service

router = APIRouter(tags=["media"])

class PodcastDiscoveryRequest(BaseModel):
    url: HttpUrl

@router.post("/podcast", status_code=status.HTTP_200_OK)
async def discover_episodes(
    req: PodcastDiscoveryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves the list of episodes from a podcast website or RSS feed URL.
    Does NOT download files or create database records.
    """
    url_str = str(req.url)
    try:
        episodes = await media_ingestion_service.discover_podcast_episodes(url_str)
        return {
            "status": "success",
            "url": url_str,
            "episodes": episodes
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/upload", status_code=status.HTTP_201_CREATED, response_model=Media)
async def upload_media(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Ingests local media files or remote episode URLs:
    - Must provide EXACTLY one of 'file' (local upload) or 'url' (podcast episode download).
    - Downloads/saves the media, processes video to extract audio, and writes metadata to MongoDB.
    """
    if file and url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either a file or a URL, not both."
        )
    if not file and not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a local file or a remote media URL."
        )
        
    owner_id = current_user["id"]
    
    try:
        if file:
            media_record = await media_ingestion_service.ingest_uploaded_file(file, owner_id, image_url)
        else:
            media_record = await media_ingestion_service.ingest_media_from_url(url, owner_id, image_url)
        return media_record

    except HTTPException as e:
        raise e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/media/{media_id}", response_model=Media)
async def get_media_metadata(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves metadata for a specific Media record.
    Enforces access control so users can only fetch their own files.
    """
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media record not found."
        )
        
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this media file."
        )
        
    # Return Pydantic schema instantiated from the dictionary
    return Media(**record)


@router.get("/media", response_model=List[Media])
async def list_user_media(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves all media records owned by the current authenticated user.
    """
    db = get_database()
    owner_id = current_user["id"]
    records = list(db.media.find({"owner_id": owner_id}).sort("upload_time", -1))
    return [Media(**record) for record in records]


@router.post("/media/{media_id}/process")
async def process_and_transcribe_media(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Triggers audio preprocessing (converting to 16kHz mono WAV) and Whisper transcription.
    Enforces user ownership check.
    """
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
        
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to process this file.")
        
    try:
        # If already embedded, advance status to completed to mark all stages green and enable chat
        if record.get("status") == "embedded":
            db.media.update_one(
                {"media_id": media_id},
                {"$set": {"status": "completed"}}
            )
            return {"status": "success", "message": "Media advanced to completed.", "transcript": None}

        # Step 1: Preprocess to WAV
        wav_path = media_processing_service.preprocess_audio(media_id)
        
        # Step 2: Transcribe via Groq Whisper and save
        transcript = await transcription_service.transcribe_audio(wav_path, media_id)
        
        return {"status": "success", "message": "Media processed and transcribed successfully.", "transcript": transcript}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/media/{media_id}/transcript", response_model=Transcript)
def get_media_transcript(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves the transcript document associated with a specific media file.
    Enforces user ownership check.
    """
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
        
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to view this transcript.")
        
    transcript_record = db.transcripts.find_one({"media_id": media_id})
    if not transcript_record:
        raise HTTPException(status_code=404, detail="Transcript not found for this media file.")
        
    return Transcript(**transcript_record)


@router.post("/media/{media_id}/clean")
async def clean_media_transcript(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Triggers Groq Llama-3.3-70b-versatile model to clean and format
    the raw Whisper transcript. Enforces user ownership check.
    """
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
        
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to view or modify this file.")
        
    try:
        cleaned_text = await transcript_cleaning_service.clean_transcript(media_id)
        return {
            "status": "success",
            "message": "Transcript cleaned and formatted successfully.",
            "clean_transcript": cleaned_text
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/media/{media_id}/embed")
async def generate_embeddings_for_media(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Triggers semantic chunking and embedding generation for the cleaned transcript.
    Saves vectors to ChromaDB and updates media status to 'embedded'.
    """
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
        
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to view or modify this file.")
        
    try:
        result = await embedding_service.generate_and_store_embeddings(media_id, current_user["id"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/media/{media_id}/embeddings")
def get_media_embeddings_list(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves stored text chunks and vector previews for a media file.
    Enforces user ownership check.
    """
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
        
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to view this file's vectors.")
        
    try:
        chunks = embedding_service.get_media_embeddings(media_id)
        return {"status": "success", "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/media/{media_id}/next-step")
async def advance_media_pipeline(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Unified entry point for advancing a media document through its processing pipeline stages.
    It inspects the current status and triggers the appropriate service step:
    - uploaded -> process (preprocess to WAV & transcribe via Whisper)
    - transcribed -> clean (format via Llama-3)
    - cleaned -> embed (semantic chunking & persist in ChromaDB via BGE)
    - embedded -> completed (finalization)
    - completed -> return success (no action needed)
    """
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
        
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to modify this file.")
        
    current_status = record.get("status", "uploaded")
    
    try:
        if current_status in ("uploaded", "failed"):
            # Step 1: Preprocess to WAV
            wav_path = media_processing_service.preprocess_audio(media_id)
            # Step 2: Transcribe via Whisper
            transcript = await transcription_service.transcribe_audio(wav_path, media_id)
            return {
                "status": "success",
                "stage": "transcription",
                "next_status": "transcribed",
                "data": transcript
            }
            
        elif current_status == "transcribed":
            # Step 3: Clean transcript
            cleaned_text = await transcript_cleaning_service.clean_transcript(media_id)
            return {
                "status": "success",
                "stage": "cleaning",
                "next_status": "cleaned",
                "clean_transcript": cleaned_text
            }
            
        elif current_status == "cleaned":
            # Step 4: Semantic chunking and embeddings store
            embed_result = await embedding_service.generate_and_store_embeddings(media_id, current_user["id"])
            return {
                "status": "success",
                "stage": "embeddings",
                "next_status": "embedded",
                "data": embed_result
            }
            
        elif current_status == "embedded":
            # Step 5: Advance status to completed
            db.media.update_one(
                {"media_id": media_id},
                {"$set": {"status": "completed"}}
            )
            return {
                "status": "success",
                "stage": "completion",
                "next_status": "completed",
                "message": "Media pipeline advanced to completed state."
            }
            
        elif current_status in ("completed", "ready"):
            return {
                "status": "success",
                "stage": "already_completed",
                "next_status": current_status,
                "message": "Media is already fully processed."
            }
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported media status sequence: {current_status}")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
class ChatRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None

@router.post("/media/{media_id}/chat")
async def chat_with_media(
    media_id: str,
    req: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to access this media file.")
        
    try:
        response = await chat_service.ask_question(
            media_id=media_id,
            owner_id=current_user["id"],
            question=req.question,
            conversation_id=req.conversation_id
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/media/{media_id}/conversations")
async def create_conversation(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to access this media file.")
        
    try:
        import uuid
        from datetime import datetime
        conversation_id = str(uuid.uuid4())
        db.conversations.insert_one({
            "conversation_id": conversation_id,
            "media_id": media_id,
            "owner_id": current_user["id"],
            "title": "New Chat",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        return {"conversation_id": conversation_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/media/{media_id}/conversations")
async def list_conversations(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    record = db.media.find_one({"media_id": media_id})
    if not record:
        raise HTTPException(status_code=404, detail="Media record not found.")
    if record.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to access this media file.")
        
    try:
        conversations = list(db.conversations.find(
            {"media_id": media_id, "owner_id": current_user["id"]}
        ).sort("updated_at", -1))
        
        # Convert MongoDB _id ObjectIds to strings
        for c in conversations:
            c["_id"] = str(c["_id"])
        return conversations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    # Verify user owns the conversation
    conv = db.conversations.find_one({"conversation_id": conversation_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have permission to view these messages.")
        
    try:
        messages = list(db.chat_messages.find(
            {"conversation_id": conversation_id, "owner_id": current_user["id"]}
        ).sort("created_at", 1))
        
        # Convert ObjectIds to strings
        for m in messages:
            m["_id"] = str(m["_id"])
        return messages
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

