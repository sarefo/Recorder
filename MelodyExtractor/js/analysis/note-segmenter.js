/**
 * NoteSegmenter - Converts pitch frames into discrete note events
 */

import { frequencyToMidi, midiToNoteName } from '../core/utils.js';

export class NoteSegmenter {
    constructor(config) {
        this.config = config;
    }

    /**
     * Segment pitch data into note events
     * @param {Array} pitches - Array of pitch values (Hz)
     * @param {Array} confidences - Array of confidence values (0-1)
     * @param {number} hopSize - Hop size in samples
     * @param {number} sampleRate - Sample rate in Hz
     * @param {Array} tapTimestamps - Optional array of user-marked note onset times
     * @returns {Array} Array of note objects
     */
    segmentNotes(pitches, confidences, hopSize, sampleRate, tapTimestamps = []) {
        // If tap timestamps are provided, use tap-based segmentation
        if (tapTimestamps && tapTimestamps.length > 0) {
            console.log('Using tap-based segmentation with', tapTimestamps.length, 'markers');
            return this._segmentWithTaps(pitches, confidences, hopSize, sampleRate, tapTimestamps);
        }

        // Otherwise use automatic pitch-change detection
        return this._segmentAutomatic(pitches, confidences, hopSize, sampleRate);
    }

    /**
     * Segment using user-provided tap timestamps
     * @private
     */
    _segmentWithTaps(pitches, confidences, hopSize, sampleRate, tapTimestamps) {
        const notes = [];
        const frameDuration = hopSize / sampleRate;
        const audioDuration = pitches.length * frameDuration;

        // Sort tap timestamps
        const sortedTaps = [...tapTimestamps].sort((a, b) => a - b);

        // Add end of audio as final boundary
        sortedTaps.push(audioDuration);

        for (let i = 0; i < sortedTaps.length - 1; i++) {
            const startTime = sortedTaps[i];
            const endTime = sortedTaps[i + 1];

            // Skip if duration too short
            if (endTime - startTime < this.config.minNoteDuration) {
                continue;
            }

            // Find the dominant pitch in this time window
            const startFrame = Math.floor(startTime / frameDuration);
            const endFrame = Math.min(Math.floor(endTime / frameDuration), pitches.length);

            const result = this._findDominantPitch(pitches, confidences, startFrame, endFrame);

            if (result.midi !== null) {
                notes.push({
                    id: `note-${i}`,
                    midi: result.midi,
                    noteName: midiToNoteName(result.midi),
                    startTime: startTime,
                    endTime: endTime,
                    duration: endTime - startTime,
                    confidence: result.confidence,
                    userCorrected: false
                });
            }
        }

        console.log('Tap-based segmentation created', notes.length, 'notes');
        return notes;
    }

    /**
     * Find the dominant pitch in a frame range
     * @private
     */
    _findDominantPitch(pitches, confidences, startFrame, endFrame) {
        const pitchCounts = {};
        let totalConfidence = 0;
        let confidenceCount = 0;

        for (let i = startFrame; i < endFrame; i++) {
            const pitch = pitches[i];
            const confidence = confidences[i];

            if (confidence >= this.config.confidenceThreshold && pitch > 20) {
                const midi = Math.round(frequencyToMidi(pitch));
                pitchCounts[midi] = (pitchCounts[midi] || 0) + confidence;
                totalConfidence += confidence;
                confidenceCount++;
            }
        }

        // Find pitch with highest weighted count
        let bestMidi = null;
        let bestScore = 0;

        for (const [midi, score] of Object.entries(pitchCounts)) {
            if (score > bestScore) {
                bestScore = score;
                bestMidi = parseInt(midi);
            }
        }

        return {
            midi: bestMidi,
            confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0
        };
    }

