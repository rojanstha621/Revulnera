from django.db import models
from reconscan.models import Scan


class VulnerabilityFinding(models.Model):
    OWASP_CHOICES = [
        ("A01", "Broken Access Control"),
        ("A02", "Cryptographic Failures"),
    ]
    SEVERITY_CHOICES = [
        ("Low", "Low"),
        ("Medium", "Medium"),
        ("High", "High"),
    ]
    CONFIDENCE_CHOICES = [
        ("Low", "Low"),
        ("Medium", "Medium"),
        ("High", "High"),
    ]

    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="vulnerability_findings")
    host = models.CharField(max_length=255, db_index=True)
    url = models.URLField(max_length=1000)
    owasp_category = models.CharField(max_length=3, choices=OWASP_CHOICES, db_index=True)
    title = models.CharField(max_length=255)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    confidence = models.CharField(max_length=10, choices=CONFIDENCE_CHOICES)
    evidence = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["scan", "host"]),
            models.Index(fields=["owasp_category"]),
            models.Index(fields=["created_at"]),
        ]
