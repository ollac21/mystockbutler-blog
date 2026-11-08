#!/usr/bin/env python3
"""Analyst recommendations for the public stock pages (SEO row 1, 2026-11-07).

For every company file in gs://<bucket>/library/public-pages/<slug>.json this asks FMP (the licensed price feed the chain
already uses) three questions (and one more for the estimates' currency) and writes ONE small file per company:

    library/public-pages/analysts/<slug>.json
      grades-consensus        -> rating (FMP's word) + the counts strong buy / buy / hold / sell / strong sell
      price-target-consensus  -> the average, high, low and median target
      analyst-estimates       -> the next two fiscal years' average EPS and revenue, with the number of analysts

A ticker FMP has nothing for gets no file. Nothing here is a MyStockButler opinion; every field is FMP's, copied.
`as_of` is the UTC moment of OUR fetch (FMP dates none of the three answers); the blog draws the block only while it is
recent. This script touches no chain step.

Run by hand (secrets only through the env script, in the SAME command; the key is never printed):
    source scripts/local_env_from_gcloud.sh && python3 scripts/public_pages_analysts.py \\
        --out-dir /tmp/analysts [--upload] [--only nvda,jpm] [--pages-dir DIR]

--upload copies the files to gs://<bucket>/library/public-pages/analysts/ (the durable store). The blog build reads
them from its own data/stocks/analysts/ (copy the out dir there and commit).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from research_engine.v4.fmp_market_provider import FMP_BASE_URL, _clean_symbol  # the one outbound symbol seam

BUCKET = "gs://project-42fe84df-9d99-41ef-897-a100-openclaw-mvp/library/public-pages"
SCHEMA = "public_analysts_v1"
WORKERS = 4
RETRIES = 4


def _num(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _get(endpoint: str, params: dict, key: str):
    """One FMP stable call; a 429 or 5xx is asked again after 2, 4, 8, 16 s; anything else is 'no data'."""
    query = "&".join(f"{k}={v}" for k, v in params.items())
    request = urllib.request.Request(
        f"{FMP_BASE_URL}/{endpoint}?{query}",
        headers={"Accept": "application/json", "User-Agent": "mystockbutler-analysts/1", "apikey": key},
    )
    for attempt in range(RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = json.loads(response.read().decode("utf-8"))
            return body if isinstance(body, list) else []
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < RETRIES:
                time.sleep(2 ** (attempt + 1))
                continue
            return []
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            if attempt < RETRIES:
                time.sleep(2 ** (attempt + 1))
                continue
            return []
    return []


def build_file(page: dict, key: str, now: datetime) -> dict | None:
    symbol = _clean_symbol(page["ticker"])
    grades = (_get("grades-consensus", {"symbol": symbol}, key) or [{}])[0]
    target = (_get("price-target-consensus", {"symbol": symbol}, key) or [{}])[0]
    rows = _get("analyst-estimates", {"symbol": symbol, "period": "annual", "limit": "10"}, key)
    # FMP's own price at this same moment: the gap to the target is computed against it (the page's price can be weeks old)
    quote = (_get("quote", {"symbol": symbol}, key) or [{}])[0]
    # FMP gives the estimates in the company's REPORTING currency (Tencent: yuan, TSMC: Taiwan dollars, Novo: kroner), which
    # is not always the page's price currency; its income statement names it.
    statement = (_get("income-statement", {"symbol": symbol, "period": "annual", "limit": "1"}, key) or [{}])[0]
    reported = statement.get("reportedCurrency") if isinstance(statement.get("reportedCurrency"), str) else None

    counts = {
        "strong_buy": _num(grades.get("strongBuy")),
        "buy": _num(grades.get("buy")),
        "hold": _num(grades.get("hold")),
        "sell": _num(grades.get("sell")),
        "strong_sell": _num(grades.get("strongSell")),
    }
    has_counts = all(v is not None for v in counts.values()) and sum(counts.values()) > 0
    out: dict = {
        "schema": SCHEMA,
        "slug": page["slug"],
        "ticker": page["ticker"],
        "symbol": symbol,
        "as_of": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "FMP",
    }
    if has_counts:
        out["rating"] = grades.get("consensus") or None
        out["counts"] = counts
        out["analysts"] = sum(counts.values())
    avg = _num(target.get("targetConsensus"))
    if avg and avg > 0:
        out["target"] = {
            "average": avg,
            "high": _num(target.get("targetHigh")),
            "low": _num(target.get("targetLow")),
            "median": _num(target.get("targetMedian")),
            "currency": page.get("currency"),   # FMP names none; the page's own price currency (checked on samples)
        }
    if "target" in out and _num(quote.get("price")) and quote["price"] > 0:
        out["price"] = quote["price"]
    today = now.date().isoformat()
    future = sorted((r for r in rows if str(r.get("date") or "") >= today), key=lambda r: str(r["date"]))[:2]
    estimates = [
        {
            "fiscal_year_end": str(r["date"]),
            "eps_avg": _num(r.get("epsAvg")),
            "eps_analysts": _num(r.get("numAnalystsEps")),
            "revenue_avg": _num(r.get("revenueAvg")),
            "revenue_analysts": _num(r.get("numAnalystsRevenue")),
        }
        for r in future
        if _num(r.get("epsAvg")) is not None or _num(r.get("revenueAvg")) is not None
    ]
    if estimates and reported:
        out["estimates"] = estimates
        out["estimates_currency"] = reported
    if "counts" not in out and "target" not in out:
        return None   # nothing a reader could use: no file
    return out


def load_pages(pages_dir: Path | None, only: set[str]) -> list[dict]:
    if pages_dir is None:
        pages_dir = Path(tempfile.mkdtemp(prefix="pp-pages-"))
        subprocess.run(["gsutil", "-q", "-m", "cp", f"{BUCKET}/*.json", str(pages_dir)], check=True)
    pages = []
    for path in sorted(pages_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        if data.get("schema") != "public_pages_v1" or not data.get("ticker") or not data.get("slug"):
            continue
        if only and data["slug"] not in only:
            continue
        pages.append({"slug": data["slug"], "ticker": data["ticker"], "currency": data.get("currency"), "price": data.get("price")})
    return pages


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--pages-dir", help="a local copy of library/public-pages (default: read from GCS)")
    ap.add_argument("--only", default="", help="comma-separated slugs")
    ap.add_argument("--upload", action="store_true", help="copy the files to gs://.../public-pages/analysts/")
    args = ap.parse_args()
    key = os.environ.get("FMP_API_KEY", "")
    if not key:
        print("FMP_API_KEY is not set (source scripts/local_env_from_gcloud.sh in the same command)", file=sys.stderr)
        return 2
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    pages = load_pages(Path(args.pages_dir) if args.pages_dir else None, only)
    now = datetime.now(timezone.utc)
    written = 0
    empty = []

    def one(page):
        try:
            return page, build_file(page, key, now)
        except Exception as exc:  # one company never stops the run
            return page, exc

    with ThreadPoolExecutor(WORKERS) as pool:
        for page, result in pool.map(one, pages):
            if isinstance(result, Exception) or result is None:
                empty.append(page["slug"])
                stale = out_dir / f"{page['slug']}.json"
                if stale.exists():
                    stale.unlink()          # no data now = no file (never an old one)
                continue
            (out_dir / f"{page['slug']}.json").write_text(json.dumps(result, indent=1, sort_keys=True) + "\n")
            written += 1
    print(f"analysts: {written} files written for {len(pages)} pages ({100 * written // max(1, len(pages))} %); no data for {len(empty)}")
    if empty:
        print("  no file: " + ", ".join(empty[:80]) + (" ..." if len(empty) > 80 else ""))
    if args.upload and written:
        subprocess.run(["gsutil", "-q", "-m", "cp", str(out_dir / "*.json"), f"{BUCKET}/analysts/"], check=True)
        print(f"uploaded to {BUCKET}/analysts/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
