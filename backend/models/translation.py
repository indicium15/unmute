from typing import Dict, List, Optional

from pydantic import BaseModel

from models.common import Usage


class GlossRequest(BaseModel):
    text: str
    language: Optional[str] = None  # Language code (e.g., 'en', 'zh', 'ms', 'ta'). If None, auto-detects.


class GlossResult(BaseModel):
    gloss: List[str] = []
    unmatched: List[str] = []
    notes: Optional[str] = None
    detected_language: Optional[str] = None
    usage: Optional[Usage] = None
    error: Optional[str] = None


class TranscriptionResult(BaseModel):
    transcription: str = ""
    detected_language: Optional[str] = None
    usage: Optional[Usage] = None
    error: Optional[str] = None


class RenderPlanItem(BaseModel):
    token: str
    sign_name: Optional[str] = None
    type: str
    assets: Dict[str, str] = {}


class TranslateResponse(BaseModel):
    gloss: List[str]
    unmatched: List[str]
    plan: List[RenderPlanItem]
    notes: Optional[str] = None
    detected_language: Optional[str] = None
    log_doc_id: Optional[str] = None  # Firestore doc ID for feedback linkage


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
    plan: Optional[List[RenderPlanItem]] = None
    notes: Optional[str] = None
    log_doc_id: Optional[str] = None  # Firestore doc ID for feedback linkage (only when auto_translate=True)


class PoseFrame(BaseModel):
    pose: List[List[float]]


class SignLandmarkFrames(BaseModel):
    """Actual response shape of GET /api/sign/{sign_name}/landmarks."""
    pose_frames: List[PoseFrame]
    L_orig: Optional[int] = None
    L_max: Optional[int] = None


class FeedbackRequest(BaseModel):
    rating: str  # "positive" or "negative"
    log_doc_id: Optional[str] = None  # Firestore translation_logs document ID
    comment: Optional[str] = None
