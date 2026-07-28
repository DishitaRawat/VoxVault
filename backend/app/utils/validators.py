import re
from urllib.parse import urlparse

ALLOWED_EXTENSIONS = {".mp3", ".mp4", ".wav"}
ALLOWED_MIME_TYPES = {
    "audio/mpeg", "video/mp4", "audio/mp3", "audio/x-m4a",
    "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"
}
BLOCKED_DOMAINS = {"spotify.com"}

def is_valid_url(url: str) -> bool:
    """Checks if a string has a valid URL structure (scheme and netloc)."""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def is_allowed_file_extension(filename: str) -> bool:
    """Checks if the file extension is .mp3, .mp4, or .wav."""
    import os
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTENSIONS

def is_allowed_mime_type(content_type: str) -> bool:
    """Checks if the file MIME type is allowed."""
    return content_type.lower() in ALLOWED_MIME_TYPES

def validate_podcast_url_syntax(url: str) -> bool:
    """
    Validates the structure of a podcast URL and ensures
    it doesn't belong to any blocked domains like Spotify or YouTube.
    """
    if not is_valid_url(url):
        return False
    
    try:
        parsed = urlparse(url.lower())
        domain = parsed.netloc
        
        # Block Spotify player and YouTube links explicitly
        for blocked in BLOCKED_DOMAINS:
            if blocked in domain:
                return False
        return True
    except Exception:
        return False
