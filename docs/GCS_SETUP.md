# Google Cloud Storage Setup for Datasets

This guide explains how to store `sgsl_dataset` and `sgsl_processed` on Google Cloud Storage (GCS) for production deployment, and how the backend expects objects to be laid out.

## Bucket layout (storage schema)

The backend reads **object paths inside the bucket** (not `gs://` URLs in config). Defaults assume you upload two top-level prefixes: `sgsl_dataset/` and `sgsl_processed/`.

```
gs://{GCS_BUCKET_NAME}/
├── {GCS_SGLS_DATASET_ROOT}/          # default: sgsl_dataset/
│   └── {sign_name}/
│       ├── {sign_name}.gif           # sign video (public URL in render plan)
│       └── {sign_name}.json          # optional per-sign metadata (dataset tooling)
└── sgsl_processed/
    ├── vocab.json                    # token ↔ sign folder mapping (loaded at startup)
    ├── meta.json                     # optional; from preprocess scripts (not read by backend)
    └── landmarks_pkl/
        ├── {sign_name}.pkl           # hand landmark sequences (hands + optional pose in same pickle)
        └── {sign_name}_full_body_pose.pkl   # optional; 33×3 full-body pose when generated separately
```

**How paths are used in code**

| Purpose | GCS object path | Module |
|--------|-------------------|--------|
| GIFs for playback / static URLs | `{GCS_SGLS_DATASET_ROOT}/{sign_name}/{sign_name}.gif` | `planner` → `gcs_storage.get_static_url` |
| Landmark pickles (server load) | `sgsl_processed/landmarks_pkl/{sign_name}.pkl` | `sign_seq` → `read_pickle` |
| Full-body pose pickle (optional) | `sgsl_processed/landmarks_pkl/{sign_name}_full_body_pose.pkl` | `sign_seq` |
| Vocabulary | `sgsl_processed/vocab.json` | `vocab` → `read_json` |

**Public URLs** (when `USE_GCS=true`) use:

`https://storage.googleapis.com/{GCS_BUCKET_NAME}/{relative_path}`

For example, with defaults:  
`https://storage.googleapis.com/unmute-datasets/sgsl_dataset/HELLO/HELLO.gif`

The render plan also exposes pickle paths under `sgsl_processed/landmarks_pkl/` via the same `get_static_url` pattern; those objects must be readable by whatever loads them (often public if the browser fetches them directly).

**Nested folder caveat:** If uploads created an extra directory level (e.g. `sgsl_dataset/sgsl_dataset/HELLO/...`), set `GCS_SGLS_DATASET_ROOT=sgsl_dataset/sgsl_dataset` so GIF paths match the backend.

## Prerequisites

1. Google Cloud account with a project
2. `gcloud` CLI installed and authenticated
3. `gsutil` command available

## Step 1: Create a GCS Bucket

```bash
# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Create a bucket in the same region as your Cloud Run service
gsutil mb -l asia-southeast1 gs://unmute-datasets

# Or use a different name
gsutil mb -l asia-southeast1 gs://your-bucket-name
```

## Step 2: Upload Datasets

Upload the two directories so **bucket root** contains `sgsl_dataset/` and `sgsl_processed/` (matching the layout above):

```bash
# Upload both dataset trees (this may take a while)
gsutil -m cp -r sgsl_dataset gs://unmute-datasets/
gsutil -m cp -r sgsl_processed gs://unmute-datasets/

# Verify layout
gsutil ls gs://unmute-datasets/
gsutil ls gs://unmute-datasets/sgsl_processed/
gsutil ls gs://unmute-datasets/sgsl_processed/landmarks_pkl/ | head
```

## Step 3: Make Files Publicly Accessible

For the frontend to load GIFs (and any pickle URLs returned in the plan) from `storage.googleapis.com`, objects need public read access **unless** you use signed URLs or proxy through the backend (would require code changes).

```bash
# Make entire bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://unmute-datasets

# Or set uniform bucket-level access first (recommended)
gsutil uniformbucketlevelaccess set on gs://unmute-datasets
gsutil iam ch allUsers:objectViewer gs://unmute-datasets
```

### Alternative: Signed URLs (More Secure)

If you don't want public access, you can modify the code to generate signed URLs. This requires service account credentials.

