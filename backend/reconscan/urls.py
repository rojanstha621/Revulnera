from django.urls import path
from .views import StartScanView, IngestSubdomainsView, IngestEndpointsView, UpdateScanStatusView

urlpatterns = [
    path("scans/start/", StartScanView.as_view()),
    path("scans/<int:scan_id>/ingest/subdomains/", IngestSubdomainsView.as_view()),
    path("scans/<int:scan_id>/ingest/endpoints/", IngestEndpointsView.as_view()),
    path("scans/<int:scan_id>/status/", UpdateScanStatusView.as_view()),
]
