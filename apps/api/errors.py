"""Standardized error handling for the NexLedger API.

Provides:
- A consistent error envelope for all HTTP error responses
- Exception handlers to register on the FastAPI app
- Domain-specific exception classes
"""

from __future__ import annotations

import logging
import traceback

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("nexledger.errors")


def error_envelope(
    status_code: int,
    message: str,
    *,
    detail: str | None = None,
    request_id: str | None = None,
) -> JSONResponse:
    body: dict = {
        "error": {
            "code": status_code,
            "message": message,
        }
    }
    if detail:
        body["error"]["detail"] = detail
    if request_id:
        body["error"]["request_id"] = request_id
    return JSONResponse(status_code=status_code, content=body)


# ── Domain exceptions ────────────────────────────────────────────────

class NotFoundError(Exception):
    def __init__(self, resource: str = "Resource"):
        self.resource = resource
        super().__init__(f"{resource} not found")


class ForbiddenError(Exception):
    def __init__(self, message: str = "Access denied"):
        self.message = message
        super().__init__(message)


class ConflictError(Exception):
    def __init__(self, message: str = "Conflict"):
        self.message = message
        super().__init__(message)


# ── Exception handlers (register on app) ─────────────────────────────

def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError):
        return error_envelope(
            status.HTTP_404_NOT_FOUND,
            str(exc),
            request_id=getattr(request.state, "request_id", None),
        )

    @app.exception_handler(ForbiddenError)
    async def forbidden_handler(request: Request, exc: ForbiddenError):
        return error_envelope(
            status.HTTP_403_FORBIDDEN,
            exc.message,
            request_id=getattr(request.state, "request_id", None),
        )

    @app.exception_handler(ConflictError)
    async def conflict_handler(request: Request, exc: ConflictError):
        return error_envelope(
            status.HTTP_409_CONFLICT,
            exc.message,
            request_id=getattr(request.state, "request_id", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        return error_envelope(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Validation error",
            detail=str(exc.errors()),
            request_id=getattr(request.state, "request_id", None),
        )

    @app.exception_handler(Exception)
    async def generic_handler(request: Request, exc: Exception):
        logger.error(
            "Unhandled exception on %s %s: %s",
            request.method,
            request.url.path,
            exc,
            exc_info=True,
        )
        return error_envelope(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Internal server error",
            request_id=getattr(request.state, "request_id", None),
        )
