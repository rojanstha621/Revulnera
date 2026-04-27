import json
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.authentication import JWTAuthentication

from vulnerability_detection.models import VulnerabilityScan


class BaseAuthConsumer(AsyncWebsocketConsumer):
    async def _resolve_user(self):
        query = parse_qs((self.scope.get("query_string") or b"").decode("utf-8"))
        token = (query.get("token") or [None])[0]
        if not token:
            return None

        try:
            return await self._get_user_from_token(token)
        except Exception:
            return None

    @database_sync_to_async
    def _get_user_from_token(self, token):
        auth = JWTAuthentication()
        validated_token = auth.get_validated_token(token)
        return auth.get_user(validated_token)


class VulnerabilityScanConsumer(BaseAuthConsumer):
    async def connect(self):
        try:
            self.scan_id = int(self.scope["url_route"]["kwargs"]["scan_id"])
        except (TypeError, ValueError, KeyError):
            await self.close(code=4400)
            return

        self.user = await self._resolve_user()

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        allowed = await self._can_access_scan(self.user.id, self.scan_id)
        if not allowed:
            await self.close(code=4403)
            return

        self.group_name = f"vuln_scan_{self.scan_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        snapshot = await self._scan_snapshot(self.scan_id)
        await self.send(
            text_data=json.dumps(
                {
                    "type": "connected",
                    "scan_id": self.scan_id,
                    "snapshot": snapshot,
                }
            )
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def scan_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    @database_sync_to_async
    def _can_access_scan(self, user_id, scan_id):
        return VulnerabilityScan.objects.filter(pk=scan_id, created_by_id=user_id).exists()

    @database_sync_to_async
    def _scan_snapshot(self, scan_id):
        scan = VulnerabilityScan.objects.filter(pk=scan_id).first()
        if not scan:
            return None
        return {
            "id": scan.id,
            "status": scan.status,
            "total_tests": scan.total_tests,
            "vulnerabilities_found": scan.vulnerabilities_found,
            "failures": scan.failures,
            "retry_count": scan.retry_count,
            "error_message": scan.error_message,
        }


class VulnerabilityScanStreamConsumer(BaseAuthConsumer):
    async def connect(self):
        self.user = await self._resolve_user()
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = f"vuln_user_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({"type": "connected", "scope": "user_stream"}))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def scan_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
