/**
 * Test harness for the MelodyExtractor pipeline.
 *
 * Synthesizes melodies with known ground truth (recorder-like, voice-like,
 * octave-trap timbres), runs them through PitchDetector + NoteSegmenter,
 * and scores the detected notes. Results land in window.__testResults for
 * programmatic access and are rendered to the page.
 */

import { PitchDetector } from '../js/audio/pitch-detector.js';
import { NoteSegmenter } from '../js/analysis/note-segmenter.js';
import { AbcGenerator } from '../js/export/abc-generator.js';
import { midiToFrequency, midiToNoteName } from '../js/core/utils.js';

const SAMPLE_RATE = 44100;

const CONFIG = {
    sampleRate: SAMPLE_RATE,
    frameSize: 2048,
    hopSize: 256,
    confidenceThreshold: 0.7,
    minNoteDuration: 0.05
};

// ---------------------------------------------------------------------------
// Melody definitions: notes are { midi, beats } at the given bpm.
// gap: silence between notes in seconds (0 = legato with re-articulation dip)
// ---------------------------------------------------------------------------

const TESTS = [
    {
        name: 'scale-clean',
        desc: 'C major scale, quarter notes, clean recorder tone, detached',
        bpm: 100,
        timbre: 'recorder',
        gap: 0.06,
        notes: [72, 74, 76, 77, 79, 81, 83, 84].map(m => ({ midi: m, beats: 1 }))
    },
    {
        name: 'repeated-notes',
        desc: 'Twinkle opening: C C G G A A G — repeated notes, small articulation dips',
        bpm: 100,
        timbre: 'recorder',
        gap: 0.03,
        notes: [
            { midi: 72, beats: 1 }, { midi: 72, beats: 1 },
            { midi: 79, beats: 1 }, { midi: 79, beats: 1 },
            { midi: 81, beats: 1 }, { midi: 81, beats: 1 },
            { midi: 79, beats: 2 }
        ]
    },
    {
        name: 'rhythm-mix',
        desc: 'Mixed rhythms: eighths, quarters, dotted quarter, half',
        bpm: 90,
        timbre: 'recorder',
        gap: 0.04,
        notes: [
            { midi: 76, beats: 0.5 }, { midi: 77, beats: 0.5 },
            { midi: 79, beats: 1 }, { midi: 76, beats: 1.5 },
            { midi: 74, beats: 0.5 }, { midi: 72, beats: 2 }
        ]
    },
    {
        name: 'vibrato-voice',
        desc: 'Sung long notes with vibrato (5.5 Hz, ±40 cents) and portamento onsets',
        bpm: 60,
        timbre: 'voice',
        gap: 0.05,
        vibrato: { rate: 5.5, cents: 40 },
        portamento: 0.06,
        notes: [
            { midi: 67, beats: 2 }, { midi: 71, beats: 2 },
            { midi: 74, beats: 2 }, { midi: 72, beats: 2 }
        ]
    },
    {
        name: 'octave-trap',
        desc: 'Low notes with strong 2nd harmonic (octave-error bait)',
        bpm: 90,
        timbre: 'octavebait',
        gap: 0.05,
        notes: [
            { midi: 60, beats: 1 }, { midi: 62, beats: 1 },
            { midi: 64, beats: 1 }, { midi: 60, beats: 1 }
        ]
    },
    {
        name: 'fast-passage',
        desc: 'Fast eighth notes at 140 bpm, nearly legato',
        bpm: 140,
        timbre: 'recorder',
        gap: 0.015,
        notes: [72, 74, 76, 74, 72, 76, 79, 77, 76, 74, 72, 72]
            .map(m => ({ midi: m, beats: 0.5 }))
    }
];

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

/**
 * Render a melody to a mono Float32Array with a naturalistic tone.
 * Returns { audio, groundTruth: [{midi, startTime, endTime}] }
 */
