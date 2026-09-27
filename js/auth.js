/**
 * ============================================================================
 * FLYVIS USER AUTHENTICATION, PROFILE & DATA ENGINE
 * Website-native flight tracking, My Profile modal, and Firestore sync (NO emojis)
 * ============================================================================
 */

const FlyvisAuthState = {
  currentUser: null,
  userProfile: {
    name: "",
    email: "",
    phone: "",
    homeAirport: "DEL",
    nationality: "Indian",
    savedCards: ["hdfc_infinia", "axis_atlas"]
  },
  activeAlerts: [],
  flightBookings: [],
  visaApplications: [],
  dummyTickets: []
};

// Listen for Firebase Auth state changes
document.addEventListener("DOMContentLoaded", () => {
  initFirebaseAuthListener();
});

function initFirebaseAuthListener() {
  if (typeof firebase === "undefined" || !firebase.auth) {
    setTimeout(initFirebaseAuthListener, 300);
    return;
  }

  // Handle mobile redirect sign-in results
  try {
    firebase.auth().getRedirectResult().then((result) => {
      if (result && result.user) {
        renderToast(`Welcome, ${result.user.displayName ? result.user.displayName.split(' ')[0] : 'Traveler'}`);
      }
    }).catch((err) => {
      console.warn("Redirect result check:", err);
    });
  } catch (e) {}

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      FlyvisAuthState.currentUser = user;
      await syncUserProfileToFirestore(user);
      renderAuthNavbar(user);
      loadUserActivityData(user);
    } else {
      FlyvisAuthState.currentUser = null;
      renderAuthNavbar(null);
    }
  });
}

let _pendingAuthAction = null;

/**
 * Universal Auth Requirement Guard
 */
function requireFlyvisAuth(actionCallback, featureName = "use this feature") {
  if (FlyvisAuthState.currentUser) {
    return true;
  }
  openAuthGateModal(featureName, actionCallback);
  return false;
}

function openAuthGateModal(featureName, callback) {
  _pendingAuthAction = callback || null;
  let modal = document.getElementById("flyvis-auth-gate-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "flyvis-auth-gate-modal";
    modal.className = "ota-booking-modal-overlay";
    modal.style.cssText = "display:flex; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(13,27,42,0.65); backdrop-filter:blur(6px); z-index:10010; align-items:center; justify-content:center; padding:16px;";
    modal.onclick = (e) => { if (e.target === modal) closeAuthGateModal(); };
    modal.innerHTML = `
      <div class="ota-booking-modal" style="max-width:440px; width:100%; background:#FFFFFF; border-radius:20px; border:1px solid #CBD5E1; box-shadow:0 20px 40px rgba(0,0,0,0.18); overflow:hidden;">
        <div style="padding:24px 28px 20px; text-align:center; border-bottom:1px solid #F1F5F9; position:relative;">
          <button type="button" onclick="closeAuthGateModal()" style="position:absolute; top:18px; right:18px; background:none; border:none; font-size:22px; cursor:pointer; color:#64748B;">&times;</button>
          <div style="width:52px; height:52px; background:#EAF6F6; border-radius:14px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:14px; color:#2E7D7E;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
          </div>
          <h3 style="margin:0 0 6px; font-size:20px; font-weight:900; color:#0D1B2A;" id="auth-gate-title">Sign In or Sign Up</h3>
          <p style="margin:0; font-size:13.5px; color:#64748B; line-height:1.5;" id="auth-gate-desc">Please sign in with Google to ${featureName} and access your Flyvis tools.</p>
        </div>
        
        <div style="padding:22px 28px 28px;">
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:14px 16px; margin-bottom:20px;">
            <div style="font-size:12.5px; font-weight:800; color:#0D1B2A; margin-bottom:8px;">Member Access Includes:</div>
            <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#334155; margin-bottom:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              24/7 AI Price Drop Alerts & Live Notifications
            </div>
            <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#334155; margin-bottom:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              18+ Bank Credit Card Multiplier & Points Optimizer
            </div>
            <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#334155;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Instant Embassy-Ready Dummy Tickets & Visa Processing
            </div>
          </div>

          <button type="button" onclick="handleAuthGateSignIn()" style="display:flex; align-items:center; justify-content:center; gap:12px; width:100%; background:#FFFFFF; border:1.5px solid #CBD5E1; padding:13px 20px; border-radius:10px; font-size:14.5px; font-weight:800; color:#0D1B2A; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.06); transition:background 0.2s;">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            Sign In with Google
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    const descEl = document.getElementById("auth-gate-desc");
    if (descEl) descEl.textContent = `Please sign in with Google to ${featureName} and access your Flyvis tools.`;
    modal.style.display = "flex";
  }
}

function closeAuthGateModal() {
  const modal = document.getElementById("flyvis-auth-gate-modal");
  if (modal) modal.style.display = "none";
}

async function handleAuthGateSignIn() {
  await signInWithGoogle((user) => {
    closeAuthGateModal();
    if (typeof _pendingAuthAction === "function") {
      const act = _pendingAuthAction;
      _pendingAuthAction = null;
      act(user);
    }
  });
}

/**
 * 1-Click Google Sign-In with Popup & Mobile Redirect Fallback
 */
async function signInWithGoogle(callback) {
  if (typeof firebase === "undefined" || !firebase.auth) {
    alert("Authentication service initializing. Please try again in a moment.");
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    renderToast(`Welcome, ${user.displayName ? user.displayName.split(' ')[0] : 'Traveler'}`);
    if (typeof callback === "function") callback(user);
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    
    // Ignore user deliberately closing popup
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      return;
    }

    // If popup is blocked by browser/mobile Safari, fallback to direct redirect
    if (error.code === "auth/popup-blocked") {
      try {
        await firebase.auth().signInWithRedirect(provider);
        return;
      } catch (redirectErr) {
        console.error("Redirect sign in error:", redirectErr);
      }
    }

    // Domain Whitelist Diagnostic Guide
    if (error.code === "auth/unauthorized-domain") {
      const currentHost = window.location.hostname;
      alert(`Authentication Domain Error:\n\nThe domain "${currentHost}" is not listed in Firebase Authorized Domains.\n\nPlease visit the official site at https://fly-s-8baec.web.app or add "${currentHost}" in Firebase Console > Authentication > Settings > Authorized domains.`);
    } else if (error.code === "auth/operation-not-allowed") {
      alert("Google Sign-In is currently disabled in your Firebase project. Please enable Google provider in Firebase Console > Authentication > Sign-in method.");
    } else {
      alert(`Sign in failed (${error.code || 'error'}): ${error.message}`);
    }
  }
}

