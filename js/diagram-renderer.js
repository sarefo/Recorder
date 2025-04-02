/**
 * Manages visual display of the fingering diagrams on the staff
 */
class DiagramRenderer {
    constructor(fingeringManager, config) {
        this.fingeringManager = fingeringManager;
        this.config = config;
    }

    addFingeringDiagrams(abcContainer, notesData) {
        // Create container for fingering diagrams
        this.clearFingeringDiagrams();

        const layer = document.createElement('div');
        layer.id = 'fingering-layer';
        layer.style.position = 'absolute';
        layer.style.top = '0';
        layer.style.left = '0';
        layer.style.width = '100%';
        layer.style.height = '100%';
        layer.style.pointerEvents = 'none'; // None for layer, but we'll enable it for diagrams
        layer.style.zIndex = '10';

        abcContainer.style.position = 'relative';
        abcContainer.appendChild(layer);

        // Extract notes from notesData
        const allNotes = notesData;

        // Find note elements
        const allElements = document.querySelectorAll("#abc-notation .abcjs-note");
        const noteElements = Array.from(allElements).filter(el => {
            // Filter out non-note elements that might have the note class
            return !el.classList.contains('abcjs-clef') &&
                !el.classList.contains('abcjs-key-signature') &&
                !el.classList.contains('abcjs-time-signature') &&
                !el.classList.contains('abcjs-tempo');
        });

        if (!noteElements.length) return;

        const containerRect = abcContainer.getBoundingClientRect();

        // Group notes by staff line
        const staffLines = this.groupNotesByStaffLine(noteElements);

        // Adjust note list if counts don't match
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

        // Add this before rendering diagrams
        const validNotes = notesData.filter(note =>
            this.fingeringManager.getFingeringForNote(note) !== null
        );
        console.log(`Found ${validNotes.length} valid notes out of ${notesData.length}`);

        // Add fingering diagrams for each staff line
        this.renderDiagramsOnStaff(staffLines, notesToUse, containerRect, layer);
    }

    groupNotesByStaffLine(noteElements) {
        const staffLines = [];
        const tolerance = 40; // pixels

        // Create positions map
        const notePositions = noteElements.map(el => {
            const rect = el.getBoundingClientRect();
            return {
                element: el,
                top: rect.top,
                left: rect.left,
                width: rect.width
            };
        });

        // Group by vertical position
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

        // Sort staff lines by vertical position (top to bottom)
        staffLines.sort((a, b) => a.top - b.top);

        // Sort notes within each staff line from left to right
        staffLines.forEach(staff => {
            staff.notes.sort((a, b) => a.left - b.left);
        });

        return staffLines;
    }

    renderDiagramsOnStaff(staffLines, notesToUse, containerRect, layer) {
        let noteIndex = 0;

        // Create a map of staff elements by their line number
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

        // Process each staff line
        staffLines.forEach((staff, staffIndex) => {
            if (staff.notes.length === 0) return;

            // Find the first note in this staff line and extract its line number from the class
            const noteElement = staff.notes[0].element;
            let lineNumber = null;

            // Look for the closest element with an abcjs-lN class
            let el = noteElement;
            while (el && lineNumber === null) {
                const lineClassMatch = Array.from(el.classList)
                    .find(cls => cls.match(/abcjs-l\d+/));

                if (lineClassMatch) {
                    lineNumber = parseInt(lineClassMatch.replace('abcjs-l', ''), 10);
                }
                el = el.parentElement;
            }

            // If we found a line number, get the corresponding staff element
            const staffElement = lineNumber !== null ? staffElementMap.get(lineNumber) : null;

            if (!staffElement) return;

            // Get the staff's position
            const staffRect = staffElement.getBoundingClientRect();

            // Position diagrams a consistent distance below the staff bottom
            const diagramsTopPosition = staffRect.bottom - containerRect.top + this.config.verticalOffset;

            // Process each note in this staff
            staff.notes.forEach(note => {
                if (noteIndex >= notesToUse.length) return;

                const noteName = notesToUse[noteIndex];
                const fingeringData = this.fingeringManager.getFingeringForNote(noteName);

                noteIndex++;
                if (!fingeringData) return;

                const diagram = this.fingeringManager.createFingeringDiagram(fingeringData, noteName);

                // Position horizontally based on note, vertically based on staff
                diagram.style.position = 'absolute';
                diagram.style.left = `${note.left - containerRect.left + (note.width / 2)}px`;
                diagram.style.top = `${diagramsTopPosition}px`;
                diagram.style.transform = `translate(-50%, 0) scale(${this.config.scale})`;
                diagram.style.transformOrigin = 'center top';

                layer.appendChild(diagram);
            });
        });
    }

    clearFingeringDiagrams() {
        const existing = document.getElementById('fingering-layer');
        if (existing) existing.remove();
    }
}
