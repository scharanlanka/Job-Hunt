
# Backend Service

Overview
--------

This repository contains the backend for the project — a Python web API (FastAPI-style) that provides data models, storage access, and API routes used by the frontend.

Contents
--------

- `main.py` — application entrypoint for local runs
- `requirements.txt` / `pyproject.toml` — dependency files
- `app/` — application package (models, schemas, database, CRUD, routes)

Prerequisites
-------------

- Python 3.10+ recommended
- Git
- A running database (e.g., PostgreSQL) if using a persisted DB

Environment (.env) overview
---------------------------

This project uses `python-dotenv` (see `app/database.py`) to load environment variables from a `.env` file at runtime. The following variables are required or recommended for local development and production.

Required
- `POSTGRES_URI` — SQLAlchemy-compatible connection string for PostgreSQL. Example: `postgresql://username:password@host:5432/dbname`
- `S3_BUCKET` — name of the S3-compatible bucket used to store uploaded resumes
- `AWS_REGION` — region for the S3 bucket (e.g., `us-east-2`)

Recommended (for S3 access)
- `AWS_ACCESS_KEY_ID` — AWS access key id (or credentials provided by your cloud provider)
- `AWS_SECRET_ACCESS_KEY` — AWS secret access key
- `AWS_SESSION_TOKEN` — optional, when using temporary credentials
- `S3_ENDPOINT_URL` — optional custom S3 endpoint (e.g., for local S3-compatible services like MinIO); leave blank to use AWS default

Example `.env` (DO NOT commit secrets to git)

```env
# PostgreSQL connection string
POSTGRES_URI=postgresql://postgres:password@localhost:5432/job_hunt

# AWS / S3 configuration
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_SESSION_TOKEN=
AWS_REGION=us-east-2
S3_BUCKET=your-bucket-name
S3_ENDPOINT_URL=
```

The code will raise a runtime error if `POSTGRES_URI`, `S3_BUCKET`, or `AWS_REGION` are not set.

Quickstart (development)
------------------------

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

3. Set environment variables (example):

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
export SECRET_KEY="your-secret-key"
```

4. Run the app locally (FastAPI + Uvicorn example):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Notes
-----

- The app entrypoint is `app.main:app` (adjust if your project uses a different module).
- API docs (if using FastAPI) will be available at `http://localhost:8000/docs` and `http://localhost:8000/redoc` when the server is running.

Environment variables
---------------------

- `DATABASE_URL` — connection string for your database
- `SECRET_KEY` — application secret key for signing or encryption
- Any other variables used by `app` modules should be documented in `app/*.py` or the repo's configuration.

Database / Migrations
---------------------

- If the project uses SQLAlchemy / Alembic, run migrations before starting in production. Typical commands:

```bash
alembic upgrade head
```

- For lightweight development, the code may include a `database.py` helper that creates tables automatically — check `app/database.py`.

Testing
-------

- Run unit tests with `pytest`.
- Example:

```bash
pytest -q
```

Development notes
-----------------

- Use `--reload` with Uvicorn for iterative development.
- Keep secrets out of source control — use environment variables or a secrets manager.

API surface
-----------

Below is a concise, detailed overview of every HTTP endpoint implemented in `app/main.py`. Use these to drive the frontend integration or to write API clients.

1) Health check
- Method: `GET`
- Path: `/health`
- Description: Basic liveness endpoint.
- Request: none
- Response (200): `{"status": "ok"}`

2) Upload resume
- Method: `POST`
- Path: `/uploads/resume`
- Description: Accepts a file upload (multipart/form-data) and stores it in the configured S3 bucket. Returns file metadata including a public URL.
- Request: multipart form with field `file` (file payload)
- Response (201): JSON object `{ "name": string, "url": string, "key": string }`
- Errors: 400 on missing filename; 500 if server S3 config missing; 502 on S3 upload errors.

