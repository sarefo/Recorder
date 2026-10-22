/**
 * MarkTracker - Keeps the red/green note marks and turns them into a lasting
 * record of which notes give trouble.
 *
 * Two separate things are kept:
 * - The marks themselves, as they stand on the tune: saved on every tap and
 *   put back when the tune is opened again, so they carry over between
 *   sessions and devices. A note is only put back if it still has the pitch it
 *   had when it was marked, so an edited or transposed tune loses its marks
 *   instead of showing them on the wrong notes.
 * - The trouble record: tapping a note cycles it neutral, red, green, so a red
 *   mark passed through on the way to green means nothing. A red mark counts
 *   once it has stayed red for DWELL_MS on the same tune. Any other state ends
 *   the wait, and nothing takes back counts already made: the record is of
 *   where trouble happened, not of whether it was fixed since.
 */
class MarkTracker {
    static DWELL_MS = 10 * 1000;

    /**
     * @param {Object} player - The ABC player instance
     */
    constructor(player) {
        this.player = player;
        this.timers = new Map();
        /** Set while many marks change at once, so they are saved as one */
        this.bulk = false;
    }

    /**
     * @returns {string|null} The open tune's path, if its marks can be kept.
     *   Only the first tune of a file is, as the other tunes in a file share
     *   its note indexes.
     * @private
     */
    persistablePath() {
        const path = this.player.fileManager.currentFilePath;
        return path && (this.player.tuneManager?.currentTuneIndex ?? 0) === 0 ? path : null;
    }

    /**
     * Called whenever a note's mark changes
     * @param {string} noteIndex - Index of the note in the rendered tune
     * @param {string} newState - 'red', 'green' or 'neutral'
     */
    onChange(noteIndex, newState) {
        clearTimeout(this.timers.get(noteIndex));
        this.timers.delete(noteIndex);
        if (this.bulk) return;

        const path = this.persistablePath();
        if (!path) return;
        this.saveState(path, noteIndex, newState);
        if (newState !== 'red') return;
        this.timers.set(noteIndex, setTimeout(
            () => this.commit(path, noteIndex), MarkTracker.DWELL_MS));
    }

    /**
     * Remembers the mark on a note and refreshes the clear button by the title
     * @private
     */
    saveState(path, noteIndex, newState) {
        const pitch = this.player.notationParser.extractCleanedNotes()[Number(noteIndex)]?.name;
        // Rests can be tapped too (long-press anchors) but are not worth keeping
        if (pitch && pitch !== 'rest') {
            this.player.userDataManager.setMarkState(path, noteIndex, newState, pitch);
        }
        this.player.fileManager.metadataUI.updateScoreTitleMark();
    }

    /**
     * Puts the remembered marks back on a freshly drawn tune. Sets the state
     * on the marker zones directly, so it is neither saved again nor counted
     * as new trouble; fingering diagrams drawn afterwards read it from there.
     * @param {Array<{name: string}>} notes - The tune's notes by index
     */
    restore(notes) {
        const path = this.persistablePath();
        const saved = path && this.player.userDataManager.data.markStates[path];
        if (!saved) return;
        for (const [index, mark] of Object.entries(saved.notes)) {
            const zone = document.querySelector(`.note-marker-zone[data-note-index="${index}"]`);
            if (!zone || zone.getAttribute('data-state') !== 'neutral') continue;
            if (notes[Number(index)]?.name !== mark.pitch) continue;
            zone.setAttribute('data-state', mark.state);
        }
    }

    /**
     * Removes every mark from the open tune, on screen and in the saved data.
     * The trouble record is kept.
     * @returns {number} How many notes were cleared
     */
    clearAll() {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        this.bulk = true;
        let cleared;
        try {
            cleared = this.player.fingeringManager.clearAllMarks();
        } finally {
            this.bulk = false;
        }
        const path = this.persistablePath();
        if (path) this.player.userDataManager.clearMarkStates(path);
        this.player.fileManager.metadataUI.updateScoreTitleMark();
        return cleared;
    }

    /**
     * Records a red mark that has stayed long enough
     * @param {string} path - The tune the mark was made on
     * @param {string} noteIndex - Index of the note
     * @private
     */
    commit(path, noteIndex) {
        this.timers.delete(noteIndex);
        // The tune changed or the mark was changed in the meantime
        if (this.player.fileManager.currentFilePath !== path) return;
        const zone = document.querySelector(`.note-marker-zone[data-note-index="${noteIndex}"]`);
        if (zone?.getAttribute('data-state') !== 'red') return;

        const context = MarkTracker.contextFor(this.player.notationParser.extractCleanedNotes(), Number(noteIndex));
        if (context) this.player.userDataManager.recordMark(path, noteIndex, context);
    }

    /**
     * What a mark needs to be understood later, without the tune: the note,
     * the note played just before it, and how often each occurs in the tune
     * (so a trouble spot can be weighed against how common it is).
     * Tied-on notes carry no new fingering and are skipped; a rest breaks
     * the transition.
     * @param {Array<{name: string, suppressDiagram: boolean}>} notes - Notes of the tune by index
     * @param {number} index - The marked note
     * @returns {{pitch: string, prev: string|null, pitchSeen: number, transSeen: number}|null}
     */
    static contextFor(notes, index) {
        const fingered = notes.map(note => (note && note.name !== 'rest' && !note.suppressDiagram) ? note.name : null);
        const previousOf = i => {
            for (let j = i - 1; j >= 0; j--) {
                if (notes[j]?.name === 'rest') return null;
                if (fingered[j]) return fingered[j];
            }
            return null;
        };

        const pitch = fingered[index];
        if (!pitch) return null;
        const prev = previousOf(index);

        let pitchSeen = 0;
        let transSeen = 0;
        fingered.forEach((name, i) => {
            if (name !== pitch) return;
            pitchSeen++;
            if (previousOf(i) === prev && prev) transSeen++;
        });
        return { pitch, prev, pitchSeen, transSeen };
    }
}
