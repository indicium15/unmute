# Gemini API Key Rotation

Use this guide when the Gemini API key has been exposed, depleted, revoked, or needs routine rotation.

## Summary

The backend reads `GEMINI_API_KEY` from the environment. In production, Cloud Run should populate that environment variable from Google Secret Manager, not from a literal plaintext value.

After Cloud Run is configured with `--set-secrets GEMINI_API_KEY=gemini-api-key:latest`, normal backend redeploys preserve the secret binding. You do not need to update `scripts/deploy.sh` for routine key rotation.

## Prerequisites

- Access to Google AI Studio for creating a new Gemini API key
- `gcloud` installed and authenticated
- Permission to manage Secret Manager secrets and Cloud Run services in `unmute-c9757`

```bash
gcloud config set project unmute-c9757
gcloud services enable secretmanager.googleapis.com
```

## First-Time Secret Manager Setup

If the `gemini-api-key` secret does not exist yet, create it. Run the first command, paste the new Gemini API key when the terminal waits silently, then press Enter.

```bash
read -s GEMINI_API_KEY
printf "%s" "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
unset GEMINI_API_KEY
```

Grant the Cloud Run runtime service account permission to read the secret:

```bash
SERVICE_ACCOUNT=$(gcloud run services describe unmute-backend \
  --region asia-southeast1 \
  --format='value(spec.template.spec.serviceAccountName)')

gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

Bind the secret to the `GEMINI_API_KEY` environment variable in Cloud Run:

```bash
gcloud run services update unmute-backend \
  --region asia-southeast1 \
  --remove-env-vars GEMINI_API_KEY \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

## Rotating an Existing Key

Create a new API key in Google AI Studio. Do not paste it into chat, docs, commits, or command history.

Add it as a new Secret Manager version:

```bash
read -s GEMINI_API_KEY
printf "%s" "$GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
unset GEMINI_API_KEY
```

Restart Cloud Run so instances pick up the latest secret version:

```bash
gcloud run services update unmute-backend \
  --region asia-southeast1 \
  --update-labels secret-refresh="$(date +%Y%m%d%H%M%S)"
```

Then revoke or delete the old Gemini API key in Google AI Studio.

## Verification

Confirm Cloud Run references Secret Manager instead of showing the raw key:

```bash
gcloud run services describe unmute-backend \
  --region asia-southeast1 \
  --format='yaml(spec.template.spec.containers[0].env)'
```

Expected result: `GEMINI_API_KEY` should use a `valueFrom.secretKeyRef` entry. It should not show a plaintext `value`.

Test the deployed backend from the frontend translate page. If translation still fails, inspect Cloud Run logs:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="unmute-backend" AND (textPayload:"Gemini" OR textPayload:"/api/translate" OR httpRequest.requestUrl:"/api/translate")' \
  --project unmute-c9757 \
  --limit=50 \
  --freshness=1h
```

## Notes

- If Gemini returns `429 RESOURCE_EXHAUSTED` with a message about depleted prepayment credits, key rotation alone will not fix it. Add credits or update billing in Google AI Studio.
- Do not pass `--set-env-vars GEMINI_API_KEY=...` in future deploy commands. That would reintroduce the plaintext key into the Cloud Run service config.
- `scripts/deploy.sh backend` is safe for normal redeploys because it does not set backend environment variables or secrets.
