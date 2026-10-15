"""WebSocket endpoint for live simulation streaming."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/live/{run_id}")
async def live_stream(websocket: WebSocket, run_id: str):
    """Stream simulation windows and predictions in real-time.

    Client sends:
      {"action": "start", "speed": 1.0}  – begin/resume streaming
      {"action": "pause"}                – pause
      {"action": "set_speed", "speed": 4.0}

    Server sends per window:
      {"type": "window", "data": {...predictions, features, timestamps...}}
      {"type": "event", "data": {...anomaly event...}}
    """
    await websocket.accept()

    speed = 1.0
    paused = True

    try:
        while True:
            # Wait for client commands
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                msg = json.loads(raw)
                action = msg.get("action", "")

                if action == "start":
                    paused = False
                    speed = msg.get("speed", 1.0)
                elif action == "pause":
                    paused = True
                elif action == "set_speed":
                    speed = msg.get("speed", speed)

            except asyncio.TimeoutError:
                pass

            if not paused:
                # TODO: fetch next window from the run and stream it
                await websocket.send_json({
                    "type": "heartbeat",
                    "run_id": run_id,
                    "speed": speed,
                })
                await asyncio.sleep(1.0 / max(speed, 0.5))

    except WebSocketDisconnect:
        pass
