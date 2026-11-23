// Jayden-app: afvinken, metingen invullen, meldingen en installeren
{
const $ = s => document.querySelector(s);
const sb = AQ.client();
let S = { settings: { tank_name: "Mijn aquarium", liters: 54 }, tasks: [], comps: [], meas: [] };
let loaded = false, ME = null;
const myName = () => (ME && ME.name) || "kanjer";

function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 2600); }

async function load() {
  if (!sb || !ME) return;
  const td = AQ.today();
  const [st, ta, co, me] = await Promise.all([
    sb.from("aq_settings").select("*").eq("id", 1).single(),
    sb.from("aq_tasks").select("*").eq("active", true).order("sort"),
    sb.from("aq_completions").select("*").eq("done_on", td),
    sb.from("aq_measurements").select("*").order("measured_on", { ascending: false }).order("id", { ascending: false }).limit(20)
  ]);
  if (ta.error) { toast("Geen verbinding. Probeer het zo nog eens."); return; }
  if (st.data) S.settings = st.data;
  S.tasks = ta.data; S.comps = co.data || []; S.meas = me.data || [];
  loaded = true; render();
}

function taskCard(t, maint) {
  const s = AQ.status(t, S.comps), d = AQ.dueText(s);
  let extra = "";
  if (t.kind === "interval") {
    const pct = s.done ? 100 : Math.max(0, Math.min(100, (t.every_days - Math.max(s.left, 0)) / t.every_days * 100));
    extra = `<div class="meta ${d.cls}">${d.txt}</div>${maint ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="hint">${AQ.every(t.every_days)}</div>` : ""}`;
  }
  return `<button class="card task${s.done ? " done" : ""}" data-id="${t.id}"><span class="ck">${s.done ? "✓" : ""}</span><span style="flex:1"><h3>${AQ.esc(t.title)}</h3><p>${AQ.esc(t.description)}</p>${extra}</span></button>`;
}

function render() {
  const td = AQ.today(), dow = new Date().getDay(), kid = myName();
  $("#title").textContent = S.settings.tank_name; document.title = S.settings.tank_name;
  $("#date").textContent = AQ.nice(td, true);
  $("#kwart").textContent = Math.round((S.settings.liters || 54) / 4);
  const now = S.tasks.filter(t => AQ.status(t, S.comps).on);
  const done = now.filter(t => AQ.status(t, S.comps).done).length;
  $("#prog").textContent = !now.length ? "Vandaag niets te doen" : done >= now.length ? "Alles klaar voor vandaag!" : `Vandaag ${done} van ${now.length} klaar`;
  const feed = S.tasks.find(t => t.anim === "vis" && t.kind === "dagelijks");
  let h = feed && !(feed.days || []).includes(dow) ? `<div class="card fast"><h3>Vastendag</h3><p style="margin:4px 0 0">Vandaag krijgen de vissen geen eten. Dat is gezond voor hun buikjes en houdt het water schoon.</p></div>` : "";
  h += now.map(t => taskCard(t)).join("") || `<div class="card empty">Niks te doen vandaag. Geniet van je aquarium, ${AQ.esc(kid)}!</div>`;
  $("#today").innerHTML = h;
  const soon = S.tasks.filter(t => { const s = AQ.status(t, S.comps); return t.kind === "interval" && !s.on && s.left <= 3; });
  $("#soon").innerHTML = soon.map(t => taskCard(t)).join("") || `<div class="card empty">De komende dagen geen extra onderhoud.</div>`;
  $("#maint").innerHTML = S.tasks.filter(t => t.kind === "interval").sort((a, b) => AQ.status(a, S.comps).left - AQ.status(b, S.comps).left).map(t => taskCard(t, true)).join("");
  renderWater();
}

function renderWater() {
  const L = S.meas[0];
  if (!L) { $("#latest").innerHTML = ""; $("#hist").innerHTML = '<p class="empty">Nog geen metingen. Doe je eerste test en vul hem hierboven in.</p>'; return; }
  const rows = AQ.PARAMS.filter(p => L[p.k] != null).map(p => { const v = +L[p.k]; return `<div class="res"><span class="dot d-${AQ.stat(p, v)}"></span><div><b>${p.n}: ${v} ${p.u}</b> <span class="hint">(goed: ${AQ.range(p)} ${p.u})</span><div class="hint" style="font-size:15px">${AQ.tip(p, v)}</div></div></div>`; }).join("");
  const bad = AQ.PARAMS.some(p => L[p.k] != null && AQ.stat(p, +L[p.k]) === "bad");
  $("#latest").innerHTML = `<div class="card"><h3>Laatste meting · ${AQ.nice(L.measured_on)}</h3>${bad ? '<p class="late" style="font-weight:700;margin:6px 0">Let op: er is iets niet goed. Doe vandaag wat er staat en vraag papa mee te kijken.</p>' : ""}${rows}${L.note ? `<p class="hint">Notitie: ${AQ.esc(L.note)}</p>` : ""}</div>`;
  $("#hist").innerHTML = `<table><thead><tr><th>Datum</th>${AQ.PARAMS.map(p => `<th>${p.n}</th>`).join("")}</tr></thead><tbody>${S.meas.map(r => `<tr><td>${AQ.nice(r.measured_on)}</td>${AQ.PARAMS.map(p => r[p.k] == null ? "<td>–</td>" : `<td class="c-${AQ.stat(p, +r[p.k])}">${+r[p.k]}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

const MSG = (scene, kid, t) =>
  scene === "vis" ? { title: "Mmm, lekker!", sub: `Dank je wel, ${kid}!` } :
  scene === "garnalen" ? { title: "De garnalen smullen!", sub: `Goed gedaan, ${kid}!` } :
  { title: "Duim omhoog!", sub: `${t.title}: klaar. Goed gedaan, ${kid}!` };

document.addEventListener("click", async e => {
  const b = e.target.closest(".task[data-id]"); if (!b || !sb) return;
  const t = S.tasks.find(x => x.id === b.dataset.id), s = AQ.status(t, S.comps);
  b.classList.add("busy");
  if (s.done) {
    const { error } = await sb.rpc("aq_undo", { p_id: s.row.id });
    if (error) toast("Dat lukte niet: " + error.message); else toast("Ongedaan gemaakt");
    return load();
  }
  const scene = AQAnim.sceneFor(t);
  const anim = AQAnim.play(scene, MSG(scene, myName(), t));
  const { error } = await sb.rpc("aq_complete", { p_task: t.id });
  if (error) { toast("Opslaan lukte niet. Heb je internet?"); b.classList.remove("busy"); return; }
  await load(); await anim;
});

$("#fields").innerHTML = AQ.PARAMS.map(p => `<div><label for="f-${p.k}">${p.n} <span class="hint">${p.u} · goed ${AQ.range(p)}</span></label><input id="f-${p.k}" type="text" inputmode="decimal" autocomplete="off" pattern="[0-9]*[.,]?[0-9]*"></div>`).join("");
$("#f-date").value = AQ.today(); $("#f-date").max = AQ.today(); $("#f-date").min = AQ.addDays(AQ.today(), -7);
$("#form").addEventListener("submit", async e => {
  e.preventDefault(); if (!sb) return;
  const r = { measured_on: $("#f-date").value || AQ.today(), note: $("#f-note").value.trim() || null }; let any = false;
  for (const p of AQ.PARAMS) { const v = $("#f-" + p.k).value.replace(",", "."); if (v !== "" && !isNaN(+v)) { r[p.k] = +v; any = true; } }
  if (!any) { toast("Vul minstens één waarde in"); return; }
  $("#btnSave").disabled = true;
  const { error } = await sb.from("aq_measurements").insert(r);
  $("#btnSave").disabled = false;
  if (error) { toast("Opslaan lukte niet: " + error.message); return; }
  for (const p of AQ.PARAMS) $("#f-" + p.k).value = ""; $("#f-note").value = "";
  const test = S.tasks.find(t => t.id === "test");
  if (test && r.measured_on === AQ.today() && !AQ.status(test, S.comps).done && AQ.status(test, S.comps).left <= 2) await sb.rpc("aq_complete", { p_task: "test" });
  const bad = AQ.PARAMS.some(p => r[p.k] != null && AQ.stat(p, r[p.k]) === "bad");
  await load();
  if (bad) toast("Opgeslagen. Kijk even wat er moet gebeuren!");
  else AQAnim.play("test", { title: "Meting opgeslagen!", sub: `Lekker bezig, ${myName()}!` });
});

function route() {
  const t = (location.hash || "#vandaag").slice(1), ok = ["vandaag", "onderhoud", "water", "uitleg"].includes(t) ? t : "vandaag";
  document.querySelectorAll("main section").forEach(s => s.classList.toggle("on", s.id === "s-" + ok));
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.t === ok));
}
addEventListener("hashchange", route); route();

// ---- Installeren en meldingen ----
let deferred = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; setup(); });
addEventListener("appinstalled", () => { deferred = null; setup(); });
async function setup() {
  const box = $("#setup"), inst = $("#btnInstall"), push = $("#btnPush");
  if (!ME) { box.hidden = true; return; }
  const standalone = AQ.isStandalone(), ios = AQ.isIOS();
  const ps = "serviceWorker" in navigator ? await AQ.pushState().catch(() => "niet") : "niet";
  inst.hidden = standalone || !deferred;
  push.hidden = !(ps === "uit") || (ios && !standalone) || !sb || !ME;
  let txt = "Zet de app op je beginscherm en zet meldingen aan, dan krijg je een seintje als je aquarium iets nodig heeft.";
  if (ios && !standalone) txt = "Op een iPhone: tik onderin op het deel-icoon (vierkantje met pijl) en kies 'Zet op beginscherm'. Open daarna de app vanaf je beginscherm om meldingen aan te zetten.";
  else if (ps === "geblokkeerd") txt = "Meldingen staan uit in je instellingen. Zet ze aan bij Instellingen > Meldingen voor deze app.";
  else if (!deferred && !standalone && ps !== "uit") txt = "Installeren: open het menu van je browser (drie puntjes) en kies 'App installeren' of 'Toevoegen aan startscherm'.";
  $("#setupTxt").textContent = txt;
  box.hidden = standalone && (ps === "aan" || ps === "niet");
}
$("#btnInstall").addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; setup(); });
$("#btnPush").addEventListener("click", async () => {
  try { await AQ.enablePush(sb, "kind"); toast("Meldingen staan aan!"); } catch (e) { toast(e.message || "Meldingen aanzetten lukte niet"); }
  setup();
});

