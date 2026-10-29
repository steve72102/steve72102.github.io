'use strict';
const CACHE = 'mind-quest-v3-20261029-living-world';
const ASSETS = ['./adventure.js','./adventure-ui.js','./adventure.css','./lobby.js','./lobby-network.js','./lobby-ui.js','./assets/academy/living-trees.webp','./assets/academy/doctor-run.webp','./assets/academy/professor-run.webp','./assets/academy/graduate-run.webp','./assets/academy/researcher-run.webp','./assets/academy/cedar-dean-run.webp','./assets/academy/herbal-mentor-run.webp','./assets/academy/lab-engineer-run.webp','./assets/academy/balance-analyst-run.webp','./assets/academy/dawn-intern-run.webp','./assets/academy/river-fellow-run.webp','./', './index.html', './style.css', './engine.js', './app.js', './combat.js', './combat-ui.js', './combat.css', './bank.js', './icon.svg', './manifest.webmanifest', './duel.js', './duel-network.js', './duel-ui.js', './duel.css', './vendor/peerjs.min.js', './campus-walk.js', './campus-walk-ui.js', './campus-walk.css', './academy.js', './academy-ui.js', './academy.css', './daylight.css', './lesson.js', './journey.js', './journey.css', './cloud.js', './firebase-config.js', './account-ui.js', ...['campus-taiwan','hall-ntu','hall-nthu','hall-ncku','doctor-portrait','professor-portrait','graduate-portrait','researcher-portrait','cedar-dean-portrait','herbal-mentor-portrait','lab-engineer-portrait','balance-analyst-portrait','dawn-intern-portrait','river-fellow-portrait','beaker','flask','cylinder','mortar'].map(id => './assets/academy/'+id+'.webp')];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, {cache:'reload'})))).then(() => self.skipWaiting()).catch(async error => { await caches.delete(CACHE); throw error; })));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mind-quest-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url), scope = new URL(self.registration.scope);
  // Development preview reads current files; the published site keeps its offline cache.
  if (scope.hostname === '127.0.0.1' || scope.hostname === 'localhost') return;
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
});

