#!/usr/bin/env python3
"""
Mock Collector - generates synthetic events for testing/demo
No eBPF required - works on any Linux kernel
"""

import time
import random
import requests
import threading
import signal
import sys

PROCESSES = ['bash', 'curl', 'firefox', 'systemd', 'sshd', 'python3', 'node', 'docker', 'nginx', 'redis']
TARGETS = ['github.com:443', 'google.com:443', 'example.com:80', 'api.local:8080', 'database:5432']
FILES = ['/etc/passwd', '/var/log/auth.log', '/tmp/data', '/home/user/.bashrc', '/usr/bin/ls']

class MockCollector:
    def __init__(self, backend_url="http://localhost:8000", rate=5):
        self.backend_url = backend_url
        self.rate = rate  # events per second
        self.running = False

    def generate_event(self):
        event_type = random.choice(['exec', 'connect', 'exec', 'exec'])  # 75% exec, 25% connect
        process = random.choice(PROCESSES)
        
        if event_type == 'exec':
            return {
                "timestamp": time.time(),
                "pid": random.randint(1000, 9999),
                "ppid": random.randint(1, 2000),
                "process": process,
                "event": "exec",
                "filename": random.choice(FILES),
                "source": "mock_collector"
            }
        else:
            return {
                "timestamp": time.time(),
                "pid": random.randint(1000, 9999),
                "process": process,
                "event": "connect",
                "target": random.choice(TARGETS),
                "dest_ip": f"192.168.{random.randint(0,255)}.{random.randint(0,255)}",
                "dest_port": random.choice([80, 443, 22, 3306, 5432]),
                "source": "mock_collector"
            }

    def send_batch(self, batch):
        try:
            resp = requests.post(
                f"{self.backend_url}/api/events/batch",
                json={"events": batch},
                timeout=2
            )
            if resp.status_code == 200:
                print(f"[mock] Sent {len(batch)} events")
        except Exception as e:
            print(f"[mock] Error: {e}")

    def run(self):
        self.running = True
        print(f"[mock] Mock collector starting (rate: {self.rate} events/sec)")
        print("[mock] Generating synthetic events... Press Ctrl+C to stop\n")
        
        batch = []
        while self.running:
            batch.append(self.generate_event())
            
            if len(batch) >= 10:
                self.send_batch(batch)
                batch = []
            
            time.sleep(1.0 / self.rate)

    def stop(self):
        self.running = False

def main():
    collector = MockCollector(rate=8)  # 8 events per second
    
    def shutdown(sig, frame):
        print("\n[mock] Shutting down...")
        collector.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    
    collector.run()

if __name__ == "__main__":
    main()
