/**
 * AbcGenerator - Generates ABC notation from note events
 */

import { midiToAbc } from '../core/utils.js';

export class AbcGenerator {
    constructor() {
        this.defaultTempo = 120;
        this.defaultMeter = '4/4';
        this.defaultKey = 'C';
    }

    /**
     * Generate ABC notation from notes
     * @param {Array} notes - Array of note objects
     * @param {Object} options - Generation options
     * @returns {string} ABC notation string
     */
    generate(notes, options = {}) {
        const title = options.title || 'Extracted Melody';
        const tempo = options.tempo || this._estimateTempo(notes);
        const meter = options.meter || this.defaultMeter;
        const key = options.key || this.defaultKey;
        const transpose = options.transpose || 0;  // Semitones to transpose (e.g., -12 for down one octave)

        // Calculate timing parameters
        const beatsPerMeasure = parseInt(meter.split('/')[0]);
        const beatUnit = parseInt(meter.split('/')[1]);
        const beatDuration = 60 / tempo;  // Duration of one beat in seconds
        const eighthNoteDuration = beatDuration / 2;  // Duration of eighth note
        const measureDuration = (beatsPerMeasure / beatUnit) * 4 * beatDuration;

        // Build header
        let abc = '';
        abc += `X:1\n`;
        abc += `T:${title}\n`;
        abc += `M:${meter}\n`;
        abc += `L:1/8\n`;
        abc += `Q:1/4=${tempo}\n`;
        abc += `K:${key}\n`;

        // Generate notes
        if (notes.length === 0) {
            abc += 'z8 |]\n';  // Empty measure with rest
        } else {
            abc += this._notesToAbcString(notes, eighthNoteDuration, measureDuration, transpose);
        }

        return abc;
    }

    /**
     * Convert notes to ABC string
     * @private
     */
    _notesToAbcString(notes, eighthNoteDuration, measureDuration, transpose = 0) {
        let abc = '';
        let currentMeasureTime = 0;
        let lastEndTime = 0;

        // Sort notes by start time
        const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

        for (let i = 0; i < sortedNotes.length; i++) {
            const note = sortedNotes[i];

            // Check for rest (gap before this note)
            const gap = note.startTime - lastEndTime;
            if (gap > eighthNoteDuration * 0.3) {
                const restResult = this._addRest(gap, eighthNoteDuration, currentMeasureTime, measureDuration);
                abc += restResult.abc;
                currentMeasureTime = restResult.measureTime;
            }

            // Add the note (may span multiple measures)
            const transposedMidi = note.midi + transpose;
            const abcNote = midiToAbc(transposedMidi);
            const quantizedDuration = this._quantizeDuration(note.duration, eighthNoteDuration);
            const noteDurationSeconds = quantizedDuration * eighthNoteDuration;

            const noteResult = this._addNote(abcNote, noteDurationSeconds, eighthNoteDuration, currentMeasureTime, measureDuration);
            abc += noteResult.abc;
            currentMeasureTime = noteResult.measureTime;

            lastEndTime = note.endTime;

            // Add line break every 4 measures for readability
            if (abc.split('|').length % 5 === 0 && abc.includes('|')) {
                abc = abc.trimEnd() + '\n';
            }
        }

        // Ensure proper ending
        abc = abc.trimEnd();
        if (!abc.endsWith('|')) {
            abc += ' |]';
        } else if (!abc.endsWith('|]')) {
            abc = abc.slice(0, -1) + '|]';
        }

        return abc + '\n';
    }

    /**
     * Add a note to the ABC string, handling measure boundaries with ties
     * @private
     */
    _addNote(abcNote, noteDuration, eighthNoteDuration, currentMeasureTime, measureDuration) {
        let abc = '';
        let remainingDuration = noteDuration;
        let measureTime = currentMeasureTime;
        const tolerance = eighthNoteDuration * 0.05; // Small tolerance for rounding

        while (remainingDuration > tolerance) {
            const spaceInMeasure = measureDuration - measureTime;

            if (remainingDuration <= spaceInMeasure + tolerance) {
                // Note fits in current measure
                const quantized = this._quantizeDuration(remainingDuration, eighthNoteDuration);
                abc += abcNote + this._getDurationSuffix(quantized) + ' ';
                measureTime += quantized * eighthNoteDuration;

                // Check if measure is now full
                if (Math.abs(measureTime - measureDuration) < tolerance) {
                    abc = abc.trimEnd() + ' | ';
                    measureTime = 0;
                }
                break;
            } else {
                // Note crosses bar line - split with tie
                const quantized = this._quantizeDuration(spaceInMeasure, eighthNoteDuration);
                if (quantized > 0) {
                    abc += abcNote + this._getDurationSuffix(quantized) + '-| '; // Tie across bar
                    remainingDuration -= quantized * eighthNoteDuration;
                    measureTime = 0;
                } else {
                    // Measure is full, start new measure
                    abc = abc.trimEnd() + ' | ';
                    measureTime = 0;
                }
            }
        }

        return { abc, measureTime };
    }