/**
 * Sign Out
 */
async function signOutUser() {
  try {
    await firebase.auth().signOut();
    renderToast("Signed out successfully.");
    closeUserDashboard();
    closeUserProfileModal();
    if (typeof renderMyFlightsPage === "function") renderMyFlightsPage();
  } catch (error) {
    console.error("Sign-out error:", error);
  }
}

/**
 * Sync User Profile to Firestore
 */
async function syncUserProfileToFirestore(user) {
  // Load local cached profile first for instant responsiveness
  try {
    const cached = localStorage.getItem("flyvis_user_profile_" + user.uid);
    if (cached) {
      FlyvisAuthState.userProfile = JSON.parse(cached);
    }
  } catch (e) {}

  if (typeof db === "undefined") return;

  try {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    const userData = {
      uid: user.uid,
      name: user.displayName || "Traveler",
      email: user.email || "",
      photoURL: user.photoURL || "",
      lastLoginAt: (typeof firebase !== "undefined" && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    };

    if (!doc.exists) {
      userData.createdAt = (typeof firebase !== "undefined" && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
      userData.savedCards = ["hdfc_infinia", "axis_atlas"];
      userData.phone = (FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.phone) || "";
      userData.homeAirport = (FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.homeAirport) || "DEL";
      userData.nationality = (FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.nationality) || "Indian";
      await userRef.set(userData, { merge: true });
      FlyvisAuthState.userProfile = { ...userData };
    } else {
      await userRef.set(userData, { merge: true });
      const existing = doc.data() || {};
      FlyvisAuthState.userProfile = { ...FlyvisAuthState.userProfile, ...existing, ...userData };
      if (existing.savedCards && typeof FlyvisOtaState !== 'undefined') {
        FlyvisOtaState.filters.selectedCardIds = existing.savedCards;
        if (typeof renderSidebarCardsList === 'function') renderSidebarCardsList();
      }
    }
    localStorage.setItem("flyvis_user_profile_" + user.uid, JSON.stringify(FlyvisAuthState.userProfile));
  } catch (err) {
    console.warn("Could not sync user profile to Firestore:", err);
  }
}

/**
 * Render Navbar Auth State
 */
function renderAuthNavbar(user) {
  const container = document.getElementById("nav-auth-container");
  const mobileContainer = document.getElementById("mobile-nav-auth");

  if (container) {
    if (user) {
      const firstName = user.displayName ? user.displayName.split(' ')[0] : 'My Account';
      const avatarSrc = user.photoURL || 'assets/brand/flyvis-icon.png';
      container.innerHTML = `
        <button type="button" onclick="openUserProfileModal()" style="display:inline-flex; align-items:center; gap:8px; background:#FFFFFF; border:1px solid #CBD5E1; padding:5px 12px 5px 6px; border-radius:24px; font-size:12.5px; font-weight:800; color:#0D1B2A; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.04); transition:all 0.15s;">
          <img src="${avatarSrc}" alt="${firstName}" style="width:22px; height:22px; border-radius:50%; object-fit:cover; border:1.5px solid #2E7D7E;" />
          <span>${firstName}</span>
        </button>
      `;
    } else {
      container.innerHTML = `
        <button type="button" onclick="signInWithGoogle()" style="display:inline-flex; align-items:center; gap:6px; background:#FFFFFF; border:1px solid #CBD5E1; padding:6px 12px; border-radius:24px; font-size:12px; font-weight:800; color:#0D1B2A; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.04); transition:all 0.15s;">
          <svg width="13" height="13" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          <span>Sign In</span>
        </button>
      `;
    }
  }

  if (mobileContainer) {
    if (user) {
      mobileContainer.innerHTML = `
        <div style="padding:12px 16px; display:flex; align-items:center; justify-content:space-between; border-top:1px solid #E2E8F0; margin-top:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <img src="${user.photoURL || 'assets/brand/flyvis-icon.png'}" style="width:28px; height:28px; border-radius:50%;" />
            <span style="font-size:13px; font-weight:800; color:#0D1B2A;">${user.displayName || 'Traveler'}</span>
          </div>
          <button type="button" onclick="signOutUser()" style="background:none; border:none; color:#E11D48; font-size:12px; font-weight:800; cursor:pointer;">Sign Out</button>
        </div>
      `;
    } else {
      mobileContainer.innerHTML = `
        <div style="padding:12px 16px; border-top:1px solid #E2E8F0; margin-top:8px;">
          <button type="button" onclick="signInWithGoogle()" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; background:#FFFFFF; border:1px solid #CBD5E1; padding:10px; border-radius:8px; font-size:13px; font-weight:800; color:#0D1B2A; cursor:pointer;">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            <span>Sign In with Google</span>
          </button>
        </div>
      `;
    }
  }
}

/**
 * Load User Activity from Firestore & Local Storage
 */
function loadLocalSavedAlerts(uid) {
  try {
    const key = "flyvis_saved_alerts_" + (uid || "guest");
    const local = localStorage.getItem(key);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        FlyvisAuthState.activeAlerts = parsed;
      }
    }
  } catch (e) {}
}

