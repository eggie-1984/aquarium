// Beheerpagina: overzicht, taken aanpassen, metingen, logboek, instellingen
{
const $ = s => document.querySelector(s);
const sb = AQ.client();
const B = { settings: {}, tasks: [], comps: [], meas: [] };

const tt = t => String(t || "").slice(0, 5);

function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 2800); }
// Knoppen met data-confirm vragen eerst "Zeker?"
function armed(btn) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = "Zeker?";
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; }, 3000);
  return false;
}

// ---------- Inloggen ----------
async function start() {
  if (!sb) { $("#cfg").hidden = false; return; }
  const { data } = await sb.auth.getSession();
  if (!data.session) return showLogin();
  const { data: ok } = await sb.rpc("aq_is_admin");
  if (!ok) { await sb.auth.signOut(); showLogin("Dit account is geen beheerder van het aquarium. Zie de README, stap 2."); return; }
  $("#login").hidden = true; $("#nav").hidden = false; $("#who").textContent = "Ingelogd als " + data.session.user.email;
  route(); await load(); pushUI();
}
function showLogin(msg) {
  $("#login").hidden = false; $("#nav").hidden = true; $("#l-err").textContent = msg || "";
  document.querySelectorAll("main section").forEach(s => s.classList.remove("on"));
}
$("#login").addEventListener("submit", async e => {
  e.preventDefault(); $("#l-err").textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email: $("#l-mail").value.trim(), password: $("#l-pw").value });
  if (error) { $("#l-err").textContent = "Inloggen mislukt: controleer e-mail en wachtwoord."; return; }
  start();
});
$("#btnOut").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

// ---------- Data ----------
async function load() {
  const from = AQ.addDays(AQ.today(), -60);
  const [st, ta, co, me] = await Promise.all([
    sb.from("aq_settings").select("*").eq("id", 1).single(),
    sb.from("aq_tasks").select("*").order("sort"),
    sb.from("aq_completions").select("*").gte("done_on", from).order("done_at", { ascending: false }),
    sb.from("aq_measurements").select("*").order("measured_on", { ascending: false }).order("id", { ascending: false }).limit(200)
  ]);
  if (ta.error) { toast("Laden mislukt: " + ta.error.message); return; }
  B.settings = st.data || {}; B.tasks = ta.data; B.comps = co.data || []; B.meas = me.data || [];
  render();
}
const lastDone = id => B.comps.find(c => c.task_id === id);

