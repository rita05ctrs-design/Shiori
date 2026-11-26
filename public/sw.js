const STATIC_CACHE = "shiori-pwa-v3";
const IMAGE_CACHE = "shiori-media-img-v1";
const MAX_CACHED_IMAGES = 150;

const PRECACHE_ASSETS = [
  "/manifest.json",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/icon.svg",
];

const MEDIA_IMAGE_HOSTS = new Set([
  "s4.anilist.co",
  "img.anili.st",
  "media.kitsu.app",
  "cdn.myanimelist.net",
  "i.ytimg.com",
]);

async function trimImageCache() {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const keys = await cache.keys();
    if (keys.length > MAX_CACHED_IMAGES) {
      const excess = keys.length - MAX_CACHED_IMAGES;
      await Promise.all(keys.slice(0, excess).map((req) => cache.delete(req)));
    }
  } catch {
    // Non-fatal
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== IMAGE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Stale-while-revalidate cache for anime/manga cover art & banners (instant revisit + offline posters)
  if (MEDIA_IMAGE_HOSTS.has(url.hostname)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) {
              cache.put(request, res.clone()).then(() => trimImageCache()).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);

        return cached || networkPromise;
      })
    );
    return;
  }

  // Never intercept other cross-origin requests, API calls, or Next.js HMR dev streams
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/webpack-hmr")) {
    return;
  }

  // Static PWA assets: cache-first with network refresh
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Page navigations: network-first with graceful Shiori offline page fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline.html");
        return offline || new Response("Shiori est hors-ligne.", { status: 503 });
      })
    );
  }
});

// Focus or open the target anime / episodes route when the user clicks an episode reminder notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/episodes");

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
