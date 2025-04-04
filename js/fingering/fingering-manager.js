/**
 * Manages fingering diagrams and their display
 */
class FingeringManager {
    constructor(config) {
        this.config = config;
        this.fingeringData = {
            'C': { left: ['c', 'c', 'c', 'c'], right: ['c', 'c', 'c', 'c'] },
            '^C': { left: ['c', 'c', 'c', 'c'], right: ['c', 'c', 'c', 'p'] },
            'D': { left: ['c', 'c', 'c', 'c'], right: ['c', 'c', 'c', 'o'] },
            '^D': { left: ['c', 'c', 'c', 'c'], right: ['c', 'c', 'p', 'o'] },
            'E': { left: ['c', 'c', 'c', 'c'], right: ['c', 'c', 'o', 'o'] },
            'F': { left: ['c', 'c', 'c', 'c'], right: ['c', 'o', 'c', 'c'] },
            '^F': { left: ['c', 'c', 'c', 'c'], right: ['o', 'c', 'c', 'o'] },
            'G': { left: ['c', 'c', 'c', 'c'], right: ['o', 'o', 'o', 'o'] },
            '^G': { left: ['c', 'c', 'c', 'o'], right: ['c', 'c', 'o', 'o'] },
            'A': { left: ['c', 'c', 'c', 'o'], right: ['o', 'o', 'o', 'o'] },
            '^A': { left: ['c', 'c', 'o', 'c'], right: ['c', 'o', 'o', 'o'] },
            'B': { left: ['c', 'c', 'o', 'o'], right: ['o', 'o', 'o', 'o'] },
            'c': { left: ['c', 'o', 'c', 'o'], right: ['o', 'o', 'o', 'o'] },
            '^c': { left: ['o', 'c', 'c', 'o'], right: ['o', 'o', 'o', 'o'] },
            'd': { left: ['o', 'o', 'c', 'o'], right: ['o', 'o', 'o', 'o'] },
            '^d': { left: ['o', 'o', 'c', 'c'], right: ['c', 'c', 'c', 'o'] },
            'e': { left: ['p', 'c', 'c', 'c'], right: ['c', 'c', 'o', 'o'] },
            'f': { left: ['p', 'c', 'c', 'c'], right: ['c', 'o', 'c', 'o'] },
            '^f': { left: ['p', 'c', 'c', 'c'], right: ['o', 'c', 'o', 'o'] },
            'g': { left: ['p', 'c', 'c', 'c'], right: ['o', 'o', 'o', 'o'] },
            '^g': { left: ['p', 'c', 'c', 'o'], right: ['c', 'o', 'o', 'o'] },
            'a': { left: ['p', 'c', 'c', 'o'], right: ['o', 'o', 'o', 'o'] }
        };

        // German fingering variations
        this.fingeringDataGerman = {
            'F': { left: ['c', 'c', 'c', 'c'], right: ['c', 'o', 'o', 'o'] },
            '^F': { left: ['c', 'c', 'c', 'c'], right: ['o', 'c', 'c', 'c'] },
            '^c': { left: ['c', 'o', 'o', 'o'], right: ['o', 'o', 'o', 'o'] },
            'f': { left: ['p', 'c', 'c', 'c'], right: ['c', 'o', 'o', 'o'] },
            '^f': { left: ['p', 'c', 'c', 'c'], right: ['o', 'c', 'o', 'c'] },
            '^g': { left: ['p', 'c', 'c', 'c'], right: ['o', 'c', 'c', 'c'] }
        };

        this.currentFingeringSystem = 'german';
        this.showFingering = true;
    }

    /**
     * Creates a hole element for fingering diagrams
     * @param {string} state - State of the hole ('c' = closed, 'o' = open, 'p' = partially closed)
     * @param {boolean} isFirstLeftHole - Whether this is the thumb hole
     * @returns {HTMLElement} - The created hole element
     */
    createHole(state, isFirstLeftHole = false) {
        const config = this.config;
        const hole = document.createElement('div');

        this._applyHoleStyles(hole, config);
        this._applyHoleState(hole, state, isFirstLeftHole);

        return hole;
    }

