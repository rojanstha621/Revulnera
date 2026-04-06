# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.db.models import Count
from .models import User, UserProfile

class UserProfileInline(admin.StackedInline):
    """Show profile fields directly inside user admin page."""

    model = UserProfile
    extra = 0
    can_delete = False

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Admin panel configuration for managing platform users."""

    ordering = ("-date_joined",)
    list_display = ("email", "full_name", "role", "is_active", "is_staff", "vuln_scan_approved", "date_joined", "scan_count", "last_login")
    list_filter = ("role", "is_active", "is_staff", "can_run_vulnerability_scans", "date_joined")
    search_fields = ("email", "full_name")
    actions = ['approve_vulnerability_scans', 'revoke_vulnerability_scans']
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Vulnerability Scanning", {"fields": ("can_run_vulnerability_scans",)}),
        ("Audit", {"fields": ("last_login_ip", "last_password_change", "last_login")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "role", "is_staff", "is_superuser")}),
    )
    inlines = [UserProfileInline]
    readonly_fields = ("scan_count",)

    def vuln_scan_approved(self, obj):
        """Display vulnerability scan approval status with icon"""
        if obj.can_run_vulnerability_scans:
            return "✅ Approved"
        return "❌ Not Approved"
    vuln_scan_approved.short_description = "Vuln Scan Access"
    vuln_scan_approved.admin_order_field = "can_run_vulnerability_scans"

    def approve_vulnerability_scans(self, request, queryset):
        """Bulk action to approve users for vulnerability scanning"""
        updated = queryset.update(can_run_vulnerability_scans=True)
        self.message_user(request, f"{updated} user(s) approved for vulnerability scanning.")
    approve_vulnerability_scans.short_description = "✅ Approve for vulnerability scanning"

    def revoke_vulnerability_scans(self, request, queryset):
        """Bulk action to revoke vulnerability scanning access"""
        updated = queryset.update(can_run_vulnerability_scans=False)
        self.message_user(request, f"{updated} user(s) revoked from vulnerability scanning.")
    revoke_vulnerability_scans.short_description = "❌ Revoke vulnerability scanning access"

    def scan_count(self, obj):
        return obj.scans.count()
    scan_count.short_description = "Scans"

    def get_queryset(self, request):
        """Optimize queryset with scan count annotation"""
        queryset = super().get_queryset(request)
        return queryset.annotate(scan_count=Count('scans'))

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin list view for user profile records."""

    list_display = ("user", "phone", "updated_at")
    search_fields = ("user__email", "phone")
    raw_id_fields = ("user",)
