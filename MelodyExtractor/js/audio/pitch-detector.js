/**
 * PitchDetector - Wraps pitch detection using Essentia.js or fallback
 *
 * Uses Essentia.js PitchYinProbabilistic for accurate pitch detection.
 * Falls back to a simpler autocorrelation method if Essentia.js fails to load.
 */

export class PitchDetector {
    constructor(config) {
        this.config = config;
        this.essentia = null;
        this.EssentiaWASM = null;
        this.initialized = false;
        this.useEssentia = true;
    }

    /**
     * Initialize the pitch detector
     */
    async init() {
        if (this.initialized) return;

        try {
            // Try to load Essentia.js
            console.log('Loading Essentia.js...');

            // Try unpkg CDN first, then jsDelivr as fallback
            let essentiaWasm, essentiaCore;
            try {
                [essentiaWasm, essentiaCore] = await Promise.all([
                    import('https://unpkg.com/essentia.js@0.1.3/dist/essentia-wasm.es.js'),
                    import('https://unpkg.com/essentia.js@0.1.3/dist/essentia.js-core.es.js')
                ]);
            } catch (e1) {
                console.warn('unpkg CDN failed, trying jsDelivr:', e1);
                [essentiaWasm, essentiaCore] = await Promise.all([
                    import('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.es.js'),
                    import('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.es.js')
                ]);
            }

            this.EssentiaWASM = essentiaWasm.EssentiaWASM;

            // Try to find the Essentia constructor
            const EssentiaClass = essentiaCore.Essentia || essentiaCore.default || essentiaCore;

            if (typeof EssentiaClass === 'function') {
                this.essentia = new EssentiaClass(this.EssentiaWASM);
                console.log('Essentia.js loaded successfully');
            } else {
                throw new Error('Could not find Essentia constructor');
            }
            this.useEssentia = true;
            this.initialized = true;

        } catch (error) {
            console.warn('Failed to load Essentia.js, using YIN fallback:', error);
            console.info('Using YIN algorithm - should work well for monophonic audio');
            this.useEssentia = false;
            this.initialized = true;
        }
    }

    /**
     * Detect pitches in audio data
     * @param {Float32Array} audioData - Mono audio samples
     * @param {number} sampleRate - Sample rate in Hz
     * @param {Function} onProgress - Progress callback (0-1)
     * @returns {Promise<Object>} Object with pitches and confidences arrays
     */
    async detectPitches(audioData, sampleRate, onProgress) {
        if (!this.initialized) await this.init();

        // Use YIN fallback directly (Essentia.js has compatibility issues)
        console.info('Using YIN algorithm for pitch detection');
        return this._detectWithFallback(audioData, sampleRate, onProgress);

        /* Essentia.js disabled due to WASM compatibility issues
        if (this.useEssentia && this.essentia) {
            try {
                return await this._detectWithEssentia(audioData, sampleRate, onProgress);
            } catch (error) {
                console.warn('Essentia failed, using YIN fallback:', error);
                return this._detectWithFallback(audioData, sampleRate, onProgress);
            }
        } else {
            return this._detectWithFallback(audioData, sampleRate, onProgress);
        }
        */
    }

