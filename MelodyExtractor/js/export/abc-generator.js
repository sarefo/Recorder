/**
 * AbcGenerator - Generates ABC notation from note events.
 *
 * Quantization works on an absolute beat grid anchored at the first note
 * onset: every onset is snapped to the grid independently, so timing drift
 * can never accumulate across the piece (the old per-duration approach
 * pushed every later note further off the barlines).
 */

import { midiToAbc } from '../core/utils.js';

export class AbcGenerator {
    constructor() {
        this.defaultTempo = 120;
        this.defaultMeter = '4/4';
        this.defaultKey = 'C';
        this.gridUnitsPerBeat = 4;   // 16th-note grid
    }

    /**
     * Generate ABC notation from notes
     * @param {Array} notes - Array of note objects
     * @param {Object} options - { title, tempo, meter, key, transpose }
     * @returns {string} ABC notation string
     */
    generate(notes, options = {}) {
        const title = options.title || 'Extracted Melody';
        const tempo = options.tempo || this.estimateTempo(notes);
        const meter = options.meter || this.defaultMeter;
        const key = options.key || this.defaultKey;
        const transpose = options.transpose || 0;

        let abc = '';
        abc += `X:1\n`;
        abc += `T:${title}\n`;
        abc += `M:${meter}\n`;
        abc += `L:1/8\n`;
        abc += `Q:1/4=${tempo}\n`;
        abc += `K:${key}\n`;

        if (notes.length === 0) {
            return abc + 'z8 |]\n';
        }

        const events = this.quantizeNotes(notes, tempo);
        abc += this._emitAbc(events, meter, transpose);

        return abc;
    }

    /**
     * Quantize notes onto a 16th-note beat grid anchored at the first onset.
     *
     * Returns events: [{ type: 'note'|'rest', midi?, startUnits, units }]
     * where units are grid units (16ths). Gaps caused by articulation
     * (short relative to the note spacing) are absorbed into the note;
     * longer gaps become explicit rests.
     *
     * @param {Array} notes - Note objects with startTime/endTime in seconds
     * @param {number} tempo - BPM
     * @returns {Array} Quantized event list starting at unit 0
     */
    quantizeNotes(notes, tempo) {
        const beatDur = 60 / tempo;
        const unitDur = beatDur / this.gridUnitsPerBeat;
        const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
        const t0 = sorted[0].startTime;

        // Snap all onsets first (independently - no drift)
        const snapped = sorted.map(n => ({
            midi: n.midi,
            onsetUnits: Math.round((n.startTime - t0) / unitDur),
            endUnits: Math.round((n.endTime - t0) / unitDur)
        }));

        const events = [];
        let cursor = 0;

        for (let i = 0; i < snapped.length; i++) {
            const n = snapped[i];
            let onset = Math.max(n.onsetUnits, cursor);
            let end = Math.max(n.endUnits, onset + 1);

            // Rest before this note?
            if (onset > cursor) {
                events.push({ type: 'rest', startUnits: cursor, units: onset - cursor });
            }

            // Absorb small articulation gaps: if the gap to the next onset is
            // at most 1 grid unit or <25% of the spacing, extend to fill it.
            if (i + 1 < snapped.length) {
                const nextOnset = Math.max(snapped[i + 1].onsetUnits, onset + 1);
                const gap = nextOnset - end;
                const spacing = nextOnset - onset;
                if (gap > 0 && (gap <= 1 || gap < spacing * 0.25)) {
                    end = nextOnset;
                }
                // Overlap (shouldn't happen after snapping, but guard): truncate
                if (end > nextOnset) end = nextOnset;
                if (end <= onset) end = onset + 1;
            }

            events.push({ type: 'note', midi: n.midi, startUnits: onset, units: end - onset });
            cursor = end;
        }

        return events;
    }

