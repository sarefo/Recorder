/**
 * Manages automatic scrolling during playback to keep the current note visible
 */
class AutoScrollManager {
    constructor(player) {
        this.player = player;
        this.enabled = true;
        this.timingCallbacks = null;
        this.currentElements = []; // Array of currently playing note elements
        this.scrollBehavior = 'smooth';
        this.viewportOffset = 0.4; // Position note at 40% from top (desktop default)
        this.scrollThreshold = 50; // Minimum pixels out of position before scrolling
        this.onFinishedCallback = null; // Callback to fire when playback completes
        this.finishTimer = null; // Timer to detect playback completion
        this.noteTimings = []; // ABCJS timing entries for the current tune
        this.preScrolledForRepeat = false; // View already moved to the repeat's first line

    }

    /**
     * Auto-scroll used to be limited to small screens, but a piece longer than
     * one screen needs following on a laptop just as much as on a phone.
     * It is now always on; scrollToPosition() no-ops when the page has
     * nothing to scroll, so short tunes are unaffected on any screen size.
     */
    updateEnabledBasedOnScreenSize() {
        this.enabled = true;
    }

    /**
     * Initialize timing callbacks for the current visual object
     * @param {Object} visualObj - The ABC visual object from ABCJS
     * @param {number} adjustedTempo - Optional adjusted tempo (BPM) for playback
     * @param {boolean} hasCountIn - Whether there's a count-in bar at the start
     */
    init(visualObj, adjustedTempo, hasCountIn) {
        if (!visualObj) {
            console.warn('AutoScrollManager: Cannot initialize without visual object');
            return;
        }

        // Stop any existing timing callbacks and finish timer
        if (this.timingCallbacks) {
            this.timingCallbacks.stop();
        }
        if (this.finishTimer) {
            clearTimeout(this.finishTimer);
            this.finishTimer = null;
        }

        try {
            // Get the base tempo from visual object if not provided
            const baseTempo = visualObj.getBpm ? visualObj.getBpm() : 120;
            const qpm = adjustedTempo || baseTempo;

            // Calculate total duration of the piece for completion detection
            // getTotalTime() returns duration in seconds at the base tempo
            // Adjust for the current playback tempo
            let durationMs = 0;
            if (visualObj.getTotalTime && typeof visualObj.getTotalTime === 'function') {
                const baseDurationSeconds = visualObj.getTotalTime();
                // Adjust duration based on tempo: faster tempo = shorter duration
                // baseDurationMs * (baseTempo / adjustedTempo)
                durationMs = (baseDurationSeconds * 1000) * (baseTempo / qpm);
            }

            // Store duration for use when starting playback
            this.totalDurationMs = durationMs;

            // Create new timing callbacks with ABCJS
            // If there's a count-in bar, add extraMeasuresAtBeginning so scrolling waits
            this.timingCallbacks = new ABCJS.TimingCallbacks(visualObj, {
                qpm: qpm, // Use adjusted tempo for correct timing
                extraMeasuresAtBeginning: hasCountIn ? 1 : 0, // Wait for count-in bar if present
                eventCallback: (ev) => this.handleNoteEvent(ev),
                lineEndCallback: (info) => this.handleLineEnd(info)
            });

            // Kept so the tune's last note and the loop's first note can be looked
            // up while playing; these are the same objects eventCallback receives
            this.noteTimings = this.timingCallbacks.noteTimings || [];
        } catch (error) {
            console.error('AutoScrollManager: Error initializing timing callbacks:', error);
        }
    }

    /**
     * Handle note event from ABCJS timing callbacks
     * Highlighting always happens; scrolling only when enabled (mobile)
     * @param {Object} ev - Event object containing note elements and position
     */
    handleNoteEvent(ev) {
        if (!ev) return;

        // A-B practice region: the first event past the end anchor means the
        // end note has finished — wrap to the start anchor (loop) or stop
        if (typeof ev.milliseconds === 'number') {
            const endMs = this.player?.renderManager?.getAnchorEndMs?.();
            if (typeof endMs === 'number' && ev.milliseconds > endMs) {
                this.player?.midiPlayer?.handleRegionBoundary?.();
                return;
            }
        }

        // Always clear previous highlight from all elements
        if (this.currentElements && this.currentElements.length > 0) {
            this.currentElements.forEach(el => {
                if (el && el.classList) {
                    el.classList.remove('playing');
                }
            });
        }

        // Get the DOM elements for current note (ev.elements is an array of arrays)
        if (ev.elements && ev.elements.length > 0) {
            // Store all elements for this note (flatten the array structure)
            this.currentElements = [];

            // Always add 'playing' class to all elements representing this note
            // ev.elements is an array of arrays (for chords, multiple notes, etc.)
            ev.elements.forEach(noteArray => {
                if (Array.isArray(noteArray)) {
                    noteArray.forEach(el => {
                        if (el && el.classList) {
                            el.classList.add('playing');
                            this.currentElements.push(el);
                        }
                    });
                }
            });

            // Only scroll when auto-scroll is enabled (mobile)
            if (this.enabled) {
                if (this.isRepeatLeadIn(ev)) {
                    this.scrollToLoopStart();
                } else {
                    this.scrollToPosition(ev.top, ev.height);
                }
            }
        }
    }

