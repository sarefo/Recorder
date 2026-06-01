#!/usr/bin/env python
"""Regenerate the ABC/docs file lists and bump the PWA cache + build version.

Run automatically by the git pre-commit hook (scripts/hooks/pre-commit), or by
hand:  py scripts/prepare_release.py

Bumping CACHE_VERSION (sw.js) and APP_BUILD (js/core/main.js) forces installed
PWAs to pick up the new release. The version is today's date; a second commit on
the same day gets a -2, -3, ... suffix so every commit still busts the cache.
"""
import os
import re
import sys
import datetime
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
SW_JS = os.path.join(PROJECT_DIR, "sw.js")
MAIN_JS = os.path.join(PROJECT_DIR, "js", "core", "main.js")

# Files the hook should re-stage after this script runs.
TOUCHED_FILES = [
    SW_JS,
    MAIN_JS,
    os.path.join(PROJECT_DIR, "js", "data", "abc-file-list.js"),
    os.path.join(PROJECT_DIR, "js", "data", "docs-file-list.js"),
]


def regenerate_file_lists():
    subprocess.run([sys.executable, os.path.join(SCRIPT_DIR, "update_data.py")],
                   check=True, cwd=PROJECT_DIR)


def _next_version(current_suffix, today):
    """Given the current date-part of a version, return the next one for today."""
    if not current_suffix.startswith(today):
        return today
    rest = current_suffix[len(today):]          # '' | '-2' | '-keep-awake'
    m = re.fullmatch(r'-(\d+)', rest)
    n = int(m.group(1)) if m else 1
    return f"{today}-{n + 1}"


def _bump_in_file(path, pattern, today):
    """Replace the date-part captured by `pattern` (group 'ver') with a fresh one."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.search(pattern, text)
    if not m:
        print(f"  ! version marker not found in {os.path.basename(path)}", file=sys.stderr)
        return False
    new_ver = _next_version(m.group("ver"), today)
    new_text = text[:m.start("ver")] + new_ver + text[m.end("ver"):]
    if new_text != text:
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(new_text)
        print(f"  bumped {os.path.basename(path)} -> {new_ver}")
        return True
    return False


def bump_versions():
    today = datetime.date.today().isoformat()
    # sw.js:   const CACHE_VERSION = 'abc-player-v3-2026-05-31';
    _bump_in_file(SW_JS, r"CACHE_VERSION = 'abc-player-v\d+-(?P<ver>[^']+)'", today)
    # main.js: const APP_BUILD = '2026-05-31-keep-awake';
    _bump_in_file(MAIN_JS, r"APP_BUILD = '(?P<ver>[^']+)'", today)


def main():
    print("[prepare_release] regenerating file lists...")
    regenerate_file_lists()
    print("[prepare_release] bumping version...")
    bump_versions()


if __name__ == "__main__":
    main()
