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
    doc_id: Optional[str] = None,
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
        doc_ref = db.collection("translation_logs").document(doc_id)
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


# ── Admin helpers ─────────────────────────────────────────────────────────────

def _serialize_doc(data: dict) -> dict:
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


# ── User management (approval workflow) ───────────────────────────────────────

def register_user(uid: str, email: Optional[str], initial_status: str = "approved") -> dict:
    """Upsert a user into the ``users`` collection.

    Creates the document with ``initial_status`` if it doesn't exist.
    If the user already exists with ``pending`` status, promotes them to ``approved``
    (handles users who were pending before the allowlist was introduced).
    Returns ``{"is_new": bool, "status": str}`` in both cases.
    """
    db = get_db()
    if db is None:
        return {"is_new": False, "status": initial_status}
    try:
        doc_ref = db.collection("users").document(uid)
        doc = doc_ref.get()
        if doc.exists:
            existing_status = doc.to_dict().get("status", "pending")
            if existing_status == "pending":
                doc_ref.update({
                    "status": "approved",
                    "approved_at": datetime.now(timezone.utc),
                    "approved_by": "allowlist",
                })
                logger.info("[DB] Promoted pending user %s to approved via allowlist", uid)
                return {"is_new": False, "status": "approved"}
            return {"is_new": False, "status": existing_status}
        doc_ref.set({
            "uid": uid,
            "email": email,
            "status": initial_status,
            "registered_at": datetime.now(timezone.utc),
        })
        logger.info("[DB] Registered new user %s with status=%s", uid, initial_status)
        return {"is_new": True, "status": initial_status}
    except Exception as exc:
        logger.error("[DB] Failed to register user %s: %s", uid, exc)
        return {"is_new": False, "status": initial_status}


def get_user_status(uid: str) -> Optional[str]:
    """Return the user's approval status or ``None`` if not found."""
    db = get_db()
    if db is None:
        return None
    try:
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            return doc.to_dict().get("status")
        return None
    except Exception as exc:
        logger.error("[DB] Failed to get user status for %s: %s", uid, exc)
        return None


def is_approved_user(uid: str, decoded_token: dict) -> bool:
    """Return ``True`` if the user has the admin custom claim or an approved Firestore status."""
    if decoded_token.get("admin") is True:
        return True
    return get_user_status(uid) == "approved"


# ── Email allowlist ───────────────────────────────────────────────────────────

def is_email_allowed(email: str) -> bool:
    """Return ``True`` if the email exists in the ``allowed_emails`` collection."""
    db = get_db()
    if db is None:
        return False
    try:
        return db.collection("allowed_emails").document(email.strip().lower()).get().exists
    except Exception as exc:
        logger.error("[DB] Failed to check allowed_emails for %s: %s", email, exc)
        return False


def add_allowed_email(email: str, added_by: Optional[str] = None) -> bool:
    """Add an email to the allowlist. Idempotent."""
    db = get_db()
    if db is None:
        return False
    try:
        doc_id = email.strip().lower()
        db.collection("allowed_emails").document(doc_id).set({
            "email": doc_id,
            "added_at": datetime.now(timezone.utc),
            "added_by": added_by,
        })
        logger.info("[DB] Added %s to allowlist (by %s)", doc_id, added_by)
        return True
    except Exception as exc:
        logger.error("[DB] Failed to add allowed email %s: %s", email, exc)
        return False


def remove_allowed_email(email: str) -> bool:
    """Remove an email from the allowlist."""
    db = get_db()
    if db is None:
        return False
    try:
        db.collection("allowed_emails").document(email.strip().lower()).delete()
        logger.info("[DB] Removed %s from allowlist", email.strip().lower())
        return True
    except Exception as exc:
        logger.error("[DB] Failed to remove allowed email %s: %s", email, exc)
        return False


