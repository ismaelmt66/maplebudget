"""Reusable pagination utilities for all list endpoints.

Usage in routers:
    from pagination import PaginationParams, paginated_response

    @router.get("/items")
    def list_items(
        params: PaginationParams = Depends(),
        db: Session = Depends(get_db),
    ):
        query = db.query(Model).filter(...)
        return paginated_response(query, params)
"""

from __future__ import annotations

from typing import Any, Generic, List, Optional, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy.orm import Query as SAQuery

T = TypeVar("T")

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50


class PaginationParams:
    """FastAPI dependency that extracts limit/offset from query params."""

    def __init__(
        self,
        limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
        offset: int = Query(0, ge=0),
    ):
        self.limit = limit
        self.offset = offset


class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    total: int
    limit: int
    offset: int
    has_more: bool


def paginated_response(
    query: SAQuery,
    params: PaginationParams,
    *,
    serialize: Any | None = None,
) -> dict:
    """Apply limit/offset to a SQLAlchemy query and return a paginated envelope.

    Args:
        query: Base SQLAlchemy query (unsliced).
        params: PaginationParams from the request.
        serialize: Optional callable to transform each row before returning.

    Returns:
        Dict matching PaginatedResponse schema.
    """
    total = query.count()
    rows = query.offset(params.offset).limit(params.limit).all()

    if serialize:
        data = [serialize(r) for r in rows]
    else:
        data = rows

    return {
        "data": data,
        "total": total,
        "limit": params.limit,
        "offset": params.offset,
        "has_more": (params.offset + params.limit) < total,
    }
