/**
 * PianoRoll - Interactive piano roll visualization for note editing
 */

import { midiToNoteName, getConfidenceColor } from '../core/utils.js';
import { Spectrogram } from './spectrogram.js';

export class PianoRoll {
    constructor(app, containerId) {
        this.app = app;
        this.containerId = containerId;
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.spectrogramCanvas = null;
        this.spectrogram = null;
        this.notes = [];
        this.selectedNoteId = null;
        this.duration = 0;
        this.pixelsPerSecond = 100;
        this.noteHeight = 14;

        // Piano key setup - will be adjusted based on notes
        this.midiMin = 60;  // C4 (middle C) - default
        this.midiMax = 84;  // C6 - default
        this.keyWidth = 50;

        // Interaction state
        this.isDragging = false;
        this.dragType = null; // 'move', 'resize-left', 'resize-right', 'pitch'
        this.dragNote = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.originalNote = null;

        // Grid settings
        this.snapEnabled = true;
        this.gridTempo = 120;
        this.gridDivision = 4; // beats per bar

        // Delete bar buttons
        this.deleteButtons = []; // Array of {x, y, width, height, barStartTime, barEndTime}
    }

    /**
     * Initialize the piano roll
     */
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;

        // Make container position relative for layering
        this.container.style.position = 'relative';

        // Create spectrogram canvas (background layer)
        this.spectrogramCanvas = document.createElement('canvas');
        this.spectrogramCanvas.className = 'piano-roll-spectrogram';
        this.spectrogramCanvas.style.position = 'absolute';
        this.spectrogramCanvas.style.top = '0';
        this.spectrogramCanvas.style.left = '0';
        this.spectrogramCanvas.style.pointerEvents = 'none'; // Allow clicks through
        this.container.appendChild(this.spectrogramCanvas);

        // Initialize spectrogram
        this.spectrogram = new Spectrogram();
        this.spectrogram.init(this.spectrogramCanvas);

        // Create main canvas (foreground layer)
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'piano-roll-canvas';
        this.canvas.style.position = 'relative';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Add event listeners
        this.canvas.addEventListener('click', (e) => this._handleClick(e));
        this.canvas.addEventListener('mousedown', (e) => this._handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this._handleMouseUp(e));

        // Handle resize
        this._resize();
        window.addEventListener('resize', () => this._resize());

