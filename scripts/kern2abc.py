#!/usr/bin/env py
"""Convert a Bach chorale from Humdrum **kern (4 voices) to ABC.

Emits the soprano line as the melody, with chord symbols derived from the
pitch classes actually sounding in Bach's own four-part setting -- so the
harmony is documented rather than guessed.

Source corpus: github.com/craigsapp/bach-370-chorales (Riemenschneider 371).

Usage:  py scripts/kern2abc.py chor010.krn [--transpose 2] [--beats]
"""
import re
import sys
import argparse
from fractions import Fraction

STEPS = 'cdefgab'
STEP_SEMI = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}

TOKEN_RE = re.compile(r'(\d+)(\.*)([a-gA-G]+)([#\-n]*)')
REST_RE = re.compile(r'(\d+)(\.*)r')


# ---------------------------------------------------------------- kern parsing

def parse_token(tok):
    """Return (duration, letter, octave, alter, tie, fermata) or None."""
    if ' ' in tok:
        tok = tok.split()[0]
    if tok in ('.', ''):
        return None
    m = TOKEN_RE.search(tok)
    if not m:
        m = REST_RE.search(tok)
        if not m:
            return None
        recip, dots = m.groups()
        letters, acc = None, ''
    else:
        recip, dots, letters, acc = m.groups()
    dur = Fraction(4, int(recip)) if int(recip) else Fraction(8)
    add, half = dur, dur
    for _ in dots:
        half /= 2
        add += half
    dur = add
    if letters is None:
        return dur, None, None, None, False, False
    letter = letters[0].lower()
    if letters[0].islower():
        octave = 3 + len(letters)          # c -> 4, cc -> 5
    else:
        octave = 4 - len(letters)          # C -> 3, CC -> 2
    alter = acc.count('#') - acc.count('-')
    if 'n' in acc:
        alter = 0
    tied_over = '_' in tok or ']' in tok
    return dur, letter, octave, alter, tied_over, ';' in tok


def midi(letter, octave, alter):
    return (octave + 1) * 12 + STEP_SEMI[letter] + alter


def read_kern(path):
    """-> (voices, bars, meta).  voices[i] = note dicts, bass spine first."""
    meta = {}
    events = [[], [], [], []]        # bass, tenor, alto, soprano
    pos = [Fraction(0)] * 4
    bars = []                        # (soprano position, raw barline token)
    barpos = []
    with open(path, encoding='utf-8', errors='replace') as fh:
        lines = fh.read().splitlines()
    for line in lines:
        if line.startswith('!!!'):
            k, _, v = line[3:].partition(':')
            meta.setdefault(k.strip(), v.strip())
            continue
        if line.startswith('!'):
            continue
        cols = line.split('\t')
        if line.startswith('*'):
            for c in cols:
                if c.startswith('*k['):
                    meta['keysig'] = c[3:-1]
                elif re.fullmatch(r'\*[a-gA-G](#|-)?:', c):
                    meta.setdefault('key', c[1:-1])
                elif c.startswith('*M') and '/' in c:
                    meta.setdefault('meter', c[2:])
                elif c.startswith('*MM'):
                    meta.setdefault('mm', c[3:])
            continue
        if line.startswith('='):
            bars.append((pos[3], cols[0]))
            barpos.append(pos[3])
            continue
        for i, tok in enumerate(cols[:4]):
            ev = parse_token(tok)
            if ev is None:
                continue
            dur, letter, octave, alter, tied_over, ferm = ev
            if letter is None:               # a rest: Bach's phrase break
                events[i].append(dict(start=pos[i], dur=dur, rest=True,
                                      fermata=False, tie_out=False, midi=None))
                pos[i] += dur
                continue
            note = dict(start=pos[i], dur=dur, letter=letter, octave=octave,
                        alter=alter, fermata=ferm, tie_out=False,
                        midi=midi(letter, octave, alter))
            if tied_over and events[i]:
                # a tie inside one bar is just a longer note; one that crosses
                # a barline has to stay two notes so the barline survives
                prev = events[i][-1]
                if not any(prev['start'] < p <= note['start'] for p in barpos):
                    prev['dur'] += dur
                    prev['fermata'] |= ferm
                    pos[i] += dur
                    continue
                prev['tie_out'] = True
            events[i].append(note)
            pos[i] += dur
    return events, bars, meta


