from typing import List, Optional

from pydantic import BaseModel

from models.dictionary import SignDetail


class LessonJSON(BaseModel):
    lesson_id: str
    lesson_name: str
    description: str
    emoji: str = "📖"
    order: int = 999
    difficulty: Optional[str] = None
    tags: List[str] = []
    tokens: List[str] = []


class LessonSummary(BaseModel):
    lesson_id: str
    lesson_name: str
    description: str
    emoji: str
    sign_count: int
    difficulty: Optional[str]
    tags: List[str]


class LessonDetail(BaseModel):
    lesson_id: str
    lesson_name: str
    description: str
    emoji: str
    difficulty: Optional[str]
    tags: List[str]
    signs: List[SignDetail]


class LessonProgress(BaseModel):
    lesson_id: str
    signs_viewed: List[str] = []
    completed: bool = False
    completed_at: Optional[str] = None
    quiz_attempts: int = 0
    quiz_best_score: Optional[int] = None
    quiz_best_total: Optional[int] = None
    last_quiz_score: Optional[int] = None
    last_quiz_total: Optional[int] = None
    last_attempted_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class QuizAttemptRequest(BaseModel):
    score: int
    total: int
