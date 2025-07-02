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
                    const notes = this.player.notationParser.extractCleanedNotes();
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
        const clickListener = (abcElem, tuneNumber, classes, analysis, drag) => {
            // Skip if this was part of a drag operation
            if (drag) return;
            this.handleNoteClick(abcElem);
        };

        // Preprocess ABC notation to fix common rendering issues
        const preprocessedAbc = this.player.notationParser.preprocessAbc(this.player.notationParser.currentAbc);
        
        // Debug logging for ABC notation issues
        if (preprocessedAbc !== this.player.notationParser.currentAbc) {
            console.log("ABC notation preprocessed to fix potential issues");
        }

        const visualObj = ABCJS.renderAbc("abc-notation", preprocessedAbc, {
            responsive: "resize",
            add_classes: true,
            stretchlast: false,
            staffwidth: window.innerWidth - 60,
            stafftopmargin: this.player.renderConfig.stafftopmargin,
            staffbottommargin: this.player.renderConfig.staffbottommargin,
            oneSvgPerLine: this.player.renderConfig.oneSvgPerLine,
            scale: this.player.renderConfig.scale,
            clickListener: clickListener,
            dragColor: "rgba(0,0,0,0.1)",
            dragging: true,   // Enable drag detection
            footer: false,
            footerPadding: 0,
            paddingbottom: 0,
            startingTune: this.player.tuneManager.currentTuneIndex
        })[0];

        // Debug: Check for potential positioning issues and fix them
        setTimeout(() => {
            this.validateNotePositioning();
        }, 200);

        return visualObj;
    }

    /**
     * Validates note positioning and fixes common issues
     */
    validateNotePositioning() {
        const svgElements = document.querySelectorAll('#abc-notation .abcjs-note');
        console.log(`Validating ${svgElements.length} note elements`);
        
        let issuesFound = 0;
        
        svgElements.forEach((note, index) => {
            const rect = note.getBoundingClientRect();
            const transform = note.getAttribute('transform') || '';
            const fill = note.getAttribute('fill') || '';
            const parent = note.closest('svg');
            
            if (!parent) return;
            
            const parentRect = parent.getBoundingClientRect();
            
            // Check for notes displaced above the staff
            if (rect.top < parentRect.top - 50) {
                console.warn(`Note ${index} displaced above staff:`, {
                    noteTop: rect.top,
                    parentTop: parentRect.top,
                    transform: transform,
                    fill: fill
                });
                issuesFound++;
                
                // Try to fix by resetting transform
                if (transform.includes('translate')) {
                    console.log(`Attempting to fix note ${index} positioning`);
                    note.removeAttribute('transform');
                }
            }
            
            // Check for unexpected red coloring (not from fingering system)
            if (fill.includes('red') && !note.closest('.fingering-overlay')) {
                console.warn(`Note ${index} has unexpected red coloring:`, {
                    fill: fill,
                    position: {x: rect.x, y: rect.y}
                });
                issuesFound++;
                
                // Reset to default fill
                note.removeAttribute('fill');
            }
        });
        
        if (issuesFound > 0) {
            console.log(`Fixed ${issuesFound} positioning issues`);
        }
    }

    /**
     * Renders fingering diagrams if enabled
     * @param {HTMLElement} abcContainer - The container element
     */
    renderFingeringDiagrams(abcContainer) {
        if (this.player.fingeringManager.showFingering) {
            setTimeout(() => {
                const notes = this.player.notationParser.extractCleanedNotes();
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
        }, 100);
    }
}