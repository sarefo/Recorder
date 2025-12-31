/**
 * AbcPreview - Renders and plays ABC notation using ABCJS
 */

import { showFeedback } from '../core/utils.js';

export class AbcPreview {
    constructor(app) {
        this.app = app;
        this.visualObj = null;
        this.synth = null;
        this.synthControl = null;
        this.isPlaying = false;
    }

    /**
     * Render ABC notation
     * @param {string} abc - ABC notation string
     */
    render(abc) {
        const container = document.getElementById('abc-notation-preview');
        if (!container || !window.ABCJS) {
            console.error('ABCJS or container not available');
            return;
        }

        try {
            // Clear previous content
            container.innerHTML = '';

            // Render the ABC notation
            this.visualObj = ABCJS.renderAbc(container, abc, {
                responsive: 'resize',
                add_classes: true,
                staffwidth: container.clientWidth - 40,
                wrap: {
                    minSpacing: 1.5,
                    maxSpacing: 2.5,
                    preferredMeasuresPerLine: 4
                }
            })[0];

        } catch (error) {
            console.error('Failed to render ABC:', error);
            container.innerHTML = '<p class="error">Failed to render notation</p>';
        }
    }

    /**
     * Play ABC notation using ABCJS synth
     * @param {string} abc - ABC notation string
     */
    async play(abc) {
        if (!window.ABCJS) {
            showFeedback('ABCJS not loaded');
            return;
        }

        try {
            // Stop any existing playback
            this.stop();

            // Create audio context if needed (requires user interaction)
            if (!window.AudioContext) {
                window.AudioContext = window.AudioContext ||
                    window.webkitAudioContext ||
                    navigator.mozAudioContext ||
                    navigator.msAudioContext;
            }

            const audioContext = new window.AudioContext();
            await audioContext.resume();

            // Create new synth for each playback
            if (ABCJS.synth.supportsAudio()) {
                this.synth = new ABCJS.synth.CreateSynth();
            } else {
                showFeedback('Audio playback not supported');
                return;
            }

            // Parse and render if not already done
            if (!this.visualObj) {
                const tempContainer = document.createElement('div');
                this.visualObj = ABCJS.renderAbc(tempContainer, abc)[0];
            }

            // Create cursor control for playback events
            const cursorControl = {
                onStart: () => {
                    console.log('ABC playback started');
                },
                onFinished: () => {
                    console.log('ABC playback finished');
                    this.isPlaying = false;
                    this._updatePlayButton(false);
                },
                onEvent: (event) => {
                    // Could highlight notes here in the future
                }
            };

            // Initialize the synth with cursor control
            await this.synth.init({
                audioContext: audioContext,
                visualObj: this.visualObj,
                options: {
                    soundFontUrl: 'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/',
                    program: 73  // Flute sound
                }
            });

            // Create timing callbacks for playback events
            const timingCallbacks = new ABCJS.TimingCallbacks(this.visualObj, {
                eventCallback: cursorControl.onEvent
            });

            // Prime the audio
            await this.synth.prime();

            // Update state
            this.isPlaying = true;
            cursorControl.onStart();

            // Start playback
            this.synth.start();
            timingCallbacks.start();

        } catch (error) {
            console.error('Failed to play ABC:', error);
            showFeedback('Playback failed: ' + error.message);
            this.isPlaying = false;
        }
    }

    /**
     * Stop ABC playback
     */
    stop() {
        if (this.synth && this.isPlaying) {
            this.synth.stop();
            this.isPlaying = false;
        }
    }

    /**
     * Toggle playback
     * @param {string} abc - ABC notation string
     */
    async toggle(abc) {
        if (this.isPlaying) {
            this.stop();
        } else {
            await this.play(abc);
        }
    }

    /**
     * Check if currently playing
     * @returns {boolean} True if playing
     */
    isCurrentlyPlaying() {
        return this.isPlaying;
    }

    /**
     * Get the rendered visual object
     * @returns {Object} ABCJS visual object
     */
    getVisualObj() {
        return this.visualObj;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        this.visualObj = null;
        this.synth = null;
    }
}
