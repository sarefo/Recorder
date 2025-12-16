/**
 * Main application controller
 */
class AbcPlayer {
    constructor() {
        // Configuration for rendering ABC notation
        this.renderConfig = {
            stafftopmargin: 120,
            staffbottommargin: 60,
            oneSvgPerLine: false,
            scale: 1.0,
            resizeThreshold: 100, // pixels - minimum change to trigger re-render
        };

        // Config settings for fingering diagrams
        this.fingeringConfig = {
            showLabels: true,
            scale: 0.75,
            verticalOffset: 12,
            holeSize: 7,
            holeBorder: 1,
            holeSpacing: 2,
            columnSpacing: 6,
            borderRadius: 4,
            fontSizeNote: 10,
            backgroundColor: 'rgba(240, 240, 180, 0.9)',
            redColor: 'rgba(255, 200, 150, 0.8)',
            greenColor: 'rgba(0, 128, 0, 0.6)',
            // Note marking configuration
            enableNoteMarking: true,
            noteMarkingHeight: 80,
        };

        // Initialize settings manager first
        this.settingsManager = new SettingsManager();
        
        // Initialize sub-modules
        this.notationParser = new NotationParser();
        this.tuneManager = new TuneManager(this);
        this.fingeringManager = new FingeringManager(this.fingeringConfig);
        this.transposeManager = new TransposeManager();
        this.midiPlayer = new MidiPlayer();
        this.autoScrollManager = new AutoScrollManager(this);
        this.midiPlayer.autoScrollManager = this.autoScrollManager;
        this.diagramRenderer = new DiagramRenderer(this.fingeringManager, this.fingeringConfig);
        this.fileManager = new FileManager(this);
        this.tuneNavigation = new TuneNavigation(this);
        this.uiControls = new UIControls(this);
        this.renderManager = new RenderManager(this);
        this.mobileUI = new MobileUI(this);
        this.swipeHandler = new SwipeHandler(this);

        // Initialize UI handlers
        this.initializeEventListeners();

        this.shareManager = new ShareManager(this);

        // Mobile detection is now handled by MobileUI class
        this.isMobile = window.innerWidth <= 768;
    }

    /**
     * Renders the ABC notation on the page
     */
    render() {
        this.renderManager.render();
    }

    /**
     * Copies the current ABC notation to the clipboard
     */
    async copyToClipboard() {
        return Utils.copyToClipboard(this.notationParser.currentAbc);
    }

    /**
     * Pastes ABC notation from the clipboard
     * @returns {boolean} Whether the paste was successful
     */
    async pasteFromClipboard() {
        const text = await Utils.readFromClipboard();
        if (text && text.includes('X:') && text.includes('K:')) {
            this.notationParser.currentAbc = text;
            this.render();
            Utils.showFeedback('ABC notation pasted successfully!');
            return true;
        } else if (text) {
            alert('Invalid ABC notation format');
        }
        return false;
    }

    /**
     * Transposes the music up or down
     * @param {string} direction - The direction to transpose ('up' or 'down')
     */
    transpose(direction) {
        const semitoneShift = direction === 'up' ? 1 : -1;
        const transposedAbc = this.transposeManager.transpose(this.notationParser.currentAbc, semitoneShift);

        if (transposedAbc !== this.notationParser.currentAbc) {
            this.notationParser.currentAbc = transposedAbc;
            this.render();
        }
    }

    /**
     * Toggles the reference row visibility
     */
    toggleReferenceRow() {
        const referenceRow = document.getElementById('reference-row');

        // Toggle visibility using CSS classes
        if (referenceRow.classList.contains('hidden')) {
            referenceRow.classList.remove('hidden');
            referenceRow.classList.add('visible-flex');
            document.getElementById('chart-toggle').innerHTML = '&#x2212;'; // Minus sign
        } else {
            referenceRow.classList.add('hidden');
            referenceRow.classList.remove('visible-flex');
            document.getElementById('chart-toggle').innerHTML = '&#43;'; // Plus sign
        }
    }

