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
        maj: [['ionian', 'lydian'], [0, 4, 7]],
        maj7: [['ionian', 'lydian'], [0, 4, 7, 11]],
        maj6: [['ionian', 'lydian'], [0, 4, 7, 9]],
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
        const mode = keyText.trim().slice(root.length).toLowerCase().replace(/\s+/g, '');
        const named = ['dor', 'mix', 'lyd', 'phr', 'loc', 'maj'].find(k => mode.startsWith(k));
        const modeKey = named || (mode.startsWith('m') ? 'm' : '');
        const rootPc = (ScaleAdvisor.LETTER_PC[root.letter] + root.acc + 12) % 12;
        return new Set(ScaleAdvisor.KEY_MODES[modeKey].map(s => (rootPc + s) % 12));
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
     * @returns {Object|null} {chord, rootLetter, rootAcc, scaleName, degrees, chordTones}
     *   where degrees lists each scale tone as {pc, letter, acc, interval}
     */
    static suggest(chordName, keyPcs) {
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
            if (!best || outside < best.outside) best = { name, steps, outside, order };
        });
        if (!best) {
            const name = candidates[0];
            best = { name, steps: ScaleAdvisor.SCALES[name][1] };
        }

        return {
            chord: chordName,
            rootLetter: root.letter,
            rootAcc: root.acc,
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
