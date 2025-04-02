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
    }

    async init(visualObj) {
        try {
            // Create audio context if it doesn't exist
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Create MIDI player if not exists
            if (!this.midiPlayer) {
                this.midiPlayer = new ABCJS.synth.CreateSynth();

                // Add event listener for when playback ends
                this.midiPlayer.onEnded = () => {
                    this.isPlaying = false;
                    this.updatePlayButtonState();
                };
            }

            // Get the base tempo from the tune
            const baseTempo = visualObj.metaText?.tempo?.qpm || 120;
            const adjustedTempo = (baseTempo * this.playbackSettings.tempo) / 100;

            // Calculate milliseconds per measure based on adjusted tempo
            const timeSignature = visualObj.getMeter();
            const beatsPerMeasure = timeSignature?.value?.[0].num || 4;
            const millisecondsPerMeasure = (60000 * beatsPerMeasure) / adjustedTempo;

            // Initialize MIDI with all current settings
            await this.midiPlayer.init({
                visualObj: visualObj,
                audioContext: this.audioContext,
                millisecondsPerMeasure: millisecondsPerMeasure,
                options: {
                    program: 73, // Flute instrument (MIDI program 73)
                    midiTranspose: 0,
                    chordsOff: !this.playbackSettings.chordsOn,
                    voicesOff: !this.playbackSettings.voicesOn,
                    drum: this.playbackSettings.metronomeOn ? "dddd" : "", // Simple metronome pattern
                    drumBars: 1,
                    drumIntro: 1
                }
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

    updatePlayButtonState(disabled = false) {
        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.disabled = disabled;
            playButton.textContent = this.isPlaying ? '⏸' : '▶';
            playButton.title = this.isPlaying ? 'Pause' : 'Play';
        }
    }

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

    async togglePlay() {
        try {
            if (!this.midiPlayer) {
                this.updateStatusDisplay("MIDI player not initialized");
                return false;
            }

            if (this.isPlaying) {
                await this.midiPlayer.pause();
                this.updateStatusDisplay("Playback paused");
            } else {
                await this.midiPlayer.start();
                this.updateStatusDisplay("Playing");
            }

            this.isPlaying = !this.isPlaying;
            this.updatePlayButtonState();
            return true;
        } catch (error) {
            console.error("Error in togglePlay:", error);
            this.updateStatusDisplay("Error during playback");
            return false;
        }
    }

    async restart() {
        try {
            if (!this.midiPlayer) {
                this.updateStatusDisplay("MIDI player not initialized");
                return false;
            }

            await this.midiPlayer.stop();
            this.isPlaying = false;
            this.updatePlayButtonState();

            await this.midiPlayer.start();
            this.isPlaying = true;
            this.updatePlayButtonState();
            this.updateStatusDisplay("Playback restarted");
            return true;
        } catch (error) {
            console.error("Error in restart:", error);
            this.updateStatusDisplay("Error restarting playback");
            return false;
        }
    }

    async updatePlaybackSettings(settings, visualObj) {
        // Update the settings
        this.playbackSettings = {
            ...this.playbackSettings,
            ...settings
        };

        // If we're currently playing, stop playback
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            await this.midiPlayer.stop();
            this.isPlaying = false;
            this.updatePlayButtonState();
        }

        // Re-initialize with new settings
        await this.init(visualObj);

        // Resume playback if it was playing before
        if (wasPlaying) {
            await this.midiPlayer.start();
            this.isPlaying = true;
            this.updatePlayButtonState();
        }

        return this.playbackSettings;
    }
}
