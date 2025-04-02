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

    createHole(state, isFirstLeftHole = false) {
        const config = this.config;

        const hole = document.createElement('div');
        hole.style.width = `${config.holeSize}px`;
        hole.style.height = `${config.holeSize}px`;
        hole.style.borderRadius = '50%';
        hole.style.border = `${config.holeBorder}px solid #000`;
        hole.style.margin = `${config.holeSpacing}px 0`;

        const filledColor = isFirstLeftHole ? '#888' : 'black';

        if (state === 'c') {
            hole.style.backgroundColor = filledColor;
        } else if (state === 'p') {
            hole.style.background = `linear-gradient(45deg, ${filledColor} 50%, white 50%)`;
        } else {
            hole.style.backgroundColor = 'white';
        }

        return hole;
    }

    createFingeringDiagram(fingeringData, noteName) {
        const config = this.config;

        // Create container
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

        // Add click event to cycle through states
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

        // Add note name label if enabled
        if (config.showLabels && noteName) {
            const noteLabel = document.createElement('div');
            noteLabel.textContent = noteName;
            noteLabel.style.fontSize = `${config.fontSizeNote}px`;
            noteLabel.style.fontWeight = 'bold';
            noteLabel.style.marginBottom = '2px';
            diagram.appendChild(noteLabel);
        }

        // Create two columns for left and right hand
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = `${config.columnSpacing}px`;

        // Left hand column
        const leftCol = document.createElement('div');
        leftCol.style.display = 'flex';
        leftCol.style.flexDirection = 'column';
        leftCol.style.alignItems = 'center';

        // Right hand column
        const rightCol = document.createElement('div');
        rightCol.style.display = 'flex';
        rightCol.style.flexDirection = 'column';
        rightCol.style.alignItems = 'center';

        // Create holes
        fingeringData.left.forEach((state, index) => {
            leftCol.appendChild(this.createHole(state, index === 0)); // Pass true for first hole
        });

        fingeringData.right.forEach(state => {
            rightCol.appendChild(this.createHole(state));
        });

        container.appendChild(leftCol);
        container.appendChild(rightCol);
        diagram.appendChild(container);

        return diagram;
    }

    getFingeringForNote(noteName) {
        // Handle natural accidentals (=) by treating them as the base note
        if (noteName.startsWith('=')) {
            noteName = noteName.substring(1);
        }

        // Continue with existing lookup logic
        // Try direct match first
        if (this.currentFingeringSystem === 'german' && this.fingeringDataGerman[noteName]) {
            return this.fingeringDataGerman[noteName];
        }

        if (this.fingeringData[noteName]) {
            return this.fingeringData[noteName];
        }

        // Try enharmonic equivalents if needed
        const noteMatch = noteName.match(/([_^=]*)([A-Ga-g])([,']*)/);
        if (!noteMatch) return null;

        const [, accidental, noteLetter, octaveMarkers] = noteMatch;

        // Map for common enharmonic equivalents
        const enharmonicMap = {
            // Original mappings for C4-B4 octave (uppercase)
            '_B': '^A', '^A': '_B',
            '_E': '^D', '^D': '_E',
            '_A': '^G', '^G': '_A',
            '_D': '^C', '^C': '_D',
            '_G': '^F', '^F': '_G',

            // Additional mappings for C5-B5 octave (lowercase)
            '_b': '^a', '^a': '_b',
            '_e': '^d', '^d': '_e',
            '_a': '^g', '^g': '_a',
            '_d': '^c', '^c': '_d',
            '_g': '^f', '^f': '_g'
        };

        // Try looking up with an enharmonic equivalent
        const enharmonicKey = accidental + noteLetter;
        if (enharmonicMap[enharmonicKey]) {
            const enharmonic = enharmonicMap[enharmonicKey] + octaveMarkers;

            if (this.currentFingeringSystem === 'german' && this.fingeringDataGerman[enharmonic]) {
                return this.fingeringDataGerman[enharmonic];
            }

            if (this.fingeringData[enharmonic]) {
                return this.fingeringData[enharmonic];
            }
        }

        return null;
    }

    toggleFingeringSystem() {
        this.currentFingeringSystem = (this.currentFingeringSystem === 'baroque') ? 'german' : 'baroque';
        return this.currentFingeringSystem;
    }

    clearFingeringDiagrams() {
        const existing = document.getElementById('fingering-layer');
        if (existing) existing.remove();
    }

    populateReferenceRow() {
        const referenceRow = document.getElementById('reference-row');
        if (!referenceRow) return;

        // Clear any existing content
        referenceRow.innerHTML = '';

        // Define reference notes (C4 to A5)
        const referenceNotes = [
            'C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B',
            'c', '^c', 'd', '^d', 'e', 'f', '^f', 'g', '^g', 'a'
        ];

        // Create a fingering diagram for each reference note
        referenceNotes.forEach(noteName => {
            const fingeringData = this.getFingeringForNote(noteName);
            if (!fingeringData) return;

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

            const noteLabel = document.createElement('div');
            noteLabel.textContent = noteName;
            noteLabel.style.textAlign = 'center';
            noteLabel.style.marginBottom = '8px';
            noteLabel.style.fontWeight = 'bold';

            const diagram = this.createFingeringDiagram(fingeringData, noteName);

            container.appendChild(noteLabel);
            container.appendChild(diagram);
            referenceRow.appendChild(container);
        });

        // Start with reference row minimized
        document.querySelector('.abcjs-container').classList.add('minimized');
    }
}

export default FingeringManager;