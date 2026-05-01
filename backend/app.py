from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os

import random

from vocab import vocab
from gemini_client import GeminiClient
from planner import build_render_plan
from sign_seq import SignSequenceManager
from gcs_storage import USE_GCS, get_dataset_info, get_static_url, GCS_SGLS_DATASET_ROOT
from auth import verify_token
import database

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Directories for sign language assets only (when not using GCS)
# When USE_GCS=true, assets are served directly from Google Cloud Storage
DATASET_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sgsl_dataset")
PROCESSED_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sgsl_processed")

if not USE_GCS:
    print("[App] Using local static file serving")
    if os.path.exists(DATASET_PATH):
        app.mount("/static/sgsl_dataset", StaticFiles(directory=DATASET_PATH), name="sgsl_dataset")
    if os.path.exists(PROCESSED_PATH):
        app.mount("/static/sgsl_processed", StaticFiles(directory=PROCESSED_PATH), name="sgsl_processed")
else:
    print(f"[App] Using GCS for static files: {get_dataset_info()['public_url']}")



# Components
gemini = GeminiClient()
sign_mgr = SignSequenceManager()

class GlossRequest(BaseModel):
    text: str
    language: Optional[str] = None  # Language code (e.g., 'en', 'zh', 'ms', 'ta'). If None, auto-detects.

class RenderPlanItem(BaseModel):
    token: str
    sign_name: Optional[str]
    type: str
    assets: Dict[str, str]

class TranslateResponse(BaseModel):
    gloss: List[str]
    unmatched: List[str]
    plan: List[Dict[str, Any]]
    notes: Optional[str] = None
    detected_language: Optional[str] = None
    log_doc_id: Optional[str] = None  # Firestore doc ID for feedback linkage

@app.get("/health")
def health():
    storage_info = get_dataset_info()
    return {
        "status": "ok", 
        "vocab_size": len(vocab.get_allowed_tokens()),
        "storage": storage_info,
    }

@app.post("/api/translate", response_model=TranslateResponse)
def translate(req: GlossRequest, background_tasks: BackgroundTasks, user: dict = Depends(verify_token)):
    # 1. Text to Gloss (Gemini) with language support
    print(f"Translating: {req.text} (language: {req.language or 'auto-detect'})")
    gloss_result = gemini.text_to_gloss(req.text, language=req.language)
    gloss_tokens = gloss_result.get("gloss", [])
    unmatched = gloss_result.get("unmatched", [])
    detected_language = gloss_result.get("detected_language")

    # 2. Gloss to Plan (Planner)
    plan = build_render_plan(gloss_tokens)

    # 3. Pre-generate the Firestore doc ID (local op, no network call) so it
    #    can be returned to the client for feedback linkage before the background
    #    write completes.
    db = database.get_db()
    log_doc_id = db.collection("translation_logs").document().id if db else None

    background_tasks.add_task(
        database.log_translation,
        user_id=user.get("uid"),
        user_email=user.get("email"),
        query_type="text",
        input_text=req.text,
        gemini_response=gloss_result,
        render_plan=plan,
        doc_id=log_doc_id,
    )

    return {
        "gloss": gloss_tokens,
        "unmatched": unmatched,
        "plan": plan,
        "notes": gloss_result.get("notes"),
        "detected_language": detected_language,
        "log_doc_id": log_doc_id,
    }

@app.get("/api/sign/{sign_name}/landmarks")
def get_landmarks(sign_name: str, _user: dict = Depends(verify_token)):
    """Return 3D full-body pose landmark frames for a sign."""
    pose_data = sign_mgr.get_sign_full_body_pose_frames(sign_name)
    
    if not pose_data:
        raise HTTPException(status_code=404, detail="Sign data not found")
    
    response = {
        "pose_frames": pose_data.get("frames", []),
        "L_orig": pose_data.get("L_orig"),
        "L_max": pose_data.get("L_max")
    }
    
    return response


class TranscribeRequest(BaseModel):
    audio_data: str  # Base64 encoded audio
    mime_type: str = "audio/webm"
    language: Optional[str] = None  # Language code (e.g., 'en', 'zh', 'ms', 'ta'). If None, auto-detects.
    auto_translate: bool = False  # If True, automatically translate transcription to sign language


class TranscribeResponse(BaseModel):
    transcription: str
    detected_language: Optional[str] = None
    gloss: Optional[List[str]] = None
    unmatched: Optional[List[str]] = None
    plan: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    log_doc_id: Optional[str] = None  # Firestore doc ID for feedback linkage (only when auto_translate=True)


