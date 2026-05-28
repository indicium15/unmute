#!/usr/bin/env python3
"""Set admin=True custom claim on a Firebase user by email.

Usage (with backend venv active, from repo root):
    python scripts/set_admin_claim.py chaitanyajadhav@better.sg

The user must already exist in Firebase Auth (sign up via the app first).
After running, the user must sign out and back in for the claim to appear in their token.
"""
import sys
import os
import json
import firebase_admin
from firebase_admin import credentials, auth


def init_firebase():
    if firebase_admin._apps:
        return
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
    elif (path := os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")) and os.path.exists(path):
        cred = credentials.Certificate(path)
    else:
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)


def set_admin_claim(email: str) -> None:
    init_firebase()
    user = auth.get_user_by_email(email)
    auth.set_custom_user_claims(user.uid, {"admin": True})
    print(f"[OK] Set admin=True on {email} (uid={user.uid})")
    print("     Sign out and back in for the claim to appear in the token.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <email>")
        sys.exit(1)
    set_admin_claim(sys.argv[1])
