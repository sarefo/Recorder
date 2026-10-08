/**
 * Manages the control bar layout, used on every screen size.
 *
 * Layout: one bar of large icon buttons for the controls used constantly
 * (play, loop, files, random, fingering, fingering system, transpose), plus
 * "more", which opens a full-screen overlay holding every other control.
 * The overlay's "hide" button removes the bar entirely (focus mode) leaving
 * a small restore button.
 * The bar sits at the top by default or as a rail on the left edge.
 *
 * Transposing happens in its own mode so the score stays visible: the
 * bar's transpose button toggles a small panel placed next to it (accept/reject, key up/key down, lowest note on
 * C4/highest on C6). With a GitHub token set, a save button in a fourth
 * column commits the new key to the repo.
 */
class MobileUI {
    constructor(player) {
        this.player = player;
        this.overlayOpen = false;
        this.transposing = false;
        this.abcBeforeTranspose = null;
        // Net shift from the tune file as loaded, kept across transpose sessions
        this.transposeSteps = 0;
        this.stepsBeforeTranspose = 0;
        this.savingTranspose = false;

        const settings = player.settingsManager;
        const savedPosition = settings.get('mobileBarPosition');
        this.barPosition = savedPosition === 'left' || savedPosition === 'right' ? 'left' : 'top';
        this.barHidden = settings.get('mobileBarHidden') === true;
    }

    /** Icons for the buttons MobileUI creates itself (24px viewBox, stroke = currentColor) */
    static ICONS = {
        more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>',
        hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
        show: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
        notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h10l4 4v14H5z"/><path d="M9 11h6M9 15h6"/></svg>',
        clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l5 5-10 10H6l-3-3z"/><path d="M9 21h12"/></svg>',
        barTop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><rect x="3" y="4" width="18" height="4" fill="currentColor"/></svg>',
        transpose: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4"/></svg>',
        accept: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
        save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 7.97"/><path d="M12 20v-8M8.5 15.5 12 12l3.5 3.5"/></svg>',
        toTop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14M12 20V9M7 14l5-5 5 5"/></svg>',
        toBottom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20h14M12 4v11M7 10l5 5 5-5"/></svg>',
        restore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.7-6"/><path d="M4 4v5h5"/></svg>',
        reject: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        barLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><rect x="3" y="4" width="5" height="16" fill="currentColor"/></svg>'
    };

