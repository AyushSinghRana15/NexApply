import asyncio
from typing import Any, Optional


class JobQueue:

    def __init__(self):
        self._queue: asyncio.Queue[Any] = asyncio.Queue()

    async def enqueue(self, event: Any):
        await self._queue.put(event)

    async def dequeue(self) -> Optional[Any]:
        try:
            return await self._queue.get()
        except Exception:
            return None

    def qsize(self) -> int:
        return self._queue.qsize()
