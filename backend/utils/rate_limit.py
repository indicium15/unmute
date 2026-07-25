"""Shared slowapi rate-limiter instance.

Pulled out of app.py into its own leaf module because the same Limiter
instance must be referenced both by app.py (registers app.state.limiter +
the RateLimitExceeded handler) and by routers/translation.py (applies
@limiter.limit(...) to individual routes) — defining it in either of those
would create an import cycle between them.
"""

from fastapi import Request
from slowapi import Limiter


def _get_client_ip(request: Request) -> str:
    # Cloud Run's front end is the only proxy hop we trust, and it appends the
    # real client IP as the last entry of X-Forwarded-For (after any value the
    # client itself supplied) - so the leftmost entry is attacker-controlled
    # and must not be used, only the rightmost.
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_get_client_ip, headers_enabled=True)
