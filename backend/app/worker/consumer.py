import multiprocessing

from rq import Worker

from app.config import settings
from app.services.queue_service import get_redis
from app.services.settings_service import get_or_create_app_settings


def run_worker() -> None:
    redis_conn = get_redis()
    worker = Worker(
        ["migration"],
        connection=redis_conn,
        worker_ttl=86400,
    )
    worker.work(with_scheduler=False)


def main() -> None:
    app_settings = get_or_create_app_settings()
    concurrency = app_settings.worker_concurrency or settings.worker_concurrency
    concurrency = max(1, min(concurrency, 10))

    if concurrency == 1:
        run_worker()
        return

    processes: list[multiprocessing.Process] = []
    for _ in range(concurrency):
        p = multiprocessing.Process(target=run_worker)
        p.start()
        processes.append(p)

    for p in processes:
        p.join()


if __name__ == "__main__":
    main()
