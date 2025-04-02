/**
 * Manages visual display of the fingering diagrams on the staff
 */
class DiagramRenderer {
    constructor(fingeringManager, config) {
        this.fingeringManager = fingeringManager;
        this.config = config;
    }

    /**
     * Creates a container for all fingering diagrams
     * @returns {HTMLElement} The diagram layer container
     */
    createDiagramLayer() {
        const layer = document.createElement('div');
        layer.id = 'fingering-layer';
        layer.style.position = 'absolute';
        layer.style.top = '0';
        layer.style.left = '0';
        layer.style.width = '100%';
        layer.style.height = '100%';
        layer.style.pointerEvents = 'none'; // None for layer, but we'll enable it for diagrams
        layer.style.zIndex = '10';
        return layer;
    }

    /**
     * Main method to add fingering diagrams to the notation
     * @param {HTMLElement} abcContainer - The ABC notation container
     * @param {Array} notesData - Array of note names
     */
    addFingeringDiagrams(abcContainer, notesData) {
        // Clear any existing diagrams
        this.clearFingeringDiagrams();

        // Create the layer for fingering diagrams
        const layer = this.createDiagramLayer();
        abcContainer.style.position = 'relative';
        abcContainer.appendChild(layer);

        // Find and filter note elements
        const noteElements = this.findNoteElements();
        if (!noteElements.length) return;

        // Get container dimensions
        const containerRect = abcContainer.getBoundingClientRect();

        // Group notes by staff line
        const staffLines = this.groupNotesByStaffLine(noteElements);

        // Prepare the note data according to staff layout
        const notesToUse = this.prepareNoteData(notesData, staffLines);

        // Log info about valid notes (useful for debugging)
        this.logValidNotesInfo(notesData);

        // Add fingering diagrams for each staff line
        this.renderDiagramsOnStaff(staffLines, notesToUse, containerRect, layer);
    }

    /**
     * Find and filter note elements in the rendered notation
     * @returns {Array} Filtered array of note elements
     */
    findNoteElements() {
        const allElements = document.querySelectorAll("#abc-notation .abcjs-note");
        return Array.from(allElements).filter(el => {
            // Filter out non-note elements that might have the note class
            return !el.classList.contains('abcjs-clef') &&
                !el.classList.contains('abcjs-key-signature') &&
                !el.classList.contains('abcjs-time-signature') &&
                !el.classList.contains('abcjs-tempo');
        });
    }

    /**
     * Prepare note data to match the staff layout
     * @param {Array} allNotes - Original note data
     * @param {Array} staffLines - Grouped staff lines with notes
     * @returns {Array} Adjusted note array
     */
    prepareNoteData(allNotes, staffLines) {
        let notesToUse = [...allNotes];
        const totalNoteElements = staffLines.reduce((sum, staff) => sum + staff.notes.length, 0);

        if (totalNoteElements !== notesToUse.length) {
            // Adjust list length to match element count
            if (totalNoteElements < notesToUse.length) {
                notesToUse = notesToUse.slice(0, totalNoteElements);
            } else {
                // Fill with the last note if we have more elements than notes
                while (notesToUse.length < totalNoteElements) {
                    notesToUse.push(notesToUse[notesToUse.length - 1] || "?");
                }
            }
        }
        return notesToUse;
    }

    /**
     * Log information about valid notes (for debugging)
     * @param {Array} notesData - Array of note names
     */
    logValidNotesInfo(notesData) {
        const validNotes = notesData.filter(note =>
            this.fingeringManager.getFingeringForNote(note) !== null
        );
        console.log(`Found ${validNotes.length} valid notes out of ${notesData.length}`);
    }

    /**
     * Group note elements by their vertical position on staff lines
     * @param {Array} noteElements - Array of note elements
     * @returns {Array} Notes grouped by staff line
     */
    groupNotesByStaffLine(noteElements) {
        const staffLines = [];
        const tolerance = 40; // pixels

        // Create positions map
        const notePositions = this.createNotePositionsMap(noteElements);

        // Group by vertical position
        this.groupNotesByVerticalPosition(notePositions, staffLines, tolerance);

        // Sort staff lines by vertical position (top to bottom)
        staffLines.sort((a, b) => a.top - b.top);

        // Sort notes within each staff line from left to right
        staffLines.forEach(staff => {
            staff.notes.sort((a, b) => a.left - b.left);
        });

        return staffLines;
    }

    /**
     * Create a map of note positions from elements
     * @param {Array} noteElements - Array of note elements
     * @returns {Array} Array of note position objects
     */
    createNotePositionsMap(noteElements) {
        return noteElements.map(el => {
            const rect = el.getBoundingClientRect();
            return {
                element: el,
                top: rect.top,
                left: rect.left,
                width: rect.width
            };
        });
    }

