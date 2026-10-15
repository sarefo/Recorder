#!/usr/bin/env node
/**
 * Rescale an ABC tune's note values by a factor, rebar it, and re-beam it.
 *
 *   node rescale.mjs in.abc out.abc 2    # double every duration, rebar, 4 bars per line
 *   node rescale.mjs in.abc out.abc 1    # only normalize beaming; bars and lines stay put
 *
 * Beaming rule (house style): a space before a note when it starts on a beat,
 * or when it or the previous note is a quarter or longer. Everything else in a
 * beat is written together so abcjs beams it.
 *
 * Notes that cross a new barline are split and tied. Accidentals are re-emitted
 * where rebarring would otherwise lose them. Handles the subset of ABC the MIDI
 * transcriptions use (one voice, chords, notes, rests, ties, plain barlines);
 * anything else is an error. Header lines are copied unchanged, so fix Q: and
 * add an N: line by hand. Verify with check_rescale.mjs.
 */
import fs from 'node:fs';

const [, , inPath, outPath, factorArg] = process.argv;
if (!inPath || !outPath || !factorArg) {
  console.error('usage: node rescale.mjs in.abc out.abc factor');
  process.exit(1);
}
const factor = Number(factorArg);

const KEY_FLATS = { C: '', Am: '', F: 'B', Dm: 'B', Bb: 'BE', Gm: 'BE', Fmix: 'BE', Eb: 'BEA', Cm: 'BEA' };
const KEY_SHARPS = { G: 'F', Em: 'F', D: 'FC', Bm: 'FC', A: 'FCG', 'F#m': 'FCG' };

