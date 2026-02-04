from rest_framework import serializers
from .models import VulnerabilityFinding


class VulnerabilityFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = VulnerabilityFinding
        fields = [
            "host",
            "url",
            "owasp_category",
            "title",
            "severity",
            "confidence",
            "evidence",
            "created_at",
        ]
