"""
Cloud Firestore database client for logging translation sessions.

Stores per-request:
  - The user query (text or voice transcription)
  - Intermediate Gemini responses (gloss tokens, unmatched words, notes, detected language)
  - Final speech/sign token output (render plan tokens and sign names)

Collections:
  translation_logs  – text and voice queries that were fully translated
  transcription_logs – voice queries returned without translation
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

_db = None


def get_db():
    """Lazily initialise and return the Firestore client.

    Relies on the Firebase app already being initialised by auth.py.
    Supports an optional FIRESTORE_DATABASE_ID env var to target a named
    Firestore database instead of the default one.
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


def log_translation(
    user_id: str,
    user_email: Optional[str],
    query_type: str,
    input_text: str,
    gemini_response: dict[str, Any],
    render_plan: list[dict[str, Any]],
) -> Optional[str]:
    """Persist a completed translation session to the *translation_logs* collection.

    Args:
        user_id:        Firebase UID of the authenticated user.
        user_email:     User's email address (may be None).
        query_type:     ``"text"`` for direct text input, ``"voice"`` for audio
                        transcription that was then translated.
        input_text:     Original user query (plain text or voice transcription).
        gemini_response: Intermediate response returned by Gemini, expected keys:
                         ``gloss`` (list[str]), ``unmatched`` (list[str]),
                         ``notes`` (str), ``detected_language`` (str).
        render_plan:    Ordered list of sign render items produced by the planner,
                        each dict having at least ``token`` and ``sign_name`` keys.

    Returns:
        The Firestore document ID on success, ``None`` on any failure.
    """
    db = get_db()
    if db is None:
        logger.warning("[DB] Firestore unavailable – skipping translation log")
        return None

    try:
        doc_ref = db.collection("translation_logs").document()
        doc_ref.set({
            # ── Who made the request ──────────────────────────────────────────
            "user_id": user_id,
            "user_email": user_email,
            "timestamp": datetime.now(timezone.utc),
            # ── What the user sent ───────────────────────────────────────────
            "query_type": query_type,
            "input_text": input_text,
            # ── Intermediate Gemini response ─────────────────────────────────
            "detected_language": gemini_response.get("detected_language"),
            "gemini_gloss": gemini_response.get("gloss", []),
            "gemini_unmatched": gemini_response.get("unmatched", []),
            "gemini_notes": gemini_response.get("notes"),
            # ── Final speech/sign token output ───────────────────────────────
            "output_tokens": [
                item["token"] for item in render_plan if "token" in item
            ],
            "output_sign_names": [
                item["sign_name"]
                for item in render_plan
                if item.get("sign_name")
            ],
            "render_plan_count": len(render_plan),
        })
        logger.info(
            "[DB] Translation logged for user %s → doc %s", user_id, doc_ref.id
        )
        return doc_ref.id
    except Exception as exc:
        logger.error("[DB] Failed to log translation: %s", exc)
        return None


def log_transcription(
    user_id: str,
    user_email: Optional[str],
    transcription: str,
    detected_language: Optional[str],
) -> Optional[str]:
    """Persist a voice transcription (no subsequent translation) to the
    *transcription_logs* collection.

    Args:
        user_id:            Firebase UID of the authenticated user.
        user_email:         User's email address (may be None).
        transcription:      Transcribed text returned by Gemini.
        detected_language:  Detected language code (e.g. ``"en"``, ``"zh"``).

    Returns:
        The Firestore document ID on success, ``None`` on any failure.
    """
    db = get_db()
    if db is None:
        logger.warning("[DB] Firestore unavailable – skipping transcription log")
        return None

    try:
        doc_ref = db.collection("transcription_logs").document()
        doc_ref.set({
            "user_id": user_id,
            "user_email": user_email,
            "timestamp": datetime.now(timezone.utc),
            "transcription": transcription,
            "detected_language": detected_language,
        })
        logger.info(
            "[DB] Transcription logged for user %s → doc %s", user_id, doc_ref.id
        )
        return doc_ref.id
    except Exception as exc:
        logger.error("[DB] Failed to log transcription: %s", exc)
        return None
