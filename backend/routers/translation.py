from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response

from models.translation import (
    FeedbackRequest,
    GlossRequest,
    SignLandmarkFrames,
    TranscribeRequest,
    TranscribeResponse,
    TranslateResponse,
)
from utils.auth import optional_approved_token
from utils.gcp import get_db
from utils.llm import llm_client, log_token_usage
from utils.rate_limit import limiter
from utils.translation import build_render_plan, log_feedback, log_transcription, log_translation, sign_mgr

router = APIRouter()


@router.post("/api/translate", response_model=TranslateResponse)
@limiter.limit("5/minute;30/hour")
def translate(request: Request, response: Response, req: GlossRequest, background_tasks: BackgroundTasks, _user: Optional[dict] = Depends(optional_approved_token)):
    # 1. Text to Gloss (language auto-detected by the LLM)
    print(f"Translating: {req.text}")
    gloss_result = llm_client.text_to_gloss(req.text)
    if gloss_result.error:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini translation failed: {gloss_result.error}",
        )

    # 2. Gloss to Plan
    plan = build_render_plan(gloss_result.gloss)

    # 3. Pre-generate the Firestore doc ID (local op, no network call) so it
    #    can be returned to the client for feedback linkage before the background
    #    write completes.
    db = get_db()
    log_doc_id = db.collection("translation_logs").document().id if db else None

    background_tasks.add_task(
        log_translation,
        query_type="text",
        input_text=req.text,
        gemini_response=gloss_result,
        render_plan=plan,
        doc_id=log_doc_id,
    )

    if gloss_result.usage:
        background_tasks.add_task(log_token_usage, endpoint="translate", usage=gloss_result.usage)

    return TranslateResponse(
        gloss=gloss_result.gloss,
        unmatched=gloss_result.unmatched,
        plan=plan,
        notes=gloss_result.notes,
        detected_language=gloss_result.detected_language,
        log_doc_id=log_doc_id,
    )


@router.get("/api/sign/{sign_name}/landmarks")
def get_landmarks(sign_name: str, _user: Optional[dict] = Depends(optional_approved_token)) -> SignLandmarkFrames:
    """Return 3D full-body pose landmark frames for a sign."""
    pose_data = sign_mgr.get_sign_full_body_pose_frames(sign_name)

    if not pose_data:
        raise HTTPException(status_code=404, detail="Sign data not found")

    return SignLandmarkFrames(
        pose_frames=pose_data.get("frames", []),
        L_orig=pose_data.get("L_orig"),
        L_max=pose_data.get("L_max"),
    )


@router.post("/api/transcribe")
@limiter.limit("3/minute;20/hour")
async def transcribe_audio(request: Request, response: Response, req: TranscribeRequest, background_tasks: BackgroundTasks, _user: Optional[dict] = Depends(optional_approved_token)):
    """
    Transcribe audio to text using the realtime Whisper API with automatic VAD.
    Supports multiple languages: English, Chinese, Malay, Tamil, and others.
    If auto_translate is True, automatically translates the transcription to sign language.
    """
    print(f"Received transcription request (audio mime_type: {req.mime_type}, language: {req.language or 'auto-detect'}, auto_translate: {req.auto_translate})")

    # Transcribe audio using the realtime API with VAD and language support
    result = await llm_client.transcribe_audio_live(req.audio_data, req.mime_type, req.language)

    if result.error:
        # Realtime websocket failures are often transient (Azure drops the
        # connection right after the handshake on occasion) - retry once
        # before giving up. Config/input errors will fail identically on
        # retry, so skip the retry and surface them immediately.
        permanent_error = result.error.startswith("No API key") or result.error.startswith("Failed to decode audio")
        if permanent_error:
            raise HTTPException(status_code=400, detail=result.error)
        print(f"Live API transcription failed, retrying once: {result.error}")
        result = await llm_client.transcribe_audio_live(req.audio_data, req.mime_type, req.language)
        if result.error:
            raise HTTPException(status_code=400, detail=result.error)

    transcription = result.transcription
    detected_language = result.detected_language
    print(f"Transcription: {transcription} (detected language: {detected_language})")

    if result.usage:
        background_tasks.add_task(log_token_usage, endpoint="transcribe", usage=result.usage)

    # If auto_translate is enabled, automatically translate
    if req.auto_translate and transcription:
        print(f"Auto-translating: {transcription}")
        gloss_result = llm_client.text_to_gloss(transcription)

        # Build render plan
        plan = build_render_plan(gloss_result.gloss)

        # Pre-generate doc ID for feedback linkage
        db = get_db()
        log_doc_id = db.collection("translation_logs").document().id if db else None

        # Persist query, intermediate LLM response, and output tokens to Firestore
        background_tasks.add_task(
            log_translation,
            query_type="voice",
            input_text=transcription,
            gemini_response=gloss_result,
            render_plan=plan,
            doc_id=log_doc_id,
        )

        if gloss_result.usage:
            background_tasks.add_task(log_token_usage, endpoint="translate", usage=gloss_result.usage)

        # Return full translation response
        return TranscribeResponse(
            transcription=transcription,
            detected_language=detected_language,
            gloss=gloss_result.gloss,
            unmatched=gloss_result.unmatched,
            plan=plan,
            notes=gloss_result.notes,
            log_doc_id=log_doc_id,
        )

    # Persist transcription-only result to Firestore
    background_tasks.add_task(
        log_transcription,
        transcription=transcription,
        detected_language=detected_language,
    )

    # Return just transcription with detected language
    return TranscribeResponse(transcription=transcription, detected_language=detected_language)


@router.post("/api/feedback")
def submit_feedback(req: FeedbackRequest):
    """Store a thumbs-up / thumbs-down rating (with optional comment) for a
    translation.  The ``log_doc_id`` links the feedback to the original entry
    in *translation_logs*.
    """
    if req.rating not in ("positive", "negative"):
        raise HTTPException(
            status_code=400, detail="rating must be 'positive' or 'negative'"
        )

    doc_id = log_feedback(
        rating=req.rating,
        translation_log_id=req.log_doc_id,
        comment=req.comment,
    )
    return {"success": doc_id is not None}
