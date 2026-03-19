// ═══════════════════════════════════════════════════════════════
// firebase.js — Grace Ministry India
// Replace placeholder values with your real Firebase config.
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// initFirebase
// ─────────────────────────────────────────────────────────────
function initFirebase() {
  try {
    if (typeof firebase === "undefined") { console.warn("Firebase SDK not loaded."); return; }
    if (firebaseConfig.apiKey === "YOUR_API_KEY") { console.warn("Firebase not configured — offline mode."); return; }
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    window.db     = firebase.firestore();
    window.fbAuth = firebase.auth();

    window.fbAuth.onAuthStateChanged(async user => {
      window.currentUser = user;
      window.isAdmin     = false;
      if (user) {
        try {
          const adminDoc = await window.db.collection("admins").doc(user.uid).get();
          window.isAdmin = adminDoc.exists;
        } catch(e) {}
        if (document.getElementById("admin-panel")?.classList.contains("on")) renderAdminDash();
      }
    });

    if (firebase.messaging?.isSupported()) {
      window.fbMessaging = firebase.messaging();
      initFCM();
    }

    // Load all dynamic data
    loadVerseFromFirestore();
    loadSermonsFromFirestore();
    loadEventsFromFirestore();
    loadAnnouncementsFromFirestore();
    loadLiveServiceStatus();
    loadTodayDevotional();
    loadMediaFeed();
    loadCommunityFeed();
    loadPrayerWall();

    console.log("✅ Firebase connected");
  } catch (err) { console.error("Firebase init error:", err.message); }
}

// ─────────────────────────────────────────────────────────────
// FCM
// ─────────────────────────────────────────────────────────────
async function initFCM() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const token = await window.fbMessaging.getToken({ vapidKey: FCM_VAPID_KEY });
    if (token && window.db) {
      await window.db.collection("fcm_tokens").doc(token).set({
        token, createdAt: new Date().toISOString(),
        platform: navigator.userAgent.includes("Mobi") ? "mobile" : "desktop"
      });
    }
    window.fbMessaging.onMessage(payload => {
      const n = payload.notification || {};
      showInAppNotification(n.title || "Grace Ministry", n.body || "");
    });
  } catch (err) { console.warn("FCM error:", err.message); }
}

