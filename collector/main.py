#!/usr/bin/env python3
import threading, signal, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.process_monitor import ProcessMonitor
from src.network_monitor_v2 import NetworkMonitorV2   # stable, no file_monitor
from src.event_emitter import EventEmitter

def main():
    if os.geteuid() != 0:
        print("❌ Requires root: sudo python3 main.py")
        sys.exit(1)

    print("""
    ██╗     ██╗███╗   ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗
    ██║     ██║████╗  ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
    ██║     ██║██╔██╗ ██║███████╗██║     ██║   ██║██████╔╝█████╗
    ██║     ██║██║╚██╗██║╚════██║██║     ██║   ██║██╔═══╝ ██╔══╝
    ███████╗██║██║ ╚████║███████║╚██████╗╚██████╔╝██║     ███████╗
    ╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝
    v1.0.0 — Process + Network Monitoring (stable, file_monitor disabled)
    """)

    emitter = EventEmitter(backend_url="http://localhost:8000")
    emitter.start()

    def shutdown(sig, frame):
        print("\n[linscope] Shutting down...")
        emitter.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Only stable monitors
    t1 = threading.Thread(target=ProcessMonitor(emitter.emit).start, daemon=True)
    t2 = threading.Thread(target=NetworkMonitorV2(emitter.emit).start, daemon=True)

    t1.start()
    t2.start()

    print("[linscope] Process + Network monitors running. (file_monitor disabled for stability)")
    print("Press Ctrl+C to stop.\n")
    t1.join()
    t2.join()

if __name__ == "__main__":
    main()
