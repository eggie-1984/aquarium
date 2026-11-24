// Updatemelding: laat onderin "Nieuwe versie beschikbaar" zien als er een nieuwe versie op GitHub staat.
// De service worker zelf wordt geregistreerd in js/logic.js (AQ.registerSW).
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  const CHECK_ELK = 30 * 60 * 1000; // elk half uur kijken
  let reg = null, herladen = false, geklikt = false;

  const css = `
    #update-balk{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:99999;
      display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;background:#12385c;color:#fff;
      box-shadow:0 8px 28px rgba(0,0,0,.3);transform:translateY(160%);transition:transform .35s ease;max-width:560px;margin:0 auto}
    #update-balk.zichtbaar{transform:translateY(0)}
    #update-balk .vis{font-size:26px;line-height:1}
    #update-balk .tekst{flex:1;min-width:0}
    #update-balk .titel{font-weight:700}
    #update-balk .nieuw{opacity:.85;font-size:13px;margin-top:2px}
    #update-balk button{border:0;border-radius:99px;padding:9px 14px;font:inherit;font-weight:700;cursor:pointer}
    #update-balk .bijwerken{background:#ffb347;color:#3a2000}
    #update-balk .later{background:transparent;color:#fff;opacity:.75;padding:9px 4px}`;

  function toonBalk(worker) {
    let balk = document.getElementById("update-balk");
    if (balk) { balk._worker = worker; balk.classList.add("zichtbaar"); return; }
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    balk = document.createElement("div");
    balk.id = "update-balk"; balk.setAttribute("role", "status"); balk._worker = worker;
    balk.innerHTML = '<span class="vis">🐠</span><div class="tekst"><div class="titel">Nieuwe versie beschikbaar</div><div class="nieuw"></div></div>' +
      '<button class="later" type="button">Later</button><button class="bijwerken" type="button">Bijwerken</button>';
    document.body.appendChild(balk);

    fetch("versie.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(info => {
      if (!info) return;
      if (info.versie) balk.querySelector(".titel").textContent = "Nieuwe versie beschikbaar (" + info.versie + ")";
      if (info.nieuw) balk.querySelector(".nieuw").textContent = info.nieuw;
    }).catch(() => {});

    balk.querySelector(".bijwerken").addEventListener("click", () => {
      geklikt = true;
      balk.querySelector(".bijwerken").textContent = "Bezig…";
      balk._worker.postMessage({ type: "SKIP_WAITING" });
      setTimeout(() => location.reload(), 4000); // vangnet
    });
    balk.querySelector(".later").addEventListener("click", () => balk.classList.remove("zichtbaar"));
    requestAnimationFrame(() => requestAnimationFrame(() => balk.classList.add("zichtbaar")));
  }

  function volg(worker) {
    if (!worker) return;
    const kijk = () => { if (worker.state === "installed" && navigator.serviceWorker.controller) toonBalk(worker); };
    kijk(); worker.addEventListener("statechange", kijk);
  }

  // Na "Bijwerken" neemt de nieuwe versie het over: één keer herladen
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!geklikt || herladen) return; herladen = true; location.reload();
  });

  function toonVersie() {
    const plek = document.getElementById("app-versie");
    const sw = navigator.serviceWorker.controller;
    if (!plek || !sw) return;
    const kanaal = new MessageChannel();
    kanaal.port1.onmessage = e => { plek.textContent = "Versie " + e.data; };
    sw.postMessage({ type: "GET_VERSION" }, [kanaal.port2]);
  }

  // Zelf ook registreren (zelfde bestand, dus geen dubbele service worker), voor het geval logic.js het niet doet
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});

  navigator.serviceWorker.ready.then(r => {
    reg = r;
    if (reg.waiting) volg(reg.waiting);
    volg(reg.installing);
    reg.addEventListener("updatefound", () => volg(reg.installing));
    reg.update().catch(() => {});
    setInterval(() => reg.update().catch(() => {}), CHECK_ELK);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
    });
    toonVersie();
  });
  navigator.serviceWorker.addEventListener("controllerchange", toonVersie);
})();
