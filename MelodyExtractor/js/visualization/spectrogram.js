/**
 * Spectrogram - Canvas-based spectrogram visualization
 * Renders behind the piano roll with aligned frequency/time axes
 * Uses Web Audio API's AnalyserNode for fast FFT computation
 */

export class Spectrogram {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.audioBuffer = null;
        this.audioContext = null;

        // FFT settings
        this.fftSize = 2048;
        this.hopSize = 512;

        // Display settings matching piano roll
        this.midiMin = 48;
        this.midiMax = 84;
        this.pixelsPerSecond = 100;
        this.noteHeight = 10;
        this.keyWidth = 50;

        // Color settings
        this.colorMap = this._generateColorMap();
    }

    /**
     * Initialize the spectrogram canvas
     * @param {HTMLCanvasElement} canvas - Canvas element to draw on
     */
    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    /**
     * Set display parameters to match piano roll
     * @param {Object} params - Display parameters
     */
    setDisplayParams(params) {
        if (params.midiMin !== undefined) this.midiMin = params.midiMin;
        if (params.midiMax !== undefined) this.midiMax = params.midiMax;
        if (params.pixelsPerSecond !== undefined) this.pixelsPerSecond = params.pixelsPerSecond;
        if (params.noteHeight !== undefined) this.noteHeight = params.noteHeight;
        if (params.keyWidth !== undefined) this.keyWidth = params.keyWidth;
    }

    /**
     * Compute and render spectrogram from audio buffer
     * Uses a chunked approach for better performance
     * @param {AudioBuffer} audioBuffer - Audio to analyze
     * @param {number} duration - Duration in seconds
     */
    async compute(audioBuffer, duration) {
        this.audioBuffer = audioBuffer;

        if (!this.canvas || !this.ctx) {
            console.warn('Spectrogram canvas not initialized');
            return;
        }

        const sampleRate = audioBuffer.sampleRate;
        const audioData = audioBuffer.getChannelData(0); // Mono

        // Calculate dimensions
        const numFrames = Math.floor((audioData.length - this.fftSize) / this.hopSize) + 1;
        const numBins = this.fftSize / 2;

        console.log(`Computing spectrogram: ${numFrames} frames, ${numBins} bins`);

        // Use Web Audio API's OfflineAudioContext for FFT
        const magnitudes = await this._computeFFTFrames(audioData, sampleRate, numFrames);

        // Find max for normalization
        let maxMag = 0;
        for (const spectrum of magnitudes) {
            for (let i = 0; i < spectrum.length; i++) {
                if (spectrum[i] > maxMag) maxMag = spectrum[i];
            }
        }

        // Render to canvas
        this._render(magnitudes, maxMag, numFrames, numBins, sampleRate, duration);
    }

    /**
     * Compute FFT frames using Web Audio API
     * @private
     */
    async _computeFFTFrames(audioData, sampleRate, numFrames) {
        const magnitudes = [];

        // Create offline context for analysis
        const offlineCtx = new OfflineAudioContext(1, audioData.length, sampleRate);

        // Create analyser node
        const analyser = offlineCtx.createAnalyser();
        analyser.fftSize = this.fftSize;
        analyser.smoothingTimeConstant = 0;

        // Create buffer source
        const buffer = offlineCtx.createBuffer(1, audioData.length, sampleRate);
        buffer.getChannelData(0).set(audioData);

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);
        analyser.connect(offlineCtx.destination);

        // We need to process frame by frame
        // Since OfflineAudioContext doesn't allow real-time analysis,
        // we'll use a simpler approach with typed arrays
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        // Process each frame manually using simple windowed FFT
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const frameData = new Float32Array(this.fftSize);

            // Apply Hann window
            for (let i = 0; i < this.fftSize; i++) {
                const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (this.fftSize - 1)));
                frameData[i] = (audioData[startSample + i] || 0) * windowValue;
            }

            // Use optimized FFT
            const spectrum = this._fft(frameData);
            magnitudes.push(spectrum);
        }

        return magnitudes;
    }

    /**
     * Optimized FFT using Cooley-Tukey algorithm
     * @private
     */
    _fft(data) {
        const n = data.length;
        const magnitudes = new Float32Array(n / 2);

        // For power-of-2 sizes, use iterative Cooley-Tukey
        if ((n & (n - 1)) === 0) {
            const real = new Float32Array(n);
            const imag = new Float32Array(n);

            // Bit-reversal permutation
            for (let i = 0; i < n; i++) {
                let j = 0;
                let x = i;
                for (let k = 0; k < Math.log2(n); k++) {
                    j = (j << 1) | (x & 1);
                    x >>= 1;
                }
                real[j] = data[i];
            }

            // Cooley-Tukey iterative FFT
            for (let size = 2; size <= n; size *= 2) {
                const halfSize = size / 2;
                const step = Math.PI / halfSize;

                for (let i = 0; i < n; i += size) {
                    for (let j = 0; j < halfSize; j++) {
                        const angle = -j * step;
                        const cos = Math.cos(angle);
                        const sin = Math.sin(angle);

                        const idx1 = i + j;
                        const idx2 = i + j + halfSize;

                        const tReal = real[idx2] * cos - imag[idx2] * sin;
                        const tImag = real[idx2] * sin + imag[idx2] * cos;

                        real[idx2] = real[idx1] - tReal;
                        imag[idx2] = imag[idx1] - tImag;
                        real[idx1] = real[idx1] + tReal;
                        imag[idx1] = imag[idx1] + tImag;
                    }
                }
            }

            // Compute magnitudes
            for (let i = 0; i < n / 2; i++) {
                magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
            }
        } else {
            // Fallback to DFT for non-power-of-2
            for (let k = 0; k < n / 2; k++) {
                let real = 0;
                let imag = 0;
                for (let t = 0; t < n; t++) {
                    const angle = (2 * Math.PI * k * t) / n;
                    real += data[t] * Math.cos(angle);
                    imag -= data[t] * Math.sin(angle);
                }
                magnitudes[k] = Math.sqrt(real * real + imag * imag) / n;
            }
        }

        return magnitudes;
    }

    /**
     * Render spectrogram to canvas
     * @private
     */
    _render(magnitudes, maxMag, numFrames, numBins, sampleRate, duration) {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.clearRect(0, 0, width, height);

        // Frequency range corresponding to MIDI range
        const minFreq = this._midiToFreq(this.midiMin);
        const maxFreq = this._midiToFreq(this.midiMax);
        const freqPerBin = sampleRate / this.fftSize;

        // Calculate bin range
        const minBin = Math.floor(minFreq / freqPerBin);
        const maxBin = Math.min(Math.ceil(maxFreq / freqPerBin), numBins - 1);

        // Time per frame
        const timePerFrame = this.hopSize / sampleRate;

        // Use logarithmic scaling for magnitude (dB-like)
        const logMax = Math.log10(maxMag + 1e-10);

        // Create image data for faster rendering
        const imageData = ctx.createImageData(width, height);
        const pixels = imageData.data;

        // Render each pixel
        for (let x = this.keyWidth; x < width; x++) {
            // Map x to time
            const time = (x - this.keyWidth) / this.pixelsPerSecond;
            const frameIndex = Math.floor(time / timePerFrame);

            if (frameIndex >= numFrames) continue;

            const spectrum = magnitudes[frameIndex];

            for (let y = 0; y < height; y++) {
                // Map y to MIDI note (inverted - higher notes at top)
                const midi = this.midiMax - (y / this.noteHeight);

                if (midi < this.midiMin || midi > this.midiMax) continue;

                // Map MIDI to frequency
                const freq = this._midiToFreq(midi);
                const bin = freq / freqPerBin;

                // Interpolate between bins
                const binLow = Math.floor(bin);
                const binHigh = Math.ceil(bin);
                const binFrac = bin - binLow;

                let mag = 0;
                if (binLow >= 0 && binHigh < spectrum.length) {
                    mag = spectrum[binLow] * (1 - binFrac) + spectrum[binHigh] * binFrac;
                }

                // Convert to 0-1 range with log scaling
                const logMag = Math.log10(mag + 1e-10);
                const normalized = Math.max(0, Math.min(1, (logMag - logMax + 3) / 3));

                // Map to color
                const color = this._getColor(normalized);

                // Set pixel
                const idx = (y * width + x) * 4;
                pixels[idx] = color.r;
                pixels[idx + 1] = color.g;
                pixels[idx + 2] = color.b;
                pixels[idx + 3] = Math.floor(normalized * 180); // Semi-transparent
            }
        }

        ctx.putImageData(imageData, 0, 0);
        console.log('Spectrogram rendered');
    }

    /**
     * Convert MIDI note to frequency
     * @private
     */
    _midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    /**
     * Generate color map (warm colors)
     * @private
     */
    _generateColorMap() {
        const colors = [];
        for (let i = 0; i < 256; i++) {
            const t = i / 255;
            // Black -> Purple -> Red -> Orange -> Yellow -> White
            let r, g, b;
            if (t < 0.2) {
                // Black to dark purple
                const lt = t / 0.2;
                r = Math.floor(30 * lt);
                g = 0;
                b = Math.floor(60 * lt);
            } else if (t < 0.4) {
                // Dark purple to red
                const lt = (t - 0.2) / 0.2;
                r = Math.floor(30 + 195 * lt);
                g = 0;
                b = Math.floor(60 * (1 - lt));
            } else if (t < 0.6) {
                // Red to orange
                const lt = (t - 0.4) / 0.2;
                r = 225;
                g = Math.floor(128 * lt);
                b = 0;
            } else if (t < 0.8) {
                // Orange to yellow
                const lt = (t - 0.6) / 0.2;
                r = 225 + Math.floor(30 * lt);
                g = 128 + Math.floor(127 * lt);
                b = 0;
            } else {
                // Yellow to white
                const lt = (t - 0.8) / 0.2;
                r = 255;
                g = 255;
                b = Math.floor(255 * lt);
            }
            colors.push({ r, g, b });
        }
        return colors;
    }

    /**
     * Get color for intensity value
     * @private
     */
    _getColor(intensity) {
        const idx = Math.floor(intensity * 255);
        return this.colorMap[Math.max(0, Math.min(255, idx))];
    }

    /**
     * Clear the spectrogram
     */
    clear() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}
