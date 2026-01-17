/**
 * Manages rendering of ABC notation and fingering diagrams
 */
class RenderManager {
    static RENDER_DELAY = 100;

    constructor(player) {
        this.player = player;
        this.currentVisualObj = null;
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

        // Check if we're on mobile and this might be a scroll attempt
        if (this.player.isMobile) {
            // Additional check could go here if needed
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
        return abcElem.currentTrackMilliseconds || abcElem.midiStartTime * 1000;
    }

    /**
     * Plays from a specific position in the music
     * @param {number} startMs - The start time in milliseconds
     */
    playFromPosition(startMs) {
        // Stop current playback if playing
        if (this.player.midiPlayer.isPlaying) {
            this.player.midiPlayer.midiPlayer.stop();
        }

        // Start from this position
        setTimeout(() => {
            this.player.midiPlayer.midiPlayer.seek(startMs);
            this.player.midiPlayer.midiPlayer.start();
            this.player.midiPlayer.isPlaying = true;
            document.getElementById('play-button').textContent = '⏸';
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