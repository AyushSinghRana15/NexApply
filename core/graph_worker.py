import asyncio
import traceback

from core.logger import Logger
from core.models import JobEvent
from core.queue import JobQueue
from core.workflow import invoke_pipeline

_log = Logger()


class GraphWorker:

    def __init__(self, config: dict, input_queue: JobQueue):
        self.cfg = config
        self.input_queue = input_queue
        self._concurrency = config.get("fleet", {}).get("max_concurrent_browsers", 3)
        self._semaphore = asyncio.Semaphore(self._concurrency)
        self._processed = 0
        self._failed = 0

    async def start(self):
        _log.start(f"GraphWorker started — concurrency: {self._concurrency}")
        asyncio.create_task(self._heartbeat())

        while True:
            event = await self.input_queue.dequeue()
            if event is None:
                await asyncio.sleep(0.1)
                continue
            asyncio.create_task(self._process(event))

    async def _process(self, event: JobEvent):
        async with self._semaphore:
            try:
                _log.detail(f"GraphWorker: processing {event.title} @ {event.company} [{event.platform}]")
                result = await invoke_pipeline(event)
                final = result.get("final_status", "UNKNOWN")
                _log.detail(f"GraphWorker: {event.job_id} finished — {final}")
                self._processed += 1
            except Exception as e:
                _log.error(f"GraphWorker: {event.job_id} failed — {e}")
                _log.detail(traceback.format_exc())
                self._failed += 1

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(60)
            _log.info(
                f"GraphWorker alive — {self._processed} processed, "
                f"{self._failed} failed, queue: {self.input_queue.qsize()}"
            )
