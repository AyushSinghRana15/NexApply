import traceback
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def setup_error_handlers(app: FastAPI):
    log_path = Path("logs/errors.log")
    log_path.parent.mkdir(parents=True, exist_ok=True)

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        timestamp = datetime.now(timezone.utc).isoformat()

        with log_path.open("a") as f:
            f.write(f"[{timestamp}] {request.method} {request.url.path}\n{tb}\n")

        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "message": str(exc),
                "timestamp": timestamp,
            },
        )
