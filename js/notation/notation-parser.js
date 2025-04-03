/**
 * Handles music notation extraction and processing
 */
class NotationParser {
    /**
     * Creates a new NotationParser instance with default ABC notation
     */
    constructor() {
        this.currentAbc = `X:1
T:Chromatic Scale
M:4/4
L:1/4
Q:1/4=120
K:C
C ^C D ^D | E F ^F G | ^G A ^A B |c ^c d ^d | e f ^f g |^g a z2 |`;
    }

    /**
     * Splits ABC notation into header, key, and notes sections
     * @param {string} abc - The ABC notation to parse
     * @returns {object} Sections of the ABC notation
     */
    parseAbcSections(abc) {
        const sections = {
            header: [],
            key: '',
            notes: []
        };

        const lines = abc.split('\n');
        let inNotes = false;

        for (const line of lines) {
            if (line.trim().startsWith('K:')) {
                sections.key = line;
                inNotes = true;
            } else if (!inNotes) {
                sections.header.push(line);
            } else {
                sections.notes.push(line);
            }
        }

        return sections;
    }

    /**
     * Reconstructs ABC notation from parsed sections
     * @param {object} sections - The sections to reconstruct
     * @returns {string} The reconstructed ABC notation
     */
    reconstructAbc(sections) {
        return [
            ...sections.header,
            sections.key,
            ...sections.notes
        ].join('\n');
    }

