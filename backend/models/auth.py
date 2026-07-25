from typing import Dict, List, Optional

from pydantic import BaseModel


class PasswordValidationRequest(BaseModel):
    email: str
    password: str


class RegisterResult(BaseModel):
    is_new: bool
    status: str


class UserRecord(BaseModel):
    id: str
    uid: Optional[str] = None
    email: Optional[str] = None
    status: str
    registered_at: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    revoked_at: Optional[str] = None
    is_admin: Optional[bool] = None
    admin_updated_at: Optional[str] = None
    admin_set_by: Optional[str] = None


class QueryDayCount(BaseModel):
    date: str
    count: int


class DashboardStats(BaseModel):
    total_users: int
    queries_last_30_days: int
    active_users_30d: int
    queries_by_day: List[QueryDayCount]


class UsageBucket(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0


class UsageDayBucket(UsageBucket):
    date: str


class TokenUsageStats(BaseModel):
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_cost_usd: float
    by_endpoint: Dict[str, UsageBucket]
    usage_by_day: List[UsageDayBucket]
