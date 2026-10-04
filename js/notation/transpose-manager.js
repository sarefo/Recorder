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
     * Finds the lowest and highest sounding MIDI pitches of the ABC
     * @param {string} abc - The ABC notation
     * @returns {{low: number, high: number}|null} The range, or null if there are no notes
     */
    getPitchRange(abc) {
        try {
            // chordsOff: otherwise the generated bass line drags the low end down
            const midi = ABCJS.synth.getMidiFile(abc.replace(/\r\n/g, '\n'),
                { midiOutputType: 'binary', chordsOff: true })[0];
            if (!midi) return null;

            const bytes = Object.values(midi);
            const pitches = [];
            let p = 0;
            const u32 = () => (bytes[p++] << 24 | bytes[p++] << 16 | bytes[p++] << 8 | bytes[p++]) >>> 0;
            const varLen = () => {
                let length = 0, b;
                do { b = bytes[p++]; length = (length << 7) | (b & 0x7f); } while (b & 0x80);
                return length;
            };

            p = 4;
            const headerLength = u32();
            p += headerLength;
            while (p < bytes.length - 8) {
                const tag = String.fromCharCode(...bytes.slice(p, p + 4));
                p += 4;
                const trackLength = u32();
                const end = p + trackLength;
                if (tag !== 'MTrk') { p = end; continue; }

                let status = 0;
                while (p < end) {
                    varLen(); // delta time
                    if (p >= end) break;
                    if (bytes[p] & 0x80) status = bytes[p++];
                    const type = status & 0xf0;

                    if (status === 0xff) {
                        p++;
                        const metaLength = varLen();
                        p += metaLength;
                    } else if (status === 0xf0 || status === 0xf7) {
                        const sysexLength = varLen();
                        p += sysexLength;
                    } else if (type === 0x90) {
                        const pitch = bytes[p++], velocity = bytes[p++];
                        if (velocity > 0 && (status & 0x0f) !== 9) pitches.push(pitch);
                    } else if (type === 0xc0 || type === 0xd0) {
                        p += 1;
                    } else {
                        p += 2;
                    }
                }
                p = end;
            }

            if (!pitches.length) return null;
            return { low: Math.min(...pitches), high: Math.max(...pitches) };
        } catch (error) {
            console.error('Pitch range error:', error);
            return null;
        }
    }

    /**
     * Semitone shift that puts the lowest note on C4 or the highest on C6
     * @param {string} abc - The ABC notation
     * @param {string} edge - 'bottom' (lowest note becomes C4) or 'top' (highest becomes C6)
     * @returns {number} The shift in semitones (0 if there are no notes)
     */
    getShiftToEdge(abc, edge) {
        const range = this.getPitchRange(abc);
        if (!range) return 0;
        return edge === 'bottom' ? 60 - range.low : 84 - range.high;
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