/**
 * Suggests a scale for a chord symbol, judged against the tune's key.
 *
 * Each chord quality has a few candidate scales. The one that has to leave the
 * key the least wins, so Dm7 in C is Dorian, Ebmaj7 in Gm is Lydian (A natural,
 * not Ab) and D7 in Gm is Phrygian dominant (F#, Eb), without a rule per tune.
 */
class ScaleAdvisor {
    static LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    static LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    // name: [display name, semitones above the root]
    static SCALES = {
        ionian: ['major', [0, 2, 4, 5, 7, 9, 11]],
        lydian: ['Lydian', [0, 2, 4, 6, 7, 9, 11]],
        mixolydian: ['Mixolydian', [0, 2, 4, 5, 7, 9, 10]],
        lydianDominant: ['Lydian dominant', [0, 2, 4, 6, 7, 9, 10]],
        phrygianDominant: ['Phrygian dominant', [0, 1, 4, 5, 7, 8, 10]],
        altered: ['altered', [0, 1, 3, 4, 6, 8, 10]],
        wholeTone: ['whole tone', [0, 2, 4, 6, 8, 10]],
        dorian: ['Dorian', [0, 2, 3, 5, 7, 9, 10]],
        aeolian: ['minor', [0, 2, 3, 5, 7, 8, 10]],
        phrygian: ['Phrygian', [0, 1, 3, 5, 7, 8, 10]],
        melodicMinor: ['melodic minor', [0, 2, 3, 5, 7, 9, 11]],
        harmonicMinor: ['harmonic minor', [0, 2, 3, 5, 7, 8, 11]],
        locrian: ['Locrian', [0, 1, 3, 5, 6, 8, 10]],
        locrianNat2: ['Locrian ♭2', [0, 2, 3, 5, 6, 8, 10]],
        dimWH: ['diminished', [0, 2, 3, 5, 6, 8, 9, 11]]
    };

    // class: [candidate scales in order of preference, chord tones]
    static CLASSES = {
        // A triad or 6 chord leaves the 7th open: D in G is Mixolydian, E in
        // A minor Phrygian dominant
        maj: [['ionian', 'lydian', 'mixolydian', 'phrygianDominant'], [0, 4, 7]],
        maj7: [['ionian', 'lydian'], [0, 4, 7, 11]],
        maj6: [['ionian', 'lydian', 'mixolydian'], [0, 4, 7, 9]],
        dom: [['mixolydian', 'phrygianDominant', 'lydianDominant'], [0, 4, 7, 10]],
        domAlt: [['altered', 'phrygianDominant', 'lydianDominant', 'mixolydian', 'wholeTone'], [0, 4, 7, 10]],
        m: [['dorian', 'aeolian', 'phrygian'], [0, 3, 7]],
        m7: [['dorian', 'aeolian', 'phrygian'], [0, 3, 7, 10]],
        m6: [['melodicMinor', 'dorian'], [0, 3, 7, 9]],
        mMaj7: [['melodicMinor', 'harmonicMinor'], [0, 3, 7, 11]],
        m7b5: [['locrian', 'locrianNat2'], [0, 3, 6, 10]],
        dim: [['dimWH'], [0, 3, 6, 9]],
        aug: [['wholeTone', 'lydianDominant'], [0, 4, 8]],
        sus: [['mixolydian', 'dorian'], [0, 5, 7, 10]]
    };

    // Scale of each mode name abcjs reports for K:, as semitones above the tonic
    static KEY_MODES = {
        '': [0, 2, 4, 5, 7, 9, 11], maj: [0, 2, 4, 5, 7, 9, 11], major: [0, 2, 4, 5, 7, 9, 11],
        m: [0, 2, 3, 5, 7, 8, 10, 11], min: [0, 2, 3, 5, 7, 8, 10, 11], minor: [0, 2, 3, 5, 7, 8, 10, 11],
        dor: [0, 2, 3, 5, 7, 9, 10], mix: [0, 2, 4, 5, 7, 9, 10], lyd: [0, 2, 4, 6, 7, 9, 11],
        phr: [0, 1, 3, 5, 7, 8, 10], loc: [0, 1, 3, 5, 6, 8, 10]
    };

    // K: mode → the 7-note mode that is the tune's home (minor = natural minor)
    static KEY_HOME_MODES = {
        '': 'ionian', maj: 'ionian', m: 'aeolian', dor: 'dorian',
        mix: 'mixolydian', lyd: 'lydian', phr: 'phrygian', loc: 'locrian'
    };

