'use strict';
/* AIS Window Quote Decoder + QA — service worker.
   IMPORTANT: bump CACHE_VERSION every time app content changes so installed
   users get the "update available" prompt. Keep this in sync with APP_VERSION
   inside the main HTML file — they don't have to match exactly, they just both
   need to change together whenever you ship an update. */
const CACHE_VERSION = 'ais-qa-v4.2.0';
const SKIP_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const APP_SHELL = [
  './',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => {}))
      )
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (SKIP_HOSTS.some((h) => url.hostname.includes(h))) return;
  if (url.pathname.endsWith('.pdf')) return; // never cache the user's uploaded quotation PDFs

  // Network-first for the HTML shell so updates are picked up promptly;
  // cache-first for everything else (icons, manifest, fonts already fetched).
  const isHTML = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');

  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(e.request).then((cached) =>
          cached ||
          fetch(e.request).then((res) => {
            try { cache.put(e.request, res.clone()); } catch (_) {}
            return res;
          })
        )
      )
    );
  }
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
