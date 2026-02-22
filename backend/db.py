import os
from typing import Optional

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "ai_mock_interviews")

_client: Optional[MongoClient] = None

# Add this inside db.py



def get_interviews_collection() -> Collection:
    collection = get_db()["interviews"]
    collection.create_index("created_at")
    return collection


def get_interview_sessions_collection() -> Collection:
    collection = get_db()["interview_sessions"]
    collection.create_index("created_at")
    return collection

def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return _client


def get_db():
    return get_client()[MONGO_DB_NAME]


def get_admins_collection() -> Collection:
    collection = get_db()["admins"]
    collection.create_index("email", unique=True)
    return collection


def ping_mongo() -> bool:
    try:
        get_client().admin.command("ping")
        return True
    except PyMongoError:
        return False