    /**
     * Toggles between German and Dizi D fingering systems with automatic transposition
     * @returns {string} The new fingering system
     */
    toggleFingeringSystem() {
        const previousSystem = this.fingeringManager.currentFingeringSystem;
        const newSystem = this.fingeringManager.toggleFingeringSystem();

        // Apply automatic transposition when switching to/from dizi
        this.applyAutoTransposition(previousSystem, newSystem);

        this.settingsManager.set('fingeringStyle', newSystem);
        this.render();
        // Update the reference row
        this.fingeringManager.populateReferenceRow();
        return newSystem;
    }

    /**
     * Toggles to baroque from german (or back to german from baroque)
     * @returns {string} The new fingering system
     */
    toggleBaroqueSystem() {
        const newSystem = this.fingeringManager.toggleBaroqueSystem();
        this.settingsManager.set('fingeringStyle', newSystem);
        this.render();
        // Update the reference row
        this.fingeringManager.populateReferenceRow();
        return newSystem;
    }

    /**
     * Applies automatic transposition when switching between fingering systems
     * @param {string} previousSystem - The previous fingering system
     * @param {string} newSystem - The new fingering system
     */
    applyAutoTransposition(previousSystem, newSystem) {
        const semitoneShift = this.transposeManager.getFingeringSystemShift(previousSystem, newSystem);

        if (semitoneShift === 0) {
            return;
        }

        const transposedAbc = this.transposeManager.transpose(this.notationParser.currentAbc, semitoneShift);

        if (transposedAbc !== this.notationParser.currentAbc) {
            this.notationParser.currentAbc = transposedAbc;
            console.log(`Auto-transposed ${semitoneShift > 0 ? 'up' : 'down'} ${Math.abs(semitoneShift)} semitones when switching from ${previousSystem} to ${newSystem}`);
        }
    }

    /**
     * Toggles the display of fingering diagrams
     * @returns {boolean} Whether fingering diagrams are now shown
     */
    toggleFingeringDisplay() {
        this.fingeringManager.showFingering = !this.fingeringManager.showFingering;
        this.settingsManager.set('fingeringVisible', this.fingeringManager.showFingering);

        if (this.fingeringManager.showFingering) {
            this.showFingeringDiagrams();
        } else {
            this.hideFingeringDiagrams();
        }

        // Update marker zone z-indexes after toggling
        this.updateMarkerZoneZIndexes();

        return this.fingeringManager.showFingering;
    }

    /**
     * Updates the z-index of marker zones based on fingering visibility
     */
    updateMarkerZoneZIndexes() {
        const markerZones = document.querySelectorAll('.note-marker-zone');
        markerZones.forEach(zone => {
            if (this.fingeringManager.showFingering) {
                zone.style.zIndex = '5'; // Lower when fingering diagrams are visible
            } else {
                zone.style.zIndex = '15'; // Higher when fingering diagrams are hidden
            }
        });
    }


    /**
     * Shows fingering diagrams
     */
    showFingeringDiagrams() {
        const notes = this.notationParser.extractCleanedNotes();
        const abcContainer = document.getElementById('abc-notation');
        this.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
    }

    /**
     * Hides fingering diagrams
     */
    hideFingeringDiagrams() {
        this.diagramRenderer.clearFingeringDiagrams();
    }

    /**
     * Initializes event listeners
     */
    initializeEventListeners() {
        window.addEventListener('DOMContentLoaded', () => {
            // Apply initial settings first, before creating UI controls
            this.applyInitialSettings();
            this.uiControls.createControlElements();
            this.initializeApplication();
            this.setupKeyboardShortcuts();
            this.setupWindowResizeHandler();
            this.mobileUI.setupMobileControls();
            this.swipeHandler.init();
        });
    }

    /**
     * Initializes the application
     */
    initializeApplication() {
        // Set initial state of reference row
        document.getElementById('reference-row').classList.add('hidden');

        // Initialize the application
        this.render();
        setTimeout(() => {
            this.shareManager.loadFromUrlParams();
        }, 100);
        this.fingeringManager.populateReferenceRow();
        
        // Check initial constant metronome mode
        this.uiControls.checkConstantMetronomeMode();
    }

