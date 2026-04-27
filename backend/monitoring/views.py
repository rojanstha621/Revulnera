from django.db import connection
from kombu.exceptions import OperationalError
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from vuln_scanner.celery import app as celery_app

from .redis_metrics import (
    METRIC_ACTIVE_TASKS_KEY,
    METRIC_FAILED_TASKS_KEY,
    get_counter_int,
    get_per_user_usage,
    get_queue_sizes,
    get_redis_client,
)


def _safe_inspect(timeout=1):
    inspect = celery_app.control.inspect(timeout=timeout)
    return {
        "stats": inspect.stats() or {},
        "ping": inspect.ping() or {},
        "active": inspect.active() or {},
        "reserved": inspect.reserved() or {},
        "scheduled": inspect.scheduled() or {},
    }


def _count_tasks_by_queue(task_map):
    counts = {}
    for worker_tasks in (task_map or {}).values():
        for entry in worker_tasks or []:
            if not isinstance(entry, dict):
                continue
            delivery_info = entry.get("delivery_info") or {}
            queue = delivery_info.get("routing_key") or delivery_info.get("exchange") or "unknown"
            counts[queue] = int(counts.get(queue, 0)) + 1
    return counts


def _merge_queue_counts(*maps):
    merged = {}
    for mapping in maps:
        for key, value in (mapping or {}).items():
            merged[key] = int(merged.get(key, 0)) + int(value)
    return merged


class SystemHealthView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        redis_state = "down"
        celery_state = "down"
        db_state = "down"
        workers = 0

        try:
            get_redis_client().ping()
            redis_state = "ok"
        except Exception:
            redis_state = "down"

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            db_state = "ok"
        except Exception:
            db_state = "down"

        try:
            checks = _safe_inspect(timeout=1)
            workers = len(checks["stats"])
            has_ping = bool(checks["ping"])
            celery_state = "ok" if has_ping and workers > 0 else "down"
        except OperationalError:
            celery_state = "down"
        except Exception:
            celery_state = "down"

        payload = {
            "redis": redis_state,
            "celery": celery_state,
            "db": db_state,
            "workers": workers,
        }

        http_status = status.HTTP_200_OK
        if "down" in payload.values():
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE

        return Response(payload, status=http_status)


class SystemMetricsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queue_names = ["premium", "standard", "free"]

        queue_sizes_broker = get_queue_sizes(queue_names)

        checks = _safe_inspect(timeout=1)
        stats = checks["stats"]
        worker_count = len(stats)
        worker_concurrency = 0
        for worker_stat in stats.values():
            pool = worker_stat.get("pool", {}) if isinstance(worker_stat, dict) else {}
            worker_concurrency += int(pool.get("max-concurrency", 0) or 0)

        active_by_queue = _count_tasks_by_queue(checks["active"])
        reserved_by_queue = _count_tasks_by_queue(checks["reserved"])
        scheduled_by_queue = _count_tasks_by_queue(checks["scheduled"])
        queue_sizes_runtime = _merge_queue_counts(active_by_queue, reserved_by_queue, scheduled_by_queue)

        queue_sizes = {}
        for queue in sorted(set(queue_names + list(queue_sizes_runtime.keys()))):
            queue_sizes[queue] = {
                "broker": int(queue_sizes_broker.get(queue, 0)),
                "runtime": int(queue_sizes_runtime.get(queue, 0)),
            }
        queued_tasks = sum(entry["broker"] + entry["runtime"] for entry in queue_sizes.values())

        payload = {
            "active_tasks": get_counter_int(METRIC_ACTIVE_TASKS_KEY, default=0),
            "queued_tasks": queued_tasks,
            "failed_tasks": get_counter_int(METRIC_FAILED_TASKS_KEY, default=0),
            "workers": worker_count,
            "per_user_usage": get_per_user_usage(),
            "queue_sizes": queue_sizes,
            "worker_concurrency": worker_concurrency,
            "workers_detail": {
                worker_name: {
                    "pool": (worker_stat.get("pool") or {}),
                    "total": (worker_stat.get("total") or {}),
                }
                for worker_name, worker_stat in stats.items()
                if isinstance(worker_stat, dict)
            },
        }
        return Response(payload, status=status.HTTP_200_OK)
