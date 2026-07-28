import os
import re
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from google import genai
from google.genai import types
from ddgs import DDGS

from app.db import get_database
from app.config import (
    SIMILARITY_THRESHOLD,
    TOP_K_RESULTS,
    MAX_CHAT_HISTORY,
    MAX_WEB_RESULTS,
    CHROMA_DISTANCE_SPACE
)
from app.services.embedding_service import EmbeddingService

def normalize_text(text: str) -> str:
    """Removes special characters and spaces, converts to lowercase for offset alignment."""
    return re.sub(r'[^a-z0-9]', '', text.lower())

def normalize_distance_to_similarity(distance: float, space: str) -> float:
    """Normalizes raw distances from ChromaDB into similarity score bounds [0.0, 1.0]."""
    if space == "cosine" or space == "ip":
        score = 1.0 - distance
    elif space == "l2":
        score = 1.0 - (distance / 2.0)
    else:
        score = 1.0 - distance
    return max(0.0, min(1.0, score))

def get_chunk_timestamps(chunk_text: str, segments: list, total_duration: float, chunk_index: int, total_chunks: int):
    """
    Finds the start and end timestamp of a chunk text based on the segment array.
    Falls back to a linear duration interpolation if segments are missing.
    """
    if not segments:
        if not total_duration or total_duration <= 0:
            total_duration = 300.0
        if total_chunks <= 0:
            total_chunks = 1
        start = (chunk_index / total_chunks) * total_duration
        end = ((chunk_index + 1) / total_chunks) * total_duration
        return round(start, 2), round(end, 2)

    # Reconstruct segments to match offsets
    norm_segments = []
    current_offset = 0
    for seg in segments:
        text = seg.get("text", "")
        norm = normalize_text(text)
        if not norm:
            continue
        start_offset = current_offset
        end_offset = current_offset + len(norm)
        norm_segments.append({
            "start": seg.get("start", 0.0),
            "end": seg.get("end", 0.0),
            "start_offset": start_offset,
            "end_offset": end_offset,
            "text": text
        })
        current_offset = end_offset

    if not norm_segments:
        if not total_duration or total_duration <= 0:
            total_duration = 300.0
        start = (chunk_index / total_chunks) * total_duration
        end = ((chunk_index + 1) / total_chunks) * total_duration
        return round(start, 2), round(end, 2)

    norm_chunk = normalize_text(chunk_text)
    full_segments_text = "".join(normalize_text(seg.get("text", "")) for seg in segments)

    match_index = full_segments_text.find(norm_chunk)
    if match_index == -1:
        # Try a partial boundary check (first and last 30 characters)
        first_part = norm_chunk[:30]
        last_part = norm_chunk[-30:] if len(norm_chunk) > 30 else norm_chunk
        start_idx = full_segments_text.find(first_part)
        end_idx = full_segments_text.find(last_part)

        if start_idx != -1 and end_idx != -1:
            match_start = start_idx
            match_end = end_idx + len(last_part)
        else:
            # Fallback to linear estimation
            if not total_duration or total_duration <= 0:
                total_duration = norm_segments[-1]["end"]
            start = (chunk_index / total_chunks) * total_duration
            end = ((chunk_index + 1) / total_chunks) * total_duration
            return round(start, 2), round(end, 2)
    else:
        match_start = match_index
        match_end = match_index + len(norm_chunk)

    start_time = None
    end_time = None

    # Map match_start to segment
    for seg in norm_segments:
        if seg["start_offset"] <= match_start < seg["end_offset"]:
            start_time = seg["start"]
            break
    if start_time is None:
        start_time = norm_segments[0]["start"]

    # Map match_end to segment
    for seg in reversed(norm_segments):
        if seg["start_offset"] < match_end <= seg["end_offset"]:
            end_time = seg["end"]
            break
    if end_time is None:
        end_time = norm_segments[-1]["end"]

    return round(start_time, 2), round(end_time, 2)

def generate_query_embedding(question: str) -> List[float]:
    """Generates query embedding list using BAAI/bge-small-en-v1.5 model."""
    model = EmbeddingService.get_model()
    # Direct encode converts to numpy vector, list conversion maps back to list of floats
    embedding = model.encode(question, convert_to_numpy=True).tolist()
    return embedding

