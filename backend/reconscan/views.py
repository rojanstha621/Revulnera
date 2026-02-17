import requests
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils.dateparse import parse_datetime

from .models import Scan, Subdomain, Endpoint, PortScanFinding, TLSScanResult, DirectoryFinding
from .serializers import ScanSerializer

channel_layer = get_channel_layer()

def broadcast(scan_id: int, payload: dict):
    async_to_sync(channel_layer.group_send)(
        f"scan_{scan_id}",
        {"type": "scan_event", "payload": payload},
    )

class StartScanView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        target = request.data.get("target")
        if not target:
            return Response({"detail": "target required"}, status=400)

        scan = Scan.objects.create(
            target=target,
            status="PENDING",
            created_by=request.user
        )

        broadcast(scan.id, {"type": "scan_status", "scan_id": scan.id, "status": "PENDING"})

        # Tell Go to start (Go will stream chunks back to Django)
        # We'll pass scan_id + target + Django base url (callback)
        go_url = settings.GO_RECON_URL.rstrip("/") + "/scan"
        django_base = request.build_absolute_uri("/").rstrip("/")

        # Optional: lightweight shared secret for Go->Django (dev)
        token = request.headers.get("Authorization", "")

        try:
            requests.post(go_url, json={
                "scan_id": scan.id,
                "target": target,
                "backend_base": django_base,
                "auth_header": token,  # Go will reuse it when posting back
            }, timeout=5)
        except Exception as e:
            scan.status = "FAILED"
            scan.save(update_fields=["status"])
            broadcast(scan.id, {"type": "scan_status", "scan_id": scan.id, "status": "FAILED", "error": str(e)})
            return Response({"detail": f"Go worker not reachable: {e}"}, status=500)

        scan.status = "RUNNING"
        scan.save(update_fields=["status"])
        broadcast(scan.id, {"type": "scan_status", "scan_id": scan.id, "status": "RUNNING"})

        return Response(ScanSerializer(scan).data, status=201)

class IngestSubdomainsView(APIView):
    permission_classes = [permissions.AllowAny]  # dev; later secure this

    def post(self, request, scan_id: int):
        items = request.data.get("items", [])
        scan = Scan.objects.get(id=scan_id)

        out = []
        for it in items:
            name = it.get("name")
            if not name:
                continue
            
            # Extract IPs (support both old 'ip' and new 'ips' fields)
            ips = it.get("ips", [])
            if not ips and it.get("ip"):
                ips = [it.get("ip")]
            
            # Get primary IP (first one for backward compatibility)
            primary_ip = ips[0] if ips else None
            
            obj, _ = Subdomain.objects.update_or_create(
                scan=scan,
                name=name,
                defaults={
                    "ip": primary_ip,
                    "ips": ips,
                    "alive": bool(it.get("alive", False)),
                    "error_msg": it.get("error_msg", ""),
                }
            )
            out.append({
                "name": obj.name, 
                "ip": obj.ip, 
                "ips": obj.ips,
                "alive": obj.alive,
                "error_msg": obj.error_msg
            })

        broadcast(scan.id, {"type": "subdomains_chunk", "scan_id": scan.id, "data": out})
        return Response({"ok": True, "count": len(out)})

class IngestEndpointsView(APIView):
    permission_classes = [permissions.AllowAny]  # dev; later secure this

    def post(self, request, scan_id: int):
        items = request.data.get("items", [])
        scan = Scan.objects.get(id=scan_id)

        out = []
        for it in items:
            url = it.get("url")
            if not url:
                continue
            obj, _ = Endpoint.objects.update_or_create(
                scan=scan,
                url=url,
                defaults={
                    "status_code": int(it.get("status_code", 0)),
                    "title": it.get("title", "") or "",
                    "headers": it.get("headers", {}) or {},
                    "fingerprints": it.get("fingerprints", []) or [],
                    "evidence": it.get("evidence", {}) or {},
                }
            )
            out.append({
                "url": obj.url,
                "status_code": obj.status_code,
                "title": obj.title,
                "headers": obj.headers,
                "fingerprints": obj.fingerprints,
                "evidence": obj.evidence,
            })

        broadcast(scan.id, {"type": "endpoints_chunk", "scan_id": scan.id, "data": out})
        return Response({"ok": True, "count": len(out)})

