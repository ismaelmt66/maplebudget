"""Background task infrastructure for long-running operations.

Uses FastAPI's built-in BackgroundTasks for simplicity (no external
broker required).  Tasks write their status to the ``job_results``
in-memory store (or Redis when available).

Usage:
    from services.background import enqueue_task

    @router.post("/long-operation")
    def start_operation(background_tasks: BackgroundTasks, ...):
        job_id = enqueue_task(background_tasks, my_func, arg1, arg2)
        return {"job_id": job_id, "status": "queued"}

    @router.get("/jobs/{job_id}")
    def job_status(job_id: str):
        return get_job_status(job_id)
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from cache import cache_get, cache_set

logger = logging.getLogger("nexledger.background")

JOB_TTL = 3600 * 24  # keep job results for 24h


def _job_key(job_id: str) -> str:
    return f"job:{job_id}"


def enqueue_task(background_tasks: Any, fn: Callable, *args: Any, **kwargs: Any) -> str:
    """Schedule ``fn(*args, **kwargs)`` as a background task.

    Returns a job_id that can be polled via ``get_job_status()``.
    """
    job_id = uuid.uuid4().hex[:16]
    cache_set(_job_key(job_id), {
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }, JOB_TTL)

    def _wrapper():
        cache_set(_job_key(job_id), {
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }, JOB_TTL)
        try:
            result = fn(*args, **kwargs)
            cache_set(_job_key(job_id), {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "result": result,
            }, JOB_TTL)
        except Exception as exc:
            logger.error("Background job %s failed: %s", job_id, exc, exc_info=True)
            cache_set(_job_key(job_id), {
                "status": "failed",
                "error": str(exc),
                "failed_at": datetime.now(timezone.utc).isoformat(),
            }, JOB_TTL)

    background_tasks.add_task(_wrapper)
    return job_id


def get_job_status(job_id: str) -> dict:
    """Retrieve the current status of a background job."""
    result = cache_get(_job_key(job_id))
    if result is None:
        return {"status": "not_found", "job_id": job_id}
    if isinstance(result, dict):
        return {"job_id": job_id, **result}
    return {"job_id": job_id, "status": "unknown"}
