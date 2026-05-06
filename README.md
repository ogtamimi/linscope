<div align="center">

# 🔭 LINSCOPE

**Real-time behavioral observability platform for Linux**

*See what's happening inside your Linux system as a living security graph*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux-orange.svg)]()
[![Status](https://img.shields.io/badge/status-alpha-yellow.svg)]()
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)]()
[![React](https://img.shields.io/badge/react-18-blue.svg)]()

</div>

---

## ✨ What is linscope?

linscope transforms Linux kernel activity into a **live visual behavioral system**.

Instead of drowning in logs, you see:

- 🔴 **Live process graphs** — who spawned what, when, and why
- 🌐 **Network flow maps** — real-time connection visualization  
- ⚡ **Behavioral anomaly detection** — not signature-based
- 🎬 **Attack replay** — reconstruct incidents step by step
- 🤖 **AI-powered analysis** — local LLM for incident explanation

> Built for SOC analysts, pentesters, and security researchers.

---

## 🏗️ Architecture
eBPF Collector → FastAPI Backend → WebSocket → React Frontend
↓ ↓ ↓ ↓
Kernel Event Stream Real-time Live Graph
Events Processing Updates Visualization

text

---

## 🚀 Quick Start

### Prerequisites

- Linux (Ubuntu 22.04+, Mint 21+, or any distribution with eBPF support)
- Python 3.10+
- Node.js 18+
- Root access (for eBPF collector)

### Installation

```bash
# Clone the repository
git clone https://github.com/ogtamimi/linscope.git
cd linscope

# Run the installation script
chmod +x scripts/install.sh
./scripts/install.sh
Running linscope
Terminal 1 - Backend:

bash
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000
Terminal 2 - Collector (requires root):

bash
# For real eBPF monitoring
sudo PYTHONPATH=/usr/lib/python3/dist-packages python3 collector/main.py

# OR for demo/testing (no root required)
python3 collector/mock_collector.py
Terminal 3 - Frontend:

bash
cd frontend
npm run dev
Open http://localhost:5173 and watch your system come to life! 🔭

📸 Screenshot
text
┌─────────────────────────────────────────────────────────────────┐
│  🔭 LINSCOPE                                    processes 42   │
│  v0.1.0 — behavioral observability             connections 15  │
│                                                   events/s 127  │
├──────────────┬─────────────────────────────────┬───────────────┤
│              │                                 │               │
│  Live Graph  │      ●    ●                     │  LIVE EVENTS  │
│  Network Map │        ●       ●                │  ───────────  │
│  Timeline    │    ●         ●                  │  exec bash    │
│  Incidents   │          ●                      │  connect curl │
│  AI Analyst  │       ●    ●                    │  exec python3 │
│  Settings    │                                 │  connect wget │
│              │                                 │  exec systemd │
│              │                                 │               │
├──────────────┴─────────────────────────────────┴───────────────┤
│  ● eBPF collector active                           14:32:05    │
└─────────────────────────────────────────────────────────────────┘
🎯 Features
Feature	Status	Description
Process Monitoring	✅	Track exec, fork, exit events via eBPF
Network Monitoring	⚠️	TCP connect tracking (kernel 6.17+ compatible)
Live Graph	✅	Real-time canvas visualization
Event Feed	✅	Scrollable real-time event stream
WebSocket Streaming	✅	Real-time backend→frontend communication
Attack Timeline	🔄	Temporal reconstruction
AI Assistant	🔄	Local LLM integration (Ollama)
Replay Engine	🔄	System activity replay
🗺️ Roadmap
Project structure & GitHub setup

eBPF process collector

FastAPI backend with WebSocket

React frontend with live graph

Mock collector for demo

Network monitor (kernel 6.17+ fix)

Behavioral detection engine

Attack timeline reconstruction

Ollama AI integration

Incident summarization

🛠️ Tech Stack
Backend
Technology	Purpose
Python 3.10+	Main runtime
FastAPI	Async web framework
WebSockets	Real-time communication
eBPF (BCC)	Kernel telemetry
Uvicorn	ASGI server
Frontend
Technology	Purpose
React 18	UI framework
TypeScript	Type safety
Canvas API	Custom graph rendering
TailwindCSS	Styling
Infrastructure
Technology	Purpose
SQLite	Metadata storage
ClickHouse	Future event storage
📁 Project Structure
text
linscope/
├── collector/
│   ├── src/
│   │   ├── process_monitor.py   # eBPF process tracking
│   │   ├── network_monitor.py   # eBPF network tracking
│   │   └── event_emitter.py     # HTTP event sender
│   ├── main.py                   # Real eBPF collector
│   └── mock_collector.py         # Demo collector (no root)
├── backend/
│   └── main.py                   # FastAPI + WebSocket server
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── hooks/                # Custom hooks (WebSocket)
│   │   └── types/                # TypeScript types
│   └── package.json
├── scripts/
│   └── install.sh                # Installation script
├── docs/
├── README.md
└── LICENSE
🤝 Contributing
Contributions are welcome! Please read CONTRIBUTING.md

Fork the repository

Create your feature branch (git checkout -b feature/amazing)

Commit your changes (git commit -m 'Add amazing feature')

Push to the branch (git push origin feature/amazing)

Open a Pull Request

📝 License
Apache 2.0 License - see LICENSE file for details.

⚠️ Known Issues
Network monitor incompatible with kernel 6.17+ (BPF struct bpf_wq error)

Mock collector available for testing without root

High event volume may impact performance (optimization WIP)

🙏 Acknowledgments
Linux kernel eBPF community

BCC project contributors

FastAPI & React ecosystems

<div align="center"> <sub>Built with ❤️ for the blue team</sub> </div> ```