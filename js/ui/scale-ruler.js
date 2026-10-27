/**
 * A ribbon above the score showing every recorder note with its fingering.
 * Notes that belong to the scale for the current chord stay bright (chord
 * tones marked); the rest are grayed out. During playback it follows the
 * chord under the playing note.
 */
class ScaleRuler {
    static SETTING = 'scaleRulerVisible';
    static FIT_SETTING = 'scaleHighlightNotes';
    static STAFF_SETTING = 'scaleStaffVisible';

    constructor(player) {
        this.player = player;
        this.element = null;
        this.notesEl = null;
        this.titleEl = null;
        this.chordsEl = null;
        this.frameEl = null;
        this.orderBtn = null;
        this.fitBtn = null;
        this.staffBtn = null;
        this.staffEl = null;
        this.suggestion = null; // the scale on show
        this.staffVisible = !!player.settingsManager?.get(ScaleRuler.STAFF_SETTING);
        this.noteNames = null; // note names of the score by data-index, read lazily
        this.scalePcs = null; // pitch classes of the scale on show
        this.fitNotes = !!player.settingsManager?.get(ScaleRuler.FIT_SETTING);
        this.cells = []; // [{ cell, label, pc }] in pitch order
        this.cellsSystem = null; // fingering system the cells were built for
        this.chordTimeline = []; // [{ startChar, chord }] in score order
        this.keyPcs = null;
        this.keyText = '';
        this.currentChord = null;
        this.visible = !!player.settingsManager?.get(ScaleRuler.SETTING);
    }