    /**
     * Applies base styles to a hole element
     * @param {HTMLElement} hole - The hole element
     * @param {Object} config - Configuration object
     * @private
     */
    _applyHoleStyles(hole, config) {
        hole.style.width = `${config.holeSize}px`;
        hole.style.height = `${config.holeSize}px`;
        hole.style.borderRadius = '50%';
        hole.style.border = `${config.holeBorder}px solid #000`;
        hole.style.margin = `${config.holeSpacing}px 0`;
    }

    /**
     * Applies state-specific styles to a hole element
     * @param {HTMLElement} hole - The hole element
     * @param {string} state - State of the hole
     * @param {boolean} isFirstLeftHole - Whether this is the thumb hole
     * @private
     */
    _applyHoleState(hole, state, isFirstLeftHole) {
        const filledColor = isFirstLeftHole ? '#888' : 'black';

        if (state === 'c') {
            hole.style.backgroundColor = filledColor;
        } else if (state === 'p') {
            hole.style.background = `linear-gradient(45deg, ${filledColor} 50%, white 50%)`;
        } else {
            hole.style.backgroundColor = 'white';
        }
    }

    /**
     * Creates a complete fingering diagram for a note
     * @param {Object} fingeringData - Fingering data for the note
     * @param {string} noteName - Name of the note
     * @returns {HTMLElement} - The created diagram element
     */
    createFingeringDiagram(fingeringData, noteName) {
        const diagram = this._createDiagramContainer();
        this._addClickBehavior(diagram);

        if (this.config.showLabels && noteName) {
            //this._addNoteLabel(diagram, noteName);
        }

        const columnsContainer = this._createColumnsContainer();
        const leftColumn = this._createHandColumn(fingeringData.left, true);
        const rightColumn = this._createHandColumn(fingeringData.right, false);

        columnsContainer.appendChild(leftColumn);
        columnsContainer.appendChild(rightColumn);
        diagram.appendChild(columnsContainer);

        return diagram;
    }

    /**
     * Creates the main container for a fingering diagram
     * @returns {HTMLElement} - The diagram container
     * @private
     */
    _createDiagramContainer() {
        const config = this.config;
        const diagram = document.createElement('div');

        diagram.className = 'fingering-diagram';
        diagram.setAttribute('data-state', 'neutral');
        diagram.style.display = 'flex';
        diagram.style.flexDirection = 'column';
        diagram.style.alignItems = 'center';
        diagram.style.backgroundColor = config.backgroundColor;
        diagram.style.borderRadius = `${config.borderRadius}px`;
        diagram.style.padding = '3px';
        diagram.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.2)';
        diagram.style.pointerEvents = 'auto'; // Make clickable

