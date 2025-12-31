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

        // Play all button - now plays parsed notes via synth
        const playAllBtn = document.getElementById('btn-play-all');
        const stopAllBtn = document.getElementById('btn-stop-all');
        if (playAllBtn && stopAllBtn) {
            playAllBtn.addEventListener('click', () => {
                console.log('Play All clicked - playing via synth');
                this.playAllNotes();
            });

            stopAllBtn.addEventListener('click', () => {
                console.log('Stop clicked');
                this.stopPlayback();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
    }

    /**
     * Attach finish event listener to wavesurfer (call after wavesurfer is ready)
     */
    attachWavesurferEvents() {
        const playAllBtn = document.getElementById('btn-play-all');
        const stopAllBtn = document.getElementById('btn-stop-all');

        if (this.app.waveformManager.editorWavesurfer && playAllBtn && stopAllBtn) {
            this.app.waveformManager.editorWavesurfer.on('finish', () => {
                console.log('Audio playback finished');
                playAllBtn.disabled = false;
                stopAllBtn.disabled = true;
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
                if (note) {
                    e.preventDefault();
                    this.playSelectedNote();
                } else {
                    // Play all if no note selected
                    e.preventDefault();
                    const playAllBtn = document.getElementById('btn-play-all');
                    if (playAllBtn && !playAllBtn.disabled) {
                        playAllBtn.click();
                    }
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

        const playAllBtn = document.getElementById('btn-play-all');
        const stopAllBtn = document.getElementById('btn-stop-all');

        if (playAllBtn) playAllBtn.disabled = true;
        if (stopAllBtn) stopAllBtn.disabled = false;

        this.app.synth.playNotes(
            this.app.correctedNotes,
            0,
            // Highlight notes as they play
            (note) => {
                this.selectNote(note.id);
            },
            // On complete
            () => {
                if (playAllBtn) playAllBtn.disabled = false;
                if (stopAllBtn) stopAllBtn.disabled = true;
            }
        );
    }

    /**
     * Stop synth playback
     */
    stopPlayback() {
        if (this.app.synth) {
            this.app.synth.stop();
        }
        const playAllBtn = document.getElementById('btn-play-all');
        const stopAllBtn = document.getElementById('btn-stop-all');
        if (playAllBtn) playAllBtn.disabled = false;
        if (stopAllBtn) stopAllBtn.disabled = true;
    }
}
