from django.urls import re_path

from .consumers import VulnerabilityScanConsumer, VulnerabilityScanStreamConsumer


websocket_urlpatterns = [
    re_path(r"ws/vulnerability-scans/(?P<scan_id>\d+)/$", VulnerabilityScanConsumer.as_asgi()),
    re_path(r"ws/vulnerability-scans/stream/$", VulnerabilityScanStreamConsumer.as_asgi()),
]
