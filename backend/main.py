#!/usr/bin/env python3
"""
linscope Backend - Phase 3
- Full event storage with timestamps (for replay)
- Detection engine integration
- Alert broadcasting
- Replay API endpoints
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
import time
import asyncio
from collections import deque, defaultdict
from datetime import datetime

from detection_engine import DetectionEngine

app = FastAPI(title="linscope", version="0.3.0-phase3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage: all events with their original timestamp for replay
event_log = []  # list of (real_timestamp, event_dict)
event_store = deque(maxlen=50000)  # for quick access
connected_clients: List[WebSocket] = []
alert_clients: List[WebSocket] = []

# Structures for correlation and detection
process_tree: Dict[int, dict] = {}
detection_engine = DetectionEngine(event_callback=None)  # will set callback later

# Event batching for WebSocket (live)
event_batch = []
BATCH_INTERVAL = 0.08
MAX_BATCH_SIZE = 100

# Helper functions
def send_alert(alert_dict: dict):
    """Send alert to all alert clients"""
    alert_dict["timestamp"] = time.time()
    alert_dict["datetime"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    message = json.dumps({"type": "alert", "data": alert_dict})
    for client in alert_clients[:]:
        try:
            asyncio.create_task(client.send_text(message))
        except:
            if client in alert_clients:
                alert_clients.remove(client)

def correlate_event(event: dict):
    """Update correlation structures"""
    pid = event.get("pid")
    if not pid: return
    if event.get("event") == "exec":
        process_tree[pid] = {
            "pid": pid,
            "ppid": event.get("ppid"),
            "name": event.get("process"),
            "start_time": event.get("timestamp"),
            "children": set(),
            "files": set(),
            "connections": set()
        }
        if event.get("ppid") in process_tree:
            process_tree[event["ppid"]]["children"].add(pid)
    elif event.get("event") in ["open", "unlink", "write"] and event.get("filename"):
        if pid in process_tree:
            process_tree[pid]["files"].add(event["filename"])
    elif event.get("event") == "connect" and event.get("target"):
        if pid in process_tree:
            process_tree[pid]["connections"].add(event["target"])

# Set detection engine callback
detection_engine.event_callback = send_alert

# API Models
class EventBatch(BaseModel):
    events: List[dict]

@app.get("/")
async def root():
    return {"status": "linscope Phase 3", "events_total": len(event_log), "alerts": len(detection_engine.alert_history)}

@app.post("/api/events/batch")
async def receive_batch(batch: EventBatch):
    received = 0
    for event in batch.events:
        # Normalize event
        event["id"] = f"{event.get('pid', 0)}-{int(time.time()*1000)}"
        event["datetime"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        real_ts = time.time()
        event_log.append((real_ts, event))
        event_store.append(event)
        correlate_event(event)
        # Analyze with detection engine
        alerts = detection_engine.analyze_event(event)
        # Batch for live broadcast
        event_batch.append(event)
        received += 1
    
    return {"received": received, "total_stored": len(event_log)}

@app.get("/api/events")
async def get_events(limit: int = 100, after_index: Optional[int] = None):
    if after_index is not None:
        events = [e for _, e in event_log[after_index:after_index+limit]]
    else:
        events = list(event_store)[-limit:]
    return {"events": events, "total": len(event_log), "next_index": min(len(event_log), after_index+limit) if after_index else None}

@app.get("/api/replay/range")
async def replay_range(start: int = 0, end: int = 100):
    """Get events between indices for replay"""
    start = max(0, start)
    end = min(len(event_log), end)
    events_with_ts = [(ts, ev) for ts, ev in event_log[start:end]]
    return {"events": [ev for _, ev in events_with_ts], "timestamps": [ts for ts, _ in events_with_ts], "start_index": start, "end_index": end, "total": len(event_log)}

@app.get("/api/alerts")
async def get_alerts(limit: int = 50):
    alerts = list(detection_engine.alert_history)[-limit:]
    return {"alerts": alerts, "total": len(detection_engine.alert_history)}

@app.get("/api/anomalies")
async def get_anomalies():
    top = detection_engine.get_top_anomalies(10)
    return {"anomalies": [{"pid": pid, "score": score} for pid, score in top]}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        # Send history (last 100 events)
        history = list(event_store)[-100:]
        await websocket.send_text(json.dumps({"type": "history", "events": history}))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

@app.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    await websocket.accept()
    alert_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        alert_clients.remove(websocket)

async def batch_broadcaster():
    while True:
        await asyncio.sleep(BATCH_INTERVAL)
        if event_batch:
            message = json.dumps({
                "type": "batch",
                "events": event_batch[:],
                "timestamp": int(time.time() * 1000),
                "rate": len(event_batch) / BATCH_INTERVAL
            })
            for client in connected_clients[:]:
                try:
                    await client.send_text(message)
                except:
                    if client in connected_clients:
                        connected_clients.remove(client)
            event_batch.clear()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(batch_broadcaster())

# --- AI Endpoints for Phase 4 ---
from ai_service import ai_service
from fastapi.responses import StreamingResponse

class AIRequest(BaseModel):
    prompt: str
    context: Optional[List[Dict]] = None
    provider: str = "ollama"  # "ollama" or "groq"

class IncidentRequest(BaseModel):
    events: List[dict]

@app.post("/api/ai/chat")
async def ai_chat(request: AIRequest):
    """Stream AI chat response."""
    async def event_generator():
        async for chunk in ai_service.generate(request.prompt, request.context, request.provider):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/ai/embed")
async def ai_embed(text: str):
    """Generate embedding for text."""
    embedding = await ai_service.embed(text)
    return {"embedding": embedding}

@app.post("/api/ai/analyze-incident")
async def analyze_incident(request: IncidentRequest):
    """AI-based incident analysis."""
    analysis = await ai_service.analyze_incident(request.events)
    return {"analysis": analysis}

@app.post("/api/ai/suggest-investigation")
async def suggest_investigation(context: str):
    """Get investigation suggestions."""
    suggestions = await ai_service.suggest_investigation(context)
    return {"suggestions": suggestions}
