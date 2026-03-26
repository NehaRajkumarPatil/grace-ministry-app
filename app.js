// ═══════════════════════════════════════════════════════════════
// app.js — Grace Ministry India
// Main UI logic. Requires firebase.js and admin.js.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// THEME — Dark / Light Mode
// ─────────────────────────────────────────────────────────────
function applyTheme(mode) {
  const isLight = mode === "light";
  document.body.classList.toggle("light", isLight);
  const btn  = document.getElementById("theme-toggle");
  const lbl  = document.getElementById("theme-lbl");
  const meta = document.getElementById("theme-meta");
  if (btn)  btn.classList.toggle("light", isLight);
  if (lbl)  lbl.textContent = isLight ? "☀️" : "🌙";
  if (meta) meta.content    = isLight ? "#ffffff" : "#800000";
  localStorage.setItem("gm-theme", mode);
}

function toggleTheme() {
  const cur = document.body.classList.contains("light") ? "light" : "dark";
  applyTheme(cur === "light" ? "dark" : "light");
}

(function initTheme() {
  const saved = localStorage.getItem("gm-theme");
  if (saved) { applyTheme(saved); return; }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
})();

// ─────────────────────────────────────────────────────────────
// LIVE CLOCK
// ─────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const el = document.getElementById("live-time");
  if (el) el.textContent = h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
}
updateClock();
setInterval(updateClock, 10000);

// ─────────────────────────────────────────────────────────────
// LIVE DATE ON VERSE TAG
// ─────────────────────────────────────────────────────────────
const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const _nd = new Date();
const verseTagEl = document.getElementById("verse-date-tag");
if (verseTagEl) verseTagEl.textContent = "Daily Verse \u00b7 " + MO[_nd.getMonth()] + " " + _nd.getDate();

// ─────────────────────────────────────────────────────────────
// DAILY BIBLE VERSE — Public API
// ─────────────────────────────────────────────────────────────
const DAILY_VERSES = [
  "john 3:16","jeremiah 29:11","philippians 4:13","psalm 23:1","isaiah 40:31",
  "romans 8:28","proverbs 3:5-6","matthew 11:28","psalm 46:1","romans 8:38-39",
  "joshua 1:9","psalm 121:1-2","isaiah 41:10","2 corinthians 5:17","ephesians 2:8-9",
  "psalm 27:1","john 14:6","galatians 2:20","hebrews 11:1","1 john 4:19"
];

async function loadDailyVerseFromAPI() {
  const vEl = document.getElementById("daily-verse-text");
  const rEl = document.getElementById("daily-verse-ref");
  if (!vEl) return;
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const verse = DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
  try {
    const res = await fetch("https://bible-api.com/" + encodeURIComponent(verse) + "?translation=kjv");
    const d   = await res.json();
    if (d.text && vEl) {
      vEl.textContent = "\u201c" + d.text.trim().replace(/\n/g, " ") + "\u201d";
      if (rEl && d.reference) rEl.textContent = "\u2014 " + d.reference;
    }
  } catch { /* keep default */ }
}
loadDailyVerseFromAPI();

// ─────────────────────────────────────────────────────────────
// TAB SWITCHING — expanded screen list
// ─────────────────────────────────────────────────────────────
const mainScreens = [
  "home","devotional","sermons","media","events",
  "prayer-wall","volunteer","give","connect",
  "prayer","profile","about","privacy"
];