class UpdateScanStatusView(APIView):
    permission_classes = [permissions.AllowAny]  # dev; later secure this

    def post(self, request, scan_id: int):
        scan = Scan.objects.get(id=scan_id)
        new_status = request.data.get("status")
        error = request.data.get("error", "")

        if new_status not in ["RUNNING", "COMPLETED", "FAILED"]:
            return Response({"detail": "invalid status"}, status=400)

        scan.status = new_status
        scan.save(update_fields=["status"])
        payload = {"type": "scan_status", "scan_id": scan.id, "status": new_status}
        if error:
            payload["error"] = error
        broadcast(scan.id, payload)
        return Response({"ok": True})


class UserScansListView(APIView):
    """Get all scans for authenticated user with summary data"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scans = Scan.objects.filter(created_by=request.user).order_by("-created_at")
        
        data = []
        for scan in scans:
            subdomain_count = scan.subdomains.count()
            endpoint_count = scan.endpoints.count()
            alive_count = scan.subdomains.filter(alive=True).count()
            
            data.append({
                "id": scan.id,
                "target": scan.target,
                "status": scan.status,
                "created_at": scan.created_at.isoformat(),
                "updated_at": scan.updated_at.isoformat(),
                "subdomain_count": subdomain_count,
                "endpoint_count": endpoint_count,
                "alive_count": alive_count,
            })
        
        return Response(data)


class UserScanDetailView(APIView):
    """Get detailed scan data including all subdomains and endpoints"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, scan_id: int):
        scan = Scan.objects.get(id=scan_id)
        
        # Check ownership
        if scan.created_by != request.user:
            return Response({"detail": "Not found"}, status=404)
        
        subdomains = scan.subdomains.all().values("id", "name", "ip", "ips", "alive", "error_msg")
        endpoints = scan.endpoints.all().values(
            "id", "url", "status_code", "title", "headers", "fingerprints"
        )
        
        # Network analysis results
        port_findings = scan.port_findings.all().values(
            "id", "host", "port", "protocol", "state", "service", "product", "version", "banner"
        )
        tls_results = scan.tls_results.all().values(
            "id", "host", "has_https", "supported_versions", "weak_versions", 
            "cert_valid", "cert_expires_at", "cert_issuer", "issues"
        )
        directory_findings = scan.directory_findings.all().values(
            "id", "host", "base_url", "path", "status_code", "issue_type", "evidence"
        )
        
        return Response({
            "id": scan.id,
            "target": scan.target,
            "status": scan.status,
            "created_at": scan.created_at.isoformat(),
            "updated_at": scan.updated_at.isoformat(),
            "subdomains": list(subdomains),
            "endpoints": list(endpoints),
            "subdomain_count": scan.subdomains.count(),
            "endpoint_count": scan.endpoints.count(),
            "alive_count": scan.subdomains.filter(alive=True).count(),
            # Network analysis data
            "port_findings": list(port_findings),
            "tls_results": list(tls_results),
            "directory_findings": list(directory_findings),
            "port_findings_count": scan.port_findings.count(),
            "tls_results_count": scan.tls_results.count(),
            "directory_findings_count": scan.directory_findings.count(),
        })


