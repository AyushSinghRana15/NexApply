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
                from api.services.agent_bridge import agent_bridge
                job_id = data.get("job_id", "")
                action = data.get("action", "")
                await ws_manager.broadcast_event("REVIEW_CLEARED", job_id=job_id, decision=action)
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(ws)
