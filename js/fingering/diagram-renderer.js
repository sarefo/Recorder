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

        // Get or create the layer for fingering diagrams
        let layer = document.getElementById('fingering-layer');
        if (!layer) {
            layer = this.createDiagramLayer();
            if (!abcContainer.classList.contains('relative-position')) {
                abcContainer.style.position = 'relative';
            }
            abcContainer.appendChild(layer);
        }

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

            // Position for diagrams is above the staff
            const diagramsTopPosition = staffRect.top - containerRect.top - this.config.verticalOffset;

            // Add diagrams for each note in this staff
            staff.notes.forEach(note => {
                // Get the corresponding note data using data-index
                const noteData = noteDataMap.get(note.dataIndex);


                if (noteData && noteData.name !== 'rest' && !noteData.suppressDiagram) {
                    // Check if we're in 'marked' mode and if so, only show marked notes
                    if (this.fingeringManager.fingeringDisplayMode === 'marked') {
                        // Find the marker zone for this note
                        const markerZone = document.querySelector(`[data-note-index="${note.dataIndex}"].note-marker-zone`);
                        const markerState = markerZone ? markerZone.getAttribute('data-state') : 'neutral';

                        // Skip this note if it's not marked red
                        if (markerState !== 'red') {
                            return;
                        }
                    }

                    // Create and position the diagram
                    const fingeringData = this.fingeringManager.getFingeringForNote(noteData.name);
                    if (!fingeringData) return;

                    const diagram = this.fingeringManager.createFingeringDiagram(fingeringData, noteData.name);

                    // Add note index for coupling with marker zones
                    diagram.setAttribute('data-note-index', note.dataIndex);

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

    renderNoteMarkerZones(staff, staffRect, containerRect, layer) {
        if (!staff.notes.length) return;

        // Calculate the horizontal span for marker zones
        const leftmostNote = Math.min(...staff.notes.map(n => n.left));
        const rightmostNote = Math.max(...staff.notes.map(n => n.left + n.width));
        const totalWidth = rightmostNote - leftmostNote;
        const zoneWidth = totalWidth / staff.notes.length;

        // Position marker zones to extend from above staff to below staff
        const markerTopPosition = staffRect.top - containerRect.top - 20;

        // Create marker zones for each note
        staff.notes.forEach((note, index) => {
            const markerZone = this.fingeringManager.createNoteMarkerZone(note.dataIndex);
            
            // Position the marker zone to align with the note center (same as fingering diagrams)
            markerZone.style.position = 'absolute';
            markerZone.style.left = `${note.left - containerRect.left + (note.width / 2) - (zoneWidth / 2)}px`;
            markerZone.style.top = `${markerTopPosition}px`;
            markerZone.style.width = `${zoneWidth}px`;
            markerZone.style.height = `${this.config.noteMarkingHeight}px`;
            
            // Set initial z-index based on whether fingering diagrams are shown
            if (this.fingeringManager.fingeringDisplayMode !== 'off') {
                markerZone.style.zIndex = '5'; // Lower when fingering diagrams are visible
            } else {
                markerZone.style.zIndex = '15'; // Higher when fingering diagrams are hidden
            }

            layer.appendChild(markerZone);
        });
    }

    addMarkerZones(abcContainer, notesData) {
        // Get or create the layer for marker zones
        let layer = document.getElementById('fingering-layer');
        if (!layer) {
            layer = this.createDiagramLayer();
            if (!abcContainer.classList.contains('relative-position')) {
                abcContainer.style.position = 'relative';
            }
            abcContainer.appendChild(layer);
        }

        // Find note elements
        const noteElements = this.findNoteElements();
        if (!noteElements.length) return;

        // Create a mapping from data-index to note data
        const noteDataMap = this.buildNoteDataMapping(notesData);

        // Map notes to staff lines
        const staffMap = this.mapNotesToStaffLines(noteElements);

        // Get container dimensions
        const containerRect = abcContainer.getBoundingClientRect();

        // Add marker zones for each staff line
        staffMap.forEach(staff => {
            if (!staff.notes.length) return;

            // Sort notes by horizontal position within each staff
            staff.notes.sort((a, b) => a.left - b.left);

            // Find the top position of the staff
            const staffEl = document.querySelector(`.abcjs-staff.abcjs-l${staff.lineNumber}`);
            if (!staffEl) return;

            const staffRect = staffEl.getBoundingClientRect();
            this.renderNoteMarkerZones(staff, staffRect, containerRect, layer);
        });
    }

    clearFingeringDiagrams() {
        const layer = document.getElementById('fingering-layer');
        if (layer) {
            // Only remove fingering diagrams, keep marker zones
            const diagrams = layer.querySelectorAll('.fingering-diagram-container');
            diagrams.forEach(diagram => diagram.remove());
        }
    }

    clearAllDiagrams() {
        const existing = document.getElementById('fingering-layer');
        if (existing) existing.remove();
    }

    /**
     * Adds a single fingering diagram for a specific note index
     * @param {number} noteIndex - The note index
     * @param {Array} notesData - All notes data
     */
    addSingleDiagram(noteIndex, notesData) {
        const abcContainer = document.getElementById('abc-notation');
        const layer = document.getElementById('fingering-layer');
        if (!layer || !abcContainer) return;

        // Convert noteIndex to integer for map lookup
        const noteIndexInt = parseInt(noteIndex, 10);

        // Find the note element with this index
        const noteElement = document.querySelector(`.abcjs-note[data-index="${noteIndex}"]`);
        if (!noteElement) return;

        // Get note data
        const noteDataMap = this.buildNoteDataMapping(notesData);
        const noteData = noteDataMap.get(noteIndexInt);
        if (!noteData || noteData.name === 'rest' || noteData.suppressDiagram) return;

        // Get fingering data
        const fingeringData = this.fingeringManager.getFingeringForNote(noteData.name);
        if (!fingeringData) return;

        // Find the staff line number
        const lineClass = Array.from(noteElement.classList).find(cls => cls.match(/abcjs-l\d+/));
        if (!lineClass) return;

        const lineNumber = parseInt(lineClass.replace('abcjs-l', ''), 10);
        const staffEl = document.querySelector(`.abcjs-staff.abcjs-l${lineNumber}`);
        if (!staffEl) return;

        // Calculate positions
        const noteRect = noteElement.getBoundingClientRect();
        const staffRect = staffEl.getBoundingClientRect();
        const containerRect = abcContainer.getBoundingClientRect();

        const diagramsTopPosition = staffRect.top - containerRect.top - this.config.verticalOffset;

        // Create the diagram
        const diagram = this.fingeringManager.createFingeringDiagram(fingeringData, noteData.name);
        diagram.setAttribute('data-note-index', noteIndex);

        // Check if this note already has a marked state and apply it
        const markerZone = document.querySelector(`[data-note-index="${noteIndex}"].note-marker-zone`);
        if (markerZone) {
            const markerState = markerZone.getAttribute('data-state');
            diagram.setAttribute('data-state', markerState);
            if (markerState === 'red') {
                diagram.style.backgroundColor = this.config.redColor;
            } else if (markerState === 'green') {
                diagram.style.backgroundColor = this.config.greenColor;
                diagram.classList.add('clicked');
            }
        }

        // Position the diagram
        diagram.style.position = 'absolute';
        diagram.style.left = `${noteRect.left - containerRect.left + (noteRect.width / 2)}px`;
        diagram.style.top = `${diagramsTopPosition}px`;
        diagram.style.transform = `translate(-50%, -100%) scale(${this.config.scale})`;
        diagram.style.transformOrigin = 'center bottom';

        layer.appendChild(diagram);
    }

    /**
     * Removes a single fingering diagram for a specific note index
     * @param {number} noteIndex - The note index
     */
    removeSingleDiagram(noteIndex) {
        const diagram = document.querySelector(`[data-note-index="${noteIndex}"].fingering-diagram-container`);
        if (diagram) {
            diagram.remove();
        }
    }
}