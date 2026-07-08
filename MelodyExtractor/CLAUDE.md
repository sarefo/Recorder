# MelodyExtractor - CLAUDE.md

Standalone web app that extracts melody from audio files and transcribes to ABC notation with human-in-the-loop correction.

## Running

- URL: http://localhost:8000/Recorder/MelodyExtractor
- No build step - uses ES modules directly
- Test harness: http://localhost:8000/Recorder/MelodyExtractor/test/harness.html —
  synthesizes melodies with known ground truth (repeated notes, vibrato,
  octave-trap timbres), runs the full pipeline, scores note F1 + rhythm
  accuracy + tempo estimation. Results in `window.__testResults`.
  Run it after any change to detection, segmentation or ABC generation.

## Architecture

```
/MelodyExtractor/
├── index.html              # Single-page app with 3-step workflow
├── css/
│   ├── main.css            # Imports all modules
│   ├── base.css            # Variables, typography
│   ├── layout.css          # Step panels, grid layouts, ABC preview
│   ├── waveform.css        # Piano roll, spectrogram
│   ├── editor.css          # Note editing interface
│   ├── controls.css        # Buttons, inputs
│   └── responsive.css      # Mobile styles
└── js/
    ├── core/
    │   ├── main.js               # Entry point
    │   ├── melody-extractor.js   # Main controller
    │   └── utils.js              # Shared utilities (single source of truth)
    ├── audio/
    │   ├── audio-loader.js       # File loading, recording, tap detection
    │   ├── pitch-detector.js     # Optimized YIN: pitch + confidence + RMS energy per frame
    │   ├── ml-pitch-detector.js  # Optional Basic Pitch (ML) engine, CDN-loaded on demand
    │   └── synth.js              # Web Audio synth for playback
    ├── analysis/
    │   └── note-segmenter.js     # Median filter, octave fix, energy onsets → note events
    ├── visualization/
    │   ├── waveform-manager.js   # Wavesurfer.js (hidden, for audio playback)
    │   ├── region-manager.js     # Note regions
    │   ├── piano-roll.js         # Interactive editor with grid/snap
    │   └── spectrogram.js        # Canvas-based FFT spectrogram
    ├── editor/
    │   └── note-editor.js        # Selection, editing, re-timing
    ├── export/
    │   ├── abc-generator.js      # Notes → ABC string
    │   └── abc-preview.js        # ABCJS rendering
    └── ui/
        ├── workflow-manager.js   # Step navigation
        └── ui-controls.js        # Event handlers
```

## 3-Step Workflow

1. **Load & Detect** - Upload/record audio, configure detection, run pitch detection
2. **Review & Correct** - Edit notes in piano roll with ABC preview
3. **Export** - Generate ABC, copy/download, open in Recorder app

## Key Features

### Piano Roll + Spectrogram
- Notes displayed on piano roll with spectrogram behind
- Click to select, drag to move/resize
- Arrow keys for pitch, Delete to remove

### ABC Notation Preview
- Live updates as notes are edited
- Selected note highlighted in red (syncs with piano roll)
- Uses `.abcjs-note` class for accurate note indexing

### Re-time Mode
- Click "Re-time" button in review sidebar
- Audio plays from start
- Tap Right Ctrl for each note onset
- Notes get new start times (pitches preserved)
- Handles mismatched tap/note counts gracefully

### Snap to Grid
- Enable via "Snap to grid" checkbox
- Set tempo (BPM) and division (quarter, eighth, 16th, etc.)
- Beat grid lines shown on piano roll
- Note edges snap when dragging

### Recording with Tap Markers
- Record audio directly in browser
- Tap Right Ctrl during recording to mark note onsets
- Markers improve segmentation accuracy

## Detection Pipeline

Two engines, selectable in step 1 (`#detection-engine`):

- **Fast (default)**: optimized YIN in `pitch-detector.js` (difference function
  only up to maxPeriod, ~4x realtime) producing per-frame pitch/confidence/RMS.
  `note-segmenter.js` then median-filters the pitch track, corrects octave
  jumps against local context, detects energy onsets (this is what splits
  repeated same-pitch notes), and segments with hysteresis so vibrato and
  short dropouts don't split notes. Tap markers use this path.
- **AI (Basic Pitch)**: `ml-pitch-detector.js` lazy-loads Spotify Basic Pitch
  from esm.sh/unpkg (~9 MB), resamples to 22050 Hz, and reduces the
  polyphonic output to a melody line (drops overlapping harmonics).

