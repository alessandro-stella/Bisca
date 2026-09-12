const CACHE_NAME = "app-cache-v-{{SERVER_VERSION}}";

const urlsToCache = [
  "/",
  "/index.html",
  "/game.html",
  "/lobbies.html",
  "/login.html",
  "/profile.html",
  "/register.html",
  "/reset.css",
  "/style.css",
  "/styles/game.css",
  "/styles/home.css",
  "/styles/lobbies.css",
  "/styles/login_register.css",
  "/styles/profile.css",
  "/scripts/game.js",
  "/scripts/lobbies.js",
  "/scripts/login.js",
  "/scripts/profile.js",
  "/scripts/register.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(
        `[Service Worker] Scarico tutti i file per la nuova versione: ${CACHE_NAME}`,
      );

      return Promise.all(
        urlsToCache.map((url) => {
          return fetch(new Request(url, { cache: "reload" })).then(
            (response) => {
              if (!response.ok) throw new Error(`Impossibile scaricare ${url}`);
              return cache.put(url, response);
            },
          );
        }),
      );
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(
                `[Service Worker] Elimino la vecchia cache: ${cacheName}`,
              );
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("socket.io")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== "basic"
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    }),
  );
});