def retrieve_relevant_chunks(media_id: str, owner_id: str, question: str) -> List[Dict[str, Any]]:
    """
    Retrieves the top-K relevant transcript chunks from ChromaDB.
    Verify that:
    - The user's question is embedded using BAAI/bge-small-en-v1.5.
    - Searches the 'media_embeddings' collection.
    - Filters by media_id and owner_id (if stored).
    - Returns the Top-K most relevant chunks with metadata, score, and timestamps.
    """
    db = get_database()
    collection = EmbeddingService.get_chroma_collection()
    query_embedding = generate_query_embedding(question)

    # Search ChromaDB collection
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=TOP_K_RESULTS,
        where={"$and": [{"media_id": media_id}, {"owner_id": owner_id}]}
    )

    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    all_chunks = collection.get(where={"media_id": media_id}, include=[])
    total_chunks = len(all_chunks.get("ids", []))

    transcript_doc = db.transcripts.find_one({"media_id": media_id})
    segments = []
    duration = 0.0
    if transcript_doc:
        segments = transcript_doc.get("segments", [])
        duration = transcript_doc.get("duration") or transcript_doc.get("duration_seconds") or 0.0

    retrieved_sources = []
    for idx in range(len(ids)):
        chunk_id = ids[idx]
        text_content = documents[idx]
        meta = metadatas[idx]
        distance = distances[idx]

        score = normalize_distance_to_similarity(distance, CHROMA_DISTANCE_SPACE)
        chunk_idx = meta.get("chunk_index", 0)

        start_time, end_time = get_chunk_timestamps(text_content, segments, duration, chunk_idx, total_chunks)

        retrieved_sources.append({
            "type": "transcript",
            "chunk_id": chunk_id,
            "start": start_time,
            "end": end_time,
            "score": round(score, 4),
            "text": text_content
        })

    # Sort transcript sources by similarity score descending
    retrieved_sources.sort(key=lambda x: x["score"], reverse=True)
    return retrieved_sources

def search_web(question: str) -> List[Dict[str, str]]:
    """Retrieves related web context snippets using DuckDuckGo search."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(question, max_results=MAX_WEB_RESULTS))
            return [
                {
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "summary": r.get("body", "")
                }
                for r in results
            ]
    except Exception as e:
        print(f"[Web Search Error] Web search failed: {e}")
        return []

def get_genai_client() -> genai.Client:
    """Initializes Google GenAI Client wrapper."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing in your backend environment configuration (.env file).")
    return genai.Client(api_key=api_key)

def generate_answer(question: str, context: str, history: List[Dict[str, Any]]) -> tuple:
    """Queries Gemini 2.5 Flash including truncated conversational contexts."""
    client = get_genai_client()
    contents = []

    # 1. Truncate conversation history to last MAX_CHAT_HISTORY messages
    recent_history = history[-MAX_CHAT_HISTORY:] if history else []
    for msg in recent_history:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=msg.get("content", ""))]
        ))

    # 2. Append RAG context
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_text(text=context)]
    ))

    # Gemini system instruction with rules from Step 4
    system_prompt = (
        "You are VoxVault, a professional audio media chat assistant.\n"
        "Rules you MUST follow:\n"
        "1. The uploaded media transcript is the PRIMARY source of truth. Always answer from the retrieved transcript whenever the answer exists.\n"
        "2. Only use web search if the transcript does not contain enough information or the user explicitly asks for additional/background information.\n"
        "3. If both transcript and web are used, clearly separate them.\n"
        "4. Never ignore retrieved transcript chunks.\n"
        "5. Cite facts using numbered brackets (e.g., [1], [2]) corresponding to the sources provided in the context.\n"
        "If the answer cannot be found in the context, clearly state that you do not know."
    )

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.2
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=config
        )
        answer = response.text or ""
        tokens = response.usage_metadata.total_token_count if response.usage_metadata else 0
        return answer, tokens
    except Exception as e:
        print(f"[Gemini Error] Generation failed: {e}")
        return f"I encountered an error generating an answer from Gemini: {str(e)}", 0

def generate_title_automatically(conversation_id: str, question: str, answer: str = ""):
    """
    Automatically renames conversation locally based on the first user question.
    Zero LLM / zero API calls used - preserves user quota and executes instantly.
    """
    db = get_database()
    try:
        clean_q = (question or "").strip()
        words = clean_q.split()
        if not words:
            title = "New Discussion"
        else:
            # Take up to the first 6 words
            short_words = words[:6]
            short_title = " ".join(short_words)
            if len(short_title) > 42:
                short_title = short_title[:39] + "..."
            
            # Capitalize first letter cleanly
            title = short_title[0].upper() + short_title[1:] if len(short_title) > 1 else short_title.upper()

        db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {
                "title": title,
                "updated_at": datetime.utcnow()
            }}
        )
    except Exception as e:
        print(f"[Title Error] Auto-title update failed: {e}")


