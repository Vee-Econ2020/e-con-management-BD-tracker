# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**e-con Management BD Tracker** is a real-time business development tracking dashboard with AI-powered analytics. It features a React/TypeScript frontend communicating with a FastAPI backend connected to MongoDB, plus Python transformation pipelines for weekly data processing.

## Quick Commands

### Frontend (React + Vite)
```bash
cd frontend
npm run dev      # Start dev server (HMR enabled)
npm run build    # Production build
npm run lint     # ESLint validation
npm run preview  # Preview production build
```

### Backend (FastAPI)
```bash
py main.py       # Start FastAPI server (uses uvicorn, watches .env for config)
```

### Python Scripts
Always use `py` (not `python`) when executing scripts:
```bash
py <script_name>.py              # Root-level scripts
py backend/<script_name>.py      # Backend scripts
py frontend/<script_name>.py     # Frontend utility scripts
```

Common scripts:
- `transformation.py` / `transformation_with_progress.py` — Weekly data transformation pipeline
- `append_slides.py` — Append custom slide data
- `update_admin.py` — Admin user sync
- `slides_compute.py` — Compute slide metrics
- `export_worker.py` — Export data to files

## Architecture

### Codebase Structure
```
root/
├── frontend/                      # React + TypeScript + Vite app
│   ├── src/components/           # React components (charts, admin UI, 3D visualizations)
│   ├── src/services/             # API client and data fetching
│   └── package.json              # Dependencies (React 19, Three.js, Plotly, Lucide)
├── agents/                        # Agent configuration files
├── routers/                       # FastAPI route modules (grouped by domain)
├── services/                      # FastAPI business logic services
├── backend/                       # Backend-specific Python scripts
├── main.py                        # FastAPI app entry point
├── requirements.txt               # Python dependencies (FastAPI, Motor, Pandas, etc.)
└── GEMINI.md                      # AI agent architecture rules (CRITICAL—read first)
```

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Three.js (3D), Plotly (charts), React Router v7, Lucide icons
- **Backend**: FastAPI 0.141, Uvicorn, Motor (async MongoDB)
- **Database**: MongoDB (multiple collections for slides, user input, tracking data, settings)
- **Data Processing**: Pandas, NumPy, openpyxl (Excel import), Playwright (automation), Pillow (images)
- **Type Checking**: TypeScript (frontend), no strict typing in backend (add if needed)

### API Communication
- FastAPI endpoints under `/api/*` (routers-based)
- Server-Sent Events (SSE) for real-time streaming via `sse-starlette`
- Frontend services fetch from `http://localhost:8000` (dev) with CORS
- Request payload validation via Pydantic models

### Database Layout (MongoDB)
Key collections:
- `weekly_tracker_data` — Main tracking metrics (weeks, regions, categories, amounts)
- `weekly_tracker_settings` — Slide visibility, hidden slides (must include `fy` field per GEMINI.md)
- `weekly_tracker_custom_slides` — User-defined slides (store `fy` on creation)
- `orderbacklogs` — Order backlog data (week, region, amount, FY closing date)
- `target_settings` — Target thresholds (Base/Stretch targets)
- `ai_chat_sessions` / `ai_chat_logs` — AI conversation history and audit logs (sanitize Protobuf/NumPy before insert)
- `admin_users` / `admin_sessions` — Auth and session management

## Critical Architecture Rules (from GEMINI.md)

### 1. MongoDB Serialization Invariants
- **Before any MongoDB insert/update**: Sanitize Protobuf objects (`MapComposite`, `RepeatedComposite`), NumPy types (`np.int64`, `np.float64`), ObjectId, and Decimal128 to native JSON types using `sanitize_gemini_args()` / `serialize_mongo_val()`.
- **When updating existing documents** (`$set` operator): Pop `_id` from payload first (`doc.pop("_id", None)`). Passing `_id` in `$set` causes `WriteError`.
- **Text extraction**: Never call `response.text` unconditionally; safely extract from `response.candidates[0].content.parts` to avoid `ValueError`.

### 2. Multi-FY Isolation (CRITICAL for Slide State)
- **Hidden Slides** and **Custom Slides** must be filtered by `fy` field (e.g., `{"type": "hidden_slides", "fy": "FY2027"}`).
- Documents missing `fy` fall back to `"FY2027"`.
- Frontend hooks must include `[selectedFY]` in dependencies and pass `?fy=${selectedFY}` in API calls to prevent cross-FY state bleeding.

### 3. Fiscal Year & Quarter Mapping (FY2027 & FY2028)
- **FY2027**: Week 14–26 = Q1, 27–39 = Q2, 40–52 = Q3
- **FY2028**: Treated as future year; quarters map as QP1–QP4 for prior-year relative timing
- **Milestone Status**: Never hardcode QP1/QP2/QP3 as "automatically achieved." For FY2028, `QP2` is active and must evaluate against `po_current >= val` to avoid false positives.
- **Cumulative Progress Line** (`current_progress_x`):
  - FY2027 Q2: positioned at `3.0 + fraction`
  - FY2028 QP2: positioned at `0.0 + fraction` from tick 0

### 4. AI Tool Design (Latency & Pre-Aggregation)
- Tools must return **pre-calculated summaries** (totals, regional breakdowns) not massive row dumps (>50 rows cause LLM to loop).
- Cap tool iterations to **3 turns maximum**; synthesize structured output immediately after data arrival.
- Track execution duration (`time.time()`) and store `latency_ms` in logs.

