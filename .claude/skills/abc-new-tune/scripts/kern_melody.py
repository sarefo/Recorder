#!/usr/bin/env python
"""Pull the right-hand melody out of an ifdo.ca kern2abc piece as plain ABC.

    awk -v n=132 '/^X:/{p=($2==n)} p' chopin.abc > x132.abc
    py kern_melody.py x132.abc            # one bar per line, L:1/8
    py kern_melody.py x132.abc --keep-graces

Takes the [V:1] lines (one bar each), then:
  - drops grace groups {..}, !decorations!, "text" and [I:..] instructions
  - collapses chords [..] to their highest note (octave doublings, inner voices)
  - rescales every length to L:1/8 from the source's L: (a source sixteenth in
    L:1/16 becomes `c/`; `d2>e2` becomes `d>e`)
  - drops a second voice written after `&` in the same line
  - keeps ties, slurs, tuplets such as (3 and (7:4:5, rests and bar lines

The output is a starting point for hand-checking, not a finished tune: ornament
runs written as (7:4:5 and similar are kept as they stand, so decide for each
whether to keep it or write the plain note. Pair with transpose_abc.py.
"""
import argparse
import re
import sys
from fractions import Fraction

NOTE = r"(?:\^\^|__|\^|_|=)?[A-Ga-g][,']*"
CHORD_RE = re.compile(r'\[((?:' + NOTE + r'[\d/]*-?)+)\]')
LEN = r'(\d+)?(/+)?(\d+)?'
ITEM_RE = re.compile(r'((?:\^\^|__|\^|_|=)?[A-Ga-gzxZ][,\']*)' + LEN)
TUPLET_RE = re.compile(r'\(\d+(?::\d*)*')


def pitch_key(note):
    m = re.match(r"(?:\^\^|__|\^|_|=)?([A-Ga-g])([,']*)", note)
    letter, marks = m.group(1), m.group(2)
    octv = (1 if letter.islower() else 0) + marks.count("'") - marks.count(',')
    return (octv, 'CDEFGAB'.index(letter.upper()))


def top_of_chord(m):
    """Highest note of a chord, with the length it was written with inside [..]."""
    notes = re.findall('(' + NOTE + r')([\d/]*)(-?)', m.group(1))
    top = max(notes, key=lambda n: pitch_key(n[0]))
    return top[0] + top[1] + top[2]


def scale(num, slashes, den, factor):
    """Length text for a note written num, slashes, den (as in c3/2, c//) in L:1/8."""
    n = int(num) if num else 1
    d = 1
    if slashes:
        d = int(den) if den and len(slashes) == 1 else 2 ** len(slashes)
    value = Fraction(n, d) * factor
    if value == 1:
        return ''
    if value.denominator == 1:
        return str(value.numerator)
    if value.numerator == 1:
        return '/' if value.denominator == 2 else '/%d' % value.denominator
    return '%d/%d' % (value.numerator, value.denominator)


def convert(line, keep_graces, factor):
    s = line.split('&')[0]  # a second voice written into the same line
    if '&' in line and re.search(r'\|+\s*$', line):
        s += '|'
    s = re.sub(r'\[V:\d+\]|\[I:[^\]]*\]', '', s)
    s = re.sub(r'"[^"]*"', '', s)
    s = re.sub(r'![^!]*!', '', s)
    if not keep_graces:
        s = re.sub(r'\{[^}]*\}', '', s)
    s = re.sub(r'\.(?=[A-Ga-g^_=\[])', '', s)  # staccato dots
    # a chord keeps its highest note; its length follows the bracket
    s = CHORD_RE.sub(top_of_chord, s)
    out, i = [], 0
    while i < len(s):
        t = TUPLET_RE.match(s, i)
        if t:
            out.append(t.group(0))
            i = t.end()
            continue
        m = ITEM_RE.match(s, i)
        if m and m.group(1):
            out.append(m.group(1) + scale(m.group(2), m.group(3), m.group(4), factor))
            i = m.end()
            continue
        out.append(s[i])
        i += 1
    text = ''.join(out)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--keep-graces', action='store_true')
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    lines = open(args.file, encoding='utf-8').read().split('\n')
    header = {}
    for l in lines:
        m = re.match(r'^([KMQL]):\s*(.*)', l)
        if m and m.group(1) not in header:
            header[m.group(1)] = m.group(2)
    print('%% K:%s M:%s Q:%s source L:%s -> L:1/8' % (
        header.get('K', '?'), header.get('M', '?'), header.get('Q', '?'), header.get('L', '?')),
        file=sys.stderr)
    unit = Fraction(header.get('L', '1/8').replace(' ', ''))
    factor = unit / Fraction(1, 8)
    n = 0
    for l in lines:
        if l.startswith('[V:1]'):
            text = convert(l, args.keep_graces, factor)
            print(text)
            n += 1


if __name__ == '__main__':
    main()