function render() {
  const td = AQ.today(), kid = B.settings.kid_name || "Jayden";
  $("#date").textContent = (B.settings.tank_name || "Aquarium") + " · " + AQ.nice(td, true);
  const active = B.tasks.filter(t => t.active);
  const todayComps = B.comps.filter(c => c.done_on === td);
  const now = active.filter(t => AQ.status(t, todayComps).on);
  const done = now.filter(t => AQ.status(t, todayComps).done).length;

  // Op tijd: geplande dagelijkse taken van de afgelopen 14 dagen (tot gisteren)
  let plan = 0, hit = 0;
  for (let i = 1; i <= 14; i++) { const d = AQ.addDays(td, -i), dow = new Date(d + "T12:00").getDay();
    for (const t of active.filter(t => t.kind === "dagelijks" && t.days.includes(dow))) { plan++; if (B.comps.some(c => c.task_id === t.id && c.done_on === d)) hit++; } }
  const since = AQ.addDays(td, -13), who = {};
  for (const c of B.comps.filter(c => c.done_on >= since)) { const n = c.done_by_name || "onbekend"; who[n] = (who[n] || 0) + 1; }
  const whoTxt = Object.entries(who).sort((a, b) => b[1] - a[1]).map(([n, k]) => `${AQ.esc(n)} ${k}`).join(" · ") || "–";
  const next = active.filter(t => t.kind === "interval").sort((a, b) => AQ.eff(a).localeCompare(AQ.eff(b)))[0];
  const L = B.meas[0], worst = L ? AQ.PARAMS.filter(p => L[p.k] != null).map(p => AQ.stat(p, +L[p.k])) : [];
  const ws = worst.includes("bad") ? "bad" : worst.includes("warn") ? "warn" : "ok";
  $("#stats").innerHTML = `
    <div class="stat"><b>${done} / ${now.length}</b><span>vandaag gedaan</span></div>
    <div class="stat"><b>${plan ? Math.round(hit / plan * 100) : 100}%</b><span>dagtaken gedaan (14 dagen)</span></div>
    <div class="stat"><b style="font-size:17px;line-height:1.4">${whoTxt}</b><span>afgevinkt per persoon (14 dagen)</span></div>
    <div class="stat"><b>${next ? AQ.nice(AQ.eff(next)) : "–"}</b><span>${next ? AQ.esc(next.title) : "geen onderhoud"}</span></div>
    <div class="stat"><b>${L ? `<span class="dot d-${ws}"></span> ` + AQ.nice(L.measured_on) : "–"}</b><span>laatste meting</span></div>`;

  // Vandaag
  $("#o-today").innerHTML = now.length ? `<div class="card">${now.map(t => { const s = AQ.status(t, todayComps);
    return `<div class="res"><span class="dot d-${s.done ? "ok" : s.left < 0 ? "bad" : "warn"}"></span><div style="flex:1"><b>${AQ.esc(t.title)}</b><div class="hint">${s.done ? "Gedaan om " + AQ.time(s.row.done_at) + (s.row.done_by_name ? " door " + AQ.esc(s.row.done_by_name) : "") : s.left < 0 ? `Nog open, ${-s.left} dag${s.left === -1 ? "" : "en"} te laat` : "Nog open · melding om " + AQ.remindAt(t, new Date().getDay())}</div></div></div>`; }).join("")}</div>`
    : `<div class="card empty">Vandaag staat er niets op de lijst.</div>`;

  // Kalender 14 dagen
  const days = [...Array(14)].map((_, i) => AQ.addDays(td, i - 13));
  const rows = active.map(t => `<tr><td>${AQ.esc(t.title)}</td>${days.map(d => {
    const dow = new Date(d + "T12:00").getDay(), did = B.comps.find(c => c.task_id === t.id && c.done_on === d);
    if (did) return `<td><span class="c ok ini" title="${AQ.esc(did.done_by_name || "")} ${AQ.time(did.done_at)}">${AQ.esc((did.done_by_name || "✓")[0].toUpperCase())}</span></td>`;
    if (t.kind === "dagelijks" && t.days.includes(dow)) return d < td ? '<td><span class="c miss">✕</span></td>' : '<td><span class="c open"></span></td>';
    if (t.kind === "interval" && d === td && AQ.eff(t) <= td) return '<td><span class="c open"></span></td>';
    return '<td><span class="c off">·</span></td>'; }).join("")}</tr>`).join("");
  $("#o-cal").innerHTML = `<thead><tr><th>Taak</th>${days.map(d => `<th>${AQ.DAYS[new Date(d + "T12:00").getDay()]}<br><span class="hint">${+d.slice(8)}</span></th>`).join("")}</tr></thead><tbody>${rows}</tbody>`;

  // Onderhoud
  const iv = active.filter(t => t.kind === "interval").sort((a, b) => AQ.eff(a).localeCompare(AQ.eff(b)));
  $("#o-maint").innerHTML = `<thead><tr><th>Taak</th><th>Ritme</th><th>Laatst gedaan</th><th>Volgende keer</th><th>Status</th><th></th></tr></thead><tbody>${iv.map(t => {
    const s = AQ.status(t, todayComps), d = AQ.dueText(s), ld = lastDone(t.id);
    return `<tr><td>${AQ.esc(t.title)}</td><td>${AQ.every(t.every_days)}</td><td>${ld ? AQ.nice(ld.done_on) + (ld.done_by_name ? ` <span class="by">${AQ.esc(ld.done_by_name)}</span>` : "") : "–"}</td><td>${AQ.nice(AQ.eff(t))}${t.due_override ? ` <span class="tag">verschoven</span>` : ""}</td><td class="${d.cls}" style="font-weight:700">${d.txt.split(" · ")[0]}</td><td><button class="btn ghost" data-edit="${t.id}">Aanpassen</button></td></tr>`; }).join("")}</tbody>`;

  // Taken
  $("#t-list").innerHTML = B.tasks.map(t => {
    const sum = t.kind === "dagelijks"
      ? (t.days.length === 7 ? "Elke dag" : t.days.length ? t.days.slice().sort().map(d => AQ.DAYS[d]).join(", ") : "Geen dagen gekozen")
      : `${AQ.every(t.every_days)[0].toUpperCase() + AQ.every(t.every_days).slice(1)} · volgende keer ${AQ.nice(AQ.eff(t))}${t.due_override ? " (eenmalig verschoven, ritme " + AQ.nice(t.due_date) + ")" : ""}`;
    return `<div class="card"><div class="trow"><h3>${AQ.esc(t.title)}<span class="tag">${t.kind}</span>${t.active ? "" : '<span class="tag">uit</span>'}</h3><button class="btn ghost" data-edit="${t.id}">Aanpassen</button></div>
      <p class="hint" style="font-size:15px;margin:6px 0 4px">${AQ.esc(t.description)}</p><div style="font-weight:700;font-size:14px">${sum} · melding ${tt(t.remind_time) || "uit"}${afwijkend(t)}</div></div>`; }).join("");

  renderWater(); renderLog();
  $("#st-tank").value = B.settings.tank_name || ""; $("#st-l").value = B.settings.liters || 54; $("#st-r2").value = tt(B.settings.second_remind);
}

