# Frontend (Next.js)

## Overview
This frontend provides:

1. Table and Kanban views for applications.
2. Stage-based application editing.
3. Dynamic interview rounds support.
4. Resume upload and preview link handling.
5. Proxy API routes under `/api/*` to call backend safely.

Main UI is in `frontend/src/app/page.tsx`.

## Tech Stack

1. Next.js (App Router)
2. React + TypeScript
3. Tailwind CSS

## Prerequisites

1. Node.js 18+
2. Backend service running on `http://127.0.0.1:8000` (or configured host)

## Installation

```bash
cd frontend
npm install
```

## Environment Setup

Create `frontend/.env.local`:

```env
BACKEND_API_BASE_URL=http://127.0.0.1:8000
```

Optional:

1. `NEXT_PUBLIC_API_BASE_URL` can override client API base (defaults to `/api`).
2. In normal local setup, keep client requests on `/api` and only set `BACKEND_API_BASE_URL`.

## Run the Frontend

```bash
cd frontend
npm run dev
```

Frontend URL:

1. `http://localhost:3000`

## API Integration

Frontend context (`frontend/src/app/applications-context.tsx`) calls:

1. `GET /api/applications`
2. `POST /api/applications`
3. `PUT /api/applications/{id}`
4. `DELETE /api/applications/{id}`
5. `POST /api/uploads/resume`

`frontend/src/app/api/[...path]/route.ts` proxies those requests to backend.

## Build and Typecheck

```bash
cd frontend
npx tsc --noEmit
npm run build
```

## Troubleshooting

1. `Cannot reach backend...`  
Ensure backend is running and `BACKEND_API_BASE_URL` points to it.

2. `Request failed (500)` during resume upload  
Check backend logs for S3/IAM details.
