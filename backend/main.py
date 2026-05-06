from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import time
from collections import deque

app = FastAPI(title="linscope", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

event_store = deque(maxlen=10000)
connected_clients: List[WebSocket] = []

class EventBatch(BaseModel):
    events: List[dict]

@app.get("/")
async def root():
    return {"status": "linscope running 🔭", "events": len(event_store)}

@app.post("/api/events/batch")
async def receive_batch(batch: EventBatch):
    for event in batch.events:
        event_store.append(event)
        await broadcast(event)
    return {"received": len(batch.events)}

@app.get("/api/events")
async def get_events(limit: int = 100, source: Optional[str] = None):
    events = list(event_store)
    if source:
        events = [e for e in events if e.get("source") == source]
    return {"events": events[-limit:], "total": len(events)}

@app.get("/api/stats")
async def get_stats():
    events = list(event_store)
    processes = {}
    connections = []
    for e in events:
        if e.get("event") == "exec":
            pid = e.get("pid")
            processes[pid] = {
                "pid": pid,
                "ppid": e.get("ppid"),
                "name": e.get("process"),
                "time": e.get("datetime")
            }
        elif e.get("event") == "connect":
            connections.append({
                "pid": e.get("pid"),
                "process": e.get("process"),
                "target": e.get("target")
            })
    return {
        "total_events": len(events),
        "unique_processes": len(processes),
        "network_connections": len(connections),
        "processes": list(processes.values())[-50:],
        "connections": connections[-50:]
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        recent = list(event_store)[-100:]
        await websocket.send_text(json.dumps({"type": "history", "events": recent}))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

async def broadcast(event: dict):
    if not connected_clients:
        return
    message = json.dumps({"type": "event", "data": event})
    dead = []
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            dead.append(client)
    for d in dead:
        connected_clients.remove(d)
