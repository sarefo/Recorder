/**
 * Manages UI control creation and handling
 */
class UIControls {
    // Timing constants
    static LONG_PRESS_DURATION = 500;
    static STYLE_REAPPLY_DELAY = 100;
    static METRONOME_FLASH_DURATION = 100;

    constructor(player) {
        this.player = player;
        this.tuningModal = new TuningModal(player);
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
        // Playback controls first for consistent ordering across all screen sizes
        controlBar.appendChild(this.createPlaybackControlsSection());
        controlBar.appendChild(this.createFingeringControlsSection());
        controlBar.appendChild(this.createNotationControlsSection());

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

        // Mobile layout is now handled by MobileUI class

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
     * Creates the offline status display
     * @returns {HTMLElement} The offline status element
     */
    createOfflineStatusDisplay() {
        const offlineStatus = document.createElement('div');
        offlineStatus.className = 'offline-status';

        // Create indicator dot
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'offline-indicator online';
        indicator.title = 'Online';

        // Create status text (optional, for desktop)
        const statusText = document.createElement('span');
        statusText.id = 'offline-status-text';
        statusText.textContent = 'Online';

        offlineStatus.appendChild(indicator);
        offlineStatus.appendChild(statusText);

        return offlineStatus;
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

        // Playback toggle button removed - mobile UI now handled differently

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
        fingeringDisplayToggle.title = 'Cycle fingering display: Off → Full → Marked';

        fingeringDisplayToggle.addEventListener('click', () => {
            const mode = this.player.toggleFingeringDisplay();
            this.updateFingeringButtonState(fingeringDisplayToggle, mode);
        });

        return fingeringDisplayToggle;
    }

    /**
     * Updates the fingering button state based on the current mode
     * @param {HTMLElement} button - The fingering button
     * @param {string} mode - The current mode ('off', 'full', or 'marked')
     */
    updateFingeringButtonState(button, mode) {
        // Remove all mode classes
        button.classList.remove('active', 'marked-mode');

        // Update based on mode
        if (mode === 'full') {
            button.classList.add('active');
            button.textContent = 'Fingering';
        } else if (mode === 'marked') {
            button.classList.add('active', 'marked-mode');
            button.textContent = 'Fingering ★';
        } else {
            button.textContent = 'Fingering';
        }
    }

    /**
     * Creates system toggle button with long-press for baroque
     * @returns {HTMLElement} The system toggle button
     */
    createSystemToggleButton() {
        const systemToggle = document.createElement('button');
        systemToggle.id = 'system-toggle';
        systemToggle.title = 'Toggle German/Dizi D Fingering\nHold for Baroque (when German is active)';

        // Set initial text content based on current system
        const currentSystem = this.player.fingeringManager.currentFingeringSystem;
        systemToggle.textContent = this._getSystemDisplayText(currentSystem);

        let longPressTimer = null;
        let isLongPress = false;
        let mousePressed = false;

        // Handle mouse/touch start
        const startPress = () => {
            mousePressed = true;
            isLongPress = false;
            const currentSys = this.player.fingeringManager.currentFingeringSystem;

            // Only allow long press when german or baroque is active
            if (currentSys === 'german' || currentSys === 'baroque') {
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    // Toggle to baroque/german on long press
                    const newSystem = this.player.toggleBaroqueSystem();
                    systemToggle.textContent = this._getSystemDisplayText(newSystem);
                    // Provide haptic feedback if available
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }, UIControls.LONG_PRESS_DURATION);
            }
        };

        // Handle mouse/touch end
        const endPress = (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }

            // Only toggle normally if there was a mouse press AND it wasn't a long press
            if (mousePressed && !isLongPress) {
                const newSystem = this.player.toggleFingeringSystem();
                systemToggle.textContent = this._getSystemDisplayText(newSystem);
            }

