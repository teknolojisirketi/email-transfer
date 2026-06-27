from __future__ import annotations

from redis import Redis
from rq import Queue
from rq.job import Job as RqJob

from app.config import settings

_redis: Redis | None = None
_queue: Queue | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url)
    return _redis


def get_queue() -> Queue:
    global _queue
    if _queue is None:
        _queue = Queue("migration", connection=get_redis())
    return _queue


def enqueue_migration(job_uuid: str) -> str:
    queue = get_queue()
    rq_job = queue.enqueue(
        "app.worker.tasks.migrate_account",
        job_uuid,
        job_timeout="24h",
        result_ttl=86400,
        failure_ttl=86400,
    )
    return rq_job.id


def cancel_migration(rq_job_id: str | None) -> None:
    """Remove a queued RQ job so the worker does not run it."""
    if not rq_job_id:
        return
    try:
        rq_job = RqJob.fetch(rq_job_id, connection=get_redis())
        rq_job.cancel()
    except Exception:
        pass
