# 🔭 LINSCOPE

**Real-time behavioral observability platform for Linux**

*See what's happening inside your Linux system as a living security graph*

---

## ✨ What is LINSCOPE?

LINSCOPE transforms Linux kernel activity into a live behavioral security system.

Instead of logs, you see behavior visually:

- Live process graphs
- Network flow visualization
- Behavioral anomaly detection
- Attack replay
- AI-powered analysis

---

## 🏗️ Architecture

eBPF Collector → FastAPI Backend → WebSocket → React Frontend

---

## 🚀 Quick Start

### Requirements
- Linux (Ubuntu 22.04+)
- Python 3.10+
- Node.js 18+
- Root (for eBPF)

### Install
```bash
git clone https://github.com/ogtamimi/linscope.git
cd linscope
chmod +x scripts/install.sh
./scripts/install.sh
```

### Run Backend
```bash
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

### Run Collector
```bash
sudo python3 collector/main.py
```

### Run Frontend
```bash
cd frontend
npm install
npm run dev
```

Open:
http://localhost:5173

---

## 🎯 Features

- Process Monitoring via eBPF
- Network Tracking
- Live Graph UI
- WebSocket Streaming
- Attack Timeline (WIP)
- AI Analyst (WIP)

---

## 🛠️ Tech Stack

Backend: Python, FastAPI, eBPF  
Frontend: React, TypeScript, Canvas  
Storage: SQLite

---

## 📁 Structure

collector/ backend/ frontend/ scripts/

---

## 🤝 Contributing

Fork → Branch → Commit → PR

---

## ⚠️ Known Issues

- Kernel 6.17+ network issue
- Root required for full monitoring

---

## ❤️ Built for blue team security
