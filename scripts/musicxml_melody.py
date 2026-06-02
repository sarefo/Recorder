#!/usr/bin/env python
"""Melody analysis + reduction for MusicXML / .mxl scores (stdlib only).

Many scores we triage are two-hand piano arrangements: the tune is one voice and
the rest is accompaniment. This module finds the melody (the highest-register
voice) and can reduce a score down to just that line plus its <harmony> chord
symbols, so the existing xml2abc pipeline then yields a clean single-line ABC.

Used by:
  - triage/scan_fit.py     (classify every song by its melody's pitch span)
  - scripts/import_song.py  (melody_only conversion for audition + promote)

No music21 / no external deps - just xml.etree, so it stays as light as the rest
of the import pipeline.
"""
import zipfile
import xml.etree.ElementTree as ET

STEP_SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


# ---- generic, namespace-agnostic XML helpers ------------------------------

def _localname(tag):
    """Strip any XML namespace: '{...}note' -> 'note'."""
    return tag.rsplit("}", 1)[-1]


def _child(el, name):
    for c in el:
        if _localname(c.tag) == name:
            return c
    return None


def _children(el, name):
    return [c for c in el if _localname(c.tag) == name]


def _text(el, name):
    """Text of the first direct child with this local name, or None.

    A populated leaf (<step>C</step>) is falsy in ElementTree because it has no
    child elements, so we must compare against None explicitly rather than `or`.
    """
    c = _child(el, name)
    return c.text if c is not None else None


def read_musicxml(path):
    """Return the root element of a .mxl (zip of MusicXML) or a plain .xml file."""
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            inner = None
            if "META-INF/container.xml" in z.namelist():
                cont = ET.fromstring(z.read("META-INF/container.xml"))
                rf = cont.find(".//{*}rootfile")
                if rf is not None:
                    inner = rf.get("full-path")
            if not inner:
                inner = next((n for n in z.namelist()
                              if n.lower().endswith((".xml", ".musicxml"))
                              and not n.startswith("META-INF")), None)
            return ET.fromstring(z.read(inner))
    return ET.parse(path).getroot()


def note_midi(note):
    """MIDI number of a <note>'s <pitch>, or None for rests / unpitched notes."""
    pitch = _child(note, "pitch")
    if pitch is None:
        return None
    step = _text(pitch, "step")
    octave = _text(pitch, "octave")
    alter = _text(pitch, "alter")
    if step not in STEP_SEMITONES or not octave:
        return None
    return 12 * (int(octave) + 1) + STEP_SEMITONES[step] + (int(float(alter)) if alter else 0)


def _note_key(note, part_id):
    """(part, staff, voice) identity for a note - one melodic line per key."""
    return (part_id, _text(note, "staff") or "1", _text(note, "voice") or "1")


# ---- melody selection -----------------------------------------------------

def select_melody(root):
    """Inspect the score and return (melody_key, lines, has_chords).

    Notes are grouped by (part, staff, voice) and each group is reduced to one
    pitch per onset (the top note of any chord) so chords don't widen it. The
    melody is the highest-register group that carries a real tune - it must hold a
    meaningful share of the busiest group's notes, not just a few stray high ones.
    Returns melody_key=None when the score has no pitched notes.
    """
    lines = {}        # key -> [top-note-per-onset MIDI]
    has_chords = False
    for part in _children(root, "part"):
        pid = part.get("id", "P")
        for measure in _children(part, "measure"):
            for el in measure:
                tag = _localname(el.tag)
                if tag == "harmony":
                    has_chords = True
                    continue
                if tag != "note":
                    continue
                midi = note_midi(el)
                if midi is None:
                    continue
                line = lines.setdefault(_note_key(el, pid), [])
                if _child(el, "chord") is not None and line:
                    line[-1] = max(line[-1], midi)   # same onset: keep the top
                else:
                    line.append(midi)

    if not lines:
        return None, lines, has_chords

    most = max(len(v) for v in lines.values())
    candidates = {k: v for k, v in lines.items() if len(v) >= max(8, most * 0.25)} or lines
    melody_key = max(candidates, key=lambda k: sum(candidates[k]) / len(candidates[k]))
    return melody_key, lines, has_chords


def melody_span(root):
    """Pitch span (semitones) of the melody line, or None if no pitched notes."""
    key, lines, _ = select_melody(root)
    if key is None:
        return None
    line = lines[key]
    return max(line) - min(line)


def analyze_file(path):
    """Convenience for the scanner: (melody_span, has_chords) for a file path."""
    root = read_musicxml(path)
    key, lines, has_chords = select_melody(root)
    span = None if key is None else max(lines[key]) - min(lines[key])
    return span, has_chords


# ---- melody reduction -----------------------------------------------------

def _clean_attributes(attr, melody_staff):
    """Collapse a piano <attributes> to a single staff: drop <staves>, keep only
    the melody staff's <clef>/<staff-details> and unnumber them."""
    for staves in _children(attr, "staves"):
        attr.remove(staves)
    for tag in ("clef", "staff-details"):
        for el in _children(attr, tag):
            num = el.get("number")
            if num and num != melody_staff:
                attr.remove(el)
            elif num:
                del el.attrib["number"]


def _strip_staff(el):
    """Remove any <staff> child so nothing references a now-deleted staff number."""
    s = _child(el, "staff")
    if s is not None:
        el.remove(s)


def reduce_to_melody(root, melody_key=None):
    """Mutate `root` in place so it contains only the melody line + chord symbols.

    Drops other parts and other voices/staves, removes <backup>/<forward> cursor
    moves (single voice now), and reduces any chords in the melody voice to their
    top note. Returns the modified root (or unchanged if no melody was found).
    """
    if melody_key is None:
        melody_key, _, _ = select_melody(root)
    if melody_key is None:
        return root
    mel_pid, mel_staff, mel_voice = melody_key

    for part in _children(root, "part"):
        if part.get("id", "P") != mel_pid:
            root.remove(part)
            continue
        for measure in _children(part, "measure"):
            kept = []          # rebuilt, in-order children of this measure
            last_note_idx = None   # index in `kept` of the current onset's note
            last_pitch = None
            for el in list(measure):
                tag = _localname(el.tag)
                if tag in ("backup", "forward"):
                    continue
                if tag == "note":
                    pid_key = _note_key(el, mel_pid)
                    if pid_key != melody_key:
                        continue   # accompaniment voice/staff
                    _strip_staff(el)
                    midi = note_midi(el)
                    is_chord = _child(el, "chord") is not None
                    if is_chord and last_note_idx is not None:
                        # Same onset as the last melody note: keep only the top.
                        if midi is not None and (last_pitch is None or midi > last_pitch):
                            chord_tag = _child(el, "chord")
                            if chord_tag is not None:
                                el.remove(chord_tag)
                            kept[last_note_idx] = el
                            last_pitch = midi
                        # else drop this lower chord tone
                        continue
                    kept.append(el)
                    last_note_idx = len(kept) - 1
                    last_pitch = midi   # None for rests, which is fine (breaks the run)
                    continue
                if tag == "attributes":
                    _clean_attributes(el, mel_staff)
                elif tag in ("harmony", "direction"):
                    _strip_staff(el)
                kept.append(el)
                # Non-note structural element doesn't continue a chord run.
                if tag not in ("harmony", "direction", "print", "sound"):
                    last_note_idx = None
            for el in list(measure):
                measure.remove(el)
            for el in kept:
                measure.append(el)
    return root