function renderWater() {
  const asc = [...B.meas].reverse();
  $("#w-spark").innerHTML = AQ.PARAMS.map(p => {
    const pts = asc.filter(m => m[p.k] != null).slice(-20);
    if (!pts.length) return "";
    const vals = pts.map(m => +m[p.k]), lo = Math.min(p.o[0], ...vals), hi = Math.max(p.o[1], ...vals) || 1, span = hi - lo || 1;
    const y = v => 64 - (v - lo) / span * 58, n = pts.length;
    const line = pts.map((m, i) => `${n === 1 ? 150 : i / (n - 1) * 300},${y(+m[p.k]).toFixed(1)}`).join(" ");
    const last = vals[vals.length - 1], s = AQ.stat(p, last);
    return `<div class="card"><div class="trow"><b>${p.n}</b><span><span class="dot d-${s}"></span> <b>${last}</b> ${p.u}</span></div>
      <svg viewBox="0 0 300 70" preserveAspectRatio="none" aria-label="Verloop ${p.n}"><rect x="0" y="${y(p.g[1]).toFixed(1)}" width="300" height="${Math.max(2, y(p.g[0]) - y(p.g[1])).toFixed(1)}" fill="var(--ok)" opacity=".15"/>
      <polyline points="${n === 1 ? "0," + y(last) + " 300," + y(last) : line}" fill="none" stroke="var(--deep)" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>
      <div class="hint">Goed: ${AQ.range(p)} ${p.u} · ${n} meting${n === 1 ? "" : "en"}</div></div>`; }).join("");
  $("#w-table").innerHTML = B.meas.length ? `<table><thead><tr><th>Datum</th><th style="text-align:left">Door</th>${AQ.PARAMS.map(p => `<th>${p.n}</th>`).join("")}<th style="text-align:left">Notitie</th><th></th></tr></thead><tbody>${B.meas.map(r => `<tr><td>${AQ.nice(r.measured_on)}</td><td style="text-align:left">${AQ.esc(r.by_name || "")}</td>${AQ.PARAMS.map(p => r[p.k] == null ? "<td>–</td>" : `<td class="c-${AQ.stat(p, +r[p.k])}">${+r[p.k]}</td>`).join("")}<td style="text-align:left;white-space:normal;min-width:140px">${AQ.esc(r.note)}</td><td><button class="btn ghost" data-delm="${r.id}">Wissen</button></td></tr>`).join("")}</tbody></table>`
    : '<p class="empty">Nog geen metingen.</p>';
}

