---
name: abc-keys
description: Fix a wrong or awkward key signature in an ABC tune under abc/ — diagnose why a tune is littered with naturals or sharps, pick the signature (often modal) that minimises accidentals, and prove the rewrite changed no pitches. Use when a tune "looks messed up", has a weird key, or needs lots of accidental marks.
---

# Fixing key signatures in the ABC tunes

## The symptom

A tune whose `K:` does not match its notes still *sounds* right — every note
just carries an explicit accidental to cancel the wrong signature. It reads
terribly. Two shapes show up:

- `K:` too flat → forests of naturals (`=G`, `=d`, `=a`)
- `K:` too sharp / too plain → forests of sharps (`^F`, `^c`, `^g`)

## 1. Count the damage first

```
node .claude/skills/abc-keys/scripts/report_keys.mjs abc/pop/popcorn.abc
```

Prints, per tune, the `K:` field, the signature abcjs derives from it, and how
many explicit accidentals the notes carry. More than a handful in a folk or pop
tune means the signature is wrong. Re-run it after the fix to show the drop.

## 2. Work out the real key

Read the **chord symbols** — they name the tonality far faster than the notes
do. `Cm Bb Ab Eb Gm F` is C-something; `Bm A G D F#m E` is B-something.

Then decide major/minor/modal from the accidentals that actually appear:

- If one scale degree appears **both** raised and lowered, the tune is modal or
  borrows. Pick the signature matching the **more frequent** version and write
  the rare one explicitly.
- A minor tune with a **major IV chord** (Cm with F major, Bm with E major) is
  **dorian** — raised 6th. Use `K:Cdor`, `K:Bdor`. abcjs renders these as a
  plain 2-flat / 3-sharp signature with the right tonic, which is standard in
  folk notation and much better than forcing `K:Cm` and cancelling the 6th on
  every note.
- Modes abcjs accepts: `dor phr lyd mix aeo loc`, e.g. `K:Ador`, `K:Gmix`.

Worked example — `abc/pop/popcorn.abc` was `K:Db` (5 flats) for music in C.
Chords `Cm … F` (major IV) ⇒ C dorian ⇒ 2 flats ⇒ 44 accidentals became 1.

## 3. Rewrite the notes

Strip the accidentals the new signature now supplies, and add the few it does
not. Two rules that are easy to get wrong:

- **An accidental holds for the rest of its bar.** `B^F E<F` is B F# E **F#** —
  the second F inherits the sharp. Do not "helpfully" respell it as F natural.
- **Octave matters for the letter, not the accidental.** `G` and `g` are both
  cancelled/sharpened by the same signature entry.

## 4. Prove you changed nothing

This is the important step: the notation is *supposed* to differ, so a text
diff proves nothing. Compare the rendered MIDI instead.

```
git show HEAD:abc/pop/popcorn.abc > /tmp/old.abc
node .claude/skills/abc-keys/scripts/compare_pitches.mjs /tmp/old.abc abc/pop/popcorn.abc
```

It renders both through the app's own abcjs and diffs the note-on events per
tune. Anything but "All tunes sound identical" means you altered the music —
usually by missing an in-bar accidental carry (rule above). Chord-symbol
accompaniment is included in the comparison, so a changed chord shows up too.

Also run the chord/bar-length check from the sibling skill:

```
node .claude/skills/abc-chords/scripts/check_abc.mjs abc/pop/popcorn.abc
```

## Notes

- Both scripts share one cached abcjs bundle at
  `.claude/skills/abc-chords/scripts/abcjs-cache.js`, downloaded on first run.
- Renaming or retitling a tune means the file list must be regenerated
  (`py scripts/update_data.py`) — but a pure key-signature fix does not.
