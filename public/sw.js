// Minimal service worker - enables PWA install prompt without offline caching
// CareSense AI requires live internet connection for all features

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// No fetch caching - app requires live APIs
self.addEventListener('fetch', () => {});
