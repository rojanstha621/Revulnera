import ipaddress
import re
from urllib.parse import urlparse

from rest_framework import serializers

from .models import Scan, Subdomain, Endpoint, PortScanFinding, TLSScanResult, DirectoryFinding


HOSTNAME_LABEL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", re.IGNORECASE)

class ScanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scan
        fields = ["id", "target", "status", "created_at", "updated_at", "auth_headers", "auth_cookies"]

    def validate_target(self, value):
        raw_value = (value or "").strip()
        if not raw_value:
            raise serializers.ValidationError("Target is required.")
        if len(raw_value) > 255:
            raise serializers.ValidationError("Target must be 255 characters or fewer.")
        if any(ch.isspace() for ch in raw_value):
            raise serializers.ValidationError("Target cannot contain whitespace.")

        candidate = raw_value
        if "://" in raw_value:
            parsed = urlparse(raw_value)
            candidate = parsed.hostname or ""

        candidate = candidate.strip(".").lower()
        if not candidate:
            raise serializers.ValidationError("Target must be a valid domain or IP address.")

        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass

        labels = candidate.split(".")
        if len(labels) < 2:
            raise serializers.ValidationError("Target must include a valid domain suffix (example.com).")
        if any(not HOSTNAME_LABEL_RE.match(label) for label in labels):
            raise serializers.ValidationError("Target contains invalid domain characters.")

        return candidate

    def _validate_auth_map(self, value, field_name):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError({field_name: "Must be a JSON object."})

        normalized = {}
        for key, item in value.items():
            key_text = str(key).strip()
            if not key_text:
                raise serializers.ValidationError({field_name: "Header/cookie names cannot be blank."})
            normalized[key_text] = str(item)
        return normalized

    def validate_auth_headers(self, value):
        return self._validate_auth_map(value, "auth_headers")

    def validate_auth_cookies(self, value):
        return self._validate_auth_map(value, "auth_cookies")

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
