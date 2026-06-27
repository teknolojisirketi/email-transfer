from __future__ import annotations

import subprocess
import threading
import time
from typing import Callable

from app.database import MigrationJob, SessionLocal

CANCELLED_BY_USER = "Cancelled by user"
CANCEL_KEY_PREFIX = "migration:cancel:"
KILL_ACCOUNT_KEY_PREFIX = "migration:kill_account:"
CANCEL_CHANNEL = "migration:cancel"


def _redis():
    from app.services.queue_service import get_redis

    return get_redis()


def mark_job_cancelled(job_uuid: str, yandex_email: str | None = None) -> None:
    """Signal cancel to worker immediately (API + worker share Redis)."""
    redis_conn = _redis()
    redis_conn.set(f"{CANCEL_KEY_PREFIX}{job_uuid}", "1", ex=86400)
    if yandex_email:
        redis_conn.set(f"{KILL_ACCOUNT_KEY_PREFIX}{yandex_email}", job_uuid, ex=3600)
        redis_conn.publish(CANCEL_CHANNEL, f"{job_uuid}:{yandex_email}")


def is_job_cancelled_redis(job_uuid: str) -> bool:
    try:
        return bool(_redis().get(f"{CANCEL_KEY_PREFIX}{job_uuid}"))
    except Exception:
        return False


def is_job_cancelled(job: MigrationJob | None) -> bool:
    if not job:
        return False
    if is_job_cancelled_redis(job.uuid):
        return True
    return job.status == "failed" and job.error_message == CANCELLED_BY_USER


def check_job_cancelled(job_uuid: str) -> bool:
    if is_job_cancelled_redis(job_uuid):
        return True
    db = SessionLocal()
    try:
        job = db.query(MigrationJob).filter(MigrationJob.uuid == job_uuid).first()
        return bool(job and job.status == "failed" and job.error_message == CANCELLED_BY_USER)
    finally:
        db.close()


def make_cancel_checker(job_uuid: str) -> Callable[[], bool]:
    return lambda: check_job_cancelled(job_uuid)


def terminate_process(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def start_cancel_watcher(
    proc: subprocess.Popen,
    should_cancel: Callable[[], bool],
    job_uuid: str | None = None,
    on_cancel: Callable[[], None] | None = None,
    poll_seconds: float = 1.0,
) -> tuple[threading.Event, list[threading.Thread]]:
    stopped = threading.Event()
    threads: list[threading.Thread] = []

    def _handle_cancel() -> None:
        if on_cancel:
            on_cancel()
        terminate_process(proc)

    def _poll_loop() -> None:
        while proc.poll() is None and not stopped.is_set():
            if should_cancel():
                _handle_cancel()
                stopped.set()
                return
            time.sleep(poll_seconds)

    def _pubsub_loop() -> None:
        pubsub = None
        try:
            redis_conn = _redis()
            pubsub = redis_conn.pubsub(ignore_subscribe_messages=True)
            pubsub.subscribe(CANCEL_CHANNEL)
            while proc.poll() is None and not stopped.is_set():
                message = pubsub.get_message(timeout=1.0)
                if not message or message.get("type") != "message":
                    continue
                data = message.get("data")
                if isinstance(data, bytes):
                    data = data.decode()
                if not isinstance(data, str):
                    continue
                parts = data.split(":", 1)
                if len(parts) != 2:
                    continue
                cancelled_uuid, _email = parts
                if job_uuid and cancelled_uuid == job_uuid:
                    _handle_cancel()
                    stopped.set()
                    return
        except Exception:
            pass
        finally:
            if pubsub is not None:
                try:
                    pubsub.close()
                except Exception:
                    pass

    poll_thread = threading.Thread(target=_poll_loop, daemon=True)
    pubsub_thread = threading.Thread(target=_pubsub_loop, daemon=True)
    poll_thread.start()
    pubsub_thread.start()
    threads.extend([poll_thread, pubsub_thread])
    return stopped, threads


def kill_orphan_imapsync_for_account(yandex_email: str, cpanel_email: str) -> None:
    """Stop stray imapsync processes for this account (worker container only)."""
    pattern = f"--user1 {yandex_email} --passfile1"
    subprocess.run(["pkill", "-f", pattern], check=False, capture_output=True)
