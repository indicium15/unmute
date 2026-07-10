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
Download the service account key from Firebase Console → Project Settings → Service Accounts → Generate new private key. Save as `firebase-key.json` in the repo root, then:
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

### 5. Set up GCS bucket
```bash
gcloud storage buckets create gs://kinnect-sgsl-datasets --project=kinnect-sgsl --location=asia-southeast1

# Make publicly readable (for GIF serving)
gcloud storage buckets add-iam-policy-binding gs://kinnect-sgsl-datasets \
  --member=allUsers \
  --role=roles/storage.objectViewer

# Upload datasets
gsutil -m -o "GSUtil:parallel_process_count=1" cp -r sgsl_dataset/ gs://kinnect-sgsl-datasets/sgsl_dataset/
gsutil -m -o "GSUtil:parallel_process_count=1" cp -r sgsl_processed/ gs://kinnect-sgsl-datasets/sgsl_processed/
```

## Deploying

The Cloud Run image installs backend dependencies with `uv` from `backend/pyproject.toml` and `backend/uv.lock`.

### Local backend development
```bash
cd backend
uv sync
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Build the image
```bash
cd backend && gcloud builds submit --tag gcr.io/kinnect-sgsl/kinnect-backend .
```

### Deploy to Cloud Run
```bash
gcloud run deploy kinnect-backend \
  --image gcr.io/kinnect-sgsl/kinnect-backend \
  --platform managed \
  --region asia-southeast1 \
  --memory 1Gi \
  --allow-unauthenticated \
  --set-env-vars USE_GCS=true,GCS_BUCKET_NAME=kinnect-sgsl-datasets,LLM_PROVIDER=azure,AZURE_OPENAI_ENDPOINT=https://bettersg-openai-sea-prod.openai.azure.com/,AZURE_OPENAI_API_VERSION=2025-04-01-preview,AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini,FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/firebase-key.json \
  --set-secrets AZURE_OPENAI_API_KEY=azure-openai-api-key:latest,/secrets/firebase-key.json=firebase-key:latest \
  --project kinnect-sgsl
```

After deploying, copy the Cloud Run URL from the output — you'll need it for the frontend `.env`.

### Creating the Azure OpenAI secret (one-time)

```bash
read -s AZURE_OPENAI_API_KEY
printf "%s" "$AZURE_OPENAI_API_KEY" | gcloud secrets create azure-openai-api-key --data-file=- --project kinnect-sgsl
unset AZURE_OPENAI_API_KEY

gcloud secrets add-iam-policy-binding azure-openai-api-key \
  --member="serviceAccount:486007040576-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project kinnect-sgsl
```

To rotate the key later, follow the same pattern as `docs/GEMINI_KEY_ROTATION.md` (that doc is titled for the OpenAI key but the steps — `gcloud secrets versions add`, disable the old version, restart Cloud Run — apply identically to `azure-openai-api-key`).

## Redeploying after code changes

```bash
cd backend && gcloud builds submit --tag gcr.io/kinnect-sgsl/kinnect-backend .
gcloud run deploy kinnect-backend --image gcr.io/kinnect-sgsl/kinnect-backend --platform managed --region asia-southeast1 --memory 1Gi --project kinnect-sgsl
```

## Environment Variables

| Variable | Value |
|---|---|
| `AZURE_OPENAI_API_KEY` | From Secret Manager (`azure-openai-api-key:latest`) |
| `AZURE_OPENAI_ENDPOINT` | `https://bettersg-openai-sea-prod.openai.azure.com/` |
| `AZURE_OPENAI_API_VERSION` | `2025-04-01-preview` |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-5.4-mini` (deployment name — confirm this matches the actual Azure deployment name for the model version 2026-03-17) |
| `LLM_PROVIDER` | `azure` |
| `USE_GCS` | `true` |
| `GCS_BUCKET_NAME` | `kinnect-sgsl-datasets` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `/secrets/firebase-key.json` |

## Notes

- `firebase-key.json` is gitignored — never commit it
- The OpenAI API key is sensitive — never commit `.env`
- Cloud Run automatically scales to zero when not in use (cost-efficient)
- Port is dynamically set via `${PORT:-8080}` in the Dockerfile to comply with Cloud Run requirements
- The backend needs more than Cloud Run's 512 MiB default during startup; deploy it with at least `--memory 1Gi`