    /**
     * Scroll viewport to keep note at target position using ABCJS position data
     * @param {number} top - Top position of note in SVG (pixels from top of SVG)
     * @param {number} height - Height of the note
     */
    scrollToPosition(top, height) {
        if (top === undefined) return;

        // Get the SVG element to calculate absolute position
        const svg = document.querySelector('#abc-notation svg');
        if (!svg) return;

        const svgRect = svg.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Calculate absolute position of the note in viewport
        const absoluteTop = svgRect.top + top;

        // Check if we're on mobile
        const isMobile = this.player?.isMobile || window.innerWidth < 1024;

        // On mobile, position note higher (30%) to leave room for controls
        // On desktop, center it more (40%)
        const targetPosition = viewportHeight * (isMobile ? 0.3 : this.viewportOffset);

        const scrollNeeded = absoluteTop - targetPosition;

        // Smaller threshold on mobile for tighter tracking
        const threshold = isMobile ? 30 : this.scrollThreshold;

        // Only scroll if note is significantly out of position (prevents jitter)
        if (Math.abs(scrollNeeded) > threshold) {
            window.scrollBy({
                top: scrollNeeded,
                behavior: this.scrollBehavior
            });
        }
    }

    /**
     * Whether the note that just started is the last one before playback
     * loops back to the start. Scrolling at the wrap itself puts the first
     * line on screen only once it is already sounding, too late to read; the
     * last note is usually long enough to give that reading time back.
     * @param {Object} ev - The current timing event
     * @returns {boolean} True when the view should move to the loop start now
     */
    isRepeatLeadIn(ev) {
        if (!this.player?.midiPlayer?.playbackSettings?.loopEnabled) return false;
        if (typeof ev?.milliseconds !== 'number') return false;

        const lastMs = this.getLastNoteMs();
        return typeof lastMs === 'number' && ev.milliseconds >= lastMs;
    }

    /**
     * Start time of the last note actually heard before the loop wraps. Rests
     * are skipped: a tune ending in a bar of silence should give its reading
     * time from the last sounding note, not from the pause after it.
     * @returns {number|undefined} Time in ms, or undefined when unknown
     */
    getLastNoteMs() {
        const endMs = this.player?.renderManager?.getAnchorEndMs?.();
        const limit = (typeof endMs === 'number' && !isNaN(endMs)) ? endMs : Infinity;

        const timings = this.noteTimings || [];
        for (let i = timings.length - 1; i >= 0; i--) {
            const timing = timings[i];
            if (timing?.milliseconds <= limit && this.isSoundingEvent(timing)) {
                return timing.milliseconds;
            }
        }
        return undefined;
    }

    /**
     * Scrolls to where the next pass begins - the start anchor's note, or the
     * first note of the tune. Landing on the position the wrap would scroll to
     * anyway means the wrap itself no longer moves the page.
     */
    scrollToLoopStart() {
        this.preScrolledForRepeat = true;

        const startMs = this.player?.renderManager?.getAnchorStartMs?.();
        const from = (typeof startMs === 'number' && !isNaN(startMs)) ? startMs : 0;
        const timing = (this.noteTimings || []).find(t =>
            this.isSoundingEvent(t) && t.milliseconds >= from);

        if (timing) {
            this.scrollToPosition(timing.top, timing.height);
        } else {
            this.scrollToTop();
        }
    }

    /**
     * Whether a timing entry is a note being played, as opposed to a rest or
     * the end marker.
     * @param {Object} timing - An ABCJS timing entry
     * @returns {boolean} True for entries that sound a pitch and carry a position
     */
    isSoundingEvent(timing) {
        if (!timing || timing.type !== 'event' ||
            typeof timing.milliseconds !== 'number' ||
            !timing.elements || timing.elements.length === 0) {
            return false;
        }
        if (timing.midiPitches && timing.midiPitches.length > 0) return true;

        // ABCJS only hangs midiPitches on an event once the audio for the tune
        // has been built, so fall back to what was drawn: a rest says so in
        // the class of its element, a note carries abcjs-note
        return timing.elements.some(group => (group || []).some(el =>
            el?.classList?.contains('abcjs-note')));
    }

