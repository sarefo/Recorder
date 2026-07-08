/**
 * NoteSegmenter - Converts pitch frames into discrete note events.
 *
 * Pipeline:
 *   1. Median-filter the pitch track (kills single-frame glitches)
 *   2. Correct octave jumps against the local pitch context
 *   3. Detect energy onsets (splits repeated notes at re-articulations)
 *   4. Segment with hysteresis (vibrato/portamento don't cause splits,
 *      short unvoiced dropouts don't end a note)
 *   5. Post-process: merge fragments, drop noise
 */

import { frequencyToMidi, midiToNoteName } from '../core/utils.js';

export class NoteSegmenter {
    constructor(config) {
        this.config = config;

        // Segmentation tuning
        this.pitchSplitSemitones = 0.65;  // sustained deviation that starts a new note
        this.pitchSplitFrames = 3;        // frames the deviation must persist
        this.maxDropoutSec = 0.045;       // unvoiced gap tolerated inside a note
        this.onsetMinGapSec = 0.08;       // min spacing between energy onsets
        this.onsetRiseRatio = 1.8;        // energy rise ratio that marks an onset
    }

    /**
     * Segment pitch data into note events
     * @param {Array} pitches - Array of pitch values (Hz)
     * @param {Array} confidences - Array of confidence values (0-1)
     * @param {number} hopSize - Hop size in samples
     * @param {number} sampleRate - Sample rate in Hz
     * @param {Array} tapTimestamps - Optional user-marked note onset times
     * @param {Array} energies - Optional per-frame RMS energies (enables onset splitting)
     * @returns {Array} Array of note objects
     */
    segmentNotes(pitches, confidences, hopSize, sampleRate, tapTimestamps = [], energies = null) {
        const frameDuration = hopSize / sampleRate;

        // Smoothed, octave-corrected MIDI track (null = unvoiced)
        const midiTrack = this._buildMidiTrack(pitches, confidences);

        if (tapTimestamps && tapTimestamps.length > 0) {
            return this._segmentWithTaps(midiTrack, confidences, frameDuration, tapTimestamps);
        }

        const onsetFrames = energies
            ? this._detectOnsets(energies, frameDuration)
            : new Set();

        return this._segmentAutomatic(midiTrack, confidences, frameDuration, onsetFrames);
    }

    // -----------------------------------------------------------------------
    // Pitch track conditioning
    // -----------------------------------------------------------------------

    /**
     * Convert Hz to MIDI floats, median-filter, and fix octave errors.
     * Returns array of MIDI floats or null for unvoiced frames.
     * @private
     */
    _buildMidiTrack(pitches, confidences) {
        const threshold = this.config.confidenceThreshold;
        const n = pitches.length;
        const raw = new Array(n);

        for (let i = 0; i < n; i++) {
            raw[i] = (confidences[i] >= threshold && pitches[i] > 20)
                ? frequencyToMidi(pitches[i])
                : null;
        }

        // Median filter (window 5) over voiced frames; unvoiced stay unvoiced
        const filtered = new Array(n);
        for (let i = 0; i < n; i++) {
            if (raw[i] === null) { filtered[i] = null; continue; }
            const window = [];
            for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) {
                if (raw[j] !== null) window.push(raw[j]);
            }
            filtered[i] = this._median(window);
        }

        // Octave correction: a frame that sits ~12 semitones from the local
        // median (of surrounding ±10 voiced frames) is shifted back.
        for (let i = 0; i < n; i++) {
            if (filtered[i] === null) continue;
            const context = [];
            for (let j = Math.max(0, i - 10); j <= Math.min(n - 1, i + 10); j++) {
                if (j !== i && filtered[j] !== null) context.push(filtered[j]);
            }
            if (context.length < 4) continue;
            const local = this._median(context);
            const diff = filtered[i] - local;
            if (Math.abs(Math.abs(diff) - 12) < 1.5) {
                filtered[i] -= Math.sign(diff) * 12;
            }
        }

