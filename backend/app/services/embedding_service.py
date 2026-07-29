import os
import time
import uuid
from datetime import datetime
from pathlib import Path
import numpy as np
from sentence_transformers import SentenceTransformer

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue

from app.db import get_database
from app.auth_helper import get_supabase_client
from app.utils.semantic_chunker import chunk_text
from app.config import QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION_NAME

class EmbeddingService:
    _model = None
    _qdrant_client = None
    COLLECTION_NAME = QDRANT_COLLECTION_NAME or "voxvault"

    @classmethod
    def get_model(cls):
        """Loads and returns the SentenceTransformer model (cached locally)."""
        if cls._model is None:
            cache_dir = "D:/AI/Models"
            os.makedirs(cache_dir, exist_ok=True)
            cls._model = SentenceTransformer("BAAI/bge-small-en-v1.5", cache_folder=cache_dir)
        return cls._model

    @classmethod
    def get_qdrant_client(cls) -> QdrantClient:
        """Initializes and returns the Qdrant Cloud or local Qdrant persistent client."""
        if cls._qdrant_client is None:
            url = os.getenv("QDRANT_URL") or QDRANT_URL
            api_key = os.getenv("QDRANT_API_KEY") or QDRANT_API_KEY
            if url:
                cls._qdrant_client = QdrantClient(url=url, api_key=api_key if api_key else None)
            else:
                persist_dir = "storage/qdrant"
                os.makedirs(persist_dir, exist_ok=True)
                cls._qdrant_client = QdrantClient(path=persist_dir)
        return cls._qdrant_client

    @classmethod
    def ensure_collection(cls, client: QdrantClient):
        """Ensures the Qdrant collection exists with Cosine distance, 384 dimensions, and payload indexes."""
        collection_name = os.getenv("QDRANT_COLLECTION_NAME") or cls.COLLECTION_NAME
        if not client.collection_exists(collection_name):
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE)
            )
        try:
            from qdrant_client.models import PayloadSchemaType
            client.create_payload_index(
                collection_name=collection_name,
                field_name="media_id",
                field_schema=PayloadSchemaType.KEYWORD
            )
            client.create_payload_index(
                collection_name=collection_name,
                field_name="owner_id",
                field_schema=PayloadSchemaType.KEYWORD
            )
        except Exception:
            pass


async def generate_and_store_embeddings(media_id: str, owner_id: str) -> dict:
    """
    Retrieves the cleaned transcript from MongoDB, segments it semantically,
    generates chunk-level embeddings, stores them in Qdrant Cloud, and updates media status.
    """
    start_time = time.time()
    db = get_database()
    
    # 1. Fetch transcript from MongoDB
    transcript_doc = db.transcripts.find_one({"media_id": media_id})
    if not transcript_doc:
        raise ValueError("No transcript record found for this media ID. Please transcribe first.")
        
    cleaned_transcript = transcript_doc.get("clean_transcript", "")
    if not cleaned_transcript:
        raise ValueError("Cleaned transcript is empty. Please clean the transcript first.")

    # 2. Get singleton components & ensure collection
    model = EmbeddingService.get_model()
    qdrant = EmbeddingService.get_qdrant_client()
    EmbeddingService.ensure_collection(qdrant)
    collection_name = os.getenv("QDRANT_COLLECTION_NAME") or EmbeddingService.COLLECTION_NAME

    # 3. Perform semantic chunking
    chunks = chunk_text(cleaned_transcript, model, similarity_threshold=0.6, max_words=600, overlap_words=80)
    
    if not chunks:
        raise ValueError("Semantic chunking yielded zero chunks.")

    # 4. Generate final embeddings for each semantic chunk in batch
    chunk_embeddings = model.encode(chunks, convert_to_numpy=True)

    # 5. Delete existing vectors for this media_id to avoid duplicate inserts on retry
    try:
        qdrant.delete(
            collection_name=collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="media_id",
                        match=MatchValue(value=media_id)
                    )
                ]
            )
        )
    except Exception as e:
        print(f"[Qdrant Note] Deletion check prior to upsert: {e}")

    # 6. Build PointStruct list with required payload metadata
    points = []
    for idx, chunk_text_content in enumerate(chunks):
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{media_id}_{idx}"))
        embedding_vector = chunk_embeddings[idx]
        
        points.append(
            PointStruct(
                id=point_id,
                vector=embedding_vector.tolist(),
                payload={
                    "media_id": media_id,
                    "owner_id": owner_id,
                    "chunk_index": idx,
                    "document": chunk_text_content
                }
            )
        )

    # Upsert points into Qdrant
    if points:
        qdrant.upsert(
            collection_name=collection_name,
            points=points
        )

    processing_time = round(time.time() - start_time, 2)

    # 7. Update media status in MongoDB to 'embedded'
    db.media.update_one(
        {"media_id": media_id},
        {"$set": {
            "status": "embedded"
        }}
    )

    # 8. Pipeline complete: Automatically delete local copy ONLY after pipeline succeeds & verified in Supabase Storage
    cleanup_local_file_after_pipeline(media_id)

    return {
        "status": "success",
        "chunks_created": len(chunks),
        "embeddings_created": len(chunks),
        "processing_time": processing_time
    }


