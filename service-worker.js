// ═══════════════════════════════════════════════════════════════
// service-worker.js — Grace Ministry India PWA
// Handles offline caching and push notification display.
// ═══════════════════════════════════════════════════════════════

importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

const CACHE_NAME  = "grace-ministry-v3";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/firebase.js",
  "/admin.js",
  "/manifest.json",
  "/images/icon-192.png",
  "/images/icon-512.png",
  "/images/jesus-welcome.png"
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(SHELL_FILES).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH — Cache-first for shell, network-first for API ─────
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Pass through Firebase, API, YouTube, WhatsApp requests
  if (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebase") ||
    url.includes("anthropic.com") ||
    url.includes("bible-api.com") ||
    url.includes("youtube.com") ||
    url.includes("wa.me") ||
    url.includes("maps.google") ||
    url.includes("instagram.com") ||
    url.includes("gstatic.com")
  ) {
    return; // network only
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (event.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === "document") {
          return caches.match("/index.html");
        }
      });
    })
  );
});

// ── FIREBASE MESSAGING (background push) ────────────────────
// NOTE: Replace with your real Firebase config
try {
  firebase.initializeApp({
    apiKey: "AIzaSyB5OIl_LZ2DAc_eH1q_i0JVv4IuvtSC5Zg",
    authDomain: "grace-ministry-india.firebaseapp.com",
    projectId: "grace-ministry-india",
    storageBucket: "grace-ministry-india.firebasestorage.app",
    messagingSenderId: "1080421610164",
    appId: "1:1080421610164:web:af95ab487bdb17c019dde1"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    const n = payload.notification || {};
    self.registration.showNotification(n.title || "Grace Ministry India", {
      body:    n.body || "",
      icon:    "/images/icon-192.png",
      badge:   "/images/icon-192.png",
      vibrate: [200, 100, 200],
      data:    { url: payload.data?.url || "/" }
    });
  });
} catch (e) {
  // Firebase not configured — push disabled
}

// ── NOTIFICATION CLICK ───────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});