function saveLocalAlerts(uid, alerts) {
  try {
    const key = "flyvis_saved_alerts_" + (uid || "guest");
    localStorage.setItem(key, JSON.stringify(alerts));
  } catch (e) {}
}

async function loadUserActivityData(user) {
  if (!user) return;

  // 1. Instant load from local storage
  loadLocalSavedAlerts(user.uid);
  if (typeof renderSidebarMarkup === "function") renderSidebarMarkup();
  if (typeof renderMyFlightsPage === "function") renderMyFlightsPage();

  if (typeof db === "undefined") return;

  try {
    // 2. Real-time Firestore snapshot listener
    db.collection("price_alerts")
      .where("uid", "==", user.uid)
      .onSnapshot((snapshot) => {
        const firestoreAlerts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Merge with any local alerts
        const existingLocal = FlyvisAuthState.activeAlerts || [];
        const mergedMap = new Map();

        firestoreAlerts.forEach(a => mergedMap.set(a.id || `${a.from}_${a.to}_${a.date}`, a));
        existingLocal.forEach(a => {
          const key = a.id || `${a.from}_${a.to}_${a.date}`;
          if (!mergedMap.has(key)) mergedMap.set(key, a);
        });

        FlyvisAuthState.activeAlerts = Array.from(mergedMap.values());
        saveLocalAlerts(user.uid, FlyvisAuthState.activeAlerts);

        if (typeof renderSidebarMarkup === "function") renderSidebarMarkup();
        if (typeof renderMyFlightsPage === "function") renderMyFlightsPage();
      }, (err) => {
        console.warn("Firestore real-time alerts warning:", err);
      });

    // 3. Visa applications
    const visasSnap = await db.collection("visa_applications")
      .where("userId", "==", user.uid)
      .get();
    FlyvisAuthState.visaApplications = visasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Dummy tickets
    const dummySnap = await db.collection("dummy_tickets")
      .where("userId", "==", user.uid)
      .get();
    FlyvisAuthState.dummyTickets = dummySnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (typeof renderSidebarMarkup === "function") renderSidebarMarkup();
    if (typeof renderMyFlightsPage === "function") renderMyFlightsPage();
  } catch (err) {
    console.warn("Could not query user activity:", err);
  }
}

