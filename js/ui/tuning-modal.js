/**
 * Manages the tuning modal UI and functionality
 */
class TuningModal {
    constructor(player) {
        this.player = player;
        this.modal = null;
    }

    /**
     * Creates tuning button
     * @returns {HTMLElement} The tuning button
     */
    createButton() {
        const tuningButton = document.createElement('button');
        tuningButton.id = 'tuning-button';
        tuningButton.title = 'Tune to your instrument';
        tuningButton.textContent = 'Tune';

        tuningButton.addEventListener('click', () => {
            this.show();
        });

        return tuningButton;
    }

    /**
     * Shows the tuning modal
     */
    show() {
        // Check if microphone is supported
        if (!TuningManager.isMicrophoneSupported()) {
            Utils.showFeedback('Microphone not supported on this device');
            return;
        }

        // Create modal if it doesn't exist
        if (!this.modal) {
            this.modal = this._createModal();
            document.body.appendChild(this.modal);
        }

        // Show modal
        this.modal.style.display = 'flex';

        // Initialize tuning if not already done
        this._initialize();
    }

    /**
     * Creates the tuning modal
     * @private
     * @returns {HTMLElement} The tuning modal
     */
    _createModal() {
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
        this._addEventListeners(modal);

        return modal;
    }

    /**
     * Adds event listeners to tuning modal
     * @private
     * @param {HTMLElement} modal - The tuning modal
     */
    _addEventListeners(modal) {
        // Close modal
        modal.querySelector('#tuning-modal-close').addEventListener('click', () => {
            this.close();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });

        // Start tuning
        modal.querySelector('#start-tuning').addEventListener('click', () => {
            this._startTuning();
        });

        // Stop tuning
        modal.querySelector('#stop-tuning').addEventListener('click', () => {
            this._stopTuning();
        });

        // Apply tuning
        modal.querySelector('#apply-tuning').addEventListener('click', () => {
            this._applyTuning();
        });

        // Reset tuning
        modal.querySelector('#reset-tuning').addEventListener('click', () => {
            this._resetTuning();
        });
    }

    /**
     * Initialize tuning functionality
     * @private
     */
    _initialize() {
        const tuningManager = this.player.midiPlayer.tuningManager;

        // Set up tuning update callback
        tuningManager.onTuningUpdate = (data) => {
            this._updateDisplay(data);
        };

        // Update display with current tuning
        this._updateDisplay({
            frequency: null,
            centsOffset: tuningManager.getTuningOffset(),
            smoothedOffset: tuningManager.getTuningOffset(),
            isInTune: Math.abs(tuningManager.getTuningOffset()) <= 5
        });
    }

    /**
     * Start tuning process
     * @private
     */
    async _startTuning() {
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
     * @private
     */
    _stopTuning() {
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
     * @private
     */
    async _applyTuning() {
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
     * @private
     */
    async _resetTuning() {
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
     * @private
     * @param {Object} data - Tuning data
     */
    _updateDisplay(data) {
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
            this._updateDisplay({
                frequency: null,
                smoothedOffset: 0,
                isInTune: true
            });
        }
    }

    /**
     * Close tuning modal
     */
    close() {
        if (this.modal) {
            // Stop tuning if active
            const tuningManager = this.player.midiPlayer.tuningManager;
            if (tuningManager.isListening) {
                tuningManager.stopTuning();
            }

            this.modal.style.display = 'none';
        }
    }
}
