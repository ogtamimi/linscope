from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import time
import asyncio
from collections import deque
from datetime import datetime

app = FastAPI(title="linscope", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

event_store = deque(maxlen=10000)
connected_clients: List[WebSocket] = []
event_batch: List[dict] = []
batch_lock = asyncio.Lock()
last_batch_time = time.time()

class EventBatch(BaseModel):
    events: List[dict]

# Configuration
BATCH_INTERVAL = 0.05  # Send batches every 50ms
MAX_BATCH_SIZE = 50    # Max events per batch
MAX_RATE_PER_SEC = 2000  # Rate limit

class RateLimiter:
    def __init__(self, max_per_second: int):
        self.max_per_second = max_per_second
        self.tokens = max_per_second
        self.last_update = time.time()
    
    def allow(self, count: int = 1) -> bool:
        now = time.time()
        elapsed = now - self.last_update
        self.tokens += elapsed * self.max_per_second
        self.tokens = min(self.tokens, self.max_per_second)
        self.last_update = now
        
        if self.tokens >= count:
            self.tokens -= count
            return True
        return False

rate_limiter = RateLimiter(MAX_RATE_PER_SEC)

def filter_event(event: dict) -> dict:
    """Filter and minimize event data"""
    return {
        "id": event.get("id"),
        "timestamp": event.get("timestamp"),
        "datetime": event.get("datetime"),
        "pid": event.get("pid"),
        "process": event.get("process", "unknown")[:20],  # Limit process name length
        "event": event.get("event", "unknown"),
        "target": event.get("target"),
        "filename": event.get("filename"),
        "dest_port": event.get("dest_port"),
    }

async def batch_broadcaster():
    """Periodically send batched events to all clients"""
    global event_batch, last_batch_time
    
    while True:
        await asyncio.sleep(BATCH_INTERVAL)
        
        async with batch_lock:
            if not event_batch or not connected_clients:
                continue
            
            batch = event_batch.copy()
            event_batch.clear()
            last_batch_time = time.time()
        
        # Send batch to all clients
        message = json.dumps({
            "type": "batch",
            "events": batch,
            "timestamp": int(last_batch_time * 1000),
            "rate": len(batch) / BATCH_INTERVAL
        })
        
        dead = []
        for client in connected_clients:
            try:
                await client.send_text(message)
            except Exception:
                dead.append(client)
        
        for d in dead:
            connected_clients.remove(d)

@app.on_event("startup")
async def startup():
    """Start batch broadcaster task"""
    asyncio.create_task(batch_broadcaster())

@app.get("/")
async def root():
    return {
        "status": "linscope running 🔭",
        "events": len(event_store),
        "version": "0.2.0-optimized"
    }

@app.post("/api/events/batch")
async def receive_batch(batch: EventBatch):
    """Receive batch of events from collector"""
    if not rate_limiter.allow(len(batch.events)):
        return {"received": 0, "dropped": len(batch.events), "reason": "rate limit"}
    
    filtered_events = []
    for event in batch.events:
        event_store.append(event)
        filtered_events.append(filter_event(event))
    
    # Add to broadcast queue
    async with batch_lock:
        event_batch.extend(filtered_events)
    
    return {"received": len(batch.events)}

@app.get("/api/events")
async def get_events(limit: int = 100, source: Optional[str] = None):
    """Get events with optional filtering"""
    events = list(event_store)
    if source:
        events = [e for e in events if e.get("source") == source]
    
    # Filter to minimize response size
    filtered = [filter_event(e) for e in events[-limit:]]
    return {"events": filtered, "total": len(events)}

@app.get("/api/stats")
async def get_stats():
    """Get aggregated statistics"""
    events = list(event_store)
    processes = {}
    connections = []
    
    for e in events[-1000:]:  # Only process last 1000
        if e.get("event") == "exec":
            pid = e.get("pid")
            processes[pid] = {
                "pid": pid,
                "ppid": e.get("ppid"),
                "name": e.get("process", "unknown")[:20],
                "time": e.get("datetime")
            }
        elif e.get("event") == "connect":
            connections.append({
                "pid": e.get("pid"),
                "process": e.get("process", "unknown")[:20],
                "target": e.get("target")
            })
    
    return {
        "total_events": len(events),
        "unique_processes": len(processes),
        "network_connections": len(connections),
        "processes": list(processes.values())[-50:],
        "connections": connections[-50:],
        "batch_interval": BATCH_INTERVAL,
        "max_batch_size": MAX_BATCH_SIZE,
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time event streaming"""
    await websocket.accept()
    connected_clients.append(websocket)
    
    try:
        # Send recent history
        recent = list(event_store)[-100:]
        filtered_history = [filter_event(e) for e in recent]
        await websocket.send_text(json.dumps({
            "type": "history",
            "events": filtered_history
        }))
        
        # Keep connection alive
        while True:
            # Receive ping/pong or commands
            msg = await websocket.receive_text()
            # Optional: handle client commands like filtering
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        if websocket in connected_clients:
            connected_clients.remove(websocket)
