"""Inspect a MIDI file: find the melody, read the accompaniment's chords, and
dump notes in a form you can diff against an ABC transcription.

    py midi_notes.py <file.mid>                  # channel summary -- start here
    py midi_notes.py <file.mid> --channel 15     # that channel's notes, by bar
    py midi_notes.py <file.mid> --chords 2       # per-bar pitch classes (accompaniment)
    py midi_notes.py <file.mid> --channel 15 --flat > a.txt   # one note per line, diffable

Options:
    --grid N        snap onsets/durations to 1/N of a quarter (default 4 = 16ths).
                    Exported MIDI is usually humanised by a few ticks; without
                    this every onset reads as 13.0254 instead of 13.
    --shift Q       add Q quarters to every onset (align two dumps whose pickups
                    start at different absolute times)
    --transpose N   transpose by N semitones (compare a transposed ABC to its source)
    --flat          one "NAME@onset/duration" per line, nothing else, for `diff`

Durations and onsets are in quarter notes throughout, so they read straight
across to ABC: in L:1/8 an onset of 1.5 is the fourth eighth of the bar.
"""

import argparse
import struct
from collections import defaultdict

NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def name(pitch):
    return f'{NAMES[pitch % 12]}{pitch // 12 - 1}'


def read_varlen(data, i):
    value = 0
    while True:
        byte = data[i]
        i += 1
        value = (value << 7) | (byte & 0x7F)
        if not byte & 0x80:
            return value, i


def parse(path):
    """Return (notes_by_channel, programs, timesig, tempo_bpm).

    notes_by_channel maps channel -> list of (onset_quarters, pitch, dur_quarters).
    """
    data = open(path, 'rb').read()
    if data[:4] != b'MThd':
        raise SystemExit(f'{path}: not a MIDI file')
    _fmt, ntracks, division = struct.unpack('>HHH', data[8:14])
    if division & 0x8000:
        raise SystemExit('SMPTE time division is not supported')

    notes = defaultdict(list)
    programs, timesig, tempo = {}, (4, 4), None
    i = 14
    for _ in range(ntracks):
        if data[i:i + 4] != b'MTrk':
            break
        length = struct.unpack('>I', data[i + 4:i + 8])[0]
        track = data[i + 8:i + 8 + length]
        i += 8 + length

        j, clock, running, sounding = 0, 0, None, {}
        while j < len(track):
            delta, j = read_varlen(track, j)
            clock += delta
            if track[j] & 0x80:
                running = track[j]
                j += 1
            status = running
            if status == 0xFF:
                meta = track[j]
                j += 1
                size, j = read_varlen(track, j)
                payload = track[j:j + size]
                j += size
                if meta == 0x58 and len(payload) >= 2:
                    timesig = (payload[0], 2 ** payload[1])
                elif meta == 0x51 and len(payload) == 3:
                    tempo = 60_000_000 / struct.unpack('>I', b'\0' + payload)[0]
            elif status in (0xF0, 0xF7):
                size, j = read_varlen(track, j)
                j += size
            else:
                kind, channel = status & 0xF0, status & 0x0F
                nargs = 1 if kind in (0xC0, 0xD0) else 2
                args = track[j:j + nargs]
                j += nargs
                if kind == 0xC0:
                    programs[channel] = args[0]
                elif kind == 0x90 and args[1] > 0:
                    sounding[(channel, args[0])] = clock
                elif kind == 0x80 or (kind == 0x90 and args[1] == 0):
                    key = (channel, args[0])
                    start = sounding.pop(key, None)
                    if start is not None:
                        notes[channel].append(
                            (start / division, args[0], (clock - start) / division))
    return notes, programs, timesig, tempo


def snap(value, grid):
    return round(value * grid) / grid if grid else value


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--channel', type=int)
    ap.add_argument('--chords', type=int)
    ap.add_argument('--grid', type=int, default=4)
    ap.add_argument('--shift', type=float, default=0.0)
    ap.add_argument('--transpose', type=int, default=0)
    ap.add_argument('--flat', action='store_true')
    args = ap.parse_args()

    notes, programs, timesig, tempo = parse(args.file)
    barlen = timesig[0] * 4.0 / timesig[1]

    def prepared(channel):
        out = []
        for onset, pitch, dur in sorted(notes[channel]):
            out.append((snap(onset, args.grid) + args.shift,
                        pitch + args.transpose,
                        snap(dur, args.grid)))
        return out

    if args.channel is None and args.chords is None:
        print(f'time signature {timesig[0]}/{timesig[1]}  '
              f'({barlen:g} quarters per bar)   tempo '
              f'{tempo:.1f} bpm' if tempo else f'time signature {timesig[0]}/{timesig[1]}')
        print()
        print('channel  program  notes  range          first onset')
        for channel in sorted(notes):
            events = sorted(notes[channel])
            pitches = [p for _, p, _ in events]
            print(f'{channel:>7}  {programs.get(channel, "-"):>7}  {len(events):>5}  '
                  f'{name(min(pitches)):<5}-{name(max(pitches)):<8}  '
                  f'{snap(events[0][0], args.grid):g}')
        print()
        print('The melody is usually the channel with a one-note-at-a-time texture and a')
        print('range around C4-C6. A channel whose notes arrive in simultaneous stacks is')
        print('the accompaniment -- run --chords on it to read the harmony off the')
        print('arrangement instead of deriving it.')
        return

    if args.chords is not None:
        bars = defaultdict(lambda: defaultdict(set))
        for onset, pitch, _ in prepared(args.chords):
            bars[int(onset // barlen)][snap(onset % barlen, 2)].add(NAMES[pitch % 12])
        for bar in sorted(bars):
            beats = ' | '.join(f'{beat:g}:{"".join(sorted(pcs))}'
                               for beat, pcs in sorted(bars[bar].items()))
            print(f'bar@{bar * barlen:g}  {beats}')
        return

    events = prepared(args.channel)
    if args.flat:
        for onset, pitch, dur in events:
            print(f'{name(pitch)}@{onset:g}/{dur:g}')
        return

    bars = defaultdict(list)
    for onset, pitch, dur in events:
        bars[int(onset // barlen)].append(
            f'{name(pitch)}@{onset % barlen:g}/{dur:g}')
    for bar in sorted(bars):
        print(f'bar@{bar * barlen:<6g} {" ".join(bars[bar])}')


if __name__ == '__main__':
    main()
