// Parse-verify ABC files with the same abcjs the app uses, without a browser.
//
//   node check_abc.mjs <file.abc> [file.abc ...]
//
// Reports, per tune: parser warnings, the chord sequence in playing order, and
// any bar whose length is not a full measure. Exits non-zero if any file warns.
//
// abcjs is a browser bundle; it is cached next to this script on first run and
// evaluated against a few DOM stubs, which is enough for parseOnly().

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cache = path.join(here, 'abcjs-cache.js');
const CDN = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js';

if (!fs.existsSync(cache)) {
    const res = await fetch(CDN);
    if (!res.ok) throw new Error(`could not fetch abcjs: ${res.status}`);
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

const files = process.argv.slice(2);
if (!files.length) {
    console.error('usage: node check_abc.mjs <file.abc> [...]');
    process.exit(2);
}

let failed = false;

for (const file of files) {
    const tunes = abcjs.parseOnly(fs.readFileSync(file, 'utf8'));
    console.log('===', file);

    tunes.forEach((tune, i) => {
        const warnings = tune.warnings || [];
        // abcjs measures duration in whole notes, so a 4/4 measure is 1.0.
        const meter = tune.getMeter?.() || { type: 'common_time' };
        const num = meter.value?.[0]?.num ?? 4;
        const den = meter.value?.[0]?.den ?? 4;
        const measure = Number(num) / Number(den);
        const chords = [];
        const oddBars = [];
        let bar = 0;
        let filled = 0;

        for (const line of tune.lines) {
            if (!line.staff) continue;
            for (const staff of line.staff) {
                for (const voice of staff.voices) {
                    for (const el of voice) {
                        if (el.chord) chords.push(el.chord.map(c => c.name).join('/'));
                        if (el.el_type === 'note') filled += el.duration;
                        if (el.el_type === 'bar') {
                            bar++;
                            if (filled > 0 && Math.abs(filled - measure) > 1e-9) {
                                oddBars.push(`${bar}=${+(filled / measure).toFixed(4)}`);
                            }
                            filled = 0;
                        }
                    }
                }
            }
        }

        const label = tunes.length > 1 ? ` [tune ${i + 1}]` : '';
        console.log(`${label} warnings:`, warnings.length ? warnings : 'none');
        console.log(`${label} chords (${chords.length}):`, chords.join(' ') || '(none)');
        console.log(`${label} partial bars (as fraction of a measure):`,
            oddBars.join(' ') || 'none');
        if (warnings.length) failed = true;
    });
}

process.exit(failed ? 1 : 0);
