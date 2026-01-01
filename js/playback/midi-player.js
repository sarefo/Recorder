/**
 * Manages MIDI playback functionality with enhanced controls
 */
class MidiPlayer {
    constructor() {
        this.midiPlayer = null;
        this.isPlaying = false;
        this.audioContext = null;
        this.playbackSettings = {
            chordsOn: false,
            voicesOn: false,
            metronomeOn: true,
            tempo: 100, // Default tempo percentage (100%)
            loopEnabled: false // Loop playback when song ends
        };

        // Add custom metronome
        this.customMetronome = new CustomMetronome();
        this.lastTimeSignature = 4; // Default 4/4 time
        this.lastTempo = 120;       // Default tempo

        // Add tuning manager
        this.tuningManager = new TuningManager();

        // Initialize tuning manager with shared audio context when MIDI player is initialized
        this.tuningManagerInitialized = false;

        // Track onEnded callback to prevent duplicates
        this.onEndedCallbackActive = false;

        // Track whether this is the first play (for count-in bar)
        // First play always gets count-in, loop repeats don't
        this.isFirstPlay = true;

        // Track whether the current synth was initialized with count-in
        // Used for gapless looping - need to reinitialize once to remove count-in
        this.synthHasCountIn = false;

        // Auto-scroll manager reference (will be set by AbcPlayer)
        this.autoScrollManager = null;

        // Track preparation delay state and timeout
        this.isPreparingToPlay = false;
        this.preparationTimeout = null;
        this.preparationDelayMs = 2000; // 2-second delay before playback starts
    }

    /**
     * Creates the audio context
     */
    createAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    /**
     * Creates the MIDI player instance
     */
    createMidiPlayer() {
        if (!this.midiPlayer) {
            this.midiPlayer = new ABCJS.synth.CreateSynth();

        }
        return this.midiPlayer;
    }

    /**
     * Destroys current MIDI player and creates a new one
     * This prevents callback conflicts when reinitializing
     */
    recreateMidiPlayer() {
        // Clean up existing player
        if (this.midiPlayer) {
            try {
                // Stop any ongoing playback
                this.midiPlayer.stop();
            } catch (e) {
                // Ignore errors during cleanup
            }
        }
        
        // Create new player
        this.midiPlayer = new ABCJS.synth.CreateSynth();
        return this.midiPlayer;
    }

    /**
     * Calculates the tempo settings based on visual object metadata
     * @param {Object} visualObj - The ABC visual object
     * @returns {Object} Tempo settings including adjusted tempo and milliseconds per measure
     */
    calculateTempoSettings(visualObj) {
        // Validate that visualObj has the required methods
        if (!visualObj || typeof visualObj.getBpm !== 'function') {
            console.warn('Visual object missing getBpm method, using defaults');
            const adjustedTempo = (120 * this.playbackSettings.tempo) / 100;
            return {
                adjustedTempo,
                millisecondsPerMeasure: (60000 * 4) / adjustedTempo
            };
        }

        // Get the base tempo from the tune
        const baseTempo = visualObj.getBpm() || 120;
        const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;

        // Calculate milliseconds per measure based on adjusted tempo
        const timeSignature = visualObj.getMeter?.() || null;
        let beatsPerMeasure = timeSignature?.value?.[0]?.num || 4;

        // For compound time (6/8, 9/8, 12/8), the beat is the dotted quarter (3 eighths),
        // not individual eighth notes, so divide by 3 to get actual beats per measure
        if (timeSignature?.value?.[0]) {
            const numerator = parseInt(timeSignature.value[0].num);
            const denominator = parseInt(timeSignature.value[0].den);
            if (numerator % 3 === 0 && denominator === 8 && numerator > 3) {
                beatsPerMeasure = numerator / 3; // e.g., 6/8 → 2 beats, 9/8 → 3 beats
            }
        }

        const millisecondsPerMeasure = (60000 * beatsPerMeasure) / adjustedTempo;

        return {
            adjustedTempo,
            millisecondsPerMeasure
        };
    }