    /** Builds the ribbon and applies the saved visibility. */
    setup() {
        const el = document.createElement('section');
        el.id = 'scale-ribbon';
        el.className = 'scale-ribbon';
        el.setAttribute('aria-label', 'Scale for the current chord');

        const header = document.createElement('div');
        header.className = 'scale-ribbon-header';
        this.titleEl = document.createElement('div');
        this.titleEl.className = 'scale-ribbon-title';
        this.chordsEl = document.createElement('div');
        this.chordsEl.className = 'scale-ribbon-chords';
        this.chordsEl.setAttribute('role', 'group');
        this.chordsEl.setAttribute('aria-label', 'Chords in this tune');
        this.chordsEl.addEventListener('click', (e) => {
            const chip = e.target.closest('.scale-ribbon-chord');
            if (chip) this.showChord(chip.dataset.chord);
        });
        this.orderBtn = document.createElement('button');
        this.orderBtn.type = 'button';
        this.orderBtn.className = 'scale-ribbon-order';
        this.orderBtn.addEventListener('click', () => this.toggleOrder());

        // Experimental: color every note of the tune that fits the shown scale
        this.fitBtn = document.createElement('button');
        this.fitBtn.type = 'button';
        this.fitBtn.className = 'scale-ribbon-order';
        this.fitBtn.textContent = '◉ Fit';
        this.fitBtn.title = 'Experimental: color every note in the tune that fits this scale';
        this.fitBtn.addEventListener('click', () => this.toggleFit());

        // The scale as sheet music, under the fingering row
        this.staffBtn = document.createElement('button');
        this.staffBtn.type = 'button';
        this.staffBtn.className = 'scale-ribbon-order';
        this.staffBtn.textContent = '𝄞 Staff';
        this.staffBtn.title = 'Show the scale as sheet music';
        this.staffBtn.addEventListener('click', () => this.toggleStaff());

        const tools = document.createElement('div');
        tools.className = 'scale-ribbon-tools';
        tools.append(this.orderBtn, this.fitBtn, this.staffBtn);
        header.append(this.titleEl, this.chordsEl, tools);
        this.notesEl = document.createElement('div');
        this.notesEl.className = 'scale-ribbon-notes';
        // Sits behind the cells, so a grayed-out cell does not dim it
        this.frameEl = document.createElement('div');
        this.frameEl.className = 'scale-ribbon-octave';
        this.staffEl = document.createElement('div');
        this.staffEl.className = 'scale-ribbon-staff';
        this.staffEl.hidden = true;
        el.append(header, this.notesEl, this.staffEl);

        // Keep scroll targets clear of the sticky ribbon whatever its height
        if (window.ResizeObserver) {
            new ResizeObserver(() => {
                document.documentElement.style.setProperty(
                    '--scale-ribbon-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
            }).observe(el);
        }

        // Above the chart row, so it sits right over the score
        const anchor = document.getElementById('reference-row');
        if (anchor) anchor.before(el);
        else document.body.prepend(el);
        this.element = el;

        this.applyVisibility();
    }

    /** @param {boolean} [force] Show or hide; omitted flips the current state. */
    toggle(force) {
        this.visible = typeof force === 'boolean' ? force : !this.visible;
        this.player.settingsManager?.set(ScaleRuler.SETTING, this.visible);
        this.applyVisibility();
        if (this.visible) {
            this.currentChord = null;
            this.showChord(this.chordTimeline[0]?.chord || this.keyChord());
            this.centerOnRoot();
        }
    }

    applyVisibility() {
        this.element?.classList.toggle('visible', this.visible);
        document.body.classList.toggle('scale-ribbon-on', this.visible);
        document.getElementById('scale-toggle')?.classList.toggle('active', this.visible);
        this.fitBtn?.classList.toggle('active', this.fitNotes);
        this.fitBtn?.setAttribute('aria-pressed', String(this.fitNotes));
        this.staffBtn?.classList.toggle('active', this.staffVisible);
        this.staffBtn?.setAttribute('aria-pressed', String(this.staffVisible));
        if (this.staffEl) this.staffEl.hidden = !(this.visible && this.staffVisible);
        this.markFittingNotes();
        this.renderStaff();
    }

    toggleStaff() {
        this.staffVisible = !this.staffVisible;
        this.player.settingsManager?.set(ScaleRuler.STAFF_SETTING, this.staffVisible);
        this.applyVisibility();
    }

    /**
     * Draws the scale on show as sheet music, starting on the root and
     * ascending from the root (placed A3 to G#4), with the chord tones in the
     * accent color.
     */
    renderStaff() {
        const sug = this.suggestion;
        if (!this.staffEl || this.staffEl.hidden || !sug || typeof ABCJS === 'undefined') return;
        try {
            // Always ascends from the root, which sits between A3 and G#4 so
            // the whole scale stays on and around the staff lines
            const rootMidi = 60 + ScaleAdvisor.LETTER_PC[sug.rootLetter] + sug.rootAcc;
            const lowestRoot = 57;
            const target = lowestRoot + (((rootMidi - lowestRoot) % 12) + 12) % 12;
            const shift = Math.round((target - rootMidi) / 12);
            const tones = sug.degrees.map(d => ScaleAdvisor.abcNote(sug, d, shift));
            // M:none and no bar lines: just the notes after the clef
            ABCJS.renderAbc(this.staffEl, `X:1
M:none
L:1/4
K:C
${tones.join(' ')}|]
`, {
                staffwidth: 40 + tones.length * 34,
                paddingtop: 0, paddingbottom: 0, paddingleft: 0, paddingright: 0,
                add_classes: true
            });
            const notes = this.staffEl.querySelectorAll('.abcjs-note');
            notes.forEach((el, i) => {
                const degree = sug.degrees[i] || sug.degrees[0];
                el.classList.toggle('chord-tone', sug.chordTones.has(degree.interval));
                // Not part of the score: keep the score's own selectors off it
                el.classList.remove('abcjs-note');
                el.classList.add('scale-staff-note');
                el.removeAttribute('data-index');
            });
        } catch (error) {
            console.error('ScaleRuler: could not draw the staff:', error);
        }
    }

    toggleFit() {
        this.fitNotes = !this.fitNotes;
        this.player.settingsManager?.set(ScaleRuler.FIT_SETTING, this.fitNotes);
        this.applyVisibility();
    }

    /**
     * Colors every note in the score whose pitch class is in the scale on
     * show. Clears the marks when the option or the ribbon is off.
     */
    markFittingNotes() {
        const notes = document.querySelectorAll('#abc-notation .abcjs-note');
        const on = this.visible && this.fitNotes && this.scalePcs;
        if (on && !this.noteNames) {
            try {
                // Same list the fingering diagrams use; data-index points into it
                this.noteNames = this.player.notationParser.extractCleanedNotes()
                    .map(n => (typeof n === 'string' ? n : n.name));
            } catch (error) {
                console.error('ScaleRuler: could not read the notes:', error);
                this.noteNames = [];
            }
        }
        for (const el of notes) {
            let fits = false;
            if (on) {
                const name = this.noteNames[parseInt(el.getAttribute('data-index'), 10)];
                fits = !!name && name !== 'rest' && this.scalePcs.has(ScaleRuler.pitchClass(name));
            }
            el.classList.toggle('scale-fit', fits);
        }
    }

    /**
     * Called after every render: reads the chords and key from the new score.
     * @param {Object} visualObj - The abcjs visual object
     */
    onRender(visualObj) {
        this.chordTimeline = [];
        this.currentChord = null;
        this.noteNames = null;
        try {
            const abc = this.player.notationParser?.currentAbc || '';
            this.keyText = (/^K:\s*(.*)$/m.exec(abc)?.[1] || '').split('%')[0].trim();
            this.keyPcs = ScaleAdvisor.keyPitchClasses(this.keyText);

            for (const line of visualObj?.lines || []) {
                for (const staff of line.staff || []) {
                    for (const el of (staff.voices?.[0] || [])) {
                        const chord = el.chord?.find(c => c.position === 'default' && c.name)?.name
                            || el.chord?.[0]?.name;
                        if (chord && typeof el.startChar === 'number') {
                            this.chordTimeline.push({ startChar: el.startChar, chord });
                        }
                    }
                }
            }
            this.chordTimeline.sort((a, b) => a.startChar - b.startChar);
        } catch (error) {
            console.error('ScaleRuler: could not read chords:', error);
        }
        this.buildChordChips();
        if (this.visible) {
            this.showChord(this.chordTimeline[0]?.chord || this.keyChord());
            this.centerOnRoot();
        }
    }

    /** @returns {boolean} True when chips run C to B, false for play order. */
    get orderByPitch() {
        return this.player.settingsManager?.get('scaleChordOrder') !== 'play';
    }

    toggleOrder() {
        this.player.settingsManager?.set('scaleChordOrder', this.orderByPitch ? 'play' : 'pitch');
        this.buildChordChips();
        this.markActiveChip();
    }

    /** Semitones above C of a chord's root, for sorting. */
    static chordRootPc(chord) {
        const root = ScaleAdvisor.parseRoot(chord);
        return root ? (ScaleAdvisor.LETTER_PC[root.letter] + root.acc + 12) % 12 : 12;
    }

    /**
     * One chip per distinct chord; a tap shows its scale. Order is C to B by
     * root (play order within a root) or the order of first appearance.
     */
    buildChordChips() {
        this.chordsEl.replaceChildren();
        this.orderBtn.textContent = this.orderByPitch ? '⇅ C–B' : '⇅ Play';
        this.orderBtn.title = this.orderByPitch
            ? 'Chords ordered by root; tap for play order'
            : 'Chords in play order; tap to order by root';
        const chords = [...new Set(this.chordTimeline.map(e => e.chord))];
        if (this.orderByPitch) {
            // Array.sort is stable, so equal roots keep their play order
            chords.sort((a, b) => ScaleRuler.chordRootPc(a) - ScaleRuler.chordRootPc(b));
        }
        for (const chord of chords) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'scale-ribbon-chord';
            chip.dataset.chord = chord;
            chip.textContent = chord;
            this.chordsEl.appendChild(chip);
        }
    }

