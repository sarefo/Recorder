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
            'a': { left: ['p', 'c', 'c', 'o'], right: ['o', 'o', 'o', 'o'] },
            '^a': { left: ['p', 'c', 'c', 'o'], right: ['c', 'c', 'c', 'o'] },
            'b': { left: ['p', 'c', 'c', 'o'], right: ['c', 'c', 'o', 'o'] },
            'c\'': { left: ['p', 'c', 'o', 'o'], right: ['c', 'c', 'o', 'o'] },
            '^c\'': { left: ['p', 'c', 'p', 'c'], right: ['c', 'o', 'c', 'c'] },
            'd\'': { left: ['p', 'c', 'o', 'c'], right: ['c', 'o', 'c', 'p'] }
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

        // Dizi D fingering data (6 holes total, 3 per hand, no thumb hole)
        this.fingeringDataDiziD = {
            'A,': { left: ['c', 'c', 'c'], right: ['c', 'c', 'c'] },
            '^A,': { left: ['c', 'c', 'c'], right: ['c', 'c', 'p'] },
            'B,': { left: ['c', 'c', 'c'], right: ['c', 'c', 'o'] },
            'C': { left: ['c', 'c', 'c'], right: ['c', 'p', 'o'] },
            '^C': { left: ['c', 'c', 'c'], right: ['c', 'o', 'o'] },
            'D': { left: ['c', 'c', 'c'], right: ['o', 'o', 'o'] },
            '^D': { left: ['c', 'c', 'p'], right: ['o', 'o', 'o'] },
            'E': { left: ['c', 'c', 'o'], right: ['o', 'o', 'o'] },
            'F': { left: ['c', 'o', 'c'], right: ['c', 'o', 'o'] },
            '^F': { left: ['c', 'o', 'o'], right: ['o', 'o', 'o'] },
            'G': { left: ['o', 'c', 'c'], right: ['o', 'o', 'o'] },
            '^G': { left: ['o', 'o', 'o'], right: ['o', 'o', 'o'] },
            'A': { left: ['o', 'c', 'c'], right: ['c', 'c', 'c'] },
            '^A': { left: ['c', 'c', 'c'], right: ['c', 'c', 'p'] },
            'B': { left: ['c', 'c', 'c'], right: ['c', 'c', 'o'] },
            'c': { left: ['c', 'c', 'c'], right: ['c', 'p', 'o'] },
            '^c': { left: ['c', 'c', 'c'], right: ['c', 'o', 'o'] },
            'd': { left: ['c', 'c', 'c'], right: ['o', 'o', 'o'] },
            '^d': { left: ['c', 'c', 'p'], right: ['o', 'o', 'o'] },
            'e': { left: ['c', 'c', 'o'], right: ['o', 'o', 'o'] },
            'f': { left: ['c', 'p', 'o'], right: ['o', 'o', 'o'] },
            '^f': { left: ['c', 'o', 'o'], right: ['o', 'o', 'o'] },
            'g': { left: ['o', 'c', 'c'], right: ['c', 'c', 'o'] },
            '^g': { left: ['o', 'o', 'o'], right: ['c', 'p', 'o'] },
            'a': { left: ['o', 'c', 'c'], right: ['c', 'c', 'c'] },
            '^a': { left: ['c', 'c', 'p'], right: ['c', 'c', 'p'] },
            'b': { left: ['c', 'c', 'o'], right: ['c', 'c', 'o'] },
            'c\'': { left: ['c', 'p', 'o'], right: ['c', 'p', 'o'] },
            '^c\'': { left: ['c', 'o', 'c'], right: ['c', 'o', 'c'] },
            'd\'': { left: ['c', 'o', 'c'], right: ['o', 'o', 'o'] }
        };

        this.currentFingeringSystem = 'german';
        this.showFingering = false;
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
        hole.className = 'fingering-hole';
        // Override default sizes if config specifies different values
        if (config.holeSize !== 6) {
            hole.style.width = `${config.holeSize}px`;
            hole.style.height = `${config.holeSize}px`;
        }
        if (config.holeBorder !== 1) {
            hole.style.borderWidth = `${config.holeBorder}px`;
        }
        if (config.holeSpacing !== 1) {
            hole.style.margin = `${config.holeSpacing}px 0`;
        }
    }

    /**
     * Applies state-specific styles to a hole element
     * @param {HTMLElement} hole - The hole element
     * @param {string} state - State of the hole
     * @param {boolean} isFirstLeftHole - Whether this is the thumb hole
     * @private
     */
    _applyHoleState(hole, state, isFirstLeftHole) {
        // Remove existing state classes
        hole.classList.remove('closed', 'half-hole');

        if (state === 'c') {
            hole.classList.add('closed');
            // Only apply gray color for thumb hole in recorder/baroque modes, not dizi
            if (isFirstLeftHole && this.currentFingeringSystem !== 'diziD') {
                hole.style.backgroundColor = '#888';
            }
        } else if (state === 'p') {
            hole.classList.add('half-hole');
            // Only apply gray gradient for thumb hole in recorder/baroque modes, not dizi
            if (isFirstLeftHole && this.currentFingeringSystem !== 'diziD') {
                hole.style.background = 'linear-gradient(45deg, #888 50%, white 50%)';
            }
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

        diagram.className = 'fingering-diagram-container clickable';
        diagram.setAttribute('data-state', 'neutral');

        // Override default styles if config differs
        if (config.backgroundColor !== 'rgba(255, 255, 255, 0.9)') {
            diagram.style.backgroundColor = config.backgroundColor;
        }
        if (config.borderRadius !== 4) {
            diagram.style.borderRadius = `${config.borderRadius}px`;
        }

        return diagram;
    }

    /**
     * Adds click behavior to cycle through states for a diagram
     * @param {HTMLElement} diagram - The diagram element
     * @private
     */
    _addClickBehavior(diagram) {
        diagram.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteIndex = diagram.getAttribute('data-note-index');
            this._updateCoupledState(noteIndex, diagram);
        });
    }

    /**
     * Creates a note marker zone for note marking functionality
     * @param {number} noteIndex - The index of the note this marker represents
     * @returns {HTMLElement} - The created marker zone element
     */
    createNoteMarkerZone(noteIndex) {
        const markerZone = document.createElement('div');
        markerZone.className = 'note-marker-zone';
        markerZone.setAttribute('data-state', 'neutral');
        markerZone.setAttribute('data-note-index', noteIndex);

        // Add the same click behavior as fingering diagrams
        this._addMarkerClickBehavior(markerZone);

        return markerZone;
    }

    /**
     * Adds click behavior to cycle through states for a marker zone
     * @param {HTMLElement} markerZone - The marker zone element
     * @private
     */
    _addMarkerClickBehavior(markerZone) {
        markerZone.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteIndex = markerZone.getAttribute('data-note-index');
            this._updateCoupledState(noteIndex, markerZone);
        });
    }

    /**
     * Updates the state of both fingering diagram and marker zone for a note
     * @param {string} noteIndex - The note index
     * @param {HTMLElement} clickedElement - The element that was clicked
     * @private
     */
    _updateCoupledState(noteIndex, clickedElement) {
        // Find both elements for this note
        const diagram = document.querySelector(`[data-note-index="${noteIndex}"].fingering-diagram-container`);
        const markerZone = document.querySelector(`[data-note-index="${noteIndex}"].note-marker-zone`);

        // Get current state from the clicked element
        const currentState = clickedElement.getAttribute('data-state');
        let newState;

        if (currentState === 'neutral') {
            newState = 'red';
        } else if (currentState === 'red') {
            newState = 'green';
        } else {
            newState = 'neutral';
        }

        // Update diagram state and appearance
        if (diagram) {
            diagram.setAttribute('data-state', newState);
            diagram.classList.remove('clicked');

            if (newState === 'red') {
                diagram.style.backgroundColor = this.config.redColor;
            } else if (newState === 'green') {
                diagram.style.backgroundColor = this.config.greenColor;
                diagram.classList.add('clicked');
            } else {
                diagram.style.backgroundColor = this.config.backgroundColor;
            }
        }

        // Update marker zone state
        if (markerZone) {
            markerZone.setAttribute('data-state', newState);
        }
    }

    /**
     * Creates the container for the left and right hand columns
     * @returns {HTMLElement} - The columns container
     * @private
     */
    _createColumnsContainer() {
        const container = document.createElement('div');
        container.className = 'fingering-hands-container';

        // Override default gap if config differs
        if (this.config.columnSpacing !== 4) {
            container.style.gap = `${this.config.columnSpacing}px`;
        }

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
        column.className = 'fingering-hand-column';

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

        // PRESERVE ORIGINAL NOTE WITH NATURAL SIGN
        const originalNoteName = noteName;

        // Create a version without natural sign for fallback
        let noteWithoutNatural = noteName;
        if (noteName.startsWith('=')) {
            noteWithoutNatural = noteName.substring(1);
        }

        // First try with the original note (including natural sign)
        let fingeringData = this._getDirectFingeringMatch(originalNoteName);
        if (fingeringData) {
            return fingeringData;
        }

        // If that fails and we have a natural sign, try with the base note 
        if (originalNoteName.startsWith('=')) {
            fingeringData = this._getDirectFingeringMatch(noteWithoutNatural);
            if (fingeringData) {
                return fingeringData;
            }
        } else {
            // Use normal lookup path for non-natural notes
            fingeringData = this._getDirectFingeringMatch(noteName);
            if (fingeringData) {
                return fingeringData;
            }
        }

        // Try enharmonic match as a last resort
        const enharmonicMatch = this._getEnharmonicFingeringMatch(
            noteWithoutNatural // Use version without natural for enharmonic lookup
        );
        if (enharmonicMatch) {
            return enharmonicMatch;
        }

        console.warn('No fingering found for:', originalNoteName);
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

        if (this.currentFingeringSystem === 'diziD' && this.fingeringDataDiziD[noteName]) {
            return this.fingeringDataDiziD[noteName];
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

        // Map for common enharmonic equivalents
        const enharmonicMap = this._getEnharmonicMap();

        // Try looking up with an enharmonic equivalent
        const enharmonicKey = accidental + noteLetter;

        if (enharmonicMap[enharmonicKey]) {
            const enharmonic = enharmonicMap[enharmonicKey] + octaveMarkers;

            if (this.currentFingeringSystem === 'german' && this.fingeringDataGerman[enharmonic]) {
                return this.fingeringDataGerman[enharmonic];
            }

            if (this.currentFingeringSystem === 'diziD' && this.fingeringDataDiziD[enharmonic]) {
                return this.fingeringDataDiziD[enharmonic];
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
            '^e': 'f', 'f': '_g',
            '_b': '^a', '^a': '_b',
            '_c\'': 'b', 'b': '_c\'',
            '_d\'': '^c\'', '^c\'': '_d\''
        };
    }

    /**
     * Toggles between German and Dizi D fingering systems
     * @returns {string} - The new fingering system
     */
    toggleFingeringSystem() {
        if (this.currentFingeringSystem === 'german' || this.currentFingeringSystem === 'baroque') {
            this.currentFingeringSystem = 'diziD';
        } else {
            this.currentFingeringSystem = 'german';
        }
        return this.currentFingeringSystem;
    }

    /**
     * Toggles to baroque from german, or back to german from baroque
     * @returns {string} - The new fingering system
     */
    toggleBaroqueSystem() {
        if (this.currentFingeringSystem === 'german') {
            this.currentFingeringSystem = 'baroque';
        } else if (this.currentFingeringSystem === 'baroque') {
            this.currentFingeringSystem = 'german';
        }
        return this.currentFingeringSystem;
    }

    /**
     * Sets the fingering system to a specific type
     * @param {string} system - The fingering system ('baroque', 'german', or 'diziD')
     */
    setFingeringSystem(system) {
        if (system === 'baroque' || system === 'german' || system === 'diziD') {
            this.currentFingeringSystem = system;
        }
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
        if (this.currentFingeringSystem === 'diziD') {
            // Define reference notes for Dizi D (A3 to D6)
            return [
                'A,', '^A,', 'B,',
                'C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B',
                'c', '^c', 'd', '^d', 'e', 'f', '^f', 'g', '^g', 'a', '^a', 'b',
                'c\'', '^c\'', 'd\''
            ];
        } else {
            // Define reference notes for Baroque and German (C4 to D6)
            return [
                'C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B',
                'c', '^c', 'd', '^d', 'e', 'f', '^f', 'g', '^g', 'a', '^a', 'b',
                'c\'', '^c\'', 'd\''
            ];
        }
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

            const container = this._createClickableNoteContainer(noteName);
            const noteLabel = this._createNoteLabel(noteName);
            const diagram = this._createSimpleFingeringDiagram(fingeringData, noteName);

            container.appendChild(noteLabel);
            container.appendChild(diagram);
            referenceRow.appendChild(container);
        });
    }

    /**
     * Creates a simple fingering diagram for the reference row (without click handlers)
     * @param {Object} fingeringData - Fingering data for the note
     * @param {string} noteName - Name of the note
     * @returns {HTMLElement} - The created diagram element
     */
    _createSimpleFingeringDiagram(fingeringData, noteName) {
        const diagram = this._createDiagramContainer();
        diagram.classList.remove('clickable'); // Remove the sheet music clickable behavior
        diagram.classList.add('reference-diagram');
        diagram.setAttribute('data-state', 'neutral');

        const columnsContainer = this._createColumnsContainer();
        const leftColumn = this._createHandColumn(fingeringData.left, true);
        const rightColumn = this._createHandColumn(fingeringData.right, false);

        columnsContainer.appendChild(leftColumn);
        columnsContainer.appendChild(rightColumn);
        diagram.appendChild(columnsContainer);

        return diagram;
    }

    /**
     * Toggles the red state for reference row containers
     * @param {HTMLElement} container - The container element to toggle
     * @private
     */
    _toggleReferenceContainerState(container) {
        const currentState = container.getAttribute('data-state');
        const newState = currentState === 'neutral' ? 'red' : 'neutral';

        container.setAttribute('data-state', newState);

        // Find the diagram inside this container and update its state too
        const diagram = container.querySelector('.reference-diagram');
        if (diagram) {
            diagram.setAttribute('data-state', newState);

            if (newState === 'red') {
                diagram.style.backgroundColor = this.config.redColor;
                container.style.backgroundColor = this.config.redColor;
            } else {
                diagram.style.backgroundColor = this.config.backgroundColor;
                container.style.backgroundColor = '';
            }
        }
    }

    /**
     * Creates a clickable container for a note in the reference row
     * @param {string} noteName - Name of the note
     * @returns {HTMLElement} - The clickable note container
     * @private
     */
    _createClickableNoteContainer(noteName) {
        const container = document.createElement('div');
        container.className = 'reference-fingering-container clickable-reference-container';
        container.setAttribute('data-state', 'neutral');

        if (noteName.includes('^')) {
            container.setAttribute('data-accidental', 'sharp');
        }

        // Add click behavior to the entire container
        container.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleReferenceContainerState(container);
        });

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
        noteLabel.className = 'note-label';

        // Hide note names for sharp notes (black keys)
        if (noteName.includes('^')) {
            noteLabel.textContent = '•';
        } else {
            noteLabel.textContent = noteName;
        }

        return noteLabel;
    }
}
