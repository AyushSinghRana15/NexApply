import asyncio
import logging
import os

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from core.guard import GuardAgent, WSManager
from core.logger import Logger

log = Logger()
logging.getLogger("uvicorn.access").disabled = True
logging.getLogger("uvicorn.error").disabled = True


class DashboardServer:

    def __init__(self, ws_manager: WSManager, guard_agent: GuardAgent, port: int = 8000):
        self.ws_manager = ws_manager
        self.guard_agent = guard_agent
        self.port = port
        self._app = self._build_app()

    def _build_app(self) -> FastAPI:
        app = FastAPI()

        static_dir = os.path.join(os.path.dirname(__file__), "static")
        os.makedirs(static_dir, exist_ok=True)

        @app.get("/")
        async def index():
            return FileResponse(os.path.join(static_dir, "index.html"))

        @app.get("/screenshot/{job_id}")
        async def get_screenshot(job_id: str):
            screenshots_dir = "logs/screenshots"
            if not os.path.isdir(screenshots_dir):
                return {"error": "no screenshots directory"}
            for f in os.listdir(screenshots_dir):
                if f.startswith(job_id):
                    return FileResponse(os.path.join(screenshots_dir, f))
            return {"error": f"screenshot not found for {job_id}"}

        @app.websocket("/ws")
        async def websocket_endpoint(ws: WebSocket):
            await ws.accept()
            await self.ws_manager.connect(ws)
            log.detail(f"Dashboard client connected ({self.ws_manager.count} total)")

            try:
                while True:
                    data = await ws.receive_json()
                    msg_type = data.get("type")
                    if msg_type == "DECISION":
                        job_id = data.get("job_id", "")
                        action = data.get("action", "")
                        if job_id and action:
                            await self.guard_agent.on_decision(job_id, action)
                        else:
                            log.warn(f"Invalid DECISION message: {data}")
            except WebSocketDisconnect:
                pass
            except Exception as e:
                log.warn(f"WebSocket error: {e}")
            finally:
                await self.ws_manager.disconnect(ws)
                log.detail(f"Dashboard client disconnected ({self.ws_manager.count} total)")

        return app

    async def start(self):
        log.dashboard_start(f"http://localhost:{self.port}")
        config = uvicorn.Config(
            self._app,
            host="0.0.0.0",
            port=self.port,
            log_level="error",
            ws_ping_interval=30,
        )
        server = uvicorn.Server(config)
        await server.serve()
