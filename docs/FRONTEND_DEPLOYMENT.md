# Frontend Deployment Guide (Firebase Hosting)

## Prerequisites

- Google Cloud / Firebase project: `unmute-c9757` (same project as the backend)
- Node.js 20+ and npm (or another compatible package manager)
- `firebase-tools` installed globally: `npm install -g firebase-tools`
- A deployed backend URL (see [BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md)) — you will point the SPA at that API at **build time**

## One-time Setup

### 1. Authenticate Firebase CLI
```bash
firebase login
firebase use unmute-c9757
```

If the project is not linked locally yet:
```bash
firebase use --add
```
Select `unmute-c9757` and choose an alias (for example `default`).

### 2. Confirm hosting configuration

Hosting is configured at the repo root in `firebase.json`: the site serves static files from `frontend/dist` and rewrites all routes to `index.html` for the React SPA.

No extra Firebase Hosting setup is required unless you are creating a **new** Firebase project from scratch (in that case enable Hosting in the Firebase Console and run `firebase init hosting` once, matching `public` → `frontend/dist` and SPA rewrites).

### 3. Web app config (Firebase client SDK)

The app reads Firebase web config from `VITE_FIREBASE_*` variables (see [Environment variables](#environment-variables)). Get values from Firebase Console → Project settings → Your apps → Web app config, or from the snippet shown when you register a web app.

## Deploying

From the **repository root** (where `firebase.json` lives):

1. **Install dependencies and build** with production URLs and Firebase config set in the environment (Vite bakes these into the bundle):

```bash
cd frontend
npm ci
```

Create a production env file (do not commit secrets you consider sensitive; Firebase web API keys are client-exposed by design):

```bash
# Example: frontend/.env.production.local (gitignored) — or export vars inline for CI
```

Example **inline** build (replace placeholders with your real values):

```bash
VITE_API_BASE_URL=https://YOUR-CLOUD-RUN-URL \
VITE_FIREBASE_API_KEY=... \
VITE_FIREBASE_AUTH_DOMAIN=unmute-c9757.firebaseapp.com \
VITE_FIREBASE_PROJECT_ID=unmute-c9757 \
VITE_FIREBASE_STORAGE_BUCKET=... \
VITE_FIREBASE_MESSAGING_SENDER_ID=... \
VITE_FIREBASE_APP_ID=... \
npm run build
```

Use `https://` for `VITE_API_BASE_URL` when the site is served over HTTPS.

2. **Deploy Hosting**

```bash
cd ..   # back to repo root
firebase deploy --only hosting
```

After deploy, the CLI prints the Hosting URL(s). Use that URL in the browser to verify the app loads and talks to the backend.

## Redeploying after code changes

```bash
cd frontend && npm ci && npm run build
cd .. && firebase deploy --only hosting
```

Rebuild whenever you change code or any `VITE_*` value — Vite does not read env at runtime in the browser.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend HTTP API base URL (e.g. Cloud Run `https://...run.app`) |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (often `PROJECT_ID.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID (`unmute-c9757`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase default storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |

For local development and env file precedence, see [frontend/ENV_README.md](./frontend/ENV_README.md).

## Notes

- Never commit `.env`, `.env.local`, or `.env.production.local` if they contain values you want to keep private.
- `VITE_*` variables are embedded at **build** time; changing them requires a new `npm run build` and redeploy.
- Firebase Hosting serves the SPA; API keys in the client bundle are normal for Firebase web apps — protect resources with Firebase Security Rules and backend auth as appropriate.
