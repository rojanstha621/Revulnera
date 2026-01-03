from django.urls import path
from .views_admin import (
    AdminDashboardView,
    AdminUsersView,
    AdminUserDetailView,
    AdminScansView,
    AdminScanDetailView,
    AdminAnalyticsView,
)

urlpatterns = [
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/users/", AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/<int:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/scans/", AdminScansView.as_view(), name="admin-scans"),
    path("admin/scans/<int:scan_id>/", AdminScanDetailView.as_view(), name="admin-scan-detail"),
    path("admin/analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
]
