// =========================
// NOOK — SERVICE WORKER
// Handgeschrieben, kein Workbox/Build-Step — passend zur bestehenden
// No-Bundler-Philosophie von Nook (siehe CLAUDE.md).
//
// Strategie:
//   - App-Shell (/, index.html, manifest.json, Icons) wird bei der
//     Installation fest vorgeladen.
//   - Code (js/css/html/json) ist network-first mit Cache-Fallback: online
//     immer die aktuelle Datei, offline die zuletzt gesehene. Früher war
//     auch Code cache-first — nach jedem Deploy lief dann ein paar Ladevor-
//     gänge lang eine Mischung aus alten und neuen Dateien (neue index.html
//     + noch nie gecachte neue Dateien, aber alte main.js/css aus dem
//     Cache), was z.B. eigene Themes beim Neuladen verschwinden ließ.
//   - Übrige Same-Origin-Anfragen (Bilder, Schriften, Audio …) bleiben
//     "cache-first, im Hintergrund aktualisiert" — groß, ändern sich selten.
//     Beides ohne hartcodiertes Datei-Verzeichnis (Nook wächst laufend).
//   - Navigationsanfragen (HTML) sind network-first mit Cache-Fallback,
//     damit online immer die neueste Version geladen wird, offline aber
//     trotzdem etwas angezeigt werden kann.
//   - Die Wetter-API (Open-Meteo, today.js) ist network-first mit
//     Cache-Fallback, damit offline zumindest der letzte bekannte
//     Wetterstand erscheint statt eines Fehlers.
//
// WICHTIG: Diese Datei selbst darf serverseitig nicht langlebig gecacht
// werden (siehe _headers in Phase 3), sonst kommen Updates nie an.
// =========================

const CACHE_VERSION = "nook-v5";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const WEATHER_CACHE = `${CACHE_VERSION}-weather`;

const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
];

const CODE_EXTENSIONS = /\.(js|css|html|json|md)$/i;

const WEATHER_HOSTS = ["api.open-meteo.com", "geocoding-api.open-meteo.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("nook-") && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Wetter-API: network-first, letzter bekannter Stand als Fallback.
  if (WEATHER_HOSTS.includes(url.hostname)) {
    event.respondWith(networkFirst(request, WEATHER_CACHE));
    return;
  }

  // Fremde Origins (Google Fonts etc.) unangetastet lassen — der Browser
  // cacht sie ohnehin nach den üblichen HTTP-Regeln.
  if (url.origin !== self.location.origin) return;

  // Navigation (HTML-Aufruf, z.B. Adressleiste/App-Start): network-first,
  // damit online immer die aktuelle Version kommt.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/index.html"));
    return;
  }

  // Code: network-first, damit nie alte und neue Dateien gemischt laufen.
  if (CODE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // Alles andere Same-Origin (Bilder, Schriften …): cache-first,
  // Hintergrund-Aktualisierung für den nächsten Aufruf.
  event.respondWith(cacheFirst(request, RUNTIME_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await networkFetch) || Response.error();
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = (await cache.match(request)) || (fallbackUrl && (await cache.match(fallbackUrl)));
    if (cached) return cached;
    return Response.error();
  }
}
