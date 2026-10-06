"""Build a country-tagged effort baseline, for effort-corrected country comparisons (the
Flyway chart and future "best time/place" features).

Cells almost never straddle a country border (~99.8% single-country, measured on a sample of
the raw ingest), so each 0.5 degree cell is assigned its dominant country by total record volume
across all species, then effort_era_week_cell is re-aggregated by (country, week), pooling across
eras the same way the app already pools eras for its seasonal share calculations.

Usage:
  python pipeline/build_country_effort.py --data data-build/full --out data-build/publish

Output: effort-country.json.gz = { "<country>": [w1..w52] }  (effort summed across eras, by week)
"""
import argparse
import json
import os

import duckdb

from build_publish import write_gz
from build_tables import log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    data = args.data.replace("\\", "/")

    con = duckdb.connect()
    con.execute(f"""
        CREATE TEMP TABLE cell_country AS
        SELECT clat, clon, country FROM (
          SELECT clat, clon, country, sum(n) AS total,
                 row_number() OVER (PARTITION BY clat, clon ORDER BY sum(n) DESC) AS rnk
          FROM read_parquet('{data}/species_era_week_cell/*.parquet')
          GROUP BY clat, clon, country
        ) WHERE rnk = 1""")
    cells = con.execute("SELECT count(*) FROM cell_country").fetchone()[0]
    log(f"{cells:,} cells tagged with a dominant country")

    rows = con.execute(f"""
        SELECT c.country, e.week, sum(e.n_all)::BIGINT AS n
        FROM '{data}/effort_era_week_cell.parquet' e
        JOIN cell_country c ON e.clat = c.clat AND e.clon = c.clon
        GROUP BY 1, 2 ORDER BY 1, 2""").fetchall()

    by_country = {}
    for country, week, n in rows:
        by_country.setdefault(country, [0] * 52)[week - 1] = n

    os.makedirs(args.out, exist_ok=True)
    out = os.path.join(args.out, "effort-country.json.gz")
    write_gz(out, json.dumps(by_country, separators=(",", ":")))
    log(f"effort-country.json.gz: {len(by_country)} countries, {os.path.getsize(out) / 1e3:.1f} KB")

    meta_path = os.path.join(args.out, "meta.json")
    if os.path.exists(meta_path):
        meta = json.load(open(meta_path, encoding="utf-8"))
        meta["effortCountry"] = {
            "path": "effort-country.json.gz",
            "weeks": 52,
            "format": "{country: [n_week1..n_week52]}, all-species record counts summed across eras",
        }
        json.dump(meta, open(meta_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        log("meta.json updated")


if __name__ == "__main__":
    main()
