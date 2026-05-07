#!/usr/bin/env python3
"""
linscope - Network Monitor v2 (bpftrace + fallback)
Works on kernel 6.17+ using bpftrace, with /proc/net/tcp fallback
"""

import subprocess
import threading
import time
import socket
import struct
import os
import re

class NetworkMonitorV2:
    def __init__(self, callback):
        self.callback = callback
        self.process = None
        self.running = False
        self.thread = None
        self.use_bpftrace = False
        self.known_connections = set()

    def _parse_ip(self, packed):
        try:
            return socket.inet_ntoa(struct.pack('I', packed))
        except:
            return "0.0.0.0"

    def _parse_proc_net_tcp(self):
        """Fallback: read /proc/net/tcp for new connections"""
        try:
            with open('/proc/net/tcp', 'r') as f:
                lines = f.readlines()[1:]  # skip header
            for line in lines:
                parts = line.strip().split()
                if len(parts) < 4:
                    continue
                local = parts[1]
                remote = parts[2]
                state = parts[3]
                # state 01 = ESTABLISHED
                if state == '01':
                    # parse local/remote addresses
                    local_ip_hex, local_port_hex = local.split(':')
                    remote_ip_hex, remote_port_hex = remote.split(':')
                    local_ip = socket.inet_ntoa(bytes.fromhex(local_ip_hex)[::-1])
                    remote_ip = socket.inet_ntoa(bytes.fromhex(remote_ip_hex)[::-1])
                    local_port = int(local_port_hex, 16)
                    remote_port = int(remote_port_hex, 16)
                    # skip localhost connections
                    if remote_ip.startswith('127.'):
                        continue
                    conn_key = f"{remote_ip}:{remote_port}"
                    if conn_key not in self.known_connections:
                        self.known_connections.add(conn_key)
                        # emit event
                        event = {
                            "timestamp": time.time(),
                            "pid": 0,  # unknown from /proc
                            "process": "unknown",
                            "event": "connect",
                            "source_ip": local_ip,
                            "dest_ip": remote_ip,
                            "source_port": local_port,
                            "dest_port": remote_port,
                            "target": f"{remote_ip}:{remote_port}",
                            "source": "network_monitor_fallback"
                        }
                        event["id"] = f"net-{int(time.time()*1000)}-{remote_port}"
                        event["datetime"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                        self.callback(event)
        except Exception as e:
            print(f"[network fallback] error: {e}")

    def _bpftrace_worker(self):
        bpftrace_script = '''
        #include <net/sock.h>
        kprobe:tcp_v4_connect
        {
            $sk = (struct sock *)arg0;
            $daddr = $sk->__sk_common.skc_daddr;
            $dport = $sk->__sk_common.skc_dport;
            $saddr = $sk->__sk_common.skc_rcv_saddr;
            $sport = $sk->__sk_common.skc_num;
            $dport = ($dport >> 8) | (($dport << 8) & 0xFFFF);
            printf("%d|%s|%u|%u|%u|%u\\n", pid, comm, $saddr, $daddr, $sport, $dport);
        }
        '''
        
        cmd = ['sudo', 'bpftrace', '-e', bpftrace_script]
        try:
            self.process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
            for line in self.process.stdout:
                if not self.running:
                    break
                line = line.strip()
                if not line:
                    continue
                parts = line.split('|')
                if len(parts) >= 6:
                    try:
                        pid = int(parts[0])
                        comm = parts[1]
                        saddr = self._parse_ip(int(parts[2]))
                        daddr = self._parse_ip(int(parts[3]))
                        sport = int(parts[4])
                        dport = int(parts[5])
                        if daddr.startswith('127.'):
                            continue
                        event = {
                            "timestamp": time.time(),
                            "pid": pid,
                            "process": comm,
                            "event": "connect",
                            "source_ip": saddr,
                            "dest_ip": daddr,
                            "source_port": sport,
                            "dest_port": dport,
                            "target": f"{daddr}:{dport}",
                            "source": "network_monitor_bpftrace"
                        }
                        event["id"] = f"net-{pid}-{int(time.time()*1000)}"
                        event["datetime"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                        self.callback(event)
                    except Exception as e:
                        pass
        except Exception as e:
            print(f"[network bpftrace] error: {e}")
            self.use_bpftrace = False

    def _proc_worker(self):
        """Poll /proc/net/tcp every second"""
        while self.running:
            self._parse_proc_net_tcp()
            time.sleep(1)

    def start(self):
        # Try bpftrace first
        print("[linscope] Starting network monitor (bpftrace)...")
        self.running = True
        # Quick test for bpftrace availability
        try:
            subprocess.run(['sudo', 'bpftrace', '--version'], capture_output=True, check=True)
            self.use_bpftrace = True
            self.thread = threading.Thread(target=self._bpftrace_worker, daemon=True)
        except:
            print("[linscope] bpftrace not available, falling back to /proc/net/tcp polling")
            self.use_bpftrace = False
            self.thread = threading.Thread(target=self._proc_worker, daemon=True)
        
        self.thread.start()
        print(f"[linscope] Network monitor active ({'bpftrace' if self.use_bpftrace else 'fallback'}) ✅")

    def stop(self):
        self.running = False
        if self.process:
            self.process.terminate()