    /**
    * Updates metronome settings based on visual object data
    * @param {Object} visualObj - The ABC visual object
    */
    async updateMetronome(visualObj) {
        // Validate visual object
        if (!visualObj || typeof visualObj.getBpm !== 'function') {
            console.warn('Visual object missing required methods for metronome, using defaults');
            const adjustedTempo = (120 * this.playbackSettings.tempo) / 100;
            this.lastTempo = adjustedTempo;
            this.lastTimeSignature = 4;
            return;
        }

        // Extract time signature from the visual object
        const timeSignature = visualObj.getMeter?.();
        const numerator = timeSignature?.value?.[0]?.num || 4;

        // Extract tempo from the visual object (same method as MIDI)
        const baseTempo = visualObj.getBpm() || 120;
        const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;

        // Update saved values
        this.lastTimeSignature = numerator;
        this.lastTempo = adjustedTempo;

        // Update metronome if it's running
        if (this.customMetronome.isPlaying) {
            this.customMetronome.setTimeSignature(numerator);
            // Only update tempo if it's different to avoid unnecessary restarts
            if (this.customMetronome.tempo !== adjustedTempo) {
                await this.customMetronome.setTempo(adjustedTempo);
            }
        } else {
            // Always update the metronome's internal tempo value when not playing
            this.customMetronome.tempo = adjustedTempo;
        }
    }

    /**
     * Prepares playback options based on current settings
     * @returns {Object} MIDI playback options
     */
    preparePlaybackOptions() {
        // Start with base octave transpose for recorder range
        let totalTranspose = 12; // Base octave up (12 semitones)

        // Add fine tuning if available (convert cents to semitones)
        if (this.tuningManager) {
            const tuningOffsetCents = this.tuningManager.getTuningOffset();
            if (Math.abs(tuningOffsetCents) > 5) { // Only apply if significant offset
                const additionalSemitones = Math.round(tuningOffsetCents / 100);
                totalTranspose += additionalSemitones;
            }
        }

        const options = {
            // https://en.wikipedia.org/wiki/General_MIDI#Program_change_events
            program: 13, // Marimba for melody/voices
            // program: 73, // Flute instrument (MIDI program 73)
            chordprog: 106, // chords: Electric Piano 1 
            bassprog: 34, // bass notes (first beat): electric bass
            midiTranspose: totalTranspose,
            chordsOff: !this.playbackSettings.chordsOn,
            voicesOff: !this.playbackSettings.voicesOn,
            drum: "", // Disable ABCJS drum - using CustomMetronome instead
            drumBars: 1,
            drumIntro: 0, // No ABCJS drum intro - CustomMetronome handles count-in
            // Additional metronome settings
            drumOn: false, // Disable ABCJS drum - using CustomMetronome instead
            //soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
            // Define specific drum sounds
            preferredDrum: "hi-hat", // Options: "bass-drum", "snare-drum", "hi-hat", "tambourine", "woodblock"
            // Set volume levels for different beats
            staccato: 0.3,
            beatAccents: [0.75, 0.5, 0.5, 0.5]  // Accent patterns: first beat gets more emphasis
        };


        return options;
    }

