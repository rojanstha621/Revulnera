from django.contrib import admin
from .models import VulnerabilityFinding


@admin.register(VulnerabilityFinding)
class VulnerabilityFindingAdmin(admin.ModelAdmin):
    list_display = ["id", "scan", "host", "owasp_category", "title", "severity", "confidence", "created_at"]
    list_filter = ["owasp_category", "severity", "confidence", "created_at"]
    search_fields = ["host", "url", "title"]
    readonly_fields = ["created_at"]
