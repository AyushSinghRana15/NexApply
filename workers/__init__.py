import importlib
from typing import Optional, Tuple, Type

from workers.base import BaseWorker


PLATFORM_HANDLERS: dict[str, Tuple[str, str]] = {
    "indeed": ("workers.indeed", "IndeedWorker"),
    "naukri": ("workers.naukri", "NaukriWorker"),
    "internshala": ("workers.internshala", "InternshalaWorker"),
}


def get_worker_class(platform: str) -> Optional[Type[BaseWorker]]:
    mod_name, cls_name = PLATFORM_HANDLERS.get(platform, (None, None))
    if not mod_name or not cls_name:
        return None
    mod = importlib.import_module(mod_name)
    return getattr(mod, cls_name)