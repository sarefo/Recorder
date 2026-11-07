// Transpose an ABC file by N semitones with the app's own TransposeManager.
//
//   node transpose_abc.mjs abc/scottish/franks_reel.abc 5            # to stdout
//   node transpose_abc.mjs abc/scottish/franks_reel.abc 5 --in-place
//   node transpose_abc.mjs file.abc 5 --tune 1                       # one tune only
//
// This rewrites the K: field, the notes and the chord symbols together, and proves
// every note of each tune moved by the shift. If a tune can't be transposed it
// writes nothing and exits with status 1.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..', '..');
const cache = path.join(here, '..', '..', 'abc-chords', 'scripts', 'abcjs-cache.js');
const CDN = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js';

if (!fs.existsSync(cache)) {
    const res = await fetch(CDN);
    if (!res.ok) throw new Error(`could not fetch abcjs: ${res.status}`);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, await res.text());
}

globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = {
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    querySelector: () => null,
};
(0, eval)(fs.readFileSync(cache, 'utf8'));
const load = (file, name) => (0, eval)(`(()=>{${fs.readFileSync(path.join(root, file), 'utf8')};return ${name}})()`);
globalThis.AbcTransposer = load('js/notation/abc-transposer.js', 'AbcTransposer');
const manager = new (load('js/notation/transpose-manager.js', 'TransposeManager'))();

/** Split a multi-tune ABC file at its `X:` lines; the check only sees a file's first tune. */
function splitTunes(text) {
    const tunes = [];
    let current = null;
    for (const line of text.split(/\r?\n/)) {
        if (/^X\s*:/.test(line)) {
            if (current) tunes.push(current.join('\n'));
            current = [];
        }
        if (current) current.push(line);
    }
    if (current) tunes.push(current.join('\n'));
    return tunes.length ? tunes : [text];
}

const args = process.argv.slice(2);
const inPlace = args.includes('--in-place');
const tuneArg = args.indexOf('--tune');
const onlyTune = tuneArg === -1 ? null : Number(args[tuneArg + 1]);
const positional = args.filter((a, i) =>
    !(a.startsWith('--') || (tuneArg !== -1 && i === tuneArg + 1)));
const [file, stepsRaw] = positional;
const steps = Number(stepsRaw);

if (!file || Number.isNaN(steps)) {
    console.error('usage: node transpose_abc.mjs <file.abc> <semitones> [--in-place] [--tune N]');
    process.exit(2);
}

const tunes = splitTunes(fs.readFileSync(file, 'utf8'));
const out = tunes.map((abc, i) => {
    if (steps === 0 || (onlyTune !== null && i + 1 !== onlyTune)) return abc;
    const transposed = manager.transpose(abc, steps);
    if (transposed === abc && manager.getPitches(abc).length) {
        console.error(`${file}: tune ${i + 1} could not be transposed, nothing written`);
        process.exit(1);
    }
    return transposed;
}).join('\n');

if (inPlace) {
    fs.writeFileSync(file, out.endsWith('\n') ? out : out + '\n');
    console.log(`${file}: transposed ${steps >= 0 ? '+' : ''}${steps} semitones` +
        (onlyTune !== null ? ` (tune ${onlyTune} only)` : ''));
} else {
    process.stdout.write(out);
}
