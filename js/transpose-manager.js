/**
 * Manages music transposition using abcjs built-in functions
 */
class TransposeManager {
    constructor() {
        // No need for the extensive music theory data structures anymore
    }

    /**
     * Transposes the ABC notation using abcjs's built-in transposition
     * @param {string} abcString - The ABC notation to transpose
     * @param {Object} visualObj - The visual object from abcjs
     * @param {number} semitoneShift - The number of semitones to transpose
     * @returns {string} The transposed ABC notation
     */
    transposeAbc(abcString, visualObj, semitoneShift) {
        // Use abcjs's built-in transposition function
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