# Frontend Setup (Local Development)

React 19 + TypeScript SPA built with Vite, Tailwind CSS 4, and Firebase Auth. This doc covers
local dev setup and environment variables; for shipping the built app, see
`docs/deploy/FRONTEND_DEPLOYMENT.md`.

## Prerequisites

- Node.js 20+ and npm

## Install & Run

```bash
cd frontend
npm install
npm run dev       # Dev server at http://localhost:5173
```

Other scripts:

```bash
npm run build      # Production build to dist/ (tsc -b && vite build)
npm run lint        # ESLint
npm run preview     # Preview a production build locally
npm run dev:cloud   # Dev server using --mode production (loads .env.production* instead of .env)
```

## Environment Variables

Create `frontend/.env` (gitignored). Only variables prefixed `VITE_` are exposed to client code
(Vite inlines them at build time — see `frontend/vite.config.ts`).

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_AUTH_ENABLED=true
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=kinnect-sgsl
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL the app calls for the backend API (see `src/lib/api.ts`). Defaults to `http://127.0.0.1:8000` if unset. |
| `VITE_AUTH_ENABLED` | Set to `false` to bypass frontend auth gating (demo/open-access mode) — should match the backend's `AUTH_ENABLED`. |
| `VITE_FIREBASE_*` | Firebase Web SDK config (`src/lib/firebase.ts`). Get values from Firebase Console → Project settings → Your apps → Web app config. These are client-exposed by design; that's normal for Firebase web apps — protect resources with Firebase Security Rules and backend auth, not by hiding these values. |

Vite env file precedence (highest to lowest): `.env.[mode].local` > `.env.[mode]` > `.env.local` >
`.env`. `npm run dev` uses mode `development`; `npm run build` and `npm run dev:cloud` use mode
`production`.

> **Testing against the deployed backend from a local frontend:** point `VITE_API_BASE_URL` at the
> Cloud Run URL to hit production data locally. If you also set `VITE_AUTH_ENABLED=false`, that
> bypasses all frontend auth gating — convenient for demos, but not representative of real
> logged-out behavior. For auth-sensitive testing, use the deployed frontend
> (`kinnect-sgsl.web.app`) directly instead, since its session persists via `localStorage` (reload
> alone won't produce a logged-out state — explicitly log out first).

## Project Structure

```
frontend/src/
├── App.tsx              # Root component; path-based mode switching (home/translate/dictionary/learn/admin/login), auth gating
├── components/          # TranslatePage, DictionaryPage, LearningPage, AdminPage, HomePage, LoginPage, VoiceRecorder, AppNavbar
│   ├── admin/            # Admin dashboard views
│   ├── learning/          # Lesson cards, quiz UI
│   └── signs/             # Sign detail cards
├── hooks/                # useTranslation, useSignCatalog, useSignDetail, useVoiceRecording
├── lib/
│   ├── api.ts             # API_BASE_URL + authHeaders() — Firebase ID token attached to backend requests
│   ├── firebase.ts        # Firebase app/auth init from VITE_FIREBASE_* vars
│   ├── categories.ts      # Tag color fallback palette
│   └── utils.ts
└── contexts/
    └── AuthContext.tsx    # Firebase auth state (user, token, login/logout, admin/approval status) + useAuth.ts
```

See `AGENTS.md` (repo root) for the full architecture, API endpoint list, and auth flow shared
with the backend.
