#!/usr/bin/env python3
"""
linscope Backend - Enhanced with Event Correlation
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Set
import json
import time
import asyncio
from collections import deque, defaultdict
from dataclasses import dataclass, field

app = FastAPI(title="linscope", version="0.2.0-alpha")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage
event_store = deque(maxlen=20000)
connected_clients: List[WebSocket] = []

# Event Correlation structures
@dataclass
class ProcessNode:
    pid: int
    ppid: int
    name: str
    start_time: float
    children: Set[int] = field(default_factory=set)
    files: Set[str] = field(default_factory=set)
    connections: Set[str] = field(default_factory=set)

process_tree: Dict[int, ProcessNode] = {}
file_to_process: Dict[str, Set[int]] = defaultdict(set)

# Batching for WebSocket
event_batch: List[dict] = []
BATCH_INTERVAL = 0.05  # 50ms
MAX_BATCH_SIZE = 50
rate_limiter = None  # would implement token bucket

class EventBatch(BaseModel):
    events: List[dict]

# Correlation functions
def correlate_event(event: dict):
    """Update correlation structures based on event"""
    event_type = event.get("event")
    pid = event.get("pid")
    if not pid:
        return
    
    if event_type == "exec":
        # New process
        ppid = event.get("ppid", 0)
        proc = ProcessNode(
            pid=pid,
            ppid=ppid,
            name=event.get("process", "unknown"),
            start_time=event.get("timestamp", time.time())
        )
        process_tree[pid] = proc
        if ppid in process_tree:
            process_tree[ppid].children.add(pid)
    
    elif event_type == "open" or event_type == "unlink":
        filename = event.get("filename")
        if filename:
            file_to_process[filename].add(pid)
            if pid in process_tree:
                process_tree[pid].files.add(filename)
    
    elif event_type == "connect":
        target = event.get("target")
        if target:
            if pid in process_tree:
                process_tree[pid].connections.add(target)

def get_correlated_events(pid: int, depth: int = 2) -> dict:
    """Get all events related to a process and its descendants"""
    result = {"process": None, "children": [], "files": [], "connections": []}
    if pid not in process_tree:
        return result
    
    proc = process_tree[pid]
    result["process"] = {"pid": pid, "name": proc.name, "ppid": proc.ppid}
    result["files"] = list(proc.files)
    result["connections"] = list(proc.connections)
    
    # Get children recursively
    def get_children(pids: set, level: int):
        if level <= 0:
            return
        for child_pid in pids:
            if child_pid in process_tree:
                child = process_tree[child_pid]
                result["children"].append({"pid": child_pid, "name": child.name})
                get_children(child.children, level - 1)
    
    get_children(proc.children, depth)
    return result

@app.get("/")
async def root():
    return {"status": "linscope running", "version": "0.2.0-alpha", "events": len(event_store)}

@app.post("/api/events/batch")
async def receive_batch(batch: EventBatch):
    for event in batch.events:
        # Add ID and datetime
        event["id"] = f"{event.get('pid', 0)}-{int(time.time()*1000)}"
        event["datetime"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        event_store.append(event)
        correlate_event(event)
        event_batch.append(event)
    
    return {"received": len(batch.events)}

@app.get("/api/events")
async def get_events(limit: int = 100, pid: Optional[int] = None, event_type: Optional[str] = None):
    events = list(event_store)
    if pid:
        events = [e for e in events if e.get("pid") == pid]
    if event_type:
        events = [e for e in events if e.get("event") == event_type]
    return {"events": events[-limit:], "total": len(events)}

@app.get("/api/correlate/{pid}")
async def correlate(pid: int, depth: int = 2):
    """Get correlated events for a process"""
    return get_correlated_events(pid, depth)

@app.get("/api/process-tree")
async def process_tree_endpoint():
    """Get full process tree as JSON"""
    tree = {}
    for pid, proc in process_tree.items():
        tree[pid] = {
            "name": proc.name,
            "ppid": proc.ppid,
            "children": list(proc.children),
            "files": list(proc.files),
            "connections": list(proc.connections)
        }
    return tree

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        # Send history
        recent = list(event_store)[-100:]
        await websocket.send_text(json.dumps({"type": "history", "events": recent}))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

async def batch_broadcaster():
    """Send batched events every 50ms"""
    while True:
        await asyncio.sleep(BATCH_INTERVAL)
        if event_batch:
            message = json.dumps({
                "type": "batch",
                "events": event_batch[:],
                "timestamp": int(time.time() * 1000),
                "rate": len(event_batch) / BATCH_INTERVAL
            })
            dead = []
            for client in connected_clients:
                try:
                    await client.send_text(message)
                except:
                    dead.append(client)
            for d in dead:
                connected_clients.remove(d)
            event_batch.clear()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(batch_broadcaster())
