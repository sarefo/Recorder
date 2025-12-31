/**
 * RegionManager - Manages Wavesurfer regions for note visualization
 */

import { getConfidenceColor, midiToNoteName } from '../core/utils.js';

export class RegionManager {
    constructor(app) {
        this.app = app;
        this.noteRegions = new Map();  // noteId -> region
    }

    /**
     * Display notes as regions on the waveform
     * @param {Array} notes - Array of note objects
     */
    displayNotes(notes) {
        this.clearAll();

        const regions = this.app.waveformManager.getRegions();
        if (!regions) return;

        for (const note of notes) {
            this.addNoteRegion(note);
        }
    }

    /**
     * Add a region for a single note
     * @param {Object} note - Note object
     * @returns {Object} The created region
     */
    addNoteRegion(note) {
        const regions = this.app.waveformManager.getRegions();
        if (!regions) return null;

        const color = note.userCorrected
            ? 'rgba(0, 123, 255, 0.4)'  // Blue for user-corrected
            : getConfidenceColor(note.confidence);

        const region = regions.addRegion({
            id: note.id,
            start: note.startTime,
            end: note.endTime,
            color: color,
            drag: true,
            resize: true,
            content: this._createRegionContent(note)
        });

        this.noteRegions.set(note.id, region);

        return region;
    }

    /**
     * Create content element for region (note label)
     * @private
     */
    _createRegionContent(note) {
        const label = document.createElement('span');
        label.className = 'region-label';
        label.textContent = midiToNoteName(note.midi);
        return label;
    }

    /**
     * Update an existing region
     * @param {string} noteId - Note ID
     * @param {Object} updates - Updates to apply
     */
    updateRegion(noteId, updates) {
        const region = this.noteRegions.get(noteId);
        if (!region) return;

        if (updates.start !== undefined) {
            region.setOptions({ start: updates.start });
        }
        if (updates.end !== undefined) {
            region.setOptions({ end: updates.end });
        }
        if (updates.color !== undefined) {
            region.setOptions({ color: updates.color });
        }
        if (updates.midi !== undefined) {
            // Update label
            const label = region.element?.querySelector('.region-label');
            if (label) {
                label.textContent = midiToNoteName(updates.midi);
            }
        }
    }

    /**
     * Remove a region
     * @param {string} noteId - Note ID
     */
    removeRegion(noteId) {
        const region = this.noteRegions.get(noteId);
        if (region) {
            region.remove();
            this.noteRegions.delete(noteId);
        }
    }

    /**
     * Highlight a region as selected
     * @param {string} noteId - Note ID
     */
    selectRegion(noteId) {
        // Deselect all
        this.deselectAll();

        const region = this.noteRegions.get(noteId);
        if (region && region.element) {
            region.element.classList.add('selected');
        }
    }

    /**
     * Deselect all regions
     */
    deselectAll() {
        for (const region of this.noteRegions.values()) {
            if (region.element) {
                region.element.classList.remove('selected');
            }
        }
    }

    /**
     * Clear all regions
     */
    clearAll() {
        const regions = this.app.waveformManager.getRegions();
        if (regions) {
            regions.clearRegions();
        }
        this.noteRegions.clear();
    }

    /**
     * Get region by note ID
     * @param {string} noteId - Note ID
     * @returns {Object} Region object
     */
    getRegion(noteId) {
        return this.noteRegions.get(noteId);
    }

    /**
     * Get all regions
     * @returns {Map} Map of noteId -> region
     */
    getAllRegions() {
        return this.noteRegions;
    }

    /**
     * Refresh all region displays
     */
    refresh() {
        this.displayNotes(this.app.correctedNotes);
    }
}
