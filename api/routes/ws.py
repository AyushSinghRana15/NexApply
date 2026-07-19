from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.core.websocket import ws_manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")
            if msg_type == "DECISION":
                job_id = data.get("job_id", "")
                action = data.get("action", "")
                await ws_manager.broadcast_event("REVIEW_CLEARED", job_id=job_id, decision=action)
                if job_id and action in ("APPROVE", "SKIP", "EDIT"):
                    try:
                        from core.workflow import resume_pipeline
                        await resume_pipeline(job_id, action)
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(ws)
