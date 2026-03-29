const CACHE_NAME = "kpai-family-v2";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/favicon/android-chrome-192x192.png",
  "/favicon/android-chrome-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const reqUrl = new URL(event.request.url);
  if (
    reqUrl.pathname === "/favicon.ico" ||
    reqUrl.pathname.startsWith("/favicon/") ||
    reqUrl.pathname === "/apple-touch-icon.png"
  )
    return;

  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("supabase") ||
    event.request.url.includes("r2.cloudflarestorage")
  )
    return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
