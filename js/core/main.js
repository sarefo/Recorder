// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize orientation handler first
    window.orientationHandler = new OrientationHandler();

    // Initialize main app
    window.app = new AbcPlayer();
});