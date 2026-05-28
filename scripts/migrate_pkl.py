#!/usr/bin/env python3
"""
Copy primary-variant PKL files to the new base-sign naming convention.

Old: activity_a.pkl, activity_a_full_body_pose.pkl
New: activity.pkl,   activity_full_body_pose.pkl

Only the primary variant (lowest suffix alphabetically) is kept.
Already-correctly-named files (e.g. abuse.pkl → abuse.pkl) are no-ops.
"""
import os
import re
import shutil
import argparse
from collections import defaultdict

CATEGORY_SUFFIXES = re.compile(
    r'[_-](?:noun|verb|adjective|adverb|place|animal|food|medical|brand|job'
    r'|mathematics|numeral|calendar|symbol|season|colour|sign)$',
    re.IGNORECASE,
)

def parse_sign_label(raw_label):
    clean_name = re.sub(r'\s*\([^)]+\)', '', raw_label).strip()
    core = CATEGORY_SUFFIXES.sub('', clean_name)
    sep_match = re.match(r'^(.{2,}?)[_-]+([a-e])$', core, re.IGNORECASE)
    if sep_match:
        return sep_match.group(1).rstrip('_-'), sep_match.group(2).lower()
    return core, None

def sanitize(name):
    return ''.join(c if c.isalnum() or c in '._-' else '_' for c in name.strip())

def migrate_pkls(pkl_dir, dry_run=False):
    # Group files by (base_sign, is_pose)
    groups = defaultdict(list)
    for f in sorted(os.listdir(pkl_dir)):
        if not f.endswith('.pkl'):
            continue
        is_pose = f.endswith('_full_body_pose.pkl')
        stem = f[:-len('_full_body_pose.pkl')] if is_pose else f[:-len('.pkl')]
        base, suffix = parse_sign_label(stem)
        base_clean = sanitize(base).lower()
        groups[(base_clean, is_pose)].append((suffix or '', f))

    copied = 0
    already_ok = 0
    skipped_collision = 0

    for (base_name, is_pose), entries in sorted(groups.items()):
        # Sort: empty suffix first (primary), then a, b, c
        entries.sort(key=lambda x: x[0])
        _, primary_file = entries[0]

        suffix_str = '_full_body_pose' if is_pose else ''
        new_name = f'{base_name}{suffix_str}.pkl'
        src = os.path.join(pkl_dir, primary_file)
        dst = os.path.join(pkl_dir, new_name)

        if os.path.abspath(src) == os.path.abspath(dst):
            already_ok += 1
            continue

        if dry_run:
            print(f'  [dry] {primary_file} → {new_name}')
            copied += 1
            continue

        shutil.copy2(src, dst)
        copied += 1
        if copied % 200 == 0:
            print(f'  {copied} PKLs copied...')

    print(f'\nDone. Copied: {copied}, Already correct name: {already_ok}')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pkl-dir', default='../sgsl_processed/landmarks_pkl')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    migrate_pkls(os.path.abspath(args.pkl_dir), args.dry_run)

if __name__ == '__main__':
    main()
