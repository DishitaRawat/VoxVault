import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "voxvault_db")

# Use certifi CA bundle to resolve Windows OpenSSL/TLS handshake errors
try:
    client = MongoClient(MONGODB_URI, tlsCAFile=certifi.where())
except Exception:
    client = MongoClient(MONGODB_URI)

db = client[MONGODB_DB_NAME]

def get_database():
    return db
