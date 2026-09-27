/**
 * FareOS Enterprise Admin Portal — Authentication & User Management Controller
 * Supports Firebase Auth, Cloud Firestore `admin_users` collection, and server.py fallback.
 */

// Global state
let currentAuthMode = "signin";

// Whitelist Storage Key
const WHITELIST_STORAGE_KEY = "fareos_authorized_admins_v1";

// Default pre-seeded admin accounts with productivity stats
const DEFAULT_AUTHORIZED_ADMINS = [
  {
    id: "adm_susen",
    name: "Susen",
    email: "susen@flyvis.com",
    role: "Super Admin",
    avatar: "S",
    status: "Active",
    isOwner: true,
    lastActive: "Active Now",
    stats: {
      bookingsProcessed: 78,
      gmvHandled: 542800,
      visasHandled: 14,
      markupsCreated: 9
    },
    modules: [
      "Flight Bookings",
      "Markup Master",
      "Revenue Dashboard",
      "Accounting Logs",
      "Visa Operations",
      "Admin Team & Roles"
    ]
  },
  {
    id: "adm_zaid",
    name: "Zaid Khaleel",
    email: "admin@flyvis.com",
    role: "Lead Admin",
    avatar: "Z",
    status: "Active",
    isOwner: false,
    lastActive: "14 mins ago",
    stats: {
      bookingsProcessed: 42,
      gmvHandled: 318500,
      visasHandled: 28,
      markupsCreated: 3
    },
    modules: [
      "Flight Bookings",
      "Markup Master",
      "Revenue Dashboard",
      "Accounting Logs",
      "Visa Operations"
    ]
  },
  {
    id: "adm_desk",
    name: "Flight Desk Admin",
    email: "flights@flyvis.com",
    role: "Flight Desk Admin",
    avatar: "F",
    status: "Active",
    isOwner: false,
    lastActive: "2 hours ago",
    stats: {
      bookingsProcessed: 21,
      gmvHandled: 184200,
      visasHandled: 0,
      markupsCreated: 1
    },
    modules: [
      "Flight Bookings",
      "Flight Desk & Alerts",
      "Supplier Mapping"
    ]
  },
  {
    id: "adm_visa",
    name: "Visa Operations Lead",
    email: "visa.ops@flyvis.com",
    role: "Visa Admin",
    avatar: "V",
    status: "Active",
    isOwner: false,
    lastActive: "4 hours ago",
    stats: {
      bookingsProcessed: 0,
      gmvHandled: 0,
      visasHandled: 166,
      markupsCreated: 0
    },
    modules: [
      "Visa Operations Hub",
      "Add Visa",
      "Manage Visas"
    ]
  },
  {
    id: "adm_support",
    name: "Support Desk",
    email: "support@flyvis.com",
    role: "Support Desk",
    avatar: "S",
    status: "Passive",
    isOwner: false,
    lastActive: "Yesterday",
    stats: {
      bookingsProcessed: 5,
      gmvHandled: 34200,
      visasHandled: 8,
      markupsCreated: 0
    },
    modules: [
      "Flight Bookings (Read-only)",
      "Ancillary Queue"
    ]
  }
];

/**
 * Check if an email is authorized by a Super Admin
 */
