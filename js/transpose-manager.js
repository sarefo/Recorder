class TransposeManager {
    constructor() {
        // Initialize music theory data structures
        this.setupMusicTheoryData();
    }

    setupMusicTheoryData() {
        // Base note values and mapping
        this.noteValues = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

        // Major key signatures (positive = # of sharps, negative = # of flats)
        this.keySignatures = {
            'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
            'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7
        };

        // Order of sharps and flats in key signatures
        this.sharpOrder = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
        this.flatOrder = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

        // Circle of fifths for key selection
        this.keysInCircle = [
            'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
            'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'
        ];
    }

    // Get key signature information (which notes have accidentals)
    getKeySignatureNotes(key) {
        const keyRoot = key.replace(/m$/, '');
        const accidentalCount = this.keySignatures[keyRoot] || 0;
        const affectedNotes = {};

        if (accidentalCount > 0) {
            // Handle sharp key signatures
            for (let i = 0; i < accidentalCount; i++) {
                affectedNotes[this.sharpOrder[i]] = '^';
            }
        } else if (accidentalCount < 0) {
            // Handle flat key signatures
            for (let i = 0; i < Math.abs(accidentalCount); i++) {
                affectedNotes[this.flatOrder[i]] = '_';
            }
        }

        return affectedNotes;
    }

    // Improved note-to-semitone conversion with better accidental handling
    noteToSemitone(accidental, noteLetter, octaveMarkers) {
        // Get base semitone value for the note letter
        let semitone = this.noteValues[noteLetter.toUpperCase()];

        // Apply accidentals with improved handling for double accidentals
        if (accidental) {
            for (let i = 0; i < accidental.length; i++) {
                if (accidental[i] === '^') {
                    if (i + 1 < accidental.length && accidental[i + 1] === '^') {
                        semitone += 2; // Double sharp
                        i++; // Skip next character
                    } else {
                        semitone += 1; // Single sharp
                    }
                } else if (accidental[i] === '_') {
                    if (i + 1 < accidental.length && accidental[i + 1] === '_') {
                        semitone -= 2; // Double flat
                        i++; // Skip next character
                    } else {
                        semitone -= 1; // Single flat
                    }
                }
                // Natural sign (=) doesn't change the semitone value
            }
        }

        // Calculate octave
        let octave = noteLetter === noteLetter.toUpperCase() ? 4 : 5;

        if (octaveMarkers) {
            for (const marker of octaveMarkers) {
                if (marker === ',') octave -= 1;
                else if (marker === "'") octave += 1;
            }
        }

        // Calculate absolute semitone value
        return semitone + (octave * 12);
    }

    semitoneToAbc(semitone, duration, key) {
        const octave = Math.floor(semitone / 12);
        const noteValue = ((semitone % 12) + 12) % 12;

        // Simplified note mapping for C major
        // This defines the most natural way to represent each semitone in C major
        const cMajorMap = {
            0: { note: 'C', accidental: '' },      // C
            1: { note: 'C', accidental: '^' },     // C#
            2: { note: 'D', accidental: '' },      // D
            3: { note: 'E', accidental: '_' },     // Eb
            4: { note: 'E', accidental: '' },      // E
            5: { note: 'F', accidental: '' },      // F
            6: { note: 'F', accidental: '^' },     // F#
            7: { note: 'G', accidental: '' },      // G
            8: { note: 'G', accidental: '^' },     // G#
            9: { note: 'A', accidental: '' },      // A
            10: { note: 'B', accidental: '_' },    // Bb
            11: { note: 'B', accidental: '' }      // B
        };

        // For all keys, use the C major mapping when we're in C major
        const keyMatch = key.match(/([A-G][#b]?)([m]?)/);
        const keyRoot = keyMatch ? keyMatch[1] : 'C';
        const keyMode = keyMatch ? keyMatch[2] : '';

        let noteData;

        // Special handling for C major - always use the C major map
        if (keyRoot === 'C' && keyMode === '') {
            noteData = cMajorMap[noteValue];
        } else {
            // For other keys, use the original logic
            const keySignatureValue = this.keySignatures[keyRoot.replace('#', '♯').replace('b', '♭')] || 0;
            const useSharp = keySignatureValue >= 0;

            if (useSharp) {
                // Sharp key mapping
                const sharpMap = [
                    { note: 'C', accidental: '' },     // 0
                    { note: 'C', accidental: '^' },    // 1
                    { note: 'D', accidental: '' },     // 2
                    { note: 'D', accidental: '^' },    // 3
                    { note: 'E', accidental: '' },     // 4
                    { note: 'F', accidental: '' },     // 5
                    { note: 'F', accidental: '^' },    // 6
                    { note: 'G', accidental: '' },     // 7
                    { note: 'G', accidental: '^' },    // 8
                    { note: 'A', accidental: '' },     // 9
                    { note: 'A', accidental: '^' },    // 10
                    { note: 'B', accidental: '' }      // 11
                ];
                noteData = sharpMap[noteValue];
            } else {
                // Flat key mapping
                const flatMap = [
                    { note: 'C', accidental: '' },     // 0
                    { note: 'D', accidental: '_' },    // 1
                    { note: 'D', accidental: '' },     // 2
                    { note: 'E', accidental: '_' },    // 3
                    { note: 'E', accidental: '' },     // 4
                    { note: 'F', accidental: '' },     // 5
                    { note: 'G', accidental: '_' },    // 6
                    { note: 'G', accidental: '' },     // 7
                    { note: 'A', accidental: '_' },    // 8
                    { note: 'A', accidental: '' },     // 9
                    { note: 'B', accidental: '_' },    // 10
                    { note: 'B', accidental: '' }      // 11
                ];
                noteData = flatMap[noteValue];
            }
        }

        const { note, accidental } = noteData;

        // Format note based on octave
        let formattedNote, octaveMarkers = '';

        if (octave < 4) {
            // Lower octaves: uppercase with commas
            formattedNote = note.toUpperCase();
            octaveMarkers = ','.repeat(4 - octave);
        } else if (octave === 4) {
            // Middle octave: uppercase
            formattedNote = note.toUpperCase();
        } else if (octave === 5) {
            // One octave up: lowercase
            formattedNote = note.toLowerCase();
        } else {
            // Higher octaves: lowercase with apostrophes
            formattedNote = note.toLowerCase();
            octaveMarkers = "'".repeat(octave - 5);
        }

        return accidental + formattedNote + octaveMarkers + duration;
    }

    transposeKey(keyLine, semitoneShift) {
        // Extract just the key name from the key directive
        const keyMatch = keyLine.match(/K:\s*([A-G][#b]?)([m]?)/i);
        if (!keyMatch) return keyLine;

        const [, key, mode] = keyMatch;

        // Map keys to semitones
        const keyToSemitone = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };

        // Map semitones to preferred key names (avoiding theoretical keys)
        const semitoneToKey = {
            0: 'C', 1: 'C#', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
            6: 'F#', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B'
        };

        let semitone = keyToSemitone[key];
        if (semitone === undefined) return keyLine;

        semitone = (semitone + semitoneShift + 12) % 12;
        const newKey = semitoneToKey[semitone];

        // Create new key directive with proper spacing
        // Find the exact key part in the original line and replace just that part
        return keyLine.replace(/([K|k]:\s*)([A-G][#b]?[m]?)/, `$1${newKey}${mode}`);
    }

    // Main note transposition function
    transposeNote(note, semitoneShift, key) {
        const match = note.match(/([_^=]*)([A-Ga-g])([,']*)([\d/]*)/);
        if (!match) return note;

        const [, accidental, noteLetter, octaveMarkers, duration] = match;

        // Convert to semitone value
        const semitone = this.noteToSemitone(accidental, noteLetter, octaveMarkers);

        // Calculate the new key for context-aware notation
        const keyMatch = key.match(/([A-G][#b]?)([m]?)/);
        const keyRoot = keyMatch ? keyMatch[1] : 'C';
        const keyMode = keyMatch ? keyMatch[2] : '';

        // Convert key to standard notation
        const standardKey = keyRoot.replace('#', '♯').replace('b', '♭') + keyMode;

        // Calculate new semitone and convert to ABC with key context
        const newSemitone = semitone + semitoneShift;
        return this.semitoneToAbc(newSemitone, duration, standardKey);
    }

    // Transpose all notes in an ABC piece
    transposeNotes(noteLines, semitoneShift, key) {
        const noteRegex = /([_^=]*)([A-Ga-g])([,']*)([\d/]*)/g;

        return noteLines.map(line => {
            return line.replace(noteRegex, (match) => {
                return this.transposeNote(match, semitoneShift, key);
            });
        });
    }
}