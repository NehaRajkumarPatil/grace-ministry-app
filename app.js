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
  if (meta) meta.content    = isLight ? "#ffffff" : "#0d1b2a";
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
// OTP COUNTDOWN
// ─────────────────────────────────────────────────────────────
let otpSec = 45;
function runOtpTimer() {
  const el = document.getElementById("otp-timer");
  if (!el) return;
  el.textContent = "00:" + (otpSec < 10 ? "0" : "") + otpSec;
  if (otpSec > 0) { otpSec--; setTimeout(runOtpTimer, 1000); }
  else { el.textContent = "Resend"; el.style.cursor = "pointer"; }
}

// ─────────────────────────────────────────────────────────────
// TAB SWITCHING — expanded screen list
// ─────────────────────────────────────────────────────────────
const mainScreens = [
  "home","devotional","sermons","media","events",
  "prayer-wall","volunteer","give","ai","connect",
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
  if (n === "otp")        runOtpTimer();
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
    } catch (err) { alert("Login error: " + err.message); }
    return;
  }
  switchTab("home");
}

async function handleRegister() {
  const name  = document.getElementById("reg-name")?.value?.trim() || "";
  const email = document.getElementById("reg-email")?.value?.trim();
  const pw    = document.getElementById("reg-pw")?.value;
  const city  = document.getElementById("reg-city")?.value || "Mangalore";
  if (!email || !pw) { alert("Email and password are required."); return; }
  if (window.fbAuth) {
    try {
      const cred = await window.fbAuth.createUserWithEmailAndPassword(email, pw);
      await cred.user.updateProfile({ displayName: name });
      await saveMemberProfile(cred.user.uid, { name, email, city, createdAt: new Date().toISOString() });
      switchTab("home");
    } catch (err) { alert("Register error: " + err.message); }
    return;
  }
  switchTab("home");
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

function toggleLoginMode(m) {
  document.getElementById("login-email-fields").style.display = m === "email" ? "block" : "none";
  document.getElementById("login-phone-fields").style.display = m === "phone" ? "block" : "none";
  document.getElementById("login-email-tab").classList.toggle("on", m === "email");
  document.getElementById("login-phone-tab").classList.toggle("on", m === "phone");
}

function toggleRegMode(m) {
  document.getElementById("reg-email-fields").style.display = m === "email" ? "block" : "none";
  document.getElementById("reg-phone-fields").style.display = m === "phone" ? "block" : "none";
  document.getElementById("reg-email-tab").classList.toggle("on", m === "email");
  document.getElementById("reg-phone-tab").classList.toggle("on", m === "phone");
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
// AI BIBLE ASSISTANT — Full implementation
// ─────────────────────────────────────────────────────────────
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

  // User bubble
  const uRow = document.createElement("div");
  uRow.className = "ai-row usr-row";
  uRow.innerHTML = '<div class="usr-bub">' + q.replace(/</g,"&lt;").replace(/>/g,"&gt;") + "</div>";
  msgs.appendChild(uRow);

  // Typing indicator
  const aRow = document.createElement("div");
  aRow.className = "ai-row";
  aRow.innerHTML = '<div class="ai-ava">G</div><div class="ai-bub"><div class="ai-typing"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(aRow);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a warm, Spirit-filled Bible assistant for Grace Ministry India, a Christian healing ministry serving Mangalore and Bangalore, led by Bro. Andrew Richard.

When users ask Bible questions:
1. Give a clear, warm explanation (2-3 sentences)
2. Quote 1-2 relevant Bible verses with references
3. Share a brief encouraging message
4. Keep total response under 200 words

Format responses clearly with the explanation, then "📖 Key Verse:" followed by the verse, then "✨ Encouragement:" followed by the encouragement.`,
        messages: [{ role: "user", content: q }]
      })
    });

    const d = await r.json();
    const text = d.content?.[0]?.text || "I'm unable to respond right now. Please try again.";
    aRow.querySelector(".ai-bub").textContent = text;
  } catch (err) {
    aRow.querySelector(".ai-bub").textContent = "Unable to connect. Please check your internet connection and try again. 🙏";
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
// SMART LOGIN — routes email vs phone based on active tab
// ─────────────────────────────────────────────────────────────
function handleSmartLogin() {
  const phoneTab = document.getElementById("login-phone-tab");
  if (phoneTab && phoneTab.classList.contains("on")) {
    sendPhoneOTP();
  } else {
    handleLogin();
  }
}

// ─────────────────────────────────────────────────────────────
// PHONE OTP — Firebase Phone Authentication
// ─────────────────────────────────────────────────────────────
function otpMove(el, nextId) {
  el.value = el.value.slice(-1);
  if (el.value && nextId) document.getElementById(nextId)?.focus();
  if (getOTPCode().length === 6) verifyOTP();
}

function getOTPCode() {
  return ["otp1","otp2","otp3","otp4","otp5","otp6"]
    .map(id => document.getElementById(id)?.value || "").join("");
}

function clearOTPBoxes() {
  ["otp1","otp2","otp3","otp4","otp5","otp6"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("otp1")?.focus();
}

async function sendPhoneOTP() {
  const raw = document.getElementById("phone-number-input")?.value?.trim();

  if (!raw || raw.replace(/\D/g,"").length < 10) {
    alert("Please enter a valid 10-digit mobile number.");
    return;
  }

  const phoneNumber = "+91" + raw.replace(/\D/g,"");
  const btn = document.getElementById("login-btn");

  if (btn) {
    btn.textContent = "Sending OTP...";
    btn.disabled = true;
  }

  try {
    if (!window.fbAuth) throw new Error("Firebase not configured yet.");

    // 🔥 CLEAR OLD RECAPTCHA
    const container = document.getElementById("recaptcha-container");
    if (container) container.innerHTML = "";

    // 🔥 CREATE NEW ONE
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      "recaptcha-container",
      { size: "invisible" }
    );

    await window.recaptchaVerifier.render();

    const result = await window.fbAuth.signInWithPhoneNumber(
      phoneNumber,
      window.recaptchaVerifier
    );

    window.otpConfirmationResult = result;

    const sentTo = document.getElementById("otp-sent-to");
    if (sentTo) {
      sentTo.textContent = "OTP sent to +91 " + raw.replace(/\D/g,"");
    }

    clearOTPBoxes();
    otpSec = 45;
    switchTab("otp");
    runOtpTimer();

  } catch (err) {
    console.error(err);
    alert("Failed to send OTP: " + err.message);
    window.recaptchaVerifier = null;
  } finally {
    if (btn) {
      btn.textContent = "Sign In";
      btn.disabled = false;
    }
  }
}

async function verifyOTP() {
  const code = getOTPCode();
  const errEl = document.getElementById("otp-error");
  if (code.length < 6) {
    if (errEl) { errEl.textContent = "Please enter all 6 digits."; errEl.style.display = "block"; }
    return;
  }
  const btn = document.getElementById("otp-verify-btn");
  if (btn) { btn.textContent = "Verifying..."; btn.disabled = true; }
  if (errEl) errEl.style.display = "none";
  try {
    if (!window.otpConfirmationResult) throw new Error("Session expired. Please request a new OTP.");
    const cred = await window.otpConfirmationResult.confirm(code);
    if (cred.user) {
      await saveMemberProfile(cred.user.uid, {
        name: cred.user.displayName || "",
        phone: cred.user.phoneNumber || "",
        email: cred.user.email || "",
        city: "Mangalore", role: "user",
        createdAt: new Date().toISOString()
      });
    }
    switchTab("home");
  } catch (err) {
    if (errEl) {
      errEl.textContent = (err.message.includes("invalid") || err.message.includes("code"))
        ? "Wrong OTP. Please try again." : err.message;
      errEl.style.display = "block";
    }
  } finally {
    if (btn) { btn.textContent = "Verify & Continue"; btn.disabled = false; }
  }
}

async function resendOTP() {
  if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
  window.otpConfirmationResult = null;
  switchTab("login");
  toggleLoginMode("phone");
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