    /**
     * Sets up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        const handleKeyEvent = (event) => {
            if (event.ctrlKey && !event.shiftKey && !event.altKey) {
                if (event.key === 'c' && !window.getSelection().toString()) {
                    event.preventDefault();
                    this.copyToClipboard();
                } else if (event.key === 'v') {
                    event.preventDefault();
                    this.pasteFromClipboard();
                }
            } else if (event.key === ' ' && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                const target = event.target;
                const isInputField = target.tagName === 'INPUT' ||
                                   target.tagName === 'TEXTAREA' ||
                                   (target.contentEditable && target.contentEditable !== 'false');

                if (!isInputField || target.tagName === 'BODY') {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.type === 'keydown') {
                        this.midiPlayer.togglePlay();
                    }
                    return false;
                }
            } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
                       !event.ctrlKey && !event.shiftKey && !event.altKey) {
                const target = event.target;
                const isInputField = target.tagName === 'INPUT' ||
                                   target.tagName === 'TEXTAREA' ||
                                   (target.contentEditable && target.contentEditable !== 'false');

                if (!isInputField || target.tagName === 'BODY') {
                    event.preventDefault();
                    if (event.type === 'keydown') {
                        if (event.key === 'ArrowLeft') {
                            // Left arrow - previous tune
                            this.tuneManager.previousTune();
                            this.render();
                            this.tuneNavigation.updateTuneCountDisplay();
                        } else if (event.key === 'ArrowRight') {
                            // Right arrow - next tune
                            this.tuneManager.nextTune();
                            this.render();
                            this.tuneNavigation.updateTuneCountDisplay();
                        }
                    }
                    return false;
                }
            }
        };

        document.addEventListener('keydown', handleKeyEvent, true);
        document.addEventListener('keyup', handleKeyEvent, true);
    }

    /**
     * Sets up window resize handler
     */
    setupWindowResizeHandler() {
        let lastWidth = window.innerWidth;
        
        window.addEventListener('resize', Utils.debounce(() => {
            const currentWidth = window.innerWidth;
            
            // Only re-render if this is a significant resize
            if (this.renderManager.isSignificantResize(lastWidth, currentWidth)) {
                // Capture current annotation states
                const savedStates = this.renderManager.captureAnnotationStates();
                
                // Trigger full re-render with new dimensions
                this.render();
                
                // Restore annotation states after render completes
                setTimeout(() => {
                    this.renderManager.restoreAnnotationStates(savedStates);
                }, 150);
                
                lastWidth = currentWidth;
            } else {
                // For minor resizes, just reposition fingering diagrams
                if (this.fingeringManager.showFingering) {
                    this.showFingeringDiagrams();
                }
            }
        }, 300)); // Increased debounce time for full re-render operations
    }

    /**
     * Applies initial settings from SettingsManager
     */
    applyInitialSettings() {
        // Set fingering visibility
        this.fingeringManager.showFingering = this.settingsManager.get('fingeringVisible');

        // Set fingering style
        const fingeringStyle = this.settingsManager.get('fingeringStyle');
        this.fingeringManager.setFingeringSystem(fingeringStyle);

        // Apply initial transposition if starting with dizi fingering
        // This ensures the default ABC notation is transposed down 3 semitones
        // when the app loads with dizi as the saved fingering system
        if (fingeringStyle === 'diziD') {
            this.applyAutoTransposition('baroque', 'diziD');
        }

        // Set playback settings
        this.midiPlayer.playbackSettings.voicesOn = this.settingsManager.get('voicesOn');
        this.midiPlayer.playbackSettings.chordsOn = this.settingsManager.get('chordsOn');
        this.midiPlayer.playbackSettings.metronomeOn = this.settingsManager.get('metronomeOn');

        // TEMP FIX: Force loop to always be false on load to prevent localStorage issues
        this.midiPlayer.playbackSettings.loopEnabled = false;
        console.log('FORCED loopEnabled to false to prevent issues');

        // Auto-scroll is now automatic based on screen size (no need to load from settings)

        console.log('Initial playback settings loaded:');
        console.log('  voicesOn:', this.midiPlayer.playbackSettings.voicesOn);
        console.log('  chordsOn:', this.midiPlayer.playbackSettings.chordsOn);
        console.log('  metronomeOn:', this.midiPlayer.playbackSettings.metronomeOn);
        console.log('  loopEnabled:', this.midiPlayer.playbackSettings.loopEnabled);

        // Update UI to reflect initial settings
        this.uiControls.updateFingeringButtons();
        this.uiControls.updatePlaybackButtons();
    }
}