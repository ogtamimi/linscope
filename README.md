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
Kernel Event Stream → Processing → Real-time Updates → Live Graph

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
```

### Running LINSCOPE

#### Terminal 1 - Backend
```bash
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

#### Terminal 2 - Collector (requires root)
```bash
# Real eBPF monitoring
sudo PYTHONPATH=/usr/lib/python3/dist-packages python3 collector/main.py

# OR demo mode (no root required)
python3 collector/mock_collector.py
```

#### Terminal 3 - Frontend
```bash
cd frontend
npm install
npm run dev
```

Open:
```
http://localhost:5173
```

---

## 📸 Screenshot

```
┌─────────────────────────────────────────────────────────────────┐
│  🔭 LINSCOPE                                    processes 42   │
│  v0.1.0 — behavioral observability             connections 15  │
│                                                   events/s 127  │
├──────────────┬─────────────────────────────────┬───────────────┤
│  Live Graph  │      ●    ●                     │  LIVE EVENTS  │
│  Network Map │        ●       ●                │  exec bash    │
│  Timeline    │    ●         ●                  │  connect curl │
│  Incidents   │          ●                      │  exec python3 │
│  AI Analyst  │       ●    ●                    │  connect wget │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Features

| Feature | Status | Description |
|--------|--------|-------------|
| Process Monitoring | ✅ | eBPF exec/fork/exit tracking |
| Network Monitoring | ⚠️ | TCP connection tracking |
| Live Graph | ✅ | Real-time visualization |
| Event Feed | ✅ | Live streaming events |
| WebSocket Streaming | ✅ | Backend → Frontend |
| Attack Timeline | 🔄 | Incident reconstruction |
| AI Assistant | 🔄 | Local LLM integration |
| Replay Engine | 🔄 | System activity replay |

---

## 🗺️ Roadmap

- eBPF process collector
- FastAPI backend + WebSocket
- React frontend live graph
- Mock collector for demo
- Network monitor fix (kernel 6.17+)
- Behavioral detection engine
- Attack timeline reconstruction
- Ollama AI integration

---

## 🛠️ Tech Stack

**Backend**
- Python 3.10+
- FastAPI
- WebSockets
- eBPF (BCC)
- Uvicorn

**Frontend**
- React 18
- TypeScript
- Canvas API
- TailwindCSS

**Storage**
- SQLite

---

## 📁 Project Structure

```
linscope/
├── collector/
├── backend/
├── frontend/
├── scripts/
├── docs/
└── README.md
```

---

## 🤝 Contributing

1. Fork repo  
2. Create branch  
3. Commit changes  
4. Push branch  
5. Open PR  

---

## 📝 License

Apache 2.0 License

---

## ⚠️ Known Issues

- Kernel 6.17+ network limitation
- Root required for full monitoring
- High event load may affect performance

---

## 🙏 Acknowledgments

- Linux eBPF community
- BCC project
- FastAPI
- React ecosystem

---

<div align="center">

**Built with ❤️ for the blue team**

</div>