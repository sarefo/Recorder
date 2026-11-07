/**
 * Transposes ABC text note by note, keeping its formatting.
 *
 * abcjs's strTranspose is not used because it mishandles this repertoire: it
 * ignores explicit accidentals in K: (K: Dphr ^f, K: A exp _B^c), drops or merges
 * lines after a K: field, and throws on some tunes.
 *
 * Every note moves by the same number of letter steps as the tonic, then takes
 * whatever accidental gives the wanted pitch. The accidental is written only
 * when the key signature and the earlier notes of the bar don't already give it.
 */
class AbcTransposer {
    static ATTEMPTS = 5;
    static LETTERS = 'CDEFGAB';
    static NATURALS = [0, 2, 4, 5, 7, 9, 11];
    static FIFTHS = 'FCGDAEB';
    static MODES = { '': 0, maj: 0, ion: 0, mix: -1, dor: -2, m: -3, min: -3, aeo: -3, phr: -4, loc: -5, lyd: 1 };
    static ACCIDENTALS = { '^^': 2, '^': 1, '=': 0, '_': -1, '__': -2 };
    static KEY_PATTERN = /^(\s*)([A-G][#b]?)?(\s*)(maj[a-z]*|min[a-z]*|ion[a-z]*|aeo[a-z]*|mix[a-z]*|dor[a-z]*|phr[a-z]*|lyd[a-z]*|loc[a-z]*|m(?![a-z]))?(\s*)(exp\b\s*)?((?:(?:\^\^|\^|__|_|=)[a-gA-G]\s*)*)(.*)$/i;
    static NOTE_PATTERN = /(\^\^|\^|__|_|=)?([A-Ga-g])([,']*)/y;

    /**
     * Transposes a whole ABC text
     * @param {string} abc - The ABC notation, with LF line endings
     * @param {number} semitones - The shift in semitones
     * @param {number} [attempt=0] - Which spelling to use, best first, up to ATTEMPTS - 1
     * @returns {string} The transposed ABC notation
     */
    static transpose(abc, semitones, attempt = 0) {
        const state = { semitones, attempt, fifths: 0, source: {}, target: {}, steps: 0, bar: new Map(), barTarget: new Map(), tied: new Map(), chord: new Map(), inChord: false, inGrace: false };
        const lines = abc.split('\n');
        this.startTune(lines, 0, state);
        return lines.map((line, index) => {
            if (index > 0 && /^X:/.test(line)) this.startTune(lines, index, state);
            return this.transposeLine(line, state);
        }).join('\n');
    }

    /**
     * Chooses one move around the circle of fifths for a whole tune, so that all
     * its keys go up the same number of letters. Keys that drifted apart (D to Db
     * with Dm to C#m) would be played wrongly by abcjs across a repeat. The move
     * gives the smallest signature, avoiding double accidentals, flats winning a tie.
     * A tune whose keys need different moves (Em and Fm up a semitone) gets the
     * smallest signature for each key instead. Later attempts take the next best.
     * @private
     */
    static startTune(lines, start, state) {
        const end = lines.findIndex((line, index) => index > start && /^X:/.test(line));
        const keys = [];
        for (const line of lines.slice(start, end < 0 ? undefined : end)) {
            const isField = /^[A-Za-z+]:(?![|:])/.test(line);
            const values = line.startsWith('K:') ? [line.slice(2)]
                : isField || line.startsWith('%') ? []
                : [...line.matchAll(/\[K:([^\]]*)\]/g)].map(match => match[1]);
            for (const value of values) {
                const [, , tonic = 'C', , mode = '', , , extras] = value.match(this.KEY_PATTERN);
                keys.push({ tonic, mode, extras });
            }
        }
        if (!keys.length) keys.push({ tonic: 'C', mode: '', extras: '' });

        const base = this.mod(7 * state.semitones, 12);
        const moves = [base - 24, base - 12, base, base + 12]
            .map(move => ({ move, size: Math.max(...keys.map(key => this.signatureSize(key, move, state.semitones))) }))
            .sort((a, b) => a.size - b.size || a.move - b.move);
        const options = moves.filter(({ size }) => size < 100).map(({ move }) => move);
        options.push(null, ...moves.filter(({ size }) => size >= 100).map(({ move }) => move));
        state.fifths = options[Math.min(state.attempt, options.length - 1)];
        state.source = {};
        state.target = {};
        this.clearBar(state, true);
    }

    /** @private */
    static smallestMove(key, semitones) {
        const base = this.mod(7 * semitones, 12);
        return [base - 12, base]
            .map(move => ({ move, size: this.signatureSize(key, move, semitones) }))
            .sort((a, b) => a.size - b.size || a.move - b.move)[0].move;
    }

    /**
     * How many accidentals a key would need after a move, doubles counting heavily
     * @private
     */
    static signatureSize({ tonic, mode, extras }, move, semitones) {
        const name = this.nameOf(this.fifthsOf(tonic) + move);
        const steps = this.stepsBetween(tonic, name, semitones);
        const mapped = Object.values(this.mapSignature(this.signature(tonic, mode, extras), steps, semitones));
        const doubles = mapped.filter(accidental => Math.abs(accidental) > 1).length + (name.length > 2 ? 1 : 0);
        return mapped.filter(accidental => accidental !== 0).length + 100 * doubles;
    }

    /** @private */
    static transposeLine(line, state) {
        const field = line.match(/^([A-Za-z+]):(?![|:])(.*)$/);
        if (field) {
            if (field[1] === 'K') return `K:${this.transposeKeyField(field[2], state)}`;
            if (field[1] === 'V' || field[1] === 'X') this.clearBar(state, true);
            return line;
        }
        if (line.startsWith('%')) return line;
        return this.transposeBody(line, state);
    }

    /** @private */
    static transposeBody(line, state) {
        let out = '';
        let i = 0;
        while (i < line.length) {
            const c = line[i];
            if (c === '%') return out + line.slice(i);

            if (c === '"' || c === '!' || c === '+') {
                const end = line.indexOf(c, i + 1);
                if (end < 0) { out += c; i++; continue; }
                const text = line.slice(i + 1, end);
                out += c + (c === '"' ? this.transposeChordSymbol(text, state) : text) + c;
                i = end + 1;
                continue;
            }

            if (c === '[' && /^[A-Za-z]:/.test(line.slice(i + 1, i + 3))) {
                const end = line.indexOf(']', i);
                if (end < 0) return out + line.slice(i);
                if (line[i + 1] === 'K') {
                    out += `[K:${this.transposeKeyField(line.slice(i + 3, end), state)}]`;
                } else {
                    if (line[i + 1] === 'V') this.clearBar(state, true);
                    out += line.slice(i, end + 1);
                }
                i = end + 1;
                continue;
            }

            if (c === '{' || c === '}') state.inGrace = c === '{';
            if (c === '[' && /[^\d|]/.test(line[i + 1] || '|')) state.inChord = true;
            if (c === ']' && state.inChord) {
                state.inChord = false;
                this.endChord(state, this.isTied(line, i + 1));
            }

            if (c === '|' || (c === ':' && line[i + 1] === ':')) {
                this.clearBar(state, false);
                out += c;
                i++;
                continue;
            }

            this.NOTE_PATTERN.lastIndex = i;
            const note = this.NOTE_PATTERN.exec(line);
            if (note) {
                out += this.transposeNote(note, state, this.isTied(line, i + note[0].length));
                i += note[0].length;
                continue;
            }

            out += c;
            i++;
        }
        return out;
    }

    /** @private */
    static transposeNote([, accidental, letter, marks], state, tiedOn) {
        const lower = letter === letter.toLowerCase();
        const octave = (lower ? 5 : 4) + (marks.match(/'/g) || []).length - (marks.match(/,/g) || []).length;
        const upper = letter.toUpperCase();
        const index = octave * 7 + this.LETTERS.indexOf(upper);

        // A note tied across a barline keeps the accidental of the note it continues
        const carried = !state.inGrace && state.tied.has(index);
        const written = accidental !== undefined ? this.ACCIDENTALS[accidental]
            : carried ? state.tied.get(index)
            : state.bar.has(index) ? state.bar.get(index)
            : state.source[upper] || 0;
        // abcjs ignores the accidental of a note that ends a tie for the rest of the bar
        if (accidental !== undefined && !carried) state.bar.set(index, written);
        if (!state.inGrace) {
            state.chord.set(index, { written, tiedOn });
            if (!state.inChord) this.endChord(state, false);
        }

        const pitch = this.natural(index) + written + state.semitones;
        let target = index + state.steps;
        let wanted = pitch - this.natural(target);
        if (Math.abs(wanted) > 1) {
            target += Math.sign(wanted);
            wanted = pitch - this.natural(target);
        }

        const targetLetter = this.LETTERS[this.mod(target, 7)];
        const current = state.barTarget.has(target) ? state.barTarget.get(target) : state.target[targetLetter] || 0;
        let sign = '';
        if (accidental !== undefined || wanted !== current) {
            sign = Object.keys(this.ACCIDENTALS).find(key => this.ACCIDENTALS[key] === wanted);
            if (!carried) state.barTarget.set(target, wanted);
        }

        const targetOctave = Math.floor(target / 7);
        return sign + (targetOctave >= 5
            ? targetLetter.toLowerCase() + "'".repeat(targetOctave - 5)
            : targetLetter + ','.repeat(4 - targetOctave));
    }

    /**
     * Records which notes of the event that just ended tie into the next one
     * @private
     */
    static endChord(state, wholeChordTied) {
        state.tied.clear();
        for (const [index, { written, tiedOn }] of state.chord) {
            if (tiedOn || wholeChordTied) state.tied.set(index, written);
        }
        state.chord.clear();
    }

    /** @private */
    static isTied(line, position) {
        return /^[\d/]*-/.test(line.slice(position, position + 8));
    }

    /**
     * Rewrites the value of a K: field and switches the state to that key
     * @private
     */
    static transposeKeyField(value, state) {
        const [, lead, tonic, gap, mode = '', modeGap, exp, extras, tail] = value.match(this.KEY_PATTERN);
        if (!tonic && !extras) return value;

        // abcjs reads "exp" as an addition to the key, so that is what is transposed
        const source = this.signature(tonic || 'C', mode, extras);
        const move = state.fifths ?? this.smallestMove({ tonic: tonic || 'C', mode, extras }, state.semitones);
        const name = this.nameOf(this.fifthsOf(tonic || 'C') + move);
        const steps = this.stepsBetween(tonic || 'C', name, state.semitones);
        const base = this.signature(name, mode, '');
        const mapped = this.mapSignature(source, steps, state.semitones);

        const target = { ...base };
        const written = [];
        for (const letter of this.LETTERS) {
            const accidental = mapped[letter];
            if (accidental === (base[letter] || 0) || Math.abs(accidental) > 1) continue;
            // abcjs can't lift the F of seven flats out of a K: field
            if (letter === 'F' && base.F < 0) continue;
            target[letter] = accidental;
            const sign = Object.keys(this.ACCIDENTALS).find(key => this.ACCIDENTALS[key] === accidental);
            written.push(sign + this.keyLetter(letter, base));
        }

        state.source = source;
        state.target = target;
        state.steps = steps;

        const list = written.join(/\s/.test(extras.trim()) ? ' ' : '');
        const tailGap = tail && list ? ' ' : '';
        return `${lead}${name}${gap}${mode}${list ? modeGap : ''}${list}${tailGap}${tail}`;
    }

    /**
     * Spells a letter for a K: field. abcjs folds every letter to one case except
     * G, which must match the signature or both accidentals stay.
     * @private
     */
    static keyLetter(letter, base) {
        return letter === 'G' && base.G < 0 ? 'G' : letter.toLowerCase();
    }

    /**
     * Letter steps between two tonics that add up to the shift in semitones
     * @private
     */
    static stepsBetween(from, to, semitones) {
        const start = this.LETTERS.indexOf(from[0]);
        const end = this.LETTERS.indexOf(to[0]);
        const wanted = semitones + this.accidentalOf(from) - this.accidentalOf(to);
        const estimate = Math.round(semitones * 7 / 12);
        for (let steps = estimate - 7; steps <= estimate + 7; steps++) {
            if (this.mod(start + steps, 7) === end && this.natural(start + steps) - this.natural(start) === wanted) {
                return steps;
            }
        }
        return estimate;
    }

    /**
     * The accidental of each letter in a key
     * @private
     */
    static signature(tonic, mode, extras) {
        const result = {};
        const fifths = this.fifthsOf(tonic) + this.modeOffset(mode);
        for (let i = 0; i < Math.abs(fifths); i++) {
            const letter = fifths > 0 ? this.FIFTHS[i % 7] : this.FIFTHS[6 - (i % 7)];
            result[letter] = (result[letter] || 0) + Math.sign(fifths);
        }
        for (const [, accidental, letter] of extras.matchAll(/(\^\^|\^|__|_|=)([a-gA-G])/g)) {
            result[letter.toUpperCase()] = this.ACCIDENTALS[accidental];
        }
        return result;
    }

    /** @private */
    static mapSignature(source, steps, semitones) {
        const mapped = {};
        for (let index = 0; index < 7; index++) {
            const target = index + steps;
            const pitch = this.natural(index) + (source[this.LETTERS[index]] || 0) + semitones;
            mapped[this.LETTERS[this.mod(target, 7)]] = pitch - this.natural(target);
        }
        return mapped;
    }

    /**
     * Transposes the root and bass of a chord symbol, leaving annotations alone
     * @private
     */
    static transposeChordSymbol(text, state) {
        const chord = text.match(/^(\(?)([A-G])([#b]?)((?:maj|min|m|M|dim|aug|sus|add|\+|-|°|ø|o|\d|\(|\)|#|b)*)(?:\/([A-G])([#b]?))?(\)?)$/);
        if (!chord) return text;
        const [, open, root, rootSign, quality, bass, bassSign, close] = chord;
        const name = (letter, sign) => this.transposeChordNote(letter, sign, state);
        return `${open}${name(root, rootSign)}${quality}${bass ? `/${name(bass, bassSign)}` : ''}${close}`;
    }

    /** @private */
    static transposeChordNote(letter, sign, state) {
        const index = this.LETTERS.indexOf(letter);
        const pitch = this.natural(index) + (sign === '#' ? 1 : sign === 'b' ? -1 : 0) + state.semitones;
        let target = index + state.steps;
        let accidental = pitch - this.natural(target);
        if (Math.abs(accidental) > 1) {
            target += Math.sign(accidental);
            accidental = pitch - this.natural(target);
        }
        const name = this.LETTERS[this.mod(target, 7)] + (accidental > 0 ? '#' : accidental < 0 ? 'b' : '');
        return { 'E#': 'F', 'B#': 'C', Fb: 'E', Cb: 'B' }[name] || name;
    }

    /** @private */
    static clearBar(state, all) {
        state.bar.clear();
        state.barTarget.clear();
        if (all) {
            state.tied.clear();
            state.chord.clear();
        }
    }

    /** @private */
    static modeOffset(mode) {
        const name = mode.toLowerCase();
        return this.MODES[name === 'm' ? 'm' : name.slice(0, 3)] || 0;
    }

    /** @private */
    static natural(index) {
        return Math.floor(index / 7) * 12 + this.NATURALS[this.mod(index, 7)];
    }

    /** @private */
    static accidentalOf(name) {
        return name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
    }

    /** @private */
    static fifthsOf(name) {
        return this.FIFTHS.indexOf(name[0]) - 1 + 7 * this.accidentalOf(name);
    }

    /** @private */
    static nameOf(fifths) {
        const accidental = Math.floor((fifths + 1) / 7);
        return this.FIFTHS[this.mod(fifths + 1, 7)] + (accidental > 0 ? '#'.repeat(accidental) : 'b'.repeat(-accidental));
    }

    /** @private */
    static mod(value, base) {
        return ((value % base) + base) % base;
    }
}
