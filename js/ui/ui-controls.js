/**
 * Manages UI control creation and handling
 */
class UIControls {
    constructor(player) {
        this.player = player;
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

        // Mobile-specific controls are now in the fingering section

        // Always add playback controls (they will be moved if mobile playback bar is enabled)
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
     * Creates fingering controls section
     * @returns {HTMLElement} The fingering controls section
     */
    createFingeringControlsSection() {
        const fingeringSection = document.createElement('div');
        fingeringSection.className = 'control-section fingering-controls';

        // Add playback toggle button (mobile-only, hidden on desktop via CSS)
        fingeringSection.appendChild(this.createPlaybackToggleButton());

        // Add fingering toggle button
        fingeringSection.appendChild(this.createFingeringToggleButton());

        // Add system toggle button
        fingeringSection.appendChild(this.createSystemToggleButton());

        // Add chart toggle button (simplified)
        fingeringSection.appendChild(this.createChartToggleButton());

        return fingeringSection;
    }

    /**
     * Creates fingering toggle button
     * @returns {HTMLElement} The fingering toggle button
     */
    createFingeringToggleButton() {
        const fingeringDisplayToggle = document.createElement('button');
        fingeringDisplayToggle.id = 'show-fingering';
        fingeringDisplayToggle.textContent = 'Fingering';
        fingeringDisplayToggle.title = 'Show/hide fingering diagrams';
        // Start as inactive since fingering is disabled by default

        fingeringDisplayToggle.addEventListener('click', () => {
            const showFingering = this.player.toggleFingeringDisplay();
            fingeringDisplayToggle.classList.toggle('active', showFingering);
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
            const newSystem = this.player.toggleFingeringSystem();
            systemToggle.textContent = newSystem === 'baroque' ? 'Baroque' : 'German';
        });

        return systemToggle;
    }


    /**
     * Creates chart toggle button (simplified)
     * @returns {HTMLElement} The chart toggle button
     */
    createChartToggleButton() {
        const chartToggle = document.createElement('button');
        chartToggle.id = 'chart-toggle';
        chartToggle.title = 'Show/Hide Reference Chart';
        chartToggle.textContent = 'Chart';

        chartToggle.addEventListener('click', () => {
            const referenceRow = document.getElementById('reference-row');

            // Toggle visibility using CSS classes
            if (referenceRow.classList.contains('hidden')) {
                referenceRow.classList.remove('hidden');
                referenceRow.classList.add('visible-flex');
                chartToggle.classList.add('active');
            } else {
                referenceRow.classList.add('hidden');
                referenceRow.classList.remove('visible-flex');
                chartToggle.classList.remove('active');
            }
        });

        return chartToggle;
    }

    /**
     * Creates playback toggle button for fingering section
     * @returns {HTMLElement} The playback toggle button
     */
    createPlaybackToggleButton() {
        const playbackToggle = document.createElement('button');
        playbackToggle.id = 'playback-toggle-fingering';
        playbackToggle.className = 'playback-toggle-fingering';
        playbackToggle.title = 'Show/hide permanent playback controls';
        playbackToggle.textContent = 'Playback';

        // Set initial active state based on mobile UI setting
        if (this.player.mobileUI && this.player.mobileUI.isPlaybackBarEnabled()) {
            playbackToggle.classList.add('active');
        }

        playbackToggle.addEventListener('click', () => {
            if (this.player.mobileUI) {
                this.player.mobileUI.togglePlaybackBar();
                playbackToggle.classList.toggle('active', this.player.mobileUI.isPlaybackBarEnabled());
            }
        });

        return playbackToggle;
    }

    /**
     * Creates mobile-specific controls section
     * @returns {HTMLElement} The mobile controls section
     */
    createMobileControlsSection() {
        console.log('Creating mobile controls section');
        const mobileSection = document.createElement('div');
        mobileSection.className = 'control-section mobile-controls';

        // Add playback toggle
        const playbackToggle = this.player.mobileUI.createPlaybackToggle();
        mobileSection.appendChild(playbackToggle);

        console.log('Mobile controls section created:', mobileSection);
        return mobileSection;
    }

    /**
     * Updates mobile playback visibility based on toggle state
     */
    updateMobilePlaybackVisibility() {
        // This method is called when the playback toggle changes
        // The playback controls are moved by the MobileUI class
        // We don't need to do anything special here since the controls are moved via DOM manipulation
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

        // REMOVE transpose buttons from here
        // They're now in the playback section

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
        const selector = this.player.fileManager.createFileSelector();

        // Create tune navigation controls
        const tuneNavigation = this.player.tuneNavigation.createTuneNavigationControls();

        fileContainer.appendChild(selector);
        fileContainer.appendChild(tuneNavigation);

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
        copyButton.textContent = 'Copy';

        copyButton.addEventListener('click', () => {
            this.player.copyToClipboard();
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
        pasteButton.textContent = 'Paste';

        pasteButton.addEventListener('click', () => {
            this.player.pasteFromClipboard();
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
            this.player.transpose('up');
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
            this.player.transpose('down');
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
            this.player.shareManager.copyShareUrl()
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

        // Add tuning control
        playbackSection.appendChild(this.createTuningButton());

        // Add transpose buttons - MOVED FROM NOTATION SECTION
        playbackSection.appendChild(this.createTransposeUpButton());
        playbackSection.appendChild(this.createTransposeDownButton());

        // Initialize constant metronome mode based on initial settings
        // Use setTimeout to ensure DOM is fully ready
        setTimeout(() => {
            this.checkConstantMetronomeMode();
        }, 0);

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
            this.player.midiPlayer.togglePlay();

            // If on mobile and starting playback, collapse controls
            if (this.player.isMobile && !this.player.midiPlayer.isPlaying) {
                // We need to wait for togglePlay to update isPlaying
                setTimeout(() => {
                    if (this.player.midiPlayer.isPlaying) {
                        this.player.mobileUI.collapseControls();
                    }
                }, 50);
            }
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
            this.player.midiPlayer.restart();
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
        
        // Set initial active state (chords are OFF by default)
        this.setButtonActiveState(chordsToggle, false);

        chordsToggle.addEventListener('click', async () => {
            const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                { chordsOn: !this.player.midiPlayer.playbackSettings.chordsOn },
                this.player.renderManager.currentVisualObj
            );

            this.setButtonActiveState(chordsToggle, newSettings.chordsOn);
            this.checkConstantMetronomeMode();
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
        
        // Set initial active state (voices are OFF by default)
        this.setButtonActiveState(voicesToggle, false);

        voicesToggle.addEventListener('click', async () => {
            const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                { voicesOn: !this.player.midiPlayer.playbackSettings.voicesOn },
                this.player.renderManager.currentVisualObj
            );

            this.setButtonActiveState(voicesToggle, newSettings.voicesOn);
            this.checkConstantMetronomeMode();
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
        
        // Set initial active state (metronome is ON by default)
        this.setButtonActiveState(metronomeToggle, true);

        metronomeToggle.addEventListener('click', async () => {
            const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                { metronomeOn: !this.player.midiPlayer.playbackSettings.metronomeOn },
                this.player.renderManager.currentVisualObj
            );

            this.setButtonActiveState(metronomeToggle, newSettings.metronomeOn);
        });

        // Set up visual feedback for metronome
        this.setupMetronomeVisualFeedback(metronomeToggle);

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
            await this.player.midiPlayer.updatePlaybackSettings(
                { tempo: value },
                this.player.renderManager.currentVisualObj
            );

            // Force update metronome if it's running
            if (this.player.midiPlayer.playbackSettings.metronomeOn &&
                this.player.midiPlayer.customMetronome.isPlaying) {

                this.player.midiPlayer.customMetronome.setTempo(
                    this.player.midiPlayer.lastTempo
                );
            }
        });
    }

    /**
     * Creates tuning button and modal
     * @returns {HTMLElement} The tuning button
     */
    createTuningButton() {
        const tuningButton = document.createElement('button');
        tuningButton.id = 'tuning-button';
        tuningButton.title = 'Tune to your instrument';
        tuningButton.textContent = 'Tune';

        tuningButton.addEventListener('click', () => {
            this.showTuningModal();
        });

        return tuningButton;
    }

    /**
     * Shows the tuning modal
     */
    showTuningModal() {
        // Check if microphone is supported
        if (!TuningManager.isMicrophoneSupported()) {
            Utils.showFeedback('Microphone not supported on this device');
            return;
        }

        // Create modal if it doesn't exist
        let modal = document.getElementById('tuning-modal');
        if (!modal) {
            modal = this.createTuningModal();
            document.body.appendChild(modal);
        }

        // Show modal
        modal.style.display = 'flex';

        // Initialize tuning if not already done
        this.initializeTuning();
    }

    /**
     * Creates the tuning modal
     * @returns {HTMLElement} The tuning modal
     */
    createTuningModal() {
        const modal = document.createElement('div');
        modal.id = 'tuning-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Tune to Your Instrument</h3>
                    <button class="modal-close" id="tuning-modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="tuning-instructions">
                        <p>Play an A note on your recorder to tune the app to match your sound.</p>
                        <p><small>Note: Recorder A is typically around 880 Hz (an octave above piano A440)</small></p>
                    </div>
                    <div class="tuning-display">
                        <div class="frequency-display">
                            <span class="frequency-label">Frequency:</span>
                            <span class="frequency-value" id="frequency-value">---</span>
                        </div>
                        <div class="cents-display">
                            <span class="cents-label">Offset:</span>
                            <span class="cents-value" id="cents-value">---</span>
                        </div>
                        <div class="tuning-indicator">
                            <div class="tuning-meter">
                                <div class="tuning-needle" id="tuning-needle"></div>
                                <div class="tuning-scale">
                                    <span class="scale-mark">-50</span>
                                    <span class="scale-mark">0</span>
                                    <span class="scale-mark">+50</span>
                                </div>
                            </div>
                            <div class="in-tune-indicator" id="in-tune-indicator">
                                Play A note
                            </div>
                        </div>
                    </div>
                    <div class="tuning-controls">
                        <button id="start-tuning" class="tuning-btn primary">Start Listening</button>
                        <button id="stop-tuning" class="tuning-btn" disabled>Stop</button>
                        <button id="apply-tuning" class="tuning-btn" disabled>Apply Tuning</button>
                        <button id="reset-tuning" class="tuning-btn">Reset to A880</button>
                    </div>
                    <div class="tuning-status" id="tuning-status"></div>
                </div>
            </div>
        `;

        // Add event listeners
        this.addTuningModalEventListeners(modal);

        return modal;
    }

    /**
     * Adds event listeners to tuning modal
     * @param {HTMLElement} modal - The tuning modal
     */
    addTuningModalEventListeners(modal) {
        // Close modal
        modal.querySelector('#tuning-modal-close').addEventListener('click', () => {
            this.closeTuningModal();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTuningModal();
            }
        });

        // Start tuning
        modal.querySelector('#start-tuning').addEventListener('click', () => {
            this.startTuning();
        });

        // Stop tuning
        modal.querySelector('#stop-tuning').addEventListener('click', () => {
            this.stopTuning();
        });

        // Apply tuning
        modal.querySelector('#apply-tuning').addEventListener('click', () => {
            this.applyTuning();
        });

        // Reset tuning
        modal.querySelector('#reset-tuning').addEventListener('click', () => {
            this.resetTuning();
        });
    }

    /**
     * Initialize tuning functionality
     */
    initializeTuning() {
        const tuningManager = this.player.midiPlayer.tuningManager;

        // Set up tuning update callback
        tuningManager.onTuningUpdate = (data) => {
            this.updateTuningDisplay(data);
        };

        // Update display with current tuning
        this.updateTuningDisplay({
            frequency: null,
            centsOffset: tuningManager.getTuningOffset(),
            smoothedOffset: tuningManager.getTuningOffset(),
            isInTune: Math.abs(tuningManager.getTuningOffset()) <= 5
        });
    }

    /**
     * Start tuning process
     */
    async startTuning() {
        try {
            const tuningManager = this.player.midiPlayer.tuningManager;
            await tuningManager.startTuning();

            // Update button states
            document.getElementById('start-tuning').disabled = true;
            document.getElementById('stop-tuning').disabled = false;
            document.getElementById('tuning-status').textContent = 'Listening... Play an A note';

        } catch (error) {
            document.getElementById('tuning-status').textContent = error.message;
            console.error('Error starting tuning:', error);
        }
    }

    /**
     * Stop tuning process
     */
    stopTuning() {
        const tuningManager = this.player.midiPlayer.tuningManager;
        tuningManager.stopTuning();

        // Update button states
        document.getElementById('start-tuning').disabled = false;
        document.getElementById('stop-tuning').disabled = true;
        document.getElementById('apply-tuning').disabled = false;
        document.getElementById('tuning-status').textContent = 'Stopped listening';
    }

    /**
     * Apply current tuning
     */
    async applyTuning() {
        const tuningManager = this.player.midiPlayer.tuningManager;
        const offset = tuningManager.applyTuning();

        // Reinitialize MIDI player with new tuning
        if (this.player.renderManager.currentVisualObj) {
            try {
                await this.player.midiPlayer.init(this.player.renderManager.currentVisualObj);
                document.getElementById('tuning-status').textContent =
                    `Tuning applied: ${offset.toFixed(1)} cents - MIDI reinitialized`;
                Utils.showFeedback(`Tuning applied: ${offset.toFixed(1)} cents`);
            } catch (error) {
                console.error('Error applying tuning:', error);
                document.getElementById('tuning-status').textContent = 'Error applying tuning';
            }
        } else {
            document.getElementById('tuning-status').textContent =
                `Tuning applied: ${offset.toFixed(1)} cents`;
            Utils.showFeedback(`Tuning applied: ${offset.toFixed(1)} cents`);
        }
    }

    /**
     * Reset tuning to A880
     */
    async resetTuning() {
        const tuningManager = this.player.midiPlayer.tuningManager;
        tuningManager.resetTuning();

        // Reinitialize MIDI player with reset tuning
        if (this.player.renderManager.currentVisualObj) {
            try {
                await this.player.midiPlayer.init(this.player.renderManager.currentVisualObj);
                document.getElementById('tuning-status').textContent = 'Reset to A880 - MIDI reinitialized';
                Utils.showFeedback('Tuning reset to A880');
            } catch (error) {
                console.error('Error resetting tuning:', error);
                document.getElementById('tuning-status').textContent = 'Error resetting tuning';
            }
        } else {
            document.getElementById('tuning-status').textContent = 'Reset to A880';
            Utils.showFeedback('Tuning reset to A880');
        }
    }

    /**
     * Update tuning display with current data
     * @param {Object} data - Tuning data
     */
    updateTuningDisplay(data) {
        const frequencyValue = document.getElementById('frequency-value');
        const centsValue = document.getElementById('cents-value');
        const needle = document.getElementById('tuning-needle');
        const indicator = document.getElementById('in-tune-indicator');

        if (data.frequency) {
            frequencyValue.textContent = `${data.frequency.toFixed(1)} Hz`;
        }

        if (data.smoothedOffset !== undefined) {
            const offset = data.smoothedOffset;
            centsValue.textContent = `${offset.toFixed(1)} cents`;

            // Update needle position (-50 to +50 cents range)
            const needlePosition = Math.max(-50, Math.min(50, offset));
            const needlePercent = ((needlePosition + 50) / 100) * 100;
            needle.style.left = `${needlePercent}%`;

            // Update indicator
            if (data.isInTune) {
                indicator.textContent = '✓ In Tune';
                indicator.className = 'in-tune-indicator in-tune';
                document.getElementById('apply-tuning').disabled = false;
            } else if (offset > 0) {
                indicator.textContent = '↑ Too High';
                indicator.className = 'in-tune-indicator out-of-tune-high';
            } else {
                indicator.textContent = '↓ Too Low';
                indicator.className = 'in-tune-indicator out-of-tune-low';
            }
        }

        // Handle special states
        if (data.applied) {
            document.getElementById('tuning-status').textContent = 'Tuning locked in!';
        } else if (data.reset) {
            this.updateTuningDisplay({
                frequency: null,
                smoothedOffset: 0,
                isInTune: true
            });
        }
    }

    /**
     * Close tuning modal
     */
    closeTuningModal() {
        const modal = document.getElementById('tuning-modal');
        if (modal) {
            // Stop tuning if active
            const tuningManager = this.player.midiPlayer.tuningManager;
            if (tuningManager.isListening) {
                tuningManager.stopTuning();
            }

            modal.style.display = 'none';
        }
    }

    /**
     * Sets button active state with inline styles to bypass CSS conflicts
     * @param {HTMLElement} button - The button element
     * @param {boolean} isActive - Whether the button should be active
     */
    setButtonActiveState(button, isActive) {
        // Store the active state on the button for later reference
        button.dataset.isActive = isActive.toString();
        
        // Common base styles for all states to ensure consistent sizing
        const baseStyles = `
            padding: 6px 10px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            white-space: nowrap !important;
            border-width: 1px !important;
            border-style: solid !important;
            box-sizing: border-box !important;
            display: inline-block !important;
            width: auto !important;
            height: auto !important;
            margin: 2px !important;
        `;
        
        if (isActive) {
            button.style.cssText = baseStyles + `
                background-color: #4285f4 !important;
                border-color: #4285f4 !important;
                color: white !important;
            `;
        } else {
            button.style.cssText = baseStyles + `
                background-color: #f8f8f8 !important;
                border-color: #ddd !important;
                color: #333 !important;
            `;
        }
        
        // Force reapply styles after a short delay to override mobile UI interference
        setTimeout(() => this.reapplyButtonStyles(button), 100);
    }

    /**
     * Reapplies button styles to ensure they persist after mobile UI manipulation
     * @param {HTMLElement} button - The button element
     */
    reapplyButtonStyles(button) {
        if (!button.dataset.isActive) return;
        
        const isActive = button.dataset.isActive === 'true';
        this.setButtonActiveState(button, isActive);
    }

    /**
     * Ensures all our toggle buttons maintain their styling after mobile UI changes
     */
    reapplyAllToggleButtonStyles() {
        const buttons = ['chords-toggle', 'voices-toggle', 'metronome-toggle'];
        buttons.forEach(id => {
            const button = document.getElementById(id);
            if (button && button.dataset.isActive !== undefined) {
                this.reapplyButtonStyles(button);
            }
        });
    }

    /**
     * Check if constant metronome mode should be enabled/disabled
     */
    checkConstantMetronomeMode() {
        const settings = this.player.midiPlayer.playbackSettings;
        const shouldEnableConstantMode = !settings.chordsOn && !settings.voicesOn;
        
        // Update metronome constant mode
        if (this.player.midiPlayer.customMetronome) {
            this.player.midiPlayer.customMetronome.setConstantMode(shouldEnableConstantMode);
        }

        // Update visual indicator
        const metronomeButton = document.getElementById('metronome-toggle');
        if (metronomeButton) {
            if (shouldEnableConstantMode && settings.metronomeOn) {
                metronomeButton.classList.add('constant-mode');
                metronomeButton.title = 'Metronome (Constant Mode)';
            } else {
                metronomeButton.classList.remove('constant-mode');
                metronomeButton.title = 'Toggle Metronome';
            }
        }
    }

    /**
     * Set up visual feedback for metronome button
     * @param {HTMLElement} metronomeButton - The metronome button element
     */
    setupMetronomeVisualFeedback(metronomeButton) {
        // Set up visual callback for metronome
        if (this.player.midiPlayer.customMetronome) {
            this.player.midiPlayer.customMetronome.setVisualCallback((isAccented) => {
                // Only show visual feedback if metronome is active
                if (this.player.midiPlayer.playbackSettings.metronomeOn) {
                    // Add visual feedback class
                    metronomeButton.classList.add(isAccented ? 'metronome-beat-accent' : 'metronome-beat');
                    
                    // Remove class after animation
                    setTimeout(() => {
                        metronomeButton.classList.remove('metronome-beat-accent', 'metronome-beat');
                    }, 100);
                }
            });
        }
    }

}