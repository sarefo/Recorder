/**
 * Manages rendering of ABC notation and fingering diagrams
 */
class RenderManager {
    static RENDER_DELAY = 100;

    constructor(player) {
        this.player = player;
        this.currentVisualObj = null;

        // Long-press playback anchor: while set, pressing play always starts
        // at this note (practice mode) — overriding the pause position and
        // fresh starts alike. Long-press the same note again to unpin it.
        // Kept while the same tune stays open, cleared when another tune loads.
        this.anchorNoteIndex = null;
        this.anchorTuneId = null;
    }

    /**
     * Renders the ABC notation on the page
     */
    render() {
        try {
            const abcContainer = document.getElementById('abc-notation');
            this.player.diagramRenderer.clearAllDiagrams(); // Clear everything to start fresh

            // Render the ABC notation first to get the visual object
            this.currentVisualObj = this.renderAbcNotation();

            // A different tune invalidates the long-press playback anchor
            // (re-renders of the same tune — resize, transpose — keep it)
            const tuneId = `${this.player.tuneManager?.currentTuneIndex ?? 0}:${this.currentVisualObj?.metaText?.title || ''}`;
            if (tuneId !== this.anchorTuneId) {
                this.anchorNoteIndex = null;
                this.anchorTuneId = tuneId;
            }

            // Initialize MIDI player
            this.player.midiPlayer.init(this.currentVisualObj);

            // Always add marker zones AFTER we have the visual object
            setTimeout(() => {
                const notes = this.player.notationParser.extractCleanedNotes();
                this.player.diagramRenderer.addMarkerZones(abcContainer, notes);

                // Add fingering diagrams if they should be shown
                if (this.player.fingeringManager.fingeringDisplayMode !== 'off') {
                    this.player.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
                }

                // Marker zones were rebuilt; re-show the playback anchor
                this.applyAnchorMarker();
            }, RenderManager.RENDER_DELAY);

            // Update URL for sharing
            if (this.player.shareManager) {
                this.player.shareManager.updateUrlDebounced();
            }

            // Update the tune counter display
            if (this.player.tuneNavigation) {
                this.player.tuneNavigation.updateTuneCountDisplay();
                this.player.tuneNavigation.updateTuneTitle();
            }

            // Scroll back to the beginning when a new piece is loaded
            if (this.player.autoScrollManager) {
                this.player.autoScrollManager.scrollToTop();
            }

        } catch (error) {
            console.error("Error in render:", error);
        }
    }

    /**
     * Renders the ABC notation to the DOM
     * @returns {Object} The visual object from abcjs
     */
    renderAbcNotation() {
        // Add click handler
        const clickListener = (abcElem, tuneNumber, classes, analysis, drag) => {
            // Skip if this was part of a drag operation
            if (drag) return;
            this.handleNoteClick(abcElem);
        };

        const visualObj = ABCJS.renderAbc("abc-notation", this.player.notationParser.currentAbc, {
            responsive: "resize",
            add_classes: true,
            stretchlast: false,
            staffwidth: window.innerWidth - 60,
            stafftopmargin: this.player.renderConfig.stafftopmargin,
            staffbottommargin: this.player.renderConfig.staffbottommargin,
            oneSvgPerLine: this.player.renderConfig.oneSvgPerLine,
            scale: this.player.renderConfig.scale,
            clickListener: clickListener,
            // abcjs paints the clicked element (note + attached chord symbol) with
            // selectionColor and leaves it that way; the default is #ff0000, which
            // showed up as "random" red notes after tap-to-seek. currentColor makes
            // the selection invisible while keeping the clickListener working.
            selectionColor: "currentColor",
            dragging: false,   // Disable all drag functionality - notes should never be draggable
            footer: false,
            footerPadding: 0,
            paddingbottom: 0,
            startingTune: this.player.tuneManager.currentTuneIndex
        })[0];

        return visualObj;
    }

    /**
     * Renders fingering diagrams if enabled
     * @param {HTMLElement} abcContainer - The container element
     */
    renderFingeringDiagrams(abcContainer) {
        if (this.player.fingeringManager.fingeringDisplayMode !== 'off') {
            setTimeout(() => {
                const notes = this.player.notationParser.extractCleanedNotes();
                this.player.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
            }, RenderManager.RENDER_DELAY);
        }
    }

