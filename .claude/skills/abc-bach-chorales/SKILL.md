---
name: abc-bach-chorales
description: Add a Bach chorale to abc/classical/bach/chorales/ with chord symbols taken from Bach's own four-part setting, using scripts/kern2abc.py and the Riemenschneider 371 Humdrum corpus. Use when asked for another chorale, for more Bach, or to fix the harmony of one already here.
---

# Adding Bach chorales

Unlike every other tune in this repo, a chorale's harmony does not have to be
guessed — Bach wrote it down, and all 370 settings are machine-readable. So the
`abc-chords` "research, then derive" routine does not apply here. **Read the
chords off the score.**

## The corpus

<https://github.com/craigsapp/bach-370-chorales> — `kern/chor001.krn` …
`chor371.krn`, Riemenschneider numbering. Grab the whole zip once into the
scratchpad; per-file `raw.githubusercontent.com` fetches also work.

Every file is exactly four `**kern` spines, left to right **bass, tenor, alto,
soprano** — no spine splits anywhere in the corpus. Titles and BWV numbers are
in `!!!OTL@@DE:` and `!!!SCT:`.

```bash
for f in *.krn; do
  echo "$f|$(grep -m1 '^!!!OTL@@DE:' $f | sed 's/.*://')|$(grep -m1 '^!!!SCT:' $f | sed 's/.*://')"
done
```

## Converting

```bash
py scripts/kern2abc.py <chorNNN.krn> \
   --transpose <semitones> --steps <diatonic steps> \
   --key F --title "Wachet auf, ruft uns die Stimme" \
   --index 179 --note "Transposed up a whole tone from Bach's E-flat major." \
   --out "abc/classical/bach/chorales/wachet auf.abc"
```

- The soprano becomes the melody; chord symbols come from the pitch classes
  sounding in all four voices, emitted **only where the harmony changes**.
- `--transpose` is semitones, `--steps` is diatonic steps — pass both, or a
  transposition like E→F comes out spelled wrong.
- `--unit auto` (the default) picks `L:1/4` for a chorale that moves in quarters
  and eighths, `L:1/8` once anything dotted or finer appears.
- `--index` should be the Riemenschneider number, matching the two older Bach
  files in `abc/classical/bach/`.

Warnings on stderr are worth reading, not suppressing:

- `harmony X at beat N falls under a held note` — a real chord change that a
  lead sheet cannot show. Normal at final cadences; frequent elsewhere means the
  chorale moves faster than one chord per melody note.
- `open fifth on X read as Xm` — Bach omitted the third; the script copies the
  quality that root has elsewhere in the same tune. Spot-check these.
- `dropped an unnameable sonority` / `BELOW RECORDER RANGE` — look at those.

## Choosing which ones

**Range is almost never the problem.** Chorale sopranos sit inside a soprano
recorder's compass (midi 60–84) in Bach's own key roughly 25 times out of 26.
The key *signature* is the problem: several chorales are in E♭ or A♭.

The house rule the user settled on: keep D, G, F, C, B♭ and the minors
(Em, Am, Dm, Gm, Bm) as Bach wrote them; move anything in E♭, A♭ or A major to
F or G. Always say so in an `N:` line.

**Check for duplicate melodies before adding.** Many chorale texts share one
tune, and the corpus has several settings of each — "Befiehl du deine Wege" is
note-for-note "O Haupt voll Blut und Wunden"; there are four "Jesu, meine
Freude" and five "Wie schön leuchtet der Morgenstern". Compare soprano interval
sequences, not titles.

## Gotchas already paid for

- **Rests are structural.** 74 files use `4r` between phrases. Dropping them
  leaves three-beat bars. They must reach the ABC as `z`.
- **Ties crossing a barline** must stay two notes joined by `-`, or the barline
  disappears and a 6/4 bar appears in a 3/4 tune.
- **Never chord the pickup** — and the pickup often has no barline before it,
  so detect it as "first barline position > 0", not "first bar is short".
- **abcjs has no `aug` or `mMaj7`.** Use `+` for augmented; a minor-major
  seventh is always an appoggiatura here, so let the analyzer name the triad
  underneath it instead.

## Verifying

```bash
node .claude/skills/abc-chords/scripts/check_abc.mjs abc/classical/bach/chorales/*.abc
```

Expect **zero warnings**. Partial bars are expected and correct: a chorale in
barform reads `1=0.25 5=0.75 6=0.25 14=0.75` — a quarter-bar pickup, each
section closing three-quarters short to absorb it.

To prove the chords actually sound, build the synth in the browser
(`recorder-testing`) and check it produces two tracks:

```js
const s = new ABCJS.synth.CreateSynth();
await s.init({ visualObj: tune, options: { program: 13, chordprog: 106, chordsOff: false } });
s.flattened.tracks.length          // 2: melody (prog 13) + chords (prog 106)
```

One track means every chord symbol was ignored.
