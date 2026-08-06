# RikuAI

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.13-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Mastra](https://img.shields.io/badge/Built%20with-Mastra-6366f1)](https://mastra.ai)
[![LM Studio](https://img.shields.io/badge/Inference-LM%20Studio-0ea5e9)](https://lmstudio.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**RikuAI** is a local-first AI Software Architect — a reasoning agent that helps design, evaluate, and deliver production-grade systems. It runs entirely on your machine via LM Studio, grounds answers in your architecture documents, remembers context across sessions, and meets you on Telegram when you are away from the desk.

---

## Overview

RikuAI is built for engineers who want an architecture partner that thinks in tradeoffs, not templates. It combines a local language model, document retrieval, persistent working memory, and a mobile-friendly chat interface into a single agent you control end to end.

| Capability | What it does |
| --- | --- |
| **Architecture reasoning** | Produces concrete, implementation-ready guidance with explicit assumptions and tradeoffs |
| **Document RAG** | Indexes `docs/` on startup and cites source files in answers |
| **Persistent memory** | Tracks requirements, decisions, and open questions per user and thread |
| **Telegram interface** | Streams responses to a private bot with `/new` and `/compact` session controls |
| **Extensible skills** | Drop-in `SKILL.md` files extend behavior without code changes |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Interfaces                              │
│   Mastra Studio (local)          Telegram Bot (streaming)       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Architect Agent (Mastra)                     │
│   Instructions · Working memory · Channel handlers              │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐   ┌───────────────┐   ┌──────────────────┐
│  LM Studio  │   │  LibSQL Store │   │  Workspace RAG   │
│  Chat model │   │  Session mem  │   │  docs/ + skills/ │
│  Embeddings │   │  Thread state │   │  Vector search   │
└─────────────┘   └───────────────┘   └──────────────────┘
```

### Components

| Layer | Technology | Role |
| --- | --- | --- |
| **Agent runtime** | [Mastra](https://mastra.ai) | Orchestrates the agent, memory, workspace, and channels |
| **Inference** | [LM Studio](https://lmstudio.ai) | OpenAI-compatible local endpoint for chat and embeddings |
| **Session storage** | LibSQL (`architect.db`) | Conversation history and working memory |
| **Vector store** | LibSQL (`architecture-vectors.db`) | Semantic search over indexed documents |
| **Knowledge base** | `docs/` | Architecture notes, ADRs, and reference material |
| **Skills** | `skills/<name>/SKILL.md` | Optional domain playbooks loaded on demand |
| **Messaging** | Telegram (`@chat-adapter/telegram`) | Mobile access with streaming replies |

---

## How It Works

1. **Startup** — Mastra boots the architect agent, connects to LM Studio, and auto-indexes every file under `docs/` into the vector store.
2. **Query** — When you ask a question, the agent searches the workspace (topK 5) for relevant passages before generating a response.
3. **Reasoning** — The model applies architecture-focused instructions: clarify only what matters, separate facts from assumptions, and prefer the smallest reliable design.
4. **Memory** — Working memory persists project context, confirmed requirements, and decisions per Telegram user and thread.
5. **Delivery** — Replies stream to Telegram (or Mastra Studio locally). Source files are cited when RAG contributed to the answer.

### Telegram commands

| Command | Action |
| --- | --- |
| `/new` | Start a fresh conversation thread |
| `/compact` | Summarize and preserve context, then reset the thread |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 22.13
- **LM Studio** — [Download](https://lmstudio.ai/download)
- **Telegram bot** (optional) — Create via [@BotFather](https://t.me/BotFather)

### 1. Install LM Studio

Download and install LM Studio for your platform. Open the app and start the local server (default: `http://127.0.0.1:1234`).

### 2. Download models

Load these models in LM Studio before starting RikuAI:

| Model | Purpose | Default identifier |
| --- | --- | --- |
| Chat | Architecture reasoning | `qwen/qwen3.5-9b` |
| Embeddings | Document indexing & search | `text-embedding-nomic-embed-text-v1.5` |

### 3. Configure environment

```bash
git clone https://github.com/AppajiDheeraj/RikuAI.git
cd RikuAI
npm install
cp .env.example .env
```

Edit `.env` with your values:

```bash
# LM Studio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_MODEL=qwen/qwen3.5-9b
LM_STUDIO_EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5

# Telegram (optional — Mastra Studio works without it)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_MODE=polling

# Storage (defaults work for local development)
MASTRA_DATABASE_URL=file:./architect.db
MASTRA_VECTOR_DATABASE_URL=file:./architecture-vectors.db
```

### 4. Add knowledge

Place text or Markdown files anywhere under `docs/`. They are chunked and indexed automatically on startup.

### 5. Add skills (optional)

Create `skills/<skill-name>/SKILL.md` with valid `name` and `description` frontmatter. The description tells the model when to activate the skill. Skills are discovered automatically — no code changes required.

### 6. Run

```bash
npm run dev
```

- **Mastra Studio** — Available at the local dev URL printed in the terminal.
- **Telegram** — Message your bot once `TELEGRAM_BOT_TOKEN` is set.

### 7. Verify

```bash
npm run check
```

Runs TypeScript checks and a production build.

---

## Project Structure

```
RikuAI/
├── docs/                  # Knowledge base (auto-indexed; add your own .md files)
├── skills/                # Skill definitions (SKILL.md)
├── src/mastra/
│   ├── architect-agent.ts # Agent & Telegram handlers
│   ├── prompts.ts         # System prompt
│   ├── config.ts
│   ├── lm-studio.ts
│   ├── workspace.ts       # RAG + vector store
│   └── index.ts
├── .env.example
└── package.json
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Mastra in development mode |
| `npm run build` | Production build |
| `npm run start` | Run the production server |
| `npm run typecheck` | TypeScript validation |
| `npm run check` | Typecheck + build |

---

## Deployment Notes

The default configuration is optimized for local development. For a shared or production deployment:

- Replace local LibSQL file paths with a managed database
- Point inference at a hosted OpenAI-compatible endpoint instead of LM Studio
- Use Telegram webhook mode (`TELEGRAM_MODE=webhook`) behind HTTPS

---

## License

MIT — see [LICENSE](LICENSE).
