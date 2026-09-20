const CACHE_NAME = "elohim-grains-shell-v2";
const SHELL = ["/", "/products", "/offline", "/pwa-icon.svg", "/logo.png"];
const isPublicNavigation = (url) =>
  url.pathname === "/" ||
  url.pathname === "/products" ||
  url.pathname.startsWith("/products/") ||
  url.pathname === "/offline" ||
  url.pathname === "/policies" ||
  url.pathname.startsWith("/policies/");

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Financial APIs are hosted separately and therefore never enter this cache.
  // Keep all authenticated/account routes network-only even when they are
  // same-origin, so a device cache never stores wallet, BNPL, KYC or order data.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    if (!isPublicNavigation(url)) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); return response; }).catch(() => caches.match(request).then((cached) => cached || caches.match("/offline"))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok && (request.destination === "image" || request.destination === "style" || request.destination === "script")) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())); return response; })));
});
