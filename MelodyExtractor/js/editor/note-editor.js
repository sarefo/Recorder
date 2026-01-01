/**
 * NoteEditor - Human-in-the-loop note correction interface
 */

import {
    midiToNoteName,
    generatePitchOptions,
    getConfidenceClass,
    getConfidenceColor,
    showFeedback
} from '../core/utils.js';

export class NoteEditor {
    constructor(app) {
        this.app = app;
        this.selectedNoteId = null;
        this.addMode = false;
        this.addStartTime = null;

        // Re-time mode state
        this.retimeMode = false;
        this.retimeStartTime = null;
        this.retimeTaps = [];
        this.retimeKeyHandler = null;
        this.retimeMetronomeInterval = null;
        this.retimeRecordingStarted = false;
    }

    /**
     * Initialize the note editor
     */
    init() {
        this._setupEventListeners();
    }

    /**
     * Setup event listeners for editor controls
     * @private
     */
    _setupEventListeners() {
        // Add note button
        const addBtn = document.getElementById('btn-add-note');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.toggleAddMode());
        }

        // Playback buttons
        const playParsedBtn = document.getElementById('btn-play-parsed');
        const playOriginalBtn = document.getElementById('btn-play-original');
        const stopAllBtn = document.getElementById('btn-stop-all');
        const playBothChk = document.getElementById('chk-play-both');

        if (playParsedBtn) {
            playParsedBtn.addEventListener('click', () => {
                console.log('Play Parsed clicked');
                const playBoth = playBothChk && playBothChk.checked;
                if (playBoth) {
                    this.playBoth();
                } else {
                    this.playAllNotes();
                }
            });
        }

        if (playOriginalBtn) {
            playOriginalBtn.addEventListener('click', () => {
                console.log('Play Original clicked');
                const playBoth = playBothChk && playBothChk.checked;
                if (playBoth) {
                    this.playBoth();
                } else {
                    this.playOriginal();
                }
            });
        }

        if (stopAllBtn) {
            stopAllBtn.addEventListener('click', () => {
                console.log('Stop clicked');
                this.stopPlayback();
            });
        }

        // Re-time button
        const retimeBtn = document.getElementById('btn-retime');
        if (retimeBtn) {
            retimeBtn.addEventListener('click', () => {
                if (this.retimeMode) {
                    this.stopRetime();
                } else {
                    this.startRetime();
                }
            });
        }

        // Transpose all buttons
        const transposeUpBtn = document.getElementById('btn-transpose-up');
        const transposeDownBtn = document.getElementById('btn-transpose-down');
        if (transposeUpBtn) {
            transposeUpBtn.addEventListener('click', () => {
                this.transposeAll(1);
            });
        }
        if (transposeDownBtn) {
            transposeDownBtn.addEventListener('click', () => {
                this.transposeAll(-1);
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
    }

    /**
     * Attach finish event listener to wavesurfer (call after wavesurfer is ready)
     */
    attachWavesurferEvents() {
        if (this.app.waveformManager.editorWavesurfer) {
            this.app.waveformManager.editorWavesurfer.on('finish', () => {
                console.log('Audio playback finished');
                this._setPlaybackState(false);
            });
        }
    }

    /**
     * Handle keyboard shortcuts
     * @private
     */
    _handleKeyboard(e) {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Only handle when in review mode
        const reviewPanel = document.getElementById('panel-review');
        if (reviewPanel.classList.contains('hidden')) {
            return;
        }

        const note = this._getSelectedNote();

        switch (e.code) {
            case 'Delete':
            case 'Backspace':
                if (note) {
                    e.preventDefault();
                    this.deleteNote(note.id);
                }
                break;

            case 'ArrowUp':
                if (note) {
                    e.preventDefault();
                    this.changePitch(note.id, note.midi + 1);
                }
                break;

            case 'ArrowDown':
                if (note) {
                    e.preventDefault();
                    this.changePitch(note.id, note.midi - 1);
                }
                break;

            case 'ArrowLeft':
                e.preventDefault();
                this.selectPreviousNote();
                break;

            case 'ArrowRight':
                e.preventDefault();
                this.selectNextNote();
                break;

            case 'KeyP':
            case 'Space':
                e.preventDefault();
                if (note) {
                    this.playSelectedNote();
                } else {
                    // Play all if no note selected
                    this.playAllNotes();
                }
                break;

            case 'Escape':
                if (this.addMode) {
                    this.toggleAddMode();
                } else {
                    this.deselectNote();
                }
                break;
        }
    }

    /**
     * Select a note for editing
     * @param {string} noteId - Note ID
     */
    selectNote(noteId) {
        this.selectedNoteId = noteId;
        const note = this._getSelectedNote();

        if (!note) return;

        // Highlight region
        this.app.regionManager.selectRegion(noteId);

        // Update piano roll selection
        if (this.app.pianoRoll) {
            this.app.pianoRoll.setSelectedNote(noteId);
        }

        // Highlight in ABC preview
        if (this.app.highlightAbcNote) {
            this.app.highlightAbcNote(noteId);
        }

        // Show note details
        this._showNoteDetails(note);

        // Play this note's audio segment
        this.playSelectedNote();

        // Scroll waveform to note
        this.app.waveformManager.editorWavesurfer?.setTime(note.startTime);
    }

    /**
     * Deselect current note
     */
    deselectNote() {
        this.selectedNoteId = null;
        this.app.regionManager.deselectAll();
        if (this.app.pianoRoll) {
            this.app.pianoRoll.setSelectedNote(null);
        }
        // Clear ABC highlight
        if (this.app.highlightAbcNote) {
            this.app.highlightAbcNote(null);
        }
        this._clearNoteDetails();
    }

    /**
     * Select previous note
     */
    selectPreviousNote() {
        const notes = this.app.correctedNotes;
        if (notes.length === 0) return;

        const currentIndex = notes.findIndex(n => n.id === this.selectedNoteId);
        const newIndex = currentIndex > 0 ? currentIndex - 1 : notes.length - 1;
        this.selectNote(notes[newIndex].id);
    }

    /**
     * Select next note
     */
    selectNextNote() {
        const notes = this.app.correctedNotes;
        if (notes.length === 0) return;

        const currentIndex = notes.findIndex(n => n.id === this.selectedNoteId);
        const newIndex = currentIndex < notes.length - 1 ? currentIndex + 1 : 0;
        this.selectNote(notes[newIndex].id);
    }

    /**
     * Show note details in sidebar
     * @private
     */
    _showNoteDetails(note) {
        const panel = document.getElementById('note-details');
        if (!panel) return;

        panel.innerHTML = `
            <h4>Note Details</h4>
            <div class="note-info">
                <label>Pitch:</label>
                <select id="pitch-selector">
                    ${generatePitchOptions(note.midi)}
                </select>
                <div class="pitch-adjust-buttons">
                    <button class="pitch-adjust-btn" data-dir="-1">-</button>
                    <button class="pitch-adjust-btn" data-dir="1">+</button>
                </div>
            </div>
            <div class="note-info">
                <label>Start:</label>
                <input type="number" id="note-start" value="${note.startTime.toFixed(3)}" step="0.01" min="0">
                <span>sec</span>
            </div>
            <div class="note-info">
                <label>Duration:</label>
                <input type="number" id="note-duration" value="${note.duration.toFixed(3)}" step="0.01" min="0.01">
                <span>sec</span>
            </div>
            <div class="note-info">
                <label>Confidence:</label>
                <span class="confidence ${getConfidenceClass(note.confidence)}">
                    ${Math.round(note.confidence * 100)}%
                </span>
                ${note.userCorrected ? '<span class="shortcut-hint">edited</span>' : ''}
            </div>
            <div class="note-actions">
                <button id="delete-note" class="btn btn-tool">Delete</button>
                <button id="split-note" class="btn btn-tool">Split</button>
                <button id="merge-note" class="btn btn-tool">Merge</button>
            </div>
        `;

        // Attach event listeners
        this._attachNoteDetailListeners(note);
    }

    /**
     * Attach event listeners to note detail controls
     * @private
     */
    _attachNoteDetailListeners(note) {
        // Pitch selector
        const pitchSelect = document.getElementById('pitch-selector');
        if (pitchSelect) {
            pitchSelect.addEventListener('change', (e) => {
                this.changePitch(note.id, parseInt(e.target.value));
            });
        }

        // Pitch adjust buttons
        document.querySelectorAll('.pitch-adjust-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = parseInt(btn.dataset.dir);
                this.changePitch(note.id, note.midi + dir);
            });
        });

        // Start time
        const startInput = document.getElementById('note-start');
        if (startInput) {
            startInput.addEventListener('change', (e) => {
                this.changeStartTime(note.id, parseFloat(e.target.value));
            });
        }

        // Duration
        const durationInput = document.getElementById('note-duration');
        if (durationInput) {
            durationInput.addEventListener('change', (e) => {
                this.changeDuration(note.id, parseFloat(e.target.value));
            });
        }

        // Delete button
        const deleteBtn = document.getElementById('delete-note');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteNote(note.id);
            });
        }

        // Split button
        const splitBtn = document.getElementById('split-note');
        if (splitBtn) {
            splitBtn.addEventListener('click', () => {
                this.splitNote(note.id);
            });
        }

        // Merge button
        const mergeBtn = document.getElementById('merge-note');
        if (mergeBtn) {
            mergeBtn.addEventListener('click', () => {
                this.mergeWithNext(note.id);
            });
        }
    }

    /**
     * Clear note details panel
     * @private
     */
    _clearNoteDetails() {
        const panel = document.getElementById('note-details');
        if (panel) {
            panel.innerHTML = '<p class="placeholder-text">Click a note region to edit</p>';
        }
    }

    /**
     * Get currently selected note
     * @private
     */
    _getSelectedNote() {
        if (!this.selectedNoteId) return null;
        return this.app.correctedNotes.find(n => n.id === this.selectedNoteId);
    }

    /**
     * Change note pitch
     * @param {string} noteId - Note ID
     * @param {number} newMidi - New MIDI note number
     */
    changePitch(noteId, newMidi) {
        const note = this.app.correctedNotes.find(n => n.id === noteId);
        if (!note) return;

        // Clamp to valid range
        newMidi = Math.max(36, Math.min(96, newMidi));

        note.midi = newMidi;
        note.noteName = midiToNoteName(newMidi);
        note.userCorrected = true;
        note.confidence = 1.0;

        // Update region display
        this.app.regionManager.updateRegion(noteId, {
            midi: newMidi,
            color: 'rgba(0, 123, 255, 0.4)'  // Blue for user-corrected
        });

        // Update piano roll
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }

        // Update ABC preview
        if (this.app.updateAbcPreview) {
            this.app.updateAbcPreview();
        }

        // Update details panel
        this._showNoteDetails(note);
    }

    /**
     * Change note start time
     * @param {string} noteId - Note ID
     * @param {number} newStart - New start time in seconds
     */
    changeStartTime(noteId, newStart) {
        const note = this.app.correctedNotes.find(n => n.id === noteId);
        if (!note) return;

        const duration = note.duration;
        note.startTime = Math.max(0, newStart);
        note.endTime = note.startTime + duration;
        note.userCorrected = true;

        this.app.regionManager.updateRegion(noteId, {
            start: note.startTime,
            end: note.endTime
        });

        // Update piano roll
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }
    }

    /**
     * Change note duration
     * @param {string} noteId - Note ID
     * @param {number} newDuration - New duration in seconds
     */
    changeDuration(noteId, newDuration) {
        const note = this.app.correctedNotes.find(n => n.id === noteId);
        if (!note) return;

        note.duration = Math.max(0.01, newDuration);
        note.endTime = note.startTime + note.duration;
        note.userCorrected = true;

        this.app.regionManager.updateRegion(noteId, {
            end: note.endTime
        });

        // Update piano roll
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }
    }

    /**
     * Delete a note
     * @param {string} noteId - Note ID
     */
    deleteNote(noteId) {
        const index = this.app.correctedNotes.findIndex(n => n.id === noteId);
        if (index === -1) return;

        this.app.correctedNotes.splice(index, 1);
        this.app.regionManager.removeRegion(noteId);

        if (this.selectedNoteId === noteId) {
            this.deselectNote();
        }

        // Update piano roll
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }

        // Update ABC preview
        if (this.app.updateAbcPreview) {
            this.app.updateAbcPreview();
        }

        showFeedback('Note deleted');
    }

    /**
     * Split note at midpoint
     * @param {string} noteId - Note ID
     */
    splitNote(noteId) {
        const note = this.app.correctedNotes.find(n => n.id === noteId);
        if (!note || note.duration < 0.05) return;

        const splitTime = note.startTime + note.duration / 2;
        const splitNotes = this.app.noteSegmenter.splitNote(note, splitTime);

        // Replace original with split notes
        const index = this.app.correctedNotes.findIndex(n => n.id === noteId);
        this.app.correctedNotes.splice(index, 1, ...splitNotes);

        // Refresh regions and piano roll
        this.app.regionManager.refresh();
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }
        if (this.app.updateAbcPreview) {
            this.app.updateAbcPreview();
        }
        this.selectNote(splitNotes[0].id);

        showFeedback('Note split');
    }

    /**
     * Merge with next note
     * @param {string} noteId - Note ID
     */
    mergeWithNext(noteId) {
        const notes = this.app.correctedNotes;
        const index = notes.findIndex(n => n.id === noteId);
        if (index === -1 || index >= notes.length - 1) return;

        const merged = this.app.noteSegmenter.mergeNotes(notes[index], notes[index + 1]);

        // Replace both with merged note
        notes.splice(index, 2, merged);

        // Refresh regions and piano roll
        this.app.regionManager.refresh();
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }
        if (this.app.updateAbcPreview) {
            this.app.updateAbcPreview();
        }
        this.selectNote(merged.id);

        showFeedback('Notes merged');
    }

    /**
     * Handle region update from Wavesurfer
     * @param {Object} region - Updated region
     */
    onRegionUpdate(region) {
        const note = this.app.correctedNotes.find(n => n.id === region.id);
        if (!note) return;

        note.startTime = region.start;
        note.endTime = region.end;
        note.duration = region.end - region.start;
        note.userCorrected = true;

        // Update piano roll
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }

        // Update details if this is the selected note
        if (this.selectedNoteId === region.id) {
            this._showNoteDetails(note);
        }
    }

    /**
     * Toggle add note mode
     */
    toggleAddMode() {
        this.addMode = !this.addMode;
        this.addStartTime = null;

        const addBtn = document.getElementById('btn-add-note');
        if (addBtn) {
            addBtn.classList.toggle('active', this.addMode);
            addBtn.textContent = this.addMode ? 'Click Start...' : 'Add Note';
        }

        // Update cursor style
        const container = document.getElementById('waveform-editor');
        if (container) {
            container.style.cursor = this.addMode ? 'crosshair' : 'default';
        }
    }

    /**
     * Handle click in add mode
     * @param {number} time - Click time in seconds
     */
    handleAddClick(time) {
        if (!this.addMode) return;

        if (this.addStartTime === null) {
            // First click - set start time
            this.addStartTime = time;
            const addBtn = document.getElementById('btn-add-note');
            if (addBtn) {
                addBtn.textContent = 'Click End...';
            }
        } else {
            // Second click - create note
            const startTime = Math.min(this.addStartTime, time);
            const endTime = Math.max(this.addStartTime, time);

            if (endTime - startTime >= 0.02) {
                this.addNote(startTime, endTime, 72);  // Default to C5
            }

            // Exit add mode
            this.toggleAddMode();
        }
    }

    /**
     * Add a new note
     * @param {number} startTime - Start time
     * @param {number} endTime - End time
     * @param {number} midi - MIDI note number
     */
    addNote(startTime, endTime, midi) {
        const newNote = {
            id: `note-user-${Date.now()}`,
            midi: midi,
            noteName: midiToNoteName(midi),
            startTime: startTime,
            endTime: endTime,
            duration: endTime - startTime,
            confidence: 1.0,
            userCorrected: true
        };

        // Insert in correct position
        this.app.correctedNotes.push(newNote);
        this.app.correctedNotes.sort((a, b) => a.startTime - b.startTime);

        // Refresh regions and piano roll
        this.app.regionManager.refresh();
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }
        if (this.app.updateAbcPreview) {
            this.app.updateAbcPreview();
        }

        this.selectNote(newNote.id);

        showFeedback('Note added');
    }

    /**
     * Play the selected note via synth
     */
    playSelectedNote() {
        const note = this._getSelectedNote();
        if (!note) return;

        // Play through synth instead of original audio
        if (this.app.synth) {
            this.app.synth.previewNote(note.midi, Math.min(note.duration, 0.5));
        }
    }

    /**
     * Play all parsed notes via synth
     */
    playAllNotes() {
        if (!this.app.synth || this.app.correctedNotes.length === 0) return;

        this._setPlaybackState(true);

        this.app.synth.playNotes(
            this.app.correctedNotes,
            0,
            // Highlight notes as they play
            (note) => {
                this.selectNote(note.id);
            },
            // On complete
            () => {
                this._setPlaybackState(false);
            }
        );
    }

    /**
     * Play original audio
     */
    playOriginal() {
        if (!this.app.waveformManager.editorWavesurfer) return;

        this._setPlaybackState(true);
        this.app.waveformManager.playEditor();

        // Listen for finish
        this.app.waveformManager.editorWavesurfer.once('finish', () => {
            this._setPlaybackState(false);
        });
    }

    /**
     * Play both original and parsed together (A/B comparison)
     */
    playBoth() {
        if (!this.app.synth || this.app.correctedNotes.length === 0) return;
        if (!this.app.waveformManager.editorWavesurfer) return;

        this._setPlaybackState(true);

        // Start both at same time
        this.app.waveformManager.playEditor();
        this.app.synth.playNotes(
            this.app.correctedNotes,
            0,
            (note) => {
                this.selectNote(note.id);
            },
            () => {
                // Synth finished - original might still be playing
            }
        );

        // Listen for original to finish
        this.app.waveformManager.editorWavesurfer.once('finish', () => {
            this._setPlaybackState(false);
        });
    }

    /**
     * Stop all playback
     */
    stopPlayback() {
        if (this.app.synth) {
            this.app.synth.stop();
        }
        if (this.app.waveformManager.editorWavesurfer) {
            this.app.waveformManager.stopEditor();
        }
        this._setPlaybackState(false);
    }

    /**
     * Update playback button states
     * @private
     */
    _setPlaybackState(isPlaying) {
        const playParsedBtn = document.getElementById('btn-play-parsed');
        const playOriginalBtn = document.getElementById('btn-play-original');
        const stopAllBtn = document.getElementById('btn-stop-all');

        if (playParsedBtn) playParsedBtn.disabled = isPlaying;
        if (playOriginalBtn) playOriginalBtn.disabled = isPlaying;
        if (stopAllBtn) stopAllBtn.disabled = !isPlaying;
    }

    /**
     * Transpose all notes up or down by semitones
     * @param {number} semitones - Number of semitones to transpose (positive for up, negative for down)
     */
    transposeAll(semitones) {
        if (this.app.correctedNotes.length === 0) {
            showFeedback('No notes to transpose');
            return;
        }

        let transposed = 0;
        this.app.correctedNotes.forEach(note => {
            const newMidi = note.midi + semitones;
            // Only transpose if within valid range
            if (newMidi >= 36 && newMidi <= 96) {
                note.midi = newMidi;
                note.noteName = midiToNoteName(newMidi);
                note.userCorrected = true;
                transposed++;
            }
        });

        if (transposed > 0) {
            // Refresh all displays
            this.app.regionManager.refresh();
            if (this.app.pianoRoll) {
                this.app.pianoRoll.refresh();
            }
            if (this.app.updateAbcPreview) {
                this.app.updateAbcPreview();
            }

            // Update details if a note is selected
            const selectedNote = this._getSelectedNote();
            if (selectedNote) {
                this._showNoteDetails(selectedNote);
            }

            const direction = semitones > 0 ? 'up' : 'down';
            showFeedback(`Transposed ${transposed} note${transposed > 1 ? 's' : ''} ${direction}`);
        } else {
            showFeedback('No notes could be transposed (out of range)');
        }
    }

    /**
     * Start re-time mode - play metronome with count-in, then capture tap timestamps
     */
    startRetime() {
        if (this.app.correctedNotes.length === 0) {
            showFeedback('No notes to re-time');
            return;
        }

        this.retimeMode = true;
        this.retimeTaps = [];
        this.retimeRecordingStarted = false;

        // Get tempo and meter from grid settings
        const tempoInput = document.getElementById('grid-tempo');
        const meterSelect = document.getElementById('grid-meter');
        const tempo = tempoInput ? parseInt(tempoInput.value) || 120 : 120;
        const meter = meterSelect ? meterSelect.value : '4/4';

        // Parse meter (e.g., "4/4" -> beats=4, noteValue=4)
        const [beatsPerBar, noteValue] = meter.split('/').map(Number);
        const beatDuration = (60 / tempo) * (4 / noteValue); // Adjust for note value

        // Update UI
        const retimeBtn = document.getElementById('btn-retime');
        const retimeStatus = document.getElementById('retime-status');
        const tapCount = document.getElementById('retime-tap-count');
        const noteCount = document.getElementById('retime-note-count');

        if (retimeBtn) {
            retimeBtn.textContent = '⏹ Stop';
            retimeBtn.classList.add('active');
        }
        if (retimeStatus) {
            retimeStatus.classList.remove('hidden');
            retimeStatus.querySelector('div').innerHTML =
                `Count-in (${meter})... <span id="retime-tap-count">0</span> / <span id="retime-note-count">${this.app.correctedNotes.length}</span>`;
        }

        // Setup keydown handler for Right Ctrl
        this.retimeKeyHandler = (e) => {
            if (e.code === 'ControlRight' && this.retimeMode && this.retimeRecordingStarted) {
                e.preventDefault();

                // Calculate time since recording started
                const elapsed = (performance.now() - this.retimeStartTime) / 1000;
                this.retimeTaps.push(elapsed);

                // Visual feedback
                const tapCountEl = document.getElementById('retime-tap-count');
                if (tapCountEl) tapCountEl.textContent = this.retimeTaps.length;

                // Flash indicator
                const indicator = retimeStatus?.querySelector('.recording-indicator');
                if (indicator) {
                    indicator.style.transform = 'scale(1.3)';
                    setTimeout(() => {
                        indicator.style.transform = 'scale(1)';
                    }, 100);
                }

                console.log(`Re-time tap ${this.retimeTaps.length}: ${elapsed.toFixed(3)}s`);

                // Auto-stop when all notes have been tapped
                if (this.retimeTaps.length >= this.app.correctedNotes.length) {
                    setTimeout(() => this.stopRetime(), 100);
                }
            }
        };
        document.addEventListener('keydown', this.retimeKeyHandler);

        // Initialize synth for metronome
        this.app.synth.init();

        // Play count-in: one bar based on meter
        const countInBeats = beatsPerBar;
        const now = this.app.synth.audioContext.currentTime;

        console.log(`Count-in: ${countInBeats} beats at ${tempo} BPM (meter: ${meter})`);

        // Schedule count-in beats
        for (let i = 0; i < countInBeats; i++) {
            const clickTime = now + (i * beatDuration);
            this.app.synth.playMetronomeClick(clickTime, i === 0); // First beat is downbeat
        }

        // Calculate exact time when recording should start (after count-in)
        const recordingStartDelay = countInBeats * beatDuration * 1000; // in milliseconds

        // Start recording after count-in
        setTimeout(() => {
            this.retimeRecordingStarted = true;
            this.retimeStartTime = performance.now();

            // Update status to show we're recording
            const statusDiv = retimeStatus?.querySelector('div');
            if (statusDiv) {
                statusDiv.innerHTML = `Taps: <span id="retime-tap-count">0</span> / <span id="retime-note-count">${this.app.correctedNotes.length}</span>`;
            }

            console.log('Recording started - tap for each note');

            // Play first beat of continuous metronome immediately (synchronized with audio context)
            const firstBeatTime = this.app.synth.audioContext.currentTime;
            this.app.synth.playMetronomeClick(firstBeatTime, true); // First beat is downbeat

            // Continue playing metronome clicks at regular intervals
            let beatCount = 1; // Start at 1 since we already played beat 0
            this.retimeMetronomeInterval = setInterval(() => {
                this.app.synth.playMetronomeClick(null, beatCount % beatsPerBar === 0);
                beatCount++;
            }, beatDuration * 1000);

        }, recordingStartDelay);

        showFeedback(`Re-time: ${countInBeats} beat count-in (${meter}) at ${tempo} BPM, then tap Right Ctrl for each note`);
    }

    /**
     * Stop re-time mode and apply new timing to notes
     */
    stopRetime() {
        if (!this.retimeMode) return;

        this.retimeMode = false;
        this.retimeRecordingStarted = false;

        // Stop metronome
        if (this.retimeMetronomeInterval) {
            clearInterval(this.retimeMetronomeInterval);
            this.retimeMetronomeInterval = null;
        }

        // Remove keydown handler
        if (this.retimeKeyHandler) {
            document.removeEventListener('keydown', this.retimeKeyHandler);
            this.retimeKeyHandler = null;
        }

        // Update UI
        const retimeBtn = document.getElementById('btn-retime');
        const retimeStatus = document.getElementById('retime-status');

        if (retimeBtn) {
            retimeBtn.textContent = '⏱ Re-time';
            retimeBtn.classList.remove('active');
        }
        if (retimeStatus) retimeStatus.classList.add('hidden');

        // Apply timing if we have taps
        if (this.retimeTaps.length > 0) {
            this._applyRetiming();
        } else {
            showFeedback('No taps recorded');
        }
    }

    /**
     * Apply re-timing to notes based on captured taps
     * @private
     */
    _applyRetiming() {
        const notes = this.app.correctedNotes;
        const taps = this.retimeTaps;

        console.log(`Applying ${taps.length} taps to ${notes.length} notes`);

        // Sort notes by their original start time to maintain pitch order
        notes.sort((a, b) => a.startTime - b.startTime);

        // Get tempo for calculating default durations
        const tempoInput = document.getElementById('grid-tempo');
        const tempo = tempoInput ? parseInt(tempoInput.value) || 120 : 120;
        const quarterNoteDuration = 60 / tempo;

        // Match taps to notes
        const numToProcess = Math.min(taps.length, notes.length);

        for (let i = 0; i < numToProcess; i++) {
            const note = notes[i];
            const tapTime = taps[i];

            // Calculate new end time
            let newEndTime;
            if (i < taps.length - 1) {
                // End just before next tap
                newEndTime = taps[i + 1] - 0.02;
            } else {
                // Last note - use quarter note duration
                newEndTime = tapTime + quarterNoteDuration;
            }

            // Update note timing
            note.startTime = tapTime;
            note.endTime = Math.max(newEndTime, tapTime + 0.05); // Min 50ms duration
            note.duration = note.endTime - note.startTime;
            note.userCorrected = true;
        }

        // Handle extra taps (more taps than notes) - could add notes here
        if (taps.length > notes.length) {
            showFeedback(`Re-timed ${notes.length} notes (${taps.length - notes.length} extra taps ignored)`);
        } else if (taps.length < notes.length) {
            showFeedback(`Re-timed ${taps.length} of ${notes.length} notes`);
        } else {
            showFeedback(`Re-timed all ${notes.length} notes`);
        }

        // Refresh displays
        this.app.regionManager.refresh();
        if (this.app.pianoRoll) {
            this.app.pianoRoll.refresh();
        }
        if (this.app.updateAbcPreview) {
            this.app.updateAbcPreview();
        }
    }
}