# ------------------------------------------------------------ chord detection

TEMPLATES = [
    (frozenset({0, 4, 7}),        ''),
    (frozenset({0, 3, 7}),        'm'),
    (frozenset({0, 4, 7, 10}),    '7'),
    (frozenset({0, 3, 6}),        'dim'),
    (frozenset({0, 3, 7, 10}),    'm7'),
    (frozenset({0, 3, 6, 10}),    'm7b5'),
    (frozenset({0, 3, 6, 9}),     'dim7'),
    (frozenset({0, 4, 7, 11}),    'maj7'),
    (frozenset({0, 4, 8}),        '+'),
    (frozenset({0, 4, 10}),       '7'),
    (frozenset({0, 7, 10}),       '7'),
    (frozenset({0, 4}),           ''),
    (frozenset({0, 3}),           'm'),
    (frozenset({0, 7}),           '5'),
]
RANK = {t: i for i, (t, _) in enumerate(TEMPLATES)}

SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def name_pc(pc, flats, spellings):
    if pc in spellings:
        letter, alter = spellings[pc]
        if abs(alter) <= 1:
            return letter.upper() + ('#' if alter > 0 else 'b' if alter < 0 else '')
    return (FLAT_NAMES if flats else SHARP_NAMES)[pc]


def identify(pcs, bass_pc, flats, spellings):
    """Best chord symbol for a pitch-class set, or None."""
    best = None
    for root in range(12):
        iv = frozenset((p - root) % 12 for p in pcs)
        for tpl, suffix in TEMPLATES:
            if iv == tpl:
                score = (RANK[tpl], 0 if root == bass_pc else 1)
                if best is None or score < best[0]:
                    best = (score, name_pc(root, flats, spellings) + suffix)
    return best[1] if best else None


def sounding(events, t):
    """One entry per voice: the note sounding at time t, or None."""
    out = []
    for voice in events:
        cur = None
        for n in voice:
            if n.get('rest'):
                continue
            if n['start'] <= t < n['start'] + n['dur']:
                cur = n
                break
        out.append(cur)
    return out


def analyze(events, t, flats, spellings):
    voices = [v for v in sounding(events, t) if v]
    if not voices:
        return None
    pcs = {v['midi'] % 12 for v in voices}
    bass = min(voices, key=lambda v: v['midi'])['midi'] % 12
    sym = identify(pcs, bass, flats, spellings)
    if sym:
        return sym
    # a suspension or passing tone: drop one upper voice and retry
    ordered = sorted(voices, key=lambda v: -v['midi'])
    for drop in ordered[:-1]:                       # a suspension above
        sub = {v['midi'] % 12 for v in voices if v is not drop}
        sym = identify(sub, bass, flats, spellings)
        if sym:
            return sym
    if len(ordered) > 2:                            # a passing tone in the bass
        rest = [v for v in ordered[:-1]]
        sub = {v['midi'] % 12 for v in rest}
        newbass = min(rest, key=lambda v: v['midi'])['midi'] % 12
        sym = identify(sub, newbass, flats, spellings)
        if sym:
            return sym
    return '?'


# ------------------------------------------------------------------ ABC output

ACC = {-2: '__', -1: '_', 0: '=', 1: '^', 2: '^^'}


def abc_pitch(letter, octave, alter, state, keyalter):
    acc = ''
    have = state.get(letter, keyalter.get(letter, 0))
    if alter != have:
        acc = ACC[alter]
        state[letter] = alter
    name = letter.upper() if octave <= 4 else letter
    if octave >= 5:
        name += "'" * (octave - 5)
    else:
        name += ',' * (4 - octave)
    return acc + name


