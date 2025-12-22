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
    ip = models.GenericIPAddressField(null=True, blank=True)
    alive = models.BooleanField(default=False)

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