function switchTab(n) {
  document.querySelectorAll(".scr").forEach(s => s.classList.remove("on"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("on"));
  const scr = document.getElementById("s-" + n);
  if (scr) scr.classList.add("on");
  const tab = document.getElementById("t-" + n);
  if (tab) tab.classList.add("on");
  const tabbar = document.getElementById("main-tabbar");
  if (tabbar) tabbar.style.display = mainScreens.includes(n) ? "flex" : "none";
  const fab = document.getElementById("fab-wrap");
  if (fab) fab.classList.toggle("on", mainScreens.includes(n));
  if (n === "profile")    renderProfile();
  if (n === "devotional") renderDevotionalIfNeeded();
  if (n === "media")      { window._mediaFilter = window._mediaFilter || "all"; loadMediaFeed?.(window._mediaFilter); }
  if (n === "community")  loadCommunityFeed?.();
  if (n === "prayer-wall") loadPrayerWall?.();
}

function renderDevotionalIfNeeded() {
  if (window._latestDevotional) {
    renderDevotionalScreen(window._latestDevotional);
  } else if (window.db) {
    loadTodayDevotional?.();
  }
}

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById("login-email")?.value?.trim();
  const pw    = document.getElementById("login-password")?.value;
  if (!email || !pw) { alert("Please enter email and password."); return; }
  if (window.fbAuth) {
    try {
      await window.fbAuth.signInWithEmailAndPassword(email, pw);
      switchTab("home");
    } catch (err) {
      const c = err.code;
      const msg =
        c === "auth/user-not-found"     ? "No account found. Please register first." :
        c === "auth/wrong-password"     ? "Incorrect password. Please try again." :
        c === "auth/invalid-email"      ? "Invalid email format." :
        c === "auth/invalid-credential" ? "Email or password is incorrect." :
        c === "auth/too-many-requests"  ? "Too many attempts. Please try again later." :
        "Login failed. Please try again.";
      alert(msg);
    }
    return;
  }
  switchTab("home");
}

async function handleRegister() {
  const email    = document.getElementById("reg-email")?.value?.trim();
  const password = document.getElementById("reg-pw")?.value?.trim();
  const name     = document.getElementById("reg-name")?.value?.trim();
  const phone    = document.getElementById("reg-phone")?.value?.trim();

  if (!email || !password) { alert("Please fill all required fields."); return; }

  try {
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = cred.user;

    await window.db.collection("users").doc(user.uid).set({
      name: name || "",
      email: email,
      phone: phone || "",
      role: "user",
      createdAt: new Date().toISOString()
    }, { merge: true });

    alert("Registration successful!");
    switchTab("login");
  } catch (err) {
    console.error(err);
    const msg =
      err.code === "auth/email-already-in-use" ? "Email already registered." :
      err.code === "auth/weak-password"        ? "Password should be at least 6 characters." :
      "Registration failed";
    alert(msg);
  }
}

async function handleGoogleLogin() {
  if (!window.fbAuth) { switchTab("home"); return; }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await window.fbAuth.signInWithPopup(provider);
    await saveMemberProfile(cred.user.uid, {
      name: cred.user.displayName || "", email: cred.user.email || "",
      city: "Mangalore", createdAt: new Date().toISOString()
    });
    switchTab("home");
  } catch (err) { alert("Google sign-in error: " + err.message); }
}

function handleLogout() {
  if (window.fbAuth) window.fbAuth.signOut();
  window.currentUser = null;
  switchTab("splash");
}



