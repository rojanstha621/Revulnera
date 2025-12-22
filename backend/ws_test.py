import asyncio
import sys
import websockets

scan_id = sys.argv[1] if len(sys.argv) > 1 else "12"

async def main():
    uri = f"ws://localhost:8000/ws/scans/{scan_id}/"
    async with websockets.connect(uri) as ws:
        print("CONNECTED:", uri)
        while True:
            msg = await ws.recv()
            print("RECV:", msg)

asyncio.run(main())
