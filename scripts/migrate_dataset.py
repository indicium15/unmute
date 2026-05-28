#!/usr/bin/env python3
"""
One-off migration: convert old per-variant folders to new consolidated structure.

Old layout:
  sgsl_dataset/activity_a/activity_a.gif  + activity_a.json  + units/1.png
  sgsl_dataset/activity_-b/activity_-b.gif + activity_-b.json + units/1.png

New layout:
  sgsl_dataset/activity/primary.gif  + variant_b.gif  + metadata.json
  sgsl_dataset/activity/units/primary/1.png
  sgsl_dataset/activity/units/b/1.png

Old folders are left in place (harmless — vocab builder only reads metadata.json).
"""
import os
import re
import json
import shutil
import argparse
from collections import defaultdict

CATEGORY_SUFFIXES = re.compile(
    r'[_-](?:noun|verb|adjective|adverb|place|animal|food|medical|brand|job'
    r'|mathematics|numeral|calendar|symbol|season|colour|sign)$',
    re.IGNORECASE,
)

def parse_sign_label(raw_label):
    pos_match = re.search(r'\(([^)]+)\)', raw_label)
    pos = pos_match.group(1).strip() if pos_match else None
    clean_name = re.sub(r'\s*\([^)]+\)', '', raw_label).strip()
    core = CATEGORY_SUFFIXES.sub('', clean_name)
    sep_match = re.match(r'^(.{2,}?)[_-]+([a-e])$', core, re.IGNORECASE)
    if sep_match:
        base_sign = sep_match.group(1).rstrip('_-')
        variant_suffix = sep_match.group(2).lower()
    else:
        base_sign = core
        variant_suffix = None
    return clean_name, pos, base_sign, variant_suffix

def sanitize(name):
    return ''.join(c if c.isalnum() or c in '._-' else '_' for c in name.strip())

def assign_suffix(existing_suffixes, desired):
    """Return desired suffix if free, else assign next available letter."""
    if desired not in existing_suffixes:
        return desired
    for letter in 'abcdefghij':
        if letter not in existing_suffixes:
            return letter
    raise RuntimeError("Ran out of variant letters")

def migrate(dataset_dir, dry_run=False):
    # Group old folders by base sign; skip folders already in new format
    groups = defaultdict(list)
    for d in sorted(os.listdir(dataset_dir)):
        full = os.path.join(dataset_dir, d)
        if not os.path.isdir(full):
            continue
        if os.path.exists(os.path.join(full, 'metadata.json')):
            continue  # already migrated
        _, pos, base, suffix = parse_sign_label(d)
        base_clean = sanitize(base).lower()
        groups[base_clean].append((suffix, d, pos, full))

    old_folders_total = sum(len(v) for v in groups.values())
    print(f"Found {len(groups)} base signs ({old_folders_total} old folders) to migrate.")

    migrated = 0
    skipped = 0

    for base_name, entries in sorted(groups.items()):
        new_folder = os.path.join(dataset_dir, base_name)

        if os.path.exists(os.path.join(new_folder, 'metadata.json')):
            skipped += 1
            continue

        # Sort: explicit suffix first (None → ''), then alphabetically.
        # Primary = no variant suffix (empty string), or first alphabetically.
        entries.sort(key=lambda x: (x[0] is None, x[0] or ''))
        # Normalise None suffix → ''
        entries = [(s or '', d, pos, path) for s, d, pos, path in entries]

        # Resolve suffix collisions (e.g. allergy-food + allergy-medical both have suffix='')
        seen_suffixes: set = set()
        resolved = []
        for suffix, old_folder, pos, old_path in entries:
            final_suffix = assign_suffix(seen_suffixes, suffix)
            seen_suffixes.add(final_suffix)
            resolved.append((final_suffix, old_folder, pos, old_path))

        if dry_run:
            print(f"  [dry] {base_name}: {[s for s, _, _, _ in resolved]}")
            continue

        os.makedirs(new_folder, exist_ok=True)

        primary_pos = resolved[0][2]
        top_meta = {
            'base_sign': base_name,
            'part_of_speech': primary_pos,
            'description': None,
            'visual_guide': None,
            'translation_equivalents': None,
            'parameters': {},
            'variants': [],
        }

        for idx, (suffix, old_folder, _pos, old_path) in enumerate(resolved):
            is_primary = (idx == 0)
            units_sub = 'primary' if is_primary else suffix
            gif_filename = 'primary.gif' if is_primary else f'variant_{suffix}.gif'

            # Copy GIF
            old_gif = os.path.join(old_path, f'{old_folder}.gif')
            new_gif = os.path.join(new_folder, gif_filename)
            if os.path.exists(old_gif) and os.path.abspath(old_gif) != os.path.abspath(new_gif):
                shutil.copy2(old_gif, new_gif)

            # Copy units: old units/1.png → new units/{sub}/1.png
            old_units_dir = os.path.join(old_path, 'units')
            units_meta = []
            if os.path.isdir(old_units_dir):
                new_units_dir = os.path.join(new_folder, 'units', units_sub)
                os.makedirs(new_units_dir, exist_ok=True)
                for fname in sorted(os.listdir(old_units_dir)):
                    src = os.path.join(old_units_dir, fname)
                    dst = os.path.join(new_units_dir, fname)
                    if os.path.isfile(src) and os.path.abspath(src) != os.path.abspath(dst):
                        shutil.copy2(src, dst)
                        units_meta.append({
                            'step': fname,
                            'filename': os.path.join('units', units_sub, fname),
                        })

            # Load old json for metadata
            old_json = os.path.join(old_path, f'{old_folder}.json')
            old_meta = {}
            if os.path.exists(old_json):
                try:
                    with open(old_json, 'r', encoding='utf-8') as f:
                        old_meta = json.load(f)
                except Exception:
                    pass

            # Populate top-level fields from primary only
            if is_primary:
                top_meta['part_of_speech'] = old_meta.get('part_of_speech') or primary_pos
                # Old json used 'description_of_sign'; fall back to 'description'
                top_meta['description'] = (
                    old_meta.get('description_of_sign') or old_meta.get('description')
                )
                top_meta['visual_guide'] = old_meta.get('visual_guide')
                top_meta['translation_equivalents'] = old_meta.get('translation_equivalents')
                top_meta['parameters'] = old_meta.get('parameters', {})

            # Pull units from old json if filesystem units were absent
            if not units_meta and old_meta.get('units'):
                for u in old_meta['units']:
                    units_meta.append({
                        'step': u.get('step', ''),
                        'filename': u.get('filename', ''),
                    })

            top_meta['variants'].append({
                'label': None if is_primary else suffix,
                'gif_filename': gif_filename,
                'gif_url': old_meta.get('gif_url'),
                'units': units_meta,
            })

        with open(os.path.join(new_folder, 'metadata.json'), 'w', encoding='utf-8') as f:
            json.dump(top_meta, f, ensure_ascii=False, indent=2)

        migrated += 1
        if migrated % 100 == 0:
            print(f"  {migrated}/{len(groups)} migrated...")

    print(f"\nDone. Migrated: {migrated}, Skipped (already new): {skipped}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='../sgsl_dataset')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    migrate(os.path.abspath(args.dataset), args.dry_run)

if __name__ == '__main__':
    main()
