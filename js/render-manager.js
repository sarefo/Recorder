/**
 * Manages rendering of ABC notation and fingering diagrams
 */
class RenderManager {
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
            this.player.diagramRenderer.clearFingeringDiagrams();

            // Render the ABC notation first to get the visual object
            this.currentVisualObj = this.renderAbcNotation();

            // Initialize MIDI player
            this.player.midiPlayer.init(this.currentVisualObj);

            // Add fingering diagrams AFTER we have the visual object
            if (this.player.fingeringManager.showFingering) {
                setTimeout(() => {
                    const notes = this.player.notationParser.extractNotesUsingAbcjs(this.currentVisualObj);
                    //console.log("Notes extracted with abcjs:", notes);
                    this.player.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
                }, 100);
            }

            // Update URL for sharing
            if (this.player.shareManager) {
                this.player.shareManager.updateUrlDebounced();
            }

            // Update the tune counter display
            if (this.player.tuneNavigation) {
                this.player.tuneNavigation.updateTuneCountDisplay();
                this.player.tuneNavigation.updateTuneTitle();
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
        const clickListener = (abcElem, tuneNumber, classes) => {
            this.handleNoteClick(abcElem);
        };

        return ABCJS.renderAbc("abc-notation", this.player.notationParser.currentAbc, {
            responsive: "resize",
            add_classes: true,
            staffwidth: window.innerWidth - 60,
            stafftopmargin: this.player.renderConfig.stafftopmargin,
            staffbottommargin: this.player.renderConfig.staffbottommargin,
            oneSvgPerLine: this.player.renderConfig.oneSvgPerLine,
            scale: this.player.renderConfig.scale,
            clickListener: clickListener,
            footer: false,
            footerPadding: 0,
            paddingbottom: 0,
            startingTune: this.player.tuneManager.currentTuneIndex // Use tuneManager here
        })[0];
    }

    /**
     * Renders fingering diagrams if enabled
     * @param {HTMLElement} abcContainer - The container element
     */
    renderFingeringDiagrams(abcContainer) {
        if (this.player.fingeringManager.showFingering) {
            setTimeout(() => {
                // Use abcjs visual object to get correctly interpreted notes
                const notes = this.player.notationParser.extractNotesUsingAbcjs(this.currentVisualObj);

                //console.log("Notes adjusted for fingering:", notes);
                this.player.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
            }, 100);
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
        }, 100);
    }
}