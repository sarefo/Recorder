/**
 * PianoRoll - Interactive piano roll visualization for note editing
 */

import { midiToNoteName, getConfidenceColor } from '../core/utils.js';

export class PianoRoll {
    constructor(app, containerId) {
        this.app = app;
        this.containerId = containerId;
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.notes = [];
        this.selectedNoteId = null;
        this.duration = 0;
        this.pixelsPerSecond = 100;
        this.noteHeight = 10;

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
    }

    /**
     * Initialize the piano roll
     */
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'piano-roll-canvas';
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

            // Add padding of 3 semitones above and below
            this.midiMin = Math.max(36, minMidi - 3);  // Don't go below C2
            this.midiMax = Math.min(96, maxMidi + 3);  // Don't go above C7

            // Ensure at least 12 semitones (one octave) visible
            if (this.midiMax - this.midiMin < 12) {
                const center = Math.floor((this.midiMin + this.midiMax) / 2);
                this.midiMin = Math.max(36, center - 6);
                this.midiMax = Math.min(96, center + 6);
            }

            console.log(`Piano roll range: MIDI ${this.midiMin} to ${this.midiMax} (${midiToNoteName(this.midiMin)} to ${midiToNoteName(this.midiMax)})`);
        }

        // Calculate pixels per second to fit the container
        const availableWidth = this.canvas.width - this.keyWidth - 20;
        this.pixelsPerSecond = Math.max(50, availableWidth / duration);

        // Resize canvas height based on MIDI range
        this._resize();
        this.render();
    }

    /**
     * Render the piano roll
     */
    render() {
        if (!this.ctx || !this.canvas) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);

        // Draw piano keys on the left
        this._drawPianoKeys();

        // Draw grid lines
        this._drawGrid();

        // Draw notes
        this._drawNotes();

        // Draw time markers
        this._drawTimeMarkers();
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

        // Vertical lines for time (every 0.5 seconds)
        ctx.strokeStyle = '#d0d0d0';
        for (let t = 0; t <= this.duration; t += 0.5) {
            const x = this._timeToX(t);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }

        // Stronger lines every second
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1;
        for (let t = 0; t <= this.duration; t += 1) {
            const x = this._timeToX(t);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
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
                noteToUpdate.startTime = Math.max(0, this.originalNote.startTime + deltaTime);
                noteToUpdate.endTime = this.originalNote.endTime + deltaTime;
                noteToUpdate.midi = Math.max(this.midiMin, Math.min(this.midiMax, this.originalNote.midi + deltaMidi));
                noteToUpdate.noteName = midiToNoteName(noteToUpdate.midi);
                break;

            case 'resize-left':
                noteToUpdate.startTime = Math.max(0, Math.min(noteToUpdate.endTime - 0.05, this.originalNote.startTime + deltaTime));
                noteToUpdate.duration = noteToUpdate.endTime - noteToUpdate.startTime;
                break;

            case 'resize-right':
                noteToUpdate.endTime = Math.max(noteToUpdate.startTime + 0.05, this.originalNote.endTime + deltaTime);
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
        this.ctx = null;
        this.notes = [];
    }
}
