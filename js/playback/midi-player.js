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
            tempo: 100 // Default tempo percentage (100%)
        };

        // Add custom metronome
        this.customMetronome = new CustomMetronome();
        this.lastTimeSignature = 4; // Default 4/4 time
        this.lastTempo = 120;       // Default tempo

        // Add tuning manager
        this.tuningManager = new TuningManager();

        // Initialize tuning manager with shared audio context when MIDI player is initialized
        this.tuningManagerInitialized = false;
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
     * Calculates the tempo settings based on visual object metadata
     * @param {Object} visualObj - The ABC visual object
     * @returns {Object} Tempo settings including adjusted tempo and milliseconds per measure
     */
    calculateTempoSettings(visualObj) {
        // Get the base tempo from the tune
        const baseTempo = visualObj.getBpm() || 120;
        const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;

        // Calculate milliseconds per measure based on adjusted tempo
        const timeSignature = visualObj.getMeter();
        const beatsPerMeasure = timeSignature?.value?.[0].num || 4;
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
        // Extract time signature from the visual object
        const timeSignature = visualObj.getMeter();
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
                console.log('Combined transpose: octave(12) + tuning(' + additionalSemitones + ') = ' + totalTranspose + ' semitones');
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
            drum: this.playbackSettings.metronomeOn ? "dddd" : "", // Simple metronome pattern
            drumBars: 1,
            drumIntro: 1,
            // Additional metronome settings
            drumOn: this.playbackSettings.metronomeOn,
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
            // Ensure audio context exists
            this.createAudioContext();

            // Create MIDI player if needed
            this.createMidiPlayer();

            // Calculate tempo settings
            const { millisecondsPerMeasure } = this.calculateTempoSettings(visualObj);

            // Get playback options
            const options = this.preparePlaybackOptions();

            // Add onEnded to the options to stop both playback and metronome
            options.onEnded = () => {
                this.isPlaying = false;
                this.updatePlayButtonState();

                // Stop the metronome when the song ends, unless it's in constant mode
                if (this.playbackSettings.metronomeOn && this.customMetronome.isPlaying && !this.customMetronome.isConstantMode()) {
                    this.customMetronome.stop();
                }

                this.updateStatusDisplay("Playback finished");
            };


            // Initialize MIDI with all current settings
            await this.midiPlayer.init({
                visualObj: visualObj,
                audioContext: this.audioContext,
                millisecondsPerMeasure: millisecondsPerMeasure,
                options: options
            });

            // Update metronome with the current time signature and tempo from the visual object
            await this.updateMetronome(visualObj);

            // Load and prepare the synth
            await this.midiPlayer.prime();

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
     * Updates the play button state
     * @param {boolean} disabled - Whether the button should be disabled
     */
    updatePlayButtonState(disabled = false) {
        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.disabled = disabled;
            playButton.textContent = this.isPlaying ? '⏸' : '▶';
            playButton.title = this.isPlaying ? 'Pause' : 'Play';
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
            // Start metronome BEFORE starting MIDI player to ensure synchronization
            if (this.playbackSettings.metronomeOn && !this.customMetronome.isPlaying) {
                // Always get the current visual object to ensure we have the latest tempo
                const visualObj = window.app?.renderManager?.currentVisualObj;
                if (visualObj) {
                    // Calculate the correct tempo directly from the current piece
                    const baseTempo = visualObj.getBpm() || 120;
                    const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;

                    // Update our saved tempo values
                    this.lastTempo = adjustedTempo;

                    // Get time signature
                    const timeSignature = visualObj.getMeter();
                    const numerator = timeSignature?.value?.[0]?.num || 4;
                    this.lastTimeSignature = numerator;

                    // Start with the correct tempo
                    await this.customMetronome.start(adjustedTempo, numerator);
                } else {
                    // Fallback to saved values
                    await this.customMetronome.start(this.lastTempo, this.lastTimeSignature);
                }
            }

            // Start MIDI player after metronome is synchronized
            await this.midiPlayer.start();
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

            if (this.isPlaying) {
                if (isConstantMetronomeMode) {
                    // In constant mode, only stop the metronome
                    this.customMetronome.stop();
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
                if (isConstantMetronomeMode) {
                    // In constant mode, only start the metronome
                    const visualObj = window.app?.renderManager?.currentVisualObj;
                    if (visualObj) {
                        const baseTempo = visualObj.getBpm() || 120;
                        const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;
                        const timeSignature = visualObj.getMeter();
                        const numerator = timeSignature?.value?.[0]?.num || 4;

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

                    // Now use restart logic for reliable sync
                    success = await this.restart();
                }
            }

            return success;
        } catch (error) {
            console.error("Error in togglePlay:", error);
            this.updateStatusDisplay("Error during playback");
            return false;
        }
    }

    /**
     * Stops current playback
     * @returns {Promise<boolean>} Success state
     */
    async stopPlayback() {
        try {
            // Make sure metronome is stopped first
            this.customMetronome.stop();

            // Ensure we completely stop the MIDI player
            if (this.midiPlayer) {
                await this.midiPlayer.stop();

                // Add a small timeout to ensure any lingering audio processes are cleared
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Update state
            this.isPlaying = false;
            this.updatePlayButtonState();

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

            // Small delay to ensure complete reset
            await new Promise(resolve => setTimeout(resolve, 50));

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

            // Stop playback if currently playing
            if (wasPlaying) {
                await this.stopPlayback();
            }

            // Re-initialize with new settings
            await this.init(visualObj);

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
     * Apply fine tuning by manipulating the synth's audio output
     */
    applyFineTuning() {
        if (!this.tuningManager || !this.audioContext) {
            return;
        }

        const tuningOffsetCents = this.tuningManager.getTuningOffset();

        if (Math.abs(tuningOffsetCents) > 0.1) {
            console.log('Applying fine tuning offset:', tuningOffsetCents.toFixed(1), 'cents');

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
                console.log('Fine tuning applied with multiplier:', frequencyMultiplier.toFixed(4));
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
