/**
 * Manages mobile-specific UI behavior
 */
class MobileUI {
    constructor(player) {
        this.player = player;
        this.playbackExtrasVisible = false; // Expandable playback controls (chords, voices, etc.)
        this.fileExtrasVisible = false; // Expandable file controls (copy, paste, share)
    }

    /**
     * Sets up mobile controls
     */
    setupMobileControls() {
        // Set up the initial state
        this.updateMobileState();

        // Create mobile layout
        this.createMobileLayout();

        // Handle screen size changes
        this.setupScreenChangeHandlers();
    }

    collapseControls() {
        if (this.player.isMobile) {
            this.playbackExtrasVisible = false;
            this.fileExtrasVisible = false;
            this.applyMobileState();
        }
    }

    /**
     * Creates the mobile layout with all important controls visible
     * and expandable sections for extras
     */
    createMobileLayout() {
        if (!this.player.isMobile) return;

        // Create mobile control bar with all controls
        this.createMobileControlBar();

        // Set up initial state
        this.applyMobileState();
    }

    /**
     * Updated mobile detection logic
     * @returns {boolean} Whether current environment is mobile
     */
    updateMobileState() {
        // Check if this is a mobile device
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Use smaller dimension to determine mobile (handles landscape orientation)
        const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
        const largerDimension = Math.max(window.innerWidth, window.innerHeight);

        // Mobile if:
        // 1. It's a mobile device by user agent, OR
        // 2. Smaller dimension is phone-sized (portrait or landscape), OR  
        // 3. It's clearly a mobile screen size (under 1024px width)
        this.player.isMobile = isMobileDevice || 
                               smallerDimension <= 600 || 
                               window.innerWidth < 1024;

        return this.player.isMobile;
    }

    /**
     * Apply the current state to the UI elements
     */
    applyMobileState() {
        if (!this.player.isMobile) {
            this.applyDesktopState();
            return;
        }

        // Apply mobile state - toggle expandable rows
        const playbackExtras = document.getElementById('mobile-playback-extras');
        const fileExtras = document.getElementById('mobile-file-extras');
        const playbackToggle = document.getElementById('mobile-playback-toggle');
        const fileToggle = document.getElementById('mobile-file-toggle');

        // Show/hide playback extras row
        if (playbackExtras) {
            if (this.playbackExtrasVisible) {
                playbackExtras.classList.remove('hidden');
            } else {
                playbackExtras.classList.add('hidden');
            }
        }

        // Update playback toggle button
        if (playbackToggle) {
            playbackToggle.classList.toggle('expanded', this.playbackExtrasVisible);
            playbackToggle.textContent = this.playbackExtrasVisible ? '−' : '+';
        }

        // Show/hide file extras row
        if (fileExtras) {
            if (this.fileExtrasVisible) {
                fileExtras.classList.remove('hidden');
            } else {
                fileExtras.classList.add('hidden');
            }
        }

        // Update file toggle button
        if (fileToggle) {
            fileToggle.classList.toggle('expanded', this.fileExtrasVisible);
            fileToggle.textContent = this.fileExtrasVisible ? '−' : '+';
        }

        // Mark body as having mobile controls active
        document.body.classList.add('mobile-controls-active');
    }

    /**
     * Apply desktop state
     */
    applyDesktopState() {
        // Hide mobile elements
        const mobileBar = document.getElementById('mobile-control-bar');

        if (mobileBar) {
            mobileBar.classList.add('hidden');
        }

        // Remove mobile body class
        document.body.classList.remove('mobile-controls-active');

        // Ensure controls are in main control bar in correct order (playback first)
        const controlBar = document.querySelector('.control-bar');
        const playbackControls = document.querySelector('.playback-controls');
        const fingeringControls = document.querySelector('.fingering-controls');
        const notationControls = document.querySelector('.notation-controls');

        if (controlBar) {
            // Add in correct order: playback, fingering, notation
            if (playbackControls && !controlBar.contains(playbackControls)) {
                controlBar.appendChild(playbackControls);
            }
            if (fingeringControls && !controlBar.contains(fingeringControls)) {
                controlBar.appendChild(fingeringControls);
            }
            if (notationControls && !controlBar.contains(notationControls)) {
                controlBar.appendChild(notationControls);
            }
        }

        // Reset mobile-specific styles
        if (playbackControls) {
            playbackControls.style.cssText = '';
        }
        if (fingeringControls) {
            fingeringControls.style.cssText = '';
        }
        if (notationControls) {
            notationControls.style.cssText = '';
        }
    }

