/**
 * Manages mobile-specific UI behavior
 */
class MobileUI {
    constructor(player) {
        this.player = player;
        this.playbackBarEnabled = false; // Default to disabled
    }

    /**
     * Sets up mobile controls
     */
    setupMobileControls() {
        // Create or get the toggle button
        const toggleButton = this.createMobileToggleButton();

        // Get control container
        const controlContainer = document.querySelector('.control-container');

        // Create playback bar for mobile
        this.createMobilePlaybackBar();

        // Set up the initial state (properly connected)
        this.updateMobileState();

        // On mobile: always start with controls collapsed
        if (this.player.isMobile) {
            this.player.controlsCollapsed = true;
        } else {
            this.player.controlsCollapsed = false;
        }

        // Apply the initial state to both the button and controls
        this.applyMobileState(toggleButton, controlContainer);

        // Click handler to toggle controls
        toggleButton.onclick = () => {
            this.player.controlsCollapsed = !this.player.controlsCollapsed;
            this.applyMobileState(toggleButton, controlContainer);
        };

        // Set up click outside to close functionality
        this.setupClickOutsideHandler(controlContainer);

        // Handle screen size changes
        this.setupScreenChangeHandlers(toggleButton, controlContainer);

        // Initialize playback controls visibility
        this.updatePlaybackControlsVisibility();
    }

    collapseControls() {
        if (this.player.isMobile) {
            const toggleButton = document.getElementById('control-toggle');
            const controlContainer = document.querySelector('.control-container');

            this.player.controlsCollapsed = true;

            if (controlContainer) {
                controlContainer.classList.add('collapsed');
            }

            if (toggleButton) {
                toggleButton.classList.remove('open');
            }
        }
    }

    /**
     * Set up click outside handler to close mobile dialog
     * @param {HTMLElement} controlContainer - The control container
     */
    setupClickOutsideHandler(controlContainer) {
        // Add click listener to document to handle clicks outside the dialog
        document.addEventListener('click', (e) => {
            // Only handle on mobile when controls are expanded
            if (!this.player.isMobile || this.player.controlsCollapsed) {
                return;
            }

            const toggleButton = document.getElementById('control-toggle');

            // Check if click is outside both the control container and toggle button
            if (!controlContainer.contains(e.target) && !toggleButton.contains(e.target)) {
                // Close the dialog
                this.player.controlsCollapsed = true;
                this.applyMobileState(toggleButton, controlContainer);
            }
        });
    }