        return diagram;
    }

    /**
     * Adds click behavior to cycle through states for a diagram
     * @param {HTMLElement} diagram - The diagram element
     * @private
     */
    _addClickBehavior(diagram) {
        const config = this.config;

        diagram.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentState = diagram.getAttribute('data-state');
            let newState;

            if (currentState === 'neutral') {
                newState = 'red';
                diagram.style.backgroundColor = config.redColor;
            } else if (currentState === 'red') {
                newState = 'green';
                diagram.style.backgroundColor = config.greenColor;
            } else {
                newState = 'neutral';
                diagram.style.backgroundColor = config.backgroundColor;
            }

            diagram.setAttribute('data-state', newState);
        });
    }

    /**
     * Adds a note label to a diagram
     * @param {HTMLElement} diagram - The diagram element
     * @param {string} noteName - The name of the note
     * @private
     */
    _addNoteLabel(diagram, noteName) {
        const config = this.config;
        const noteLabel = document.createElement('div');

        noteLabel.textContent = noteName;
        noteLabel.style.fontSize = `${config.fontSizeNote}px`;
        noteLabel.style.fontWeight = 'bold';
        noteLabel.style.marginBottom = '2px';

        diagram.appendChild(noteLabel);
    }

    /**
     * Creates the container for the left and right hand columns
     * @returns {HTMLElement} - The columns container
     * @private
     */
    _createColumnsContainer() {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = `${this.config.columnSpacing}px`;
        return container;
    }

    /**
     * Creates a column for either left or right hand
     * @param {Array} states - Array of hole states
     * @param {boolean} isLeftHand - Whether this is the left hand column
     * @returns {HTMLElement} - The hand column element
     * @private
     */
    _createHandColumn(states, isLeftHand) {
        const column = document.createElement('div');
        column.style.display = 'flex';
        column.style.flexDirection = 'column';
        column.style.alignItems = 'center';

        states.forEach((state, index) => {
            // For left hand, first hole is the thumb hole
            const isThumbHole = isLeftHand && index === 0;
            column.appendChild(this.createHole(state, isThumbHole));
        });

        return column;
    }

    /**
     * Gets the fingering data for a specific note
     * @param {string} noteName - Name of the note
     * @returns {Object|null} - Fingering data for the note or null if not found
     */
    getFingeringForNote(noteName) {
        // Skip processing for rests
        if (noteName === 'rest') {
            return null;
        }

        //console.log('Looking for fingering for note:', noteName);

        // Clean up duplicated accidentals (like ==G becoming =G)
        if (noteName.startsWith('==')) {
            noteName = '=' + noteName.substring(2);
        }
        if (noteName.startsWith('__')) {
            noteName = '_' + noteName.substring(2);
        }
        if (noteName.startsWith('^^')) {
            noteName = '^' + noteName.substring(2);
        }

        // Handle natural accidentals (=) by treating them as the base note
        if (noteName.startsWith('=')) {
            noteName = noteName.substring(1);
        }

        // Try direct match first
        const fingeringData = this._getDirectFingeringMatch(noteName);
        if (fingeringData) {
            //console.log('Found direct match for:', noteName);
            return fingeringData;
        }

        // Try enharmonic match if direct match failed
        const enharmonicMatch = this._getEnharmonicFingeringMatch(noteName);
        if (enharmonicMatch) {
            //console.log('Found enharmonic match for:', noteName);
            return enharmonicMatch;
        }

        console.warn('No fingering found for:', noteName);
        return null;
    }

    /**
     * Attempts to find a direct match for fingering data
     * @param {string} noteName - Name of the note
     * @returns {Object|null} - Fingering data or null if not found
     * @private
     */
    _getDirectFingeringMatch(noteName) {
        if (this.currentFingeringSystem === 'german' && this.fingeringDataGerman[noteName]) {
            return this.fingeringDataGerman[noteName];
        }

        if (this.fingeringData[noteName]) {
            return this.fingeringData[noteName];
        }

        return null;
    }

    /**
     * Attempts to find an enharmonic match for fingering data
     * @param {string} noteName - Name of the note
     * @returns {Object|null} - Fingering data or null if not found
     * @private
     */
    _getEnharmonicFingeringMatch(noteName) {
        const noteMatch = noteName.match(/([_^=]*)([A-Ga-g])([,']*)/);
        if (!noteMatch) return null;

        const [, accidental, noteLetter, octaveMarkers] = noteMatch;
        //console.log('Enharmonic lookup for:', noteName, 'Parsed as:', { accidental, noteLetter, octaveMarkers });

        // Map for common enharmonic equivalents
        const enharmonicMap = this._getEnharmonicMap();

        // Try looking up with an enharmonic equivalent
        const enharmonicKey = accidental + noteLetter;
        //console.log('Enharmonic key:', enharmonicKey, 'Map has key:', enharmonicMap[enharmonicKey] ? 'Yes' : 'No');

        if (enharmonicMap[enharmonicKey]) {
            const enharmonic = enharmonicMap[enharmonicKey] + octaveMarkers;
            //console.log('Trying enharmonic equivalent:', enharmonic);

            if (this.currentFingeringSystem === 'german' && this.fingeringDataGerman[enharmonic]) {
                return this.fingeringDataGerman[enharmonic];
            }

            if (this.fingeringData[enharmonic]) {
                return this.fingeringData[enharmonic];
            }
        }

        return null;
    }

    /**
     * Returns a mapping of enharmonic note equivalents
     * @returns {Object} - Map of enharmonic equivalents
     * @private
     */
    _getEnharmonicMap() {
        return {
            // Original mappings for C4-B4 octave (uppercase)
            '_B': '^A', '^A': '_B',
            '_E': '^D', '^D': '_E',
            '_A': '^G', '^G': '_A',
            '_D': '^C', '^C': '_D',
            '_G': '^F', '^F': '_G',

            // Add missing enharmonic pairs
            '_C': 'B', 'B': '_C',
            '_F': 'E', 'E': '_F',
            '^B': 'C', 'C': '_D',
            '^E': 'F', 'F': '_G',

            // Additional mappings for C5-B5 octave (lowercase)
            '_b': '^a', '^a': '_b',
            '_e': '^d', '^d': '_e',
            '_a': '^g', '^g': '_a',
            '_d': '^c', '^c': '_d',
            '_g': '^f', '^f': '_g',

            // Add missing lowercase enharmonic pairs
            '_c': 'b', 'b': '_c',
            '_f': 'e', 'e': '_f',
            '^b': 'c', 'c': '_d',
            '^e': 'f', 'f': '_g'
        };
    }

    /**
     * Toggles between Baroque and German fingering systems
     * @returns {string} - The new fingering system
     */
    toggleFingeringSystem() {
        this.currentFingeringSystem = (this.currentFingeringSystem === 'baroque') ? 'german' : 'baroque';
        return this.currentFingeringSystem;
    }

    /**
     * Clears all fingering diagrams from the display
     */
    clearFingeringDiagrams() {
        const existing = document.getElementById('fingering-layer');
        if (existing) existing.remove();
    }

    /**
     * Populates the reference row with fingering diagrams for all notes
     */
    populateReferenceRow() {
        const referenceRow = document.getElementById('reference-row');
        if (!referenceRow) return;

        // Clear any existing content
        referenceRow.innerHTML = '';

        const referenceNotes = this._getReferenceNotesList();
        this._populateNoteDiagrams(referenceRow, referenceNotes);

        // Start with reference row minimized
        document.querySelector('.abcjs-container').classList.add('minimized');
    }

    /**
     * Gets the list of reference notes to display
     * @returns {Array} - List of note names
     * @private
     */
    _getReferenceNotesList() {
        // Define reference notes (C4 to A5)
        return [
            'C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B',
            'c', '^c', 'd', '^d', 'e', 'f', '^f', 'g', '^g', 'a'
        ];
    }

    /**
     * Creates and adds diagram containers for each note
     * @param {HTMLElement} referenceRow - The reference row element
     * @param {Array} referenceNotes - List of note names
     * @private
     */
    _populateNoteDiagrams(referenceRow, referenceNotes) {
        // Create a fingering diagram for each reference note
        referenceNotes.forEach(noteName => {
            const fingeringData = this.getFingeringForNote(noteName);
            if (!fingeringData) return;

            const container = this._createNoteContainer(noteName);
            const noteLabel = this._createNoteLabel(noteName);
            const diagram = this.createFingeringDiagram(fingeringData, noteName);

            container.appendChild(noteLabel);
            container.appendChild(diagram);
            referenceRow.appendChild(container);
        });
    }

    /**
     * Creates a container for a note in the reference row
     * @param {string} noteName - Name of the note
     * @returns {HTMLElement} - The note container
     * @private
     */
    _createNoteContainer(noteName) {
        const container = document.createElement('div');
        container.className = 'chart-container';
        container.style.padding = '8px';
        container.style.border = '1px solid #ddd';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';

        if (noteName.includes('^')) {
            container.style.borderWidth = '3px';
            container.style.borderColor = '#000';
        }

        return container;
    }

    /**
     * Creates a label for a note in the reference row
     * @param {string} noteName - Name of the note
     * @returns {HTMLElement} - The note label
     * @private
     */
    _createNoteLabel(noteName) {
        const noteLabel = document.createElement('div');
        noteLabel.textContent = noteName;
        noteLabel.style.textAlign = 'center';
        noteLabel.style.marginBottom = '8px';
        noteLabel.style.fontWeight = 'bold';
        return noteLabel;
    }
}
