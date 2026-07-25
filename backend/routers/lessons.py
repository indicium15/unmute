from typing import List

from fastapi import APIRouter, Depends, HTTPException

import utils.lessons as lessons_utils
from models.lessons import LessonDetail, LessonProgress, LessonSummary, QuizAttemptRequest
from utils.auth import optional_approved_token, verify_approved_token

router = APIRouter()


# ── Static lesson content ───────────────────────────────────────────────────

@router.get("/api/learning/tag-config")
def get_tag_config(_user=Depends(optional_approved_token)):
    """Return display metadata (color, bg, border) for all known tags."""
    return lessons_utils.tag_config


@router.get("/api/learning/lessons", response_model=List[LessonSummary])
def get_lessons(_user=Depends(optional_approved_token)):
    """Return all lesson summaries (metadata + sign count, no GIF data)."""
    return lessons_utils.get_lesson_summaries()


@router.get("/api/learning/lessons/{lesson_id}", response_model=LessonDetail)
def get_lesson(lesson_id: str, _user=Depends(optional_approved_token)):
    """Return full lesson detail with resolved GIF URLs for all signs."""
    detail = lessons_utils.get_lesson_detail(lesson_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Lesson '{lesson_id}' not found")
    return detail


# ── Lesson progress ──────────────────────────────────────────────────────────
# All require a hard-verified, approved user (progress is inherently per-user)
# and write synchronously — the client needs the upserted doc echoed back
# immediately, unlike the fire-and-forget BackgroundTasks logging used for
# translation/transcription history.

@router.get("/api/learning/progress", response_model=List[LessonProgress])
def get_learning_progress(user: dict = Depends(verify_approved_token)):
    """Return all of the caller's lesson progress docs (drives landing-page stats)."""
    return lessons_utils.get_all_lesson_progress(user.get("uid"))


@router.get("/api/learning/lessons/{lesson_id}/progress", response_model=LessonProgress)
def get_single_lesson_progress(lesson_id: str, user: dict = Depends(verify_approved_token)):
    """Return the caller's progress for one lesson (empty default if untouched)."""
    progress = lessons_utils.get_lesson_progress(user.get("uid"), lesson_id)
    return progress or LessonProgress(lesson_id=lesson_id)


@router.post("/api/learning/lessons/{lesson_id}/signs/{token}/viewed", response_model=LessonProgress)
def mark_sign_viewed(lesson_id: str, token: str, user: dict = Depends(verify_approved_token)):
    """Mark a sign as viewed within a lesson for the calling user."""
    lesson = lessons_utils.get_lesson_by_id(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail=f"Lesson '{lesson_id}' not found")
    if token not in lesson.tokens:
        raise HTTPException(status_code=400, detail=f"Sign '{token}' is not part of lesson '{lesson_id}'")

    progress = lessons_utils.upsert_sign_progress(
        uid=user.get("uid"),
        lesson_id=lesson_id,
        token=token,
        total_signs=len(lesson.tokens),
    )
    if progress is None:
        raise HTTPException(status_code=503, detail="Unable to save progress")
    return progress


@router.post("/api/learning/lessons/{lesson_id}/quiz-attempt", response_model=LessonProgress)
def submit_quiz_attempt(lesson_id: str, req: QuizAttemptRequest, user: dict = Depends(verify_approved_token)):
    """Record a quiz attempt (score/total) for a lesson for the calling user."""
    lesson = lessons_utils.get_lesson_by_id(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail=f"Lesson '{lesson_id}' not found")
    if req.total <= 0 or not (0 <= req.score <= req.total):
        raise HTTPException(status_code=400, detail="Invalid score/total")

    progress = lessons_utils.record_quiz_attempt(
        uid=user.get("uid"), lesson_id=lesson_id, score=req.score, total=req.total
    )
    if progress is None:
        raise HTTPException(status_code=503, detail="Unable to save quiz attempt")
    return progress
