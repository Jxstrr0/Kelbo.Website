/* ======================================================================
   OFFLINE HELPER (service worker)
   ----------------------------------------------------------------------
   main.js registers this file. It sits between the site and the
   internet and keeps a copy of every page and file you open, so the site
   still loads with no signal (on a plane, out at the lake).

   Online, it always asks the internet first, so new changes show up
   straight away like before. Only when that fails does it hand back the
   saved copy. The weather, air quality and aurora checks go straight to
   the internet as usual (they have their own short memory in main.js).

   It must stay in the site's top folder: it can only look after pages in
   its own folder and below. If it ever gets stuck, change CACHE below
   ("longlight-3") and the old copies are thrown away.
   ====================================================================== */
const CACHE = "longlight-2";

// Saved as soon as the helper is installed, so these work offline even
// if they haven't been opened yet.
const CORE = [
  "./",
  "index.html",
  "games.html",
  "game.html",
  "trading.html",
  "ai.html",
  "projects.html",
  "about.html",
  "whats-new.html",
  "journal.html",
  "agent-fleet.html",
  "404.html",
  "style.css",
  "main.js",
  "journal.css",
  "journal.js",
  "scan.js",
  "projects.json",
  "now.json",
  "journal.json",
  "options.json",
  "scan.json",
  "site.webmanifest",
  "assets/icon.svg",
  "assets/favicon.svg",
  "assets/icon-180.png",
  "assets/icon-192.png",
  "assets/fonts/space-grotesk-latin.woff2",
];

self.addEventListener("install", (event) => {
  // One missing file shouldn't stop the rest being saved.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // Throw away copies saved by an older version of this file.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // the contact form and the like go straight through
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // weather and other sites: not ours to save

  event.respondWith(
    fetch(request)
      .then((response) => keep(request, response))
      .catch(() =>
        // No signal: the saved copy (ignoring ?at= and ?v= on the end),
        // or the home page for a page that was never opened.
        caches.match(request, { ignoreSearch: true }).then((saved) => {
          if (saved) return saved;
          if (request.mode === "navigate") return caches.match("index.html");
          return Response.error();
        })
      )
  );
});

// Saves a good answer for later and passes it on.
function keep(request, response) {
  if (response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}
