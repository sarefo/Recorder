# MelodyExtractor - CLAUDE.md

Standalone web app that extracts melody from audio files and transcribes to ABC notation with human-in-the-loop correction.

## Running

- URL: http://localhost:8000/Recorder/MelodyExtractor
- No build step - uses ES modules directly

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
    │   ├── pitch-detector.js     # Essentia.js wrapper
    │   └── synth.js              # Web Audio synth for playback
    ├── analysis/
    │   └── note-segmenter.js     # Pitch frames → note events
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

## Libraries (CDN)

| Library | Purpose |
|---------|---------|
| Essentia.js | Pitch detection (PitchYinProbabilistic) |
| Wavesurfer.js 7.x | Audio playback (hidden) |
| ABCJS 6.4.4 | ABC notation rendering and synth |

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
- `snapEnabled`, `gridTempo`, `gridDivision` - Grid settings
- `_snapToGrid(time)` - Snap time to nearest grid line
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
