# Backend Deployment Guide (Google Cloud Run)

## Prerequisites

- Google Cloud project: `kinnect-sgsl`
- Billing enabled on the project
- `gcloud` CLI installed and authenticated
- `uv` installed for local backend development

## One-time Setup

### 1. Authenticate
```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project kinnect-sgsl
gcloud auth application-default set-quota-project kinnect-sgsl
```

### 2. Enable required APIs
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com --project kinnect-sgsl
```

### 3. Create the Firebase secret
Download the service account key from Firebase Console → Project Settings → Service Accounts →
Generate new private key. Save as `firebase-key.json` in the repo root, then:
```bash
gcloud secrets create firebase-key --data-file=firebase-key.json --project kinnect-sgsl
```

### 4. Grant Cloud Run access to the secret
```bash
gcloud secrets add-iam-policy-binding firebase-key \
  --member="serviceAccount:486007040576-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project kinnect-sgsl
```

### 5. Set up the GCS bucket

See `docs/backend/GCS_SETUP.md` for the full bucket layout, IAM, and CORS setup. Quick version:
```bash
gcloud storage buckets create gs://kinnect-sgsl-datasets --project=kinnect-sgsl --location=asia-southeast1

gcloud storage buckets add-iam-policy-binding gs://kinnect-sgsl-datasets \
  --member=allUsers \
  --role=roles/storage.objectViewer

gsutil -m -o "GSUtil:parallel_process_count=1" cp -r sgsl_dataset/ gs://kinnect-sgsl-datasets/sgsl_dataset/
gsutil -m -o "GSUtil:parallel_process_count=1" cp -r sgsl_processed/ gs://kinnect-sgsl-datasets/sgsl_processed/
```

### 6. Create the Azure OpenAI secrets (one-time)

Two separate Azure resources are used: the chat deployment (gloss translation) and a realtime
Whisper deployment (transcription). Both keys are secrets; endpoints/deployment names are plain
env vars.

```bash
read -s AZURE_OPENAI_API_KEY
printf "%s" "$AZURE_OPENAI_API_KEY" | gcloud secrets create azure-openai-api-key --data-file=- --project kinnect-sgsl
unset AZURE_OPENAI_API_KEY

read -s AZURE_WHISPER_OPENAI_API_KEY
printf "%s" "$AZURE_WHISPER_OPENAI_API_KEY" | gcloud secrets create azure-whisper-api-key --data-file=- --project kinnect-sgsl
unset AZURE_WHISPER_OPENAI_API_KEY

gcloud secrets add-iam-policy-binding azure-openai-api-key \
  --member="serviceAccount:486007040576-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project kinnect-sgsl

gcloud secrets add-iam-policy-binding azure-whisper-api-key \
  --member="serviceAccount:486007040576-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project kinnect-sgsl
```

## Deploying

The Cloud Run image installs backend dependencies with `uv` from `backend/pyproject.toml` and
`backend/uv.lock` (see `backend/Dockerfile`).

### Local backend development
```bash
cd backend
uv sync
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000
```
(Or run it in Docker — see `docs/backend/DOCKER_SETUP.md`.)

### Build the image
```bash
cd backend && gcloud builds submit --tag gcr.io/kinnect-sgsl/kinnect-backend . --project kinnect-sgsl
```

### Deploy to Cloud Run
```bash
gcloud run deploy kinnect-backend \
  --image gcr.io/kinnect-sgsl/kinnect-backend \
  --platform managed \
  --region asia-southeast1 \
  --memory 1Gi \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET_NAME=kinnect-sgsl-datasets,AZURE_OPENAI_ENDPOINT=https://bettersg-openai-sea-prod.openai.azure.com/,AZURE_OPENAI_API_VERSION=2025-04-01-preview,AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini,AZURE_WHISPER_ENDPOINT=https://YOUR-WHISPER-RESOURCE.openai.azure.com/,AZURE_WHISPER_DEPLOYMENT=gpt-realtime-whisper,FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/firebase-key.json \
  --set-secrets AZURE_OPENAI_API_KEY=azure-openai-api-key:latest,AZURE_WHISPER_OPENAI_API_KEY=azure-whisper-api-key:latest,/secrets/firebase-key.json=firebase-key:latest \
  --project kinnect-sgsl
