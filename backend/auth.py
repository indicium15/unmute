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
    """FastAPI dependency that verifies a Firebase ID token.

    Returns the decoded token payload (includes uid, email, etc.).
    Raises HTTP 401 if the token is missing or invalid.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decoded = auth.verify_id_token(credentials.credentials)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
