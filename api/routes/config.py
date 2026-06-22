import yaml
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/config", tags=["config"])

CONFIG_PATH = "config.yaml"


@router.get("")
def get_config():
    with open(CONFIG_PATH) as f:
        cfg = yaml.safe_load(f)
    return cfg


@router.patch("")
def patch_config(body: dict):
    with open(CONFIG_PATH) as f:
        cfg = yaml.safe_load(f)

    def deep_merge(base, updates):
        for k, v in updates.items():
            if k in base and isinstance(base[k], dict) and isinstance(v, dict):
                deep_merge(base[k], v)
            else:
                base[k] = v

    deep_merge(cfg, body)
    with open(CONFIG_PATH, "w") as f:
        yaml.dump(cfg, f, default_flow_style=False)
    return cfg
