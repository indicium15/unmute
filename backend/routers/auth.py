from fastapi import APIRouter, Depends, HTTPException

import utils.auth as auth_utils
import utils.llm as llm_utils
import utils.translation as translation_utils
from models.auth import (
    DashboardStats,
    PasswordValidationRequest,
    TokenUsageStats,
)
from utils.auth import require_admin, verify_token

router = APIRouter()


@router.post("/api/auth/validate-password")
def validate_password(req: PasswordValidationRequest):
    """Validate password strength before account creation."""
    validation_error = auth_utils.validate_password_strength(req.password, req.email)
    if validation_error:
        raise HTTPException(status_code=400, detail=validation_error)
    return {"valid": True}


@router.post("/api/auth/register")
def register_user(user: dict = Depends(verify_token)):
    """Register a new user (or return their existing status). No approval required.

    Called by the frontend after Firebase signup/login to sync the user record
    and get back their current approval status. All new users are auto-approved.
    """
    uid = user.get("uid")
    email = user.get("email")
    is_admin_user = user.get("admin") is True

    result = auth_utils.register_user(uid, email)
    return {"status": result.status, "is_admin": is_admin_user}


@router.get("/api/admin/check")
def admin_check(user: dict = Depends(verify_token)):
    """Return whether the authenticated user has admin privileges."""
    return {"is_admin": user.get("admin") is True}

@router.get("/api/admin/logs")
def admin_logs(
    log_type: str = "translation",
    limit: int = 25,
    offset: int = 0,
    _user: dict = Depends(require_admin),
):
    """Return a paginated page of translation or transcription logs."""
    if not (1 <= limit <= 100):
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be non-negative")

    if log_type == "translation":
        logs, has_more = translation_utils.get_translation_logs(limit=limit, offset=offset)
    elif log_type == "transcription":
        logs, has_more = translation_utils.get_transcription_logs(limit=limit, offset=offset)
    elif log_type == "feedback":
        logs, has_more = translation_utils.get_feedback_logs(limit=limit, offset=offset)
    else:
        raise HTTPException(status_code=400, detail="log_type must be 'translation', 'transcription', or 'feedback'")

    return {"logs": logs, "has_more": has_more}


@router.get("/api/admin/users")
def admin_list_users(
    limit: int = 50,
    offset: int = 0,
    _user: dict = Depends(require_admin),
):
    """Return a paginated list of all registered users"""
    if not (1 <= limit <= 100):
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    users, has_more = auth_utils.get_all_users(limit=limit, offset=offset)
    return {"users": users, "has_more": has_more}


@router.post("/api/admin/users/{target_uid}/revoke")
def admin_revoke_user(target_uid: str, _user: dict = Depends(require_admin)):
    """Revoke a user's access"""
    ok = auth_utils.revoke_user(target_uid)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found or update failed")
    return {"success": True}


@router.get("/api/admin/stats", response_model=DashboardStats)
def admin_stats(_user: dict = Depends(require_admin)):
    """Return dashboard statistics"""
    user_stats = auth_utils.get_user_stats()
    query_stats = translation_utils.get_query_stats()
    return DashboardStats(**user_stats, **query_stats)


@router.get("/api/admin/token-usage", response_model=TokenUsageStats)
def admin_token_usage(_user: dict = Depends(require_admin)):
    """Return LLM token usage stats (translate + transcribe) over time."""
    return llm_utils.get_token_usage_stats()


@router.post("/api/admin/users/{target_uid}/grant-admin")
def admin_grant_admin(target_uid: str, user: dict = Depends(require_admin)):
    """Grant admin privileges to a user."""
    ok = auth_utils.set_user_admin(target_uid, True, set_by=user.get("uid"))
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to grant admin privileges")
    return {"success": True}


@router.post("/api/admin/users/{target_uid}/revoke-admin")
def admin_revoke_admin_claim(target_uid: str, user: dict = Depends(require_admin)):
    """Revoke admin privileges from a user."""
    ok = auth_utils.set_user_admin(target_uid, False, set_by=user.get("uid"))
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to revoke admin privileges")
    return {"success": True}