    /**
     * Set up handlers for screen size/orientation changes
     */
    setupScreenChangeHandlers() {
        // Handle window resize
        window.addEventListener('resize', () => {
            const wasMobile = this.player.isMobile;
            this.updateMobileState();

            // If transitioning between mobile/desktop, recreate layout
            if (wasMobile !== this.player.isMobile) {
                this.createMobileLayout();
            }

            this.applyMobileState();
        });

        // Handle orientation changes specifically
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateMobileState();
                this.applyMobileState();
            }, 100);
        });
    }

    /**
     * Creates the mobile control bar with all important controls in one row
     * and expandable sections for extras
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

        // Clear existing content
        mobileBar.innerHTML = '';

        // Create main row with all important controls
        const mainRow = document.createElement('div');
        mainRow.className = 'mobile-main-row';

        // Get all control sections
        const playbackControls = document.querySelector('.playback-controls');
        const fingeringControls = document.querySelector('.fingering-controls');
        const notationControls = document.querySelector('.notation-controls');

        // Add important controls to main row
        this.addPlaybackControlsToRow(mainRow, playbackControls);
        this.addFingeringControlsToRow(mainRow, fingeringControls);
        this.addFileControlsToRow(mainRow, notationControls);

        mobileBar.appendChild(mainRow);

        // Create expandable rows for extras
        const extrasContainer = document.createElement('div');
        extrasContainer.className = 'mobile-extras-container';

        // Playback extras row
        const playbackExtras = this.createPlaybackExtrasRow(playbackControls);
        extrasContainer.appendChild(playbackExtras);

        // File extras row
        const fileExtras = this.createFileExtrasRow(notationControls);
        extrasContainer.appendChild(fileExtras);

        mobileBar.appendChild(extrasContainer);

        return mobileBar;
    }

    /**
     * Adds playback controls to the main row
     * @param {HTMLElement} mainRow - The main row element
     * @param {HTMLElement} playbackControls - The playback controls element
     */
    addPlaybackControlsToRow(mainRow, playbackControls) {
        if (!playbackControls) return;

        // Get individual buttons
        const playButton = document.getElementById('play-button');
        const restartButton = document.getElementById('restart-button');
        const transposeUp = document.getElementById('transpose-up');
        const transposeDown = document.getElementById('transpose-down');
        const tempoControl = document.querySelector('.tempo-control');

        // Add important controls to main row
        if (playButton) mainRow.appendChild(playButton);
        if (restartButton) mainRow.appendChild(restartButton);
        if (transposeUp) mainRow.appendChild(transposeUp);
        if (transposeDown) mainRow.appendChild(transposeDown);
        if (tempoControl) mainRow.appendChild(tempoControl);

        // Create toggle button for playback extras
        const toggleButton = document.createElement('button');
        toggleButton.id = 'mobile-playback-toggle';
        toggleButton.className = 'mobile-expand-toggle';
        toggleButton.textContent = '+';
        toggleButton.title = 'Show more playback controls';
        toggleButton.onclick = () => {
            this.playbackExtrasVisible = !this.playbackExtrasVisible;
            this.applyMobileState();
        };
        mainRow.appendChild(toggleButton);
    }

    /**
     * Adds fingering controls to the main row
     * @param {HTMLElement} mainRow - The main row element
     * @param {HTMLElement} fingeringControls - The fingering controls element
     */
    addFingeringControlsToRow(mainRow, fingeringControls) {
        if (!fingeringControls) return;

        // Get individual buttons
        const fingeringToggle = document.getElementById('show-fingering');
        const systemToggle = document.getElementById('system-toggle');
        const chartToggle = document.getElementById('chart-toggle');

        // Add all fingering controls (all important)
        if (fingeringToggle) mainRow.appendChild(fingeringToggle);
        if (systemToggle) mainRow.appendChild(systemToggle);
        if (chartToggle) mainRow.appendChild(chartToggle);
    }

    /**
     * Adds file controls to the main row
     * @param {HTMLElement} mainRow - The main row element
     * @param {HTMLElement} notationControls - The notation controls element
     */
    addFileControlsToRow(mainRow, notationControls) {
        if (!notationControls) return;

        // Get file selector
        const fileControls = notationControls.querySelector('.file-controls');

        // Add file selector to main row
        if (fileControls) mainRow.appendChild(fileControls);

        // Create toggle button for file extras
        const toggleButton = document.createElement('button');
        toggleButton.id = 'mobile-file-toggle';
        toggleButton.className = 'mobile-expand-toggle';
        toggleButton.textContent = '+';
        toggleButton.title = 'Show file operations';
        toggleButton.onclick = () => {
            this.fileExtrasVisible = !this.fileExtrasVisible;
            this.applyMobileState();
        };
        mainRow.appendChild(toggleButton);
    }

    /**
     * Creates the playback extras row
     * @param {HTMLElement} playbackControls - The playback controls element
     * @returns {HTMLElement} The extras row
     */
    createPlaybackExtrasRow(playbackControls) {
        const extrasRow = document.createElement('div');
        extrasRow.id = 'mobile-playback-extras';
        extrasRow.className = 'mobile-extras-row hidden';

        if (!playbackControls) return extrasRow;

        // Get extras buttons
        const chordsToggle = document.getElementById('chords-toggle');
        const voicesToggle = document.getElementById('voices-toggle');
        const metronomeToggle = document.getElementById('metronome-toggle');
        const tuningButton = document.getElementById('tuning-button');

        if (chordsToggle) extrasRow.appendChild(chordsToggle);
        if (voicesToggle) extrasRow.appendChild(voicesToggle);
        if (metronomeToggle) extrasRow.appendChild(metronomeToggle);
        if (tuningButton) extrasRow.appendChild(tuningButton);

        return extrasRow;
    }

    /**
     * Creates the file extras row
     * @param {HTMLElement} notationControls - The notation controls element
     * @returns {HTMLElement} The extras row
     */
    createFileExtrasRow(notationControls) {
        const extrasRow = document.createElement('div');
        extrasRow.id = 'mobile-file-extras';
        extrasRow.className = 'mobile-extras-row hidden';

        if (!notationControls) return extrasRow;

        // Get extras buttons
        const copyButton = document.getElementById('copy-button');
        const pasteButton = document.getElementById('paste-button');
        const shareButton = document.getElementById('share-button');

        if (copyButton) extrasRow.appendChild(copyButton);
        if (pasteButton) extrasRow.appendChild(pasteButton);
        if (shareButton) extrasRow.appendChild(shareButton);

        return extrasRow;
    }
}