---
name: abc-new-tune
description: Add a new tune to the abc/ repertoire from scratch — find a melody source you can actually trust, extract the notes (and often the chords) from it, write the ABC, and prove the transcription matches the source before committing. Use when asked to add a song, a set of songs, or a whole tradition to this app, as opposed to editing a tune that is already here.
---

# Adding a new tune to the repertoire

`abc-chords` fixes the harmony of a tune that already exists. `abc-keys` fixes
its key signature. This skill is for the step before both: getting a *correct
melody* into `abc/<tradition>/<name>.abc` in the first place.

## The hard part is sourcing, not notation

Writing ABC takes minutes. Finding a melody you can defend takes most of the
work, and it is the only part that can silently go wrong.

**Never transcribe a tune from memory, however well you think you know it.**
A famous folk song feels unambiguous right up to the point where you write down
the wrong interval in bar 4 and nothing in the app will ever flag it. If no
source can be found for a tune, say so and leave it out — a short set of correct
tunes beats a long set with one quietly broken one.

Read `reference/sources.md` for the search routes that actually pay off, which
ones are dead ends, and the exact URL patterns.

## What a usable source looks like

In descending order of value:

1. **A lead sheet you can read.** Melody *and* printed chords, so the harmony is
   sourced rather than derived. Rare, worth chasing.
2. **A MIDI arrangement with a separate accompaniment channel.** Nearly as good:
   the melody is exact, and the chord track gives the arranger's harmony bar by
   bar. Very common in school/folk MIDI libraries.
3. **A melody-only MIDI or a flute/recorder score.** Exact notes, no chords —
   derive those with `abc-chords`.
4. **Letter notes / number notation from a tab site.** Pitches only, *no
   rhythm*. Fine as a cross-check on a source you already have; not enough on
   its own. A tune where this is all you can find is a tune to skip.

Score images and PDFs are readable: download them and open them with the Read
tool. If the engraving is too small to tell a line from a space, crop the system
and upscale it first (Pillow is installed):

```python
from PIL import Image
im = Image.open('score.jpg').crop((0, 90, 1310, 245))
im.resize((im.width * 2, im.height * 2), Image.LANCZOS).save('system1.png')
```

### Staff notation with no MIDI: read it twice, two different ways

For a whole piece that exists only as staff-notation images (scans, screenshots
of a choral score), eyeballing line-vs-space at screen resolution WILL produce
wrong notes. `scripts/staff_scan.py` (built for Bua Kao, 2026-08) machine-reads
a one-staff crop: it detects the staff lines, prints every notehead it can find
as x-position + pitch letter + filled/hollow, and lists the barline positions.
Crop each system's staff to its own band (~25px line spacing after a 3x
upscale), run it, then generate its `--tint` image — background striped one
colour per diatonic letter, labels in the margin — and read that visually as
the second, independent pass:

```bash
py .claude/skills/abc-new-tune/scripts/staff_scan.py band3x.png --tint t.png
py ... staff_scan.py bassband.png --clef bass          # SATB bass for chords
```

The detector misses some heads (nicked hollow rims, graces, odd flags) — the
tint read fills the gaps, and disagreements get a dedicated 3-4x zoom crop.
What replaces the source-MIDI diff as proof: every bar must sum to the meter
using the detected barlines, every tie must join equal pitches (including
across systems), and the harmony implied by the bass staff must be functional.
An SATB score's bass staff, read the same way at bar level, gives *sourced*
chords instead of derived ones. Pitch names are diatonic letters — apply the
key signature yourself, and remember graces/lyrics can be omitted but say so
in `N:`.

## Extracting from a MIDI

`scripts/midi_notes.py` does all three jobs. Start with the summary:

```bash
py .claude/skills/abc-new-tune/scripts/midi_notes.py source.mid
```

It prints the time signature, tempo and one row per channel. Pick the melody by
texture and range — one note at a time, roughly C4–C6. Then:

```bash
py ... midi_notes.py source.mid --channel 0    # melody, grouped by bar
py ... midi_notes.py source.mid --chords 2     # accompaniment, pitch classes per bar
```

Onsets and durations are in quarter notes, and `--channel` prints them as an
offset within the bar, which reads straight across to ABC: in `L:1/8`, `@1.5/0.5`
is a sixteenth on the fourth eighth of the bar.

Notes on reading the output:

- **Exported MIDI is humanised.** Onsets arrive as 13.0254, not 13. `--grid 4`
  (the default) snaps to sixteenths. Raise it only if a tune genuinely uses
  32nds.
- **The first note is rarely at 0.** An accompaniment intro, or a pickup, means
  the melody starts mid-bar. Work out where bar 1 is before assigning any note
  to a beat — get this wrong and every chord lands a beat early.
- **`--chords` gives pitch classes, not chord names.** `ACE` is Am, `BDG#` is E7
  (or E, with the third of the scale raised — check the melody). A stack with a
  missing third, e.g. `ABF#`, is a shell voicing; look at how the same
  arrangement voices that chord in its intro before deciding between B7 and Bm.
- **The arrangement usually repeats the verse.** Find the loop point and
  transcribe one pass.

## Writing the ABC

See `reference/abc-syntax.md` for the syntax and this repo's conventions —
octave letters, durations under `L:1/8`, headers, and the recorder range the
fingering diagrams support.

## Verify: diff against the source

This is the step that makes the difference, and it is not optional. Render your
ABC back to MIDI and diff it against the source through the same parser:

```bash
S=.claude/skills/abc-new-tune/scripts
node $S/abc_to_midi.mjs abc/philippine/dandansoy.abc mine.mid
py $S/midi_notes.py mine.mid      --channel 0 --flat --shift 13 > mine.txt
py $S/midi_notes.py source.mid    --channel 0 --flat            > src.txt
diff src.txt mine.txt
```

