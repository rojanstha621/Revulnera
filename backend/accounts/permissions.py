# accounts/permissions.py
from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    """Allow access to admin/staff/superuser accounts."""

    def has_permission(self, request, view):
        """Check role/flags on authenticated user."""
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.role == 'admin'
                or request.user.is_staff
                or request.user.is_superuser
            )
        )

class IsAnalystOrAdmin(permissions.BasePermission):
    """Allow only analyst or admin roles."""

    def has_permission(self, request, view):
        """Role gate for analyst/admin-only endpoints."""
        return bool(request.user and request.user.is_authenticated and request.user.role in ('admin','analyst'))
