# 🚀 Production-Grade Branching ChatUI with AuthBlue SSO Shield

An enterprise-ready, air-gap compliant multi-service conversational agent platform. It integrates a premium dark-mode Vite React (**assistant-ui**) client with a compiled **LangGraph StateGraph** Python agent, shielded by an **AuthBlue SSO Identity Gateway** simulation layer and backed by a robust relational database schema (**PostgreSQL / SQLite**).

---

## 🏛️ Architecture Overview

The system is architected as three decoupled, production-ready services:

```
                  ┌──────────────────────────────────────────────┐
                  │          AuthBlue SSO Shield Proxy           │
                  │              (Port 8085 / Local)             │
                  └──────────────────────┬───────────────────────┘
                                         │  (Redirect / Session Cookie)
                                         ▼
   ┌─────────────────────────────────────┴─────────────────────────────────────┐
   │                                                                           │
   │                          Vite React Frontend SPA                          │
   │                            (Port 5173 / Local)                            │
   │                                                                           │
   │  • Completely auth-agnostic client, operating under the SSO proxy context │
   │  • Premium glassmorphism dark mode, powered by base-ui & Tailwind CSS      │
   │  • Debounced real-time Active Tree synchronization on conversation branch   │
   │                                                                           │
   └─────────────────────────────────────┬─────────────────────────────────────┘
                                         │  (REST API / NDJSON Stream)
                                         ▼
   ┌─────────────────────────────────────┴─────────────────────────────────────┐
   │                                                                           │
   │                           FastAPI Agent Backend                           │
   │                            (Port 8080 / Local)                            │
   │                                                                           │
   │  • LangGraph StateGraph engine for recursive multi-stage tool-use routing │
   │  • Relational DB Layer: PostgreSQL schema with seamless SQLite fallback   │
   │  • Chronological Tree Path Resolution: reconstructs exact flow of         │
   │    HumanMessage, AIMessage (CoT / Reasoning), and ToolMessages            │
   │  • Multi-Level Verbose Diagnostic Logging (VERBOSE_LEVEL=1 or 2)          │
   │                                                                           │
   └───────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ AuthBlue SSO Shield Pattern

To mirror modern enterprise environments, the **Vite React Frontend is completely auth-agnostic**. It contains **no login screens, logout logic, redirects, or local token storage**.
* **The Shield:** The browser must be authenticated by the AuthBlue Reverse Proxy before it can access or render the UI.
* **SSO Simulator (`sso_simulator/`):** For local development and testing, a simulated AuthBlue proxy server runs on port `8085`. It hosts a premium Dark Centurion-themed login portal, signs high-fidelity JWT `bluetoken` sessions, and exposes mock `/v1/user/userinfo` endpoints matching real cloud specifications.

---

## 🧠 Relational Data Layer & Branching Chat Persistence

All conversation history is persisted using a highly structured relational database schema built with **SQLAlchemy**:
* **Branching Conversational Trees:** Instead of storing chats as simple linear lists, the database stores conversations as tree branches (using `parent_id` pointers for each message node). This enables full state preservation of all edits, splits, and custom conversation branches.
* **Automatic Thread Synchronization:** An observer inside the React client automatically detects active tree splits and syncs the entire branch map back to PostgreSQL/SQLite via debounced API calls.

---

## 🔍 Context Resolution & Logging

The system implements advanced **Chronological Tree Path Resolution** to feed high-fidelity conversation histories to the LangGraph agent:
1. **Ancestry Path Resolution:** The backend traces the database parent pointers from the current user prompt back to the root message node, reversing it into correct chronological order (`[Root -> ... -> Parent -> User Prompt]`).
2. **High-Fidelity Serialization:** Reconstructs full conversation states, converting database payloads into correct LangChain objects: `HumanMessage`, `AIMessage` (with reasoning/CoT and tool-call schema arrays), and `ToolMessage` (with execution results) sequentially.
3. **Verbose Conditional Logging:** Configured via `VERBOSE_LEVEL` environment variable:
   - `VERBOSE_LEVEL=1` (Default): Logs only the last 5 conversation messages in the resolved path to keep terminal noise minimal.
   - `VERBOSE_LEVEL=2` (Developer Mode): Logs the **entire** active conversation history including reasoning, tool-call parameters, and tool message contents.

---

## 🛠️ Supported Tools & Rich Widgets

* **🌦️ Weather Widget (`getWeather`)**: Custom, location-aware climate visualizers displaying humidity, wind index, and custom multi-gradient backgrounds.
* **📈 Stock Evaluator (`getStockAnalysis`)**: Visualizes historical asset performance with fully responsive SVG line charts, area fills, day ranges, and buy recommendations.
* **🔍 Search citation cards (`searchWeb`)**: Perplexity-style reference grids displaying favicons, publisher domains, and summarized findings.

---

## 🚀 Running the Services Locally

To launch the full environment, open three terminal sessions in the root directory:

### 🛡️ 1. Start the SSO Simulator (Port `8085`)
```bash
# 1. Activate the python virtual environment
source /home/beyond/Space/envs/test_311.9/bin/activate

# 2. Run the SSO Simulator
python sso_simulator/server.py
```
* **Portal Gateway:** `http://localhost:8085`

### 🧠 2. Start the Backend Agent Service (Port `8080`)
```bash
# 1. Activate the python virtual environment
source /home/beyond/Space/envs/test_311.9/bin/activate

# 2. Run the Backend API Server
python backend/server.py
```
* **Fallback Database:** A local SQLite database is automatically generated at `backend/chat.db` if `DATABASE_URL` is omitted.
* **Diagnostic Logging:** Launch as `VERBOSE_LEVEL=2 python backend/server.py` to print complete agent history arrays for debug tracing.

### 💻 3. Start the Frontend React Web App (Port `5173`)
```bash
# 1. Install frontend packages
npm install

# 2. Run the Vite development server
npm run dev
```
* **Main App UI:** `http://localhost:5173`

---

## ⚙️ Configuration Files

* **[`src/config.ts`](file:///home/beyond/Space/Workspace1/react_chatui/src/config.ts)**: Toggles backend integration. Set `USE_BACKEND_API: true` to connect the live FastAPI server, or `false` to run in a standalone browser simulation mode.
* **[`.gitignore`](file:///home/beyond/Space/Workspace1/react_chatui/.gitignore)**: Configured to ignore all SQLite databases (`*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`) and local Python virtual environment folders cleanly.