    /**
     * Add a rest to the ABC string
     * @private
     */
    _addRest(gapDuration, eighthNoteDuration, currentMeasureTime, measureDuration) {
        let abc = '';
        let remainingGap = gapDuration;
        let measureTime = currentMeasureTime;
        const tolerance = eighthNoteDuration * 0.05;

        while (remainingGap > eighthNoteDuration * 0.3) {
            const spaceInMeasure = measureDuration - measureTime;
            const quantized = this._quantizeDuration(Math.min(remainingGap, spaceInMeasure), eighthNoteDuration);

            if (quantized === 0) break; // Safety check

            const restDuration = quantized * eighthNoteDuration;
            abc += 'z' + this._getDurationSuffix(quantized) + ' ';
            remainingGap -= restDuration;
            measureTime += restDuration;

            // Check if measure is now full
            if (Math.abs(measureTime - measureDuration) < tolerance) {
                abc = abc.trimEnd() + ' | ';
                measureTime = 0;
            }
        }

        return { abc, measureTime };
    }

    /**
     * Quantize duration to nearest musical value
     * @private
     */
    _quantizeDuration(durationSeconds, eighthNoteDuration) {
        const eighthNotes = durationSeconds / eighthNoteDuration;

        // Standard durations in eighth notes: 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16
        const standardDurations = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];

        let closest = standardDurations[0];
        let minDiff = Math.abs(eighthNotes - closest);

        for (const dur of standardDurations) {
            const diff = Math.abs(eighthNotes - dur);
            if (diff < minDiff) {
                minDiff = diff;
                closest = dur;
            }
        }

        return closest;
    }

    /**
     * Get ABC duration suffix
     * @private
     */
    _getDurationSuffix(eighthNotes) {
        // ABC duration notation with L:1/8 base
        switch (eighthNotes) {
            case 0.5: return '/2';     // sixteenth note
            case 1: return '';         // eighth note (default)
            case 1.5: return '3/2';    // dotted eighth
            case 2: return '2';        // quarter note
            case 3: return '3';        // dotted quarter
            case 4: return '4';        // half note
            case 6: return '6';        // dotted half
            case 8: return '8';        // whole note
            case 12: return '12';      // dotted whole
            case 16: return '16';      // double whole (breve)
            default:
                // Handle other durations
                if (eighthNotes < 1) {
                    return '/' + Math.round(1 / eighthNotes);
                }
                return Math.round(eighthNotes).toString();
        }
    }

    /**
     * Estimate tempo from note durations
     * @private
     */
    _estimateTempo(notes) {
        if (notes.length < 2) return this.defaultTempo;

        // Calculate average note duration
        const durations = notes.map(n => n.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        // Assume average note is an eighth note → calculate BPM
        // eighth note = 0.5 beats, so if avgDuration = time for 0.5 beat
        // beat duration = avgDuration * 2
        // tempo = 60 / beatDuration = 60 / (avgDuration * 2) = 30 / avgDuration
        const estimatedTempo = 30 / avgDuration;

        // Round to nearest common tempo
        const commonTempos = [60, 66, 72, 80, 88, 92, 100, 108, 112, 120, 132, 144, 160, 176, 200];
        return commonTempos.reduce((prev, curr) =>
            Math.abs(curr - estimatedTempo) < Math.abs(prev - estimatedTempo) ? curr : prev
        );
    }

    /**
     * Get statistics about the generated ABC
     * @param {Array} notes - Array of note objects
     * @returns {Object} Statistics
     */
    getStatistics(notes) {
        if (notes.length === 0) {
            return { noteCount: 0, avgConfidence: 0, userCorrected: 0, duration: 0 };
        }

        const avgConfidence = notes.reduce((sum, n) => sum + n.confidence, 0) / notes.length;
        const userCorrected = notes.filter(n => n.userCorrected).length;
        const duration = notes[notes.length - 1].endTime - notes[0].startTime;

        return {
            noteCount: notes.length,
            avgConfidence: Math.round(avgConfidence * 100),
            userCorrected: userCorrected,
            duration: duration.toFixed(1)
        };
    }
}
