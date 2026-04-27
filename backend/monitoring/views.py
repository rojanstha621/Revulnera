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


class SystemHealthView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        redis_state = "down"
        celery_state = "down"
        db_state = "down"

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
            pong = celery_app.control.inspect(timeout=1).ping() or {}
            celery_state = "ok" if pong else "down"
        except OperationalError:
            celery_state = "down"
        except Exception:
            celery_state = "down"

        payload = {
            "redis": redis_state,
            "celery": celery_state,
            "db": db_state,
        }

        http_status = status.HTTP_200_OK
        if "down" in payload.values():
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE

        return Response(payload, status=http_status)


class SystemMetricsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queue_names = ["premium", "standard", "free"]

        queue_sizes = get_queue_sizes(queue_names)
        queued_tasks = sum(queue_sizes.values())

        inspect = celery_app.control.inspect(timeout=1)
        stats = inspect.stats() or {}
        worker_count = len(stats)
        worker_concurrency = 0
        for worker_stat in stats.values():
            pool = worker_stat.get("pool", {}) if isinstance(worker_stat, dict) else {}
            worker_concurrency += int(pool.get("max-concurrency", 0) or 0)

        payload = {
            "active_tasks": get_counter_int(METRIC_ACTIVE_TASKS_KEY, default=0),
            "queued_tasks": queued_tasks,
            "failed_tasks": get_counter_int(METRIC_FAILED_TASKS_KEY, default=0),
            "workers": worker_count,
            "per_user_usage": get_per_user_usage(),
            "queue_sizes": queue_sizes,
            "worker_concurrency": worker_concurrency,
        }
        return Response(payload, status=status.HTTP_200_OK)
