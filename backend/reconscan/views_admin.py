from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth import get_user_model

from .models import Scan, Subdomain, Endpoint
from .serializers_admin import AdminUserSerializer, AdminScanSummarySerializer, AdminScanDetailSerializer

User = get_user_model()


class IsAdmin(permissions.BasePermission):
    """Custom permission to check if user is admin"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class AdminDashboardView(APIView):
    """Main dashboard with overall statistics"""
    permission_classes = [IsAdmin]

    def get(self, request):
        now = timezone.now()
        last_7_days = now - timedelta(days=7)
        last_30_days = now - timedelta(days=30)

        # User Statistics
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        new_users_7d = User.objects.filter(date_joined__gte=last_7_days).count()
        users_by_role = dict(User.objects.values('role').annotate(count=Count('id')).values_list('role', 'count'))

        # Scan Statistics
        total_scans = Scan.objects.count()
        scan_status_breakdown = dict(Scan.objects.values('status').annotate(count=Count('id')).values_list('status', 'count'))
        scans_7d = Scan.objects.filter(created_at__gte=last_7_days).count()
        scans_30d = Scan.objects.filter(created_at__gte=last_30_days).count()

        # Scan Performance
        completed_scans = Scan.objects.filter(status='COMPLETED')
        avg_scan_duration = None
        if completed_scans.exists():
            total_duration = sum((s.updated_at - s.created_at).total_seconds() for s in completed_scans)
            avg_scan_duration = total_duration / completed_scans.count()

        # Data Discovery Statistics
        total_subdomains = Subdomain.objects.count()
        alive_subdomains = Subdomain.objects.filter(alive=True).count()
        total_endpoints = Endpoint.objects.count()

        # HTTP Status Code Distribution
        status_codes = {}
        for ep in Endpoint.objects.values('status_code'):
            code = str(ep['status_code'])
            status_codes[code] = status_codes.get(code, 0) + 1

        return Response({
            'timestamp': now,
            'users': {
                'total': total_users,
                'active': active_users,
                'new_7d': new_users_7d,
                'by_role': users_by_role,
            },
            'scans': {
                'total': total_scans,
                'status_breakdown': scan_status_breakdown,
                'scans_7d': scans_7d,
                'scans_30d': scans_30d,
                'avg_duration_seconds': avg_scan_duration,
            },
            'data': {
                'total_subdomains': total_subdomains,
                'alive_subdomains': alive_subdomains,
                'total_endpoints': total_endpoints,
                'http_status_distribution': status_codes,
            }
        })


class AdminUsersView(APIView):
    """List and manage users with filtering and pagination"""
    permission_classes = [IsAdmin]

    def get(self, request):
        role = request.query_params.get('role')
        is_active = request.query_params.get('is_active')
        search = request.query_params.get('search')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))

        queryset = User.objects.all()

        # Filters
        if role:
            queryset = queryset.filter(role=role)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if search:
            queryset = queryset.filter(Q(email__icontains=search) | Q(full_name__icontains=search))

        # Pagination
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        users = queryset.order_by('-date_joined')[start:end]

        serializer = AdminUserSerializer(users, many=True)

        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'results': serializer.data,
        })


class AdminUserDetailView(APIView):
    """Get detailed information about a specific user"""
    permission_classes = [IsAdmin]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # User info
        user_data = AdminUserSerializer(user).data

        # User's scans
        scans = user.scans.all().order_by('-created_at')[:10]
        scans_data = AdminScanSummarySerializer(scans, many=True).data

        # User scan statistics
        scan_stats = {
            'total_scans': user.scans.count(),
            'scans_by_status': dict(user.scans.values('status').annotate(count=Count('id')).values_list('status', 'count')),
            'total_subdomains': Subdomain.objects.filter(scan__created_by=user).count(),
            'total_endpoints': Endpoint.objects.filter(scan__created_by=user).count(),
        }

        return Response({
            'user': user_data,
            'recent_scans': scans_data,
            'scan_statistics': scan_stats,
        })


class AdminScansView(APIView):
    """List and filter scans"""
    permission_classes = [IsAdmin]

    def get(self, request):
        status_filter = request.query_params.get('status')
        user_id = request.query_params.get('user_id')
        search = request.query_params.get('search')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))

        queryset = Scan.objects.all()

        # Filters
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if user_id:
            queryset = queryset.filter(created_by_id=user_id)
        if search:
            queryset = queryset.filter(target__icontains=search)

        # Pagination
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        scans = queryset.order_by('-created_at')[start:end]

        serializer = AdminScanSummarySerializer(scans, many=True)

        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'results': serializer.data,
        })


class AdminScanDetailView(APIView):
    """Get detailed information about a specific scan"""
    permission_classes = [IsAdmin]

    def get(self, request, scan_id):
        try:
            scan = Scan.objects.get(id=scan_id)
        except Scan.DoesNotExist:
            return Response({'error': 'Scan not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminScanDetailSerializer(scan)
        return Response(serializer.data)


class AdminAnalyticsView(APIView):
    """Advanced analytics and insights"""
    permission_classes = [IsAdmin]

    def get(self, request):
        period = request.query_params.get('period', '30')  # days
        days = int(period)
        cutoff = timezone.now() - timedelta(days=days)

        # Timeline: Scans per day
        scans_per_day = {}
        for scan in Scan.objects.filter(created_at__gte=cutoff):
            date = scan.created_at.date()
            scans_per_day[str(date)] = scans_per_day.get(str(date), 0) + 1

        # Top targets
        top_targets = (
            Scan.objects.filter(created_at__gte=cutoff)
            .values('target')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # Most active users
        most_active_users = (
            User.objects.annotate(scan_count=Count('scans'))
            .order_by('-scan_count')[:10]
        )
        most_active_data = []
        for user in most_active_users:
            most_active_data.append({
                'email': user.email,
                'scans': user.scan_count,
            })

        # Scan success rate
        total_scans = Scan.objects.filter(created_at__gte=cutoff).count()
        completed_scans = Scan.objects.filter(created_at__gte=cutoff, status='COMPLETED').count()
        failed_scans = Scan.objects.filter(created_at__gte=cutoff, status='FAILED').count()
        success_rate = (completed_scans / total_scans * 100) if total_scans > 0 else 0

        # Average findings per scan
        endpoints_total = Endpoint.objects.filter(scan__created_at__gte=cutoff).count()
        avg_endpoints = endpoints_total / total_scans if total_scans > 0 else 0

        subdomains_total = Subdomain.objects.filter(scan__created_at__gte=cutoff).count()
        avg_subdomains = subdomains_total / total_scans if total_scans > 0 else 0

        return Response({
            'period_days': days,
            'scans_per_day': scans_per_day,
            'top_targets': list(top_targets),
            'most_active_users': most_active_data,
            'scan_metrics': {
                'total_scans': total_scans,
                'completed': completed_scans,
                'failed': failed_scans,
                'success_rate_percent': round(success_rate, 2),
            },
            'average_findings': {
                'endpoints_per_scan': round(avg_endpoints, 2),
                'subdomains_per_scan': round(avg_subdomains, 2),
            }
        })
