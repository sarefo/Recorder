#!/usr/bin/env python
"""Convert a MusicXML / .mxl score into a cleaned ABC tune for the Recorder app.

Used both as a CLI and as a module by the triage server (triage/server.py).
Wraps the vendored scripts/xml2abc.py converter.

Examples:
    py scripts/import_song.py song.mxl --stdout
    py scripts/import_song.py song.mxl --category irish --title "The Kesh Jig"
    py scripts/import_song.py song.mxl --category practice --transpose -2

--transpose (semitones) is optional and only needs the `music21` package
(`py -m pip install music21`); everything else is dependency-free.
"""
import os
import re
import sys
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
XML2ABC = os.path.join(SCRIPT_DIR, "xml2abc.py")
ABC_DIR = os.path.join(PROJECT_DIR, "abc")


def _run_xml2abc(xml_path):
    """Run the vendored xml2abc on a .xml/.mxl/.musicxml file, return ABC text."""
    # Force UTF-8 in the child: xml2abc writes to sys.stdout, which defaults to
    # cp1252 on Windows and crashes on non-Latin titles/lyrics (Japanese, Cyrillic...).
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    result = subprocess.run(
        [sys.executable, XML2ABC, xml_path],
        capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
    )
    if result.returncode != 0 or not result.stdout.strip():
        msg = result.stderr.strip() or "no output produced"
        raise RuntimeError(f"xml2abc failed for {xml_path}: {msg}")
    return result.stdout


def _transpose_xml(xml_path, semitones):
    """Transpose a MusicXML file by N semitones via music21; return a temp file path."""
    try:
        from music21 import converter, interval
    except ImportError:
        raise RuntimeError(
            "Transposing needs music21 - install it with: py -m pip install music21"
        )
    import tempfile
    score = converter.parse(xml_path)
    score = score.transpose(interval.ChromaticInterval(semitones))
    fd, out = tempfile.mkstemp(suffix=".musicxml")
    os.close(fd)
    score.write("musicxml", fp=out)
    return out


def clean_abc(abc, title=None):
    """Tidy raw xml2abc output: drop layout directives, force X:1, optional title."""
    # Drop %%-layout/page directives that don't affect playback or fingering.
    lines = [ln for ln in abc.splitlines() if not ln.startswith("%%")]
    abc = "\n".join(lines).strip() + "\n"

    # Normalise the tune index to 1 (single tune per file in this app).
    abc = re.sub(r'^X:\s*\d+', 'X: 1', abc, count=1, flags=re.M)

    if title:
        if re.search(r'^T:', abc, flags=re.M):
            abc = re.sub(r'^T:.*$', f'T: {title}', abc, count=1, flags=re.M)
        else:
            abc = re.sub(r'(^X:.*$)', r'\1\n' + f'T: {title}', abc, count=1, flags=re.M)
    return abc


def convert_to_abc(input_path, title=None, transpose=0):
    """Convert a MusicXML/.mxl file to cleaned ABC text."""
    xml_path = input_path
    tmp = None
    if transpose:
        xml_path = tmp = _transpose_xml(input_path, transpose)
    try:
        raw = _run_xml2abc(xml_path)
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)
    return clean_abc(raw, title=title)


def _safe_filename(title):
    name = re.sub(r'[<>:"/\\|?*]', '', title or "").strip().lower()
    name = re.sub(r'\s+', ' ', name)
    return name or "untitled"


def extract_title(abc):
    m = re.search(r'^T:\s*(.+)$', abc, flags=re.M)
    return m.group(1).strip() if m else "untitled"


def write_song(abc, category, title):
    """Write ABC text into abc/<category>/<title>.abc; return path relative to abc/."""
    cat_dir = os.path.join(ABC_DIR, category)
    os.makedirs(cat_dir, exist_ok=True)
    path = os.path.join(cat_dir, _safe_filename(title) + ".abc")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(abc)
    return os.path.relpath(path, ABC_DIR).replace("\\", "/")


def main():
    import argparse
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("input", help="path to a .xml / .mxl / .musicxml file")
    p.add_argument("--category", help="abc/ subfolder to write into")
    p.add_argument("--title", help="override the tune title")
    p.add_argument("--transpose", type=int, default=0,
                   help="transpose by N semitones (needs music21)")
    p.add_argument("--stdout", action="store_true",
                   help="print ABC instead of writing a file")
    args = p.parse_args()

    abc = convert_to_abc(args.input, title=args.title, transpose=args.transpose)

    if args.stdout or not args.category:
        sys.stdout.write(abc)
        return
    rel = write_song(abc, args.category, args.title or extract_title(abc))
    print(f"Wrote abc/{rel}")


if __name__ == "__main__":
    main()
