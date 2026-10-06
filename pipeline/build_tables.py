"""Aggregate the eBird dataset from the GBIF open-data snapshot (AWS) into local tables.

Species are keyed by eBird's own scientific name (verbatimscientificname), not GBIF's
backbone name: GBIF lumps some eBird species together (e.g. the House Wren complex).

Usage:
  python pipeline/build_tables.py --snapshot 2026-09-01 --out data-build/full
  python pipeline/build_tables.py --snapshot 2026-09-01 --sample 40 --out data-build/sample

Ingestion is resumable: each batch of files is committed on its own, so re-running
the same command skips batches that are already done.
"""
import argparse
import json
import os
import random
import re
import time
import urllib.parse
import urllib.request

import duckdb

HOST = "https://gbif-open-data-us-east-1.s3.amazonaws.com/"
EBIRD_DATASET = "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"
BATCH_FILES = 200

BAD_ISSUES = [
    "COORDINATE_INVALID",
    "COORDINATE_OUT_OF_RANGE",
    "ZERO_COORDINATE",
    "COUNTRY_COORDINATE_MISMATCH",
    "COORDINATE_REPROJECTION_FAILED",
    "COORDINATE_REPROJECTION_SUSPICIOUS",
]

# Era bands: pre-2000, 2000-2009, 2010-2014, 2015-2019, 2020+
ERA = "(CASE WHEN year < 2000 THEN 0 WHEN year < 2010 THEN 1 WHEN year < 2015 THEN 2 WHEN year < 2020 THEN 3 ELSE 4 END)::UTINYINT"

# The species table has hundreds of millions of groups, so it is built in hash slices
# of species to keep memory and temp-disk use small. Output: species_era_week_cell/part-NN.parquet
BUCKETS = 16
BUCKETED_TABLE = "species_era_week_cell"
BUCKET_QUERY = f"""
    SELECT species, {ERA} AS era, week, clat, clon, country, count(*)::INTEGER AS n
    FROM eb WHERE hash(species) % {BUCKETS} = {{k}}
    GROUP BY ALL ORDER BY species, era, week, clat, clon, country"""

TABLES = {
    "effort_era_week_cell": f"""
        SELECT {ERA} AS era, week, clat, clon, count(*)::INTEGER AS n_all
        FROM eb GROUP BY ALL ORDER BY era, week, clat, clon""",
    "species_year_totals": """
        SELECT species, year, count(*)::INTEGER AS n FROM eb GROUP BY ALL ORDER BY species, year""",
    "species_country": """
        SELECT species, country, count(*)::INTEGER AS n FROM eb GROUP BY ALL ORDER BY species, n DESC""",
    "name_map": """
        SELECT species AS ebird_name, gbif_species, count(*)::BIGINT AS n FROM eb GROUP BY ALL ORDER BY ebird_name, n DESC""",
}


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def s3_list(prefix, delimiter=None):
    keys, token = [], None
    while True:
        q = {"list-type": "2", "prefix": prefix}
        if delimiter:
            q["delimiter"] = delimiter
        if token:
            q["continuation-token"] = token
        xml = urllib.request.urlopen(HOST + "?" + urllib.parse.urlencode(q)).read().decode()
        if delimiter:
            keys += re.findall(r"<CommonPrefixes><Prefix>([^<]*)</Prefix>", xml)
        else:
            keys += re.findall(r"<Key>([^<]*)</Key>", xml)
        m = re.search(r"<NextContinuationToken>([^<]*)</NextContinuationToken>", xml)
        if not m:
            return keys
        token = m.group(1)


def connect(out, db_name="ebird.duckdb"):
    con = duckdb.connect(os.path.join(out, db_name))
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-east-1'; SET s3_url_style='path'; SET s3_access_key_id=''; SET s3_secret_access_key='';")
    con.execute("SET preserve_insertion_order=false; SET http_retries=8; SET http_timeout=120;")
    tmp = os.path.join(out, "tmp").replace("\\", "/")
    os.makedirs(tmp, exist_ok=True)
    con.execute(f"SET temp_directory='{tmp}'")
    con.execute("SET max_temp_directory_size='25GB'")
    return con