- `--shift` aligns the two pickups; nudge it until the first lines match.
- `--transpose N` (semitones) handles a tune you deliberately wrote in another
  key. A transposed transcription still diffs clean — that is the point.
- Trim the source to one verse (`head -n $(wc -l < mine.txt)`) if it repeats.

Every surviving difference must be one you can name out loud. "I lengthened the
final tonic from 4 beats to 6 because the source's 4 were followed by the
repeat's pickup" is fine. Anything you cannot explain is a transcription error,
and reading the notation back will not find it — a wrong octave or a dropped dot
looks perfectly plausible on the staff.

Then run the usual parse check and, for anything with an unusual meter or
rhythm, load it in the app (`recorder-testing`):

```bash
node .claude/skills/abc-chords/scripts/check_abc.mjs abc/philippine/*.abc
```

Expect zero warnings. The only partial bars should be your intended pickups.

## Check that it loops

The app repeats a tune by restarting it, so one pass has to last a whole number
of measures or the pulse limps at every wrap. A pickup has to be paid back by a
short final bar — write a 3-eighth anacrusis and end on a full bar and the loop
runs three eighths long forever.

```bash
node .claude/skills/abc-new-tune/scripts/abc_range.mjs abc/breton/*.abc
node .claude/skills/abc-new-tune/scripts/abc_loop_check.mjs abc/breton
```

It measures the MIDI abcjs renders rather than counting written bars, because
repeats, voltas, ties, tuplets and leading rests are all already resolved there.
The length is taken from the LAST NOTE-ON plus the written tail, not the last
note-off: abcjs shortens a note carrying a staccato dot, so a tune ending on one
would otherwise measure short. Inline `[Q:]` changes are stripped before
measuring, because abcjs scales tick durations by the tempo and a tune that
slows down measures long.

Traps it exists to catch, all found in real files here:

- **A repeat around a section that is already written out twice.** Tri Martolod's
  second strain ends with a 7/8 bar that pays back the tune's 1/8 pickup; that is
  right at the end of the tune and wrong in front of a `:|`, so the added repeat
  made every pass an eighth short.
- **A held final note that was squared off to fill its bar.** Son ar Chistr ends
  on a dotted half tied over the barline. Writing it as a plain `c4` in a full
  bar lost a quarter from every cycle; `c4- |c2` restores the source value *and*
  completes the 6/8 anacrusis.
- **A last bar with two jobs.** When the final bar sits in front of a `:|` it has
  to be full for the repeat and short for the loop. That needs a volta, not a
  compromise: `|1 ...full... :|2 ...short... |]`. Tarantella Napoletana, Highland
  Fling, Frank's Reel and both Bach chorales all wanted this.
- **A missing or a spurious barline.** A pickup glued to the bar after it
  (Waltzing Matilda, Nanita Nana), or a phrase-end and its pickup split apart
  (Schubert's Impromptu). Neither changes the tune's length, so only the bar
  listing finds them.

`--bad` prints only the failures, `--bars` also flags bars with too many beats.
A `SUSPECT` line means the script could not account for that tune and is not
judging it, not that the tune is wrong.

What it deliberately does not judge: a tune with no `K:` line (a stub), the bar
joins of a two-staff tune (the staves' bars are concatenated, so "the next bar"
is not a join anything plays), and a piece barred only at phrase ends, like the
Dowland pavan.

### abcjs limitations worth knowing

These are silent — the tune looks fine and plays wrong:

- **`[M:C]` inline is dropped.** Write `[M:4/4]`. Chiribim was playing half the
  tune in 2/4 because of this.
- **`[Q:]` inline is not read at all**, and each one is reported as an unknown
  bar type, so the score gets junk barlines through it. Grogg Mayles' last four
  bars were drawn in halves.
- **A tuplet wider than 9 is ignored**, ratio and all, so `(12:7:2` plays at
  written length (Chamberguito).
- **`startTriplet` is the *p* of `(p:q:r`, not the note count.** For `(3:2:2` it
  says 3 where two notes are in the tuplet. Close a tuplet on `endTriplet`.
- **A tuplet written as a bare fraction is not a tuplet.** `c2/3` is two-thirds
  of the unit length, which is what a triplet quarter is worth in `L:1/4` — but
  its partner has to be written too, or the bar comes up short. Use `(3:2:2`.

To see *which* bars are the wrong length, with the line they start on and the
notes in them, write the markdown report:

```bash
node .claude/skills/abc-new-tune/scripts/abc_loop_check.mjs     --bad --bars --skip 670_songs --report loop-check-report.md abc
```

`loop-check-report.md` in the repo root is that output, regenerated by the same
command. `--skip` leaves `abc/chinese/670_songs.abc` out: it is 664 Essen field
transcriptions kept as a *source* to pick tunes from, so its irregular bars are
as collected and are not ours to tidy.

## Registering the tune

```bash
py scripts/update_data.py
```

A new tradition is just a new folder under `abc/` — categories are derived from
the directory name, and nothing in `js/`, `index.html` or `css/` hardcodes the
list. Name the folder like the ones beside it: an adjective (`peruvian`,
`japanese`, `philippine`), not a demonym or a language.

`T:` becomes the display name, so title-case it properly. The filename is
lower-case with spaces.

## Committing

Commit from inside `Recorder/`; the pre-commit hook regenerates the file lists
and bumps `sw.js` / `main.js`. **`Recorder` is its own repo** nested inside the
`sarefo.github.io` working copy, and GitHub Pages serves it at
`sarefo.github.io/Recorder` — so a tune is only live once `master` of the
`Recorder` repo is pushed. Committing to a side branch deploys nothing.
