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
z A, ^A, B, |C ^C D ^D | E F ^F G | ^G A ^A B |c ^c d ^d | e f ^f g |^g a z2 |`;
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
     * @returns {Array} Array of objects with note names and tied status
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
            if (line.staff) {
                line.staff.forEach(staff => {
                    staff.voices.forEach(voice => {
                        let currentMeasure = -1;
                        this._processVoice(voice, notes, measureAccidentals, currentMeasure, keyAccidentals);
                    });
                });
            }
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
                Object.keys(measureAccidentals).forEach(key => {
                    delete measureAccidentals[key];
                });

                currentMeasure++;
                return;
            }

            if (element.el_type === "note" && !element.rest) {
                this._processNoteElement(element, notes, measureAccidentals, keyAccidentals);
            } else if (element.el_type === "note" && element.rest) {
                notes.push({
                    name: "rest",
                    suppressDiagram: false,
                    isTieStart: false,
                    isTieEnd: false
                });
            }
        });
    }

    /**
     * Processes a note element to extract each pitch
     * @private
     * @param {Object} element - Note element from abcjs
     * @param {Array} notes - Array to collect note objects
     * @param {Object} measureAccidentals - Object to track accidentals within measures
     * @param {Object} keyAccidentals - Object with key signature accidentals
     */
    _processNoteElement(element, notes, measureAccidentals, keyAccidentals) {
        element.pitches.forEach(pitch => {
            // FIXED: Properly extract just the letter from the note name
            // First, remove any accidentals from the beginning
            const baseName = pitch.name.replace(/^[=^_]+/, '');
            // Then get the first character (the note letter)
            const noteLetter = baseName.charAt(0).toUpperCase();

            const accidental = this._determineNoteAccidental(pitch, noteLetter, measureAccidentals, keyAccidentals);

            // Create the full note name
            const noteName = this._createNoteName(accidental, pitch, noteLetter, keyAccidentals);

            // Check if this note is tied to the next note
            const isTieStart = element.startTie || element.startSlur;
            const isTieEnd = element.endTie || element.endSlur;

            // Debug logging to see what abcjs provides
            if (element.startTie || element.endTie || element.startSlur || element.endSlur) {
                console.log(`ABCJS Tie data for ${noteName}:`, {
                    startTie: element.startTie,
                    endTie: element.endTie,
                    startSlur: element.startSlur,
                    endSlur: element.endSlur,
                    isTieStart,
                    isTieEnd
                });
            }

            // Determine if this note should have its fingering diagram suppressed
            // Suppress diagrams for tied continuation notes (notes that end a tie but aren't the first note)
            const suppressDiagram = this._shouldSuppressFingeringDiagram(notes, noteName, isTieEnd);

            notes.push({
                name: noteName,
                suppressDiagram: suppressDiagram,
                isTieStart: isTieStart,
                isTieEnd: isTieEnd
            });
        });
    }

    /**
     * Determines if a fingering diagram should be suppressed for tied notes
     * @private
     * @param {Array} notes - Array of previously processed notes
     * @param {string} currentNoteName - Name of current note
     * @param {boolean} isTieEnd - Whether this note ends a tie
     * @returns {boolean} Whether to suppress the fingering diagram
     */
    _shouldSuppressFingeringDiagram(notes, currentNoteName, isTieEnd) {
        // Only suppress if this note ends a tie
        if (!isTieEnd) return false;

        // Look back through recent notes to find the matching tie start
        for (let i = notes.length - 1; i >= 0; i--) {
            const prevNote = notes[i];

            // Skip rests
            if (prevNote.name === 'rest') continue;

            // If we find a matching note that starts a tie, suppress this diagram
            if (prevNote.name === currentNoteName && prevNote.isTieStart) {
                return true;
            }

            // If we encounter a different note, stop looking (ties don't span different pitches)
            if (prevNote.name !== currentNoteName) {
                break;
            }
        }

        return false;
    }

    /**
     * Detects if current note ends a tie in regex-based parsing
     * @private
     * @param {Array} notes - Array of previously processed notes
     * @param {string} currentNoteName - Name of current note
     * @returns {boolean} Whether this note ends a tie
     */
    _detectTieEndInRegex(notes, currentNoteName) {
        // Look back through recent notes to find a matching tied note
        for (let i = notes.length - 1; i >= 0; i--) {
            const prevNote = notes[i];

            // Skip rests
            if (prevNote.name === 'rest') continue;

            // If we find a matching note with a tie start, this is a tie end
            if (prevNote.name === currentNoteName && prevNote.isTieStart) {
                return true;
            }

            // If we encounter a different note, stop looking
            if (prevNote.name !== currentNoteName) {
                break;
            }
        }

        return false;
    }

    /**
     * Extracts tie information from ABC notation using regex
     * @private
     * @returns {Set} Set of note positions that should be suppressed
     */
    extractTieInfoFromAbc() {
        const musicPart = this.filterLyricsLines(this.extractMusicContent());
        const suppressSet = new Set();
        const noteRegex = /([_^=]?)([A-Ga-gz])([,']*[0-9\/]*)([-]?)/g;
        let match;
        let noteIndex = 0;
        let lastTiedNote = null;
        let lastTiedIndex = -1;

        while ((match = noteRegex.exec(musicPart)) !== null) {
            if (this.isNoteInChord(musicPart, match.index)) continue;

            let [, accidental, noteLetter, octaveMarkers, tieMarker] = match;

            if (noteLetter === 'z') {
                noteIndex++;
                continue;
            }

            const cleanOctaveMarkers = octaveMarkers.replace(/[0-9\/]+/g, '');
            const noteName = accidental + noteLetter + cleanOctaveMarkers;

            // If this note matches the last tied note, suppress its diagram
            if (lastTiedNote === noteName && noteIndex === lastTiedIndex + 1) {
                suppressSet.add(noteIndex);
                console.log(`Marking note ${noteIndex} (${noteName}) for suppression`);
            }

            // If this note has a tie, remember it
            if (tieMarker === '-') {
                lastTiedNote = noteName;
                lastTiedIndex = noteIndex;
            } else {
                lastTiedNote = null;
                lastTiedIndex = -1;
            }

            noteIndex++;
        }

        return suppressSet;
    }

    /**
     * Merges tie information with abcjs extracted notes
     * @private
     * @param {Array} abcjsNotes - Notes from abcjs extraction
     * @param {Set} suppressSet - Set of indices to suppress
     * @returns {Array} Notes with tie information
     */
    mergeTieInformation(abcjsNotes, suppressSet) {
        return abcjsNotes.map((note, index) => {
            if (typeof note === 'string') {
                return {
                    name: note,
                    suppressDiagram: suppressSet.has(index),
                    isTieStart: false,
                    isTieEnd: suppressSet.has(index)
                };
            } else {
                return {
                    ...note,
                    suppressDiagram: suppressSet.has(index),
                    isTieEnd: suppressSet.has(index)
                };
            }
        });
    }

    /**
     * Adds tie detection directly to abcjs extracted notes
     * @private
     * @param {Array} abcjsNotes - Notes from abcjs extraction
     * @returns {Array} Notes with tie information
     */
    addTieDetectionToAbcjsNotes(abcjsNotes) {
        const result = abcjsNotes.map((note, index) => {
            if (typeof note === 'string') {
                return {
                    name: note,
                    suppressDiagram: false,
                    isTieStart: false,
                    isTieEnd: false
                };
            } else {
                return {
                    ...note,
                    suppressDiagram: false,
                    isTieStart: false,
                    isTieEnd: false
                };
            }
        });

        // Now detect ties by looking for consecutive identical notes
        for (let i = 0; i < result.length - 1; i++) {
            const currentNote = result[i];
            const nextNote = result[i + 1];

            // Skip rests
            if (currentNote.name === 'rest' || nextNote.name === 'rest') continue;

            // If current and next notes are the same, check for ties
            if (currentNote.name === nextNote.name) {
                console.log(`Found consecutive identical notes: ${currentNote.name} at positions ${i} and ${i + 1}`);
                // Check if there's a tie in the ABC notation between these positions
                const hasTie = this.isTieInOriginalAbc(i, i + 1);
                console.log(`Tie check result: ${hasTie}`);
                if (hasTie) {
                    currentNote.isTieStart = true;
                    nextNote.isTieEnd = true;
                    nextNote.suppressDiagram = true;
                    console.log(`Detected tie: ${currentNote.name} -> ${nextNote.name} (suppressing diagram for note ${i + 1})`);
                }
            }
        }

        return result;
    }

    /**
     * Checks if there's a tie in the original ABC notation between two note positions
     * @private
     * @param {number} pos1 - First note position
     * @param {number} pos2 - Second note position
     * @returns {boolean} Whether there's a tie
     */
    isTieInOriginalAbc(pos1, pos2) {
        // Extract notes from ABC and check for ties at specific positions
        const musicPart = this.filterLyricsLines(this.extractMusicContent());
        console.log(`Checking tie at positions ${pos1}-${pos2} in music: ${musicPart.substring(0, 100)}...`);
        const noteRegex = /([_^=]?)([A-Ga-gz])([,']*[0-9\/]*)([-]?)/g;
        let match;
        let noteIndex = 0;

        while ((match = noteRegex.exec(musicPart)) !== null) {
            if (this.isNoteInChord(musicPart, match.index)) continue;

            let [fullMatch, accidental, noteLetter, octaveMarkers, tieMarker] = match;

            if (noteLetter === 'z') {
                if (noteIndex === pos1) {
                    console.log(`Position ${pos1} is a rest, can't be tied`);
                    return false;
                }
                noteIndex++;
                continue;
            }

            // Debug log for the position we're checking
            if (noteIndex === pos1) {
                console.log(`At position ${pos1}: note='${fullMatch}', tieMarker='${tieMarker}'`);
                if (tieMarker === '-') {
                    console.log(`Found tie at position ${pos1}!`);
                    return true;
                }
            }

            noteIndex++;

            // If we've passed both positions, stop looking
            if (noteIndex > pos2) break;
        }

        console.log(`No tie found at position ${pos1}`);
        return false;
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
            measureAccidentals[noteLetter] = '^';  // Store by note letter
        } else if (pitch.accidental === "flat") {
            accidental = '_';
            measureAccidentals[noteLetter] = '_';  // Store by note letter
        } else if (pitch.accidental === "natural") {
            accidental = '=';
            measureAccidentals[noteLetter] = '=';  // Store by note letter
        } else if (pitch.accidental === "dblsharp") {
            accidental = '^^';
            measureAccidentals[noteLetter] = '^^'; // Store by note letter
        } else if (pitch.accidental === "dblflat") {
            accidental = '__';
            measureAccidentals[noteLetter] = '__'; // Store by note letter
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
        // Remove any existing accidentals from the beginning of the name
        const baseName = pitch.name.replace(/^[=^_]+/, '');

        // Create the note name with the correct accidental
        return accidental + baseName;
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
     * Extracts notes from ABC notation with proper tie detection
     * @returns {Array} Array of note objects with names and tied status
     */
    extractNotesFromAbcWithTies() {
        // Get the key and determine its accidentals
        const key = this.extractKeySignature();
        const keyAccidentals = this.getAccidentalsForKey(key);

        // Get the musical content, filtering out lyrics lines
        const musicPart = this.filterLyricsLines(this.extractMusicContent());
        if (!musicPart) return [];

        // Extract notes with proper tie detection
        const notes = [];
        const noteRegex = /([_^=]?)([A-Ga-gz])([,']*[0-9\/]*)([-]?)/g;
        let match;
        let measureAccidentals = {};

        while ((match = noteRegex.exec(musicPart)) !== null) {
            // Skip notes within chord structures
            if (this.isNoteInChord(musicPart, match.index)) continue;

            let [fullMatch, accidental, noteLetter, octaveMarkers, tieMarker] = match;

            // Handle rests (z)
            if (noteLetter === 'z') {
                notes.push({
                    name: 'rest',
                    suppressDiagram: false,
                    isTieStart: false,
                    isTieEnd: false
                });
                continue;
            }

            const baseNote = noteLetter.toUpperCase();

            // Check if we've reached a bar line, and reset measure accidentals if so
            if (this.shouldResetAccidentals(musicPart, match.index)) {
                Object.keys(measureAccidentals).forEach(key => {
                    delete measureAccidentals[key];
                });
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

            // Remove duration numbers from octave markers to get clean note name
            const cleanOctaveMarkers = octaveMarkers.replace(/[0-9\/]+/g, '');
            const noteName = finalAccidental + noteLetter + cleanOctaveMarkers;
            const isTieStart = tieMarker === '-';

            // Detect tie end by looking at the previous note
            const isTieEnd = this._detectTieEndForCurrentNote(notes, noteName);
            const suppressDiagram = isTieEnd; // Suppress diagram for tied continuation notes

            // Debug logging for tied notes
            if (isTieStart || isTieEnd) {
                console.log(`Tied note detected: ${noteName}, isTieStart: ${isTieStart}, isTieEnd: ${isTieEnd}, suppressDiagram: ${suppressDiagram}`);
            }

            notes.push({
                name: noteName,
                suppressDiagram: suppressDiagram,
                isTieStart: isTieStart,
                isTieEnd: isTieEnd
            });
        }

        return notes;
    }

    /**
     * Detects if current note ends a tie based on previous notes
     * @private
     * @param {Array} notes - Array of previously processed notes
     * @param {string} currentNoteName - Name of current note
     * @returns {boolean} Whether this note ends a tie
     */
    _detectTieEndForCurrentNote(notes, currentNoteName) {
        // Check if the immediately previous note is the same and has a tie start
        if (notes.length === 0) return false;

        const lastNote = notes[notes.length - 1];

        // If the last note is the same and starts a tie, this current note ends it
        return lastNote.name === currentNoteName && lastNote.isTieStart;
    }

    /**
     * Extracts tie suppression information from ABC notation
     * @returns {Array} Array of note names that should be suppressed
     */
    extractTieSuppressionInfo() {
        const musicPart = this.filterLyricsLines(this.extractMusicContent());
        const suppressions = [];
        const noteRegex = /([_^=]?)([A-Ga-gz])([,']*[0-9\/]*)([-]?)/g;
        let match;
        let lastTiedNote = null;

        while ((match = noteRegex.exec(musicPart)) !== null) {
            if (this.isNoteInChord(musicPart, match.index)) continue;

            let [, accidental, noteLetter, octaveMarkers, tieMarker] = match;

            if (noteLetter === 'z') {
                lastTiedNote = null;
                continue;
            }

            const cleanOctaveMarkers = octaveMarkers.replace(/[0-9\/]+/g, '');
            const noteName = accidental + noteLetter + cleanOctaveMarkers;

            // If this note matches the last tied note, it should be suppressed
            if (lastTiedNote === noteName) {
                suppressions.push(noteName);
            }

            // Update last tied note
            if (tieMarker === '-') {
                lastTiedNote = noteName;
            } else {
                lastTiedNote = null;
            }
        }

        return suppressions;
    }

    /**
     * Applies tie suppression information to abcjs extracted notes
     * @param {Array} abcjsNotes - Notes from abcjs
     * @param {Array} suppressions - Note names to suppress
     * @returns {Array} Notes with tie information applied
     */
    applyTieSuppressions(abcjsNotes, suppressions) {
        let suppressionIndex = 0;

        return abcjsNotes.map((note, index) => {
            const noteName = typeof note === 'string' ? note : note.name;

            // Normalize note names by removing accidentals for comparison
            const normalizedNoteName = this.normalizeNoteForComparison(noteName);
            const normalizedSuppression = suppressionIndex < suppressions.length ?
                this.normalizeNoteForComparison(suppressions[suppressionIndex]) : null;

            // Check if this note should be suppressed
            let suppressDiagram = false;
            if (suppressionIndex < suppressions.length && normalizedSuppression === normalizedNoteName) {
                suppressDiagram = true;
                suppressionIndex++;
            }

            if (typeof note === 'string') {
                return {
                    name: note,
                    suppressDiagram: suppressDiagram,
                    isTieStart: false,
                    isTieEnd: suppressDiagram
                };
            } else {
                return {
                    ...note,
                    suppressDiagram: suppressDiagram,
                    isTieEnd: suppressDiagram
                };
            }
        });
    }

    /**
     * Normalizes a note name for comparison by removing accidentals
     * @private
     * @param {string} noteName - The note name to normalize
     * @returns {string} Normalized note name
     */
    normalizeNoteForComparison(noteName) {
        if (!noteName || noteName === 'rest') return noteName;
        // Remove accidentals (^, _, =) from the beginning and duration/octave markers
        return noteName.replace(/^[_^=]+/, '').replace(/[,']*[0-9\/]*$/, '');
    }

    /**
     * Adds tie suppression to abcjs notes using simple pattern matching
     * @private
     * @param {Array} abcjsNotes - Notes from abcjs extraction
     * @returns {Array} Notes with tie information applied
     */
    addTieSuppressionToAbcjsNotes(abcjsNotes) {
        // Detect ties directly from abcjs visual object
        if (window.app && window.app.renderManager && window.app.renderManager.currentVisualObj) {
            const tiedIndices = this.detectTiesFromVisualObject(window.app.renderManager.currentVisualObj);

            return abcjsNotes.map((note, index) => {
                const noteData = typeof note === 'string' ?
                    { name: note, suppressDiagram: false, isTieStart: false, isTieEnd: false } :
                    { ...note, suppressDiagram: false, isTieStart: false, isTieEnd: false };

                if (tiedIndices.continuationIndices.has(index)) {
                    noteData.suppressDiagram = true;
                    noteData.isTieEnd = true;
                }

                if (tiedIndices.startIndices.has(index)) {
                    noteData.isTieStart = true;
                }

                return noteData;
            });
        }

        // Fallback: return notes without tie detection
        return abcjsNotes.map(note => {
            return typeof note === 'string' ?
                { name: note, suppressDiagram: false, isTieStart: false, isTieEnd: false } :
                { ...note, suppressDiagram: false, isTieStart: false, isTieEnd: false };
        });
    }

    /**
     * Detect ties directly from abcjs visual object
     * @param {Object} visualObj - The abcjs visual object
     * @returns {Object} Object with startIndices and continuationIndices sets
     */
    detectTiesFromVisualObject(visualObj) {
        const startIndices = new Set();
        const continuationIndices = new Set();

        if (!visualObj || !visualObj.lines) {
            return { startIndices, continuationIndices };
        }

        // Use EXACTLY the same traversal as extractNotesUsingAbcjs
        let noteIndex = 0;

        visualObj.lines.forEach(line => {
            if (line.staff) {
                line.staff.forEach(staff => {
                    staff.voices.forEach(voice => {
                        voice.forEach(element => {
                            // Skip bar elements (like extractNotesUsingAbcjs does)
                            if (element.el_type === "bar") {
                                return;
                            }

                            if (element.el_type === "note" && !element.rest) {
                                // Process note element with pitches
                                if (element.pitches) {
                                    element.pitches.forEach(pitch => {
                                        if (element.startTie || pitch.startTie) {
                                            startIndices.add(noteIndex);
                                        }
                                        if (element.endTie || pitch.endTie) {
                                            continuationIndices.add(noteIndex);
                                        }
                                        noteIndex++;
                                    });
                                }
                            } else if (element.el_type === "note" && element.rest) {
                                // Handle rest notes
                                noteIndex++;
                            }
                        });
                    });
                });
            }
        });

        return { startIndices, continuationIndices };
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
     * @returns {Array} Array of note objects with names and tied status
     */
    extractCleanedNotes() {
        try {
            // Use abcjs for clean note extraction, then add tie info using a simple pattern check
            if (window.app && window.app.renderManager && window.app.renderManager.currentVisualObj) {
                const abcjsNotes = this.extractNotesUsingAbcjs(window.app.renderManager.currentVisualObj);
                return this.addTieSuppressionToAbcjsNotes(abcjsNotes);
            }

            // Fallback to regex method
            return this.extractNotesFromAbcWithTies();
        } catch (error) {
            return this.extractNotesFromAbcWithTies();
        }
    }
}