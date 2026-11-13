# Tunes without chords

Living record of every tune under `abc/` whose first (`X:1`) setting has no
chord symbols, so we don't repeatedly research tunes that were already
researched. When chords are added, move the tune to the log at the bottom.

Sources that were tried and failed are noted per tune — do not retry them
without a new reason.

Re-check this list with the scanner:
`node %TEMP%\opencode\scan_chords.mjs` (script of 2026-11-12; any re-write
should parse X:1 with abcjs and count `el.chord`).

## No chords, by design

Do not look for chords for these.

| Tune | Why no chords |
|---|---|
| `practice/chromatic_scale.abc` | Scale exercise, no harmony to accompany. |
| `unsorted/test.abc` | Empty test stub. |
| `unsorted/spin the wheel.abc` | Duolingo Music practice tune (exercise, not a song). |
| `classical/bach/inventions/invention 01.abc` | Two-voice counterpoint; the piece is its own harmony, accompaniment chords under it would be noise. |
| `classical/scriabin/prelude 11.02.abc` | Freely chromatic harmony; any triad-plus-seventh reading is arguable and oom-pah chords sound wrong. |

## Deferred (possible, but a project of its own)

Chords exist in principle, but the obvious route failed or the work is bigger
than a pass. Only revisit with a concrete new source.

| Tune | Situation |
|---|---|
| `classical/schubert/impromptus/impromptus 1.abc` | Solo piano original; chords need the left hand off a MIDI of Op. 90 No. 1 (not found yet). |
| `bartok/romanian folk dances/1 joc cu bata.abc` | Bartók's own piano setting is polytonal, not chord symbols; a faithful reduction needs the two-hand original. |
| `bartok/romanian folk dances/2 braul.abc` | Same. |
| `bartok/romanian folk dances/3 pe loc.abc` | Same (mostly drone harmony under a modal line). |
| `tv/mash.abc` — chorded 2026-11-12 from the melody after all; the fitted-from-MIDI route stays dead (see log). |
| `georgian/gandagana.abc` | 60+ bars, modal, three transposed settings in one file; needs its own session with the musescore source. |
| `latino/tango/chamberguito.abc` | File is broken: the first `X:1` is empty, the playable setting has (12:7:2 tuplets abcjs ignores, and the transcriber noted the bars don't add up. The guitar chord track exists only as a commented-out voice. Fix the transcription first (re-read Villoldo's score), then chord off that voice. |
| `film/cannibal holocaust.abc` | Stub with no transcription (header + TODO only). Transcribe first. |
| `unsorted/dota/alles dur.abc` | Dota is a living band; only tabs sites (linked in the file), no ABC/lead sheet. Deriving from the melody alone would be guessing at a copyrighted arrangement. |

## To do — TV themes

All 42 remaining themes chorded 2026-11-12 (see log). Nothing left here.

## To do — film, pop, tango

All chorded 2026-11-12 except the deferred ones above (chamberguito,
cannibal holocaust stub, alles dur).

## To do — traditional songs

All chorded 2026-11-12 except `georgian/gandagana.abc` (deferred). The Chinese
pentatonic tunes (`670_songs` X:1, geming, huang hua cao) are harmonized
simply on purpose: pentatonic melodies admit many readings; the chosen one
follows the cadence notes.

## Log

- 2026-11-12: list created (94 tunes without chords: 5 by design, 5 deferred, 84 to do).
- 2026-11-12: chorded all 42 remaining TV themes and the 6 klezmer + 3 Yiddish
  tunes (51 files). TV chords came from re-downloading each hamienet MIDI,
  aligning our melody to the melody channel by interval sequence and reading
  the accompaniment in our bar grid (`fit_chords3.py` in the session temp dir;
  melody channel validated against the tune's own pitch-class profile, because
  some MIDIs double the tune a tritone away and several files' K: lines lie).
  Tunes whose MIDIs have no accompaniment (Cheers, Flintstones, Muppets, Pippi,
  GoT, Coronation Street, Doctor Who) and the klezmer set (source settings in
  allklez have no chords) were derived from the melody, cross-checked against
  sibling tunes in the same collections for the harmonic vocabulary. Chord
  qualities are plain triads/sevenths; expect the odd wrong bar, not the odd
  wrong key. `tv/rawhide.abc` already had fitted chords — it had been listed
  here by mistake.
- 2026-11-12 (second pass): chorded the film/pop set (Pink Panther, Colonel
  Bogey, Chariots of Fire, Concerning Hobbits, Itsumo Nando Demo, Galop
  Infernal, pop Yakety Sax — opening bars carried over from the fitted
  `tv/yakety sax.abc`, trio derived) and the traditional set (Which Side Are
  You On, El Cant dels Ocells, Seikilos, Dwa Serduszka, Nanita Nana,
  Muiñeira de Chantada, Reel du répertoire des frères Pigeon, She Moved
  Through the Fair, The Coolin, The South Wind, Aye Waukin O, Hector the
  Hero, Loch Lomond, Ar Hyd y Nos, Suo Gân, Tros y Garreg, Mylecharaine,
  Ny Kirree fo Niaghtey, Helston Furry Dance, geming, huang hua cao,
  670_songs X:1) — all derived from the melody per the abc-chords skill.
  Remaining without chords: 5 by design, 9 deferred (table above).
- 2026-11-12 (third pass): the Little Shop of Horrors score transcribed and
  chorded from hamienet MIDIs (whole score: prologue, Somewhere That's Green,
  Grow for Me, Suppertime, Suddenly Seymour, Dentist!, Da-Doo, Feed Me, Skid
  Row, Ya Never Know, Mushnik and Son, Gas, Call Back, The Meek Shall Inherit,
  Sominex, Dentist Chair Intro — ids 7926-7955). Every tune verified bar for
  bar against its MIDI (session-temp verify scripts; the few remaining diffs
  are tie continuations of unrepresentable 5-eighth notes). Chords fitted from
  each MIDI's accompaniment; Dentist's hook chords partly from the melody's
  own harmony, its source being melody plus drums there.
- 2026-11-13: reworked `film/pink panther.abc` — the game-music transcription
  was badly wrong (F naturals for F#'s, no C-B bar, the two riff endings
  swapped, bars of 12 and 16 eighths under a 4/4 header, Cm/Bb chords).
  Rewritten from three bitmidi arrangements (103005 + 85208 in Em, 103006 in
  Dm; two independent keys agreeing on every figure). Harmony read off the
  same accompaniments: a B7 vamp that never resolves, C7 under both A# bars
  (the melody's A# is C7's 7th), Em only at the final answer bars — much
  more like the record than the old Cm guess.
