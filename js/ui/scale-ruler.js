/**
 * A ribbon above the score showing every recorder note with its fingering.
 * Notes that belong to the scale for the current chord stay bright (chord
 * tones marked); the rest are grayed out. During playback it follows the
 * chord under the playing note.
 *
 * The tune is split into stretches with one home scale each (see
 * ScaleAdvisor.analyze). The ribbon names the home and marks only what the
 * current chord changes against it: notes it brings in, home notes it
 * leaves out, and the notes the next chord will change, so a change can be
 * seen coming.
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
        this.chordTimeline = []; // analyzed entries (ScaleAdvisor.analyze) in score order
        this.analysis = null;
        this.keyHome = null;
        this.keyText = '';
        this.currentChord = null;
        this.entryIndex = -1; // index into chordTimeline on show, -1 for none
        this.charOfNote = new Map(); // score SVG element → startChar
        this.noteAtChar = new Map(); // startChar → score SVG element
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
            if (chip) this.showChordByName(chip.dataset.chord);
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
        this.fitBtn.title = 'Color each note against the scale at its point in the tune: '
            + 'green is a note the chord changes, gray is outside the scale';
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
            this.showStart();
            this.centerOnRoot();
        }
    }

    /** Shows the first chord, or the key's own scale in a tune without chords. */
    showStart() {
        this.currentChord = null;
        this.entryIndex = -1;
        if (this.chordTimeline.length) this.showEntry(0);
        else this.showKeyScale();
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
        this.markScoreChords();
        this.renderStaff();
    }

    toggleStaff() {
        this.staffVisible = !this.staffVisible;
        this.player.settingsManager?.set(ScaleRuler.STAFF_SETTING, this.staffVisible);
        this.applyVisibility();
    }

    /**
     * Draws the scale on show as sheet music, starting on the root and
     * ascending from the root (placed C4 to B4), with the chord tones in the
     * accent color.
     */
    renderStaff() {
        const sug = this.suggestion;
        if (!this.staffEl || this.staffEl.hidden || !sug || typeof ABCJS === 'undefined') return;
        try {
            // Always ascends from the root, which sits between C4 and B4 so
            // the whole scale stays on and around the staff lines
            const rootMidi = 60 + ScaleAdvisor.LETTER_PC[sug.rootLetter] + sug.rootAcc;
            const lowestRoot = 60;
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
     * Colors each note of the score against the scale at its own point in
     * the tune. Home-scale notes keep their normal color; green marks a note
     * the chord there changes against the home (the G♯ under E7 in C); gray
     * marks a note outside the chord's scale (a passing tone). Clears the
     * marks when the option or the ribbon is off.
     */
    markFittingNotes() {
        const notes = document.querySelectorAll('#abc-notation .abcjs-note');
        const on = this.visible && this.fitNotes && (this.chordTimeline.length || this.keyHome);
        const live = !!this.player.midiPlayer?.isPlaying && this.chordTimeline.length > 0;
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
            let outside = false;
            let changed = false;
            if (on) {
                const name = this.noteNames[parseInt(el.getAttribute('data-index'), 10)];
                if (name && name !== 'rest') {
                    const pc = ScaleRuler.pitchClass(name);
                    const entry = this.entryAt(this.charOfNote.get(el));
                    // While playing, only notes under the sounding chord are marked
                    if (live && entry !== this.chordTimeline[this.entryIndex]) {
                        el.classList.remove('scale-outside', 'scale-changed');
                        continue;
                    }
                    const pcs = entry ? entry.pcs : this.keyHome?.pcs;
                    changed = !!entry && entry.added.has(pc);
                    outside = !changed && !!pcs && !pcs.has(pc);
                }
            }
            el.classList.toggle('scale-outside', outside);
            el.classList.toggle('scale-changed', changed);
        }
    }

    /**
     * Marks the chord symbols in the score: green where the chord changes
     * notes against the home, bold where a new home begins.
     */
    markScoreChords() {
        document.querySelectorAll('#abc-notation .scale-chord-change, #abc-notation .scale-chord-home')
            .forEach(el => el.classList.remove('scale-chord-change', 'scale-chord-home'));
        if (!this.visible || !this.analysis) return;
        const homeStarts = new Set(this.analysis.stretches.length > 1
            ? this.analysis.stretches.map(st => st.start) : []);
        this.chordTimeline.forEach((entry, i) => {
            const el = this.noteAtChar.get(entry.startChar);
            if (!el) return;
            el.classList.toggle('scale-chord-change', entry.added.size > 0);
            el.classList.toggle('scale-chord-home', homeStarts.has(i));
        });
    }

    /**
     * The chord entry sounding at a point of the ABC text.
     * @param {number|undefined} char - Offset into the ABC text
     * @returns {Object|null}
     */
    entryAt(char) {
        if (typeof char !== 'number' || !this.chordTimeline.length) return null;
        return this.chordTimeline[this.entryIndexAt(char)];
    }

    /** Index of the last chord entry at or before char (the first if none). */
    entryIndexAt(char) {
        let index = 0;
        for (let i = 0; i < this.chordTimeline.length; i++) {
            if (this.chordTimeline[i].startChar > char) break;
            index = i;
        }
        return index;
    }

    /**
     * Called after every render: reads the chords and key from the new score
     * and splits it into home stretches.
     * @param {Object} visualObj - The abcjs visual object
     */
    onRender(visualObj) {
        this.chordTimeline = [];
        this.analysis = null;
        this.currentChord = null;
        this.entryIndex = -1;
        this.noteNames = null;
        this.charOfNote = new Map();
        this.noteAtChar = new Map();
        try {
            const abc = this.player.notationParser?.currentAbc || '';
            this.keyText = (/^K:\s*(.*)$/m.exec(abc)?.[1] || '').split('%')[0].trim();
            this.keyHome = ScaleAdvisor.homeFromKey(this.keyText);

            // Score SVG elements ↔ positions in the ABC text
            for (const line of visualObj?.lines || []) {
                for (const staff of line.staff || []) {
                    for (const voice of staff.voices || []) {
                        for (const el of voice) {
                            if (typeof el.startChar !== 'number') continue;
                            for (const svg of el.abselem?.elemset || []) {
                                this.charOfNote.set(svg, el.startChar);
                                if (!this.noteAtChar.has(el.startChar)) {
                                    this.noteAtChar.set(el.startChar, svg);
                                }
                            }
                        }
                    }
                }
            }

            this.analysis = ScaleAdvisor.analyze(ScaleAdvisor.readChords(visualObj), this.keyText);
            this.chordTimeline = this.analysis.entries.filter(e => e.suggestion);
            for (const e of this.chordTimeline) e.pcs = new Set(e.suggestion.degrees.map(d => d.pc));
            this.chordTimeline.forEach(e => {
                e.home = this.analysis.stretches[e.stretch].home;
            });
        } catch (error) {
            console.error('ScaleRuler: could not read chords:', error);
            this.chordTimeline = [];
        }
        this.buildChordChips();
        this.markScoreChords();
        this.markFittingNotes();
        if (this.visible) {
            this.showStart();
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
            // A chord that changes notes against its home gets a green mark
            const changes = [...new Set(this.chordTimeline
                .filter(e => e.chord === chord && e.change).map(e => e.change))];
            chip.classList.toggle('changes', changes.length > 0);
            if (changes.length) chip.title = `${chord}: ${changes.join(', ')}`;
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
        const before = this.entryIndex;
        this.showEntry(this.entryIndexAt(char));
        // While playing, the Fit marks belong to the chord now sounding
        if (this.entryIndex !== before && this.fitNotes) this.markFittingNotes();
    }

    /**
     * A tapped chip: the chord where it occurs in the stretch on show, else
     * its first occurrence.
     * @param {string} chord - Chord symbol
     */
    showChordByName(chord) {
        const stretch = this.chordTimeline[this.entryIndex]?.stretch;
        let index = this.chordTimeline.findIndex(e => e.chord === chord && e.stretch === stretch);
        if (index < 0) index = this.chordTimeline.findIndex(e => e.chord === chord);
        if (index >= 0) this.showEntry(index, true);
    }

    /**
     * Shows one chord of the tune against its home.
     * @param {number} index - Index into chordTimeline
     * @param {boolean} [force] - Repaint even if this chord is already on show
     */
    showEntry(index, force = false) {
        const entry = this.chordTimeline[index];
        if (!this.element || !entry) return;
        if (!force && index === this.entryIndex) return;
        this.entryIndex = index;
        this.currentChord = entry.chord;
        // Tunes loop, so the last chord leads back to the first
        const next = this.chordTimeline[(index + 1) % this.chordTimeline.length];
        this.ensureCells();
        this.paint(entry, next === entry ? null : next);
        this.markActiveChip();
    }

    /** A tune without chords: the key's home scale, tonic chord marked. */
    showKeyScale() {
        const chord = this.keyChord();
        if (!this.element || !chord || !this.keyHome) return;
        const suggestion = ScaleAdvisor.suggest(chord, this.keyHome.pcs);
        if (!suggestion) return;
        this.currentChord = chord;
        this.ensureCells();
        this.paint({
            chord: null,
            suggestion,
            home: this.keyHome,
            pcs: new Set(suggestion.degrees.map(d => d.pc)),
            ...ScaleAdvisor.changes(suggestion, this.keyHome)
        }, null);
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

    /**
     * Lights the chord's scale and grays out the rest. Against the home:
     * notes the chord brings in are green, home notes it leaves out are
     * struck through. Notes the next chord brings in get a dashed outline.
     * @param {Object} entry - Analyzed chord: suggestion, home, pcs, added, dropped, change
     * @param {Object|null} next - The chord after it
     */
    paint(entry, next) {
        const { suggestion, home } = entry;
        const root = suggestion.degrees[0];
        this.titleEl.replaceChildren();
        const homeEl = document.createElement('strong');
        homeEl.textContent = home.name;
        homeEl.title = 'Home scale of this part of the tune';
        const line = document.createElement('span');
        const scaleName = `${ScaleAdvisor.label(root)} ${suggestion.scaleName}`;
        line.textContent = entry.chord ? `${entry.chord}: ${scaleName}` : 'no chords';
        // Next to the home, where a narrow screen still shows it. Long lists
        // (a chord far outside the home) read worse than the scale name
        if (entry.change && entry.change.split(' ').length <= 3) {
            const change = document.createElement('em');
            change.className = 'scale-ribbon-change';
            change.textContent = ` ${entry.change}`;
            homeEl.append(change);
        }
        this.titleEl.append(homeEl, line);

        const byPc = new Map(suggestion.degrees.map(d => [d.pc, d]));
        const homeByPc = new Map(home.degrees.map(d => [d.pc, d]));
        const coming = new Set();
        // Only the notes coming in: marking the ones going out as well
        // doubles the outlines for one change
        if (next) for (const pc of next.pcs) if (!entry.pcs.has(pc)) coming.add(pc);
        for (const { cell, label, pc } of this.cells) {
            const degree = byPc.get(pc);
            const dropped = entry.dropped.has(pc);
            const tone = !!degree && suggestion.chordTones.has(degree.interval);
            cell.classList.toggle('in-scale', !!degree);
            cell.classList.toggle('chord-tone', tone);
            // 3rds and 7ths say which chord it is: the notes to aim for in jazz
            cell.classList.toggle('guide-tone', tone && [3, 4, 10, 11].includes(degree.interval));
            cell.classList.toggle('root', !!degree && degree.interval === 0);
            cell.classList.toggle('changed', entry.added.has(pc));
            cell.classList.toggle('dropped', dropped);
            cell.classList.toggle('coming', coming.has(pc));
            label.textContent = degree ? ScaleAdvisor.label(degree)
                : dropped ? ScaleAdvisor.label(homeByPc.get(pc)) : '';
        }
        this.frameOctave(root.pc);
        this.scalePcs = new Set(byPc.keys());
        this.suggestion = suggestion;
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
