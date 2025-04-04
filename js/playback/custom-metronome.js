/**
 * CustomMetronome: Simple metronome using Web Audio API
 */
class CustomMetronome {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.tempo = 120;
        this.interval = null;
        this.nextNoteTime = 0.0;
        this.currentBeat = 0;
        this.beatsPerMeasure = 4;
        this.clickSchedulerLookahead = 0.1; // seconds ahead to schedule audio
        this.clickSchedulerInterval = 25;   // how often to call scheduling function (in ms)

        // Create gain nodes for different accent levels
        this.accentedClickGain = null;
        this.normalClickGain = null;
    }

    /**
     * Initialize the audio context and gain nodes
     */
    init() {
        // Create audio context if it doesn't exist yet
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create gain nodes for accented and normal beats
            this.accentedClickGain = this.audioContext.createGain();
            this.accentedClickGain.gain.value = 1.0;
            this.accentedClickGain.connect(this.audioContext.destination);

            this.normalClickGain = this.audioContext.createGain();
            this.normalClickGain.gain.value = 0.5; // Lower volume for non-accented beats
            this.normalClickGain.connect(this.audioContext.destination);
        }
    }

    /**
     * Create a metronome click sound
     * @param {number} time - When to schedule the click
     * @param {boolean} isAccented - Whether this click should be accented
     */
    scheduleClick(time, isAccented) {
        // Create oscillator
        const osc = this.audioContext.createOscillator();

        // Set frequency - higher for accented beats
        osc.frequency.value = isAccented ? 1000 : 800;

        // Choose gain node based on whether this is an accented beat
        const gainNode = isAccented ? this.accentedClickGain : this.normalClickGain;

        // Connect oscillator to gain node
        osc.connect(gainNode);

        // Schedule the click
        osc.start(time);
        osc.stop(time + 0.05); // Short duration click
    }

    /**
     * Schedule the upcoming metronome clicks
     */
    scheduleClicks() {
        // Calculate beat length in seconds based on tempo
        const secondsPerBeat = 60.0 / this.tempo;

        // Schedule clicks until we're beyond our lookahead window
        while (this.nextNoteTime < this.audioContext.currentTime + this.clickSchedulerLookahead) {
            // Determine if this is an accented beat (first beat of measure)
            const isAccented = this.currentBeat % this.beatsPerMeasure === 0;

            // Schedule this beat
            this.scheduleClick(this.nextNoteTime, isAccented);

            // Advance beat time and counter
            this.nextNoteTime += secondsPerBeat;
            this.currentBeat++;
        }
    }

    /**
     * Start the metronome
     * @param {number} bpm - Tempo in beats per minute
     * @param {number} timeSignatureNumerator - Top number of time signature (e.g., 4 in 4/4)
     */
    start(bpm, timeSignatureNumerator = 4) {
        if (this.isPlaying) return;

        this.init();
        this.tempo = bpm;
        this.beatsPerMeasure = timeSignatureNumerator;
        this.isPlaying = true;
        this.currentBeat = 0;

        // Resume audio context if it was suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Start scheduling from current time
        this.nextNoteTime = this.audioContext.currentTime;

        // Start scheduler interval
        this.interval = setInterval(() => this.scheduleClicks(), this.clickSchedulerInterval);
    }

    /**
     * Stop the metronome
     */
    stop() {
        if (!this.isPlaying) return;

        clearInterval(this.interval);
        this.isPlaying = false;
    }

    /**
     * Set the tempo
     * @param {number} bpm - Tempo in beats per minute
     */
    setTempo(bpm) {
        this.tempo = bpm;

        // If already playing, restart with new tempo
        if (this.isPlaying) {
            this.stop();
            this.start(bpm, this.beatsPerMeasure);
        }
    }

    /**
     * Set the time signature
     * @param {number} numerator - Top number of time signature
     */
    setTimeSignature(numerator) {
        this.beatsPerMeasure = numerator;

        // Reset beat counter on time signature change
        this.currentBeat = 0;
    }
}