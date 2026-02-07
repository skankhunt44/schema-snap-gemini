# AGENTS.md

## Project summary
- **What this project does:** Infers relationships across schemas (CSV / DDL / DB) and maps fields to reporting templates with explainable Gemini suggestions.
- **Primary users:** Nonprofits + analysts preparing stakeholder reports.
- **Core workflows:** Ingest → Profile → Infer relationships → Review graph → Export mappings.

## Stack
- Language/runtime: TypeScript, Node 20
- Frameworks: React (Vite), Express
- DB/cache: none (local analysis only)
- Infra: local-only, no auth

## Repo map
- /apps/web — Vite React UI + graph view
- /apps/api — Express API for ingest + inference
- /samples — example CSVs / DDL

## Quickstart
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint/format/typecheck: (add later)

## Env/config
- Required env vars: `GEMINI_API_KEY`
- Local secrets: `.env`

## Conventions
- Code style: TS + ESLint/Prettier (add later)
- Branching: feature branches
- Commit messages: conventional-ish, clear scope
- Error handling: return actionable errors to UI
- Logging: server logs to stdout

## Tests
- Unit: (add later)
- Integration: (add later)
- E2E: (add later)
- How to run a focused test: (add later)

## Data/migrations
- None (no DB)

## Deployment
- Local-only for hackathon demo

## Agent workflow (required)
- Follow the loop: gather context → implement → verify → repeat.
- Do not claim “done” until tests and acceptance checks pass.
- Ask before destructive changes (data loss, prod deploys).

## Definition of Done
- See: DEFINITION_OF_DONE.md