    /**
     * Group notes by their vertical position
     * @param {Array} notePositions - Array of note position objects
     * @param {Array} staffLines - Array to populate with staff lines
     * @param {number} tolerance - Vertical tolerance in pixels
     */
    groupNotesByVerticalPosition(notePositions, staffLines, tolerance) {
        notePositions.forEach(pos => {
            let foundStaff = false;
            for (const staff of staffLines) {
                if (Math.abs(staff.top - pos.top) <= tolerance) {
                    staff.notes.push(pos);
                    foundStaff = true;
                    break;
                }
            }

            if (!foundStaff) {
                staffLines.push({
                    top: pos.top,
                    notes: [pos]
                });
            }
        });
    }

    /**
     * Render fingering diagrams on the staff
     * @param {Array} staffLines - Notes grouped by staff line
     * @param {Array} notesToUse - Array of note names
     * @param {DOMRect} containerRect - Container bounding rectangle
     * @param {HTMLElement} layer - Container for diagrams
     */
    renderDiagramsOnStaff(staffLines, notesToUse, containerRect, layer) {
        let noteIndex = 0;

        // Create staff element map
        const staffElementMap = this.createStaffElementMap();

        // Process each staff line
        staffLines.forEach((staff, staffIndex) => {
            if (staff.notes.length === 0) return;

            // Get diagram vertical position for this staff
            const diagramsTopPosition = this.getDiagramVerticalPosition(staff, containerRect, staffElementMap);
            if (diagramsTopPosition === null) return;

            // Process each note in this staff
            staff.notes.forEach(note => {
                if (noteIndex >= notesToUse.length) return;

                this.renderDiagramForNote(note, notesToUse[noteIndex], containerRect, diagramsTopPosition, layer);
                noteIndex++;
            });
        });
    }

    /**
     * Create a map of staff elements by their line number
     * @returns {Map} Map of staff elements by line number
     */
    createStaffElementMap() {
        const staffElementMap = new Map();
        const staffElements = document.querySelectorAll('.abcjs-staff');

        staffElements.forEach(el => {
            // Look for the abcjs-lN class to determine line number
            const lineClassMatch = Array.from(el.classList)
                .find(cls => cls.match(/abcjs-l\d+/));

            if (lineClassMatch) {
                const lineNumber = parseInt(lineClassMatch.replace('abcjs-l', ''), 10);
                staffElementMap.set(lineNumber, el);
            }
        });

        return staffElementMap;
    }

    /**
     * Get the vertical position for diagrams on a staff
     * @param {Object} staff - Staff line object
     * @param {DOMRect} containerRect - Container bounding rectangle
     * @param {Map} staffElementMap - Map of staff elements
     * @returns {number|null} Vertical position or null if not found
     */
    getDiagramVerticalPosition(staff, containerRect, staffElementMap) {
        // Find the first note in this staff line and extract its line number from the class
        const noteElement = staff.notes[0].element;
        let lineNumber = this.findLineNumberForElement(noteElement);

        // If we found a line number, get the corresponding staff element
        const staffElement = lineNumber !== null ? staffElementMap.get(lineNumber) : null;
        if (!staffElement) return null;

        // Get the staff's position
        const staffRect = staffElement.getBoundingClientRect();

        // Position diagrams a consistent distance below the staff bottom
        return staffRect.bottom - containerRect.top + this.config.verticalOffset;
    }

    /**
     * Find the line number for a note element
     * @param {HTMLElement} element - Note element
     * @returns {number|null} Line number or null if not found
     */
    findLineNumberForElement(element) {
        let lineNumber = null;
        let el = element;

        // Look for the closest element with an abcjs-lN class
        while (el && lineNumber === null) {
            const lineClassMatch = Array.from(el.classList)
                .find(cls => cls.match(/abcjs-l\d+/));

            if (lineClassMatch) {
                lineNumber = parseInt(lineClassMatch.replace('abcjs-l', ''), 10);
            }
            el = el.parentElement;
        }

        return lineNumber;
    }

    /**
     * Render a fingering diagram for a specific note
     * @param {Object} note - Note position object
     * @param {string} noteName - ABC notation note name
     * @param {DOMRect} containerRect - Container bounding rectangle
     * @param {number} verticalPosition - Vertical position for the diagram
     * @param {HTMLElement} layer - Container for diagrams
     */
    renderDiagramForNote(note, noteName, containerRect, verticalPosition, layer) {
        const fingeringData = this.fingeringManager.getFingeringForNote(noteName);
        if (!fingeringData) return;

        const diagram = this.fingeringManager.createFingeringDiagram(fingeringData, noteName);

        // Position horizontally based on note, vertically based on staff
        diagram.style.position = 'absolute';
        diagram.style.left = `${note.left - containerRect.left + (note.width / 2)}px`;
        diagram.style.top = `${verticalPosition}px`;
        diagram.style.transform = `translate(-50%, 0) scale(${this.config.scale})`;
        diagram.style.transformOrigin = 'center top';

        layer.appendChild(diagram);
    }

    /**
     * Remove all fingering diagrams
     */
    clearFingeringDiagrams() {
        const existing = document.getElementById('fingering-layer');
        if (existing) existing.remove();
    }
}
