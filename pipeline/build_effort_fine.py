"""Publish the fine effort baseline used by the compare view: all-species eBird records per
0.1 degree cell and era, summed from the partial table that build_range.py --scale 10 keeps.

Usage:
  python pipeline/build_effort_fine.py --db data-build/range-fine/range.duckdb --publish data-build/publish

Output: {publish}/effort-fine.json.gz = {cell, lat, lng, era}
  lat, lng  cell indices of the occupied cells (degrees = index * cell), sorted by lat then lng
  era       flat array, cells x 5: era[i * 5 + e] = records in cell i, era e, all weeks
"""
import argparse
import json
import os

import duckdb

from build_publish import write_gz
from build_tables import log

ERAS = 5


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--publish", required=True)
    args = ap.parse_args()

    con = duckdb.connect(args.db, read_only=True)
    cells = con.execute("SELECT clat, clon FROM partial GROUP BY ALL ORDER BY clat, clon").fetchall()
    index = {c: i for i, c in enumerate(cells)}
    log(f"{len(cells):,} occupied cells")

    era = [0] * (len(cells) * ERAS)
    for clat, clon, e, n in con.execute("SELECT clat, clon, era, sum(n)::BIGINT FROM partial GROUP BY ALL").fetchall():
        era[index[(clat, clon)] * ERAS + e] = int(n)
    total = sum(era)

    report = os.path.join(os.path.dirname(os.path.abspath(args.publish)), "publish_report.json")
    if os.path.exists(report):
        expected = json.load(open(report, encoding="utf-8"))["totalRecords"]
        assert total == expected, (total, expected)
        log(f"records check OK: {total:,}")

    payload = {"cell": 0.1, "lat": [c[0] for c in cells], "lng": [c[1] for c in cells], "era": era}
    out = os.path.join(args.publish, "effort-fine.json.gz")
    write_gz(out, json.dumps(payload, separators=(",", ":")))
    log(f"effort-fine.json.gz: {os.path.getsize(out) / 1e6:.2f} MB")

    meta_path = os.path.join(args.publish, "meta.json")
    if os.path.exists(meta_path):
        meta = json.load(open(meta_path, encoding="utf-8"))
        meta["effortFine"] = {"path": "effort-fine.json.gz", "cellDegrees": 0.1, "eras": ERAS}
        json.dump(meta, open(meta_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        log("meta.json updated")


if __name__ == "__main__":
    main()
