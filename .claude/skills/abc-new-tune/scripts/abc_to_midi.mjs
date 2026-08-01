// Render an ABC file to a standard MIDI file with the same abcjs the app uses.
//
//   node abc_to_midi.mjs <file.abc> <out.mid> [tuneIndex]
//
// The point is to get your transcription and the source it came from into ONE
// format, so a single parser reads both and `diff` is trustworthy:
//
//   node abc_to_midi.mjs abc/philippine/dandansoy.abc mine.mid
//   py midi_notes.py mine.mid   --channel 0  --flat > mine.txt
//   py midi_notes.py source.mid --channel 0  --flat --shift 13 > source.txt
//   diff source.txt mine.txt
//
// Use --shift to line the two pickups up, and --transpose if you wrote the tune
// in a different key from the source. An empty diff is the only real proof that
// a transcription is faithful; reading the notation back never catches a wrong
// octave or a dropped dot.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Reuse the bundle the abc-chords skill already caches, so there is one copy.
const cache = path.join(here, '..', '..', 'abc-chords', 'scripts', 'abcjs-cache.js');
const CDN = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js';

if (!fs.existsSync(cache)) {
    const res = await fetch(CDN);
    if (!res.ok) throw new Error(`could not fetch abcjs: ${res.status}`);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, await res.text());
}

// Do NOT assign globalThis.navigator — it is getter-only in Node 22 and throws.
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = {
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    querySelector: () => null,
};
(0, eval)(fs.readFileSync(cache, 'utf8'));
const abcjs = globalThis.ABCJS;

const [input, output, index = '0'] = process.argv.slice(2);
if (!output) {
    console.error('usage: node abc_to_midi.mjs <file.abc> <out.mid> [tuneIndex]');
    process.exit(2);
}

const files = abcjs.synth.getMidiFile(fs.readFileSync(input, 'utf8'),
    { midiOutputType: 'binary' });
const file = files[Number(index)];
if (!file) {
    console.error(`no tune at index ${index} (file has ${files.length})`);
    process.exit(1);
}

fs.writeFileSync(output, Buffer.from(Object.values(file)));
console.log(`${output}: tune ${Number(index) + 1} of ${files.length}`);