function renderLog() {
  const byDay = {};
  for (const c of B.comps) (byDay[c.done_on] ||= []).push(c);
  const title = id => B.tasks.find(t => t.id === id)?.title || id;
  $("#g-list").innerHTML = Object.keys(byDay).sort().reverse().map(d => `<div class="day">${AQ.nice(d, true)}</div>${byDay[d].map(c =>
    `<div class="logi"><span><b>${AQ.time(c.done_at)}</b> &nbsp;${AQ.esc(title(c.task_id))}${c.done_by_name ? ` <span class="by">· ${AQ.esc(c.done_by_name)}</span>` : ""}</span><button class="btn ghost" data-delc="${c.id}">Wissen</button></div>`).join("")}`).join("")
    || '<p class="empty">Nog niets afgevinkt.</p>';
}

// Dagen met een eigen meldtijd, bv. " (za 10:00, zo 10:00)"
function afwijkend(t) {
  if (!t.day_times) return "";
  const l = [1, 2, 3, 4, 5, 6, 0].filter(d => (t.kind !== "dagelijks" || t.days.includes(d)) && t.day_times[d] && tt(t.day_times[d]) !== tt(t.remind_time)).map(d => `${AQ.DAYS[d]} ${tt(t.day_times[d])}`);
  return l.length ? ` (${l.join(", ")})` : "";
}

