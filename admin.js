// ═══════════════════════════════════════════════════════════════
// admin.js — Grace Ministry India
// All admin panel logic. Requires firebase.js.
// Access: navigate to /#admin
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// ADMIN PANEL — OPEN / CLOSE / AUTH
// ─────────────────────────────────────────────────────────────
function openAdmin() {
  document.getElementById("admin-panel")?.classList.add("on");
  if (window.currentUser) {
    window.currentUser.getIdTokenResult()
      .then(t => t.claims.admin ? showAdminDash() : showAdminLogin())
      .catch(() => showAdminLogin());
  } else { showAdminLogin(); }
}

function closeAdmin() {
  document.getElementById("admin-panel")?.classList.remove("on");
}

function showAdminLogin() {
  const loginView = document.getElementById("admin-login-view");
  const dashView  = document.getElementById("admin-dash");
  if (loginView) loginView.style.display = "block";
  if (dashView)  dashView.style.display  = "none";
  const errEl = document.getElementById("admin-err");
  if (errEl) errEl.style.display = "none";
}

function showAdminDash() {
  const loginView = document.getElementById("admin-login-view");
  const dashView  = document.getElementById("admin-dash");
  if (loginView) loginView.style.display = "none";
  if (dashView)  dashView.style.display  = "block";
  renderAdminDash();
}

async function adminSignIn() {
  const email  = document.getElementById("admin-email")?.value?.trim();
  const pw     = document.getElementById("admin-pw")?.value;
  const errEl  = document.getElementById("admin-err");
  if (!email || !pw) { showAdminErr("Enter email and password."); return; }
  try {
    if (!window.fbAuth) { showAdminErr("Firebase not configured."); return; }
    const cred  = await window.fbAuth.signInWithEmailAndPassword(email, pw);
    const adminDoc = await window.db.collection("admins").doc(cred.user.uid).get();
    if (!adminDoc.exists) {
      await window.fbAuth.signOut();
      showAdminErr("You do not have admin access. Contact the church administrator.");
      return;
    }
    window.isAdmin = true;
    showAdminDash();
  } catch (err) { showAdminErr(err.message); }
}

async function adminSignOut() {
  if (window.fbAuth) await window.fbAuth.signOut();
  window.isAdmin = false;
  showAdminLogin();
}

function showAdminErr(msg) {
  const el = document.getElementById("admin-err");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

// Hash-based access
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#admin") openAdmin();
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.hash === "#admin") openAdmin();
  });
}

// ─────────────────────────────────────────────────────────────
// RENDER DASHBOARD — load all data
// ─────────────────────────────────────────────────────────────
function renderAdminDash() {
  loadAdminPrayers();
  loadAdminSermons();
  loadAdminEvents();
  loadAdminUsers();
  loadAdminMedia();
  loadAdminLiveStatus();
}

