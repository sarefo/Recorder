/**
 * Synth - Simple Web Audio API synthesizer for playing MIDI notes
 */

import { midiToFrequency } from '../core/utils.js';

export class Synth {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.activeOscillators = new Map();
        this.isPlaying = false;
        this.playbackTimer = null;
    }

    /**
     * Initialize the audio context
     */
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.audioContext.destination);
        }

        // Resume if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * Play a single MIDI note
     * @param {number} midi - MIDI note number
     * @param {number} duration - Duration in seconds
     * @param {number} startTime - Start time relative to audio context (optional)
     * @returns {Object} The oscillator/gain nodes for this note
     */
    playNote(midi, duration = 0.5, startTime = null) {
        this.init();

        const frequency = midiToFrequency(midi);
        const now = startTime !== null ? startTime : this.audioContext.currentTime;

        // Create oscillator
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sine'; // Clean tone for whistling/recorder
        oscillator.frequency.value = frequency;

        // Create envelope
        const envelope = this.audioContext.createGain();
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(0.8, now + 0.02); // Attack
        envelope.gain.setValueAtTime(0.8, now + duration - 0.05); // Sustain
        envelope.gain.linearRampToValueAtTime(0, now + duration); // Release

        // Connect
        oscillator.connect(envelope);
        envelope.connect(this.masterGain);

        // Schedule start and stop
        oscillator.start(now);
        oscillator.stop(now + duration + 0.01);

        // Track the oscillator
        const noteId = `${midi}-${now}`;
        this.activeOscillators.set(noteId, { oscillator, envelope });

        oscillator.onended = () => {
            this.activeOscillators.delete(noteId);
        };

        return { oscillator, envelope, noteId };
    }

    /**
     * Play a sequence of notes
     * @param {Array} notes - Array of note objects with midi, startTime, endTime
     * @param {number} startOffset - Offset to subtract from note times (for partial playback)
     * @param {Function} onNoteStart - Callback when each note starts
     * @param {Function} onComplete - Callback when playback completes
     */
    playNotes(notes, startOffset = 0, onNoteStart = null, onComplete = null) {
        if (notes.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        this.init();
        this.stop(); // Stop any existing playback
        this.isPlaying = true;

        const now = this.audioContext.currentTime;
        const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

        // Calculate total duration
        const lastNote = sortedNotes[sortedNotes.length - 1];
        const totalDuration = lastNote.endTime - startOffset;

        // Schedule all notes
        for (const note of sortedNotes) {
            const noteStart = note.startTime - startOffset;
            const noteDuration = note.endTime - note.startTime;

            if (noteStart >= 0) {
                const scheduledTime = now + noteStart;
                this.playNote(note.midi, noteDuration, scheduledTime);

                // Schedule callback for note highlighting
                if (onNoteStart) {
                    setTimeout(() => {
                        if (this.isPlaying) {
                            onNoteStart(note);
                        }
                    }, noteStart * 1000);
                }
            }
        }

        // Schedule completion callback
        if (onComplete) {
            this.playbackTimer = setTimeout(() => {
                this.isPlaying = false;
                onComplete();
            }, totalDuration * 1000 + 100);
        }
    }

    /**
     * Play a single note immediately (for previewing)
     * @param {number} midi - MIDI note number
     * @param {number} duration - Duration in seconds (default 0.3s for preview)
     */
    previewNote(midi, duration = 0.3) {
        this.init();
        this.playNote(midi, duration);
    }

    /**
     * Stop all playback
     */
    stop() {
        this.isPlaying = false;

        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }

        // Stop all active oscillators
        for (const { oscillator, envelope } of this.activeOscillators.values()) {
            try {
                const now = this.audioContext.currentTime;
                envelope.gain.cancelScheduledValues(now);
                envelope.gain.setValueAtTime(envelope.gain.value, now);
                envelope.gain.linearRampToValueAtTime(0, now + 0.02);
                oscillator.stop(now + 0.03);
            } catch (e) {
                // Oscillator may have already stopped
            }
        }
        this.activeOscillators.clear();
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
