/**
 * Keeps looped playback perfectly in time.
 *
 * The naive way to loop is to wait for the audio to end and then start it
 * again. That costs a JavaScript round trip at the seam — the browser has to
 * fire an event, run our handler and kick off a new audio source — which shows
 * up as a hesitation of a few dozen milliseconds and throws off the beat.
 *
 * Instead this class schedules the next repeat *ahead of time* on the Web Audio
 * clock, so the repeat begins at an exact sample, and briefly crossfades the
 * outgoing repeat so the seam has no click either. The loop window is either
 * the whole tune or the A-B practice region.
 */
class SeamlessLooper {
    /**
     * @param {AudioContext} audioContext - The shared audio context
     * @param {Object} synth - The ABCJS CreateSynth instance to loop
     */
    constructor(audioContext, synth) {
        this.audioContext = audioContext;
        this.synth = synth;

        /** @type {{start: number, end: number}|null} Loop window in seconds */
        this.window = null;
        /** @type {Array<{source: AudioBufferSourceNode, gain: GainNode}>} */
        this.voices = [];
        /** Repeats that are fading out but still sounding */
        this.retiring = [];
        /** Audio-clock time of the next seam */
        this.nextWrapAt = 0;
        this.wrapTimer = null;
        this.visualTimer = null;
        this.active = false;

        /** Called at every seam so note highlighting can jump back */
        this.onWrap = null;

        // How far ahead of a seam we do the scheduling work: generous enough
        // that a busy main thread cannot make us miss it, but never more than
        // a third of the loop, or we would schedule repeats faster than they
        // play. Recomputed per loop window.
        this.maxLookaheadSec = 0.3;
        this.lookaheadSec = this.maxLookaheadSec;
        // Fade applied to a repeat that is being retired. It runs *before* the
        // seam and reaches silence exactly there, so the outgoing repeat never
        // leaks the music that follows the region — which was clearly audible
        // as a second attack alongside the first note whenever the region ends
        // in a rest and nothing masks the leak. Long enough to remove the
        // click, short enough to barely shorten the last note.
        this.fadeOutSec = 0.06;
        // Tiny fade-in guards against a click when the loop start sits mid-note
        this.fadeInSec = 0.005;
    }

    /**
     * Starts looped playback at a position inside the loop window.
     * @param {{start: number, end: number}} loopWindow - Loop bounds in seconds
     * @param {number} fromSec - Position to begin at (defaults to the loop start)
     * @param {number} [atSec] - Audio-clock time to begin at, for a start that
     *   has to land on an exact moment (the end of a count-in)
     * @returns {boolean} Whether the loop could be started
     */
    start(loopWindow, fromSec, atSec) {
        const buffer = this.synth?.getAudioBuffer?.();
        if (!buffer || !loopWindow || !(loopWindow.end > loopWindow.start)) {
            return false;
        }

        this.stop();
        this.window = loopWindow;
        this.active = true;
        this._tuneLookahead();

        const offset = (typeof fromSec === 'number' && fromSec >= loopWindow.start && fromSec < loopWindow.end)
            ? fromSec : loopWindow.start;

        // A small lead lets the first repeat be scheduled rather than raced
        const startAt = (typeof atSec === 'number' && atSec > this.audioContext.currentTime)
            ? atSec
            : this.audioContext.currentTime + 0.03;
        this._startVoice(offset, startAt);
        this._adoptSynthClock(startAt, offset);

        this.nextWrapAt = startAt + (loopWindow.end - offset);
        this._scheduleWrap();
        return true;
    }

    /**
     * Re-aims the loop at a new window without interrupting the sound, e.g.
     * after the user moves an A-B anchor mid-playback.
     * @param {{start: number, end: number}} loopWindow - New loop bounds in seconds
     * @returns {boolean} Whether the new window was adopted
     */
    retarget(loopWindow) {
        if (!this.active || !loopWindow || !(loopWindow.end > loopWindow.start)) {
            return false;
        }
        const position = this.positionSec();
        this.window = loopWindow;

        // Outside the new window (or already past its end): wrap at once
        if (position < loopWindow.start || position >= loopWindow.end) {
            return this.start(loopWindow, loopWindow.start);
        }

        this._clearTimers();
        this._tuneLookahead();
        this.nextWrapAt = this.audioContext.currentTime + (loopWindow.end - position);
        this._scheduleWrap();
        return true;
    }

    /**
     * Keeps the scheduling lead short enough for the current loop length
     */
    _tuneLookahead() {
        const period = this.window.end - this.window.start;
        this.lookaheadSec = Math.min(this.maxLookaheadSec, period / 3);
    }

