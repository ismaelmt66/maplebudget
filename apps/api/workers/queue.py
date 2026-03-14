"""Job queue abstraction for background processing.

Provides a unified API for enqueueing and polling async jobs.  Uses
Redis (via RQ) when REDIS_URL is configured, otherwise falls back to
a thread-pool executor for development.

This keeps the API non-blocking for expensive operations (AI analysis,
bank sync, report generation) without requiring a separate Celery cluster.
"""

from __future__ import annotations

import logging
import os
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable

logger = logging.getLogger("nexledger.queue")

_REDIS_URL = os.environ.get("REDIS_URL", "")
_JOB_STORE: dict[str, dict] = {}
_executor: ThreadPoolExecutor | None = None


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="nexledger-worker")
    return _executor


def enqueue(fn: Callable, *args: Any, **kwargs: Any) -> str:
    """Submit a function for background execution.

    Returns a job_id that can be polled with ``get_job()``.  When Redis
    is available, the job is pushed to an RQ queue instead.
    """
    job_id = uuid.uuid4().hex[:16]

    if _REDIS_URL:
        return _enqueue_redis(job_id, fn, *args, **kwargs)

    return _enqueue_thread(job_id, fn, *args, **kwargs)


def get_job(job_id: str) -> dict:
    """Return the current status of a background job."""
    if _REDIS_URL:
        return _get_redis_job(job_id)

    info = _JOB_STORE.get(job_id)
    if info is None:
        return {"job_id": job_id, "status": "not_found"}
    future: Future | None = info.get("_future")
    if future and future.done():
        try:
            result = future.result()
            info.update({"status": "completed", "result": result, "completed_at": datetime.now(timezone.utc).isoformat()})
        except Exception as exc:
            info.update({"status": "failed", "error": str(exc), "failed_at": datetime.now(timezone.utc).isoformat()})
    return {k: v for k, v in info.items() if k != "_future"}


# ── Thread-pool backend ──────────────────────────────────────────────

def _enqueue_thread(job_id: str, fn: Callable, *args: Any, **kwargs: Any) -> str:
    _JOB_STORE[job_id] = {
        "job_id": job_id,
        "status": "running",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    future = _get_executor().submit(fn, *args, **kwargs)
    _JOB_STORE[job_id]["_future"] = future
    logger.info("Job %s enqueued (thread-pool)", job_id)
    return job_id


# ── Redis/RQ backend ────────────────────────────────────────────────

def _enqueue_redis(job_id: str, fn: Callable, *args: Any, **kwargs: Any) -> str:
    try:
        from redis import Redis
        from rq import Queue

        redis_conn = Redis.from_url(_REDIS_URL)
        q = Queue(connection=redis_conn)
        rq_job = q.enqueue(fn, *args, **kwargs, job_id=job_id, job_timeout="10m")
        _JOB_STORE[job_id] = {"job_id": job_id, "status": "queued", "rq_id": rq_job.id}
        logger.info("Job %s enqueued (Redis/RQ)", job_id)
    except Exception as exc:
        logger.warning("Redis enqueue failed (%s), falling back to thread-pool", exc)
        return _enqueue_thread(job_id, fn, *args, **kwargs)
    return job_id


def _get_redis_job(job_id: str) -> dict:
    try:
        from redis import Redis
        from rq.job import Job as RQJob

        redis_conn = Redis.from_url(_REDIS_URL)
        rq_job = RQJob.fetch(job_id, connection=redis_conn)
        status_map = {"queued": "queued", "started": "running", "finished": "completed", "failed": "failed"}
        result: dict = {
            "job_id": job_id,
            "status": status_map.get(rq_job.get_status(), "unknown"),
        }
        if rq_job.result is not None:
            result["result"] = rq_job.result
        if rq_job.exc_info:
            result["error"] = str(rq_job.exc_info)
        return result
    except Exception:
        local = _JOB_STORE.get(job_id)
        if local:
            return {k: v for k, v in local.items() if k != "_future"}
        return {"job_id": job_id, "status": "not_found"}
