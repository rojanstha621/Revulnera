from rest_framework import serializers
from .models import Scan, Subdomain, Endpoint, PortScanFinding, TLSScanResult, DirectoryFinding

class ScanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scan
        fields = ["id", "target", "status", "created_at", "updated_at"]

class SubdomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subdomain
        fields = ["name", "ip", "ips", "alive", "error_msg"]

class EndpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = Endpoint
        fields = ["url", "status_code", "title", "headers", "fingerprints", "evidence"]

class PortScanFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortScanFinding
        fields = ["host", "ip", "port", "protocol", "state", "service", "product", "version", "banner", "risk_tags"]

class TLSScanResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = TLSScanResult
        fields = ["host", "has_https", "supported_versions", "weak_versions", "cert_valid", 
                  "cert_expires_at", "cert_issuer", "issues"]

class DirectoryFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectoryFinding
        fields = ["host", "base_url", "path", "status_code", "issue_type", "evidence"]
