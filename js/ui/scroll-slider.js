/**
 * Provides a vertical scroll slider for mobile users
 */
class ScrollSlider {
    constructor(player) {
        this.player = player;
        this.sliderElement = null;
        this.isDragging = false;
        this.lastScrollPosition = 0;
        this.scrollThumbHeight = 60; // Default height in pixels
        this.hideTimeout = null;
        this.isVisible = false;
    }

    /**
     * Creates and initializes the scroll slider
     */
    init() {
        if (!this.player.isMobile) return;

        // Create the slider container
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'scroll-slider-container';

        // Create the slider thumb
        const sliderThumb = document.createElement('div');
        sliderThumb.className = 'scroll-slider-thumb';

        // Add thumb to container
        sliderContainer.appendChild(sliderThumb);

        // Add container to document
        document.body.appendChild(sliderContainer);

        this.sliderElement = sliderContainer;
        this.thumbElement = sliderThumb;

        // Initialize event listeners
        this._initEventListeners();

        // Initial position update
        this._updateSliderPosition();

        // Hide the slider initially
        this._hideSlider();

        // Show slider on first scroll
        window.addEventListener('scroll', () => this._handleScroll(), { passive: true });

        // Update on resize
        window.addEventListener('resize', () => this._updateSliderPosition(), { passive: true });
    }

    /**
     * Initialize event listeners for the slider
     */
    _initEventListeners() {
        // Touch/mouse events for the thumb
        this.thumbElement.addEventListener('touchstart', (e) => this._handleDragStart(e), { passive: false });
        this.thumbElement.addEventListener('mousedown', (e) => this._handleDragStart(e), { passive: false });

        // Global touch/mouse events for dragging
        document.addEventListener('touchmove', (e) => this._handleDragMove(e), { passive: false });
        document.addEventListener('mousemove', (e) => this._handleDragMove(e), { passive: false });

        document.addEventListener('touchend', () => this._handleDragEnd(), { passive: true });
        document.addEventListener('mouseup', () => this._handleDragEnd(), { passive: true });
    }

    /**
     * Handles the start of a drag operation
     * @param {Event} e - The mousedown/touchstart event
     */
    _handleDragStart(e) {
        e.preventDefault();
        this.isDragging = true;
        this.sliderElement.classList.add('active');

        // Store initial touch/mouse position
        this.lastY = e.type === 'touchstart'
            ? e.touches[0].clientY
            : e.clientY;

        // Store initial scroll position
        this.initialScrollTop = window.scrollY;
    }

    /**
     * Handles dragging motion
     * @param {Event} e - The mousemove/touchmove event
     */
    _handleDragMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        // Get current position
        const currentY = e.type === 'touchmove'
            ? e.touches[0].clientY
            : e.clientY;

        // Calculate distance moved
        const deltaY = currentY - this.lastY;

        // Calculate scroll amount based on document height
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollRatio = scrollableHeight / (window.innerHeight - this.scrollThumbHeight);
        const scrollAmount = deltaY * scrollRatio;

        // Scroll the page
        window.scrollTo({
            top: this.initialScrollTop + scrollAmount,
            behavior: 'auto'
        });

        // Update thumb position
        this._updateThumbPosition();
    }

    /**
     * Handles the end of dragging
     */
    _handleDragEnd() {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.sliderElement.classList.remove('active');

        // Start the hide timer
        this._scheduleHide();
    }

    /**
     * Handles scroll events
     */
    _handleScroll() {
        if (this.player.isMobile) {
            // Show the slider
            this._showSlider();

            // Update thumb position
            this._updateThumbPosition();

            // Schedule hide after scrolling stops
            this._scheduleHide();
        }
    }

    /**
     * Updates the thumb position based on current scroll
     */
    _updateThumbPosition() {
        if (!this.thumbElement) return;

        const scrollRatio = window.scrollY /
            (document.documentElement.scrollHeight - window.innerHeight);

        const thumbTravel = window.innerHeight - this.scrollThumbHeight;
        const thumbPosition = scrollRatio * thumbTravel;

        this.thumbElement.style.top = `${thumbPosition}px`;
    }

    /**
     * Updates the slider's overall position and size
     */
    _updateSliderPosition() {
        if (!this.sliderElement) return;

        // Calculate thumb height based on page length vs viewport
        const viewportRatio = window.innerHeight / document.documentElement.scrollHeight;
        this.scrollThumbHeight = Math.max(40, window.innerHeight * viewportRatio);

        // Update thumb height
        this.thumbElement.style.height = `${this.scrollThumbHeight}px`;

        // Update thumb position
        this._updateThumbPosition();
    }

    /**
     * Shows the slider with fade-in effect
     */
    _showSlider() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        if (!this.isVisible) {
            this.isVisible = true;
            this.sliderElement.classList.add('visible');
        }
    }

    /**
     * Hides the slider with fade-out effect
     */
    _hideSlider() {
        this.isVisible = false;
        this.sliderElement.classList.remove('visible');
    }

    /**
     * Schedules hiding the slider after scrolling stops
     */
    _scheduleHide() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        this.hideTimeout = setTimeout(() => {
            if (!this.isDragging) {
                this._hideSlider();
            }
        }, 1500); // Hide after 1.5 seconds of inactivity
    }
}