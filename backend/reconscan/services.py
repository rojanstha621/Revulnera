import requests
from django.conf import settings
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Scan, Subdomain, Endpoint


GO_RECON_URL = getattr(settings, "GO_RECON_URL", "http://localhost:8080")  # your Go server


def broadcast(scan_id: int, payload: dict):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"scan_{scan_id}",
        {"type": "scan_event", "payload": payload}
    )


def run_full_scan(scan_id: int):
    scan = Scan.objects.get(id=scan_id)

    try:
        scan.status = "RUNNING"
        scan.error_message = ""
        scan.save(update_fields=["status", "error_message", "updated_at"])

        broadcast(scan.id, {"type": "scan_status", "scan_id": scan.id, "status": "RUNNING"})

        # 1) Call Go /jobs (subdomains)
        r = requests.post(
            f"{GO_RECON_URL}/jobs",
            json={"scan_id": scan.id, "target": scan.target},
            timeout=600
        )
        r.raise_for_status()
        subdomains = r.json().get("subdomains", [])

        # Store + broadcast in chunks
        chunk = []
        for item in subdomains:
            name = item.get("name")
            if not name:
                continue
            obj, _ = Subdomain.objects.update_or_create(
                scan=scan,
                name=name,
                defaults={
                    "ip": item.get("ip") or None,
                    "alive": bool(item.get("alive", False)),
                    "last_seen_at": timezone.now(),
                }
            )
            chunk.append({
                "name": obj.name,
                "ip": obj.ip,
                "alive": obj.alive
            })

            if len(chunk) >= 50:
                broadcast(scan.id, {"type": "subdomains_chunk", "scan_id": scan.id, "items": chunk})
                chunk = []

        if chunk:
            broadcast(scan.id, {"type": "subdomains_chunk", "scan_id": scan.id, "items": chunk})

        broadcast(scan.id, {"type": "phase", "scan_id": scan.id, "name": "endpoint_discovery"})

        # 2) Call Go /endpoints (endpoints + fingerprinting)
        r2 = requests.post(
            f"{GO_RECON_URL}/endpoints",
            json={"scan_id": scan.id, "target": scan.target},
            timeout=1200
        )
        r2.raise_for_status()
        endpoints = r2.json().get("endpoints", [])

        chunk = []
        for item in endpoints:
            url = item.get("url")
            if not url:
                continue

            obj, _ = Endpoint.objects.update_or_create(
                scan=scan,
                url=url,
                defaults={
                    "status_code": int(item.get("status_code", 0)),
                    "title": item.get("title", "") or "",
                    "headers": item.get("headers", {}) or {},
                    "fingerprints": item.get("fingerprints", []) or [],
                    "evidence": item.get("evidence", {}) or {},
                    "last_seen_at": timezone.now(),
                }
            )

            chunk.append({
                "url": obj.url,
                "status_code": obj.status_code,
                "title": obj.title,
                "fingerprints": obj.fingerprints,
            })

            if len(chunk) >= 50:
                broadcast(scan.id, {"type": "endpoints_chunk", "scan_id": scan.id, "items": chunk})
                chunk = []

        if chunk:
            broadcast(scan.id, {"type": "endpoints_chunk", "scan_id": scan.id, "items": chunk})

        scan.status = "COMPLETED"
        scan.save(update_fields=["status", "updated_at"])

        broadcast(scan.id, {"type": "scan_status", "scan_id": scan.id, "status": "COMPLETED"})

    except Exception as e:
        scan.status = "FAILED"
        scan.error_message = str(e)
        scan.save(update_fields=["status", "error_message", "updated_at"])
        broadcast(scan.id, {
            "type": "scan_status",
            "scan_id": scan.id,
            "status": "FAILED",
            "error": str(e),
        })
