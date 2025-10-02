/**
 * Manages mobile-specific UI behavior
 */
class MobileUI {
    constructor(player) {
        this.player = player;
        this.additionalControlsVisible = false; // Additional controls (fingering + notation)
        this.playbackControlsMinimized = false; // Playback controls minimize state
    }

    /**
     * Sets up mobile controls
     */
    setupMobileControls() {
        // Get control container
        const controlContainer = document.querySelector('.control-container');

        // Set up the initial state
        this.updateMobileState();

        // Create mobile layout
        this.createMobileLayout();

        // Handle screen size changes
        this.setupScreenChangeHandlers();
    }

    collapseControls() {
        if (this.player.isMobile) {
            this.additionalControlsVisible = false;
            this.applyMobileState();
        }
    }

    /**
     * Creates the mobile layout with playback controls always visible
     */
    createMobileLayout() {
        if (!this.player.isMobile) return;

        const controlContainer = document.querySelector('.control-container');
        if (!controlContainer) return;

        // Create mobile playback bar (always visible)
        this.createMobilePlaybackBar();

        // Create additional controls container (toggle-able)
        this.createAdditionalControlsContainer();

        // Set up initial state
        this.applyMobileState();
    }

    /**
     * Create the hamburger button attached to playback controls
     * @returns {HTMLElement} The mobile toggle button
     */
    createMobileToggleButton() {
        let toggleButton = document.getElementById('mobile-hamburger');
        if (!toggleButton) {
            toggleButton = document.createElement('button');
            toggleButton.id = 'mobile-hamburger';
            toggleButton.className = 'mobile-hamburger';
            toggleButton.innerHTML = '<span></span><span></span><span></span>';
            toggleButton.title = 'Toggle additional controls';
            
            // Add click handler
            toggleButton.onclick = () => {
                this.additionalControlsVisible = !this.additionalControlsVisible;
                this.applyMobileState();
            };
        }
        return toggleButton;
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

        // Apply mobile state
        const playbackBar = document.getElementById('mobile-playback-bar');
        const additionalControls = document.getElementById('mobile-additional-controls');
        const hamburgerButton = document.getElementById('mobile-hamburger');
        const minimizeButton = document.getElementById('mobile-minimize');

        // Show/hide additional controls
        if (additionalControls) {
            if (this.additionalControlsVisible) {
                additionalControls.classList.remove('hidden');
                additionalControls.classList.add('visible');
            } else {
                additionalControls.classList.add('hidden');
                additionalControls.classList.remove('visible');
            }
        }

        // Update hamburger button state
        if (hamburgerButton) {
            hamburgerButton.classList.toggle('open', this.additionalControlsVisible);
        }

        // Handle playback controls minimize state
        if (playbackBar) {
            if (this.playbackControlsMinimized) {
                playbackBar.classList.add('minimized');
                document.body.classList.remove('mobile-playback-active');
            } else {
                playbackBar.classList.remove('minimized');
                document.body.classList.add('mobile-playback-active');
            }
        }

        // Update minimize button state
        if (minimizeButton) {
            minimizeButton.classList.toggle('active', this.playbackControlsMinimized);
            // Update button text based on minimized state
            minimizeButton.innerHTML = this.playbackControlsMinimized ? '+' : '−';
        }
    }

    /**
     * Apply desktop state
     */
    applyDesktopState() {
        // Hide mobile elements
        const playbackBar = document.getElementById('mobile-playback-bar');
        const additionalControls = document.getElementById('mobile-additional-controls');
        
        if (playbackBar) {
            playbackBar.classList.add('hidden');
        }
        if (additionalControls) {
            additionalControls.classList.add('hidden');
        }
        
        // Remove mobile body class
        document.body.classList.remove('mobile-playback-active');
        
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
     * Creates the mobile playback bar container
     */
    createMobilePlaybackBar() {
        if (!this.player.isMobile) return;

        let playbackBar = document.getElementById('mobile-playback-bar');

        if (!playbackBar) {
            playbackBar = document.createElement('div');
            playbackBar.id = 'mobile-playback-bar';
            playbackBar.className = 'mobile-playback-bar';
            document.body.appendChild(playbackBar);
        }

        // Move playback controls to the bar
        const playbackControls = document.querySelector('.playback-controls');
        if (playbackControls && !playbackBar.contains(playbackControls)) {
            playbackBar.appendChild(playbackControls);
        }

        // Add hamburger button to playback bar
        const hamburgerButton = this.createMobileToggleButton();
        if (!playbackBar.contains(hamburgerButton)) {
            playbackBar.appendChild(hamburgerButton);
        }

        // Add minimize button to playback bar
        const minimizeButton = this.createMinimizeButton();
        if (!playbackBar.contains(minimizeButton)) {
            playbackBar.appendChild(minimizeButton);
        }

        return playbackBar;
    }

    /**
     * Creates additional controls container
     */
    createAdditionalControlsContainer() {
        if (!this.player.isMobile) return;

        let additionalControls = document.getElementById('mobile-additional-controls');

        if (!additionalControls) {
            additionalControls = document.createElement('div');
            additionalControls.id = 'mobile-additional-controls';
            additionalControls.className = 'mobile-additional-controls hidden';
            document.body.appendChild(additionalControls);
        }

        // Move fingering and notation controls to additional controls
        const fingeringControls = document.querySelector('.fingering-controls');
        const notationControls = document.querySelector('.notation-controls');

        if (fingeringControls && !additionalControls.contains(fingeringControls)) {
            additionalControls.appendChild(fingeringControls);
        }
        if (notationControls && !additionalControls.contains(notationControls)) {
            additionalControls.appendChild(notationControls);
        }

        return additionalControls;
    }

    /**
     * Creates minimize button for playback controls
     * @returns {HTMLElement} The minimize button
     */
    createMinimizeButton() {
        let minimizeButton = document.getElementById('mobile-minimize');
        if (!minimizeButton) {
            minimizeButton = document.createElement('button');
            minimizeButton.id = 'mobile-minimize';
            minimizeButton.className = 'mobile-minimize';
            minimizeButton.innerHTML = '−';
            minimizeButton.title = 'Minimize playback controls';
            
            // Add click handler
            minimizeButton.onclick = () => {
                this.playbackControlsMinimized = !this.playbackControlsMinimized;
                this.applyMobileState();
            };
        }
        return minimizeButton;
    }

    /**
     * Gets whether additional controls are visible
     * @returns {boolean} Whether additional controls are visible
     */
    areAdditionalControlsVisible() {
        return this.additionalControlsVisible;
    }

    /**
     * Gets whether playback controls are minimized
     * @returns {boolean} Whether playback controls are minimized
     */
    arePlaybackControlsMinimized() {
        return this.playbackControlsMinimized;
    }
}