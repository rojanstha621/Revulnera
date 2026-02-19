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
                "user_id": request.user.id,  # Pass user ID for file organization
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

class CancelScanView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, scan_id: int):
        try:
            scan = Scan.objects.get(id=scan_id, created_by=request.user)
        except Scan.DoesNotExist:
            return Response({"detail": "Scan not found"}, status=404)

        # Only cancel if scan is running
        if scan.status not in ["PENDING", "RUNNING"]:
            return Response({"detail": "Scan is not running"}, status=400)

        # Tell Go scanner to cancel
        go_url = settings.GO_RECON_URL.rstrip("/") + "/cancel"
        try:
            response = requests.post(go_url, json={"scan_id": scan.id}, timeout=5)
            if response.ok:
                # Update scan status
                scan.status = "CANCELLED"
                scan.save(update_fields=["status"])
                broadcast(scan.id, {"type": "scan_status", "scan_id": scan.id, "status": "CANCELLED"})
                return Response({"detail": "Scan cancelled"}, status=200)
            else:
                return Response({"detail": "Failed to cancel scan in scanner"}, status=500)
        except Exception as e:
            return Response({"detail": f"Go worker not reachable: {e}"}, status=500)

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

class ScanLogView(APIView):
    """Receive and broadcast log messages from Go worker"""
    permission_classes = [permissions.AllowAny]  # dev; later secure this

    def post(self, request, scan_id: int):
        message = request.data.get("message", "")
        level = request.data.get("level", "info")  # info, success, warning, error
        
        if not message:
            return Response({"detail": "message required"}, status=400)
        
        # Broadcast log message via WebSocket
        broadcast(scan_id, {
            "type": "scan_log",
            "scan_id": scan_id,
            "message": message,
            "level": level,
            "timestamp": request.data.get("timestamp", "")
        })
        
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
            "id", "host", "ip", "port", "protocol", "state", "service", "product", "version", "banner", "risk_tags"
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
                ip=it.get("ip"),  # Now populated from Go scanner
                port=port,
                protocol=it.get("protocol", "tcp"),
                state=it.get("state", "open"),
                service=it.get("service", ""),
                product=it.get("product", ""),
                version=it.get("version", ""),
                banner=it.get("banner", ""),
                risk_tags=it.get("risk_tags", []),  # Risk classification tags
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
                "ip": f.ip,
                "port": f.port,
                "protocol": f.protocol,
                "state": f.state,
                "service": f.service,
                "product": f.product,
                "version": f.version,
                "risk_tags": f.risk_tags,
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


