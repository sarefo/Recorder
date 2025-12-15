/**
 * Manages automatic scrolling during playback to keep the current note visible
 */
class AutoScrollManager {
    constructor(player) {
        this.player = player;
        this.enabled = true; // On by default
        this.timingCallbacks = null;
        this.currentElements = []; // Array of currently playing note elements
        this.scrollBehavior = 'smooth';
        this.viewportOffset = 0.4; // Position note at 40% from top (desktop default)
        this.scrollThreshold = 50; // Minimum pixels out of position before scrolling
    }

    /**
     * Initialize timing callbacks for the current visual object
     * @param {Object} visualObj - The ABC visual object from ABCJS
     */
    init(visualObj) {
        if (!visualObj) {
            console.warn('AutoScrollManager: Cannot initialize without visual object');
            return;
        }

        // Stop any existing timing callbacks
        if (this.timingCallbacks) {
            this.timingCallbacks.stop();
        }

        try {
            // Create new timing callbacks with ABCJS
            this.timingCallbacks = new ABCJS.TimingCallbacks(visualObj, {
                eventCallback: (ev) => this.handleNoteEvent(ev),
                lineEndCallback: (info) => this.handleLineEnd(info)
            });
        } catch (error) {
            console.error('AutoScrollManager: Error initializing timing callbacks:', error);
        }
    }

    /**
     * Handle note event from ABCJS timing callbacks
     * @param {Object} ev - Event object containing note elements and position
     */
    handleNoteEvent(ev) {
        if (!this.enabled || !ev) return;

        // Clear previous highlight from all elements
        if (this.currentElements && this.currentElements.length > 0) {
            this.currentElements.forEach(el => {
                if (el && el.classList) {
                    el.classList.remove('playing');
                }
            });
        }

        // Get the DOM elements for current note (ev.elements is an array)
        if (ev.elements && ev.elements.length > 0) {
            // Store all elements for this note
            this.currentElements = ev.elements;

            // Add 'playing' class to all elements representing this note
            ev.elements.forEach(el => {
                if (el && el.classList) {
                    el.classList.add('playing');
                }
            });

            // Use the position data from the event for scrolling
            // This is more reliable than getBoundingClientRect
            this.scrollToPosition(ev.top, ev.height);
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
     * Handle line end event (optional optimization for pre-scrolling)
     * @param {Object} info - Line end information
     */
    handleLineEnd(info) {
        // Optional: Could implement pre-scroll when approaching end of line
        // For now, relying on per-note scrolling is sufficient
    }

    /**
     * Start auto-scroll sync with playback
     */
    start() {
        if (this.timingCallbacks && this.enabled) {
            try {
                this.timingCallbacks.start();
            } catch (error) {
                console.error('AutoScrollManager: Error starting timing callbacks:', error);
            }
        }
    }

    /**
     * Pause auto-scroll
     */
    pause() {
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
        this.scrollToTop();
    }

    /**
     * Reset scroll position for loop restart
     */
    reset() {
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

        // Scroll back to top
        this.scrollToTop();
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
     * Toggle auto-scroll on/off
     * @returns {boolean} New enabled state
     */
    toggle() {
        this.enabled = !this.enabled;

        // If disabling, clear current highlight
        if (!this.enabled && this.currentElements && this.currentElements.length > 0) {
            this.currentElements.forEach(el => {
                if (el && el.classList) {
                    el.classList.remove('playing');
                }
            });
            this.currentElements = [];
        }

        return this.enabled;
    }

    /**
     * Set enabled state
     * @param {boolean} enabled - Whether auto-scroll should be enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        // If disabling, clear current highlight
        if (!this.enabled && this.currentElements && this.currentElements.length > 0) {
            this.currentElements.forEach(el => {
                if (el && el.classList) {
                    el.classList.remove('playing');
                }
            });
            this.currentElements = [];
        }
    }

    /**
     * Check if auto-scroll is currently enabled
     * @returns {boolean} Current enabled state
     */
    isEnabled() {
        return this.enabled;
    }
}
