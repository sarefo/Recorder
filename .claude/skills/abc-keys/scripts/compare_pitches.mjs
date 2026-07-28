// Prove that an edit to an ABC file did not change a single sounding pitch.
//
//   node compare_pitches.mjs <old.abc> <new.abc>
//
// Renders both files to MIDI with the same abcjs the app uses and compares the
// note-on events (clock + pitch) tune by tune. This is the only trustworthy
// check when rewriting key signatures or accidentals: the notation changes on
// purpose, so a textual diff tells you nothing, but the sound must be identical.
//
// Get the "old" side straight out of git:
//   git show HEAD:abc/pop/popcorn.abc > /tmp/old.abc
//
// Exits non-zero on any mismatch.

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

/** Split a multi-tune file into individual tunes, so X:2 is not blamed for X:1. */
function splitTunes(text) {
    return text.split(/\n(?=X:)/).map(s => s.trim()).filter(Boolean);
}

/** Collect "clock:pitch" for every note-on in a standard MIDI byte array. */
function noteOns(bytes) {
    const b = Array.from(bytes);
    const notes = [];
    let i = 0;
    const u32 = () => (b[i++] << 24) | (b[i++] << 16) | (b[i++] << 8) | b[i++];
    const varLen = () => { let v = 0, c; do { c = b[i++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
    // NB: always read a length into a temporary. `i += u32()` evaluates the old
    // `i` before the helper advances it, silently corrupting every offset.
    const skip = n => { i += n; };

    if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'MThd') throw new Error('not a MIDI file');
    i = 4;
    skip(u32());

    while (i < b.length) {
        if (String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]) !== 'MTrk') break;
        i += 4;
        const trackLen = u32();
        const end = i + trackLen;
        let running = 0, clock = 0;
        while (i < end) {
            clock += varLen();
            let status = b[i];
            if (status & 0x80) { i++; running = status; } else { status = running; }
            if (status === 0xff) { i++; skip(varLen()); }         // meta (incl. key sig — ignored)
            else if (status === 0xf0 || status === 0xf7) { skip(varLen()); }
            else {
                const hi = status & 0xf0;
                const p1 = b[i++];
                const p2 = (hi === 0xc0 || hi === 0xd0) ? null : b[i++];
                if (hi === 0x90 && p2 > 0) notes.push(`${clock}:${p1}`);
            }
        }
        i = end;
    }
    return notes;
}

function midiOf(tuneText) {
    const file = abcjs.synth.getMidiFile(tuneText, { midiOutputType: 'binary' })[0];
    return noteOns(Object.values(file));
}

const [oldFile, newFile] = process.argv.slice(2);
if (!newFile) {
    console.error('usage: node compare_pitches.mjs <old.abc> <new.abc>');
    process.exit(2);
}

const oldTunes = splitTunes(fs.readFileSync(oldFile, 'utf8'));
const newTunes = splitTunes(fs.readFileSync(newFile, 'utf8'));

let failed = oldTunes.length !== newTunes.length;
if (failed) console.log(`tune count differs: ${oldTunes.length} vs ${newTunes.length}`);

for (let t = 0; t < Math.max(oldTunes.length, newTunes.length); t++) {
    const a = oldTunes[t] ? midiOf(oldTunes[t]) : [];
    const c = newTunes[t] ? midiOf(newTunes[t]) : [];
    const diffs = [];
    for (let j = 0; j < Math.max(a.length, c.length); j++) {
        if (a[j] !== c[j]) diffs.push(`   note ${j}: old=${a[j]} new=${c[j]}`);
    }
    // A tune that yields no note-ons means the MIDI parse broke, not that the
    // two sides agree — never let that read as a pass.
    if (!a.length || !c.length) { failed = true; diffs.push('   no note-ons parsed — the comparison is not valid'); }
    if (diffs.length) failed = true;
    console.log(`X:${t + 1}  ${a.length} vs ${c.length} note-ons  ->  ${diffs.length ? `DIFFERS (${diffs.length})` : 'identical'}`);
    diffs.slice(0, 12).forEach(d => console.log(d));
}

console.log(failed ? '\nMISMATCH — the edit changed the music.' : '\nAll tunes sound identical.');
process.exit(failed ? 1 : 0);