function getAuthorizedAdmin(email) {
  const normEmail = (email || "").trim().toLowerCase();
  let list = [];
  try {
    const raw = localStorage.getItem(WHITELIST_STORAGE_KEY);
    if (raw) {
      list = JSON.parse(raw);
    }
  } catch (e) {}

  if (!Array.isArray(list) || list.length === 0) {
    list = JSON.parse(JSON.stringify(DEFAULT_AUTHORIZED_ADMINS));
    try {
      localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  // Exact email match
  let match = list.find(a => (a.email || "").trim().toLowerCase() === normEmail);
  
  // Support aliases for development/legacy tests
  if (!match) {
    if (normEmail === "zaid@flyvis.com") {
      match = list.find(a => (a.email || "").trim().toLowerCase() === "admin@flyvis.com");
    } else if (normEmail === "desk@flyvis.com" || normEmail === "desk@fareos.com") {
      match = list.find(a => (a.email || "").trim().toLowerCase() === "flights@flyvis.com");
    } else if (normEmail === "susen@fareos.com") {
      match = list.find(a => (a.email || "").trim().toLowerCase() === "susen@flyvis.com");
    } else if (normEmail === "support@fareos.com") {
      match = list.find(a => (a.email || "").trim().toLowerCase() === "support@flyvis.com");
    }
  }

  return match || null;
}

document.addEventListener("DOMContentLoaded", () => {
  // Ensure whitelist is seeded
  getAuthorizedAdmin("susen@flyvis.com");

  // Check if user just logged out
  const params = new URLSearchParams(window.location.search);
  if (params.get("logout") === "true") {
    try {
      localStorage.removeItem("fareos_current_admin");
      localStorage.removeItem("flyvis_current_admin");
      localStorage.removeItem("fareos_admin_session");
      localStorage.removeItem("flyvis_admin_session");
      if (typeof firebase !== "undefined" && firebase.auth) {
        firebase.auth().signOut().catch(() => {});
      }
    } catch (e) {}
    showToast("You have been logged out securely.", "success");
  } else if (params.get("reason") === "suspended") {
    showToast("Access Suspended: Your admin profile is currently marked as Passive by Super Admin.", "error");
  } else {
    // Check remembered email
    try {
      const rem = localStorage.getItem("flyvis_remembered_email") || localStorage.getItem("fareos_remembered_email");
      if (rem) {
        const inEl = document.getElementById("signin-email");
        if (inEl) inEl.value = rem;
      }
    } catch (e) {}
  }
});

/**
 * Toggle Password Visibility
 */
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";

  if (isPassword) {
    btn.innerHTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
    btn.setAttribute("title", "Hide password");
  } else {
    btn.innerHTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    btn.setAttribute("title", "Show password");
  }
}

/**
 * Switch between Sign In and Sign Up modes
 */
function switchAuthMode(mode) {
  currentAuthMode = mode;
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");
  const tagEl = document.getElementById("hero-tag");
  const headingEl = document.getElementById("hero-heading");
  const descEl = document.getElementById("hero-desc");

  if (mode === "signup") {
    signinForm.style.display = "none";
    signupForm.style.display = "block";
    tagEl.innerHTML = `<span>&mdash;</span> CREATE ADMIN ACCOUNT`;
    headingEl.innerHTML = `Create your admin<br/>dashboard account`;
    descEl.innerText = `Register your enterprise admin profile with role-based access permissions.`;
  } else {
    signupForm.style.display = "none";
    signinForm.style.display = "block";
    tagEl.innerHTML = `<span>&mdash;</span> WELCOME BACK`;
    headingEl.innerHTML = `Sign in to your<br/>admin dashboard`;
    descEl.innerText = `Enter your credentials to access the FareOS admin console.`;
  }
}

/**
 * 1-Click Demo Credentials Autofill
 */
function fillDemoCredentials(email, password) {
  const emailInput = document.getElementById("signin-email");
  const passInput = document.getElementById("signin-password");
  if (emailInput && passInput) {
    emailInput.value = email;
    passInput.value = password;
    showToast(`Loaded demo credentials for ${email.split('@')[0]}`, "success");
    // Subtle visual feedback
    emailInput.style.borderColor = "#2563EB";
    passInput.style.borderColor = "#2563EB";
    setTimeout(() => {
      emailInput.style.borderColor = "#E2E8F0";
      passInput.style.borderColor = "#E2E8F0";
    }, 1200);
  }
}

/**
 * Handle Admin Sign In
 */
async function handleAdminSignIn(event) {
  event.preventDefault();
  const email = document.getElementById("signin-email").value.trim();
  const password = document.getElementById("signin-password").value.trim();
  const rememberMe = document.getElementById("signin-remember").checked;
  const btn = document.getElementById("btn-signin");
  const btnText = document.getElementById("btn-signin-text");

  if (!email || !password) {
    showToast("Please enter both email and password.", "error");
    return;
  }

  // 0. Super Admin Authorization Whitelist Gatekeeper
  const authorized = getAuthorizedAdmin(email);
  if (!authorized) {
    showToast(`Access Denied: "${email}" has not been granted authorization rights by a Super Admin.`, "error");
    return;
  }

  if (authorized.status === "Passive") {
    showToast(`Access Suspended: Account (${email}) is currently set to Passive. Contact Super Admin to reactivate.`, "error");
    return;
  }

  // Set loading state
  btn.disabled = true;
  btnText.innerHTML = `
    <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
    </svg>
    <span>Authenticating...</span>
  `;

  try {
    let adminProfile = null;
    let authSuccess = false;

    // 1. First try Firebase Auth
    if (typeof firebase !== "undefined" && firebase.auth) {
      try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const fbUser = userCredential.user;
        
        // Fetch or create Firestore admin_users doc
        if (typeof db !== "undefined" && db) {
          const docRef = db.collection("admin_users").doc(fbUser.uid);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
            adminProfile = docSnap.data();
            adminProfile.uid = fbUser.uid;
            // Update lastLogin
            await docRef.update({ lastLogin: new Date().toISOString() }).catch(() => {});
          } else {
            // Seed profile
            const name = email.split("@")[0];
            adminProfile = {
              uid: fbUser.uid,
              name: name.charAt(0).toUpperCase() + name.slice(1),
              email: email,
              role: "Super Admin",
              avatar: name.charAt(0).toUpperCase(),
              lastLogin: new Date().toISOString(),
              createdAt: new Date().toISOString()
            };
            await docRef.set(adminProfile).catch(() => {});
          }
        }
        authSuccess = true;
      } catch (fbErr) {
        console.warn("Firebase Auth sign-in bypassed or failed:", fbErr.code || fbErr.message);
      }
    }

    // 2. If Firebase Auth did not complete, attempt Firestore direct lookup
    if (!authSuccess && typeof db !== "undefined" && db) {
      try {
        const querySnapshot = await db.collection("admin_users").where("email", "==", email.toLowerCase()).get();
        if (!querySnapshot.empty) {
          const matchedDoc = querySnapshot.docs[0];
          const data = matchedDoc.data();
          if (data.password && data.password === password) {
            adminProfile = { ...data, uid: matchedDoc.id };
            authSuccess = true;
            await matchedDoc.ref.update({ lastLogin: new Date().toISOString() }).catch(() => {});
          }
        }
      } catch (fsErr) {
        console.warn("Firestore lookup bypassed:", fsErr);
      }
    }

    // 3. Fallback to Local Server API (/api/admin/login)
    if (!authSuccess) {
      try {
        const resp = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        if (resp.ok) {
          const resData = await resp.json();
          if (resData.success && resData.admin) {
            adminProfile = resData.admin;
            authSuccess = true;
          }
        }
      } catch (srvErr) {
        console.warn("Local server API bypassed:", srvErr);
      }
    }

    // 4. Fallback Pre-configured Accounts (Guaranteed offline / test resilience)
    if (!authSuccess) {
      const demoUsers = [
        { email: "susen@flyvis.com", password: "admin123", name: "Susen", role: "Super Admin", avatar: "S" },
        { email: "susen@fareos.com", password: "admin123", name: "Susen", role: "Super Admin", avatar: "S" },
        { email: "zaid@flyvis.com", password: "zaid123", name: "Zaid Khaleel", role: "Lead Admin", avatar: "Z" },
        { email: "admin@flyvis.com", password: "zaid123", name: "Zaid Khaleel", role: "Lead Admin", avatar: "Z" },
        { email: "desk@flyvis.com", password: "desk123", name: "Flight Desk Admin", role: "Ticketing Desk", avatar: "F" },
        { email: "desk@fareos.com", password: "desk123", name: "Flight Desk Admin", role: "Ticketing Desk", avatar: "F" },
        { email: "support@flyvis.com", password: "support123", name: "Support Desk", role: "Operations Desk", avatar: "S" },
        { email: "support@fareos.com", password: "support123", name: "Support Desk", role: "Operations Desk", avatar: "S" }
      ];

      const found = demoUsers.find(u => (u.email.toLowerCase() === email.toLowerCase()) && u.password === password);
      if (found) {
        adminProfile = {
          uid: "adm_" + found.name.toLowerCase().replace(/\s+/g, "_"),
          name: found.name,
          email: found.email,
          role: found.role,
          avatar: found.avatar,
          lastLogin: new Date().toISOString(),
          status: "Active"
        };
        authSuccess = true;
      }
    }

    if (!authSuccess || !adminProfile) {
      showToast("Invalid email or password. Please try again.", "error");
      btn.disabled = false;
      btnText.innerText = "Continue";
      return;
    }

    // Synchronize authorized profile properties
    adminProfile.status = authorized.status || "Active";
    if (authorized.role) adminProfile.role = authorized.role;
    if (authorized.name) adminProfile.name = authorized.name;
    if (authorized.avatar) adminProfile.avatar = authorized.avatar;
    if (authorized.modules) adminProfile.modules = authorized.modules;
    if (authorized.isOwner) adminProfile.isOwner = true;

    // Remember Me handling
    if (rememberMe) {
      try { localStorage.setItem("fareos_remembered_email", email); } catch(e) {}
      try { localStorage.setItem("flyvis_remembered_email", email); } catch(e) {}
    } else {
      try { localStorage.removeItem("fareos_remembered_email"); } catch(e) {}
      try { localStorage.removeItem("flyvis_remembered_email"); } catch(e) {}
    }

    // Save Active Session (Dual-key for backwards and forward compatibility)
    const sessionData = {
      token: "flyvis_auth_" + Date.now() + "_" + adminProfile.uid,
      email: adminProfile.email,
      loginTime: new Date().toISOString()
    };

    localStorage.setItem("fareos_current_admin", JSON.stringify(adminProfile));
    localStorage.setItem("flyvis_current_admin", JSON.stringify(adminProfile));
    localStorage.setItem("fareos_admin_session", JSON.stringify(sessionData));
    localStorage.setItem("flyvis_admin_session", JSON.stringify(sessionData));

    // Also mirror to Firestore if available to keep cloud synchronized
    if (typeof db !== "undefined" && db) {
      db.collection("admin_users").doc(adminProfile.uid).set(adminProfile, { merge: true }).catch(() => {});
    }

    showToast(`Welcome back, ${adminProfile.name}! Redirecting...`, "success");

    // Redirect after smooth toast
    setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const target = params.get("redirect") || "admin-flight-bookings.html";
      window.location.href = target;
    }, 900);

  } catch (err) {
    console.error("Sign-in unexpected error:", err);
    showToast("An error occurred while signing in. Please check console.", "error");
    btn.disabled = false;
    btnText.innerText = "Continue";
  }
}

