// Transposes every tune through the app's own TransposeManager and proves that
// each melody note moved by exactly the shift and each chord root with it.
//
//   node .claude/skills/abc-keys/scripts/transpose_check.mjs [path-filter]
//   SHIFTS=1,2,-1 node .claude/skills/abc-keys/scripts/transpose_check.mjs klezmer
//
// "refused" means the guard kept the tune as it was. Files that hold only a TODO
// have no music and are skipped.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = {
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    querySelector: () => null,
};
(0, eval)(fs.readFileSync(path.join(root, '.claude/skills/abc-chords/scripts/abcjs-cache.js'), 'utf8'));
const load = (file, name) => (0, eval)(`(()=>{${fs.readFileSync(path.join(root, file), 'utf8')};return ${name}})()`);
globalThis.AbcTransposer = load('js/notation/abc-transposer.js', 'AbcTransposer');
const manager = new (load('js/notation/transpose-manager.js', 'TransposeManager'))();

const shifts = (process.env.SHIFTS || '-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1,1,2,3,4,5,6,7,8,9,10,11,12,-12')
    .split(',').map(Number);
const filter = process.argv[2];

const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (full.endsWith('.abc')) out.push(full);
    }
    return out;
};

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const name = (letter, sign) => PITCH[letter] + (sign === '#' ? 1 : sign === 'b' ? -1 : 0);
const chords = abc => {
    const found = [];
    for (const line of abc.split('\n')) {
        if (/^[A-Za-z+]:(?![|:])/.test(line) || line.startsWith('%')) continue;
        const parts = line.split('%')[0].split('"');
        for (let i = 1; i < parts.length; i += 2) {
            const chord = parts[i].match(/^\(?([A-G])([#b]?)(?:maj|min|m|M|dim|aug|sus|add|\+|-|°|ø|o|\d|\(|\)|#|b)*(?:\/([A-G])([#b]?))?\)?$/);
            if (chord) found.push([name(chord[1], chord[2]), chord[3] ? name(chord[3], chord[4]) : null]);
        }
    }
    return found;
};
const warnings = abc => (ABCJS.parseOnly(abc)[0].warnings || []).length;

let checks = 0;
const problems = [];
for (const file of walk(path.join(root, 'abc')).filter(f => !filter || f.includes(filter))) {
    const abc = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    if (/^TODO/m.test(abc)) continue;
    const pitches = manager.getPitches(abc);
    if (!pitches.length) continue;
    const symbols = chords(abc);

    for (const shift of shifts) {
        checks++;
        const report = message => problems.push(`${path.relative(root, file)}  ${shift}: ${message}`);
        const result = manager.transpose(abc, shift);
        if (result === abc) { report('refused'); continue; }

        const moved = manager.getPitches(result);
        const wrong = moved.filter((pitch, i) => pitch - pitches[i] !== shift).length;
        if (moved.length !== pitches.length || wrong) { report(`${wrong} wrong of ${pitches.length}`); continue; }

        const movedSymbols = chords(result);
        const sameChords = movedSymbols.length === symbols.length && symbols.every(([chord, bass], i) =>
            (movedSymbols[i][0] - chord - shift) % 12 === 0
            && (bass === null || (movedSymbols[i][1] - bass - shift) % 12 === 0));
        if (!sameChords) report('chords moved wrongly');
        else if (warnings(result) > warnings(abc)) report('new parse warnings');
    }
}

console.log(problems.join('\n'));
console.log(`${checks} checks, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
