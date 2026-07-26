"""Deliver lesson content loaded from content/lessons/*.json + content/tag_config.json
and per-user lesson progress from Firestore.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from models.lessons import LessonDetail, LessonJSON, LessonProgress, LessonSummary
from utils.dictionary import get_sign_detail, vocab
from utils.gcp import get_db, serialize_doc
from firebase_admin import firestore

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_LESSONS_DIR = _BACKEND_ROOT / "content" / "lessons"
_TAG_CONFIG_PATH = _BACKEND_ROOT / "content" / "tag_config.json"


def _load_lessons() -> List[LessonJSON]:
    loaded = []
    for path in sorted(_LESSONS_DIR.glob("*.json")):
        with open(path, "r", encoding="utf-8") as f:
            lesson = LessonJSON.model_validate(json.load(f))
        for token in lesson.tokens:
            if not vocab.validate_token(token):
                print(f"[Lessons] WARNING: unknown token '{token}' in '{path.name}'")
        loaded.append(lesson)
    loaded.sort(key=lambda l: (l.order, l.lesson_id))
    return loaded


def _load_tag_config() -> dict:
    with open(_TAG_CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


lessons: List[LessonJSON] = _load_lessons()
tag_config: dict = _load_tag_config()


def get_lesson_by_id(lesson_id: str) -> Optional[LessonJSON]:
    return next((l for l in lessons if l.lesson_id == lesson_id), None)


def get_lesson_summaries() -> List[LessonSummary]:
    """Return all lesson metada and sign counts"""
    return [
        LessonSummary(
            lesson_id=lesson.lesson_id,
            lesson_name=lesson.lesson_name,
            description=lesson.description,
            emoji=lesson.emoji,
            sign_count=len(lesson.tokens),
            difficulty=lesson.difficulty,
            tags=lesson.tags,
        )
        for lesson in lessons
    ]


def get_lesson_detail(lesson_id: str) -> Optional[LessonDetail]:
    """Return full lesson detail with GIF URLs for all signs."""
    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        return None

    signs = []
    for token in lesson.tokens:
        item = get_sign_detail(token)
        if item:
            signs.append(item)
        else:
            print(f"[Lessons] Skipping unresolvable token '{token}' in '{lesson_id}'")

    return LessonDetail(
        lesson_id=lesson.lesson_id,
        lesson_name=lesson.lesson_name,
        description=lesson.description,
        emoji=lesson.emoji,
        difficulty=lesson.difficulty,
        tags=lesson.tags,
        signs=signs,
    )


# ── Lesson progress ───────────────────────────────────────────────────────────
# Stored as a subcollection users/{uid}/lesson_progress/{lesson_id} rather than a
# nested map on the users/{uid} doc — keeps writes to one lesson from contending
# with (or bloating reads of) another, and keeps the identity doc small for the
# admin user listing.

def _lesson_progress_ref(uid: str, lesson_id: str):
    db = get_db()
    if db is None:
        return None
    return db.collection("users").document(uid).collection("lesson_progress").document(lesson_id)


def get_lesson_progress(uid: str, lesson_id: str) -> Optional[LessonProgress]:
    """Return a single lesson's progress doc for a user, or None if untouched."""
    ref = _lesson_progress_ref(uid, lesson_id)
    if ref is None:
        return None
    try:
        doc = ref.get()
        return LessonProgress(**serialize_doc(doc.to_dict())) if doc.exists else None
    except Exception as exc:
        logger.error("[DB] Failed to get lesson progress for %s/%s: %s", uid, lesson_id, exc)
        return None


def get_all_lesson_progress(uid: str) -> List[LessonProgress]:
    """Return every lesson_progress doc for a user (drives landing-page stats)."""
    db = get_db()
    if db is None:
        return []
    try:
        docs = db.collection("users").document(uid).collection("lesson_progress").stream()
        return [LessonProgress(lesson_id=doc.id, **serialize_doc(doc.to_dict())) for doc in docs]
    except Exception as exc:
        logger.error("[DB] Failed to get all lesson progress for %s: %s", uid, exc)
        return []


def upsert_sign_progress(uid: str, lesson_id: str, token: str, total_signs: int) -> Optional[LessonProgress]:
    """Mark a sign as viewed within a lesson; flips ``completed`` once every token
    in the lesson has been viewed at least once.
    """
    ref = _lesson_progress_ref(uid, lesson_id)
    if ref is None:
        return None
    try:
        now = datetime.now(timezone.utc)
        is_new = not ref.get().exists

        ref.set({
            "lesson_id": lesson_id,
            "signs_viewed": firestore.ArrayUnion([token]),
            "updated_at": now,
            **({"created_at": now, "completed": False} if is_new else {}),
        }, merge=True)

        data = ref.get().to_dict()
        signs_viewed = data["signs_viewed"]
        if len(signs_viewed) >= total_signs and not data.get("completed"):
            ref.update({"completed": True, "completed_at": now})
            data["completed"] = True
            data["completed_at"] = now

        logger.info("[DB] Sign '%s' marked viewed for user %s in lesson %s", token, uid, lesson_id)
        return LessonProgress(**serialize_doc(data))
    except Exception as exc:
        logger.error("[DB] Failed to upsert sign progress for %s/%s/%s: %s", uid, lesson_id, token, exc)
        return None


def record_quiz_attempt(uid: str, lesson_id: str, score: int, total: int) -> Optional[LessonProgress]:
    """Record a quiz attempt for a lesson, increment the attempt count and update the best score."""
    ref = _lesson_progress_ref(uid, lesson_id)
    if ref is None:
        return None
    try:

        now = datetime.now(timezone.utc)
        transaction = get_db().transaction()

        @firestore.transactional
        def _apply(transaction):
            snapshot = ref.get(transaction=transaction)
            data = snapshot.to_dict() if snapshot.exists else {}
            best_score = data.get("quiz_best_score", -1)
            update = {
                "lesson_id": lesson_id,
                "quiz_attempts": firestore.Increment(1),
                "last_quiz_score": score,
                "last_quiz_total": total,
                "last_attempted_at": now,
                "updated_at": now,
            }
            if not data:
                update["created_at"] = now
                update["signs_viewed"] = []
                update["completed"] = False
            if score > best_score:
                update["quiz_best_score"] = score
                update["quiz_best_total"] = total
            transaction.set(ref, update, merge=True)

        _apply(transaction)

        logger.info("[DB] Quiz attempt recorded for user %s in lesson %s: %d/%d", uid, lesson_id, score, total)
        return LessonProgress(**serialize_doc(ref.get().to_dict()))
    except Exception as exc:
        logger.error("[DB] Failed to record quiz attempt for %s/%s: %s", uid, lesson_id, exc)
        return None