// ---- Inloggen ----
function showApp(on) {
  $("#login").hidden = on || !sb; $("nav").hidden = !on;
  document.querySelectorAll("main section").forEach(s => s.hidden = !on);
  if (!on) $("#setup").hidden = true;
}
async function auth() {
  if (!sb) { showApp(false); return; }
  const { data } = await sb.auth.getSession();
  if (!data.session) { ME = null; showApp(false); $("#prog").textContent = "Log eerst in"; try { $("#l-mail").value = localStorage.getItem("aq-mail") || ""; } catch (e) {} return; }
  const { data: me, error } = await sb.rpc("aq_me");
  ME = me && me[0];
  if (!ME) {
    showApp(false);
    $("#l-err").textContent = error ? "Geen verbinding, probeer het zo nog eens." : "Dit account hoort nog niet bij het aquarium. Vraag papa om je toe te voegen.";
    if (!error) await sb.auth.signOut();
    return;
  }
  $("#who").textContent = "Ingelogd als " + ME.name;
  showApp(true); route(); setup(); load();
}
$("#login").addEventListener("submit", async e => {
  e.preventDefault(); if (!sb) return; $("#l-err").textContent = ""; $("#l-btn").disabled = true;
  const email = $("#l-mail").value.trim().toLowerCase();
  const { error } = await sb.auth.signInWithPassword({ email, password: $("#l-pw").value });
  $("#l-btn").disabled = false;
  if (error) { $("#l-err").textContent = "Dat klopt niet. Controleer je e-mail en wachtwoord."; return; }
  try { localStorage.setItem("aq-mail", email); } catch (e) {}
  $("#l-pw").value = ""; auth();
});
$("#btnOut").addEventListener("click", async () => {
  try { const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription(); if (sub) await sb.rpc("aq_remove_sub", { p_endpoint: sub.endpoint, p_role: "kind" }); } catch (e) {}
  await sb.auth.signOut(); ME = null; S.tasks = []; S.comps = []; S.meas = []; render(); auth();
});

if (!sb) { $("#cfg").hidden = false; $("#prog").textContent = "Niet gekoppeld"; }
render(); AQAnim.preload();
AQ.registerSW().then(setup);
auth();
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
}
