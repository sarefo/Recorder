// Report, per tune, the key signature and how many explicit accidentals the
// notes carry — the quickest way to spot a K: field that fights its own music.
//
//   node report_keys.mjs <file.abc> [file.abc ...]
//   node report_keys.mjs abc/**/*.abc     # sweep the whole collection
//
// A tune needing many accidentals is notated in the wrong key. See SKILL.md.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cache = path.join(here, '..', '..', 'abc-chords', 'scripts', 'abcjs-cache.js');
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
    console.error('usage: node report_keys.mjs <file.abc> [...]');
    process.exit(2);
}

// Roughly: more than one accidental per two bars is suspicious.
const SUSPICIOUS = 8;

for (const file of files) {
    const tunes = abcjs.parseOnly(fs.readFileSync(file, 'utf8'));
    console.log('===', file);

    tunes.forEach((tune, i) => {
        const key = tune.getKeySignature();
        const sig = (key.accidentals || [])
            .map(a => `${a.note}${a.acc === 'flat' ? 'b' : a.acc === 'sharp' ? '#' : '='}`)
            .join(' ') || '(none)';

        let notes = 0, explicit = 0;
        for (const line of tune.lines) {
            if (!line.staff) continue;
            for (const staff of line.staff) {
                for (const voice of staff.voices) {
                    for (const el of voice) {
                        if (el.el_type !== 'note' || !el.pitches) continue;
                        for (const p of el.pitches) {
                            notes++;
                            if (p.accidental) explicit++;
                        }
                    }
                }
            }
        }

        const flag = explicit >= SUSPICIOUS ? '   <-- check this key' : '';
        console.log(
            `  X:${i + 1}  K:${key.root}${key.acc || ''}${key.mode || ''}` +
            `  sig=[${sig}]  ${explicit}/${notes} notes need an accidental${flag}`
        );
    });
}