    /**
     * Current playback position within the tune, in seconds
     * @returns {number}
     */
    positionSec() {
        if (typeof this.synth?.startTimeSec !== 'number') return 0;
        return this.audioContext.currentTime - this.synth.startTimeSec;
    }

    /**
     * Stops the loop and silences every repeat it owns
     */
    stop() {
        this.active = false;
        this.window = null;
        this._clearTimers();
        this.voices.concat(this.retiring).forEach(({ source }) => {
            try {
                source.stop();
            } catch (e) {
                // Already stopped or never started — nothing to clean up
            }
        });
        this.voices = [];
        this.retiring = [];
    }

    /////////////// Private helpers //////////////

    _clearTimers() {
        if (this.wrapTimer) {
            clearTimeout(this.wrapTimer);
            this.wrapTimer = null;
        }
        if (this.visualTimer) {
            clearTimeout(this.visualTimer);
            this.visualTimer = null;
        }
    }

    /**
     * Creates and schedules one repeat of the tune
     * @param {number} offsetSec - Position in the buffer to start at
     * @param {number} whenSec - Audio-clock time to start at
     */
    _startVoice(offsetSec, whenSec) {
        const ctx = this.audioContext;
        const source = ctx.createBufferSource();
        source.buffer = this.synth.getAudioBuffer();

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, whenSec);
        gain.gain.linearRampToValueAtTime(1, whenSec + this.fadeInSec);

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(whenSec, offsetSec);

        this.voices.push({ source, gain });
        this._publishVoices();
    }

    /**
     * Keeps the synth's source list pointing at every repeat we currently own,
     * so its own stop()/pause() silences them like any other playback
     */
    _publishVoices() {
        this.synth.directSource = this.voices
            .concat(this.retiring)
            .map(voice => voice.source);
    }

    /**
     * Fades out and stops every repeat except the newest one, so that the
     * outgoing repeat is silent by the time the seam arrives
     * @param {number} seamSec - Audio-clock time of the seam
     */
    _retireOldVoices(seamSec) {
        const keep = this.voices[this.voices.length - 1];
        const outgoing = this.voices.filter(voice => voice !== keep);
        this.voices = keep ? [keep] : [];
        this.retiring = this.retiring.concat(outgoing);
        this._publishVoices();

        // Never schedule in the past: on a very short loop the seam can be
        // closer than a full fade, in which case we fade over what is left
        const fadeFrom = Math.max(this.audioContext.currentTime, seamSec - this.fadeOutSec);

        outgoing.forEach(voice => {
            const { source, gain } = voice;
            try {
                gain.gain.cancelScheduledValues(fadeFrom);
                gain.gain.setValueAtTime(gain.gain.value, fadeFrom);
                gain.gain.linearRampToValueAtTime(0, seamSec);
                source.stop(seamSec + 0.01);
            } catch (e) {
                // A source that already stopped is fine to skip
            }
            source.onended = () => {
                this.retiring = this.retiring.filter(v => v !== voice);
                if (this.active) this._publishVoices();
            };
        });
    }

    /**
     * Makes the synth's own position bookkeeping agree with the repeat we just
     * scheduled, so pause/resume and seek keep working while looping.
     * @param {number} whenSec - Audio-clock time the repeat starts
     * @param {number} offsetSec - Position in the tune it starts at
     */
    _adoptSynthClock(whenSec, offsetSec) {
        this.synth.isRunning = true;
        this.synth.startTimeSec = whenSec - offsetSec;
        this.synth.pausedTimeSec = undefined;
    }

    _scheduleWrap() {
        const delayMs = Math.max(
            0,
            (this.nextWrapAt - this.lookaheadSec - this.audioContext.currentTime) * 1000
        );
        this.wrapTimer = setTimeout(() => this._wrap(), delayMs);
    }

    _wrap() {
        if (!this.active || !this.window) return;

        const at = this.nextWrapAt;
        const loopWindow = this.window;

        this._startVoice(loopWindow.start, at);
        this._retireOldVoices(at);

        // The sound is scheduled; the bookkeeping and the score highlighting
        // catch up at the moment the seam actually passes
        const seamDelayMs = Math.max(0, (at - this.audioContext.currentTime) * 1000);
        this.visualTimer = setTimeout(() => {
            if (!this.active) return;
            this._adoptSynthClock(at, loopWindow.start);
            if (this.onWrap) this.onWrap(loopWindow.start);
        }, seamDelayMs);

        this.nextWrapAt = at + (loopWindow.end - loopWindow.start);
        this._scheduleWrap();
    }
}
