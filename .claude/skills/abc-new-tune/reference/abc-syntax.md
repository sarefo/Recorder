# ABC syntax, as this repo uses it

Reference for writing a tune file by hand. abcjs 6.4.4 is the parser; anything
it accepts, the app renders.

## File shape

```
X:1
T:Bahay Kubo
O:Philippines (Tagalog)
N:Melody transcribed from the flutetunes.com setting; chords derived from the melody
M:3/4
Q:1/4=132
L:1/8
K:C
G2 |"C" c4 d2 |"G" B4 G2 | ...
```

Header fields, in the order used here. `X`, `T`, `M`, `L` and `K` are the only
required ones, and **`K:` must come last** — it ends the header and starts the
music.

| Field | Meaning | Notes |
|---|---|---|
| `X:` | tune number | `1`; a second setting in the file is `X:2` |
| `T:` | title | becomes the display name in the file browser |
| `C:` | composer | omit for anonymous traditional tunes |
| `O:` | origin | `Philippines (Ilocano)`, `trad Korea` — shown as a subtitle |
| `N:` | note | **use this for provenance**: where the melody came from, whether it was transposed |
| `Z:` | transcriber | who made the transcription, if the source names one |
| `M:` | meter | `4/4`, `3/4`, `6/8`; `C` means 4/4 |
| `Q:` | tempo | `1/4=132`; in 6/8 use the dotted beat: `3/8=44` |
| `L:` | default note length | `1/8` throughout this repo unless the tune argues otherwise |
| `K:` | key | `C`, `F`, `Em`, `Dm`, `Bb`; modal keys as `Ddor`, `Gmix` |

## Pitch

Octave is encoded by case and by commas/apostrophes. This is the single easiest
thing to get wrong, and a wrong octave is invisible on a quick read-back:

| ABC | Sounds |
|---|---|
| `C,` | C3 |
| `C` `D` `E` `F` `G` `A` `B` | C4 (middle C) up to B4 |
| `c` `d` `e` `f` `g` `a` `b` | C5 up to B5 |
| `c'` | C6 |

So `B,` is below middle C, while `B` is the B *above* it — in a tune that dips
below the staff, `B,` and `B` sit a seventh apart.

**The key signature applies to letters.** In `K:F`, a written `B` is B♭; the
figure `BAGF` is a B♭ figure, not B natural. This trips up chord derivation
constantly.

## Duration

Durations multiply `L:`. With `L:1/8`:

| ABC | Length |
|---|---|
| `c` | eighth |
| `c2` | quarter |
| `c3` | dotted quarter |
| `c4` | half |
| `c6` | dotted half |
| `c8` | whole |
| `c/` | sixteenth |
| `c3/2` | dotted eighth |
| `c/4` | 32nd |

Rests are `z` with the same numbers: `z4` is a half rest.

Check every bar adds up. In `M:3/4` with `L:1/8` a full bar is 6; in `M:6/8`
it is also 6; in `M:4/4` it is 8. `check_abc.mjs` reports any bar that does not,
as a fraction of a measure.

## Accidentals

`^` sharp, `_` flat, `=` natural, placed before the letter: `^c`, `_B`, `=B`.
They last to the end of the bar, as on paper. Use `=` to cancel a key signature
accidental — in `K:F`, `=B` is B natural.

## Chord symbols

A quoted string immediately before the note it lands on:

```
"Dm" defe "A7" d2 |
```

Two per bar is the most this repo uses, and only where the harmony really moves
mid-bar. Placement is by note, not by beat, so put the symbol before the note
that falls on the beat you mean. `check_abc.mjs` prints the chord sequence in
playing order — read it back as a progression to catch a symbol attached to the
wrong note.

A leading `^`, `_` or `<` inside the quotes makes it an annotation rather than a
chord (`"^gently"`), positioned above/below/left.

## Bars, repeats, structure

| ABC | Meaning |
|---|---|
| `\|` | bar line |
| `\|]` | final bar line |
| `\|:` … `:\|` | repeat |
| `\|1` … `:\|2` … | first and second endings |
| `-` after a note | tie: `c6-` at the end of a bar, `c4` at the start of the next |
| `(` `)` | slur |
| `(3` | triplet: `(3abc` |
| `>` `<` | broken rhythm: `a>b` is dotted-eighth + sixteenth |

A **pickup** is just a short first bar — write the notes and a bar line, and
abcjs works it out. `check_abc.mjs` will report it as a partial bar; that is
expected. Per the user's standing preference, **never put a chord on the
pickup** — the first chord goes on the first full bar.

## Layout

- One line of ABC per staff line; four bars per line reads well for most tunes.
- `%%` directives (`%%stretchlast true`, `%%score`) are passed to abcjs.
- `w:` under a music line adds lyrics, syllable per note, `-` between syllables
  of a word and `*` to skip a note. Most files here have none; only add them if
  the alignment is verified, since a mis-aligned `w:` line is worse than none.
- No dynamics (`!f!`, `!<(!`). They were explicitly removed once.

## Range: what the recorder can actually play

The fingering diagrams cover **written C4 to D6** (`js/fingering/fingering-manager.js`).
Anything outside that renders as notation but gets no diagram.

Most tunes here sit between D4 and E5. When a source sits awkwardly — a very low
melody, or a key with four flats — transpose it into a comfortable register and
say so in `N:`. If both the original key and a playable one matter, write them as
`X:1` and `X:2` in one file, the way `abc/korean/arirang.abc` does, and chord
both.
