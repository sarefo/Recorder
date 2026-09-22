// Check that ABC tunes loop seamlessly.
//
//   node abc_loop_check.mjs abc                 # walks the directory
//   node abc_loop_check.mjs --bad abc           # only the broken ones
//   node abc_loop_check.mjs --bars abc          # also flag over-full bars
//   node abc_loop_check.mjs abc/breton/toutouic.abc
//
// The app loops a tune by restarting it, so the join between the end and the
// beginning has to land on the beat. That is true exactly when ONE PASS THROUGH
// THE TUNE LASTS A WHOLE NUMBER OF MEASURES. A tune that opens with a 3-eighth
// pickup therefore has to end with a bar of (measure - 3 eighths); if it ends
// with a full bar instead, every loop is a pickup too long and the pulse limps.
//
// The measurement is taken from the MIDI abcjs renders, not from the written
// bars, because that is what the app actually plays: repeats, first/second
// endings, ties, tuplets and leading rests are all already resolved in it. That
// matters — a section whose last bar is short because it pays back the tune's
// anacrusis is fine at the end of the tune but wrong in front of a `:|`, and
// only the played timeline shows the difference.
//
// Partial written bars are listed too, but only as a hint about where to fix
// it: a pair of partial bars either side of a repeat is normal notation.

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

const EPS = 1e-6;
const args = process.argv.slice(2);
const onlyBad = args.includes('--bad');
const showBars = args.includes('--bars');

// Directories are walked, so no shell has to glob filenames full of spaces.
function expand(target) {
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return [target];
    return fs.readdirSync(target, { withFileTypes: true })
        .flatMap(e => (e.isDirectory() ? expand(path.join(target, e.name))
            : e.name.toLowerCase().endsWith('.abc') ? [path.join(target, e.name)] : []))
        .sort();
}

const files = args.filter(a => !a.startsWith('--')).flatMap(expand);
if (!files.length) {
    console.error('usage: node abc_loop_check.mjs [--bad] <file.abc|dir> [...]');
    process.exit(2);
}

