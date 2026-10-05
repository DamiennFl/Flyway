"""Turn the aggregated eBird tables into the static files the app loads.

Usage:
  python pipeline/build_publish.py --data data-build/full --out data-build/publish
  python pipeline/build_publish.py --data data-build/full --out data-build/publish-test --parts 0

Output (upload with Content-Type application/json and Content-Encoding gzip):
  index.json.gz            species list for the dropdown
  meta.json                source, license, era definitions, file format
  species/{code}.json.gz   one file per species, columnar arrays sorted by era, week, lat, lng

In a species file, lat/lng are cell indices: degrees = index * cell (cell = 0.5), i.e. the
cell centre. n is the number of eBird records in that cell/week/era (not individual birds).
country is the ISO country code of each record, parallel to era/week/lat/lng/n.
Names are matched to eBird's current taxonomy; the rest are listed in publish_report.json.
"""
import argparse
import gzip
import json
import os
import re
import time
import urllib.request
from collections import defaultdict

import duckdb

CELL = 0.5
SPECIES_PARTS = 16
TAXONOMY_URL = "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species"
EBIRD_DATASET = "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"
ERAS = [
    {"id": 0, "label": "Before 2000", "from": None, "to": 1999},
    {"id": 1, "label": "2000-2009", "from": 2000, "to": 2009},
    {"id": 2, "label": "2010-2014", "from": 2010, "to": 2014},
    {"id": 3, "label": "2015-2019", "from": 2015, "to": 2019},
    {"id": 4, "label": "2020-2024", "from": 2020, "to": 2024},
]


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def api_key():
    if os.environ.get("EBIRD_API_KEY"):
        return os.environ["EBIRD_API_KEY"]
    env = os.path.join(os.path.dirname(__file__), "..", ".env")
    return re.search(r"VITE_EBIRD_API_KEY=(.+)", open(env).read()).group(1).strip()


def load_taxonomy(cache_path):
    if os.path.exists(cache_path):
        return json.load(open(cache_path, encoding="utf-8"))
    req = urllib.request.Request(TAXONOMY_URL, headers={"X-eBirdApiToken": api_key()})
    tax = json.load(urllib.request.urlopen(req))
    json.dump(tax, open(cache_path, "w", encoding="utf-8"))
    return tax


def match_names(con, data, tax):
    """Map eBird names in our data to current taxonomy entries (1:1)."""
    by_sci = {t["sciName"]: t for t in tax}
    rows = con.execute(f"SELECT ebird_name, gbif_species, sum(n) FROM '{data}/name_map.parquet' GROUP BY 1, 2").fetchall()
    records = defaultdict(int)
    gbif_names = defaultdict(list)
    for ebird_name, gbif_species, n in rows:
        records[ebird_name] += n
        gbif_names[ebird_name].append((n, gbif_species))

    mapping, used = {}, set()
    for name in records:
        if name in by_sci:
            mapping[name] = by_sci[name]
            used.add(by_sci[name]["speciesCode"])

    aliases, unresolved = [], []
    for name in sorted(records, key=lambda x: -records[x]):
        if name in mapping:
            continue
        target = next((by_sci[g] for _, g in sorted(gbif_names[name], reverse=True) if g in by_sci), None)
        same_epithet = target and name.split()[-1][:4] == target["sciName"].split()[-1][:4]
        if target and same_epithet and target["speciesCode"] not in used:
            mapping[name] = target
            used.add(target["speciesCode"])
            aliases.append({"ebird_name": name, "taxonomy_name": target["sciName"], "common_name": target["comName"], "records": records[name]})
        else:
            top = sorted(gbif_names[name], reverse=True)[0][1]
            unresolved.append({"ebird_name": name, "records": records[name], "gbif_name": top, "reason": "no taxonomy match" if not target else "ambiguous alias"})
    return mapping, aliases, unresolved, sum(records.values())


