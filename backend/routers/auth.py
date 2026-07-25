from fastapi import APIRouter, Depends, HTTPException

import utils.auth as auth_utils
import utils.llm as llm_utils
import utils.translation as translation_utils
from models.auth import (
    AllowlistRequest,
    DashboardStats,
    PasswordValidationRequest,
    TokenUsageStats,
)
from utils.auth import require_admin, verify_token

router = APIRouter()


# ── Auth / register ──────────────────────────────────────────────────────────

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
    and get back their current approval status. Rejects emails not on the allowlist
    (unless the user has the admin custom claim).
    """
    uid = user.get("uid")
    email = user.get("email")
    is_admin_user = user.get("admin") is True

    result = auth_utils.register_user(uid, email, initial_status="approved")
    return {"status": result.status, "is_admin": is_admin_user}


# ── Admin ─────────────────────────────────────────────────────────────────────

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
    """Return a paginated page of translation or transcription logs. Admin only."""
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
    """Return a paginated list of all registered users. Admin only."""
    if not (1 <= limit <= 100):
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    users, has_more = auth_utils.get_all_users(limit=limit, offset=offset)
    return {"users": users, "has_more": has_more}


@router.post("/api/admin/users/{target_uid}/revoke")
def admin_revoke_user(target_uid: str, _user: dict = Depends(require_admin)):
    """Revoke a user's access. Admin only."""
    ok = auth_utils.revoke_user(target_uid)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found or update failed")
    return {"success": True}


@router.get("/api/admin/stats", response_model=DashboardStats)
def admin_stats(_user: dict = Depends(require_admin)):
    """Return dashboard statistics. Admin only."""
    user_stats = auth_utils.get_user_stats()
    query_stats = translation_utils.get_query_stats()
    return DashboardStats(**user_stats, **query_stats)


@router.get("/api/admin/token-usage", response_model=TokenUsageStats)
def admin_token_usage(_user: dict = Depends(require_admin)):
    """Return LLM token usage stats (translate + transcribe) over time. Admin only.

    Exists because we have no direct access to the Azure OpenAI usage/billing
    dashboard - this is our own approximation from per-request usage figures.
    """
    return llm_utils.get_token_usage_stats()


@router.post("/api/admin/users/{target_uid}/grant-admin")
def admin_grant_admin(target_uid: str, user: dict = Depends(require_admin)):
    """Grant admin privileges (Firebase custom claim) to a user. Admin only."""
    ok = auth_utils.set_user_admin(target_uid, True, set_by=user.get("uid"))
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to grant admin privileges")
    return {"success": True}


@router.post("/api/admin/users/{target_uid}/revoke-admin")
def admin_revoke_admin_claim(target_uid: str, user: dict = Depends(require_admin)):
    """Revoke admin privileges (Firebase custom claim) from a user. Admin only."""
    ok = auth_utils.set_user_admin(target_uid, False, set_by=user.get("uid"))
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to revoke admin privileges")
    return {"success": True}


# ── Allowlist ─────────────────────────────────────────────────────────────────

@router.get("/api/admin/allowlist")
def admin_list_allowlist(
    limit: int = 100,
    offset: int = 0,
    _user: dict = Depends(require_admin),
):
    """Return the email allowlist. Admin only."""
    emails, has_more = auth_utils.get_allowed_emails(limit=limit, offset=offset)
    return {"emails": emails, "has_more": has_more}


@router.post("/api/admin/allowlist")
def admin_add_allowlist(req: AllowlistRequest, user: dict = Depends(require_admin)):
    """Add an email to the allowlist. Admin only."""
    ok = auth_utils.add_allowed_email(req.email, added_by=user.get("uid"))
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to add email to allowlist")
    return {"success": True, "email": req.email.strip().lower()}


@router.delete("/api/admin/allowlist/{email}")
def admin_remove_allowlist(email: str, _user: dict = Depends(require_admin)):
    """Remove an email from the allowlist. Admin only."""
    ok = auth_utils.remove_allowed_email(email)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to remove email from allowlist")
    return {"success": True}
