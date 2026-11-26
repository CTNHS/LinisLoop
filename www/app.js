"use strict";
/* LinisLoop · Camp Tinio NHS — all data is stored locally on the device. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KEY = "linisloop-v2";
const OLD_KEY = "linisloop-v1";

/* ---------------- helpers ---------------- */
function escapeHTML(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
function dateText(v) {
  const d = new Date(v);
  return isNaN(d) ? "Date to be announced" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}

/* Pure-JS SHA-256 so password hashing works the same on file://, http and https. */
function sha256(msg) {
  const utf = unescape(encodeURIComponent(msg));
  const K = [], H = [];
  const isPrime = x => { for (let d = 2; d * d <= x; d++) if (x % d === 0) return false; return true; };
  for (let n = 2; K.length < 64; n++) {
    if (!isPrime(n)) continue;
    if (H.length < 8) H.push((Math.sqrt(n) % 1) * 4294967296 | 0);
    K.push((Math.cbrt(n) % 1) * 4294967296 | 0);
  }
  const bytes = [];
  for (let i = 0; i < utf.length; i++) bytes.push(utf.charCodeAt(i));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let s = 56; s >= 0; s -= 8) bytes.push(s >= 32 ? 0 : (bitLen >>> s) & 255);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    const w = new Array(64);
    for (let t = 0; t < 16; t++) w[t] = (bytes[o + 4 * t] << 24) | (bytes[o + 4 * t + 1] << 16) | (bytes[o + 4 * t + 2] << 8) | bytes[o + 4 * t + 3];
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
function randomSalt() {
  const a = new Uint8Array(12);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------- photo database (IndexedDB) ---------------- */
const DB = {
  db: null,
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open("linisloop-photos", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("photos");
        r.onsuccess = () => { this.db = r.result; res(true); };
        r.onerror = () => res(false);
      } catch { res(false); }
    });
  },
  tx(mode, fn) {
    return new Promise(res => {
      if (!this.db) return res(null);
      try {
        const tx = this.db.transaction("photos", mode);
        const req = fn(tx.objectStore("photos"));
        tx.oncomplete = () => res(req && "result" in req ? req.result : true);
        tx.onerror = tx.onabort = () => res(null);
      } catch { res(null); }
    });
  },
  put(id, blob) { return this.tx("readwrite", s => s.put(blob, id)).then(r => r !== null); },
  get(id) { return this.tx("readonly", s => s.get(id)); },
  del(id) { return this.tx("readwrite", s => s.delete(id)); },
  clear() { return this.tx("readwrite", s => s.clear()); }
};

/* ---------------- data (localStorage) ---------------- */
function seedEvents() {
  const day = 86400000;
  return [
    { id: 1, name: "Community Park Cleanup", date: new Date(Date.now() + day * 2).toISOString(), place: "Community park entrance", details: "Help collect litter and sort recyclables. Bring reusable gloves and drinking water.", base: 4, joinedBy: [] },
    { id: 2, name: "Creekside Waste Watch", date: new Date(Date.now() + day * 5).toISOString(), place: "Public footbridge meeting point", details: "Community observation and cleanup of accessible public areas. Do not enter waterways.", base: 7, joinedBy: [] }
  ];
}
function normalize(d) {
  d = d && typeof d === "object" ? d : {};
  d.users = d.users && typeof d.users === "object" ? d.users : {};
  d.reports = Array.isArray(d.reports) ? d.reports : [];
  d.events = Array.isArray(d.events) && d.events.length ? d.events : seedEvents();
  d.events.forEach(e => { e.joinedBy = Array.isArray(e.joinedBy) ? e.joinedBy : []; e.base = Number(e.base) || 0; });
  d.session = d.session || null;
  return d;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn("Could not read saved data", e); }
  // Migrate the old v1 prototype data (reports + events) if present.
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
    if (old) {
      const d = normalize({});
      d.reports = (old.reports || []).map(r => ({ ...r, owner: (r.owner || "guest").toLowerCase(), photoInline: r.photo || "" }));
      d.reports.forEach(r => delete r.photo);
      return d;
    }
  } catch {}
  return normalize({});
}
let data = load();
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch (e) { toast("Storage is full — save a backup and remove old reports."); return false; }
}
function save() { persist(); render(); }
const me = () => data.users[data.session] || null;
const myName = () => (me() && me().name) || "Community Member";
function addPoints(n) { if (me()) me().points = (me().points || 0) + n; }

