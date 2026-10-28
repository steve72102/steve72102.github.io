'use strict';
const CACHE = 'mind-quest-v2-20261028-r2';
const ASSETS = ['./', './index.html', './style.css', './engine.js', './app.js', './combat.js', './combat-ui.js', './combat.css', './bank.js', './icon.svg', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()).catch(async error => { await caches.delete(CACHE); throw error; })));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mind-quest-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url), scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
});
