/**
 * PitchDetector - Monophonic pitch tracking with an optimized YIN implementation.
 *
 * Produces per-frame pitch (Hz), confidence (0-1) and RMS energy arrays.
 * The energy track is used downstream for onset detection (splitting
 * repeated notes that YIN alone cannot separate).
 */

export class PitchDetector {
    constructor(config) {
        this.config = config;
        this.initialized = false;

        // Detectable pitch range. C3 (130 Hz) to C7 (2093 Hz) covers voice,
        // whistling and recorder; 80 Hz floor allows low male voice.
        this.minFreq = 80;
        this.maxFreq = 2100;
        this.yinThreshold = 0.12;
        this.rmsGate = 0.004; // frames below this RMS are treated as silence
    }

    /**
     * Initialize the pitch detector (kept async for API compatibility)
     */
    async init() {
        this.initialized = true;
    }

    /**
     * Detect pitches in audio data
     * @param {Float32Array} audioData - Mono audio samples
     * @param {number} sampleRate - Sample rate in Hz
     * @param {Function} onProgress - Progress callback (0-1)
     * @returns {Promise<Object>} { pitches, confidences, energies } per-frame arrays
     */
    async detectPitches(audioData, sampleRate, onProgress) {
        if (!this.initialized) await this.init();

        const frameSize = this.config.frameSize;
        const hopSize = this.config.hopSize;
        const numFrames = Math.max(0, Math.floor((audioData.length - frameSize) / hopSize));

        const pitches = new Float32Array(numFrames);
        const confidences = new Float32Array(numFrames);
        const energies = new Float32Array(numFrames);

        // YIN parameters derived once
        const minPeriod = Math.max(2, Math.floor(sampleRate / this.maxFreq));
        const maxPeriod = Math.min(Math.floor(sampleRate / this.minFreq), Math.floor(frameSize / 2) - 2);
        const windowLength = Math.floor(frameSize / 2);
        const yinBuffer = new Float32Array(maxPeriod + 2);

        const chunkSize = 200; // frames between event-loop yields

        for (let i = 0; i < numFrames; i++) {
            const start = i * hopSize;
            const result = this._yinFrame(
                audioData, start, windowLength, minPeriod, maxPeriod, sampleRate, yinBuffer
            );
            pitches[i] = result.pitch;
            confidences[i] = result.confidence;
            energies[i] = result.rms;

            if (i % chunkSize === 0) {
                if (onProgress) onProgress(i / numFrames);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        if (onProgress) onProgress(1.0);

        return {
            pitches: Array.from(pitches),
            confidences: Array.from(confidences),
            energies: Array.from(energies)
        };
    }

    /**
     * YIN pitch estimate for one frame.
     * Only computes the difference function up to maxPeriod (not frameSize/2),
     * which is ~8x less work than the naive implementation.
     * @private
     */
    _yinFrame(audio, offset, windowLength, minPeriod, maxPeriod, sampleRate, yinBuffer) {
        // RMS energy over the analysis window
        let rms = 0;
        for (let i = 0; i < windowLength; i++) {
            const s = audio[offset + i];
            rms += s * s;
        }
        rms = Math.sqrt(rms / windowLength);

        if (rms < this.rmsGate) {
            return { pitch: 0, confidence: 0, rms };
        }

        // Step 1+2: difference function with cumulative mean normalization,
        // computed incrementally so we can early-exit at the first dip.
        yinBuffer[0] = 1.0;
        let runningSum = 0;

        for (let tau = 1; tau <= maxPeriod; tau++) {
            let sum = 0;
            const a = offset;
            const b = offset + tau;
            for (let i = 0; i < windowLength; i++) {
                const delta = audio[a + i] - audio[b + i];
                sum += delta * delta;
            }
            runningSum += sum;
            yinBuffer[tau] = runningSum > 0 ? (sum * tau) / runningSum : 1.0;
        }

        // Step 3: absolute threshold - first dip below threshold
        let tauEstimate = -1;
        for (let tau = minPeriod; tau <= maxPeriod; tau++) {
            if (yinBuffer[tau] < this.yinThreshold) {
                while (tau + 1 <= maxPeriod && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        // Fallback: global minimum if reasonably strong
        if (tauEstimate === -1) {
            let minValue = 1.0;
            let minTau = -1;
            for (let tau = minPeriod; tau <= maxPeriod; tau++) {
                if (yinBuffer[tau] < minValue) {
                    minValue = yinBuffer[tau];
                    minTau = tau;
                }
            }
            if (minValue < 0.5) {
                tauEstimate = minTau;
            }
        }

        if (tauEstimate <= 0) {
            return { pitch: 0, confidence: 0, rms };
        }

        // Octave-error guard: if half the period (double frequency) is nearly
        // as good a match, the true fundamental is likely the higher octave
        // (common with strong even harmonics).
        const halfTau = Math.round(tauEstimate / 2);
        if (halfTau >= minPeriod && yinBuffer[halfTau] < this.yinThreshold * 1.3) {
            tauEstimate = halfTau;
        }

        const betterTau = this._parabolicInterpolation(yinBuffer, tauEstimate, maxPeriod);
        const pitch = sampleRate / betterTau;
        const confidence = Math.max(0, Math.min(1, 1.0 - yinBuffer[tauEstimate]));

        return { pitch, confidence, rms };
    }

    /**
     * Parabolic interpolation for sub-sample period accuracy
     * @private
     */
    _parabolicInterpolation(array, x, maxIndex) {
        if (x < 1 || x >= maxIndex) return x;

        const s0 = array[x - 1];
        const s1 = array[x];
        const s2 = array[x + 1];
        const denom = s0 - 2 * s1 + s2;
        if (denom === 0) return x;

        return x + 0.5 * (s0 - s2) / denom;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.initialized = false;
    }
}
