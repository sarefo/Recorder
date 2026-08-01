// Transpose an ABC file by N semitones, using the app's own abcjs.
//
//   node transpose_abc.mjs abc/scottish/franks_reel.abc 5            # to stdout
//   node transpose_abc.mjs abc/scottish/franks_reel.abc 5 --in-place
//   node transpose_abc.mjs file.abc 5 --tune 1                       # one tune only
//
// abcjs rewrites the K: field, the note letters, the octave marks AND the chord
// symbols together, which is the whole reason to use it rather than editing by
// hand — chord symbols are what a manual transpose always forgets.
//
// Always confirm the result with the sibling script:
//   node compare_pitches.mjs old.abc new.abc     (expects the shift, so use it
//   after transposing the NEW file back by -N to prove nothing else moved)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
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
const abcjs = globalThis.ABCJS;

/** Split a multi-tune ABC file at its `X:` lines (abcjs handles one at a time). */
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
    !a.startsWith('--') && !(tuneArg !== -1 && i === tuneArg + 1));
const [file, stepsRaw] = positional;
const steps = Number(stepsRaw);

if (!file || Number.isNaN(steps)) {
    console.error('usage: node transpose_abc.mjs <file.abc> <semitones> [--in-place] [--tune N]');
    process.exit(2);
}

const tunes = splitTunes(fs.readFileSync(file, 'utf8'));
const out = tunes.map((abc, i) => {
    if (onlyTune !== null && i + 1 !== onlyTune) return abc;
    // parseOnly, not renderAbc — strTranspose only needs the parsed key info,
    // and renderAbc wants a real DOM that Node does not have.
    return abcjs.strTranspose(abc, abcjs.parseOnly(abc), steps);
}).join('\n');

if (inPlace) {
    fs.writeFileSync(file, out.endsWith('\n') ? out : out + '\n');
    console.log(`${file}: transposed ${steps >= 0 ? '+' : ''}${steps} semitones` +
        (onlyTune !== null ? ` (tune ${onlyTune} only)` : ''));
} else {
    process.stdout.write(out);
}