class IngestPortScanFindingsView(APIView):
    """Ingest port scan findings from Go worker"""
    permission_classes = [permissions.AllowAny]  # dev; secure with worker secret in production

    def post(self, request, scan_id: int):
        items = request.data.get("items", [])
        scan = Scan.objects.get(id=scan_id)

        findings_to_create = []
        for it in items:
            host = it.get("host")
            port = it.get("port")
            if not host or port is None:
                continue
            
            findings_to_create.append(PortScanFinding(
                scan=scan,
                host=host,
                port=port,
                protocol=it.get("protocol", "tcp"),
                state=it.get("state", "open"),
                service=it.get("service", ""),
                product=it.get("product", ""),
                version=it.get("version", ""),
                banner=it.get("banner", ""),
            ))

        # Bulk create for efficiency
        if findings_to_create:
            PortScanFinding.objects.bulk_create(
                findings_to_create,
                ignore_conflicts=True  # Skip duplicates
            )

        # Broadcast chunk
        chunk_data = [
            {
                "host": f.host,
                "port": f.port,
                "protocol": f.protocol,
                "state": f.state,
                "service": f.service,
                "product": f.product,
                "version": f.version,
            }
            for f in findings_to_create
        ]
        
        broadcast(scan.id, {
            "type": "network_ports_chunk",
            "scan_id": scan.id,
            "data": chunk_data
        })

        return Response({"ok": True, "count": len(findings_to_create)})


class IngestTLSResultView(APIView):
    """Ingest TLS scan result from Go worker"""
    permission_classes = [permissions.AllowAny]  # dev; secure with worker secret in production

    def post(self, request, scan_id: int):
        scan = Scan.objects.get(id=scan_id)
        host = request.data.get("host")
        
        if not host:
            return Response({"detail": "host required"}, status=400)

        # Parse cert_expires_at if present
        cert_expires_at = request.data.get("cert_expires_at")
        if cert_expires_at:
            cert_expires_at = parse_datetime(cert_expires_at)

        obj, created = TLSScanResult.objects.update_or_create(
            scan=scan,
            host=host,
            defaults={
                "has_https": bool(request.data.get("has_https", False)),
                "supported_versions": request.data.get("supported_versions", []),
                "weak_versions": request.data.get("weak_versions", []),
                "cert_valid": request.data.get("cert_valid"),
                "cert_expires_at": cert_expires_at,
                "cert_issuer": request.data.get("cert_issuer", ""),
                "issues": request.data.get("issues", []),
            }
        )

        # Broadcast result
        broadcast(scan.id, {
            "type": "network_tls_result",
            "scan_id": scan.id,
            "host": obj.host,
            "data": {
                "has_https": obj.has_https,
                "supported_versions": obj.supported_versions,
                "weak_versions": obj.weak_versions,
                "cert_valid": obj.cert_valid,
                "issues": obj.issues,
            }
        })

        return Response({"ok": True, "created": created})


class IngestDirectoryFindingsView(APIView):
    """Ingest directory findings from Go worker"""
    permission_classes = [permissions.AllowAny]  # dev; secure with worker secret in production

    def post(self, request, scan_id: int):
        items = request.data.get("items", [])
        scan = Scan.objects.get(id=scan_id)

        findings_to_create = []
        for it in items:
            host = it.get("host")
            path = it.get("path")
            if not host or not path:
                continue
            
            findings_to_create.append(DirectoryFinding(
                scan=scan,
                host=host,
                base_url=it.get("base_url", ""),
                path=path,
                status_code=it.get("status_code", 0),
                issue_type=it.get("issue_type", ""),
                evidence=it.get("evidence", ""),
            ))

        # Bulk create for efficiency
        if findings_to_create:
            DirectoryFinding.objects.bulk_create(
                findings_to_create,
                ignore_conflicts=True  # Skip duplicates
            )

        # Broadcast chunk
        chunk_data = [
            {
                "host": f.host,
                "base_url": f.base_url,
                "path": f.path,
                "status_code": f.status_code,
                "issue_type": f.issue_type,
                "evidence": f.evidence,
            }
            for f in findings_to_create
        ]
        
        broadcast(scan.id, {
            "type": "network_dirs_chunk",
            "scan_id": scan.id,
            "data": chunk_data
        })

        return Response({"ok": True, "count": len(findings_to_create)})