    /**
     * Handles click events on notes
     * @param {Object} abcElem - The ABC element that was clicked
     */
    handleNoteClick(abcElem) {
        // Only handle actual notes
        if (abcElem.el_type !== "note" || !this.player.midiPlayer.midiPlayer) {
            return;
        }

        // Find the start milliseconds for this note
        const startMs = this.getNoteStartTime(abcElem);
        if (startMs === undefined) {
            console.warn("Could not determine start time for note");
            return;
        }

        this.playFromPosition(startMs);
    }

    /**
     * Gets the start time for a note in milliseconds
     * @param {Object} abcElem - The ABC element
     * @returns {number} The start time in milliseconds
     */
    getNoteStartTime(abcElem) {
        // For notes inside repeats, abcjs stores an array of occurrence times;
        // seek to the first occurrence.
        let ms = abcElem.currentTrackMilliseconds;
        if (Array.isArray(ms)) {
            ms = ms[0];
        }
        if (typeof ms !== 'number' && typeof abcElem.midiStartTime === 'number') {
            ms = abcElem.midiStartTime * 1000;
        }
        return typeof ms === 'number' && !isNaN(ms) ? ms : undefined;
    }

    /**
     * Plays from a specific note, identified by its abcjs data-index
     * (used by the long-press gesture on note marker zones)
     * @param {number} noteIndex - Index into the engraver's selectables
     */
    playFromNoteIndex(noteIndex) {
        const selectable = this.currentVisualObj?.engraver?.selectables?.[noteIndex];
        const abcElem = selectable?.absEl?.abcelem;
        if (abcElem) {
            if (this.anchorNoteIndex === noteIndex) {
                // Long-press on the anchored note unpins it (this one still
                // plays from there; afterwards pause/resume behaves normally)
                this.anchorNoteIndex = null;
                this.applyAnchorMarker();
            } else {
                this.setPlaybackAnchor(noteIndex);
            }
            this.handleNoteClick(abcElem);
        }
    }

    /**
     * Remembers a note as the playback anchor and marks it in the score
     * @param {number} noteIndex - Index into the engraver's selectables
     */
    setPlaybackAnchor(noteIndex) {
        this.anchorNoteIndex = noteIndex;
        this.applyAnchorMarker();
    }

    /**
     * Shows the anchor marker on the matching note marker zone
     * (safe to call after zones were rebuilt)
     */
    applyAnchorMarker() {
        document.querySelectorAll('.note-marker-zone[data-anchor]')
            .forEach(zone => zone.removeAttribute('data-anchor'));
        if (this.anchorNoteIndex === null) return;
        const zone = document.querySelector(`.note-marker-zone[data-note-index="${this.anchorNoteIndex}"]`);
        if (zone) {
            zone.setAttribute('data-anchor', 'true');
        }
    }

    /**
     * Resolves the anchor note to its playback start time
     * @returns {number|undefined} Start time in ms, or undefined if no anchor
     */
    getAnchorStartMs() {
        if (this.anchorNoteIndex === null) return undefined;
        const abcElem = this.currentVisualObj?.engraver?.selectables?.[this.anchorNoteIndex]?.absEl?.abcelem;
        return abcElem ? this.getNoteStartTime(abcElem) : undefined;
    }

    /**
     * Plays from a specific position in the music
     * @param {number} startMs - The start time in milliseconds
     */
    playFromPosition(startMs) {
        const midiPlayer = this.player.midiPlayer;

        // Take over playback: abort any in-flight start (preparation delay or
        // count-in) and silence whatever is sounding so sources never stack
        midiPlayer.interruptPendingStart();
        const session = midiPlayer.playSession;
        try {
            midiPlayer.midiPlayer.stop();
        } catch (e) {
            // stop() before the synth ever started is safe to ignore
        }

        // Start from this position
        setTimeout(() => {
            // Abort if another play/pause action took over in the meantime
            if (session !== midiPlayer.playSession) return;
            if (midiPlayer.midiPlayer.isRunning) {
                midiPlayer.midiPlayer.stop();
            }

            // seek() defaults to percent (0-1); pass seconds explicitly
            midiPlayer.midiPlayer.seek(startMs / 1000, "seconds");
            midiPlayer.midiPlayer.start();

            // Playback is now mid-piece; a later pause/resume must not
            // insert a count-in bar
            midiPlayer.isFirstPlay = false;

            // Keep note highlighting (and mobile auto-scroll) in sync
            const autoScroll = midiPlayer.autoScrollManager;
            if (autoScroll && autoScroll.timingCallbacks) {
                autoScroll.start();
                autoScroll.timingCallbacks.setProgress(startMs / 1000, "seconds");
            }

            midiPlayer.isPlaying = true;
            midiPlayer.updatePlayButtonState();
        }, RenderManager.RENDER_DELAY);
    }

