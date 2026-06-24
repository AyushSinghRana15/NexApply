import time
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path == "/ws":
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start) * 1000)

        print(
            f"[{datetime.now(timezone.utc).isoformat()}] "
            f"{request.method} {request.url.path} "
            f"{response.status_code} {duration_ms}ms"
        )
        return response
