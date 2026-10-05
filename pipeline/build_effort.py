"""Publish the effort baseline: all-species eBird records per 0.5 degree cell.

Dividing a species' records by this gives its share of all reports, which corrects for where
and when people go birding. One file feeds the season slider, the migration view and the
then-versus-now comparison.

Usage:
  python pipeline/build_effort.py --data data-build/full --publish data-build/publish

Output: {publish}/effort.json.gz = {cell, lat, lng, week, era}
  lat, lng  cell indices of the occupied cells (degrees = index * cell), sorted by lat then lng
  week      flat array, cells x 52: week[i * 52 + w - 1] = records in cell i, week w, all years
  era       flat array, cells x 5: era[i * 5 + e] = records in cell i, era e, all weeks
"""
import argparse
import json
import os

import duckdb

from build_publish import write_gz
from build_tables import log

CELL = 0.5
WEEKS = 52
ERAS = 5


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--publish", required=True)
    args = ap.parse_args()

    path = os.path.join(args.data, "effort_era_week_cell.parquet").replace("\\", "/")
    con = duckdb.connect()
    cells = con.execute(f"SELECT clat, clon FROM '{path}' GROUP BY ALL ORDER BY clat, clon").fetchall()
    index = {c: i for i, c in enumerate(cells)}
    log(f"{len(cells):,} occupied cells")

    week = [0] * (len(cells) * WEEKS)
    for clat, clon, w, n in con.execute(f"SELECT clat, clon, week, sum(n_all) FROM '{path}' GROUP BY ALL").fetchall():
        week[index[(clat, clon)] * WEEKS + w - 1] = int(n)

    era = [0] * (len(cells) * ERAS)
    for clat, clon, e, n in con.execute(f"SELECT clat, clon, era, sum(n_all) FROM '{path}' GROUP BY ALL").fetchall():
        era[index[(clat, clon)] * ERAS + e] = int(n)

    total_week, total_era = sum(week), sum(era)
    assert total_week == total_era, (total_week, total_era)
    payload = {"cell": CELL, "lat": [c[0] for c in cells], "lng": [c[1] for c in cells], "week": week, "era": era}

    os.makedirs(args.publish, exist_ok=True)
    out = os.path.join(args.publish, "effort.json.gz")
    write_gz(out, json.dumps(payload, separators=(",", ":")))
    log(f"effort.json.gz: {os.path.getsize(out) / 1e6:.2f} MB, {total_week:,} records")

    meta_path = os.path.join(args.publish, "meta.json")
    if os.path.exists(meta_path):
        meta = json.load(open(meta_path, encoding="utf-8"))
        meta["effort"] = {"path": "effort.json.gz", "cellDegrees": CELL, "weeks": WEEKS, "eras": ERAS}
        json.dump(meta, open(meta_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        log("meta.json updated")


if __name__ == "__main__":
    main()
