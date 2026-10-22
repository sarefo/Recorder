# TODO

## Practice feedback: find where I struggle and suggest drills

Goal: the app learns which notes, fingerings and transitions give me trouble
and suggests practice for them. The dashboard (button in the "..." overlay)
says which tunes are due and, since the red-mark tracking below, which notes
and note changes keep going wrong.

### Signal: the red/green note marks (done)

Tapping a note cycles it neutral, red, green (`fingering-manager.js`,
`data-state` on `.note-marker-zone`). `MarkTracker` (`js/core/mark-tracker.js`)
turns that into data:
- A red mark counts only after it has stayed 10 seconds on the same tune
  (`MarkTracker.DWELL_MS`). Passing through red on the way to green, clearing
  it, or switching tunes records nothing.
- A green mark that stays 10 seconds takes one red count off the note.
- Each counted mark is stored in `marks[path][noteIndex]` in the user data with
  the pitch, the previous pitch (null after a rest; tied-on notes skipped), the
  count, the time, and how often that pitch and that note change occur in the
  tune. Merged across devices, the copy changed last wins.

### Analysis (done, first version)

`PracticeDashboard.findStruggles` groups marks by single note and by note
change (previous note to this note), not by tune. A pattern is reported when
it has at least 3 red marks in at least 2 tunes
(`STRUGGLE_MIN_MARKS`, `STRUGGLE_MIN_TUNES`). Ranked by weighted marks divided
by how often it occurs in the marked tunes, where a mark loses half its weight
every 60 days. Shown as "Where you struggle" on the dashboard.

Known weakness: how often a pattern occurs is only known for tunes that have
marks, so the rate leans high. Fix if the ranking looks off: store a pitch and
note-change histogram per tune whenever a tune is played, and divide by the
total over all tunes played.

### Still to do
- Use it: a reason line in "Practice next" ("contains your weak change F#5 to
  E5"), and tunes from the library that contain a weak pattern with few other
  difficulties.
- Generate a short drill: the pattern looped, slow.
- Show saved red marks again when a tune is reopened. Marks are stored by note
  index plus pitch, so after an edit or a transposition the pitch can be
  compared and stale marks dropped.
- Group by fingering instead of pitch name (enharmonic notes and octaves that
  share a fingering shape, and thumb hole plus several fingers changing at
  once), using `getFingeringForNote`.
- Tell "hard" from "I played it wrong this time". Probably an explicit second
  meaning later if the data looks noisy.
- A "mark hard bars" action (tap a bar, not a note) may be less fiddly while
  playing, then spread the mark to the notes in the bar.
- Cheaper alternative to marking by hand: have the app listen (the tuning code
  already uses the microphone) and detect wrong or late notes. Much bigger
  project; only worth it if hand marking turns out to be too much friction.
