"""Build a range layer: eBird records per species, era and map cell (no weeks).
Cell size is set with --scale (4 = 0.25 degrees, 10 = 0.1 degrees).

Reads the GBIF snapshot like build_tables.py, but aggregates inside each batch of files so
only small partial counts are stored. Species names/codes come from the first pass's name_map
and eBird's taxonomy, exactly as in build_publish.py.

Usage:
  python pipeline/build_range.py --snapshot 2026-09-01 --out data-build/range \
      --names data-build/full --publish data-build/publish
  python pipeline/build_range.py --snapshot 2026-09-01 --sample 40 --out data-build/range-sample \
      --names data-build/full --publish data-build/range-sample/publish

Output: {publish}/range/{code}.json.gz with arrays era, lat, lng, n (degrees = index * cell).
"""
import argparse
import json
import os
import random
import time
from collections import defaultdict

import duckdb

from build_publish import load_taxonomy, match_names, write_gz
from build_tables import BAD_ISSUES, BATCH_FILES, EBIRD_DATASET, ERA, connect, log, s3_list

BUCKETS = 8


def ingest(con, files, scale):
    con.execute("""CREATE TABLE IF NOT EXISTS partial
                   (species VARCHAR, era UTINYINT, clat SMALLINT, clon SMALLINT, country VARCHAR, n INTEGER)""")
    con.execute("CREATE TABLE IF NOT EXISTS done_batches (batch INTEGER PRIMARY KEY, files INTEGER, seconds DOUBLE)")
    done = {r[0] for r in con.execute("SELECT batch FROM done_batches").fetchall()}
    batches = [files[i:i + BATCH_FILES] for i in range(0, len(files), BATCH_FILES)]
    bad = "[" + ",".join(f"'{b}'" for b in BAD_ISSUES) + "]"
    start = time.time()
    for i, batch in enumerate(batches):
        if i in done:
            continue
        lst = "[" + ",".join(f"'s3://gbif-open-data-us-east-1/{k}'" for k in batch) + "]"
        t0 = time.time()
        con.execute("BEGIN")
        con.execute(f"""
            INSERT INTO partial
            SELECT ebird_name, {ERA} AS era, clat, clon, country, count(*)::INTEGER FROM (
              SELECT verbatimscientificname AS ebird_name, countrycode AS country, year::SMALLINT AS year,
                     round(decimallatitude * {scale})::SMALLINT AS clat,
                     round(decimallongitude * {scale})::SMALLINT AS clon
              FROM read_parquet({lst}, union_by_name=true)
              WHERE datasetkey = '{EBIRD_DATASET}' AND species IS NOT NULL AND verbatimscientificname IS NOT NULL
                AND decimallatitude BETWEEN -90 AND 90 AND decimallongitude BETWEEN -180 AND 180
                AND year BETWEEN 1700 AND 2025 AND month IS NOT NULL AND day IS NOT NULL
                AND TRY(make_date(year, month, day)) IS NOT NULL
                AND NOT list_has_any(coalesce(issue, CAST([] AS VARCHAR[])), {bad})
            ) GROUP BY ALL""")
        secs = time.time() - t0
        con.execute("INSERT INTO done_batches VALUES (?, ?, ?)", [i, len(batch), secs])
        con.execute("COMMIT")
        rows = con.execute("SELECT count(*), sum(n) FROM partial").fetchone()
        log(f"batch {i + 1}/{len(batches)} done in {secs:.0f}s | partial rows {rows[0]:,} | records {rows[1] or 0:,} | elapsed {(time.time() - start) / 60:.1f} min")


def write_parts(con, out):
    part_dir = os.path.join(out, "species_era_cell")
    os.makedirs(part_dir, exist_ok=True)
    for k in range(BUCKETS):
        path = os.path.join(part_dir, f"part-{k:02d}.parquet")
        if os.path.exists(path) and os.path.getsize(path) > 0:
            continue
        t0 = time.time()
        tmp = (path + ".tmp").replace("\\", "/")
        con.execute(f"""COPY (SELECT species, era, clat, clon, country, sum(n)::INTEGER AS n FROM partial
                         WHERE hash(species) % {BUCKETS} = {k} GROUP BY ALL ORDER BY species, era, clat, clon, country)
                        TO '{tmp}' (FORMAT parquet, COMPRESSION zstd)""")
        os.replace(tmp, path)
        log(f"species_era_cell slice {k + 1}/{BUCKETS}: {os.path.getsize(path) / 1e6:,.1f} MB ({time.time() - t0:.0f}s)")
    glob = os.path.join(part_dir, "*.parquet").replace("\\", "/")
    rows, recs = con.execute(f"SELECT count(*), sum(n) FROM read_parquet('{glob}')").fetchone()
    log(f"species_era_cell: {rows:,} rows, {recs:,} records")
    return glob


