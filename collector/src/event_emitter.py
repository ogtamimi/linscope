import json
import queue
import threading
import time
import requests
from datetime import datetime

class EventEmitter:
    def __init__(self, backend_url="http://localhost:8000"):
        self.backend_url = backend_url
        self.queue = queue.Queue(maxsize=10000)
        self.running = False
        self.stats = {"sent": 0, "failed": 0}

    def emit(self, event: dict):
        event["id"] = f"{event.get('pid', 0)}-{int(time.time()*1000)}"
        event["datetime"] = datetime.fromtimestamp(
            event.get("timestamp", time.time())
        ).isoformat()
        try:
            self.queue.put_nowait(event)
        except queue.Full:
            pass

    def _sender_loop(self):
        batch = []
        while self.running:
            try:
                event = self.queue.get(timeout=0.1)
                batch.append(event)
                if len(batch) >= 20:
                    self._send_batch(batch)
                    batch = []
            except queue.Empty:
                if batch:
                    self._send_batch(batch)
                    batch = []

    def _send_batch(self, batch):
        try:
            requests.post(
                f"{self.backend_url}/api/events/batch",
                json={"events": batch},
                timeout=2
            )
            self.stats["sent"] += len(batch)
        except Exception:
            self.stats["failed"] += len(batch)

    def start(self):
        self.running = True
        threading.Thread(target=self._sender_loop, daemon=True).start()
        print(f"[linscope] Emitter → {self.backend_url} ✅")

    def stop(self):
        self.running = False
