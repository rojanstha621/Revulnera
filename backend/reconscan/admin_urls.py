from django.urls import path
from .views_admin import (
    AdminDashboardView,
    AdminUsersView,
    AdminUserDetailView,
    AdminScansView,
    AdminScanDetailView,
    AdminAnalyticsView,
)
from kyc.views import (
    AdminKYCQueueView,
    AdminKYCDetailView,
    AdminKYCFileView,
    AdminKYCApproveView,
    AdminKYCRejectView,
)

urlpatterns = [
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/users/", AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/<int:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/scans/", AdminScansView.as_view(), name="admin-scans"),
    path("admin/scans/<int:scan_id>/", AdminScanDetailView.as_view(), name="admin-scan-detail"),
    path("admin/analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("admin/kyc-queue/", AdminKYCQueueView.as_view(), name="admin-kyc-queue"),
    path("admin/kyc-detail/<int:submission_id>/", AdminKYCDetailView.as_view(), name="admin-kyc-detail"),
    path("admin/kyc-file/<int:submission_id>/<str:file_field>/", AdminKYCFileView.as_view(), name="admin-kyc-file"),
    path("admin/kyc-approve/<int:submission_id>/", AdminKYCApproveView.as_view(), name="admin-kyc-approve"),
    path("admin/kyc-reject/<int:submission_id>/", AdminKYCRejectView.as_view(), name="admin-kyc-reject"),
]
