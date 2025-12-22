import requests
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Scan, Subdomain, Endpoint
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
            obj, _ = Subdomain.objects.update_or_create(
                scan=scan,
                name=name,
                defaults={
                    "ip": it.get("ip") or None,
                    "alive": bool(it.get("alive", False)),
                }
            )
            out.append({"name": obj.name, "ip": obj.ip, "alive": obj.alive})

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
