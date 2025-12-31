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
        this._setupDetectionControls();
        this._setupExportControls();
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

        // Step 2 → Step 3
        const toExport = document.getElementById('btn-to-export');
        if (toExport) {
            toExport.addEventListener('click', () => {
                this.app.workflowManager.showStep('export');
            });
        }

        // Step 3 → Step 2
        const backToReview = document.getElementById('btn-back-to-review');
        if (backToReview) {
            backToReview.addEventListener('click', () => {
                this.app.workflowManager.showStep('review');
            });
        }
    }

    /**
     * Setup detection settings controls
     * @private
     */
    _setupDetectionControls() {
        // Confidence threshold slider
        const confidenceSlider = document.getElementById('confidence-threshold');
        const confidenceValue = document.getElementById('confidence-value');
        if (confidenceSlider && confidenceValue) {
            confidenceSlider.addEventListener('input', () => {
                confidenceValue.textContent = confidenceSlider.value;
            });
        }

        // Min duration slider
        const durationSlider = document.getElementById('min-duration');
        const durationValue = document.getElementById('duration-value');
        if (durationSlider && durationValue) {
            durationSlider.addEventListener('input', () => {
                durationValue.textContent = durationSlider.value;
            });
        }
    }

    /**
     * Setup export controls
     * @private
     */
    _setupExportControls() {
        // ABC settings changes → regenerate
        const settingsInputs = [
            'abc-title', 'abc-tempo', 'abc-meter', 'abc-key'
        ];
        settingsInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    this.app.generateAbc();
                });
            }
        });

        // Play original button
        const playOriginal = document.getElementById('btn-play-original');
        if (playOriginal) {
            playOriginal.addEventListener('click', () => {
                if (playOriginal.classList.contains('active')) {
                    this.app.stopOriginal();
                    playOriginal.textContent = 'Play Original';
                    playOriginal.classList.remove('active');
                } else {
                    this.app.playOriginal();
                    playOriginal.textContent = 'Stop Original';
                    playOriginal.classList.add('active');
                }
            });
        }

        // Play ABC button
        const playAbc = document.getElementById('btn-play-abc');
        if (playAbc) {
            playAbc.addEventListener('click', () => {
                const abc = document.getElementById('abc-text').value;
                this.app.abcPreview.toggle(abc);
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
