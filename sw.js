const CACHE_NAME = "frallan-v28";
const CORE_FILES = ["./", "./index.html", "./rapport.html", "./style.css", "./style.css?v=28", "./app.js", "./app.js?v=28", "./manifest.json", "./icons/icon-180.png", "./djur/kiwi-halloween.png", "./djur/kiwi-00.png", "./djur/kiwi-01.png", "./djur/kiwi-02.png", "./djur/kiwi-03.png", "./djur/kiwi-04.png", "./djur/kiwi-05.png", "./djur/kiwi-06.png", "./djur/kiwi-07.png", "./djur/kiwi-08.png", "./djur/kiwi-host-00.png", "./djur/kiwi-host-01.png", "./djur/kiwi-host-02.png", "./djur/kiwi-host-03.png", "./djur/kiwi-host-04.png", "./djur/kiwi-host-05.png", "./djur/kiwi-host-06.png", "./djur/kiwi-host-07.png", "./djur/kiwi-host-08.png", "./djur/kiwi-vinter-00.png", "./djur/kiwi-vinter-01.png", "./djur/kiwi-vinter-02.png", "./djur/kiwi-vinter-03.png", "./djur/kiwi-vinter-04.png", "./djur/kiwi-vinter-05.png", "./djur/kiwi-vinter-06.png", "./djur/kiwi-vinter-07.png", "./djur/kiwi-vinter-08.png", "./djur/rav-00.svg", "./djur/rav-01.svg", "./djur/rav-02.svg", "./djur/rav-03.svg", "./djur/rav-04.svg", "./djur/rav-05.svg", "./djur/rav-06.svg", "./djur/rav-07.svg", "./djur/rav-08.svg", "./djur/rav-09.svg", "./djur/rav-10.svg", "./djur/rav-11.svg", "./djur/rav-12.svg", "./djur/rav-13.svg", "./djur/rav-14.svg", "./djur/rav-15.svg", "./djur/rav-16.svg", "./djur/rav-17.svg", "./djur/rav-18.svg", "./djur/rav-19.svg"];

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
