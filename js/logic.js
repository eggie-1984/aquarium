// Gedeelde logica voor de Jayden-app en de beheerpagina
(function () {
  const z = n => String(n).padStart(2, "0");
  const key = d => d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  const today = () => key(new Date());
  const addDays = (k, n) => { const d = new Date(k + "T12:00"); d.setDate(d.getDate() + n); return key(d); };
  const diff = (a, b) => Math.round((new Date(a + "T12:00") - new Date(b + "T12:00")) / 864e5);
  const nice = (k, long) => new Date(k + "T12:00").toLocaleDateString("nl-NL", long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" });
  const time = iso => new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const DAYS_LONG = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const eff = t => t.due_override || t.due_date;
  const every = n => n === 1 ? "elke dag" : n === 7 ? "elke week" : n === 14 ? "elke 2 weken" : n % 7 === 0 ? `elke ${n / 7} weken` : n === 30 || n === 31 ? "elke maand" : `elke ${n} dagen`;

  // Status van een taak op een dag. comps = completions van die dag.
  function status(t, comps, day = today()) {
    const doneRow = comps.find(c => c.task_id === t.id && c.done_on === day);
    const dow = new Date(day + "T12:00").getDay();
    if (t.kind === "dagelijks") {
      const on = (t.days || []).includes(dow);
      return { on, done: !!doneRow, row: doneRow, left: on ? 0 : null };
    }
    const due = eff(t);
    const left = due ? diff(due, day) : 0;
    return { on: left <= 0 || !!doneRow, done: !!doneRow, row: doneRow, left, due };
  }
  function dueText(s) {
    if (s.done) return { txt: "Vandaag gedaan, top!", cls: "fine" };
    if (s.left < 0) return { txt: `${-s.left} dag${s.left === -1 ? "" : "en"} te laat`, cls: "late" };
    if (s.left === 0) return { txt: "Vandaag doen", cls: "soon" };
    if (s.left === 1) return { txt: "Morgen", cls: "soon" };
    return { txt: `Over ${s.left} dagen · ${nice(s.due)}`, cls: "fine" };
  }

  const PARAMS = [
    { k: "temp", n: "Temperatuur", u: "°C", g: [22, 26], o: [20, 28], lo: "Te koud. Staat de verwarming aan en goed ingesteld?", hi: "Te warm. Lamp korter aan, deksel even open en geen zon op het aquarium." },
    { k: "ph", n: "pH", u: "", g: [6.5, 7.8], o: [6, 8.2], lo: "Het water is erg zuur. Ververs wat vaker en vraag advies bij de dierenwinkel.", hi: "Het water is erg basisch. Meestal komt dat door het kraanwater; vraag advies als het zo blijft." },
    { k: "gh", n: "GH", u: "°dH", g: [6, 12], o: [4, 15], lo: "Te zacht voor garnalen: ze vervellen dan slecht. Vraag naar GH-plus of garnalenmineralen.", hi: "Hard water. Meestal geen probleem, wel in de gaten houden." },
    { k: "kh", n: "KH", u: "°dH", g: [3, 8], o: [1, 12], lo: "Lage KH: de pH kan ineens schommelen. Niet te veel water tegelijk verversen.", hi: "Hoge KH. Meestal geen probleem voor deze dieren." },
    { k: "nh3", n: "Ammoniak", u: "mg/l", g: [0, 0], o: [0, 0.25], hi: "Giftig! Ververs vandaag 30% water en voer 2 dagen niet. Morgen opnieuw testen." },
    { k: "no2", n: "Nitriet", u: "mg/l", g: [0, 0], o: [0, 0.1], hi: "Giftig! Ververs vandaag 30% water, voer minder en spoel het filter nu niet uit." },
    { k: "no3", n: "Nitraat", u: "mg/l", g: [0, 20], o: [0, 40], hi: "Te veel nitraat. Ververs wat meer of vaker en voer iets minder." }
  ];
  const stat = (p, v) => v < p.o[0] || v > p.o[1] ? "bad" : v < p.g[0] || v > p.g[1] ? "warn" : "ok";
  const range = p => p.g[1] === 0 ? "0" : `${p.g[0]}–${p.g[1]}`;
  const tip = (p, v) => { const s = stat(p, v); return s === "ok" ? "Prima!" : (v < p.g[0] ? p.lo : p.hi); };

  function client() {
    const c = window.AQ_CONFIG || {};
    if (!c.SUPABASE_URL || c.SUPABASE_URL.includes("JOUWPROJECT")) return null;
    return window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  }

  // Service worker + push
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return null;
    try { return await navigator.serviceWorker.register("sw.js"); } catch (e) { return null; }
  }
  const b64 = s => { const p = "=".repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  async function pushState() {
    if (!("PushManager" in window) || !("Notification" in window)) return "niet";
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "niet";
    const sub = await reg.pushManager.getSubscription();
    return Notification.permission === "granted" && sub ? "aan" : Notification.permission === "denied" ? "geblokkeerd" : "uit";
  }
  async function enablePush(sb, role) {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Meldingen zijn niet toegestaan.");
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(window.AQ_CONFIG.VAPID_PUBLIC_KEY) });
    const { error } = await sb.rpc("aq_save_sub", { p_sub: sub.toJSON(), p_role: role });
    if (error) throw error;
  }
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // App open en er komt een melding binnen? Speel dan het aquariumgeluid af.
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => {
    if (e.data && e.data.type === "aq-push" && document.visibilityState === "visible") {
      try { const a = new Audio("sounds/aquarium-melding.mp3"); a.volume = .8; a.play().catch(() => {}); } catch (x) {}
    }
  });
  window.AQ = { today, addDays, diff, nice, time, esc, DAYS, DAYS_LONG, eff, every, status, dueText, PARAMS, stat, range, tip, client, registerSW, pushState, enablePush, isStandalone, isIOS };
})();
