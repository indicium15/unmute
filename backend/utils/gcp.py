"""Interfacing with Google Cloud Platform: Cloud Storage (dataset assets) and
Firestore/Firebase Admin (auth verification backing store + app data).

All dataset files (vocab, landmark pickles, GIFs) are always read from GCS,
including in local development, so that everyone works off the same data.

Environment Variables:
    GCS_BUCKET_NAME: Name of the GCS bucket (e.g., 'unmute-datasets')
    GCS_SGLS_DATASET_ROOT: Object prefix for GIF folders (default 'sgsl_dataset'). Use
        'sgsl_dataset/sgsl_dataset' if uploads created an extra nested folder.
    AUTH_ENABLED: Set to 'false' to skip Firebase Admin init entirely (demo / open-access mode).
"""

import json
import logging
import os
import pickle
from datetime import datetime
from typing import Any, Optional

import firebase_admin
from firebase_admin import credentials

from models.gcp import DatasetInfo

logger = logging.getLogger(__name__)

GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME", "unmute-datasets")
# GIF paths may have an extra nested prefix depending on how the bucket was populated.
GCS_SGLS_DATASET_ROOT = os.environ.get("GCS_SGLS_DATASET_ROOT", "sgsl_dataset")

# GCS public URL base (for static file serving)
GCS_PUBLIC_URL = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}"

# Log configuration on module import
print(
    f"[GCS Storage] BUCKET={GCS_BUCKET_NAME}, "
    f"SGLS_DATASET_ROOT={GCS_SGLS_DATASET_ROOT}, PUBLIC_URL={GCS_PUBLIC_URL}"
)

# Set AUTH_ENABLED=false to disable authentication entirely (demo / open-access mode).
# All existing Firebase verification code remains intact; flip the flag to re-enable.
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "true").lower() != "false"

# Initialize GCS client lazily
_gcs_client = None
_gcs_bucket = None


def _get_gcs_bucket():
    """Lazily initialize GCS client and bucket."""
    global _gcs_client, _gcs_bucket
    if _gcs_bucket is None:
        from google.cloud import storage
        _gcs_client = storage.Client()
        _gcs_bucket = _gcs_client.bucket(GCS_BUCKET_NAME)
        print(f"[GCS] Connected to bucket: {GCS_BUCKET_NAME}")
    return _gcs_bucket


def get_static_url(relative_path: str) -> str:
    """Get the public GCS URL for a static file."""
    url = f"{GCS_PUBLIC_URL}/{relative_path}"
    print(f"[GCS] Generated URL: {url}")
    return url


def read_json(relative_path: str) -> Optional[dict]:
    """
    Read a JSON file from GCS.

    Args:
        relative_path: Path relative to the dataset root (e.g., 'sgsl_processed/vocab.json')

    Returns:
        Parsed JSON data or None if file doesn't exist
    """
    try:
        bucket = _get_gcs_bucket()
        blob = bucket.blob(relative_path)
        content = blob.download_as_text()
        return json.loads(content)
    except Exception as e:
        print(f"[GCS] Error reading JSON {relative_path}: {e}")
        return None


def read_pickle(relative_path: str) -> Optional[Any]:
    """
    Read a pickle file from GCS.

    Args:
        relative_path: Path relative to the dataset root (e.g., 'sgsl_processed/landmarks_pkl/HELLO.pkl')

    Returns:
        Unpickled data or None if file doesn't exist
    """
    try:
        bucket = _get_gcs_bucket()
        blob = bucket.blob(relative_path)
        content = blob.download_as_bytes()
        return pickle.loads(content)
    except Exception as e:
        print(f"[GCS] Error reading pickle {relative_path}: {e}")
        return None


def get_dataset_info() -> DatasetInfo:
    """Get information about the current storage configuration."""
    return DatasetInfo(bucket_name=GCS_BUCKET_NAME, public_url=GCS_PUBLIC_URL)


# ── Firebase Admin init + Firestore ─────────────────────────────────────────

def _init_firebase():
    if not AUTH_ENABLED:
        return
    if firebase_admin._apps:
        return
    # Option 1: inline JSON via env var (avoids Secret Manager)
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
    # Option 2: path to a mounted key file
    elif (service_account_path := os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")) and os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
    # Option 3: Application Default Credentials
    else:
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)


_init_firebase()

_db = None


def get_db():
    """Lazily initialise and return the Firestore client.

    Relies on the Firebase app already being initialised (above, at module
    import time). Supports an optional FIRESTORE_DATABASE_ID env var to
    target a named Firestore database instead of the default one.
    """
    global _db
    if _db is not None:
        return _db

    try:
        from firebase_admin import firestore

        database_id = os.getenv("FIRESTORE_DATABASE_ID", "(default)")
        _db = firestore.client(database_id=database_id)
        logger.info("[DB] Firestore client initialised (database: %s)", database_id)
    except Exception as exc:
        logger.error("[DB] Failed to initialise Firestore: %s", exc)

    return _db


def serialize_doc(data: dict) -> dict:
    """Convert Firestore-specific types (e.g. DatetimeWithNanoseconds) to plain
    JSON-serialisable Python types so API responses can be encoded without error.
    """
    result = {}
    for key, value in data.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [v.isoformat() if isinstance(v, datetime) else v for v in value]
        else:
            result[key] = value
    return result
