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
            backgroundColor: 'rgba(240, 240, 180, 0.6)',
            redColor: 'rgba(255, 0, 0, 0.6)',
            greenColor: 'rgba(0, 128, 0, 0.6)',
        };

        // Initialize sub-modules
        this.notationParser = new NotationParser();
        this.fingeringManager = new FingeringManager(this.fingeringConfig);
        this.transposeManager = new TransposeManager();
        this.midiPlayer = new MidiPlayer();
        this.diagramRenderer = new DiagramRenderer(this.fingeringManager, this.fingeringConfig);
        this.fileManager = new FileManager(this);

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
        try {
            const abcContainer = document.getElementById('abc-notation');
            this.diagramRenderer.clearFingeringDiagrams();

            // Render the ABC notation
            const visualObj = this.renderAbcNotation();

            // Initialize MIDI player
            this.midiPlayer.init(visualObj);

            // Add fingering diagrams if enabled
            this.renderFingeringDiagrams(abcContainer);

            // Update URL for sharing
            if (this.shareManager) {
                this.shareManager.updateUrlDebounced();
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

        return ABCJS.renderAbc("abc-notation", this.notationParser.currentAbc, {
            responsive: "resize",
            add_classes: true,
            staffwidth: window.innerWidth - 60,
            stafftopmargin: this.renderConfig.stafftopmargin,
            staffbottommargin: this.renderConfig.staffbottommargin,
            oneSvgPerLine: this.renderConfig.oneSvgPerLine,
            scale: this.renderConfig.scale,
            clickListener: clickListener,
            footer: false,          // Footer content set to false
            footerPadding: 0,       // Remove footer padding
            paddingbottom: 0        // Remove bottom padding
        })[0];
    }

    /**
     * Renders fingering diagrams if enabled
     * @param {HTMLElement} abcContainer - The container element
     */
    renderFingeringDiagrams(abcContainer) {
        if (this.fingeringManager.showFingering) {
            setTimeout(() => {
                const notes = this.notationParser.extractNotesFromAbc();
                this.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
            }, 100);
        }
    }

    /**
     * Handles click events on notes
     * @param {Object} abcElem - The ABC element that was clicked
     */
    handleNoteClick(abcElem) {
        // Only handle actual notes
        if (abcElem.el_type !== "note" || !this.midiPlayer.midiPlayer) {
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
        if (this.midiPlayer.isPlaying) {
            this.midiPlayer.midiPlayer.stop();
        }

        // Start from this position
        setTimeout(() => {
            this.midiPlayer.midiPlayer.seek(startMs);
            this.midiPlayer.midiPlayer.start();
            this.midiPlayer.isPlaying = true;
            document.getElementById('play-button').textContent = '⏸';
        }, 100);
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

        // Parse ABC notation
        const sections = this.notationParser.parseAbcSections(this.notationParser.currentAbc);

        // Transpose key if present
        if (sections.key) {
            sections.key = this.transposeManager.transposeKey(sections.key, semitoneShift);
        }

        // Transpose notes
        sections.notes = this.transposeManager.transposeNotes(sections.notes, semitoneShift);

        this.notationParser.currentAbc = this.notationParser.reconstructAbc(sections);
        this.render();
    }

    /**
     * Toggles the reference row visibility
     */
    toggleReferenceRow() {
        const referenceRow = document.getElementById('reference-row');

        // Toggle visibility directly
        if (referenceRow.style.display === 'none') {
            referenceRow.style.display = 'flex';
            document.getElementById('chart-toggle').innerHTML = '&#x2212;'; // Minus sign
        } else {
            referenceRow.style.display = 'none';
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
        const notes = this.notationParser.extractNotesFromAbc();
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
            this.createControlElements();
            this.initializeApplication();
            this.setupKeyboardShortcuts();
            this.setupWindowResizeHandler();
            this.setupMobileControls();
        });
    }

    /**
     * Creates control elements in the DOM
     */
    createControlElements() {
        // Create main container for controls
        const controlContainer = this.createControlContainer();

        // Create MIDI status display
        const midiStatus = this.createMidiStatusDisplay();

        // Create the control bar
        const controlBar = this.createControlBar();

        // Add sections to control bar
        controlBar.appendChild(this.createFingeringControlsSection());
        controlBar.appendChild(this.createNotationControlsSection());
        controlBar.appendChild(this.createPlaybackControlsSection());

        // Add control elements to the document
        controlContainer.appendChild(midiStatus);
        controlContainer.appendChild(controlBar);

        // Insert at the beginning of the body
        document.body.insertBefore(controlContainer, document.body.firstChild);
    }

    /**
     * Creates the main control container
     * @returns {HTMLElement} The control container
     */
    createControlContainer() {
        const container = document.createElement('div');
        container.className = 'control-container';

        // If on mobile, add collapsed class by default
        if (window.innerWidth <= 768) {
            container.classList.add('collapsed');
        }

        return container;
    }

    /**
     * Creates the MIDI status display
     * @returns {HTMLElement} The MIDI status element
     */
    createMidiStatusDisplay() {
        const midiStatus = document.createElement('div');
        midiStatus.id = 'midi-status';
        return midiStatus;
    }

    /**
     * Creates the control bar
     * @returns {HTMLElement} The control bar
     */
    createControlBar() {
        const controlBar = document.createElement('div');
        controlBar.className = 'control-bar';
        return controlBar;
    }

    /**
     * Initializes the application
     */
    initializeApplication() {
        // Set initial state of reference row
        document.getElementById('reference-row').style.display = 'none';

        // Initialize the application
        this.render();
        setTimeout(() => {
            this.shareManager.loadFromUrlParams();
        }, 100);
        this.fingeringManager.populateReferenceRow();
    }

    /**
     * Creates fingering controls section
     * @returns {HTMLElement} The fingering controls section
     */
    createFingeringControlsSection() {
        const fingeringSection = document.createElement('div');
        fingeringSection.className = 'control-section fingering-controls';

        // Add fingering toggle button
        fingeringSection.appendChild(this.createFingeringToggleButton());

        // Add system toggle button
        fingeringSection.appendChild(this.createSystemToggleButton());

        // Add chart container
        fingeringSection.appendChild(this.createChartContainer());

        return fingeringSection;
    }

    /**
     * Creates fingering toggle button
     * @returns {HTMLElement} The fingering toggle button
     */
    createFingeringToggleButton() {
        const fingeringDisplayToggle = document.createElement('button');
        fingeringDisplayToggle.id = 'show-fingering';
        fingeringDisplayToggle.textContent = 'Hide Fingering';
        fingeringDisplayToggle.title = 'Show/hide fingering diagrams';

        fingeringDisplayToggle.addEventListener('click', () => {
            const showFingering = this.toggleFingeringDisplay();
            fingeringDisplayToggle.textContent = showFingering ? 'Hide Fingering' : 'Show Fingering';
        });

        return fingeringDisplayToggle;
    }

    /**
     * Creates system toggle button
     * @returns {HTMLElement} The system toggle button
     */
    createSystemToggleButton() {
        const systemToggle = document.createElement('button');
        systemToggle.id = 'system-toggle';
        systemToggle.title = 'Toggle Baroque/German Fingering';
        systemToggle.textContent = 'German';

        systemToggle.addEventListener('click', () => {
            const newSystem = this.toggleFingeringSystem();
            systemToggle.textContent = newSystem === 'baroque' ? 'Baroque' : 'German';
        });

        return systemToggle;
    }

    /**
     * Creates chart container with toggle button
     * @returns {HTMLElement} The chart container
     */
    createChartContainer() {
        const chartContainer = document.createElement('div');
        chartContainer.className = 'minimize-controls';

        const chartLabel = document.createElement('span');
        chartLabel.className = 'minimize-label';
        chartLabel.textContent = 'Chart';

        const chartToggle = document.createElement('button');
        chartToggle.id = 'chart-toggle';
        chartToggle.title = 'Show/Hide Reference Chart';
        chartToggle.innerHTML = '&#43;'; // Plus sign

        chartToggle.addEventListener('click', () => {
            this.toggleReferenceRow();
        });

        chartContainer.appendChild(chartLabel);
        chartContainer.appendChild(chartToggle);

        return chartContainer;
    }

    /**
     * Creates notation controls section
     * @returns {HTMLElement} The notation controls section
     */
    createNotationControlsSection() {
        const notationSection = document.createElement('div');
        notationSection.className = 'control-section notation-controls';

        // Add clipboard buttons
        notationSection.appendChild(this.createCopyButton());
        notationSection.appendChild(this.createPasteButton());

        // Add transpose buttons
        notationSection.appendChild(this.createTransposeUpButton());
        notationSection.appendChild(this.createTransposeDownButton());

        // Add share button
        notationSection.appendChild(this.createShareButton());

        // Add file selector
        notationSection.appendChild(this.createFileSelector());

        return notationSection;
    }

    createFileSelector() {
        const fileContainer = document.createElement('div');
        fileContainer.className = 'file-controls';

        // Create the selector using our hardcoded list
        const selector = this.fileManager.createFileSelector();
        fileContainer.appendChild(selector);

        return fileContainer;
    }

    /**
     * Creates copy button
     * @returns {HTMLElement} The copy button
     */
    createCopyButton() {
        const copyButton = document.createElement('button');
        copyButton.id = 'copy-button';
        copyButton.title = 'Copy ABC notation (Ctrl+C)';
        copyButton.textContent = 'To Clipboard';

        copyButton.addEventListener('click', () => {
            this.copyToClipboard();
        });

        return copyButton;
    }

    /**
     * Creates paste button
     * @returns {HTMLElement} The paste button
     */
    createPasteButton() {
        const pasteButton = document.createElement('button');
        pasteButton.id = 'paste-button';
        pasteButton.title = 'Paste ABC notation (Ctrl+V)';
        pasteButton.textContent = 'From Clipboard';

        pasteButton.addEventListener('click', () => {
            this.pasteFromClipboard();
        });

        return pasteButton;
    }

    /**
     * Creates transpose up button
     * @returns {HTMLElement} The transpose up button
     */
    createTransposeUpButton() {
        const transposeUpButton = document.createElement('button');
        transposeUpButton.id = 'transpose-up';
        transposeUpButton.title = 'Transpose up';
        transposeUpButton.textContent = '▲';

        transposeUpButton.addEventListener('click', () => {
            this.transpose('up');
        });

        return transposeUpButton;
    }

    /**
     * Creates transpose down button
     * @returns {HTMLElement} The transpose down button
     */
    createTransposeDownButton() {
        const transposeDownButton = document.createElement('button');
        transposeDownButton.id = 'transpose-down';
        transposeDownButton.title = 'Transpose down';
        transposeDownButton.textContent = '▼';

        transposeDownButton.addEventListener('click', () => {
            this.transpose('down');
        });

        return transposeDownButton;
    }

    /**
     * Creates share button
     * @returns {HTMLElement} The share button
     */
    createShareButton() {
        const shareButton = document.createElement('button');
        shareButton.id = 'share-button';
        shareButton.title = 'Create shareable link';
        shareButton.textContent = 'Share';

        shareButton.addEventListener('click', () => {
            this.shareManager.copyShareUrl()
                .then(success => {
                    if (success) {
                        Utils.showFeedback('Share link copied to clipboard!');
                    }
                });
        });

        return shareButton;
    }

    /**
     * Creates playback controls section
     * @returns {HTMLElement} The playback controls section
     */
    createPlaybackControlsSection() {
        const playbackSection = document.createElement('div');
        playbackSection.className = 'control-section playback-controls';

        // Add play and restart buttons
        playbackSection.appendChild(this.createPlayButton());
        playbackSection.appendChild(this.createRestartButton());

        // Add toggle buttons
        playbackSection.appendChild(this.createChordsToggleButton());
        playbackSection.appendChild(this.createVoicesToggleButton());
        playbackSection.appendChild(this.createMetronomeToggleButton());

        // Add tempo control
        playbackSection.appendChild(this.createTempoControl());

        return playbackSection;
    }

    /**
     * Creates play button
     * @returns {HTMLElement} The play button
     */
    createPlayButton() {
        const playButton = document.createElement('button');
        playButton.id = 'play-button';
        playButton.title = 'Play/Pause';
        playButton.textContent = '▶';

        playButton.addEventListener('click', () => {
            this.midiPlayer.togglePlay();
        });

        return playButton;
    }

    /**
     * Creates restart button
     * @returns {HTMLElement} The restart button
     */
    createRestartButton() {
        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.title = 'Restart';
        restartButton.textContent = '⟳';

        restartButton.addEventListener('click', () => {
            this.midiPlayer.restart();
        });

        return restartButton;
    }

    /**
     * Creates chords toggle button
     * @returns {HTMLElement} The chords toggle button
     */
    createChordsToggleButton() {
        const chordsToggle = document.createElement('button');
        chordsToggle.id = 'chords-toggle';
        chordsToggle.title = 'Toggle Chords';
        chordsToggle.textContent = 'Chords';
        chordsToggle.classList.add('active');

        chordsToggle.addEventListener('click', async () => {
            const newSettings = await this.midiPlayer.updatePlaybackSettings(
                { chordsOn: !this.midiPlayer.playbackSettings.chordsOn },
                this.currentVisualObj
            );

            chordsToggle.classList.toggle('active', newSettings.chordsOn);
        });

        return chordsToggle;
    }

    /**
     * Creates voices toggle button
     * @returns {HTMLElement} The voices toggle button
     */
    createVoicesToggleButton() {
        const voicesToggle = document.createElement('button');
        voicesToggle.id = 'voices-toggle';
        voicesToggle.title = 'Toggle Voices';
        voicesToggle.textContent = 'Voices';
        voicesToggle.classList.add('active');

        voicesToggle.addEventListener('click', async () => {
            const newSettings = await this.midiPlayer.updatePlaybackSettings(
                { voicesOn: !this.midiPlayer.playbackSettings.voicesOn },
                this.currentVisualObj
            );

            voicesToggle.classList.toggle('active', newSettings.voicesOn);
        });

        return voicesToggle;
    }

    /**
     * Creates metronome toggle button
     * @returns {HTMLElement} The metronome toggle button
     */
    createMetronomeToggleButton() {
        const metronomeToggle = document.createElement('button');
        metronomeToggle.id = 'metronome-toggle';
        metronomeToggle.title = 'Toggle Metronome';
        metronomeToggle.textContent = 'Metronome';

        metronomeToggle.addEventListener('click', async () => {
            const newSettings = await this.midiPlayer.updatePlaybackSettings(
                { metronomeOn: !this.midiPlayer.playbackSettings.metronomeOn },
                this.currentVisualObj
            );

            metronomeToggle.classList.toggle('active', newSettings.metronomeOn);
        });

        return metronomeToggle;
    }

    /**
     * Creates tempo control
     * @returns {HTMLElement} The tempo control
     */
    createTempoControl() {
        const tempoControl = document.createElement('div');
        tempoControl.className = 'tempo-control';

        // Create label
        const tempoLabel = document.createElement('label');
        tempoLabel.textContent = 'Tempo:';
        tempoControl.appendChild(tempoLabel);

        // Create slider
        const tempoSlider = this.createTempoSlider();
        tempoControl.appendChild(tempoSlider);

        // Create value display
        const tempoValue = document.createElement('span');
        tempoValue.id = 'tempo-value';
        tempoValue.className = 'tempo-value';
        tempoValue.textContent = '100%';
        tempoControl.appendChild(tempoValue);

        // Connect slider to value display
        this.connectTempoSliderEvents(tempoSlider, tempoValue);

        return tempoControl;
    }

    /**
     * Creates tempo slider
     * @returns {HTMLElement} The tempo slider
     */
    createTempoSlider() {
        const tempoSlider = document.createElement('input');
        tempoSlider.type = 'range';
        tempoSlider.id = 'tempo-slider';
        tempoSlider.min = '50';
        tempoSlider.max = '200';
        tempoSlider.value = '100';
        tempoSlider.title = 'Adjust playback speed';

        return tempoSlider;
    }

    /**
     * Connects tempo slider events
     * @param {HTMLElement} tempoSlider - The tempo slider
     * @param {HTMLElement} tempoValue - The tempo value display
     */
    connectTempoSliderEvents(tempoSlider, tempoValue) {
        tempoSlider.addEventListener('input', () => {
            const value = tempoSlider.value;
            tempoValue.textContent = `${value}%`;
        });

        tempoSlider.addEventListener('change', async () => {
            const value = parseInt(tempoSlider.value, 10);
            await this.midiPlayer.updatePlaybackSettings(
                { tempo: value },
                this.currentVisualObj
            );
        });
    }

    /**
     * Sets up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && !event.shiftKey && !event.altKey) {
                if (event.key === 'c' && !window.getSelection().toString()) {
                    event.preventDefault();
                    this.copyToClipboard();
                } else if (event.key === 'v') {
                    event.preventDefault();
                    this.pasteFromClipboard();
                }
            }
        });
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

    setupMobileControls() {
        // Create or get the toggle button
        const toggleButton = this.createMobileToggleButton();

        // Get control container
        const controlContainer = document.querySelector('.control-container');

        // Set up the initial state (properly connected)
        this.updateMobileState();

        // Apply the initial state to both the button and controls
        this.applyMobileState(toggleButton, controlContainer);

        // Click handler to toggle controls
        toggleButton.onclick = () => {
            this.controlsCollapsed = !this.controlsCollapsed;
            this.applyMobileState(toggleButton, controlContainer);
        };

        // Handle screen size changes
        this.setupScreenChangeHandlers(toggleButton, controlContainer);
    }

    // Create the hamburger button
    createMobileToggleButton() {
        let toggleButton = document.getElementById('control-toggle');
        if (!toggleButton) {
            toggleButton = document.createElement('button');
            toggleButton.id = 'control-toggle';
            toggleButton.className = 'control-toggle';
            toggleButton.innerHTML = '<span></span><span></span><span></span>';
            document.body.appendChild(toggleButton);
        }
        return toggleButton;
    }

    // Updated mobile detection logic
    updateMobileState() {
        // Detect mobile devices
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Consider both screen dimensions and device type
        const smallerDimension = Math.min(window.innerWidth, window.innerHeight);

        // Determine if we should use mobile mode
        this.isMobile = isMobileDevice || smallerDimension <= 900;

        // Initialize collapsed state (if not already set)
        if (this.controlsCollapsed === undefined) {
            this.controlsCollapsed = this.isMobile;
        }

        return this.isMobile;
    }

    // Apply the current state to the UI elements
    applyMobileState(toggleButton, controlContainer) {
        if (!toggleButton || !controlContainer) return;

        // Always show/hide toggle based on mobile status
        toggleButton.style.display = this.isMobile ? 'block' : 'none';

        // For desktop: always show controls, never collapsed
        if (!this.isMobile) {
            controlContainer.classList.remove('collapsed');
            controlContainer.classList.remove('mobile-view');
            return;
        }

        // For mobile: handle collapsed state and styling
        controlContainer.classList.add('mobile-view');

        if (this.controlsCollapsed) {
            controlContainer.classList.add('collapsed');
            toggleButton.classList.remove('open');
        } else {
            controlContainer.classList.remove('collapsed');
            toggleButton.classList.add('open');
        }
    }

    // Set up handlers for screen size/orientation changes
    setupScreenChangeHandlers(toggleButton, controlContainer) {
        // Handle window resize
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.updateMobileState();

            // If transitioning between mobile/desktop, reset collapsed state appropriately
            if (wasMobile !== this.isMobile) {
                this.controlsCollapsed = this.isMobile;
            }

            this.applyMobileState(toggleButton, controlContainer);
        });

        // Handle orientation changes specifically
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateMobileState();
                this.applyMobileState(toggleButton, controlContainer);
            }, 100);
        });
    }

    updateMobileState() {
        // Check if this is a mobile device
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Consider both width and device type
        this.isMobile = isMobileDevice || window.innerWidth <= 900; // Increased threshold for landscape

        // Alternative approach: detect by maximum dimension
        const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
        const largerDimension = Math.max(window.innerWidth, window.innerHeight);

        // If it's a phone-sized screen in either dimension, treat as mobile
        if (smallerDimension <= 600 || (isMobileDevice && largerDimension <= 1000)) {
            this.isMobile = true;
        }

        return this.isMobile;
    }

    createMobileToggleButton() {
        let toggleButton = document.getElementById('control-toggle');
        if (!toggleButton) {
            toggleButton = document.createElement('button');
            toggleButton.id = 'control-toggle';
            toggleButton.className = 'control-toggle';
            toggleButton.innerHTML = '<span></span><span></span><span></span>';
            document.body.appendChild(toggleButton);
        }
        return toggleButton;
    }

    initializeMobileControlState(controlContainer) {
        // Check if we're on mobile based on screen width
        this.isMobile = window.innerWidth <= 768;

        // Set initial state - collapsed on mobile, visible on desktop
        this.controlsCollapsed = this.isMobile;

        // Apply initial collapsed state to the DOM
        if (this.controlsCollapsed && controlContainer) {
            controlContainer.classList.add('collapsed');
        } else if (controlContainer) {
            controlContainer.classList.remove('collapsed');
        }
    }

    setupMobileToggleEvents(toggleButton, controlContainer) {
        toggleButton.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent any default behavior

            // Toggle collapsed state
            this.controlsCollapsed = !this.controlsCollapsed;

            // Update UI based on new state
            if (this.controlsCollapsed) {
                controlContainer.classList.add('collapsed');
                toggleButton.classList.remove('open');
            } else {
                controlContainer.classList.remove('collapsed');
                toggleButton.classList.add('open');
            }

            console.log('Toggle clicked, controls collapsed:', this.controlsCollapsed);
        });

        // Set initial button visibility
        toggleButton.style.display = this.isMobile ? 'block' : 'none';
    }

    setupMobileResizeHandler(toggleButton, controlContainer) {
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;

            // Toggle button visibility based on screen size
            toggleButton.style.display = this.isMobile ? 'block' : 'none';

            // Handle transition between desktop and mobile
            if (!wasMobile && this.isMobile) {
                // Switching from desktop to mobile - collapse controls
                this.controlsCollapsed = true;
                controlContainer.classList.add('collapsed');
                toggleButton.classList.remove('open');
            } else if (wasMobile && !this.isMobile) {
                // Switching from mobile to desktop - show controls
                this.controlsCollapsed = false;
                controlContainer.classList.remove('collapsed');
            }
        });
    }
}