// ─────────────────────────────────────────────────────────────
// MEMBER PROFILE
// ─────────────────────────────────────────────────────────────
async function renderProfile() {
  const container = document.getElementById("profile-content");
  if (!container) return;
  if (!window.currentUser) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px">
        <div style="font-size:48px;margin-bottom:16px">👤</div>
        <div style="font-size:16px;font-weight:600;color:var(--gold-text)">Not signed in</div>
        <p style="font-size:13px;color:var(--text-secondary);margin:8px 0 20px">Sign in to view your profile.</p>
        <button class="btn-gold" onclick="switchTab('login')" style="width:180px">Sign In</button>
      </div>`;
    return;
  }
  const profile = window.fbAuth ? await getMemberProfile(window.currentUser.uid).catch(()=>null) : null;
  const name  = profile?.name  || window.currentUser.displayName || "Member";
  const email = profile?.email || window.currentUser.email || "";
  const city  = profile?.city  || "Mangalore";
  container.innerHTML = `
    <div style="text-align:center;padding:24px 20px 16px">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--bg-card);border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:24px;font-weight:700;color:var(--gold)">
        ${name.charAt(0).toUpperCase()}
      </div>
      <div style="font-size:18px;font-weight:600;color:var(--gold-text)">${name}</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${email}</div>
      <div style="font-size:12px;color:var(--gold);margin-top:4px">📍 ${city}</div>
    </div>
    <div style="padding:0 16px 20px">
      <div class="give-card" onclick="switchTab('prayer-wall')" style="cursor:pointer">
        <div><div class="give-title">🙏 Prayer Wall</div><div class="give-sub">View and submit prayer requests</div></div>
        <span style="color:var(--gold);font-size:20px">›</span>
      </div>
      <div class="give-card" onclick="switchTab('volunteer')" style="cursor:pointer">
        <div><div class="give-title">🤝 My Volunteer Teams</div><div class="give-sub">Church teams you've joined</div></div>
        <span style="color:var(--gold);font-size:20px">›</span>
      </div>
      <div class="give-card" onclick="switchTab('events')" style="cursor:pointer">
        <div><div class="give-title">📅 Registered Events</div><div class="give-sub">Upcoming events</div></div>
        <span style="color:var(--gold);font-size:20px">›</span>
      </div>
      <button onclick="handleLogout()" class="btn-outline" style="margin-top:8px">Sign Out</button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// PRAYER FORM
// ─────────────────────────────────────────────────────────────
let urgency = "normal", prayerType = "healing";

function setUrgency(u) {
  urgency = u;
  document.getElementById("tog-normal")?.classList.toggle("on", u === "normal");
  document.getElementById("tog-urgent")?.classList.toggle("on", u === "urgent");
}

function setPrayerType(t) {
  prayerType = t;
  ["healing","family","financial","other"].forEach(x =>
    document.getElementById("pt-" + x)?.classList.toggle("on", x === t)
  );
}

async function sendPrayer(e) {
  e.preventDefault();
  const name = document.getElementById("prayer-name")?.value?.trim() || "Anonymous";
  const text = document.getElementById("prayer-text")?.value?.trim();
  const city = document.getElementById("prayer-city")?.value || "Mangalore";
  if (!text) { alert("Please share your prayer request first 🙏"); return; }
  await savePrayerToFirestore(name, text, urgency, prayerType, city);
  const prefix = urgency === "urgent" ? "🚨 URGENT PRAYER REQUEST" : "🙏 Prayer Request";
  const msg = encodeURIComponent(
    prefix + "\nFrom: " + name +
    "\nType: " + prayerType.charAt(0).toUpperCase() + prayerType.slice(1) +
    "\nCity: " + city + "\n\n" + text + "\n\n— Sent via Grace Ministry App"
  );
  window.open("https://wa.me/919880093988?text=" + msg, "_blank");
}

// ─────────────────────────────────────────────────────────────
// GIVE / DONATE
// ─────────────────────────────────────────────────────────────
let selectedAmt = 1000, givePurpose = "tithe";
const amts = [100, 500, 1000, 2000, 5000];

function setAmount(a) {
  selectedAmt = a;
  amts.forEach(x => {
    const btn = document.getElementById("amt-" + x);
    if (btn) {
      btn.style.background  = x === a ? "var(--gold-dim)" : "";
      btn.style.borderColor = x === a ? "var(--gold)" : "";
      btn.style.color       = x === a ? "var(--gold)" : "";
      btn.style.fontWeight  = x === a ? "600" : "500";
    }
  });
  const custom    = document.getElementById("amt-custom");
  const customInp = document.getElementById("custom-amount");
  if (a === null) {
    if (custom) { custom.style.background="var(--gold-dim)"; custom.style.borderColor="var(--gold)"; custom.style.color="var(--gold)"; custom.style.fontWeight="600"; }
    if (customInp) customInp.style.display = "block";
  } else {
    if (custom) { custom.style.background=""; custom.style.borderColor=""; custom.style.color=""; custom.style.fontWeight="500"; }
    if (customInp) customInp.style.display = "none";
  }
}