function showInAppNotification(title, body) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);background:var(--bg-mid);border:1px solid var(--gold);border-radius:14px;padding:12px 18px;max-width:360px;width:90%;z-index:999;display:flex;gap:10px;align-items:flex-start;box-shadow:0 8px 32px #000a;";
  el.innerHTML = `<div style="font-size:20px">🔔</div><div><div style="font-size:14px;font-weight:600;color:var(--gold-text)">${title}</div><div style="font-size:12px;color:var(--text-muted);margin-top:3px">${body}</div></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ─────────────────────────────────────────────────────────────
// DAILY VERSE (Firestore override)
// ─────────────────────────────────────────────────────────────
async function loadVerseFromFirestore() {
  if (!window.db) return;
  try {
    const doc = await window.db.collection("settings").doc("daily_verse").get();
    if (doc.exists) {
      const v = doc.data();
      const vEl = document.getElementById("daily-verse-text");
      const rEl = document.getElementById("daily-verse-ref");
      const dateEl = document.getElementById("verse-date-tag");
      
      if (vEl && v.text) vEl.textContent = "\u201c" + v.text + "\u201d";
      if (rEl && v.ref)  rEl.textContent = "\u2014 " + v.ref;
      
      // Update date tag if date field exists
      if (dateEl && v.date) {
        const dateObj = new Date(v.date);
        const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        dateEl.textContent = "Daily Verse \u00b7 " + MO[dateObj.getMonth()] + " " + dateObj.getDate();
      }
    } else { loadDailyVerseFromAPI(); }
  } catch { loadDailyVerseFromAPI(); }
}

// ─────────────────────────────────────────────────────────────
// LIVE SERVICE STATUS
// ─────────────────────────────────────────────────────────────
async function loadLiveServiceStatus() {
  if (!window.db) return;
  try {
    const snap = await window.db.collection("live_services")
      .where("isLive", "==", true).limit(1).get();

    const card    = document.getElementById("live-service-card");
    const titleEl = document.getElementById("live-title");
    const subEl   = document.getElementById("live-sub");
    const pulseEl = document.getElementById("live-pulse");
    const badgeEl = document.getElementById("live-badge");

    if (!snap.empty && card) {
      const ls = snap.docs[0].data();
      card.href = ls.youtubeURL || "https://www.youtube.com/@GraceMinistryMangalore/live";
      card.classList.add("live-active");
      if (titleEl) titleEl.innerHTML = (ls.title || "Live Service") + ' <span class="live-badge" id="live-badge">LIVE</span>';
      if (subEl)   subEl.textContent  = ls.startTime ? "Started at " + ls.startTime : "Streaming now";
      if (pulseEl) pulseEl.classList.remove("offline");
    } else if (card) {
      card.href = "https://www.youtube.com/@GraceMinistryMangalore/live";
      card.classList.remove("live-active");
      if (titleEl) titleEl.textContent = "Watch Live Service";
      if (subEl)   subEl.textContent   = "Sundays 10:00 AM · Grace Ministry Mangalore";
      if (pulseEl) pulseEl.classList.add("offline");
    }
  } catch (err) { console.warn("Live service error:", err.message); }
}

// ─────────────────────────────────────────────────────────────
// TODAY'S DEVOTIONAL
// ─────────────────────────────────────────────────────────────
async function loadTodayDevotional() {
  if (!window.db) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const snap  = await window.db.collection("devotionals")
      .orderBy("createdAt", "desc").limit(1).get();

    if (snap.empty) return;
    const d = snap.docs[0].data();
    window._latestDevotional = d;

    // Update home preview
    const prev = document.getElementById("devot-preview");
    if (prev) {
      document.getElementById("devot-preview-title").textContent  = d.title || "Today's Devotional";
      document.getElementById("devot-preview-verse").textContent  = d.verse  || "";
      prev.style.display = "block";
    }

    // Update devotional screen
    renderDevotionalScreen(d);
  } catch (err) { console.warn("Devotional error:", err.message); }
}

function renderDevotionalScreen(d) {
  const container = document.getElementById("devot-content");
  if (!container || !d) return;
  const dateStr = d.date || d.createdAt?.slice(0,10) || new Date().toISOString().slice(0,10);
  container.innerHTML = `
    <div class="devot-card">
      <div class="devot-card-header">
        <div class="devot-date">📖 Devotional · ${dateStr}</div>
        <div class="devot-title">${d.title || ""}</div>
      </div>
      <div class="devot-body">
        <div class="devot-verse-block">
          <div class="devot-verse-text">${d.verse || ""}</div>
        </div>
        <div class="devot-message">${(d.message || "").replace(/\n/g, "<br>")}</div>
        ${d.prayer ? `<div class="devot-prayer-block">
          <div class="devot-prayer-label">🙏 Prayer</div>
          <div class="devot-prayer-text">${d.prayer}</div>
        </div>` : ""}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// SERMONS
