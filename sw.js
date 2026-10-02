/**
 * Service Worker for ABC Recorder App
 * Handles offline caching of app shell and ABC music files
 */

const CACHE_VERSION = 'abc-player-v3-2026-10-02-5';
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
// Not keyed by CACHE_VERSION: a deploy used to wipe every cached tune, so
// after each one all tunes were downloaded again and a tune the user opened
// waited on the network. Each entry now carries the content hash from
// abc-file-list.js instead, and only tunes whose hash changed are refetched.
const ABC_FILES_CACHE = 'abc-player-abc-files';
const ABC_HASH_HEADER = 'X-Abc-Hash';

// App shell files to cache on install
const APP_SHELL_FILES = [
    '/Recorder/index.html',
    '/Recorder/js/core/utils.js',
    '/Recorder/js/core/settings-manager.js',
    '/Recorder/js/core/offline-manager.js',
    '/Recorder/js/core/abc-player.js',
    '/Recorder/js/core/main.js',
    '/Recorder/js/core/version-checker.js',
    '/Recorder/js/core/share-manager.js',
    '/Recorder/js/core/github-sync.js',
    '/Recorder/js/core/back-guard.js',
    '/Recorder/js/notation/notation-parser.js',
    '/Recorder/js/notation/keysig-highlighter.js',
    '/Recorder/js/notation/render-manager.js',
    '/Recorder/js/notation/transpose-manager.js',
    '/Recorder/js/fingering/fingering-manager.js',
    '/Recorder/js/fingering/diagram-renderer.js',
    '/Recorder/js/playback/midi-player.js',
    '/Recorder/js/playback/seamless-looper.js',
    '/Recorder/js/playback/auto-scroll-manager.js',
    '/Recorder/js/playback/custom-metronome.js',
    '/Recorder/js/playback/tuning-manager.js',
    '/Recorder/js/files/file-manager.js',
    '/Recorder/js/files/tune-manager.js',
    '/Recorder/js/files/tune-navigation.js',
    '/Recorder/js/ui/theme-manager.js',
    '/Recorder/js/ui/ui-controls.js',
    '/Recorder/js/ui/mobile-ui.js',
    '/Recorder/js/ui/orientation-handler.js',
    '/Recorder/js/ui/swipe-handler.js',
    '/Recorder/js/data/abc-file-list.js',
    '/Recorder/js/data/regions.js',
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
                        // cache: 'reload' skips the browser's HTTP cache, which
                        // (GitHub Pages: max-age=600) would otherwise hand the
                        // new version the previous build's files
                        await cache.add(new Request(file, { cache: 'reload' }));
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

    // Handle ABC file requests (see abcFileStrategy)
    if (url.pathname.includes('/Recorder/abc/')) {
        event.respondWith(abcFileStrategy(event));
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
        // Try to get from cache first. Scope the lookup to this cache --
        // a bare caches.match() searches every cache in the origin, so a
        // stale cache that outlived a version bump could still answer.
        const cachedResponse = await caches.match(request, { cacheName });
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
 * Store a tune in the ABC cache under its plain URL, tagged with its hash
 * @param {Cache} cache
 * @param {string} key - URL without the ?v= query
 * @param {Response} response - A 200 network response
 * @param {string|null} hash - Content hash from abc-file-list.js
 */
async function putAbcFile(cache, key, response, hash) {
    const headers = new Headers(response.headers);
    if (hash) {
        headers.set(ABC_HASH_HEADER, hash);
    }
    const body = await response.blob();
    await cache.put(key, new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers
    }));
}

/**
 * ABC files: the app asks for abc/<file>?v=<hash>. When the cached copy has
 * that hash it is current, so it answers at once and the network is only
 * asked in the background (a tune saved from the phone through the GitHub
 * API changes without a new hash). Otherwise the copy is missing or stale
 * and this falls through to network-first with the cache as fallback.
 * @param {FetchEvent} event
 */