        // Setup grid controls
        this._setupGridControls();
    }

    /**
     * Setup grid control event listeners
     * @private
     */
    _setupGridControls() {
        const snapCheckbox = document.getElementById('chk-snap-grid');
        const tempoInput = document.getElementById('abc-tempo');
        const meterSelect = document.getElementById('abc-meter');
        const divisionSelect = document.getElementById('grid-division');

        if (snapCheckbox) {
            snapCheckbox.addEventListener('change', () => {
                this.snapEnabled = snapCheckbox.checked;
                this.render();
            });
        }

        if (tempoInput) {
            tempoInput.addEventListener('change', () => {
                this.gridTempo = parseInt(tempoInput.value) || 120;
                this.render();
            });
        }

        if (meterSelect) {
            meterSelect.addEventListener('change', () => {
                // Meter change doesn't affect grid rendering, just stored for reference
                this.render();
            });
        }

        if (divisionSelect) {
            divisionSelect.addEventListener('change', () => {
                this.gridDivision = parseInt(divisionSelect.value) || 4;
                this.render();
            });
        }
    }

    /**
     * Resize canvas to fit container
     */
    _resize() {
        if (!this.container || !this.canvas) return;

        const rect = this.container.getBoundingClientRect();
        const numNotes = this.midiMax - this.midiMin + 1;
        const height = Math.max(150, numNotes * this.noteHeight + 20);

        // Set both the canvas internal dimensions AND the CSS dimensions
        this.canvas.width = rect.width;
        this.canvas.height = height;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = height + 'px';

        // Also resize spectrogram canvas
        if (this.spectrogramCanvas) {
            this.spectrogramCanvas.width = rect.width;
            this.spectrogramCanvas.height = height;
            this.spectrogramCanvas.style.width = rect.width + 'px';
            this.spectrogramCanvas.style.height = height + 'px';
        }

        this.render();
    }

    /**
     * Set notes and duration
     * @param {Array} notes - Array of note objects
     * @param {number} duration - Total audio duration in seconds
     */
    setNotes(notes, duration) {
        this.notes = notes;
        this.duration = duration;

        // Calculate MIDI range based on actual notes (with padding)
        if (notes.length > 0) {
            const midiValues = notes.map(n => n.midi);
            const minMidi = Math.min(...midiValues);
            const maxMidi = Math.max(...midiValues);

            // Add padding of one full octave (12 semitones) above and below
            this.midiMin = Math.max(36, minMidi - 12);  // Don't go below C2
            this.midiMax = Math.min(96, maxMidi + 12);  // Don't go above C7

            // Ensure at least 2 octaves (24 semitones) visible
            if (this.midiMax - this.midiMin < 24) {
                const center = Math.floor((this.midiMin + this.midiMax) / 2);
                this.midiMin = Math.max(36, center - 12);
                this.midiMax = Math.min(96, center + 12);
            }

            console.log(`Piano roll range: MIDI ${this.midiMin} to ${this.midiMax} (${midiToNoteName(this.midiMin)} to ${midiToNoteName(this.midiMax)})`);
        }

        // Calculate pixels per second to fit the container
        const availableWidth = this.canvas.width - this.keyWidth - 20;
        this.pixelsPerSecond = Math.max(50, availableWidth / duration);

        // Update spectrogram display parameters
        if (this.spectrogram) {
            this.spectrogram.setDisplayParams({
                midiMin: this.midiMin,
                midiMax: this.midiMax,
                pixelsPerSecond: this.pixelsPerSecond,
                noteHeight: this.noteHeight,
                keyWidth: this.keyWidth
            });
        }

        // Resize canvas height based on MIDI range
        this._resize();
        this.render();

        // Compute spectrogram if we have audio
        this._computeSpectrogram();
    }

    /**
     * Compute and render spectrogram from app's audio buffer
     * @private
     */
    async _computeSpectrogram() {
        if (!this.spectrogram || !this.app.audioBuffer) {
            console.log('Cannot compute spectrogram: missing spectrogram or audioBuffer');
            return;
        }

        try {
            console.log('Computing spectrogram...');
            await this.spectrogram.compute(this.app.audioBuffer, this.duration);
        } catch (error) {
            console.error('Failed to compute spectrogram:', error);
        }
    }

    /**
     * Render the piano roll
     */
    render() {
        if (!this.ctx || !this.canvas) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas with semi-transparent background
        // This allows the spectrogram to show through
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(245, 245, 245, 0.7)';
        ctx.fillRect(0, 0, width, height);

        // Draw piano keys on the left (opaque)
        this._drawPianoKeys();

        // Draw grid lines
        this._drawGrid();

        // Draw notes
        this._drawNotes();

        // Draw time markers
        this._drawTimeMarkers();

        // Draw delete bar buttons
        this._drawBarDeleteButtons();
    }

    /**
     * Draw piano keys on the left side
     */
    _drawPianoKeys() {
        const ctx = this.ctx;
        const blackKeys = [1, 3, 6, 8, 10]; // Semitones that are black keys

        for (let midi = this.midiMax; midi >= this.midiMin; midi--) {
            const y = this._midiToY(midi);
            const semitone = midi % 12;
            const isBlack = blackKeys.includes(semitone);

            // Key background
            ctx.fillStyle = isBlack ? '#333' : '#fff';
            ctx.fillRect(0, y, this.keyWidth - 2, this.noteHeight);

            // Key border
            ctx.strokeStyle = '#ccc';
            ctx.strokeRect(0, y, this.keyWidth - 2, this.noteHeight);

            // Note name (only for C notes)
            if (semitone === 0) {
                ctx.fillStyle = '#333';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(midiToNoteName(midi), this.keyWidth - 6, y + this.noteHeight - 2);
            }
        }
    }

    /**
     * Draw grid lines
     */
    _drawGrid() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Horizontal lines for each pitch
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;

        for (let midi = this.midiMax; midi >= this.midiMin; midi--) {
            const y = this._midiToY(midi);
            ctx.beginPath();
            ctx.moveTo(this.keyWidth, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Calculate beat timing
        const beatDuration = 60 / this.gridTempo; // seconds per beat
        const divisionDuration = beatDuration / (this.gridDivision / 4); // seconds per grid line

        if (this.snapEnabled) {
            // Draw beat grid lines
            let gridTime = 0;
            let beatCount = 0;

            while (gridTime <= this.duration) {
                const x = this._timeToX(gridTime);
                const isMeasureLine = beatCount % 4 === 0;
                const isBeatLine = beatCount % 1 === 0;

                if (isMeasureLine) {
                    // Measure lines (every 4 beats in 4/4) - thick purple
                    ctx.strokeStyle = 'rgba(79, 74, 133, 0.6)';
                    ctx.lineWidth = 2;
                } else if (Number.isInteger(beatCount)) {
                    // Beat lines - medium purple
                    ctx.strokeStyle = 'rgba(79, 74, 133, 0.4)';
                    ctx.lineWidth = 1;
                } else {
                    // Subdivision lines - light purple
                    ctx.strokeStyle = 'rgba(79, 74, 133, 0.2)';
                    ctx.lineWidth = 0.5;
                }

                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();

                gridTime += divisionDuration;
                beatCount += 1 / (this.gridDivision / 4);
            }
        } else {
            // Original time-based grid (when snap is disabled)
            // Vertical lines for time (every 0.5 seconds)
            ctx.strokeStyle = '#d0d0d0';
            ctx.lineWidth = 0.5;
            for (let t = 0; t <= this.duration; t += 0.5) {
                const x = this._timeToX(t);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            // Stronger lines every second
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 1;
            for (let t = 0; t <= this.duration; t += 1) {
                const x = this._timeToX(t);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        }
    }

    /**
     * Draw delete buttons for each measure
     */
    _drawBarDeleteButtons() {
        const ctx = this.ctx;
        this.deleteButtons = []; // Reset delete buttons array

        // Get meter from UI to determine measure duration
        const meterSelect = document.getElementById('abc-meter');
        const meter = meterSelect ? meterSelect.value : '4/4';
        const beatsPerMeasure = parseInt(meter.split('/')[0]);
        const beatDuration = 60 / this.gridTempo;
        const measureDuration = beatDuration * beatsPerMeasure;

        // Calculate measure boundaries
        let measureTime = 0;
        let measureIndex = 0;

        while (measureTime < this.duration) {
            const nextMeasureTime = Math.min(measureTime + measureDuration, this.duration);
            const x1 = this._timeToX(measureTime);
            const x2 = this._timeToX(nextMeasureTime);

            // Only draw if measure has width
            if (x2 - x1 > 30) {
                // Button dimensions
                const buttonSize = 16;
                const buttonX = x2 - buttonSize - 4;
                const buttonY = 4;

                // Store button info for click detection
                this.deleteButtons.push({
                    x: buttonX,
                    y: buttonY,
                    width: buttonSize,
                    height: buttonSize,
                    barStartTime: measureTime,
                    barEndTime: nextMeasureTime,
                    measureIndex: measureIndex
                });

                // Draw button background
                ctx.fillStyle = 'rgba(220, 53, 69, 0.8)';
                ctx.fillRect(buttonX, buttonY, buttonSize, buttonSize);

                // Draw border
                ctx.strokeStyle = 'rgba(155, 37, 48, 1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(buttonX, buttonY, buttonSize, buttonSize);

                // Draw X
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                const padding = 4;
                ctx.beginPath();
                ctx.moveTo(buttonX + padding, buttonY + padding);
                ctx.lineTo(buttonX + buttonSize - padding, buttonY + buttonSize - padding);
                ctx.moveTo(buttonX + buttonSize - padding, buttonY + padding);
                ctx.lineTo(buttonX + padding, buttonY + buttonSize - padding);
                ctx.stroke();
            }

            measureTime = nextMeasureTime;
            measureIndex++;
        }
    }

    /**
     * Get the grid interval in seconds
     * @returns {number} Grid interval in seconds
     */
    _getGridInterval() {
        const beatDuration = 60 / this.gridTempo;
        return beatDuration / (this.gridDivision / 4);
    }

    /**
     * Snap a time value to the nearest grid line
     * @param {number} time - Time in seconds
     * @returns {number} Snapped time
     */
    _snapToGrid(time) {
        if (!this.snapEnabled) return time;

        const interval = this._getGridInterval();
        return Math.round(time / interval) * interval;
    }

    /**
     * Draw all notes
     */
    _drawNotes() {
        const ctx = this.ctx;

        for (const note of this.notes) {
            const x = this._timeToX(note.startTime);
            const y = this._midiToY(note.midi);
            const width = (note.endTime - note.startTime) * this.pixelsPerSecond;

            // Note color based on confidence or user-corrected status
            let color = getConfidenceColor(note.confidence);
            if (note.userCorrected) {
                color = 'rgba(0, 123, 255, 0.8)';
            }

            // Selected note highlight
            if (note.id === this.selectedNoteId) {
                ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.fillRect(x - 2, y - 2, width + 4, this.noteHeight + 4);
            }

            // Note rectangle
            ctx.fillStyle = color;
            ctx.fillRect(x, y, Math.max(width, 4), this.noteHeight - 1);

            // Note border
            ctx.strokeStyle = note.id === this.selectedNoteId ? '#ff0' : 'rgba(0,0,0,0.3)';
            ctx.lineWidth = note.id === this.selectedNoteId ? 2 : 1;
            ctx.strokeRect(x, y, Math.max(width, 4), this.noteHeight - 1);

            // Note label (if there's room)
            if (width > 30) {
                ctx.fillStyle = '#000';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(midiToNoteName(note.midi), x + 3, y + this.noteHeight - 2);
            }
        }
    }

    /**
     * Draw time markers at the bottom
     */
    _drawTimeMarkers() {
        const ctx = this.ctx;
        const height = this.canvas.height;

        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';

        for (let t = 0; t <= this.duration; t += 1) {
            const x = this._timeToX(t);
            ctx.fillText(`${t}s`, x, height - 2);
        }
    }

    /**
     * Convert time to x coordinate
     */
    _timeToX(time) {
        return this.keyWidth + time * this.pixelsPerSecond;
    }

    /**
     * Convert x coordinate to time
     */
    _xToTime(x) {
        return Math.max(0, (x - this.keyWidth) / this.pixelsPerSecond);
    }

    /**
     * Convert MIDI note to y coordinate
     */
    _midiToY(midi) {
        return (this.midiMax - midi) * this.noteHeight;
    }

    /**
     * Convert y coordinate to MIDI note
     */
    _yToMidi(y) {
        const midi = this.midiMax - Math.floor(y / this.noteHeight);
        return Math.max(this.midiMin, Math.min(this.midiMax, midi));
    }

    /**
     * Find note at given coordinates
     */
    _findNoteAt(x, y) {
        const time = this._xToTime(x);

        // Check each note's bounding box directly
        for (const note of this.notes) {
            const noteX = this._timeToX(note.startTime);
            const noteEndX = this._timeToX(note.endTime);
            const noteY = this._midiToY(note.midi);

            // Check if click is within note's bounding box
            if (x >= noteX && x <= noteEndX &&
                y >= noteY && y <= noteY + this.noteHeight) {
                return note;
            }
        }
        return null;
    }

    /**
     * Get canvas-relative coordinates from mouse event
     * @private
     */
    _getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Scale mouse coordinates to canvas coordinates
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    /**
     * Handle click event
     */
    _handleClick(e) {
        if (this.isDragging) return;

        const { x, y } = this._getCanvasCoords(e);

        // Check if a delete button was clicked
        for (const button of this.deleteButtons) {
            if (x >= button.x && x <= button.x + button.width &&
                y >= button.y && y <= button.y + button.height) {
                this._deleteBar(button.barStartTime, button.barEndTime, button.measureIndex);
                return;
            }
        }

        const note = this._findNoteAt(x, y);
        if (note) {
            this.selectNote(note.id);
        } else {
            this.deselectNote();
        }
    }

    /**
     * Handle mouse down for dragging
     */
    _handleMouseDown(e) {
        const { x, y } = this._getCanvasCoords(e);

        const note = this._findNoteAt(x, y);
        if (!note) return;

        this.isDragging = true;
        this.dragNote = note;
        this.dragStartX = x;
        this.dragStartY = y;
        this.originalNote = { ...note };

        // Determine drag type based on where clicked
        const noteX = this._timeToX(note.startTime);
        const noteEndX = this._timeToX(note.endTime);

        if (x < noteX + 8) {
            this.dragType = 'resize-left';
            this.canvas.style.cursor = 'ew-resize';
        } else if (x > noteEndX - 8) {
            this.dragType = 'resize-right';
            this.canvas.style.cursor = 'ew-resize';
        } else {
            this.dragType = 'move';
            this.canvas.style.cursor = 'grabbing';
        }
    }

    /**
     * Handle mouse move for dragging
     */
    _handleMouseMove(e) {
        const { x, y } = this._getCanvasCoords(e);

        if (!this.isDragging || !this.dragNote) {
            // Check if hovering over a delete button
            for (const button of this.deleteButtons) {
                if (x >= button.x && x <= button.x + button.width &&
                    y >= button.y && y <= button.y + button.height) {
                    this.canvas.style.cursor = 'pointer';
                    return;
                }
            }

            // Update cursor based on hover position
            const note = this._findNoteAt(x, y);
            if (note) {
                const noteX = this._timeToX(note.startTime);
                const noteEndX = this._timeToX(note.endTime);
                if (x < noteX + 8 || x > noteEndX - 8) {
                    this.canvas.style.cursor = 'ew-resize';
                } else {
                    this.canvas.style.cursor = 'grab';
                }
            } else {
                this.canvas.style.cursor = 'default';
            }
            return;
        }

        const deltaX = x - this.dragStartX;
        const deltaY = y - this.dragStartY;
        const deltaTime = deltaX / this.pixelsPerSecond;
        const deltaMidi = -Math.round(deltaY / this.noteHeight);

        // Find the actual note object in the app's correctedNotes
        const noteToUpdate = this.app.correctedNotes.find(n => n.id === this.dragNote.id);
        if (!noteToUpdate) return;

        switch (this.dragType) {
            case 'move':
                // Move both start and end time
                let newStart = Math.max(0, this.originalNote.startTime + deltaTime);
                let newEnd = this.originalNote.endTime + deltaTime;

                // Apply snap to grid
                if (this.snapEnabled) {
                    const snappedStart = this._snapToGrid(newStart);
                    const offset = snappedStart - newStart;
                    newStart = snappedStart;
                    newEnd = newEnd + offset;
                }

                noteToUpdate.startTime = newStart;
                noteToUpdate.endTime = newEnd;
                noteToUpdate.duration = newEnd - newStart;
                noteToUpdate.midi = Math.max(this.midiMin, Math.min(this.midiMax, this.originalNote.midi + deltaMidi));
                noteToUpdate.noteName = midiToNoteName(noteToUpdate.midi);
                break;

            case 'resize-left':
                let resizeLeftStart = Math.max(0, this.originalNote.startTime + deltaTime);
                if (this.snapEnabled) {
                    resizeLeftStart = this._snapToGrid(resizeLeftStart);
                }
                noteToUpdate.startTime = Math.min(noteToUpdate.endTime - 0.05, resizeLeftStart);
                noteToUpdate.duration = noteToUpdate.endTime - noteToUpdate.startTime;
                break;

            case 'resize-right':
                let resizeRightEnd = this.originalNote.endTime + deltaTime;
                if (this.snapEnabled) {
                    resizeRightEnd = this._snapToGrid(resizeRightEnd);
                }
                noteToUpdate.endTime = Math.max(noteToUpdate.startTime + 0.05, resizeRightEnd);
                noteToUpdate.duration = noteToUpdate.endTime - noteToUpdate.startTime;
                break;
        }

        noteToUpdate.userCorrected = true;

        // Update the drag note reference
        this.dragNote = noteToUpdate;

        // Re-sync notes and render
        this.notes = this.app.correctedNotes;
        this.render();

        // Update regions on waveform
        this.app.regionManager.updateRegion(noteToUpdate.id, {
            start: noteToUpdate.startTime,
            end: noteToUpdate.endTime,
            midi: noteToUpdate.midi
        });
    }

    /**
     * Handle mouse up to end dragging
     */
    _handleMouseUp(e) {
        if (this.isDragging && this.dragNote) {
            // Refresh regions to ensure sync
            this.app.regionManager.refresh();

            // Update ABC preview
            if (this.app.updateAbcPreview) {
                this.app.updateAbcPreview();
            }
        }

        this.isDragging = false;
        this.dragNote = null;
        this.dragType = null;
        this.originalNote = null;
        this.canvas.style.cursor = 'default';
    }

    /**
     * Select a note
     */
    selectNote(noteId) {
        this.selectedNoteId = noteId;
        this.render();

        // Notify note editor
        if (this.app.noteEditor) {
            this.app.noteEditor.selectNote(noteId);
        }
    }

    /**
     * Deselect current note
     */
    deselectNote() {
        this.selectedNoteId = null;
        this.render();

        if (this.app.noteEditor) {
            this.app.noteEditor.deselectNote();
        }
    }

    /**
     * Delete all notes in a measure/bar
     * @param {number} barStartTime - Start time of the bar in seconds
     * @param {number} barEndTime - End time of the bar in seconds
     * @param {number} measureIndex - Index of the measure
     */
    _deleteBar(barStartTime, barEndTime, measureIndex) {
        // Confirm deletion
        const notesInBar = this.app.correctedNotes.filter(note =>
            note.startTime >= barStartTime && note.startTime < barEndTime
        );

        if (notesInBar.length === 0) {
            return; // No notes to delete
        }

        if (!confirm(`Delete bar ${measureIndex + 1} (${notesInBar.length} note${notesInBar.length > 1 ? 's' : ''})?`)) {
            return;
        }

        // Remove notes from the corrected notes array
        this.app.correctedNotes = this.app.correctedNotes.filter(note =>
            !(note.startTime >= barStartTime && note.startTime < barEndTime)
        );

        // Deselect if the selected note was deleted
        if (this.selectedNoteId && !this.app.correctedNotes.find(n => n.id === this.selectedNoteId)) {
            this.deselectNote();
        }

        // Update all visualizations
        this.setNotes(this.app.correctedNotes);

        // Update ABC preview
        if (this.app.updateAbcPreview) {
            this.app.updateAbcPreview();
        }
    }

    /**
     * Update selection from external source
     */
    setSelectedNote(noteId) {
        this.selectedNoteId = noteId;
        this.render();
    }

    /**
     * Refresh display
     */
    refresh() {
        this.notes = this.app.correctedNotes;
        this.render();
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        if (this.spectrogramCanvas) {
            this.spectrogramCanvas.remove();
            this.spectrogramCanvas = null;
        }
        this.ctx = null;
        this.spectrogram = null;
        this.notes = [];
    }
}
