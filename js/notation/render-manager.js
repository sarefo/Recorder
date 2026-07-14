/**
 * Manages rendering of ABC notation and fingering diagrams
 */
class RenderManager {
    static RENDER_DELAY = 100;

    constructor(player) {
        this.player = player;
        this.currentVisualObj = null;

        // Long-press playback anchors. Start anchor (blue arrow): fresh starts
        // (play after stop or song end, restart) and loop wrap-arounds begin at
        // this note — without a count-in bar. Pause/resume keeps its own
        // position. End anchor (orange arrow): playback stops there (or wraps
        // to the start anchor in loop mode), forming an A-B practice region.
        // Long-press an existing arrow to remove it; long-press elsewhere with
        // a start anchor set opens a start-or-end choice. Cleared on tune load.
        this.anchorNoteIndex = null;
        this.anchorEndNoteIndex = null;
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
                this.anchorEndNoteIndex = null;
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
    /**
     * Handles a long-press on a note (via marker zone or fingering diagram):
     * - no start anchor yet: set it there and play from it
     * - on the start anchor: remove both anchors (and play from there)
     * - on the end anchor: remove just the end anchor
     * - elsewhere: ask whether to move the start or set the end
     * @param {number} noteIndex - Index into the engraver's selectables
     */
    handleNoteLongPress(noteIndex) {
        this.dismissAnchorChoice();

        if (this.anchorNoteIndex === null) {
            this.setPlaybackAnchor(noteIndex);
            this.playFromNoteIndex(noteIndex);
        } else if (noteIndex === this.anchorNoteIndex) {
            // Unpin (this press still plays from there; afterwards
            // pause/resume behaves normally)
            this.anchorNoteIndex = null;
            this.anchorEndNoteIndex = null;
            this.applyAnchorMarker();
            this.playFromNoteIndex(noteIndex);
        } else if (noteIndex === this.anchorEndNoteIndex) {
            this.anchorEndNoteIndex = null;
            this.applyAnchorMarker();
        } else {
            this.showAnchorChoice(noteIndex);
        }
    }

    /**
     * Plays from a specific note, identified by its abcjs data-index
     * @param {number} noteIndex - Index into the engraver's selectables
     */
    playFromNoteIndex(noteIndex) {
        const selectable = this.currentVisualObj?.engraver?.selectables?.[noteIndex];
        const abcElem = selectable?.absEl?.abcelem;
        if (abcElem) {
            this.handleNoteClick(abcElem);
        }
    }

    /**
     * Remembers a note as the playback start anchor and marks it in the score
     * @param {number} noteIndex - Index into the engraver's selectables
     */
    setPlaybackAnchor(noteIndex) {
        this.anchorNoteIndex = noteIndex;
        // An end anchor at or before the start makes no sense
        if (this.anchorEndNoteIndex !== null && this.anchorEndNoteIndex <= noteIndex) {
            this.anchorEndNoteIndex = null;
        }
        this.applyAnchorMarker();
    }

    /**
     * Remembers a note as the playback end anchor (A-B region)
     * @param {number} noteIndex - Index into the engraver's selectables
     */
    setPlaybackAnchorEnd(noteIndex) {
        if (noteIndex <= this.anchorNoteIndex) {
            // End before the start: swap so the region stays ordered
            this.anchorEndNoteIndex = this.anchorNoteIndex;
            this.anchorNoteIndex = noteIndex;
        } else {
            this.anchorEndNoteIndex = noteIndex;
        }
        this.applyAnchorMarker();
    }

    /**
     * Shows the anchor markers on the matching note marker zones
     * (safe to call after zones were rebuilt)
     */
    applyAnchorMarker() {
        document.querySelectorAll('.note-marker-zone[data-anchor]')
            .forEach(zone => zone.removeAttribute('data-anchor'));
        const mark = (noteIndex, kind) => {
            const zone = document.querySelector(`.note-marker-zone[data-note-index="${noteIndex}"]`);
            if (zone) zone.setAttribute('data-anchor', kind);
        };
        if (this.anchorNoteIndex !== null) mark(this.anchorNoteIndex, 'start');
        if (this.anchorEndNoteIndex !== null) mark(this.anchorEndNoteIndex, 'end');
    }

    /**
     * Resolves the start anchor note to its playback start time
     * @returns {number|undefined} Start time in ms, or undefined if no anchor
     */
    getAnchorStartMs() {
        return this.getNoteStartMsByIndex(this.anchorNoteIndex);
    }

    /**
     * Resolves the end anchor note to its playback start time. Playback that
     * passes this moment has finished the end note (the next event marks it).
     * @returns {number|undefined} Start time in ms, or undefined if no end anchor
     */
    getAnchorEndMs() {
        return this.getNoteStartMsByIndex(this.anchorEndNoteIndex);
    }

    /**
     * Resolves a selectable index to that note's playback start time
     * @param {number|null} noteIndex - Index into the engraver's selectables
     * @returns {number|undefined} Start time in ms
     */
    getNoteStartMsByIndex(noteIndex) {
        if (noteIndex === null || noteIndex === undefined) return undefined;
        const abcElem = this.currentVisualObj?.engraver?.selectables?.[noteIndex]?.absEl?.abcelem;
        return abcElem ? this.getNoteStartTime(abcElem) : undefined;
    }

    /**
     * Shows a small popup asking whether the long-pressed note should become
     * the loop start or the loop end
     * @param {number} noteIndex - Index into the engraver's selectables
     */
    showAnchorChoice(noteIndex) {
        const zone = document.querySelector(`.note-marker-zone[data-note-index="${noteIndex}"]`);
        if (!zone) return;
        const rect = zone.getBoundingClientRect();

        const popup = document.createElement('div');
        popup.className = 'anchor-choice-popup';

        const startBtn = document.createElement('button');
        startBtn.textContent = '▶ Start here';
        startBtn.addEventListener('click', () => {
            this.dismissAnchorChoice();
            this.setPlaybackAnchor(noteIndex);
            this.playFromNoteIndex(noteIndex);
        });

        const endBtn = document.createElement('button');
        endBtn.textContent = '◀ End here';
        endBtn.addEventListener('click', () => {
            this.dismissAnchorChoice();
            this.setPlaybackAnchorEnd(noteIndex);
        });

        popup.appendChild(startBtn);
        popup.appendChild(endBtn);
        document.body.appendChild(popup);

        // Position centered under the note, clamped to the viewport
        const popupRect = popup.getBoundingClientRect();
        const left = Math.min(
            Math.max(4, rect.left + rect.width / 2 - popupRect.width / 2),
            window.innerWidth - popupRect.width - 4
        );
        popup.style.left = `${left}px`;
        popup.style.top = `${Math.max(4, rect.bottom + 4)}px`;

        this._anchorChoicePopup = popup;
        // Dismiss on the next press anywhere outside the popup (pointerdown,
        // so the long-press's own trailing click can't dismiss it instantly)
        this._anchorChoiceDismiss = (e) => {
            if (!popup.contains(e.target)) this.dismissAnchorChoice();
        };
        document.addEventListener('pointerdown', this._anchorChoiceDismiss, true);
    }

    /**
     * Removes the anchor choice popup if present
     */
    dismissAnchorChoice() {
        if (this._anchorChoiceDismiss) {
            document.removeEventListener('pointerdown', this._anchorChoiceDismiss, true);
            this._anchorChoiceDismiss = null;
        }
        if (this._anchorChoicePopup) {
            this._anchorChoicePopup.remove();
            this._anchorChoicePopup = null;
        }
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