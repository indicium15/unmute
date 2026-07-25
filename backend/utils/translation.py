"""Gloss-token → render-plan resolution, sign landmark pickle loading, and
Firestore logging for translation/transcription/feedback (backing the admin
logs + dashboard endpoints).
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import numpy as np

from models.auth import QueryDayCount
from models.translation import GlossResult, RenderPlanItem
from utils.dictionary import vocab
from utils.gcp import GCS_SGLS_DATASET_ROOT, get_db, get_static_url, read_pickle, serialize_doc

logger = logging.getLogger(__name__)


def build_render_plan(gloss_tokens: List[str]) -> List[RenderPlanItem]:
    """Convert a list of gloss tokens into a rendering plan with asset URLs."""
    plan = []

    for token in gloss_tokens:
        sign_name = vocab.token_to_video_name(token)

        if sign_name:
            plan.append(RenderPlanItem(
                token=token,
                sign_name=sign_name,
                type="sign",
                assets={
                    "gif": get_static_url(f"{GCS_SGLS_DATASET_ROOT}/{sign_name}/primary.gif"),
                    "pkl": get_static_url(f"sgsl_processed/landmarks_pkl/{sign_name}.pkl"),
                },
            ))
        else:
            plan.append(RenderPlanItem(token=token, sign_name=None, type="text", assets={}))

    return plan


# ── Sign landmark pickles ────────────────────────────────────────────────────

GCS_PKL_PREFIX = "sgsl_processed/landmarks_pkl"


class SignSequenceManager:
    def __init__(self):
        print(f"[SignSequenceManager] Loading landmark pickles from GCS: {GCS_PKL_PREFIX}")

    def _load_pkl_data(self, sign_name: str):
        """Load pickle data from GCS."""
        gcs_path = f"{GCS_PKL_PREFIX}/{sign_name}.pkl"
        print(f"[SignSequenceManager] Loading from GCS: {gcs_path}")
        data = read_pickle(gcs_path)
        if data is None:
            print(f"[SignSequenceManager] Sign data not found in GCS for {sign_name}")
        return data

    def _load_pkl_data_full_body_pose(self, sign_name: str):
        """Load full-body pose pickle data from GCS."""
        pose_filename = f"{sign_name}_full_body_pose.pkl"
        gcs_path = f"{GCS_PKL_PREFIX}/{pose_filename}"
        print(f"[SignSequenceManager] Loading full-body pose from GCS: {gcs_path}")
        data = read_pickle(gcs_path)
        if data is None:
            print(f"[SignSequenceManager] Full-body pose data not found in GCS for {sign_name}")
        return data

    def get_sign_frames(self, sign_name: str):
        """
        Load frames for a given sign.
        Returns: {
            "frames": [
                { "left": [[x,y,z]...], "right": [[x,y,z]...] },
                ...
            ],
            "L_orig": int,
            "L_max": int
        }
        """
        data = self._load_pkl_data(sign_name)
        if data is None:
            return None

        # Data X is (L, 126).
        # 0-62 = Left flattened. 63-125 = Right flattened.
        X = data["X"]
        L, D = X.shape

        # Filter out zero-padded frames first
        non_zero_frames = []
        for t in range(L):
            row = X[t]
            if np.any(row != 0):
                non_zero_frames.append(row)

        if len(non_zero_frames) == 0:
            print(f"[get_sign_frames] {sign_name}: No non-zero frames found")
            return None

        # Stack into array for normalization
        X_filtered = np.array(non_zero_frames)

        # Normalize to 0-1 range
        # Find global min/max across all non-zero values
        X_nonzero = X_filtered[X_filtered != 0]
        if len(X_nonzero) > 0:
            x_min = X_nonzero.min()
            x_max = X_nonzero.max()
            print(f"[get_sign_frames] {sign_name}: Data range [{x_min:.4f}, {x_max:.4f}]")

            # Normalize: (x - min) / (max - min)
            X_normalized = np.zeros_like(X_filtered)
            mask = X_filtered != 0
            X_normalized[mask] = (X_filtered[mask] - x_min) / (x_max - x_min)
        else:
            X_normalized = X_filtered

        # Convert to frames
        frames_out = []
        for row in X_normalized:
            lh_flat = row[:63]
            rh_flat = row[63:]

            # Reshape (21, 3)
            lh = np.round(lh_flat.reshape(21, 3), 4).tolist()
            rh = np.round(rh_flat.reshape(21, 3), 4).tolist()

            frames_out.append({
                "left": lh,
                "right": rh
            })

        print(f"[get_sign_frames] {sign_name}: {len(frames_out)} non-zero frames out of {L} total")

        return {
            "frames": frames_out,
            "L_orig": data.get("L_orig", L),
            "L_max": data.get("L_max", L)
        }

    def get_sign_pose_frames(self, sign_name: str):
        """
        Load full body pose frames for a given sign.
        Checks for {sign_name}.pkl and converts hand data to pose-like format.
        Returns: {
            "frames": [
                { "pose": [[x,y,z]...] },  # landmarks per frame
                ...
            ],
            "L_orig": int,
            "L_max": int
        }
        """
        data = self._load_pkl_data(sign_name)
        if data is None:
            return None

        X = data["X"]
        L, D = X.shape
        print(f"Data shape: ({L}, {D})")

        # Check data format based on dimension
        if D == 99:
            # Full body pose data: 33 landmarks × 3 coordinates
            frames_out = []
            for t in range(L):
                row = X[t]
                pose = np.round(row.reshape(33, 3), 4).tolist()
                frames_out.append({"pose": pose})

            return {
                "frames": frames_out,
                "L_orig": data.get("L_orig", L),
                "L_max": data.get("L_max", L)
            }
        elif D == 126:
            # Hand-only data: 21 landmarks × 3 coordinates × 2 hands
            # Convert to a format with left and right hand landmarks
            print(f"Converting hand data (126 elements) to pose format")

            # Filter out zero-padded frames first
            non_zero_frames = []
            for t in range(L):
                row = X[t]
                if np.any(row != 0):
                    non_zero_frames.append(row)

            if len(non_zero_frames) == 0:
                print(f"[get_sign_pose_frames] {sign_name}: No non-zero frames found")
                return None

            # Stack into array for normalization
            X_filtered = np.array(non_zero_frames)

            # Normalize to 0-1 range
            X_nonzero = X_filtered[X_filtered != 0]
            if len(X_nonzero) > 0:
                x_min = X_nonzero.min()
                x_max = X_nonzero.max()
                print(f"[get_sign_pose_frames] {sign_name}: Data range [{x_min:.4f}, {x_max:.4f}]")

                # Normalize: (x - min) / (max - min)
                X_normalized = np.zeros_like(X_filtered)
                mask = X_filtered != 0
                X_normalized[mask] = (X_filtered[mask] - x_min) / (x_max - x_min)
            else:
                X_normalized = X_filtered

            # Convert to frames
            frames_out = []
            for row in X_normalized:
                lh_flat = row[:63]
                rh_flat = row[63:]

                # Reshape to (21, 3) for each hand
                lh = np.round(lh_flat.reshape(21, 3), 4).tolist()
                rh = np.round(rh_flat.reshape(21, 3), 4).tolist()

                frames_out.append({
                    "left_hand": lh,
                    "right_hand": rh
                })

            print(f"[get_sign_pose_frames] {sign_name}: {len(frames_out)} non-zero frames out of {L} total")

            return {
                "frames": frames_out,
                "L_orig": data.get("L_orig", L),
                "L_max": data.get("L_max", L),
                "format": "hands"  # Indicate this is hand data
            }
        else:
            print(f"Unknown data format with {D} elements")
            return None

    def get_sign_full_body_pose_frames(self, sign_name: str):
        """
        Load full body pose frames from {sign_name}_full_body_pose.pkl.
        Returns raw 33x3 pose landmarks without normalization.
        Returns: {
            "frames": [
                { "pose": [[x,y,z]...] },  # 33 landmarks per frame
                ...
            ],
            "L_orig": int,
            "L_max": int
        }
        """
        data = self._load_pkl_data_full_body_pose(sign_name)
        if data is None:
            return None

        X = data["X"]
        L, D = X.shape
        print(f"[get_sign_full_body_pose_frames] {sign_name}: Data shape ({L}, {D})")

        # Full body pose data should be 33 landmarks × 3 coordinates = 99
        if D != 99:
            print(f"[get_sign_full_body_pose_frames] {sign_name}: Expected 99 dimensions, got {D}")
            return None

        # Convert to frames with raw coordinates (no normalization)
        # Filter out zero-padded frames
        frames_out = []
        for t in range(L):
            row = X[t]
            # Check if frame has any non-zero data
            if np.any(row != 0):
                # Reshape to (33, 3) - 33 pose landmarks with x, y, z coordinates
                pose = np.round(row.reshape(33, 3), 4).tolist()
                frames_out.append({"pose": pose})

        print(f"[get_sign_full_body_pose_frames] {sign_name}: {len(frames_out)} non-zero frames out of {L} total")

        if len(frames_out) == 0:
            print(f"[get_sign_full_body_pose_frames] {sign_name}: WARNING - No non-zero frames found!")
            return None

        return {
            "frames": frames_out,
            "L_orig": data.get("L_orig", L),
            "L_max": data.get("L_max", L)
        }


sign_mgr = SignSequenceManager()


# ── Translation/transcription/feedback logging ──────────────────────────────

def log_translation(
    query_type: str,
    input_text: str,
    gemini_response: GlossResult,
    render_plan: List[RenderPlanItem],
    doc_id: Optional[str] = None,
) -> Optional[str]:
    """Persist a completed translation session to the *translation_logs* collection.

    Does not record any user-identifying information - the translate page is
    accessible without login, and this log exists purely to review translation
    quality (gloss output, unmatched words), not to track who made a request.
    """
    db = get_db()
    if db is None:
        logger.warning("[DB] Firestore unavailable – skipping translation log")
        return None

    try:
        doc_ref = db.collection("translation_logs").document(doc_id)
        doc_ref.set({
            "timestamp": datetime.now(timezone.utc),
            # ── What the user sent ───────────────────────────────────────────
            "query_type": query_type,
            "input_text": input_text,
            # ── Intermediate LLM response ────────────────────────────────────
            "detected_language": gemini_response.detected_language,
            "gemini_gloss": gemini_response.gloss,
            "gemini_unmatched": gemini_response.unmatched,
            "gemini_notes": gemini_response.notes,
            # ── Final speech/sign token output ───────────────────────────────
            "output_tokens": [item.token for item in render_plan],
            "output_sign_names": [item.sign_name for item in render_plan if item.sign_name],
            "render_plan_count": len(render_plan),
        })
        logger.info("[DB] Translation logged → doc %s", doc_ref.id)
        return doc_ref.id
    except Exception as exc:
        logger.error("[DB] Failed to log translation: %s", exc)
        return None


def log_transcription(transcription: str, detected_language: Optional[str]) -> Optional[str]:
    """Persist a voice transcription (no subsequent translation) to the
    *transcription_logs* collection. No user-identifying information is stored
    (the translate page is accessible without login).
    """
    db = get_db()
    if db is None:
        logger.warning("[DB] Firestore unavailable – skipping transcription log")
        return None

    try:
        doc_ref = db.collection("transcription_logs").document()
        doc_ref.set({
            "timestamp": datetime.now(timezone.utc),
            "transcription": transcription,
            "detected_language": detected_language,
        })
        logger.info("[DB] Transcription logged → doc %s", doc_ref.id)
        return doc_ref.id
    except Exception as exc:
        logger.error("[DB] Failed to log transcription: %s", exc)
        return None


def get_translation_logs(limit: int = 25, offset: int = 0) -> tuple[list[dict], bool]:
    """Return a page of *translation_logs* ordered by timestamp descending.

    Fetches ``limit + 1`` rows to cheaply determine whether a next page exists
    without a separate COUNT query.
    """
    db = get_db()
    if db is None:
        return [], False
    try:
        docs = list(
            db.collection("translation_logs")
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit + 1)
            .offset(offset)
            .stream()
        )
        has_more = len(docs) > limit
        return [
            {"id": doc.id, **serialize_doc(doc.to_dict())} for doc in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch translation logs: %s", exc)
        return [], False


def get_transcription_logs(limit: int = 25, offset: int = 0) -> tuple[list[dict], bool]:
    """Return a page of *transcription_logs* ordered by timestamp descending."""
    db = get_db()
    if db is None:
        return [], False
    try:
        docs = list(
            db.collection("transcription_logs")
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit + 1)
            .offset(offset)
            .stream()
        )
        has_more = len(docs) > limit
        return [
            {"id": doc.id, **serialize_doc(doc.to_dict())} for doc in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch transcription logs: %s", exc)
        return [], False


def log_feedback(
    user_id: Optional[str],
    user_email: Optional[str],
    rating: str,
    translation_log_id: Optional[str] = None,
    comment: Optional[str] = None,
) -> Optional[str]:
    """Persist a user feedback submission to the *feedback_logs* collection."""
    db = get_db()
    if db is None:
        logger.warning("[DB] Firestore unavailable – skipping feedback log")
        return None

    try:
        doc_ref = db.collection("feedback_logs").document()
        doc_ref.set({
            "user_id": user_id,
            "user_email": user_email,
            "timestamp": datetime.now(timezone.utc),
            "translation_log_id": translation_log_id,
            "rating": rating,
            "comment": comment if comment else None,
        })
        logger.info("[DB] Feedback logged for user %s → doc %s", user_id, doc_ref.id)
        return doc_ref.id
    except Exception as exc:
        logger.error("[DB] Failed to log feedback: %s", exc)
        return None


def get_feedback_logs(limit: int = 25, offset: int = 0) -> tuple[list[dict], bool]:
    """Return a page of *feedback_logs* ordered by timestamp descending."""
    db = get_db()
    if db is None:
        return [], False
    try:
        docs = list(
            db.collection("feedback_logs")
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit + 1)
            .offset(offset)
            .stream()
        )
        has_more = len(docs) > limit
        return [
            {"id": doc.id, **serialize_doc(doc.to_dict())} for doc in docs[:limit]
        ], has_more
    except Exception as exc:
        logger.error("[DB] Failed to fetch feedback logs: %s", exc)
        return [], False


def get_query_stats() -> dict:
    """translation_logs-collection half of the admin dashboard stats; composed
    with utils.auth.get_user_stats() by routers/auth.py into DashboardStats.
    """
    db = get_db()
    if db is None:
        return {"queries_last_30_days": 0, "queries_by_day": []}

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        query_docs = list(
            db.collection("translation_logs")
            .where("timestamp", ">=", cutoff)
            .stream()
        )

        by_day: dict[str, int] = defaultdict(int)
        for doc in query_docs:
            data = doc.to_dict()
            ts = data.get("timestamp")
            if ts:
                day = ts[:10] if isinstance(ts, str) else ts.date().isoformat()
                by_day[day] += 1

        today = datetime.now(timezone.utc).date()
        queries_by_day = [
            QueryDayCount(date=(d := (today - timedelta(days=i)).isoformat()), count=by_day.get(d, 0))
            for i in range(29, -1, -1)
        ]

        return {"queries_last_30_days": len(query_docs), "queries_by_day": queries_by_day}
    except Exception as exc:
        logger.error("[DB] Failed to get query stats: %s", exc)
        return {"queries_last_30_days": 0, "queries_by_day": []}
