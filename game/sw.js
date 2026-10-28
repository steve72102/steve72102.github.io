'use strict';
const CACHE = 'mind-quest-v3-20261029-release3';
const ASSETS = ['./', './index.html', './style.css', './engine.js', './app.js', './combat.js', './combat-ui.js', './combat.css', './bank.js', './icon.svg', './manifest.webmanifest', './duel.js', './duel-network.js', './duel-ui.js', './duel.css', './vendor/peerjs.min.js', './academy.js', './academy-ui.js', './academy.css', './daylight.css', './lesson.js', ...['campus-taiwan','hall-ntu','hall-nthu','hall-ncku','doctor-inspired','professor-inspired','graduate-inspired','researcher-inspired','beaker','flask','cylinder','mortar'].map(id => './assets/academy/'+id+'.webp')];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, {cache:'reload'})))).then(() => self.skipWaiting()).catch(async error => { await caches.delete(CACHE); throw error; })));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mind-quest-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url), scope = new URL(self.registration.scope);
  // Development preview reads current files; the published site keeps its offline cache.
  if (scope.hostname === '127.0.0.1' || scope.hostname === 'localhost') return;
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
});

