import os
import re
import time
import json
from urllib.parse import urlparse, quote, urljoin, unquote
import requests
from bs4 import BeautifulSoup
from collections import defaultdict
from tqdm import tqdm
from requests.adapters import HTTPAdapter, Retry

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL   = "https://blogs.ntu.edu.sg/sgslsignbank/signs/"
OUTPUT_DIR = "../sgsl_dataset"

# ——— 1) REQUESTS SESSION + RETRIES ———
session = requests.Session()
retries = Retry(
    total=5,
    backoff_factor=0.5,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"]
)
session.mount("https://", HTTPAdapter(max_retries=retries))
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
})

# ——— 2) SELENIUM SETUP ———
chrome_opts = Options()
chrome_opts.add_argument("--headless")
chrome_opts.add_argument("--disable-gpu")
chrome_opts.add_argument("--no-sandbox")
driver = webdriver.Chrome(options=chrome_opts)
wait = WebDriverWait(driver, 10)

# ——— 3) URL BUILDER ———
def build_sign_url(raw_href):
    full = urljoin(BASE_URL, raw_href)
    parsed = urlparse(full)
    if parsed.query:
        key, val = parsed.query.split("=", 1)
        val_enc = quote(val, safe="")
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{key}={val_enc}"
    return full

# ——— 4) SCRAPING HELPERS ———
def get_sign_links():
    driver.get(BASE_URL)
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "a.sign.btn.btn-red")))
    soup = BeautifulSoup(driver.page_source, "html.parser")
    raw_links = [a["href"] for a in soup.find_all("a", class_="sign btn btn-red")]
    return [build_sign_url(h) for h in raw_links]

def sanitize_filename(name):
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in name.strip())

CATEGORY_SUFFIXES = re.compile(
    r'[_-](?:noun|verb|adjective|adverb|place|animal|food|medical|brand|job'
    r'|mathematics|numeral|calendar|symbol|season|colour|sign)$',
    re.IGNORECASE
)

def parse_sign_label(raw_label):
    """
    Splits a raw sign label into its components.
    Returns (clean_name, part_of_speech, base_sign, variant_suffix)
    """
    pos_match = re.search(r'\(([^)]+)\)', raw_label)
    pos = pos_match.group(1).strip() if pos_match else None
    clean_name = re.sub(r'\s*\([^)]+\)', '', raw_label).strip()

    core = CATEGORY_SUFFIXES.sub('', clean_name)

    sep_match = re.match(r'^(.{2,}?)[_-]+([a-e])$', core, re.IGNORECASE)
    if sep_match:
        base_sign = sep_match.group(1).rstrip("_-")
        variant_suffix = sep_match.group(2).lower()
    else:
        base_sign = core
        variant_suffix = None

    return clean_name, pos, base_sign, variant_suffix

def base_name_from_raw(raw_label: str) -> str:
    """Derive the base folder name from a raw sign label (button value or img alt)."""
    _, _, base_sign, _ = parse_sign_label(raw_label)
    return sanitize_filename(base_sign).lower()

def base_name_from_url(url: str):
    """Derive the base folder name from a sign URL's query param."""
    parsed = urlparse(url)
    if not parsed.query:
        return None
    val = unquote(parsed.query.split("=", 1)[1])
    return base_name_from_raw(val)

# ——— 5) VARIANT DATA EXTRACTION ———
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

# ——— 6) SIGN SCRAPE (ALL VARIANTS INTO ONE FOLDER) ———
def scrape_sign(page_soup, base_name: str, variants_raw: list):
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

    # Parse each raw variant value and sort: no-suffix (primary) first, then a, b, c…
    parsed_variants = []
    for raw in variants_raw:
        _, pos, _, variant_suffix = parse_sign_label(raw)
        parsed_variants.append((variant_suffix or "", raw, pos))
    parsed_variants.sort(key=lambda x: x[0])  # "" < "a" < "b" < ...

    primary_pos = parsed_variants[0][2] if parsed_variants else None

    top_level_meta = {
        "base_sign": base_name,
        "part_of_speech": primary_pos,
        "description": None,
        "visual_guide": None,
        "translation_equivalents": None,
        "parameters": {},
        "variants": [],
    }

    for idx, (suffix, raw_var, _pos) in enumerate(parsed_variants):
        is_primary = (idx == 0)
        units_folder_name = "primary" if is_primary else suffix
        gif_filename = "primary.gif" if is_primary else f"variant_{suffix}.gif"

        section = page_soup.find("div", id=raw_var)
        variant_soup = BeautifulSoup(str(section), "html.parser") if section else page_soup

        vdata = _extract_variant_data(variant_soup)

        # Download GIF
        if vdata["gif_url"]:
            try:
                gif_bytes = session.get(vdata["gif_url"], timeout=10).content
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
                    img_data = session.get(img_src, timeout=10).content
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

    time.sleep(0.5)

# ——— 7) MAIN LOOP ———
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
            driver.get(url)
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.row[id]")))
            page_soup = BeautifulSoup(driver.page_source, "html.parser")

            group = page_soup.find("div", class_="btn-group-vertical")
            if group:
                variants_raw = [inp.get("value") for inp in group.find_all("input", class_="btn-check") if inp.get("value")]
            else:
                parsed = urlparse(url)
                variants_raw = [unquote(parsed.query.split("=", 1)[1])]

            base_name = base_name_from_raw(variants_raw[0]) if variants_raw else base_name_from_url(url)
            if not base_name:
                print(f"[!] Could not determine base name for {url}")
                continue

            try:
                scrape_sign(page_soup, base_name, variants_raw)
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
    driver.quit()


if __name__ == "__main__":
    main()
