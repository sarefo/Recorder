/**
 * CustomMetronome: Simple metronome using Web Audio API
 */
class CustomMetronome {
    // Click loudness, relative to full scale
    static ACCENTED_VOLUME = 0.5;
    static NORMAL_VOLUME = 0.25;

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
        this.constantMode = false; // whether metronome runs independently of playback
        this.visualCallback = null; // callback for visual feedback

        // Optional source for the music's own beat grid (see setBeatGridProvider)
        this.beatGridProvider = null;
        // Audio-clock time of the most recently scheduled click, so a grid that
        // moves under us can never place a second click on top of one already
        // sounding
        this.lastScheduledTime = -Infinity;

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
        }
        if (!this.accentedClickGain) {
            // Create gain nodes for accented and normal beats. The clicks sit
            // under the music, so these stay well below unity.
            this.accentedClickGain = this.audioContext.createGain();
            this.accentedClickGain.gain.value = CustomMetronome.ACCENTED_VOLUME;
            this.accentedClickGain.connect(this.audioContext.destination);

            this.normalClickGain = this.audioContext.createGain();
            this.normalClickGain.gain.value = CustomMetronome.NORMAL_VOLUME;
            this.normalClickGain.connect(this.audioContext.destination);
        }
    }

    /**
     * Adopts the audio context the music plays on. Two separate contexts have
     * unrelated `currentTime` origins, so sharing one is what makes it possible
     * to place a click at a known position in the music.
     * @param {AudioContext} context - The player's audio context
     */
    useAudioContext(context) {
        if (!context || this.audioContext === context) return;

        // Nodes belong to the context that created them
        this.accentedClickGain = null;
        this.normalClickGain = null;
        this.audioContext = context;
        this.lastScheduledTime = -Infinity;
        this.nextNoteTime = context.currentTime;
        this.init();
    }

    /**
     * Supplies the music's beat grid, so the clicks land on the printed beats
     * instead of free-running from whenever the metronome happened to start.
     * @param {function(): ({originSec: number, pickupBeats: number}|null)} provider
     *   Returns the audio-clock time of the music's position 0 and how many
     *   beats of pickup precede its first bar line, or null when no music is
     *   playing (the metronome then free-runs, e.g. during the count-in)
     */
    setBeatGridProvider(provider) {
        this.beatGridProvider = provider;
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

        // Per-click envelope: a bare start/stop on the oscillator snaps the
        // waveform at both ends, which is heard as a harsh extra click
        const envelope = this.audioContext.createGain();
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(1, time + 0.002);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.connect(envelope);
        envelope.connect(gainNode);

        // Schedule the click
        osc.start(time);
        osc.stop(time + 0.05); // Short duration click
        osc.onended = () => envelope.disconnect();

        // Schedule visual feedback if callback is set
        if (this.visualCallback) {
            const visualDelay = (time - this.audioContext.currentTime) * 1000;
            setTimeout(() => {
                this.visualCallback(isAccented);
            }, Math.max(0, visualDelay));
        }
    }

    /**
     * Schedule the upcoming metronome clicks
     */
    scheduleClicks() {
        // Calculate beat length in seconds based on tempo
        const secondsPerBeat = 60.0 / this.tempo;
        const now = this.audioContext.currentTime;
        const horizon = now + this.clickSchedulerLookahead;

        const grid = this.beatGridProvider ? this.beatGridProvider() : null;
        if (grid) {
            this.scheduleClicksOnGrid(grid, secondsPerBeat, now, horizon);
            return;
        }

        // No music to follow: free-run from wherever we are. Coming back from
        // grid mode, nextNoteTime is stale and would flush a burst of clicks.
        if (this.nextNoteTime < now) {
            this.nextNoteTime = Math.max(now, this.lastScheduledTime + secondsPerBeat);
        }

        // Schedule clicks until we're beyond our lookahead window
        while (this.nextNoteTime < horizon) {
            // Determine if this is an accented beat (first beat of measure)
            const isAccented = this.currentBeat % this.beatsPerMeasure === 0;

            // Schedule this beat
            this.scheduleClick(this.nextNoteTime, isAccented);
            this.lastScheduledTime = this.nextNoteTime;

            // Advance beat time and counter
            this.nextNoteTime += secondsPerBeat;
            this.currentBeat++;
        }
    }

    /**
     * Schedules the upcoming clicks onto the music's beat grid.
     *
     * The grid is re-derived on every scheduler tick rather than advanced by
     * one beat at a time, and that is the whole point: when a loop wraps, the
     * music jumps back and the grid jumps with it, so the next click lands on
     * the beat at the region's start instead of wherever a free-running count
     * happened to be. It also keeps the accent on real bar lines, however many
     * beats long the A-B region is.
     *
     * @param {{originSec: number, pickupBeats: number}} grid - Music beat grid
     * @param {number} secondsPerBeat - Beat length in seconds
     * @param {number} now - Current audio-clock time
     * @param {number} horizon - Schedule clicks up to this audio-clock time
     */
    scheduleClicksOnGrid(grid, secondsPerBeat, now, horizon) {
        // Audio-clock time of the music's first bar line
        const downbeat = grid.originSec + grid.pickupBeats * secondsPerBeat;

        // Half a beat of guard: enough to absorb the grid shifting at a loop
        // seam without ever double-triggering a beat
        const earliest = Math.max(now, this.lastScheduledTime + secondsPerBeat / 2);
        let beat = Math.ceil((earliest - downbeat) / secondsPerBeat);

        for (let time = downbeat + beat * secondsPerBeat; time < horizon;) {
            // Beats before the first bar line (a pickup) count negative
            const beatInMeasure = ((beat % this.beatsPerMeasure) + this.beatsPerMeasure)
                % this.beatsPerMeasure;
            this.scheduleClick(time, beatInMeasure === 0);
            this.lastScheduledTime = time;
            this.currentBeat = beat;

            beat++;
            time = downbeat + beat * secondsPerBeat;
        }
    }

    /**
     * Start the metronome
     * @param {number} bpm - Tempo in beats per minute
     * @param {number} timeSignatureNumerator - Top number of time signature (e.g., 4 in 4/4)
     */
    async start(bpm, timeSignatureNumerator = 4) {
        if (this.isPlaying) return;

        this.init();
        this.tempo = bpm;
        this.beatsPerMeasure = timeSignatureNumerator;
        this.isPlaying = true;
        this.currentBeat = 0;

        // Resume audio context if it was suspended and wait for it to be ready
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // Start scheduling from current time (after audio context is ready)
        this.nextNoteTime = this.audioContext.currentTime;
        this.lastScheduledTime = -Infinity;

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
    async setTempo(bpm) {
        this.tempo = bpm;

        // If already playing, restart with new tempo
        if (this.isPlaying) {
            this.stop();
            await this.start(bpm, this.beatsPerMeasure);
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

    /**
     * Set the visual feedback callback
     * @param {function} callback - Function to call for visual feedback (receives isAccented parameter)
     */
    setVisualCallback(callback) {
        this.visualCallback = callback;
    }

    /**
     * Set constant mode - whether metronome runs independently of playback
     * @param {boolean} enabled - Whether to enable constant mode
     */
    setConstantMode(enabled) {
        this.constantMode = enabled;
    }

    /**
     * Check if constant mode is enabled
     * @returns {boolean} Whether constant mode is active
     */
    isConstantMode() {
        return this.constantMode;
    }
}