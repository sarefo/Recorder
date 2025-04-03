class DiagramRenderer {
    constructor(fingeringManager, config) {
        this.fingeringManager = fingeringManager;
        this.config = config;
    }

    createDiagramLayer() {
        const layer = document.createElement('div');
        layer.id = 'fingering-layer';
        layer.style.position = 'absolute';
        layer.style.top = '0';
        layer.style.left = '0';
        layer.style.width = '100%';
        layer.style.height = '100%';
        layer.style.pointerEvents = 'none';
        layer.style.zIndex = '10';
        return layer;
    }

    addFingeringDiagrams(abcContainer, notesData) {
        // Clear any existing diagrams
        this.clearFingeringDiagrams();

        // Create the layer for fingering diagrams
        const layer = this.createDiagramLayer();
        abcContainer.style.position = 'relative';
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

        // Create an array to store the debugging info
        const noteSequenceDebugInfo = [];

        // Add diagrams for each staff line
        this.renderDiagramsByStaff(staffMap, noteDataMap, containerRect, layer, noteSequenceDebugInfo);

        // Log the note sequence for debugging
        console.group('Diagram Note Sequence (for debugging)');
        console.log('Original ABC Notes count:', notesData.length);
        console.table(noteSequenceDebugInfo);

        // Create a more readable version for comparison
        const sequenceString = noteSequenceDebugInfo
            .map(info => `${info.position}. data-index ${info.dataIndex}: ${info.noteName} (staff ${info.staffLine}, measure ${info.measure})`)
            .join('\n');

        console.log('Notes as rendered (for easy comparison):\n' + sequenceString);
        console.groupEnd();
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
            noteDataMap.set(index, note);
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

    renderDiagramsByStaff(staffMap, noteDataMap, containerRect, layer, debugInfo) {
        let position = 0;

        // For each staff line
        staffMap.forEach(staff => {
            if (!staff.bottom || !staff.notes.length) return;

            // Sort notes by horizontal position within each staff
            staff.notes.sort((a, b) => a.left - b.left);

            // Position for diagrams is below the staff
            const diagramsTopPosition = staff.bottom - containerRect.top + this.config.verticalOffset;

            // Add diagrams for each note in this staff
            staff.notes.forEach(note => {
                // Get the corresponding note data using data-index
                const noteName = noteDataMap.get(note.dataIndex);

                if (noteName) {
                    // Add to debug info
                    debugInfo.push({
                        position: position++,
                        dataIndex: note.dataIndex,
                        noteName: noteName,
                        staffLine: staff.lineNumber,
                        measure: note.measure,
                        left: Math.round(note.left - containerRect.left)
                    });

                    this.renderDiagramForNote(note, noteName, containerRect, diagramsTopPosition, layer);
                } else {
                    console.warn(`No note data found for data-index ${note.dataIndex}`);
                }
            });
        });
    }

    renderDiagramForNote(note, noteName, containerRect, verticalPosition, layer) {
        const fingeringData = this.fingeringManager.getFingeringForNote(noteName);
        if (!fingeringData) return;

        const diagram = this.fingeringManager.createFingeringDiagram(fingeringData, noteName);

        // Add data-index as a debug label
        const debugLabel = document.createElement('div');
        debugLabel.textContent = `${note.dataIndex}`;
        debugLabel.style.fontSize = '10px';
        debugLabel.style.fontWeight = 'bold';
        debugLabel.style.color = 'red';
        debugLabel.style.position = 'absolute';
        debugLabel.style.top = '0';
        debugLabel.style.left = '0';

        // Add measure information
        const measureLabel = document.createElement('div');
        measureLabel.textContent = `m:${note.measure}`;
        measureLabel.style.fontSize = '10px';
        measureLabel.style.color = 'green';
        measureLabel.style.position = 'absolute';
        measureLabel.style.bottom = '0';
        measureLabel.style.right = '0';

        // Position the diagram
        diagram.style.position = 'absolute';
        diagram.style.left = `${note.left - containerRect.left + (note.width / 2)}px`;
        diagram.style.top = `${verticalPosition}px`;
        diagram.style.transform = `translate(-50%, 0) scale(${this.config.scale})`;
        diagram.style.transformOrigin = 'center top';

        // Make room for the debug labels
        diagram.style.paddingTop = '15px';
        diagram.style.paddingBottom = '15px';

        // Append debug labels
        diagram.appendChild(debugLabel);
        diagram.appendChild(measureLabel);

        layer.appendChild(diagram);
    }

    clearFingeringDiagrams() {
        const existing = document.getElementById('fingering-layer');
        if (existing) existing.remove();
    }
}