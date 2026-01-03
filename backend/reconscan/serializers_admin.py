from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Scan, Subdomain, Endpoint

User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    scan_count = serializers.SerializerMethodField()
    last_scan_date = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'is_active', 'date_joined', 'last_login', 'scan_count', 'last_scan_date']
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_scan_count(self, obj):
        return obj.scans.count()

    def get_last_scan_date(self, obj):
        last_scan = obj.scans.order_by('-created_at').first()
        return last_scan.created_at if last_scan else None


class AdminScanSummarySerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    subdomain_count = serializers.SerializerMethodField()
    endpoint_count = serializers.SerializerMethodField()

    class Meta:
        model = Scan
        fields = ['id', 'target', 'status', 'created_by_email', 'created_at', 'updated_at', 'subdomain_count', 'endpoint_count']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_subdomain_count(self, obj):
        return obj.subdomains.count()

    def get_endpoint_count(self, obj):
        return obj.endpoints.count()


class AdminScanDetailSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    subdomains = serializers.SerializerMethodField()
    endpoints = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Scan
        fields = ['id', 'target', 'status', 'created_by_email', 'created_at', 'updated_at', 'subdomains', 'endpoints', 'stats']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_subdomains(self, obj):
        subdomains = obj.subdomains.all()
        return {
            'total': subdomains.count(),
            'alive': subdomains.filter(alive=True).count(),
            'dead': subdomains.filter(alive=False).count(),
        }

    def get_endpoints(self, obj):
        endpoints = obj.endpoints.all()
        status_codes = {}
        for ep in endpoints:
            code = str(ep.status_code)
            status_codes[code] = status_codes.get(code, 0) + 1

        return {
            'total': endpoints.count(),
            'by_status_code': status_codes,
        }

    def get_stats(self, obj):
        endpoints = obj.endpoints.all()
        return {
            'subdomains_discovered': obj.subdomains.count(),
            'subdomains_alive': obj.subdomains.filter(alive=True).count(),
            'endpoints_found': endpoints.count(),
            '2xx_responses': endpoints.filter(status_code__gte=200, status_code__lt=300).count(),
            '3xx_responses': endpoints.filter(status_code__gte=300, status_code__lt=400).count(),
            '4xx_responses': endpoints.filter(status_code__gte=400, status_code__lt=500).count(),
            '5xx_responses': endpoints.filter(status_code__gte=500, status_code__lt=600).count(),
        }