def publish(con, glob, names_dir, publish_dir, full_run, cell, layer):
    names = names_dir.replace("\\", "/")
    tax = load_taxonomy(os.path.join(os.path.dirname(names), "taxonomy.json"))
    mapping, aliases, unresolved, _ = match_names(con, names, tax)
    con.execute("CREATE TEMP TABLE name_to_code (ebird_name VARCHAR, code VARCHAR)")
    con.executemany("INSERT INTO name_to_code VALUES (?, ?)", [(n, t["speciesCode"]) for n, t in mapping.items()])
    info = {t["speciesCode"]: t for t in mapping.values()}

    range_dir = os.path.join(publish_dir, layer)
    os.makedirs(range_dir, exist_ok=True)
    order = "ORDER BY p.era, p.clat, p.clon, p.country"
    cur = con.execute(f"""
        SELECT m.code, sum(p.n)::BIGINT, count(*)::BIGINT,
               to_json(list(p.era {order}))::VARCHAR, to_json(list(p.clat {order}))::VARCHAR,
               to_json(list(p.clon {order}))::VARCHAR, to_json(list(p.country {order}))::VARCHAR,
               to_json(list(p.n {order}))::VARCHAR
        FROM read_parquet('{glob}') p JOIN name_to_code m ON p.species = m.ebird_name
        GROUP BY m.code""")
    files = total_bytes = published = 0
    largest = ("", 0)
    start = time.time()
    while True:
        batch = cur.fetchmany(50)
        if not batch:
            break
        for code, records, rows, era, lat, lng, country, n in batch:
            t = info[code]
            head = json.dumps({"code": code, "name": t["comName"], "sci": t["sciName"], "cell": cell, "records": records, "rows": rows},
                              separators=(",", ":"), ensure_ascii=False)[:-1]
            out = os.path.join(range_dir, f"{code}.json.gz")
            write_gz(out, f'{head},"era":{era},"lat":{lat},"lng":{lng},"country":{country},"n":{n}}}')
            size = os.path.getsize(out)
            total_bytes += size
            largest = max(largest, (code, size), key=lambda x: x[1])
            published += records
            files += 1
        if files % 1000 < 50:
            log(f"published {files:,} files, {total_bytes / 1e6:,.1f} MB ({(time.time() - start) / 60:.1f} min)")
    log(f"range files {files:,} | {total_bytes / 1e6:,.1f} MB | largest {largest[0]} {largest[1] / 1e6:.2f} MB | records {published:,}")

    meta_path = os.path.join(publish_dir, "meta.json")
    if os.path.exists(meta_path):
        meta = json.load(open(meta_path, encoding="utf-8"))
        meta.setdefault("layers", {"weekly": {"path": "species/", "cellDegrees": 0.5, "weeks": 52}})
        meta["layers"][layer] = {"path": f"{layer}/", "cellDegrees": cell, "weeks": None}
        meta["format"] = ("species/{code}.json.gz (weekly layer): era, week, lat, lng, country, n. "
                          "{layer}/{code}.json.gz (range layers, no weeks): era, lat, lng, country, n. "
                          "country is the ISO country code of each record. "
                          "Sorted by their columns in that order; degrees = index * layers[layer].cellDegrees; n = eBird records.")
        json.dump(meta, open(meta_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        log("meta.json updated with layer info")

    if full_run:
        expected = json.load(open(os.path.join(os.path.dirname(names), "publish_report.json"), encoding="utf-8"))["publishedRecords"]
        assert published == expected, (published, expected)
        log(f"records check OK: {published:,} matches the weekly layer")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--names", required=True, help="folder with name_map.parquet from build_tables.py")
    ap.add_argument("--publish", required=True)
    ap.add_argument("--sample", type=int)
    ap.add_argument("--scale", type=int, default=4, help="cells per degree: 4 = 0.25 degree cells, 10 = 0.1 degree cells")
    ap.add_argument("--layer", default="range", help="folder name under --publish for the species files")
    args = ap.parse_args()
    cell = round(1 / args.scale, 6)

    os.makedirs(args.out, exist_ok=True)
    files = sorted(s3_list(f"occurrence/{args.snapshot}/occurrence.parquet/"))
    log(f"snapshot {args.snapshot}: {len(files):,} files")
    if args.sample:
        files = sorted(random.Random(1).sample(files, args.sample))
        log(f"sampling {len(files)} files")

    con = connect(args.out, "range.duckdb")
    ingest(con, files, args.scale)
    glob = write_parts(con, args.out)
    publish(con, glob, args.names, args.publish, not args.sample, cell, args.layer)
    con.close()
    log("done")


if __name__ == "__main__":
    main()
