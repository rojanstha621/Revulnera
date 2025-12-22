import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ScanConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.scan_id = self.scope["url_route"]["kwargs"]["scan_id"]
        self.group_name = f"scan_{self.scan_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({"type": "connected", "scan_id": int(self.scan_id)}))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def scan_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
