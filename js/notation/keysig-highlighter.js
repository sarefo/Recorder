/**
 * Highlights the notes that the key signature silently alters — e.g. with
 * one sharp, every printed F sounds as F# without showing an accidental.
 * Toggled by tapping the key signature at the start of a line; off by
 * default and reset when a different tune is loaded.
 */
class KeySignatureHighlighter {
    static TAP_PADDING = 6;

    constructor(player) {
        this.player = player;
        this.enabled = false;
    }

    /**
     * Forgets the toggle state (called when a different tune is loaded)
     */
    reset() {
        this.enabled = false;
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
    }

    /**
     * Marks every note the key signature alters with the .keysig-affected
     * class (or clears all marks when disabled)
     */
    apply() {
        document.querySelectorAll('#abc-notation .keysig-affected')
            .forEach(el => el.classList.remove('keysig-affected'));
        if (!this.enabled) return;

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
                            if (this.isAffected(element, keyMap, measureAccidentals)) {
                                (element.abselem?.elemset || []).forEach(svg =>
                                    svg.classList?.add('keysig-affected'));
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
     * Decides whether a note sounds altered by the key signature alone —
     * i.e. nothing is printed on it, no earlier accidental in the measure
     * governs its letter, but the signature does
     * @param {Object} element - abcjs note element
     * @param {Object} keyMap - Letters altered by the signature
     * @param {Object} measureAccidentals - Letters with an explicit
     *   accidental earlier in the current measure (mutated here)
     * @returns {boolean} Whether to highlight the note
     */
    isAffected(element, keyMap, measureAccidentals) {
        let affected = false;
        (element.pitches || []).forEach(pitch => {
            const letter = pitch.name.replace(/^[=^_]+/, '').charAt(0).toUpperCase();
            if (pitch.accidental) {
                measureAccidentals[letter] = pitch.accidental;
            } else if (!measureAccidentals[letter] && keyMap[letter]) {
                affected = true;
            }
        });
        return affected;
    }
}
