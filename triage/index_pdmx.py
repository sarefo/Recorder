#!/usr/bin/env python
"""Index the PDMX dataset into the triage SQLite DB and materialize matching .mxl files.

Reads pdmx/PDMX.csv, keeps rows matching the filters, inserts them into
triage/triage.db, then streams pdmx/mxl.tar.gz once to extract only the matching
.mxl files into pdmx/mxl/ (so we never unpack all ~250k scores).

Examples:
    py triage/index_pdmx.py                          # solo + deduplicated (default)
    py triage/index_pdmx.py --min-rating 4 --limit 2000
    py triage/index_pdmx.py --subset all --max-tracks 2 --genre folk
    py triage/index_pdmx.py --no-extract             # DB only, skip unpacking

Re-running keeps existing per-song status (new/kept/discarded/promoted).
"""
import os
import csv
import sys
import sqlite3
import tarfile
import argparse

TRIAGE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(TRIAGE_DIR)
PDMX_DIR = os.path.join(PROJECT_DIR, "pdmx")
CSV_PATH = os.path.join(PDMX_DIR, "PDMX.csv")
MXL_TAR = os.path.join(PDMX_DIR, "mxl.tar.gz")
DB_PATH = os.path.join(TRIAGE_DIR, "triage.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS songs (
    pdmx_id    TEXT PRIMARY KEY,
    mxl_path   TEXT NOT NULL,
    title      TEXT,
    song_name  TEXT,
    composer   TEXT,
    artist     TEXT,
    genres     TEXT,
    tags       TEXT,
    n_tracks   INTEGER,
    n_notes    INTEGER,
    bars       INTEGER,
    seconds    REAL,
    rating     REAL,
    n_ratings  INTEGER,
    complexity INTEGER,
    license    TEXT,
    status     TEXT NOT NULL DEFAULT 'new',
    abc_path   TEXT,
    note       TEXT
);
CREATE INDEX IF NOT EXISTS idx_status ON songs(status);
CREATE INDEX IF NOT EXISTS idx_rating ON songs(rating);
"""


def connect():
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
    return db


def _num(v, cast, default=None):
    try:
        return cast(v)
    except (TypeError, ValueError):
        return default


def _clean(v):
    return None if v in (None, "", "NA") else v


def iter_matching(args):
    """Yield CSV rows passing the filters."""
    with open(CSV_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if not (row.get("subset:" + args.subset) == "True"):
                continue
            nt = _num(row.get("n_tracks"), int, 99)
            if nt > args.max_tracks:
                continue
            if args.min_rating and _num(row.get("rating"), float, 0) < args.min_rating:
                continue
            if args.genre and args.genre.lower() not in (row.get("genres") or "").lower():
                continue
            yield row


def index(args):
    db = connect()
    rows = {}
    for row in iter_matching(args):
        # mxl column is like ./mxl/8/31/<hash>.mxl  -> store relative to pdmx/
        mxl_rel = row["mxl"].lstrip("./")
        pdmx_id = os.path.splitext(os.path.basename(mxl_rel))[0]
        rows[pdmx_id] = (mxl_rel, row)
        if args.limit and len(rows) >= args.limit:
            break

    inserted = 0
    for pdmx_id, (mxl_rel, row) in rows.items():
        db.execute(
            """INSERT INTO songs (pdmx_id, mxl_path, title, song_name, composer, artist,
                   genres, tags, n_tracks, n_notes, bars, seconds, rating, n_ratings,
                   complexity, license)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(pdmx_id) DO UPDATE SET
                   mxl_path=excluded.mxl_path, title=excluded.title,
                   song_name=excluded.song_name, composer=excluded.composer,
                   artist=excluded.artist, genres=excluded.genres, tags=excluded.tags,
                   n_tracks=excluded.n_tracks, n_notes=excluded.n_notes,
                   bars=excluded.bars, seconds=excluded.seconds, rating=excluded.rating,
                   n_ratings=excluded.n_ratings, complexity=excluded.complexity,
                   license=excluded.license""",
            (pdmx_id, mxl_rel, _clean(row.get("title")), _clean(row.get("song_name")),
             _clean(row.get("composer_name")), _clean(row.get("artist_name")),
             _clean(row.get("genres")), _clean(row.get("tags")),
             _num(row.get("n_tracks"), int), _num(row.get("n_notes"), int),
             _num(row.get("song_length.bars"), int), _num(row.get("song_length.seconds"), float),
             _num(row.get("rating"), float), _num(row.get("n_ratings"), int),
             _num(row.get("complexity"), int), _clean(row.get("license"))),
        )
        inserted += 1
    db.commit()
    print(f"Indexed {inserted} songs into {os.path.relpath(DB_PATH, PROJECT_DIR)}")

    if not args.no_extract:
        wanted = {rel for rel, _ in rows.values()}
        extract_mxl(wanted)
    db.close()


def extract_mxl(wanted):
    """Stream the mxl tar once, extracting only members in `wanted` that aren't on disk."""
    todo = {rel for rel in wanted if not os.path.exists(os.path.join(PDMX_DIR, rel))}
    if not todo:
        print("All matching .mxl files already extracted.")
        return
    print(f"Extracting {len(todo)} .mxl files (streaming {os.path.basename(MXL_TAR)})...")
    done = 0
    with tarfile.open(MXL_TAR, "r:gz") as tar:
        for m in tar:
            rel = m.name.lstrip("./")
            if rel in todo:
                data = tar.extractfile(m).read()
                dest = os.path.join(PDMX_DIR, rel)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(dest, "wb") as out:
                    out.write(data)
                done += 1
                if done % 250 == 0:
                    print(f"  {done}/{len(todo)}")
                if done == len(todo):
                    break
    print(f"Extracted {done} .mxl files.")


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--subset", default="deduplicated",
                   help="PDMX subset flag: all, rated, deduplicated, rated_deduplicated, "
                        "no_license_conflict, all_valid (default: deduplicated)")
    p.add_argument("--max-tracks", type=int, default=1,
                   help="keep scores with at most N tracks (default 1 = solo melody)")
    p.add_argument("--min-rating", type=float, default=0,
                   help="keep scores rated >= R (default 0)")
    p.add_argument("--genre", help="keep only scores whose genres contain this substring")
    p.add_argument("--limit", type=int, default=0, help="cap number of songs indexed")
    p.add_argument("--no-extract", action="store_true",
                   help="index into the DB but don't unpack .mxl files")
    args = p.parse_args()

    if not os.path.exists(CSV_PATH):
        sys.exit(f"PDMX.csv not found at {CSV_PATH} - download the dataset first.")
    index(args)


if __name__ == "__main__":
    main()
