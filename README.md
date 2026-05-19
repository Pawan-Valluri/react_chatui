# 🚀 Premium LangGraph ChatUI Dashboard

An enterprise-grade, fully local (air-gap compliant) web application integrating a Vite React **assistant-ui** frontend with a compiled **LangGraph StateGraph** Python backend.

This codebase is designed specifically for **Python & AI Developers** to easily modify, debug, and connect advanced multi-stage agent workflows without needing heavy web-development expertise.

---

## 🏛️ Architecture Overview

The system operates via two self-contained components:
1. **Frontend**: Vite SPA running React 18 and `@assistant-ui/react`. Features local history persistence in a beautiful dark glassmorphism layout, with native `.woff2` bundled fonts (100% offline-ready).
2. **Backend**: FastAPI server running a real, compiled LangGraph `StateGraph` workflow. It executes sequential, recursive multi-stage reasoning loops, running at full CPU speed with verbose terminal traces.

```
[ User Prompt ] ──> [ React Thread ] ──> [ api/chat Stream ]
                                                  │ (NDJSON)
                                                  ▼
                                         [ StateGraph START ]
                                                  │
                                                  ▼
                                            [ agent_node ] <───┐
                                                  │            │
                                         (should_continue)     │
                                            /           \      │
                                       (Tools?)       (End?)   │
                                         /                 \   │
                                        ▼                   ▼  │
                                   [ tools_node ] ─────────────┘
                                        │
                                        ▼
                                 [ StateGraph END ]
```

---

## 🧠 Dynamic Multi-Stage Reasoning

Rather than simple one-off tool executions, the backend implements **recursive stage routing** where the output of one tool dynamically feeds as the input parameter to subsequent tools.

### 🌟 Try These Multi-Stage Prompts:
* **NVIDIA Nexus Flow**: 
  > *"Search for Nvidia headquarters and check its stock and weather"*
  * **Stage 1**: Searches for Nvidia headquarters location and stock ticker.
  * **Stage 2**: Automatically extracts "Santa Clara" and "NVDA" from search results, then dynamically schedules `getWeather(Santa Clara)` and `getStockAnalysis(NVDA)` on the next graph pass.
  * **Stage 3**: Synthesizes the unified financial and climate card.

* **Zustand Creator Flow**: 
  > *"Search for Zustand creator and check weather in their city"*
  * **Stage 1**: Searches for Zustand creator details.
  * **Stage 2**: Extracts "Tokyo, Japan" from the search summaries, then schedules `getWeather(Tokyo)`.
  * **Stage 3**: Renders a biography summary alongside the Tokyo weather widget.

* **Microsoft HQ Flow**: 
  > *"Search for Microsoft HQ, analyze Microsoft stock, and get the weather there"*
  * **Stage 1**: Searches for Microsoft headquarters location.
  * **Stage 2**: Dynamically schedules `getWeather(Redmond)` and `getStockAnalysis(MSFT)`.
  * **Stage 3**: Compiles the Microsoft historical financial SVG trend chart and live climate status.

---

## 🛠️ Supported Tools & Rich Widgets

* **🌦️ Weather Widget (`getWeather`)**: Custom, location-aware climate visualizers displaying humidity, wind index, and custom multi-gradient backgrounds.
* **📈 Stock Evaluator (`getStockAnalysis`)**: Visualizes historical asset performance with fully responsive SVG line charts, area fills, day ranges, and buy recommendations.
* **🔍 Search citation cards (`searchWeb`)**: Perplexity-style reference grids displaying favicons, publisher domains, and summarized findings.

---

## 🚀 Getting Started

### 1. Launch the FastAPI Backend
Start the local Python server (reloads automatically on save):
```bash
# Activate your python environment
source /home/beyond/Space/envs/test_311.9/bin/activate

# Start the uvicorn server
python server.py
```
The server will boot on `http://localhost:8000`. You will see trace logs in the terminal for every StateGraph node transition!

### 2. Start the Frontend Dev Server
Run the local Vite React development server:
```bash
# Start dev server
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Build for Production
To bundle the frontend assets for local/isolated HTML deployment:
```bash
npm run build
```
Production assets compile cleanly under `dist/` with Zero telemetry calls or CDN downloads.

---

## ⚙️ Configuration File

* **[`src/config.ts`](file:///home/beyond/Space/Workspace1/chatui2/src/config.ts)**: Simple toggle for Python developers. Set `USE_BACKEND_API: true` to connect the live FastAPI server, or `false` to run in a standalone browser simulation mode.
