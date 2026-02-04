from django.urls import path
from .views import IngestVulnerabilityFindingsView

urlpatterns = [
    path("scans/<int:scan_id>/vulnerabilities/ingest/", IngestVulnerabilityFindingsView.as_view()),
]
