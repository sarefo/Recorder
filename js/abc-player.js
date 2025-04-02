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

        // Initialize UI handlers
        this.initializeEventListeners();

        this.shareManager = new ShareManager(this);
    }

    render() {
        try {
            const abcContainer = document.getElementById('abc-notation');
            this.diagramRenderer.clearFingeringDiagrams();

            // Add click handler
            const clickListener = (abcElem, tuneNumber, classes) => {
                this.handleNoteClick(abcElem);
            };

            const visualObj = ABCJS.renderAbc("abc-notation", this.notationParser.currentAbc, {
                responsive: "resize",
                add_classes: true,
                staffwidth: window.innerWidth - 60,
                stafftopmargin: this.renderConfig.stafftopmargin,
                staffbottommargin: this.renderConfig.staffbottommargin,
                oneSvgPerLine: this.renderConfig.oneSvgPerLine,
                scale: this.renderConfig.scale,
                clickListener: clickListener
            })[0];

            // Store the visualObj for later use
            this.currentVisualObj = visualObj;

            // Initialize MIDI player
            this.midiPlayer.init(visualObj);

            // Add fingering diagrams after rendering if enabled
            if (this.fingeringManager.showFingering) {
                setTimeout(() => {
                    const notes = this.notationParser.extractNotesFromAbc();
                    this.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
                }, 100);
            }
            if (this.shareManager) {
                this.shareManager.updateUrlDebounced();
            }
        } catch (error) {
            console.error("Error in render:", error);
        }
    }

    handleNoteClick(abcElem) {
        // Only handle actual notes
        if (abcElem.el_type !== "note" || !this.midiPlayer.midiPlayer) {
            return;
        }

        // Find the start milliseconds for this note
        const startMs = abcElem.currentTrackMilliseconds || abcElem.midiStartTime * 1000;
        if (startMs === undefined) {
            console.warn("Could not determine start time for note");
            return;
        }

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

    async copyToClipboard() {
        return Utils.copyToClipboard(this.notationParser.currentAbc);
    }

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

    toggleFingeringSystem() {
        const newSystem = this.fingeringManager.toggleFingeringSystem();
        this.render();
        // Update the reference row
        this.fingeringManager.populateReferenceRow();
        return newSystem;
    }

    toggleFingeringDisplay() {
        this.fingeringManager.showFingering = !this.fingeringManager.showFingering;
        if (this.fingeringManager.showFingering) {
            const notes = this.notationParser.extractNotesFromAbc();
            const abcContainer = document.getElementById('abc-notation');
            this.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
        } else {
            this.diagramRenderer.clearFingeringDiagrams();
        }
        return this.fingeringManager.showFingering;
    }

    initializeEventListeners() {
        window.addEventListener('DOMContentLoaded', () => {
            // Create a main container for controls
            const controlContainer = document.createElement('div');
            controlContainer.className = 'control-container';

            // Create MIDI status display
            const midiStatus = document.createElement('div');
            midiStatus.id = 'midi-status';

            // Create the control bar
            const controlBar = document.createElement('div');
            controlBar.className = 'control-bar';

            // 1. Fingering Controls Section
            const fingeringSection = this.createFingeringControlsSection();

            // 2. Notation Controls Section
            const notationSection = this.createNotationControlsSection();

            // 3. Playback Controls Section
            const playbackSection = this.createPlaybackControlsSection();

            // Add sections to control bar
            controlBar.appendChild(fingeringSection);
            controlBar.appendChild(notationSection);
            controlBar.appendChild(playbackSection);

            // Add control elements to the document
            controlContainer.appendChild(midiStatus);
            controlContainer.appendChild(controlBar);

            // Insert at the beginning of the body
            document.body.insertBefore(controlContainer, document.body.firstChild);

            // Set initial state of reference row
            document.getElementById('reference-row').style.display = 'none';

            // Initialize the application
            this.render();
            setTimeout(() => {
                this.shareManager.loadFromUrlParams();
            }, 100);
            this.fingeringManager.populateReferenceRow();

            // Set up keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Handle window resize
            this.setupWindowResizeHandler();
        });
    }

    createFingeringControlsSection() {
        const fingeringSection = document.createElement('div');
        fingeringSection.className = 'control-section fingering-controls';

        // Fingering display toggle
        const fingeringDisplayToggle = document.createElement('button');
        fingeringDisplayToggle.id = 'show-fingering';
        fingeringDisplayToggle.textContent = 'Hide Fingering';
        fingeringDisplayToggle.title = 'Show/hide fingering diagrams';
        fingeringDisplayToggle.addEventListener('click', () => {
            const showFingering = this.toggleFingeringDisplay();
            fingeringDisplayToggle.textContent = showFingering ? 'Hide Fingering' : 'Show Fingering';
        });

        // Fingering system toggle
        const systemToggle = document.createElement('button');
        systemToggle.id = 'system-toggle';
        systemToggle.title = 'Toggle Baroque/German Fingering';
        systemToggle.textContent = 'German';
        systemToggle.addEventListener('click', () => {
            const newSystem = this.toggleFingeringSystem();
            systemToggle.textContent = newSystem === 'baroque' ? 'Baroque' : 'German';
        });

        // Chart toggle
        const chartToggle = document.createElement('button');
        chartToggle.id = 'chart-toggle';
        chartToggle.title = 'Show/Hide Reference Chart';
        chartToggle.innerHTML = '&#43;'; // Plus sign
        chartToggle.addEventListener('click', () => {
            this.toggleReferenceRow();
        });

        const chartLabel = document.createElement('span');
        chartLabel.className = 'minimize-label';
        chartLabel.textContent = 'Chart';

        const chartContainer = document.createElement('div');
        chartContainer.className = 'minimize-controls';
        chartContainer.appendChild(chartLabel);
        chartContainer.appendChild(chartToggle);

        fingeringSection.appendChild(fingeringDisplayToggle);
        fingeringSection.appendChild(systemToggle);
        fingeringSection.appendChild(chartContainer);

        return fingeringSection;
    }

    createNotationControlsSection() {
        const notationSection = document.createElement('div');
        notationSection.className = 'control-section notation-controls';

        // Clipboard controls
        const copyButton = document.createElement('button');
        copyButton.id = 'copy-button';
        copyButton.title = 'Copy ABC notation (Ctrl+C)';
        copyButton.textContent = 'To Clipboard';
        copyButton.addEventListener('click', () => {
            this.copyToClipboard();
        });

        const pasteButton = document.createElement('button');
        pasteButton.id = 'paste-button';
        pasteButton.title = 'Paste ABC notation (Ctrl+V)';
        pasteButton.textContent = 'From Clipboard';
        pasteButton.addEventListener('click', () => {
            this.pasteFromClipboard();
        });

        // Transpose controls
        const transposeUpButton = document.createElement('button');
        transposeUpButton.id = 'transpose-up';
        transposeUpButton.title = 'Transpose up';
        transposeUpButton.textContent = '▲';
        transposeUpButton.addEventListener('click', () => {
            this.transpose('up');
        });

        const transposeDownButton = document.createElement('button');
        transposeDownButton.id = 'transpose-down';
        transposeDownButton.title = 'Transpose down';
        transposeDownButton.textContent = '▼';
        transposeDownButton.addEventListener('click', () => {
            this.transpose('down');
        });

        // Share button
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

        notationSection.appendChild(copyButton);
        notationSection.appendChild(pasteButton);
        notationSection.appendChild(transposeUpButton);
        notationSection.appendChild(transposeDownButton);
        notationSection.appendChild(shareButton);

        return notationSection;
    }

    createPlaybackControlsSection() {
        const playbackSection = document.createElement('div');
        playbackSection.className = 'control-section playback-controls';

        // Play and restart buttons
        const playButton = document.createElement('button');
        playButton.id = 'play-button';
        playButton.title = 'Play/Pause';
        playButton.textContent = '▶';
        playButton.addEventListener('click', () => {
            this.midiPlayer.togglePlay();
        });

        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.title = 'Restart';
        restartButton.textContent = '⟳';
        restartButton.addEventListener('click', () => {
            this.midiPlayer.restart();
        });

        // Toggle buttons
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

        // Tempo control
        const tempoControl = document.createElement('div');
        tempoControl.className = 'tempo-control';

        const tempoLabel = document.createElement('label');
        tempoLabel.textContent = 'Tempo:';

        const tempoSlider = document.createElement('input');
        tempoSlider.type = 'range';
        tempoSlider.id = 'tempo-slider';
        tempoSlider.min = '50';
        tempoSlider.max = '200';
        tempoSlider.value = '100';
        tempoSlider.title = 'Adjust playback speed';

        const tempoValue = document.createElement('span');
        tempoValue.id = 'tempo-value';
        tempoValue.className = 'tempo-value';
        tempoValue.textContent = '100%';

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

        tempoControl.appendChild(tempoLabel);
        tempoControl.appendChild(tempoSlider);
        tempoControl.appendChild(tempoValue);

        playbackSection.appendChild(playButton);
        playbackSection.appendChild(restartButton);
        playbackSection.appendChild(chordsToggle);
        playbackSection.appendChild(voicesToggle);
        playbackSection.appendChild(metronomeToggle);
        playbackSection.appendChild(tempoControl);

        return playbackSection;
    }

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

    setupWindowResizeHandler() {
        window.addEventListener('resize', Utils.debounce(() => {
            if (this.fingeringManager.showFingering) {
                const notes = this.notationParser.extractNotesFromAbc();
                const abcContainer = document.getElementById('abc-notation');
                this.diagramRenderer.addFingeringDiagrams(abcContainer, notes);
            }
        }, 150));
    }
}
