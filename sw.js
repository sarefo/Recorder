/**
 * Service Worker for ABC Recorder App
 * Handles offline caching of app shell and ABC music files
 */

const CACHE_VERSION = 'abc-player-v2';
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
const ABC_FILES_CACHE = `${CACHE_VERSION}-abc-files`;

// App shell files to cache on install
const APP_SHELL_FILES = [
    '/Recorder/index.html',
    '/Recorder/js/core/utils.js',
    '/Recorder/js/core/settings-manager.js',
    '/Recorder/js/core/offline-manager.js',
    '/Recorder/js/core/abc-player.js',
    '/Recorder/js/core/main.js',
    '/Recorder/js/core/share-manager.js',
    '/Recorder/js/notation/notation-parser.js',
    '/Recorder/js/notation/render-manager.js',
    '/Recorder/js/notation/transpose-manager.js',
    '/Recorder/js/fingering/fingering-manager.js',
    '/Recorder/js/fingering/diagram-renderer.js',
    '/Recorder/js/playback/midi-player.js',
    '/Recorder/js/playback/auto-scroll-manager.js',
    '/Recorder/js/playback/custom-metronome.js',
    '/Recorder/js/playback/tuning-manager.js',
    '/Recorder/js/files/file-manager.js',
    '/Recorder/js/files/tune-manager.js',
    '/Recorder/js/files/tune-navigation.js',
    '/Recorder/js/ui/ui-controls.js',
    '/Recorder/js/ui/mobile-ui.js',
    '/Recorder/js/ui/orientation-handler.js',
    '/Recorder/js/ui/swipe-handler.js',
    '/Recorder/js/data/abc-file-list.js',
    'https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js',
    'https://cdn.jsdelivr.net/npm/abcjs@6.4.4/abcjs-audio.min.css'
];

/**
 * Install event - cache app shell
 */
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(APP_SHELL_CACHE)
            .then(async (cache) => {
                console.log('[Service Worker] Caching app shell');

                // Cache files individually so one failure doesn't break everything
                let cached = 0;
                for (const file of APP_SHELL_FILES) {
                    try {
                        await cache.add(file);
                        cached++;
                    } catch (error) {
                        console.warn(`[Service Worker] Failed to cache ${file}:`, error.message);
                    }
                }

                console.log(`[Service Worker] Cached ${cached}/${APP_SHELL_FILES.length} app shell files`);
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] App shell caching failed:', error);
                // Still skip waiting even if caching fails
                return self.skipWaiting();
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old cache versions
                        if (cacheName.startsWith('abc-player-') &&
                            cacheName !== APP_SHELL_CACHE &&
                            cacheName !== ABC_FILES_CACHE) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activated');
                // Claim all clients immediately
                return self.clients.claim();
            })
    );
});

/**
 * Fetch event - serve from cache or network
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle ABC file requests
    if (url.pathname.includes('/Recorder/abc/')) {
        event.respondWith(cacheFirstStrategy(request, ABC_FILES_CACHE));
        return;
    }

    // Handle app shell requests
    if (url.pathname.startsWith('/Recorder/')) {
        event.respondWith(networkFirstStrategy(request, APP_SHELL_CACHE));
        return;
    }

    // Handle CDN requests (ABCJS library)
    if (url.hostname === 'cdn.jsdelivr.net') {
        event.respondWith(cacheFirstStrategy(request, APP_SHELL_CACHE));
        return;
    }

    // Handle MIDI soundfont requests (required for offline MIDI playback)
    // ABCJS loads instrument samples from this domain
    if (url.hostname === 'paulrosen.github.io') {
        event.respondWith(cacheFirstStrategy(request, APP_SHELL_CACHE));
        return;
    }

    // For all other requests, use network only
    event.respondWith(fetch(request));
});

/**
 * Cache-first strategy: Try cache first, fall back to network
 * Good for static assets that don't change often (ABC files, CDN resources)
 */
async function cacheFirstStrategy(request, cacheName) {
    try {
        // Try to get from cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // If not in cache, fetch from network and cache it
        const networkResponse = await fetch(request);

        // Only cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Cache-first strategy failed:', error);
        // Return a basic error response if everything fails
        return new Response('Offline - resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * Network-first strategy: Try network first, fall back to cache
 * Good for app shell files that may update but need offline support
 */
async function networkFirstStrategy(request, cacheName) {
    try {
        // Try network first
        const networkResponse = await fetch(request);

        // Cache the successful response
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        console.error('[Service Worker] Network-first strategy failed:', error);
        // Return error response if everything fails
        return new Response('Offline - resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_ABC_FILES') {
        // Cache all ABC files in background
        cacheAbcFiles(event.data.files);
    }

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/**
 * Cache all ABC files in background
 */
async function cacheAbcFiles(files) {
    if (!files || !Array.isArray(files)) {
        console.error('[Service Worker] Invalid files array for caching');
        return;
    }

    console.log(`[Service Worker] Starting to cache ${files.length} ABC files`);

    try {
        const cache = await caches.open(ABC_FILES_CACHE);
        let cached = 0;

        // Cache files in small batches to avoid overwhelming the browser
        const batchSize = 10;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const promises = batch.map(async (file) => {
                try {
                    const url = `/Recorder/abc/${file.file}`;
                    const response = await fetch(url);
                    if (response && response.status === 200) {
                        await cache.put(url, response);
                        cached++;

                        // Send progress update to clients
                        const clients = await self.clients.matchAll();
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'CACHE_PROGRESS',
                                cached: cached,
                                total: files.length
                            });
                        });
                    }
                } catch (error) {
                    console.warn(`[Service Worker] Failed to cache ${file.file}:`, error);
                }
            });

            await Promise.all(promises);
        }

        console.log(`[Service Worker] Cached ${cached}/${files.length} ABC files`);

        // Notify clients that caching is complete
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'CACHE_COMPLETE',
                cached: cached,
                total: files.length
            });
        });
    } catch (error) {
        console.error('[Service Worker] Error caching ABC files:', error);
    }
}
