import os
from typing import Optional

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017"
DEFAULT_MONGO_DB_NAME = "ai_mock_interviews"

_client: Optional[MongoClient] = None
_client_uri: Optional[str] = None


def _get_mongo_uri() -> str:
    return os.getenv("MONGO_URI", DEFAULT_MONGO_URI)


def _get_db_name() -> str:
    return os.getenv("MONGO_DB_NAME", DEFAULT_MONGO_DB_NAME)


def get_interviews_collection() -> Collection:
    collection = get_db()["interviews"]
    collection.create_index("created_at")
    return collection


def get_interview_sessions_collection() -> Collection:
    collection = get_db()["interview_sessions"]
    collection.create_index("created_at")
    return collection


def get_client() -> MongoClient:
    global _client, _client_uri
    mongo_uri = _get_mongo_uri()

    # Recreate client if URI changed (e.g. env loaded after import).
    if _client is None or _client_uri != mongo_uri:
        _client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        _client_uri = mongo_uri
    return _client


def get_db():
    return get_client()[_get_db_name()]


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