// ─────────────────────────────────────────────────────────────
// ADD SERMON
// ─────────────────────────────────────────────────────────────
async function adminAddSermon() {
  const title   = document.getElementById("adm-s-title")?.value?.trim();
  const speaker = document.getElementById("adm-s-speaker")?.value?.trim();
  const url     = document.getElementById("adm-s-url")?.value?.trim();
  const date    = document.getElementById("adm-s-date")?.value?.trim();
  const cat     = document.getElementById("adm-s-category")?.value?.trim() || "General";
  if (!title || !url) { alert("Title and YouTube URL are required."); return; }

  const btn = document.getElementById("adm-s-btn");
  if (btn) btn.textContent = "Adding...";
  try {
    const docRef = await window.db.collection("sermons").add({
      title, speaker, youtubeLink: url, date, category: cat,
      createdAt: new Date().toISOString()
    });
    await sendFCMNotification("🎙️ New Sermon: " + title,
      (speaker ? "By " + speaker + " · " : "") + "Watch now on YouTube",
      { type: "sermon", id: docRef.id });

    showAdminSuccess("adm-s-success", "✅ Sermon added!");
    ["adm-s-title","adm-s-speaker","adm-s-url","adm-s-date","adm-s-category"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    loadSermonsFromFirestore?.();
    loadAdminSermons();
  } catch (err) { alert("Error: " + err.message); }
  if (btn) btn.textContent = "Add Sermon";
}

async function loadAdminSermons() {
  const c = document.getElementById("adm-sermons-count");
  if (!c || !window.db) return;
  try {
    const snap = await window.db.collection("sermons").orderBy("createdAt","desc").limit(5).get();
    c.innerHTML = snap.empty ? '<p style="font-size:12px;color:var(--text-muted);text-align:center">No sermons yet.</p>'
      : snap.docs.map(doc => {
          const s = doc.data();
          return `<div class="prayer-req-item">
            <div class="prayer-req-name">${s.title||""}</div>
            <div class="prayer-req-meta">${s.speaker||""} · ${s.date||""} · ${s.category||""}</div>
          </div>`;
        }).join("");
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// ADD DEVOTIONAL
// ─────────────────────────────────────────────────────────────
async function adminAddDevotional() {
  const title   = document.getElementById("adm-d-title")?.value?.trim();
  const verse   = document.getElementById("adm-d-verse")?.value?.trim();
  const message = document.getElementById("adm-d-message")?.value?.trim();
  const prayer  = document.getElementById("adm-d-prayer")?.value?.trim();
  const date    = document.getElementById("adm-d-date")?.value?.trim()
                  || new Date().toISOString().slice(0,10);
  if (!title || !verse || !message) { alert("Title, verse, and message are required."); return; }

  const btn = document.getElementById("adm-d-btn");
  if (btn) btn.textContent = "Publishing...";
  try {
    await window.db.collection("devotionals").add({
      title, verse, message, prayer, date,
      createdAt: new Date().toISOString()
    });
    await sendFCMNotification("📖 Today's Devotional: " + title,
      verse.slice(0,80) + (verse.length > 80 ? "..." : ""),
      { type: "devotional" });

    showAdminSuccess("adm-d-success", "✅ Devotional published!");
    ["adm-d-title","adm-d-verse","adm-d-message","adm-d-prayer","adm-d-date"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    loadTodayDevotional?.();
  } catch (err) { alert("Error: " + err.message); }
  if (btn) btn.textContent = "Publish Devotional";
}

// ─────────────────────────────────────────────────────────────
// LIVE SERVICE — START / STOP
// ─────────────────────────────────────────────────────────────
async function adminStartLive() {
  const title = document.getElementById("adm-live-title")?.value?.trim() || "Live Service";
  const url   = document.getElementById("adm-live-url")?.value?.trim()
               || "https://www.youtube.com/@GraceMinistryMangalore/live";
  const time  = new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});

  try {
    // Stop any existing live
    const existing = await window.db.collection("live_services").where("isLive","==",true).get();
    const batch = window.db.batch();
    existing.docs.forEach(d => batch.update(d.ref, { isLive: false }));
    await batch.commit();

    await window.db.collection("live_services").add({
      title, youtubeURL: url, isLive: true,
      startTime: time, createdAt: new Date().toISOString()
    });
    await sendFCMNotification("🔴 Grace Ministry is LIVE!", title + " — Watch now", { type: "live", url });

    document.getElementById("adm-live-status").textContent = "🔴 Live — " + time;
    loadLiveServiceStatus?.();
    alert("✅ Live service started!");
  } catch (err) { alert("Error: " + err.message); }
}

async function adminStopLive() {
  try {
    const snap = await window.db.collection("live_services").where("isLive","==",true).get();
    const batch = window.db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { isLive: false }));
    await batch.commit();
    document.getElementById("adm-live-status").textContent = "⚫ Offline";
    loadLiveServiceStatus?.();
    alert("✅ Live service stopped.");
  } catch (err) { alert("Error: " + err.message); }
}

