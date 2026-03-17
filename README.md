# 🧠 Monnu Clow

### Autonomous Multi-Agent AI Development System

> **Self-healing, intelligent code orchestration powered by specialized AI agents**

Monnu Clow is an autonomous multi-agent system that continuously analyzes, codes, tests, debugs, and reviews your codebase until it reaches a stable state — all visualized through a stunning real-time dashboard.

---

## ✨ Features

- **5 Specialized AI Agents** — Planner, Coder, Tester, Debugger, Reviewer
- **Autonomous Execution Loop** — Runs continuously until all conditions are met
- **Self-Healing Repository** — Detects → Isolates → Repairs → Verifies
- **Real-Time Dashboard** — Glassmorphic dark UI with live agent activity streams
- **Memory System** — Tracks recurring bugs and fragile code for priority repair
- **WebSocket Streaming** — All agent events streamed live to the dashboard
- **Task Management** — Auto-generated tasks from repository analysis
- **Bug Tracking** — Severity-based bug detection and resolution tracking
- **Coverage Monitoring** — Automatic test generation when coverage drops below 80%

---

## 🏗️ Architecture

```
monnu-clow/
├── packages/
│   ├── core/          # Agent orchestration engine (TypeScript)
│   ├── server/        # Fastify API + WebSocket server
│   └── dashboard/     # Vite + React real-time dashboard
├── SUPER_AGENT_SYSTEM.md  # Original system specification
└── package.json           # pnpm workspace root
```

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start both server and dashboard
pnpm dev

# Or start individually
pnpm dev:server     # API server on http://localhost:3001
pnpm dev:dashboard  # Dashboard on http://localhost:5173
```

---

## 🤖 Agent Roles

| Agent | Role | Emoji |
|-------|------|-------|
| **Planner** | Analyzes repo, generates execution plans | 🧠 |
| **Coder** | Implements features and fixes | ⚡ |
| **Tester** | Generates and runs tests | 🧪 |
| **Debugger** | Identifies and repairs bugs | 🔧 |
| **Reviewer** | Validates code quality | 👁️ |

---

## 📋 Stability Conditions

The system will run until ALL conditions are satisfied:

- ✅ No pending tasks
- ✅ No open bugs
- ✅ No runtime errors
- ✅ All tests passing
- ✅ Coverage ≥ 80%

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Core Engine | Node.js + TypeScript |
| API Server | Fastify + WebSocket |
| Dashboard | Vite + React + Zustand |
| Styling | Vanilla CSS (glassmorphic dark theme) |
| State | Zustand (reactive store) |
| Fonts | Inter + JetBrains Mono |

---

## 📄 License

MIT