def abc_dur(dur, unit):
    n = Fraction(dur, unit)
    if n == 1:
        return ''
    if n.denominator == 1:
        return str(n.numerator)
    if n.numerator == 1:
        return '/' if n.denominator == 2 else '/%d' % n.denominator
    return '%d/%d' % (n.numerator, n.denominator)


def keysig_map(sig):
    """kern *k[f#c#] payload -> {letter: alter}"""
    out = {}
    for m in re.finditer(r'([a-g])([#\-]+)', sig):
        out[m.group(1)] = m.group(2).count('#') - m.group(2).count('-')
    return out


def transpose_note(letter, octave, alter, semitones, steps):
    m = midi(letter, octave, alter) + semitones
    idx = STEPS.index(letter) + steps
    new_letter = STEPS[idx % 7]
    new_octave = octave + idx // 7
    return new_letter, new_octave, m - midi(new_letter, new_octave, 0)


BARLINE = {'': '|', '-': '|', '||': '||', '==': '|]', ':|!': ':|',
           '!|:': '|:', ':|!|:': '::', '==:|!': ':|]'}


def render_barline(tok):
    """kern '=6:|!' -> ABC ':|'"""
    if tok.startswith('=='):
        return BARLINE.get(tok, '|]')
    return BARLINE.get(re.sub(r'^=\d*', '', tok), '|')


TONIC_FIFTHS = {'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F': -1}
MODE_FIFTHS = {'': 0, 'maj': 0, 'ion': 0, 'lyd': 1, 'mix': -1, 'dor': -2,
               'm': -3, 'min': -3, 'aeo': -3, 'phr': -4, 'loc': -5}
SHARP_ORDER = 'fcgdaeb'


def abc_key_sig(key):
    """ABC K: field -> {letter: alter}, e.g. 'Gm' -> {'b': -1, 'e': -1}"""
    m = re.match(r'([A-G])([#b]?)\s*([A-Za-z]*)', (key or 'C').strip())
    if not m:
        return {}
    tonic, acc, mode = m.groups()
    fifths = TONIC_FIFTHS[tonic]
    fifths += 7 if acc == '#' else -7 if acc == 'b' else 0
    fifths += MODE_FIFTHS.get(mode[:3].lower(), 0)
    out = {}
    if fifths > 0:
        for l in SHARP_ORDER[:fifths]:
            out[l] = 1
    else:
        for l in SHARP_ORDER[::-1][:-fifths]:
            out[l] = -1
    return out


OPEN_FIFTH = re.compile(r'^([A-G][#b]?)5$')
CHORD_ROOT = re.compile(r'^([A-G])([#b]?)(.*)$')


def transpose_symbol(sym, semitones, steps):
    m = CHORD_ROOT.match(sym)
    if not m:
        return sym
    letter, acc, suffix = m.groups()
    alter = 1 if acc == '#' else -1 if acc == 'b' else 0
    l, o, a = transpose_note(letter.lower(), 4, alter, semitones, steps)
    return l.upper() + ('#' * a if a > 0 else 'b' * -a) + suffix


def resolve_fifths(lines, warnings):
    """Name bare open fifths ("D5") after how that root is voiced elsewhere,
    and drop harmonies the analyzer could not name at all."""
    quality = {}
    for line in lines:
        for kind, text in line:
            if kind != 'chord':
                continue
            sym = text.strip('"')
            if OPEN_FIFTH.match(sym) or sym == '?':
                continue
            m = CHORD_ROOT.match(sym)
            if m:
                root = m.group(1) + m.group(2)
                q = quality.setdefault(root, {})
                rest = m.group(3)
                minor = rest.startswith('m') and not rest.startswith('maj')
                key = 'm' if minor else 'dim' if rest.startswith('dim') else ''
                q[key] = q.get(key, 0) + 1
    out = []
    last = None          # dedupe only after the fifths are named
    for line in lines:
        new = []
        for kind, text in line:
            sym = text.strip('"') if kind == 'chord' else None
            if sym == '?':
                warnings.append('dropped an unnameable sonority')
                continue
            m = OPEN_FIFTH.match(sym) if sym else None
            if m:
                root = m.group(1)
                q = quality.get(root, {})
                best = max(q, key=q.get) if q else ''
                warnings.append('open fifth on %s read as %s%s'
                                % (root, root, best or ' major'))
                text = '"%s%s"' % (root, best)
            if kind == 'chord':
                if text == last:
                    continue
                last = text
            elif kind == 'bar':
                last = None      # every bar opens with its chord restated
            new.append((kind, text))
        out.append(new)
    return out