// ─────────────────────────────────────────────────────────────
async function loadSermonsFromFirestore() {
  if (!window.db) return;
  try {
    const snap = await window.db.collection("sermons")
      .orderBy("createdAt", "desc").limit(12).get();
    if (snap.empty) return;
    const container = document.getElementById("sermons-list");
    if (!container) return;
    container.innerHTML = "";
    snap.forEach(doc => {
      const s = doc.data();
      const row = document.createElement("a");
      row.href = s.youtubeLink || "https://www.youtube.com/@GraceMinistryMangalore";
      row.target = "_blank"; row.className = "sermon-row";
      row.innerHTML = `<div class="thumb"><div class="play-tri"></div></div>
        <div style="flex:1"><div class="s-title">${s.title||"Sermon"}</div>
        <div class="s-meta">${s.speaker||""} · ${s.date||""}</div>
        <div class="s-dur">▶ Watch on YouTube</div></div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334455" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
      container.appendChild(row);
    });
  } catch (err) { console.warn("Sermons error:", err.message); }
}

// ─────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────
async function loadEventsFromFirestore() {
  if (!window.db) return;
  try {
    const snap = await window.db.collection("events")
      .orderBy("createdAt", "desc").limit(10).get();
    if (snap.empty) return;
    const container = document.getElementById("events-list");
    if (!container) return;
    container.innerHTML = "";
    snap.forEach(doc => {
      const ev = doc.data();
      
      // Handle date conversion if only "date" field exists (YYYY-MM-DD format)
      let day = ev.day;
      let month = ev.month;
      
      if (!day || !month) {
        if (ev.date) {
          const dateObj = new Date(ev.date);
          day = dateObj.getDate();
          month = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][dateObj.getMonth()];
        }
      }
      
      const row = document.createElement("div");
      row.className = "event-row";
      row.innerHTML = `<div style="width:38px;text-align:center">
        <div class="e-day">${day||""}</div>
        <div class="e-mon">${month||""}</div></div>
        <div style="flex:1"><div class="e-title">${ev.title||""}</div>
        <div class="e-time">${ev.time||""} · ${ev.location||""}</div></div>
        <a href="https://wa.me/919880093988?text=Register%3A%20${encodeURIComponent(ev.title||'')}"
           target="_blank" class="reg-btn"><div class="reg-txt">Register</div></a>`;
      container.appendChild(row);
    });
  } catch (err) { console.warn("Events error:", err.message); }
}

// ─────────────────────────────────────────────────────────────
// ANNOUNCEMENTS
// ─────────────────────────────────────────────────────────────
async function loadAnnouncementsFromFirestore() {
  if (!window.db) return;
  try {
    const snap = await window.db.collection("announcements")
      .orderBy("createdAt", "desc").limit(5).get();
    if (snap.empty) return;
    const panel = document.getElementById("notif-list");
    if (!panel) return;
    panel.innerHTML = "";
    snap.forEach(doc => {
      const a = doc.data();
      const item = document.createElement("div");
      item.className = "notif-item";
      item.innerHTML = `<div class="notif-msg">${a.emoji||"📣"} ${a.message||""}</div>
        <div class="notif-time">${a.createdAt?a.createdAt.slice(0,10):""}</div>`;
      panel.appendChild(item);
    });
  } catch (err) { console.warn("Announcements error:", err.message); }
}

// ─────────────────────────────────────────────────────────────
// MEDIA FEED
// ─────────────────────────────────────────────────────────────
async function loadMediaFeed(filter) {
  if (!window.db) return;
  try {
    let q = window.db.collection("media").orderBy("createdAt", "desc").limit(20);
    const snap = await q.get();
    if (snap.empty) { renderMediaEmpty(); return; }
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Media page shows only reels and videos — sermons have their own screen
    const filtered = filter && filter !== "all"
      ? items.filter(i => i.type === filter)
      : items.filter(i => i.type === "reel" || i.type === "video");
    renderMediaCards(filtered);
  } catch (err) { console.warn("Media error:", err.message); }
}

function renderMediaCards(items) {
  const container = document.getElementById("media-grid");
  if (!container) return;
  if (!items.length) { container.innerHTML = '<div class="devot-empty">No media yet. Check back soon!</div>'; return; }
  container.innerHTML = items.map(m => {
    const typeClass = "media-type-" + (m.type || "video");
    const typeLabel = (m.type || "VIDEO").toUpperCase();
    const thumb = m.thumbnail
      ? `<img src="${m.thumbnail}" alt="${m.title}" onerror="this.style.display='none'">`
      : `<div class="media-play-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="var(--gold)"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>`;
    return `<div class="media-card" onclick="window.open('${m.videoURL||"#"}','_blank')">
      <div class="media-thumb">${thumb}
        <div class="media-play-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="var(--gold)"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        <div class="media-type-badge ${typeClass}">${typeLabel}</div>
      </div>
      <div class="media-info">
        <div class="media-title">${m.title||"Media"}</div>
        <div class="media-meta">${m.uploadedBy||"Grace Ministry"} · ${(m.createdAt||"").slice(0,10)}</div>
      </div></div>`;
  }).join("");
}

function renderMediaEmpty() {
  const container = document.getElementById("media-grid");
  if (container) container.innerHTML = '<div class="devot-empty">No media yet. Check back soon!</div>';
}

// ─────────────────────────────────────────────────────────────
// COMMUNITY FEED
// ─────────────────────────────────────────────────────────────
async function loadCommunityFeed() {
  if (!window.db) return;
  try {
    const snap = await window.db.collection("posts")
      .orderBy("createdAt", "desc").limit(20).get();
    const container = document.getElementById("community-feed");
    if (!container) return;
    if (snap.empty) {
      container.innerHTML = '<div class="devot-empty">No posts yet.</div>';
      return;
    }
    container.innerHTML = snap.docs.map(doc => {
      const p = doc.data();
      const initials = (p.postedBy || "GM").slice(0,2).toUpperCase();
      const imgHtml = p.imageURL
        ? `<img class="post-image" src="${p.imageURL}" alt="post" onerror="this.style.display='none'">`
        : "";
      return `<div class="post-card">
        <div class="post-header">
          <div class="post-avatar">${initials}</div>
          <div><div class="post-author">${p.postedBy||"Grace Ministry"}</div>
          <div class="post-time">${(p.createdAt||"").slice(0,10)}</div></div>
        </div>
        ${imgHtml}
        <div class="post-body">
          ${p.title ? `<div class="post-title">${p.title}</div>` : ""}
          <div class="post-desc">${(p.description||"").replace(/\n/g,"<br>")}</div>
        </div>
        <div class="post-actions">
          <button class="post-action-btn">🙏 Pray</button>
          <button class="post-action-btn">💬 Amen</button>
          <button class="post-action-btn" onclick="sharePost('${p.title||""}')">↗ Share</button>
        </div>
      </div>`;
    }).join("");
  } catch (err) { console.warn("Community feed error:", err.message); }
}

function sharePost(title) {
  const text = "Check this out from Grace Ministry India: " + title + " — https://www.graceministryindia.org";
  if (navigator.share) { navigator.share({ text }).catch(()=>{}); }
  else { window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank"); }
}

// ─────────────────────────────────────────────────────────────
// PRAYER WALL
// ─────────────────────────────────────────────────────────────
async function loadPrayerWall() {
  if (!window.db) return;
  try {
    const snap = await window.db.collection("prayer_wall")
      .orderBy("createdAt", "desc").limit(30).get();
    const container = document.getElementById("prayer-wall-list");
    if (!container) return;
    if (snap.empty) {
      container.innerHTML = '<div class="devot-empty">Be the first to post a prayer request 🙏</div>';
      return;
    }
    container.innerHTML = snap.docs.map(doc => {
      const p = doc.data();
      return `<div class="prayer-wall-card">
        <div class="prayer-wall-name">🙏 ${p.name||"Anonymous"}</div>
        <div class="prayer-wall-msg">${(p.message||"").replace(/</g,"&lt;")}</div>
        <div class="prayer-wall-footer">
          <div class="prayer-wall-time">${(p.createdAt||"").slice(0,10)}</div>
          <button class="pray-btn" id="pray-${doc.id}" onclick="prayForRequest('${doc.id}',this)">
            🙏 Pray <span>(${p.prayersCount||0})</span>
          </button>
        </div>
      </div>`;
    }).join("");
  } catch (err) { console.warn("Prayer wall error:", err.message); }
}

async function submitPrayerWall() {
  const nameEl = document.getElementById("pw-name");
  const msgEl  = document.getElementById("pw-msg");
  const name   = nameEl?.value?.trim() || "Anonymous";
  const msg    = msgEl?.value?.trim();
  if (!msg) { alert("Please enter a prayer request."); return; }
  if (!window.db) { alert("Not connected. Please try again."); return; }
  try {
    await window.db.collection("prayer_wall").add({
      name, message: msg, prayersCount: 0,
      createdAt: new Date().toISOString()
    });
    if (nameEl) nameEl.value = "";
    if (msgEl)  msgEl.value  = "";
    loadPrayerWall();
  } catch (err) { alert("Error: " + err.message); }
}

async function prayForRequest(docId, btn) {
  if (!window.db) return;
  try {
    const ref  = window.db.collection("prayer_wall").doc(docId);
    const doc  = await ref.get();
    const curr = doc.data()?.prayersCount || 0;
    await ref.update({ prayersCount: curr + 1 });
    btn.classList.add("prayed");
    btn.innerHTML = `🙏 Prayed <span>(${curr + 1})</span>`;
    btn.disabled = true;
  } catch (err) { console.warn("Pray error:", err.message); }
}

// ─────────────────────────────────────────────────────────────
// VOLUNTEER
// ─────────────────────────────────────────────────────────────
async function joinTeam(team, btn) {
  if (!window.currentUser) { alert("Please sign in to join a team."); switchTab("login"); return; }
  if (!window.db) { btn.textContent = "Joined ✓"; btn.classList.add("joined"); return; }
  try {
    await window.db.collection("volunteers").add({
      userId: window.currentUser.uid,
      name: window.currentUser.displayName || "",
      email: window.currentUser.email || "",
      team, joinedAt: new Date().toISOString()
    });
    btn.textContent = "Joined ✓";
    btn.classList.add("joined");
    btn.disabled = true;

    // Also send WhatsApp confirmation
    const msg = encodeURIComponent("Hi Grace Ministry! I'd like to join the " + team + " team. — " + (window.currentUser.displayName || ""));
    window.open("https://wa.me/919880093988?text=" + msg, "_blank");
  } catch (err) { alert("Error: " + err.message); }
}

// ─────────────────────────────────────────────────────────────
// PRAYER → FIRESTORE
// ─────────────────────────────────────────────────────────────
async function savePrayerToFirestore(name, message, urgency, prayerType, city) {
  if (!window.db) return;
  try {
    await window.db.collection("prayer_requests").add({
      name, message, urgency, type: prayerType, city,
      timestamp: new Date().toISOString(),
      uid: window.currentUser?.uid || null
    });
  } catch (err) { console.warn("Prayer save error:", err.message); }
}

// ─────────────────────────────────────────────────────────────
// MEMBER PROFILE
// ─────────────────────────────────────────────────────────────
async function saveMemberProfile(uid, data) {
  if (!window.db) return;
  await window.db.collection("users").doc(uid).set({ role: data.role || 'user', ...data }, { merge: true });
}

async function getMemberProfile(uid) {
  if (!window.db) return null;
  const doc = await window.db.collection("users").doc(uid).get();
  return doc.exists ? doc.data() : null;
}

async function getAllUsers() {
  if (!window.db) return [];
  const snap = await window.db.collection("users").orderBy("createdAt","desc").limit(50).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function promoteUserToAdmin(uid) {
  // This requires a Cloud Function. Queue the promotion request.
  if (!window.db) return;
  await window.db.collection("admin_requests").add({
    uid, action: "promote", requestedAt: new Date().toISOString(),
    requestedBy: window.currentUser?.uid
  });
  showInAppNotification("Admin request queued", "Cloud Function will process this shortly.");
}

async function revokeAdminRole(uid) {
  if (!window.db) return;
  await window.db.collection("admin_requests").add({
    uid, action: "revoke", requestedAt: new Date().toISOString(),
    requestedBy: window.currentUser?.uid
  });
  showInAppNotification("Revoke request queued", "Cloud Function will process this shortly.");
}

// ─────────────────────────────────────────────────────────────
// FCM QUEUE HELPER (used by admin)
// ─────────────────────────────────────────────────────────────
async function sendFCMNotification(title, body, data = {}) {
  if (!window.db) return;
  try {
    await window.db.collection("notifications_queue").add({
      title, body, data, createdAt: new Date().toISOString(), sent: false
    });
  } catch (err) { console.warn("FCM queue error:", err.message); }
}
