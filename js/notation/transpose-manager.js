/**
 * Manages music transposition using abcjs built-in functions
 */
class TransposeManager {
    constructor() {
        this.DIZI_TRANSPOSE_SEMITONES = 3;
    }

    /**
     * Transposes the ABC notation by creating a fresh visual object
     * @param {string} currentAbc - The current ABC notation
     * @param {number} semitoneShift - The number of semitones to transpose
     * @returns {string} The transposed ABC notation
     */
    transpose(currentAbc, semitoneShift) {
        try {
            // Normalize line endings to LF (\n)
            const normalizedAbc = currentAbc.replace(/\r\n/g, '\n');

            // Create or reuse hidden div for transposition
            const tempDiv = this.getOrCreateTempDiv();

            // Create a fresh visual object with normalized ABC
            const freshVisualObj = ABCJS.renderAbc(tempDiv.id, normalizedAbc, {
                generateDownload: false,
                generateInline: false
            });

            // Apply transposition
            let transposedAbc = ABCJS.strTranspose(
                normalizedAbc,
                freshVisualObj,
                semitoneShift
            );

            // Ensure proper line ending after key line
            if (!transposedAbc.match(/K:.*\n/)) {
                transposedAbc = transposedAbc.replace(/(K:.*?)([A-Ga-g])/, '$1\n$2');
            }

            return transposedAbc;
        } catch (error) {
            console.error('Transposition error:', error);
            return currentAbc;
        }
    }

    /**
     * Gets or creates the temporary div for transposition
     * @returns {HTMLElement} The temp div
     * @private
     */
    getOrCreateTempDiv() {
        let tempDiv = document.getElementById('transposition-temp');
        if (!tempDiv) {
            tempDiv = document.createElement('div');
            tempDiv.id = 'transposition-temp';
            tempDiv.className = 'temp-hidden';
            document.body.appendChild(tempDiv);
        }
        return tempDiv;
    }

    /**
     * Calculates semitone shift for fingering system changes
     * @param {string} fromSystem - The previous fingering system
     * @param {string} toSystem - The new fingering system
     * @returns {number} Semitone shift (0 if no transposition needed)
     */
    getFingeringSystemShift(fromSystem, toSystem) {
        const isDiziFrom = fromSystem === 'diziD';
        const isDiziTo = toSystem === 'diziD';

        // Skip if no transposition needed
        if (isDiziFrom === isDiziTo) {
            return 0;
        }

        // Down 3 for switch to dizi, up 3 for switch from dizi
        return isDiziTo ? -this.DIZI_TRANSPOSE_SEMITONES : this.DIZI_TRANSPOSE_SEMITONES;
    }

    /**
     * Transposes the ABC notation using abcjs's built-in transposition
     * @param {string} abcString - The ABC notation to transpose
     * @param {Object} visualObj - The visual object from abcjs
     * @param {number} semitoneShift - The number of semitones to transpose
     * @returns {string} The transposed ABC notation
     * @deprecated Use transpose() instead
     */
    transposeAbc(abcString, visualObj, semitoneShift) {
        return ABCJS.strTranspose(abcString, visualObj, semitoneShift);
    }

    /**
     * Utility for transposing the key signature line only
     * @param {string} keyLine - The key directive line
     * @param {number} semitoneShift - The number of semitones to transpose
     * @param {Object} visualObj - The visual object from abcjs
     * @returns {string} The transposed key line
     */
    transposeKey(keyLine, semitoneShift, visualObj) {
        // Extract just the key portion of the key line for processing
        const keyLineOnly = `X:1\n${keyLine}\n`;
        const transposed = ABCJS.strTranspose(keyLineOnly, visualObj, semitoneShift);

        // Extract the transposed key line
        const lines = transposed.split('\n');
        for (const line of lines) {
            if (line.trim().startsWith('K:')) {
                return line;
            }
        }

        // Return original if something went wrong
        return keyLine;
    }
}