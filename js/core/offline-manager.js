/**
 * Manages offline functionality via Service Worker
 */
class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isCacheComplete = false;
        this.cacheProgress = 0;
        this.totalFiles = 0;
        this.serviceWorkerRegistration = null;

        this.setupEventListeners();
    }

    /**
     * Set up event listeners for online/offline status
     */
    setupEventListeners() {
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));

        // Listen for messages from service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event);
            });
        }
    }

    /**
     * Register the service worker
     * @returns {Promise<ServiceWorkerRegistration|null>}
     */
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported in this browser');
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.register('/Recorder/sw.js', {
                scope: '/Recorder/'
            });

            console.log('Service Worker registered successfully:', registration);
            this.serviceWorkerRegistration = registration;

            // Listen for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('Service Worker update found');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New Service Worker available - page will reload on next visit');
                        this.showUpdateNotification();
                    }
                });
            });

            // Start caching ABC files in background after registration
            this.startBackgroundCaching();

            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    }

    /**
     * Start caching all ABC files in background
     */
    async startBackgroundCaching() {
        try {
            // Get list of ABC files from AbcFileList
            if (typeof AbcFileList === 'undefined') {
                console.warn('AbcFileList not available yet, waiting...');
                setTimeout(() => this.startBackgroundCaching(), 1000);
                return;
            }

            const files = AbcFileList.getFiles();
            this.totalFiles = files.length;

            console.log(`Starting background caching of ${this.totalFiles} ABC files`);

            // Send message to service worker to start caching
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'CACHE_ABC_FILES',
                    files: files
                });
            } else {
                console.warn('No active service worker controller yet');
            }
        } catch (error) {
            console.error('Error starting background caching:', error);
        }
    }

    /**
     * Handle messages from service worker
     * @param {MessageEvent} event
     */
    handleServiceWorkerMessage(event) {
        const { type, cached, total } = event.data;

        switch (type) {
            case 'CACHE_PROGRESS':
                this.cacheProgress = cached;
                this.totalFiles = total;
                this.updateCacheProgress(cached, total);
                break;

            case 'CACHE_COMPLETE':
                this.isCacheComplete = true;
                this.cacheProgress = cached;
                this.totalFiles = total;
                console.log(`Cache complete: ${cached}/${total} files cached`);
                this.updateStatusDisplay();
                this.showCacheCompleteNotification(cached, total);
                break;

            default:
                console.log('Unknown service worker message:', event.data);
        }
    }

    /**
     * Update cache progress display
     * @param {number} cached - Number of files cached
     * @param {number} total - Total number of files
     */
    updateCacheProgress(cached, total) {
        const percentage = Math.round((cached / total) * 100);
        console.log(`Cache progress: ${cached}/${total} (${percentage}%)`);

        // Update UI if status display exists
        const statusElement = document.getElementById('offline-status-text');
        if (statusElement) {
            statusElement.textContent = `Caching: ${percentage}%`;
        }
    }

    /**
     * Show cache complete notification
     * @param {number} cached - Number of files cached
     * @param {number} total - Total number of files
     */
    showCacheCompleteNotification(cached, total) {
        const message = `Offline mode ready! ${cached}/${total} files cached`;
        console.log(message);

        // Show feedback to user
        if (typeof Utils !== 'undefined' && Utils.showFeedback) {
            Utils.showFeedback(message);
        }
    }

    /**
     * Show update notification
     */
    showUpdateNotification() {
        const message = 'App update available! Refresh to get the latest version.';
        console.log(message);

        if (typeof Utils !== 'undefined' && Utils.showFeedback) {
            Utils.showFeedback(message);
        }
    }

    /**
     * Update online/offline status
     * @param {boolean} online - Whether the app is online
     */
    updateOnlineStatus(online) {
        this.isOnline = online;
        console.log(`Network status: ${online ? 'Online' : 'Offline'}`);
        this.updateStatusDisplay();

        // Show feedback to user
        if (typeof Utils !== 'undefined' && Utils.showFeedback) {
            Utils.showFeedback(online ? 'Back online' : 'Offline mode');
        }
    }

    /**
     * Update the offline status display in UI
     */
    updateStatusDisplay() {
        const indicator = document.getElementById('offline-indicator');
        const statusText = document.getElementById('offline-status-text');

        if (!indicator) return;

        // Remove all status classes
        indicator.classList.remove('online', 'offline', 'no-cache');

        if (this.isOnline) {
            // Online
            indicator.classList.add('online');
            indicator.title = 'Online';
            if (statusText) {
                statusText.textContent = this.isCacheComplete
                    ? `${this.cacheProgress} files cached`
                    : 'Online';
            }
        } else {
            // Offline
            if (this.isCacheComplete) {
                indicator.classList.add('offline');
                indicator.title = 'Offline (cached)';
                if (statusText) {
                    statusText.textContent = `Offline (${this.cacheProgress} files cached)`;
                }
            } else {
                indicator.classList.add('no-cache');
                indicator.title = 'Offline (limited functionality)';
                if (statusText) {
                    statusText.textContent = 'Offline (limited)';
                }
            }
        }
    }

    /**
     * Get current online status
     * @returns {boolean}
     */
    isAppOnline() {
        return this.isOnline;
    }

    /**
     * Get cache status
     * @returns {object}
     */
    getCacheStatus() {
        return {
            isComplete: this.isCacheComplete,
            cached: this.cacheProgress,
            total: this.totalFiles,
            percentage: this.totalFiles > 0
                ? Math.round((this.cacheProgress / this.totalFiles) * 100)
                : 0
        };
    }
}