## Step 4: Configure Cloud Run Environment Variables

In your Cloud Run service, set at least:

```
USE_GCS=true
GCS_BUCKET_NAME=unmute-datasets
```

If your GIF layout uses a nested prefix (see above), also set:

```
GCS_SGLS_DATASET_ROOT=sgsl_dataset/sgsl_dataset
```

### Using gcloud CLI:

```bash
gcloud run services update unmute-backend \
  --set-env-vars="USE_GCS=true,GCS_BUCKET_NAME=unmute-datasets" \
  --region=asia-southeast1
```

### Using Cloud Console:

1. Go to Cloud Run in Google Cloud Console
2. Select your service
3. Click "Edit & Deploy New Revision"
4. Go to "Variables & Secrets" tab
5. Add:
   - `USE_GCS` = `true`
   - `GCS_BUCKET_NAME` = `unmute-datasets`
   - Optional: `GCS_SGLS_DATASET_ROOT` = `sgsl_dataset` (default) or `sgsl_dataset/sgsl_dataset`
6. Deploy

## Step 5: Set Up IAM (For Cloud Run)

Cloud Run needs permission to read from GCS. The default service account usually has this, but you can verify:

```bash
# Get the service account email
gcloud run services describe unmute-backend --region=asia-southeast1 --format='value(spec.template.spec.serviceAccountName)'

# Grant Storage Object Viewer role if needed
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_GCS` | Enable GCS storage (`true`/`false`) | `false` |
| `GCS_BUCKET_NAME` | Name of the GCS bucket | `unmute-datasets` |
| `GCS_SGLS_DATASET_ROOT` | Object prefix for sign GIF folders (must end at the folder that contains `{sign_name}/{sign_name}.gif`) | `sgsl_dataset` |

## How It Works

When `USE_GCS=true`:

1. **GIFs**: Paths like `{GCS_SGLS_DATASET_ROOT}/{sign}/{sign}.gif` are turned into public `storage.googleapis.com` URLs for the client.
2. **Pickles**: `sgsl_processed/landmarks_pkl/*.pkl` are read with the **Google Cloud Storage Python client** (server-side). Frequently used reads may be cached in memory (`read_pickle_cached`).
3. **vocab.json**: Loaded from `sgsl_processed/vocab.json` at startup via `read_json`.

`aliases.json` is read from the backend package on disk only (not from GCS); ship it with the container image if you rely on aliases in production.

## Local Development

For local development, you have two options:

### Option 1: Use Local Files (Default)

Keep `USE_GCS=false` (or unset) and place `sgsl_dataset/` and `sgsl_processed/` where the backend expects them (see `backend/docker-compose.yml` for example volume mounts).

### Option 2: Test with GCS

Set environment variables to test GCS integration locally:

```bash
export USE_GCS=true
export GCS_BUCKET_NAME=unmute-datasets
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

uvicorn backend.app:app --reload
```

## CORS Configuration for Frontend

Since GIFs (and optionally pickles) are served directly from GCS, configure CORS on the bucket if browsers enforce cross-origin rules:

```bash
# Create cors.json file
cat > cors.json << 'EOF'
[
  {
    "origin": ["https://unmute-gamma.vercel.app", "http://localhost:5173"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Apply CORS configuration
gsutil cors set cors.json gs://unmute-datasets
```

## Troubleshooting

### "403 Forbidden" when accessing GCS files
- Check bucket permissions: `gsutil iam get gs://unmute-datasets`
- Ensure `allUsers:objectViewer` is set for public access

### "Could not authenticate" errors
- For Cloud Run: Check service account has `storage.objectViewer` role
- For local: Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

### Files not found in GCS
- Verify upload: `gsutil ls gs://unmute-datasets/sgsl_processed/`
- Check bucket name matches `GCS_BUCKET_NAME`
- GIF 404s: confirm `GCS_SGLS_DATASET_ROOT` matches how objects were uploaded (e.g. no accidental double `sgsl_dataset/` segment)

## Cost Considerations

GCS pricing includes:
- **Storage**: ~$0.02/GB/month for Standard storage
- **Operations**: ~$0.004 per 10,000 Class A operations (uploads)
- **Egress**: Free within same region, ~$0.12/GB to internet

For ~10GB of datasets with moderate traffic, expect ~$1-5/month.