function synthesizeMelody(test) {
    const beatDur = 60 / test.bpm;
    const gap = test.gap ?? 0.05;

    // Total duration
    let total = 0.25; // lead-in silence
    for (const n of test.notes) total += n.beats * beatDur;
    total += 0.5; // tail

    const numSamples = Math.ceil(total * SAMPLE_RATE);
    const audio = new Float32Array(numSamples);
    const groundTruth = [];

    // Timbre recipes: harmonic amplitudes [fundamental, 2nd, 3rd, ...]
    const timbres = {
        recorder: [1.0, 0.12, 0.28, 0.06, 0.04],
        voice: [1.0, 0.45, 0.3, 0.18, 0.1, 0.06],
        octavebait: [0.55, 1.0, 0.35, 0.5, 0.2]  // 2nd harmonic dominant
    };
    const harmonics = timbres[test.timbre] || timbres.recorder;

    let t = 0.25;
    let prevFreq = null;

    for (const note of test.notes) {
        const noteDur = note.beats * beatDur - gap;
        const startSample = Math.floor(t * SAMPLE_RATE);
        const durSamples = Math.floor(noteDur * SAMPLE_RATE);
        const baseFreq = midiToFrequency(note.midi);

        const attack = 0.015;
        const release = 0.03;
        const portamento = test.portamento || 0;
        const vib = test.vibrato || null;

        let phase = 0;
        for (let i = 0; i < durSamples; i++) {
            const time = i / SAMPLE_RATE;

            // Frequency: portamento glide from previous note, plus vibrato
            let freq = baseFreq;
            if (portamento > 0 && prevFreq && time < portamento) {
                const p = time / portamento;
                freq = prevFreq * Math.pow(baseFreq / prevFreq, p);
            }
            if (vib && time > 0.15) {
                const centsDev = vib.cents * Math.sin(2 * Math.PI * vib.rate * time);
                freq *= Math.pow(2, centsDev / 1200);
            }

            phase += 2 * Math.PI * freq / SAMPLE_RATE;

            // Envelope
            let env = 1.0;
            if (time < attack) env = time / attack;
            const remaining = noteDur - time;
            if (remaining < release) env = Math.max(0, remaining / release);

            // Slight breath noise + amplitude wobble for realism
            let sample = 0;
            for (let h = 0; h < harmonics.length; h++) {
                sample += harmonics[h] * Math.sin(phase * (h + 1));
            }
            sample *= 0.25 * env * (1 + 0.03 * Math.sin(2 * Math.PI * 3.1 * time));
            sample += (Math.random() - 0.5) * 0.004; // noise floor

            const idx = startSample + i;
            if (idx < numSamples) audio[idx] += sample;
        }

        groundTruth.push({
            midi: note.midi,
            noteName: midiToNoteName(note.midi),
            startTime: t,
            endTime: t + noteDur
        });

        prevFreq = baseFreq;
        t += note.beats * beatDur;
    }

    return { audio, groundTruth };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Match detected notes to ground truth.
 * A detected note matches a truth note if onset within tolerance and same midi.
 * Returns metrics including octave-error count.
 */
function scoreNotes(detected, truth, onsetTolerance = 0.12) {
    const usedDetected = new Set();
    let matched = 0;
    let octaveErrors = 0;
    const errors = [];

    for (const gt of truth) {
        let found = null;
        let foundOctave = null;
        for (let i = 0; i < detected.length; i++) {
            if (usedDetected.has(i)) continue;
            const d = detected[i];
            if (Math.abs(d.startTime - gt.startTime) <= onsetTolerance) {
                if (d.midi === gt.midi) { found = i; break; }
                if (Math.abs(d.midi - gt.midi) % 12 === 0 && foundOctave === null) foundOctave = i;
            }
        }
        if (found !== null) {
            usedDetected.add(found);
            matched++;
        } else if (foundOctave !== null) {
            usedDetected.add(foundOctave);
            octaveErrors++;
            errors.push(`${gt.noteName}@${gt.startTime.toFixed(2)}s detected as ${detected[foundOctave].noteName} (octave error)`);
        } else {
            errors.push(`${gt.noteName}@${gt.startTime.toFixed(2)}s MISSED`);
        }
    }

    const spurious = detected.length - usedDetected.size;
    const precision = detected.length > 0 ? matched / detected.length : 0;
    const recall = truth.length > 0 ? matched / truth.length : 0;
    const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;

    return {
        truthCount: truth.length,
        detectedCount: detected.length,
        matched,
        octaveErrors,
        spurious,
        precision: +(precision * 100).toFixed(1),
        recall: +(recall * 100).toFixed(1),
        f1: +(f1 * 100).toFixed(1),
        errors
    };
}

/**
 * Compare quantized note events against the melody definition.
 * Truth: onset = cumulative beats * 4 units, duration = beats * 4 units
 * (articulation gaps should be absorbed into the written duration).
 */
function scoreRhythm(events, test) {
    const noteEvents = events.filter(e => e.type === 'note');
    const truth = [];
    let pos = 0;
    for (const n of test.notes) {
        truth.push({ onset: Math.round(pos * 4), units: Math.round(n.beats * 4) });
        pos += n.beats;
    }

    let correct = 0;
    const errors = [];
    const count = Math.min(noteEvents.length, truth.length);
    for (let i = 0; i < count; i++) {
        if (noteEvents[i].startUnits === truth[i].onset && noteEvents[i].units === truth[i].units) {
            correct++;
        } else {
            errors.push(`#${i}: got onset ${noteEvents[i].startUnits}u dur ${noteEvents[i].units}u, ` +
                `want onset ${truth[i].onset}u dur ${truth[i].units}u`);
        }
    }
    if (noteEvents.length !== truth.length) {
        errors.push(`event count ${noteEvents.length} vs truth ${truth.length}`);
    }

    return {
        accuracy: truth.length ? +((correct / truth.length) * 100).toFixed(1) : 0,
        errors
    };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runAll() {
    const statusEl = document.getElementById('status');
    const resultsEl = document.getElementById('results');
    const detector = new PitchDetector(CONFIG);
    await detector.init();
    const segmenter = new NoteSegmenter(CONFIG);
    const abcGen = new AbcGenerator();

    const allResults = [];

    for (const test of TESTS) {
        statusEl.textContent = `Running: ${test.name}...`;
        const { audio, groundTruth } = synthesizeMelody(test);

        const t0 = performance.now();
        const pitchData = await detector.detectPitches(audio, SAMPLE_RATE, () => {});
        const detectTime = performance.now() - t0;

        const notes = segmenter.segmentNotes(
            pitchData.pitches, pitchData.confidences,
            CONFIG.hopSize, SAMPLE_RATE, [],
            pitchData.energies
        );

        const score = scoreNotes(notes, groundTruth);
        const abc = abcGen.generate(notes, { tempo: test.bpm, title: test.name });

        // Rhythm scoring: quantized (onset, duration) in 16th-units vs truth
        const rhythm = scoreRhythm(abcGen.quantizeNotes(notes, test.bpm), test);
        const estimatedTempo = abcGen.estimateTempo(notes);

        const result = {
            name: test.name,
            desc: test.desc,
            audioSeconds: +(audio.length / SAMPLE_RATE).toFixed(2),
            detectMs: Math.round(detectTime),
            score,
            rhythm,
            estimatedTempo,
            trueTempo: test.bpm,
            detectedSequence: notes.map(n => n.noteName).join(' '),
            truthSequence: groundTruth.map(n => n.noteName).join(' '),
            abc
        };
        allResults.push(result);
        renderResult(resultsEl, result);
    }

    // Summary
    const avgF1 = allResults.reduce((s, r) => s + r.score.f1, 0) / allResults.length;
    const summary = {
        avgF1: +avgF1.toFixed(1),
        totalDetectMs: allResults.reduce((s, r) => s + r.detectMs, 0),
        tests: allResults
    };
    window.__testResults = summary;
    statusEl.innerHTML = `<b>DONE.</b> Average F1: <span class="${avgF1 > 90 ? 'pass' : 'fail'}">${avgF1.toFixed(1)}%</span>` +
        ` | Total detection time: ${summary.totalDetectMs}ms`;
    console.log('TEST_RESULTS_JSON:' + JSON.stringify(summary));
}

function renderResult(container, r) {
    const div = document.createElement('div');
    const cls = (r.score.f1 >= 90 && r.rhythm.accuracy >= 90) ? 'pass' : 'fail';
    div.innerHTML = `
        <h2 class="${cls}">${r.name} — F1 ${r.score.f1}% | rhythm ${r.rhythm.accuracy}% | tempo est ${r.estimatedTempo} (true ${r.trueTempo})</h2>
        <table>
            <tr><th>desc</th><td>${r.desc}</td></tr>
            <tr><th>audio</th><td>${r.audioSeconds}s, detected in ${r.detectMs}ms</td></tr>
            <tr><th>truth</th><td>${r.truthSequence} (${r.score.truthCount})</td></tr>
            <tr><th>detected</th><td>${r.detectedSequence} (${r.score.detectedCount})</td></tr>
            <tr><th>octave errs</th><td>${r.score.octaveErrors}</td></tr>
            <tr><th>spurious</th><td>${r.score.spurious}</td></tr>
            <tr><th>errors</th><td>${r.score.errors.join('<br>') || '—'}</td></tr>
        </table>
        <pre>${r.abc}</pre>
    `;
    container.appendChild(div);
}

runAll().catch(err => {
    document.getElementById('status').textContent = 'FAILED: ' + err.message;
    console.error(err);
    window.__testResults = { error: err.message };
});