    /**
     * Handle line end event (optional optimization for pre-scrolling)
     * @param {Object} info - Line end information
     */
    handleLineEnd(info) {
        // Optional: Could implement pre-scroll when approaching end of line
        // For now, relying on per-note scrolling is sufficient
    }

    /**
     * Start timing callbacks for note highlighting (always) and auto-scroll (mobile only)
     */
    start() {
        this.preScrolledForRepeat = false;
        if (this.timingCallbacks) {
            try {
                this.timingCallbacks.start();

                // Set up completion timer if we have a duration and callback
                if (this.totalDurationMs && this.onFinishedCallback) {
                    // Add a small buffer (100ms) to ensure the last note event has fired
                    this.finishTimer = setTimeout(() => {
                        if (this.onFinishedCallback) {
                            this.onFinishedCallback();
                        }
                    }, this.totalDurationMs + 100);
                }
            } catch (error) {
                console.error('AutoScrollManager: Error starting timing callbacks:', error);
            }
        }
    }

    /**
     * Pause auto-scroll
     */
    pause() {
        // Clear the finish timer when pausing
        if (this.finishTimer) {
            clearTimeout(this.finishTimer);
            this.finishTimer = null;
        }

        if (this.timingCallbacks) {
            try {
                this.timingCallbacks.pause();
            } catch (error) {
                console.error('AutoScrollManager: Error pausing timing callbacks:', error);
            }
        }
    }

    /**
     * Stop and reset auto-scroll
     */
    stop() {
        // Clear the finish timer when stopping
        if (this.finishTimer) {
            clearTimeout(this.finishTimer);
            this.finishTimer = null;
        }

        if (this.timingCallbacks) {
            try {
                this.timingCallbacks.stop();
            } catch (error) {
                console.error('AutoScrollManager: Error stopping timing callbacks:', error);
            }
        }

        // Clear highlight from current note elements
        if (this.currentElements && this.currentElements.length > 0) {
            this.currentElements.forEach(el => {
                if (el && el.classList) {
                    el.classList.remove('playing');
                }
            });
            this.currentElements = [];
        }

        // Reset scroll position
        this.preScrolledForRepeat = false;
        this.scrollToTop();
    }

    /**
     * Reset scroll position for loop restart
     */
    reset() {
        // Clear the finish timer when resetting
        if (this.finishTimer) {
            clearTimeout(this.finishTimer);
            this.finishTimer = null;
        }

        // Clear highlight
        if (this.currentElements && this.currentElements.length > 0) {
            this.currentElements.forEach(el => {
                if (el && el.classList) {
                    el.classList.remove('playing');
                }
            });
            this.currentElements = [];
        }

        // Reset timing callbacks
        if (this.timingCallbacks) {
            try {
                this.timingCallbacks.reset();
            } catch (error) {
                console.error('AutoScrollManager: Error resetting timing callbacks:', error);
            }
        }

        // Scroll back to top, unless the last note already put the loop's
        // first line in view - scrolling again would only jog the page
        if (this.preScrolledForRepeat) {
            this.preScrolledForRepeat = false;
        } else {
            this.scrollToTop();
        }
    }

    /**
     * Sends note highlighting back to a position mid-flight, without stopping
     * anything. Used when looped playback wraps: the audio never pauses, so
     * neither should the timing callbacks.
     * @param {number} seconds - Position in the tune to continue from
     */
    restartAt(seconds) {
        if (!this.timingCallbacks) return;
        this.preScrolledForRepeat = false;

        // Clear highlight so the note we jump away from doesn't stay lit
        if (this.currentElements && this.currentElements.length > 0) {
            this.currentElements.forEach(el => {
                if (el && el.classList) {
                    el.classList.remove('playing');
                }
            });
            this.currentElements = [];
        }

        try {
            // The timing callbacks stop themselves at the end of the tune;
            // only restart them when they actually ran out (starting an
            // already-running instance would double up its animation loop)
            if (!this.timingCallbacks.isRunning) {
                this.timingCallbacks.start();
            }
            this.timingCallbacks.setProgress(seconds, "seconds");
        } catch (error) {
            console.error('AutoScrollManager: Error restarting timing callbacks:', error);
        }
    }

    /**
     * Scroll back to the top of the notation
     */
    scrollToTop() {
        const notation = document.getElementById('abc-notation');
        if (notation) {
            notation.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * toggle() and setEnabled() methods removed - auto-scroll is now automatic based on screen size
     * The enabled state is managed by updateEnabledBasedOnScreenSize()
     */

    /**
     * Check if auto-scroll is currently enabled
     * @returns {boolean} Current enabled state
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Set a callback to fire when playback completes
     * @param {Function} callback - Function to call when playback finishes
     */
    setOnFinishedCallback(callback) {
        this.onFinishedCallback = callback;
    }
}
