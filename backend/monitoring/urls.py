from django.urls import path

from .views import SystemHealthView, SystemMetricsView


urlpatterns = [
    path("health/", SystemHealthView.as_view(), name="system-health"),
    path("metrics/", SystemMetricsView.as_view(), name="system-metrics"),
]
