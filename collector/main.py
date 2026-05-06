#!/usr/bin/env python3
import threading, signal, sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.process_monitor import ProcessMonitor
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
    v0.1.0 — Process Monitor Only
    """)

    emitter = EventEmitter()
    emitter.start()

    def shutdown(sig, frame):
        print("\n[linscope] Shutting down...")
        emitter.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Process monitor only (network monitor disabled for kernel 6.17)
    t1 = threading.Thread(target=ProcessMonitor(emitter.emit).start, daemon=True)
    t1.start()
    
    print("[linscope] Process monitor running. Ctrl+C to stop.\n")
    t1.join()

if __name__ == "__main__":
    main()
