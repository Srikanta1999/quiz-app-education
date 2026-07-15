/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

const CACHE_VERSION = 'quiz-app-v2';

clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.keys().then(cacheNames => Promise.all(cacheNames.map(cacheName => {
    if (cacheName !== CACHE_VERSION && cacheName !== `${CACHE_VERSION}-images`) {
      return caches.delete(cacheName);
    }
    return Promise.resolve();
  }))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(cacheNames.map(cacheName => {
      if (cacheName !== CACHE_VERSION && cacheName !== `${CACHE_VERSION}-images`) {
        return caches.delete(cacheName);
      }
      return Promise.resolve();
    }))).then(() => self.clients.claim())
  );
});

const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(({ request, url }) => {
  if (request.mode !== 'navigate') {
    return false;
  }

  if (url.pathname.startsWith('/_')) {
    return false;
  }

  if (url.pathname.match(fileExtensionRegexp)) {
    return false;
  }

  return true;
}, createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html'));

registerRoute(
  ({ url }) =>
    url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })]
  })
);

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then(cacheNames => Promise.all(cacheNames.map(cacheName => caches.delete(cacheName))))
    );
  }
});
