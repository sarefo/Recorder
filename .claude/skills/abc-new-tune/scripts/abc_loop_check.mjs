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
// --report <file.md>: write a per-bar markdown breakdown of every failing tune.
const reportIdx = args.indexOf('--report');
const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : null;
// --skip <substring>: leave matching paths out, for corpus dumps like
// abc/chinese/670_songs.abc that are a source to pick from, not repertoire.
const skipIdx = args.indexOf('--skip');
const skipPattern = skipIdx >= 0 ? args[skipIdx + 1] : null;

// Directories are walked, so no shell has to glob filenames full of spaces.
function expand(target) {
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return [target];
    return fs.readdirSync(target, { withFileTypes: true })
        .flatMap(e => (e.isDirectory() ? expand(path.join(target, e.name))
            : e.name.toLowerCase().endsWith('.abc') ? [path.join(target, e.name)] : []))
        .sort();
}

const files = args
    .filter((a, n) => !a.startsWith('--') && n !== reportIdx + 1 && n !== skipIdx + 1)
    .flatMap(expand)
    .filter(f => !skipPattern || !f.includes(skipPattern));
if (!files.length) {
    console.error('usage: node abc_loop_check.mjs [--bad] <file.abc|dir> [...]');
    process.exit(2);
}

/**
 * Time of the last note-ON in a standard MIDI file, in quarter notes.
 *
 * The last note-OFF would be the obvious thing to measure, but abcjs shortens
 * a note that carries a staccato dot, so a tune ending on one measures short by
 * however much the dot took off. Where the last note STARTS is exact, and what
 * it is worth is written in the ABC.
 */
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
            // Note-on with a real velocity; 0x9n with velocity 0 is a note-off.
            if ((status & 0xf0) === 0x90 && d[p - 1] > 0 && tick > maxTick) maxTick = tick;
        }
        i = end;
    }
    return maxTick / division;
}

/**
 * What is still to run, in whole notes, after the tune's last note-ON: that
 * note's own written value, anything tied onto it (a tie sounds as one note, so
 * it has only the one note-on), and any rests after it.
 */
function tailAfterLastOnset(tune) {
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
        total += notes[i].duration;
        if (notes[i].rest) continue;
        if (!(notes[i].pitches || []).some(p => p.endTie)) break;
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
    // Source span of the bar being filled, so a report can quote it. A bar runs
    // from the end of the barline before it to the start of the one after.
    let from = null;
    let to = null;
    // Where a `:|` jumps back to, and which bar an alternative ending starts on,
    // so a short bar in front of either can be paired with what completes it.
    let sectionStart = 0;
    let groupPre = null;
    let startsEnding = false;
    let closesRepeat = false;

    for (const line of tune.lines) {
        if (!line.staff) continue;
        for (const staff of line.staff) {
            voices = Math.max(voices, staff.voices.length, line.staff.length);
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
                    if (from === null) from = el.startChar;
                    to = el.endChar;
                } else if (el.el_type === 'bar') {
                    const type = String(el.type || '');
                    if (type.includes('repeat') || el.startEnding || el.endEnding) repeats = true;
                    // End the span at the barline, not after it: abcjs sometimes
                    // reports an endChar well past it and the quote would then
                    // run into the next bar.
                    if (seen) {
                        out.push({
                            filled, measure, from,
                            to: Math.max(to, Math.min(el.startChar ?? to, el.endChar ?? to)),
                            idx: out.length,
                            // Set below, once this barline says what follows it.
                            endingPre: startsEnding ? groupPre : null,
                            repeatTarget: null,
                        });
                    }
                    startsEnding = false;
                    if (type === 'bar_right_repeat' || type === 'bar_dbl_repeat') {
                        if (out.length) out[out.length - 1].repeatTarget = sectionStart;
                    }
                    if (type === 'bar_left_repeat' || type === 'bar_dbl_repeat') {
                        sectionStart = out.length;
                    }
                    if (el.startEnding) {
                        // The bar before the FIRST ending is the one every
                        // alternative ending has to complete.
                        if (groupPre === null || String(el.startEnding).trim() === '1') {
                            groupPre = out.length - 1;
                        }
                        startsEnding = true;
                    }
                    filled = 0;
                    seen = false;
                    from = null;
                }
            }
        }
    }
    if (seen) {
        out.push({
            filled, measure, from, to, idx: out.length,
            endingPre: startsEnding ? groupPre : null, repeatTarget: null,
        });
    }
    return { bars: out, meters, written, repeats, voices };
}