### 5. Slide 2 Executive KPIs (Key Metrics)
- **Stretch Target**: $73.00M | **Base Target**: $63.80M
- **Total PO Won**: Sum `Weighted Amount` where `projection_category == 'Closed Won'` (~$67.67M)
- **Pipeline Forecast**: Sum `Weighted Amount` where `projection_category == 'Pipeline'` (~$10.73M)
- **Invoiced**: Sum `grand_total` from `invoice_data` (~$20.26M)
- **FY2027 Backlog (Q2–Q3)**: Filter `closing_date_fy == "FY2027"` (~$47.19M); all-FY backlog ~$59.45M

### 6. Weekly Data Fallback
If requested week has 0 records, query tools automatically fall back to latest week with data and append a clear note.

## Development Notes

### Running Locally
1. **Frontend dev**: `cd frontend && npm run dev` → http://localhost:5173
2. **Backend dev**: `py main.py` → http://localhost:8000 (FastAPI docs at `/docs`)
3. Both must run concurrently for full app
4. Set `.env` in root with `MONGODB_URI`, `DATABASE_NAME`, etc.

### Debugging
- **Frontend**: Use React DevTools, Vite HMR logs in browser console
- **Backend**: FastAPI auto-generates `/docs` (Swagger UI) and `/redoc` (ReDoc) at startup
- **Database**: Use MongoDB Compass or CLI (`mongosh`) to inspect collections; check `_id` field presence before updates
- **Python scripts**: Add `print()` or logging; use `py -m pdb <script>.py` for debugging

### Adding Features
- **New endpoint**: Create router module in `routers/`, import in `main.py`
- **New collection**: Define Pydantic model, create service in `services/`, add CRUD routes
- **New React component**: Place in `src/components/` with TypeScript types, export from index
- **Data transformation**: Add to `transformation.py` or create new script with `sanitize_gemini_args()` before MongoDB writes

### Testing
- **Frontend**: No Jest/Vitest configured; manually test via dev server
- **Backend**: No pytest suite; test via FastAPI `/docs` or curl/Postman
- **Data scripts**: Run standalone with test data or dry-run flags if implemented

## Important Files to Reference

- `GEMINI.md` — AI agent architecture and invariants (READ FIRST for any AI/tool work)
- `main.py` — FastAPI app initialization and route mounting
- `requirements.txt` — Python dependencies and versions
- `frontend/package.json` — Frontend dependencies and build scripts
- `frontend/src/services/` — API client and data fetching logic
- `.env` — Runtime config (MONGODB_URI, DATABASE_NAME, API keys—not in git)

## Shell Commands for Efficient Code Discovery

Use these CLI tools to explore the codebase programmatically instead of static file lists (which drift quickly):

**Search & Browse**
- `tree -L 2 -I node_modules` — Show project structure at 2 levels
- `rg --files "routers" | head -10` — Find all router files quickly
- `fd "\.tsx$" frontend/src` — Find all React components
- `fd "\.py$" backend` — Find Python scripts in backend

**Code Analysis**
- `rg "def get_.*slides" backend/` — Find slide-related functions in backend
- `rg "interface\|type" frontend/src --type ts` — Find TS types/interfaces
- `rg "POST|GET|PUT|DELETE" backend/routers/admin.py` — Extract FastAPI route definitions

**JSON/Config**
- `jq '.scripts' frontend/package.json` — Extract npm scripts
- `jq '.dependencies' frontend/package.json` — List frontend deps

**Skip Lists (Don't Read)**
- `frontend/node_modules/` — Use `fd` or `rg --type-list` to find specific packages
- `mongodb export/` — Reference only; live data in MongoDB
- `__pycache__/`, `.git/`, `dist/`, `test-results/`, `exports/` — Generated/temp files

### How to Navigate Without Static File Lists
1. Use `tree -L 2 -I node_modules` to see structure once
2. Use `rg` or `fd` to find specific files by pattern (faster than reading CLAUDE.md)
3. Read only targeted files (e.g., `admin.py` for slide logic, `ai_agent.py` for Gemini)
4. Reference schemas below—don't reverse-engineer from Pydantic models

### Database Schema Quick Reference

Instead of reading Pydantic models, use these key collections and fields:

**weekly_tracker_data**: week, region, category, amount, projection_category, weighted_amount, fy
**weekly_tracker_settings**: type ("hidden_slides"), fy (defaults "FY2027"), hidden_slide_ids
**weekly_tracker_custom_slides**: fy (REQUIRED), title, description, data_source
**orderbacklogs**: week, region, amount_uninvoiced, closing_date_fy
**target_settings**: base_target (63.80M), stretch_target (73.00M), category, fy
**ai_chat_sessions/logs**: Sanitize Protobuf/NumPy before insert; pop `_id` from updates; track latency_ms

**Critical FY Rule**: Always filter by `fy` field to prevent cross-year state bleeding (per GEMINI.md)

### API Endpoint Discovery

Use `rg "app.get|app.post|app.put|app.delete" backend/routers/` to see all endpoints. Main routers:
- `backend/routers/admin.py` — Slides, custom slides, settings CRUD
- `backend/routers/ai_agent.py` — Gemini chat, conversation history, logs
- `backend/routers/auth.py` — Login, session management
- `backend/routers/export.py` — Excel/JSON exports

### When to Read Full Files
Only if implementing features in these domains (use `rg` to find them):
- **Slide management** → read `backend/routers/admin.py`
- **AI/Gemini work** → read `backend/routers/ai_agent.py` + `GEMINI.md` (critical)
- **Authentication** → read `backend/routers/auth.py`
- **Data transformation** → read root `transformation.py` or specific variant
- **React component bug** → find component path with `fd "\.tsx$"`, read only that file

## Always Use `py` for Python Execution

Reduces tokens by avoiding shell aliasing overhead:
```bash
py main.py                          # Start backend
py transformation.py                # Run data pipeline
py backend/check_services_targets.py # Validation script
```

NOT: `python main.py`, `python3 main.py`, etc.
