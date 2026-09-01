# RikuAI

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.13-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Mastra](https://img.shields.io/badge/Built%20with-Mastra-6366f1)](https://mastra.ai)
[![LM Studio](https://img.shields.io/badge/Inference-LM%20Studio-0ea5e9)](https://lmstudio.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**RikuAI** is a local-first finance requirements assistant. Two agents run in sequence: **Requirements Agent** lists software requirements; **SDLC Selection Agent** picks and justifies a lifecycle for that specification. Telegram and Studio workflow `requirements-then-sdlc` both use this pipeline. Only provenance-tracked material under `docs/ingested/` is indexed.

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

## Finance agents

There is no single “do everything” agent for the course demo.

| Studio entry | Role |
| --- | --- |
| **Requirements Agent** | (i) Identify and list software requirements |
| **SDLC Selection Agent** | (ii) Identify a suitable SDLC for that specification |
| **requirements-then-sdlc** (Workflows tab) | Runs (i) then (ii) and concatenates the two documents |
| **Riku Coordinator** | Telegram only; do not chat this for the evaluation |

Start with `npm run dev`. In Studio open **Workflows → requirements-then-sdlc** and paste the loan-origination brief (`prompt`). When it finishes, open `artifacts/evaluation/latest.md` (Cmd+Shift+V) or `latest.html` in a browser — you do not copy one agent into the other. Confirm jurisdiction and legal conclusions with authorised reviewers.

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
| **Inference** | [LM Studio](https://lmstudio.ai) | OpenAI-compatible local chat model |
| **Session storage** | LibSQL (`architect.db`) | Conversation history and working memory |
| **Document search** | Mastra BM25 | Fast local retrieval over indexed source text |
| **Knowledge base** | `docs/ingested/` | Original, provenance-tracked publisher material |
| **Skills** | `skills/<name>/SKILL.md` | Optional domain playbooks loaded on demand |
| **Messaging** | Telegram (`@chat-adapter/telegram`) | Mobile access with streaming replies |

---

## How It Works

1. **Startup** — Mastra boots the agents, connects to LM Studio, and BM25-indexes searchable text, Markdown, and YAML under `docs/ingested/`.
2. **Query** — Each request BM25-searches the workspace (topK 5) in code and attaches the passages before the model writes.
3. **Reasoning** — The model applies architecture-focused instructions: fill gaps with labeled assumptions, separate facts from guesses, and prefer the smallest reliable design.
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

# Telegram (optional — Mastra Studio works without it)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_MODE=polling

# Storage (defaults work for local development)
MASTRA_DATABASE_URL=file:./architect.db
```

### 4. Add knowledge

Add source originals and mechanically extracted `.txt`, `.md`, or `.yaml` files under `docs/ingested/`, then update `docs/CORPUS_SOURCES.md` and `docs/CORPUS_SHA256.txt`.

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
│   ├── rag.ts             # BM25 retrieve + inject evidence
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