    /**
     * Create the hamburger button
     * @returns {HTMLElement} The mobile toggle button
     */
    createMobileToggleButton() {
        let toggleButton = document.getElementById('control-toggle');
        if (!toggleButton) {
            toggleButton = document.createElement('button');
            toggleButton.id = 'control-toggle';
            toggleButton.className = 'control-toggle';
            toggleButton.innerHTML = '<span></span><span></span><span></span>';
            document.body.appendChild(toggleButton);
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

        // Consider both width and device type
        this.player.isMobile = isMobileDevice || window.innerWidth <= 900; // Increased threshold for landscape

        // Alternative approach: detect by maximum dimension
        const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
        const largerDimension = Math.max(window.innerWidth, window.innerHeight);

        // If it's a phone-sized screen in either dimension, treat as mobile
        if (smallerDimension <= 600 || (isMobileDevice && largerDimension <= 1000)) {
            this.player.isMobile = true;
        }

        return this.player.isMobile;
    }

    /**
     * Apply the current state to the UI elements
     * @param {HTMLElement} toggleButton - The mobile toggle button
     * @param {HTMLElement} controlContainer - The control container
     */
    applyMobileState(toggleButton, controlContainer) {
        if (!toggleButton || !controlContainer) return;

        // Always show/hide toggle based on mobile status
        if (this.player.isMobile) {
            toggleButton.classList.remove('hidden');
            toggleButton.classList.add('visible');
        } else {
            toggleButton.classList.add('hidden');
            toggleButton.classList.remove('visible');
        }

        // For desktop: always show controls, never collapsed, hide mobile playback bar
        if (!this.player.isMobile) {
            controlContainer.classList.remove('collapsed');
            controlContainer.classList.remove('mobile-view');

            // Hide mobile top playback bar on desktop
            const playbackBar = document.getElementById('mobile-playback-bar');
            if (playbackBar) {
                playbackBar.classList.add('hidden');
            }
            return;
        }

        // For mobile: handle collapsed state and styling
        controlContainer.classList.add('mobile-view');

        if (this.player.controlsCollapsed) {
            controlContainer.classList.add('collapsed');
            toggleButton.classList.remove('open');
        } else {
            controlContainer.classList.remove('collapsed');
            toggleButton.classList.add('open');
        }

        // Update mobile playback bar visibility based on toggle state
        const playbackBar = document.getElementById('mobile-playback-bar');
        if (playbackBar) {
            if (this.playbackBarEnabled) {
                playbackBar.classList.remove('hidden');
                controlContainer.classList.add('with-top-playback');
            } else {
                playbackBar.classList.add('hidden');
                controlContainer.classList.remove('with-top-playback');
            }
        }
    }

    /**
         * Set up handlers for screen size/orientation changes
         * @param {HTMLElement} toggleButton - The mobile toggle button
         * @param {HTMLElement} controlContainer - The control container
         */
    setupScreenChangeHandlers(toggleButton, controlContainer) {
        // Handle window resize
        window.addEventListener('resize', () => {
            const wasMobile = this.player.isMobile;
            this.updateMobileState();

            // If transitioning between mobile/desktop, reset collapsed state appropriately
            if (wasMobile !== this.player.isMobile) {
                this.player.controlsCollapsed = this.player.isMobile;
            }

            this.applyMobileState(toggleButton, controlContainer);
        });

        // Handle orientation changes specifically
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateMobileState();
                this.applyMobileState(toggleButton, controlContainer);
            }, 100);
        });
    }

    /**
     * Creates the mobile playback bar container
     */
    createMobilePlaybackBar() {
        let playbackBar = document.getElementById('mobile-playback-bar');

        if (!playbackBar) {
            playbackBar = document.createElement('div');
            playbackBar.id = 'mobile-playback-bar';
            playbackBar.className = 'mobile-playback-bar hidden';
            document.body.appendChild(playbackBar);
        }
        return playbackBar;
    }

    /**
     * Creates playback toggle for mobile popup
     * @returns {HTMLElement} The playback toggle container
     */
    createPlaybackToggle() {
        const toggleSwitch = document.createElement('button');
        toggleSwitch.id = 'playback-toggle';
        toggleSwitch.className = 'toggle-switch';
        toggleSwitch.textContent = 'Playback';
        toggleSwitch.title = 'Show/hide permanent playback controls';

        if (this.playbackBarEnabled) {
            toggleSwitch.classList.add('active');
        }

        toggleSwitch.addEventListener('click', () => {
            this.togglePlaybackBar();
        });

        return toggleSwitch;
    }

    /**
     * Toggles the playback bar visibility and moves controls
     */
    togglePlaybackBar() {
        this.playbackBarEnabled = !this.playbackBarEnabled;

        const toggleSwitch = document.getElementById('playback-toggle');
        if (toggleSwitch) {
            toggleSwitch.classList.toggle('active', this.playbackBarEnabled);
        }

        let playbackBar = document.getElementById('mobile-playback-bar');

        // If not found, try to create it
        if (!playbackBar) {
            playbackBar = this.createMobilePlaybackBar();
        }

        const playbackControls = document.querySelector('.playback-controls');

        if (this.playbackBarEnabled) {
            // Show playback bar and move controls there
            if (playbackBar) {
                playbackBar.classList.remove('hidden');
                // Force the bar itself to be visible at the top
                playbackBar.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; background-color: #f8f8f8 !important; border-bottom: 1px solid #ddd !important; box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important; z-index: 1000 !important; height: auto !important; display: flex !important; align-items: center !important; justify-content: center !important; transform: translateY(0) !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; padding: 0 !important;';
            }
            if (playbackControls) {
                // Move to top bar and force visibility with aggressive styling
                playbackBar.appendChild(playbackControls);

                // Force visibility with explicit dimensions (this worked before)
                playbackControls.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; width: 100% !important; height: auto !important; flex-wrap: nowrap !important; justify-content: space-between !important; align-items: center !important; gap: 6px !important; margin: 0 !important; padding: 8px 15px !important; background-color: transparent !important;';

                // Force visibility on all child elements  
                const buttons = playbackControls.querySelectorAll('button, div, input, span');
                buttons.forEach(element => {
                    if (element.tagName === 'BUTTON') {
                        // Don't override our special toggle buttons - just make them visible
                        if (element.id === 'chords-toggle' || element.id === 'voices-toggle' || element.id === 'metronome-toggle') {
                            element.style.cssText += '; display: inline-block !important; visibility: visible !important; opacity: 1 !important;';
                        } else {
                            element.style.cssText += '; display: inline-block !important; visibility: visible !important; opacity: 1 !important; width: auto !important; height: auto !important; padding: 6px 10px !important; margin: 2px !important; background-color: #f8f8f8 !important; color: #333 !important; border: 1px solid #ddd !important; border-radius: 4px !important; font-size: 12px !important;';
                        }
                    } else if (element.classList.contains('tempo-control')) {
                        element.style.cssText += '; display: flex !important; visibility: visible !important; opacity: 1 !important; align-items: center !important; gap: 5px !important; margin: 0 5px !important; flex: 1 1 auto !important; min-width: 150px !important;';
                    } else if (element.id === 'tempo-slider') {
                        element.style.cssText += '; display: block !important; visibility: visible !important; opacity: 1 !important; flex: 1 1 auto !important; min-width: 80px !important;';
                    } else {
                        element.style.cssText += '; display: block !important; visibility: visible !important; opacity: 1 !important;';
                    }
                });

                // Reapply our custom button styles after mobile UI manipulation
                setTimeout(() => {
                    if (this.player.uiControls && this.player.uiControls.reapplyAllToggleButtonStyles) {
                        this.player.uiControls.reapplyAllToggleButtonStyles();
                    }
                }, 150);

            }
        } else {
            // Hide top playback bar
            if (playbackBar) {
                playbackBar.classList.add('hidden');
            }
            if (playbackControls) {
                // Move controls back and hide them on mobile
                const controlBar = document.querySelector('.control-bar');
                if (controlBar) {
                    controlBar.appendChild(playbackControls);
                    playbackControls.style.display = 'none';
                }
            }
        }
    }

    /**
     * Updates playback controls visibility in mobile popup
     */
    updatePlaybackControlsVisibility() {
        const playbackControls = document.querySelector('.playback-controls');

        if (playbackControls) {
            if (this.player.isMobile) {
                // On mobile: hide in popup only if not in bottom bar
                if (!this.playbackBarEnabled) {
                    playbackControls.style.display = 'none';
                } else {
                    // Show when in bottom bar
                    playbackControls.style.display = '';
                }
            } else {
                // On desktop: always show playback controls in popup
                playbackControls.style.display = '';
            }
        }
    }

    /**
     * Gets whether playback bar is enabled
     * @returns {boolean} Whether playback bar is enabled
     */
    isPlaybackBarEnabled() {
        return this.playbackBarEnabled;
    }
}