/**
 * Every partial bar has to be completed by SOME bar it actually abuts when the
 * tune is played. This works out who abuts whom and keeps the bars nothing
 * completes.
 *
 * A bar's partners are its neighbours in the file; the first and last bar of
 * the tune, because the app loops straight from one to the other; the two ends
 * of a `:|`, since the repeat jumps from the bar before it back to the start of
 * the section; and the bar in front of a first ending, which every alternative
 * ending lands after in turn.
 *
 * A bar may answer more than one join -- a pickup after `|:` completes both the
 * bar before the `:|` and, at the end, the tune's final bar -- so this is a
 * reachability test, not a matching.
 *
 * @returns {Array|null} The bars left unanswered, or null when all are answered
 */
function pairPartials(partial, bars, measure) {
    const partners = bars.map(() => new Set());
    const link = (a, b) => {
        if (a == null || b == null || a === b || !bars[a] || !bars[b]) return;
        partners[a].add(b);
        partners[b].add(a);
    };
    for (let i = 0; i + 1 < bars.length; i++) link(i, i + 1);
    link(0, bars.length - 1);                       // the loop join
    bars.forEach((b, i) => { link(i, b.repeatTarget); link(i, b.endingPre); });

    const rest = partial.filter(b => ![...partners[b.idx]]
        .some(j => Math.abs(bars[j].filled + b.filled - b.measure) < EPS));
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
    if (starts.length <= 1) return [{ text: src, firstLine: 0, headerLines: 0 }];
    const header = lines.slice(0, starts[0]).join('\n');
    const headerLines = header ? starts[0] : 0;
    return starts.map((start, i) => {
        const body = lines.slice(start, starts[i + 1] ?? lines.length).join('\n');
        return {
            text: header ? header + '\n' + body : body,
            firstLine: start,          // 0-based line of this tune's X: in the file
            headerLines,               // lines of file header glued on in front
        };
    });
}

/** 1-based line in the original FILE for a character offset in a tune chunk. */
function fileLine(chunk, offset) {
    if (offset === null || offset === undefined) return null;
    const upto = chunk.text.slice(0, offset).split('\n').length - 1;   // 0-based
    return chunk.firstLine + (upto - chunk.headerLines) + 1;
}

let bad = 0;
let checked = 0;

/**
 * Rows for the markdown report: one per failing tune, listing every bar whose
 * length is not a full measure and whether something else completes it.
 */
const report = [];
let collect = () => {};

