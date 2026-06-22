import asyncio
import sys

import yaml

from core.logger import Logger
from core.queue import JobQueue
from core.radar import RadarAgent
from core.tailor import TailorAgent


async def phase3_consumer(queue: JobQueue, log: Logger):
    while True:
        result = await queue.dequeue()
        if result is None:
            await asyncio.sleep(0.1)
            continue
        log.detail(f"[Phase 3] TailoredResult waiting — {result.title} @ {result.company} | "
                   f"score: {result.match_score}/100 | queue depth: {queue.qsize()}")


async def main():
    log = Logger()

    try:
        with open("config.yaml") as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        log.error("config.yaml not found — using defaults")
        config = {
            "platforms": {"linkedin": True, "indeed": True, "naukri": True, "internshala": True},
            "polling_interval_seconds": 30,
            "filters": {},
            "tailor": {"min_match_score": 60},
        }

    job_queue = JobQueue()
    tailor_queue = JobQueue()

    radar = RadarAgent(config, job_queue)
    tailor = TailorAgent(config, job_queue, tailor_queue)

    radar_task = asyncio.create_task(radar.start())
    tailor_task = asyncio.create_task(tailor.start())
    consumer_task = asyncio.create_task(phase3_consumer(tailor_queue, log))

    await asyncio.gather(radar_task, tailor_task, consumer_task)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down NexApply...")
        sys.exit(0)
