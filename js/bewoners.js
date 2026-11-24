// Bewoners van het aquarium: lijst invullen en tellen of ze er nog allemaal zijn.
// AQB.tellen(sb)  → Promise<{ alles_er, resultaat } | null>   (null = gesloten zonder opslaan)
// AQB.lijst(sb)   → Promise<boolean>                          (true = lijst opgeslagen)
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const css = `
.aqb-ov{position:fixed;inset:0;z-index:45;display:grid;place-items:center;background:rgba(3,25,35,.7);padding:14px}
.aqb-box{width:min(560px,100%);max-height:92vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.aqb-box h2{margin:0 0 4px}
.aqb-rij{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
.aqb-rij:last-of-type{border-bottom:0}
.aqb-naam{flex:1;min-width:0}
.aqb-naam b{display:block;font-size:17px}
.aqb-tel{display:flex;align-items:center;gap:6px}
.aqb-tel button{width:44px;height:44px;border-radius:50%;border:0;background:var(--deep);color:#fff;font:800 22px Nunito,sans-serif;cursor:pointer}
.aqb-tel button:active{transform:scale(.9)}
.aqb-tel output{min-width:46px;text-align:center;font:800 22px Nunito,sans-serif}
.aqb-rij.goed output{color:var(--ok)}
.aqb-rij.goed .aqb-naam b::after{content:" ✓";color:var(--ok)}
.aqb-rij.meer output{color:var(--warn)}
.aqb-knoppen{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.aqb-knoppen .btn{flex:1}
.aqb-let{background:color-mix(in srgb,var(--warn) 18%,transparent);border-radius:12px;padding:10px 12px;margin-top:12px;font-weight:700}
.aqb-edit{display:grid;grid-template-columns:1fr 84px 44px;gap:8px;align-items:center;margin-bottom:8px}
.aqb-edit button{height:44px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--soft);font-size:20px;cursor:pointer}
.aqb-link{background:none;border:0;color:var(--soft);text-decoration:underline;font:inherit;font-size:14px;cursor:pointer;margin-top:12px;padding:6px 0}`;
  let styled = false;
  function overlay() {
    if (!styled) { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); styled = true; }
    const ov = document.createElement("div"); ov.className = "aqb-ov";
    ov.innerHTML = '<div class="aqb-box" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(ov);
    return { ov, box: ov.firstChild, close: () => ov.remove() };
  }

  async function laad(sb) {
    const { data, error } = await sb.from("aq_bewoners").select("*").order("sort").order("id");
    if (error) throw error;
    return data || [];
  }

  // ---------- Lijst invullen ----------
  function lijstScherm(sb, box, rijen, klaar) {
    let werk = rijen.map(r => ({ id: r.id, naam: r.naam, aantal: r.aantal }));
    if (!werk.length) werk.push({ naam: "", aantal: 1 });
    const weg = [];
    const teken = () => {
      box.innerHTML = `<h2>Wie zitten er in je aquarium?</h2>
        <p class="hint" style="font-size:15px;margin:0 0 12px">Schrijf op welke dieren erin zitten en hoeveel. Dan kun je straks bij het tellen zien of ze er nog allemaal zijn.</p>
        <div class="aqb-edit hint" style="margin-bottom:2px"><span>Soort</span><span>Aantal</span><span></span></div>
        ${werk.map((r, i) => `<div class="aqb-edit"><input data-n="${i}" value="${esc(r.naam)}" placeholder="bijv. Neontetra" maxlength="40" autocomplete="off">
          <input data-a="${i}" type="number" inputmode="numeric" min="0" max="999" value="${r.aantal}"><button type="button" data-weg="${i}" aria-label="Weghalen">×</button></div>`).join("")}
        <button class="btn ghost" type="button" data-plus>+ Soort toevoegen</button>
        <p class="late" data-fout style="font-weight:700;min-height:1em;margin:8px 0 0"></p>
        <div class="aqb-knoppen"><button class="btn ghost" type="button" data-terug>Annuleren</button><button class="btn" type="button" data-opslaan>Opslaan</button></div>`;
    };
    const lees = () => werk.forEach((r, i) => {
      r.naam = box.querySelector(`[data-n="${i}"]`).value.trim();
      r.aantal = Math.max(0, Math.min(999, parseInt(box.querySelector(`[data-a="${i}"]`).value, 10) || 0));
    });
    teken();
    box.onclick = async e => {
      const t = e.target;
      if (t.dataset.plus !== undefined) { lees(); werk.push({ naam: "", aantal: 1 }); teken(); box.querySelector(`[data-n="${werk.length - 1}"]`).focus(); }
      else if (t.dataset.weg !== undefined) { lees(); const [r] = werk.splice(+t.dataset.weg, 1); if (r.id) weg.push(r.id); teken(); }
      else if (t.dataset.terug !== undefined) klaar(false);
      else if (t.dataset.opslaan !== undefined) {
        lees();
        const fout = box.querySelector("[data-fout]");
        const goed = werk.filter(r => r.naam);
        if (!goed.length) { fout.textContent = "Vul minstens één soort in."; return; }
        const dubbel = goed.map(r => r.naam.toLowerCase()).find((n, i, a) => a.indexOf(n) !== i);
        if (dubbel) { fout.textContent = "Deze soort staat er twee keer in: " + dubbel; return; }
        t.disabled = true; t.textContent = "Bezig…";
        try {
          // Lege regels met een id tellen als weghalen
          for (const r of werk) if (!r.naam && r.id) weg.push(r.id);
          if (weg.length) { const { error } = await sb.from("aq_bewoners").delete().in("id", weg); if (error) throw error; }
          for (const [i, r] of goed.entries()) {
            const rij = { naam: r.naam, aantal: r.aantal, sort: i };
            const { error } = r.id ? await sb.from("aq_bewoners").update(rij).eq("id", r.id) : await sb.from("aq_bewoners").insert(rij);
            if (error) throw error;
          }
          klaar(true);
        } catch (err) {
          fout.textContent = "Opslaan lukte niet. Heb je internet?" + (err && err.message ? " (" + err.message + ")" : "");
          t.disabled = false; t.textContent = "Opslaan";
        }
      }
    };
  }

  // ---------- Tellen ----------
  function telScherm(sb, box, rijen, klaar, naarLijst) {
    const geteld = rijen.map(() => 0);
    let gewaarschuwd = false;
    const teken = () => {
      box.innerHTML = `<h2>Even kijken en tellen</h2>
        <p class="hint" style="font-size:15px;margin:0 0 6px">Tel de dieren en tik op <b>+</b> voor elke die je ziet. Kijk ook achter de planten en stenen!</p>
        ${rijen.map((r, i) => `<div class="aqb-rij" data-rij="${i}"><div class="aqb-naam"><b>${esc(r.naam)}</b><span class="hint">er horen er ${r.aantal} te zijn</span></div>
          <div class="aqb-tel"><button type="button" data-min="${i}" aria-label="Eén minder">−</button><output data-o="${i}">0</output><button type="button" data-plus="${i}" aria-label="Eén meer">+</button></div></div>`).join("")}
        <div data-let></div>
        <div class="aqb-knoppen"><button class="btn ghost" type="button" data-sluit>Sluiten</button><button class="btn" type="button" data-klaar>Klaar met tellen</button></div>
        <button class="aqb-link" type="button" data-lijst>Klopt de lijst niet meer? Pas hem aan</button>`;
      rijen.forEach((_, i) => zet(i));
    };
    const zet = i => {
      box.querySelector(`[data-o="${i}"]`).textContent = geteld[i];
      const rij = box.querySelector(`[data-rij="${i}"]`);
      rij.classList.toggle("goed", geteld[i] === rijen[i].aantal);
      rij.classList.toggle("meer", geteld[i] > rijen[i].aantal);
    };
    teken();
    box.onclick = async e => {
      const t = e.target;
      if (t.dataset.plus !== undefined) { const i = +t.dataset.plus; geteld[i] = Math.min(999, geteld[i] + 1); zet(i); gewaarschuwd = false; box.querySelector("[data-let]").innerHTML = ""; }
      else if (t.dataset.min !== undefined) { const i = +t.dataset.min; geteld[i] = Math.max(0, geteld[i] - 1); zet(i); gewaarschuwd = false; box.querySelector("[data-let]").innerHTML = ""; }
      else if (t.dataset.sluit !== undefined) klaar(null);
      else if (t.dataset.lijst !== undefined) naarLijst();
      else if (t.dataset.klaar !== undefined) {
        const resultaat = rijen.map((r, i) => ({ naam: r.naam, verwacht: r.aantal, geteld: geteld[i] }));
        const minder = resultaat.filter(r => r.geteld < r.verwacht), meer = resultaat.filter(r => r.geteld > r.verwacht);
        if ((minder.length || meer.length) && !gewaarschuwd) {
          gewaarschuwd = true;
          box.querySelector("[data-let]").innerHTML = `<div class="aqb-let">${
            minder.map(r => `Je mist er ${r.verwacht - r.geteld} van de ${esc(r.naam.toLowerCase())}.`).join("<br>")}${minder.length && meer.length ? "<br>" : ""}${
            meer.map(r => `Je telt ${r.geteld - r.verwacht} ${esc(r.naam.toLowerCase())} méér dan er horen. Jonkies?`).join("<br>")}
            <div class="hint" style="font-weight:400;font-size:14px;margin-top:6px">${minder.length ? "Kijk nog even goed, ze kunnen zich goed verstoppen. Zie je ze echt niet? Zeg het tegen papa. " : ""}Tik nog een keer op <b>Klaar met tellen</b> om het zo op te slaan.</div></div>`;
          box.querySelector("[data-let]").scrollIntoView({ behavior: "smooth", block: "nearest" });
          return;
        }
        t.disabled = true; t.textContent = "Bezig…";
        const alles_er = !minder.length;
        const { error } = await sb.from("aq_tellingen").insert({ resultaat, alles_er });
        if (error) { t.disabled = false; t.textContent = "Klaar met tellen"; box.querySelector("[data-let]").innerHTML = `<div class="aqb-let">Opslaan lukte niet. Heb je internet?</div>`; return; }
        klaar({ alles_er, resultaat });
      }
    };
  }

  async function tellen(sb) {
    const o = overlay();
    o.box.innerHTML = '<p class="empty">Laden…</p>';
    return new Promise(async klaar => {
      const stop = v => { o.close(); klaar(v); };
      let rijen;
      try { rijen = await laad(sb); } catch (e) { o.box.innerHTML = '<p class="late" style="font-weight:700">Laden lukte niet. Heb je internet?</p><div class="aqb-knoppen"><button class="btn" type="button">Sluiten</button></div>'; o.box.onclick = e => { if (e.target.closest("button")) stop(null); }; return; }
      const naarTellen = () => telScherm(sb, o.box, rijen.filter(r => r.aantal > 0), stop, naarLijst);
      const naarLijst = () => lijstScherm(sb, o.box, rijen, async opgeslagen => {
        if (opgeslagen) rijen = await laad(sb);
        if (!rijen.some(r => r.aantal > 0)) return stop(null);
        naarTellen();
      });
      if (!rijen.some(r => r.aantal > 0)) naarLijst(); else naarTellen();
    });
  }

  async function lijst(sb) {
    const o = overlay();
    o.box.innerHTML = '<p class="empty">Laden…</p>';
    let rijen = [];
    try { rijen = await laad(sb); } catch (e) {}
    return new Promise(klaar => lijstScherm(sb, o.box, rijen, v => { o.close(); klaar(v); }));
  }

  window.AQB = { tellen, lijst, laad };
})();
