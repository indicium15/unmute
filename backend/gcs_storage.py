"""
Google Cloud Storage helper for accessing datasets.

All dataset files (vocab, landmark pickles, GIFs) are always read from GCS,
including in local development, so that everyone works off the same data.

Environment Variables:
    GCS_BUCKET_NAME: Name of the GCS bucket (e.g., 'unmute-datasets')
    GCS_SGLS_DATASET_ROOT: Object prefix for GIF folders (default 'sgsl_dataset'). Use
        'sgsl_dataset/sgsl_dataset' if uploads created an extra nested folder.
"""

import os
import pickle
import json
from typing import Optional, Any
from functools import lru_cache

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


def file_exists(relative_path: str) -> bool:
    """Check if a file exists in GCS."""
    try:
        bucket = _get_gcs_bucket()
        blob = bucket.blob(relative_path)
        return blob.exists()
    except Exception as e:
        print(f"[GCS] Error checking file existence: {e}")
        return False


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


@lru_cache(maxsize=100)
def read_pickle_cached(relative_path: str) -> Optional[Any]:
    """
    Read a pickle file with caching (for frequently accessed files).

    Note: Uses LRU cache to avoid repeated GCS calls for the same file.
    """
    return read_pickle(relative_path)


def get_dataset_info() -> dict:
    """Get information about the current storage configuration."""
    return {
        "bucket_name": GCS_BUCKET_NAME,
        "public_url": GCS_PUBLIC_URL,
    }
