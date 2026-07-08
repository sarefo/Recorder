/**
 * ReviewWizard - Guided, ear-first note correction.
 *
 * Steps through the detected notes one at a time. For each note it plays
 * the original audio slice, then the detected pitch, so wrong notes can be
 * heard (not read) and fixed with the arrow keys - no dragging needed.
 *
 * Keys while active (captured before the normal editor shortcuts):
 *   Up/Down  - change pitch, immediately previews the new pitch
 *   R / Left - replay original + detected comparison
 *   Enter/Space - accept note, advance to next
 *   Delete/Backspace - remove note, advance
 *   Escape   - finish review
 */

import { showFeedback } from '../core/utils.js';

export class ReviewWizard {
    constructor(app) {
        this.app = app;
        this.active = false;
        this.queue = [];      // note ids in playback order
        this.index = 0;
        this.playToken = 0;   // invalidates pending scheduled playback
        this._keyHandler = (e) => this._handleKey(e);
        this._sliceSource = null;
    }

    /**
     * Bind panel buttons (call once at app init)
     */
    init() {
        const replayBtn = document.getElementById('rw-replay');
        const keepBtn = document.getElementById('rw-keep');
        const stopBtn = document.getElementById('rw-stop');
        if (replayBtn) replayBtn.addEventListener('click', () => this._playComparison());
        if (keepBtn) keepBtn.addEventListener('click', () => this._next());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stop());
    }

    /**
     * Start reviewing all notes in time order
     */
    start() {
        const notes = [...this.app.correctedNotes].sort((a, b) => a.startTime - b.startTime);
        if (notes.length === 0) {
            showFeedback('No notes to review');
            return;
        }

        this.queue = notes.map(n => n.id);
        this.index = 0;
        this.active = true;

        // Capture phase so these keys win over the regular editor shortcuts
        document.addEventListener('keydown', this._keyHandler, true);

        const panel = document.getElementById('review-wizard');
        if (panel) panel.classList.remove('hidden');

        this._present();
    }

    /**
     * Finish the review session
     */
    stop(message = 'Review finished') {
        if (!this.active) return;
        this.active = false;
        this.playToken++;
        this._stopSlice();
        this.app.synth.stop();
        document.removeEventListener('keydown', this._keyHandler, true);

        const panel = document.getElementById('review-wizard');
        if (panel) panel.classList.add('hidden');

        showFeedback(message);
    }

    // -----------------------------------------------------------------------

    _currentNote() {
        const id = this.queue[this.index];
        return this.app.correctedNotes.find(n => n.id === id) || null;
    }

    /**
     * Show and play the current note
     * @private
     */
    _present() {
        // Skip ids that no longer exist (deleted elsewhere)
        while (this.index < this.queue.length && !this._currentNote()) {
            this.index++;
        }
        if (this.index >= this.queue.length) {
            this.stop('Review complete ✓');
            return;
        }

        const note = this._currentNote();

        // Select across piano roll + ABC preview
        this.app.noteEditor.selectNote(note.id);

        // Update panel
        const progressEl = document.getElementById('rw-progress');
        const nameEl = document.getElementById('rw-note-name');
        const confEl = document.getElementById('rw-confidence');
        if (progressEl) progressEl.textContent = `${this.index + 1} / ${this.queue.length}`;
        if (nameEl) nameEl.textContent = note.noteName;
        if (confEl) {
            const pct = Math.round(note.confidence * 100);
            confEl.textContent = `${pct}%`;
            confEl.className = 'rw-conf ' + (pct >= 80 ? 'high' : pct >= 60 ? 'medium' : 'low');
        }

        this._playComparison();
    }

    /**
     * Play original audio slice, then the detected pitch
     * @private
     */
    _playComparison() {
        const note = this._currentNote();
        if (!note) return;

        const token = ++this.playToken;
        this._stopSlice();
        this.app.synth.stop();

        const sliceSec = this._playOriginalSlice(note);

        // Then the detected pitch on the synth
        setTimeout(() => {
            if (token !== this.playToken || !this.active) return;
            this.app.synth.playNote(note.midi, Math.min(Math.max(note.duration, 0.3), 1.2));
        }, sliceSec * 1000 + 250);
    }

    /**
     * Play the note's slice of the original recording
     * @returns {number} Slice duration in seconds
     * @private
     */
    _playOriginalSlice(note) {
        const buffer = this.app.audioBuffer;
        if (!buffer) return 0;

        const synth = this.app.synth;
        synth.init(); // ensures audioContext + masterGain exist

        const pad = 0.03;
        const start = Math.max(0, note.startTime - pad);
        const duration = Math.min(note.duration + pad * 2, 2.0);

        const src = synth.audioContext.createBufferSource();
        src.buffer = buffer;
        src.connect(synth.masterGain);
        src.start(0, start, duration);
        this._sliceSource = src;

        return duration;
    }

    _stopSlice() {
        if (this._sliceSource) {
            try { this._sliceSource.stop(); } catch (e) { /* already stopped */ }
            this._sliceSource = null;
        }
    }

    _next() {
        this.index++;
        this._present();
    }

    /**
     * @private
     */
    _handleKey(e) {
        if (!this.active) return;
        // Leave browser/system shortcuts (incl. Ctrl+Z undo) alone
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const note = this._currentNote();

        switch (e.code) {
            case 'ArrowUp':
            case 'ArrowDown': {
                if (!note) break;
                const delta = e.code === 'ArrowUp' ? 1 : -1;
                this.app.noteEditor.changePitch(note.id, note.midi + delta);
                const updated = this._currentNote();
                const nameEl = document.getElementById('rw-note-name');
                if (nameEl && updated) nameEl.textContent = updated.noteName;
                // Quick audible feedback with the new pitch only
                this.playToken++;
                this._stopSlice();
                this.app.synth.stop();
                if (updated) this.app.synth.previewNote(updated.midi, 0.4);
                break;
            }

            case 'KeyR':
            case 'ArrowLeft':
                this._playComparison();
                break;

            case 'Enter':
            case 'Space':
            case 'ArrowRight':
                this._next();
                break;

            case 'Delete':
            case 'Backspace':
                if (note) {
                    this.app.noteEditor.deleteNote(note.id);
                }
                this._present(); // same index now points at the next note
                break;

            case 'Escape':
                this.stop();
                break;

            default:
                return; // don't swallow other keys
        }

        e.preventDefault();
        e.stopPropagation();
    }
}
