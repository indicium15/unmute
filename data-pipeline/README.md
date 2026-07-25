# data-pipeline

Scrapes the [NTU SgSL Sign Bank](https://blogs.ntu.edu.sg/sgslsignbank/signs/) and builds the
`vocab.json` / `signs_metadata.json` files the backend loads from GCS at startup
(`sgsl_processed/`, see `docs/backend/GCS_SETUP.md`).

## Setup

```bash
cd data-pipeline
uv sync
```

## Usage (run from repo root)

```bash
# 1. Scrape sign GIFs + metadata into ./sgsl_dataset
uv run --project data-pipeline data-pipeline/scrape.py

# 2. Build vocab.json + signs_metadata.json into ./sgsl_processed
uv run --project data-pipeline data-pipeline/build_vocab_from_json.py --dataset sgsl_dataset --output sgsl_processed
```

`scrape.py` skips signs that already have a `metadata.json` in `sgsl_dataset/`; pass `--force` to
re-scrape everything.

Token alias overrides (e.g. `PLS` -> `PLEASE`) live in `aliases.json` and are merged into
`vocab.json` by `build_vocab_from_json.py`. Editing aliases only requires rebuilding and
re-uploading `vocab.json` — no backend redeploy needed.

## Publishing changes

Upload the resulting `sgsl_dataset/` and `sgsl_processed/` directories to GCS as described in
`docs/deploy/BACKEND_DEPLOYMENT.md` / `docs/backend/GCS_SETUP.md`:

```bash
gsutil -m -o "GSUtil:parallel_process_count=1" cp -r sgsl_dataset/ gs://kinnect-sgsl-datasets/sgsl_dataset/
gsutil -m -o "GSUtil:parallel_process_count=1" cp -r sgsl_processed/ gs://kinnect-sgsl-datasets/sgsl_processed/
```