async function loadAdminLiveStatus() {
  if (!window.db) return;
  try {
    const snap = await window.db.collection("live_services").where("isLive","==",true).limit(1).get();
    const el = document.getElementById("adm-live-status");
    if (el) el.textContent = snap.empty ? "⚫ Offline" : "🔴 Currently Live";
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// ADD MEDIA
// ─────────────────────────────────────────────────────────────
async function adminAddMedia() {
  const title   = document.getElementById("adm-m-title")?.value?.trim();
  const url     = document.getElementById("adm-m-url")?.value?.trim();
  const type    = document.getElementById("adm-m-type")?.value || "video";
  const thumb   = document.getElementById("adm-m-thumb")?.value?.trim() || "";
  if (!title || !url) { alert("Title and URL are required."); return; }

  const btn = document.getElementById("adm-m-btn");
  if (btn) btn.textContent = "Adding...";
  try {
    await window.db.collection("media").add({
      title, videoURL: url, type, thumbnail: thumb,
      uploadedBy: window.currentUser?.displayName || "Admin",
      createdAt: new Date().toISOString()
    });
    showAdminSuccess("adm-m-success", "✅ Media added!");
    ["adm-m-title","adm-m-url","adm-m-thumb"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    loadMediaFeed?.();
    loadAdminMedia();
  } catch (err) { alert("Error: " + err.message); }
  if (btn) btn.textContent = "Add Media";
}

async function loadAdminMedia() {
  const c = document.getElementById("adm-media-list");
  if (!c || !window.db) return;
  try {
    const snap = await window.db.collection("media").orderBy("createdAt","desc").limit(5).get();
    c.innerHTML = snap.empty ? '<p style="font-size:12px;color:var(--text-muted);text-align:center">No media yet.</p>'
      : snap.docs.map(doc => {
          const m = doc.data();
          return `<div class="prayer-req-item">
            <div class="prayer-req-name">${m.title||""} <span style="font-size:10px;color:var(--gold)">[${m.type||""}]</span></div>
            <div class="prayer-req-meta">${m.uploadedBy||""} · ${(m.createdAt||"").slice(0,10)}</div>
          </div>`;
        }).join("");
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// ADD POST (Community Feed)
// ─────────────────────────────────────────────────────────────
async function adminAddPost() {
  const title = document.getElementById("adm-p-title")?.value?.trim();
  const desc  = document.getElementById("adm-p-desc")?.value?.trim();
  const img   = document.getElementById("adm-p-img")?.value?.trim() || "";
  if (!desc) { alert("Description is required."); return; }

  const btn = document.getElementById("adm-p-btn");
  if (btn) btn.textContent = "Posting...";
  try {
    await window.db.collection("posts").add({
      title, description: desc, imageURL: img,
      postedBy: window.currentUser?.displayName || "Grace Ministry",
      createdAt: new Date().toISOString()
    });
    showAdminSuccess("adm-p-success", "✅ Post published!");
    ["adm-p-title","adm-p-desc","adm-p-img"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    loadCommunityFeed?.();
  } catch (err) { alert("Error: " + err.message); }
  if (btn) btn.textContent = "Publish Post";
}

// ─────────────────────────────────────────────────────────────
// ADD EVENT
// ─────────────────────────────────────────────────────────────
async function adminAddEvent() {
  const title = document.getElementById("adm-e-title")?.value?.trim();
  const day   = document.getElementById("adm-e-day")?.value?.trim();
  const month = document.getElementById("adm-e-month")?.value?.trim();
  const time  = document.getElementById("adm-e-time")?.value?.trim();
  const loc   = document.getElementById("adm-e-location")?.value?.trim();
  const city  = document.getElementById("adm-e-city")?.value || "Mangalore";
  const desc  = document.getElementById("adm-e-desc")?.value?.trim() || "";
  if (!title || !day) { alert("Title and day are required."); return; }

  const btn = document.getElementById("adm-e-btn");
  if (btn) btn.textContent = "Adding...";
  try {
    const docRef = await window.db.collection("events").add({
      title, day, month, time, location: loc, city, description: desc,
      createdAt: new Date().toISOString()
    });
    await sendFCMNotification("📅 New Event: " + title,
      day + " " + month + (time ? " · " + time : "") + (loc ? " · " + loc : ""),
      { type: "event", id: docRef.id });

    showAdminSuccess("adm-e-success", "✅ Event added!");
    ["adm-e-title","adm-e-day","adm-e-month","adm-e-time","adm-e-location","adm-e-desc"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    loadEventsFromFirestore?.();
    loadAdminEvents();
  } catch (err) { alert("Error: " + err.message); }
  if (btn) btn.textContent = "Add Event";
}

async function loadAdminEvents() {
  const c = document.getElementById("adm-events-count");
  if (!c || !window.db) return;
  try {
    const snap = await window.db.collection("events").orderBy("createdAt","desc").limit(5).get();
    c.innerHTML = snap.empty ? '<p style="font-size:12px;color:var(--text-muted);text-align:center">No events yet.</p>'
      : snap.docs.map(doc => {
          const ev = doc.data();
          return `<div class="prayer-req-item">
            <div class="prayer-req-name">${ev.title||""}</div>
            <div class="prayer-req-meta">${ev.day||""} ${ev.month||""} · ${ev.time||""} · ${ev.location||""}</div>
          </div>`;
        }).join("");
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// ADD ANNOUNCEMENT
// ─────────────────────────────────────────────────────────────
async function adminAddAnnouncement() {
  const msg   = document.getElementById("adm-ann-msg")?.value?.trim();
  const emoji = document.getElementById("adm-ann-emoji")?.value?.trim() || "📣";
  if (!msg) { alert("Enter an announcement message."); return; }
  try {
    await window.db.collection("announcements").add({
      message: msg, emoji, createdAt: new Date().toISOString()
    });
    await sendFCMNotification(emoji + " Announcement", msg, { type: "announcement" });
    showAdminSuccess("adm-ann-success", "✅ Announcement posted!");
    const el = document.getElementById("adm-ann-msg");
    if (el) el.value = "";
    loadAnnouncementsFromFirestore?.();
  } catch (err) { alert("Error: " + err.message); }
}

// ─────────────────────────────────────────────────────────────
// UPDATE DAILY VERSE
// ─────────────────────────────────────────────────────────────
async function adminUpdateVerse() {
  const text = document.getElementById("adm-verse-text")?.value?.trim();
  const ref  = document.getElementById("adm-verse-ref")?.value?.trim();
  if (!text) { alert("Enter verse text."); return; }
  try {
    await window.db.collection("settings").doc("daily_verse").set({
      text, ref, updatedAt: new Date().toISOString()
    });
    const vEl = document.getElementById("daily-verse-text");
    const rEl = document.getElementById("daily-verse-ref");
    if (vEl) vEl.textContent = "\u201c" + text + "\u201d";
    if (rEl) rEl.textContent = "\u2014 " + ref;
    showAdminSuccess("adm-verse-success", "✅ Verse updated!");
  } catch (err) { alert("Error: " + err.message); }
}

// ─────────────────────────────────────────────────────────────
// MANAGE USERS
// ─────────────────────────────────────────────────────────────
async function loadAdminUsers() {
  const c = document.getElementById("admin-users-list");
  if (!c || !window.db) return;
  c.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center">Loading...</p>';
  try {
    const users = await getAllUsers();
    if (!users.length) {
      c.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center">No users yet.</p>';
      return;
    }
    c.innerHTML = users.map(u => `
      <div class="prayer-req-item" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="prayer-req-name">${u.name||"Member"}</div>
          <div class="prayer-req-meta">${u.email||""} · ${u.city||""}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="promoteUserToAdmin('${u.id}')" style="font-size:11px;padding:5px 8px;background:var(--gold-dim);border:0.5px solid var(--gold);border-radius:8px;color:var(--gold);cursor:pointer">
            ↑ Admin
          </button>
          <button onclick="revokeAdminRole('${u.id}')" style="font-size:11px;padding:5px 8px;background:#ff333322;border:0.5px solid #ff3333;border-radius:8px;color:#ff3333;cursor:pointer">
            ✕ Revoke
          </button>
        </div>
      </div>`).join("");
  } catch (err) {
    c.innerHTML = '<p style="font-size:12px;color:#f66;padding:8px">' + err.message + "</p>";
  }
}

// ─────────────────────────────────────────────────────────────
// PRAYER REQUESTS (admin view)
// ─────────────────────────────────────────────────────────────
async function loadAdminPrayers() {
  const c = document.getElementById("admin-prayers");
  if (!c) return;
  if (!window.db) {
    c.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px">Firebase not configured.</p>';
    return;
  }
  c.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center">Loading...</p>';
  try {
    const snap = await window.db.collection("prayer_requests")
      .orderBy("timestamp","desc").limit(30).get();
    if (snap.empty) {
      c.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px">No prayer requests yet.</p>';
      return;
    }
    c.innerHTML = snap.docs.map(doc => {
      const p = doc.data();
      return `<div class="prayer-req-item">
        <div class="prayer-req-name">${p.name||"Anonymous"}${p.urgency==="urgent"?" 🚨":""}</div>
        <div class="prayer-req-msg">${p.message||""}</div>
        <div class="prayer-req-meta">${p.type||""} · ${p.city||""} · ${(p.timestamp||"").slice(0,10)}</div>
      </div>`;
    }).join("");
  } catch (err) {
    c.innerHTML = '<p style="font-size:12px;color:#f66;padding:12px">' + err.message + "</p>";
  }
}

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────
function showAdminSuccess(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3000);
}

// ─────────────────────────────────────────────────────────────
// ADD MEMBER (admin manually registers a member)
// ─────────────────────────────────────────────────────────────
async function adminAddMember() {
  const name  = document.getElementById("adm-mem-name")?.value?.trim();
  const email = document.getElementById("adm-mem-email")?.value?.trim() || "";
  const phone = document.getElementById("adm-mem-phone")?.value?.trim() || "";
  const city  = document.getElementById("adm-mem-city")?.value  || "Mangalore";
  const role  = document.getElementById("adm-mem-role")?.value  || "user";
  const notes = document.getElementById("adm-mem-notes")?.value?.trim() || "";

  if (!name) { alert("Full name is required."); return; }
  if (!email && !phone) { alert("Please enter at least an email or phone number."); return; }

  const btn = document.getElementById("adm-mem-btn");
  if (btn) { btn.textContent = "Adding..."; btn.disabled = true; }

  try {
    if (!window.db) { alert("Firebase not connected."); return; }

    // Check if member with same email already exists
    if (email) {
      const existing = await window.db.collection("users")
        .where("email", "==", email).limit(1).get();
      if (!existing.empty) {
        alert("A member with this email already exists.");
        return;
      }
    }

    // Save to Firestore users collection
    const docRef = await window.db.collection("users").add({
      name,
      email,
      phone,
      city,
      role,
      notes,
      addedByAdmin: true,
      addedBy: window.currentUser?.email || "admin",
      createdAt: new Date().toISOString()
    });

    showAdminSuccess("adm-mem-success",
      "✅ " + name + " added as " + role + "!");

    // Clear all fields
    ["adm-mem-name","adm-mem-email","adm-mem-phone","adm-mem-notes"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

    // Refresh member list
    loadAdminUsers();

  } catch (err) {
    alert("Error adding member: " + err.message);
  } finally {
    if (btn) { btn.textContent = "Add Member"; btn.disabled = false; }
  }
}
