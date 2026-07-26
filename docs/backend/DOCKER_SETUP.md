# Docker Setup for the Unmute Backend

Run the backend in a container via `backend/docker-compose.yml` (not a repo-root compose file).
The image installs Python dependencies with `uv` (see `backend/Dockerfile`).

## Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (usually included with Docker Desktop)
- Azure OpenAI credentials (chat deployment + realtime Whisper deployment)
- A Firebase service account key (`firebase-key.json`) for Firestore/auth — the compose file
  mounts it from the repo root as `../gcs-key.json` (despite the name, this is the Firebase
  service account JSON, used for both Firestore and GCS auth via Application Default Credentials)

## Quick Start

### 1. Set up environment variables

Create `backend/.env` (the compose file's `env` block reads a subset of these; uvicorn reads the
rest directly from the container environment via `python-dotenv`):

```bash
cat > backend/.env << 'EOF'
AUTH_ENABLED=true
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_VERSION=2025-04-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini
AZURE_WHISPER_ENDPOINT=...
AZURE_WHISPER_OPENAI_API_KEY=...
AZURE_WHISPER_DEPLOYMENT=gpt-realtime-whisper
GCS_BUCKET_NAME=kinnect-sgsl-datasets
EOF
```

Place the Firebase service account key at the repo root as `gcs-key.json` (gitignored) — this is
what `backend/docker-compose.yml` mounts into the container and points
`GOOGLE_APPLICATION_CREDENTIALS` at.

> **Note:** `backend/docker-compose.yml` also passes through a `GEMINI_API_KEY` environment
> variable. It's a leftover from an earlier provider and isn't read by any current backend code
> (the only LLM client is Azure OpenAI's `AzureOpenAIClient` in `backend/utils/llm.py` — see
> `AGENTS.md`). You can leave it unset.

### 2. Build and run with Docker Compose (Recommended)

```bash
cd backend
docker-compose up --build
```

The backend will be available at `http://localhost:8000`.

### 3. Run in detached mode (background)

```bash
cd backend
docker-compose up -d
```

### 4. View logs

```bash
cd backend
docker-compose logs -f backend
```

### 5. Stop the backend

```bash
cd backend
docker-compose down
```

## Alternative: Using Docker directly (without compose)

```bash
# Build the image (from repo root, since the Dockerfile COPYs pyproject.toml/uv.lock from its
# build context — backend/Dockerfile expects to be built with backend/ as context)
cd backend
docker build -t unmute-backend .

# Run the container
docker run -d \
  --name unmute-backend \
  -p 8000:8000 \
  -e PORT=8000 \
  --env-file .env \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/gcs-key.json \
  -v "$(pwd)/../gcs-key.json:/app/gcs-key.json:ro" \
  unmute-backend
```

View logs:
```bash
docker logs -f unmute-backend
```

Stop and remove:
```bash
docker stop unmute-backend
docker rm unmute-backend
```

## API Endpoints

Once running:

- **Health check**: http://localhost:8000/health
- **API docs**: http://localhost:8000/docs
- **Translation**: http://localhost:8000/api/translate

## Development Mode

`backend/docker-compose.yml` mounts `.` into `/app/backend`, so code edits are visible inside the
container. Uncomment/add a `--reload` command override to get hot reload:

```yaml
command: uv run uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Then run:
```bash
docker-compose up
```

## Troubleshooting

### Port already in use

Change the port mapping in `backend/docker-compose.yml`:

```yaml
ports:
  - "8001:8000"  # Use 8001 on host instead
```

### Container fails to start

Check logs:
```bash
docker-compose logs backend
```

Common causes: missing `AZURE_OPENAI_*` vars (translation will fall back to a mock client rather
than crash — check startup logs for which provider was selected), or a missing/misnamed
`gcs-key.json` at the repo root causing Firebase Admin init to fail (unless `AUTH_ENABLED=false`).

### Cannot access static files / sign GIFs

The backend always reads datasets from GCS (no local dataset volume mount is needed or used) — see
`docs/backend/GCS_SETUP.md`. 404s usually mean `GCS_BUCKET_NAME`/`GCS_SGLS_DATASET_ROOT` don't
match how the bucket was populated, or GCS auth isn't configured (`GOOGLE_APPLICATION_CREDENTIALS`
/ `FIREBASE_SERVICE_ACCOUNT_JSON`).

## Production Deployment

Docker Compose here is for local development. For actually deploying, see
`docs/deploy/BACKEND_DEPLOYMENT.md` (Cloud Run, which builds the same `backend/Dockerfile` via
Cloud Build).