// ---------- Taak bewerken ----------
let editing = null;
function openEdit(t) {
  const isNew = !t;
  t = t || { id: "", title: "", description: "", kind: "interval", days: [0, 1, 2, 3, 4, 5, 6], every_days: 7, due_date: AQ.today(), remind_time: "17:00:00", anim: "duim", active: true, sort: (B.tasks.at(-1)?.sort || 0) + 1 };
  editing = { t, isNew };
  $("#edit").innerHTML = `
   <h2>${isNew ? "Nieuwe taak" : "Taak aanpassen"}</h2>
   <label for="e-title">Titel</label><input id="e-title" required maxlength="60" value="${AQ.esc(t.title)}">
   <label for="e-desc" style="margin-top:10px">Uitleg voor Jayden</label><textarea id="e-desc" rows="3" maxlength="300">${AQ.esc(t.description)}</textarea>
   <div class="grid" style="margin-top:10px">
    <div><label for="e-kind">Soort</label><select id="e-kind"><option value="dagelijks">Op vaste dagen</option><option value="interval">Elke zoveel dagen (onderhoud)</option></select></div>
    <div><label for="e-time">Melding om</label><input id="e-time" type="time" value="${tt(t.remind_time)}"></div>
    <div><label for="e-anim">Animatie <button type="button" class="btn ghost" id="e-play" style="min-height:28px;padding:2px 10px;margin-left:6px">Bekijk</button></label><select id="e-anim">${Object.entries(AQAnim.SCENES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select></div>
   </div>
   <div id="e-int" style="margin-top:12px">
    <div class="grid"><div><label for="e-every">Elke … dagen</label><input id="e-every" type="number" min="1" max="365" value="${t.every_days || 7}"></div>
    <div><label for="e-next">Volgende keer</label><input id="e-next" type="date" value="${AQ.eff(t) || AQ.today()}"></div></div>
    ${isNew ? "" : `<label class="opt"><input type="radio" name="mode" value="eenmalig" checked><span>Alleen deze keer verschuiven<br><span class="hint">Daarna gaat het verder in het oude ritme (${AQ.nice(t.due_date)}, ${AQ.nice(AQ.addDays(t.due_date, t.every_days))}, …)</span></span></label>
    <label class="opt"><input type="radio" name="mode" value="ritme"><span>Nieuw ritme vanaf deze datum<br><span class="hint">Alle volgende keren schuiven mee</span></span></label>`}
    <div class="preview" id="e-prev"></div>
   </div>
   <div id="e-dag" style="margin-top:12px"><label id="e-dag-l">Op welke dagen en hoe laat?</label>
    <div class="hint" id="e-dag-h" style="margin-bottom:6px">Pas de tijd aan bij een dag die afwijkt van de standaard (Melding om).</div>
    <div class="dayrows">${[1, 2, 3, 4, 5, 6, 0].map(d => `<div class="dayrow" data-d="${d}"><label><input type="checkbox" value="${d}" ${t.days.includes(d) ? "checked" : ""}>${AQ.DAYS_LONG[d]}</label>
     <input type="time" class="dtime" aria-label="Meldtijd ${AQ.DAYS_LONG[d]}" value="${tt((t.day_times && t.day_times[d]) || t.remind_time)}">
     <button type="button" class="btn ghost dreset" title="Terug naar standaardtijd" aria-label="Terug naar standaardtijd">↺</button></div>`).join("")}</div></div>
   <label class="opt" style="margin-top:12px"><input type="checkbox" id="e-active" ${t.active ? "checked" : ""}><span>Actief (Jayden ziet deze taak)</span></label>
   <div class="row" style="margin-top:14px;justify-content:space-between"><div class="row"><button class="btn" type="submit">Opslaan</button><button class="btn ghost" type="button" id="e-cancel">Annuleren</button></div>${isNew ? "" : '<button class="btn ghost" type="button" id="e-del" style="color:var(--bad)">Verwijderen</button>'}</div>`;
  $("#e-kind").value = t.kind; $("#e-anim").value = AQAnim.sceneFor(t);
  editing.std = $("#e-time").value; dayRows();
  editToggle(); $("#modal").classList.add("on"); $("#e-title").focus();
}
// Dagregels bijwerken: uitgevinkte dag grijs, afwijkende tijd gemarkeerd
function dayRows() {
  const std = $("#e-time").value, iv = $("#e-kind").value === "interval";
  $("#e-dag").classList.toggle("iv", iv);
  $("#e-dag-l").textContent = iv ? "Andere meldtijd op een bepaalde dag?" : "Op welke dagen en hoe laat?";
  $("#e-dag-h").textContent = iv ? "Valt de taak op een dag hieronder, dan komt de melding op die tijd. Bijvoorbeeld later in het weekend." : "Pas de tijd aan bij een dag die afwijkt van de standaard (Melding om).";
  document.querySelectorAll("#e-dag .dayrow").forEach(r => {
    const on = iv || r.querySelector("input[type=checkbox]").checked, ti = r.querySelector(".dtime");
    if (!ti.value) ti.value = std;
    const diff = on && std && ti.value !== std;
    r.classList.toggle("off", !on); r.classList.toggle("diff", diff);
    ti.disabled = !on; r.querySelector(".dreset").hidden = !diff;
  });
}
function editToggle(e) {
  // Standaardtijd gewijzigd: dagen die de standaard volgden schuiven mee
  if (e && e.target && e.target.id === "e-time" && editing) {
    const nw = $("#e-time").value;
    document.querySelectorAll("#e-dag .dtime").forEach(i => { if (i.value === editing.std || !i.value) i.value = nw; });
    editing.std = nw;
  }
  if (document.querySelector("#e-dag .dayrow")) dayRows();
  const iv = $("#e-kind").value === "interval";
  $("#e-int").hidden = !iv;
  if (!iv) return;
  const n = Math.max(1, +$("#e-every").value || 7), next = $("#e-next").value || AQ.today();
  const mode = document.querySelector('input[name=mode]:checked')?.value || "ritme";
  let after = [];
  if (mode === "ritme" || !editing.t.due_date) { for (let i = 1; i <= 3; i++) after.push(AQ.addDays(next, n * i)); }
  else { let r = editing.t.due_date; while (after.length < 3) { if (r > next) after.push(r); r = AQ.addDays(r, n); } }
  $("#e-prev").innerHTML = `<b>Planning:</b> ${AQ.nice(next)}, daarna ${after.map(d => AQ.nice(d)).join(", ")}, …`;
}
$("#edit").addEventListener("input", editToggle);
$("#edit").addEventListener("click", async e => {
  if (e.target.id === "e-cancel") closeEdit();
  if (e.target.classList.contains("dreset")) { e.target.closest(".dayrow").querySelector(".dtime").value = $("#e-time").value; dayRows(); }
  if (e.target.id === "e-play") AQAnim.play($("#e-anim").value, { title: "Voorbeeld", sub: $("#e-title").value || "Zo ziet Jayden het" });
  if (e.target.id === "e-del" && armed(e.target)) {
    const { error } = await sb.from("aq_tasks").delete().eq("id", editing.t.id);
    if (error) return toast("Verwijderen mislukt: " + error.message);
    closeEdit(); toast("Taak verwijderd"); load();
  }
});
$("#edit").addEventListener("submit", async e => {
  e.preventDefault();
  const { t, isNew } = editing;
  const row = { title: $("#e-title").value.trim(), description: $("#e-desc").value.trim(), kind: $("#e-kind").value, remind_time: $("#e-time").value || null, anim: $("#e-anim").value, active: $("#e-active").checked };
  if (row.kind === "dagelijks") {
    row.days = [...document.querySelectorAll("#e-dag input[type=checkbox]:checked")].map(i => +i.value);
    row.day_times = {};
    for (const d of row.days) {
      const v = document.querySelector(`#e-dag .dayrow[data-d="${d}"] .dtime`).value;
      if (v && v !== row.remind_time) row.day_times[d] = v;
    }
    row.every_days = null; row.due_date = null; row.due_override = null;
  } else {
    row.day_times = {};
    for (const d of [0, 1, 2, 3, 4, 5, 6]) {
      const v = document.querySelector(`#e-dag .dayrow[data-d="${d}"] .dtime`).value;
      if (v && v !== row.remind_time) row.day_times[d] = v;
    }
    row.every_days = Math.max(1, +$("#e-every").value || 7);
    const next = $("#e-next").value || AQ.today();
    const mode = document.querySelector('input[name=mode]:checked')?.value || "ritme";
    if (mode === "ritme" || !t.due_date || t.kind !== "interval") { row.due_date = next; row.due_override = null; }
    else { row.due_date = t.due_date; row.due_override = next === t.due_date ? null : next; }
  }
  let res;
  if (isNew) {
    row.id = row.title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) + "-" + Date.now().toString(36);
    row.sort = t.sort; res = await sb.from("aq_tasks").insert(row);
  } else res = await sb.from("aq_tasks").update(row).eq("id", t.id);
  if (res.error) return toast("Opslaan mislukt: " + res.error.message);
  closeEdit(); toast("Opgeslagen"); load();
});
function closeEdit() { $("#modal").classList.remove("on"); editing = null; }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeEdit(); });
addEventListener("keydown", e => { if (e.key === "Escape" && editing) closeEdit(); });
$("#btnNew").addEventListener("click", () => openEdit(null));

