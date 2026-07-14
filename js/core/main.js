const APP_BUILD = '2026-07-14-4';
console.log(`[App] build: ${APP_BUILD}`);

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.dataset.build = APP_BUILD;
    // Initialize orientation handler first
    window.orientationHandler = new OrientationHandler();

    // Initialize main app
    window.app = new AbcPlayer();

    // Keep the device screen awake while the app is in the foreground.
    window.wakeLockManager = new WakeLockManager();

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