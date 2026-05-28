import os
import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_security = HTTPBearer(auto_error=False)

def _init_firebase():
    if firebase_admin._apps:
        return
    # Option 1: inline JSON via env var (avoids Secret Manager)
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_json:
        import json
        cred = credentials.Certificate(json.loads(service_account_json))
    # Option 2: path to a mounted key file
    elif (service_account_path := os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")) and os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
    # Option 3: Application Default Credentials
    else:
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)

_init_firebase()


def verify_token(credentials: HTTPAuthorizationCredentials = Security(_security)) -> dict:
    """Verify a Firebase ID token and return the decoded payload.

    Does NOT check approval status — use for admin routes or the register endpoint.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decoded = auth.verify_id_token(credentials.credentials)
        return decoded
    except Exception as exc:
        print(f"[Auth] Firebase ID token verification failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def verify_approved_token(credentials: HTTPAuthorizationCredentials = Security(_security)) -> dict:
    """Verify a Firebase ID token AND check that the user is approved.

    Raises HTTP 403 if the account is pending or revoked.
    Use this for all user-facing API endpoints.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except Exception as exc:
        print(f"[Auth] Firebase ID token verification failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    import database as db_module
    if not db_module.is_approved_user(decoded.get("uid"), decoded):
        raise HTTPException(status_code=403, detail="Account pending approval")

    return decoded
