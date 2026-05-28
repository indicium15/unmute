import os
import glob
import json
import argparse
import re

def load_all_metadata(dataset_root):
    """Yields (folder_path, meta_dict) for all sign folders containing metadata.json."""
    for sd in sorted(glob.glob(os.path.join(dataset_root, "*"))):
        if not os.path.isdir(sd):
            continue
        meta_path = os.path.join(sd, "metadata.json")
        if not os.path.exists(meta_path):
            continue
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception as e:
            print(f"[!] Could not read {meta_path}: {e}")
            continue
        yield sd, meta

def canon_token(text):
    if not text:
        return ""
    t = text.upper()
    t = re.sub(r"[\s\-]+", "_", t)
    t = re.sub(r"[^A-Z0-9_]", "", t)
    return t

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="sgsl_dataset", help="Path to input dataset")
    parser.add_argument("--output", default="sgsl_processed", help="Path to output directory")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)

    token_to_sign = {}
    sign_to_token = {}
    signs_metadata = {}

    print("Building vocabulary...")
    count = 0

    for folder_path, meta in load_all_metadata(args.dataset):
        base_sign = meta.get("base_sign") or os.path.basename(folder_path)
        token = canon_token(base_sign)

        if not token:
            continue

        if token in token_to_sign and token_to_sign[token] != base_sign:
            print(f"[!] Token collision: '{token}' → '{token_to_sign[token]}' vs '{base_sign}', keeping first")
            continue

        token_to_sign[token] = base_sign
        sign_to_token[base_sign] = token

        # signs_metadata: summary with label + gif_filename only (no full unit data)
        variant_summaries = [
            {"label": v.get("label"), "gif_filename": v.get("gif_filename")}
            for v in meta.get("variants", [])
        ]
        signs_metadata[base_sign] = {
            "base_sign": base_sign,
            "part_of_speech": meta.get("part_of_speech"),
            "description": meta.get("description"),
            "variants": variant_summaries,
        }
        count += 1

    print(f"Mapped {count} signs. Unique tokens: {len(token_to_sign)}")

    vocab_path = os.path.join(args.output, "vocab.json")
    with open(vocab_path, "w", encoding="utf-8") as f:
        json.dump({"token_to_sign": token_to_sign, "sign_to_token": sign_to_token}, f, indent=2)
    print(f"Saved vocab to {vocab_path}")

    signs_meta_path = os.path.join(args.output, "signs_metadata.json")
    with open(signs_meta_path, "w", encoding="utf-8") as f:
        json.dump(signs_metadata, f, indent=2)
    print(f"Saved signs_metadata to {signs_meta_path}")

if __name__ == "__main__":
    main()
