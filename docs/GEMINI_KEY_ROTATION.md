# OpenAI API Key Rotation

Use this guide when the OpenAI API key has been exposed, depleted, revoked, or needs routine rotation.

## Summary

The backend reads `OPENAI_API_KEY` from the environment. In production, Cloud Run populates that variable from Google Secret Manager via `--set-secrets OPENAI_API_KEY=openai-api-key:latest`. Normal backend redeploys preserve the secret binding — you do not need to update `scripts/deploy.sh` for routine key rotation.

## Prerequisites

- Access to platform.openai.com to create a new API key (use **Restricted** permissions → **Models: Write** only)
- `gcloud` CLI installed and authenticated
- Permission to manage Secret Manager secrets in `kinnect-sgsl`

```bash
gcloud config set project kinnect-sgsl
```

## Rotating an Existing Key

Create a new restricted API key at platform.openai.com. Do not paste it into chat, docs, commits, or command history.

Add it as a new Secret Manager version:

```bash
read -s OPENAI_API_KEY
printf "%s" "$OPENAI_API_KEY" | gcloud secrets versions add openai-api-key --data-file=- --project kinnect-sgsl
unset OPENAI_API_KEY
```

Disable the old version (replace `N` with the previous version number):

```bash
gcloud secrets versions disable N --secret=openai-api-key --project kinnect-sgsl
```

Restart Cloud Run so instances pick up the latest secret version:

```bash
gcloud run services update kinnect-backend \
  --region asia-southeast1 \
  --update-labels secret-refresh="$(date +%Y%m%d%H%M%S)" \
  --project kinnect-sgsl
```

Then revoke the old key at platform.openai.com.

## Verification

Confirm Cloud Run references Secret Manager instead of showing the raw key:

```bash
gcloud run services describe kinnect-backend \
  --region asia-southeast1 \
  --format='yaml(spec.template.spec.containers[0].env)' \
  --project kinnect-sgsl
```

`OPENAI_API_KEY` should use a `valueFrom.secretKeyRef` entry, not a plaintext `value`.

Test the deployed backend from the frontend translate page. If translation fails, inspect Cloud Run logs:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="kinnect-backend" AND (textPayload:"OpenAI" OR textPayload:"/api/translate")' \
  --project kinnect-sgsl \
  --limit=50 \
  --freshness=1h
```

## Notes

- Do not pass `--set-env-vars OPENAI_API_KEY=...` in future deploy commands — that would expose the key in the Cloud Run config.
- `scripts/deploy.sh backend` is safe for normal redeploys because it does not set environment variables or secrets.