class GenerateScanReportView(APIView):
    """Generate comprehensive report for a completed scan"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, scan_id: int):
        try:
            scan = Scan.objects.get(id=scan_id, created_by=request.user)
        except Scan.DoesNotExist:
            return Response({"detail": "Scan not found"}, status=404)

        # Collect all scan data
        subdomains = list(scan.subdomains.all().values(
            "name", "ip", "ips", "alive", "error_msg"
        ))
        endpoints = list(scan.endpoints.all().values(
            "url", "status_code", "title", "headers", "fingerprints", "evidence"
        ))
        port_findings = list(scan.port_findings.all().values(
            "host", "ip", "port", "protocol", "state", "service", "product", "version", "banner", "risk_tags"
        ))
        tls_results = list(scan.tls_results.all().values(
            "host", "has_https", "supported_versions", "weak_versions",
            "cert_valid", "cert_expires_at", "cert_issuer", "issues"
        ))
        directory_findings = list(scan.directory_findings.all().values(
            "host", "base_url", "path", "status_code", "issue_type", "evidence"
        ))

        # Calculate statistics
        total_subdomains = len(subdomains)
        alive_subdomains = sum(1 for s in subdomains if s["alive"])
        total_endpoints = len(endpoints)
        total_ports = len(port_findings)
        high_risk_ports = sum(1 for p in port_findings if "high-risk" in p.get("risk_tags", []))
        total_tls_issues = sum(len(t.get("issues", [])) for t in tls_results)
        total_directory_issues = len(directory_findings)

        # Identify critical findings
        critical_findings = []
        
        # High-risk open ports
        for port in port_findings:
            if "high-risk" in port.get("risk_tags", []):
                critical_findings.append({
                    "type": "high_risk_port",
                    "severity": "high",
                    "host": port["host"],
                    "detail": f"High-risk service {port['service']} on port {port['port']}"
                })
        
        # TLS issues
        for tls in tls_results:
            if "weak_tls_version_10" in tls.get("issues", []) or "weak_tls_version_11" in tls.get("issues", []):
                critical_findings.append({
                    "type": "weak_tls",
                    "severity": "medium",
                    "host": tls["host"],
                    "detail": f"Weak TLS versions detected: {', '.join(tls.get('weak_versions', []))}"
                })
            if "certificate_expired" in tls.get("issues", []):
                critical_findings.append({
                    "type": "expired_cert",
                    "severity": "high",
                    "host": tls["host"],
                    "detail": "SSL certificate has expired"
                })
        
        # Directory issues
        for dir_finding in directory_findings:
            if dir_finding["issue_type"] in ["git_exposed", "env_exposed"]:
                critical_findings.append({
                    "type": "sensitive_exposure",
                    "severity": "critical",
                    "host": dir_finding["host"],
                    "detail": f"Sensitive path exposed: {dir_finding['path']}"
                })

        # Technology fingerprints summary
        tech_stack = {}
        for endpoint in endpoints:
            for tech in endpoint.get("fingerprints", []):
                tech_stack[tech] = tech_stack.get(tech, 0) + 1

        # Build comprehensive report
        report = {
            "scan_info": {
                "id": scan.id,
                "target": scan.target,
                "status": scan.status,
                "created_at": scan.created_at.isoformat(),
                "updated_at": scan.updated_at.isoformat(),
                "created_by": scan.created_by.email,
            },
            "summary": {
                "total_subdomains": total_subdomains,
                "alive_subdomains": alive_subdomains,
                "total_endpoints": total_endpoints,
                "total_open_ports": total_ports,
                "high_risk_ports": high_risk_ports,
                "tls_issues": total_tls_issues,
                "directory_issues": total_directory_issues,
                "critical_findings_count": len([f for f in critical_findings if f["severity"] in ["critical", "high"]]),
            },
            "critical_findings": critical_findings[:20],  # Top 20
            "technology_stack": dict(sorted(tech_stack.items(), key=lambda x: x[1], reverse=True)[:15]),
            "detailed_results": {
                "subdomains": subdomains,
                "endpoints": endpoints,
                "port_findings": port_findings,
                "tls_results": tls_results,
                "directory_findings": directory_findings,
            }
        }

        return Response(report)


class UserReportsSummaryView(APIView):
    """Get summary of all scans for report generation"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get scans with filters
        scans = Scan.objects.filter(created_by=request.user).order_by("-created_at")
        
        # Apply date filter if provided
        date_range = request.query_params.get("range", "all")
        if date_range == "7days":
            from django.utils import timezone
            from datetime import timedelta
            cutoff = timezone.now() - timedelta(days=7)
            scans = scans.filter(created_at__gte=cutoff)
        elif date_range == "30days":
            from django.utils import timezone
            from datetime import timedelta
            cutoff = timezone.now() - timedelta(days=30)
            scans = scans.filter(created_at__gte=cutoff)
        
        # Build summary list
        summary = []
        for scan in scans:
            summary.append({
                "id": scan.id,
                "target": scan.target,
                "status": scan.status,
                "created_at": scan.created_at.isoformat(),
                "subdomain_count": scan.subdomains.count(),
                "endpoint_count": scan.endpoints.count(),
                "port_findings_count": scan.port_findings.count(),
                "has_critical_findings": scan.port_findings.filter(
                    risk_tags__contains=["high-risk"]
                ).exists() or scan.directory_findings.filter(
                    issue_type__in=["git_exposed", "env_exposed"]
                ).exists(),
            })
        
        return Response(summary)