def write_gz(path, text):
    with open(path, "wb") as f:
        f.write(gzip.compress(text.encode("utf-8"), 9, mtime=0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--parts", help="comma-separated slice numbers for a test run")
    args = ap.parse_args()

    data = args.data.replace("\\", "/")
    species_dir = os.path.join(args.out, "species")
    os.makedirs(species_dir, exist_ok=True)
    parts = [int(p) for p in args.parts.split(",")] if args.parts else list(range(SPECIES_PARTS))

    con = duckdb.connect()
    tax = load_taxonomy(os.path.join(os.path.dirname(data), "taxonomy.json"))
    mapping, aliases, unresolved, total_records = match_names(con, data, tax)
    log(f"taxonomy species {len(tax):,} | matched {len(mapping):,} | aliased {len(aliases)} | unresolved {len(unresolved)}")

    con.execute("CREATE TEMP TABLE name_to_code (ebird_name VARCHAR, code VARCHAR)")
    con.executemany("INSERT INTO name_to_code VALUES (?, ?)", [(n, t["speciesCode"]) for n, t in mapping.items()])
    info = {t["speciesCode"]: t for t in mapping.values()}

    years = defaultdict(lambda: ([], []))
    for code, year, n in con.execute(f"""SELECT m.code, y.year, y.n FROM '{data}/species_year_totals.parquet' y
                                         JOIN name_to_code m ON y.species = m.ebird_name ORDER BY m.code, y.year""").fetchall():
        years[code][0].append(year)
        years[code][1].append(n)
    countries = defaultdict(list)
    for code, cc, n in con.execute(f"""SELECT m.code, c.country, sum(c.n) AS n FROM '{data}/species_country.parquet' c
                                       JOIN name_to_code m ON c.species = m.ebird_name GROUP BY 1, 2 ORDER BY 1, 3 DESC""").fetchall():
        countries[code].append([cc, n])

    order = "ORDER BY p.era, p.week, p.clat, p.clon, p.country"
    index, total_bytes, largest, published_records = [], 0, ("", 0), 0
    start = time.time()
    for k in parts:
        path = f"{data}/species_era_week_cell/part-{k:02d}.parquet"
        cur = con.execute(f"""
            SELECT m.code, sum(p.n)::BIGINT, count(*)::BIGINT,
                   to_json(list(p.era {order}))::VARCHAR, to_json(list(p.week {order}))::VARCHAR,
                   to_json(list(p.clat {order}))::VARCHAR, to_json(list(p.clon {order}))::VARCHAR,
                   to_json(list(p.country {order}))::VARCHAR, to_json(list(p.n {order}))::VARCHAR
            FROM read_parquet('{path}') p JOIN name_to_code m ON p.species = m.ebird_name
            GROUP BY m.code""")
        count = 0
        while True:
            batch = cur.fetchmany(50)
            if not batch:
                break
            for code, records, rows, era, week, lat, lng, country, n in batch:
                t = info[code]
                head = json.dumps({"code": code, "name": t["comName"], "sci": t["sciName"], "cell": CELL, "records": records, "rows": rows},
                                  separators=(",", ":"), ensure_ascii=False)[:-1]
                yrs = {"year": years[code][0], "n": years[code][1]}
                text = (f'{head},"era":{era},"week":{week},"lat":{lat},"lng":{lng},"country":{country},"n":{n},'
                        f'"years":{json.dumps(yrs, separators=(",", ":"))},"countries":{json.dumps(countries[code][:10], separators=(",", ":"))}}}')
                out = os.path.join(species_dir, f"{code}.json.gz")
                write_gz(out, text)
                size = os.path.getsize(out)
                total_bytes += size
                if size > largest[1]:
                    largest = (code, size)
                published_records += records
                index.append({"code": code, "name": t["comName"], "sci": t["sciName"], "n": records, "c": [c[0] for c in countries[code][:3]]})
                count += 1
        log(f"slice {k + 1}/{SPECIES_PARTS}: {count} species | total so far {len(index):,} files, {total_bytes / 1e6:,.1f} MB ({(time.time() - start) / 60:.1f} min)")

    index.sort(key=lambda e: e["name"].lower())
    write_gz(os.path.join(args.out, "index.json.gz"), json.dumps(index, separators=(",", ":"), ensure_ascii=False))

    ds = json.load(urllib.request.urlopen(f"https://api.gbif.org/v1/dataset/{EBIRD_DATASET}"))
    meta = {
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": {"name": ds.get("title"), "gbifDataset": EBIRD_DATASET, "license": ds.get("license"),
                   "citation": (ds.get("citation") or {}).get("text"), "lastYearCovered": 2024},
        "cellDegrees": CELL, "weeks": 52, "eras": ERAS, "species": len(index),
        "format": "species/{code}.json.gz: arrays era, week, lat, lng, country, n sorted by era, week, lat, lng, country; "
                  "degrees = index * cellDegrees; country = ISO country code; n = eBird records",
    }
    json.dump(meta, open(os.path.join(args.out, "meta.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    dropped = sum(u["records"] for u in unresolved)
    report = {"aliases": aliases, "unresolved": unresolved, "publishedRecords": published_records, "droppedRecords": dropped, "totalRecords": total_records}
    json.dump(report, open(os.path.join(os.path.dirname(args.out.rstrip("/\\")), "publish_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    index_mb = os.path.getsize(os.path.join(args.out, "index.json.gz")) / 1e6
    log(f"files {len(index):,} | species files {total_bytes / 1e6:,.1f} MB | index {index_mb:.2f} MB | largest {largest[0]} {largest[1] / 1e6:.2f} MB")
    if not args.parts:
        assert published_records + dropped == total_records, (published_records, dropped, total_records)
        log(f"records check OK: published {published_records:,} + unresolved {dropped:,} = {total_records:,}")
    log("done")


if __name__ == "__main__":
    main()