/**
 * Ensure My Profile Modal Markup is in DOM
 */
function ensureUserProfileModal() {
  let modal = document.getElementById("flyvis-profile-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "ota-booking-modal-overlay";
    modal.id = "flyvis-profile-modal";
    modal.onclick = (e) => { if (e.target === modal) closeUserProfileModal(); };
    modal.innerHTML = `
      <div class="ota-booking-modal" style="max-width:480px;">
        <div class="ota-modal-head">
          <h3 style="margin:0; font-size:17px; font-weight:900; color:#0D1B2A;">My Profile</h3>
          <button type="button" onclick="closeUserProfileModal()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#64748B; padding:0 4px; line-height:1;">&times;</button>
        </div>
        <div class="ota-modal-body" id="profile-modal-body">
          <!-- Injected dynamically -->
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  return modal;
}

/**
 * Open My Profile Modal
 */
function openUserProfileModal() {
  const user = FlyvisAuthState.currentUser;
  if (!user) {
    signInWithGoogle(() => openUserProfileModal());
    return;
  }

  const modal = ensureUserProfileModal();
  const body = document.getElementById("profile-modal-body");
  const profile = FlyvisAuthState.userProfile || {};

  body.innerHTML = `
    <form onsubmit="saveUserProfile(event)">
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid #E2E8F0;">
        <img src="${user.photoURL || 'assets/brand/flyvis-icon.png'}" alt="${user.displayName}" style="width:52px; height:52px; border-radius:50%; object-fit:cover; border:2px solid #2E7D7E;" />
        <div>
          <div style="font-size:15px; font-weight:900; color:#0D1B2A;">${user.displayName || 'Traveler'}</div>
          <div style="font-size:12px; color:#64748B;">${user.email}</div>
          <span style="display:inline-block; margin-top:3px; font-size:10.5px; font-weight:800; background:#DCFCE7; color:#166534; padding:2px 7px; border-radius:4px;">Verified Member</span>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block; font-size:12px; font-weight:800; color:#0D1B2A; margin-bottom:5px;">Full Name</label>
        <input type="text" id="prof-name" class="ota-input-field" style="width:100%; border:1.5px solid #CBD5E1; padding:10px 12px; border-radius:8px; font-size:13.5px; box-sizing:border-box;" value="${profile.name || user.displayName || ''}" required />
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block; font-size:12px; font-weight:800; color:#0D1B2A; margin-bottom:5px;">Phone / WhatsApp Number</label>
        <input type="tel" id="prof-phone" class="ota-input-field" style="width:100%; border:1.5px solid #CBD5E1; padding:10px 12px; border-radius:8px; font-size:13.5px; box-sizing:border-box;" placeholder="+91 98765 43210" value="${profile.phone || ''}" required />
        <span style="font-size:11px; color:#64748B;">Used to receive 24/7 price drop alerts and flight booking confirmations.</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:800; color:#0D1B2A; margin-bottom:5px;">Home Airport</label>
          <input type="text" id="prof-airport" class="ota-input-field" style="width:100%; border:1.5px solid #CBD5E1; padding:10px 12px; border-radius:8px; font-size:13.5px; box-sizing:border-box;" placeholder="DEL / BOM / DXB" value="${profile.homeAirport || 'DEL'}" />
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:800; color:#0D1B2A; margin-bottom:5px;">Nationality</label>
          <input type="text" id="prof-nat" class="ota-input-field" style="width:100%; border:1.5px solid #CBD5E1; padding:10px 12px; border-radius:8px; font-size:13.5px; box-sizing:border-box;" value="${profile.nationality || 'Indian'}" />
        </div>
      </div>

      <button type="submit" style="width:100%; padding:13px; background:#2E7D7E; color:#FFFFFF; border:none; border-radius:10px; font-size:14px; font-weight:800; cursor:pointer; box-shadow:0 4px 14px rgba(46,125,126,0.25);">
        Save Profile
      </button>
    </form>
  `;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeUserProfileModal() {
  const modal = document.getElementById("flyvis-profile-modal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}

/**
 * Save User Profile to Firestore & Local Storage
 */
async function saveUserProfile(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const user = FlyvisAuthState.currentUser;
  if (!user) {
    alert("Please sign in to save your profile.");
    return;
  }

  const name = document.getElementById("prof-name")?.value.trim() || user.displayName || "Traveler";
  const phone = document.getElementById("prof-phone")?.value.trim() || "";
  const airport = document.getElementById("prof-airport")?.value.trim().toUpperCase() || "DEL";
  const nat = document.getElementById("prof-nat")?.value.trim() || "Indian";

  const profileData = {
    uid: user.uid,
    name: name,
    email: user.email || "",
    phone: phone,
    homeAirport: airport,
    nationality: nat,
    savedCards: (FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.savedCards) || ["hdfc_infinia", "axis_atlas"],
    updatedAt: (typeof firebase !== "undefined" && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
  };

  FlyvisAuthState.userProfile = { ...FlyvisAuthState.userProfile, ...profileData };
  localStorage.setItem("flyvis_user_profile_" + user.uid, JSON.stringify(profileData));

  try {
    if (typeof db !== "undefined") {
      await db.collection("users").doc(user.uid).set(profileData, { merge: true });
    }
    renderToast("Profile updated successfully.");
    closeUserProfileModal();
    if (typeof renderSidebarMarkup === "function") renderSidebarMarkup();
    if (typeof renderMyFlightsPage === "function") renderMyFlightsPage();
  } catch (err) {
    console.warn("Firestore profile sync warning:", err);
    // Still succeed locally if localStorage saved
    renderToast("Profile updated successfully.");
    closeUserProfileModal();
    if (typeof renderSidebarMarkup === "function") renderSidebarMarkup();
  }
}

/**
 * Ensure User Dashboard Modal Markup is in DOM
 */
function ensureUserDashboardModal() {
  let modal = document.getElementById("flyvis-user-dashboard-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "ota-booking-modal-overlay";
    modal.id = "flyvis-user-dashboard-modal";
    modal.onclick = (e) => { if (e.target === modal) closeUserDashboard(); };
    modal.innerHTML = `
      <div class="ota-booking-modal">
        <div class="ota-modal-head">
          <div style="display:flex; align-items:center; gap:10px;">
            <h3 style="margin:0; font-size:17px; font-weight:900; color:#0D1B2A;">My Account &amp; Past Actions</h3>
          </div>
          <button type="button" onclick="closeUserDashboard()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#64748B; padding:0 4px; line-height:1;">&times;</button>
        </div>

        <!-- Navigation Tabs -->
        <div style="display:flex; border-bottom:1px solid #E2E8F0; background:#F8FAFC; padding:0 8px; overflow-x:auto;">
          <button type="button" class="ud-tab-btn active" data-tab="flights" onclick="renderDashboardContent('flights')" style="padding:12px 14px; background:none; border:none; font-size:13px; font-weight:800; color:#0D1B2A; cursor:pointer; border-bottom:2.5px solid #2E7D7E; white-space:nowrap;">
            My Flights
          </button>
          <button type="button" class="ud-tab-btn" data-tab="visas" onclick="renderDashboardContent('visas')" style="padding:12px 14px; background:none; border:none; font-size:13px; font-weight:800; color:#64748B; cursor:pointer; white-space:nowrap;">
            My Visas
          </button>
          <button type="button" class="ud-tab-btn" data-tab="dummy" onclick="renderDashboardContent('dummy')" style="padding:12px 14px; background:none; border:none; font-size:13px; font-weight:800; color:#64748B; cursor:pointer; white-space:nowrap;">
            My Dummy Tickets
          </button>
          <button type="button" class="ud-tab-btn" data-tab="wallet" onclick="renderDashboardContent('wallet')" style="padding:12px 14px; background:none; border:none; font-size:13px; font-weight:800; color:#64748B; cursor:pointer; white-space:nowrap;">
            My Wallet
          </button>
        </div>

        <div class="ota-modal-body" id="user-dashboard-body">
          <!-- Injected dynamically -->
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  return modal;
}

/**
 * Open User Dashboard Modal
 */
function openUserDashboard(activeTab = "flights") {
  if (activeTab === "flights") {
    window.location.href = "my-flights.html";
    return;
  }

  const modal = ensureUserDashboardModal();
  if (!modal) return;

  renderDashboardContent(activeTab);
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeUserDashboard() {
  const modal = document.getElementById("flyvis-user-dashboard-modal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}

function renderDashboardContent(tab) {
  const body = document.getElementById("user-dashboard-body");
  if (!body) return;

  // Update tabs active class
  document.querySelectorAll(".ud-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  if (tab === "flights") {
    window.location.href = "my-flights.html";
  } else if (tab === "visas") {
    renderVisasTab(body);
  } else if (tab === "dummy") {
    renderDummyTicketsTab(body);
  } else if (tab === "wallet") {
    renderWalletTab(body);
  }
}

/**
 * TAB 2: MY VISAS
 */
function renderVisasTab(container) {
  const visas = FlyvisAuthState.visaApplications || [];

  container.innerHTML = `
    <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:13px; font-weight:800; color:#0D1B2A;">Visa Applications (${visas.length})</span>
      <button type="button" onclick="closeUserDashboard(); window.location.href='visas.html';" style="background:#EAF6F6; color:#2E7D7E; border:1px solid #2E7D7E; padding:4px 10px; border-radius:6px; font-size:11.5px; font-weight:800; cursor:pointer;">Apply for Visa</button>
    </div>
  `;

  if (visas.length === 0) {
    container.innerHTML += `
      <div style="text-align:center; padding:36px 16px; color:#64748B; background:#F8FAFC; border-radius:10px;">
        <div style="font-size:14px; font-weight:800; color:#0D1B2A; margin-bottom:4px;">No Visa Applications Found</div>
        <p style="font-size:12px; margin:0 0 14px;">Apply for visas to 120+ countries with guaranteed on-time processing.</p>
        <button type="button" onclick="closeUserDashboard(); window.location.href='visas.html';" style="padding:8px 16px; background:#2E7D7E; color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:800; cursor:pointer;">Browse Visas</button>
      </div>
    `;
    return;
  }

  container.innerHTML += `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${visas.map(v => `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:14px; font-weight:900; color:#0D1B2A;">${v.country || 'Visa Application'}</span>
            <span style="font-size:11px; background:#DCFCE7; color:#166534; padding:2px 8px; border-radius:4px; font-weight:800;">${v.status || 'IN PROCESSING'}</span>
          </div>
          <div style="font-size:12px; color:#64748B;">Applicant: ${v.applicantName || 'Applicant'} • Type: ${v.visaType || 'Tourist Visa'}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/**
 * TAB 3: MY DUMMY TICKETS
 */
function renderDummyTicketsTab(container) {
  const dummyTickets = FlyvisAuthState.dummyTickets || [];

  container.innerHTML = `
    <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:13px; font-weight:800; color:#0D1B2A;">Dummy Tickets &amp; Hotel Proofs (${dummyTickets.length})</span>
      <button type="button" onclick="closeUserDashboard(); window.location.href='dummy-ticket.html';" style="background:#EAF6F6; color:#2E7D7E; border:1px solid #2E7D7E; padding:4px 10px; border-radius:6px; font-size:11.5px; font-weight:800; cursor:pointer;">Create Ticket</button>
    </div>
  `;

  if (dummyTickets.length === 0) {
    container.innerHTML += `
      <div style="text-align:center; padding:36px 16px; color:#64748B; background:#F8FAFC; border-radius:10px;">
        <div style="font-size:14px; font-weight:800; color:#0D1B2A; margin-bottom:4px;">No Dummy Tickets Created</div>
        <p style="font-size:12px; margin:0 0 14px;">Generate verified dummy onward flight tickets for visa applications within 60 mins.</p>
        <button type="button" onclick="closeUserDashboard(); window.location.href='dummy-ticket.html';" style="padding:8px 16px; background:#2E7D7E; color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:800; cursor:pointer;">Create Dummy Ticket</button>
      </div>
    `;
    return;
  }

  container.innerHTML += `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${dummyTickets.map(d => `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:14px; font-weight:900; color:#0D1B2A;">${d.route || d.destination || 'Flight Ticket'}</span>
            <span style="font-size:11px; background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:4px; font-weight:800;">VERIFIED PNR</span>
          </div>
          <div style="font-size:12px; color:#64748B;">Date: ${d.flightDate || 'Upcoming'} • Contact: ${d.phone || '+91 92070 21258'}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/**
 * TAB 4: MY WALLET (Credit Cards & Multipliers)
 */
function renderWalletTab(container) {
  const allCards = typeof MASTER_CREDIT_CARDS !== 'undefined' ? MASTER_CREDIT_CARDS : [];
  const savedCards = (FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.savedCards) || ["hdfc_infinia"];

  container.innerHTML = `
    <div style="margin-bottom:12px; font-size:12.5px; color:#64748B;">
      Select the credit cards you own. Flyvis automatically calculates your maximum bank reward points and cashback on every flight search.
    </div>
    <div style="max-height:260px; overflow-y:auto; padding-right:4px;">
      ${allCards.map(c => {
        const isSaved = savedCards.includes(c.id);
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border:1px solid #E2E8F0; border-radius:8px; margin-bottom:6px; background:${isSaved ? '#EAF6F6' : '#fff'}; cursor:pointer;" onclick="toggleSavedCard('${c.id}')">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:12px; height:12px; border-radius:3px; background:${c.color || '#2E7D7E'};"></div>
              <div>
                <div style="font-size:13px; font-weight:800; color:#0D1B2A;">${c.name} <span style="font-size:11px; color:#64748B; font-weight:500;">(${c.bank})</span></div>
                <div style="font-size:10.5px; color:#16A34A; font-weight:700;">${c.flightMultiplier || 'Travel Benefits'}</div>
              </div>
            </div>
            <span style="font-size:12px; font-weight:800; color:${isSaved ? '#2E7D7E' : '#94A3B8'};">${isSaved ? 'Saved' : 'Add'}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function toggleSavedCard(cardId) {
  const user = FlyvisAuthState.currentUser;
  if (!user) return;

  const profile = FlyvisAuthState.userProfile || { savedCards: [] };
  let cards = profile.savedCards || [];

  const idx = cards.indexOf(cardId);
  if (idx > -1) {
    cards.splice(idx, 1);
  } else {
    cards.push(cardId);
  }

  profile.savedCards = cards;
  FlyvisAuthState.userProfile = profile;

  try {
    if (typeof db !== "undefined") {
      await db.collection("users").doc(user.uid).update({ savedCards: cards });
    }
  } catch (e) {
    console.warn("Could not save card to Firestore:", e);
  }

  if (typeof FlyvisOtaState !== "undefined") {
    FlyvisOtaState.filters.selectedCardIds = [...cards];
    if (typeof renderSidebarCardsList === "function") renderSidebarCardsList();
    if (typeof applyFilters === "function") applyFilters();
  }

  renderDashboardContent("wallet");
}

async function deletePriceAlert(alertId) {
  const user = FlyvisAuthState.currentUser;
  FlyvisAuthState.activeAlerts = FlyvisAuthState.activeAlerts.filter(a => a.id !== alertId);
  saveLocalAlerts(user ? user.uid : "guest", FlyvisAuthState.activeAlerts);
  if (typeof renderMyFlightsPage === "function") renderMyFlightsPage();
  if (typeof renderSidebarMarkup === "function") renderSidebarMarkup();

  if (typeof db !== "undefined" && alertId && !alertId.startsWith("local_")) {
    try {
      await db.collection("price_alerts").doc(alertId).delete().catch(() => {});
      await db.collection("flight_price_alerts").doc(alertId).delete().catch(() => {});
    } catch (err) {
      console.warn("Firestore delete alert:", err);
    }
  }
  renderToast("Flight alert removed.");
}

/**
 * Toast Notification Utility
 */
function renderToast(message) {
  let toast = document.getElementById("flyvis-auth-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "flyvis-auth-toast";
    toast.style.cssText = "position:fixed; bottom:24px; right:24px; background:#0D1B2A; color:#fff; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:700; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:9999; transition:all 0.3s ease; opacity:0; transform:translateY(10px); pointer-events:none;";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
  }, 3200);
}
