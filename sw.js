// Service Worker for ABC Player

const CACHE_NAME = 'abc-player-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/main.css',
    '/js/abc-player.js',
    // Add other essential files here
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});