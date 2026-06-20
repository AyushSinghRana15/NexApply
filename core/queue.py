import asyncio
from typing import Optional

from core.models import JobEvent


class JobQueue:

    def __init__(self):
        self._queue: asyncio.Queue[JobEvent] = asyncio.Queue()

    async def enqueue(self, event: JobEvent):
        await self._queue.put(event)

    async def dequeue(self) -> Optional[JobEvent]:
        try:
            return await self._queue.get()
        except Exception:
            return None

    def qsize(self) -> int:
        return self._queue.qsize()
