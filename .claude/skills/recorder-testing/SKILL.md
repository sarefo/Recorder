---
name: recorder-testing
description: Run the Recorder app in a real browser and drive it to verify a change — start the dev server, load a specific tune, start playback, inspect playback/notation state, check the console. Use whenever a change to this app needs confirming in the real app rather than by reading code (playback, looping, anchors, metronome, tempo, rendering, fingering diagrams, mobile layout).
---

# Testing the Recorder app in a browser

The app has no test suite. Verification means loading it in Chrome and driving
it. This skill is the shortcut past the setup fiddling.

## 1. Start the dev server

```bash
cd .. && py -m http.server 8000 --bind 127.0.0.1
```

Run it with `run_in_background: true`, and `TaskStop` it when finished.

- Serve from the **parent** directory (`sarefo.github.io`), not `Recorder/` —
  every path in the app is absolute under `/Recorder/`.
- `py`, never `python3` (see the global CLAUDE.md).
- App URL: `http://127.0.0.1:8000/Recorder/`

## 2. Load the browser tools

One `ToolSearch` call, not one per tool:

```
select:mcp__chrome-devtools__new_page,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__list_console_messages,mcp__chrome-devtools__take_snapshot,mcp__chrome-devtools__click,mcp__chrome-devtools__close_page
```

Add `mcp__chrome-devtools__resize_page` for layout work, `take_screenshot` when
the result is visual.

Then `new_page` on the app URL, and `close_page` at the end.

## 3. Load a specific tune

Fastest and most deterministic: put the ABC in the URL, base64-encoded.

```bash
py -c "import base64;print(base64.b64encode(open('abc/traditional/greensleeves.abc','rb').read()).decode())"
```

then open `http://127.0.0.1:8000/Recorder/?abc=<that string>`.

In-page alternative:

```js
app.notationParser.currentAbc = 'X:1\nT:Test\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nC D E F|G A B c|';
app.render();
// wait ~300ms — marker zones and fingering diagrams are added on a delay
```

Without a URL parameter the app loads whatever tune it last had.

## 4. Start audio — this needs a real click

`AudioContext` stays suspended until a genuine user gesture. `evaluate_script`
does not count. **Click `#play-button` once with the `click` tool** (get its
`uid` from `take_snapshot`); after that the context is unlocked and everything
else can be driven programmatically for the rest of the page's life.

Two things bite when calling playback methods directly instead of clicking:

- **`isPlaying` is set by the UI layer.** After `await mp.startPlayback()`, also
  set `mp.isPlaying = true` (and `false` after `pausePlayback()`), or callbacks
  that guard on it silently do nothing.
- **First play waits a full measure** for the metronome count-in. Set
  `mp.isFirstPlay = false` first to skip it.

## 5. Poll inside one script, not across many calls

Each `evaluate_script` is a round trip. Sample a whole timeline in a single
call:

```js
async () => {
  const mp = window.app.midiPlayer;
  const out = [];
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 500));
    out.push({
      t: mp.audioContext.currentTime,
      running: mp.midiPlayer.isRunning,
      pos: mp.audioContext.currentTime - mp.midiPlayer.startTimeSec,
      lit: document.querySelectorAll('.playing').length
    });
  }
  return out;
}
```

**Judge timing by `audioContext.currentTime`, never by `performance.now()` or
`Date.now()`.** The audio clock is what the ear hears; the main thread drifts.
A rhythm claim is only proven if successive audio-clock timestamps are evenly
spaced.

## 6. Always finish with the console

```
list_console_messages with types: ["error", "warn"]
```

The app swallows a lot into `console.error` inside try/catch, so a feature can
look fine on screen while erroring every frame.

## Gotchas

- **New JS file?** It needs *both* a `<script>` tag in `index.html` and an entry
  in `APP_SHELL_FILES` in `sw.js`, or it works locally and breaks offline.
- **Service worker caching.** `/Recorder/` paths are network-first, so edits
  normally show up on reload. If they don't, hard-reload or unregister the
  worker in DevTools.
- **Version bumping is automatic.** A pre-commit hook bumps `sw.js`
  `CACHE_VERSION` and `main.js` `APP_BUILD`. Don't edit those by hand.
- **Mobile targets** (from CLAUDE.md): Pixel 7a landscape `915x412`, Pixel 4a
  portrait `393x851`. Use `resize_page`.
- **Don't trigger `alert`/`confirm`** — a modal dialog freezes the whole
  automation session.

## Where things live

See `reference/architecture.md` for the object graph, the playback APIs worth
poking at, and how notes are addressed.