def build_body(events, bars, meta, transpose, steps, unit, beats_mode,
               out_sig):
    """-> (list of ABC lines, list of warnings)"""
    sig = keysig_map(meta.get('keysig', ''))
    flats = any(v < 0 for v in sig.values())
    spellings = {}
    for voice in events:
        for n in voice:
            if not n.get('rest'):
                spellings.setdefault(n['midi'] % 12,
                                     (n['letter'], n['alter']))

    soprano = events[3]
    beat = Fraction(1)
    meter = meta.get('meter', '4/4')
    bar_len = Fraction(int(meter.split('/')[0]) * 4, int(meter.split('/')[1]))
    pickup = bool(bars) and (bars[0][0] > 0
                             or (len(bars) > 1
                                 and bars[1][0] - bars[0][0] < bar_len))

    warnings = []
    lines, cur = [], []
    state = {}
    prev_chord = None
    bi = 0
    pending_break = False
    first_full_bar = pickup   # skip chords until the first complete bar
    prev_dur = Fraction(4)

    for n in soprano:
        while bi < len(bars) and bars[bi][0] <= n['start']:
            if cur:
                cur.append(('bar', render_barline(bars[bi][1])))
                if pending_break:
                    lines.append(cur)
                    cur = []
                    pending_break = False
                first_full_bar = False
            state = {}
            prev_chord = None
            bi += 1
        if n['start'] % beat == 0 and not first_full_bar:
            ch = analyze(events, n['start'], flats, spellings)
            if ch == '?':
                warnings.append('unresolved harmony at beat %s'
                                % (n['start'] + 1))
            if ch and (beats_mode or ch != prev_chord):
                out = ch if ch == '?' else \
                    transpose_symbol(ch, transpose, steps) if transpose else ch
                cur.append(('chord', '"%s"' % out))
            prev_chord = ch
        # a chord change hidden under a held soprano note cannot be notated
        t = n['start'] + beat
        seen = prev_chord
        while t < n['start'] + n['dur']:
            if t % beat == 0:
                ch = analyze(events, t, flats, spellings)
                if ch and ch != seen:
                    warnings.append('harmony %s at beat %s falls under a held '
                                    'note' % (ch, t + 1))
                    seen = ch
            t += beat
        prev_chord = seen

        if n.get('rest'):
            cur.append(('note', 'z' + abc_dur(n['dur'], unit)))
            prev_dur = n['dur']
            continue

        letter, octave, alter = n['letter'], n['octave'], n['alter']
        keyalter = sig
        if transpose:
            letter, octave, alter = transpose_note(letter, octave, alter,
                                                   transpose, steps)
            keyalter = out_sig
        tok = ('!fermata!' if n['fermata'] else '') \
            + abc_pitch(letter, octave, alter, state, keyalter) \
            + abc_dur(n['dur'], unit) \
            + ('-' if n['tie_out'] else '')
        # only notes shorter than a beat beam together, and only off the beat
        beamed = (n['start'] % beat != 0 and n['dur'] < beat
                  and prev_dur < beat)
        cur.append(('offbeat' if beamed else 'note', tok))
        prev_dur = n['dur']
        if n['fermata']:
            pending_break = True
    while bi < len(bars):                    # trailing double bar
        if cur and render_barline(bars[bi][1]) != '|':
            cur.append(('bar', render_barline(bars[bi][1])))
        bi += 1
    if cur:
        lines.append(cur)
    return resolve_fifths(lines, warnings), warnings


