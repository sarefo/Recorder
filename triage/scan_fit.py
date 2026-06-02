#!/usr/bin/env python
"""Pre-compute instrument fit + chord presence for every indexed song.

The triage UI classifies songs lazily (only when you click one), so the
"Playable" / "Has chords" filters start out doing almost nothing. This script
fills in instrument_fit ('recorder' | 'dizi' | 'none' | 'error') and has_chords
for the whole DB in one pass, so the filters work across the dataset immediately.

Fit is judged by the MELODY LINE only (the accompaniment is dropped when we
promote), using scripts/musicxml_melody.py - the same melody selection the
audition + promote pipeline uses, so the filter agrees with what you hear.
Classification is by span alone, since transposition can slide any narrow-enough
span into range. has_chords reflects MusicXML <harmony> chord symbols.

Run:  py triage/scan_fit.py            # scan songs not yet classified
      py triage/scan_fit.py --all      # re-scan everything
      py triage/scan_fit.py --limit 50 # cap work (e.g. to test)
"""
import os
import sys
import sqlite3
import argparse

TRIAGE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(TRIAGE_DIR)
PDMX_DIR = os.path.join(PROJECT_DIR, "pdmx")
DB_PATH = os.path.join(TRIAGE_DIR, "triage.db")

sys.path.insert(0, os.path.join(PROJECT_DIR, "scripts"))
import musicxml_melody  # noqa: E402

# Must match RANGES in triage/app.js. Only the span matters for classification,
# because transposition can move any narrow-enough span inside the range.
RECORDER_SPAN = 86 - 60   # C5..D6 written -> 26 semitones
DIZI_SPAN = 86 - 57       # A4..D6 written -> 29 semitones


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    _migrate(conn)
    return conn


def _migrate(conn):
    existing = {row[1] for row in conn.execute("PRAGMA table_info(songs)")}
    if "instrument_fit" not in existing:
        conn.execute("ALTER TABLE songs ADD COLUMN instrument_fit TEXT")
    if "has_chords" not in existing:
        conn.execute("ALTER TABLE songs ADD COLUMN has_chords INTEGER")
    conn.commit()


def classify(span):
    if span is None:
        return "error"
    if span <= RECORDER_SPAN:
        return "recorder"
    if span <= DIZI_SPAN:
        return "dizi"
    return "none"


def scan(args):
    conn = db()
    where = "" if args.all else " WHERE instrument_fit IS NULL"
    rows = conn.execute(
        f"SELECT pdmx_id, mxl_path FROM songs{where} ORDER BY rating DESC"
    ).fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"Scanning {len(rows)} songs...")

    counts = {"recorder": 0, "dizi": 0, "none": 0, "error": 0, "missing": 0}
    for i, row in enumerate(rows, 1):
        mxl = os.path.join(PDMX_DIR, row["mxl_path"])
        if not os.path.exists(mxl):
            counts["missing"] += 1
            continue
        try:
            span, has_chords = musicxml_melody.analyze_file(mxl)
            fit = classify(span)
        except Exception:
            fit, has_chords = "error", None
        counts[fit] += 1
        conn.execute(
            "UPDATE songs SET instrument_fit=?, has_chords=? WHERE pdmx_id=?",
            (fit, (1 if has_chords else 0) if fit != "error" else None, row["pdmx_id"]),
        )
        if i % 50 == 0:
            conn.commit()
            print(f"  {i}/{len(rows)}  "
                  + "  ".join(f"{k}:{v}" for k, v in counts.items() if v))
    conn.commit()
    conn.close()
    print("Done. " + "  ".join(f"{k}:{v}" for k, v in counts.items() if v))


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--all", action="store_true",
                   help="re-scan every song (default: only unclassified ones)")
    p.add_argument("--limit", type=int, default=0, help="cap number of songs scanned")
    args = p.parse_args()

    if not os.path.exists(DB_PATH):
        sys.exit("No triage.db - run:  py triage/index_pdmx.py")
    scan(args)


if __name__ == "__main__":
    main()
