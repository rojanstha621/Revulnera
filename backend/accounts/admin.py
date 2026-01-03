# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.db.models import Count
from .models import User, UserProfile

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    extra = 0
    can_delete = False

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("email", "full_name", "role", "is_active", "is_staff", "date_joined", "scan_count", "last_login")
    list_filter = ("role", "is_active", "is_staff", "date_joined")
    search_fields = ("email", "full_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Audit", {"fields": ("last_login_ip", "last_password_change", "last_login")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "role", "is_staff", "is_superuser")}),
    )
    inlines = [UserProfileInline]
    readonly_fields = ("scan_count",)

    def scan_count(self, obj):
        return obj.scans.count()
    scan_count.short_description = "Scans"

    def get_queryset(self, request):
        """Optimize queryset with scan count annotation"""
        queryset = super().get_queryset(request)
        return queryset.annotate(scan_count=Count('scans'))

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "updated_at")
    search_fields = ("user__email", "phone")
    raw_id_fields = ("user",)
