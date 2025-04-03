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
            const showFingering = this.player.toggleFingeringDisplay();
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
            const newSystem = this.player.toggleFingeringSystem();
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
            this.player.toggleReferenceRow();
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
        copyButton.textContent = 'To Clipboard';

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
        pasteButton.textContent = 'From Clipboard';

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
        chordsToggle.classList.add('active');

        chordsToggle.addEventListener('click', async () => {
            const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                { chordsOn: !this.player.midiPlayer.playbackSettings.chordsOn },
                this.player.renderManager.currentVisualObj
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
            const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                { voicesOn: !this.player.midiPlayer.playbackSettings.voicesOn },
                this.player.renderManager.currentVisualObj
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
            const newSettings = await this.player.midiPlayer.updatePlaybackSettings(
                { metronomeOn: !this.player.midiPlayer.playbackSettings.metronomeOn },
                this.player.renderManager.currentVisualObj
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
            await this.player.midiPlayer.updatePlaybackSettings(
                { tempo: value },
                this.player.renderManager.currentVisualObj
            );
        });
    }
}