        return filtered;
    }

    _median(arr) {
        if (arr.length === 0) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // -----------------------------------------------------------------------
    // Onset detection (energy-based)
    // -----------------------------------------------------------------------

    /**
     * Find frames where energy rises sharply after a dip - i.e. a new
     * articulation. This is what separates repeated notes of the same pitch.
     * @private
     */
    _detectOnsets(energies, frameDuration) {
        const n = energies.length;
        const onsets = new Set();
        if (n < 8) return onsets;

        // Smooth energy lightly (3-frame average) to reduce jitter
        const smooth = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const a = energies[Math.max(0, i - 1)];
            const b = energies[i];
            const c = energies[Math.min(n - 1, i + 1)];
            smooth[i] = (a + b + c) / 3;
        }

        const minGapFrames = Math.max(1, Math.round(this.onsetMinGapSec / frameDuration));
        const lookback = Math.max(2, Math.round(0.05 / frameDuration)); // dip window ~50ms
        let lastOnset = -minGapFrames;

        for (let i = 2; i < n; i++) {
            // Local minimum over the recent past
            let recentMin = Infinity;
            for (let j = Math.max(0, i - lookback); j < i; j++) {
                if (smooth[j] < recentMin) recentMin = smooth[j];
            }

            const rising = smooth[i] > smooth[i - 1];
            const bigRise = smooth[i] > recentMin * this.onsetRiseRatio && smooth[i] > 0.006;

            if (rising && bigRise && i - lastOnset >= minGapFrames) {
                // Walk back to the start of the rise for a tighter onset time
                let k = i;
                while (k > 0 && smooth[k - 1] < smooth[k] && smooth[k - 1] > recentMin * 1.05) k--;
                onsets.add(k);
                lastOnset = i;
            }
        }

        return onsets;
    }

    // -----------------------------------------------------------------------
    // Automatic segmentation
    // -----------------------------------------------------------------------

    /**
     * @private
     */
    _segmentAutomatic(midiTrack, confidences, frameDuration, onsetFrames) {
        const notes = [];
        const n = midiTrack.length;
        const maxDropoutFrames = Math.max(1, Math.round(this.maxDropoutSec / frameDuration));

        // Onsets as a sorted list; an onset may land on an unvoiced frame
        // (in the articulation gap), so it is consumed by the next voiced frame.
        const onsetList = [...onsetFrames].sort((a, b) => a - b);
        let onsetPtr = 0;

        let noteFrames = [];   // midi floats of current note
        let noteConfs = [];
        let startFrame = -1;
        let dropoutRun = 0;
        let deviationRun = 0;

        const flush = (endFrame) => {
            if (startFrame < 0 || noteFrames.length === 0) return;
            const midi = Math.round(this._median(noteFrames));
            const startTime = startFrame * frameDuration;
            const endTime = endFrame * frameDuration;
            notes.push({
                midi,
                noteName: midiToNoteName(midi),
                startTime,
                endTime,
                duration: endTime - startTime,
                confidence: noteConfs.length
                    ? noteConfs.reduce((a, b) => a + b, 0) / noteConfs.length
                    : 0,
                userCorrected: false
            });
            noteFrames = [];
            noteConfs = [];
            startFrame = -1;
            deviationRun = 0;
        };

        for (let i = 0; i < n; i++) {
            const midi = midiTrack[i];
            const voiced = midi !== null;

            if (!voiced) {
                if (startFrame >= 0) {
                    dropoutRun++;
                    if (dropoutRun > maxDropoutFrames) {
                        flush(i - dropoutRun + 1);
                        dropoutRun = 0;
                    }
                }
                continue;
            }

            // Consume any onsets up to this frame; a re-articulation inside a
            // running note splits it (this is what separates repeated notes)
            let onsetHere = false;
            while (onsetPtr < onsetList.length && onsetList[onsetPtr] <= i) {
                onsetHere = true;
                onsetPtr++;
            }
            if (onsetHere && startFrame >= 0 && i - startFrame >= 2 && noteFrames.length >= 2) {
                flush(i);
            }

            if (startFrame < 0) {
                startFrame = i;
                noteFrames = [midi];
                noteConfs = [confidences[i]];
                dropoutRun = 0;
                deviationRun = 0;
                continue;
            }

            dropoutRun = 0;
            const currentPitch = this._median(noteFrames);

            if (Math.abs(midi - currentPitch) >= this.pitchSplitSemitones) {
                deviationRun++;
                if (deviationRun >= this.pitchSplitFrames) {
                    // Split at the point the deviation began
                    const splitFrame = i - deviationRun + 1;
                    flush(splitFrame);
                    startFrame = splitFrame;
                    noteFrames = [];
                    noteConfs = [];
                    for (let j = splitFrame; j <= i; j++) {
                        if (midiTrack[j] !== null) {
                            noteFrames.push(midiTrack[j]);
                            noteConfs.push(confidences[j]);
                        }
                    }
                }
            } else {
                deviationRun = 0;
                noteFrames.push(midi);
                noteConfs.push(confidences[i]);
            }
        }

        flush(n - dropoutRun);

        return this._postProcess(notes);
    }

    // -----------------------------------------------------------------------
    // Tap-based segmentation
    // -----------------------------------------------------------------------

    /**
     * Segment using user-provided tap timestamps
     * @private
     */
    _segmentWithTaps(midiTrack, confidences, frameDuration, tapTimestamps) {
        const notes = [];
        const audioDuration = midiTrack.length * frameDuration;

        const sortedTaps = [...tapTimestamps].sort((a, b) => a - b);
        sortedTaps.push(audioDuration);

        for (let i = 0; i < sortedTaps.length - 1; i++) {
            const startTime = sortedTaps[i];
            const endTime = sortedTaps[i + 1];

            if (endTime - startTime < this.config.minNoteDuration) continue;

            const startFrame = Math.floor(startTime / frameDuration);
            const endFrame = Math.min(Math.floor(endTime / frameDuration), midiTrack.length);

            const window = [];
            const confs = [];
            for (let f = startFrame; f < endFrame; f++) {
                if (midiTrack[f] !== null) {
                    window.push(midiTrack[f]);
                    confs.push(confidences[f]);
                }
            }
            if (window.length === 0) continue;

            const midi = Math.round(this._median(window));
            notes.push({
                midi,
                noteName: midiToNoteName(midi),
                startTime,
                endTime,
                duration: endTime - startTime,
                confidence: confs.reduce((a, b) => a + b, 0) / confs.length,
                userCorrected: false
            });
        }

        return this._postProcess(notes);
    }

    // -----------------------------------------------------------------------
    // Post-processing
    // -----------------------------------------------------------------------

    /**
     * Merge fragments, drop noise, assign stable IDs.
     * @private
     */
    _postProcess(notes) {
        const minNoteDuration = this.config.minNoteDuration;
        const processed = [];
        const mergeGap = 0.03;

        for (const note of notes) {
            const prev = processed[processed.length - 1];

            if (prev && note.midi === prev.midi && note.startTime - prev.endTime < mergeGap
                && note.duration < minNoteDuration) {
                // Same-pitch fragment right after a note: it's the tail, merge it
                prev.endTime = note.endTime;
                prev.duration = prev.endTime - prev.startTime;
                continue;
            }

            // Drop noise: too short AND weak
            if (note.duration < minNoteDuration) continue;

            processed.push({ ...note });
        }

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
