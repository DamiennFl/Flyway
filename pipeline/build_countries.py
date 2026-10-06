"""Build a country -> species reverse index, for filtering species by country.

The per-species files already carry each species' top 10 countries, but that's
not enough to answer "what's been recorded in Japan" - a country can be a
minor fraction of a species' records and never appear in its top 10. This
script inverts the same species_country.parquet table (already loaded in
build_publish.py) the other way: one file per country, listing every species
recorded there.

Usage:
  python pipeline/build_countries.py --data data-build/full --out data-build/publish

Output:
  countries/index.json       [{"cc": "JP", "n": 631}, ...] for the country picker
  countries/{cc}.json.gz     {"country": "JP", "species": [[code, name, n], ...]},
                              sorted by n (records) descending
"""
import argparse
import json
import os
import time
from collections import defaultdict

import duckdb

from build_publish import load_taxonomy, log, match_names, write_gz


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    data = args.data.replace("\\", "/")
    out_dir = os.path.join(args.out, "countries")
    os.makedirs(out_dir, exist_ok=True)

    start = time.time()
    con = duckdb.connect()
    tax = load_taxonomy(os.path.join(os.path.dirname(data), "taxonomy.json"))
    mapping, _, _, _ = match_names(con, data, tax)
    con.execute("CREATE TEMP TABLE name_to_code (ebird_name VARCHAR, code VARCHAR)")
    con.executemany("INSERT INTO name_to_code VALUES (?, ?)", [(n, t["speciesCode"]) for n, t in mapping.items()])
    info = {t["speciesCode"]: t for t in mapping.values()}

    rows = con.execute(f"""
        SELECT c.country, m.code, sum(c.n)::BIGINT AS n
        FROM '{data}/species_country.parquet' c JOIN name_to_code m ON c.species = m.ebird_name
        GROUP BY 1, 2 ORDER BY 1, 3 DESC""").fetchall()

    by_country = defaultdict(list)
    for cc, code, n in rows:
        by_country[cc].append([code, info[code]["comName"], n])

    index, total_bytes = [], 0
    for cc, species in sorted(by_country.items()):
        text = json.dumps({"country": cc, "species": species}, separators=(",", ":"), ensure_ascii=False)
        path = os.path.join(out_dir, f"{cc}.json.gz")
        write_gz(path, text)
        total_bytes += os.path.getsize(path)
        index.append({"cc": cc, "n": len(species)})

    index.sort(key=lambda e: -e["n"])
    json.dump(index, open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8"), separators=(",", ":"))
    index_bytes = os.path.getsize(os.path.join(out_dir, "index.json"))

    log(f"countries {len(index)} | species files {total_bytes / 1e6:.2f} MB | index.json {index_bytes / 1e3:.1f} KB "
        f"| {time.time() - start:.1f}s")


if __name__ == "__main__":
    main()
