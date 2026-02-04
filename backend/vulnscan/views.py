from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from reconscan.models import Scan
from .models import VulnerabilityFinding

channel_layer = get_channel_layer()


def broadcast(scan_id: int, payload: dict):
    async_to_sync(channel_layer.group_send)(
        f"scan_{scan_id}",
        {"type": "scan_event", "payload": payload},
    )


class IngestVulnerabilityFindingsView(APIView):
    """Ingest vulnerability findings (OWASP A01/A02) from Go worker"""
    permission_classes = [permissions.AllowAny]  # dev; secure with worker secret in production

    def post(self, request, scan_id: int):
        items = request.data.get("findings", [])
        try:
            scan = Scan.objects.get(id=scan_id)
        except Scan.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)

        allowed_categories = {"A01", "A02"}
        allowed_levels = {"Low", "Medium", "High"}

        findings_to_create = []
        for it in items:
            host = it.get("host")
            url = it.get("url")
            category = it.get("owasp_category")
            title = it.get("title")
            severity = it.get("severity")
            confidence = it.get("confidence")

            if not host or not url or not title:
                continue
            if category not in allowed_categories:
                continue
            if severity not in allowed_levels or confidence not in allowed_levels:
                continue

            findings_to_create.append(VulnerabilityFinding(
                scan=scan,
                host=host,
                url=url,
                owasp_category=category,
                title=title,
                severity=severity,
                confidence=confidence,
                evidence=it.get("evidence", {}) or {},
            ))

        if findings_to_create:
            VulnerabilityFinding.objects.bulk_create(findings_to_create)

        chunk_data = [
            {
                "host": f.host,
                "url": f.url,
                "owasp_category": f.owasp_category,
                "title": f.title,
                "severity": f.severity,
                "confidence": f.confidence,
                "evidence": f.evidence,
            }
            for f in findings_to_create
        ]

        broadcast(scan.id, {
            "type": "vulnerability_chunk",
            "scan_id": scan.id,
            "data": chunk_data,
        })

        return Response({"ok": True, "count": len(findings_to_create)})
