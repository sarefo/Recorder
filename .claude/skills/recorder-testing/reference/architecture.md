# Recorder app — object graph and handles worth poking at

Everything hangs off `window.app` (an `AbcPlayer`, created in `js/core/main.js`).
Every component holds a back-reference as `this.player`.

## Components on `window.app`

| Handle | Class | File | What it owns |
| --- | --- | --- | --- |
| `notationParser` | `NotationParser` | `js/notation/notation-parser.js` | The raw ABC text (`currentAbc`), note extraction, ties, accidentals |
| `renderManager` | `RenderManager` | `js/notation/render-manager.js` | Rendering, the abcjs visual object, playback anchors, note clicks |
| `transposeManager` | `TransposeManager` | `js/notation/transpose-manager.js` | Transposition |
| `midiPlayer` | `MidiPlayer` | `js/playback/midi-player.js` | All playback. Wraps the abcjs synth |
| `autoScrollManager` | `AutoScrollManager` | `js/playback/auto-scroll-manager.js` | Note highlighting (always) + scrolling (mobile only) |
| `fingeringManager` | `FingeringManager` | `js/fingering/fingering-manager.js` | Fingering chart data and display mode |
| `diagramRenderer` | `DiagramRenderer` | `js/fingering/diagram-renderer.js` | Draws diagrams, builds the note marker zones |
| `tuneManager` | `TuneManager` | `js/files/tune-manager.js` | Multi-tune files: `getTuneCount()`, `setTuneIndex()`, `nextTune()` |
| `fileManager` | `FileManager` | `js/files/file-manager.js` | Loading from `/abc` |
| `uiControls` | `UIControls` | `js/ui/ui-controls.js` | Buttons, the play/loop/restart button behaviour |
| `mobileUI`, `swipeHandler` | | `js/ui/` | Mobile layout and gestures |
| `shareManager` | `ShareManager` | `js/core/share-manager.js` | The `?abc=<base64>` URL parameter |
| `settingsManager` | `SettingsManager` | `js/core/settings-manager.js` | Persisted settings (localStorage) |

## Playback: `app.midiPlayer`

`app.midiPlayer` is the app's own controller. `app.midiPlayer.midiPlayer` is the
raw abcjs `CreateSynth` — the confusing double name is worth remembering.

```js
const mp = app.midiPlayer;

mp.playbackSettings   // { chordsOn, voicesOn, metronomeOn, tempo (percent), loopEnabled }
mp.isPlaying          // maintained by the UI layer — set it yourself when calling methods directly
mp.isFirstPlay        // true => next start plays a count-in measure
mp.audioContext       // the shared AudioContext; its currentTime is the timing ground truth
mp.customMetronome    // CustomMetronome, runs independently of the synth
mp.tuningManager      // the instrument tuner
mp.looper             // SeamlessLooper while loop mode is running

await mp.startPlayback();          // honours the anchor, count-in and loop mode
await mp.pausePlayback();
await mp.stopPlayback();
await mp.togglePlay();
await mp.restart();
await mp.toggleLoop(app);          // reinitialises the synth, then resumes if it was playing
await mp.updatePlaybackSettings({ tempo: 150 }, app.renderManager.currentVisualObj);
```

`updatePlaybackSettings` needs the visual object — it stops playback, rebuilds
the synth from scratch and resumes. `window.orientationHandler` is a separate
global, not a member of `app`.

### The abcjs synth underneath (`mp.midiPlayer`)

```js
synth.duration        // seconds, INCLUDING a 200ms fade tail (fadeLength) after the last note
synth.startTimeSec    // audio-clock time that position 0 maps to
synth.pausedTimeSec   // set while paused, undefined while running
synth.isRunning
synth.directSource    // array of live AudioBufferSourceNodes; stop() kills them all
synth.getAudioBuffer()
synth.seek(seconds, "seconds")
```

Current position = `mp.audioContext.currentTime - synth.startTimeSec`.
Musical end = `synth.duration - synth.fadeLength / 1000`.

### Looping

Loop mode does not restart the tune from JavaScript. `SeamlessLooper`
(`js/playback/seamless-looper.js`) schedules each repeat ahead of time on the
audio clock and crossfades the outgoing one, so the seam is sample-accurate.

```js
mp.isSeamlessLoopActive()   // is the audio-clock loop driving playback?
mp.getLoopWindowSec()       // { start, end } — the A-B region, else the whole tune
mp.refreshLoopWindow()      // re-aim a running loop after anchors moved
mp.looper.window            // live loop bounds
mp.looper.nextWrapAt        // audio-clock time of the next seam — successive values
                            // must differ by exactly (end - start) or the loop drifts
```

`_handlePlaybackEnded()` in `midi-player.js` is the older stop-and-restart path.
It still runs when a loop window can't be built (very short tunes) and for
non-looping playback.

## Addressing notes

Notes are indexed by their position in the abcjs selectables array:

```js
const rm = app.renderManager;
rm.currentVisualObj.engraver.selectables[i].absEl.abcelem   // the abcjs element
rm.getNoteStartMsByIndex(i)                                 // its start time in ms
```

The same index appears in the DOM as
`.note-marker-zone[data-note-index="<i>"]` — those transparent zones are what
receive taps and long-presses.

**Note times are in adjusted-tempo milliseconds.** `currentTrackMilliseconds` is
written by `ABCJS.TimingCallbacks`, which `AutoScrollManager.init()` constructs
with the tempo-adjusted qpm, so note times and synth times share one scale.

### Anchors (the A-B practice region)

```js
rm.setPlaybackAnchor(i);      // green start anchor ("A")
rm.setPlaybackAnchorEnd(i);   // red end anchor ("B"); swaps if it lands before the start
rm.anchorNoteIndex            // null when unset
rm.anchorEndNoteIndex
rm.getAnchorStartMs();
rm.getAnchorEndBoundaryMs();  // END of the end note — this is the loop boundary
rm.playFromNoteIndex(i);
rm.playFromPosition(ms);
rm.handleNoteLongPress(i);    // the real gesture entry point; may open the start/end popup
```

`applyAnchorMarker()` is the single choke point that repaints the markers and
re-aims a running loop — anything that moves an anchor must end up there.

## Highlighting and scrolling

```js
const as = app.autoScrollManager;
as.timingCallbacks        // the ABCJS.TimingCallbacks instance
as.timingCallbacks.isRunning
as.restartAt(seconds);    // jump highlighting mid-flight without stopping anything
as.enabled                // scrolling only; highlighting happens regardless
document.querySelectorAll('.playing')   // currently highlighted note elements
```

`TimingCallbacks` stops itself at the end of the tune. Calling `start()` on an
already-running instance starts a *second* animation loop — always check
`isRunning` first.

## Useful DOM ids

`#abc-notation` `#play-button` `#restart-button` (also the loop toggle)
`#metronome-toggle` `#chords-toggle` `#voices-toggle` `#show-fingering`
`#transpose-up` `#transpose-down` `#prev-tune` `#next-tune` `#tune-title`
`#midi-status` (status line — handy to assert on) `#tuning-button` `#chart-toggle`
