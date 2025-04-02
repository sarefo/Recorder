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

    reconstructAbc(sections) {
        return [
            ...sections.header,
            sections.key,
            ...sections.notes
        ].join('\n');
    }

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

        // Map minor keys to their relative major
        const minorToRelativeMajor = {
            'Am': 'C', 'Em': 'G', 'Bm': 'D', 'F♯m': 'A', 'C♯m': 'E', 'G♯m': 'B', 'D♯m': 'F♯', 'A♯m': 'C♯',
            'Dm': 'F', 'Gm': 'B♭', 'Cm': 'E♭', 'Fm': 'A♭', 'B♭m': 'D♭', 'E♭m': 'G♭', 'A♭m': 'C♭'
        };

        if (isMinor) {
            return keySignatures[minorToRelativeMajor[normalizedKey]] || {};
        }

        return keySignatures[baseKey] || {};
    }

    extractNotesFromAbc() {
        // Extract the music part (after K: line)
        const parts = this.currentAbc.split(/K:[^\n]+\n/);
        if (parts.length < 2) return [];

        // Extract the key signature
        const keyMatch = this.currentAbc.match(/K:([A-G][#b]?m?)/);
        const key = keyMatch ? keyMatch[1] : 'C';

        // Get key accidentals
        const keyAccidentals = this.getAccidentalsForKey(key);

        // Get just the musical content
        const musicPart = parts[1]
            .replace(/\\\s*\n/g, ' ')  // Handle line continuations
            .replace(/V:\d+/g, ' ')    // Remove voice indicators
            .replace(/\|/g, ' |')      // Add space after bar lines for easier parsing
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();

        // Extract notes with accidentals and octave markers
        const notes = [];
        // Match note pattern: optional accidental (^_=), note letter (A-Ga-g), optional octave markers (',)
        const noteRegex = /([_^=]?)([A-Ga-g])([,']*)/g;
        let match;

        // Track accidentals that apply within a measure
        let measureAccidentals = {};

        while ((match = noteRegex.exec(musicPart)) !== null) {
            // Skip notes within chord structures
            if (musicPart.charAt(match.index - 1) === '[') continue;

            let [, accidental, noteLetter, octaveMarkers] = match;
            const baseNote = noteLetter.toUpperCase();

            // Check if we've reached a bar line, and reset measure accidentals if so
            const textBeforeMatch = musicPart.substring(0, match.index);
            const lastBarIndex = textBeforeMatch.lastIndexOf('|');
            const lastNoteIndex = textBeforeMatch.search(/[A-Ga-g][']*$/);

            if (lastBarIndex > lastNoteIndex && lastBarIndex !== -1) {
                // We're in a new measure, reset accidentals
                measureAccidentals = {};
            }

            // Apply accidentals in this priority: 
            // 1. Explicit accidental in the note
            // 2. Accidental set earlier in the measure
            // 3. Key signature accidental
            if (accidental) {
                // Store explicit accidental for this note in the current measure
                measureAccidentals[baseNote] = accidental;
            } else if (measureAccidentals[baseNote]) {
                // Use accidental already set in this measure
                accidental = measureAccidentals[baseNote];
            } else if (keyAccidentals[baseNote]) {
                // Use key signature accidental
                accidental = keyAccidentals[baseNote];
            }

            const noteName = accidental + noteLetter + octaveMarkers;
            notes.push(noteName);
        }

        return notes;
    }
}

export default NotationParser;