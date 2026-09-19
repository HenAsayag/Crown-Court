/* CROWN COURT service worker - offline play + PWA install.
   Cache-first with a background refresh, so a new build is picked up
   on the next launch. */
const CACHE = "crowncourt-v8-round-balls";
const CORE = [
  "./", "./index.html", "./arena.css", "./art.js", "./hoop-art.js", "./game.js", "./mobile.js", "./manifest.webmanifest",
  "./webgl-renderer.js", "./webgl-scene.js",
  "./assets/obj/street-hoop.png",
  "./assets/atlas/ui.png", "./assets/atlas/collection.png", "./assets/atlas/effects.png", "./assets/atlas/courts.png",
  "./assets/obj/hoop.webp", "./assets/obj/ball.webp",
  "./assets/obj/ball-classic.webp", "./assets/obj/ball-gold.webp",
  "./assets/obj/ball-frost.webp", "./assets/obj/ball-void.webp", "./assets/obj/ball-lime.webp",
  "./assets/obj/crown.webp", "./assets/obj/crown-gold.webp",
  "./assets/obj/crown-silver.webp", "./assets/obj/crown-bronze.webp",
  "./assets/obj/trail-warm.webp", "./assets/obj/trail-red.webp", "./assets/obj/trail-smoke.webp",
  "./assets/obj/burst.webp", "./assets/obj/sparkle.webp", "./assets/obj/swoosh.webp",
  "./assets/court/sunset.webp", "./assets/court/night.webp", "./assets/court/noon.webp",
  "./assets/player/celebrate.webp", "./assets/player/dejected.webp",
  "./assets/player/dunk.webp", "./assets/player/idle.webp",
  "./assets/ui/crest.webp", "./assets/ui/coin.webp", "./assets/ui/heart.webp",
  "./assets/ui/pause.webp", "./assets/ui/trophy.webp",
  "./assets/ui/btn-red.webp", "./assets/ui/btn-white.webp", "./assets/ui/btn-dark.webp"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
