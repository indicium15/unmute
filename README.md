# Kinnect — Singapore Sign Language Translator

A web application that translates text and voice input into Singapore Sign Language (SgSL), rendered as sign GIFs. Built with FastAPI, React, and Azure OpenAI.

## Overview

Kinnect is an interactive sign language translator that bridges communication gaps by converting spoken/written language into SgSL sign sequences. The application supports text and voice input and includes a searchable sign dictionary and a structured Learn module with lessons and quizzes.

### Key Features

- **Text-to-Sign Translation**: Input text and get SgSL gloss tokens rendered as a sequence of sign GIFs
- **Voice-to-Sign Translation**: Record audio, transcribed in real time via Azure's realtime Whisper deployment, and automatically translated to sign language
- **Sign Dictionary**: Browse and search the full sign vocabulary, with per-sign detail pages
- **Learn Module**: Structured lessons (neighborhoods, food, colours, family, emotions, days/calendar) with progress tracking and quizzes
- **Auth & Admin**: Firebase-authenticated accounts with an approval/allowlist flow, plus an admin dashboard for logs, user management, and LLM token-usage/cost tracking
- **Feedback**: Thumbs up/down + comments on translations, logged for review

## Dataset

This project uses sign language data from the **Singapore Sign Language Sign Bank** maintained by Nanyang Technological University (NTU):

