import os
import time
import uuid
from datetime import datetime
import numpy as np
import chromadb
from sentence_transformers import SentenceTransformer

from pathlib import Path
from app.db import get_database
from app.auth_helper import get_supabase_client
from app.utils.semantic_chunker import chunk_text

class EmbeddingService:
    _model = None
    _chroma_client = None
    _collection = None

    @classmethod
    def get_model(cls):
        """Loads and returns the SentenceTransformer model (cached locally)."""
        if cls._model is None:
            cache_dir = "D:/AI/Models"
            os.makedirs(cache_dir, exist_ok=True)
            # Initialize SentenceTransformer referencing bge-small-en-v1.5 and caching in D:/AI/Models
            cls._model = SentenceTransformer("BAAI/bge-small-en-v1.5", cache_folder=cache_dir)
        return cls._model

    @classmethod
    def get_chroma_collection(cls):
        """Initializes and returns the ChromaDB persistent client and collection."""
        if cls._chroma_client is None:
            # Persistent Client inside storage/chromadb
            persist_dir = "storage/chromadb"
            os.makedirs(persist_dir, exist_ok=True)
            cls._chroma_client = chromadb.PersistentClient(path=persist_dir)
            cls._collection = cls._chroma_client.get_or_create_collection(name="media_embeddings")
        return cls._collection

async def generate_and_store_embeddings(media_id: str, owner_id: str) -> dict:
    """
    Retrieves the cleaned transcript from MongoDB, segments it semantically,
    generates chunk-level embeddings, stores them in ChromaDB, and updates media status.
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

    # 2. Get singleton components
    model = EmbeddingService.get_model()
    collection = EmbeddingService.get_chroma_collection()

    # 3. Perform semantic chunking
    # Configurable parameters: threshold 0.6, max words 600, overlap words 80
    chunks = chunk_text(cleaned_transcript, model, similarity_threshold=0.6, max_words=600, overlap_words=80)
    
    if not chunks:
        raise ValueError("Semantic chunking yielded zero chunks.")

    # 4. Generate final embeddings for each semantic chunk in batch
    chunk_embeddings = model.encode(chunks, convert_to_numpy=True)

    # 5. Insert each chunk vector and metadata into ChromaDB
    chunk_ids = []
    documents = []
    embeddings_list = []
    metadatas = []

    for idx, chunk_text_content in enumerate(chunks):
        chunk_id = f"chunk_{media_id}_{idx}_{str(uuid.uuid4())[:8]}"
        embedding_vector = chunk_embeddings[idx]
        
        chunk_ids.append(chunk_id)
        documents.append(chunk_text_content)
        embeddings_list.append(embedding_vector.tolist())
        metadatas.append({
            "media_id": media_id,
            "owner_id": owner_id,
            "chunk_index": idx
        })

    # Clear existing vectors for this media_id if they exist to avoid duplicate inserts on retry
    collection.delete(where={"media_id": media_id})

    # Add to persistent collection
    collection.add(
        ids=chunk_ids,
        documents=documents,
        embeddings=embeddings_list,
        metadatas=metadatas
    )

    processing_time = round(time.time() - start_time, 2)

    # 6. Update media status in MongoDB to 'embedded'
    db.media.update_one(
        {"media_id": media_id},
        {"$set": {
            "status": "embedded"
        }}
    )

    # 7. Pipeline complete: Automatically delete local copy ONLY after pipeline succeeds & verified in Supabase Storage
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
        # Verify object exists in Supabase Storage bucket 'media'
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
    """Retrieves stored text chunks and vector previews from ChromaDB for display."""
    collection = EmbeddingService.get_chroma_collection()
    
    # Query ChromaDB matching media_id
    results = collection.get(
        where={"media_id": media_id},
        include=["documents", "metadatas", "embeddings"]
    )
    
    ids = results.get("ids", [])
    documents = results.get("documents", [])
    metadatas = results.get("metadatas", [])
    embeddings = results.get("embeddings", [])
    
    chunks = []
    for i in range(len(ids)):
        meta = metadatas[i] if i < len(metadatas) else {}
        embedding = embeddings[i] if i < len(embeddings) else []
        
        # Take first 8 values as a visual preview representation of the vector profile
        vector_preview = list(embedding)[:8] if len(embedding) > 0 else []
        vector_preview_str = [round(val, 4) for val in vector_preview]
        
        chunks.append({
            "chunk_id": ids[i],
            "text": documents[i] if i < len(documents) else "",
            "chunk_index": meta.get("chunk_index", 0),
            "vector_preview": vector_preview_str
        })
        
    # Sort chunk items by index sequence
    chunks.sort(key=lambda x: x["chunk_index"])
    return chunks
