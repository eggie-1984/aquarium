// Service worker: app offline openen + pushmeldingen tonen + updatemelding
//
// NIEUWE VERSIE UITBRENGEN: verhoog VERSIE hieronder én "versie" in versie.json.
// De app laat dan onderin "Nieuwe versie beschikbaar" zien met een knop Bijwerken.
const VERSIE = "2.0";
const CACHE = "aquarium-" + VERSIE;
const SHELL = ["./", "index.html", "beheer.html", "update.js", "css/app.css", "js/config.js", "js/logic.js", "js/anim.js", "js/jayden.js", "js/beheer.js",
  "manifest.webmanifest", "manifest-beheer.webmanifest", "icons/goudvis-192.png", "icons/goudvis-512.png", "icons/badge-96.png"];
const SHELL_URLS = new Set(SHELL.map(p => new URL(p, self.registration.scope).href));

// Nieuwe versie alvast ophalen, maar pas overnemen als er op "Bijwerken" getikt wordt
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(p => new Request(p, { cache: "reload" })))));
});
self.addEventListener("message", e => {
  if (!e.data) return;
  if (e.data.type === "SKIP_WAITING") self.skipWaiting();
  if (e.data.type === "GET_VERSION" && e.ports[0]) e.ports[0].postMessage(VERSIE);
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // Supabase e.d. altijd live
  if (url.pathname.endsWith("/versie.json")) return;                    // altijd vers van GitHub
  if (req.headers.has("range")) return;                                 // video's laten streamen

  // App-bestanden (html, js, css): uit de cache van déze versie, zodat alles bij elkaar past
  const key = url.origin + url.pathname;
  if (SHELL_URLS.has(key)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(key)).then(hit => hit || fetch(req)));
    return;
  }

  // Overige bestanden (plaatjes, video's, geluid): eerst netwerk, anders uit de cache
  e.respondWith(fetch(req).then(r => { if (r.status === 200) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return r; })
    .catch(() => caches.match(req, { ignoreSearch: true })));
});

self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: "Aquarium", body: e.data ? e.data.text() : "" }; }
  self.clients.matchAll({ type: "window" }).then(list => list.forEach(c => c.postMessage({ type: "aq-push" })));
  e.waitUntil(self.registration.showNotification(d.title || "Aquarium", {
    body: d.body || "", icon: "icons/goudvis-192.png", badge: "icons/badge-96.png", tag: d.tag, renotify: true,
    data: { url: d.url || "./" }, vibrate: [120, 60, 120]
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const same = list.find(c => c.url.split("#")[0] === url.split("#")[0]);
    if (same) { same.navigate(url).catch(() => {}); return same.focus(); }
    return self.clients.openWindow(url);
  }));
});
