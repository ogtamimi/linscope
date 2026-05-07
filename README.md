<div align="center">

# 🔭 LINSCOPE

**Real-time behavioral observability platform for Linux**

*See what's happening inside your Linux system as a living security graph*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux-orange.svg)]()
[![Status](https://img.shields.io/badge/status-v0.2.0--optimized-green.svg)]()
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)]()
[![React](https://img.shields.io/badge/react-18-blue.svg)]()
[![Performance](https://img.shields.io/badge/performance-2000%2B%20eps-brightgreen.svg)]()
[![FPS](https://img.shields.io/badge/fps-45--60-brightgreen.svg)]()

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



## 🏗️ Architecture

```text
eBPF Collector  →  FastAPI Backend  →  WebSocket  →  React Frontend
      ↓                 ↓                 ↓                ↓
Kernel Event      Real-time          Live Graph      Visualization
   Stream         Processing           Updates
      ↓
Detection Engine  →  Replay Engine  →  AI Assistant
```

---

## 🚀 Quick Start

### Prerequisites
- Linux (Ubuntu 22.04+, Mint 21+)
- Python 3.10+, Node.js 18+
- Root access (for eBPF collector)

### Installation
```bash
git clone https://github.com/ogtamimi/linscope.git
cd linscope
chmod +x scripts/install.sh
./scripts/install.sh
```

### Running linscope

**Terminal 1 – Backend:**
```bash
source venv/bin/activate
cd backend && python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 – Collector (requires root):**
```bash
cd collector && sudo python3 main.py
```

**Terminal 3 – Frontend:**
```bash
cd frontend && npm run dev
```

Open http://localhost:5173 🔭

**Performance Monitoring:**
- Click "📊 METRICS ON" in sidebar to see real-time performance dashboard
- Toggle "⚡ PERF" mode in Live Graph for high-load scenarios

---



## 🎯 Features

| Feature | Status | Description |
| :--- | :--- | :--- |
| Process Monitoring | ✅ | eBPF exec/fork/exit |
| Network Monitoring | ✅ | bpftrace + /proc fallback |
| File Syscall Monitoring | ✅ | open/unlink (experimental) |
| Live Graph | ✅ | 2000+ events/sec, 45-60 FPS |
| Timeline View | ✅ | Zoom, search, PID filter |
| Replay Engine | ✅ | Speed control, seek |
| Detection Engine | ✅ | MITRE ATT&CK rules |
| Alerts Panel | ✅ | Real‑time security alerts |
| AI Analyst | ✅ | Ollama + Groq support |
| Virtual Scrolling | ✅ | O(1) DOM rendering |

## 📊 Performance (v0.3.0)

| Metric | Before | After | Improvement |
| :--- | :--- | :--- | :--- |
| Max Events/sec | 500 | 2000+ | 4x |
| FPS | 15-20 | 45-60 | 3x |
| Memory usage | 250-300MB | 45-100MB | 3x |
| DOM nodes | 1000+ | 50-150 | 10x |

## 🔌 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | /api/events | Get stored events |
| GET | /api/stats | System statistics |
| GET | /api/process-tree | Full process tree |
| GET | /api/correlate/{pid} | Correlated events for a PID |
| POST | /api/ai/chat | AI chat (streaming) |
| POST | /api/ai/analyze-incident | Incident analysis |
| WebSocket | /ws | Real‑time event stream |
| WebSocket | /ws/alerts | Alert stream |

---

## 📁 Project Structure

```
linscope/
├── README.md                          # Updated for v0.3.0-alpha
├── LICENSE                            # Apache 2.0
├── .gitignore
├── .env.example
│
├── backend/
│   ├── main.py                        # FastAPI with WebSocket, batching, AI endpoints
│   ├── detection.py                   # Advanced detection engine (MITRE ATT&CK rules)
│   ├── ai_service.py                  # Unified Ollama + Groq AI interface
│   ├── requirements.txt               # Python dependencies
│   └── __pycache__/
│
├── collector/
│   ├── main.py                        # Entry point (process + network)
│   ├── mock_collector.py              # Synthetic events for testing
│   ├── src/
│   │   ├── __init__.py
│   │   ├── process_monitor.py         # eBPF process tracking (exec/exit)
│   │   ├── network_monitor_v2.py      # bpftrace + /proc/net/tcp fallback
│   │   ├── event_emitter.py           # HTTP batch sender to backend
│   │   └── file_monitor.py            # (optional) syscall tracking (open/unlink)
│   └── __pycache__/
│
├── frontend/
│   ├── package.json                   # version 0.3.0-alpha
│   ├── vite.config.ts                 # Vite + Tailwind + optimizations
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx                    # Main layout with tabs (Live, Timeline, Replay, Alerts, AI)
│   │   ├── main.tsx
│   │   ├── index.css                  # Tailwind + global styles
│   │   ├── types/
│   │   │   └── events.ts              # TypeScript interfaces (LinEvent, etc.)
│   │   ├── hooks/
│   │   │   ├── useWebSocketAdaptive.ts    # Batched WebSocket, queue management
│   │   │   └── useWebSocketOptimized.ts   # Legacy fallback
│   │   ├── components/
│   │   │   ├── LiveGraph.tsx               # Canvas‑based dynamic graph
│   │   │   ├── LiveGraphOptimizedHighPerf.tsx  # OffscreenCanvas + Worker
│   │   │   ├── TopBar.tsx                  # Metrics + quality selector
│   │   │   ├── EventFeed.tsx               # Real‑time event list
│   │   │   ├── VirtualEventFeed.tsx        # Virtual scrolling feed
│   │   │   ├── TimelineView.tsx            # Zoomable event timeline
│   │   │   ├── ReplayView.tsx              # Replay with speed control
│   │   │   ├── AlertsPanel.tsx             # Live security alerts
│   │   │   ├── AIAnalyst.tsx               # Chat interface (Ollama/Groq)
│   │   │   ├── NetworkMap.tsx              # Basic network connections map
│   │   │   └── PerformanceMonitor.tsx      # FPS, memory, event rate dashboard
│   │   ├── workers/
│   │   │   └── graphRenderWorker.ts        # Web Worker for physics offload
│   │   └── utils/
│   │       ├── performance.ts              # Throttle, batching, pooling
│   │       └── worker.ts                   # Worker pool utilities
│   └── node_modules/
│
├── scripts/
│   ├── install.sh                     # System dependencies + Python venv
│   └── setup_ebpf.sh                  # eBPF helpers (bcc, bpftrace)
│
|
│
├── .github/
│   ├── SECURITY.md                    # Updated for v0.3.0
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── config.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── FUNDING.yml
│
├── venv/                              # Python virtual environment
└── tests/                             # Placeholder for future tests
```

---


### Expected Performance

| Metric | Expected | Status |
|--------|----------|--------|
| **FPS** | over 30FPS | ✅ Stable |
| **Memory** | <100MB | ✅ Efficient |
| **Events/sec** | 2000+ | ✅ High-throughput |
| **Render Time** | 2-8ms | ✅ Fast |
| **DOM Nodes** | 50-100 | ✅ Optimized |


---

## 🤝 Contributing
Contributions are welcome! Please read CONTRIBUTING.md.

## 📝 License
Apache 2.0 – see LICENSE.

## 🙏 Acknowledgments
- eBPF & BCC communities
- FastAPI & React ecosystems

<div align="center"> <sub>Built with ❤️ for the blue team</sub> </div>