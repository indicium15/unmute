# Scripts

Utilities for building the sign-language vocabulary and preprocessing SGSL GIFs with MediaPipe (hands + pose). Run them from the **repository root** after installing the backend environment with `cd backend && uv sync`.

## `build_vocab_from_json.py`

Scans per-sign folders under a dataset root, reads each sign’s JSON metadata, derives canonical tokens, and writes `vocab.json` (`token_to_sign` / `sign_to_token`).

```bash
python scripts/build_vocab_from_json.py --dataset sgsl_dataset --output sgsl_processed
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--dataset` | `sgsl_dataset` | Root folder containing one subfolder per sign |
| `--output` | `sgsl_processed` | Directory where `vocab.json` is written |

## `preprocess_gifs_to_pkl.py`

Walks the dataset, runs MediaPipe Hands and Pose on each sign GIF, normalizes landmark sequences, and saves per-sign pickles under `output/landmarks_pkl/`. Also writes `meta.json` (e.g. global frame length `L_max`, sign list).

```bash
python scripts/preprocess_gifs_to_pkl.py --dataset sgsl_dataset --output sgsl_processed
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--dataset` | `sgsl_dataset` | Dataset root (subfolders with GIF + JSON) |
| `--output` | `sgsl_processed` | Output directory for pickles and `meta.json` |
| `--limit` | (none) | Process at most this many signs (smoke tests) |
| `--workers` | CPU count | Worker processes for parallel processing |

## `save_detection_gifs.py`

Runs the same style of detection on a **single** input GIF and writes **two** animated GIFs: hand landmarks and body/pose overlays (defaults: `<basename>_hands.gif` and `<basename>_body.gif` next to the input).

```bash
python scripts/save_detection_gifs.py path/to/sign.gif
python scripts/save_detection_gifs.py path/to/sign.gif -oh out/hands.gif -ob out/body.gif
```

| Argument | Description |
|----------|-------------|
| `input_gif` | Path to the source GIF (positional) |
| `-oh`, `--output-hand` | Hand-overlay GIF path (optional) |
| `-ob`, `--output-body` | Body-overlay GIF path (optional) |
| `-d`, `--duration` | Frame duration in ms (default: preserve input timings) |
