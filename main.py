import asyncio
import sys

import yaml

from core.logger import Logger
from core.queue import JobQueue
from core.radar import RadarAgent


async def consumer(queue: JobQueue, log: Logger):
    while True:
        event = await queue.dequeue()
        if event is None:
            await asyncio.sleep(0.1)
            continue
        log.detail(f"Consumed: {event.platform} | {event.title} @ {event.company} | "
                   f"queue depth: {queue.qsize()}")


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
        }

    job_queue = JobQueue()
    radar = RadarAgent(config, job_queue)

    radar_task = asyncio.create_task(radar.start())
    consumer_task = asyncio.create_task(consumer(job_queue, log))

    await asyncio.gather(radar_task, consumer_task)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down RadarAgent...")
        sys.exit(0)
