# DevGuard — AI Production Incident Investigator

> **Phone-First Incident Command Center**: An AI multi-agent investigation system that autonomously analyzes telemetry, logs, code changes, and evidence to isolate root causes, generate verified fixes, and execute test suites — with **no laptop required**.

---

## 🚀 Overview

DevGuard is built for on-call software engineers and site reliability engineers (SREs). When a production incident triggers:
1. **Multi-Agent Swarm**: 5 specialized agents (`LOG AGENT`, `CODE AGENT`, `TELEMETRY AGENT`, `REASONING AGENT`, `FIX AGENT`) triage the outage in parallel.
2. **Deterministic Root Cause Analysis**: Correlates degraded metrics with git commits, author history, and stack traces (diagnosing N+1 database queries, thread pool exhaustion, memory leaks, etc.).
3. **Automated Verification Pipeline**: A 6-stage CI pipeline (`PATCH APPLIED` → `BUILD STARTED` → `UNIT TESTS` → `INTEGRATION TESTS` → `CI VERIFICATION` → `SERVICE HEALTH`) verifies fixes against 44 automated tests.
4. **Emergency Red Light Mode**: High-contrast, urgent operational display designed for mobile triage and incident rooms.
5. **Office Kit Bridge**: Seamless synchronization between a phone client and a local development workstation.

---

## 🛠️ Architecture

- **Backend**: FastAPI (Python 3.11), SQLAlchemy, SQLite, WebSockets for live telemetry and agent streaming.
- **Frontend**: React 18, TypeScript, TailwindCSS, Vite, Lucide Icons, Recharts, Framer Motion.
- **AI Engine**: Deterministic scripted engine (for zero-dependency flagship demos) with pluggable support for Google Gemini, OpenAI GPT, and local Ollama models.

---

## ⚡ Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs will be available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

## 🎯 Flagship Demo Walkthrough

1. Open `http://localhost:5173/`.
2. Click **"RUN DEMO INCIDENT"** on the dashboard.
3. Observe the AI swarm diagnose the **Checkout API** critical latency spike:
   - Identifies N+1 query loop in `OrderService.java:184` introduced in commit `8f41c2a` by `j.tanaka`.
   - Generates batch query fix using `productRepository.fetchProductsByIds(productIds)`.
4. Click **"APPROVE & RUN VERIFICATION SUITE"**.
5. Watch all **44/44 tests** pass across 4 suites (`CheckoutServiceTest`, `OrderServiceTest`, `ProductRepositoryTest`, `PaymentFlowTest`) and confirm system recovery in **6m 42s**.

---

## 📄 License

MIT
