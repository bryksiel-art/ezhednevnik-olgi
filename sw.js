// v2: resilient app-shell pre-cache, fresh-network fallback and offline navigation.
const CACHE = 'olga-planner-shell-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest'];
const OPTIONAL = ['./icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png', './voice-192.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.add(new Request('./index.html', {cache:'reload'}));
    await Promise.allSettled([...SHELL.filter(p => p !== './index.html'), ...OPTIONAL].map(p => cache.add(p)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('olga-planner-shell-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request, {cache:'no-store'});
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      const saved = await caches.match(request, { ignoreSearch: true });
      if (saved) return saved;
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
        return new Response('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Нет сети</title><body><h1>Нет подключения</h1><p>Откройте ежедневник с интернетом один раз для установки офлайн-режима.</p></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return new Response('Нет подключения', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});