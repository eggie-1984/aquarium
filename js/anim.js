// Beloningsanimaties met de goudvis. Elke taak heeft een eigen scène.
// AQAnim.play(scene, { title, sub }) → Promise (opgelost bij sluiten)
// AQAnim.sceneFor(task) kiest de scène bij een taak.
(function () {
  // Een scène = reeks beelden. d = seconden in beeld, z = zoom van/naar, o = waar naartoe gezoomd wordt,
  // fx: "chomp" (hapbewegingen), "pop" (duim-sprongetje), "work" (bezig: klein wiebeltje)
  const thumb = { src: "img/vis4.webp", d: 1.6, z: [1, 1], o: "88% 62%", fx: "pop" };
  // Taken met een eigen filmpje (eindigt met een duim). Bij "minder beweging" of als de video niet laadt: het duim-plaatje.
  const film = (name, label) => ({ label, video: `vid/${name}.mp4`, poster: `vid/${name}-start.webp`, still: `vid/${name}-duim.webp`, dur: 5.15 });
  const SCENES = {
    vis: { label: "Goudvis eet voer", hap: 2.05, frames: [
      { src: "img/vis1.webp", d: 1.75, z: [1.04, 1.14], o: "70% 40%", tx: [-4, 1] },
      { src: "img/vis2.webp", d: 1.35, z: [1.08, 1.1], o: "85% 42%", fx: "chomp" },
      { src: "img/vis3.webp", d: 1.15, z: [1.02, 1.08], o: "55% 50%" }, thumb] },
    garnalen: film("garnalen", "Garnalen voeren"),
    kijken: film("kijken", "Even kijken en tellen"),
    test: film("test", "Water testen"),
    verversen: film("verversen", "Water verversen"),
    ruiten: film("ruiten", "Ruiten schoonmaken"),
    bodem: film("bodem", "Bodem afzuigen"),
    planten: film("planten", "Planten bijknippen"),
    filter: film("filter", "Filterspons uitspoelen"),
    voorraad: film("voorraad", "Voorraad checken"),
    duim: { label: "Alleen een duim", frames: [{ src: "img/vis3.webp", d: 1.1, z: [1.02, 1.08], o: "55% 50%" }, thumb] }
  };
  const LEGACY = { garnaal: "garnalen" };
  function sceneFor(t) {
    const a = t && t.anim;
    if (a && SCENES[a] && a !== "duim") return a;
    if (t && SCENES[t.id]) return t.id;          // standaardtaken hebben hun eigen plaatje
    return LEGACY[a] || (SCENES[a] ? a : "duim");
  }

  const css = `
.aq-ov{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(3,25,35,.78);padding:14px;animation:aqFade .3s both}
.aq-box{width:min(94vw,540px);border-radius:26px;overflow:hidden;background:#063447;box-shadow:0 24px 70px rgba(0,0,0,.5);text-align:center;color:#fff}
.aq-stage{position:relative;aspect-ratio:3/2;overflow:hidden;background:#0d5f7a}
.aq-bob{position:absolute;inset:0;animation:aqBob 2.4s ease-in-out infinite alternate}
.aq-l{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;animation-timing-function:linear;animation-fill-mode:both}
.aq-v{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#0d5f7a}
.aq-msg.aq-wait{opacity:0;animation:none}
.aq-hap{position:absolute;left:79%;top:14%;font:600 clamp(22px,6vw,32px)/1 Fredoka,Nunito,sans-serif;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.45);opacity:0;animation:aqHap .8s both}
.aq-crumb{position:absolute;left:84%;top:40%;width:7px;height:7px;border-radius:50%;background:#7a4a22;opacity:0;animation:aqCrumb .9s ease-out both}
.aq-spark{position:absolute;width:26px;height:26px;opacity:0;animation:aqSpark 1.1s both}
.aq-spark svg{width:100%;height:100%;display:block}
.aq-b{position:absolute;bottom:-20px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.95),rgba(255,255,255,.25) 45%,rgba(255,255,255,.08) 70%);border:1px solid rgba(255,255,255,.5);animation:aqRise linear infinite}
.aq-msg{padding:14px 18px 18px;opacity:0;animation:aqPop .5s cubic-bezier(.3,1.6,.5,1) both}
.aq-msg h2{font:600 30px/1.1 Fredoka,Nunito,sans-serif;margin:0}
.aq-msg p{margin:6px 0 12px;color:#bfe3ec;font-size:17px}
.aq-msg button{font:700 17px Nunito,sans-serif;min-height:46px;padding:10px 30px;border:0;border-radius:14px;background:#ff6b4a;color:#fff;cursor:pointer}
@keyframes aqFade{from{opacity:0}}
@keyframes aqBob{from{transform:translateY(-1.2%)}to{transform:translateY(1.2%)}}
@keyframes aqHap{0%{opacity:0;transform:scale(.3)}25%{opacity:1;transform:scale(1.2)}60%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-20px)}}
@keyframes aqCrumb{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--x),var(--y))}}
@keyframes aqSpark{0%{opacity:0;transform:scale(0) rotate(0)}40%{opacity:1;transform:scale(1.3) rotate(45deg)}100%{opacity:.9;transform:scale(1) rotate(80deg)}}
@keyframes aqRise{from{transform:translate(0,0)}50%{transform:translate(6px,-200px)}to{transform:translate(-4px,-420px);opacity:.2}}
@keyframes aqPop{from{opacity:0;transform:translateY(16px) scale(.9)}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.aq-b,.aq-bob{animation:none!important}}`;

  const star = '<svg viewBox="-14 -14 28 28"><path d="M0-14 4-4 14 0 4 4 0 14-4 4-14 0-4-4Z" fill="#ffe27a"/></svg>';
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let uid = 0;

  // Bouwt per beeld eigen keyframes: in- en uitfaden, zoomen en het effect
  function build(sc) {
    const fr = reduce() ? [sc.frames[sc.frames.length - 1]] : sc.frames;
    const F = .3, T = fr.reduce((s, f) => s + f.d, 0) + F;
    const pct = s => Math.max(0, Math.min(100, s / T * 100)).toFixed(2) + "%";
    let t = 0, keys = "", imgs = "";
    fr.forEach((f, i) => {
      const id = `aqk${uid}_${i}`, a = t, b = t + f.d, last = i === fr.length - 1;
      const s = (z, dx = 0) => `scale(${z}) translateX(${dx}%)`;
      const z0 = f.z[0], z1 = f.z[1], tx = f.tx || [0, 0];
      let k = `0%{opacity:${i ? 0 : 1};transform:${s(z0, tx[0])}}`;
      if (i) k += `${pct(a - F)}{opacity:0;transform:${s(z0, tx[0])}}${pct(a)}{opacity:1}`;
      if (f.fx === "chomp") [[.35, .05], [.5, -.02], [.65, .04], [.8, -.02]].forEach(([p, e]) => k += `${pct(a + f.d * p)}{transform:scale(${(z0 + e).toFixed(3)})}`);
      if (f.fx === "pop") k += `${pct(a)}{transform:scale(${z0 * 1.12})}${pct(a + .25)}{transform:scale(${z0 * .97})}${pct(a + .45)}{transform:scale(${z0 * 1.02})}${pct(a + .6)}{transform:${s(z1)}}`;
      if (f.fx === "work") [.2, .4, .6, .8].forEach((p, j) => k += `${pct(a + f.d * p)}{transform:scale(${(z0 + (z1 - z0) * p).toFixed(3)}) rotate(${j % 2 ? -.8 : .8}deg)}`);
      k += last ? `100%{opacity:1;transform:${s(z1, tx[1])}}` : `${pct(b)}{opacity:1;transform:${s(z1, tx[1])}}${pct(b + F)}{opacity:0}100%{opacity:0}`;
      keys += `@keyframes ${id}{${k}}`;
      imgs += `<img class="aq-l" src="${f.src}" alt="" style="transform-origin:${f.o};animation-name:${id};animation-duration:${T}s">`;
      t = b;
    });
    uid++;
    const end = Math.max(0, t - fr[fr.length - 1].d) + .35;     // moment dat de duim verschijnt
    return { keys, imgs, end, T, hap: fr.length > 1 ? sc.hap : null };
  }

  function stage(sc) {
    if (sc.video) {
      const still = reduce();
      const end = still ? .2 : sc.dur - .45;
      const sparks = [[70, 8, 0], [94, 30, .15], [62, 70, .3]].map(([l, tp, dl]) =>
        `<span class="aq-spark" style="left:${l}%;top:${tp}%;animation-delay:${end + dl}s">${star}</span>`).join("");
      const media = still ? `<img class="aq-v" src="${sc.still}" alt="">`
        : `<video class="aq-v" src="${sc.video}" poster="${sc.poster}" muted playsinline autoplay preload="auto" disablepictureinpicture></video>`;
      return { html: `<div class="aq-stage">${media}${still ? sparks : ""}</div>`, B: { end, T: sc.dur, video: !still, sparks } };
    }
    const B = build(sc);
    const crumbs = B.hap ? [[38, -46], [62, -18], [50, 26], [24, -64], [70, 8]].map(([x, y], i) =>
      `<span class="aq-crumb" style="--x:${x}px;--y:${y}px;animation-delay:${B.hap + .05 + i * .04}s"></span>`).join("") + `<span class="aq-hap" style="animation-delay:${B.hap}s">Hap!</span>` : "";
    const bubbles = [[8, 10, 3.6, 0], [18, 6, 4.4, 1.2], [64, 12, 3.9, .5], [72, 7, 5, 2], [90, 9, 4.2, 1.6], [40, 5, 4.8, 2.6]].map(([l, s, d, dl]) =>
      `<span class="aq-b" style="left:${l}%;width:${s}px;height:${s}px;animation-duration:${d}s;animation-delay:-${dl}s"></span>`).join("");
    const sparks = [[70, 8, 0], [94, 30, .15], [62, 70, .3]].map(([l, tp, dl]) =>
      `<span class="aq-spark" style="left:${l}%;top:${tp}%;animation-delay:${B.end + dl}s">${star}</span>`).join("");
    return { html: `<style>${B.keys}</style><div class="aq-stage"><div class="aq-bob">${B.imgs}</div>${crumbs}${bubbles}${sparks}</div>`, B };
  }

  let styled = false;
  const loaded = new Set();
  function preload(names) {
    for (const n of names || Object.keys(SCENES)) {
      const sc = SCENES[n] || { frames: [] };
      if (sc.video) { for (const u of [sc.poster, sc.still]) if (!loaded.has(u)) { loaded.add(u); new Image().src = u; } continue; }
      for (const f of sc.frames) {
      if (loaded.has(f.src)) continue; loaded.add(f.src); const i = new Image(); i.src = f.src;
      }
    }
  }
  function play(name = "duim", { title = "Duim omhoog!", sub = "Goed gedaan!" } = {}) {
    if (!styled) { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); styled = true; }
    const sc = SCENES[name] || SCENES[LEGACY[name]] || SCENES.duim;
    return new Promise(resolve => {
      const { html, B } = stage(sc);
      const ov = document.createElement("div");
      ov.className = "aq-ov";
      ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", title);
      const msgStyle = B.video ? "" : ` style="animation-delay:${B.end + .1}s"`;
      ov.innerHTML = `<div class="aq-box">${html}<div class="aq-msg${B.video ? " aq-wait" : ""}"${msgStyle}><h2></h2><p></p><button type="button">Verder</button></div></div>`;
      ov.querySelector("h2").textContent = title; ov.querySelector("p").textContent = sub;
      document.body.appendChild(ov);
      const start = Date.now(); let closed = false, timer = 0;
      const close = () => { if (closed) return; closed = true; clearTimeout(timer); ov.remove(); resolve(); };
      ov.addEventListener("click", e => { if (e.target.closest("button") || Date.now() - start > 1500) close(); });
      if (B.video) {
        // Bericht en sterretjes pas tonen als de vis zijn duim geeft (einde filmpje)
        const v = ov.querySelector("video"), msg = ov.querySelector(".aq-msg");
        let shown = false;
        const show = () => {
          if (shown || closed) return; shown = true;
          ov.querySelector(".aq-stage").insertAdjacentHTML("beforeend", B.sparks.replace(/animation-delay:[\d.]+s/g, m => `animation-delay:${(parseFloat(m.slice(16)) - B.end).toFixed(2)}s`));
          msg.classList.remove("aq-wait"); msg.style.animationDelay = ".1s";
          clearTimeout(timer); timer = setTimeout(close, 4500);
          setTimeout(() => msg.querySelector("button")?.focus(), 400);
        };
        let failed = false;
        const fail = () => { if (failed) return; failed = true; v.replaceWith(Object.assign(new Image(), { className: "aq-v", src: sc.still, alt: "" })); show(); };
        v.addEventListener("timeupdate", () => { if (v.duration && v.currentTime >= v.duration - .45) show(); });
        v.addEventListener("ended", show);
        v.addEventListener("error", fail);
        const p = v.play(); if (p && p.catch) p.catch(fail);   // autoplay geweigerd → duim-plaatje
        timer = setTimeout(show, 9000);                           // vangnet bij trage verbinding
      } else {
        timer = setTimeout(close, (B.T + 3.5) * 1000);
        setTimeout(() => ov.querySelector("button")?.focus(), 400);
      }
    });
  }
  window.AQAnim = { play, preload, sceneFor, SCENES };
})();
