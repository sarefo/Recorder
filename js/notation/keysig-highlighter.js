/**
 * Highlights the notes that the key signature silently alters — e.g. with
 * one sharp, every printed F sounds as F# without showing an accidental.
 * Toggled by tapping the key signature at the start of a line; off by
 * default and reset when a different tune is loaded.
 *
 * Turning it on also marks the first occurrence of each altered pitch red,
 * so its fingering diagram shows in 'marked' fingering mode; turning it
 * off clears those marks again.
 */
class KeySignatureHighlighter {
    static TAP_PADDING = 6;

    constructor(player) {
        this.player = player;
        this.enabled = false;
        // Note indices this highlighter marked red, so toggling off only
        // clears its own marks
        this.markedIndices = new Set();
    }

    /**
     * Forgets the toggle state (called when a different tune is loaded)
     */
    reset() {
        this.enabled = false;
        this.markedIndices.clear();
    }

    /**
     * Wires tap handlers onto the rendered key-signature glyphs and
     * re-applies the highlight state. Call after every render — the SVG
     * is rebuilt each time, so listeners never stack.
     */
    setup() {
        const container = document.getElementById('abc-notation');
        if (!container) return;

        container.querySelectorAll('.abcjs-key-signature').forEach(group => {
            this.addTapTarget(group);
            group.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        });

        this.apply();
    }

    /**
     * The engraved sharps/flats are thin; give the group an invisible
     * padded rect so finger taps land reliably
     * @param {SVGGElement} group - A rendered .abcjs-key-signature group
     */
    addTapTarget(group) {
        try {
            const bbox = group.getBBox();
            const pad = KeySignatureHighlighter.TAP_PADDING;
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', bbox.x - pad);
            rect.setAttribute('y', bbox.y - pad);
            rect.setAttribute('width', bbox.width + 2 * pad);
            rect.setAttribute('height', bbox.height + 2 * pad);
            rect.setAttribute('fill', 'transparent');
            group.appendChild(rect);
        } catch (error) {
            // getBBox throws on detached/hidden SVG; the glyphs themselves
            // remain tappable in that case
        }
    }

    /**
     * Flips the highlight on or off and repaints
     */
    toggle() {
        this.enabled = !this.enabled;
        this.apply();
        if (this.enabled) {
            this.markFirstOccurrences();
        } else {
            this.clearMarks();
        }
    }

    /**
     * Marks every note the key signature alters with the .keysig-affected
     * class (or clears all marks when disabled)
     */
    apply() {
        document.querySelectorAll('#abc-notation .keysig-affected')
            .forEach(el => el.classList.remove('keysig-affected'));
        if (!this.enabled) return;

        this.forEachAffectedNote(element => {
            (element.abselem?.elemset || []).forEach(svg =>
                svg.classList?.add('keysig-affected'));
        });
    }

    /**
     * Marks red the first note of each distinct pitch the key signature
     * alters (F#4 and F#5 finger differently, so both count). Notes the
     * user already marked are left alone.
     */
    markFirstOccurrences() {
        const fingeringManager = this.player.fingeringManager;
        const selectables = this.player.renderManager?.currentVisualObj?.engraver?.selectables;
        if (!fingeringManager || !selectables) return;

        const indexByAbsElem = new Map();
        selectables.forEach((sel, index) => indexByAbsElem.set(sel.absEl, index));

        const seenPitches = new Set();
        this.forEachAffectedNote((element, affectedPitches) => {
            const newPitches = affectedPitches.filter(p => !seenPitches.has(p));
            if (!newPitches.length) return;
            newPitches.forEach(p => seenPitches.add(p));

            const noteIndex = indexByAbsElem.get(element.abselem);
            if (noteIndex === undefined) return;
            const zone = document.querySelector(`[data-note-index="${noteIndex}"].note-marker-zone`);
            if (!zone || zone.getAttribute('data-state') !== 'neutral') return;

            fingeringManager.setNoteMarkState(noteIndex, 'red');
            this.markedIndices.add(noteIndex);
        });
    }

    /**
     * Clears the red marks this highlighter set, unless the user has since
     * changed them
     */
    clearMarks() {
        const fingeringManager = this.player.fingeringManager;
        this.markedIndices.forEach(noteIndex => {
            const zone = document.querySelector(`[data-note-index="${noteIndex}"].note-marker-zone`);
            if (zone?.getAttribute('data-state') === 'red') {
                fingeringManager?.setNoteMarkState(noteIndex, 'neutral');
            }
        });
        this.markedIndices.clear();
    }

    /**
     * Walks the score in order and calls back for every note the key
     * signature alters
     * @param {Function} callback - Called with (element, affectedPitches),
     *   affectedPitches being the abcjs pitch numbers altered on that note
     */
    forEachAffectedNote(callback) {
        const visualObj = this.player.renderManager?.currentVisualObj;
        if (!visualObj || !visualObj.lines) return;

        visualObj.lines.forEach(line => {
            (line.staff || []).forEach(staff => {
                let keyMap = this.buildKeyMap(staff.key);
                staff.voices.forEach(voice => {
                    const measureAccidentals = {};
                    voice.forEach(element => {
                        if (element.el_type === 'bar') {
                            Object.keys(measureAccidentals)
                                .forEach(k => delete measureAccidentals[k]);
                        } else if (element.el_type === 'key') {
                            // Mid-tune key change: notes after it follow the
                            // new signature
                            keyMap = this.buildKeyMap(element);
                        } else if (element.el_type === 'note' && !element.rest) {
                            const affectedPitches = this.affectedPitches(
                                element, keyMap, measureAccidentals);
                            if (affectedPitches.length) {
                                callback(element, affectedPitches);
                            }
                        }
                    });
                });
            });
        });
    }

    /**
     * Reduces an abcjs key object to { letter: true } for the letters its
     * sharps/flats alter. Reading the parsed accidentals (not the K: text)
     * keeps modal keys like A dorian correct.
     * @param {Object} key - abcjs key object with an accidentals array
     * @returns {Object} Letters altered by the signature
     */
    buildKeyMap(key) {
        const map = {};
        (key?.accidentals || []).forEach(acc => {
            if (acc.acc === 'sharp' || acc.acc === 'flat') {
                map[acc.note.charAt(0).toUpperCase()] = true;
            }
        });
        return map;
    }

    /**
     * Finds the pitches of a note that sound altered by the key signature alone —
     * i.e. nothing is printed on it, no earlier accidental in the measure
     * governs its letter, but the signature does
     * @param {Object} element - abcjs note element
     * @param {Object} keyMap - Letters altered by the signature
     * @param {Object} measureAccidentals - Letters with an explicit
     *   accidental earlier in the current measure (mutated here)
     * @returns {number[]} abcjs pitch numbers of the altered pitches (empty
     *   if the note is not affected)
     */
    affectedPitches(element, keyMap, measureAccidentals) {
        const affected = [];
        (element.pitches || []).forEach(pitch => {
            const letter = pitch.name.replace(/^[=^_]+/, '').charAt(0).toUpperCase();
            if (pitch.accidental) {
                measureAccidentals[letter] = pitch.accidental;
            } else if (!measureAccidentals[letter] && keyMap[letter]) {
                affected.push(pitch.pitch);
            }
        });
        return affected;
    }
}
