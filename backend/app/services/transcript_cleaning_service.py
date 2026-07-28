import os
import httpx
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
    calls Groq's Chat Completion API with llama-3.3-70b-versatile to format
    and clean grammatical structure, saves the output in the clean_transcript field,
    and updates the media status to 'cleaned'.
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

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text_to_clean}
        ],
        "temperature": 0.1
    }

    # 3. Request LLM completion using asynchronous HTTPX client
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code != 200:
                error_detail = response.text or "Unknown Groq API Error."
                raise RuntimeError(f"Groq API returned status {response.status_code}: {error_detail}")
                
            result = response.json()
            cleaned_text = result["choices"][0]["message"]["content"].strip()
    except httpx.RequestError as e:
        raise RuntimeError(f"Network error while communicating with Groq API: {str(e)}")
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Failed to parse Groq API response structure: {str(e)}")

    # 4. Save the cleaned transcript back to MongoDB
    db.transcripts.update_one(
        {"media_id": media_id},
        {"$set": {
            "clean_transcript": cleaned_text,
            "cleaning_model": "llama-3.3-70b-versatile",
            "cleaned_at": datetime.utcnow() if 'datetime' in globals() else None  # Handled safely below
        }}
    )
    
    # Update the timestamp manually to avoid globals dependency if datetime is not imported
    from datetime import datetime
    db.transcripts.update_one(
        {"media_id": media_id},
        {"$set": {
            "cleaned_at": datetime.utcnow()
        }}
    )

    # 5. Update the original media document status to 'cleaned'
    db.media.update_one(
        {"media_id": media_id},
        {"$set": {"status": "cleaned"}}
    )

    return cleaned_text