    /** A tune without chord symbols falls back to its key's own scale. */
    keyChord() {
        const root = ScaleAdvisor.parseRoot(this.keyText);
        if (!root) return null;
        const rest = this.keyText.slice(root.length).toLowerCase();
        const minor = rest.startsWith('m') && !rest.startsWith('maj') && !rest.startsWith('mix');
        return this.keyText.slice(0, root.length) + (minor ? 'm' : '');
    }

    /**
     * Playback event from the timing callbacks.
     * @param {Object} ev - abcjs event; startCharArray locates the note in the ABC text
     */
    onNoteEvent(ev) {
        if (!this.visible || !this.chordTimeline.length) return;
        const char = ev?.startCharArray?.[0];
        if (typeof char !== 'number') return;
        let chord = this.chordTimeline[0].chord;
        for (const entry of this.chordTimeline) {
            if (entry.startChar > char) break;
            chord = entry.chord;
        }
        this.showChord(chord);
    }

    /** @param {string|null} chord - Chord symbol to show the scale of */
    showChord(chord) {
        if (!this.element || !chord || chord === this.currentChord) return;
        const suggestion = ScaleAdvisor.suggest(chord, this.keyPcs);
        if (!suggestion) return;
        this.currentChord = chord;
        this.ensureCells();
        this.paint(suggestion);
        this.markActiveChip();
    }

