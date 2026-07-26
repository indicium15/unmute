"""
Rate limiter instance that is used by app.py (registers app.state.limiter +
the RateLimitExceeded handler) and routers/translation.py.
"""

from fastapi import Request
from slowapi import Limiter

def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"

limiter = Limiter(key_func=_get_client_ip, headers_enabled=True)
