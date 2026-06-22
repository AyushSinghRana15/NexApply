import json
from typing import Any

from fastapi import WebSocket


class WSManager:
    """Broadcasts agent events to all connected dashboard clients."""

    def __init__(self):
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.add(ws)

    async def disconnect(self, ws: WebSocket):
        self._connections.discard(ws)

    async def broadcast(self, message: dict):
        dead: set[WebSocket] = set()
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        self._connections -= dead

    @property
    def count(self) -> int:
        return len(self._connections)

    async def broadcast_event(self, event_type: str, **kwargs):
        await self.broadcast({"type": event_type, **kwargs})


ws_manager = WSManager()
