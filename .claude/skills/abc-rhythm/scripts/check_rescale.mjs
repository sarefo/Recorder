// Prove that renotating an ABC tune at different note values changed nothing
// but the notation.
//
//   node check_rescale.mjs <old.abc> <new.abc> [factor]
//
// factor is the multiplier applied to every duration (default 2 = "written at
// double note values"). Use 0.5 for a halving.
//
// Checks, in order:
//   1. same number of notes, in the same order, at the same pitches
//   2. every duration scaled by exactly `factor`
//   3. every bar in the new file is metrically complete for its M:
//   4. total sounding time unchanged, given each file's own Q:
//
// A textual diff proves nothing here (the notation is supposed to differ) and
// compare_pitches.mjs from the abc-keys skill does not work either, because its
// MIDI clock is in beats, which is exactly what a rescale changes.
//
// Get the "old" side straight out of git:
//   git show HEAD:abc/philippine/pamulinawen.abc > /tmp/old.abc
//
// Exits non-zero on any mismatch.

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
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
const abcjs = createRequire(import.meta.url)(cache);

const [oldPath, newPath, factorArg] = process.argv.slice(2);
if (!oldPath || !newPath) {
    console.error('usage: node check_rescale.mjs <old.abc> <new.abc> [factor]');
    process.exit(2);
}
const factor = factorArg ? Number(factorArg) : 2;

const near = (a, b) => Math.abs(a - b) < 1e-9;

/** Flatten a tune to its note events plus per-bar duration sums. */
function scan(abc) {
    const tune = abcjs.parseOnly(abc)[0];
    if (!tune) throw new Error('abcjs parsed no tune');
    const notes = [];
    const bars = [];
    let acc = 0;
    for (const line of tune.lines) {
        if (!line.staff) continue;
        for (const staff of line.staff)
            for (const voice of staff.voices)
                for (const el of voice) {
                    if (el.el_type === 'note') {
                        acc += el.duration;
                        if (!el.rest)
                            notes.push({
                                pitch: el.pitches.map(p => `${p.pitch}${p.accidental || ''}`).join('+'),
                                duration: el.duration,
                            });
                    } else if (el.el_type === 'bar') {
                        if (acc > 0) bars.push(acc);
                        acc = 0;
                    }
                }
    }
    if (acc > 0) bars.push(acc);
    // abcjs durations are in whole notes; the meter gives the expected bar length.
    const meter = tune.getMeterFraction();
    return { notes, bars, barLength: meter.num / meter.den, beatsPerMinute: tune.getBpm(), tune };
}

const a = scan(fs.readFileSync(oldPath, 'utf8'));
const b = scan(fs.readFileSync(newPath, 'utf8'));

let problems = 0;
const fail = msg => { console.log(`FAIL ${msg}`); problems++; };

console.log(`old: ${a.notes.length} notes, ${a.bars.length} bars`);
console.log(`new: ${b.notes.length} notes, ${b.bars.length} bars (factor ${factor})`);

if (a.notes.length !== b.notes.length) {
    fail(`note count ${a.notes.length} -> ${b.notes.length}; nothing else can be compared`);
} else {
    for (let i = 0; i < a.notes.length; i++) {
        if (a.notes[i].pitch !== b.notes[i].pitch)
            fail(`note ${i + 1}: pitch ${a.notes[i].pitch} -> ${b.notes[i].pitch}`);
        if (!near(b.notes[i].duration, factor * a.notes[i].duration))
            fail(`note ${i + 1} (${a.notes[i].pitch}): duration ${a.notes[i].duration} -> ${b.notes[i].duration}, wanted ${factor * a.notes[i].duration}`);
    }
}

b.bars.forEach((len, i) => {
    // A pickup or a final short bar is legitimate; flag only interior bars.
    const edge = i === 0 || i === b.bars.length - 1;
    if (!near(len, b.barLength) && !edge)
        fail(`new bar ${i + 1} holds ${len} of a ${b.barLength} bar`);
});

const seconds = s => {
    const total = s.notes.reduce((sum, n) => sum + n.duration, 0);
    // getBpm() normalises Q: to quarter notes per minute.
    return (total * 4) / s.beatsPerMinute * 60;
};
const [ta, tb] = [seconds(a), seconds(b)];
console.log(`sounding time: ${ta.toFixed(1)}s -> ${tb.toFixed(1)}s`);
if (!near(Math.round(ta * 100), Math.round(tb * 100)))
    fail(`sounding time changed — adjust Q: by 1/${factor}`);

console.log(problems === 0
    ? 'OK: same pitches, durations scaled exactly, bars complete, same sounding time'
    : `${problems} problem(s)`);
process.exit(problems === 0 ? 0 : 1);