for (const file of files) {
    let sources;
    try {
        sources = splitTunes(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.log(`BROKEN  ${file}: ${err.message}`);
        bad++;
        continue;
    }

    sources.forEach((chunk, i) => {
        const src = chunk.text;
        let tune;
        let midis;
        try {
            tune = abcjs.parseOnly(src)[0];
            // chordsOff: the accompaniment's last release can sit past the final
            // melody note and would otherwise be read as extra length.
            // Inline [Q:] changes are dropped first: abcjs scales tick durations
            // by the tempo, so a tune that slows down measures long. How fast it
            // is played has nothing to do with whether it comes round evenly.
            midis = abcjs.synth.getMidiFile(src.replace(/\[Q:[^\]]*\]/g, ''),
                { midiOutputType: 'binary', chordsOff: true });
        } catch (err) {
            console.log(`BROKEN  ${file} [tune ${i + 1}]: ${err.message}`);
            bad++;
            return;
        }
        if (!tune || !midis || !midis.length) return;
        const label = sources.length > 1 ? `${file} [tune ${i + 1}/${sources.length}]` : file;
        // A stub with a title and a TODO but no K: is not a tune yet; abcjs
        // still reads stray letters in the prose as notes.
        if (!/^K:/m.test(src)) {
            if (!onlyBad) console.log(`--      ${label} (no K: line -- not written yet)`);
            return;
        }
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

        // Everything a report entry needs, captured while the parse is in hand.
        collect = (kind, verdict) => {
            const unpaired = pairPartials(partial, bars, bars[0].measure) || [];
            const isUnpaired = b => unpaired.some(u => u.idx === b.idx);
            report.push({
                file,
                tune: sources.length > 1 ? `${i + 1}/${sources.length}` : null,
                title: (tune.metaText?.title || '').trim(),
                meter: asNotes(bars[0].measure),
                barCount: bars.length,
                kind,
                verdict,
                bars: partial.map(b => ({
                    n: b.idx + 1,
                    line: fileLine(chunk, b.from),
                    have: asNotes(b.filled),
                    want: asNotes(b.measure),
                    over: b.filled > b.measure + EPS,
                    unpaired: isUnpaired(b),
                    // abcjs puts startChar at the opening paren of a slur, so a
                    // slurred bar's span can begin inside the bar before it.
                    // Everything after the last barline in the slice is this bar.
                    text: (b.from !== null && b.to !== null
                        ? src.slice(b.from, b.to).split('|').pop() : '')
                        .replace(/\s+/g, ' ').trim(),
                })),
            });
        };

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
                collect('METER', 'the meter changes mid-tune and the bars do not balance');
                bad++;
            }
            return;
        }

        const measureQ = 4 * bars[0].measure;
        const total = playedQuarters(Object.values(midis[0]))
            + tailAfterLastOnset(tune) * 4;

        // Self-check. With no repeat to expand and a single voice, the played
        // length has to equal the written length; if it does not, the
        // measurement is being thrown off by something this script does not
        // model (grace notes, a second voice abcjs merges, an exotic bar type)
        // and any verdict from it would be a guess.
        if (!repeats && voices === 1 && Math.abs(total - written * 4) > 2e-2) {
            console.log(`SUSPECT ${label}`);
            console.log(`        written ${asNotes(written)} but measured`
                + ` ${asNotes(total / 4)} with no repeats -- not judged.`);
            collect('SUSPECT', `written ${asNotes(written)} but measured ${asNotes(total / 4)}`
                + ' with no repeats to expand -- not judged');
            bad++;
            return;
        }

        const measures = total / measureQ;
        const off = measures - Math.round(measures);

        if (Math.abs(off) < 5e-3) {
            // The pass is a whole number of measures, so the loop join lands on
            // the beat. A repeat inside the tune is a second kind of join that
            // the timeline cannot show: the bar before a `:|` and the bar the
            // repeat lands on have to add up to one measure, exactly as a pickup
            // and a final bar do. An UNDER-full bar that nothing completes is
            // that defect. Over-full bars are a different complaint -- a bar
            // with too many beats in it -- so --bars has to be asked for.
            // With two staves the bars of both are concatenated, so "the next
            // bar" is not a join anything plays; only the total is meaningful.
            const unpaired = voices === 1
                ? pairPartials(partial, bars, bars[0].measure) : null;
            if (unpaired) {
                const short = unpaired.filter(b => b.filled < b.measure - EPS);
                const show = showBars ? unpaired : short;
                if (show.length) {
                    console.log(`JOIN    ${label}`);
                    console.log(`        loops, but ${short.length ? 'a repeat lands off the beat' : 'bars do not add up'}: `
                        + show.map(b => `#${b.idx + 1}=${asNotes(b.filled)} of ${asNotes(b.measure)}`).join(', '));
                    collect('JOIN', 'the pass is a whole number of measures, but a bar inside'
                        + ' the tune is not completed by anything');
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
        collect('LOOP', `one pass is ${measures.toFixed(3)} measures`
            + ` -- ${asNotes(over)} too long (or ${asNotes(bars[0].measure - over)} too short)`);
        bad++;
    });
}

/**
 * Markdown, one section per failing tune, listing every bar that is not a full
 * measure with the line it starts on and the notes actually in it.
 *
 * A bar marked "ok" is a legitimate partial: a pickup answered by the final
 * bar, or the short bar before a `:|` answered by the pickup after it. The ones
 * to look at are the rest.
 */
function writeReport(dest) {
    const KINDS = {
        LOOP: ['Pass is not a whole number of measures',
            'These do not loop: the join between the end and the beginning lands off'
            + ' the beat. Where a bar in the middle is over- or under-full, that bar is'
            + ' why, and retiming the last note would hide it rather than fix it.'],
        JOIN: ['Loops, but a bar inside the tune is unanswered',
            'One pass is the right length, so the loop itself is fine, but a partial'
            + ' bar in the middle has nothing completing it -- usually a repeat that'
            + ' lands mid-bar.'],
        METER: ['Meter changes and the bars do not balance', ''],
        SUSPECT: ['Could not be measured', 'The played length disagrees with the written'
            + ' length even though there is no repeat to expand, so the script will not'
            + ' pass judgement on these. Worth a look by hand.'],
    };
    const esc = s => String(s).replace(/\|/g, '\\|');
    const out = [];
    out.push('# Bars that are not a full measure', '');
    out.push('Regenerate with:', '');
    out.push('```bash');
    out.push('node .claude/skills/abc-new-tune/scripts/abc_loop_check.mjs \\');
    out.push(`    ${args.join(' ')}`);
    out.push('```', '');
    const oddCount = r => r.bars.filter(b => b.unpaired).length;
    const one = report.filter(r => oddCount(r) === 1).length;
    const few = report.filter(r => oddCount(r) >= 2 && oddCount(r) <= 3).length;
    const many = report.filter(r => oddCount(r) >= 4).length;
    out.push(`${report.length} tunes, from ${new Set(report.map(r => r.file)).size} files.`
        + ' Bar numbers count every barline in playing order, so they match what the'
        + ' checker prints on the terminal. Line numbers are 1-based in the file, and'
        + ' point at the start of the bar.', '');
    out.push(`${one} of them have a single bad bar, ${few} have two or three, and ${many}`
        + ' are mis-barred throughout. The first group is where the quick wins are.', '');
    out.push('A bar listed as **ok, answered** is a legitimate partial and should be left'
        + ' alone: either a pickup that the final bar pays back, or the short bar before'
        + ' a `:|` that the pickup after the repeat completes. The ones to fix are marked'
        + ' **too long** or **too short**.', '');
    out.push('Lengths are what abcjs makes of the notation, which is what the app plays —'
        + ' so a tuplet counts as abcjs reads it, not as it was perhaps meant. In a bar'
        + ' full of slurs the quoted notes can start or stop a little early, because'
        + ' abcjs anchors a slurred note to its opening bracket; the bar and line numbers'
        + ' are still exact.', '');

    for (const kind of ['LOOP', 'JOIN', 'METER', 'SUSPECT']) {
        const rows = report.filter(r => r.kind === kind);
        if (!rows.length) continue;
        out.push(`## ${KINDS[kind][0]} (${rows.length})`, '');
        if (KINDS[kind][1]) out.push(KINDS[kind][1], '');
        for (const r of rows) {
            out.push(`### ${r.file.replace(/\\/g, '/')}${r.tune ? ` — tune ${r.tune}` : ''}`);
            out.push('');
            out.push(`*${r.title || '(untitled)'}* · ${r.meter} per bar · ${r.barCount} bars · ${r.verdict}.`);
            out.push('');
            const odd = r.bars.filter(b => b.unpaired);
            if (!r.bars.length) {
                out.push('Every bar is a full measure; the length comes from somewhere else'
                    + ' (a repeat structure, or a tie across the end).');
            } else {
                out.push('| bar | line | has | wants | | notes in the bar |');
                out.push('|----:|-----:|----:|------:|:--|:---|');
                for (const b of r.bars) {
                    const mark = b.unpaired ? (b.over ? 'too long' : 'too short') : 'ok, answered';
                    out.push(`| ${b.n} | ${b.line ?? ''} | ${b.have} | ${b.want} | ${mark} |`
                        + ` \`${esc(b.text) || ' '}\` |`);
                }
                if (odd.length) {
                    out.push('');
                    out.push(`Look at bar${odd.length > 1 ? 's' : ''} `
                        + odd.map(b => `**${b.n}** (line ${b.line})`).join(', ') + '.');
                }
            }
            out.push('');
        }
    }
    fs.writeFileSync(dest, out.join('\n').replace(/\r\n/g, '\n') + '\n');
    console.log(`\nwrote ${dest} (${report.length} tunes)`);
}

if (reportPath) writeReport(reportPath);

console.log(bad
    ? `\n${bad} of ${checked} tunes will not loop cleanly.`
    : `\nAll ${checked} tunes loop cleanly.`);
process.exit(bad ? 1 : 0);
