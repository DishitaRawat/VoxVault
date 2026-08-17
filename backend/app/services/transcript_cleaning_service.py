import os
import httpx
from datetime import datetime
from app.db import get_database

def format_segments_with_timestamps(segments: list) -> str:
    """Helper to format Whisper segments list into timestamped lines [MM:SS.ms] Text"""
    lines = []
    for seg in segments:
        start = seg.get("start", 0.0)
        mins = int(start // 60)
        secs = int(start % 60)
        cs = int((start % 1) * 100)
        timestamp = f"[{mins:02d}:{secs:02d}.{cs:02d}]"
        text = seg.get("text", "").strip()
        lines.append(f"{timestamp} {text}")
    return "\n".join(lines)

async def clean_transcript(media_id: str) -> str:
    """
    Retrieves the raw transcript for a given media ID from MongoDB,
    calls Groq's Chat Completion API to format and clean grammatical structure,
    saves the output in the clean_transcript field, and updates the media status to 'cleaned'.
    """
    db = get_database()
    
    # 1. Fetch raw transcript from MongoDB
    transcript_doc = db.transcripts.find_one({"media_id": media_id})
    if not transcript_doc:
        raise ValueError("No transcript record found for this media ID. Please transcribe the media first.")
        
    raw_text = transcript_doc.get("raw_transcript", "")
    if not raw_text.strip():
        raise ValueError("Raw transcript content is empty.")

    # Format with segment timestamps if segments are available
    segments = transcript_doc.get("segments", [])
    text_to_clean = format_segments_with_timestamps(segments) if segments else raw_text

    # 2. Get Groq API key and construct HTTP call
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is missing in your backend environment configuration (.env file).")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    system_prompt = (
        "You are an expert audio transcript formatting assistant. Your task is to transform a raw, "
        "imperfect speech-to-text transcript into a clean, readable, professional document.\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. PRESERVE ALL INFORMATION. Do not summarize, shorten, remove, or condense any part of the text.\n"
        "2. Do not remove filler words or details if they contribute to content. Never omit technical terms, numbers, names, or timestamps.\n"
        "3. Preserve speaker labels (e.g. 'Speaker 1:', 'Speaker 2:') and any timestamps if they appear in the transcript.\n"
        "4. Fix spelling errors, correct punctuation, correct capitalization, and fix grammatical mistakes.\n"
        "5. Re-format the text into readable paragraphs to make it easier to read.\n"
        "6. Do not invent any facts or add commentary. Return ONLY the clean transcript text, with no preamble or outro."
    )

    primary_model = os.getenv("GROQ_CLEANING_MODEL", "groq/compound")
    # Candidate fallback models in case the configured model is deprecated or unavailable
    candidate_models = [primary_model, "groq/compound", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"]
    # De-duplicate while preserving order
    models_to_try = []
    for m in candidate_models:
        if m not in models_to_try:
            models_to_try.append(m)

    cleaned_text = None
    used_model = None
    last_error = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        for model in models_to_try:
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text_to_clean}
                ],
                "temperature": 0.1
            }
            try:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    result = response.json()
                    cleaned_text = result["choices"][0]["message"]["content"].strip()
                    used_model = model
                    break
                else:
                    last_error = f"Status {response.status_code}: {response.text}"
                    print(f"[Groq Model Warning] Model '{model}' failed ({last_error}). Trying fallback...")
            except httpx.RequestError as e:
                last_error = f"Network error: {str(e)}"
                print(f"[Groq Request Error] Model '{model}' failed ({last_error}). Trying fallback...")

    if not cleaned_text:
        raise RuntimeError(f"Groq API call failed across models {models_to_try}. Last error: {last_error}")

    # 4. Save the cleaned transcript back to MongoDB
    db.transcripts.update_one(
        {"media_id": media_id},
        {"$set": {
            "clean_transcript": cleaned_text,
            "cleaning_model": used_model,
            "cleaned_at": datetime.utcnow()
        }}
    )

    # 5. Update the original media document status to 'cleaned'
    db.media.update_one(
        {"media_id": media_id},
        {"$set": {"status": "cleaned"}}
    )

    return cleaned_text