    /**
     * Automatic segmentation based on pitch changes
     * @private
     */
    _segmentAutomatic(pitches, confidences, hopSize, sampleRate) {
        const notes = [];
        const frameDuration = hopSize / sampleRate;
        const confidenceThreshold = this.config.confidenceThreshold;
        const minNoteDuration = this.config.minNoteDuration;

        let currentNote = null;
        let currentStartFrame = 0;
        let frameConfidences = [];

        for (let i = 0; i < pitches.length; i++) {
            const pitch = pitches[i];
            const confidence = confidences[i];
            const isVoiced = confidence >= confidenceThreshold && pitch > 20;

            if (isVoiced) {
                const midi = frequencyToMidi(pitch);
                const roundedMidi = Math.round(midi);

                if (currentNote === null) {
                    // Start new note
                    currentNote = roundedMidi;
                    currentStartFrame = i;
                    frameConfidences = [confidence];
                } else if (Math.abs(roundedMidi - currentNote) >= 1) {
                    // Pitch changed significantly - end current note, start new
                    const duration = (i - currentStartFrame) * frameDuration;
                    if (duration >= minNoteDuration) {
                        notes.push(this._createNote(
                            currentNote,
                            currentStartFrame,
                            i,
                            frameDuration,
                            frameConfidences
                        ));
                    }
                    currentNote = roundedMidi;
                    currentStartFrame = i;
                    frameConfidences = [confidence];
                } else {
                    // Same note - accumulate confidence
                    frameConfidences.push(confidence);
                }
            } else {
                // Unvoiced - end current note if any
                if (currentNote !== null) {
                    const duration = (i - currentStartFrame) * frameDuration;
                    if (duration >= minNoteDuration) {
                        notes.push(this._createNote(
                            currentNote,
                            currentStartFrame,
                            i,
                            frameDuration,
                            frameConfidences
                        ));
                    }
                    currentNote = null;
                    frameConfidences = [];
                }
            }
        }

        // Handle last note
        if (currentNote !== null) {
            const duration = (pitches.length - currentStartFrame) * frameDuration;
            if (duration >= minNoteDuration) {
                notes.push(this._createNote(
                    currentNote,
                    currentStartFrame,
                    pitches.length,
                    frameDuration,
                    frameConfidences
                ));
            }
        }

        // Post-process: merge very short notes into neighbors
        return this._postProcess(notes);
    }

    /**
     * Create a note object
     * @private
     */
    _createNote(midi, startFrame, endFrame, frameDuration, confidences) {
        const startTime = startFrame * frameDuration;
        const endTime = endFrame * frameDuration;

        return {
            id: `note-${startTime.toFixed(4)}`,
            midi: midi,
            noteName: midiToNoteName(midi),
            startTime: startTime,
            endTime: endTime,
            duration: endTime - startTime,
            confidence: this._averageConfidence(confidences),
            userCorrected: false
        };
    }

    /**
     * Calculate average confidence
     * @private
     */
    _averageConfidence(confidences) {
        if (confidences.length === 0) return 0;
        const sum = confidences.reduce((a, b) => a + b, 0);
        return sum / confidences.length;
    }

    /**
     * Post-process notes to clean up detection artifacts
     * @private
     */
    _postProcess(notes) {
        if (notes.length < 2) return notes;

        const processed = [];
        const minGap = 0.02; // 20ms minimum gap between notes

        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];

            // Skip very short low-confidence notes
            if (note.duration < 0.03 && note.confidence < 0.6) {
                continue;
            }

            // Check if can merge with previous note
            if (processed.length > 0) {
                const prev = processed[processed.length - 1];
                const gap = note.startTime - prev.endTime;

                // Merge if same pitch and small gap
                if (note.midi === prev.midi && gap < minGap) {
                    prev.endTime = note.endTime;
                    prev.duration = prev.endTime - prev.startTime;
                    prev.confidence = (prev.confidence + note.confidence) / 2;
                    continue;
                }

                // Extend previous note to fill small gap
                if (gap < minGap && gap > 0) {
                    prev.endTime = note.startTime;
                    prev.duration = prev.endTime - prev.startTime;
                }
            }

            processed.push({ ...note });
        }

        // Reassign IDs
        return processed.map((note, index) => ({
            ...note,
            id: `note-${index}`
        }));
    }

    /**
     * Split a note at a given time
     * @param {Object} note - Note to split
     * @param {number} splitTime - Time to split at
     * @returns {Array} Two new notes
     */
    splitNote(note, splitTime) {
        if (splitTime <= note.startTime || splitTime >= note.endTime) {
            return [note];
        }

        const note1 = {
            ...note,
            id: note.id + '-a',
            endTime: splitTime,
            duration: splitTime - note.startTime,
            userCorrected: true
        };

        const note2 = {
            ...note,
            id: note.id + '-b',
            startTime: splitTime,
            duration: note.endTime - splitTime,
            userCorrected: true
        };

        return [note1, note2];
    }

    /**
     * Merge two adjacent notes
     * @param {Object} note1 - First note
     * @param {Object} note2 - Second note (must come after note1)
     * @returns {Object} Merged note
     */
    mergeNotes(note1, note2) {
        // Use the pitch of the longer note
        const midi = note1.duration >= note2.duration ? note1.midi : note2.midi;

        return {
            id: note1.id,
            midi: midi,
            noteName: midiToNoteName(midi),
            startTime: note1.startTime,
            endTime: note2.endTime,
            duration: note2.endTime - note1.startTime,
            confidence: (note1.confidence + note2.confidence) / 2,
            userCorrected: true
        };
    }
}