def cleanup_local_file_after_pipeline(media_id: str):
    """
    Automatically cleans up the local file in backend/app/uploads/ ONLY after
    the entire ingestion pipeline completes successfully (status: 'embedded')
    AND the file is verified in Supabase Storage.
    If any step failed or is remaining, the local file is retained for retry.
    """
    db = get_database()
    media_record = db.media.find_one({"media_id": media_id})
    if not media_record:
        return
        
    storage_path = media_record.get("storage_path")
    if not storage_path:
        print(f"[Pipeline Cleanup] Retaining local file for media {media_id}: storage_path missing.")
        return

    try:
        supabase = get_supabase_client()
        folder = os.path.dirname(storage_path)
        res = supabase.storage.from_("media").list(path=folder if folder else None)
        target_name = os.path.basename(storage_path)
        found_in_supabase = any(item.get("name") == target_name for item in res)
        
        if found_in_supabase:
            app_dir = Path(__file__).parent.parent
            stored_filename = media_record.get("stored_filename", f"{media_id}.mp3")
            local_file = app_dir / "uploads" / stored_filename
            if local_file.exists():
                local_file.unlink()
                print(f"[Pipeline Cleanup] Success: Ingestion pipeline complete & file verified in Supabase Storage. Deleted local copy {local_file.name}")
        else:
            print(f"[Pipeline Cleanup] Retaining local copy for media {media_id}: Not yet verified in Supabase Storage.")
    except Exception as e:
        print(f"[Pipeline Cleanup Note] Storage verification check ({e}). Retaining local copy for safety.")


def get_media_embeddings(media_id: str) -> list:
    """Retrieves stored text chunks and vector previews from Qdrant Cloud for display."""
    qdrant = EmbeddingService.get_qdrant_client()
    EmbeddingService.ensure_collection(qdrant)
    collection_name = os.getenv("QDRANT_COLLECTION_NAME") or EmbeddingService.COLLECTION_NAME
    
    try:
        records, _ = qdrant.scroll(
            collection_name=collection_name,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="media_id",
                        match=MatchValue(value=media_id)
                    )
                ]
            ),
            with_payload=True,
            with_vectors=True,
            limit=500
        )
    except Exception as e:
        print(f"[Qdrant Get Embeddings Error]: {e}")
        records = []
    
    chunks = []
    for record in records:
        payload = record.payload or {}
        vec = record.vector if isinstance(record.vector, list) else []
        vector_preview = [round(val, 4) for val in vec[:8]]
        
        chunks.append({
            "chunk_id": str(record.id),
            "text": payload.get("document", ""),
            "chunk_index": payload.get("chunk_index", 0),
            "vector_preview": vector_preview
        })
        
    chunks.sort(key=lambda x: x["chunk_index"])
    return chunks
