import random

from fastapi import APIRouter, Depends, HTTPException

from models.dictionary import SignDetail
from utils.auth import optional_approved_token
from utils.dictionary import get_sign_detail, vocab

router = APIRouter()


@router.get("/api/learning/sign/{token}")
def get_learning_sign(token: str, _user: dict | None = Depends(optional_approved_token)) -> SignDetail:
    """Return full sign detail (description, parameters, units, variants) for an exact token."""
    item = get_sign_detail(token)
    if item is None:
        raise HTTPException(status_code=404, detail="Sign not found")
    return item


@router.get("/api/learning/signs")
def get_learning_signs(
    q: str = "",
    limit: int = 48,
    offset: int = 0,
    _user=Depends(optional_approved_token),
):
    """Return searchable sign vocabulary items for the learning experience."""
    if not (1 <= limit <= 100):
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be non-negative")

    query = q.strip().upper()
    tokens = sorted(vocab.allowed_tokens_list)
    if query:
        tokens = [token for token in tokens if query in token or query in (vocab.token_to_video_name(token) or "").upper()]

    total = len(tokens)
    page_tokens = tokens[offset : offset + limit]
    signs = [get_sign_detail(token) for token in page_tokens]

    return {
        "signs": [item for item in signs if item is not None],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


@router.get("/api/learning/quiz")
def get_quiz(_user=Depends(optional_approved_token)):
    """Return a random sign GIF and 4 multiple-choice token options (1 correct, 3 wrong)."""
    tokens = vocab.allowed_tokens_list
    if len(tokens) < 4:
        raise HTTPException(status_code=500, detail="Vocabulary too small for a quiz")

    correct_token = random.choice(tokens)
    correct_item = get_sign_detail(correct_token)
    if not correct_item:
        raise HTTPException(status_code=500, detail="Unable to resolve quiz sign")

    wrong_tokens = random.sample([t for t in tokens if t != correct_token], 3)
    options = wrong_tokens + [correct_token]
    random.shuffle(options)

    return {
        "correct_token": correct_token,
        "sign_name": correct_item.sign_name,
        "gif_url": correct_item.gif_url,
        "options": options,
    }
