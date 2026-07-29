import os
from dotenv import load_dotenv

load_dotenv()

# RAG Chat Config
SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.72"))
TOP_K_RESULTS = int(os.getenv("RAG_TOP_K_RESULTS", "5"))
MAX_CHAT_HISTORY = int(os.getenv("RAG_MAX_CHAT_HISTORY", "10"))  # Number of messages to include in context
MAX_WEB_RESULTS = int(os.getenv("RAG_MAX_WEB_RESULTS", "3"))
# Qdrant Vector Store Config
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "voxvault")
