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

        // Pitch detection range and stability settings
        this.minFrequency = 200; // Hz, lower bound of search range
        this.maxFrequency = 1500; // Hz, upper bound of search range
        this.peakThreshold = 0.85; // First peak must reach this fraction of the global max
        this.clarityThreshold = 0.3; // Minimum normalized correlation to accept a detection
        this.recentPitches = []; // Recent detections for consensus filtering
        this.consensusSize = 5; // Number of detections kept for the median filter
        this.consensusCents = 20; // Detections must agree within this many cents

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

            // Request raw microphone input: the default voice-call processing
            // (echo cancellation, noise suppression, AGC) distorts sustained
            // tones and breaks pitch detection
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create audio analysis nodes
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferSize;
            this.analyser.smoothingTimeConstant = 0.3; // Less smoothing for better responsiveness

            // Connect audio nodes
            source.connect(this.analyser);

            this.recentPitches = [];
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
            this.recentPitches = [];

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
                    this.processPitchDetection(frequency);
                }
            }
        }, this.analysisRate);
    }

    /**
     * Detect pitch using normalized autocorrelation.
     * Picks the FIRST strong peak (shortest lag) rather than the global
     * maximum: for a periodic signal the correlation peaks at the true period
     * T and again at 2T, 3T, ... with near-equal strength, so a global-max
     * rule randomly flips down an octave (e.g. 880 Hz read as 440 Hz).
     * @param {Float32Array} buffer - Audio buffer
     * @returns {number|null} Detected frequency in Hz
     */
    detectPitchAutocorrelation(buffer) {
        const SIZE = buffer.length;
        const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);

        // Need sufficient signal strength
        if (rms < 0.01) return null;

        // Only search lags corresponding to the plausible frequency range
        const minLag = Math.max(2, Math.floor(this.sampleRate / this.maxFrequency));
        const maxLag = Math.min(SIZE - 2, Math.ceil(this.sampleRate / this.minFrequency));
        if (minLag >= maxLag) return null;

        // Normalized autocorrelation over the search range
        const energy = buffer.reduce((sum, val) => sum + val * val, 0);
        if (energy === 0) return null;

        const c = new Float32Array(maxLag + 2);
        for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
            let sum = 0;
            for (let j = 0; j < SIZE - lag; j++) {
                sum += buffer[j] * buffer[j + lag];
            }
            c[lag] = sum / energy;
        }

        // Find the global maximum in range as a reference level
        let maxval = -1;
        for (let lag = minLag; lag <= maxLag; lag++) {
            if (c[lag] > maxval) maxval = c[lag];
        }

        // Reject noisy/aperiodic frames
        if (maxval < this.clarityThreshold) return null;

        // Take the first local peak that comes close to the global max —
        // the shortest such lag is the true period
        const threshold = maxval * this.peakThreshold;
        let T0 = -1;
        for (let lag = minLag; lag <= maxLag; lag++) {
            if (c[lag] >= threshold && c[lag] >= c[lag - 1] && c[lag] >= c[lag + 1]) {
                T0 = lag;
                break;
            }
        }
        if (T0 < 0) return null;

        // Parabolic interpolation for sub-sample precision
        const y1 = c[T0 - 1], y2 = c[T0], y3 = c[T0 + 1];
        const a = (y1 - 2 * y2 + y3) / 2;
        const b = (y3 - y1) / 2;
        let period = T0;
        if (a) period = T0 - b / (2 * a);

        return this.sampleRate / period;
    }

    /**
     * Process detected pitch and calculate tuning offset.
     * Uses a median consensus over recent detections so a single bad frame
     * (e.g. an octave glitch) cannot yank the tuning reading.
     * @param {number} frequency - Detected frequency in Hz
     */
    processPitchDetection(frequency) {
        // Keep a short history of raw detections
        this.recentPitches.push(frequency);
        if (this.recentPitches.length > this.consensusSize) {
            this.recentPitches.shift();
        }
        if (this.recentPitches.length < 3) return;

        // Median of recent detections
        const sorted = [...this.recentPitches].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];

        // Require a majority of detections to agree with the median
        const agreeing = this.recentPitches.filter(f =>
            Math.abs(this.frequencyToCents(f, median)) <= this.consensusCents
        ).length;
        if (agreeing < 3) return;

        // Calculate cents offset from target frequency (A880)
        const centsOffset = this.frequencyToCents(median, this.targetFrequency);

        // Update tuning offset (smooth it slightly to reduce jitter)
        const smoothingFactor = 0.7;
        this.tuningOffset = (this.tuningOffset * smoothingFactor) + (centsOffset * (1 - smoothingFactor));

        // Trigger callback if registered
        if (this.onTuningUpdate) {
            this.onTuningUpdate({
                frequency: median,
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