    /**
     * Initializes the MIDI player with the provided visual object
     * @param {Object} visualObj - The ABC visual object
     * @returns {Promise<boolean>} Success state
     */
    async init(visualObj) {
        try {
            // Validate visual object before proceeding
            if (!visualObj || typeof visualObj !== 'object') {
                console.error('Invalid visual object provided to MIDI player');
                this.updateStatusDisplay("Error: Invalid music data");
                return false;
            }

            // Check if visual object has the required structure for MIDI playback
            if (!visualObj.lines || !Array.isArray(visualObj.lines) || visualObj.lines.length === 0) {
                console.warn('Visual object missing required lines array for MIDI playback');
                this.updateStatusDisplay("No playable content found");
                return false;
            }

            // Ensure audio context exists
            this.createAudioContext();

            // Create MIDI player if needed
            this.createMidiPlayer();

            // Calculate tempo settings
            const { millisecondsPerMeasure } = this.calculateTempoSettings(visualObj);

            // Get playback options
            const options = this.preparePlaybackOptions();

            // Add onEnded callback to handle playback completion
            options.onEnded = () => this._handlePlaybackEnded();


            // Initialize MIDI with all current settings
            try {
                await this.midiPlayer.init({
                    visualObj: visualObj,
                    audioContext: this.audioContext,
                    millisecondsPerMeasure: millisecondsPerMeasure,
                    options: options
                });
                // Synth no longer has count-in (handled by CustomMetronome externally)
                this.synthHasCountIn = false;
            } catch (synthError) {
                console.error('ABCJS synth initialization failed:', synthError);
                this.updateStatusDisplay("MIDI playback not available for this tune");
                return false;
            }

            // Update metronome with the current time signature and tempo from the visual object
            await this.updateMetronome(visualObj);

            // Load and prepare the synth
            try {
                await this.midiPlayer.prime();
            } catch (primeError) {
                console.error('MIDI player prime failed:', primeError);
                this.updateStatusDisplay("MIDI initialization failed");
                return false;
            }

            // Initialize auto-scroll manager if available
            if (this.autoScrollManager) {
                // Pass the adjusted tempo so auto-scroll timing matches playback
                const baseTempo = visualObj.getBpm ? visualObj.getBpm() : 120;
                const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;
                // No count-in in MIDI synth (handled externally by CustomMetronome)
                this.autoScrollManager.init(visualObj, adjustedTempo, false);
            }

            // Initialize tuning manager with shared audio context
            if (!this.tuningManagerInitialized) {
                await this.tuningManager.init(this.audioContext);
                this.tuningManagerInitialized = true;
            }

            // Apply fine tuning after synth is initialized
            this.applyFineTuning();

            this.updatePlayButtonState(false);
            return true;
        } catch (error) {
            console.error("Error initializing MIDI player:", error);
            this.updateStatusDisplay("Error initializing audio");
            return false;
        }
    }

    /**
     * Initializes the MIDI player with a fresh player instance to prevent callback conflicts
     * @param {Object} visualObj - The ABC visual object
     * @returns {Promise<boolean>} Success state
     */
    async initWithNewPlayer(visualObj) {
        try {
            // Ensure audio context exists
            this.createAudioContext();

            // Recreate MIDI player to prevent callback conflicts
            this.recreateMidiPlayer();

            // Calculate tempo settings
            const { millisecondsPerMeasure } = this.calculateTempoSettings(visualObj);

            // Get playback options
            const options = this.preparePlaybackOptions();

            // Add onEnded callback to handle playback completion
            options.onEnded = () => this._handlePlaybackEnded();

            // Initialize MIDI with all current settings
            await this.midiPlayer.init({
                visualObj: visualObj,
                audioContext: this.audioContext,
                millisecondsPerMeasure: millisecondsPerMeasure,
                options: options
            });
            // Synth no longer has count-in (handled by CustomMetronome externally)
            this.synthHasCountIn = false;

            // Update metronome with the current time signature and tempo from the visual object
            await this.updateMetronome(visualObj);

            // Load and prepare the synth
            await this.midiPlayer.prime();

            // Initialize tuning manager with shared audio context
            if (!this.tuningManagerInitialized) {
                await this.tuningManager.init(this.audioContext);
                this.tuningManagerInitialized = true;
            }

            // Initialize auto-scroll manager if available
            if (this.autoScrollManager) {
                // Pass the adjusted tempo so auto-scroll timing matches playback
                const baseTempo = visualObj.getBpm ? visualObj.getBpm() : 120;
                const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;
                // No count-in in MIDI synth (handled externally by CustomMetronome)
                this.autoScrollManager.init(visualObj, adjustedTempo, false);
            }

            // Apply fine tuning after synth is initialized
            this.applyFineTuning();

            this.updatePlayButtonState(false);
            return true;
        } catch (error) {
            console.error("Error initializing MIDI player with new instance:", error);
            this.updateStatusDisplay("Error initializing audio");
            return false;
        }
    }