def ingest(con, files):
    con.execute("""CREATE TABLE IF NOT EXISTS eb (species VARCHAR, gbif_species VARCHAR, country VARCHAR,
                   clat SMALLINT, clon SMALLINT, week UTINYINT, year SMALLINT)""")
    con.execute("CREATE TABLE IF NOT EXISTS done_batches (batch INTEGER PRIMARY KEY, files INTEGER, src_rows BIGINT, seconds DOUBLE)")
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
            INSERT INTO eb
            SELECT ebird_name, gbif_species, country, clat, clon, week, year FROM (
              SELECT verbatimscientificname AS ebird_name, species AS gbif_species, countrycode AS country,
                     round(decimallatitude * 2)::SMALLINT AS clat,
                     round(decimallongitude * 2)::SMALLINT AS clon,
                     LEAST(52, ceil(TRY(dayofyear(make_date(year, month, day))) / 7.0))::UTINYINT AS week,
                     year::SMALLINT AS year
              FROM read_parquet({lst}, union_by_name=true)
              WHERE datasetkey = '{EBIRD_DATASET}' AND species IS NOT NULL AND verbatimscientificname IS NOT NULL
                AND decimallatitude BETWEEN -90 AND 90 AND decimallongitude BETWEEN -180 AND 180
                AND year BETWEEN 1700 AND 2025 AND month IS NOT NULL AND day IS NOT NULL
                AND NOT list_has_any(coalesce(issue, CAST([] AS VARCHAR[])), {bad})
            ) WHERE week IS NOT NULL""")
        secs = time.time() - t0
        con.execute("INSERT INTO done_batches VALUES (?, ?, 0, ?)", [i, len(batch), secs])
        con.execute("COMMIT")
        total = con.execute("SELECT count(*) FROM eb").fetchone()[0]
        elapsed = time.time() - start
        remaining = len(batches) - (i + 1)
        log(f"batch {i + 1}/{len(batches)} done in {secs:.0f}s | rows kept so far {total:,} | elapsed {elapsed / 60:.1f} min")
    return con.execute("SELECT count(*) FROM eb").fetchone()[0]


def write_parquet(con, query, path):
    tmp_path = path + ".tmp"
    con.execute(f"COPY ({query}) TO '{tmp_path}' (FORMAT parquet, COMPRESSION zstd)")
    os.replace(tmp_path, path)


def aggregate(con, out):
    for name, query in TABLES.items():
        path = os.path.join(out, f"{name}.parquet")
        if os.path.exists(path) and os.path.getsize(path) > 0:
            log(f"{name}: already built, skipping")
            continue
        t0 = time.time()
        write_parquet(con, query, path)
        rows = con.execute(f"SELECT count(*) FROM read_parquet('{path.replace(chr(92), '/')}')").fetchone()[0]
        log(f"{name}: {rows:,} rows, {os.path.getsize(path) / 1e6:,.1f} MB ({time.time() - t0:.0f}s)")

    part_dir = os.path.join(out, BUCKETED_TABLE)
    os.makedirs(part_dir, exist_ok=True)
    for k in range(BUCKETS):
        path = os.path.join(part_dir, f"part-{k:02d}.parquet")
        if os.path.exists(path) and os.path.getsize(path) > 0:
            continue
        t0 = time.time()
        write_parquet(con, BUCKET_QUERY.format(k=k), path)
        log(f"{BUCKETED_TABLE} slice {k + 1}/{BUCKETS}: {os.path.getsize(path) / 1e6:,.1f} MB ({time.time() - t0:.0f}s)")
    glob = os.path.join(part_dir, "*.parquet").replace("\\", "/")
    rows = con.execute(f"SELECT count(*) FROM read_parquet('{glob}')").fetchone()[0]
    size = sum(os.path.getsize(os.path.join(part_dir, f)) for f in os.listdir(part_dir)) / 1e6
    log(f"{BUCKETED_TABLE}: {rows:,} rows, {size:,.1f} MB total")


def verify(con):
    facets = json.load(urllib.request.urlopen(
        f"https://api.gbif.org/v1/occurrence/search?datasetKey={EBIRD_DATASET}&limit=0&facet=year&facetLimit=400"))
    api = {int(c["name"]): c["count"] for c in facets["facets"][0]["counts"]}
    bands = [("pre-2000", 0, 1999), ("2000-2009", 2000, 2009), ("2010-2014", 2010, 2014),
             ("2015-2019", 2015, 2019), ("2020-2024", 2020, 2025)]
    log("era check (kept rows vs. GBIF API totals for the whole dataset; sample runs will be far lower):")
    for label, a, b in bands:
        mine = con.execute("SELECT count(*) FROM eb WHERE year BETWEEN ? AND ?", [a, b]).fetchone()[0]
        theirs = sum(c for y, c in api.items() if a <= y <= b)
        log(f"  {label:10s} kept {mine:>14,} / API {theirs:>14,} = {100 * mine / max(theirs, 1):.1f}%")
    log(f"distinct eBird species names: {con.execute('SELECT count(DISTINCT species) FROM eb').fetchone()[0]:,}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sample", type=int, help="use N random files instead of the full snapshot")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    prefix = f"occurrence/{args.snapshot}/occurrence.parquet/"
    files = sorted(s3_list(prefix))
    log(f"snapshot {args.snapshot}: {len(files):,} files")
    if args.sample:
        files = sorted(random.Random(1).sample(files, args.sample))
        log(f"sampling {len(files)} files")

    con = connect(args.out)
    t0 = time.time()
    rows = ingest(con, files)
    log(f"ingest complete: {rows:,} rows kept ({(time.time() - t0) / 60:.1f} min this run)")
    aggregate(con, args.out)
    verify(con)
    con.close()
    log("done")


if __name__ == "__main__":
    main()
