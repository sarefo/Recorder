/**
 * UIControls - Handles UI event bindings and interactions
 */

import { showFeedback } from '../core/utils.js';

export class UIControls {
    constructor(app) {
        this.app = app;
    }

    /**
     * Initialize all UI controls and event listeners
     */
    init() {
        this._setupDropZone();
        this._setupNavigationButtons();
        this._setupExportControls();
        this._setupRecordingSettings();
        this._setupTempoControls();
    }

    /**
     * Setup recording settings controls
     * @private
     */
    _setupRecordingSettings() {
        const useTapMarkers = document.getElementById('use-tap-markers');
        const countInHint = document.getElementById('count-in-hint');
        const tapHint = document.getElementById('tap-hint');

        if (useTapMarkers && countInHint) {
            // Update hint when checkbox changes
            useTapMarkers.addEventListener('change', () => {
                if (useTapMarkers.checked) {
                    countInHint.textContent = '1 bar count-in, then recording starts';
                    if (tapHint) tapHint.classList.remove('hidden');
                } else {
                    countInHint.textContent = '2 bars count-in, then recording starts';
                    if (tapHint) tapHint.classList.add('hidden');
                }
            });
        }
    }

    /**
     * Setup file drop zone
     * @private
     */
    _setupDropZone() {
        // Tab switching
        const uploadTab = document.getElementById('tab-upload');
        const recordTab = document.getElementById('tab-record');
        const uploadSection = document.getElementById('upload-section');
        const recordSection = document.getElementById('record-section');

        if (uploadTab && recordTab) {
            uploadTab.addEventListener('click', () => {
                uploadTab.classList.add('active');
                recordTab.classList.remove('active');
                uploadSection.classList.remove('hidden');
                recordSection.classList.add('hidden');
            });

            recordTab.addEventListener('click', () => {
                recordTab.classList.add('active');
                uploadTab.classList.remove('active');
                recordSection.classList.remove('hidden');
                uploadSection.classList.add('hidden');
            });
        }

        // File upload
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        if (!dropZone || !fileInput) return;

        // Click to open file picker
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // File selected via picker
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.app.loadAudio(file);
            }
        });

        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                this.app.loadAudio(file);
            } else {
                showFeedback('Please drop an audio file');
            }
        });

        // Recording button
        const recordBtn = document.getElementById('btn-record');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => {
                this.app.toggleRecording();
            });
        }
    }

    /**
     * Setup navigation buttons between steps
     * @private
     */
    _setupNavigationButtons() {
        // Step 1: Run detection (goes to review after)
        const runDetection = document.getElementById('btn-run-detection');
        if (runDetection) {
            runDetection.addEventListener('click', () => {
                this.app.runDetection();
            });
        }

        // Step 2 → Step 1
        const backToLoad = document.getElementById('btn-back-to-load');
        if (backToLoad) {
            backToLoad.addEventListener('click', () => {
                this.app.workflowManager.showStep('load');
            });
        }
    }

    /**
     * Setup tempo up/down controls
     * @private
     */
    _setupTempoControls() {
        // Recording tempo controls
        const recordTempo = document.getElementById('record-tempo');
        const recordTempoUp = document.getElementById('record-tempo-up');
        const recordTempoDown = document.getElementById('record-tempo-down');

        if (recordTempo && recordTempoUp && recordTempoDown) {
            recordTempoUp.addEventListener('click', () => {
                const currentValue = parseInt(recordTempo.value) || 120;
                const newValue = Math.min(240, currentValue + 10);
                recordTempo.value = newValue;
            });

            recordTempoDown.addEventListener('click', () => {
                const currentValue = parseInt(recordTempo.value) || 120;
                const newValue = Math.max(40, currentValue - 10);
                recordTempo.value = newValue;
            });
        }

        // ABC tempo controls
        const abcTempo = document.getElementById('abc-tempo');
        const abcTempoUp = document.getElementById('abc-tempo-up');
        const abcTempoDown = document.getElementById('abc-tempo-down');

        if (abcTempo && abcTempoUp && abcTempoDown) {
            abcTempoUp.addEventListener('click', () => {
                const currentValue = parseInt(abcTempo.value) || 120;
                const newValue = Math.min(240, currentValue + 10);
                abcTempo.value = newValue;
                // Trigger change event to update ABC
                abcTempo.dispatchEvent(new Event('change'));
            });

            abcTempoDown.addEventListener('click', () => {
                const currentValue = parseInt(abcTempo.value) || 120;
                const newValue = Math.max(40, currentValue - 10);
                abcTempo.value = newValue;
                // Trigger change event to update ABC
                abcTempo.dispatchEvent(new Event('change'));
            });
        }
    }

    /**
     * Setup export controls
     * @private
     */
    _setupExportControls() {
        // ABC settings changes → regenerate both preview and output
        const settingsInputs = [
            'abc-title', 'abc-tempo', 'abc-meter', 'abc-key', 'chk-g-recorder'
        ];
        settingsInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    this.app.updateAbcPreview(); // Update inline preview
                    this.app.generateAbc();      // Update text output
                });
            }
        });

        // Parse ABC
        const parseBtn = document.getElementById('btn-parse-abc');
        if (parseBtn) {
            parseBtn.addEventListener('click', () => {
                this.app.parseAbc();
            });
        }

        // Copy to clipboard
        const copyBtn = document.getElementById('btn-copy-abc');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.app.copyAbc();
            });
        }

        // Download
        const downloadBtn = document.getElementById('btn-download-abc');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.app.downloadAbc();
            });
        }

        // Open in Recorder
        const recorderBtn = document.getElementById('btn-open-recorder');
        if (recorderBtn) {
            recorderBtn.addEventListener('click', () => {
                this.app.openInRecorder();
            });
        }
    }
}
