"""Beam an ABC tune by beat: rewrite the music lines in place so notes shorter
than a quarter share a beam within each beat.

In ABC, whitespace breaks a beam. A tune written `A2 d B G F E F` renders every
sixteenth on its own flag; `A2dB GFEF` renders them beamed. Notes of a quarter or
longer are never beamed, so they stay space-separated.

Usage: py beam_abc.py tune.abc [more.abc ...]

Assumes a single-voice tune with plain notes, ties, accidentals, chord symbols,
`T` ornaments and barlines (no tuplets, grace groups or inline fields). Check the
result with the same MIDI diff as the transcription: the notes must not change.
"""
import re
import sys
from fractions import Fraction as F

TOK = re.compile(
    r'\s*(?:(?P<bar>:?\|:?|\|\]|:\|)'
    r'|(?P<pre>(?:"[^"]*"|T|[_=^])*)(?P<n>[A-Ga-g][,\']*)(?P<d>\d*(?:/\d*)?)(?P<t>-?))'
)


def duration(d):
    """Length in unit notes: '' is 1, '3' is 3, '/' is 1/2, '7/2' is 7/2."""
    if '/' not in d:
        return F(int(d)) if d else F(1)
    num, den = d.split('/')
    return F(int(num) if num else 1, int(den) if den else 2)


def beam_line(line, beat_units):
    out, pos, at, prev = '', 0, F(0), None  # prev = (beamable, beat index)
    while pos < len(line):
        m = TOK.match(line, pos)
        if not m or m.end() == pos:
            raise SystemExit('cannot parse: ' + line[pos:])
        pos = m.end()
        if m.group('bar'):
            bar = m.group('bar')
            if out and not out.endswith(' ') and not bar.startswith('|:'):
                out += ' '
            out += bar
            at, prev = F(0), None
            continue
        d = duration(m.group('d'))
        beamable, beat = d < beat_units, int(at // beat_units)
        item = m.group('pre') + m.group('n') + m.group('d') + m.group('t')
        joined = prev is not None and prev[0] and beamable and prev[1] == beat
        out += ('' if prev is None or joined else ' ') + item
        prev, at = (beamable, beat), at + d
    return out.rstrip()


def is_music(line):
    return bool(line.strip()) and not re.match(r'^[A-Za-z]:', line) and bool(re.match(r'^[|:"A-Ga-g ]', line))


def main(paths):
    for path in paths:
        text = open(path, encoding='utf-8', newline='').read()
        lines = text.split('\n')
        unit = next((F(l[2:].strip()) for l in lines if l.startswith('L:')), F(1, 8))
        beat_units = F(1, 4) / unit  # one quarter, in unit notes
        out = [beam_line(l, beat_units) if is_music(l) else l for l in lines]
        open(path, 'w', encoding='utf-8', newline='').write('\n'.join(out))


if __name__ == '__main__':
    main(sys.argv[1:])
