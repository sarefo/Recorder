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
            redColor: 'rgba(255, 0, 0, 0.6)',
            greenColor: 'rgba(0, 128, 0, 0.6)',
        };

        // Initialize sub-modules
        this.notationParser = new NotationParser();
        this.tuneManager = new TuneManager(this);
        this.fingeringManager = new FingeringManager(this.fingeringConfig);
        this.transposeManager = new TransposeManager();
        this.midiPlayer = new MidiPlayer();
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

        // Handle mobile control toggle
        this.isMobile = window.innerWidth <= 768;
        this.controlsCollapsed = this.isMobile; // Start collapsed on mobile
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

        try {
            // Get current ABC and normalize line endings to LF (\n)
            const currentAbc = this.notationParser.currentAbc.replace(/\r\n/g, '\n');
            //console.log("Current ABC before transposition (normalized):", currentAbc);

            // Create a hidden div for transposition
            let tempDiv = document.getElementById('transposition-temp');
            if (!tempDiv) {
                tempDiv = document.createElement('div');
                tempDiv.id = 'transposition-temp';
                tempDiv.className = 'temp-hidden';
                document.body.appendChild(tempDiv);
            }

            // Create a fresh visual object with normalized ABC
            const freshVisualObj = ABCJS.renderAbc(tempDiv.id, currentAbc, {
                generateDownload: false,
                generateInline: false
            });

            // Use the fresh visual object for transposition
            let transposedAbc = ABCJS.strTranspose(
                currentAbc,  // Use normalized ABC
                freshVisualObj,
                semitoneShift
            );

            //console.log("Transposed ABC:", transposedAbc);

            // Ensure a final newline after the key line if needed
            if (!transposedAbc.match(/K:.*\n/)) {
                transposedAbc = transposedAbc.replace(/(K:.*?)([A-Ga-g])/, '$1\n$2');
            }

            // Update the stored ABC notation with the transposed string
            this.notationParser.currentAbc = transposedAbc;

            // Re-render the notation
            this.render();
        } catch (error) {
            console.error("Transposition error:", error);
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
     * Toggles between baroque and German fingering systems
     * @returns {string} The new fingering system
     */
    toggleFingeringSystem() {
        const newSystem = this.fingeringManager.toggleFingeringSystem();
        this.render();
        // Update the reference row
        this.fingeringManager.populateReferenceRow();
        return newSystem;
    }

    /**
     * Toggles the display of fingering diagrams
     * @returns {boolean} Whether fingering diagrams are now shown
     */
    toggleFingeringDisplay() {
        this.fingeringManager.showFingering = !this.fingeringManager.showFingering;

        if (this.fingeringManager.showFingering) {
            this.showFingeringDiagrams();
        } else {
            this.hideFingeringDiagrams();
        }

        return this.fingeringManager.showFingering;
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
            }
        };

        document.addEventListener('keydown', handleKeyEvent, true);
        document.addEventListener('keyup', handleKeyEvent, true);
    }

    /**
     * Sets up window resize handler
     */
    setupWindowResizeHandler() {
        window.addEventListener('resize', Utils.debounce(() => {
            if (this.fingeringManager.showFingering) {
                this.showFingeringDiagrams();
            }
        }, 150));
    }
}