**Source**: [https://blogs.ntu.edu.sg/sgslsignbank/signs/](https://blogs.ntu.edu.sg/sgslsignbank/signs/)

## Tech Stack

### Backend
- **FastAPI** - Python web framework, dependencies managed with `uv`
- **Azure OpenAI** (`gpt-5.4-mini`) - Text-to-sign translation
- **Azure Realtime Whisper** - Voice transcription over a websocket
- **Firebase, Firestore** - Storage of users, allowlist, translation/feedback logs, lesson progress, token usage
- **Google Cloud Storage** - Sign GIFs, vocab, and landmark pickles
- **MediaPipe** - Hand/pose landmark extraction 

### Frontend
- **React 19** + **TypeScript**, built with **Vite**
- **Tailwind CSS 4** - Styling
- **Firebase** - Auth
- **Web Audio API** - Voice recording

## Setup Instructions

### Prerequisites

- Python 3.11 or 3.12
- [uv](https://docs.astral.sh/uv/)
- Node.js + npm
- An Azure OpenAI resource (chat deployment + a separate realtime Whisper deployment)
- A Firebase project for authentication 
- A GCS bucket for sign assets

### Installation

1. **Clone the repository**
   ```bash
   git clone github.com/Vshnv2001/Kinnect
   cd Kinnect
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   uv sync
   cd ..
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Set up environment variables**

   Create `backend/.env`:
   ```
   AUTH_ENABLED=true
   LLM_PROVIDER=azure
   AZURE_OPENAI_API_KEY=...
   AZURE_OPENAI_ENDPOINT=...
   AZURE_OPENAI_API_VERSION=2025-04-01-preview
   AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini
   AZURE_WHISPER_ENDPOINT=...
   AZURE_WHISPER_OPENAI_API_KEY=...
   AZURE_WHISPER_DEPLOYMENT=gpt-realtime-whisper
   GCS_BUCKET_NAME=kinnect-sgsl-datasets
   FIREBASE_SERVICE_ACCOUNT_JSON=...
   ```

   Create `frontend/.env`:
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

   Setting `AUTH_ENABLED=false` (backend) / `VITE_AUTH_ENABLED=false` (frontend) runs the app in open-access demo mode, bypassing Firebase auth.

### Running the Application

Backend and frontend run as separate servers in dev (there's a `dev.sh` tmux helper that starts both):

```bash
# Backend — from backend/
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Frontend — from frontend/
npm run dev
```

- Backend API: `http://localhost:8000`
- Frontend dev server: `http://localhost:5173`

Alternatively, run the backend with Docker Compose (`backend/docker-compose.yml`).

## Usage

### Text Translation Mode

1. Go to the Translate page and select the "Text" input mode
2. Type your text and submit
3. View the resulting gloss tokens and the sign GIF sequence

### Voice Translation Mode

1. Select the "Voice" input mode
2. Start recording, speak your message, then stop
3. Audio is transcribed in real time and translated to sign language

### API Endpoints

Selected endpoints (see `AGENTS.md` for the full list, including learning/admin routes):

- `GET /health` - Health check and vocabulary size
- `POST /api/translate` - Translate text to SgSL gloss tokens + render plan
  ```json
  {
    "text": "hello world",
    "language": "en"
  }
  ```
- `POST /api/transcribe` - Transcribe audio and optionally auto-translate
  ```json
  {
    "audio_data": "base64_encoded_audio",
    "mime_type": "audio/webm",
    "auto_translate": true
  }
  ```
- `GET /api/sign/{sign_name}/landmarks` - Pose landmark frames for a sign (unused by the current frontend)
- `GET /api/learning/signs` / `GET /api/learning/lessons` - Dictionary and Learn module data
- `POST /api/feedback` - Thumbs up/down + comment on a translation

Most endpoints expect `Authorization: Bearer <Firebase ID token>`; public pages use routes that tolerate anonymous access. See the Auth Flow section of `AGENTS.md` for details.

## Project Structure

```
Kinnect/
├── backend/
│   ├── app.py                 # FastAPI app: routes, CORS, rate limiting
│   ├── routers/                # auth, dictionary, lessons, translation route handlers
│   ├── models/                 # Pydantic models (auth, common, dictionary, gcp, lessons, translation)
│   ├── utils/                  # llm, gcp/GCS, dictionary, lessons, translation, auth, rate_limit helpers
│   ├── content/
│   │   ├── lessons/             # Lesson JSON definitions
│   │   └── tag_config.json      # Tag display colors
│   ├── scripts/
│   │   └── hand_embedder.py     # MediaPipe hand landmark extraction (offline use)
│   ├── pyproject.toml          # Backend Python dependencies for uv
│   └── uv.lock                 # Locked backend dependency graph
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Root component, path-based mode switching, auth gating
│   │   ├── components/          # TranslatePage, DictionaryPage, LearningPage, AdminPage, etc.
│   │   ├── hooks/                # useTranslation, useSignCatalog, useSignDetail, useVoiceRecording
│   │   ├── lib/                  # firebase.ts, categories.ts, utils.ts
│   │   └── contexts/             # AuthContext
│   └── package.json
├── data-pipeline/
│   ├── scrape.py                # Scrapes the NTU SgSL Sign Bank → sgsl_dataset/
│   ├── build_vocab_from_json.py # sgsl_dataset/ metadata → vocab.json + signs_metadata.json
│   ├── aliases.json             # Token alias overrides merged into vocab.json
│   └── pyproject.toml           # Own uv-managed dependencies (requests, beautifulsoup4, tqdm)
├── docs/                       # backend/, frontend/, deploy/ guides — see docs/README.md
├── dev.sh                      # tmux helper to run backend + frontend together
└── README.md                   # This file
```

## Data Storage (GCS)

- Bucket: `kinnect-sgsl-datasets` (env `GCS_BUCKET_NAME`)
- `sgsl_dataset/{SIGN_NAME}/{SIGN_NAME}.gif` - gifs used for translation, dictionary and learning
- `sgsl_processed/vocab.json` — token↔sign vocabulary, loaded at backend startup
- `sgsl_processed/signs_metadata.json` — per-sign description/parameters/variants/units
- `sgsl_processed/landmarks_pkl/{SIGN_NAME}.pkl` — pose/hand landmark frames (backs the unused landmarks endpoint)

## Deployment

- **Backend**: Google Cloud Run — see `docs/deploy/BACKEND_DEPLOYMENT.md`
- **Frontend**: Firebase Hosting — see `docs/deploy/FRONTEND_DEPLOYMENT.md`