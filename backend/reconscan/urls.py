from django.urls import path
from .views import (
    StartScanView, 
    CancelScanView,
    IngestSubdomainsView, 
    IngestEndpointsView, 
    UpdateScanStatusView,
    ScanLogView,
    UserScansListView,
    UserScanDetailView,
    IngestPortScanFindingsView,
    IngestTLSResultView,
    IngestDirectoryFindingsView,
    GenerateScanReportView,
    UserReportsSummaryView,
)

urlpatterns = [
    path("scans/start/", StartScanView.as_view()),
    path("scans/<int:scan_id>/cancel/", CancelScanView.as_view()),
    path("scans/<int:scan_id>/ingest/subdomains/", IngestSubdomainsView.as_view()),
    path("scans/<int:scan_id>/ingest/endpoints/", IngestEndpointsView.as_view()),
    path("scans/<int:scan_id>/status/", UpdateScanStatusView.as_view()),
    path("scans/<int:scan_id>/logs/", ScanLogView.as_view()),
    
    # Network analysis ingestion endpoints
    path("scans/<int:scan_id>/network/ports/ingest/", IngestPortScanFindingsView.as_view()),
    path("scans/<int:scan_id>/network/tls/ingest/", IngestTLSResultView.as_view()),
    path("scans/<int:scan_id>/network/dirs/ingest/", IngestDirectoryFindingsView.as_view()),
    
    # User scan endpoints
    path("user/scans/", UserScansListView.as_view(), name="user-scans"),
    path("user/scans/<int:scan_id>/", UserScanDetailView.as_view(), name="user-scan-detail"),
    
    # Report generation endpoints
    path("reports/scans/", UserReportsSummaryView.as_view(), name="user-reports-summary"),
    path("reports/scans/<int:scan_id>/", GenerateScanReportView.as_view(), name="generate-scan-report"),
]
