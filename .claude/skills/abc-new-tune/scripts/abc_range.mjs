// Report the written pitch range of ABC tunes and flag anything the recorder
// cannot play.
//
//   node abc_range.mjs abc/ghanaian/*.abc
//   node abc_range.mjs --bad abc/**/*.abc     # only print the unplayable ones
//
// The floor is the point of this script: the user's recorder cannot sound
// anything below written middle C, so one stray B3 makes a whole tune useless.
// The ceiling (D6) is where the fingering diagrams stop, which is a softer
// limit — the note still renders, it just gets no diagram.
//
// Pitches come from the MIDI abcjs itself generates, so key signatures,
// accidentals and octave marks are all already applied — the same route
// abc_to_midi.mjs takes, and the same numbers midi_notes.py would print.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LOW = 60;   // C4, middle C — hard floor
const HIGH = 86;  // D6 — last note with a fingering diagram

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

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const name = (n) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

/** Every note-on pitch in a standard MIDI file, ignoring the percussion channel. */
function noteOns(bytes) {
    const out = [];
    let p = 0;
    const u32 = () => (bytes[p++] << 24 | bytes[p++] << 16 | bytes[p++] << 8 | bytes[p++]) >>> 0;

    if (String.fromCharCode(...bytes.slice(0, 4)) !== 'MThd') return out;
    p = 4;
    const headerLen = u32();
    p += headerLen;

    while (p < bytes.length - 8) {
        const tag = String.fromCharCode(...bytes.slice(p, p + 4));
        p += 4;
        const len = u32();
        const end = p + len;
        if (tag !== 'MTrk') { p = end; continue; }

        let status = 0;
        while (p < end) {
            while (p < end && bytes[p] & 0x80) p++;   // skip the delta-time varint
            p++;                                      // ...and its final byte
            if (p >= end) break;
            if (bytes[p] & 0x80) status = bytes[p++]; // new status, or reuse running status
            const type = status & 0xf0;

            if (status === 0xff) {                    // meta: type byte + varint length
                p++;
                let l = 0, b;
                do { b = bytes[p++]; l = (l << 7) | (b & 0x7f); } while (b & 0x80);
                p += l;
            } else if (status === 0xf0 || status === 0xf7) {
                let l = 0, b;
                do { b = bytes[p++]; l = (l << 7) | (b & 0x7f); } while (b & 0x80);
                p += l;
            } else if (type === 0x90) {
                const pitch = bytes[p++], vel = bytes[p++];
                if (vel > 0 && (status & 0x0f) !== 9) out.push(pitch);
            } else if (type === 0xc0 || type === 0xd0) {
                p += 1;
            } else {
                p += 2;
            }
        }
        p = end;
    }
    return out;
}

/**
 * Split a multi-tune ABC file at its `X:` lines.
 *
 * abcjs's getMidiFile only ever renders the first tune in a string, so a file
 * holding the same melody in two keys (the `X:1` / `X:2` convention used all
 * over this repo) would silently go unchecked from the second tune on.
 */
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
const onlyBad = args.includes('--bad');
const files = args.filter(a => !a.startsWith('--'));

if (!files.length) {
    console.error('usage: node abc_range.mjs [--bad] <file.abc> [...]');
    process.exit(2);
}

let bad = 0;
for (const file of files) {
    const tunes = splitTunes(fs.readFileSync(file, 'utf8'));

    tunes.forEach((abc, i) => {
        let midi;
        try {
            // chordsOff is essential: without it abcjs realises the chord
            // symbols as a bass line an octave or two below the tune, and
            // every file looks like it dips to G1.
            midi = abcjs.synth.getMidiFile(abc,
                { midiOutputType: 'binary', chordsOff: true })[0];
        } catch (err) {
            console.log(`${file}: PARSE ERROR ${err.message}`);
            bad++;
            return;
        }
        if (!midi) return;

        const pitches = noteOns(Object.values(midi));
        if (!pitches.length) return;
        const lo = Math.min(...pitches), hi = Math.max(...pitches);

        const problems = [];
        if (lo < LOW) problems.push(`BELOW C4 by ${LOW - lo} semitone(s)`);
        if (hi > HIGH) problems.push(`above D6 by ${hi - HIGH} semitone(s)`);
        if (problems.length) bad++;
        else if (onlyBad) return;

        const label = tunes.length > 1 ? ` [tune ${i + 1}/${tunes.length}]` : '';
        const flag = problems.length ? `  <-- ${problems.join(', ')}` : '';
        console.log(`${name(lo)}-${name(hi)}  ${file}${label}${flag}`);
    });
}

if (bad) {
    console.log(`\n${bad} tune(s) outside the playable range.`);
    process.exit(1);
}
