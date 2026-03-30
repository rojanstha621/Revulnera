import logging
import os

from celery import Celery

from vuln_scanner.runtime_config import get_optimal_workers, get_runtime_config

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "revulnera_project.settings")

logger = logging.getLogger(__name__)

app = Celery("revulnera")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

_runtime_config = get_runtime_config()
_worker_concurrency = get_optimal_workers()

os.environ["CELERY_WORKER_CONCURRENCY"] = str(_worker_concurrency)
app.conf.worker_concurrency = _worker_concurrency

logger.info(
    "[vuln_scanner] celery_runtime_config detected_cores=%d free_ram_gb=%.2f computed_workers=%d max_workers=%d env_override_used=%s",
    _runtime_config.detected_cores,
    _runtime_config.free_ram_gb,
    _runtime_config.computed_workers,
    _runtime_config.max_workers,
    str(_runtime_config.env_override_used).lower(),
)
