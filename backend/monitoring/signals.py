import logging

from celery.signals import task_failure, task_postrun, task_prerun

from vulnerability_detection.models import VulnerabilityScan

from .redis_metrics import (
    decr_active_tasks,
    incr_active_tasks,
    incr_failed_tasks,
    incr_user_usage,
    now_monotonic,
    set_task_snapshot,
)


logger = logging.getLogger(__name__)


def _extract_scan_id(args, kwargs):
    scan_id = kwargs.get("scan_id")
    if scan_id is not None:
        return scan_id
    if args:
        first = args[0]
        if isinstance(first, int):
            return first
    return None


def _extract_user_id(scan_id):
    if scan_id is None:
        return None
    try:
        return (
            VulnerabilityScan.objects.filter(pk=scan_id)
            .values_list("created_by_id", flat=True)
            .first()
        )
    except Exception:
        logger.exception("[monitoring] failed to resolve user_id for scan_id=%s", scan_id)
        return None


@task_prerun.connect
def on_task_prerun(task=None, task_id=None, args=None, kwargs=None, **_extra):
    args = args or ()
    kwargs = kwargs or {}

    scan_id = _extract_scan_id(args, kwargs)
    user_id = _extract_user_id(scan_id)

    if task is not None:
        setattr(task.request, "_monitor_started_at", now_monotonic())

    incr_active_tasks()
    incr_user_usage(user_id)
    set_task_snapshot(
        task_id,
        {
            "task": getattr(task, "name", "unknown"),
            "state": "STARTED",
            "scan_id": scan_id,
            "user_id": user_id,
        },
    )


@task_postrun.connect
def on_task_postrun(task=None, task_id=None, args=None, kwargs=None, state=None, **_extra):
    args = args or ()
    kwargs = kwargs or {}
    scan_id = _extract_scan_id(args, kwargs)
    user_id = _extract_user_id(scan_id)

    started_at = None
    if task is not None:
        started_at = getattr(task.request, "_monitor_started_at", None)

    duration_seconds = None
    if started_at is not None:
        duration_seconds = round(max(now_monotonic() - started_at, 0.0), 4)

    decr_active_tasks()
    set_task_snapshot(
        task_id,
        {
            "task": getattr(task, "name", "unknown"),
            "state": state,
            "scan_id": scan_id,
            "user_id": user_id,
            "duration_seconds": duration_seconds,
        },
    )


@task_failure.connect
def on_task_failure(task_id=None, exception=None, traceback=None, einfo=None, sender=None, args=None, kwargs=None, **_extra):
    args = args or ()
    kwargs = kwargs or {}
    scan_id = _extract_scan_id(args, kwargs)
    user_id = _extract_user_id(scan_id)

    incr_failed_tasks()
    set_task_snapshot(
        task_id,
        {
            "task": getattr(sender, "name", "unknown"),
            "state": "FAILURE",
            "scan_id": scan_id,
            "user_id": user_id,
            "error": str(exception),
        },
    )
