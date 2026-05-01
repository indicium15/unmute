#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-unmute-c9757}"
REGION="${REGION:-asia-southeast1}"
BACKEND_SERVICE="${BACKEND_SERVICE:-unmute-backend}"
BACKEND_IMAGE="${BACKEND_IMAGE:-gcr.io/${PROJECT_ID}/${BACKEND_SERVICE}}"
BACKEND_MEMORY="${BACKEND_MEMORY:-1Gi}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<EOF
Usage: scripts/deploy.sh <frontend|backend|both>

Deploy targets:
  frontend   Build frontend and deploy Firebase Hosting
  backend    Build backend image and redeploy Cloud Run
  both       Deploy backend, then frontend

Optional environment overrides:
  PROJECT_ID=${PROJECT_ID}
  REGION=${REGION}
  BACKEND_SERVICE=${BACKEND_SERVICE}
  BACKEND_IMAGE=${BACKEND_IMAGE}
  BACKEND_MEMORY=${BACKEND_MEMORY}
  SKIP_NPM_CI=1      Skip npm ci before frontend build

Notes:
  - Frontend VITE_* values are baked into the bundle at build time.
    Put production values in frontend/.env.production.local or export them before running.
  - Backend deploy preserves the existing Cloud Run service environment and secrets.
    The backend image installs Python dependencies with uv from backend/pyproject.toml.
    Use the full command in docs/BACKEND_DEPLOYMENT.md for first-time setup.
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

deploy_frontend() {
  require_command npm
  require_command firebase

  echo "==> Building frontend"
  cd "${ROOT_DIR}/frontend"

  if [[ "${SKIP_NPM_CI:-0}" != "1" ]]; then
    npm ci
  fi

  npm run build

  echo "==> Deploying Firebase Hosting"
  cd "${ROOT_DIR}"
  firebase deploy --only hosting
}

deploy_backend() {
  require_command gcloud

  echo "==> Building backend image: ${BACKEND_IMAGE}"
  cd "${ROOT_DIR}/backend"
  gcloud builds submit --tag "${BACKEND_IMAGE}" .

  echo "==> Deploying Cloud Run service: ${BACKEND_SERVICE}"
  gcloud run deploy "${BACKEND_SERVICE}" \
    --image "${BACKEND_IMAGE}" \
    --platform managed \
    --region "${REGION}" \
    --memory "${BACKEND_MEMORY}" \
    --project "${PROJECT_ID}"
}

main() {
  if [[ $# -ne 1 ]]; then
    usage
    exit 1
  fi

  case "$1" in
    frontend)
      deploy_frontend
      ;;
    backend)
      deploy_backend
      ;;
    both)
      deploy_backend
      deploy_frontend
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "Unknown deploy target: $1" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