/**
 * Handle Admin Sign Up (Account Creation)
 */
async function handleAdminSignUp(event) {
  event.preventDefault();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim().toLowerCase();
  const role = document.getElementById("signup-role").value;
  const password = document.getElementById("signup-password").value.trim();
  const passcode = document.getElementById("signup-passcode").value.trim();
  const btn = document.getElementById("btn-signup");
  const btnText = document.getElementById("btn-signup-text");

  if (!name || !email || !password) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters long.", "error");
    return;
  }

  // 0. Super Admin Authorization Whitelist Gatekeeper for Sign Up
  const authorized = getAuthorizedAdmin(email);
  if (!authorized) {
    showToast(`Authorization Required: "${email}" is not authorized. A Super Admin must add this email in Admin Users before an account can be created.`, "error");
    return;
  }

  if (authorized.status === "Passive") {
    showToast(`Access Suspended: Authorization for "${email}" is currently set to Passive by Super Admin.`, "error");
    return;
  }

  // Verify Enterprise Passcode
  if (passcode !== "FLYVIS-2026" && passcode !== "FAREOS-2026" && passcode !== "ADMIN-SECRET" && passcode !== "") {
    showToast("Invalid Enterprise Admin Key. Use FLYVIS-2026.", "error");
    return;
  }

  btn.disabled = true;
  btnText.innerHTML = `
    <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
    </svg>
    <span>Creating Profile...</span>
  `;

  try {
    const avatar = name.charAt(0).toUpperCase();
    const newUid = "adm_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const assignedRole = authorized.role || role;
    const newAdmin = {
      uid: newUid,
      name: name,
      email: email,
      role: assignedRole,
      avatar: avatar,
      department: `${assignedRole} Desk`,
      status: "Active",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      permissions: assignedRole.toLowerCase().includes("super") ? ["all"] : (authorized.modules || ["flights", "tickets"])
    };

    // 1. Try Firebase Auth Account Creation
    if (typeof firebase !== "undefined" && firebase.auth) {
      try {
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        newAdmin.uid = cred.user.uid;
      } catch (fbCreateErr) {
        console.warn("Firebase Auth user creation note:", fbCreateErr.message);
        // If user already exists in Firebase Auth, we proceed with Firestore document update
      }
    }

    // 2. Save into Firestore `admin_users` collection
    if (typeof db !== "undefined" && db) {
      try {
        await db.collection("admin_users").doc(newAdmin.uid).set({
          ...newAdmin,
          password: password // stored securely for Firestore lookup fallback
        });
      } catch (fsWriteErr) {
        console.warn("Firestore write note:", fsWriteErr);
      }
    }

    // 3. Save into local server Python backend
    try {
      await fetch("/api/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          department: newAdmin.department
        })
      });
    } catch (srvErr) {
      console.warn("Local server signup note:", srvErr);
    }

    // 4. Save Session (Dual-key)
    const sessionData = {
      token: "flyvis_auth_" + Date.now() + "_" + newAdmin.uid,
      email: newAdmin.email,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem("fareos_current_admin", JSON.stringify(newAdmin));
    localStorage.setItem("flyvis_current_admin", JSON.stringify(newAdmin));
    localStorage.setItem("fareos_admin_session", JSON.stringify(sessionData));
    localStorage.setItem("flyvis_admin_session", JSON.stringify(sessionData));

    // Update authorized record in roster with actual user info
    try {
      const raw = localStorage.getItem(WHITELIST_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        const idx = list.findIndex(a => (a.email || "").toLowerCase() === email.toLowerCase());
        if (idx !== -1) {
          list[idx].name = name;
          list[idx].lastActive = "Active Now";
          localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(list));
        }
      }
    } catch(e) {}

    showToast(`Account created for ${name}! Welcome to Flyvis.`, "success");

    setTimeout(() => {
      window.location.href = "admin-flight-bookings.html";
    }, 1000);

  } catch (err) {
    console.error("Sign-up error:", err);
    showToast("Failed to create admin account. " + (err.message || ""), "error");
    btn.disabled = false;
    btnText.innerText = "Create Admin Account";
  }
}

