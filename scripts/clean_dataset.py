"""
Consolidate legacy per-sign folders into the current metadata.json/variants
folder layout produced by scrape.py.

Background: the dataset accumulated three folder shapes over time:
  - "new"    : {base}/metadata.json + primary.gif (+ variant_*.gif) + units/
  - "legacy" : {name}/{name}.json + {name}.gif + pose.pkl
  - "mixed"  : both sets of files living in the same folder

Legacy folders were named with whatever suffix convention an older scraper
used (e.g. "account-noun", "after_a", "bigb"), which frequently does not
match the base name the current scraper computes (e.g. "account", "after",
"big"). Naively deleting legacy folders would silently drop pose.pkl
(MediaPipe landmark data used by sign_seq.py to animate the avatar) for any
sign whose new-format counterpart hasn't had its landmarks re-extracted yet.

This script matches legacy folders to their canonical new-format folder by
gif_url (a stable identifier present in both the legacy per-sign JSON and
the new metadata.json's variants[]), migrates pose.pkl into the canonical
folder under the matching variant's naming convention (pose.pkl for the
primary variant, pose_<suffix>.pkl otherwise), and only then removes the
stale legacy files. Anything that can't be matched is left untouched and
reported for manual review.
"""
import os
import json
import shutil
import filecmp
import argparse

DATASET_DIR = os.path.join(os.path.dirname(__file__), "..", "sgsl_dataset")


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def build_gif_url_index(dataset_dir):
    """Map gif_url -> (folder_name, pose_filename) for every variant in
    every new-format (metadata.json) folder."""
    index = {}
    for name in sorted(os.listdir(dataset_dir)):
        folder = os.path.join(dataset_dir, name)
        meta_path = os.path.join(folder, "metadata.json")
        if not os.path.isfile(meta_path):
            continue
        meta = load_json(meta_path)
        if not meta:
            continue
        for variant in meta.get("variants", []):
            gif_url = variant.get("gif_url")
            if not gif_url:
                continue
            label = variant.get("label")
            pose_filename = "pose.pkl" if label is None else f"pose_{label}.pkl"
            index[gif_url] = (name, pose_filename)
    return index


def find_legacy_folders(dataset_dir):
    """Folders containing a legacy {name}.json and/or pose.pkl."""
    legacy = []
    for name in sorted(os.listdir(dataset_dir)):
        folder = os.path.join(dataset_dir, name)
        if not os.path.isdir(folder):
            continue
        files = os.listdir(folder)
        own_json = f"{name}.json"
        has_legacy_json = own_json in files
        has_pkl = "pose.pkl" in files
        if has_legacy_json or has_pkl:
            legacy.append((name, folder, files, has_legacy_json, has_pkl))
    return legacy


def folder_gif_urls(dataset_dir, name):
    meta = load_json(os.path.join(dataset_dir, name, "metadata.json"))
    if not meta:
        return set()
    return {v.get("gif_url") for v in meta.get("variants", []) if v.get("gif_url")}


def find_orphan_new_format_duplicates(dataset_dir):
    """
    Folders left over from before the variant-grouping fix in scrape.py: the
    old scraper couldn't strip an undelimited variant suffix (e.g. "bigb",
    "jealousclaw"), so it wrote them out as their own top-level metadata.json
    folders instead of merging into the correct base folder ("big",
    "jealous"). These are folder-name-prefix matches (long name starts with
    a shorter existing folder's name, no separator, alphabetic tail) that
    also share at least one gif_url with that shorter folder - the shared
    gif_url is what rules out coincidental word prefixes like "do"/"doctor".

    Returns (base, orphan, extra_gif_urls) for every such pair, where
    extra_gif_urls is whatever's in the orphan but NOT already in the base
    (empty if the orphan is a pure duplicate, safe to delete outright).
    """
    dirs = [d for d in os.listdir(dataset_dir)
            if os.path.isfile(os.path.join(dataset_dir, d, "metadata.json"))]
    cache = {d: folder_gif_urls(dataset_dir, d) for d in dirs}

    pairs = []
    for d in dirs:
        for other in dirs:
            if other == d or len(other) >= len(d):
                continue
            tail = d[len(other):]
            if d.startswith(other) and tail.isalpha() and tail.islower():
                if cache[d] & cache[other]:
                    pairs.append((other, d, cache[d] - cache[other]))
    return pairs


