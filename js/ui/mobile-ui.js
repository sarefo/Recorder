/**
 * Manages mobile-specific UI behavior.
 *
 * Layout: one bar of large icon buttons for the controls used constantly
 * (play, loop, fingering, fingering system, files, random), plus two toggles:
 * "more" opens a full-screen overlay holding every other control, and "hide"
 * removes the bar entirely (focus mode) leaving a small restore button.
 * The bar sits at the top by default or as a rail on the right edge.
 */
class MobileUI {
    constructor(player) {
        this.player = player;
        this.overlayOpen = false;

        const settings = player.settingsManager;
        this.barPosition = settings.get('mobileBarPosition') === 'right' ? 'right' : 'top';
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
        barRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><rect x="16" y="4" width="5" height="16" fill="currentColor"/></svg>'
    };

    /**
     * Sets up mobile controls
     */
    setupMobileControls() {
        this.updateMobileState();
        this.createMobileLayout();
        this.setupScreenChangeHandlers();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlayOpen) {
                this.setOverlayOpen(false);
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
     * Updated mobile detection logic
     * @returns {boolean} Whether current environment is mobile
     */
    updateMobileState() {
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Use smaller dimension to determine mobile (handles landscape orientation)
        const smallerDimension = Math.min(window.innerWidth, window.innerHeight);

        this.player.isMobile = isMobileDevice ||
                               smallerDimension <= 600 ||
                               window.innerWidth < 1024;

        return this.player.isMobile;
    }

    /**
     * Opens or closes the full-screen overlay
     * @param {boolean} open - Whether the overlay should be open
     */
    setOverlayOpen(open) {
        this.overlayOpen = open;
        this.applyMobileState();
    }

    /**
     * Shows or hides the whole bar (focus mode). Hiding also asks the browser
     * for real fullscreen when the app isn't already running fullscreen.
     * @param {boolean} hidden - Whether the bar should be hidden
     */
    setBarHidden(hidden) {
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
     * Moves the bar between the top edge and a rail on the right edge
     * @param {string} position - 'top' or 'right'
     */
    setBarPosition(position) {
        this.barPosition = position;
        this.player.settingsManager.set('mobileBarPosition', position);
        this.applyMobileState();
        this.notifyLayoutChanged();
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
        if (!this.player.isMobile) {
            this.applyDesktopState();
            return;
        }

        let mobileBar = document.getElementById('mobile-control-bar');
        if (!mobileBar || !mobileBar.querySelector('.mobile-main-row')) {
            this.createMobileControlBar();
            mobileBar = document.getElementById('mobile-control-bar');
        }

        const overlayOpen = this.overlayOpen && !this.barHidden;

        mobileBar.classList.remove('hidden');
        mobileBar.classList.toggle('bar-right', this.barPosition === 'right');
        mobileBar.classList.toggle('bar-top', this.barPosition !== 'right');

        const overlay = document.getElementById('mobile-overlay');
        if (overlay) {
            overlay.classList.toggle('open', overlayOpen);
        }

        const moreButton = document.getElementById('mobile-more-toggle');
        if (moreButton) {
            moreButton.classList.toggle('active', overlayOpen);
        }

        const positionButton = document.getElementById('mobile-position-toggle');
        if (positionButton) {
            // Shows the layout the button switches TO
            const toRight = this.barPosition !== 'right';
            positionButton.innerHTML = toRight ? MobileUI.ICONS.barRight : MobileUI.ICONS.barTop;
            positionButton.title = toRight ? 'Move bar to the right edge' : 'Move bar to the top';
        }

        const body = document.body;
        body.classList.add('mobile-controls-active');
        body.classList.toggle('mobile-bar-right', this.barPosition === 'right');
        body.classList.toggle('mobile-bar-hidden', this.barHidden);
        body.classList.toggle('mobile-overlay-open', overlayOpen);
    }

    /**
     * Apply desktop state: hide the mobile bar and put every control back
     * into its desktop section, in the original order.
     */
    applyDesktopState() {
        const mobileBar = document.getElementById('mobile-control-bar');
        if (mobileBar) {
            mobileBar.classList.add('hidden');
        }
        const overlay = document.getElementById('mobile-overlay');
        if (overlay) {
            overlay.classList.remove('open');
        }

        document.body.classList.remove('mobile-controls-active', 'mobile-bar-right',
            'mobile-bar-hidden', 'mobile-overlay-open');

        const controlBar = document.querySelector('.control-bar');
        const playbackControls = document.querySelector('.playback-controls');
        const fingeringControls = document.querySelector('.fingering-controls');
        const notationControls = document.querySelector('.notation-controls');

        if (controlBar) {
            for (const section of [playbackControls, fingeringControls, notationControls]) {
                if (section && section.parentElement !== controlBar) {
                    controlBar.appendChild(section);
                }
            }
        }

        // Appending in order restores the original sequence inside each section
        const moveBack = (parent, elements) => {
            if (!parent) return;
            for (const el of elements) {
                if (el) parent.appendChild(el);
            }
        };
        const byId = id => document.getElementById(id);

        moveBack(playbackControls, [
            byId('play-button'), byId('loop-button'),
            byId('chords-toggle'), byId('voices-toggle'), byId('metronome-toggle'),
            document.querySelector('.tempo-control'), byId('mobile-tempo-button'),
            byId('tuning-button'),
            byId('transpose-up'), byId('transpose-down'),
        ]);
        moveBack(fingeringControls, [byId('show-fingering'), byId('system-toggle'), byId('chart-toggle')]);

        const fileControls = document.querySelector('.file-controls');
        const selector = document.querySelector('.file-selector-container');
        moveBack(selector, [byId('files-button'), byId('random-abc-button'), byId('theme-toggle'), byId('help-button')]);
        moveBack(fileControls, [selector, document.querySelector('.tune-navigation')]);
        moveBack(notationControls, [byId('copy-button'), byId('paste-button'), byId('share-button'), fileControls]);

        // The inline tag button is owned by the desktop control bar directly
        moveBack(controlBar, [byId('inline-tag-button')]);
    }

    /**
     * Set up handlers for screen size/orientation changes
     */
    setupScreenChangeHandlers() {
        const onChange = () => {
            const wasMobile = this.player.isMobile;
            this.updateMobileState();
            if (wasMobile !== this.player.isMobile) {
                this.createMobileLayout();
            }
            this.applyMobileState();
        };

        window.addEventListener('resize', onChange);
        window.addEventListener('orientationchange', () => setTimeout(onChange, 100));
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
            byId('show-fingering'), byId('system-toggle'),
            byId('files-button'), byId('random-abc-button'),
        ]);

        const spacer = document.createElement('div');
        spacer.className = 'mobile-bar-spacer';
        mainRow.appendChild(spacer);

        mainRow.appendChild(this.createIconButton('mobile-more-toggle', MobileUI.ICONS.more,
            'More controls', () => this.setOverlayOpen(!this.overlayOpen)));
        mainRow.appendChild(this.createIconButton('mobile-hide-toggle', MobileUI.ICONS.hide,
            'Hide controls', () => this.setBarHidden(true)));

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
        group([byId('transpose-down'), byId('transpose-up'), byId('tuning-button')]);
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
            byId('chart-toggle'), byId('theme-toggle'),
            this.createIconButton('mobile-position-toggle', MobileUI.ICONS.barRight, '',
                () => this.setBarPosition(this.barPosition === 'right' ? 'top' : 'right')),
            byId('help-button'),
        ]);
        group([
            byId('copy-button'), byId('paste-button'), byId('share-button'),
            document.querySelector('.tune-navigation'),
        ]).classList.add('mobile-overlay-wide');

        // --- Restore button, only visible while the bar is hidden ---
        if (!byId('mobile-show-bar')) {
            const showButton = this.createIconButton('mobile-show-bar', MobileUI.ICONS.show,
                'Show controls', () => this.setBarHidden(false));
            document.body.appendChild(showButton);
        }

        return mobileBar;
    }
}
