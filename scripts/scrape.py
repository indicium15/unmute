import os
import re
import time
import json
import random
from urllib.parse import urlparse, quote, urljoin, unquote
import requests
from bs4 import BeautifulSoup
from collections import defaultdict
from tqdm import tqdm
from requests.adapters import HTTPAdapter, Retry

BASE_URL   = "https://blogs.ntu.edu.sg/sgslsignbank/signs/"
OUTPUT_DIR = "../sgsl_dataset"

# ——— RATE LIMITING ———
# The site is server-rendered (no JS needed), so we talk to it with plain
# requests instead of driving a browser. Since we now hit it far more
# cheaply/quickly than a Selenium session would, add a small randomized
# delay between every request so we don't hammer the server.
REQUEST_DELAY_MIN = 0.4
REQUEST_DELAY_MAX = 0.9

def polite_sleep():
    time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

# ——— 1) REQUESTS SESSION + RETRIES ———
session = requests.Session()
retries = Retry(
    total=5,
    backoff_factor=1.0,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"]
)
session.mount("https://", HTTPAdapter(max_retries=retries))
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
})

def fetch(url, **kwargs):
    """GET a URL, then politely wait before the next request."""
    resp = session.get(url, timeout=15, **kwargs)
    polite_sleep()
    return resp

# ——— 2) URL BUILDER ———
def build_sign_url(raw_href):
    full = urljoin(BASE_URL, raw_href)
    parsed = urlparse(full)
    if parsed.query:
        key, val = parsed.query.split("=", 1)
        val_enc = quote(val, safe="")
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{key}={val_enc}"
    return full

# ——— 3) SCRAPING HELPERS ———
def get_sign_links():
    resp = fetch(BASE_URL)
    soup = BeautifulSoup(resp.text, "html.parser")
    raw_links = [a["href"] for a in soup.find_all("a", class_="sign btn btn-red")]
    return [build_sign_url(h) for h in raw_links if urlparse(urljoin(BASE_URL, h)).query]

def sanitize_filename(name):
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in name.strip())

CATEGORY_SUFFIXES = re.compile(
    r'[_-](?:noun|verb|adjective|adverb|place|animal|food|medical|brand|job'
    r'|mathematics|numeral|calendar|symbol|season|colour|sign)$',
    re.IGNORECASE
)

def parse_single_label(raw_label):
    """
    Splits a raw (ungrouped) sign label into its components.
    Returns (clean_name, part_of_speech, base_sign).
    Used for the entry-point label (e.g. "Account (Noun)") and for signs
    that have no sibling variants on the page.
    """
    pos_match = re.search(r'\(([^)]+)\)', raw_label)
    pos = pos_match.group(1).strip() if pos_match else None
    clean_name = re.sub(r'\s*\([^)]+\)', '', raw_label).strip()
    base_sign = CATEGORY_SUFFIXES.sub('', clean_name)
    return clean_name, pos, base_sign

def base_name_from_url(url):
    """Derive the base folder name from a sign URL's query param (fallback path)."""
    parsed = urlparse(url)
    if not parsed.query:
        return None
    val = unquote(parsed.query.split("=", 1)[1])
    _, _, base_sign = parse_single_label(val)
    return sanitize_filename(base_sign).lower()

def group_variants(variants_raw):
    """
    Given the raw `value` strings of all sibling variant buttons for one
    word (e.g. ["bigfive", "bigb"], ["activity_a", "activity_-b"]), derive
    the shared base name and each variant's suffix.

    The site does not use a consistent delimiter or suffix length between
    the base word and its variant marker (some use "_a"/"-b", others glue
    a full descriptive word straight on like "five"/"bent"/"ext"), so we
    can't regex-strip a suffix from a single label in isolation. Instead we
    use the longest common prefix across all sibling values, which is
    reliable because every variant on a word's page shares the same root
    word by construction.

    Returns (base_name, [(suffix, raw_value), ...]) sorted primary-first.
    """
    values = [v.lower() for v in variants_raw]

    if len(values) == 1:
        base = CATEGORY_SUFFIXES.sub('', values[0]).rstrip('_-')
        return sanitize_filename(base).lower(), [("", values[0])]

    lcp = os.path.commonprefix(values).rstrip('_-')
    lcp = CATEGORY_SUFFIXES.sub('', lcp)
    base = sanitize_filename(lcp).lower()

    pairs = []
    for raw, orig in zip(values, variants_raw):
        suffix = raw[len(lcp):].lstrip('_-')
        if not suffix:
            suffix = ""  # this variant *is* the base/primary form
        pairs.append((suffix, orig))

    pairs.sort(key=lambda x: x[0])  # "" (primary) sorts before "a", "b", "five", ...
    return base, pairs