def main():
    parser = argparse.ArgumentParser(description="Consolidate legacy sign folders into the current format")
    parser.add_argument("--dry-run", action="store_true", help="Report what would happen without changing anything")
    args = parser.parse_args()

    dataset_dir = os.path.abspath(DATASET_DIR)
    print(f"Dataset dir: {dataset_dir}")

    gif_index = build_gif_url_index(dataset_dir)
    print(f"Indexed {len(gif_index)} gif_urls across new-format folders.\n")

    legacy_folders = find_legacy_folders(dataset_dir)
    print(f"Found {len(legacy_folders)} folders with legacy files.\n")

    migrated = []
    unmatched = []
    conflicts = []
    deleted_dirs = []
    cleaned_mixed = []

    for name, folder, files, has_legacy_json, has_pkl in legacy_folders:
        is_new_format = "metadata.json" in files  # "mixed" folder

        gif_url = None
        if has_legacy_json:
            legacy_meta = load_json(os.path.join(folder, f"{name}.json"))
            gif_url = (legacy_meta or {}).get("gif_url")

        target = gif_index.get(gif_url) if gif_url else None

        if has_pkl:
            if target is None:
                unmatched.append((name, gif_url))
                continue
            target_name, pose_filename = target
            target_folder = os.path.join(dataset_dir, target_name)
            dest = os.path.join(target_folder, pose_filename)
            src = os.path.join(folder, "pose.pkl")
            if os.path.exists(dest):
                # Something is already at the destination. Only treat this as
                # "already migrated" if it's byte-identical to our source -
                # otherwise this folder's pose.pkl would be silently deleted
                # without ever having been copied. Leave both folders intact
                # and flag for manual review instead.
                if not filecmp.cmp(src, dest, shallow=False):
                    conflicts.append((name, target_name, pose_filename))
                    continue
            else:
                print(f"[pose.pkl] {name}/pose.pkl -> {target_name}/{pose_filename}")
                if not args.dry_run:
                    shutil.copy2(src, dest)
                migrated.append((name, target_name, pose_filename))

        # Remove the legacy artifacts now that anything unique has been migrated.
        legacy_files_to_remove = [f for f in files if f not in ("metadata.json", "primary.gif", "units") and not f.startswith("variant_")]
        if is_new_format:
            # Mixed folder: strip the legacy files, keep the folder.
            if not args.dry_run:
                for f in legacy_files_to_remove:
                    p = os.path.join(folder, f)
                    if os.path.isdir(p):
                        shutil.rmtree(p)
                    else:
                        os.remove(p)
            cleaned_mixed.append(name)
        else:
            # Legacy-only folder: safe to delete entirely once pose.pkl (if any) is migrated.
            if has_pkl and target is None:
                # pose.pkl couldn't be migrated - don't delete, needs manual review.
                continue
            if not args.dry_run:
                shutil.rmtree(folder)
            deleted_dirs.append(name)

    print("\n--- Summary ---")
    print(f"pose.pkl migrated: {len(migrated)}")
    print(f"Legacy-only folders deleted: {len(deleted_dirs)}")
    print(f"Mixed folders cleaned (legacy files stripped, folder kept): {len(cleaned_mixed)}")
    print(f"Unmatched (left untouched, needs manual review): {len(unmatched)}")
    if unmatched:
        for name, gif_url in unmatched:
            print(f"  - {name} (gif_url={gif_url})")
    print(f"Conflicts - dest pose.pkl exists and differs (left untouched, needs manual review): {len(conflicts)}")
    if conflicts:
        for name, target_name, pose_filename in conflicts:
            print(f"  - {name}/pose.pkl vs {target_name}/{pose_filename}")

    print("\n--- Phase 2: orphaned new-format duplicate folders ---")
    orphan_pairs = find_orphan_new_format_duplicates(dataset_dir)
    orphan_deleted = []
    orphan_flagged = []
    for base, orphan, extra in orphan_pairs:
        orphan_folder = os.path.join(dataset_dir, orphan)
        orphan_files = os.listdir(orphan_folder)
        has_unresolved_legacy = f"{orphan}.json" in orphan_files or "pose.pkl" in orphan_files
        if extra:
            orphan_flagged.append((base, orphan, extra))
        elif has_unresolved_legacy:
            # Phase 1 left legacy artifacts here on purpose (conflict/unmatched,
            # still pending manual review) - deleting the folder would destroy
            # them without ever migrating them. Flag instead of deleting.
            orphan_flagged.append((base, orphan, {"unresolved legacy files": orphan_files}))
        else:
            print(f"[dupe] {orphan}/ fully contained in {base}/ -> deleting {orphan}/")
            if not args.dry_run:
                shutil.rmtree(orphan_folder)
            orphan_deleted.append(orphan)

    print(f"\nOrphan duplicates deleted: {len(orphan_deleted)}")
    print(f"Orphan pairs with an extra gif_url (left untouched, needs manual review): {len(orphan_flagged)}")
    for base, orphan, extra in orphan_flagged:
        print(f"  - {orphan} has gif_url(s) not in {base}: {extra}")

    if args.dry_run:
        print("\n(dry run - no files were changed)")


if __name__ == "__main__":
    main()
