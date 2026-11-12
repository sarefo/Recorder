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
| `tv/mash.abc` | hamienet MIDI (id 25506): fitted chords were tried and came out wrong — the accompaniment is an orchestral wash. Needs a lead sheet, not a fit. |

## To do — TV themes

All 42 remaining themes chorded 2026-11-12 (see log). Nothing left here.

## To do — film, pop, tango (8)

- [ ] `film/cannibal holocaust.abc` — slow guitar piece; derive
- [ ] `film/chariots of fire.abc` — Vangelis; palindrome harmony, derive
- [ ] `film/colonel bogey.abc` — march; easy to derive
- [ ] `film/concerning hobbits.abc` — derive (D major pedal patterns)
- [ ] `film/itsumo nando demo.abc` — derive; a lead sheet may exist (mu-tech `index_Japanese_song`?)
- [ ] `film/pink panther.abc` — derive (chromatic blues; mostly one chord per bar)
- [ ] `pop/yakety sax.abc` — norbeck transcription, two parts + trio; `tv/yakety sax.abc` has the fitted opening as reference
- [ ] `latino/tango/chamberguito.abc` — Villoldo; trillian's tango folders hold chorded ABCs
- [ ] `unsorted/dota/alles dur.abc` — Dota (German band) song; tabs linked in the file (911tabs). Copyright, no ABC source; derive from the bass line if it can be heard, else defer.

## To do — traditional songs (23)

No published chords for these settings; derive per the abc-chords skill
(find the real tonic from the cadence, scan half-bar by half-bar). Check
abcnotation/theSession for a chorded setting first — one look each.

- [ ] `american/which side are you on.abc` — Appalachian song; the melody is close to "Foggy Dew" shapes; simple I-IV-V works
- [ ] `catalan/el cant dels ocells.abc` — derive; modal, ends on A (Dorian?)
- [ ] `chinese/670_songs.abc` — X:1 only ("Dongjia chimi wo chikang", Sichuan shange); K:G
- [ ] `chinese/geming.abc`
- [ ] `chinese/huang hua cao.abc`
- [ ] `cornish/helston furry dance.abc`
- [ ] `french/Reel du repertoire des freres pigeon.abc`
- [ ] `galician/muineira de chantada.abc`
- [ ] `georgian/gandagana.abc`
- [ ] `greek/seikilos epitaph.abc` — complete ancient monody; simple diatonic chords fit, drone-like
- [ ] `irish/she moved through the fair.abc`
- [ ] `irish/the coolin.abc`
- [ ] `irish/the south wind.abc`
- [ ] `manx/mylecharaine.abc`
- [ ] `manx/ny kirree fo niaghtey.abc`
- [ ] `polish/dwa serduszka.abc`
- [ ] `scottish/aye waukin o.abc`
- [ ] `scottish/hector the hero.abc` — A major Scottish air, V–I cadences; easy
- [ ] `scottish/loch lomond.abc`
- [ ] `spanish/nanita nana.abc`
- [ ] `welsh/ar hyd y nos.abc`
- [ ] `welsh/suo gan.abc`
- [ ] `welsh/tros y garreg.abc`

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
