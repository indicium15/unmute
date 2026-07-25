# Google Cloud Storage Setup for Datasets

The backend always reads sign-language datasets from GCS — in every environment, including local
dev — so everyone works off the same data. This guide covers the bucket layout the backend
expects and how to provision/populate a bucket. Handled by `backend/utils/gcp.py`.

## Bucket layout (storage schema)

The backend reads **object paths inside the bucket** (not `gs://` URLs in config). Defaults assume
two top-level prefixes: `sgsl_dataset/` and `sgsl_processed/`.

```
gs://{GCS_BUCKET_NAME}/
├── {GCS_SGLS_DATASET_ROOT}/          # default: sgsl_dataset/
│   └── {sign_name}/
│       ├── {sign_name}.gif           # sign GIF (public URL in render plan / dictionary)
│       ├── primary.gif               # default GIF served for translation + dictionary detail
│       └── {variant}.gif             # additional variant GIFs referenced from signs_metadata.json
└── sgsl_processed/
    ├── vocab.json                    # token ↔ sign folder mapping + aliases, loaded at startup
    ├── signs_metadata.json           # per-sign description/parameters/variants/units
    └── landmarks_pkl/
        ├── {sign_name}.pkl           # hand landmark sequences (hands + optional pose)
        └── {sign_name}_full_body_pose.pkl   # optional; 33×3 full-body pose when generated separately
```

**How paths are used in code**

| Purpose | GCS object path | Module |
|--------|-------------------|--------|
| GIFs for playback / static URLs | `{GCS_SGLS_DATASET_ROOT}/{sign_name}/primary.gif` (translation, dictionary) or `/{sign_name}.gif` / variant filename (dictionary detail) | `utils/dictionary.py`, `utils/translation.py` → `utils/gcp.py:get_static_url` |
| Landmark pickles (server load) | `sgsl_processed/landmarks_pkl/{sign_name}.pkl` | `utils/translation.py` → `utils/gcp.py:read_pickle` |
| Full-body pose pickle (optional) | `sgsl_processed/landmarks_pkl/{sign_name}_full_body_pose.pkl` | `utils/translation.py` |
| Vocabulary + aliases | `sgsl_processed/vocab.json` | `utils/dictionary.py` (`Vocab` singleton) → `utils/gcp.py:read_json` |
| Sign metadata (variants/units/description) | `sgsl_processed/signs_metadata.json` | `utils/dictionary.py` |

**Public URLs** use:

`https://storage.googleapis.com/{GCS_BUCKET_NAME}/{relative_path}`

For example, with the production bucket:
`https://storage.googleapis.com/kinnect-sgsl-datasets/sgsl_dataset/HELLO/HELLO.gif`

**Nested folder caveat:** If uploads created an extra directory level (e.g.
`sgsl_dataset/sgsl_dataset/HELLO/...`), set `GCS_SGLS_DATASET_ROOT=sgsl_dataset/sgsl_dataset` so
GIF paths match the backend.

## Prerequisites

1. Google Cloud account with a project (`kinnect-sgsl` in production)
2. `gcloud` CLI installed and authenticated
3. `gsutil` command available

## Step 1: Create a GCS Bucket

```bash
gcloud config set project kinnect-sgsl

# Create a bucket in the same region as the Cloud Run service
gsutil mb -l asia-southeast1 gs://kinnect-sgsl-datasets
```

## Step 2: Upload Datasets

Datasets are produced by `data-pipeline/` (see `data-pipeline/README.md`). Upload the two
directories so the **bucket root** contains `sgsl_dataset/` and `sgsl_processed/`:

```bash
gsutil -m -o "GSUtil:parallel_process_count=1" cp -r sgsl_dataset/ gs://kinnect-sgsl-datasets/sgsl_dataset/
gsutil -m -o "GSUtil:parallel_process_count=1" cp -r sgsl_processed/ gs://kinnect-sgsl-datasets/sgsl_processed/

# Verify layout
gsutil ls gs://kinnect-sgsl-datasets/
gsutil ls gs://kinnect-sgsl-datasets/sgsl_processed/
gsutil ls gs://kinnect-sgsl-datasets/sgsl_processed/landmarks_pkl/ | head
```

