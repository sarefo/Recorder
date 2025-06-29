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
        this.maxSwipeDuration = 100; // Maximum duration in ms for a gesture to be considered a swipe
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
        // Don't initiate swipe detection if the user is interacting with a control
        if (event.target.closest('.control-container') ||
            event.target.closest('button') ||
            event.target.closest('input')) {
            this.isSwiping = false;
            return;
        }

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
            // Calculate distances
            const horizontalDist = this.touchEndX - this.touchStartX;
            const verticalDist = this.touchEndY - this.touchStartY;

            // Determine if swipe is more horizontal or vertical
            const isHorizontal = Math.abs(horizontalDist) > Math.abs(verticalDist);

            if (isHorizontal && Math.abs(horizontalDist) >= this.minSwipeDistance) {
                // Horizontal swipes for tune navigation
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
            } else if (!isHorizontal && Math.abs(verticalDist) >= this.minSwipeDistance) {
                // Vertical swipes for page scrolling
                if (verticalDist > 0) {
                    // Down swipe - scroll up (show previous page)
                    this.scrollPage('up');
                } else {
                    // Up swipe - scroll down (show next page)
                    this.scrollPage('down');
                }
            }
        }

        this.isSwiping = false;
    }

    /**
     * Scrolls the sheet music page with overlap
     * @param {string} direction - 'up' or 'down'
     */
    scrollPage(direction) {
        const abcContainer = document.getElementById('abc-notation');
        if (!abcContainer) return;

        // Get viewport and content dimensions
        const viewportHeight = window.innerHeight;
        const scrollableHeight = document.documentElement.scrollHeight - viewportHeight;
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

        // Calculate page size (90% of viewport for overlap)
        const pageSize = viewportHeight * 0.9;
        
        let targetScroll;
        if (direction === 'down') {
            // Scrolling down - show next page
            targetScroll = Math.min(currentScroll + pageSize, scrollableHeight);
            this.showFeedback('Next page');
        } else {
            // Scrolling up - show previous page  
            targetScroll = Math.max(currentScroll - pageSize, 0);
            this.showFeedback('Previous page');
        }

        // Smooth scroll to target position
        window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    }

    /**
     * Shows a brief feedback message
     * @param {string} message - The message to display
     */
    showFeedback(message) {
        Utils.showFeedback(message);
    }
}