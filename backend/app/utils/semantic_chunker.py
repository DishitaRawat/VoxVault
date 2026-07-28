import re
import numpy as np

def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    """Computes the cosine similarity between two numpy vectors."""
    dot = np.dot(v1, v2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))

def parse_sentences(text: str):
    """Parses clean transcript text line-by-line, extracting timestamp tags if present."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    parsed = []
    for line in lines:
        # Matches [MM:SS.ms] text or [H:MM:SS.ms] text
        match = re.match(r"^\[(\d{1,2}:\d{2}\.\d{2})\]\s*(.*)$", line)
        if match:
            timestamp = match.group(1)
            content = match.group(2).strip()
            parsed.append({
                "full_text": line,
                "clean_text": content,
                "timestamp": timestamp
            })
        else:
            parsed.append({
                "full_text": line,
                "clean_text": line,
                "timestamp": None
            })
    return parsed

def chunk_text(text: str, model, similarity_threshold: float = 0.6, max_words: int = 600, overlap_words: int = 80) -> list:
    """
    Groups sentences semantically based on cosine similarity of BGE embeddings.
    
    Step 1: Splits cleaned transcript into lines (sentences).
    Step 2: Generates temporary in-memory BGE embeddings for all sentences.
    Step 3: Compares neighboring sentence embeddings.
    Step 4: Accumulates sentences into a chunk until similarity drops below threshold.
    Step 5: Enforces max chunk word limit.
    Step 6: Adds word overlap between consecutive chunks.
    """
    parsed = parse_sentences(text)
    if not parsed:
        return []

    # 1. Generate sentence embeddings in batch for speed
    clean_texts = [p["clean_text"] for p in parsed]
    embeddings = model.encode(clean_texts, convert_to_numpy=True)

    chunks = []
    n = len(parsed)
    
    current_idx = 0
    while current_idx < n:
        chunk_words = 0
        chunk_sentences = []
        
        for i in range(current_idx, n):
            sentence_words = len(parsed[i]["clean_text"].split())
            
            # First sentence in chunk is added unconditionally to ensure forward progress
            if not chunk_sentences:
                chunk_sentences.append(parsed[i])
                chunk_words += sentence_words
                continue
            
            # Calculate cosine similarity with the previous sentence in sequence
            prev_emb = embeddings[i - 1]
            curr_emb = embeddings[i]
            sim = cosine_similarity(prev_emb, curr_emb)
            
            # If similarity drops (topic change) or word count exceeds limit, close the chunk
            if sim < similarity_threshold or (chunk_words + sentence_words) > max_words:
                # Backtrack to calculate starting index of next chunk for overlap
                backtrack_words = 0
                k = i - 1
                while k >= current_idx and backtrack_words < overlap_words:
                    backtrack_words += len(parsed[k]["clean_text"].split())
                    k -= 1
                
                # Next chunk starts at k + 1. Ensure it advances by at least 1 index.
                next_start = max(k + 1, current_idx + 1)
                
                # Commit current chunk
                chunk_content = "\n".join([s["full_text"] for s in chunk_sentences])
                chunks.append(chunk_content)
                
                current_idx = next_start
                break
            else:
                # Add sentence to current chunk
                chunk_sentences.append(parsed[i])
                chunk_words += sentence_words
        else:
            # Reached end of transcript, commit final chunk
            chunk_content = "\n".join([s["full_text"] for s in chunk_sentences])
            chunks.append(chunk_content)
            break
            
    return chunks
