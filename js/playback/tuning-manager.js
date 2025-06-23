/**
 * TuningManager: Handles pitch detection and tuning adjustment
 */
class TuningManager {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.analyser = null;
        this.isListening = false;
        this.pitchDetector = null;
        this.tuningOffset = 0; // Cents offset from A880
        this.targetFrequency = 880; // A5 = 880 Hz (recorder's A)
        this.onTuningUpdate = null; // Callback for tuning changes

        // Audio analysis settings
        this.bufferSize = 4096;
        this.sampleRate = 44100;
        this.analysisInterval = null;
        this.analysisRate = 50; // Analysis frequency in ms

        // Tuning tolerance
        this.tuningTolerance = 5; // ±5 cents considered "in tune"

        // Load saved tuning offset
        this.loadTuningOffset();
    }

    /**
     * Initialize the tuning manager
     * @param {AudioContext} sharedAudioContext - Optional shared audio context
     */
    async init(sharedAudioContext = null) {
        try {
            // Use shared audio context if provided, otherwise create new one
            if (sharedAudioContext) {
                this.audioContext = sharedAudioContext;
            } else if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Initialize our custom autocorrelation pitch detector
            this.sampleRate = this.audioContext.sampleRate;

            console.log('TuningManager initialized with sample rate:', this.sampleRate);
            return true;
        } catch (error) {
            console.error('Error initializing tuning manager:', error);
            return false;
        }
    }

    /**
     * Request microphone access and start tuning process
     */
    async startTuning() {
        try {
            if (this.isListening) {
                return true;
            }

            await this.init();

            // Request microphone access with simpler constraints first
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            console.log('Microphone access granted, stream tracks:', this.mediaStream.getTracks().length);

            // Create audio analysis nodes
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferSize;
            this.analyser.smoothingTimeConstant = 0.3; // Less smoothing for better responsiveness

            // Connect audio nodes
            source.connect(this.analyser);

            console.log('Audio nodes connected, analyser configured with fftSize:', this.analyser.fftSize);

            this.isListening = true;

            // Start pitch analysis
            this.startPitchAnalysis();

            return true;
        } catch (error) {
            console.error('Error starting tuning:', error);
            if (error.name === 'NotAllowedError') {
                throw new Error('Microphone access denied. Please allow microphone access and try again.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No microphone found. Please connect a microphone and try again.');
            }
            throw error;
        }
    }

    /**
     * Stop tuning process and release microphone
     */
    stopTuning() {
        try {
            this.isListening = false;

            // Clear analysis interval
            if (this.analysisInterval) {
                clearInterval(this.analysisInterval);
                this.analysisInterval = null;
            }

            // Stop media stream
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }

            // Clean up analyser
            this.analyser = null;

            return true;
        } catch (error) {
            console.error('Error stopping tuning:', error);
            return false;
        }
    }

    /**
     * Start continuous pitch analysis
     */
    startPitchAnalysis() {
        if (!this.analyser) {
            console.error('Cannot start pitch analysis: missing analyser');
            return;
        }

        console.log('Starting pitch analysis with', this.analysisRate, 'ms interval');

        this.analysisInterval = setInterval(() => {
            if (!this.isListening || !this.analyser) {
                return;
            }

            // Get audio data from analyser
            const buffer = new Float32Array(this.analyser.fftSize);
            this.analyser.getFloatTimeDomainData(buffer);

            // Check if we're getting audio input
            const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);

            // Only process if we have significant audio input
            if (rms > 0.001) {
                // Detect pitch using autocorrelation
                const frequency = this.detectPitchAutocorrelation(buffer);

                if (frequency && frequency > 0 && frequency > 200 && frequency < 1500) {
                    console.log('Detected frequency:', frequency.toFixed(2), 'Hz, RMS:', rms.toFixed(4));
                    this.processPitchDetection(frequency);
                }
            }
        }, this.analysisRate);
    }

    /**
     * Detect pitch using autocorrelation algorithm
     * @param {Float32Array} buffer - Audio buffer
     * @returns {number|null} Detected frequency in Hz
     */
    detectPitchAutocorrelation(buffer) {
        const SIZE = buffer.length;
        const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);

        // Need sufficient signal strength
        if (rms < 0.01) return null;

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        const c = new Array(SIZE).fill(0);

        // Autocorrelation
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
                c[i] = c[i] + buffer[j] * buffer[j + i];
            }
        }

        let d = 0;
        while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;

        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }

        let T0 = maxpos;

        // Parabolic interpolation
        const y1 = c[T0 - 1], y2 = c[T0], y3 = c[T0 + 1];
        const a = (y1 - 2 * y2 + y3) / 2;
        const b = (y3 - y1) / 2;

        if (a) T0 = T0 - b / (2 * a);

        return this.sampleRate / T0;
    }

    /**
     * Process detected pitch and calculate tuning offset
     * @param {number} frequency - Detected frequency in Hz
     */
    processPitchDetection(frequency) {
        // Calculate cents offset from target frequency (A440)
        const centsOffset = this.frequencyToCents(frequency, this.targetFrequency);

        // Update tuning offset (smooth it slightly to reduce jitter)
        const smoothingFactor = 0.7;
        this.tuningOffset = (this.tuningOffset * smoothingFactor) + (centsOffset * (1 - smoothingFactor));

        // Trigger callback if registered
        if (this.onTuningUpdate) {
            this.onTuningUpdate({
                frequency: frequency,
                centsOffset: centsOffset,
                smoothedOffset: this.tuningOffset,
                isInTune: Math.abs(this.tuningOffset) <= this.tuningTolerance
            });
        }
    }

    /**
     * Convert frequency difference to cents
     * @param {number} frequency - Measured frequency
     * @param {number} reference - Reference frequency
     * @returns {number} Cents offset
     */
    frequencyToCents(frequency, reference) {
        return 1200 * Math.log2(frequency / reference);
    }

    /**
     * Convert cents to frequency multiplier
     * @param {number} cents - Cents offset
     * @returns {number} Frequency multiplier
     */
    centsToMultiplier(cents) {
        return Math.pow(2, cents / 1200);
    }

    /**
     * Apply current tuning offset (call this to lock in the tuning)
     */
    applyTuning() {
        // Save the current tuning offset
        this.saveTuningOffset();

        // Notify that tuning has been applied
        if (this.onTuningUpdate) {
            this.onTuningUpdate({
                frequency: null,
                centsOffset: this.tuningOffset,
                smoothedOffset: this.tuningOffset,
                isInTune: true,
                applied: true
            });
        }

        return this.tuningOffset;
    }

    /**
     * Reset tuning to standard A440
     */
    resetTuning() {
        this.tuningOffset = 0;
        this.saveTuningOffset();

        if (this.onTuningUpdate) {
            this.onTuningUpdate({
                frequency: null,
                centsOffset: 0,
                smoothedOffset: 0,
                isInTune: true,
                reset: true
            });
        }
    }

    /**
     * Get current tuning offset in cents
     * @returns {number} Tuning offset in cents
     */
    getTuningOffset() {
        return this.tuningOffset;
    }

    /**
     * Get frequency multiplier for current tuning
     * @returns {number} Frequency multiplier to apply to synth
     */
    getFrequencyMultiplier() {
        return this.centsToMultiplier(this.tuningOffset);
    }

    /**
     * Save tuning offset to localStorage
     */
    saveTuningOffset() {
        try {
            localStorage.setItem('abc-player-tuning-offset', this.tuningOffset.toString());
        } catch (error) {
            console.warn('Could not save tuning offset:', error);
        }
    }

    /**
     * Load tuning offset from localStorage
     */
    loadTuningOffset() {
        try {
            const saved = localStorage.getItem('abc-player-tuning-offset');
            if (saved !== null) {
                this.tuningOffset = parseFloat(saved) || 0;
            }
        } catch (error) {
            console.warn('Could not load tuning offset:', error);
            this.tuningOffset = 0;
        }
    }

    /**
     * Check if microphone is supported
     * @returns {boolean} True if microphone access is supported
     */
    static isMicrophoneSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
}