/**
 * MarkTracker - Turns red/green note marks into a lasting record of which
 * notes give trouble.
 *
 * Tapping a note cycles it neutral, red, green, so a red mark that was only
 * passed through on the way to green means nothing. A red mark counts once it
 * has stayed red for DWELL_MS on the same tune. Any other state ends the wait,
 * and neither green nor neutral takes back counts already made: the record is
 * of where trouble happened, not of whether it was fixed since.
 */
class MarkTracker {
    static DWELL_MS = 10 * 1000;

    /**
     * @param {Object} player - The ABC player instance
     */
    constructor(player) {
        this.player = player;
        this.timers = new Map();
    }

    /**
     * Called whenever a note's mark changes
     * @param {string} noteIndex - Index of the note in the rendered tune
     * @param {string} newState - 'red', 'green' or 'neutral'
     */
    onChange(noteIndex, newState) {
        clearTimeout(this.timers.get(noteIndex));
        this.timers.delete(noteIndex);
        if (newState !== 'red') return;

        const path = this.player.fileManager.currentFilePath;
        if (!path) return;
        this.timers.set(noteIndex, setTimeout(
            () => this.commit(path, noteIndex), MarkTracker.DWELL_MS));
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
