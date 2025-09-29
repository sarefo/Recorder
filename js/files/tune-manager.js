/**
 * Manages multiple tunes within an ABC file
 */
class TuneManager {
    constructor(player) {
        this.player = player;
        this.currentTuneIndex = 0;
    }

    /**
     * Gets the total number of tunes in the current ABC notation
     * @returns {number} The number of tunes
     */
    getTuneCount() {
        const matches = this.player.notationParser.currentAbc.match(/X:\s*\d+/g);
        return matches ? matches.length : 1;
    }

    /**
     * Sets the current tune index within valid range
     * @param {number} index - The index to set
     * @returns {number} The actually set index (adjusted if needed)
     */
    setTuneIndex(index) {
        const tuneCount = this.getTuneCount();

        // Ensure index is within valid range (loop around if needed)
        if (index < 0) {
            index = tuneCount - 1;
        } else if (index >= tuneCount) {
            index = 0;
        }

        this.currentTuneIndex = index;
        return this.currentTuneIndex;
    }

    /**
     * Navigate to the next tune
     * @returns {number} The new tune index
     */
    nextTune() {
        return this.setTuneIndex(this.currentTuneIndex + 1);
    }

    /**
     * Navigate to the previous tune
     * @returns {number} The new tune index
     */
    previousTune() {
        return this.setTuneIndex(this.currentTuneIndex - 1);
    }

    /**
     * Get information about the current tune and total tunes
     * @returns {Object} Object containing current index, total, and display string
     */
    getCurrentTuneInfo() {
        const tuneCount = this.getTuneCount();
        return {
            current: this.currentTuneIndex,
            total: tuneCount,
            display: `${this.currentTuneIndex + 1}/${tuneCount}`
        };
    }

    /**
     * Reset to the first tune
     */
    resetToFirstTune() {
        this.currentTuneIndex = 0;
    }

    /**
     * Extract the title of the current tune
     * @returns {string} The title of the current tune
     */
    getCurrentTuneTitle() {
        // Match all tune headers
        const tuneRegex = /(X:\s*\d+[\s\S]*?)(?=X:\s*\d+|$)/g;
        const matches = [...this.player.notationParser.currentAbc.matchAll(tuneRegex)];

        if (matches.length > this.currentTuneIndex) {
            const currentTuneContent = matches[this.currentTuneIndex][0];

            // Extract title
            const titleMatch = currentTuneContent.match(/T:([^\r\n]+)/);
            if (titleMatch && titleMatch[1]) {
                return titleMatch[1].trim();
            }
        }

        return `Tune ${this.currentTuneIndex + 1}`;
    }

    /**
     * Extract the ABC content of just the current tune
     * @returns {string} The ABC content for the current tune only
     */
    getCurrentTuneAbc() {
        // Match all tune headers
        const tuneRegex = /(X:\s*\d+[\s\S]*?)(?=X:\s*\d+|$)/g;
        const matches = [...this.player.notationParser.currentAbc.matchAll(tuneRegex)];

        if (matches.length > this.currentTuneIndex) {
            return matches[this.currentTuneIndex][0].trim();
        }

        // Fallback: return the entire ABC if no matches (single tune file)
        return this.player.notationParser.currentAbc;
    }
}