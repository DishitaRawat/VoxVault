import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "voxvault_db")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]

def get_database():
    return db
