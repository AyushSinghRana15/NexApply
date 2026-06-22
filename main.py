import asyncio
import sys

import yaml

from core.fleet import ApplyFleet
from core.logger import Logger
from core.queue import JobQueue
from core.radar import RadarAgent
from core.tailor import TailorAgent


async def guard_consumer(queue: JobQueue, log: Logger):
    while True:
        payload = await queue.dequeue()
        if payload is None:
            await asyncio.sleep(0.1)
            continue
        log.detail(f"[Guard] ApplicationPayload received — {payload.title} @ {payload.company} | "
                   f"status: {payload.status} | queue depth: {queue.qsize()}")


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
            "fleet": {"max_concurrent_browsers": 3, "headless": True},
        }

    job_queue = JobQueue()
    tailor_queue = JobQueue()
    guard_queue = JobQueue()

    radar = RadarAgent(config, job_queue)
    tailor = TailorAgent(config, job_queue, tailor_queue)
    fleet = ApplyFleet(config, tailor_queue, guard_queue)

    radar_task = asyncio.create_task(radar.start())
    tailor_task = asyncio.create_task(tailor.start())
    fleet_task = asyncio.create_task(fleet.start())
    guard_task = asyncio.create_task(guard_consumer(guard_queue, log))

    await asyncio.gather(radar_task, tailor_task, fleet_task, guard_task)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down NexApply...")
        sys.exit(0)