document.addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]"), dm = e.target.closest("[data-delm]"), dc = e.target.closest("[data-delc]");
  if (ed) openEdit(B.tasks.find(t => t.id === ed.dataset.edit));
  if (dm && armed(dm)) { const { error } = await sb.from("aq_measurements").delete().eq("id", dm.dataset.delm); if (error) toast(error.message); else { toast("Meting gewist"); load(); } }
  if (dc && armed(dc)) { const { error } = await sb.rpc("aq_undo", { p_id: +dc.dataset.delc }); if (error) toast(error.message); else { toast("Gewist"); load(); } }
});

// ---------- Instellingen ----------
$("#setForm").addEventListener("submit", async e => {
  e.preventDefault();
  const { error } = await sb.from("aq_settings").update({ tank_name: $("#st-tank").value.trim(), liters: +$("#st-l").value, second_remind: $("#st-r2").value || null, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) toast("Opslaan mislukt: " + error.message); else { toast("Instellingen opgeslagen"); load(); }
});

let deferred = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("#btnInstall").hidden = false; });
$("#btnInstall").addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $("#btnInstall").hidden = true; });
async function pushUI() {
  const ps = await AQ.pushState().catch(() => "niet");
  $("#btnPush").hidden = ps === "aan" || ps === "niet"; $("#btnPushOff").hidden = ps !== "aan";
  $("#pushTxt").textContent = ps === "aan" ? "Meldingen staan aan op dit apparaat." : ps === "geblokkeerd" ? "Meldingen zijn geblokkeerd in de instellingen van je browser of telefoon." :
    ps === "niet" ? (AQ.isIOS() && !AQ.isStandalone() ? "Op een iPhone: zet deze pagina eerst op je beginscherm (Deel > Zet op beginscherm) en open hem daar." : "Meldingen worden op dit apparaat niet ondersteund.") : "";
}
$("#btnPush").addEventListener("click", async () => { try { await AQ.enablePush(sb, "beheer"); toast("Meldingen staan aan"); } catch (e) { toast(e.message || "Lukte niet"); } pushUI(); });
$("#btnPushOff").addEventListener("click", async () => {
  const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription();
  if (sub) await sb.rpc("aq_remove_sub", { p_endpoint: sub.endpoint, p_role: "beheer" });
  toast("Meldingen voor beheer staan uit"); $("#btnPushOff").hidden = true; $("#btnPush").hidden = false;
});

