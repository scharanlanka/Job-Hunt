# Job Hunt

A full-stack application to track job applications from first apply to final outcome, with structured interview round tracking, referral context, resume management, and stage analytics.

## What This App Is For

`Job Hunt` helps you maintain a single, clean system for your active and past job applications.

Use it to:
- Track each application by stage (`Applied`, `Interview Scheduled`, `Offered`, etc.)
- Maintain role/company details, notes, and source platform
- Add and manage interview rounds for each application
- Upload and preview the exact resume used for a role
- Analyze stage transitions via flow analytics

## Project Structure

- `frontend/`: Next.js + TypeScript UI (table and kanban views)
- `backend/`: FastAPI + SQLAlchemy API
- `backend/app/storage.py`: S3-based resume upload/fetch logic
- `frontend/src/app/api/[...path]/route.ts`: Frontend API proxy to backend

## High-Level Architecture

1. Frontend calls `/api/*` routes.
2. Next.js proxy forwards requests to backend (`BACKEND_API_BASE_URL`).
3. Backend stores application data in PostgreSQL.
4. Backend uploads/fetches resumes from S3-compatible storage.
5. Frontend renders resume preview inside the app modal through proxied backend stream.

## Core Features

- Application CRUD
- Stage-based workflow management
- Interview rounds (type, schedule, result, notes)
- Resume upload + in-app preview + download
- Table and Kanban views
- Flow analytics endpoint for stage transitions

## Prerequisites

- Node.js 18+
- Python 3.10+
- PostgreSQL
- S3 bucket (AWS S3 or compatible provider)

## Environment Variables

### Backend (`backend/.env`)

Required:
- `POSTGRES_URI` (example: `postgresql://postgres:password@localhost:5432/job_hunt`)
- `S3_BUCKET`
- `AWS_REGION`

Recommended for S3 auth:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` (optional)
- `S3_ENDPOINT_URL` (optional, for S3-compatible providers)

### Frontend (`frontend/.env.local`)

Required for local dev:
- `BACKEND_API_BASE_URL=http://127.0.0.1:8000`

Optional:
- `NEXT_PUBLIC_API_BASE_URL=/api`

## Run Locally

### 1) Start backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URLs:
- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:
- `http://localhost:3000`

## Main API Endpoints

- `GET /health`
- `GET /applications`
- `GET /applications/{application_id}`
- `POST /applications`
- `PUT /applications/{application_id}`
- `DELETE /applications/{application_id}`
- `POST /uploads/resume`
- `GET /uploads/resume/view?url=...` (or `?key=...`)
- `GET /analytics/flow`

## Typical Workflow

1. Create application entry.
2. Upload resume for that job.
3. Update stage as process progresses.
4. Add interview rounds and notes.
5. Preview/download resume directly in-app.
6. Review analytics and pipeline health.

## Troubleshooting

- `POSTGRES_URI is not set`: add backend `.env` and restart backend.
- `Cannot reach backend`: verify backend is running and `BACKEND_API_BASE_URL` is correct.
- Resume upload/preview errors: verify S3 env vars + bucket permissions.

## Existing Detailed Docs

- Backend deep dive: `backend/README.md`
- Frontend deep dive: `frontend/README.md`
