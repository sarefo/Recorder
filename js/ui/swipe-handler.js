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
        this.touchStartTime = 0;
        this.minSwipeDistance = 50; // Minimum distance for a swipe to register
        this.maxSwipeDuration = 300; // Maximum duration in ms for a gesture to be considered a swipe
        this.isInitialized = false;
        this.isSwiping = false;
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
        abcContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), false);
        abcContainer.addEventListener('touchend', this.handleTouchEnd.bind(this), false);

        this.isInitialized = true;
        console.log('Swipe handler initialized for mobile');
    }

    /**
     * Records the starting touch position and time
     * @param {TouchEvent} event - The touch event
     */
    handleTouchStart(event) {
        this.touchStartX = event.changedTouches[0].screenX;
        this.touchStartY = event.changedTouches[0].screenY;
        this.touchStartTime = new Date().getTime();
        this.isSwiping = true;
    }

    /**
     * Tracks touch movement to distinguish between swipes and scrolls
     * @param {TouchEvent} event - The touch event
     */
    handleTouchMove(event) {
        if (!this.isSwiping) return;

        // Calculate current distance moved
        const currentX = event.changedTouches[0].screenX;
        const currentY = event.changedTouches[0].screenY;
        const horizontalDist = currentX - this.touchStartX;
        const verticalDist = currentY - this.touchStartY;

        // If the user has moved a significant distance and seems to be scrolling rather than swiping
        // (For example, if they've moved more than 3x the min swipe distance or held for too long)
        const currentTime = new Date().getTime();
        const elapsedTime = currentTime - this.touchStartTime;

        if (elapsedTime > this.maxSwipeDuration ||
            Math.abs(horizontalDist) > this.minSwipeDistance * 3 ||
            Math.abs(verticalDist) > this.minSwipeDistance * 3) {

            // This is likely a scroll or drag, not a swipe
            this.isSwiping = false;
        }
    }

    /**
     * Handles the touch end event and determines if it was a swipe
     * @param {TouchEvent} event - The touch event
     */
    handleTouchEnd(event) {
        if (!this.isSwiping) return;

        this.touchEndX = event.changedTouches[0].screenX;
        this.touchEndY = event.changedTouches[0].screenY;
        const touchEndTime = new Date().getTime();

        // Calculate swipe duration
        const swipeDuration = touchEndTime - this.touchStartTime;

        // Only process quick gestures
        if (swipeDuration <= this.maxSwipeDuration) {
            // Calculate swipe distance and direction
            const horizontalDist = this.touchEndX - this.touchStartX;
            const verticalDist = this.touchEndY - this.touchStartY;

            // Determine if the swipe was primarily horizontal or vertical
            // Add a bias toward horizontal to make left/right navigation easier
            if (Math.abs(horizontalDist) > Math.abs(verticalDist) * 0.8) {
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

        this.isSwiping = false;
    }

    /**
     * Shows a brief feedback message
     * @param {string} message - The message to display
     */
    showFeedback(message) {
        Utils.showFeedback(message);
    }
}