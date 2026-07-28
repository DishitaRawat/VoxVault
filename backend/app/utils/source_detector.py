import httpx
from urllib.parse import urlparse
from app.utils.validators import validate_podcast_url_syntax

async def detect_source_type_async(url_or_filename: str, is_file: bool = False) -> str:
    """
    Detects the source type from a given local filename or remote URL.
    Does NOT execute business logic, only classifies.
    
    Returns one of: 'local_mp3', 'local_mp4', 'rss_feed', 'podcast_website', or 'direct_media_url'.
    """
    if is_file:
        name = url_or_filename.lower()
        if name.endswith(".mp3"):
            return "local_mp3"
        elif name.endswith(".mp4"):
            return "local_mp4"
        elif name.endswith(".wav"):
            return "local_wav"
        raise ValueError("Unsupported local file type. Must be .mp3, .mp4, or .wav.")
    
    # Otherwise, it's a URL
    if not validate_podcast_url_syntax(url_or_filename):
        raise ValueError("Invalid URL structure or blocked domain.")
        
    parsed_url = urlparse(url_or_filename.lower())
    domain = parsed_url.netloc
    if "youtube.com" in domain or "youtu.be" in domain:
        return "direct_media_url"
    
    try:
        # We query the URL headers to check the Content-Type
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
            response = await client.head(url_or_filename, headers=headers)
            if response.status_code in (404, 405):
                # Fallback to stream GET if HEAD is not supported by the server
                async with client.stream("GET", url_or_filename, headers=headers) as r:
                    if r.status_code < 200 or r.status_code >= 300:
                        raise ValueError(f"HTTP error {r.status_code}")
                    content_type = r.headers.get("Content-Type", "").lower()
            else:
                if response.status_code < 200 or response.status_code >= 300:
                    raise ValueError(f"HTTP error {response.status_code}")
                content_type = response.headers.get("Content-Type", "").lower()
    except Exception:
        # Fallback to simple URL-based heuristics if the network call fails
        parsed = urlparse(url_or_filename.lower())
        path = parsed.path
        if path.endswith((".xml", ".rss")) or "feed" in path or "rss" in path:
            return "rss_feed"
        if path.endswith((".mp3", ".mp4", ".wav")):
            return "direct_media_url"
        return "podcast_website"

    # Analyze MIME Content-Type
    if "xml" in content_type or "rss" in content_type:
        return "rss_feed"
    elif "html" in content_type:
        return "podcast_website"
    elif "audio/" in content_type or "video/" in content_type or url_or_filename.lower().split('?')[0].endswith((".mp3", ".mp4", ".wav")):
        return "direct_media_url"
    
    # Default fallback
    return "podcast_website"
