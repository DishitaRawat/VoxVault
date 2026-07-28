import os
from dotenv import load_dotenv

load_dotenv()

# RAG Chat Config
SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.72"))
TOP_K_RESULTS = int(os.getenv("RAG_TOP_K_RESULTS", "5"))
MAX_CHAT_HISTORY = int(os.getenv("RAG_MAX_CHAT_HISTORY", "10"))  # Number of messages to include in context
MAX_WEB_RESULTS = int(os.getenv("RAG_MAX_WEB_RESULTS", "3"))
CHROMA_DISTANCE_SPACE = os.getenv("RAG_CHROMA_DISTANCE_SPACE", "l2")  # "l2", "cosine", "ip"
