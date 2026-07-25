"""Firebase ID token verification, the user-approval workflow (users
Firestore collection), and password strength validation.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

from models.auth import RegisterResult, UserRecord
from utils.gcp import AUTH_ENABLED, get_db, serialize_doc

logger = logging.getLogger(__name__)

_DEMO_USER = {"uid": "demo", "email": "demo@kinnect.app", "admin": False}

_security = HTTPBearer(auto_error=False)


def verify_token(credentials: HTTPAuthorizationCredentials = Security(_security)) -> dict:
    """Verify a Firebase ID token and return the decoded payload.

    Does NOT check approval status — use for admin routes or the register endpoint.
    """
    if not AUTH_ENABLED:
        return _DEMO_USER
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return firebase_auth.verify_id_token(credentials.credentials)
    except Exception as exc:
        print(f"[Auth] Firebase ID token verification failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def optional_approved_token(credentials: HTTPAuthorizationCredentials = Security(_security)):
    """Optionally verify a Firebase ID token. Returns None if no credentials provided.

    Use for endpoints that are public but can also accept authenticated users.
    """
    if not AUTH_ENABLED:
        return _DEMO_USER
    if not credentials:
        return None
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
    except Exception as exc:
        print(f"[Auth] Firebase ID token verification failed: {type(exc).__name__}: {exc}")
        return None

    if not is_approved_user(decoded.get("uid"), decoded):
        return None

    return decoded


def verify_approved_token(credentials: HTTPAuthorizationCredentials = Security(_security)) -> dict:
    """Verify a Firebase ID token AND check that the user is approved.

    Raises HTTP 403 if the account is pending or revoked.
    Use this for all user-facing API endpoints.
    """
    if not AUTH_ENABLED:
        return _DEMO_USER
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
    except Exception as exc:
        print(f"[Auth] Firebase ID token verification failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not is_approved_user(decoded.get("uid"), decoded):
        raise HTTPException(status_code=403, detail="Account pending approval")

    return decoded


def require_admin(user: dict = Depends(verify_token)) -> dict:
    """Hard-require the admin custom claim. Use for every /api/admin/* route."""
    if not (user.get("admin") is True):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Password validation ─────────────────────────────────────────────────────

def validate_password_strength(password: str, email: Optional[str] = None) -> Optional[str]:
    """Return a validation error string when weak; otherwise None."""
    if len(password) < 10:
        return "Password must be at least 10 characters long."
    if not re.search(r"[A-Z]", password):
        return "Password must include at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must include at least one lowercase letter."
    if not re.search(r"\d", password):
        return "Password must include at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must include at least one special character."
    if re.search(r"\s", password):
        return "Password must not contain spaces."
    if email:
        local_part = email.split("@")[0].strip().lower()
        if local_part and local_part in password.lower():
            return "Password must not contain your email name."
    return None


# ── User management (approval workflow) ─────────────────────────────────────

def register_user(uid: str, email: Optional[str]) -> RegisterResult:
    """Upsert a user into the ``users`` collection, approved by default."""
    db = get_db()
    if db is None:
        return RegisterResult(is_new=False, status="approved")
    try:
        doc_ref = db.collection("users").document(uid)
        doc = doc_ref.get()
        if doc.exists:
            return RegisterResult(is_new=False, status=doc.to_dict().get("status", "approved"))
        doc_ref.set({
            "uid": uid,
            "email": email,
            "status": "approved",
            "registered_at": datetime.now(timezone.utc),
        })
        logger.info("[DB] Registered new user %s with status=approved", uid)
        return RegisterResult(is_new=True, status="approved")
    except Exception as exc:
        logger.error("[DB] Failed to register user %s: %s", uid, exc)
        return RegisterResult(is_new=False, status="approved")


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


def get_all_users(limit: int = 50, offset: int = 0) -> tuple[list[UserRecord], bool]:
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
            UserRecord(id=doc.id, **serialize_doc(doc.to_dict())) for doc in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch users: %s", exc)
        return [], False


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


def set_user_admin(uid: str, is_admin: bool, set_by: Optional[str] = None) -> bool:
    """Set or remove the ``admin`` Firebase custom claim and mirror it to Firestore."""
    try:
        user_record = firebase_auth.get_user(uid)
        claims = dict(user_record.custom_claims or {})
        if is_admin:
            claims["admin"] = True
        else:
            claims.pop("admin", None)
        firebase_auth.set_custom_user_claims(uid, claims)

        db = get_db()
        if db is not None:
            update: dict = {"is_admin": is_admin, "admin_updated_at": datetime.now(timezone.utc)}
            if set_by:
                update["admin_set_by"] = set_by
            db.collection("users").document(uid).update(update)

        logger.info("[DB] Admin claim set to %s for user %s (by %s)", is_admin, uid, set_by)
        return True
    except Exception as exc:
        logger.error("[DB] Failed to set admin claim for %s: %s", uid, exc)
        return False


def get_user_stats() -> dict:
    """Users-collection half of the admin dashboard stats; composed with
    utils.translation.get_query_stats() by routers/auth.py into DashboardStats.
    """
    db = get_db()
    if db is None:
        return {"total_users": 0, "active_users_30d": 0}

    from datetime import timedelta

    try:
        total_users = len(list(db.collection("users").stream()))

        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        # translation_logs no longer carries a user_id (the translate page is
        # accessible without login), so "active users" is measured via lesson
        # activity instead - login is still required there.
        active_user_ids: set[str] = {
            doc.reference.parent.parent.id
            for doc in db.collection_group("lesson_progress")
            .where("updated_at", ">=", cutoff)
            .stream()
        }

        return {"total_users": total_users, "active_users_30d": len(active_user_ids)}
    except Exception as exc:
        logger.error("[DB] Failed to get user stats: %s", exc)
        return {"total_users": 0, "active_users_30d": 0}