# ——— 4) VARIANT DATA EXTRACTION ———
def _extract_variant_data(soup):
    """
    Extract all content from a variant section soup.
    Returns a dict with gif_url, description, visual_guide, translation_equivalents,
    parameters, and raw_units [(img_src, step_text), ...].
    """
    img_tag = soup.find("img", class_="w-100 img-fluid mb-2")
    gif_url = img_tag["src"].strip() if img_tag else None

    data = {
        "gif_url": gif_url,
        "description": None,
        "visual_guide": None,
        "translation_equivalents": None,
        "parameters": {},
        "raw_units": [],
    }

    for label in ["Description of Sign", "Visual Guide", "Translation Equivalents"]:
        header = soup.find("h2", class_="h5 fw-bold", string=label)
        if header:
            p = header.find_next_sibling("p")
            if p:
                key = label.lower().replace(" ", "_")
                data[key] = p.get_text(strip=True)

    params_h2 = soup.find("h2", class_="h5 mb-4 fw-bold", string="Parameters of Sign")
    if params_h2:
        table = params_h2.find_next("table")
        if table:
            for row in table.find("tbody").find_all("tr"):
                key = row.find("th").get_text(strip=True)
                cells = row.find_all("td")
                if len(cells) == 2:
                    dom  = cells[0].get_text(strip=True)
                    nond = cells[1].get_text(strip=True)
                elif len(cells) == 1:
                    dom = nond = cells[0].get_text(strip=True)
                else:
                    continue
                data["parameters"][key] = {"Dominant Hand": dom, "Non-Dominant Hand": nond}

    units_h2 = soup.find("h2", class_="h5 mb-4 fw-bold", string="Units of Sign")
    if units_h2:
        ul = units_h2.find_next("ul")
        if ul:
            urls_attr = ul.get("urls")
            urls = [u.strip() for u in urls_attr.split(",")] if urls_attr else [img["src"].strip() for img in ul.find_all("img")]
            li_tags = ul.find_all("li", class_="list-inline-item")
            for idx, img_src in enumerate(urls, start=1):
                step_txt = None
                if li_tags and len(li_tags) >= idx:
                    p = li_tags[idx - 1].find("p", class_="text-center")
                    step_txt = p.get_text(strip=True) if p else None
                data["raw_units"].append((img_src, step_txt or f"Step {idx}"))

    return data

