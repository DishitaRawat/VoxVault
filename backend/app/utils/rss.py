import re
import hashlib
import time
import os
import httpx
import feedparser
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

async def scrape_rss_url_from_website(website_url: str) -> str:
    """
    Downloads a webpage, scrapes its HTML to search for a RSS Feed link:
    e.g., <link rel="alternate" type="application/rss+xml" href="...">
    
    If not found directly in <link> tags, falls back to querying the Podcast Index API
    if API credentials are provided.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            response = await client.get(website_url, headers=headers)
            response.raise_for_status()
    except Exception as e:
        raise ValueError(f"Failed to download podcast website HTML: {str(e)}")

    html = response.text
    soup = BeautifulSoup(html, "html.parser")
    
    # 1. Look for <link rel="alternate" ...> tags (standard mechanism)
    feed_link = soup.find("link", rel="alternate", type=re.compile(r"(application/rss\+xml|application/atom\+xml|text/xml)"))
    if feed_link and feed_link.get("href"):
        return urljoin(website_url, feed_link["href"])
    
    # 2. Check <a> tags in the body that point to likely feed paths or files
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"].lower()
        if "/feed" in href or href.endswith((".xml", ".rss")):
            return urljoin(website_url, a_tag["href"])
            
    # 3. Fallback: Query Podcast Index API
    return await query_podcast_index_fallback(website_url)

async def query_podcast_index_fallback(website_url: str) -> str:
    """
    Queries the public Podcast Index API to find a podcast feed URL for a given website.
    Requires PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET in the .env file.
    """
    api_key = os.getenv("PODCAST_INDEX_API_KEY")
    api_secret = os.getenv("PODCAST_INDEX_API_SECRET")
    
    if not api_key or not api_secret:
        raise ValueError(
            "RSS feed could not be discovered on the website. "
            "To enable fallback search, configure PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET in your .env file."
        )
    
    epoch_time = str(int(time.time()))
    auth_string = api_key + api_secret + epoch_time
    sha1_hash = hashlib.sha1(auth_string.encode("utf-8")).hexdigest()
    
    headers = {
        "User-Agent": "VoxVault-Ingestion/1.0",
        "X-Auth-Key": api_key,
        "X-Auth-Date": epoch_time,
        "Authorization": sha1_hash
    }
    
    # Extract domain name as the search query
    domain = urlparse(website_url).netloc
    if domain.startswith("www."):
        domain = domain[4:]
        
    search_url = f"https://api.podcastindex.org/api/1.0/search/byterm?q={domain}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(search_url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                feeds = data.get("feeds", [])
                if feeds:
                    return feeds[0].get("url")
    except Exception as e:
        raise ValueError(f"Podcast Index API lookup failed: {str(e)}")
        
    raise ValueError("RSS feed link could not be discovered in HTML or via Podcast Index fallback.")

async def parse_rss_feed_episodes(rss_url: str) -> list:
    """
    Downloads and parses an RSS feed using feedparser.
    Extracts all episodes with: title, description, publication date, and audio URL.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.get(rss_url, headers=headers)
            response.raise_for_status()
    except Exception as e:
        raise ValueError(f"Failed to fetch RSS feed content: {str(e)}")
        
    # Feedparser can load feed from raw string content
    feed = feedparser.parse(response.text)
    
    if feed.bozo:
        # Bozo is set to 1 if feed xml is not well-formed
        # We can still proceed if entries are parsed, but if there are no entries, raise an error
        if not feed.entries:
            raise ValueError(f"Invalid or corrupted RSS XML structure: {feed.bozo_exception}")

    episodes = []
    for entry in feed.entries:
        title = entry.get("title", "Untitled Episode")
        
        # Pull description, prioritizing summary, then description, then subtitle
        description = entry.get("summary", entry.get("description", entry.get("subtitle", "")))
        # Clean HTML tags from description if present
        description = BeautifulSoup(description, "html.parser").get_text() if description else ""
        
        # Extract publication date
        pub_date = entry.get("published", entry.get("pubDate", ""))
        
        # Locate audio URL inside enclosures tag
        audio_url = None
        enclosures = entry.get("enclosures", [])
        if enclosures:
            # Find the first enclosure (usually containing the audio/video file link)
            audio_url = enclosures[0].get("url")
            
        if not audio_url:
            # Check standard iTunes/podcast namespace link as a fallback
            links = entry.get("links", [])
            for link in links:
                if "audio" in link.get("type", ""):
                    audio_url = link.get("href")
                    break
        
        # Extract image URL, prioritizing episode image, then itunes image, then channel feed image
        image_url = entry.get("image", {}).get("href")
        if not image_url:
            image_url = entry.get("itunes_image", {}).get("href")
        if not image_url:
            image_url = feed.feed.get("image", {}).get("url") if feed.feed else None

        episodes.append({
            "title": title,
            "description": description,
            "publication_date": pub_date,
            "audio_url": audio_url,
            "image_url": image_url
        })
        
    return episodes