async function abcFileStrategy(event) {
    const url = new URL(event.request.url);
    const hash = url.searchParams.get('v');
    url.search = '';
    const key = url.href;

    const cache = await caches.open(ABC_FILES_CACHE);
    const cachedResponse = await cache.match(key);
    const cachedHash = cachedResponse?.headers.get(ABC_HASH_HEADER) ?? null;

    if (cachedResponse && (!hash || cachedHash === hash)) {
        event.waitUntil(
            fetch(key, { cache: 'no-cache' })
                .then((response) => response.status === 200
                    ? putAbcFile(cache, key, response, hash ?? cachedHash)
                    : null)
                .catch(() => null)
        );
        return cachedResponse;
    }

    const networkPromise = fetch(key, { cache: 'no-cache' })
        .then(async (response) => {
            if (response.status === 200) {
                await putAbcFile(cache, key, response.clone(), hash);
            }
            return response;
        })
        .catch(() => null);

    if (cachedResponse) {
        const timeout = new Promise((resolve) =>
            setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));
        return (await Promise.race([networkPromise, timeout])) || cachedResponse;
    }

    return (await networkPromise) || new Response('Offline - resource not available', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

/**
 * Network-first strategy: Try network first, fall back to cache
 * Good for app shell files that may update but need offline support.
 *
 * A slow network is not a failed one: on patchy mobile data the fetch can
 * hang for many seconds before erroring, and waiting for it made opening a
 * tune feel slow even though a cached copy was sitting right there. So when
 * a cached copy exists, the network only gets NETWORK_TIMEOUT_MS to answer;
 * after that the cache wins, and the late network response still refreshes
 * the cache for next time.
 */
const NETWORK_TIMEOUT_MS = 1000;

async function networkFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);

    // Fetch and store; resolves to null instead of throwing so it can race.
    // no-cache revalidates with the server (a cheap 304 when unchanged)
    // instead of trusting the browser's HTTP cache: GitHub Pages sends
    // max-age=600, so for ten minutes after a deploy a plain fetch returned
    // the old build and the "new version" banner reappeared after every
    // reload. Only default-mode requests are rewritten: explicit modes
    // (no-store, reload) already skip that cache, and navigations can't be
    // rebuilt with a RequestInit.
    const fresh = request.mode !== 'navigate' && request.cache === 'default'
        ? new Request(request, { cache: 'no-cache' })
        : request;
    const networkPromise = fetch(fresh)
        .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => null);

    // Scoped lookup -- see cacheFirstStrategy
    const cachedResponse = await cache.match(request);

    // A request that explicitly asks for a fresh copy (the version check
    // fetches main.js with no-store) must not lose the race to the cache:
    // the cached main.js is the running build, so on a slow network the
    // check always saw "latest" and the update banner never appeared.
    // Wait for the network; the cache is only the offline fallback.
    const wantsFresh = request.cache === 'no-store' || request.cache === 'reload';

    if (cachedResponse && wantsFresh) {
        return (await networkPromise) || cachedResponse;
    }

    if (cachedResponse) {
        const timeout = new Promise((resolve) =>
            setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));
        const networkResponse = await Promise.race([networkPromise, timeout]);
        return networkResponse || cachedResponse;
    }

    const networkResponse = await networkPromise;
    if (networkResponse) {
        return networkResponse;
    }

    console.error('[Service Worker] Network-first strategy failed:', request.url);
    return new Response('Offline - resource not available', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_ABC_FILES') {
        // Cache all ABC files in background
        event.waitUntil(cacheAbcFiles(event.data.files));
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
                    const url = new URL(`/Recorder/abc/${file.file}`, self.location.origin).href;

                    // Already cached with this content: skip it, so only
                    // tunes that changed since the last pass are downloaded
                    const cachedResponse = await cache.match(url);
                    if (cachedResponse && cachedResponse.headers.get(ABC_HASH_HEADER) === file.hash) {
                        cached++;
                        return;
                    }

                    const response = await fetch(url, { cache: 'no-cache' });
                    if (response && response.status === 200) {
                        await putAbcFile(cache, url, response, file.hash);
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

        // The cache outlives deploys, so drop tunes that were renamed or removed
        const listed = new Set(files.map(file =>
            new URL(`/Recorder/abc/${file.file}`, self.location.origin).href));
        for (const request of await cache.keys()) {
            if (!listed.has(request.url)) {
                await cache.delete(request);
            }
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