// ---------- Gezinsleden ----------
let M = [];
async function memberCall(body) {
  const { data, error } = await sb.functions.invoke("aq-members", { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j.error) msg = j.error; } catch (e) {}
    if (/Failed to send|not found|404/i.test(msg)) msg = "De functie aq-members staat nog niet in Supabase (README stap 4).";
    throw new Error(msg);
  }
  return data;
}
async function loadMembers() {
  try { M = (await memberCall({ action: "list" })).members || []; }
  catch (e) { $("#m-list").innerHTML = `<div class="card"><p class="late" style="font-weight:700;margin:0">${AQ.esc(e.message)}</p></div>`; return; }
  const me = (await sb.auth.getUser()).data.user?.email;
  $("#m-list").innerHTML = M.map(m => `<div class="card"><div class="trow"><h3>${AQ.esc(m.name)}<span class="tag">${m.role === "beheer" ? "beheer" : "kind"}</span>${m.email === me ? '<span class="tag">jij</span>' : ""}</h3>
    <div class="row"><button class="btn ghost" data-medit="${AQ.esc(m.email)}">Aanpassen</button>${m.email === me ? "" : `<button class="btn ghost" data-mdel="${AQ.esc(m.email)}" style="color:var(--bad)">Verwijderen</button>`}</div></div>
    <p class="hint" style="font-size:15px;margin:6px 0 0">${AQ.esc(m.email)} · ${!m.has_account ? '<span class="late">nog geen account</span>' : m.last_sign_in_at ? "laatst ingelogd " + AQ.nice(m.last_sign_in_at.slice(0, 10)) : "nog nooit ingelogd"}</p></div>`).join("")
    || '<div class="card empty">Nog geen gezinsleden.</div>';
}
function openMember(m) {
  const isNew = !m; m = m || { name: "", email: "", role: "kind" };
  $("#medit").innerHTML = `<h2>${isNew ? "Gezinslid toevoegen" : "Gezinslid aanpassen"}</h2>
    <label for="m-name">Naam</label><input id="m-name" required maxlength="30" value="${AQ.esc(m.name)}">
    <label for="m-mail" style="margin-top:10px">E-mail (om mee in te loggen)</label><input id="m-mail" type="email" required value="${AQ.esc(m.email)}" ${isNew ? "" : "readonly"}>
    <label for="m-pw" style="margin-top:10px">${isNew || !m.has_account ? "Wachtwoord" : "Nieuw wachtwoord <span class='hint'>(leeg = niet wijzigen)</span>"}</label><input id="m-pw" type="text" autocomplete="off" minlength="6" ${isNew || !m.has_account ? "required" : ""} placeholder="minstens 6 tekens">
    <label for="m-role" style="margin-top:10px">Rol</label><select id="m-role"><option value="kind">Kind: afvinken en metingen invullen</option><option value="beheer">Beheer: alles zien en aanpassen</option></select>
    <p class="late" id="m-err" style="font-weight:700;min-height:1em"></p>
    <div class="row"><button class="btn" type="submit" id="m-save">Opslaan</button><button class="btn ghost" type="button" id="m-cancel">Annuleren</button></div>`;
  $("#m-role").value = m.role; $("#mmodal").classList.add("on"); $(isNew ? "#m-name" : "#m-pw").focus();
}
$("#btnMember").addEventListener("click", () => openMember(null));
$("#mmodal").addEventListener("click", e => { if (e.target.id === "mmodal" || e.target.id === "m-cancel") $("#mmodal").classList.remove("on"); });
$("#medit").addEventListener("submit", async e => {
  e.preventDefault(); $("#m-err").textContent = ""; $("#m-save").disabled = true;
  try {
    await memberCall({ action: "save", name: $("#m-name").value.trim(), email: $("#m-mail").value.trim(), password: $("#m-pw").value, role: $("#m-role").value });
    $("#mmodal").classList.remove("on"); toast("Opgeslagen"); loadMembers();
  } catch (x) { $("#m-err").textContent = x.message; }
  $("#m-save").disabled = false;
});
document.addEventListener("click", async e => {
  const ed = e.target.closest("[data-medit]"), del = e.target.closest("[data-mdel]");
  if (ed) openMember(M.find(m => m.email === ed.dataset.medit));
  if (del && armed(del)) {
    try { await memberCall({ action: "remove", email: del.dataset.mdel, delete_account: true }); toast("Verwijderd"); loadMembers(); } catch (x) { toast(x.message); }
  }
});

