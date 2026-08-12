---
name: abc-rhythm
description: Renotate an ABC tune under abc/ that is written at the wrong note values — a staff crawling with sixteenths, dotted eighths and fractional durations like `c3/2 d/` — by scaling every duration and rebarring, then proving the music still sounds identical. Use when a tune is "hard to read", "too many short notes", "too busy", or its rhythm looks finer than the rest of the repertoire.
---

# Fixing note values in the ABC tunes

Sibling of `abc-keys`: same shape of problem (the tune *sounds* right but reads
badly), different axis. `abc-keys` fixes the vertical, this fixes the horizontal.

## The symptom

MIDI-derived transcriptions often land an octave too fine rhythmically: what a
human would write as a quarter note comes out as an eighth, so ordinary folk
rhythms turn into sixteenths and fractional ABC durations.

```
"F" c3/2 d/ c B A3 A |"F" c c B A"C7" G4 |     # hard to read
```

Tells:

- `3/2` and bare `/` durations all over the tune
- lots of sixteenth beams on screen for a song sung at a walking pace
- one lyric line squeezed into a bar or two
- `Q:` of 120+ with the melody moving mostly in eighths

Compare against a well-notated sibling — `abc/philippine/leron leron sinta.abc`
is the house style at `L:1/8`, with `G3 F E2 F2` (dotted quarter, eighth,
quarter, quarter) as the fastest thing in it. A tune whose figures are exactly
half of that is a rescale candidate.

The reverse also happens — everything written in whole and half notes, a bar
per note — and takes factor `0.5`.

## 1. Confirm it is a rescale, not a bad transcription

Add up one bar in `L:` units and check it fills the meter. If bars are already
inconsistent the problem is the transcription, not the note values — stop and
fix that first.

## 2. Scale every duration, then rebar

Keep `L:1/8` (the repertoire standard) and multiply durations instead. At
factor 2:

| before | after | meaning |
|---|---|---|
| `x/` | `x` | 16th → 8th |
| `x` | `x2` | 8th → quarter |
| `x3/2` | `x3` | dotted 8th → dotted quarter |
| `x2` | `x4` | quarter → half |
| `x3` | `x6` | dotted quarter → dotted half |
| `x4` | `x8` | half → whole |

Each old bar now spans **two** bars, so rebar as you go and re-place the
barlines by hand. Watch for:

- **Beaming — the easy one to get wrong.** Whitespace breaks beams in ABC.
  Scaling turns beamed sixteenths into eighths that must *stay* beamed, so
  notes that shared a beam before must still share one after: write `e2 ee d2 d2`,
  never `e2 e e d2 d2`. Space separates beats, not notes. Quarters and longer
  cannot beam, so leave those spaced. The rest of the repertoire already does
  this (`dandansoy.abc`: `e4 Bc`, `A4 AA`).
- **Chord symbols.** A chord attached mid-bar in the old notation often lands on
  the downbeat of the second new bar — put it there. Carry the prevailing chord
  onto any new bar that would otherwise start bare; the repertoire marks a chord
  on every bar.
- **Notes that straddle the new barline.** If a doubled duration overflows,
  split it and tie (`A8-|A2`). Usually it does not: a figure that fitted a beat
  before fits a bar now. If it happens a lot, the factor is wrong.
- **Accidentals.** `=B` stays `=B`, but it now guards a different bar — an
  accidental only holds to the end of *its* bar, and rebarring moves that end.

Layout 4 new bars per line, matching the rest of the repertoire.

## 3. Fix the tempo so the music does not change speed

Scaling durations by 2 without touching `Q:` halves the playback speed. Either
double the number (`Q:1/4=120` → `Q:1/4=240`) or, better, express it per half
note — `Q:1/2=120` — which reads as a sane beat and is already used elsewhere
(`abc/french/ai vist lo lop.abc`).

Note what happened in the header so the next reader is not puzzled:

```
N:Notated at double note values (quarters/eighths instead of eighths/sixteenths); the sounding tempo is unchanged
```

## 4. Prove you changed nothing

A text diff proves nothing (the notation is meant to differ), and
`abc-keys/scripts/compare_pitches.mjs` does **not** work here — its MIDI clock
is measured in beats, which is exactly what a rescale changes. Use:

```
git show HEAD:abc/philippine/pamulinawen.abc > /tmp/old.abc
node .claude/skills/abc-rhythm/scripts/check_rescale.mjs /tmp/old.abc abc/philippine/pamulinawen.abc 2
```

It checks same notes in the same order at the same pitches, every duration
scaled by exactly the factor, every new bar metrically complete, and identical
total sounding time under each file's own `Q:`. Anything else means a rebarring
or tempo slip.

Then the usual bar/chord check:

```
node .claude/skills/abc-chords/scripts/check_abc.mjs abc/philippine/pamulinawen.abc
```

## Notes

- Worked example: `abc/philippine/pamulinawen.abc`, commit "Renotate
  Pamulinawen at double note values" — 16 bars of sixteenths became 32 bars
  whose shortest note is an eighth, at the same 32 seconds of music.
- The script shares the cached abcjs bundle at
  `.claude/skills/abc-chords/scripts/abcjs-cache.js`, downloaded on first run.
- A pure renotation changes no title or filename, so `py scripts/update_data.py`
  is not needed (the pre-commit hook runs it regardless).
