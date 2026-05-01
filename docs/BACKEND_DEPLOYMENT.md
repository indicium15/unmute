# Backend Deployment Guide (Google Cloud Run)

## Prerequisites

- Google Cloud project: `unmute-c9757`
- Billing enabled on the project
- `gcloud` CLI installed and authenticated
- `uv` installed for local backend development
- `firebase-key.json` in the repo root (Firebase service account private key)

## One-time Setup

### 1. Authenticate
```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project unmute-c9757
gcloud auth application-default set-quota-project unmute-c9757
```

### 2. Enable required APIs
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com --project unmute-c9757
```

### 3. Create the Firebase secret
Download the service account key from Firebase Console → Project Settings → Service Accounts → Generate new private key. Save as `firebase-key.json` in the repo root, then:
```bash
gcloud secrets create firebase-key --data-file=firebase-key.json --project unmute-c9757
```

### 4. Grant Cloud Run access to the secret
```bash
gcloud secrets add-iam-policy-binding firebase-key \
  --member="serviceAccount:1091773650054-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project unmute-c9757
```

### 5. Set up GCS bucket
```bash
gcloud storage buckets create gs://unmute-c9757-datasets --project=unmute-c9757 --location=asia-southeast1

# Make publicly readable (for GIF serving)
gcloud storage buckets add-iam-policy-binding gs://unmute-c9757-datasets \
  --member=allUsers \
  --role=roles/storage.objectViewer

# Upload datasets
gsutil -m cp -r sgsl_dataset/ gs://unmute-c9757-datasets/sgsl_dataset/
gsutil -m cp -r sgsl_processed/ gs://unmute-c9757-datasets/sgsl_processed/
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
cd backend && gcloud builds submit --tag gcr.io/unmute-c9757/unmute-backend .
```

### Deploy to Cloud Run
```bash
gcloud run deploy unmute-backend --image gcr.io/unmute-c9757/unmute-backend --platform managed --region asia-southeast1 --memory 1Gi --allow-unauthenticated --set-env-vars USE_GCS=true,GCS_BUCKET_NAME=unmute-c9757-datasets,FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/firebase-key.json --set-secrets GEMINI_API_KEY=gemini-api-key:latest,/secrets/firebase-key.json=firebase-key:latest --project unmute-c9757
```

Create and rotate the `gemini-api-key` Secret Manager secret with [GEMINI_KEY_ROTATION.md](GEMINI_KEY_ROTATION.md).

After deploying, copy the Cloud Run URL from the output — you'll need it for the frontend `.env`.

## Redeploying after code changes

```bash
cd backend && gcloud builds submit --tag gcr.io/unmute-c9757/unmute-backend .
gcloud run deploy unmute-backend --image gcr.io/unmute-c9757/unmute-backend --platform managed --region asia-southeast1 --memory 1Gi --project unmute-c9757
```

## Environment Variables

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | From Google AI Studio |
| `USE_GCS` | `true` |
| `GCS_BUCKET_NAME` | `unmute-c9757-datasets` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `/secrets/firebase-key.json` |

## Notes

- `firebase-key.json` is gitignored — never commit it
- The Gemini API key is also sensitive — never commit `.env`
- Cloud Run automatically scales to zero when not in use (cost-efficient)
- Port is dynamically set via `${PORT:-8080}` in the Dockerfile to comply with Cloud Run requirements
- The backend needs more than Cloud Run's 512 MiB default during startup; deploy it with at least `--memory 1Gi`