/* ---------------- navigation ---------------- */
function go(tab) {
  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + tab));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (tab === "profile") updateStorageInfo();
}
$$("[data-tab]").forEach(b => b.addEventListener("click", () => go(b.dataset.tab)));
$$("[data-go]").forEach(b => b.addEventListener("click", e => {
  e.preventDefault();
  go(b.dataset.go);
  if (b.dataset.camera) setTimeout(openCamera, 150);
}));
$("#profileBtn").onclick = () => go("profile");

/* ---------------- login / accounts ---------------- */
let authMode = "login";
function setAuthMode(m) {
  authMode = m;
  $("#segLogin").classList.toggle("active", m === "login");
  $("#segRegister").classList.toggle("active", m === "register");
  $("#segLogin").setAttribute("aria-selected", m === "login");
  $("#segRegister").setAttribute("aria-selected", m === "register");
  $("#confirmWrap").hidden = m !== "register";
  $("#authSubmit").textContent = m === "login" ? "Sign in" : "Create my account";
  $("#loginPassword").autocomplete = m === "login" ? "current-password" : "new-password";
  authMsg("");
}
function authMsg(text, ok) {
  const el = $("#authMsg");
  el.hidden = !text;
  el.textContent = text || "";
  el.classList.toggle("ok", !!ok);
}
$("#segLogin").onclick = () => setAuthMode("login");
$("#segRegister").onclick = () => setAuthMode("register");
$("#togglePw").onclick = () => {
  const i = $("#loginPassword"), show = i.type === "password";
  i.type = show ? "text" : "password";
  $("#togglePw").classList.toggle("on", show);
  $("#togglePw").setAttribute("aria-label", show ? "Hide password" : "Show password");
};
$("#loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#loginUsername").value.trim(), key = name.toLowerCase(), pw = $("#loginPassword").value;
  if (!name || !pw) return authMsg("Enter your username and password.");
  if (authMode === "register") {
    if (!/^[A-Za-z0-9_. -]{3,24}$/.test(name)) return authMsg("Username must be 3–24 characters: letters, numbers, spaces, . _ -");
    if (key === "guest") return authMsg("That username is reserved. Please choose another.");
    if (pw.length < 4) return authMsg("Password must be at least 4 characters.");
    if (pw !== $("#loginConfirm").value) return authMsg("Passwords do not match.");
    if (data.users[key]) return authMsg("That username is already taken on this device.");
    const salt = randomSalt();
    data.users[key] = { name, salt, hash: sha256(salt + ":" + pw), points: 0, quizDone: [], created: new Date().toISOString() };
    enter(key);
    toast("Account created. Welcome, " + name + "!");
  } else {
    const u = data.users[key];
    if (!u || u.guest || u.hash !== sha256(u.salt + ":" + pw)) return authMsg("Incorrect username or password.");
    enter(key);
    toast("Welcome back, " + u.name + "!");
  }
});
$("#guestBtn").onclick = () => {
  data.users.guest = data.users.guest || { name: "Guest", guest: true, points: 0, quizDone: [] };
  enter("guest");
  toast("Signed in as guest");
};
function enter(key) {
  data.session = key;
  persist();
  $("#loginForm").reset();
  authMsg("");
  setAuthMode("login");
  showApp();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
function showApp() {
  $("#loginScreen").hidden = true;
  $("#appShell").hidden = false;
  go("home");
  render();
}
$("#logoutBtn").onclick = () => {
  data.session = null;
  persist();
  closeCamera();
  clearPhoto();
  $("#appShell").hidden = true;
  $("#loginScreen").hidden = false;
  window.scrollTo(0, 0);
};

/* ---------------- photo object URLs ---------------- */
const urlCache = new Map();
async function photoURL(r) {
  if (r.photoInline) return r.photoInline;
  if (!r.photoId) return "";
  if (urlCache.has(r.photoId)) return urlCache.get(r.photoId);
  const blob = await DB.get(r.photoId);
  if (!blob) return "";
  const url = URL.createObjectURL(blob);
  urlCache.set(r.photoId, url);
  return url;
}
function hydratePhotos() {
  $$("img[data-rid]").forEach(async img => {
    const r = data.reports.find(x => String(x.id) === img.dataset.rid);
    if (!r) return;
    const url = await photoURL(r);
    if (url) { img.src = url; img.dataset.full = url; }
    else img.closest(".rphoto-wrap,.thumb-wrap")?.remove();
  });
}

/* ---------------- render ---------------- */
function status(s) { return `<span class="badge ${escapeHTML(s.toLowerCase())}">${escapeHTML(s)}</span>`; }
function ownerName(k) { return (data.users[k] && data.users[k].name) || k; }
function hasPhoto(r) { return !!(r.photoId || r.photoInline); }
function levelFor(p) { return p >= 50 ? "Green Guardian 🌳" : p >= 20 ? "Eco Sprout 🌿" : "Seedling 🌱"; }

function render() {
  if (!data.session) return;
  const u = me() || { points: 0 };
  const mine = data.reports.filter(r => r.owner === data.session);
  const volunteers = data.events.reduce((n, e) => n + e.base + e.joinedBy.length, 0);
  $("#statReports").textContent = data.reports.length;
  $("#statEvents").textContent = data.events.length;
  $("#statVolunteers").textContent = volunteers;
  $("#reportCount").textContent = data.reports.length + " total";
  $("#myPoints").textContent = u.points || 0;
  $("#myReports").textContent = mine.length;
  $("#myEvents").textContent = data.events.filter(e => e.joinedBy.includes(data.session)).length;
  $("#profileName").textContent = myName();
  $("#profileLevel").textContent = levelFor(u.points || 0);
  $("#profileTag").textContent = u.guest ? "Guest profile" : "@" + data.session;
  if (document.activeElement !== $("#displayName")) $("#displayName").value = myName();
  $("#profileBtn").textContent = (myName()[0] || "R").toUpperCase();
  $("#heroGreeting").textContent = "WELCOME BACK, " + myName().toUpperCase();
  const nextEvent = [...data.events].filter(e => new Date(e.date) >= new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  $("#dailyNudge").textContent = nextEvent
    ? `Next up: ${nextEvent.name} · ${new Date(nextEvent.date).toLocaleDateString([], {month:"short",day:"numeric"})}. Join in and bring a friend.`
    : "Spot a waste concern? Take a clear photo and tell the community where help is needed.";

  const recent = [...data.reports].slice(-3).reverse();
  $("#recentActivity").innerHTML = recent.length ? recent.map(r => `
    <article class="activity">
      ${hasPhoto(r) ? `<span class="thumb-wrap"><img class="thumb" data-rid="${r.id}" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></span>` : ""}
      <div><div class="report-top"><strong>${escapeHTML(r.type)}</strong>${status(r.status)}</div>
      <p>${escapeHTML(r.location)} · ${escapeHTML(r.description)}</p></div>
    </article>`).join("") : '<div class="empty">No activity yet. Start by submitting a waste report.</div>';

  const searchTerm = ($("#reportSearch")?.value || "").trim().toLowerCase();
  const filterStatus = $("#reportFilter")?.value || "all";
  const visibleReports = [...data.reports].reverse().filter(r =>
    (filterStatus === "all" || r.status === filterStatus) &&
    (!searchTerm || [r.type,r.location,r.description,ownerName(r.owner)].some(v => String(v).toLowerCase().includes(searchTerm)))
  );
  $("#reportList").innerHTML = visibleReports.length ? visibleReports.map(r => `
    <article class="report-card">
      <div class="report-top"><strong>${escapeHTML(r.type)}</strong>${status(r.status)}</div>
      ${hasPhoto(r) ? `<div class="rphoto-wrap"><img class="rphoto" data-rid="${r.id}" alt="Photo attached to report" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></div>` : ""}
      <p><b>Location:</b> ${escapeHTML(r.location)}${r.geo ? ` · <a class="geo" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${r.geo.lat}&mlon=${r.geo.lng}#map=18/${r.geo.lat}/${r.geo.lng}">📍 ${r.geo.lat.toFixed(4)}, ${r.geo.lng.toFixed(4)}</a>` : ""}</p>
      <p>${escapeHTML(r.description)}</p>
      <div class="actions"><p class="hint">Submitted by ${escapeHTML(ownerName(r.owner))} · ${dateText(r.created)}</p>
      ${r.owner === data.session ? `<button class="danger small" data-del="${r.id}">Delete</button>` : ""}</div>
    </article>`).join("") : '<div class="empty">No reports yet. Your first report can help bring attention to a local concern.</div>';

  const evs = [...data.events].sort((a, b) => new Date(a.date) - new Date(b.date));
  $("#eventList").innerHTML = evs.length ? evs.map(e => {
    const joined = e.joinedBy.includes(data.session);
    return `<article class="event-card">
      <div class="event-top"><strong>${escapeHTML(e.name)}</strong><span class="badge ${joined ? "registered" : "open"}">${joined ? "Registered" : "Open"}</span></div>
      <p>📅 ${dateText(e.date)}</p><p>📍 ${escapeHTML(e.place)}</p>
      <p>${escapeHTML(e.details || "Community cleanup activity.")}</p>
      <p>👥 ${e.base + e.joinedBy.length} volunteer registrations</p>
      <button class="${joined ? "secondary" : "primary"}" data-join="${e.id}" ${joined ? "disabled" : ""}>${joined ? "You're registered" : "Join this cleanup"}</button>
    </article>`;
  }).join("") : '<div class="empty">No cleanup events published yet.</div>';

  hydratePhotos();
}

document.addEventListener("click", async e => {
  const j = e.target.closest("[data-join]");
  if (j) {
    const ev = data.events.find(x => x.id === Number(j.dataset.join));
    if (ev && !ev.joinedBy.includes(data.session)) {
      ev.joinedBy.push(data.session);
      addPoints(10);
      save();
      toast("You're registered! +10 EcoPoints");
    }
    return;
  }
  const d = e.target.closest("[data-del]");
  if (d) {
    const r = data.reports.find(x => x.id === Number(d.dataset.del));
    if (!r || r.owner !== data.session) return;
    if (!confirm("Delete this report and its photo from this device?")) return;
    if (r.photoId) { await DB.del(r.photoId); const u = urlCache.get(r.photoId); if (u) { URL.revokeObjectURL(u); urlCache.delete(r.photoId); } }
    data.reports = data.reports.filter(x => x.id !== r.id);
    save();
    toast("Report deleted");
    return;
  }
  const img = e.target.closest("img[data-full]");
  if (img) { $("#lightboxImg").src = img.dataset.full; $("#lightbox").hidden = false; }
});
$("#lightboxClose").onclick = () => { $("#lightbox").hidden = true; };
$("#lightbox").addEventListener("click", e => { if (e.target.id === "lightbox") $("#lightbox").hidden = true; });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { $("#lightbox").hidden = true; closeCamera(); }
});

/* ---------------- photo capture & upload ---------------- */
const pending = { blob: null, url: "" };
function clearPhoto() {
  if (pending.url) URL.revokeObjectURL(pending.url);
  pending.blob = null; pending.url = "";
  $("#photoPreview").hidden = true;
  $("#photoActions").hidden = false;
  $("#photoPreviewImg").removeAttribute("src");
  $("#photoCapture").value = ""; $("#photoUpload").value = "";
}
function setPhoto(blob, note) {
  if (pending.url) URL.revokeObjectURL(pending.url);
  pending.blob = blob;
  pending.url = URL.createObjectURL(blob);
  $("#photoPreviewImg").src = pending.url;
  $("#photoInfo").textContent = (note || "Photo ready") + " · " + fmtBytes(blob.size);
  $("#photoPreview").hidden = false;
  $("#photoActions").hidden = true;
}
function loadBitmap(src) {
  if (window.createImageBitmap) {
    return createImageBitmap(src, { imageOrientation: "from-image" }).catch(() => createImageBitmap(src));
  }
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(src), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("decode")); };
    img.src = url;
  });
}
async function compress(file, max = 1280, quality = 0.8) {
  const bmp = await loadBitmap(file);
  const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * scale); c.height = Math.round(h0 * scale);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("encode")), "image/jpeg", quality));
}
async function handleFile(file, label) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Please choose an image file.");
  if (file.size > 30 * 1048576) return toast("That image is too large (30 MB max).");
  try {
    toast("Preparing photo…");
    setPhoto(await compress(file), label);
  } catch {
    toast("Couldn't read that image. Try a JPG or PNG photo.");
  }
}
$("#photoCapture").onchange = e => handleFile(e.target.files[0], "Camera photo");
$("#photoUpload").onchange = e => handleFile(e.target.files[0], "Uploaded photo");
$("#btnGallery").onclick = () => $("#photoUpload").click();
$("#photoRemove").onclick = clearPhoto;
$("#btnCamera").onclick = openCamera;

/* live camera (needs https or localhost; otherwise falls back to the device camera app) */
const cam = { stream: null, facing: "environment" };
function stopStream() {
  if (cam.stream) cam.stream.getTracks().forEach(t => t.stop());
  cam.stream = null;
  $("#camVideo").srcObject = null;
}
function camFail(msg) {
  $("#camErrorText").textContent = msg;
  $("#camError").hidden = false;
}
async function startStream() {
  stopStream();
  $("#camError").hidden = true;
  try {
    cam.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: cam.facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false
    });
    const v = $("#camVideo");
    v.srcObject = cam.stream;
    v.style.transform = cam.facing === "user" ? "scaleX(-1)" : "none";
    await v.play().catch(() => {});
  } catch (err) {
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    camFail(denied
      ? "Camera permission was blocked. Allow camera access in your browser settings, or use your device's camera app instead."
      : "No camera could be started on this device. You can use your device's camera app instead.");
  }
}
function openCamera() {
  if (!$("#reportForm").offsetParent) go("reports");
  const live = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext;
  if (!live) { $("#photoCapture").click(); return; }   // opens the phone's camera app directly
  $("#cameraModal").hidden = false;
  document.body.style.overflow = "hidden";
  startStream();
}
function closeCamera() {
  stopStream();
  $("#cameraModal").hidden = true;
  document.body.style.overflow = "";
}
$("#camClose").onclick = closeCamera;
$("#camFallback").onclick = () => { closeCamera(); $("#photoCapture").click(); };
$("#camFlip").onclick = () => { cam.facing = cam.facing === "environment" ? "user" : "environment"; startStream(); };
$("#camShot").onclick = async () => {
  const v = $("#camVideo");
  if (!v.videoWidth) return toast("Camera is still starting…");
  const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
  const ctx = c.getContext("2d");
  if (cam.facing === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(v, 0, 0, c.width, c.height);
  c.toBlob(b => {
    if (!b) return toast("Couldn't capture the photo. Try again.");
    closeCamera();
    setPhoto(b, "Camera photo");
    toast("Photo captured ✓");
  }, "image/jpeg", 0.82);
};
document.addEventListener("visibilitychange", () => { if (document.hidden && !$("#cameraModal").hidden) closeCamera(); });

/* GPS (optional) */
let geo = null;
$("#btnGps").onclick = () => {
  if (!navigator.geolocation) return toast("GPS is not available on this device.");
  const b = $("#btnGps"); b.disabled = true; b.textContent = "Locating…";
  navigator.geolocation.getCurrentPosition(p => {
    geo = { lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) };
    $("#gpsInfo").hidden = false;
    $("#gpsInfo").textContent = `📍 Location added (${geo.lat}, ${geo.lng} · ±${geo.acc} m). Still describe the place in words.`;
    b.disabled = false; b.textContent = "📍 GPS";
  }, () => {
    toast("Couldn't get your location. Check permissions.");
    b.disabled = false; b.textContent = "📍 GPS";
  }, { enableHighAccuracy: true, timeout: 12000 });
};

/* ---------------- report form ---------------- */
$("#reportForm").addEventListener("submit", async e => {
  e.preventDefault();
  const type = $("#wasteType").value, location = $("#location").value.trim(), description = $("#description").value.trim();
  if (!type || !location || !description) return toast("Please fill in the category, location, and description.");
  const btn = $("#reportSubmit"); btn.disabled = true;
  const id = Date.now();
  const report = { id, type, location, description, status: "Pending", owner: data.session, created: new Date().toISOString() };
  if (geo) report.geo = geo;
  if (pending.blob) {
    const pid = "p" + id;
    if (await DB.put(pid, pending.blob)) report.photoId = pid;
    else report.photoInline = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(pending.blob); });
  }
  data.reports.push(report);
  const bonus = hasPhoto(report) ? 3 : 0;
  addPoints(5 + bonus);
  if (!persist()) { data.reports.pop(); addPoints(-(5 + bonus)); btn.disabled = false; return; }
  e.target.reset(); clearPhoto(); geo = null; $("#gpsInfo").hidden = true;
  btn.disabled = false;
  render();
  toast(`Report saved on this device. +${5 + bonus} EcoPoints`);
});

/* ---------------- events ---------------- */
$("#eventForm").addEventListener("submit", e => {
  e.preventDefault();
  const d = new Date($("#eventDate").value);
  if (isNaN(d)) return toast("Please choose a valid date and time.");
  data.events.push({ id: Date.now(), name: $("#eventName").value.trim(), date: d.toISOString(), place: $("#eventPlace").value.trim(), details: $("#eventDetails").value.trim(), base: 0, joinedBy: [] });
  e.target.reset(); save(); toast("Cleanup event published on this device");
});

/* ---------------- quiz ---------------- */
const QUIZ = [
  { q: "Where should used household batteries go?", o: ["With food scraps", "Separate special-waste collection", "Loose in any recycling bin"], a: 1, why: "Batteries are special waste and need separate handling." },
  { q: "Which bin is best for banana peels and leaves?", o: ["Biodegradable", "Recyclable", "Special / hazardous"], a: 0, why: "Organic materials belong with biodegradable waste or compost." },
  { q: "What should you do with clean, dry cardboard?", o: ["Burn it outdoors", "Recycle it where accepted", "Mix it with wet food waste"], a: 1, why: "Keeping paper and cardboard clean and dry makes it recyclable." },
  { q: "What is the safest way to join a cleanup?", o: ["Wear gloves and closed shoes", "Pick up sharp items bare-handed", "Wade into the creek to reach trash"], a: 0, why: "Protective gear keeps you safe. Never touch sharps or enter waterways." }
];
let qi = 0;
function renderQuiz(answered) {
  const q = QUIZ[qi], done = (me() && me().quizDone) || [];
  $("#quizBox").innerHTML = `
    <div class="report-top"><h3>Quick knowledge check</h3><span class="tag">${qi + 1} / ${QUIZ.length}</span></div>
    <p class="quiz-q">${escapeHTML(q.q)}</p>
    <div class="quiz-options">${q.o.map((t, i) => `<button data-q="${i}" ${answered != null ? "disabled" : ""} class="${answered != null ? (i === q.a ? "right" : i === answered ? "wrong" : "") : ""}">${escapeHTML(t)}</button>`).join("")}</div>
    <div class="quiz-meta"><p class="hint" aria-live="polite">${answered == null ? "Choose an answer. First correct answers earn +2 EcoPoints." : (answered === q.a ? "Correct! " : "Not quite. ") + escapeHTML(q.why)}</p>
    ${answered != null ? `<button class="secondary" id="nextQ">Next question →</button>` : ""}</div>`;
  $$("[data-q]", $("#quizBox")).forEach(b => b.onclick = () => {
    const pick = Number(b.dataset.q);
    if (pick === q.a && me() && !done.includes(qi)) { me().quizDone = [...done, qi]; addPoints(2); persist(); render(); toast("Correct! +2 EcoPoints"); }
    renderQuiz(pick);
  });
  const n = $("#nextQ"); if (n) n.onclick = () => { qi = (qi + 1) % QUIZ.length; renderQuiz(); };
}

/* ---------------- profile ---------------- */
$("#saveName").onclick = () => {
  const n = $("#displayName").value.trim();
  if (!n) return toast("Enter a display name first.");
  if (!me()) return;
  if (me().guest) return toast("Create an account to change your name.");
  me().name = n; save(); toast("Display name saved");
};
$("#adminApprove").onclick = () => {
  const r = data.reports.find(x => x.status === "Pending");
  if (!r) return toast("No pending reports.");
  r.status = "Approved"; save(); toast("Demo action: report approved");
};
$("#adminResolve").onclick = () => {
  const r = data.reports.find(x => x.status === "Approved");
  if (!r) return toast("No approved reports to resolve.");
  r.status = "Resolved"; addPoints(5); save(); toast("Demo action: report resolved · +5 EcoPoints");
};
$("#resetData").onclick = async () => {
  if (!confirm("Delete ALL LinisLoop data on this device (accounts, reports, photos, events)? This cannot be undone.")) return;
  localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY);
  await DB.clear();
  urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
  data = normalize({});
  $("#logoutBtn").onclick();
  toast("All local data deleted");
};

async function updateStorageInfo() {
  const photos = data.reports.filter(hasPhoto).length;
  let extra = "";
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const s = await navigator.storage.estimate();
      extra = ` · ${fmtBytes(s.usage || 0)} used`;
      if (navigator.storage.persisted && await navigator.storage.persisted()) extra += " · protected from auto-clean";
    }
  } catch {}
  $("#storageInfo").textContent = `${data.reports.length} report(s), ${photos} photo(s), ${Object.keys(data.users).length} account(s)${extra}`;
}

/* backup / restore */
const blobToDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const dataURLToBlob = u => fetch(u).then(r => r.blob());
$("#exportBtn").onclick = async () => {
  try {
    toast("Preparing backup…");
    const photos = {};
    for (const r of data.reports) if (r.photoId) { const b = await DB.get(r.photoId); if (b) photos[r.photoId] = await blobToDataURL(b); }
    const out = JSON.stringify({ app: "LinisLoop", version: 2, exported: new Date().toISOString(), data, photos });
    await saveFile("linisloop-backup-" + new Date().toISOString().slice(0, 10) + ".json", out);
    toast("Backup file saved");
  } catch { toast("Couldn't create the backup."); }
};
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== "LinisLoop" || !j.data) throw new Error("bad");
    if (!confirm("Restore this backup? It will replace the data currently on this device.")) return;
    await DB.clear();
    urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
    for (const [id, url] of Object.entries(j.photos || {})) await DB.put(id, await dataURLToBlob(url));
    data = normalize(j.data);
    if (!data.users[data.session]) data.session = null;
    persist();
    if (!data.session) { $("#logoutBtn").onclick(); } else render();
    toast("Backup restored");
  } catch { toast("That file isn't a valid LinisLoop backup."); }
};

/* ---------------- online status, install, service worker ---------------- */
function setOnline() {
  const el = $("#onlineStatus"), on = navigator.onLine;
  el.textContent = on ? "● Online" : "● Offline";
  el.classList.toggle("off", !on);
}
window.addEventListener("online", setOnline); window.addEventListener("offline", setOnline);
let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; $("#installBtn").hidden = false; });
$("#installBtn").onclick = async () => {
  if (!installPrompt) return toast("Use your browser menu and choose Install app or Add to Home screen.");
  installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $("#installBtn").hidden = true;
};
if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("./sw.js").catch(() => {});

/* ---------------- v3: motion, points & polish ---------------- */
function burst(n = 22) {
  const cols = ["#f7c948", "#2fb67a", "#8f8bff", "#ff8a65", "#5ec8ff"];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i"), a = Math.random() * 6.28, d = 90 + Math.random() * 150;
    s.className = "confetti"; s.style.background = cols[i % cols.length];
    s.style.setProperty("--x", Math.cos(a) * d + "px"); s.style.setProperty("--y", Math.sin(a) * d - 40 + "px");
    document.body.appendChild(s); setTimeout(() => s.remove(), 1000);
  }
}
const _toast = toast;
toast = function (m) { _toast(m); if (/\+\d+ EcoPoints/.test(m)) { burst(); if (navigator.vibrate) navigator.vibrate(30); } };

function countUp(el) {
  const to = Number(el.textContent) || 0, from = el._v || 0;
  el._v = to; if (from === to) return;
  const t0 = performance.now();
  (function step(t) {
    const p = Math.min(1, (t - t0) / 700);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
const REVEAL = ".stat,.action-card,.learn-card,.activity,.report-card,.event-card,.points-card,.welcome-card";
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add("in"); io.unobserve(e.target);
  setTimeout(() => e.target.classList.remove("reveal", "in"), 900);
}), { threshold: .05 }) : null;
function reveal() {
  if (!io) return;
  $$(".page.active").forEach(pg => $$(REVEAL, pg).forEach((el, i) => {
    if (el._seen) return; el._seen = 1;
    el.classList.add("reveal"); el.style.setProperty("--d", Math.min(i, 8) * 0.06 + "s"); io.observe(el);
  }));
}
function updatePoints() {
  const u = me(); if (!u) return;
  const p = u.points || 0, lv = [0, 20, 50], i = p >= 50 ? 2 : p >= 20 ? 1 : 0;
  const frac = i === 2 ? 1 : (p - lv[i]) / (lv[i + 1] - lv[i]);
  $("#pcLevel").textContent = levelFor(p);
  $("#pcNext").textContent = i === 2 ? "Top level reached. Keep cleaning! 🎉" : `${lv[i + 1] - p} more points to ${levelFor(lv[i + 1])}`;
  requestAnimationFrame(() => { $("#ringFg").style.strokeDashoffset = 327 * (1 - frac); $("#pcBar").style.width = frac * 100 + "%"; });
  const mine = data.reports.filter(r => r.owner === data.session).length, joined = data.events.some(e => e.joinedBy.includes(data.session));
  const B = [["📸", "First report", mine >= 1], ["🧤", "Volunteer", joined], ["🧠", "Quiz whiz", (u.quizDone || []).length >= QUIZ.length], ["🌿", "Eco Sprout", p >= 20], ["🌳", "Guardian", p >= 50]];
  const box = $("#badges"), sig = B.map(b => +b[2]).join("");
  if (box.dataset.s !== sig) { box.dataset.s = sig; box.innerHTML = B.map(b => `<div class="badge-i ${b[2] ? "on" : ""}"><b>${b[2] ? b[0] : "🔒"}</b>${b[1]}</div>`).join(""); }
}
const _render = render;
render = function () { _render(); if (!data.session) return; updatePoints(); $$(".stat strong,#myPoints").forEach(countUp); reveal(); };
const _go = go;
go = function (t) {
  _go(t);
  const pg = $("#page-" + t); if (!pg) return;
  $$(REVEAL, pg).forEach(el => { el._seen = 0; });
  $$(".stat strong,#myPoints", pg).forEach(el => { const v = el._v || 0; el._v = 0; el.textContent = v; countUp(el); });
  if (t === "profile") { $("#ringFg").style.strokeDashoffset = 327; $("#pcBar").style.width = "0"; delete $("#badges").dataset.s; }
  setTimeout(() => { updatePoints(); reveal(); }, 40);
};

$$(".learn-card").forEach((c, i) => {
  c.classList.add("c" + i); c.tabIndex = 0;
  const toggle = () => { const open = c.classList.toggle("open"); c.setAttribute("aria-expanded", String(open)); };
  c.onclick = toggle;
  c.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
});
["reportSearch","reportFilter"].forEach(id => {
  const el = $("#" + id);
  if (el) el.addEventListener(id === "reportSearch" ? "input" : "change", () => {
    const list = $("#reportList");
    const searchTerm = ($("#reportSearch").value || "").trim().toLowerCase();
    const status = $("#reportFilter").value;
    const filtered = [...data.reports].reverse().filter(r =>
      (status === "all" || r.status === status) &&
      (!searchTerm || [r.type,r.location,r.description,ownerName(r.owner)].some(v => String(v).toLowerCase().includes(searchTerm)))
    );
    // Re-render through the canonical renderer so photos and actions remain intact.
    render();
  });
});
$$(".panel.spaced").forEach(p => {
  const h = p.querySelector(":scope>h3"); if (!h) return;
  p.classList.add("collapsible");
  if (/Coordinator|Saved on/.test(h.textContent)) p.classList.add("collapsed");
  h.onclick = () => p.classList.toggle("collapsed");
});
setTimeout(() => { const s = $("#splash"); if (s) s.classList.add("hide"); }, 1300);

/* save a file: native share sheet inside the Android app, normal download in a browser */
async function saveFile(name, text) {
  const C = window.Capacitor, P = C && C.Plugins;
  if (C && C.isNativePlatform && C.isNativePlatform() && P && P.Filesystem && P.Share) {
    const f = await P.Filesystem.writeFile({ path: name, data: text, directory: "CACHE", encoding: "utf8" });
    await P.Share.share({ title: name, url: f.uri, dialogTitle: "Save LinisLoop backup" });
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------------- start ---------------- */
(async function init() {
  await DB.open();
  setOnline();
  setAuthMode("login");
  renderQuiz();
  if (data.session && data.users[data.session]) showApp();
  else { data.session = null; $("#loginScreen").hidden = false; }
})();
