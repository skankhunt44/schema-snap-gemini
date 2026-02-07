# Schema Snap (Gemini)

**Schema Snap** helps nonprofits and analysts **discover relationships across messy datasets** and map them to stakeholder report templates. 
Upload CSVs or connect to a local database, and the app will infer PK/FK links, suggest joins, and explain why.

## Features (MVP)
- Ingest **CSV**, **SQL DDL**, or **local DB connections** (Postgres / MySQL / SQLite)
- Column profiling: type, null %, uniqueness, sample values
- Relationship inference (heuristics + Gemini explainability)
- **Relationship graph** (tables + edges with confidence)
- Export mapping JSON + suggested join plan

## Tech
- **Web:** Vite + React + TypeScript
- **API:** Node + Express + TypeScript
- **AI:** Gemini (explainability + ranking)

## Quickstart
```bash
npm install
# Add GEMINI_API_KEY
cp .env.example .env
npm run dev
```

Open the app: http://localhost:5173
API runs at: http://localhost:8080

## Env
Create `.env` in repo root:
```
GEMINI_API_KEY=your_key
```

## DB Connections
- **Postgres / Supabase**: use a connection string
- **MySQL**: use a connection string
- **SQLite**: upload a `.db` file

## Samples
See `/samples` for example CSVs + DDL.

## Notes
- No auth (public demo)
- Data is processed locally

---
Built for the Gemini Hackathon.