    /**
     * Gets the key signature from the current ABC notation
     * @returns {string} The key signature
     */
    extractKeySignature() {
        const keyMatch = this.currentAbc.match(/K:([A-G][#b]?m?)/);
        return keyMatch ? keyMatch[1] : 'C';
    }

    /**
     * Extracts notes from a visual object using abcjs
     * @param {Object} visualObj - The visual object from abcjs
     * @returns {string[]} Array of note names
     */
    extractNotesUsingAbcjs(visualObj) {
        if (!visualObj || !visualObj.lines) {
            console.error("Invalid visual object for note extraction");
            return [];
        }

        // Get key signature and its accidentals
        const keySignature = this._extractKeySignatureFromAbc();
        const keyAccidentals = this.getAccidentalsForKey(keySignature);

        const notes = [];
        let measureAccidentals = {}; // Track accidentals within a measure

        // Process all notes in the visual object
        this._processAllStaffLines(visualObj, notes, measureAccidentals, keyAccidentals);

        return notes;
    }

    /**
     * Extracts and normalizes the key signature from ABC notation
     * @private
     * @returns {string} Normalized key signature
     */
    _extractKeySignatureFromAbc() {
        const keyDirective = this.currentAbc.match(/K:\s*([A-G][b#♭♯]?m?)/i);
        let keySignature = keyDirective ? keyDirective[1] : "C";
        return keySignature.replace('b', '♭').replace('#', '♯');
    }

    /**
     * Processes all staff lines in the visual object to extract notes
     * @private
     * @param {Object} visualObj - The visual object from abcjs
     * @param {string[]} notes - Array to collect note names
     * @param {Object} measureAccidentals - Object to track accidentals within measures
     * @param {Object} keyAccidentals - Object with key signature accidentals
     */
    _processAllStaffLines(visualObj, notes, measureAccidentals, keyAccidentals) {
        visualObj.lines.forEach(line => {
            line.staff.forEach(staff => {
                staff.voices.forEach(voice => {
                    let currentMeasure = -1;
                    this._processVoice(voice, notes, measureAccidentals, currentMeasure, keyAccidentals);
                });
            });
        });
    }

    /**
     * Processes a single voice to extract notes
     * @private
     * @param {Object[]} voice - Array of elements in a voice
     * @param {string[]} notes - Array to collect note names
     * @param {Object} measureAccidentals - Object to track accidentals within measures
     * @param {number} currentMeasure - Current measure number
     * @param {Object} keyAccidentals - Object with key signature accidentals
     */
    _processVoice(voice, notes, measureAccidentals, currentMeasure, keyAccidentals) {
        voice.forEach(element => {
            if (element.el_type === "bar") {
                // Reset measure accidentals at bar lines
                measureAccidentals = {};
                currentMeasure++;
                return;
            }

            if (element.el_type === "note" && !element.rest) {
                this._processNoteElement(element, notes, measureAccidentals, keyAccidentals);
            } else if (element.el_type === "note" && element.rest) {
                notes.push("rest");
            }
        });
    }

    /**
     * Processes a note element to extract each pitch
     * @private
     * @param {Object} element - Note element from abcjs
     * @param {string[]} notes - Array to collect note names
     * @param {Object} measureAccidentals - Object to track accidentals within measures
     * @param {Object} keyAccidentals - Object with key signature accidentals
     */
    _processNoteElement(element, notes, measureAccidentals, keyAccidentals) {
        element.pitches.forEach(pitch => {
            const noteLetter = pitch.name.toUpperCase().charAt(0);
            const accidental = this._determineNoteAccidental(pitch, noteLetter, measureAccidentals, keyAccidentals);

            // Create the full note name
            const noteName = this._createNoteName(accidental, pitch, noteLetter, keyAccidentals);

            notes.push(noteName);
        });
    }

    /**
     * Determines the appropriate accidental for a note
     * @private
     * @param {Object} pitch - Pitch object from abcjs
     * @param {string} noteLetter - Base note letter
     * @param {Object} measureAccidentals - Object tracking accidentals in the measure
     * @param {Object} keyAccidentals - Object with key signature accidentals
     * @returns {string} The appropriate accidental symbol
     */
    _determineNoteAccidental(pitch, noteLetter, measureAccidentals, keyAccidentals) {
        let accidental = '';

        if (pitch.accidental === "sharp") {
            accidental = '^';
            measureAccidentals[noteLetter] = '^';
        } else if (pitch.accidental === "flat") {
            accidental = '_';
            measureAccidentals[noteLetter] = '_';
        } else if (pitch.accidental === "natural") {
            accidental = '=';
            measureAccidentals[noteLetter] = '=';
        } else if (pitch.accidental === "dblsharp") {
            accidental = '^^';
            measureAccidentals[noteLetter] = '^^';
        } else if (pitch.accidental === "dblflat") {
            accidental = '__';
            measureAccidentals[noteLetter] = '__';
        } else {
            // Check for accidentals in the current measure
            if (measureAccidentals[noteLetter]) {
                accidental = measureAccidentals[noteLetter];
            }
            // No explicit accidental or measure accidental, check key signature
            else if (keyAccidentals[noteLetter]) {
                accidental = keyAccidentals[noteLetter];
            }
        }

        return accidental;
    }

    /**
     * Creates the full note name with accidental and handles special cases
     * @private
     * @param {string} accidental - The accidental symbol
     * @param {Object} pitch - The pitch object from abcjs
     * @param {string} noteLetter - The base note letter
     * @param {Object} keyAccidentals - Object with key signature accidentals
     * @returns {string} The full note name
     */
    _createNoteName(accidental, pitch, noteLetter, keyAccidentals) {
        let noteName;

        // For natural signs - they override any previous accidentals
        if (accidental === '=') {
            noteName = '=' + pitch.name;
        }
        // Handle special case with explicit flat in B♭ key
        else if (accidental === '_' && noteLetter === 'B' && keyAccidentals['B'] === '_') {
            noteName = '_' + pitch.name;  // Just use a single flat
        }
        // All other cases - use accidental as determined
        else {
            noteName = accidental + pitch.name;
        }

        // Remove any existing commas (octave shift down)
        return noteName.replace(/,/g, '');
    }

    /**
     * Normalizes an accidental string to handle duplicate accidentals
     * @param {string} accidental - The accidental string to normalize
     * @returns {string} The normalized accidental string
     */
    normalizeAccidental(accidental) {
        // Handle common cases of duplicated accidentals
        if (accidental === '==') return '=';  // Double natural signs become a single natural
        if (accidental === '^^') return '^^'; // Keep double sharp
        if (accidental === '__') return '__'; // Keep double flat

        // Remove any additional repetitions of accidentals beyond what's valid
        if (accidental.startsWith('=') && accidental.length > 1) return '=';
        if (accidental.startsWith('^') && accidental.length > 2) return accidental.substring(0, 2);
        if (accidental.startsWith('_') && accidental.length > 2) return accidental.substring(0, 2);

        return accidental;
    }

    /**
     * Gets the musical content part from the ABC notation (after K: line)
     * @returns {string} The musical content
     */
    extractMusicContent() {
        const parts = this.currentAbc.split(/K:[^\n]+\n/);
        if (parts.length < 2) return '';

        // Filter out lyrics lines before processing
        const content = parts[1]
            .split('\n')
            .filter(line => !line.trim().startsWith('w:'))
            .join('\n');

        return content
            .replace(/\\\s*\n/g, ' ')  // Handle line continuations
            .replace(/V:\d+/g, ' ')    // Remove voice indicators
            .replace(/\|/g, ' |')      // Add space after bar lines for easier parsing
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();
    }

    /**
     * Gets accidentals for a key signature
     * @param {string} key - The key signature
     * @returns {object} Mapping of notes to accidentals
     */
    getAccidentalsForKey(key) {
        // Standardize key format
        const normalizedKey = key.replace('#', '♯').replace('b', '♭');
        const isMinor = normalizedKey.endsWith('m');
        const baseKey = isMinor ? normalizedKey.slice(0, -1) : normalizedKey;

        // Key signature definitions (which notes are affected)
        const keySignatures = {
            // Major keys with sharps
            'C': {},  // No accidentals
            'G': { 'F': '^' },  // F♯
            'D': { 'F': '^', 'C': '^' },  // F♯, C♯
            'A': { 'F': '^', 'C': '^', 'G': '^' },  // F♯, C♯, G♯
            'E': { 'F': '^', 'C': '^', 'G': '^', 'D': '^' },  // F♯, C♯, G♯, D♯
            'B': { 'F': '^', 'C': '^', 'G': '^', 'D': '^', 'A': '^' },  // F♯, C♯, G♯, D♯, A♯
            'F♯': { 'F': '^', 'C': '^', 'G': '^', 'D': '^', 'A': '^', 'E': '^' },  // F♯, C♯, G♯, D♯, A♯, E♯
            'C♯': { 'F': '^', 'C': '^', 'G': '^', 'D': '^', 'A': '^', 'E': '^', 'B': '^' },  // F♯, C♯, G♯, D♯, A♯, E♯, B♯

            // Major keys with flats
            'F': { 'B': '_' },  // B♭
            'B♭': { 'B': '_', 'E': '_' },  // B♭, E♭
            'E♭': { 'B': '_', 'E': '_', 'A': '_' },  // B♭, E♭, A♭
            'A♭': { 'B': '_', 'E': '_', 'A': '_', 'D': '_' },  // B♭, E♭, A♭, D♭
            'D♭': { 'B': '_', 'E': '_', 'A': '_', 'D': '_', 'G': '_' },  // B♭, E♭, A♭, D♭, G♭
            'G♭': { 'B': '_', 'E': '_', 'A': '_', 'D': '_', 'G': '_', 'C': '_' },  // B♭, E♭, A♭, D♭, G♭, C♭
            'C♭': { 'B': '_', 'E': '_', 'A': '_', 'D': '_', 'G': '_', 'C': '_', 'F': '_' },  // B♭, E♭, A♭, D♭, G♭, C♭, F♭
        };

        // Check for any aliases or alternate formats
        const keyAliases = {
            'Bb': 'B♭',
            'Eb': 'E♭',
            'Ab': 'A♭',
            'Db': 'D♭',
            'Gb': 'G♭',
            'Cb': 'C♭',
            'F#': 'F♯',
            'C#': 'C♯',
            'G#': 'G♯',
            'D#': 'D♯',
            'A#': 'A♯',
            'E#': 'E♯',
            'B#': 'B♯'
        };

        // Try to resolve the key using aliases if needed
        const resolvedKey = keyAliases[baseKey] || baseKey;

        // Map minor keys to their relative major
        const minorToRelativeMajor = {
            'Am': 'C', 'Em': 'G', 'Bm': 'D', 'F♯m': 'A', 'C♯m': 'E', 'G♯m': 'B', 'D♯m': 'F♯', 'A♯m': 'C♯',
            'Dm': 'F', 'Gm': 'B♭', 'Cm': 'E♭', 'Fm': 'A♭', 'B♭m': 'D♭', 'E♭m': 'G♭', 'A♭m': 'C♭'
        };

        if (isMinor) {
            return keySignatures[minorToRelativeMajor[normalizedKey]] || {};
        }

        return keySignatures[resolvedKey] || {};
    }

    /**
     * Determines if a note is inside a chord structure
     * @param {string} musicPart - The music content
     * @param {number} matchIndex - The index of the note match
     * @returns {boolean} Whether the note is in a chord
     */
    isNoteInChord(musicPart, matchIndex) {
        return musicPart.charAt(matchIndex - 1) === '[';
    }

    /**
     * Determines if we've reached a bar line and should reset accidentals
     * @param {string} musicPart - The music content
     * @param {number} matchIndex - The index of the current note match
     * @returns {boolean} Whether accidentals should be reset
     */
    shouldResetAccidentals(musicPart, matchIndex) {
        const textBeforeMatch = musicPart.substring(0, matchIndex);
        const lastBarIndex = textBeforeMatch.lastIndexOf('|');
        const lastNoteIndex = textBeforeMatch.search(/[A-Ga-g][']*$/);

        return lastBarIndex > lastNoteIndex && lastBarIndex !== -1;
    }

    /**
     * Determines the appropriate accidental for a note based on
     * explicit marking, measure accidentals, or key signature
     * @param {string} accidental - Explicit accidental
     * @param {string} baseNote - The base note letter
     * @param {object} measureAccidentals - Accidentals set in this measure
     * @param {object} keyAccidentals - Accidentals from the key signature
     * @returns {string} The appropriate accidental
     */
    determineAccidental(accidental, baseNote, measureAccidentals, keyAccidentals) {
        if (accidental) {
            return accidental;
        } else if (measureAccidentals[baseNote]) {
            return measureAccidentals[baseNote];
        } else if (keyAccidentals[baseNote]) {
            return keyAccidentals[baseNote];
        }
        return '';
    }

    /**
     * Extracts notes from the ABC notation
     * @returns {string[]} Array of note names
     */
    extractNotesFromAbc() {
        // Get the key and determine its accidentals
        const key = this.extractKeySignature();
        const keyAccidentals = this.getAccidentalsForKey(key);

        // Get the musical content, filtering out lyrics lines
        const musicPart = this.filterLyricsLines(this.extractMusicContent());
        if (!musicPart) return [];

        // Extract notes with accidentals and octave markers, including rests
        const notes = [];
        const noteRegex = /([_^=]?)([A-Ga-gz])([,']*)/g; // Updated to include 'z' (rest)
        let match;

        // Track accidentals that apply within a measure
        let measureAccidentals = {};

        while ((match = noteRegex.exec(musicPart)) !== null) {
            // Skip notes within chord structures
            if (this.isNoteInChord(musicPart, match.index)) continue;

            let [, accidental, noteLetter, octaveMarkers] = match;

            // Handle rests (z)
            if (noteLetter === 'z') {
                notes.push('rest');
                continue;
            }

            const baseNote = noteLetter.toUpperCase();

            // Check if we've reached a bar line, and reset measure accidentals if so
            if (this.shouldResetAccidentals(musicPart, match.index)) {
                measureAccidentals = {};
            }

            // Determine the appropriate accidental
            const finalAccidental = this.determineAccidental(
                accidental,
                baseNote,
                measureAccidentals,
                keyAccidentals
            );

            // Store explicit accidental for this note in the current measure
            if (accidental) {
                measureAccidentals[baseNote] = accidental;
            }

            const noteName = finalAccidental + noteLetter + octaveMarkers;
            notes.push(noteName);
        }

        return notes;
    }

    /**
     * Filters out lyrics lines from ABC notation
     * @param {string} abcContent - The ABC notation content
     * @returns {string} ABC content without lyrics lines
     */
    filterLyricsLines(abcContent) {
        // Split by lines, filter out lyrics lines, and rejoin
        return abcContent
            .split('\n')
            .filter(line => !line.trim().startsWith('w:'))
            .join('\n');
    }

    /**
     * Extracts notes from the ABC notation using a cleaned version
     * Creates a temporary and cleaner version of the ABC notation to extract only playable notes
     * Filters out parts, chord symbols, and other non-note elements
     * @returns {string[]} Array of note names
     */
    extractCleanedNotes() {
        try {
            if (window.app && window.app.renderManager && window.app.renderManager.currentVisualObj) {
                // If we have a valid visual object, use it to extract notes
                return this.extractNotesUsingAbcjs(window.app.renderManager.currentVisualObj);
            }

            // No visual object available, fall back to the original method
            console.warn("No visual object available, falling back to regex-based extraction");
            return this.extractNotesFromAbc();
        } catch (error) {
            console.error("Error extracting notes:", error);
            return this.extractNotesFromAbc();
        }
    }
}