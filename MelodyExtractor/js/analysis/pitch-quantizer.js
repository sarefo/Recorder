/**
 * PitchQuantizer - Utilities for quantizing pitches to musical notes
 */

import { frequencyToMidi, midiToNoteName, midiToAbc } from '../core/utils.js';

export class PitchQuantizer {
    constructor() {
        // Standard note names for display
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // ABC note names (with sharps)
        this.abcNotes = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B'];
    }

    /**
     * Quantize a frequency to the nearest MIDI note
     * @param {number} frequency - Frequency in Hz
     * @returns {Object} Object with midi, noteName, cents deviation
     */
    quantizeFrequency(frequency) {
        if (frequency <= 0) {
            return { midi: null, noteName: null, cents: 0 };
        }

        const exactMidi = frequencyToMidi(frequency);
        const roundedMidi = Math.round(exactMidi);
        const cents = Math.round((exactMidi - roundedMidi) * 100);

        return {
            midi: roundedMidi,
            noteName: midiToNoteName(roundedMidi),
            cents: cents
        };
    }

    /**
     * Get the closest note in a given scale
     * @param {number} midi - MIDI note number
     * @param {string} key - Key signature (e.g., 'C', 'G', 'Am')
     * @returns {number} Adjusted MIDI note in scale
     */
    snapToScale(midi, key = 'C') {
        // Scale intervals from root
        const majorScale = [0, 2, 4, 5, 7, 9, 11];
        const minorScale = [0, 2, 3, 5, 7, 8, 10];

        // Determine root and scale type
        const isMinor = key.includes('m');
        const root = this._keyToMidi(key.replace('m', ''));
        const scale = isMinor ? minorScale : majorScale;

        // Find closest scale degree
        const noteInOctave = midi % 12;
        const octave = Math.floor(midi / 12);

        let closestDegree = 0;
        let minDistance = 12;

        for (const degree of scale) {
            const scaleTone = (root + degree) % 12;
            const distance = Math.min(
                Math.abs(noteInOctave - scaleTone),
                12 - Math.abs(noteInOctave - scaleTone)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestDegree = scaleTone;
            }
        }

        return octave * 12 + closestDegree;
    }

    /**
     * Convert key name to MIDI note (C = 0)
     * @private
     */
    _keyToMidi(key) {
        const keyMap = {
            'C': 0, 'C#': 1, 'Db': 1,
            'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'Fb': 4,
            'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8,
            'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11, 'Cb': 11
        };
        return keyMap[key] || 0;
    }

    /**
     * Analyze pitch stability in a set of values
     * @param {Array} pitches - Array of pitch values (Hz)
     * @returns {Object} Statistics about pitch stability
     */
    analyzePitchStability(pitches) {
        if (pitches.length === 0) {
            return { stable: false, averagePitch: 0, variance: 0 };
        }

        // Filter out zero values
        const validPitches = pitches.filter(p => p > 0);
        if (validPitches.length === 0) {
            return { stable: false, averagePitch: 0, variance: 0 };
        }

        // Calculate average
        const sum = validPitches.reduce((a, b) => a + b, 0);
        const avg = sum / validPitches.length;

        // Calculate variance in cents
        let varianceSum = 0;
        for (const pitch of validPitches) {
            const cents = 1200 * Math.log2(pitch / avg);
            varianceSum += cents * cents;
        }
        const variance = Math.sqrt(varianceSum / validPitches.length);

        return {
            stable: variance < 50,  // Less than 50 cents variance
            averagePitch: avg,
            variance: variance,
            quantized: this.quantizeFrequency(avg)
        };
    }

    /**
     * Get recorder-friendly range (soprano recorder: C5-A7)
     * @returns {Object} Min and max MIDI notes for recorder
     */
    getRecorderRange() {
        return {
            min: 72,  // C5
            max: 93,  // A6 (practical range)
            extended: 105  // A7 (with extreme fingerings)
        };
    }

    /**
     * Check if a MIDI note is in recorder range
     * @param {number} midi - MIDI note number
     * @returns {boolean} True if in range
     */
    isInRecorderRange(midi) {
        const range = this.getRecorderRange();
        return midi >= range.min && midi <= range.extended;
    }

    /**
     * Transpose notes to fit recorder range
     * @param {Array} notes - Array of note objects
     * @returns {Array} Transposed notes
     */
    transposeForRecorder(notes) {
        if (notes.length === 0) return notes;

        const range = this.getRecorderRange();

        // Find the average pitch
        const avgMidi = notes.reduce((sum, n) => sum + n.midi, 0) / notes.length;

        // Determine octave shift needed
        let octaveShift = 0;
        if (avgMidi < range.min) {
            octaveShift = Math.ceil((range.min - avgMidi) / 12);
        } else if (avgMidi > range.max) {
            octaveShift = -Math.ceil((avgMidi - range.max) / 12);
        }

        // Apply transposition
        return notes.map(note => ({
            ...note,
            midi: note.midi + octaveShift * 12,
            noteName: midiToNoteName(note.midi + octaveShift * 12),
            transposed: octaveShift !== 0
        }));
    }
}