## Step 3: Make Files Publicly Accessible

For the frontend to load GIFs (and any pickle URLs returned in the plan) from
`storage.googleapis.com`, objects need public read access **unless** you use signed URLs or proxy
through the backend (would require code changes).

```bash
# Set uniform bucket-level access first (recommended), then make it public
gsutil uniformbucketlevelaccess set on gs://kinnect-sgsl-datasets
gsutil iam ch allUsers:objectViewer gs://kinnect-sgsl-datasets
```

### Alternative: Signed URLs (More Secure)

If you don't want public access, you can modify the code to generate signed URLs. This requires
service account credentials.

## Step 4: Configure Cloud Run Environment Variables

In the `kinnect-backend` Cloud Run service, set at least:

```
GCS_BUCKET_NAME=kinnect-sgsl-datasets
```

If the GIF layout uses a nested prefix (see the caveat above), also set:

```
GCS_SGLS_DATASET_ROOT=sgsl_dataset/sgsl_dataset
```

```bash
gcloud run services update kinnect-backend \
  --set-env-vars="GCS_BUCKET_NAME=kinnect-sgsl-datasets" \
  --region=asia-southeast1 \
  --project kinnect-sgsl
```

## Step 5: Set Up IAM (For Cloud Run)

Cloud Run needs permission to read from GCS. The default compute service account usually has this,
but you can verify:

```bash
# Get the service account email
gcloud run services describe kinnect-backend --region=asia-southeast1 --project kinnect-sgsl \
  --format='value(spec.template.spec.serviceAccountName)'

# Grant Storage Object Viewer role if needed
gcloud projects add-iam-policy-binding kinnect-sgsl \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@kinnect-sgsl.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

## Environment Variables Reference

| Variable | Description | Default in code if unset |
|----------|-------------|---------|
| `GCS_BUCKET_NAME` | Name of the GCS bucket | `unmute-datasets` (legacy fallback — always set this explicitly; production uses `kinnect-sgsl-datasets`) |
| `GCS_SGLS_DATASET_ROOT` | Object prefix for sign GIF folders (must end at the folder that contains `{sign_name}/{sign_name}.gif`) | `sgsl_dataset` |

## Local Development

Set environment variables in `backend/.env` so the backend can reach GCS locally (see
`docs/frontend/SETUP.md` sibling doc — [docs/backend](.) — or `AGENTS.md` for the full env var
list):

```bash
GCS_BUCKET_NAME=kinnect-sgsl-datasets
# Auth to GCS: either Application Default Credentials (gcloud auth application-default login)
# or FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_PATH, which also covers Firestore.
```

```bash
cd backend
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

## CORS Configuration for Frontend

Since GIFs (and optionally pickles) are served directly from GCS, configure CORS on the bucket if
browsers enforce cross-origin rules:

```bash
cat > cors.json << 'EOF'
[
  {
    "origin": ["https://kinnect-sgsl.web.app", "http://localhost:5173"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://kinnect-sgsl-datasets
```

## Troubleshooting

### "403 Forbidden" when accessing GCS files
- Check bucket permissions: `gsutil iam get gs://kinnect-sgsl-datasets`
- Ensure `allUsers:objectViewer` is set for public access

### "Could not authenticate" errors
- For Cloud Run: check the service account has `storage.objectViewer` role
- For local: run `gcloud auth application-default login`, or set
  `FIREBASE_SERVICE_ACCOUNT_JSON`/`FIREBASE_SERVICE_ACCOUNT_PATH`

### Files not found in GCS
- Verify upload: `gsutil ls gs://kinnect-sgsl-datasets/sgsl_processed/`
- Check bucket name matches `GCS_BUCKET_NAME`
- GIF 404s: confirm `GCS_SGLS_DATASET_ROOT` matches how objects were uploaded (e.g. no accidental
  double `sgsl_dataset/` segment)

## Cost Considerations

GCS pricing includes:
- **Storage**: ~$0.02/GB/month for Standard storage
- **Operations**: ~$0.004 per 10,000 Class A operations (uploads)
- **Egress**: Free within the same region, ~$0.12/GB to internet

For ~10GB of datasets with moderate traffic, expect ~$1-5/month.
