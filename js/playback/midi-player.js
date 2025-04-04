/**
 * Manages MIDI playback functionality with enhanced controls
 */
class MidiPlayer {
    constructor() {
        this.midiPlayer = null;
        this.isPlaying = false;
        this.audioContext = null;
        this.playbackSettings = {
            chordsOn: true,
            voicesOn: true,
            metronomeOn: false,
            tempo: 100 // Default tempo percentage (100%)
        };

        // Add custom metronome
        this.customMetronome = new CustomMetronome();
        this.lastTimeSignature = 4; // Default 4/4 time
        this.lastTempo = 120;       // Default tempo
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

            // Add event listener for when playback ends
            this.midiPlayer.onEnded = () => {
                this.isPlaying = false;
                this.updatePlayButtonState();
            };
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
        const baseTempo = visualObj.metaText?.tempo?.qpm || 120;
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
    updateMetronome(visualObj) {
        // Extract time signature from the visual object
        const timeSignature = visualObj.getMeter();
        const numerator = timeSignature?.value?.[0]?.num || 4;

        // Extract tempo from the visual object
        const baseTempo = visualObj.metaText?.tempo?.qpm || 120;
        const adjustedTempo = Math.round((baseTempo * this.playbackSettings.tempo) / 100);

        // Update saved values
        this.lastTimeSignature = numerator;
        this.lastTempo = adjustedTempo;

        // Update metronome if it's running
        if (this.customMetronome.isPlaying) {
            this.customMetronome.setTimeSignature(numerator);
            this.customMetronome.setTempo(adjustedTempo);
        }
    }

    /**
     * Prepares playback options based on current settings
     * @returns {Object} MIDI playback options
     */
    preparePlaybackOptions() {
        return {
            program: 73, // Flute instrument (MIDI program 73)
            midiTranspose: 0,
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

            // Update metronome settings based on visual object
            this.updateMetronome(visualObj);

            // Get playback options
            const options = this.preparePlaybackOptions();

            // Initialize MIDI with all current settings
            await this.midiPlayer.init({
                visualObj: visualObj,
                audioContext: this.audioContext,
                millisecondsPerMeasure: millisecondsPerMeasure,
                options: options
            });

            // Load and prepare the synth
            await this.midiPlayer.prime();

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
            if (this.isPlaying) {
                success = await this.pausePlayback();

                // Also stop metronome if it's on
                if (this.playbackSettings.metronomeOn) {
                    this.customMetronome.stop();
                }
            } else {
                success = await this.startPlayback();

                // Start metronome if it's enabled
                if (this.playbackSettings.metronomeOn) {
                    this.customMetronome.start(this.lastTempo, this.lastTimeSignature);
                }
            }

            if (success) {
                this.isPlaying = !this.isPlaying;
                this.updatePlayButtonState();
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
            await this.midiPlayer.stop();
            this.isPlaying = false;
            this.updatePlayButtonState();

            // Also stop metronome
            this.customMetronome.stop();

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

            // Stop current playback
            const stopSuccess = await this.stopPlayback();
            if (!stopSuccess) return false;

            // Stop metronome
            this.customMetronome.stop();

            // Start from beginning
            const startSuccess = await this.startPlayback();

            // Start metronome if enabled
            if (startSuccess && this.playbackSettings.metronomeOn) {
                this.customMetronome.start(this.lastTempo, this.lastTimeSignature);
            }

            if (startSuccess) {
                this.isPlaying = true;
                this.updatePlayButtonState();
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
            const previousMetronomeState = this.playbackSettings.metronomeOn;

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
                this.customMetronome.stop();
            }

            // Re-initialize with new settings
            await this.init(visualObj);

            // Handle metronome state changes
            if (previousMetronomeState !== this.playbackSettings.metronomeOn) {
                if (this.playbackSettings.metronomeOn) {
                    // Metronome was just turned on
                    console.log("Metronome turned ON");
                } else {
                    // Metronome was just turned off
                    console.log("Metronome turned OFF");
                    this.customMetronome.stop();
                }
            }

            // Resume playback if it was playing before
            if (wasPlaying) {
                await this.startPlayback();

                // Restart metronome if enabled
                if (this.playbackSettings.metronomeOn) {
                    this.customMetronome.start(this.lastTempo, this.lastTimeSignature);
                }

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

}
