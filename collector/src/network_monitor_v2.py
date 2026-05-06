#!/usr/bin/env python3
"""
linscope - Network Monitor v2
Uses bpftrace for kernel 6.17+ compatibility
"""

import subprocess
import threading
import time
import socket
import struct

class NetworkMonitorV2:
    def __init__(self, callback):
        self.callback = callback
        self.process = None
        self.running = False
        self.thread = None

    def _parse_ip(self, packed):
        try:
            return socket.inet_ntoa(struct.pack('I', packed))
        except:
            return "0.0.0.0"

    def start(self):
        print("[linscope] Starting network monitor (bpftrace)...")
        
        bpftrace_script = '''
        kprobe:tcp_v4_connect
        {
            printf("CONNECT|%d|%s\\n", pid, comm);
        }
        '''
        
        def parse_output():
            self.running = True
            cmd = ["sudo", "bpftrace", "-e", bpftrace_script]
            
            try:
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1
                )
                
                for line in self.process.stdout:
                    if not self.running:
                        break
                    line = line.strip()
                    if "CONNECT" in line:
                        event = {
                            "timestamp": time.time(),
                            "pid": 0,
                            "process": "unknown",
                            "event": "connect",
                            "target": "external",
                            "source": "network_monitor_v2"
                        }
                        event["id"] = f"net-{int(time.time()*1000)}"
                        event["datetime"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                        self.callback(event)
                        print("[network] Connection detected")
            except Exception as e:
                print(f"[network] Error: {e}")
        
        self.thread = threading.Thread(target=parse_output, daemon=True)
        self.thread.start()
        print("[linscope] Network monitor active")
    
    def stop(self):
        self.running = False
        if self.process:
            self.process.terminate()