    // Semitones from a mode's tonic down to the tonic of its major scale
    static MODE_OFFSET = {
        ionian: 0, dorian: 2, phrygian: 4, lydian: 5, mixolydian: 7, aeolian: 9, locrian: 11
    };

    // Moving to a new home costs as much as playing one note outside the
    // home for this many bars; shorter excursions stay marked changes
    static SWITCH_COST = 2;
    // Per bar spent in a home other than the K: one
    static AWAY_COST = 1;
    // A home must last this many bars, or its chords count as changes
    static MIN_STRETCH_BARS = 4;
    // Whole-note fraction a melody pitch must be held under a chord to count
    // when picking its scale (a dotted quarter's worth)
    static HELD_NOTE = 0.375;

    /**
     * Reads a root such as "Bb" or "F#" into a letter and a semitone offset.
     * @param {string} text - Text starting with a note letter
     * @returns {{letter: string, acc: number, length: number}|null}
     */
    static parseRoot(text) {
        const m = /^([A-G])([#b♯♭]?)/.exec(text || '');
        if (!m) return null;
        const acc = (m[2] === '#' || m[2] === '♯') ? 1 : (m[2] ? -1 : 0);
        return { letter: m[1], acc, length: m[0].length };
    }

    /**
     * Pitch classes the key allows; minor keys include the raised 7th.
     * @param {string} keyText - The value of the K: field, e.g. "Gm" or "Bb"
     * @returns {Set<number>|null}
     */
    static keyPitchClasses(keyText) {
        const root = ScaleAdvisor.parseRoot((keyText || '').trim());
        if (!root) return null;
        const modeKey = ScaleAdvisor.keyModeKey(keyText, root);
        const rootPc = (ScaleAdvisor.LETTER_PC[root.letter] + root.acc + 12) % 12;
        return new Set(ScaleAdvisor.KEY_MODES[modeKey].map(s => (rootPc + s) % 12));
    }

    /** Mode part of a K: value as a key of KEY_MODES, e.g. "m" for "Gm". */
    static keyModeKey(keyText, root) {
        const mode = keyText.trim().slice(root.length).toLowerCase().replace(/\s+/g, '');
        const named = ['dor', 'mix', 'lyd', 'phr', 'loc', 'maj'].find(k => mode.startsWith(k));
        return named || (mode.startsWith('m') ? 'm' : '');
    }

    /**
     * A home scale: seven notes that a stretch of the tune lives in.
     * @param {{letter: string, acc: number}} root - Tonic
     * @param {number} rootPc - Pitch class of the tonic
     * @param {string} mode - ionian, dorian, ... aeolian, locrian
     * @returns {{name: string, degrees: Array, pcs: Set<number>, set: number}}
     *   set is the pitch class of the major scale with the same notes
     */
    static makeHome(root, rootPc, mode) {
        const degrees = ScaleAdvisor.spell(root, rootPc, ScaleAdvisor.SCALES[mode][1]);
        return {
            name: `${ScaleAdvisor.label(degrees[0])} ${ScaleAdvisor.SCALES[mode][0]}`,
            degrees,
            pcs: new Set(degrees.map(d => d.pc)),
            set: (rootPc - ScaleAdvisor.MODE_OFFSET[mode] + 12) % 12
        };
    }

    /**
     * The home scale the K: field names; minor keys use natural minor, so
     * a raised 7th shows up as a change on the chords that need it.
     * @param {string} keyText - The value of the K: field
     * @returns {Object|null} See makeHome
     */
    static homeFromKey(keyText) {
        const root = ScaleAdvisor.parseRoot((keyText || '').trim());
        if (!root) return null;
        const mode = ScaleAdvisor.KEY_HOME_MODES[ScaleAdvisor.keyModeKey(keyText, root)];
        const rootPc = (ScaleAdvisor.LETTER_PC[root.letter] + root.acc + 12) % 12;
        return ScaleAdvisor.makeHome(root, rootPc, mode);
    }

    /**
     * Reads the chord symbols of a parsed tune with how long each one lasts.
     * @param {Object} tune - abcjs tune (renderAbc or parseOnly result)
     * @returns {Array<{chord: string, startChar: number, bars: number}>}
     */
    static readChords(tune) {
        let barLength = 1;
        try {
            const meter = tune.getMeterFraction?.();
            if (meter?.num && meter?.den) barLength = meter.num / meter.den;
        } catch (e) { /* M:none and the like: count whole notes */ }

        const entries = [];
        let time = 0;
        let tuplet = 1;
        let keyAcc = {};
        let carried = new Map();
        for (const line of tune?.lines || []) {
            // The first voice of the first staff carries the chords
            const staff = line.staff?.[0];
            keyAcc = {};
            for (const a of staff?.key?.accidentals || []) {
                keyAcc[String(a.note).toUpperCase()] = a.acc === 'flat' ? -1 : a.acc === 'sharp' ? 1 : 0;
            }
            const voice = staff?.voices?.[0] || [];
            for (const el of voice) {
                const chord = el.chord?.find(c => c.position === 'default' && c.name)?.name
                    || el.chord?.[0]?.name;
                if (chord && typeof el.startChar === 'number') {
                    entries.push({ chord, startChar: el.startChar, time, melody: new Map() });
                }
                if (el.el_type === 'bar') carried = new Map();
                if (el.el_type === 'note' && typeof el.duration === 'number') {
                    // abcjs leaves tuplet notes at written length
                    if (el.startTriplet) tuplet = el.tripletMultiplier ?? 2 / 3;
                    const length = el.duration * tuplet;
                    time += length;
                    if (el.endTriplet) tuplet = 1;

                    const current = entries[entries.length - 1];
                    for (const p of el.rest ? [] : el.pitches || []) {
                        const letter = String(p.name || '').replace(/[^A-Ga-g]/g, '').toUpperCase();
                        if (!(letter in ScaleAdvisor.LETTER_PC)) continue;
                        // An accidental holds for that pitch until the barline
                        const explicit = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2 }[p.accidental];
                        if (explicit !== undefined) carried.set(p.pitch, explicit);
                        if (!current) continue;
                        const acc = carried.get(p.pitch) ?? keyAcc[letter] ?? 0;
                        const pc = (ScaleAdvisor.LETTER_PC[letter] + acc + 12) % 12;
                        current.melody.set(pc, (current.melody.get(pc) || 0) + length);
                    }
                }
            }
        }
        entries.forEach((e, i) => {
            const end = i + 1 < entries.length ? entries[i + 1].time : time;
            e.bars = Math.max(0, end - e.time) / barLength;
            delete e.time;
        });
        return entries;
    }

    /**
     * Splits the tune into stretches that each live in one home scale, and
     * picks every chord's scale against its stretch's home.
     *
     * Each chord costs, per candidate home, the notes its best scale has
     * outside that home, weighted by how many bars it lasts. A dynamic
     * program then finds the cheapest path through the homes, paying
     * SWITCH_COST per move, so a one-bar D7 in C stays C major with an F♯
     * while a B section in a new key gets its own home.
     *
     * @param {Array<{chord: string, bars: number}>} entries - From readChords
     * @param {string} keyText - The value of the K: field
     * @returns {{keyHome: Object|null, stretches: Array, entries: Array}}
     *   stretches: [{start, end, home}] (entry indices, inclusive);
     *   entries: [{...entry, stretch, suggestion, added, dropped, change}]
     */
    static analyze(entries, keyText) {
        const keyHome = ScaleAdvisor.homeFromKey(keyText);
        const sets = Array.from({ length: 12 }, (_, s) =>
            new Set(ScaleAdvisor.SCALES.ionian[1].map(x => (s + x) % 12)));
        const cache = new Map();
        // The melody under the chord helps choose between its candidate scales
        const suggestIn = (i, s) => {
            const key = `${i}|${s}`;
            if (!cache.has(key)) {
                cache.set(key, ScaleAdvisor.suggest(entries[i].chord, sets[s], entries[i].melody));
            }
            return cache.get(key);
        };

        const n = entries.length;
        if (!n) return { keyHome, stretches: [], entries: [] };

        // A chord with no melody under it (a rest) borrows the melody the
        // same chord has elsewhere, so it gets the scale its twin does
        const pooled = new Map();
        for (const e of entries) {
            const pool = pooled.get(e.chord) || new Map();
            for (const [pc, length] of e.melody || []) pool.set(pc, (pool.get(pc) || 0) + length);
            pooled.set(e.chord, pool);
        }
        entries = entries.map(e => (e.melody && e.melody.size ? e : { ...e, melody: pooled.get(e.chord) }));

        // cost[i][s]: chord i judged against the major-scale notes on s
        const cost = entries.map((e, i) => {
            const w = Math.max(e.bars || 0, 0.25);
            return sets.map((_, s) => {
                const sug = suggestIn(i, s);
                if (!sug) return 0;
                // A chord tone outside the home counts twice: it is a change
                // you cannot dodge, a tension is one you can
                const rootPc = (ScaleAdvisor.LETTER_PC[sug.rootLetter] + sug.rootAcc + 12) % 12;
                const toneOut = [...sug.chordTones]
                    .filter(t => !sets[s].has((rootPc + t) % 12)).length;
                let c = (sug.outside + toneOut + 0.01 * sug.order) * w;
                // The K: home is preferred over a home the chords only lean to
                if (keyHome && s !== keyHome.set) c += ScaleAdvisor.AWAY_COST * w;
                return c;
            });
        });

        // Prefix sums: bars up to entry i, and cost of entries 0..i-1 per home
        const barsTo = [0];
        const costTo = [new Array(12).fill(0)];
        entries.forEach((e, i) => {
            barsTo.push(barsTo[i] + (e.bars || 0));
            costTo.push(costTo[i].map((c, s) => c + cost[i][s]));
        });

        // Cheapest split into stretches of at least MIN_STRETCH_BARS each:
        // F[j] is the best cost of entries 0..j-1, ending a stretch at j-1
        const minBars = Math.min(ScaleAdvisor.MIN_STRETCH_BARS, barsTo[n]);
        const F = new Array(n + 1).fill(Infinity);
        const back = new Array(n + 1);
        F[0] = 0;
        for (let j = 1; j <= n; j++) {
            for (let i = 0; i < j; i++) {
                if (F[i] === Infinity || barsTo[j] - barsTo[i] < minBars - 1e-9) continue;
                for (let s = 0; s < 12; s++) {
                    const c = F[i] + costTo[j][s] - costTo[i][s] + ScaleAdvisor.SWITCH_COST;
                    if (c < F[j]) { F[j] = c; back[j] = [i, s]; }
                }
            }
        }
        const path = new Array(n).fill(keyHome ? keyHome.set : 0);
        if (F[n] < Infinity) {
            for (let j = n; j > 0;) {
                const [i, s] = back[j];
                for (let k = i; k < j; k++) path[k] = s;
                j = i;
            }
        }
        const stretches = ScaleAdvisor.runs(path);

        for (const st of stretches) {
            st.home = keyHome && keyHome.set === st.set
                ? keyHome
                : ScaleAdvisor.nameHome(entries.slice(st.start, st.end + 1), st.set);
        }

        const result = entries.map((e, i) => {
            const k = stretches.findIndex(st => i >= st.start && i <= st.end);
            const home = stretches[k].home;
            const suggestion = suggestIn(i, path[i]);
            return { ...e, stretch: k, suggestion, ...ScaleAdvisor.changes(suggestion, home) };
        });
        return { keyHome, stretches, entries: result };
    }

    /** Runs of equal values: [{start, end, set}], end inclusive. */
    static runs(path) {
        const out = [];
        path.forEach((s, i) => {
            const last = out[out.length - 1];
            if (last && last.set === s) last.end = i;
            else out.push({ start: i, end: i, set: s });
        });
        return out;
    }

    /**
     * Names a stretch's home after the chord root that holds it longest,
     * in the mode that root has there: Am6 over the notes of G major is
     * A Dorian, Gmaj7 over D major is G Lydian.
     */
    static nameHome(entries, set) {
        const modes = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
        const major = ScaleAdvisor.SCALES.ionian[1];
        const weight = new Map();
        for (const e of entries) {
            const root = ScaleAdvisor.parseRoot(e.chord);
            if (!root) continue;
            const pc = (ScaleAdvisor.LETTER_PC[root.letter] + root.acc + 12) % 12;
            const degree = (pc - set + 12) % 12;
            if (!major.includes(degree)) continue;
            // A major or minor tonic chord names a key more readily (Tea for
            // Two's bridge is A major, though Bm7 E7 fills most of it)
            // (a tie goes to the major tonic over its relative minor)
            const tonic = degree === 0 ? 3.01 : degree === 9 ? 3 : 1;
            const key = `${root.letter}|${root.acc}`;
            weight.set(key, (weight.get(key) || 0) + tonic * Math.max(e.bars || 0, 0.25));
        }
        let top = null;
        for (const [key, w] of weight) if (!top || w > top[1]) top = [key, w];
        let root;
        if (top) {
            const [letter, acc] = top[0].split('|');
            root = { letter, acc: Number(acc) };
        } else {
            const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
            root = ScaleAdvisor.parseRoot(names[set]);
        }
        const rootPc = (ScaleAdvisor.LETTER_PC[root.letter] + root.acc + 12) % 12;
        const mode = modes[major.indexOf((rootPc - set + 12) % 12)];
        return ScaleAdvisor.makeHome(root, rootPc, mode);
    }

    /**
     * What a chord's scale changes against the home: notes it adds, home
     * notes it leaves out, and a label such as "F→F♯" or "+C♯ −C".
     * @returns {{added: Set<number>, dropped: Set<number>, change: string}}
     */
    static changes(suggestion, home) {
        if (!suggestion || !home) return { added: new Set(), dropped: new Set(), change: '' };
        const pcs = new Set(suggestion.degrees.map(d => d.pc));
        const added = suggestion.degrees.filter(d => !home.pcs.has(d.pc));
        const dropped = home.degrees.filter(d => !pcs.has(d.pc));
        const paired = new Set();
        const parts = added.map(a => {
            const was = dropped.find(d => d.letter === a.letter && !paired.has(d));
            if (!was) return `+${ScaleAdvisor.label(a)}`;
            paired.add(was);
            return `${ScaleAdvisor.label(was)}→${ScaleAdvisor.label(a)}`;
        });
        dropped.filter(d => !paired.has(d)).forEach(d => parts.push(`−${ScaleAdvisor.label(d)}`));
        return {
            added: new Set(added.map(d => d.pc)),
            dropped: new Set(dropped.map(d => d.pc)),
            change: parts.join(' ')
        };
    }

    /**
     * Sorts a chord symbol into one of the CLASSES.
     * @param {string} rest - The chord text after the root
     * @returns {string} A key of CLASSES
     */
    static classify(rest) {
        const q = rest.replace(/\(.*?\)/g, m => m.slice(1, -1));
        if (/^(maj|M|Δ|∆)/.test(q)) return 'maj7';
        if (/^(m7b5|m7♭5|min7b5|-7b5|ø)/.test(q)) return 'm7b5';
        if (/^(dim|o|°)/.test(q)) return 'dim';
        if (/^(m|min|-)(maj|M|Δ|∆)/.test(q)) return 'mMaj7';
        if (/^(m|min|-)6/.test(q)) return 'm6';
        if (/^(m|min|-)7/.test(q) || /^(m|min|-)(9|11|13)/.test(q)) return 'm7';
        if (/^(m|min|-)/.test(q)) return 'm';
        if (/^(aug|\+)/.test(q)) return 'aug';
        if (/^sus/.test(q)) return 'sus';
        if (/^6/.test(q)) return 'maj6';
        if (/^(7|9|11|13)/.test(q)) {
            return /(b9|#9|b13|#5|b5|#11|alt|♭|♯)/.test(q) ? 'domAlt' : 'dom';
        }
        return 'maj';
    }

    /**
     * Picks the scale for a chord.
     * @param {string} chordName - Chord symbol, e.g. "Cm7", "F7", "Ebmaj7"
     * @param {Set<number>|null} keyPcs - Pitch classes of the tune's key
     * @param {Map<number, number>|null} melody - Pitch class to how long the
     *   melody holds it under this chord. A candidate that leaves out a
     *   held melody note loses to one that has it (the D under A♭7 in G
     *   makes it Lydian dominant, not Phrygian dominant)
     * @returns {Object|null} {chord, rootLetter, rootAcc, scaleName, degrees, chordTones}
     *   where degrees lists each scale tone as {pc, letter, acc, interval}
     */
    static suggest(chordName, keyPcs, melody = null) {
        const root = ScaleAdvisor.parseRoot(chordName);
        if (!root) return null;
        const rest = chordName.slice(root.length).replace(/\/[A-G][#b]?$/, '');
        const cls = ScaleAdvisor.classify(rest);
        const [candidates, chordTones] = ScaleAdvisor.CLASSES[cls];
        const rootPc = (ScaleAdvisor.LETTER_PC[root.letter] + root.acc + 12) % 12;

        // Extensions the symbol names must be inside the scale
        const required = new Set(chordTones);
        if (cls === 'domAlt') {
            if (/b9|♭9/.test(rest)) required.add(1);
            if (/#9|♯9/.test(rest)) required.add(3);
            if (/#11|b5|♯11/.test(rest)) required.add(6);
            if (/b13|#5|♭13/.test(rest)) required.add(8);
        }

        let best = null;
        candidates.forEach((name, order) => {
            const [, steps] = ScaleAdvisor.SCALES[name];
            if (![...required].every(t => steps.includes(t))) return;
            const outside = keyPcs
                ? steps.filter(s => !keyPcs.has((rootPc + s) % 12)).length
                : 0;
            // Only notes held a dotted quarter's worth count; passing tones do not
            let missed = 0;
            if (melody) {
                for (const [pc, length] of melody) {
                    if (length >= ScaleAdvisor.HELD_NOTE - 1e-9
                        && !steps.some(s => (rootPc + s) % 12 === pc)) missed += length;
                }
            }
            if (!best || missed < best.missed - 1e-9
                || (Math.abs(missed - best.missed) <= 1e-9 && outside < best.outside)) {
                best = { name, steps, outside, order, missed };
            }
        });
        if (!best) {
            const name = candidates[0];
            const steps = ScaleAdvisor.SCALES[name][1];
            const outside = keyPcs ? steps.filter(s => !keyPcs.has((rootPc + s) % 12)).length : 0;
            best = { name, steps, outside, order: 0, missed: 0 };
        }

        return {
            chord: chordName,
            rootLetter: root.letter,
            rootAcc: root.acc,
            mode: best.name,
            outside: best.outside,
            order: best.order,
            scaleName: ScaleAdvisor.SCALES[best.name][0],
            degrees: ScaleAdvisor.spell(root, rootPc, best.steps),
            chordTones: new Set(chordTones)
        };
    }

    /**
     * Gives every scale step a note name. Seven-note scales use each letter
     * once (Eb Lydian has A natural, not Bbb); others use sharps or flats.
     * @returns {Array<{interval:number, pc:number, letter:string, acc:number}>}
     */
    static spell(root, rootPc, steps) {
        const letters = ScaleAdvisor.LETTERS;
        const rootIndex = letters.indexOf(root.letter);
        const useFlats = root.acc < 0 || root.letter === 'F';
        const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        return steps.map((interval, i) => {
            const pc = (rootPc + interval) % 12;
            if (steps.length === 7) {
                const letter = letters[(rootIndex + i) % 7];
                const acc = ((pc - ScaleAdvisor.LETTER_PC[letter] + 18) % 12) - 6;
                return { interval, pc, letter, acc };
            }
            const name = (useFlats ? flatNames : sharpNames)[pc];
            return { interval, pc, letter: name[0], acc: name.length > 1 ? (name[1] === '#' ? 1 : -1) : 0 };
        });
    }

    /**
     * ABC note for a scale degree, with the tonic placed in the octave from C4.
     * @param {Object} suggestion - Result of suggest()
     * @param {Object} degree - One entry of suggestion.degrees
     * @param {number} octaveShift - 0 for the tonic octave, 1 for the octave above
     * @returns {string} ABC note name, e.g. "_B", "c", "^f"
     */
    static abcNote(suggestion, degree, octaveShift = 0) {
        const rootMidi = 60 + ScaleAdvisor.LETTER_PC[suggestion.rootLetter] + suggestion.rootAcc;
        const midi = rootMidi + degree.interval + 12 * octaveShift;
        const natural = midi - degree.acc;
        const octave = Math.floor(natural / 12) - 1;
        let note = (degree.acc > 0 ? '^' : degree.acc < 0 ? '_' : '') + degree.letter;
        if (octave >= 5) note = note.slice(0, -1) + degree.letter.toLowerCase() + "'".repeat(octave - 5);
        else if (octave <= 3) note += ','.repeat(4 - octave);
        return note;
    }

    /**
     * Display name of a degree, e.g. "B♭".
     */
    static label(degree) {
        return degree.letter + (degree.acc > 0 ? '♯' : degree.acc < 0 ? '♭' : '');
    }
}
