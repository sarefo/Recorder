// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize orientation handler first
    window.orientationHandler = new OrientationHandler();

    // Initialize main app
    window.app = new AbcPlayer();

    // Initialize offline manager and register service worker
    window.offlineManager = new OfflineManager();
    window.offlineManager.registerServiceWorker()
        .then(registration => {
            if (registration) {
                console.log('Service Worker registered, offline mode enabled');
            } else {
                console.log('Service Worker not available');
            }
        })
        .catch(error => {
            console.error('Service Worker registration error:', error);
        });
});