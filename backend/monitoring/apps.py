from django.apps import AppConfig


class MonitoringConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "monitoring"

    def ready(self):
        # Register Celery signal handlers for task-level observability.
        from . import signals  # noqa: F401
