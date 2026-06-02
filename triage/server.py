#!/usr/bin/env python
"""Local triage server for auditioning PDMX scores and promoting them into the app.

Run:  py triage/server.py   ->  open http://localhost:8765

Browse the indexed PDMX songs, audition each (converted to ABC and played with the
same abcjs engine the Recorder uses), then Discard / Keep / Promote. Promote writes
a cleaned .abc file into the app's abc/<category>/ folder.

Index the dataset first with:  py triage/index_pdmx.py
"""
import os
import sys
import sqlite3

from flask import Flask, jsonify, request, send_from_directory, abort

TRIAGE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(TRIAGE_DIR)
PDMX_DIR = os.path.join(PROJECT_DIR, "pdmx")
ABC_DIR = os.path.join(PROJECT_DIR, "abc")
DB_PATH = os.path.join(TRIAGE_DIR, "triage.db")

# Reuse the same converter the CLI uses.
sys.path.insert(0, os.path.join(PROJECT_DIR, "scripts"))
import import_song  # noqa: E402

app = Flask(__name__)

STATUSES = ("new", "kept", "discarded", "promoted")


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


def get_song(conn, pdmx_id):
    row = conn.execute("SELECT * FROM songs WHERE pdmx_id=?", (pdmx_id,)).fetchone()
    if not row:
        abort(404, f"unknown song {pdmx_id}")
    return row


# ---- static frontend -------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(TRIAGE_DIR, "index.html")


@app.route("/<path:fname>")
def static_files(fname):
    if fname in ("app.js", "style.css"):
        return send_from_directory(TRIAGE_DIR, fname)
    abort(404)


# ---- API -------------------------------------------------------------------

@app.route("/api/stats")
def stats():
    conn = db()
    counts = {s: 0 for s in STATUSES}
    for row in conn.execute("SELECT status, COUNT(*) c FROM songs GROUP BY status"):
        counts[row["status"]] = row["c"]
    conn.close()
    return jsonify(counts)


@app.route("/api/categories")
def categories():
    cats = sorted(
        d for d in os.listdir(ABC_DIR)
        if os.path.isdir(os.path.join(ABC_DIR, d))
    ) if os.path.isdir(ABC_DIR) else []
    return jsonify(cats)


@app.route("/api/songs")
def songs():
    status = request.args.get("status", "new")
    q = (request.args.get("q") or "").strip()
    sort = request.args.get("sort", "rating")
    limit = min(int(request.args.get("limit", 100)), 500)
    offset = int(request.args.get("offset", 0))
    playable = request.args.get("playable")   # '1' = exclude known-unplayable songs
    chords = request.args.get("chords")        # '1' = only songs with confirmed chords

    where, params = [], []
    if status != "all":
        where.append("status=?")
        params.append(status)
    if q:
        where.append("(LOWER(title) LIKE ? OR LOWER(composer) LIKE ? OR LOWER(artist) LIKE ?)")
        like = f"%{q.lower()}%"
        params += [like, like, like]
    if playable == "1":
        where.append("(instrument_fit IS NULL OR instrument_fit != 'none')")
    if chords == "1":
        where.append("has_chords=1")
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    order = {"rating": "rating DESC", "title": "title COLLATE NOCASE",
             "notes": "n_notes", "bars": "bars"}.get(sort, "rating DESC")

    conn = db()
    total = conn.execute(f"SELECT COUNT(*) FROM songs{clause}", params).fetchone()[0]
    rows = conn.execute(
        f"SELECT pdmx_id, title, song_name, composer, artist, genres, n_tracks, "
        f"n_notes, bars, seconds, rating, status, abc_path, instrument_fit, has_chords "
        f"FROM songs{clause} "
        f"ORDER BY {order} LIMIT ? OFFSET ?", params + [limit, offset]).fetchall()
    conn.close()
    return jsonify({"total": total, "songs": [dict(r) for r in rows]})


@app.route("/api/song/<pdmx_id>/abc")
def song_abc(pdmx_id):
    transpose = int(request.args.get("transpose", 0))
    conn = db()
    row = get_song(conn, pdmx_id)
    conn.close()
    mxl = os.path.join(PDMX_DIR, row["mxl_path"])
    if not os.path.exists(mxl):
        abort(404, f"mxl not extracted: {row['mxl_path']} (re-run index_pdmx.py)")
    try:
        # Audition the melody line we'd actually promote, not the full arrangement.
        abc = import_song.convert_to_abc(mxl, transpose=transpose, melody_only=True)
    except Exception as e:  # conversion can fail on odd scores; report it
        return jsonify({"error": str(e)}), 422
    return jsonify({"abc": abc, "title": import_song.extract_title(abc)})


@app.route("/api/song/<pdmx_id>/status", methods=["POST"])
def set_status(pdmx_id):
    status = (request.json or {}).get("status")
    if status not in STATUSES:
        abort(400, "invalid status")
    conn = db()
    get_song(conn, pdmx_id)
    conn.execute("UPDATE songs SET status=? WHERE pdmx_id=?", (status, pdmx_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "status": status})


@app.route("/api/song/<pdmx_id>/metadata", methods=["POST"])
def save_metadata(pdmx_id):
    data = request.json or {}
    fit = data.get("instrument_fit")   # 'recorder' | 'dizi' | 'none'
    chords = data.get("has_chords")    # true | false
    conn = db()
    get_song(conn, pdmx_id)
    updates, params = [], []
    if fit is not None:
        updates.append("instrument_fit=?")
        params.append(fit)
    if chords is not None:
        updates.append("has_chords=?")
        params.append(1 if chords else 0)
    if updates:
        conn.execute(f"UPDATE songs SET {', '.join(updates)} WHERE pdmx_id=?",
                     params + [pdmx_id])
        conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/song/<pdmx_id>/promote", methods=["POST"])
def promote(pdmx_id):
    data = request.json or {}
    category = (data.get("category") or "").strip()
    title = (data.get("title") or "").strip()
    transpose = int(data.get("transpose", 0))
    abc_text = data.get("abc")  # client sends the (already transposed) ABC it auditioned
    if not category:
        abort(400, "category required")

    conn = db()
    row = get_song(conn, pdmx_id)
    try:
        if abc_text:
            # Transposition happens in the browser (abcjs), so no music21 needed here -
            # just tidy the title/index and write what the user heard.
            abc = import_song.clean_abc(abc_text, title=title or None)
        else:
            mxl = os.path.join(PDMX_DIR, row["mxl_path"])
            if not os.path.exists(mxl):
                conn.close()
                abort(404, "mxl not extracted")
            abc = import_song.convert_to_abc(mxl, title=title or None,
                                             transpose=transpose, melody_only=True)
        rel = import_song.write_song(abc, category, title or import_song.extract_title(abc))
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 422
    conn.execute("UPDATE songs SET status='promoted', abc_path=? WHERE pdmx_id=?",
                 (rel, pdmx_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "abc_path": rel})


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("No triage.db yet - run:  py triage/index_pdmx.py", file=sys.stderr)
    print("Triage station -> http://localhost:8765")
    app.run(host="127.0.0.1", port=8765, debug=False)
