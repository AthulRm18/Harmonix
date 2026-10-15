"""API dependencies – auth seam, DB session, pagination."""

from __future__ import annotations

from fastapi import Query


# ── Auth seam ─────────────────────────────────────────────────────────
# No authentication is implemented.  This function is a clean injection
# point so that auth can be added later without touching route handlers.
async def get_current_user() -> dict:
    """Placeholder: returns a default user dict.

    Replace this with real auth (JWT, OAuth, etc.) when needed.
    """
    return {"id": "anonymous", "role": "admin"}


# ── Pagination ────────────────────────────────────────────────────────
class PaginationParams:
    def __init__(
        self,
        offset: int = Query(0, ge=0, description="Number of items to skip"),
        limit: int = Query(50, ge=1, le=500, description="Max items to return"),
    ):
        self.offset = offset
        self.limit = limit
