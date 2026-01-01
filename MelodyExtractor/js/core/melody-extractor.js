/**
 * MelodyExtractor - Main application controller
 * Coordinates all modules for melody extraction and ABC transcription
 */

import { AudioLoader } from '../audio/audio-loader.js';
import { PitchDetector } from '../audio/pitch-detector.js';
import { Synth } from '../audio/synth.js';
import { NoteSegmenter } from '../analysis/note-segmenter.js';
import { WaveformManager } from '../visualization/waveform-manager.js';
import { RegionManager } from '../visualization/region-manager.js';
import { PianoRoll } from '../visualization/piano-roll.js';
import { NoteEditor } from '../editor/note-editor.js';
import { AbcGenerator } from '../export/abc-generator.js';
import { AbcParser } from '../export/abc-parser.js';
import { AbcPreview } from '../export/abc-preview.js';
import { WorkflowManager } from '../ui/workflow-manager.js';
import { UIControls } from '../ui/ui-controls.js';
import * as Utils from './utils.js';

export class MelodyExtractor {
    constructor() {
        // Configuration
        this.config = {
            sampleRate: 44100,
            frameSize: 4096,
            hopSize: 256,
            confidenceThreshold: 0.7,
            minNoteDuration: 0.05  // 50ms
        };

        // State
        this.audioBuffer = null;
        this.audioFile = null;
        this.detectedNotes = [];
        this.correctedNotes = [];
        this.isProcessing = false;
        this.recordingStartTime = null;
        this.recordingInterval = null;
        this.tapCheckInterval = null;
        this.tapTimestamps = [];  // User-marked note onsets

        // Initialize modules
        this.audioLoader = new AudioLoader();
        this.pitchDetector = new PitchDetector(this.config);
        this.synth = new Synth();
        this.noteSegmenter = new NoteSegmenter(this.config);
        this.waveformManager = new WaveformManager(this);
        this.regionManager = new RegionManager(this);
        this.pianoRoll = new PianoRoll(this, 'piano-roll');
        this.noteEditor = new NoteEditor(this);
        this.abcGenerator = new AbcGenerator();
        this.abcParser = new AbcParser();
        this.abcPreview = new AbcPreview(this);
        this.workflowManager = new WorkflowManager(this);
        this.uiControls = new UIControls(this);

        // Bind methods
        this.onFileLoaded = this.onFileLoaded.bind(this);
        this.onDetectionComplete = this.onDetectionComplete.bind(this);
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing Melody Extractor...');

        try {
            // Initialize UI controls and event listeners
            this.uiControls.init();
            this.workflowManager.init();

            // Initialize waveform (preview only at first)
            await this.waveformManager.initPreview('waveform-preview');

            console.log('Melody Extractor initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Melody Extractor:', error);
            Utils.showFeedback('Failed to initialize application');
        }
    }

