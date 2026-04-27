import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from vulnerability_detection.models import VulnerabilityScan


logger = logging.getLogger(__name__)


def _scan_group(scan_id: int) -> str:
    return f"vuln_scan_{int(scan_id)}"


def _user_group(user_id: int) -> str:
    return f"vuln_user_{int(user_id)}"


def broadcast_scan_event(scan_id: int, payload: dict, user_id: int | None = None):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    resolved_user_id = user_id
    if resolved_user_id is None:
        resolved_user_id = (
            VulnerabilityScan.objects.filter(pk=scan_id)
            .values_list("created_by_id", flat=True)
            .first()
        )

    event = {
        "type": "scan_event",
        "payload": {
            "scan_id": int(scan_id),
            **(payload or {}),
        },
    }

    try:
        async_to_sync(channel_layer.group_send)(_scan_group(scan_id), event)
        if resolved_user_id:
            async_to_sync(channel_layer.group_send)(_user_group(int(resolved_user_id)), event)
    except Exception:
        logger.exception("[ws] failed to broadcast event for scan_id=%s", scan_id)
