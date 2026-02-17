from django.db import models
from django.conf import settings

class Scan(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("RUNNING", "Running"),
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed"),
    ]
    target = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="scans")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Subdomain(models.Model):
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="subdomains")
    name = models.CharField(max_length=255, db_index=True)
    ip = models.GenericIPAddressField(null=True, blank=True)  # Keep for backward compatibility (primary IP)
    ips = models.JSONField(default=list, blank=True, null=False)  # All resolved IPs (IPv4 + IPv6)
    alive = models.BooleanField(default=False)
    error_msg = models.TextField(blank=True, default="", null=False)  # Error details if any

    class Meta:
        unique_together = ("scan", "name")

class Endpoint(models.Model):
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="endpoints")
    url = models.URLField(max_length=1000)
    status_code = models.IntegerField()
    title = models.CharField(max_length=255, blank=True)
    headers = models.JSONField(default=dict)
    fingerprints = models.JSONField(default=list)
    evidence = models.JSONField(default=dict)

    class Meta:
        unique_together = ("scan", "url")

class PortScanFinding(models.Model):
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="port_findings")
    host = models.CharField(max_length=255, db_index=True)
    port = models.IntegerField()
    protocol = models.CharField(max_length=10, default="tcp")
    state = models.CharField(max_length=20, default="open")
    service = models.CharField(max_length=100, blank=True)
    product = models.CharField(max_length=255, blank=True)
    version = models.CharField(max_length=100, blank=True)
    banner = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("scan", "host", "port", "protocol")
        indexes = [
            models.Index(fields=["scan", "host"]),
            models.Index(fields=["created_at"]),
        ]

class TLSScanResult(models.Model):
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="tls_results")
    host = models.CharField(max_length=255, db_index=True)
    has_https = models.BooleanField(default=False)
    supported_versions = models.JSONField(default=list)
    weak_versions = models.JSONField(default=list)
    cert_valid = models.BooleanField(null=True, blank=True)
    cert_expires_at = models.DateTimeField(null=True, blank=True)
    cert_issuer = models.TextField(blank=True)
    issues = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("scan", "host")

class DirectoryFinding(models.Model):
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="directory_findings")
    host = models.CharField(max_length=255, db_index=True)
    base_url = models.CharField(max_length=500)
    path = models.CharField(max_length=500)
    status_code = models.IntegerField()
    issue_type = models.CharField(max_length=100)
    evidence = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("scan", "host", "path")
        indexes = [
            models.Index(fields=["scan", "host"]),
            models.Index(fields=["issue_type"]),
            models.Index(fields=["created_at"]),
        ]