    /**
     * Detect pitches using Essentia.js (frame-by-frame processing)
     * @private
     */
    async _detectWithEssentia(audioData, sampleRate, onProgress) {
        console.log('Starting Essentia detection...', {
            audioLength: audioData.length,
            sampleRate: sampleRate,
            duration: audioData.length / sampleRate
        });

        const frameSize = this.config.frameSize;
        const hopSize = this.config.hopSize;
        const numFrames = Math.floor((audioData.length - frameSize) / hopSize);

        console.log(`Processing ${numFrames} frames (frameSize: ${frameSize}, hopSize: ${hopSize})`);

        const pitches = [];
        const confidences = [];

        if (onProgress) onProgress(0.05);

        try {
            // Process frame by frame
            const chunkSize = 50; // Process 50 frames at a time for progress updates

            for (let i = 0; i < numFrames; i++) {
                const start = i * hopSize;
                const frame = audioData.slice(start, start + frameSize);

                // Convert frame to Essentia vector
                const frameVector = this.essentia.arrayToVector(frame);

                // Run PitchYin on single frame (simpler than PitchYinProbabilistic)
                const result = this.essentia.PitchYin(
                    frameVector,
                    frameSize,
                    sampleRate,
                    0.1  // tolerance
                );

                // Get pitch and confidence
                pitches.push(result.pitch);
                confidences.push(result.pitchConfidence);

                // Clean up frame vector
                frameVector.delete();

                // Update progress periodically
                if (i % chunkSize === 0) {
                    const progress = 0.05 + (i / numFrames) * 0.9;
                    if (onProgress) onProgress(progress);
                    // Yield to event loop
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            console.log(`Detected ${pitches.length} pitch frames`);

            if (onProgress) onProgress(1.0);

            return { pitches, confidences };

        } catch (error) {
            console.error('Essentia detection error:', error);
            throw error;
        }
    }

    /**
     * Fallback pitch detection using autocorrelation
     * @private
     */
    async _detectWithFallback(audioData, sampleRate, onProgress) {
        const frameSize = this.config.frameSize;
        const hopSize = this.config.hopSize;
        const numFrames = Math.floor((audioData.length - frameSize) / hopSize);

        const pitches = new Float32Array(numFrames);
        const confidences = new Float32Array(numFrames);

        // Process in chunks for progress updates
        const chunkSize = 100;

        for (let i = 0; i < numFrames; i++) {
            const start = i * hopSize;
            const frame = audioData.slice(start, start + frameSize);

            const result = this._yinPitch(frame, sampleRate);
            pitches[i] = result.pitch;
            confidences[i] = result.confidence;

            // Update progress periodically
            if (onProgress && i % chunkSize === 0) {
                onProgress(i / numFrames);
                // Yield to event loop
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        if (onProgress) onProgress(1.0);

        return { pitches: Array.from(pitches), confidences: Array.from(confidences) };
    }

    /**
     * YIN algorithm for pitch detection (improved autocorrelation)
     * Based on: "YIN, a fundamental frequency estimator for speech and music"
     * @private
     */
    _yinPitch(frame, sampleRate) {
        const minFreq = 80;   // Minimum detectable frequency (Hz)
        const maxFreq = 2000; // Maximum detectable frequency (Hz)

        const minPeriod = Math.floor(sampleRate / maxFreq);
        const maxPeriod = Math.floor(sampleRate / minFreq);
        const threshold = 0.15; // YIN threshold

        // Calculate RMS to check if frame has enough energy
        let rms = 0;
        for (let i = 0; i < frame.length; i++) {
            rms += frame[i] * frame[i];
        }
        rms = Math.sqrt(rms / frame.length);

        if (rms < 0.005) {
            return { pitch: 0, confidence: 0 };
        }

        const halfLength = Math.floor(frame.length / 2);
        const yinBuffer = new Float32Array(halfLength);

        // Step 1: Difference function
        yinBuffer[0] = 1.0;
        for (let tau = 1; tau < halfLength; tau++) {
            let sum = 0;
            for (let i = 0; i < halfLength; i++) {
                const delta = frame[i] - frame[i + tau];
                sum += delta * delta;
            }
            yinBuffer[tau] = sum;
        }

        // Step 2: Cumulative mean normalized difference
        let runningSum = 0;
        yinBuffer[0] = 1.0;
        for (let tau = 1; tau < halfLength; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] *= tau / runningSum;
        }

        // Step 3: Absolute threshold
        let tauEstimate = -1;
        for (let tau = minPeriod; tau < maxPeriod; tau++) {
            if (yinBuffer[tau] < threshold) {
                // Find the local minimum
                while (tau + 1 < maxPeriod && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        if (tauEstimate === -1) {
            // No pitch found below threshold, find global minimum
            let minValue = 1.0;
            let minTau = minPeriod;
            for (let tau = minPeriod; tau < maxPeriod; tau++) {
                if (yinBuffer[tau] < minValue) {
                    minValue = yinBuffer[tau];
                    minTau = tau;
                }
            }
            if (minValue < 0.8) {
                tauEstimate = minTau;
            }
        }

        if (tauEstimate > 0) {
            // Parabolic interpolation for sub-sample accuracy
            const betterTau = this._parabolicInterpolation(yinBuffer, tauEstimate);
            const pitch = sampleRate / betterTau;
            const confidence = 1.0 - yinBuffer[tauEstimate];

            return { pitch, confidence };
        }

        return { pitch: 0, confidence: 0 };
    }

    /**
     * Parabolic interpolation for pitch refinement
     * @private
     */
    _parabolicInterpolation(array, x) {
        if (x < 1 || x >= array.length - 1) return x;

        const s0 = array[x - 1];
        const s1 = array[x];
        const s2 = array[x + 1];

        const adjustment = 0.5 * (s0 - s2) / (s0 - 2 * s1 + s2);
        return x + adjustment;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.essentia) {
            try {
                this.essentia.shutdown();
                this.essentia.delete();
            } catch (e) {
                // Ignore cleanup errors
            }
            this.essentia = null;
        }
        this.initialized = false;
    }
}