    /**
     * Load an audio file
     * @param {File} file - Audio file to load
     */
    async loadAudio(file) {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.audioFile = file;

            // Load and decode audio
            const audioInfo = await this.audioLoader.loadFile(file);
            this.audioBuffer = audioInfo.buffer;
            this.config.sampleRate = audioInfo.sampleRate;

            // Update UI with audio info
            this.onFileLoaded(audioInfo);

            // Load into waveform preview
            await this.waveformManager.loadAudioBuffer(this.audioBuffer);

            Utils.showFeedback('Audio loaded successfully');

        } catch (error) {
            console.error('Failed to load audio:', error);
            Utils.showFeedback('Failed to load audio file');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Handle file loaded - update UI
     * @param {Object} audioInfo - Audio information
     */
    onFileLoaded(audioInfo) {
        document.getElementById('file-name').textContent = this.audioFile.name;
        document.getElementById('audio-duration').textContent = Utils.formatDuration(audioInfo.duration);
        document.getElementById('sample-rate').textContent = Utils.formatSampleRate(audioInfo.sampleRate);

        document.getElementById('audio-info').classList.remove('hidden');
        document.getElementById('waveform-preview').classList.remove('hidden');
        document.getElementById('btn-run-detection').disabled = false;
    }

    /**
     * Run pitch detection on loaded audio
     */
    async runDetection() {
        if (!this.audioBuffer || this.isProcessing) return;

        try {
            this.isProcessing = true;

            // Show progress
            document.getElementById('detection-progress').classList.remove('hidden');
            document.getElementById('btn-run-detection').disabled = true;

            console.log('Starting detection process...');

            // Get mono audio data
            const audioData = this.audioLoader.getMonoChannel();
            console.log('Got mono channel, length:', audioData.length);

            // Config values are set in constructor (confidenceThreshold: 0.7, minNoteDuration: 0.05)
            console.log('Detection config:', this.config);

            // Initialize pitch detector if needed
            console.log('Initializing pitch detector...');
            await this.pitchDetector.init();
            console.log('Pitch detector initialized');

            // Run detection with progress updates
            console.log('Running pitch detection...');
            const pitchData = await this.pitchDetector.detectPitches(
                audioData,
                this.config.sampleRate,
                (progress) => this.updateProgress(progress)
            );
            console.log('Pitch detection complete, got data:', pitchData);

            // Segment into notes (pass tap timestamps if available)
            console.log('Segmenting notes...');
            if (this.tapTimestamps.length > 0) {
                console.log('Using', this.tapTimestamps.length, 'tap markers for segmentation');
            }
            this.detectedNotes = this.noteSegmenter.segmentNotes(
                pitchData.pitches,
                pitchData.confidences,
                this.config.hopSize,
                this.config.sampleRate,
                this.tapTimestamps  // Pass tap markers
            );
            console.log('Segmented into', this.detectedNotes.length, 'notes');

            // Debug: Log detected notes with frequencies and MIDI
            console.log('\n=== DETECTED NOTES DEBUG ===');
            this.detectedNotes.forEach((note, i) => {
                const frequency = Utils.midiToFrequency(note.midi);
                console.log(`Note ${i + 1}: ${note.noteName} (MIDI ${note.midi}, ${frequency.toFixed(1)} Hz) ` +
                    `@ ${note.startTime.toFixed(2)}s for ${note.duration.toFixed(2)}s, ` +
                    `confidence: ${(note.confidence * 100).toFixed(0)}%`);
            });
            console.log('============================\n');

            // Copy to corrected notes for editing
            this.correctedNotes = JSON.parse(JSON.stringify(this.detectedNotes));

            // Update UI
            this.onDetectionComplete();

        } catch (error) {
            console.error('Detection failed:', error);
            Utils.showFeedback('Pitch detection failed: ' + error.message);

            // Hide progress on error
            document.getElementById('detection-progress').classList.add('hidden');
        } finally {
            this.isProcessing = false;
            document.getElementById('btn-run-detection').disabled = false;
        }
    }

    /**
     * Update detection progress bar
     * @param {number} progress - Progress value (0-1)
     */
    updateProgress(progress) {
        const percent = Math.round(progress * 100);
        document.getElementById('progress-fill').style.width = `${percent}%`;
        document.getElementById('progress-text').textContent =
            `Analyzing audio... ${percent}%`;
    }

    /**
     * Handle detection complete - update UI
     */
    onDetectionComplete() {
        // Calculate statistics
        const noteCount = this.detectedNotes.length;
        const avgConfidence = noteCount > 0
            ? this.detectedNotes.reduce((sum, n) => sum + n.confidence, 0) / noteCount
            : 0;
        const lowConfidenceCount = this.detectedNotes.filter(
            n => n.confidence < this.config.confidenceThreshold
        ).length;

        // Update results display
        document.getElementById('note-count').textContent = noteCount;
        document.getElementById('avg-confidence').textContent =
            `${Math.round(avgConfidence * 100)}%`;
        document.getElementById('low-confidence-count').textContent = lowConfidenceCount;

        // Show detected notes preview
        const previewDiv = document.getElementById('detected-notes-preview');
        if (previewDiv) {
            const notesList = this.detectedNotes
                .map(note => Utils.midiToNoteName(note.midi))
                .join(' → ');
            previewDiv.innerHTML = `
                <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                    <strong>Detected melody:</strong><br>
                    <span style="font-family: monospace; color: #4F4A85;">${notesList}</span>
                </p>
                <p style="font-size: 0.75rem; color: #999; margin-top: 0.5rem;">
                    Check console (F12) for detailed frequency information
                </p>
            `;
        }

        // Show results, hide progress
        document.getElementById('detection-progress').classList.add('hidden');
        document.getElementById('detection-results').classList.remove('hidden');

        Utils.showFeedback(`Detected ${noteCount} notes`);

        // Auto-advance to review step
        setTimeout(() => {
            this.workflowManager.showStep('review');
        }, 1000);
    }

    /**
     * Copy recording settings to music settings
     * @private
     */
    _copyRecordingSettings() {
        const recordTempo = document.getElementById('record-tempo');
        const recordMeter = document.getElementById('record-meter');
        const abcTempo = document.getElementById('abc-tempo');
        const abcMeter = document.getElementById('abc-meter');

        if (recordTempo && abcTempo) {
            abcTempo.value = recordTempo.value;
        }
        if (recordMeter && abcMeter) {
            abcMeter.value = recordMeter.value;
        }
    }

    /**
     * Enter review mode - setup editor waveform and regions
     */
    async enterReviewMode() {
        try {
            console.log('Entering review mode...');

            // Initialize editor waveform if not already
            if (!this.waveformManager.editorWavesurfer) {
                console.log('Initializing editor waveform...');
                await this.waveformManager.initEditor('waveform-editor');
            }

            // Load audio into editor
            console.log('Loading audio into editor...');
            await this.waveformManager.loadAudioBufferToEditor(this.audioBuffer);

            // Display notes as regions
            console.log('Displaying notes as regions...');
            this.regionManager.displayNotes(this.correctedNotes);

            // Initialize piano roll
            console.log('Initializing piano roll...');
            this.pianoRoll.init();
            this.pianoRoll.setNotes(this.correctedNotes, this.audioBuffer.duration);

            // Initialize note editor
            this.noteEditor.init();

            // Attach wavesurfer events after it's ready
            this.noteEditor.attachWavesurferEvents();

            // Copy recording settings to music settings (if they exist)
            this._copyRecordingSettings();

            // Render initial ABC preview and generate output text
            this.updateAbcPreview();
            this.generateAbc();

            console.log('Review mode ready');

        } catch (error) {
            console.error('Failed to enter review mode:', error);
            Utils.showFeedback('Failed to initialize editor');
        }
    }

    /**
     * Generate ABC notation from corrected notes
     */
    generateAbc() {
        // Get settings from UI
        const gRecorderCheckbox = document.getElementById('chk-g-recorder');
        const options = {
            title: document.getElementById('abc-title').value || 'Extracted Melody',
            tempo: parseInt(document.getElementById('abc-tempo').value) || 120,
            meter: document.getElementById('abc-meter').value || '4/4',
            key: document.getElementById('abc-key').value || 'C',
            transpose: gRecorderCheckbox && gRecorderCheckbox.checked ? -12 : 0
        };

        // Generate ABC
        const abc = this.abcGenerator.generate(this.correctedNotes, options);

        // Display in textarea
        document.getElementById('abc-text').value = abc;

        // Note: Preview is rendered via updateAbcPreview() in the unified layout

        return abc;
    }

    /**
     * Update the live ABC preview in the review tab
     * @param {string} selectedNoteId - Optional ID of currently selected note
     */
    updateAbcPreview(selectedNoteId = null) {
        const container = document.getElementById('abc-review-preview');
        if (!container || !window.ABCJS) return;

        // Get settings from unified controls
        const titleInput = document.getElementById('abc-title');
        const tempoInput = document.getElementById('abc-tempo');
        const meterSelect = document.getElementById('abc-meter');
        const keySelect = document.getElementById('abc-key');
        const gRecorderCheckbox = document.getElementById('chk-g-recorder');

        // Generate ABC preview with current settings
        const options = {
            title: titleInput ? titleInput.value : 'Extracted Melody',
            tempo: tempoInput ? parseInt(tempoInput.value) || 120 : 120,
            meter: meterSelect ? meterSelect.value : '4/4',
            key: keySelect ? keySelect.value : 'C',
            transpose: gRecorderCheckbox && gRecorderCheckbox.checked ? -12 : 0
        };

        const abc = this.abcGenerator.generate(this.correctedNotes, options);

        // Update the ABC text textarea
        const textArea = document.getElementById('abc-text');
        if (textArea) {
            textArea.value = abc;
        }

        try {
            container.innerHTML = '';
            ABCJS.renderAbc(container, abc, {
                responsive: 'resize',
                add_classes: true,
                staffwidth: container.clientWidth - 20,
                paddingleft: 0,
                paddingright: 0,
                paddingtop: 0,
                paddingbottom: 0
            });

            // Highlight selected note if any
            if (selectedNoteId) {
                this._highlightAbcNote(container, selectedNoteId);
            }
        } catch (error) {
            console.error('Failed to render ABC preview:', error);
        }
    }

    /**
     * Highlight a note in the ABC preview (public method for selection without re-render)
     * @param {string} noteId - Note ID to highlight (null to clear)
     */
    highlightAbcNote(noteId) {
        const container = document.getElementById('abc-review-preview');
        if (!container) return;
        this._highlightAbcNote(container, noteId);
    }

    /**
     * Highlight a note in the ABC preview
     * @private
     */
    _highlightAbcNote(container, noteId) {
        // Remove any existing highlights
        container.querySelectorAll('.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });

        if (!noteId) return;

        // Find the index of the selected note
        const noteIndex = this.correctedNotes.findIndex(n => n.id === noteId);
        if (noteIndex === -1) return;

        // Get all actual note elements (not rests) - ABCJS marks notes with abcjs-note class
        const noteElements = container.querySelectorAll('.abcjs-note');
        if (noteIndex < noteElements.length) {
            const noteElement = noteElements[noteIndex];
            noteElement.classList.add('highlighted');

            // Scroll into view if needed
            noteElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    /**
     * Copy ABC to clipboard
     */
    async copyAbc() {
        const abc = document.getElementById('abc-text').value;
        const success = await Utils.copyToClipboard(abc);
        Utils.showFeedback(success ? 'Copied to clipboard!' : 'Copy failed');
    }

    /**
     * Download ABC as file
     */
    downloadAbc() {
        const abc = document.getElementById('abc-text').value;
        const title = document.getElementById('abc-title').value || 'melody';
        const filename = title.toLowerCase().replace(/\s+/g, '_') + '.abc';
        Utils.downloadFile(abc, filename, 'text/vnd.abc');
        Utils.showFeedback('Downloaded ' + filename);
    }

    /**
     * Parse ABC notation from text field and update notes
     */
    parseAbc() {
        try {
            const abcText = document.getElementById('abc-text').value;

            if (!abcText || !abcText.trim()) {
                Utils.showFeedback('ABC text is empty');
                return;
            }

            // Validate ABC before parsing
            if (!this.abcParser.isValid(abcText)) {
                Utils.showFeedback('Invalid ABC notation');
                return;
            }

            // Check if G Recorder transpose is currently enabled
            const gRecorderCheckbox = document.getElementById('chk-g-recorder');
            const wasTransposed = gRecorderCheckbox && gRecorderCheckbox.checked;

            // Parse ABC
            const parsed = this.abcParser.parse(abcText);

            if (!parsed.notes || parsed.notes.length === 0) {
                Utils.showFeedback('No notes found in ABC');
                return;
            }

            // If G Recorder was enabled, the current ABC is already transposed down by 12
            // So we need to transpose UP by 12 to get the original pitches
            if (wasTransposed) {
                parsed.notes.forEach(note => {
                    note.midi += 12;
                    note.noteName = Utils.midiToNoteName(note.midi);
                });
            }

            // Update corrected notes
            this.correctedNotes = parsed.notes;

            // Update metadata in UI if available
            if (parsed.metadata) {
                if (parsed.metadata.title) {
                    const titleInput = document.getElementById('abc-title');
                    if (titleInput) titleInput.value = parsed.metadata.title;
                }
                if (parsed.metadata.tempo) {
                    const tempoInput = document.getElementById('abc-tempo');
                    if (tempoInput) tempoInput.value = parsed.metadata.tempo;
                }
                if (parsed.metadata.meter) {
                    const meterSelect = document.getElementById('abc-meter');
                    if (meterSelect) {
                        // Handle meter as array or string
                        const meterValue = Array.isArray(parsed.metadata.meter)
                            ? parsed.metadata.meter[0]?.num + '/' + parsed.metadata.meter[0]?.den
                            : parsed.metadata.meter;
                        meterSelect.value = meterValue;
                    }
                }
                if (parsed.metadata.key) {
                    const keySelect = document.getElementById('abc-key');
                    if (keySelect) {
                        // Try to find matching key option
                        const options = Array.from(keySelect.options);
                        const match = options.find(opt => opt.value === parsed.metadata.key);
                        if (match) keySelect.value = parsed.metadata.key;
                    }
                }
            }

            // Clear existing regions and update with new notes
            this.regionManager.clearAll();
            this.regionManager.displayNotes(this.correctedNotes);

            // Update piano roll visualization with new notes
            const duration = this.audioBuffer ? this.audioBuffer.duration : 10; // fallback duration
            this.pianoRoll.setNotes(this.correctedNotes, duration);

            // Clear note selection
            this.noteEditor.deselectNote();

            // Update ABC preview
            this.updateAbcPreview();

            Utils.showFeedback(`Parsed ${parsed.notes.length} notes from ABC`);

        } catch (error) {
            console.error('Failed to parse ABC:', error);
            Utils.showFeedback('Failed to parse ABC: ' + error.message);
        }
    }

    /**
     * Open ABC in Recorder app
     */
    openInRecorder() {
        const abc = document.getElementById('abc-text').value;
        const encoded = btoa(encodeURIComponent(abc));
        const recorderUrl = `../index.html?abc=${encoded}`;
        window.open(recorderUrl, '_blank');
    }

    /**
     * Play original audio from current position
     */
    playOriginal() {
        this.waveformManager.playEditor();
    }

    /**
     * Stop original audio playback
     */
    stopOriginal() {
        this.waveformManager.stopEditor();
    }

    /**
     * Play ABC notation
     */
    async playAbc() {
        const abc = document.getElementById('abc-text').value;
        await this.abcPreview.play(abc);
    }

    /**
     * Stop ABC playback
     */
    stopAbc() {
        this.abcPreview.stop();
    }

    /**
     * Toggle recording
     */
    async toggleRecording() {
        if (this.audioLoader.getIsRecording() || this.audioLoader.getIsWaitingForFirstTap()) {
            // Stop recording
            try {
                const blob = await this.audioLoader.stopRecording();

                // Clear timer and hide tap UI
                if (this.recordingInterval) {
                    clearInterval(this.recordingInterval);
                    this.recordingInterval = null;
                }
                if (this.tapCheckInterval) {
                    clearInterval(this.tapCheckInterval);
                    this.tapCheckInterval = null;
                }

                document.getElementById('recording-timer').classList.add('hidden');
                document.getElementById('tap-hint')?.classList.add('hidden');
                document.getElementById('tap-count')?.classList.add('hidden');
                document.getElementById('btn-record').innerHTML = '<span class="record-icon">●</span> Start Recording';

                // Store tap timestamps for use in segmentation
                this.tapTimestamps = this.audioLoader.getTapTimestamps();
                console.log('Stored tap timestamps:', this.tapTimestamps);

                // Load the recorded audio
                this.audioFile = { name: 'Recording.webm' };
                const audioInfo = await this.audioLoader.loadBlob(blob);
                this.audioBuffer = audioInfo.buffer;
                this.config.sampleRate = audioInfo.sampleRate;

                this.onFileLoaded(audioInfo);
                await this.waveformManager.loadAudioBuffer(this.audioBuffer);

                const tapMsg = this.tapTimestamps.length > 0
                    ? ` (${this.tapTimestamps.length} note markers)`
                    : '';
                Utils.showFeedback('Recording complete' + tapMsg);

            } catch (error) {
                console.error('Failed to stop recording:', error);
                Utils.showFeedback('Recording failed');
            }

        } else {
            // Prepare recording (wait for first tap to actually start)
            try {
                await this.audioLoader.startRecording();

                document.getElementById('btn-record').innerHTML = '<span class="record-icon">■</span> Stop';
                document.getElementById('tap-hint')?.classList.remove('hidden');
                document.getElementById('tap-count')?.classList.remove('hidden');
                document.getElementById('tap-count-value').textContent = '0';

                // Check for first tap to start timer
                this.tapCheckInterval = setInterval(() => {
                    const tapCount = this.audioLoader.getTapTimestamps().length;
                    document.getElementById('tap-count-value').textContent = tapCount;

                    // Start timer when first tap happens
                    if (tapCount > 0 && !this.recordingInterval) {
                        document.getElementById('recording-timer').classList.remove('hidden');
                        this.recordingStartTime = Date.now();
                        this.recordingInterval = setInterval(() => {
                            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                            const mins = Math.floor(elapsed / 60);
                            const secs = elapsed % 60;
                            document.getElementById('timer-display').textContent =
                                `${mins}:${secs.toString().padStart(2, '0')}`;
                        }, 100);
                    }
                }, 100);

                Utils.showFeedback('Ready - tap Right Ctrl to START recording');

            } catch (error) {
                console.error('Failed to start recording:', error);
                Utils.showFeedback(error.message || 'Failed to start recording');
            }
        }
    }

    /**
     * Reset and start over
     */
    reset() {
        // Stop any recording
        if (this.audioLoader.getIsRecording()) {
            this.audioLoader.stopRecording();
        }
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }

        this.audioBuffer = null;
        this.audioFile = null;
        this.detectedNotes = [];
        this.correctedNotes = [];

        // Reset UI
        document.getElementById('audio-info').classList.add('hidden');
        document.getElementById('waveform-preview').classList.add('hidden');
        document.getElementById('btn-run-detection').disabled = true;
        document.getElementById('detection-results').classList.add('hidden');
        document.getElementById('recording-timer').classList.add('hidden');
        document.getElementById('btn-record').innerHTML = '<span class="record-icon">●</span> Start Recording';

        // Clear waveforms
        this.waveformManager.destroy();

        // Go to first step
        this.workflowManager.showStep('load');
    }
}