            // Reset the pressed state
            mousePressed = false;
        };

        // Add event listeners for both mouse and touch
        systemToggle.addEventListener('mousedown', startPress);
        systemToggle.addEventListener('mouseup', endPress);
        systemToggle.addEventListener('mouseleave', endPress); // Cancel if mouse leaves
        systemToggle.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent mouse events from firing
            startPress();
        });
        systemToggle.addEventListener('touchend', (e) => {
            e.preventDefault(); // Prevent mouse events from firing
            endPress(e);
        });

        return systemToggle;
    }

    /**
     * Gets display text for fingering system
     * @param {string} system - The fingering system name
     * @returns {string} Display text for the system
     * @private
     */
    _getSystemDisplayText(system) {
        switch (system) {
            case 'baroque': return 'Baroque';
            case 'german': return 'German';
            case 'diziD': return '笛子D';
            default: return 'Baroque';
        }
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
        // Auto-scroll toggle removed - now automatic based on screen size

        // Add tempo control (desktop slider)
        playbackSection.appendChild(this.createTempoControl());

        // Add mobile tempo button (hidden on desktop, shown on mobile)
        playbackSection.appendChild(this.createMobileTempoButton());

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

        playButton.addEventListener('click', async () => {
            await this.player.midiPlayer.togglePlay();

            // If on mobile and starting playback, collapse additional controls
            if (this.player.isMobile && this.player.midiPlayer.isPlaying) {
                this.player.mobileUI.collapseControls();
            }
        });

        return playButton;
    }

    /**
     * Creates restart button with loop toggle functionality
     * @returns {HTMLElement} The restart button
     */
    createRestartButton() {
        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        this.updateRestartButtonAppearance(restartButton, false);

        let longPressTimer = null;
        let isLongPress = false;
        let mousePressed = false;
        let lastTouchTime = 0;

        // Handle mouse/touch start
        const startPress = (e) => {
            // Ignore synthetic mouse events after touch events (within 500ms)
            if (e.type === 'mousedown' && Date.now() - lastTouchTime < 500) {
                return;
            }
            mousePressed = true;
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                // Restart on long press
                this.player.midiPlayer.restart();
                // Provide haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }, UIControls.LONG_PRESS_DURATION);
        };

        // Handle mouse/touch end
        const endPress = async (e) => {
            // Ignore synthetic mouse events after touch events (within 500ms)
            if (e && e.type === 'mouseup' && Date.now() - lastTouchTime < 500) {
                return;
            }
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }

            // Toggle loop mode on normal press (if it wasn't a long press)
            if (mousePressed && !isLongPress) {
                const loopEnabled = await this.player.midiPlayer.toggleLoop(this.player);
                this.updateRestartButtonAppearance(restartButton, loopEnabled);
            }

            // Reset the pressed state
            mousePressed = false;
        };

        // Touch start handler - record time to filter synthetic mouse events
        const handleTouchStart = (e) => {
            lastTouchTime = Date.now();
            startPress(e);
        };

        // Touch end handler - record time to filter synthetic mouse events
        const handleTouchEnd = (e) => {
            lastTouchTime = Date.now();
            endPress(e);
        };

        // Add event listeners for both mouse and touch
        restartButton.addEventListener('mousedown', startPress);
        restartButton.addEventListener('mouseup', endPress);
        restartButton.addEventListener('mouseleave', endPress); // Cancel if mouse leaves
        restartButton.addEventListener('touchstart', handleTouchStart, { passive: true });
        restartButton.addEventListener('touchend', handleTouchEnd, { passive: true });

        return restartButton;
    }

    /**
     * Updates restart button appearance based on loop state
     * @param {HTMLElement} button - The restart button
     * @param {boolean} loopEnabled - Whether loop is enabled
     */
    updateRestartButtonAppearance(button, loopEnabled) {
        if (loopEnabled) {
            button.textContent = '↻';
            button.title = 'Loop: ON (click to toggle off)\nHold to restart';
            button.classList.add('loop-active');
        } else {
            button.textContent = '⟳';
            button.title = 'Loop: OFF (click to toggle on)\nHold to restart';
            button.classList.remove('loop-active');
        }
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
        
        // Set initial active state from settings
        this.setButtonActiveState(chordsToggle, this.player.midiPlayer.playbackSettings.chordsOn);

        chordsToggle.addEventListener('click', async () => {
            // Immediately update button state and settings for responsive UI
            const newChordsState = !this.player.midiPlayer.playbackSettings.chordsOn;
            this.player.midiPlayer.playbackSettings.chordsOn = newChordsState;
            this.setButtonActiveState(chordsToggle, newChordsState);
            
            // Update settings in background
            try {
                const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                    { chordsOn: newChordsState },
                    this.player.renderManager.currentVisualObj
                );

                // Save to settings manager
                this.player.settingsManager.set('chordsOn', newSettings.chordsOn);
                
                // Ensure button state matches final result (in case of error)
                this.setButtonActiveState(chordsToggle, newSettings.chordsOn);
                this.checkConstantMetronomeMode();
            } catch (error) {
                console.error('Error updating chords setting:', error);
                // Revert button state and settings on error
                this.player.midiPlayer.playbackSettings.chordsOn = !newChordsState;
                this.setButtonActiveState(chordsToggle, !newChordsState);
            }
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
        
        // Set initial active state from settings
        this.setButtonActiveState(voicesToggle, this.player.midiPlayer.playbackSettings.voicesOn);

        voicesToggle.addEventListener('click', async () => {
            // Immediately update button state and settings for responsive UI
            const newVoicesState = !this.player.midiPlayer.playbackSettings.voicesOn;
            this.player.midiPlayer.playbackSettings.voicesOn = newVoicesState;
            this.setButtonActiveState(voicesToggle, newVoicesState);
            
            // Update settings in background
            try {
                const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                    { voicesOn: newVoicesState },
                    this.player.renderManager.currentVisualObj
                );

                // Save to settings manager
                this.player.settingsManager.set('voicesOn', newSettings.voicesOn);
                
                // Ensure button state matches final result (in case of error)
                this.setButtonActiveState(voicesToggle, newSettings.voicesOn);
                this.checkConstantMetronomeMode();
            } catch (error) {
                console.error('Error updating voices setting:', error);
                // Revert button state and settings on error
                this.player.midiPlayer.playbackSettings.voicesOn = !newVoicesState;
                this.setButtonActiveState(voicesToggle, !newVoicesState);
            }
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
        
        // Set initial active state from settings
        this.setButtonActiveState(metronomeToggle, this.player.midiPlayer.playbackSettings.metronomeOn);

        metronomeToggle.addEventListener('click', async () => {
            const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                { metronomeOn: !this.player.midiPlayer.playbackSettings.metronomeOn },
                this.player.renderManager.currentVisualObj
            );

            // Save to settings manager
            this.player.settingsManager.set('metronomeOn', newSettings.metronomeOn);
            
            this.setButtonActiveState(metronomeToggle, newSettings.metronomeOn);
        });

        // Set up visual feedback for metronome
        this.setupMetronomeVisualFeedback(metronomeToggle);

        return metronomeToggle;
    }

    /**
     * Auto-scroll toggle button removed - auto-scroll is now automatic based on screen size
     * (ON for mobile, OFF for desktop)
     */

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
        tempoLabel.title = 'Click to reset tempo to 100%';
        tempoLabel.style.cursor = 'pointer';
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

        // Add click event to label to reset tempo to 100%
        tempoLabel.addEventListener('click', async () => {
            // Reset slider value
            tempoSlider.value = '100';

            // Update display
            tempoValue.textContent = '100%';

            // Update playback settings
            await this.player.midiPlayer.updatePlaybackSettings(
                { tempo: 100 },
                this.player.renderManager.currentVisualObj
            );

            // Force update metronome if it's running
            if (this.player.midiPlayer.playbackSettings.metronomeOn &&
                this.player.midiPlayer.customMetronome.isPlaying) {

                await this.player.midiPlayer.customMetronome.setTempo(
                    this.player.midiPlayer.lastTempo
                );
            }
        });

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

                await this.player.midiPlayer.customMetronome.setTempo(
                    this.player.midiPlayer.lastTempo
                );
            }
        });
    }

    /**
     * Creates mobile tempo button with full-screen overlay slider
     * @returns {HTMLElement} The mobile tempo button
     */
    createMobileTempoButton() {
        const button = document.createElement('button');
        button.id = 'mobile-tempo-button';
        button.className = 'mobile-tempo-button';
        button.textContent = `${this.player.midiPlayer.playbackSettings.tempo}%`;
        button.title = 'Hold to adjust tempo';

        let pressTimer = null;
        let overlay = null;
        let currentTempo = this.player.midiPlayer.playbackSettings.tempo;

        // Create overlay (hidden by default)
        const createOverlay = () => {
            overlay = document.createElement('div');
            overlay.className = 'tempo-overlay';
            overlay.innerHTML = `
                <div class="tempo-overlay-content">
                    <div class="tempo-overlay-label">Tempo</div>
                    <div class="tempo-overlay-value">${currentTempo}%</div>
                    <div class="tempo-overlay-track">
                        <div class="tempo-overlay-fill" style="width: ${(currentTempo - 50) / 1.5}%"></div>
                        <div class="tempo-overlay-thumb" style="left: ${(currentTempo - 50) / 1.5}%"></div>
                    </div>
                    <div class="tempo-overlay-markers">
                        <span>50%</span>
                        <span>100%</span>
                        <span>200%</span>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            return overlay;
        };

        // Update overlay display
        const updateOverlay = (tempo) => {
            if (!overlay) return;
            const percentage = (tempo - 50) / 1.5;
            overlay.querySelector('.tempo-overlay-value').textContent = `${tempo}%`;
            overlay.querySelector('.tempo-overlay-fill').style.width = `${percentage}%`;
            overlay.querySelector('.tempo-overlay-thumb').style.left = `${percentage}%`;
        };

        // Calculate tempo from touch position
        const getTempoFromTouch = (touchX) => {
            const overlayContent = overlay.querySelector('.tempo-overlay-track');
            const rect = overlayContent.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(100, ((touchX - rect.left) / rect.width) * 100));
            return Math.round(50 + (percentage * 1.5));
        };

        // Handle touch start
        const handleTouchStart = (e) => {
            pressTimer = setTimeout(() => {
                // Long press - show overlay
                if (!overlay) {
                    createOverlay();
                }
                overlay.classList.add('active');
                currentTempo = this.player.midiPlayer.playbackSettings.tempo;
                updateOverlay(currentTempo);

                // Haptic feedback
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }, 200); // 200ms for long press detection
        };

        // Handle touch move (while overlay is active)
        const handleTouchMove = (e) => {
            if (!overlay || !overlay.classList.contains('active')) {
                return;
            }
            e.preventDefault();
            const touch = e.touches[0];
            currentTempo = getTempoFromTouch(touch.clientX);
            updateOverlay(currentTempo);
        };

        // Handle touch end
        const handleTouchEnd = async (e) => {
            const wasShowingOverlay = overlay && overlay.classList.contains('active');

            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }

            if (wasShowingOverlay) {
                // Apply tempo change from overlay
                overlay.classList.remove('active');
                button.textContent = `${currentTempo}%`;

                await this.player.midiPlayer.updatePlaybackSettings(
                    { tempo: currentTempo },
                    this.player.renderManager.currentVisualObj
                );

                // Force update metronome if it's running
                if (this.player.midiPlayer.playbackSettings.metronomeOn &&
                    this.player.midiPlayer.customMetronome.isPlaying) {
                    await this.player.midiPlayer.customMetronome.setTempo(
                        this.player.midiPlayer.lastTempo
                    );
                }
            } else {
                // Quick tap without overlay showing - reset to 100%
                currentTempo = 100;
                button.textContent = '100%';

                await this.player.midiPlayer.updatePlaybackSettings(
                    { tempo: 100 },
                    this.player.renderManager.currentVisualObj
                );

                // Force update metronome if it's running
                if (this.player.midiPlayer.playbackSettings.metronomeOn &&
                    this.player.midiPlayer.customMetronome.isPlaying) {
                    await this.player.midiPlayer.customMetronome.setTempo(
                        this.player.midiPlayer.lastTempo
                    );
                }

                // Haptic feedback for reset
                if (navigator.vibrate) {
                    navigator.vibrate(30);
                }
            }
        };

        // Add event listeners
        button.addEventListener('touchstart', handleTouchStart, { passive: true });
        button.addEventListener('touchmove', handleTouchMove, { passive: false });
        button.addEventListener('touchend', handleTouchEnd);
        button.addEventListener('touchcancel', handleTouchEnd);

        return button;
    }

    /**
     * Creates tuning button
     * @returns {HTMLElement} The tuning button
     */
    createTuningButton() {
        return this.tuningModal.createButton();
    }

    /**
     * Sets button active state using CSS class
     * @param {HTMLElement} button - The button element
     * @param {boolean} isActive - Whether the button should be active
     */
    setButtonActiveState(button, isActive) {
        button.classList.toggle('active', isActive);
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
                    // Add visual feedback class to metronome button
                    metronomeButton.classList.add(isAccented ? 'metronome-beat-accent' : 'metronome-beat');
                    
                    // Add subtle background flash on accented beats only
                    if (isAccented) {
                        document.body.classList.add('metronome-beat-accent');
                    }
                    
                    // Remove classes after animation
                    setTimeout(() => {
                        metronomeButton.classList.remove('metronome-beat-accent', 'metronome-beat');
                        document.body.classList.remove('metronome-beat-accent');
                    }, UIControls.METRONOME_FLASH_DURATION);
                }
            });
        }
    }

    /**
     * Updates fingering buttons to reflect current settings
     */
    updateFingeringButtons() {
        // Update fingering visibility button
        const fingeringButton = document.getElementById('show-fingering');
        if (fingeringButton) {
            this.updateFingeringButtonState(fingeringButton, this.player.fingeringManager.fingeringDisplayMode);
        }

        // Update fingering system button
        const systemButton = document.getElementById('system-toggle');
        if (systemButton) {
            const currentSystem = this.player.fingeringManager.currentFingeringSystem;
            systemButton.textContent = currentSystem === 'baroque' ? 'Baroque' : 'German';
        }
    }

    /**
     * Updates playback buttons to reflect current settings
     */
    updatePlaybackButtons() {
        // Update chords toggle button
        const chordsButton = document.getElementById('chords-toggle');
        if (chordsButton) {
            this.setButtonActiveState(chordsButton, this.player.midiPlayer.playbackSettings.chordsOn);
        }

        // Update voices toggle button
        const voicesButton = document.getElementById('voices-toggle');
        if (voicesButton) {
            this.setButtonActiveState(voicesButton, this.player.midiPlayer.playbackSettings.voicesOn);
        }

        // Update metronome toggle button
        const metronomeButton = document.getElementById('metronome-toggle');
        if (metronomeButton) {
            this.setButtonActiveState(metronomeButton, this.player.midiPlayer.playbackSettings.metronomeOn);
        }

        // Update restart button (loop state)
        const restartButton = document.getElementById('restart-button');
        if (restartButton) {
            this.updateRestartButtonAppearance(restartButton, this.player.midiPlayer.playbackSettings.loopEnabled);
        }
    }

}