3) List applications
- Method: `GET`
- Path: `/applications`
- Description: Returns all applications ordered by `appliedDate` (descending).
- Response (200): JSON array of `Application` objects (see schemas below)

4) Get single application
- Method: `GET`
- Path: `/applications/{application_id}`
- Description: Retrieve one application by `id`.
- Response (200): `Application` object
- Errors: 404 if not found

5) Create application
- Method: `POST`
- Path: `/applications`
- Description: Create a new application. Validates conditional fields (see schema rules).
- Request body (JSON): `ApplicationCreate` (fields listed below)
- Response (201): Created `Application` object
- Errors: 409 if an application with the same `id` already exists

6) Update application
- Method: `PUT`
- Path: `/applications/{application_id}`
- Description: Update an existing application. If the `stage` changes, the application event log is updated.
- Request body (JSON): `ApplicationUpdate` (same fields as `Application`, excluding `id` in the URL)
- Response (200): Updated `Application` object
- Errors: 404 if not found

7) Delete application
- Method: `DELETE`
- Path: `/applications/{application_id}`
- Description: Permanently delete an application and associated interview rounds.
- Response (204): No content
- Errors: 404 if not found

8) Flow analytics
- Method: `GET`
- Path: `/analytics/flow`
- Description: Returns aggregated stage transition counts based on `ApplicationEvent` history.
- Response (200): JSON array of `FlowTransition` objects: `{ source: string, target: string, count: number }`

Schemas (summary)
-----------------

`Application` / `ApplicationCreate` / `ApplicationUpdate` fields:
- `id` (string) — unique identifier (required for `ApplicationCreate`)
- `company` (string)
- `role` (string)
- `location` (string | optional)
- `stage` (string) — one of: `Applied`, `Applied with Referral`, `Interview Scheduled`, `Interviewed`, `Followed Up`, `Offered`, `Rejected`
- `appliedDate` (date) — ISO date string `YYYY-MM-DD`
- `jobUrl` (string | optional)
- `appliedOn` (enum | optional) — one of: `LinkedIn`, `Indeed`, `Glassdoor`, `Company Portal`
- `referralDetails` (string | optional) — required when `stage` is `Applied with Referral`
- `interviewRounds` (array) — list of interview round objects (see below)
- `jobDescription` (string)
- `notes` (string)
- `resumeUsed` (object | optional) — `{ name: string, url?: string }`

`InterviewRoundBase` fields:
- `roundNumber` (integer >= 1)
- `roundType` (string | optional)
- `scheduledAt` (datetime | optional, ISO 8601)
- `completedAt` (datetime | optional, ISO 8601)
- `result` (optional) — one of `Pending`, `Pass`, `Fail`, `Cancelled`
- `notes` (string | optional)

Validation notes
----------------
- If `stage` is `Applied with Referral`, `referralDetails` is required.
- If `stage` is `Applied`, `referralDetails` and `interviewRounds` must be empty.
- `interviewRounds` must have unique `roundNumber` values and are sorted when saved.

Where to look in code
----------------------
- Application routes and dependence: `app/main.py`
- Request/response data models and validation: `app/schemas.py`
- Database models and relationships: `app/models.py`
- Storage (S3) helpers: `app/storage.py`
- CRUD operations: `app/crud.py`

If you'd like, I can also:
- create a `backend/.env.example` file with the placeholders shown above
- add example curl requests or Postman collection for each endpoint
- add a Dockerfile and docker-compose for local dev (Postgres + MinIO)


Deployment
----------

- For production, run the app behind a process manager (systemd, Docker, Gunicorn with Uvicorn workers) and a reverse proxy (nginx).
- Build a Dockerfile that installs the requirements and runs `uvicorn app.main:app --host 0.0.0.0 --port 8000` as the container CMD.

Common Commands
---------------

- Install deps: `pip install -r requirements.txt`
- Run locally: `uvicorn app.main:app --reload --port 8000`
- Run tests: `pytest`