function setGivePurpose(p) {
  givePurpose = p;
  ["tithe","mission","offering"].forEach(x =>
    document.getElementById("gp-" + x)?.classList.toggle("on", x === p)
  );
}

// ─────────────────────────────────────────────────────────────
// COPY UPI
// ─────────────────────────────────────────────────────────────
function copyUPI() {
  const upiId = "andrewvilla307-3@oksbi";
  navigator.clipboard.writeText(upiId).then(() => {
    ["copy-upi-btn","copy-upi-btn2","copy-upi-btn3"].forEach(bid => {
      const b = document.getElementById(bid);
      if (b) { const orig = b.textContent; b.textContent = "✓ Copied!"; setTimeout(() => b.textContent = orig, 2000); }
    });
  }).catch(() => prompt("Copy this UPI ID:", upiId));
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS PANEL
// ─────────────────────────────────────────────────────────────
function toggleNotif() { document.getElementById("notif-overlay")?.classList.toggle("on"); }
function closeNotif(e) {
  if (e.target === document.getElementById("notif-overlay"))
    document.getElementById("notif-overlay")?.classList.remove("on");
}

// ─────────────────────────────────────────────────────────────
// SHARE SHEET
// ─────────────────────────────────────────────────────────────
function openShare()    { document.getElementById("share-overlay")?.classList.add("on"); }
function closeShareBtn(){ document.getElementById("share-overlay")?.classList.remove("on"); }
function closeShare(e)  { if (e.target === document.getElementById("share-overlay")) closeShareBtn(); }
function copyLink() {
  navigator.clipboard.writeText("https://www.graceministryindia.org").then(() => {
    const lbl = document.getElementById("copy-link-lbl");
    if (lbl) { lbl.textContent = "Copied!"; setTimeout(() => lbl.textContent = "Copy Link", 2000); }
  });
}

// ─────────────────────────────────────────────────────────────
// MEDIA FILTER
// ─────────────────────────────────────────────────────────────
function setMediaFilter(f) {
  window._mediaFilter = f;
  document.querySelectorAll(".media-pill").forEach(p => p.classList.remove("on"));
  document.getElementById("media-pill-" + f)?.classList.add("on");
  loadMediaFeed?.(f);
}

// ─────────────────────────────────────────────────────────────
// AI BIBLE ASSISTANT — Keyword + free Bible API
// ─────────────────────────────────────────────────────────────
const BIBLE_TOPICS = {
  healing:    { verse: "james 5:14",        note: "Prayer and faith bring healing and restoration." },
  fear:       { verse: "isaiah 41:10",      note: "God is always with you — do not be afraid." },
  strength:   { verse: "philippians 4:13",  note: "Through Christ you can face anything." },
  love:       { verse: "john 3:16",         note: "God's love for you is unconditional and eternal." },
  peace:      { verse: "john 14:27",        note: "Jesus gives a peace the world cannot offer." },
  hope:       { verse: "jeremiah 29:11",    note: "God has a good plan and a future for you." },
  faith:      { verse: "hebrews 11:1",      note: "Faith is trusting God even when you cannot see." },
  prayer:     { verse: "philippians 4:6",   note: "Bring everything to God in prayer with thanksgiving." },
  worry:      { verse: "matthew 6:34",      note: "Focus on today — God holds tomorrow." },
  forgiveness:{ verse: "1 john 1:9",        note: "God is faithful to forgive when we come to Him." },
  salvation:  { verse: "romans 10:9",       note: "Confess and believe — salvation is a gift." },
  grace:      { verse: "ephesians 2:8",     note: "You are saved by grace, not by your own effort." },
  joy:        { verse: "psalm 16:11",       note: "True joy is found in God's presence." },
  family:     { verse: "joshua 24:15",      note: "Choose to serve God together as a household." },
  money:      { verse: "matthew 6:33",      note: "Seek God first and He will provide your needs." },
  financial:  { verse: "philippians 4:19",  note: "God will supply all your needs according to His riches." },
  depression: { verse: "psalm 34:18",       note: "God is close to the broken-hearted." },
  anxiety:    { verse: "1 peter 5:7",       note: "Cast all your anxiety on Him — He cares for you." },
  purpose:    { verse: "romans 8:28",       note: "God works all things together for good for those who love Him." },
  trust:      { verse: "proverbs 3:5",      note: "Lean on God's understanding, not your own." }
};

function askChip(q) {
  const inp = document.getElementById("ai-q");
  if (inp) inp.value = q;
  askBible();
}

async function askBible() {
  const inp = document.getElementById("ai-q");
  const q   = inp?.value?.trim();
  if (!q) return;
  inp.value = "";

  const msgs = document.getElementById("ai-msgs");
  if (!msgs) return;

  const uRow = document.createElement("div");
  uRow.className = "ai-row usr-row";
  uRow.innerHTML = '<div class="usr-bub">' + q.replace(/</g,"&lt;").replace(/>/g,"&gt;") + "</div>";
  msgs.appendChild(uRow);

  const aRow = document.createElement("div");
  aRow.className = "ai-row";
  aRow.innerHTML = '<div class="ai-ava">G</div><div class="ai-bub"><div class="ai-typing"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(aRow);
  msgs.scrollTop = msgs.scrollHeight;

  const ql = q.toLowerCase();
  const match = Object.keys(BIBLE_TOPICS).find(k => ql.includes(k));

  try {
    if (match) {
      const topic = BIBLE_TOPICS[match];
      const res = await fetch("https://bible-api.com/" + encodeURIComponent(topic.verse) + "?translation=kjv");
      const d   = await res.json();
      const verseText = d.text ? d.text.trim().replace(/\n/g, " ") : "";
      const ref       = d.reference || topic.verse;
      aRow.querySelector(".ai-bub").innerHTML =
        "\u201c" + verseText + "\u201d\n\u2014 " + ref +
        "\n\n\u2728 " + topic.note;
    } else {
      // Try to look up the verse directly if it looks like a reference
      const versePattern = /([1-3]?\s?[a-z]+)\s*(\d+):(\d+)/i;
      if (versePattern.test(q)) {
        const res = await fetch("https://bible-api.com/" + encodeURIComponent(q) + "?translation=kjv");
        const d   = await res.json();
        if (d.text) {
          aRow.querySelector(".ai-bub").innerHTML =
            "\u201c" + d.text.trim().replace(/\n/g, " ") + "\u201d\n\u2014 " + d.reference;
        } else {
          aRow.querySelector(".ai-bub").textContent =
            "I couldn't find that verse. Try topics like: healing, fear, hope, peace, faith, love, prayer, strength. 🙏";
        }
      } else {
        aRow.querySelector(".ai-bub").textContent =
          "Try asking about: healing, fear, hope, peace, faith, love, prayer, strength, forgiveness, joy, family, or type a verse like \"John 3:16\". 🙏";
      }
    }
  } catch {
    aRow.querySelector(".ai-bub").textContent = "Unable to fetch verse. Please check your connection. 🙏";
  }
  msgs.scrollTop = msgs.scrollHeight;
}

// ─────────────────────────────────────────────────────────────
// PWA — Service Worker
// ─────────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js")
      .then(reg => console.log("SW registered:", reg.scope))
      .catch(err => console.warn("SW error:", err));
  });
}



// ─────────────────────────────────────────────────────────────
// CITY PREFERENCE TOGGLE
// ─────────────────────────────────────────────────────────────
function setCityPref(id) {
  document.getElementById("city-mlr")?.classList.toggle("on", id === "city-mlr");
  document.getElementById("city-blr")?.classList.toggle("on", id === "city-blr");
}

// ─────────────────────────────────────────────────────────────
// SHARE DEVOTIONAL
// ─────────────────────────────────────────────────────────────
function shareDevotional() {
  const d = window._latestDevotional;
  const text = d
    ? "Today's Devotional: " + (d.title || "") + "\n" + (d.verse || "") + "\n\n\u2014 Grace Ministry India"
    : "Grace Ministry India \u2014 Daily Devotional";
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  }
}