/**
 * Handles orientation detection and displays a prompt when in portrait mode on mobile
 */
class OrientationHandler {
    constructor() {
        this.overlay = null;
        this.setupOrientationPrompt();
        this.checkOrientation();
        this.setupOrientationListeners();
    }

    /**
     * Determines if current device is mobile
     * @returns {boolean} True if mobile device
     */
    isMobileDevice() {
        const userAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const screenSize = Math.min(window.innerWidth, window.innerHeight) <= 600;
        return userAgent || screenSize;
    }

    /**
     * Determines if device is in portrait mode
     * @returns {boolean} True if in portrait mode
     */
    isPortraitMode() {
        return window.innerHeight > window.innerWidth;
    }

    /**
     * Creates the orientation prompt overlay
     */
    setupOrientationPrompt() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'orientation-prompt';
        this.overlay.className = 'orientation-overlay hidden';

        this.overlay.innerHTML = `
            <div class="orientation-content">
                <div class="orientation-icon">📱 ↻</div>
                <h2>Please Rotate Your Device</h2>
                <p>This app is designed for landscape mode.</p>
                <p class="orientation-tip">
                    <strong>Tip:</strong> For the best experience, add this app to your home screen:
                </p>
                <ul class="orientation-instructions">
                    <li><strong>Android:</strong> Tap menu (⋮) → "Add to Home screen"</li>
                    <li><strong>iOS:</strong> Tap share (⎙) → "Add to Home Screen"</li>
                </ul>
                <p class="orientation-dismiss">The app will open in landscape automatically when installed.</p>
            </div>
        `;

        document.body.appendChild(this.overlay);
    }

    /**
     * Checks current orientation and shows/hides overlay accordingly
     */
    checkOrientation() {
        if (!this.overlay) return;

        const shouldShow = this.isMobileDevice() && this.isPortraitMode();

        if (shouldShow) {
            this.overlay.classList.remove('hidden');
            document.body.classList.add('orientation-locked');
        } else {
            this.overlay.classList.add('hidden');
            document.body.classList.remove('orientation-locked');
        }
    }

    /**
     * Sets up event listeners for orientation changes
     */
    setupOrientationListeners() {
        // Listen for window resize (covers most orientation changes)
        window.addEventListener('resize', () => {
            this.checkOrientation();
        });

        // Listen for orientation change events specifically
        window.addEventListener('orientationchange', () => {
            // Small delay to ensure dimensions are updated
            setTimeout(() => {
                this.checkOrientation();
            }, 100);
        });

        // Also check on visibility change (when user returns to tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkOrientation();
            }
        });
    }
}