// ---------- Testmelding ----------
async function testPush(target, btn) {
  btn.disabled = true; $("#testTxt").textContent = "Versturen…";
  try {
    const r = await memberCall({ action: "test", target });
    $("#testTxt").textContent = !r.devices
      ? (target === "kinderen" ? "Er is nog geen kind met meldingen aan. Laat ze in de app op 'Meldingen aanzetten' tikken." : "Op geen enkel apparaat van jou staan de meldingen aan. Klik eerst op 'Meldingen aanzetten'.")
      : `Verstuurd naar ${r.sent} van ${r.devices} apparaat${r.devices === 1 ? "" : "en"} (${r.names.join(", ")}).${r.failed.length ? " Niet gelukt bij: " + r.failed.join(", ") + "." : " Kijk op de telefoon!"}`;
  } catch (e) { $("#testTxt").textContent = "Lukte niet: " + e.message; }
  btn.disabled = false;
}
$("#btnTestMe").addEventListener("click", e => testPush("mij", e.target));
$("#btnTestKids").addEventListener("click", e => testPush("kinderen", e.target));

function route() {
  if ($("#nav").hidden) return;
  const t = (location.hash || "#overzicht").slice(1), ok = ["overzicht", "taken", "water", "logboek", "gezin", "instellingen"].includes(t) ? t : "overzicht";
  if (ok === "gezin") loadMembers();
  document.querySelectorAll("main section").forEach(s => s.classList.toggle("on", s.id === "s-" + ok));
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.t === ok));
}
addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#nav").hidden) load(); });
AQ.registerSW();
start();
}
