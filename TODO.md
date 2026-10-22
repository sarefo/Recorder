# TODO

## Practice feedback: find where I struggle and suggest drills

Goal: the app learns which notes, fingerings and transitions give me trouble
and suggests practice for them. The dashboard (button in the "..." overlay)
already says which tunes are due; this would say what to work on inside and
across tunes.

### Signal: the red/green note marks

Tapping a note already cycles it neutral, red, green (`fingering-manager.js`,
`data-state` on `.note-marker-zone`). The state only lives in the DOM and is
gone when the tune changes. Red is a direct "this note was hard" signal, at the
granularity the analysis needs, so it is the cheapest source to start with.
A tune-level status ("needs practice") is too coarse for this.

Step 1, persist the marks:
- Store per tune, per note index: `marks: { <path>: { <noteIndex>: { red, green, at } } }`
  in the user data, merged across devices like the status log.
- A mark is a sample, not a state: keep a count of red taps per note plus the
  date, so one bad day does not outweigh a month of clean plays. Green clears
  or decays red.
- Keep note indexes stable: they shift when a tune is edited or transposed.
  Store the pitch (written, in the recorder's own key) and the neighbors with
  the mark, not only the index.

Step 2, aggregate by fingering pattern instead of by tune:
- Map each marked note to its fingering (from `fingering-manager`) and to the
  previous note, so the unit is a single fingering, an interval or fingering
  transition (for example F# to low E, thumb hole plus several fingers
  changing at once), and short sequences.
- Score a pattern by red marks divided by how often it appears in the tunes
  played, so a pattern that is common and often red ranks above a rare one.
- Needs enough data before it says anything. Show nothing until a pattern has
  at least about 5 marks across 2 or more tunes, so it does not over-fit one
  hard bar.

Step 3, act on it:
- Dashboard card "Where you struggle": the top 3 patterns with the tunes where
  they occur.
- "Practice next" gets a reason line ("contains your weak transition F#-E").
- Optional: generate a short drill (the pattern looped, slow) or pick tunes
  from the library that contain the pattern with few other difficulties.

### Open questions
- Cheaper alternative to marking by hand: have the app listen (the tuning code
  already uses the microphone) and detect wrong or late notes. Much bigger
  project; only worth it if hand marking turns out to be too much friction.
- A "mark hard bars" action (tap a bar, not a note) may be less fiddly while
  playing, then spread the mark to the notes in the bar.
- Whether to count a red mark as "hard" or "I played it wrong this time".
  Probably add a second, explicit meaning later if the data looks noisy.