    /**
     * Emit ABC body from quantized events.
     * @private
     */
    _emitAbc(events, meter, transpose) {
        const [beatsNum, beatUnit] = meter.split('/').map(Number);
        // Grid units per measure: e.g. 4/4 -> 16, 3/4 -> 12, 6/8 -> 12
        const unitsPerMeasure = Math.round(beatsNum * (4 / beatUnit) * this.gridUnitsPerBeat);

        let abc = '';
        let posInMeasure = 0;
        let measureCount = 0;

        const emitPiece = (symbol, units, tieAfter) => {
            abc += symbol + this._durationSuffix(units) + (tieAfter ? '-' : '') + ' ';
        };

        const closeMeasure = () => {
            abc = abc.trimEnd() + ' | ';
            measureCount++;
            if (measureCount % 4 === 0) {
                abc = abc.trimEnd() + '\n';
            }
            posInMeasure = 0;
        };

        for (const ev of events) {
            const symbol = ev.type === 'note' ? midiToAbc(ev.midi + transpose) : 'z';
            let remaining = ev.units;

            while (remaining > 0) {
                const space = unitsPerMeasure - posInMeasure;
                const chunk = Math.min(remaining, space);
                const pieces = this._decompose(chunk);

                for (let p = 0; p < pieces.length; p++) {
                    const isLastPieceOfEvent =
                        (p === pieces.length - 1) && (remaining - chunk === 0);
                    // Ties join pieces of the same note; rests never tie
                    const tie = ev.type === 'note' && !isLastPieceOfEvent;
                    emitPiece(symbol, pieces[p], tie);
                }

                remaining -= chunk;
                posInMeasure += chunk;

                if (posInMeasure >= unitsPerMeasure) {
                    closeMeasure();
                }
            }
        }

        // Pad the final measure with a rest so the bar count is honest
        if (posInMeasure > 0) {
            const pad = unitsPerMeasure - posInMeasure;
            for (const piece of this._decompose(pad)) {
                emitPiece('z', piece, false);
            }
        }

        abc = abc.trimEnd();
        if (abc.endsWith('|')) {
            abc = abc.slice(0, -1).trimEnd() + ' |]';
        } else {
            abc += ' |]';
        }

        return abc + '\n';
    }

    /**
     * Decompose a duration in grid units into representable note values
     * (units of 16ths: 16=whole ... 1=sixteenth), largest first with ties.
     * @private
     */
    _decompose(units) {
        const standard = [16, 12, 8, 6, 4, 3, 2, 1];
        const pieces = [];
        let remaining = units;
        while (remaining > 0) {
            const val = standard.find(v => v <= remaining) || 1;
            pieces.push(val);
            remaining -= val;
        }
        return pieces;
    }

    /**
     * ABC duration suffix for a length in 16th-grid units, with L:1/8 base.
     * units=1 -> '/2' (16th), 2 -> '' (8th), 3 -> '3/2', 4 -> '2' (quarter)...
     * @private
     */
    _durationSuffix(units) {
        if (units === 1) return '/2';
        if (units === 2) return '';
        if (units % 2 === 0) return String(units / 2);
        return `${units}/2`;
    }

    /**
     * Estimate tempo from inter-onset intervals.
     *
     * Tries interpreting the median IOI as a quarter, eighth or half note,
     * and picks the interpretation whose grid best explains all onsets.
     */
    estimateTempo(notes) {
        if (!notes || notes.length < 3) return this.defaultTempo;

        const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
        const iois = [];
        for (let i = 1; i < sorted.length; i++) {
            const ioi = sorted[i].startTime - sorted[i - 1].startTime;
            if (ioi >= 0.1 && ioi <= 2.5) iois.push(ioi);
        }
        if (iois.length === 0) return this.defaultTempo;

        iois.sort((a, b) => a - b);
        const median = iois[Math.floor(iois.length / 2)];

        // Candidate beat durations if median IOI is an 8th, quarter, or half
        const candidates = [median * 2, median, median / 2]
            .map(beat => 60 / beat)
            .filter(bpm => bpm >= 45 && bpm <= 200);
        if (candidates.length === 0) return this.defaultTempo;

        const t0 = sorted[0].startTime;
        let best = candidates[0];
        let bestScore = Infinity;

        for (const bpm of candidates) {
            const unitDur = (60 / bpm) / this.gridUnitsPerBeat;
            let err = 0;
            for (const n of sorted) {
                const pos = (n.startTime - t0) / unitDur;
                err += Math.abs(pos - Math.round(pos));
            }
            // Mild preference for tempos near 100 to break scale-invariance ties
            const score = err / sorted.length + Math.abs(bpm - 100) / 400;
            if (score < bestScore) {
                bestScore = score;
                best = bpm;
            }
        }

        // Round to a common tempo value
        const common = [60, 66, 72, 80, 88, 92, 100, 108, 112, 120, 132, 144, 160, 176, 200];
        return common.reduce((prev, curr) =>
            Math.abs(curr - best) < Math.abs(prev - best) ? curr : prev
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
