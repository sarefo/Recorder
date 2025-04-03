/**
 * Handles music notation extraction and processing
 */
class NotationParser {
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
     * Gets the key signature from the ABC notation
     * @returns {string} The key signature
     */
    extractKeySignature() {
        const keyMatch = this.currentAbc.match(/K:([A-G][#b]?m?)/);
        return keyMatch ? keyMatch[1] : 'C';
    }

    extractNotesUsingAbcjs(visualObj) {
        if (!visualObj || !visualObj.lines) {
            console.error("Invalid visual object for note extraction");
            return [];
        }

        // Extract key signature directly from the source ABC instead of relying on abcjs
        const keyDirective = this.currentAbc.match(/K:\s*([A-G][b#♭♯]?m?)/i);
        let keySignature = keyDirective ? keyDirective[1] : "C";

        // Normalize the key signature format (handle 'b' as flat)
        keySignature = keySignature.replace('b', '♭').replace('#', '♯');

        // Get accidentals from key signature
        const keyAccidentals = this.getAccidentalsForKey(keySignature);

        const notes = [];
        let measureAccidentals = {}; // Track accidentals within a measure

        // Navigate through the abcjs structure to find all notes
        visualObj.lines.forEach(line => {
            line.staff.forEach(staff => {
                staff.voices.forEach(voice => {
                    let currentMeasure = -1;

                    voice.forEach(element => {
                        // Check if we've entered a new measure
                        if (element.el_type === "bar") {
                            // Reset measure accidentals at bar lines
                            measureAccidentals = {};
                            currentMeasure++;
                            return;
                        }

                        // Only process note elements
                        if (element.el_type === "note" && !element.rest) {
                            // Extract each pitch in the note (for chords)
                            element.pitches.forEach(pitch => {
                                // Get basic note information
                                const noteLetter = pitch.name.toUpperCase().charAt(0); // Just the letter part (C, D, E, etc.)

                                // Check if there's an explicit accidental in this note
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
                                    // No explicit accidental or measure accidental, 
                                    // check key signature
                                    else if (keyAccidentals[noteLetter]) {
                                        accidental = keyAccidentals[noteLetter];
                                    }
                                }

                                // Construct the final note name
                                let noteName = accidental + pitch.name;

                                // Fix for duplicate natural signs (==E)
                                noteName = noteName.replace(/==+([A-Ga-g])/, "=$1");

                                // Remove any existing commas (octave shift down)
                                noteName = noteName.replace(/,/g, '');

                                notes.push(noteName);
                            });
                        } else if (element.el_type === "note" && element.rest) {
                            notes.push("rest");
                        }
                    });
                });
            });
        });

        console.log("Extracted notes:", notes);
        return notes;
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