async def ask_question(media_id: str, owner_id: str, question: str, conversation_id: Optional[str] = None) -> dict:
    """Main workflow to process RAG chat queries, execute threshold checks, and save turns in MongoDB."""
    db = get_database()

    # 1. Resolve conversation metadata
    if not conversation_id:
        conversation_id = str(uuid.uuid4())
        db.conversations.insert_one({
            "conversation_id": conversation_id,
            "media_id": media_id,
            "owner_id": owner_id,
            "title": "New Chat",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    else:
        conv = db.conversations.find_one({"conversation_id": conversation_id})
        if not conv:
            db.conversations.insert_one({
                "conversation_id": conversation_id,
                "media_id": media_id,
                "owner_id": owner_id,
                "title": "New Chat",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })

    # 2. Load previous messages from MongoDB
    prev_messages = list(db.chat_messages.find({"conversation_id": conversation_id}).sort("created_at", 1))

    # 3. Search ChromaDB and retrieve relevant chunks
    transcript_sources = retrieve_relevant_chunks(media_id, owner_id, question)

    # Step 2: Temporarily log retrieved chunks information
    print(f"\n[RAG Debug] Question: {question}")
    for src in transcript_sources:
        print(f"[RAG Debug] Retrieved Chunk ID: {src['chunk_id']}, Score: {src['score']}")
        print(f"[RAG Debug] Chunk Text: {src['text']}")

    # Determine fallback: trigger web search only if best similarity score < SIMILARITY_THRESHOLD
    web_sources = []
    best_score = transcript_sources[0]["score"] if transcript_sources else 0.0
    if best_score < SIMILARITY_THRESHOLD:
        web_results = search_web(question)
        for w in web_results:
            web_sources.append({
                "type": "web",
                "title": w["title"],
                "url": w["url"],
                "summary": w["summary"]
            })

    # Combine active sources for message history metadata
    all_retrieval_sources = transcript_sources + web_sources

    # 4. Build prompt context string (Step 3 Layout)
    context_str = (
        "==========================\n"
        "MEDIA CONTEXT\n"
        "==========================\n\n"
    )
    if transcript_sources:
        for idx, src in enumerate(transcript_sources):
            context_str += f"[Source {idx + 1}] (Media - Chunk: {src['chunk_id']}, Timestamp: {src['start']}s - {src['end']}s):\n{src['text']}\n\n"
    else:
        context_str += "No relevant media context found.\n\n"

    context_str += (
        "==========================\n"
        "WEB CONTEXT\n"
        "==========================\n\n"
    )
    if web_sources:
        for idx, src in enumerate(web_sources):
            offset = len(transcript_sources) + idx + 1
            context_str += f"[Source {offset}] (Web - Title: {src['title']}, URL: {src['url']}):\n{src['summary']}\n\n"
    else:
        context_str += "No web context retrieved.\n\n"

    context_str += (
        "==========================\n"
        "USER QUESTION\n"
        "==========================\n\n"
        f"{question}"
    )

    # Step 5: Temporarily print debug details before calling Gemini
    print("\n" + "=" * 50)
    print("Question:")
    print(question)
    print("-" * 50)
    print("Retrieved Chunks:")
    for idx, src in enumerate(transcript_sources):
        print(f"[{idx + 1}] (Chunk ID: {src['chunk_id']}): {src['text']}")
    print("-" * 50)
    print("Final Prompt:")
    print(context_str)
    print("=" * 50 + "\n")

    # 6. Generate Response
    answer, tokens_used = generate_answer(question, context_str, prev_messages)

    # 7. Save user turn
    db.chat_messages.insert_one({
        "message_id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "media_id": media_id,
        "owner_id": owner_id,
        "role": "user",
        "content": question,
        "retrieval_sources": [],
        "created_at": datetime.utcnow()
    })

    # 8. Save assistant turn
    db.chat_messages.insert_one({
        "message_id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "media_id": media_id,
        "owner_id": owner_id,
        "role": "assistant",
        "content": answer,
        "retrieval_sources": all_retrieval_sources,
        "model": "gemini-2.5-flash",
        "tokens": tokens_used,
        "created_at": datetime.utcnow()
    })

    # 9. Update conversation timestamp
    db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"updated_at": datetime.utcnow()}}
    )

    # 10. Auto title rename if it was the very first QA exchange
    if len(prev_messages) == 0:
        generate_title_automatically(conversation_id, question, answer)

    return {
        "conversation_id": conversation_id,
        "answer": answer,
        "retrieval_sources": all_retrieval_sources
    }