def join_tokens(tokens):
    """Space separates beats; consecutive sub-beat notes stay beamed.

    tokens are (kind, text) with kind in {'bar', 'chord', 'note', 'offbeat'}.
    """
    out = ''
    for kind, text in tokens:
        if not out or kind == 'offbeat':
            out += text
        else:
            out += ' ' + text
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('kern')
    ap.add_argument('--transpose', type=int, default=0, help='semitones')
    ap.add_argument('--steps', type=int, default=None,
                    help='diatonic steps to move (default: derived)')
    ap.add_argument('--key', default=None, help='ABC K: field, e.g. F')
    ap.add_argument('--title', default=None)
    ap.add_argument('--index', type=int, default=1)
    ap.add_argument('--note', action='append', default=[])
    ap.add_argument('--beats', action='store_true',
                    help='chord on every beat, not only on changes')
    ap.add_argument('--unit', default='auto', help="ABC L: value, or 'auto'")
    ap.add_argument('--out', default=None)
    args = ap.parse_args()

    events, bars, meta = read_kern(args.kern)
    if args.unit == 'auto':
        # L:1/4 reads best for a chorale that moves in quarters and eighths;
        # anything dotted or finer needs L:1/8 to avoid "c3/2 d/".
        durs = [n['dur'] for n in events[3] if not n.get('rest')]
        args.unit = '1/4' if all(d % 1 == 0 or d == Fraction(1, 2)
                                 for d in durs) else '1/8'
    unit = Fraction(*map(int, args.unit.split('/'))) * 4
    steps = args.steps
    if steps is None:
        steps = int(round(args.transpose * 7.0 / 12))

    soprano = events[3]
    pitched = [n for n in soprano if not n.get('rest')]
    lo = min(n['midi'] for n in pitched) + args.transpose
    hi = max(n['midi'] for n in pitched) + args.transpose
    shortest = min(n['dur'] for n in pitched)
    if shortest < Fraction(1, 2):
        sys.stderr.write('  ! shortest note is a %s -- consider L:1/8\n'
                         % shortest)
    if lo < 60:
        sys.stderr.write('  ! BELOW RECORDER RANGE: low note is midi %d\n'
                         % lo)

    key = args.key or meta.get('key', 'C')
    if key[:1].islower():
        key = key[:1].upper() + key[1:] + 'm'
    lines, warnings = build_body(events, bars, meta, args.transpose, steps,
                                 unit, args.beats, abc_key_sig(key))

    src = args.kern.replace('\\', '/').rsplit('/', 1)[-1]
    rn = re.sub(r'\D', '', src).lstrip('0')
    head = ['X: %d' % args.index,
            'T: %s' % (args.title or meta.get('OTL@@DE', src)),
            'C: Johann Sebastian Bach']
    note = 'N: %s, Riemenschneider %s.' % (meta.get('SCT', '?'), rn)
    head.append(note)
    head.append('N: Melody and chords derived from Bach\'s four-part setting '
                '(%s).' % src)
    for extra in args.note:
        head.append('N: %s' % extra)
    head.append('M: %s' % meta.get('meter', '4/4'))
    head.append('L: %s' % args.unit)
    if meta.get('mm'):
        head.append('Q: 1/4=%s' % meta['mm'])
    head.append('K: %s' % key)

    body = '\n'.join(join_tokens(t) for t in lines)
    text = '\n'.join(head) + '\n' + body + '\n'

    if args.out:
        with open(args.out, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
        print('wrote %s  (midi %d-%d)' % (args.out, lo, hi))
    else:
        print(text)
    for w in dict.fromkeys(warnings):
        sys.stderr.write('  ! %s\n' % w)


if __name__ == '__main__':
    main()
