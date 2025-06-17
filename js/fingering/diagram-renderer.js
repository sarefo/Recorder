class DiagramRenderer {
    constructor(fingeringManager, config) {
        this.fingeringManager = fingeringManager;
        this.config = config;
    }

    createDiagramLayer() {
        const layer = document.createElement('div');
        layer.id = 'fingering-layer';
        layer.className = 'absolute-positioning';
        return layer;
    }

    addFingeringDiagrams(abcContainer, notesData) {
        // Clear any existing diagrams
        this.clearFingeringDiagrams();

        // Create the layer for fingering diagrams
        const layer = this.createDiagramLayer();
        if (!abcContainer.classList.contains('relative-position')) {
            abcContainer.style.position = 'relative';
        }
        abcContainer.appendChild(layer);

        // Find note elements
        const noteElements = this.findNoteElements();
        if (!noteElements.length) return;

        // Create a mapping from data-index to note data
        const noteDataMap = this.buildNoteDataMapping(notesData);

        // Map notes to staff lines
        const staffMap = this.mapNotesToStaffLines(noteElements);

        // Get container dimensions
        const containerRect = abcContainer.getBoundingClientRect();

        // Add diagrams for each staff line
        this.renderDiagramsByStaff(staffMap, noteDataMap, containerRect, layer);
    }

    findNoteElements() {
        const elements = document.querySelectorAll("#abc-notation .abcjs-note");
        const validNotes = Array.from(elements).filter(el => {
            return !el.classList.contains('abcjs-clef') &&
                !el.classList.contains('abcjs-key-signature') &&
                !el.classList.contains('abcjs-time-signature') &&
                !el.classList.contains('abcjs-tempo') &&
                // Exclude rest notes
                !el.querySelector('[data-name="rest"]');
        });

        return validNotes;
    }

    buildNoteDataMapping(notesData) {
        // Create a map of extracted notes where the key is the position in the array
        const noteDataMap = new Map();

        notesData.forEach((note, index) => {
            // Handle both old string format and new object format
            const noteData = typeof note === 'string' ? { name: note, suppressDiagram: false } : note;
            noteDataMap.set(index, noteData);
            
        });

        return noteDataMap;
    }

    mapNotesToStaffLines(noteElements) {
        // Group notes by staff line (abcjs-l0, abcjs-l1, etc.)
        const staffMap = new Map();

        noteElements.forEach(noteEl => {
            // Find the staff line number from classes
            const lineClass = Array.from(noteEl.classList)
                .find(cls => cls.match(/abcjs-l\d+/));

            if (!lineClass) return;

            const lineNumber = parseInt(lineClass.replace('abcjs-l', ''), 10);

            if (!staffMap.has(lineNumber)) {
                staffMap.set(lineNumber, {
                    lineNumber: lineNumber,
                    notes: [],
                    bottom: null
                });
            }

            const rect = noteEl.getBoundingClientRect();
            staffMap.get(lineNumber).notes.push({
                element: noteEl,
                dataIndex: parseInt(noteEl.getAttribute('data-index') || '-1', 10),
                left: rect.left,
                top: rect.top,
                width: rect.width,
                measure: this.getMeasureNumber(noteEl)
            });
        });

        // Set the bottom position for each staff line
        staffMap.forEach(staff => {
            // Find the staff element related to this line
            const staffEl = document.querySelector(`.abcjs-staff.abcjs-l${staff.lineNumber}`);
            if (staffEl) {
                const staffRect = staffEl.getBoundingClientRect();
                staff.bottom = staffRect.bottom;
            }
        });

        return staffMap;
    }

    getMeasureNumber(element) {
        const measureClass = Array.from(element.classList)
            .find(cls => cls.match(/abcjs-m\d+/));

        if (measureClass) {
            return parseInt(measureClass.replace('abcjs-m', ''), 10);
        }

        return -1;
    }

    renderDiagramsByStaff(staffMap, noteDataMap, containerRect, layer) {
        // For each staff line
        staffMap.forEach(staff => {
            if (!staff.notes.length) return;

            // Sort notes by horizontal position within each staff
            staff.notes.sort((a, b) => a.left - b.left);

            // Find the top position of the staff
            const staffEl = document.querySelector(`.abcjs-staff.abcjs-l${staff.lineNumber}`);
            if (!staffEl) return;

            const staffRect = staffEl.getBoundingClientRect();

            // CHANGE: Position for diagrams is above the staff
            const diagramsTopPosition = staffRect.top - containerRect.top - this.config.verticalOffset;

            // Add diagrams for each note in this staff
            staff.notes.forEach(note => {
                // Get the corresponding note data using data-index
                const noteData = noteDataMap.get(note.dataIndex);
                

                if (noteData && noteData.name !== 'rest' && !noteData.suppressDiagram) {
                    // Create and position the diagram
                    const fingeringData = this.fingeringManager.getFingeringForNote(noteData.name);
                    if (!fingeringData) return;

                    const diagram = this.fingeringManager.createFingeringDiagram(fingeringData, noteData.name);

                    // Position the diagram
                    diagram.style.position = 'absolute';
                    diagram.style.left = `${note.left - containerRect.left + (note.width / 2)}px`;
                    diagram.style.top = `${diagramsTopPosition}px`;
                    diagram.style.transform = `translate(-50%, -100%) scale(${this.config.scale})`;
                    diagram.style.transformOrigin = 'center bottom';

                    layer.appendChild(diagram);
                }
            });
        });
    }

    renderDiagramForNote(note, noteData, containerRect, verticalPosition, layer) {
        // Handle both old string format and new object format
        const noteName = typeof noteData === 'string' ? noteData : noteData.name;
        const suppressDiagram = typeof noteData === 'string' ? false : noteData.suppressDiagram;
        
        if (suppressDiagram) return;
        
        const fingeringData = this.fingeringManager.getFingeringForNote(noteName);
        if (!fingeringData) return;

        const diagram = this.fingeringManager.createFingeringDiagram(fingeringData, noteName);

        // Position the diagram
        diagram.style.position = 'absolute';
        diagram.style.left = `${note.left - containerRect.left + (note.width / 2)}px`;
        diagram.style.top = `${verticalPosition}px`;
        diagram.style.transform = `translate(-50%, 0) scale(${this.config.scale})`;
        diagram.style.transformOrigin = 'center top';

        layer.appendChild(diagram);
    }

    clearFingeringDiagrams() {
        const existing = document.getElementById('fingering-layer');
        if (existing) existing.remove();
    }
}