# ——— 5) SIGN SCRAPE (ALL VARIANTS INTO ONE FOLDER) ———
def scrape_sign(page_soup, base_name: str, variant_pairs: list, entry_pos: str):
    """
    Scrape all variants of a sign into a single folder named base_name.

    Folder layout:
      {base_name}/metadata.json
      {base_name}/primary.gif
      {base_name}/variant_b.gif   (only when >1 variant)
      {base_name}/units/primary/1.png
      {base_name}/units/b/1.png
    """
    folder = os.path.join(OUTPUT_DIR, base_name)
    os.makedirs(folder, exist_ok=True)

    top_level_meta = {
        "base_sign": base_name,
        "part_of_speech": entry_pos,
        "description": None,
        "visual_guide": None,
        "translation_equivalents": None,
        "parameters": {},
        "variants": [],
    }

    for idx, (suffix, raw_var) in enumerate(variant_pairs):
        is_primary = (idx == 0)
        units_folder_name = "primary" if is_primary else suffix
        gif_filename = "primary.gif" if is_primary else f"variant_{suffix}.gif"

        section = page_soup.find("div", id=raw_var)
        variant_soup = BeautifulSoup(str(section), "html.parser") if section else page_soup

        vdata = _extract_variant_data(variant_soup)

        # Download GIF
        if vdata["gif_url"]:
            try:
                gif_bytes = fetch(vdata["gif_url"]).content
                with open(os.path.join(folder, gif_filename), "wb") as f:
                    f.write(gif_bytes)
            except Exception as e:
                print(f"[!] GIF download failed for {base_name}/{gif_filename}: {e}")

        # Download unit images
        units_meta = []
        if vdata["raw_units"]:
            units_subfolder = os.path.join(folder, "units", units_folder_name)
            os.makedirs(units_subfolder, exist_ok=True)
            for unit_idx, (img_src, step_txt) in enumerate(vdata["raw_units"], start=1):
                ext = os.path.splitext(urlparse(img_src).path)[1] or ".png"
                fname = f"{unit_idx}{ext}"
                try:
                    img_data = fetch(img_src).content
                    with open(os.path.join(units_subfolder, fname), "wb") as f:
                        f.write(img_data)
                except Exception as e:
                    print(f"[!] Unit image download failed for {base_name}: {e}")
                units_meta.append({
                    "step": step_txt,
                    "filename": os.path.join("units", units_folder_name, fname),
                })

        # Populate top-level fields from primary variant
        if is_primary:
            top_level_meta["description"] = vdata["description"]
            top_level_meta["visual_guide"] = vdata["visual_guide"]
            top_level_meta["translation_equivalents"] = vdata["translation_equivalents"]
            top_level_meta["parameters"] = vdata["parameters"]

        top_level_meta["variants"].append({
            "label": None if is_primary else suffix,
            "gif_filename": gif_filename,
            "gif_url": vdata["gif_url"],
            "units": units_meta,
        })

    with open(os.path.join(folder, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(top_level_meta, f, ensure_ascii=False, indent=2)

# ——— 6) MAIN LOOP ———
def main():
    import argparse
    parser = argparse.ArgumentParser(description="Scrape SgSL sign bank")
    parser.add_argument("--force", action="store_true", help="Re-scrape all signs, ignoring already-downloaded")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    links = get_sign_links()
    print(f"Found {len(links)} words on site.")

    total_skipped = 0
    total_downloaded = 0
    failed_downloads = defaultdict(list)

    # Pre-filter: skip URLs whose base sign folder already has metadata.json
    pending_links = []
    if args.force:
        print("--force: skipping cache, re-scraping everything.")
        pending_links = links
    else:
        for url in links:
            base = base_name_from_url(url)
            meta_path = os.path.join(OUTPUT_DIR, base, "metadata.json") if base else None
            if meta_path and os.path.exists(meta_path):
                total_skipped += 1
            else:
                pending_links.append(url)
        print(f"Pre-filtered: {total_skipped} already scraped, {len(pending_links)} to download.")

    for url in tqdm(pending_links, desc="Downloading signs"):
        try:
            resp = fetch(url)
            page_soup = BeautifulSoup(resp.text, "html.parser")

            parsed = urlparse(url)
            entry_raw_label = unquote(parsed.query.split("=", 1)[1])
            _, entry_pos, _ = parse_single_label(entry_raw_label)

            group = page_soup.find("div", class_="btn-group-vertical")
            if group:
                # Button `value` attributes can contain literal percent-encoded
                # text for special characters (e.g. "april-fools%e2%80%99-day"),
                # so unquote them before using them as sign labels.
                variants_raw = [unquote(inp.get("value")) for inp in group.find_all("input", class_="btn-check") if inp.get("value")]
            else:
                variants_raw = [entry_raw_label]

            if not variants_raw:
                print(f"[!] No variants found for {url}")
                continue

            base_name, variant_pairs = group_variants(variants_raw)
            if not base_name:
                print(f"[!] Could not determine base name for {url}")
                continue

            try:
                scrape_sign(page_soup, base_name, variant_pairs, entry_pos)
                total_downloaded += 1
            except Exception as ve:
                failed_downloads[url].append(base_name)
                print(f"[✗] Sign failed: {url} ({base_name}) → {type(ve).__name__}: {ve}")

        except Exception as e:
            failed_downloads[url].append("base")
            print(f"[✗] URL failed: {url} → {type(e).__name__}: {e}")

    print("\n✅ Download complete.")
    print(f"Skipped (already scraped): {total_skipped}")
    print(f"Newly downloaded: {total_downloaded}")
    print(f"Failed URLs: {len(failed_downloads)}")
    if failed_downloads:
        print("Failed details:")
        for u, vs in failed_downloads.items():
            print(f" - {u} → {vs}")


if __name__ == "__main__":
    main()