/** Last event time of a standard MIDI file, in quarter notes. */
function playedQuarters(bytes) {
    const d = Buffer.from(bytes);
    const division = d.readUInt16BE(12);
    let i = 14;
    let maxTick = 0;
    while (i < d.length - 8 && d.toString('ascii', i, i + 4) === 'MTrk') {
        const end = i + 8 + d.readUInt32BE(i + 4);
        let p = i + 8;
        let tick = 0;
        let running = 0;
        while (p < end) {
            let delta = 0;
            let b;
            do { b = d[p++]; delta = (delta << 7) | (b & 0x7f); } while (b & 0x80);
            tick += delta;
            let status = d[p];
            if (status & 0x80) { p++; running = status; } else status = running;
            if (status === 0xff) {
                p++;                                   // meta type
                let len = 0, c;
                do { c = d[p++]; len = (len << 7) | (c & 0x7f); } while (c & 0x80);
                p += len;
            } else if (status === 0xf0 || status === 0xf7) {
                let len = 0, c;
                do { c = d[p++]; len = (len << 7) | (c & 0x7f); } while (c & 0x80);
                p += len;
            } else if ((status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0) {
                p += 1;
            } else {
                p += 2;
            }
            if (tick > maxTick) maxTick = tick;
        }
        i = end;
    }
    return maxTick / division;
}

/**
 * Duration, in whole notes, of the rests that follow the last sounding note.
 * MIDI ends at the last note-off, so a tune that finishes on a rest measures
 * short unless this is added back.
 */
function trailingRest(tune) {
    const notes = [];
    for (const line of tune.lines) {
        if (!line.staff) continue;
        for (const staff of line.staff) {
            for (const el of staff.voices[0] || []) {
                if (el.el_type === 'note') notes.push(el);
            }
        }
    }
    let total = 0;
    for (let i = notes.length - 1; i >= 0; i--) {
        if (!notes[i].rest) break;
        total += notes[i].duration;
    }
    return total;
}

/** Written bars, with tuplet multipliers applied, plus the meters in force. */
function writtenBars(tune) {
    const header = tune.getMeter?.() || { type: 'common_time' };
    let measure = header.value
        ? Number(header.value[0].num) / Number(header.value[0].den)
        : 1;                                            // common / cut time
    const meters = new Set([measure]);
    const out = [];
    let filled = 0;
    let seen = false;
    let left = 0;
    let mult = 1;
    let written = 0;        // every duration, ignoring barlines
    let repeats = false;    // any repeat or volta -- played length then differs
    let voices = 1;

    for (const line of tune.lines) {
        if (!line.staff) continue;
        for (const staff of line.staff) {
            voices = Math.max(voices, staff.voices.length);
            for (const el of staff.voices[0] || []) {
                if (el.el_type === 'meter' && el.value) {
                    measure = Number(el.value[0].num) / Number(el.value[0].den);
                    meters.add(measure);
                } else if (el.el_type === 'note') {
                    if (el.startTriplet) { left = el.startTriplet; mult = el.tripletMultiplier; }
                    const dur = el.duration * (left > 0 ? mult : 1);
                    filled += dur;
                    written += dur;
                    if (left > 0 && --left === 0) mult = 1;
                    seen = true;
                } else if (el.el_type === 'bar') {
                    if (String(el.type || '').includes('repeat')
                        || el.startEnding || el.endEnding) repeats = true;
                    if (seen) out.push({ filled, measure });
                    filled = 0;
                    seen = false;
                }
            }
        }
    }
    if (seen) out.push({ filled, measure });
    return { bars: out, meters, written, repeats, voices };
}

/**
 * Try to pair every partial bar off against another that completes it.
 *
 * Two shapes are legitimate. A pickup paired with the final bar is the tune's
 * own anacrusis. A pair of adjacent partial bars is a repeated section with a
 * pickup: the bar before `:|` is short by exactly what the pickup after `|:`
 * supplies. Anything left over is a bar that nothing completes.
 *
 * @returns {Array|null} The bars left unpaired, or null when they all pair
 */
function pairPartials(partial, barCount, measure) {
    let rest = partial.slice();
    if (rest.length >= 2
        && rest[0].idx === 0
        && rest[rest.length - 1].idx === barCount - 1
        && Math.abs(rest[0].filled + rest[rest.length - 1].filled - measure) < EPS) {
        rest = rest.slice(1, -1);
    }
    while (rest.length >= 2
        && Math.abs(rest[0].filled + rest[1].filled - rest[0].measure) < EPS) {
        rest = rest.slice(2);
    }
    return rest.length ? rest : null;
}

/** "3/8" for a duration given in whole notes, so reports read as note values. */
function asNotes(whole) {
    const eighths = whole * 8;
    return Math.abs(eighths - Math.round(eighths)) < 1e-4
        ? `${Math.round(eighths)}/8`
        : whole.toFixed(4);
}

/**
 * One ABC source string per tune in the file.
 *
 * abcjs.synth.getMidiFile only ever renders the FIRST tune of whatever it is
 * handed, so a file holding several X: blocks has to be split before any of
 * them past the first can be measured. Anything above the first X: is a file
 * header and belongs to every tune.
 */
function splitTunes(src) {
    const lines = src.split(/\r?\n/);
    const starts = [];
    lines.forEach((line, i) => { if (/^X:/.test(line)) starts.push(i); });
    if (starts.length <= 1) return [src];
    const header = lines.slice(0, starts[0]).join('\n');
    return starts.map((start, i) => {
        const body = lines.slice(start, starts[i + 1] ?? lines.length).join('\n');
        return header ? header + '\n' + body : body;
    });
}

let bad = 0;
let checked = 0;

for (const file of files) {
    let sources;
    try {
        sources = splitTunes(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.log(`BROKEN  ${file}: ${err.message}`);
        bad++;
        continue;
    }

    sources.forEach((src, i) => {
        let tune;
        let midis;
        try {
            tune = abcjs.parseOnly(src)[0];
            // chordsOff: the accompaniment's last release can sit past the final
            // melody note and would otherwise be read as extra length.
            midis = abcjs.synth.getMidiFile(src, { midiOutputType: 'binary', chordsOff: true });
        } catch (err) {
            console.log(`BROKEN  ${file} [tune ${i + 1}]: ${err.message}`);
            bad++;
            return;
        }
        if (!tune || !midis || !midis.length) return;
        const label = sources.length > 1 ? `${file} [tune ${i + 1}/${sources.length}]` : file;
        const { bars, meters, written, repeats, voices } = writtenBars(tune);
        if (!bars.length) return;
        checked++;

        const partial = bars
            .map((b, idx) => ({ ...b, idx }))
            .filter(b => Math.abs(b.filled - b.measure) > EPS);
        const hint = partial.length
            ? '  partial bars: ' + partial
                .map(b => `#${b.idx + 1}=${asNotes(b.filled)} of ${asNotes(b.measure)}`).join(', ')
            : '';

        // Tunes that change meter mid-flight have no single measure length to
        // divide by, so fall back to "every bar full, or the pickup and the
        // final bar add up to one".
        if (meters.size > 1) {
            const first = bars[0];
            const last = bars[bars.length - 1];
            const ends = partial.filter(b => b.idx !== 0 && b.idx !== bars.length - 1);
            const paired = partial.length === 0
                || (partial.length === 2 && !ends.length
                    && Math.abs(first.filled + last.filled - first.measure) < EPS);
            if (paired) {
                if (!onlyBad) console.log(`ok      ${label} (meter changes; all bars balance)`);
            } else {
                console.log(`LOOP    ${label}\n        meter changes, and the bars do not balance.${hint}`);
                bad++;
            }
            return;
        }

        const measureQ = 4 * bars[0].measure;
        const total = playedQuarters(Object.values(midis[0]))
            + trailingRest(tune) * 4;

        // Self-check. With no repeat to expand and a single voice, the played
        // length has to equal the written length; if it does not, the
        // measurement is being thrown off by something this script does not
        // model (grace notes, a second voice abcjs merges, an exotic bar type)
        // and any verdict from it would be a guess.
        if (!repeats && voices === 1 && Math.abs(total - written * 4) > 1e-3) {
            console.log(`SUSPECT ${label}`);
            console.log(`        written ${asNotes(written)} but measured`
                + ` ${asNotes(total / 4)} with no repeats -- not judged.`);
            bad++;
            return;
        }

        const measures = total / measureQ;
        const off = measures - Math.round(measures);

        if (Math.abs(off) < 2e-3) {
            // The pass is a whole number of measures, so the loop join lands on
            // the beat. A repeat inside the tune is a second kind of join that
            // the timeline cannot show: the bar before a `:|` and the bar the
            // repeat lands on have to add up to one measure, exactly as a pickup
            // and a final bar do. An UNDER-full bar that nothing completes is
            // that defect. Over-full bars are a different complaint -- a bar
            // with too many beats in it -- so --bars has to be asked for.
            const unpaired = pairPartials(partial, bars.length, bars[0].measure);
            if (unpaired) {
                const short = unpaired.filter(b => b.filled < b.measure - EPS);
                const show = showBars ? unpaired : short;
                if (show.length) {
                    console.log(`JOIN    ${label}`);
                    console.log(`        loops, but ${short.length ? 'a repeat lands off the beat' : 'bars do not add up'}: `
                        + show.map(b => `#${b.idx + 1}=${asNotes(b.filled)} of ${asNotes(b.measure)}`).join(', '));
                    bad++;
                    return;
                }
            }
            if (!onlyBad) console.log(`ok      ${label} (${Math.round(measures)} measures)`);
            return;
        }

        // Positive `over` = the pass runs long; that much has to come off the
        // last bar (or be added to the pickup).
        const over = (measures - Math.floor(measures)) * measureQ / 4;
        console.log(`LOOP    ${label}`);
        console.log(`        one pass is ${measures.toFixed(3)} measures`
            + ` -- ${asNotes(over)} too long (or ${asNotes(bars[0].measure - over)} too short).`);
        if (hint) console.log(`      ${hint}`);
        bad++;
    });
}

console.log(bad
    ? `\n${bad} of ${checked} tunes will not loop cleanly.`
    : `\nAll ${checked} tunes loop cleanly.`);
process.exit(bad ? 1 : 0);