    /**
     * Captures current annotation states before re-render
     * @returns {Object} Object containing annotation states
     */
    captureAnnotationStates() {
        const states = {
            noteStates: new Map(),
            fingeringVisibility: this.player.fingeringManager.fingeringDisplayMode,
            lastWindowWidth: window.innerWidth
        };

        // Capture red/green note highlighting states from marker zones
        const markerZones = document.querySelectorAll('.note-marker-zone');
        markerZones.forEach(zone => {
            const noteIndex = zone.getAttribute('data-note-index');
            const dataState = zone.getAttribute('data-state');
            if (noteIndex && dataState && dataState !== 'neutral') {
                states.noteStates.set(parseInt(noteIndex), dataState);
            }
        });

        // Also capture fingering diagram states as backup
        const fingeringDiagrams = document.querySelectorAll('.fingering-diagram-container');
        fingeringDiagrams.forEach(diagram => {
            const noteIndex = diagram.getAttribute('data-note-index');
            const dataState = diagram.getAttribute('data-state');
            if (noteIndex && dataState && dataState !== 'neutral') {
                states.noteStates.set(parseInt(noteIndex), dataState);
            }
        });

        return states;
    }

    /**
     * Restores annotation states after re-render
     * @param {Object} states - Previously captured states
     */
    restoreAnnotationStates(states) {
        // Restore note highlighting and fingering diagram states
        if (states.noteStates.size > 0) {
            // Restore marker zone states
            const markerZones = document.querySelectorAll('.note-marker-zone');
            markerZones.forEach(zone => {
                const noteIndex = zone.getAttribute('data-note-index');
                if (noteIndex) {
                    const savedState = states.noteStates.get(parseInt(noteIndex));
                    if (savedState) {
                        zone.setAttribute('data-state', savedState);
                    }
                }
            });

            // Restore fingering diagram states
            const fingeringDiagrams = document.querySelectorAll('.fingering-diagram-container');
            fingeringDiagrams.forEach(diagram => {
                const noteIndex = diagram.getAttribute('data-note-index');
                if (noteIndex) {
                    const savedState = states.noteStates.get(parseInt(noteIndex));
                    if (savedState) {
                        diagram.setAttribute('data-state', savedState);
                        // Apply visual state to the diagram
                        this.applyFingeringVisualState(diagram, savedState);
                    }
                }
            });
        }

        // Restore fingering visibility if it was enabled
        if (states.fingeringVisibility !== 'off' && this.player.fingeringManager.fingeringDisplayMode === 'off') {
            this.player.fingeringManager.fingeringDisplayMode = states.fingeringVisibility;
            this.player.showFingeringDiagrams();
        }
    }

    /**
     * Applies visual state to a fingering diagram
     * @param {Element} diagram - The fingering diagram element
     * @param {string} state - The state to apply (red, green, or neutral)
     */
    applyFingeringVisualState(diagram, state) {
        // Get the background color based on state
        let backgroundColor;
        if (state === 'red') {
            backgroundColor = this.player.fingeringConfig.redColor;
            diagram.classList.add('clicked');
        } else if (state === 'green') {
            backgroundColor = this.player.fingeringConfig.greenColor;
            diagram.classList.add('clicked');
        } else {
            backgroundColor = this.player.fingeringConfig.backgroundColor;
            diagram.classList.remove('clicked');
        }
        
        // Apply the background color
        diagram.style.backgroundColor = backgroundColor;
    }

    /**
     * Checks if a significant resize occurred (threshold-based)
     * @param {number} previousWidth - Previous window width
     * @param {number} currentWidth - Current window width
     * @returns {boolean} Whether a significant resize occurred
     */
    isSignificantResize(previousWidth, currentWidth) {
        const threshold = this.player.renderConfig.resizeThreshold;
        return Math.abs(currentWidth - previousWidth) > threshold;
    }
}