from rest_framework import serializers
from .models import Scan, Subdomain, Endpoint

class ScanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scan
        fields = ["id", "target", "status", "created_at", "updated_at"]

class SubdomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subdomain
        fields = ["name", "ip", "alive"]

class EndpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = Endpoint
        fields = ["url", "status_code", "title", "headers", "fingerprints", "evidence"]