```

After deploying, copy the Cloud Run URL from the output — you'll need it for the frontend's
`VITE_API_BASE_URL` (see `docs/deploy/FRONTEND_DEPLOYMENT.md`).

## Redeploying after code changes

```bash
cd backend && gcloud builds submit --tag gcr.io/kinnect-sgsl/kinnect-backend . --project kinnect-sgsl
gcloud run deploy kinnect-backend --image gcr.io/kinnect-sgsl/kinnect-backend --platform managed --region asia-southeast1 --memory 1Gi --project kinnect-sgsl
```

If `gcloud` errors with "Reauthentication failed... cannot prompt during non-interactive
execution", the CLI's cached credentials expired mid-session — run `gcloud auth login`
interactively before retrying.

## Rotating the Azure OpenAI / Whisper keys

Same pattern for either secret (`azure-openai-api-key` or `azure-whisper-api-key`):

```bash
read -s NEW_KEY
printf "%s" "$NEW_KEY" | gcloud secrets versions add azure-openai-api-key --data-file=- --project kinnect-sgsl
unset NEW_KEY

# Disable the old version (replace N with the previous version number)
gcloud secrets versions disable N --secret=azure-openai-api-key --project kinnect-sgsl

# Restart Cloud Run so instances pick up the latest secret version
gcloud run services update kinnect-backend \
  --region asia-southeast1 \
  --update-labels secret-refresh="$(date +%Y%m%d%H%M%S)" \
  --project kinnect-sgsl
```

Then revoke/delete the old key on the Azure side.

## Environment Variables

| Variable | Value |
|---|---|
| `AZURE_OPENAI_API_KEY` | From Secret Manager (`azure-openai-api-key:latest`) |
| `AZURE_OPENAI_ENDPOINT` | `https://bettersg-openai-sea-prod.openai.azure.com/` |
| `AZURE_OPENAI_API_VERSION` | `2025-04-01-preview` |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-5.4-mini` (deployment name — confirm this matches the actual Azure deployment name) |
| `AZURE_WHISPER_ENDPOINT` | Separate Azure resource hosting the realtime Whisper deployment |
| `AZURE_WHISPER_OPENAI_API_KEY` | From Secret Manager (`azure-whisper-api-key:latest`) |
| `AZURE_WHISPER_DEPLOYMENT` | `gpt-realtime-whisper` |
| `GCS_BUCKET_NAME` | `kinnect-sgsl-datasets` |
| `GCS_SGLS_DATASET_ROOT` | Optional; only needed if the bucket has a nested GIF prefix — see `docs/backend/GCS_SETUP.md` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `/secrets/firebase-key.json` (or `FIREBASE_SERVICE_ACCOUNT_JSON` inline) |
| `AUTH_ENABLED` | `true` in production; `false` only for open-access/demo deployments |

## Notes

- `firebase-key.json` is gitignored — never commit it
- The Azure OpenAI keys are sensitive — never commit `.env`
- Cloud Run automatically scales to zero when not in use (cost-efficient)
- Port is dynamically set via `${PORT:-8080}` in the Dockerfile to comply with Cloud Run requirements
- The backend needs more than Cloud Run's 512 MiB default during startup (MediaPipe/OpenCV are
  heavy imports); deploy it with at least `--memory 1Gi`

## Verification

Confirm Cloud Run references Secret Manager instead of showing raw keys:

```bash
gcloud run services describe kinnect-backend \
  --region asia-southeast1 \
  --format='yaml(spec.template.spec.containers[0].env)' \
  --project kinnect-sgsl
```

`AZURE_OPENAI_API_KEY` / `AZURE_WHISPER_OPENAI_API_KEY` should use a `valueFrom.secretKeyRef`
entry, not a plaintext `value`.

Test the deployed backend from the frontend translate page. If translation fails, inspect Cloud
Run logs:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="kinnect-backend" AND (textPayload:"Azure" OR textPayload:"/api/translate")' \
  --project kinnect-sgsl \
  --limit=50 \
  --freshness=1h
```