def get_allowed_emails(limit: int = 100, offset: int = 0) -> tuple[list[dict], bool]:
    """Return a page of allowed emails ordered by added_at descending."""
    db = get_db()
    if db is None:
        return [], False
    try:
        docs = list(
            db.collection("allowed_emails")
            .order_by("added_at", direction="DESCENDING")
            .limit(limit + 1)
            .offset(offset)
            .stream()
        )
        has_more = len(docs) > limit
        return [
            {"id": d.id, **_serialize_doc(d.to_dict())} for d in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch allowed emails: %s", exc)
        return [], False


def get_all_users(limit: int = 50, offset: int = 0) -> tuple[list[dict], bool]:
    """Return a page of all users ordered by registration date descending."""
    db = get_db()
    if db is None:
        return [], False
    try:
        docs = list(
            db.collection("users")
            .order_by("registered_at", direction="DESCENDING")
            .limit(limit + 1)
            .offset(offset)
            .stream()
        )
        has_more = len(docs) > limit
        return [
            {"id": doc.id, **_serialize_doc(doc.to_dict())} for doc in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch users: %s", exc)
        return [], False


def approve_user(uid: str, approved_by: Optional[str] = None) -> bool:
    """Set user status to ``approved``."""
    db = get_db()
    if db is None:
        return False
    try:
        db.collection("users").document(uid).update({
            "status": "approved",
            "approved_at": datetime.now(timezone.utc),
            "approved_by": approved_by,
        })
        logger.info("[DB] User %s approved by %s", uid, approved_by)
        return True
    except Exception as exc:
        logger.error("[DB] Failed to approve user %s: %s", uid, exc)
        return False


def revoke_user(uid: str) -> bool:
    """Set user status to ``revoked``."""
    db = get_db()
    if db is None:
        return False
    try:
        db.collection("users").document(uid).update({
            "status": "revoked",
            "revoked_at": datetime.now(timezone.utc),
        })
        logger.info("[DB] User %s revoked", uid)
        return True
    except Exception as exc:
        logger.error("[DB] Failed to revoke user %s: %s", uid, exc)
        return False


def get_translation_logs(
    limit: int = 25, offset: int = 0
) -> tuple[list[dict], bool]:
    """Return a page of *translation_logs* ordered by timestamp descending.

    Fetches ``limit + 1`` rows to cheaply determine whether a next page exists
    without a separate COUNT query.

    Returns:
        ``(logs, has_more)`` – list of serialisable dicts and a boolean flag.
    """
    db = get_db()
    if db is None:
        return [], False
    try:
        docs = list(
            db.collection("translation_logs")
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit + 1)
            .offset(offset)
            .stream()
        )
        has_more = len(docs) > limit
        return [
            {"id": doc.id, **_serialize_doc(doc.to_dict())} for doc in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch translation logs: %s", exc)
        return [], False


def get_transcription_logs(
    limit: int = 25, offset: int = 0
) -> tuple[list[dict], bool]:
    """Return a page of *transcription_logs* ordered by timestamp descending.

    Returns:
        ``(logs, has_more)`` – list of serialisable dicts and a boolean flag.
    """
    db = get_db()
    if db is None:
        return [], False
    try:
        docs = list(
            db.collection("transcription_logs")
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit + 1)
            .offset(offset)
            .stream()
        )
        has_more = len(docs) > limit
        return [
            {"id": doc.id, **_serialize_doc(doc.to_dict())} for doc in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch transcription logs: %s", exc)
        return [], False


def log_feedback(
    user_id: str,
    user_email: Optional[str],
    rating: str,
    translation_log_id: Optional[str] = None,
    comment: Optional[str] = None,
) -> Optional[str]:
    """Persist a user feedback submission to the *feedback_logs* collection.

    Args:
        user_id:            Firebase UID of the authenticated user.
        user_email:         User's email address (may be None).
        rating:             ``"positive"`` or ``"negative"``.
        translation_log_id: Firestore document ID of the related translation
                            log (may be None if the ID was never generated).
        comment:            Optional free-text comment from the user.

    Returns:
        The Firestore document ID on success, ``None`` on any failure.
    """
    db = get_db()
    if db is None:
        logger.warning("[DB] Firestore unavailable – skipping feedback log")
        return None

    try:
        doc_ref = db.collection("feedback_logs").document()
        doc_ref.set({
            "user_id": user_id,
            "user_email": user_email,
            "timestamp": datetime.now(timezone.utc),
            "translation_log_id": translation_log_id,
            "rating": rating,
            "comment": comment if comment else None,
        })
        logger.info(
            "[DB] Feedback logged for user %s → doc %s", user_id, doc_ref.id
        )
        return doc_ref.id
    except Exception as exc:
        logger.error("[DB] Failed to log feedback: %s", exc)
        return None


def get_feedback_logs(
    limit: int = 25, offset: int = 0
) -> tuple[list[dict], bool]:
    """Return a page of *feedback_logs* ordered by timestamp descending.

    Returns:
        ``(logs, has_more)`` – list of serialisable dicts and a boolean flag.
    """
    db = get_db()
    if db is None:
        return [], False
    try:
        docs = list(
            db.collection("feedback_logs")
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit + 1)
            .offset(offset)
            .stream()
        )
        has_more = len(docs) > limit
        return [
            {"id": doc.id, **_serialize_doc(doc.to_dict())} for doc in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch feedback logs: %s", exc)
        return [], False
