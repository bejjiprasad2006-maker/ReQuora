# RikuAI

A clone-ready, local-first Mastra agent with LM Studio, Telegram streaming, document RAG, persistent memory, and a folder for future skills.

## Start

```bash
git clone https://github.com/AppajiDheeraj/RikuAI.git
cd RikuAI
npm install
cp .env.example .env
npm run dev
```

Before starting, load the chat and embedding models named in `.env` through LM Studio. Add your Telegram bot token if you want the Telegram interface; without it, Mastra Studio still runs locally.

## Add knowledge

Put text or Markdown files anywhere under `docs/`. On startup, Mastra recursively chunks and indexes them. Retrieval uses vector search with `topK: 5`; retrieved answers cite their source files.

## Add skills later

Create `skills/<skill-name>/SKILL.md`. Give it valid `name` and `description` frontmatter; the description tells the model when to activate it. Skills and edits are discovered automatically, so no code change is required.

## Telegram

Private Telegram responses stream through the adapter. The bot also supports:

- `/new` — start a clean conversation.
- `/compact` — replace a long conversation with a preserved checkpoint.

Telegram limits a message to 4,096 characters. Output is intentionally capped for concise mobile responses; add splitting only if long replies become a real requirement.

## Storage

Session memory uses `MASTRA_DATABASE_URL`; document vectors use `MASTRA_VECTOR_DATABASE_URL`. The defaults work inside a fresh clone. For a shared deployment, replace local LibSQL and LM Studio with production-grade shared services.

## Verify

```bash
npm run check
```

## Fine-tuned models

After training, point `LM_STUDIO_MODEL` at the local model identifier. Keep training artifacts and public model releases outside this application repository.