## Rhythm Quantization (abc-generator.js)

`quantizeNotes()` is a tracking quantizer on a 16th grid anchored at the
FIRST NOTE ONSET: each onset is placed relative to the previous quantized
onset with full error feedback (re-anchors every step, so jitter never
compounds), and steps/durations are rounded by `_bestUnits()`, which
applies a musical simplicity prior (quarters cheap, bare 16th offsets
expensive) - this is what makes sloppy human timing come out clean.
Articulation gaps ≤1 unit or <25% of spacing are absorbed; larger gaps
become rests. `estimateTempo()` sweeps candidate beat durations against
the IOIs with relative error, refines via total-time/total-beats (jitter
telescopes away), and octave-normalizes into 55-145 BPM (halving tempo
doubles note values - always a consistent transcription; never clamp).
The piano roll reads tempo/meter live from `#abc-tempo` / `#abc-meter`
and anchors its bar grid at the same first onset, so piano-roll bars
correspond 1:1 to ABC measures. `app.quantizeTiming()` writes the
quantized times back onto correctedNotes (auto-runs once per detection
on entering review; also the "⧉ Quantize" button).

## Review Wizard (editor/review-wizard.js)

Ear-first correction for users who can't judge rhythm visually: the
"✓ Review notes" button steps through notes one at a time, playing the
original audio slice then the detected pitch. Keys (captured before the
normal editor shortcuts): Up/Down fix pitch with instant preview, R/Left
replay, Enter/Space/Right keep & advance, Del remove, Esc finish.
Rhythm can be edited without dragging: `[`/`]` halve/double duration,
`,`/`.` nudge by one grid step. Piano-roll drags are axis-locked
(vertical = pitch only with audible preview, horizontal = time only).

## Undo

`app.pushUndo()` snapshots `correctedNotes` before every destructive edit
(note delete/split/merge/drag, pitch change, transpose, re-time, bar
add/delete, ABC parse). Ctrl+Z calls `app.undo()`. When adding new editing
operations, call `pushUndo()` BEFORE the first mutation.

## Libraries (CDN)

| Library | Purpose |
|---------|---------|
| Wavesurfer.js 7.x | Audio playback (hidden) |
| ABCJS 6.4.4 | ABC notation rendering and synth |
| @spotify/basic-pitch 1.0.1 | Optional ML transcription (lazy-loaded) |

## Utility Functions (utils.js)

Single source of truth - import from here, don't duplicate:

```javascript
midiToFrequency(midi)      // MIDI → Hz (440 * 2^((midi-69)/12))
frequencyToMidi(freq)      // Hz → MIDI
midiToNoteName(midi)       // MIDI → "C4", "F#5"
midiToAbc(midi)            // MIDI → ABC notation
getConfidenceColor(conf)   // Confidence → rgba color
getConfidenceClass(conf)   // Confidence → "high"/"medium"/"low"
```

## Key Classes

### MelodyExtractor (melody-extractor.js)
Main controller - coordinates all modules, manages state:
- `correctedNotes` - Array of note objects being edited
- `updateAbcPreview(selectedNoteId)` - Render ABC with optional highlight
- `highlightAbcNote(noteId)` - Highlight without re-render

### NoteEditor (note-editor.js)
Handles note selection and editing:
- `selectNote(noteId)` - Select and highlight across all views
- `startRetime()` / `stopRetime()` - Re-timing mode
- `changePitch()`, `deleteNote()`, `splitNote()`, `mergeWithNext()`

### PianoRoll (piano-roll.js)
Interactive visualization:
- `snapEnabled`, `gridDivision` - Grid settings; tempo/meter are read live
  from the Music Settings inputs via `_getTempo()` / `_getMeter()`
- `_snapToGrid(time)` - Snap time to nearest grid line (anchored at first onset)
- Handles drag to move/resize with snap support

## Note Object Structure

```javascript
{
  id: "note-0",           // Unique ID
  midi: 72,               // MIDI note number
  noteName: "C5",         // Display name
  startTime: 0.5,         // Start in seconds
  endTime: 1.0,           // End in seconds
  duration: 0.5,          // Duration in seconds
  confidence: 0.85,       // Detection confidence (0-1)
  userCorrected: false    // True if edited by user
}
```

## Code Style

- ES6 classes with clear SRP
- Import shared utilities from utils.js
- Update ABC preview after any note modification
- Call `highlightAbcNote()` on selection (not full re-render)
