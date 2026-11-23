// Service worker: app offline openen + pushmeldingen tonen
const CACHE = "aquarium-v15";
const SHELL = ["./", "index.html", "beheer.html", "css/app.css", "js/config.js", "js/logic.js", "js/anim.js", "js/jayden.js", "js/beheer.js",
  "manifest.webmanifest", "manifest-beheer.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/badge-96.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;   // Supabase e.d. altijd live
  // Eerst netwerk (zodat updates meteen binnenkomen), anders uit de cache
  e.respondWith(fetch(e.request).then(r => { if (r.status === 200) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});

self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: "Aquarium", body: e.data ? e.data.text() : "" }; }
  self.clients.matchAll({ type: "window" }).then(list => list.forEach(c => c.postMessage({ type: "aq-push" })));
  e.waitUntil(self.registration.showNotification(d.title || "Aquarium", {
    body: d.body || "", icon: "icons/icon-192.png", badge: "icons/badge-96.png", tag: d.tag, renotify: true,
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