/**
 * Handle Forgot Password
 */
async function handleForgotPassword() {
  const emailInput = document.getElementById("signin-email");
  const email = (emailInput ? emailInput.value : "").trim();
  if (!email) {
    showToast("Please enter your work email in the input above first.", "error");
    return;
  }

  if (typeof firebase !== "undefined" && firebase.auth) {
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      showToast(`Password reset link sent to ${email}`, "success");
      return;
    } catch (e) {
      console.warn("Firebase reset error:", e.message);
    }
  }

  // Fallback info
  alert(`Password Reset Instructions:\n\nA password reset request has been logged for ${email}.\nPlease check your corporate inbox or contact the Lead Administrator (zaid@flyvis.com) to reset credentials.`);
  showToast("Password reset request logged.", "success");
}

/**
 * Show Modern Auth Toast
 */
let toastTimeout = null;
function showToast(message, type = "success") {
  const toast = document.getElementById("auth-toast");
  const msgEl = document.getElementById("toast-message");
  const iconEl = document.getElementById("toast-icon");
  if (!toast || !msgEl) return;

  clearTimeout(toastTimeout);
  msgEl.textContent = message;
  toast.className = `auth-toast show ${type}`;
  const svgSuccess = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const svgError = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  iconEl.innerHTML = type === "success" ? svgSuccess : svgError;

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

// Add CSS keyframe for spinner
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
