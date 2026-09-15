const CACHE_NAME = "frallan-v3";
const CORE_FILES = ["./", "./index.html", "./rapport.html", "./style.css", "./app.js", "./manifest.json", "./icons/icon-180.png", "./djur/kiwi-00.svg", "./djur/kiwi-01.svg", "./djur/kiwi-02.svg", "./djur/kiwi-03.svg", "./djur/kiwi-04.svg", "./djur/kiwi-05.svg", "./djur/kiwi-06.svg", "./djur/kiwi-07.svg", "./djur/kiwi-08.svg", "./djur/kiwi-09.svg", "./djur/kiwi-10.svg", "./djur/kiwi-11.svg", "./djur/kiwi-12.svg", "./djur/kiwi-13.svg", "./djur/kiwi-14.svg", "./djur/kiwi-15.svg", "./djur/kiwi-16.svg", "./djur/kiwi-17.svg", "./djur/kiwi-18.svg", "./djur/kiwi-19.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Nätverk först, så nya versioner alltid når enheten direkt vid uppkoppling.
// Cachen är bara en offline-reserv.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
