import json
import logging
import os
import time

import redis
from django.conf import settings


logger = logging.getLogger(__name__)

_REDIS_CLIENT = None

METRIC_ACTIVE_TASKS_KEY = "monitor:tasks:active"
METRIC_FAILED_TASKS_KEY = "monitor:tasks:failed"
METRIC_PER_USER_USAGE_KEY = "monitor:usage:per_user"


def get_redis_client():
    global _REDIS_CLIENT
    if _REDIS_CLIENT is None:
        redis_url = os.getenv(
            "REDIS_URL",
            getattr(settings, "CELERY_BROKER_URL", "redis://127.0.0.1:6379/0"),
        )
        _REDIS_CLIENT = redis.Redis.from_url(redis_url, decode_responses=True)
    return _REDIS_CLIENT


def incr_active_tasks():
    try:
        get_redis_client().incr(METRIC_ACTIVE_TASKS_KEY)
    except Exception:
        logger.exception("[monitoring] failed to increment active task counter")


def decr_active_tasks():
    try:
        client = get_redis_client()
        value = client.decr(METRIC_ACTIVE_TASKS_KEY)
        if int(value) < 0:
            client.set(METRIC_ACTIVE_TASKS_KEY, 0)
    except Exception:
        logger.exception("[monitoring] failed to decrement active task counter")


def incr_failed_tasks():
    try:
        get_redis_client().incr(METRIC_FAILED_TASKS_KEY)
    except Exception:
        logger.exception("[monitoring] failed to increment failed task counter")


def incr_user_usage(user_id):
    if user_id is None:
        return
    try:
        get_redis_client().hincrby(METRIC_PER_USER_USAGE_KEY, str(int(user_id)), 1)
    except Exception:
        logger.exception("[monitoring] failed to update per-user usage")


def set_task_snapshot(task_id, payload):
    if not task_id:
        return
    try:
        client = get_redis_client()
        key = f"monitor:task:{task_id}"
        client.set(key, json.dumps(payload, default=str), ex=3600)
    except Exception:
        logger.exception("[monitoring] failed to persist task snapshot")


def get_counter_int(key, default=0):
    try:
        value = get_redis_client().get(key)
        if value is None:
            return int(default)
        return int(value)
    except Exception:
        return int(default)


def get_per_user_usage():
    try:
        data = get_redis_client().hgetall(METRIC_PER_USER_USAGE_KEY)
        return {str(k): int(v) for k, v in data.items()}
    except Exception:
        return {}


def get_queue_sizes(queue_names):
    sizes = {}
    client = get_redis_client()
    for queue in queue_names:
        try:
            sizes[queue] = int(client.llen(queue))
        except Exception:
            sizes[queue] = 0
    return sizes


def now_monotonic():
    return time.monotonic()
