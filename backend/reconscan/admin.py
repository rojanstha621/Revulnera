from django.contrib import admin
from django.db.models import Count
from .models import Scan, Subdomain, Endpoint, PortScanFinding, TLSScanResult, DirectoryFinding


class SubdomainInline(admin.TabularInline):
    model = Subdomain
    extra = 0
    fields = ("name", "ip", "alive")
    show_change_link = True


class EndpointInline(admin.TabularInline):
    model = Endpoint
    extra = 0
    fields = ("url", "status_code", "title")
    readonly_fields = ("headers", "fingerprints", "evidence")
    show_change_link = True


@admin.register(Scan)
class ScanAdmin(admin.ModelAdmin):
    list_display = ("id", "target", "status", "created_by", "created_at", "updated_at", "subdomain_count", "endpoint_count")
    list_filter = ("status", "created_by", "created_at")
    search_fields = ("target", "created_by__email")
    readonly_fields = ("created_at", "updated_at", "subdomain_count", "endpoint_count")
    inlines = (SubdomainInline, EndpointInline)
    actions = ["mark_running", "mark_completed", "mark_failed"]
    date_hierarchy = "created_at"

    def subdomain_count(self, obj):
        return obj.subdomains.count()
    subdomain_count.short_description = "Subdomains"

    def endpoint_count(self, obj):
        return obj.endpoints.count()
    endpoint_count.short_description = "Endpoints"

    def mark_running(self, request, queryset):
        queryset.update(status="RUNNING")
    mark_running.short_description = "Mark selected scans as Running"

    def mark_completed(self, request, queryset):
        queryset.update(status="COMPLETED")
    mark_completed.short_description = "Mark selected scans as Completed"

    def mark_failed(self, request, queryset):
        queryset.update(status="FAILED")
    mark_failed.short_description = "Mark selected scans as Failed"

    def get_queryset(self, request):
        """Optimize queryset with annotation"""
        queryset = super().get_queryset(request)
        return queryset.annotate(subdomain_count=Count('subdomains'), endpoint_count=Count('endpoints'))


@admin.register(Subdomain)
class SubdomainAdmin(admin.ModelAdmin):
    list_display = ("id", "scan", "name", "ip", "alive")
    list_filter = ("alive", "scan__created_at")
    search_fields = ("name", "ip")
    raw_id_fields = ("scan",)
    date_hierarchy = "scan__created_at"


@admin.register(Endpoint)
class EndpointAdmin(admin.ModelAdmin):
    list_display = ("id", "scan", "url", "status_code", "title")
    list_filter = ("status_code", "scan__created_at")
    search_fields = ("url", "title")
    raw_id_fields = ("scan",)
    readonly_fields = ("headers", "fingerprints", "evidence")
    date_hierarchy = "scan__created_at"


@admin.register(PortScanFinding)
class PortScanFindingAdmin(admin.ModelAdmin):
    list_display = ("id", "scan", "host", "port", "protocol", "state", "service", "product", "version", "created_at")
    list_filter = ("state", "protocol", "service", "created_at")
    search_fields = ("host", "service", "product", "banner")
    raw_id_fields = ("scan",)
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"


@admin.register(TLSScanResult)
class TLSScanResultAdmin(admin.ModelAdmin):
    list_display = ("id", "scan", "host", "has_https", "cert_valid", "cert_expires_at", "created_at")
    list_filter = ("has_https", "cert_valid", "created_at")
    search_fields = ("host", "cert_issuer")
    raw_id_fields = ("scan",)
    readonly_fields = ("created_at", "supported_versions", "weak_versions", "issues")
    date_hierarchy = "created_at"


@admin.register(DirectoryFinding)
class DirectoryFindingAdmin(admin.ModelAdmin):
    list_display = ("id", "scan", "host", "path", "status_code", "issue_type", "created_at")
    list_filter = ("issue_type", "status_code", "created_at")
    search_fields = ("host", "path", "evidence")
    raw_id_fields = ("scan",)
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
