/**
 * Manages mobile-specific UI behavior
 */
class MobileUI {
    constructor(player) {
        this.player = player;
    }

    /**
     * Sets up mobile controls
     */
    setupMobileControls() {
        // Create or get the toggle button
        const toggleButton = this.createMobileToggleButton();

        // Get control container
        const controlContainer = document.querySelector('.control-container');

        // On mobile: always start with controls collapsed
        // Update the state tracking
        if (this.player.isMobile) {
            this.player.controlsCollapsed = true;
            controlContainer.classList.add('collapsed');
            toggleButton.classList.remove('open');
        } else {
            this.player.controlsCollapsed = false;
            controlContainer.classList.remove('collapsed');
        }

        // Set up the initial state (properly connected)
        this.updateMobileState();

        // Apply the initial state to both the button and controls
        this.applyMobileState(toggleButton, controlContainer);

        // Click handler to toggle controls
        toggleButton.onclick = () => {
            this.player.controlsCollapsed = !this.player.controlsCollapsed;
            this.applyMobileState(toggleButton, controlContainer);
        };

        // Handle screen size changes
        this.setupScreenChangeHandlers(toggleButton, controlContainer);
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
        toggleButton.style.display = this.player.isMobile ? 'block' : 'none';

        // For desktop: always show controls, never collapsed
        if (!this.player.isMobile) {
            controlContainer.classList.remove('collapsed');
            controlContainer.classList.remove('mobile-view');
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
}