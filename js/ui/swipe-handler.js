/**
 * Handles swipe gestures on mobile devices
 */
class SwipeHandler {
    constructor(player) {
        this.player = player;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50; // Minimum distance for a swipe to register
        this.isInitialized = false;
    }

    /**
     * Initialize swipe detection
     */
    init() {
        // Only initialize once and only on mobile
        if (this.isInitialized || !this.player.isMobile) {
            return;
        }

        const abcContainer = document.getElementById('abc-notation');
        if (!abcContainer) return;

        // Add touch event listeners
        abcContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), false);
        abcContainer.addEventListener('touchend', this.handleTouchEnd.bind(this), false);

        this.isInitialized = true;
        console.log('Swipe handler initialized for mobile');
    }

    /**
     * Records the starting touch position
     * @param {TouchEvent} event - The touch event
     */
    handleTouchStart(event) {
        this.touchStartX = event.changedTouches[0].screenX;
        this.touchStartY = event.changedTouches[0].screenY;
    }

    /**
     * Handles the touch end event and determines if it was a swipe
     * @param {TouchEvent} event - The touch event
     */
    handleTouchEnd(event) {
        this.touchEndX = event.changedTouches[0].screenX;
        this.touchEndY = event.changedTouches[0].screenY;

        // Calculate swipe distance and direction
        const horizontalDist = this.touchEndX - this.touchStartX;
        const verticalDist = this.touchEndY - this.touchStartY;

        // Determine if the swipe was primarily horizontal or vertical
        if (Math.abs(horizontalDist) > Math.abs(verticalDist)) {
            // Horizontal swipe
            if (Math.abs(horizontalDist) >= this.minSwipeDistance) {
                if (horizontalDist > 0) {
                    // Right swipe - previous tune
                    this.player.tuneManager.previousTune();
                    this.player.render();
                    this.showFeedback('Previous tune');
                } else {
                    // Left swipe - next tune
                    this.player.tuneManager.nextTune();
                    this.player.render();
                    this.showFeedback('Next tune');
                }
            }
        } else {
            // Vertical swipe
            if (Math.abs(verticalDist) >= this.minSwipeDistance) {
                if (verticalDist > 0) {
                    // Down swipe - transpose down
                    this.player.transpose('down');
                    this.showFeedback('Transposed down');
                } else {
                    // Up swipe - transpose up
                    this.player.transpose('up');
                    this.showFeedback('Transposed up');
                }
            }
        }
    }

    /**
     * Shows a brief feedback message
     * @param {string} message - The message to display
     */
    showFeedback(message) {
        Utils.showFeedback(message);
    }
}