    markActiveChip() {
        for (const chip of this.chordsEl.children) {
            const active = chip.dataset.chord === this.currentChord;
            chip.classList.toggle('active', active);
            chip.setAttribute('aria-pressed', String(active));
            if (active) {
                // Scroll the strip only, and only when the chip is cut off, so
                // chips stay put otherwise (scrollIntoView could move the page too)
                const strip = this.chordsEl;
                const left = chip.offsetLeft;
                const right = left + chip.offsetWidth;
                if (left < strip.scrollLeft || right > strip.scrollLeft + strip.clientWidth) {
                    strip.scrollLeft = left - (strip.clientWidth - chip.offsetWidth) / 2;
                }
            }
        }
    }

    /** Builds one cell per chart note; rebuilt when the fingering system changes. */
    ensureCells() {
        const fm = this.player.fingeringManager;
        if (this.cellsSystem === fm.currentFingeringSystem && this.cells.length) return;

        this.cells = [];
        this.notesEl.replaceChildren(this.frameEl);
        for (const abcName of fm._getReferenceNotesList()) {
            const fingering = fm.getFingeringForNote(abcName);
            if (!fingering) continue;

            const cell = document.createElement('div');
            cell.className = 'scale-ribbon-cell';
            const label = document.createElement('div');
            label.className = 'scale-ribbon-label';
            cell.append(label, fm._createSimpleFingeringDiagram(fingering, abcName));
            this.notesEl.appendChild(cell);
            this.cells.push({ cell, label, pc: ScaleRuler.pitchClass(abcName) });
        }
        this.cellsSystem = fm.currentFingeringSystem;
    }

    /** On a narrow screen, scrolls the ribbon so the tonic octave is in view. */
    centerOnRoot() {
        const root = this.cells.find(c => c.cell.classList.contains('root'));
        if (!root || this.notesEl.scrollWidth <= this.notesEl.clientWidth) return;
        this.notesEl.scrollLeft = root.cell.offsetLeft - this.notesEl.clientWidth / 2;
    }

    /** @param {string} abcName - ABC note such as "^F" or "c'" */
    static pitchClass(abcName) {
        const letter = abcName.replace(/[^A-Ga-g]/g, '').toUpperCase();
        const acc = abcName.includes('^') ? 1 : abcName.includes('_') ? -1 : 0;
        return (ScaleAdvisor.LETTER_PC[letter] + acc + 12) % 12;
    }

    /** Lights the scale's notes and grays out the others. */
    paint(suggestion) {
        const root = suggestion.degrees[0];
        this.titleEl.replaceChildren();
        const scale = document.createElement('strong');
        scale.textContent = `${ScaleAdvisor.label(root)} ${suggestion.scaleName}`;
        const over = document.createElement('span');
        over.textContent = ` over ${suggestion.chord}`;
        this.titleEl.append(scale, over);

        const byPc = new Map(suggestion.degrees.map(d => [d.pc, d]));
        for (const { cell, label, pc } of this.cells) {
            const degree = byPc.get(pc);
            cell.classList.toggle('in-scale', !!degree);
            cell.classList.toggle('chord-tone', !!degree && suggestion.chordTones.has(degree.interval));
            cell.classList.toggle('root', !!degree && degree.interval === 0);
            label.textContent = degree ? ScaleAdvisor.label(degree) : '';
        }
        this.frameOctave(root.pc);
        this.scalePcs = new Set(byPc.keys());
        this.suggestion = suggestion;
        this.markFittingNotes();
        this.renderStaff();
    }

    /**
     * Frames the lowest full octave: from the lowest root up to the note
     * below the next root (F to E for F7), one pass through the scale.
     * @param {number} rootPc - Pitch class of the scale's root
     */
    frameOctave(rootPc) {
        const first = this.cells.findIndex(c => c.pc === rootPc);
        if (first < 0) {
            this.frameEl.hidden = true;
            return;
        }
        const next = this.cells.findIndex((c, i) => i > first && c.pc === rootPc);
        const last = (next < 0 ? this.cells.length : next) - 1;
        const a = this.cells[first].cell;
        const b = this.cells[last].cell;
        this.frameEl.hidden = false;
        this.frameEl.style.left = `${a.offsetLeft - 2}px`;
        this.frameEl.style.width = `${b.offsetLeft + b.offsetWidth - a.offsetLeft + 4}px`;
    }
}
