/**
 * AbcParser - Parses ABC notation and converts it to note events
 */

import { frequencyToMidi } from '../core/utils.js';

export class AbcParser {
    constructor() {
        this.noteIdCounter = 0;
    }

    /**
     * Parse ABC notation and extract note events
     * @param {string} abcText - ABC notation string
     * @returns {Object} Parsed data including notes, tempo, meter, key
     */
    parse(abcText) {
        if (!abcText || !window.ABCJS) {
            throw new Error('ABCJS library not loaded or invalid ABC text');
        }

        try {
            // Use ABCJS to parse the ABC notation
            const parsed = window.ABCJS.parseOnly(abcText);

            if (!parsed || parsed.length === 0) {
                throw new Error('No valid tune found in ABC notation');
            }

            const tune = parsed[0];

            // Extract metadata
            const metadata = this._extractMetadata(tune);

            // Extract notes from the parsed tune
            const notes = this._extractNotes(tune, metadata);

            return {
                notes,
                metadata
            };
        } catch (error) {
            console.error('ABC parsing error:', error);
            throw new Error('Failed to parse ABC notation: ' + error.message);
        }
    }

    /**
     * Extract metadata (tempo, meter, key) from parsed tune
     * @private
     */
    _extractMetadata(tune) {
        const metadata = {
            title: tune.metaText?.title || 'Parsed Melody',
            tempo: 120,
            meter: '4/4',
            key: 'C'
        };

        // Extract tempo from metaText
        if (tune.metaText?.tempo) {
            const tempo = tune.metaText.tempo;
            if (tempo.bpm) {
                metadata.tempo = tempo.bpm;
            } else if (typeof tempo === 'number') {
                metadata.tempo = tempo;
            }
        }

        // Extract meter and key from the first line's staff
        if (tune.lines && tune.lines.length > 0) {
            const firstLine = tune.lines[0];
            if (firstLine.staff && firstLine.staff.length > 0) {
                const staff = firstLine.staff[0];

                // Extract meter
                if (staff.meter) {
                    if (typeof staff.meter === 'object' && staff.meter.value) {
                        metadata.meter = staff.meter.value;
                    } else if (typeof staff.meter === 'string') {
                        metadata.meter = staff.meter;
                    }
                }

                // Extract key
                if (staff.key) {
                    if (typeof staff.key === 'object') {
                        metadata.key = staff.key.root || 'C';
                        if (staff.key.acc) {
                            metadata.key += staff.key.acc;
                        }
                        if (staff.key.mode && staff.key.mode !== '' && staff.key.mode !== 'major') {
                            metadata.key += staff.key.mode;
                        }
                    } else if (typeof staff.key === 'string') {
                        metadata.key = staff.key;
                    }
                }
            }
        }

        return metadata;
    }

    /**
     * Extract note events from parsed tune
     * @private
     */
    _extractNotes(tune, metadata) {
        const notes = [];
        this.noteIdCounter = 0;

        // Calculate timing parameters
        const tempo = metadata.tempo || 120;
        const beatDuration = 60 / tempo; // Duration of one quarter note in seconds
        const wholeNoteDuration = beatDuration * 4; // ABCJS uses whole notes as base unit

        let currentTime = 0;

        // Iterate through all lines and voices
        if (!tune.lines) return notes;

        for (const line of tune.lines) {
            if (!line.staff) continue;

            for (const staff of line.staff) {
                if (!staff.voices) continue;

                for (const voice of staff.voices) {
                    currentTime = this._processVoice(voice, wholeNoteDuration, currentTime, notes);
                }
            }
        }

        return notes;
    }

    /**
     * Process a voice and extract notes
     * @private
     */
    _processVoice(voice, wholeNoteDuration, startTime, notes) {
        let currentTime = startTime;

        for (const element of voice) {
            if (element.el_type === 'note') {
                // Handle note
                // ABCJS duration is in whole notes (1.0 = whole, 0.25 = quarter, 0.125 = eighth, 0.0625 = 16th)
                const duration = (element.duration || 1) * wholeNoteDuration;

                // ABCJS represents notes as pitch objects
                if (element.pitches && element.pitches.length > 0) {
                    // For chords, take the first pitch (or we could add all)
                    for (const pitch of element.pitches) {
                        const midi = this._pitchToMidi(pitch);

                        if (midi !== null) {
                            notes.push({
                                id: `note-${this.noteIdCounter++}`,
                                midi,
                                noteName: this._midiToNoteName(midi),
                                startTime: currentTime,
                                endTime: currentTime + duration,
                                duration,
                                confidence: 1.0, // Parsed notes have full confidence
                                userCorrected: true // Mark as user-corrected
                            });
                        }
                    }
                }

                currentTime += duration;
            } else if (element.el_type === 'rest') {
                // Handle rest
                // ABCJS duration is in whole notes (1.0 = whole, 0.25 = quarter, 0.125 = eighth, 0.0625 = 16th)
                const duration = (element.duration || 1) * wholeNoteDuration;
                currentTime += duration;
            } else if (element.el_type === 'bar') {
                // Bar line - no timing change, but could track measures
                continue;
            }
        }

        return currentTime;
    }

    /**
     * Convert ABCJS pitch object to MIDI note number
     * @private
     */
    _pitchToMidi(pitch) {
        if (!pitch) return null;

        // ABCJS pitch format:
        // verticalPos: absolute position on staff (0 = middle C in many systems)
        // pitch: note letter (0=C, 1=D, 2=E, 3=F, 4=G, 5=A, 6=B)
        // accidental: '', 'sharp', 'flat', 'natural', 'dblsharp', 'dblflat'

        // Convert verticalPos to MIDI
        // In ABCJS, verticalPos is the diatonic staff position
        // We need to map this to chromatic MIDI notes

        // Map diatonic positions to semitones within an octave
        const diatonicToChromatic = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

        // Calculate octave and note within octave from verticalPos
        // In ABCJS: verticalPos 0 = C4 (middle C, MIDI 60)
        const octaveOffset = Math.floor(pitch.verticalPos / 7);
        const noteInOctave = ((pitch.verticalPos % 7) + 7) % 7; // Handle negative positions

        // Start from C4 (MIDI 60) as reference for verticalPos 0
        let midi = 60 + (octaveOffset * 12) + diatonicToChromatic[noteInOctave];

        // Apply accidentals
        if (pitch.accidental === 'sharp') midi += 1;
        else if (pitch.accidental === 'flat') midi -= 1;
        else if (pitch.accidental === 'dblsharp') midi += 2;
        else if (pitch.accidental === 'dblflat') midi -= 2;

        return midi;
    }

    /**
     * Convert MIDI to note name
     * @private
     */
    _midiToNoteName(midi) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const note = notes[midi % 12];
        return `${note}${octave}`;
    }

    /**
     * Validate ABC notation (basic check)
     * @param {string} abcText - ABC notation string
     * @returns {boolean} True if valid
     */
    isValid(abcText) {
        if (!abcText || typeof abcText !== 'string') return false;

        // Basic validation: must have header fields and some content
        const hasHeader = /X:\s*\d+/.test(abcText) || /T:/.test(abcText) || /K:/.test(abcText);
        const hasContent = abcText.length > 10;

        return hasHeader && hasContent;
    }
}
