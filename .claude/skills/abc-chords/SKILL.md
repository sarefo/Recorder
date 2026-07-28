---
name: abc-chords
description: Add or fix chord symbols in the ABC tune files under abc/ — how to research a tune, derive a progression from the actual notes, place the chords, and verify with abcjs offline. Use whenever asked to add, change or check chords/accompaniment for a tune in this repo.
---

# Adding chords to the ABC tunes

Tunes live in `abc/<tradition>/<name>.abc`. Chords are plain ABC chord symbols
in double quotes, immediately before the note they land on:

```
"Dm"defe d2 "A"A^c |
```

## The user's standing preferences

Learned from feedback across several tunes — follow these without asking:

- **Research, don't guess.** The ask is always for *the right* chords.
- **Never chord the pickup.** The first chord goes on the first *full* bar.
  (Explicit correction: "I moved the first 'F' to the first actual full bar.")
- **Two chords per bar** where the melody moves in eighths and the harmony
  really changes mid-bar; one per bar otherwise. Don't chord every beat.
- **Don't add dynamics** (`!f!`, `!<(!`) — they were explicitly removed once.
- If a file has `X:1` and `X:2` (the same tune in two keys for different
  recorders), chord **both**, transposed.

## Researching a tune

Worth 5 minutes, but manage expectations: **published chords for these exact
settings usually do not exist.** Most files here are Nigel Gatherer
transcriptions, and the sources carry melody only.

What actually happens:

- `thesession.org` returns **HTTP 403 to WebFetch**. WebSearch surfaces it, but
  you cannot read the page. Don't burn calls retrying.
- tunearch.org and chordify give generic or wrong-setting chords.
- abcnotation.com sometimes has a chorded setting — worth one look.

So use research to establish **facts about the tune** — composer, key, whether
it is modal, what a standard accompaniment looks like — then derive the actual
progression from the notes in front of you. That is what has been accepted.

## Deriving the progression

1. **Find the real tonic — the key signature lies.** Look at the note each part
   ends on. `K:C` ending on D is **D Dorian**, not C major; `K:C` ending on G is
   G Mixolydian. Scottish tunes here do this constantly (Balquidder Lasses,
   Caber Feigh). Get this wrong and every chord is a degree off.
2. **Scan half-bar by half-bar.** Collect the pitches, weight the notes on beats
   1 and 3, and match against the diatonic triads of the real mode. Passing
   eighths do not need covering.
3. **Prefer the chord that contains the beat-1 and beat-3 notes.** Concretely:
   `f3 g f2 d2` is Dm, not F — F has the `f` but not the `d` on beat 4.
4. **Accidentals are usually functional, not decorative.** A `^c` in a D-Dorian
   tune that lands on `d2` is a real A/A7 dominant. A `=F` in G Dorian is the
   raised 6th, so IV is major.
5. **Sanity-check the cadence.** Modal tunes cadence ♭VII–i (C–Dm in D Dorian),
   major tunes V–I or V7–I. If your last two bars don't, re-check step 1.
6. **Remember the key signature when reading letters.** In `K:F`, a `B` in the
   tune is B♭ — so `BAGF` is a B♭ figure, not B natural.

Typical vocabularies that have worked here: D Dorian → Dm / C / G (+ A7);
G major → G / Em / C / D; F major → F / Dm / Gm / B♭ / C.

## Verify before committing

```bash
node .claude/skills/abc-chords/scripts/check_abc.mjs abc/scottish/*.abc
```

Runs the same abcjs 6.4.4 the app uses, in Node, no browser needed. Prints
parser warnings, the chord sequence in playing order, and any partial bars.
Caches the abcjs bundle next to itself on first run (needs network once).

Read the output like this:

- **Chord sequence** — the real check. Read it back as a progression and
  confirm it is the one you intended; a chord attached to the wrong note shows
  up here as an out-of-order symbol.
- **Warnings** — compare against the file *before* your edit rather than
  demanding zero. Some are pre-existing and harmless: `$` linebreak markers
  warn "Unknown character ignored" under `parseOnly` even with `I:linebreak $`
  in the header.
- **Partial bars** — pickups, voltas and part-ends legitimately show up.
  Only investigate ones that appear *because of* your edit. The check reads
  the meter from the header only, so a mid-tune `[M:4/4]` makes every later
  bar look wrong; ignore that.

`"^text"` annotations are also chord-position tokens, so they appear inline in
the chord list. That is expected, not a stray chord.

To actually *hear* it, see the `recorder-testing` skill.

## Committing

Just commit from inside `Recorder/`. The pre-commit hook regenerates the ABC
file lists and bumps `sw.js` / `main.js` versions — never edit those by hand.
