const CACHE_NAME = "elohim-grains-shell-v3";
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
      event.respondWith(fetch(request).catch(() => new Response("Service unavailable", { status: 503, statusText: "Service Unavailable" })));
      return;
    }
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {}));
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match("/offline"))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && (request.destination === "image" || request.destination === "style" || request.destination === "script")) {
      try {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {}));
      } catch {}
    }
    return response;
  }).catch(() => new Response("Service unavailable", { status: 503, statusText: "Service Unavailable" }))));
});

// Push is intentionally passive until the backend has a VAPID provider and an
// explicit customer opt-in flow. Notification payloads must be transactional
// (order/subscription/price-alert) rather than unsolicited promotions.
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() }; }
  const title = payload.title || "Elohim Grains";
  const options = {
    body: payload.body || "You have a new Elohim update.",
    icon: "/pwa-icon.svg",
    badge: "/pwa-icon.svg",
    tag: payload.tag || "elohim-update",
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === destination);
    return existing ? existing.focus() : clients.openWindow(destination);
  }));
});