    /**
     * Sets up mobile controls
     */
    setupMobileControls() {
        this.updateMobileState();
        this.createMobileLayout();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlayOpen) {
                this.setOverlayOpen(false);
            } else if (e.key === 'Escape' && this.transposing) {
                this.endTransposeMode(false);
            } else if (e.key === 'Enter' && this.transposing) {
                this.endTransposeMode(true);
            }
        });

        // Rotating or resizing moves the transpose button; keep the panel beside it
        window.addEventListener('resize', () => {
            const panel = document.getElementById('mobile-transpose-panel');
            if (panel && panel.classList.contains('open')) {
                this.positionTransposePanel(panel);
            }
        });
    }

    /**
     * Closes the overlay (called when playback starts)
     */
    collapseControls() {
        if (this.player.isMobile && this.overlayOpen) {
            this.setOverlayOpen(false);
        }
    }

    /**
     * Creates the mobile layout
     */
    createMobileLayout() {
        if (!this.player.isMobile) return;
        this.createMobileControlBar();
        this.applyMobileState();
    }

    /**
     * The compact bar is the layout on every screen, laptop included, so the
     * app looks and works the same everywhere. isMobile stays as the flag
     * the rest of the app reads.
     * @returns {boolean} Always true
     */
    updateMobileState() {
        this.player.isMobile = true;
        return true;
    }

    /**
     * Opens or closes the full-screen overlay
     * @param {boolean} open - Whether the overlay should be open
     */
    setOverlayOpen(open) {
        if (open) {
            this.endTransposeMode(true);
        }
        this.overlayOpen = open;
        this.applyMobileState();
    }

    /**
     * Shows or hides the whole bar (focus mode). Hiding also asks the browser
     * for real fullscreen when the app isn't already running fullscreen.
     * @param {boolean} hidden - Whether the bar should be hidden
     */
    setBarHidden(hidden) {
        this.endTransposeMode(true);
        this.barHidden = hidden;
        this.overlayOpen = false;
        this.player.settingsManager.set('mobileBarHidden', hidden);

        if (hidden) {
            this.requestFullscreen();
        }

        this.applyMobileState();
        this.notifyLayoutChanged();
    }

    /**
     * Moves the bar between the top edge and a rail on the left edge
     * @param {string} position - 'top' or 'left'
     */
    setBarPosition(position) {
        this.barPosition = position;
        this.player.settingsManager.set('mobileBarPosition', position);
        this.applyMobileState();
        this.notifyLayoutChanged();
    }

    /**
     * Closes the overlay and shows the transpose panel, remembering the
     * current ABC so the change can be rejected
     */
    startTransposeMode() {
        this.abcBeforeTranspose = this.player.notationParser.currentAbc;
        this.stepsBeforeTranspose = this.transposeSteps;
        this.transposing = true;
        this.overlayOpen = false;
        this.applyMobileState();
    }

    /**
     * The bar's transpose button: opens the panel, or closes it keeping the key
     */
    toggleTransposeMode() {
        if (this.transposing) {
            this.endTransposeMode(true);
        } else {
            this.startTransposeMode();
        }
    }

    /**
     * Leaves transpose mode. Called with keep = true whenever something else
     * takes over (overlay, focus mode, another tune loading), so a transposition
     * is only ever undone by an explicit reject.
     * @param {boolean} keep - Keep the transposed music (false restores the original)
     */
    endTransposeMode(keep) {
        if (!this.transposing) return;
        this.transposing = false;

        if (!keep && this.abcBeforeTranspose !== null &&
            this.abcBeforeTranspose !== this.player.notationParser.currentAbc) {
            this.player.notationParser.currentAbc = this.abcBeforeTranspose;
            this.transposeSteps = this.stepsBeforeTranspose;
            this.player.render();
        }
        this.abcBeforeTranspose = null;
        this.applyMobileState();
    }

    /**
     * Puts back the ABC the tune had when transpose mode started, and stays
     * in transpose mode so another key can be tried
     */
    restoreOriginalKey() {
        if (!this.transposing || this.abcBeforeTranspose === null) return;
        if (this.abcBeforeTranspose !== this.player.notationParser.currentAbc) {
            this.player.notationParser.currentAbc = this.abcBeforeTranspose;
            this.player.render();
        }
        this.transposeSteps = this.stepsBeforeTranspose;
        this.updateTransposeSaveButton();
        Utils.showFeedback('Original key restored', 1200);
    }

    /**
     * Counts a key up/key down step, in or out of transpose mode, so the
     * save button knows how far the tune is from its file
     * @param {number} semitones - The step just applied
     */
    countTransposeStep(semitones) {
        this.transposeSteps += semitones;
        this.updateTransposeSaveButton();
    }

    /**
     * A tune was loaded: it now matches its file (or has no file)
     * @param {number} [steps=0] - Shift already applied, e.g. restored from the URL
     */
    resetTransposeSteps(steps = 0) {
        this.transposeSteps = steps;
        this.stepsBeforeTranspose = steps;
        this.updateTransposeSaveButton();
    }

    /**
     * The save button shows when a token is set and a repo file is open,
     * and works once the key or the tempo has actually changed
     */
    updateTransposeSaveButton() {
        const button = document.getElementById('mobile-transpose-save');
        if (!button) return;
        const available = this.player.githubSync.hasToken() && !!this.player.fileManager.currentFilePath;
        const changed = this.transposeSteps !== 0 || this.player.midiPlayer.playbackSettings.tempo !== 100;
        button.classList.toggle('hidden', !available);
        button.disabled = this.savingTranspose || !changed;
    }

    /**
     * Commits the current key and tempo to the tune's file in the repo, then
     * leaves transpose mode keeping them. The saved tempo becomes the tune's
     * own Q: line, so the tempo control goes back to 100%.
     */
    async saveTransposition() {
        const filePath = this.player.fileManager.currentFilePath;
        const midiPlayer = this.player.midiPlayer;
        const tempoPercent = midiPlayer.playbackSettings.tempo;
        const semitones = this.transposeSteps;
        if (!filePath || this.savingTranspose || (semitones === 0 && tempoPercent === 100)) return;

        this.savingTranspose = true;
        this.updateTransposeSaveButton();
        Utils.showFeedback('Saving to GitHub…', 10000);

        try {
            const tempoFallback = GitHubSync.tempoOf(this.player.renderManager.currentVisualObj);
            const { key, bpm } = await this.player.githubSync.saveChanges(filePath,
                { semitones, tempoPercent, tempoFallback });
            if (bpm !== null) {
                await this.applySavedTempo(tempoPercent, tempoFallback);
            }
            this.endTransposeMode(true);
            this.resetTransposeSteps();
            const saved = [semitones !== 0 ? `in ${key}` : '', bpm !== null ? `at tempo ${bpm}` : '']
                .filter(Boolean).join(' ');
            Utils.showFeedback(`Saved ${saved}, live on all devices in about a minute`, 3500);
        } catch (error) {
            console.error('Saving transposition failed:', error);
            Utils.showFeedback(`Not saved: ${error.message}`, 4000);
        } finally {
            this.savingTranspose = false;
            this.updateTransposeSaveButton();
        }
    }

    /**
     * After a tempo was saved into the file, bakes it into the open tune and
     * resets the tempo control, so playback speed stays the same
     * @param {number} percent - The tempo percentage that was saved
     * @param {Object|null} fallback - Tempo used when the tune had no Q: line
     * @private
     */
    async applySavedTempo(percent, fallback) {
        const parser = this.player.notationParser;
        const scaled = GitHubSync.scaleTempo(parser.currentAbc, percent, fallback);
        if (scaled) {
            parser.currentAbc = scaled.abc;
            this.player.render();
        }
        await this.player.uiControls.resetTempo();
    }

    /**
     * Enters browser fullscreen if possible and not already fullscreen
     * (the installed PWA already runs with display: fullscreen)
     */
    requestFullscreen() {
        try {
            const alreadyFullscreen = document.fullscreenElement ||
                window.matchMedia('(display-mode: fullscreen)').matches;
            if (alreadyFullscreen || !document.documentElement.requestFullscreen) return;
            document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        } catch (e) {
            // Fullscreen is a nicety; the bar is hidden either way
        }
    }

    /**
     * The notation area changed size without the window resizing: once the
     * new layout has been applied, re-place the marker zones and diagrams.
     */
    notifyLayoutChanged() {
        requestAnimationFrame(() => this.player.refreshNoteOverlays());
    }

    /**
     * Apply the current state to the UI elements
     */
    applyMobileState() {
        let mobileBar = document.getElementById('mobile-control-bar');
        if (!mobileBar || !mobileBar.querySelector('.mobile-main-row')) {
            this.createMobileControlBar();
            mobileBar = document.getElementById('mobile-control-bar');
        }

        const overlayOpen = this.overlayOpen && !this.barHidden;

        mobileBar.classList.remove('hidden');
        mobileBar.classList.toggle('bar-left', this.barPosition === 'left');
        mobileBar.classList.toggle('bar-top', this.barPosition !== 'left');

        const overlay = document.getElementById('mobile-overlay');
        if (overlay) {
            overlay.classList.toggle('open', overlayOpen);
        }

        const transposePanel = document.getElementById('mobile-transpose-panel');
        if (transposePanel) {
            const panelOpen = this.transposing && !this.barHidden;
            transposePanel.classList.toggle('open', panelOpen);
            if (panelOpen) {
                this.positionTransposePanel(transposePanel);
            }
        }
        this.updateTransposeSaveButton();

        const transposeButton = document.getElementById('mobile-transpose-button');
        if (transposeButton) {
            transposeButton.classList.toggle('active', this.transposing);
        }

        const moreButton = document.getElementById('mobile-more-toggle');
        if (moreButton) {
            moreButton.classList.toggle('active', overlayOpen);
        }

        const positionButton = document.getElementById('mobile-position-toggle');
        if (positionButton) {
            // Shows the layout the button switches TO
            const toLeft = this.barPosition !== 'left';
            positionButton.innerHTML = toLeft ? MobileUI.ICONS.barLeft : MobileUI.ICONS.barTop;
            positionButton.title = toLeft ? 'Move bar to the left edge' : 'Move bar to the top';
        }

        const body = document.body;
        body.classList.add('mobile-controls-active');
        body.classList.toggle('mobile-bar-left', this.barPosition === 'left');
        body.classList.toggle('mobile-bar-hidden', this.barHidden);
        body.classList.toggle('mobile-overlay-open', overlayOpen);
        body.classList.toggle('mobile-transposing', this.transposing);
    }

    /**
     * Places the open transpose panel beside the bar's transpose button:
     * below it when the bar is on top, right of it on the left rail, kept
     * inside the window
     * @param {HTMLElement} panel - The transpose panel (already displayed)
     */
    positionTransposePanel(panel) {
        const button = document.getElementById('mobile-transpose-button');
        if (!button) return;
        const anchor = button.getBoundingClientRect();
        const margin = 8;
        const maxLeft = window.innerWidth - panel.offsetWidth - margin;
        const maxTop = window.innerHeight - panel.offsetHeight - margin;

        if (this.barPosition === 'left') {
            panel.style.left = `${anchor.right + margin}px`;
            panel.style.top = `${Math.max(margin, Math.min(anchor.top, maxTop))}px`;
        } else {
            panel.style.left = `${Math.max(margin, Math.min(anchor.left, maxLeft))}px`;
            panel.style.top = `${anchor.bottom + margin}px`;
        }
    }

    /**
     * Creates a button owned by the mobile UI
     * @param {string} id - Element id
     * @param {string} icon - SVG markup
     * @param {string} title - Tooltip
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} The button
     */
    createIconButton(id, icon, title, onClick) {
        const button = document.createElement('button');
        button.id = id;
        button.className = 'mobile-icon-button';
        button.innerHTML = icon;
        button.title = title;
        button.addEventListener('click', onClick);
        return button;
    }

    /**
     * Builds the bar, the overlay and the restore button, moving the
     * existing controls into them
     */
    createMobileControlBar() {
        if (!this.player.isMobile) return;

        let mobileBar = document.getElementById('mobile-control-bar');
        if (!mobileBar) {
            mobileBar = document.createElement('div');
            mobileBar.id = 'mobile-control-bar';
            mobileBar.className = 'mobile-control-bar';
            document.body.appendChild(mobileBar);
        }
        mobileBar.innerHTML = '';

        const byId = id => document.getElementById(id);
        const append = (parent, elements) => {
            for (const el of elements) {
                if (el) parent.appendChild(el);
            }
        };

        // --- Main bar: the controls used all the time ---
        const mainRow = document.createElement('div');
        mainRow.className = 'mobile-main-row';

        append(mainRow, [
            byId('play-button'), byId('loop-button'),
            byId('files-button'), byId('random-abc-button'),
            byId('show-fingering'), byId('system-toggle'),
            this.createIconButton('mobile-transpose-button', MobileUI.ICONS.transpose,
                'Transpose', () => this.toggleTransposeMode()),
        ]);

        const spacer = document.createElement('div');
        spacer.className = 'mobile-bar-spacer';
        mainRow.appendChild(spacer);

        mainRow.appendChild(this.createIconButton('mobile-more-toggle', MobileUI.ICONS.more,
            'More controls', () => this.setOverlayOpen(!this.overlayOpen)));

        mobileBar.appendChild(mainRow);

        // --- Overlay: everything else ---
        let overlay = byId('mobile-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mobile-overlay';
            overlay.className = 'mobile-overlay';
            // A tap on the backdrop around the panel closes it
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.setOverlayOpen(false);
                }
            });
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = '';

        const content = document.createElement('div');
        content.className = 'mobile-overlay-content';
        overlay.appendChild(content);

        const group = (elements) => {
            const row = document.createElement('div');
            row.className = 'mobile-extras-row mobile-overlay-group';
            append(row, elements);
            content.appendChild(row);
            return row;
        };

        // Playback
        group([document.querySelector('.tempo-control')]).classList.add('mobile-overlay-wide');
        group([byId('chart-toggle'), byId('tuning-button')]);
        group([byId('chords-toggle'), byId('voices-toggle'), byId('metronome-toggle')]);

        // Song: status/favorite, practice notes, note marks
        const player = this.player;
        const notesButton = this.createIconButton('mobile-notes-button', MobileUI.ICONS.notes,
            'Practice notes', () => {
                const filePath = player.fileManager.currentFilePath;
                if (!filePath) {
                    Utils.showFeedback('No song loaded', true);
                    return;
                }
                this.setOverlayOpen(false);
                player.fileManager.metadataUI.showNotesDialog(filePath);
            });
        const clearButton = this.createIconButton('mobile-clear-marks', MobileUI.ICONS.clear,
            'Clear note marks', () => {
                const cleared = player.fingeringManager.clearAllMarks();
                Utils.showFeedback(cleared ? `Cleared ${cleared} marked note${cleared === 1 ? '' : 's'}` : 'No marked notes');
            });
        group([byId('inline-tag-button'), notesButton, clearButton]);

        // Display and files
        group([
            byId('theme-toggle'),
            this.createIconButton('mobile-position-toggle', MobileUI.ICONS.barLeft, '',
                () => this.setBarPosition(this.barPosition === 'left' ? 'top' : 'left')),
            this.createIconButton('mobile-hide-toggle', MobileUI.ICONS.hide,
                'Hide controls', () => this.setBarHidden(true)),
            byId('help-button'),
        ]);
        // App-level buttons in a group of their own beside the clipboard group
        const lastRow = document.createElement('div');
        lastRow.className = 'mobile-overlay-split mobile-overlay-wide';
        lastRow.appendChild(group([byId('settings-button'), byId('reload-button')]));
        lastRow.appendChild(group([
            byId('copy-button'), byId('paste-button'), byId('share-button'),
            document.querySelector('.tune-navigation'),
        ]));
        content.appendChild(lastRow);

        // --- Transpose panel: accept/reject beside key up/key down ---
        let transposePanel = byId('mobile-transpose-panel');
        if (!transposePanel) {
            transposePanel = document.createElement('div');
            transposePanel.id = 'mobile-transpose-panel';
            transposePanel.className = 'mobile-extras-row';
            document.body.appendChild(transposePanel);
        }
        transposePanel.innerHTML = '';
        // Grid fills row by row: accept, up, top / reject, down, bottom; save is the fourth column
        append(transposePanel, [
            this.createIconButton('mobile-transpose-accept', MobileUI.ICONS.accept,
                'Keep this key', () => this.endTransposeMode(true)),
            byId('transpose-up'),
            this.createIconButton('mobile-transpose-top', MobileUI.ICONS.toTop,
                'Highest note on C6', () => this.player.transpose('top')),
            this.createIconButton('mobile-transpose-reject', MobileUI.ICONS.reject,
                'Back to the original key', () => this.endTransposeMode(false)),
            byId('transpose-down'),
            this.createIconButton('mobile-transpose-bottom', MobileUI.ICONS.toBottom,
                'Lowest note on C4', () => this.player.transpose('bottom')),
            this.createIconButton('mobile-transpose-save', MobileUI.ICONS.save,
                'Save this key and tempo to the tune file on GitHub', () => this.saveTransposition()),
            this.createIconButton('mobile-transpose-restore', MobileUI.ICONS.restore,
                'Restore the original key', () => this.restoreOriginalKey()),
        ]);

        // --- Restore button, only visible while the bar is hidden ---
        if (!byId('mobile-show-bar')) {
            const showButton = this.createIconButton('mobile-show-bar', MobileUI.ICONS.show,
                'Show controls', () => this.setBarHidden(false));
            document.body.appendChild(showButton);
        }

        return mobileBar;
    }
}
