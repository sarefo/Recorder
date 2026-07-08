/**
 * MlPitchDetector - Optional high-robustness transcription using Spotify's
 * Basic Pitch model (TensorFlow.js, loaded on demand from CDN, ~9 MB).
 *
 * Basic Pitch is polyphonic: on clean monophonic input it also reports
 * strong harmonics as extra notes, so the output is passed through a
 * monophonic reduction that keeps the dominant note among overlaps.
 *
 * Produces note objects directly (it has its own onset detection),
 * bypassing the YIN + NoteSegmenter pipeline.
 */

import { midiToNoteName } from '../core/utils.js';

const CDN_MODULE = 'https://esm.sh/@spotify/basic-pitch@1.0.1';
const MODEL_URL = 'https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json';
const BP_SAMPLE_RATE = 22050;

export class MlPitchDetector {
    constructor() {
        this.bp = null;      // module namespace
        this.model = null;   // BasicPitch instance
    }

    /**
     * Load the Basic Pitch module and model (cached after first call)
     */
    async init(onProgress) {
        if (this.model) return;
        if (onProgress) onProgress(0.02);
        this.bp = await import(CDN_MODULE);
        this.model = new this.bp.BasicPitch(MODEL_URL);
        if (onProgress) onProgress(0.1);
    }

    /**
     * Transcribe an AudioBuffer to note objects.
     * @param {AudioBuffer} audioBuffer - Audio at any sample rate
     * @param {Function} onProgress - Progress callback (0-1)
     * @returns {Promise<Array>} Note objects (app format)
     */
    async detectNotes(audioBuffer, onProgress) {
        await this.init(onProgress);

        // Basic Pitch requires 22050 Hz mono
        const resampled = await this._resample(audioBuffer);
        if (onProgress) onProgress(0.15);

        const frames = [], onsets = [], contours = [];
        await this.model.evaluateModel(
            resampled,
            (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); },
            (pct) => { if (onProgress) onProgress(0.15 + pct * 0.8); }
        );

        const rawNotes = this.bp.noteFramesToTime(
            this.bp.addPitchBendsToNoteEvents(
                contours,
                // onsetThreshold, frameThreshold, minNoteLengthFrames
                this.bp.outputToNotesPoly(frames, onsets, 0.5, 0.3, 5)
            )
        );

        if (onProgress) onProgress(1.0);

        return this._toMonophonicNotes(rawNotes);
    }

    /**
     * Resample to 22050 Hz mono via OfflineAudioContext
     * @private
     */
    async _resample(audioBuffer) {
        const targetLen = Math.ceil(audioBuffer.duration * BP_SAMPLE_RATE);
        const ctx = new OfflineAudioContext(1, targetLen, BP_SAMPLE_RATE);
        const node = ctx.createBufferSource();
        node.buffer = audioBuffer;
        node.connect(ctx.destination);
        node.start();
        return ctx.startRendering();
    }

    /**
     * Reduce polyphonic output to a single melody line:
     * among heavily-overlapping notes keep the loudest, preferring the
     * lower note when the upper is a harmonic interval (octave/12th/15th).
     * @private
     */
    _toMonophonicNotes(rawNotes) {
        const sorted = [...rawNotes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
        const kept = [];

        for (const note of sorted) {
            const start = note.startTimeSeconds;
            const end = start + note.durationSeconds;

            let absorbed = false;
            for (const other of kept) {
                const overlap = Math.min(end, other.end) - Math.max(start, other.start);
                if (overlap <= 0) continue;
                const overlapRatio = overlap / (end - start);
                if (overlapRatio < 0.5) continue;

                // Heavy overlap: decide which to keep
                const interval = note.pitchMidi - other.midi;
                const isHarmonicAbove = [12, 19, 24, 28].some(h => Math.abs(interval - h) <= 1);

                if (isHarmonicAbove || note.amplitude <= other.amplitude) {
                    absorbed = true; // drop this note
                } else {
                    // This note wins; replace the weaker one
                    other.midi = note.pitchMidi;
                    other.start = start;
                    other.end = end;
                    other.amplitude = note.amplitude;
                    absorbed = true;
                }
                break;
            }

            if (!absorbed) {
                kept.push({
                    midi: note.pitchMidi,
                    start,
                    end,
                    amplitude: note.amplitude ?? 0.8
                });
            }
        }

        kept.sort((a, b) => a.start - b.start);

        return kept.map((n, i) => ({
            id: `note-${i}`,
            midi: n.midi,
            noteName: midiToNoteName(n.midi),
            startTime: n.start,
            endTime: n.end,
            duration: n.end - n.start,
            confidence: Math.max(0, Math.min(1, n.amplitude)),
            userCorrected: false
        }));
    }
}
