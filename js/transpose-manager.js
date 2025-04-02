/**
  * Handles all note transposition functionality
  */
class TransposeManager {
    noteToSemitone(accidental, noteLetter, octaveMarkers) {
        // Base values for each note
        const baseValues = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

        // Start with base value
        let semitone = baseValues[noteLetter.toUpperCase()];

        // Apply accidentals
        if (accidental) {
            for (const acc of accidental) {
                if (acc === '^') semitone += 1;
                else if (acc === '_') semitone -= 1;
            }
        }

        // Set octave (C is middle C = octave 4, c is octave 5)
        let octave = noteLetter === noteLetter.toUpperCase() ? 4 : 5;

        // Apply octave markers
        if (octaveMarkers) {
            for (const marker of octaveMarkers) {
                if (marker === ',') octave -= 1;
                else if (marker === "'") octave += 1;
            }
        }

        // Calculate absolute semitone value
        return semitone + (octave * 12);
    }

    semitoneToAbc(semitone, duration) {
        // Get octave and note value
        const octave = Math.floor(semitone / 12);
        const noteValue = ((semitone % 12) + 12) % 12;

        // Map semitones to note names with accidentals
        const noteMap = [
            { note: 'C', accidental: '' },
            { note: 'C', accidental: '^' },
            { note: 'D', accidental: '' },
            { note: 'D', accidental: '^' },
            { note: 'E', accidental: '' },
            { note: 'F', accidental: '' },
            { note: 'F', accidental: '^' },
            { note: 'G', accidental: '' },
            { note: 'G', accidental: '^' },
            { note: 'A', accidental: '' },
            { note: 'A', accidental: '^' },
            { note: 'B', accidental: '' }
        ];

        // Get note information
        const { note, accidental } = noteMap[noteValue];

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
        const keyMatch = keyLine.match(/K:([A-G][#b]?)([m]?)/);
        if (!keyMatch) return keyLine;

        const [, key, mode] = keyMatch;

        // Map keys to semitones
        const keyToSemitone = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };

        // Map semitones to key names
        const semitoneToKey = {
            0: 'C', 1: 'C#', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
            6: 'F#', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B'
        };

        let semitone = keyToSemitone[key];
        if (semitone === undefined) return keyLine;

        semitone = (semitone + semitoneShift + 12) % 12;
        const newKey = semitoneToKey[semitone];

        return keyLine.replace(/K:[A-G][#b]?[m]?/, `K:${newKey}${mode}`);
    }

    transposeNote(note, semitoneShift) {
        const match = note.match(/([_^=]*)([A-Ga-g])([,']*)([\d/]*)/);
        if (!match) return note;

        const [, accidental, noteLetter, octaveMarkers, duration] = match;

        // Convert to semitone value
        const semitone = this.noteToSemitone(accidental, noteLetter, octaveMarkers);

        // Apply transposition
        const newSemitone = semitone + semitoneShift;

        // Convert back to ABC notation
        return this.semitoneToAbc(newSemitone, duration);
    }

    transposeNotes(noteLines, semitoneShift) {
        const noteRegex = /([_^=]*)([A-Ga-g])([,']*)([\d/]*)/g;

        return noteLines.map(line => {
            return line.replace(noteRegex, (match) => {
                return this.transposeNote(match, semitoneShift);
            });
        });
    }
}

export default TransposeManager;