# ReQuora AI — E-Commerce Requirements, SDLC & IEEE 830-1998 SRS Studio

**ReQuora AI** is an agentic E-Commerce Requirements Engineering platform powered by local LLM inference (LM Studio), grounded RAG evidence, a deterministic Multi-Criteria Decision Analysis (MCDA) SDLC scoring engine, and an IEEE Std 830-1998 SRS compiler (without UML diagrams).

## What It Takes & Produces

- **Input:** A concise **1–2 line project brief** describing your e-commerce product.
- **Output:**
  1. **Detailed Project Overview** — Executive summary, business case, operational concept, in-scope / out-of-scope boundaries, user classes, assumptions, constraints, and risk register.
  2. **SDLC Recommendation & Percentages** — Evaluates all 6 SDLC models (`Agile–DevSecOps Hybrid`, `DevSecOps`, `Agile`, `Spiral`, `V-Model`, `Waterfall`) with suitability percentages, explains why the winner is the ideal fit, explains why every other SDLC scored lower, and builds a tailored phased workflow.
  3. **Structured Requirements (Minimum 6, No Upper Limit)** — Black-box Functional (`FR-*`) and measurable Non-Functional (`NFR-*`) requirements with inputs, processing & error handling, outputs, acceptance criteria, verification method, and citations.
  4. **IEEE 830-1998 Standard SRS Document (No UML)** — Complete Title, TOC, Sections `1.1–1.5`, `2.1–2.5`, `3.1–3.6`, Appendices (RTM, Decision Table, Risk Mapping), and Index — audited automatically to exclude UML diagrams.

## Quick Start

1. Ensure **LM Studio** is running locally at `http://127.0.0.1:1234/v1` with `qwen/qwen3.5-9b` loaded (or edit `.env`).
2. Start ReQuora AI:
   - Double-click `start-requora.bat`, **or**
   - Run `npm start` in this folder and open `http://127.0.0.1:3456`.

## Scripts

- `npm start` — Start the ReQuora AI Web Studio (`http://127.0.0.1:3456`)
- `npm run dev` — Start with live TypeScript watch reload
- `npm run test` — Run deterministic self-checks (MCDA SDLC percentages, IEEE 830-1998 validation, UML exclusion, RAG)
- `npm run check` — Run TypeScript check, self-checks, and Mastra build
- `npm run mastra:dev` — Optional Mastra Studio developer interface