@app.post("/api/transcribe")
async def transcribe_audio(req: TranscribeRequest, background_tasks: BackgroundTasks, user: dict = Depends(verify_token)):
    """
    Transcribe audio to text using Gemini Live API with automatic VAD.
    Supports multiple languages: English, Chinese, Malay, Tamil, and others.
    If auto_translate is True, automatically translates the transcription to sign language.

    Args:
        req: TranscribeRequest with audio_data, mime_type, optional language, and auto_translate flag
    """
    print(f"Received transcription request (audio mime_type: {req.mime_type}, language: {req.language or 'auto-detect'}, auto_translate: {req.auto_translate})")

    # Transcribe audio using Live API with VAD and language support
    result = await gemini.transcribe_audio_live(req.audio_data, req.mime_type, req.language)

    if "error" in result:
        # Fallback to standard transcription method if Live API fails
        print(f"Live API failed, falling back to standard transcription: {result['error']}")
        result = gemini.transcribe_audio(req.audio_data, req.mime_type, req.language)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

    transcription = result.get("transcription", "")
    detected_language = result.get("detected_language")
    print(f"Transcription: {transcription} (detected language: {detected_language})")

    # If auto_translate is enabled, automatically translate
    if req.auto_translate and transcription:
        print(f"Auto-translating: {transcription}")
        # Use detected language if available, otherwise use provided language or auto-detect
        translation_lang = detected_language or req.language
        gloss_result = gemini.text_to_gloss(transcription, language=translation_lang)
        gloss_tokens = gloss_result.get("gloss", [])
        unmatched = gloss_result.get("unmatched", [])

        # Build render plan
        plan = build_render_plan(gloss_tokens)

        # Pre-generate doc ID for feedback linkage
        db = database.get_db()
        log_doc_id = db.collection("translation_logs").document().id if db else None

        # Persist query, intermediate Gemini response, and output tokens to Firestore
        background_tasks.add_task(
            database.log_translation,
            user_id=user.get("uid"),
            user_email=user.get("email"),
            query_type="voice",
            input_text=transcription,
            gemini_response=gloss_result,
            render_plan=plan,
            doc_id=log_doc_id,
        )

        # Return full translation response
        return {
            "transcription": transcription,
            "detected_language": detected_language,
            "gloss": gloss_tokens,
            "unmatched": unmatched,
            "plan": plan,
            "notes": gloss_result.get("notes"),
            "log_doc_id": log_doc_id,
        }

    # Persist transcription-only result to Firestore
    background_tasks.add_task(
        database.log_transcription,
        user_id=user.get("uid"),
        user_email=user.get("email"),
        transcription=transcription,
        detected_language=detected_language,
    )

    # Return just transcription with detected language
    return {
        "transcription": transcription,
        "detected_language": detected_language
    }


# ── Learning / Quiz endpoint ──────────────────────────────────────────────────

def _learning_sign_item(token: str) -> Optional[Dict[str, str]]:
    sign_name = vocab.token_to_video_name(token)
    if not sign_name:
        return None
    return {
        "token": token,
        "sign_name": sign_name,
        "gif_url": get_static_url(f"{GCS_SGLS_DATASET_ROOT}/{sign_name}/{sign_name}.gif"),
    }


@app.get("/api/learning/signs")
def get_learning_signs(
    q: str = "",
    limit: int = 48,
    offset: int = 0,
    _user: dict = Depends(verify_token),
):
    """Return searchable sign vocabulary items for the learning experience."""
    if not (1 <= limit <= 100):
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be non-negative")

    query = q.strip().upper()
    tokens = sorted(vocab.get_allowed_tokens())
    if query:
        tokens = [token for token in tokens if query in token or query in (vocab.token_to_video_name(token) or "").upper()]

    total = len(tokens)
    page_tokens = tokens[offset : offset + limit]
    signs = [_learning_sign_item(token) for token in page_tokens]

    return {
        "signs": [item for item in signs if item is not None],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


@app.get("/api/learning/quiz")
def get_quiz(_user: dict = Depends(verify_token)):
    """Return a random sign GIF and 4 multiple-choice token options (1 correct, 3 wrong)."""
    tokens = vocab.get_allowed_tokens()
    if len(tokens) < 4:
        raise HTTPException(status_code=500, detail="Vocabulary too small for a quiz")

    correct_token = random.choice(tokens)
    correct_item = _learning_sign_item(correct_token)
    if not correct_item:
        raise HTTPException(status_code=500, detail="Unable to resolve quiz sign")

    wrong_tokens = random.sample([t for t in tokens if t != correct_token], 3)
    options = wrong_tokens + [correct_token]
    random.shuffle(options)

    return {
        "correct_token": correct_token,
        "sign_name": correct_item["sign_name"],
        "gif_url": correct_item["gif_url"],
        "options": options,
    }


# ── Feedback endpoint ─────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    rating: str  # "positive" or "negative"
    log_doc_id: Optional[str] = None  # Firestore translation_logs document ID
    comment: Optional[str] = None


@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest, user: dict = Depends(verify_token)):
    """Store a thumbs-up / thumbs-down rating (with optional comment) for a
    translation.  The ``log_doc_id`` links the feedback to the original entry
    in *translation_logs*.
    """
    if req.rating not in ("positive", "negative"):
        raise HTTPException(
            status_code=400, detail="rating must be 'positive' or 'negative'"
        )

    doc_id = database.log_feedback(
        user_id=user.get("uid"),
        user_email=user.get("email"),
        rating=req.rating,
        translation_log_id=req.log_doc_id,
        comment=req.comment,
    )
    return {"success": doc_id is not None}


# ── Admin endpoints ───────────────────────────────────────────────────────────

@app.get("/api/admin/check")
def admin_check(user: dict = Depends(verify_token)):
    """Return whether the authenticated user has admin privileges."""
    return {"is_admin": database.is_admin(user.get("uid"))}


@app.get("/api/admin/logs")
def admin_logs(
    log_type: str = "translation",
    limit: int = 25,
    offset: int = 0,
    user: dict = Depends(verify_token),
):
    """Return a paginated page of translation or transcription logs.

    Only accessible to users whose UID exists in the Firestore ``admins``
    collection.  Raises HTTP 403 otherwise.
    """
    if not database.is_admin(user.get("uid")):
        raise HTTPException(status_code=403, detail="Admin access required")
    if not (1 <= limit <= 100):
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be non-negative")

    if log_type == "translation":
        logs, has_more = database.get_translation_logs(limit=limit, offset=offset)
    elif log_type == "transcription":
        logs, has_more = database.get_transcription_logs(limit=limit, offset=offset)
    elif log_type == "feedback":
        logs, has_more = database.get_feedback_logs(limit=limit, offset=offset)
    else:
        raise HTTPException(status_code=400, detail="log_type must be 'translation', 'transcription', or 'feedback'")

    return {"logs": logs, "has_more": has_more}


# Frontend is now served separately via Vite dev server (unmute-fe)
