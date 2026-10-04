#!/usr/bin/env python
"""Transpose the music lines of an ABC tune to another key, respelling notes.

    py transpose_abc.py in.abc --to F            # source key read from K:
    py transpose_abc.py in.abc --to F --shift -10  # force the interval (semitones)

Without --shift the interval is the SMALLEST move from the source tonic to the
target tonic (-6..+5); pass --shift to pick the octave (e.g. -10 instead of +2).
Handles notes, accidentals carried through a bar, ties, grace groups and chords
in [..]. Chord symbols are transposed too ("Eb" -> "F", "Bb7" -> "C7").
Quoted text, !decorations!, inline [K:..]-style fields and header lines are left
alone, except the K: line, which is rewritten. Major and minor keys only.
"""
import argparse
import re
import sys

NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
LETTER_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
SHARP_ORDER = 'FCGDAEB'
FLAT_ORDER = 'BEADGCF'
MAJOR_FIFTHS = {'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
                'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7}


def pc_of(name):
    pc = LETTER_PC[name[0].upper()]
    for ch in name[1:]:
        pc += 1 if ch in '#' else -1 if ch in 'b' else 0
    return pc % 12


def parse_key(k):
    k = k.strip().split()[0]
    m = re.match(r'^([A-G][#b]?)(m|min|minor)?', k)
    tonic, minor = m.group(1), bool(m.group(2))
    if minor:  # relative major sets the signature
        rel = (pc_of(tonic) + 3) % 12
        fifths = None
        for name, f in MAJOR_FIFTHS.items():
            if pc_of(name) == rel and abs(f) <= 6 or (pc_of(name) == rel and fifths is None):
                fifths = f
                if abs(f) <= 6:
                    break
    else:
        fifths = MAJOR_FIFTHS[tonic]
    return tonic, minor, fifths


def key_accidentals(fifths):
    acc = {c: 0 for c in 'ABCDEFG'}
    if fifths > 0:
        for c in SHARP_ORDER[:fifths]:
            acc[c] = 1
    elif fifths < 0:
        for c in FLAT_ORDER[:-fifths]:
            acc[c] = -1
    return acc


def spell(pc, fifths, acc_sig, minor_tonic=None):
    """Pick (letter, accidental) for a pitch class in a key with `fifths`.

    In a minor key (minor_tonic = its tonic name) the raised 7th is spelled
    as a sharp of the letter below the tonic (C# in D minor, not Db)."""
    # diatonic first
    for c, a in acc_sig.items():
        if (LETTER_PC[c] + a) % 12 == pc:
            return c, a
    if minor_tonic and pc == (pc_of(minor_tonic) - 1) % 12:
        letters = 'CDEFGAB'
        letter = letters[(letters.index(minor_tonic[0]) - 1) % 7]
        diff = (pc - LETTER_PC[letter] + 6) % 12 - 6
        if abs(diff) <= 1:
            return letter, diff
    names = NAMES_FLAT if fifths < 0 else NAMES_SHARP
    n = names[pc]
    return n[0], (1 if '#' in n else -1 if 'b' in n else 0)


NOTE_RE = re.compile(r"(\^\^|__|\^|_|=)?([A-Ga-g])([,']*)")
TOKEN_RE = re.compile(r'("[^"]*"|![^!]*!|\[[A-Za-z]:[^\]]*\]|\+[^+]*\+|\|)')


def transpose_chord_symbol(sym, shift, fifths_to):
    m = re.match(r'^([A-G][#b]?)(.*?)(?:/([A-G][#b]?))?$', sym)
    if not m:
        return sym
    names = NAMES_FLAT if fifths_to < 0 else NAMES_SHARP

    def tr(n):
        return names[(pc_of(n) + shift) % 12]
    out = tr(m.group(1)) + m.group(2)
    if m.group(3):
        out += '/' + tr(m.group(3))
    return out


def transpose_body(line, shift, src_acc, dst_fifths, dst_acc, state, steps):
    out = []
    for piece in TOKEN_RE.split(line):
        if piece == '':
            continue
        if piece == '|':
            state['src'] = {}
            state['dst'] = {}
            out.append(piece)
        elif piece.startswith('"'):
            body = piece[1:-1]
            if body and body[0] in '^_<>@':
                out.append(piece)
            else:
                out.append('"' + transpose_chord_symbol(body, shift, dst_fifths) + '"')
        elif piece[0] in '![+':
            out.append(piece)
        else:
            def note(mm):
                acc_s, letter, marks = mm.group(1), mm.group(2), mm.group(3)
                up = letter.islower()
                octv = (1 if up else 0) + marks.count("'") - marks.count(',')
                key = (letter.upper(), octv)
                if acc_s:
                    off = {'^^': 2, '__': -2, '^': 1, '_': -1, '=': 0}[acc_s]
                    state['src'][key] = off
                else:
                    off = state['src'].get(key, src_acc[letter.upper()])
                midi = 60 + 12 * octv + LETTER_PC[letter.upper()] + off
                midi += shift
                pc = midi % 12
                # keep the interval's letter distance, so a chromatic note keeps
                # its function (E natural in Eb -> F#, not Gb, when going to F)
                dl = 'CDEFGAB'[('CDEFGAB'.index(letter.upper()) + steps) % 7]
                da = (pc - LETTER_PC[dl] + 6) % 12 - 6
                # octave of the written letter (handles B#/Cb wrap, not used here)
                base = LETTER_PC[dl] + da
                dooct = (midi - base) // 12 - 5
                dkey = (dl, dooct)
                cur = state['dst'].get(dkey, dst_acc[dl])
                mark = ''
                if cur != da:
                    mark = {1: '^', -1: '_', 0: '=', 2: '^^', -2: '__'}[da]
                    state['dst'][dkey] = da
                ch = dl.lower() if dooct >= 1 else dl
                s = mark + ch
                if dooct >= 2:
                    s += "'" * (dooct - 1)
                elif dooct < 0:
                    s += ',' * (-dooct)
                return s
            out.append(NOTE_RE.sub(note, piece))
    return ''.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--to', required=True, help='target key, e.g. F, Dm, Bb')
    ap.add_argument('--shift', type=int, help='semitones (default: smallest move)')
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    lines = open(args.file, encoding='utf-8').read().split('\n')
    src_key = None
    for l in lines:
        if l.startswith('K:'):
            src_key = l[2:].strip()
            break
    t_from, minor_from, f_from = parse_key(src_key)
    t_to, minor_to, f_to = parse_key(args.to)
    if args.shift is not None:
        shift = args.shift
    else:
        shift = (pc_of(t_to) - pc_of(t_from)) % 12
        if shift > 6:
            shift -= 12
    steps = ('CDEFGAB'.index(t_to[0]) - 'CDEFGAB'.index(t_from[0])) % 7
    src_acc = key_accidentals(f_from)
    dst_acc = key_accidentals(f_to)
    state = {'src': {}, 'dst': {}}
    out = []
    in_music = False
    for l in lines:
        if l.startswith('K:'):
            out.append('K:' + args.to)
            in_music = True
            continue
        if not in_music or not l.strip() or re.match(r'^[A-Za-z]:', l) or l.startswith('%'):
            out.append(l)
            continue
        out.append(transpose_body(l, shift, src_acc, f_to, dst_acc, state, steps))
    sys.stdout.write('\n'.join(out))
    print('\n%% shifted %+d semitones' % shift, file=sys.stderr)


if __name__ == '__main__':
    main()