const text = fs.readFileSync(inPath, 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');
const header = [];
let i = 0;
while (i < lines.length && /^([A-Za-z]:|%)/.test(lines[i])) header.push(lines[i++]);
const bodyLines = lines.slice(i).filter(l => l.trim() !== '');

const field = k => (header.find(l => l.startsWith(k + ':')) || '').slice(2).trim();
const [mNum, mDen] = field('M').split('/').map(Number);
const [lNum, lDen] = field('L').split('/').map(Number);
const key = field('K');
if (!(key in KEY_FLATS) && !(key in KEY_SHARPS)) throw new Error(`unsupported key ${key}`);
const keyOffset = letter => {
  const L = letter.toUpperCase();
  if ((KEY_FLATS[key] || '').includes(L)) return -1;
  if ((KEY_SHARPS[key] || '').includes(L)) return 1;
  return 0;
};

// Work in sixteenths of the L: unit so every duration is an integer.
const U = 16;
const barUnits = (U * mNum * lDen) / (mDen * lNum);
const beatUnits = (U * lDen) / (mDen * lNum);

const ACC = { '_': -1, '^': 1, '=': 0, '__': -2, '^^': 2 };
const ACC_STR = { '-1': '_', '1': '^', '0': '=', '-2': '__', '2': '^^' };

// Parse into events, tracking how many bars each source line holds.
const events = [];
const barsPerLine = [];
const tokenRe = /("[^"]*")|(\|\]|\|)|(\^\^|__|[_^=])?([A-Ga-gz])([,']*)(\d*)(\/+\d*)?(-?)|(\s+)/y;
let firstBarLen = null;
let barLen = 0;
let barAcc = {};
for (const line of bodyLines) {
  let bars = 0;
  let pendingChord = null;
  tokenRe.lastIndex = 0;
  while (tokenRe.lastIndex < line.length) {
    const at = tokenRe.lastIndex;
    const m = tokenRe.exec(line);
    if (!m) throw new Error(`cannot parse at "${line.slice(at, at + 20)}"`);
    if (m[1]) pendingChord = m[1];
    else if (m[2]) {
      bars++;
      if (firstBarLen === null) firstBarLen = barLen;
      barLen = 0;
      barAcc = {};
    } else if (m[4]) {
      let dur = U * (m[6] ? Number(m[6]) : 1);
      if (m[7]) {
        const slashes = m[7].match(/\/+/)[0].length;
        const den = m[7].replace(/\/+/, '');
        dur /= den ? Number(den) : 2 ** slashes;
      }
      if (!Number.isInteger(dur)) throw new Error(`duration too fine at "${line.slice(at, at + 20)}"`);
      const ev = { chord: pendingChord, rest: m[4] === 'z', dur: dur * factor, tie: m[8] === '-' };
      if (!ev.rest) {
        const pitch = m[4] + m[5];
        ev.letter = m[4];
        ev.octave = m[5];
        ev.explicit = !!m[3];
        if (m[3]) barAcc[pitch] = ACC[m[3]];
        ev.offset = pitch in barAcc ? barAcc[pitch] : keyOffset(m[4]);
      }
      pendingChord = null;
      barLen += dur;
      events.push(ev);
    }
  }
  if (pendingChord) throw new Error('chord with no note at end of line');
  barsPerLine.push(bars);
}

// Rebar: a short first bar is a pickup and stays one (scaled).
const pickup = firstBarLen < barUnits ? firstBarLen * factor : 0;
const outBars = [[]];
let pos = pickup ? barUnits - pickup : 0;
for (const ev of events) {
  let remaining = ev.dur;
  let first = true;
  while (remaining > 0) {
    if (pos === barUnits) {
      outBars.push([]);
      pos = 0;
    }
    const take = Math.min(remaining, barUnits - pos);
    remaining -= take;
    outBars[outBars.length - 1].push({
      ...ev,
      chord: first ? ev.chord : null,
      explicit: first ? ev.explicit : false,
      dur: take,
      tie: remaining > 0 ? !ev.rest : ev.tie,
      pos,
    });
    first = false;
    pos += take;
  }
}

// When rebarring, carry the prevailing chord onto any new bar that starts bare.
if (factor !== 1) {
  let current = null;
  for (const bar of outBars) {
    if (bar.length && !bar[0].chord && current) bar[0].chord = current;
    for (const ev of bar) if (ev.chord) current = ev.chord;
  }
}

const fmtDur = u => {
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(u, U);
  const p = u / d;
  const q = U / d;
  if (q === 1) return p === 1 ? '' : String(p);
  if (p === 1) return q === 2 ? '/' : `/${q}`;
  return `${p}/${q}`;
};

const barStrs = outBars.map(bar => {
  const reader = {};
  let s = '';
  bar.forEach((ev, k) => {
    const prev = bar[k - 1];
    if (k > 0 && (ev.pos % beatUnits === 0 || prev.dur >= beatUnits || ev.dur >= beatUnits)) s += ' ';
    if (ev.chord) s += ev.chord;
    if (ev.rest) s += 'z';
    else {
      const pitch = ev.letter + ev.octave;
      const assumed = pitch in reader ? reader[pitch] : keyOffset(ev.letter);
      if (ev.explicit || ev.offset !== assumed) {
        s += ACC_STR[ev.offset];
        reader[pitch] = ev.offset;
      }
      s += pitch;
    }
    s += fmtDur(ev.dur);
    if (ev.tie) s += '-';
  });
  return s;
});

// Lay out: keep the source's line breaks at factor 1, else 4 bars per line
// (a pickup bar rides along with the first line).
const out = [];
let b = 0;
const perLine = factor === 1 ? barsPerLine : [];
let lineIdx = 0;
while (b < barStrs.length) {
  let n = factor === 1 ? perLine[lineIdx++] : 4 + (b === 0 && pickup ? 1 : 0);
  const chunk = barStrs.slice(b, b + n);
  b += n;
  out.push(chunk.join(' |') + (b >= barStrs.length ? ' |]' : ' |'));
}

fs.writeFileSync(outPath, header.join('\n') + '\n' + out.join('\n') + '\n');
console.log(`${events.length} notes, ${outBars.length} bars written to ${outPath}`);