    /**
     * Updates the play button state
     * @param {boolean} disabled - Whether the button should be disabled
     */
    updatePlayButtonState(disabled = false) {
        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.disabled = disabled;
            if (this.isPreparingToPlay) {
                playButton.textContent = '⏱';
                playButton.title = 'Preparing to play...';
            } else {
                playButton.textContent = this.isPlaying ? '⏸' : '▶';
                playButton.title = this.isPlaying ? 'Pause' : 'Play';
            }
        }
    }

    /**
     * Updates the status display with a message
     * @param {string} message - Message to display
     */
    updateStatusDisplay(message) {
        const statusEl = document.getElementById('midi-status');
        if (statusEl) {
            statusEl.textContent = message;
            // Auto-hide after 3 seconds if it's not an error
            if (!message.toLowerCase().includes('error')) {
                setTimeout(() => {
                    statusEl.textContent = '';
                }, 3000);
            }
        }
    }

    /**
     * Pauses the current playback
     * @returns {Promise<boolean>} Success state
     */
    async pausePlayback() {
        try {
            await this.midiPlayer.pause();

            // Pause auto-scroll
            if (this.autoScrollManager) {
                this.autoScrollManager.pause();
            }

            this.updateStatusDisplay("Playback paused");
            return true;
        } catch (error) {
            console.error("Error pausing playback:", error);
            return false;
        }
    }

    /**
     * Starts or resumes playback
     * @returns {Promise<boolean>} Success state
     */
    async startPlayback() {
        try {
            // Get the current visual object to calculate tempo and time signature
            const visualObj = window.app?.renderManager?.currentVisualObj;
            let adjustedTempo = this.lastTempo;
            let numerator = this.lastTimeSignature;

            if (visualObj && typeof visualObj.getBpm === 'function') {
                // Calculate the correct tempo directly from the current piece
                const baseTempo = visualObj.getBpm() || 120;
                adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;

                // Update our saved tempo values
                this.lastTempo = adjustedTempo;

                // Get time signature
                const timeSignature = visualObj.getMeter?.();
                numerator = timeSignature?.value?.[0]?.num || 4;
                this.lastTimeSignature = numerator;
            }

            // ALWAYS start metronome for count-in bar (even if metronomeOn is false)
            if (!this.customMetronome.isPlaying && this.isFirstPlay) {
                await this.customMetronome.start(adjustedTempo, numerator);

                // Calculate duration of one measure for count-in
                const secondsPerBeat = 60.0 / adjustedTempo;
                const countInDuration = secondsPerBeat * numerator * 1000; // Convert to milliseconds

                // Wait for count-in bar to complete
                await new Promise(resolve => setTimeout(resolve, countInDuration));

                // After count-in, stop metronome if metronomeOn is false
                if (!this.playbackSettings.metronomeOn) {
                    this.customMetronome.stop();
                }
                // If metronomeOn is true, CustomMetronome keeps running
            } else if (this.playbackSettings.metronomeOn && !this.customMetronome.isPlaying) {
                // Resume case: start metronome if it should be on
                await this.customMetronome.start(adjustedTempo, numerator);
            }

            // Start MIDI player after count-in
            await this.midiPlayer.start();

            // Start timing callbacks for note highlighting (always) and auto-scroll (mobile only)
            if (this.autoScrollManager) {
                this.autoScrollManager.start();
            }

            this.updateStatusDisplay("Playing");

            return true;
        } catch (error) {
            console.error("Error starting playback:", error);
            return false;
        }
    }

    /**
     * Toggles play/pause state
     * @returns {Promise<boolean>} Success state
     */
    async togglePlay() {
        try {
            if (!this.midiPlayer) {
                this.updateStatusDisplay("MIDI player not initialized");
                return false;
            }

            let success;

            // Check if we're in constant metronome mode (only metronome enabled)
            const isConstantMetronomeMode = this.customMetronome.isConstantMode() &&
                this.playbackSettings.metronomeOn &&
                !this.playbackSettings.chordsOn &&
                !this.playbackSettings.voicesOn;

            // Handle canceling preparation if button is pressed during delay
            if (this.isPreparingToPlay) {
                // Cancel the preparation timeout
                if (this.preparationTimeout) {
                    clearTimeout(this.preparationTimeout);
                    this.preparationTimeout = null;
                }
                this.isPreparingToPlay = false;
                this.updatePlayButtonState();
                this.updateStatusDisplay("Playback canceled");
                return true;
            }

            if (this.isPlaying) {
                if (isConstantMetronomeMode) {
                    // In constant mode, stop the metronome and auto-scroll manager
                    this.customMetronome.stop();
                    if (this.autoScrollManager) {
                        this.autoScrollManager.stop();
                    }
                    this.isPlaying = false;
                    this.updatePlayButtonState();
                    success = true;
                } else {
                    // Normal playback mode
                    success = await this.pausePlayback();

                    // Stop metronome if it's on (always stop when pausing playback)
                    if (this.playbackSettings.metronomeOn && this.customMetronome.isPlaying) {
                        this.customMetronome.stop();
                    }

                    if (success) {
                        this.isPlaying = false;
                        this.updatePlayButtonState();
                    }
                }
            } else {
                // Set preparing state and update UI
                this.isPreparingToPlay = true;
                this.updatePlayButtonState();
                this.updateStatusDisplay("Preparing to play...");

                // Wait for 2 seconds before starting playback
                await new Promise((resolve) => {
                    this.preparationTimeout = setTimeout(resolve, this.preparationDelayMs);
                });

                // Check if preparation was canceled during the delay
                if (!this.isPreparingToPlay) {
                    return false;
                }

                // Clear preparation state
                this.isPreparingToPlay = false;
                this.preparationTimeout = null;

                if (isConstantMetronomeMode) {
                    // In constant mode, start metronome and note highlighter
                    const visualObj = window.app?.renderManager?.currentVisualObj;
                    if (visualObj && typeof visualObj.getBpm === 'function') {
                        const baseTempo = visualObj.getBpm() || 120;
                        const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;
                        const timeSignature = visualObj.getMeter?.();
                        const numerator = timeSignature?.value?.[0]?.num || 4;

                        // Initialize and start auto-scroll manager for note highlighting and completion detection
                        if (this.autoScrollManager) {
                            this.autoScrollManager.init(visualObj, adjustedTempo, false);
                            this.autoScrollManager.start();
                        }

                        await this.customMetronome.start(adjustedTempo, numerator);
                        this.isPlaying = true;
                        this.updatePlayButtonState();
                        success = true;
                    } else {
                        // Fallback to default tempo if no visual object
                        await this.customMetronome.start(120, 4);
                        this.isPlaying = true;
                        this.updatePlayButtonState();
                        success = true;
                    }
                } else {
                    // Normal playback mode - ensure proper initialization first
                    // Check if MIDI player needs initialization
                    const visualObj = window.app?.renderManager?.currentVisualObj;
                    if (!this.midiPlayer || !visualObj) {
                        this.updateStatusDisplay("MIDI player not ready");
                        return false;
                    }

                    // Ensure MIDI player is initialized
                    if (!this.midiPlayer.synth) {
                        await this.init(visualObj);
                    }

                    // Use startPlayback for proper resume functionality
                    success = await this.startPlayback();

                    if (success) {
                        this.isPlaying = true;
                        this.updatePlayButtonState();
                    }
                }
            }

            return success;
        } catch (error) {
            console.error("Error in togglePlay:", error);
            this.updateStatusDisplay("Error during playback");
            // Reset preparation state on error
            this.isPreparingToPlay = false;
            if (this.preparationTimeout) {
                clearTimeout(this.preparationTimeout);
                this.preparationTimeout = null;
            }
            this.updatePlayButtonState();
            return false;
        }
    }

    /**
     * Stops current playback
     * @returns {Promise<boolean>} Success state
     */
    async stopPlayback() {
        try {
            // Cancel any pending preparation
            if (this.isPreparingToPlay) {
                if (this.preparationTimeout) {
                    clearTimeout(this.preparationTimeout);
                    this.preparationTimeout = null;
                }
                this.isPreparingToPlay = false;
            }

            // Make sure metronome is stopped first
            this.customMetronome.stop();

            // Stop auto-scroll
            if (this.autoScrollManager) {
                this.autoScrollManager.stop();
            }

            // Ensure we completely stop the MIDI player
            if (this.midiPlayer) {
                await this.midiPlayer.stop();

                // Add a small timeout to ensure any lingering audio processes are cleared
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Update state
            this.isPlaying = false;
            this.updatePlayButtonState();

            // Reset callback flag to prevent it from getting stuck
            this.onEndedCallbackActive = false;

            // Reset isFirstPlay so next playback gets count-in
            this.isFirstPlay = true;

            return true;
        } catch (error) {
            console.error("Error stopping playback:", error);
            return false;
        }
    }

    /**
     * Restarts playback from the beginning
     * @returns {Promise<boolean>} Success state
     */
    async restart() {
        try {
            if (!this.midiPlayer) {
                this.updateStatusDisplay("MIDI player not initialized");
                return false;
            }

            // First, fully stop current playback
            await this.stopPlayback();

            // Ensure everything is reset
            this.isPlaying = false;
            this.updatePlayButtonState();
            this.customMetronome.stop();

            // Reset auto-scroll position for loop restart
            if (this.autoScrollManager) {
                this.autoScrollManager.reset();
            }

            // Small delay to ensure complete reset (minimal for looping)
            await new Promise(resolve => setTimeout(resolve, this.playbackSettings.loopEnabled ? 5 : 50));

            // Start from beginning
            const startSuccess = await this.startPlayback();

            if (startSuccess) {
                // Update playing state
                this.isPlaying = true;
                this.updatePlayButtonState();

                // Note: Metronome is already started by startPlayback() if enabled
                this.updateStatusDisplay("Playback restarted");
            }

            return startSuccess;
        } catch (error) {
            console.error("Error in restart:", error);
            this.updateStatusDisplay("Error restarting playback");
            return false;
        }
    }

    /**
     * Handles playback ended event (shared callback for loop/stop logic)
     * @private
     */
    _handlePlaybackEnded() {
        // Prevent multiple simultaneous callbacks
        if (this.onEndedCallbackActive || !this.isPlaying) {
            return;
        }

        this.onEndedCallbackActive = true;
        this.isPlaying = false;
        this.updatePlayButtonState();

        if (this.playbackSettings.loopEnabled === true) {
            this.isFirstPlay = false;

            // Check if synth was initialized with count-in bar
            // If so, we need to reinitialize once to remove it for gapless looping
            if (this.synthHasCountIn) {
                // First loop iteration: reinitialize synth WITHOUT count-in
                // This has a small delay, but subsequent loops will be gapless
                const visualObj = window.app?.renderManager?.currentVisualObj;
                if (visualObj) {
                    this.initWithNewPlayer(visualObj).then(() => {
                        // Reset and start auto-scroll
                        if (this.autoScrollManager) {
                            this.autoScrollManager.reset();
                            this.autoScrollManager.start();
                        }
                        // Start playback
                        this.midiPlayer.start();
                        this.isPlaying = true;
                        this.updatePlayButtonState();
                        this.onEndedCallbackActive = false;
                    });
                }
            } else {
                // Gapless looping: synth has no count-in, just stop and start
                // Reset auto-scroll position for loop restart
                if (this.autoScrollManager) {
                    this.autoScrollManager.reset();
                    const visualObj = window.app?.renderManager?.currentVisualObj;
                    if (visualObj) {
                        const baseTempo = visualObj.getBpm ? visualObj.getBpm() : 120;
                        const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;
                        this.autoScrollManager.init(visualObj, adjustedTempo, false);
                    }
                }

                // Simply stop (resets to beginning) and start again - no re-priming needed
                this.midiPlayer.stop();
                this.midiPlayer.start();

                // Restart auto-scroll timing
                if (this.autoScrollManager) {
                    this.autoScrollManager.start();
                }

                this.isPlaying = true;
                this.updatePlayButtonState();
                this.onEndedCallbackActive = false;
            }
            // Note: Metronome continues running - don't stop/restart it for seamless rhythm
        } else {
            // Stop the metronome when the song ends, unless it's in constant mode
            if (this.playbackSettings.metronomeOn && this.customMetronome.isPlaying && !this.customMetronome.isConstantMode()) {
                this.customMetronome.stop();
            }
            this.updateStatusDisplay("Playback finished");
            this.onEndedCallbackActive = false;
        }
    }

    /**
     * Updates playback settings and reinitializes if needed
     * @param {Object} settings - New playback settings
     * @param {Object} visualObj - The ABC visual object
     * @returns {Promise<Object>} Updated settings
     */
    async updatePlaybackSettings(settings, visualObj) {
        try {
            // Update the settings
            this.playbackSettings = {
                ...this.playbackSettings,
                ...settings
            };

            // Track current playback state
            const wasPlaying = this.isPlaying;
            const wasLooping = this.playbackSettings.loopEnabled;

            // Temporarily disable looping to prevent restart conflicts during update
            if (wasLooping) {
                this.playbackSettings.loopEnabled = false;
            }

            // Stop playback if currently playing
            if (wasPlaying) {
                await this.stopPlayback();
                // Clear any pending restart attempts
                this.onEndedCallbackActive = false;
            }

            // Re-initialize with new settings - recreate player to prevent callback conflicts
            await this.initWithNewPlayer(visualObj);

            // Restore loop setting
            if (wasLooping) {
                this.playbackSettings.loopEnabled = true;
            }

            // Handle metronome toggle if that setting changed
            if (settings.hasOwnProperty('metronomeOn')) {
                if (!this.playbackSettings.metronomeOn) {
                    // Turning metronome off - always stop, regardless of constant mode
                    if (this.customMetronome.isPlaying) {
                        this.customMetronome.stop();
                    }
                }
                // Note: When turning metronome on, we don't auto-start it
                // It will only start when playback starts
            }

            // Resume playback if it was playing before
            if (wasPlaying) {
                await this.startPlayback();
                this.isPlaying = true;
                this.updatePlayButtonState();
            }

            return this.playbackSettings;
        } catch (error) {
            console.error("Error updating playback settings:", error);
            this.updateStatusDisplay("Error updating playback settings");
            return this.playbackSettings;
        }
    }

    /**
     * Toggles loop mode
     * @param {Object} [player] - The player instance (for saving settings)
     * @returns {Promise<boolean>} The new loop state
     */
    async toggleLoop(player) {
        const wasPlaying = this.isPlaying;

        this.playbackSettings.loopEnabled = !this.playbackSettings.loopEnabled;

        // Save to settings manager if player provided
        if (player && player.settingsManager) {
            player.settingsManager.set('loopEnabled', this.playbackSettings.loopEnabled);
        }

        // Reset isFirstPlay when toggling loop mode (next play will have count-in)
        this.isFirstPlay = true;

        // Reinitialize to apply drumIntro change
        const visualObj = window.app?.renderManager?.currentVisualObj;
        if (visualObj) {
            if (wasPlaying) {
                await this.stopPlayback();
            }
            await this.initWithNewPlayer(visualObj);
            if (wasPlaying) {
                await this.startPlayback();
                this.isPlaying = true;
                this.updatePlayButtonState();
            }
        }

        this.updateStatusDisplay(
            this.playbackSettings.loopEnabled
                ? "Loop: ON (count-in on first play)"
                : "Loop: OFF"
        );
        return this.playbackSettings.loopEnabled;
    }

    /**
     * Apply fine tuning by manipulating the synth's audio output
     */
    applyFineTuning() {
        if (!this.tuningManager || !this.audioContext) {
            return;
        }

        const tuningOffsetCents = this.tuningManager.getTuningOffset();

        if (Math.abs(tuningOffsetCents) > 0.1) {
            // Try to access and modify the synth's audio nodes
            if (this.midiPlayer && this.midiPlayer.audioNode) {
                this.createTuningEffect(tuningOffsetCents);
            } else {
                // If we can't access the audio node directly, store for later application
                this.pendingTuningOffset = tuningOffsetCents;
            }
        }
    }

    /**
     * Create a tuning effect using Web Audio API
     * @param {number} centsOffset - Tuning offset in cents
     */
    createTuningEffect(centsOffset) {
        try {
            // Calculate frequency multiplier
            const frequencyMultiplier = Math.pow(2, centsOffset / 1200);

            // Create a custom audio effect by modifying sample playback rate
            // Note: This is a simplified approach - actual implementation would depend on ABCJS internals
            if (this.audioContext.createScriptProcessor) {
                // Store the multiplier for any custom audio processing
                this.tuningFrequencyMultiplier = frequencyMultiplier;
            }
        } catch (error) {
            console.warn('Could not apply fine tuning:', error);
        }
    }

    /**
     * Get the current tuning frequency multiplier
     * @returns {number} Frequency multiplier
     */
    getTuningMultiplier() {
        return this.tuningFrequencyMultiplier || 1.0;
    }

}
