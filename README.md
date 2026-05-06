<div align="center">

# 🔭 linscope

**Real-time behavioral observability platform for Linux**

*See what's happening inside your Linux system as a living security graph*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux-orange.svg)]()
[![Status](https://img.shields.io/badge/status-active%20development-green.svg)]()
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)]()

</div>

---

## What is linscope?

linscope transforms Linux kernel activity into a **live visual behavioral system**.

Instead of drowning in logs, you see:

- 🔴 **Live process graphs** — who spawned what, when, and why
- 🌐 **Network flow maps** — real-time connection visualization  
- ⚡ **Behavioral anomaly detection** — not signature-based
- 🎬 **Attack replay** — reconstruct incidents step by step
- 🤖 **AI-powered analysis** — local LLM for incident explanation

> Built for SOC analysts, pentesters, and security researchers.

---



## Architecture
eBPF Layer → Event Collector → Stream Engine → Graph Engine → Detection → UI → AI

---

## Roadmap

- [x] Project structure
- [ ] eBPF process + network collector
- [ ] FastAPI event stream backend
- [ ] React live graph visualization
- [ ] Behavioral detection engine
- [ ] Attack timeline + replay
- [ ] Ollama AI integration

---

## Installation

> Coming soon — active development

---

## Contributing

PRs welcome. See [CONTRIBUTING.md](docs/CONTRIBUTING.md)

---

<div align="center">
Built with ❤️ for the blue team
</div>