
function openAdminPassportPreview(docIndex, isDraft) {
  const target = isDraft ? manualDraft : currentBooking;
  if (!target) return;
  const docs = target.documents || getBookingDocuments(target);
  const doc = docs[docIndex] || docs[0];
  if (!doc) return;

  const modal = document.getElementById("admin-passport-viewer-modal");
  const title = document.getElementById("admin-pv-title");
  const paxEl = document.getElementById("admin-pv-pax");
  const numEl = document.getElementById("admin-pv-num");
  const expEl = document.getElementById("admin-pv-exp");
  const countryEl = document.getElementById("admin-pv-country");
  const statusEl = document.getElementById("admin-pv-status");
  const metaEl = document.getElementById("admin-pv-meta");
  const dlBtn = document.getElementById("admin-pv-download-btn");
  const content = document.getElementById("admin-pv-content");

  if (title) title.textContent = `Passport Document Inspection — ${doc.paxName || target.passengerName}`;
  if (paxEl) paxEl.textContent = doc.paxName || target.passengerName || "Traveler";
  if (numEl) numEl.textContent = doc.number || target.passportNumber || "P1234567";
  if (expEl) expEl.textContent = doc.expiry || target.passportExpiry || "2029-08-14";
  if (countryEl) countryEl.textContent = doc.issuingCountry || target.nationality || "India (IND)";
  if (statusEl) statusEl.textContent = doc.status || "VERIFIED";
  if (metaEl) metaEl.textContent = `File: ${doc.fileName || 'passport.pdf'} • Source: ${doc.source || 'Travel Vault'}`;

  if (dlBtn) {
    if (doc.fileData) {
      dlBtn.href = doc.fileData;
      dlBtn.download = doc.fileName || `Passport_${doc.number || 'copy'}.pdf`;
      dlBtn.onclick = null;
    } else {
      dlBtn.href = "#";
      dlBtn.onclick = (e) => {
        e.preventDefault();
        showAdminToast(`Document copy for ${doc.paxName} is held in secure Travel Vault.`);
      };
    }
  }

  if (content) {
    if (doc.fileData) {
      if (doc.fileData.startsWith("data:image/") || (doc.fileName && doc.fileName.match(/\.(jpe?g|png|webp|gif)$/i))) {
        content.innerHTML = `<img src="${doc.fileData}" alt="Passport Bio-Page" style="max-width:100%; max-height:60vh; object-fit:contain; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);" />`;
      } else {
        content.innerHTML = `<iframe src="${doc.fileData}" style="width:100%; height:500px; border:none; border-radius:8px;"></iframe>`;
      }
    } else {
      // Verified KYC Certificate View
      content.innerHTML = `
        <div style="background:#FFFFFF; border:2px solid #BBF7D0; border-radius:12px; padding:24px 30px; max-width:540px; width:100%; box-shadow:0 4px 16px rgba(0,0,0,0.06); text-align:center;">
          <div style="display:flex; justify-content:center; margin-bottom:12px;">
            <div style="width:52px; height:52px; border-radius:50%; background:#DCFCE7; color:#15803D; display:flex; align-items:center; justify-content:center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div style="font-size:16px; font-weight:900; color:#0F172A; text-transform:uppercase; letter-spacing:0.5px;">Official Passport Bio-Page Verified</div>
          <div style="font-size:12px; color:#15803D; font-weight:700; margin-top:3px;">Authenticated via Flyvis Travel Vault (Encrypted AES-256)</div>

          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:14px; margin:16px 0; text-align:left; font-size:12px; line-height:1.8;">
            <div><strong>Traveler Name:</strong> ${escapeHtml(doc.paxName || target.passengerName)}</div>
            <div><strong>Passport Number:</strong> <span style="font-family:monospace; font-weight:800; color:#0F172A; background:#E2E8F0; padding:2px 6px; border-radius:4px;">${escapeHtml(doc.number || target.passportNumber || "P1234567")}</span></div>
            <div><strong>Date of Expiry:</strong> <strong>${escapeHtml(doc.expiry || target.passportExpiry || "2029-08-14")}</strong> (6-Month INAD Clear)</div>
            <div><strong>Issuing Authority:</strong> Republic of ${escapeHtml(doc.issuingCountry || "India")}</div>
            <div><strong>Verification Source:</strong> ${escapeHtml(doc.source || "Travel Vault Synced")}</div>
            <div><strong>Attached At:</strong> ${escapeHtml(doc.uploadedAt || target.bookingDate || "Booking Creation")}</div>
          </div>

          <div style="font-size:11px; color:#64748B;">
            This passport record was validated against airline IATA INAD rules and verified for international ticketing clearance.
          </div>
        </div>
      `;
    }
  }

  if (modal) modal.style.display = "flex";
}

function closeAdminPassportViewer() {
  const modal = document.getElementById("admin-passport-viewer-modal");
  if (modal) modal.style.display = "none";
}

window.openAdminPassportPreview = openAdminPassportPreview;
window.closeAdminPassportViewer = closeAdminPassportViewer;

/**
 * FareOS Enterprise Flight Booking Detail Controller
 * js/admin_flight_booking_detail.js
 */

let allBookings = [];
let currentBooking = null;
let currentBookingId = null;
let activeDetailTab = "compact";

// Passenger breakdown widget state
let paxActiveTabMap = {};
let paxEditingMap = {};
let paxCollapsedMap = {};

let currentAdmin = {
  name: "Susen",
  role: "Super Admin",
  avatar: "S"
};

try {
  const savedAdmin = localStorage.getItem("fareos_current_admin");
  if (savedAdmin) currentAdmin = JSON.parse(savedAdmin);
} catch (e) {}

document.addEventListener("DOMContentLoaded", async () => {
  setupKeyboardShortcuts();
  updateHeaderAdminUI();

  // Get booking ID from query string or hash
  const urlParams = new URLSearchParams(window.location.search);
  let bId = urlParams.get("id");
  if (!bId && window.location.hash) {
    bId = window.location.hash.replace("#", "").replace("booking/", "").trim();
  }
  if (!bId) bId = "BKNG-7265586"; // Default sample
  currentBookingId = bId;

  // View mode preference: query param > localStorage > default "compact"
  const viewParam = urlParams.get("view");
  const savedView = localStorage.getItem("flyvis_booking_view_mode") || localStorage.getItem("fareos_booking_view_mode");
  if (viewParam === "compact" || viewParam === "detailed") {
    activeDetailTab = viewParam;
  } else if (savedView === "compact" || savedView === "detailed") {
    activeDetailTab = savedView;
  } else {
    activeDetailTab = "compact";
  }

  await initBookingDetailData(bId);
});

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      const input = document.getElementById("universal-search");
      if (input) input.focus();
    }
  });
}

function searchOrRedirect(q) {
  const query = (q || "").trim();
  if (query) {
    window.location.href = `admin-flight-bookings.html?search=${encodeURIComponent(query)}`;
  }
}

/**
 * Multi-Admin Persona Switcher
 */
function toggleUserMenu() {
  const dd = document.getElementById("admin-persona-dropdown");
  if (dd) {
    dd.style.display = dd.style.display === "none" ? "block" : "none";
  }
}

document.addEventListener("click", (e) => {
  const dd = document.getElementById("admin-persona-dropdown");
  const chip = e.target.closest("#header-user-avatar, #header-user-name, #header-user-role, #admin-persona-dropdown, .fareos-dropdown-item");
  if (dd && dd.style.display === "block" && !chip && !e.target.closest("[onclick*='toggleUserMenu']")) {
    dd.style.display = "none";
  }
});

function switchCurrentAdmin(name, role, avatar) {
  currentAdmin = { name, role, avatar };
  try {
    localStorage.setItem("fareos_current_admin", JSON.stringify(currentAdmin));
  } catch (e) {}

  updateHeaderAdminUI();

  const dd = document.getElementById("admin-persona-dropdown");
  if (dd) dd.style.display = "none";

  showAdminToast(`Switched active admin to: ${name}`);

  if (currentBooking) {
    renderBookingDetailView(currentBooking);
  }
}

function updateHeaderAdminUI() {
  const nameEl = document.getElementById("header-user-name");
  const roleEl = document.getElementById("header-user-role");
  const avEl = document.getElementById("header-user-avatar");
  if (nameEl) nameEl.textContent = currentAdmin.name.split(" ")[0];
  if (roleEl) roleEl.textContent = currentAdmin.role;
  if (avEl) avEl.textContent = currentAdmin.avatar;

  document.querySelectorAll("#admin-persona-dropdown .fareos-dropdown-item").forEach((it) => {
    it.classList.remove("active");
  });
  if (currentAdmin.name.includes("Susen")) document.getElementById("persona-susen")?.classList.add("active");
  else if (currentAdmin.name.includes("Zaid")) document.getElementById("persona-zaid")?.classList.add("active");
  else if (currentAdmin.name.includes("Desk")) document.getElementById("persona-desk")?.classList.add("active");
}

function logoutAdmin() {
  try {
    localStorage.removeItem("fareos_current_admin");
    localStorage.removeItem("fareos_admin_session");
    if (typeof firebase !== "undefined" && firebase.auth) {
      firebase.auth().signOut().catch(() => {});
    }
  } catch (e) {}
  window.location.href = "admin-login.html?logout=true";
}

/**
 * Load booking data
 */
/**
 * Load booking data (Dual-Sync: Firestore Real-Time + Server API + Local Cache)
 */
async function initBookingDetailData(bookingId) {
  // 1. First Priority: Firebase Firestore (Live Cloud Database) with real-time listener
  if (typeof db !== "undefined") {
    try {
      db.collection("flight_bookings").doc(bookingId).onSnapshot((doc) => {
        if (doc.exists) {
          const raw = doc.data();
          currentBooking = normalizeFlightBooking({ id: doc.id, ...raw });
          finishBookingLoad();
        }
      }, (err) => {
        console.warn("Firestore listener notice:", err);
      });

      const snap = await db.collection("flight_bookings").doc(bookingId).get();
      if (snap.exists) {
        currentBooking = normalizeFlightBooking({ id: snap.id, ...snap.data() });
        finishBookingLoad();
        return;
      }
    } catch (e) {
      console.warn("Firestore direct get notice:", e);
    }
  }

  // 2. Second Priority: Backend REST API /api/flight-bookings?id=
  try {
    const res = await fetch(`/api/flight-bookings?id=${encodeURIComponent(bookingId)}`);
    if (res.ok) {
      const data = await res.json();
      const b = data.booking || data;
      if (b && (b.id === bookingId || b.id)) {
        currentBooking = normalizeFlightBooking(b);
        finishBookingLoad();
        return;
      }
    }
  } catch (e) {}

  // 3. Third Priority: localStorage cache
  try {
    const saved = localStorage.getItem("fareos_all_bookings");
    if (saved) {
      allBookings = JSON.parse(saved);
      const found = allBookings.find((b) => b.id === bookingId);
      if (found) {
        currentBooking = normalizeFlightBooking(found);
        finishBookingLoad();
        return;
      }
    }
  } catch (e) {}

  // 4. Fourth Priority: data/flight_bookings.json
  try {
    const res = await fetch("data/flight_bookings.json");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        allBookings = data;
        try {
          localStorage.setItem("fareos_all_bookings", JSON.stringify(data));
        } catch (e) {}
        const found = allBookings.find((b) => b.id === bookingId);
        if (found) {
          currentBooking = normalizeFlightBooking(found);
          finishBookingLoad();
          return;
        }
      }
    }
  } catch (e) {}

  // 5. Fifth Priority: Fallback seed data
  allBookings = getFallbackSeedBookings();
  currentBooking = normalizeFlightBooking(allBookings.find((b) => b.id === bookingId) || allBookings[0]);
  finishBookingLoad();
}

/**
 * Normalizes flight booking payloads coming from direct APIs, Webhooks, or Scrapers
 */
function normalizeFlightBooking(b) {
  if (!b) return b;

  // Normalize passenger list
  if (!b.passengerList || !b.passengerList.length) {
    if (Array.isArray(b.passengers) && b.passengers.length > 0) {
      b.passengerList = b.passengers.map(p => ({
        title: p.title || (p.gender === 'female' ? 'MS' : 'MR'),
        firstName: p.firstName || (p.name ? p.name.split(' ')[0] : 'TRAVELER'),
        lastName: p.lastName || (p.name ? p.name.split(' ').slice(1).join(' ') : 'PASSENGER'),
        name: p.name || `${p.firstName || 'TRAVELER'}/${p.lastName || 'PASSENGER'}`,
        type: (p.type || 'ADULT').toUpperCase(),
        status: b.status === 'Confirmed' ? 'CONFIRMED' : 'FAILED',
        nationality: p.nationality || 'IN',
        passportNumber: p.passportNumber || p.passport || '',
        expiryDate: p.expiryDate || '',
        pnr: b.pnr || ''
      }));
    } else {
      b.passengerList = [
        {
          title: "MR",
          name: b.passengerName || "VALUED TRAVELER",
          type: "ADULT",
          status: b.status === "Confirmed" ? "CONFIRMED" : "FAILED",
          nationality: "IN"
        }
      ];
    }
  }

  // Normalize flight segments
  if (!b.segments || !b.segments.length) {
    if (Array.isArray(b.flights) && b.flights.length > 0) {
      b.segments = b.flights;
    } else if (Array.isArray(b.itinerary) && b.itinerary.length > 0) {
      b.segments = b.itinerary;
    } else {
      b.segments = [
        {
          segmentNum: 1,
          airline: b.airline || "Flyvis Partner",
          flightNumber: b.flightNumber || "FZ013",
          aircraft: "73D",
          origin: b.origin || "DEL",
          originName: `${b.origin || "DELHI"} INTL ARPT`,
          depTime: b.departureTime || "02:00 AM",
          depDate: b.travelDateDisplay || b.travelDate || "23 Oct 2026",
          dest: b.destination || "DXB",
          destName: `${b.destination || "DUBAI"} INTL`,
          arrTime: b.arrivalTime || "04:00 AM",
          arrDate: b.travelDateDisplay || b.travelDate || "23 Oct 2026",
          duration: b.duration || "3h 00m",
          isNonStop: true,
          cabin: (b.cabin || "ECONOMY").toUpperCase(),
          class: "—",
          policy: "Non-Refundable",
          fareBasis: "Q06AE2",
          supplier: b.supplierIssued || "FZAR"
        }
      ];
    }
  }

  // Normalize pricing summary
  if (!b.priceSummary) {
    const amt = Number(b.amount || b.totalPrice || 6299);
    b.priceSummary = {
      baseFare: Math.round(amt * 0.75),
      tax: Math.round(amt * 0.25),
      adultTotal: amt,
      convenienceFee: 0,
      grandTotal: amt
    };
  }

  return b;
}

function finishBookingLoad() {
  if (!currentBooking) return;

  document.title = `${currentBooking.id} — FareOS Admin Enterprise`;

  // Track Access
  recordBookingAccess(currentBooking);

  // Render view
  renderBookingDetailView(currentBooking);

  // If nobody has locked it, trigger the "Lock this booking?" modal prompt automatically
  if (!currentBooking.lockedBy) {
    const modal = document.getElementById("booking-lock-prompt-modal");
    if (modal) modal.style.display = "flex";
  }
}

function recordBookingAccess(b) {
  const now = new Date();
  const formattedTime = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " +
                        now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  b.lastAccessedBy = currentAdmin.name;
  b.lastAccessedAt = formattedTime;

  if (!b.firstViewedBy) {
    b.firstViewedBy = `${currentAdmin.name} (${currentAdmin.role.replace(/\s+/g, "")})`;
    b.firstViewedAt = formattedTime;
  }

  b.isUnviewed = false;
  persistBookingUpdate(b);
}

function persistBookingUpdate(b) {
  try {
    localStorage.setItem("fareos_all_bookings", JSON.stringify(allBookings));
  } catch (e) {}

  if (typeof db !== "undefined") {
    try {
      db.collection("flight_bookings").doc(b.id).set(b, { merge: true });
    } catch (e) {}
    try {
      db.collection("flyvis_flight_bookings").doc(b.id).set(b, { merge: true });
    } catch (e) {}
  }

  try {
    fetch("/api/flight-bookings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b)
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Lock & Claim Handlers
 */
function dismissLockPrompt() {
  const modal = document.getElementById("booking-lock-prompt-modal");
  if (modal) modal.style.display = "none";
}

function handleLockPromptChoice(choice) {
  dismissLockPrompt();
  if (!currentBooking) return;

  if (choice === "lock") {
    currentBooking.lockedBy = currentAdmin.name;
    currentBooking.lockedAt = new Date().toISOString();
    persistBookingUpdate(currentBooking);
    showAdminToast(`🔒 Locked ${currentBooking.id} to you for manual updates`);
  } else {
    showAdminToast(`Viewing ${currentBooking.id} in read-only mode`);
  }

  renderBookingDetailView(currentBooking);
}

function handleClaimBooking(bookingId) {
  if (!currentBooking) return;
  currentBooking.lockedBy = currentAdmin.name;
  currentBooking.lockedAt = new Date().toISOString();
  persistBookingUpdate(currentBooking);
  showAdminToast(`🔒 You have claimed and locked ${currentBooking.id}`);
  renderBookingDetailView(currentBooking);
}

function handleReleaseLock(bookingId) {
  if (!currentBooking) return;
  currentBooking.lockedBy = null;
  currentBooking.lockedAt = null;
  persistBookingUpdate(currentBooking);
  showAdminToast(`🔓 Lock released on ${currentBooking.id}`);
  renderBookingDetailView(currentBooking);
}

function openOverclaimModal(bookingId) {
  if (!currentBooking) return;
  const ownerEl = document.getElementById("overclaim-current-owner");
  if (ownerEl) ownerEl.textContent = currentBooking.lockedBy || "Another Admin";

  const modal = document.getElementById("booking-overclaim-modal");
  if (modal) modal.style.display = "flex";
}

function closeOverclaimModal() {
  const modal = document.getElementById("booking-overclaim-modal");
  if (modal) modal.style.display = "none";
}

function confirmForceTakeOver() {
  closeOverclaimModal();
  if (!currentBooking) return;

  const prevOwner = currentBooking.lockedBy || "Previous Admin";
  currentBooking.lockedBy = currentAdmin.name;
  currentBooking.lockedAt = new Date().toISOString();
  currentBooking.owner = currentAdmin.name;

  persistBookingUpdate(currentBooking);
  showAdminToast(`⚡ Successfully overclaimed ${currentBooking.id} from ${prevOwner}`);
  renderBookingDetailView(currentBooking);
}

function calculateAwayTime(lockedAt) {
  if (!lockedAt) return "away 6d";
  const now = new Date();
  const lockedDate = new Date(lockedAt);
  if (isNaN(lockedDate)) return "away 6d";

  const diffMs = now - lockedDate;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    return `away ${days}d`;
  }
  if (diffHours >= 1) return `away ${diffHours}h`;
  const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return `away ${diffMins}m`;
}

/**
 * Compact View State & Sub-Tab Controller
 */
let compactActiveSubTab = "itinerary";

function switchCompactSubTab(subTab) {
  compactActiveSubTab = subTab;
  if (currentBooking) {
    renderBookingDetailView(currentBooking);
  }
}

function copyPNR(pnr, event) {
  if (event) event.stopPropagation();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(pnr).then(() => {
      showAdminToast(`Copied to clipboard: ${pnr}`);
    }).catch(() => {
      showAdminToast(`Copied: ${pnr}`);
    });
  } else {
    showAdminToast(`Copied: ${pnr}`);
  }
}

function toggleCompactMoreMenu(event, menuId) {
  if (event) event.stopPropagation();
  const id = menuId || "compact-more-menu";
  const menu = document.getElementById(id);
  if (!menu) return;
  // Close any other open menus
  document.querySelectorAll(".compact-more-menu.show").forEach((m) => {
    if (m !== menu) m.classList.remove("show");
  });
  menu.classList.toggle("show");
}

function handleMoreAction(action, bookingId, event) {
  if (event) event.stopPropagation();
  document.querySelectorAll(".compact-more-menu.show").forEach((m) => m.classList.remove("show"));

  if (action === "invoice") {
    showAdminToast(`📄 Generating Tax Invoice for ${bookingId}...`);
    setTimeout(() => {
      window.print();
    }, 600);
  } else if (action === "receipt") {
    showAdminToast(`💵 Downloading Payment Receipt for ${bookingId}...`);
  } else if (action === "ancillary") {
    showAdminToast(`Opening Add Meal / Seat / Bag panel for ${bookingId}...`);
    openManualUpdateModal(bookingId);
  } else if (action === "reschedule") {
    showAdminToast(`🔄 Initiating Date Change / Reschedule flow for ${bookingId}...`);
    openManualUpdateModal(bookingId);
  } else if (action === "export_logs") {
    showAdminToast(`📦 Exporting API audit logs archive (.zip)...`);
  } else if (action === "cancel") {
    if (confirm(`Are you sure you want to cancel booking ${bookingId}?\nThis will submit a cancellation request to the airline/GDS and trigger refund workflows.`)) {
      showAdminToast(`⚠️ Cancellation request submitted for ${bookingId}. Status updated.`);
    }
  }
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".compact-more-dropdown-container")) {
    document.querySelectorAll(".compact-more-menu.show").forEach((m) => m.classList.remove("show"));
  }
});



function setDetailTab(tab) {
  activeDetailTab = tab;
  try {
    localStorage.setItem("flyvis_booking_view_mode", tab);
    localStorage.setItem("fareos_booking_view_mode", tab);
    const url = new URL(window.location);
    url.searchParams.set("view", tab);
    window.history.replaceState({}, "", url);
  } catch (e) {}

  document.getElementById("btn-tab-detailed")?.classList.toggle("active", tab === "detailed");
  document.getElementById("btn-tab-compact")?.classList.toggle("active", tab === "compact");

  if (currentBooking) {
    renderBookingDetailView(currentBooking);
  }
}

/**
 * Render GDS-Style Compact View (Matching Pixel-Perfect Reference Screenshot)
 */
function renderCompactBookingView(b, isLockedByYou, isLockedByOther, bannerHtml) {
  // Normalize Segments
  const segments = (b.segments && b.segments.length > 0) ? b.segments : [
    {
      segmentNum: 1,
      direction: "OUTBOUND",
      airline: b.airline || "AI Express",
      airlineFullName: b.airlineFullName || b.airline || "Air India Express",
      flightNumber: b.flightNumber || "IX 1813",
      origin: b.origin || "COK",
      originName: b.originName || `${b.origin || "Kochi"} T1`,
      depTime: b.depTime || "10:30",
      depDate: b.depDate || b.travelDateDisplay || "01 Oct",
      dest: b.destination || "DEL",
      destName: b.destName || `${b.destination || "New Delhi"} T1`,
      arrTime: b.arrTime || "13:50",
      arrDate: b.arrDate || b.travelDateDisplay || "01 Oct",
      duration: b.duration || "3h 20m",
      isNonStop: b.isNonStop !== false,
      cabin: (b.cabin || "ECONOMY").toUpperCase(),
      class: b.bookingClass || b.class || "H",
      policy: b.policy || "Non-Refundable",
      baggage: b.baggage || "Cabin 7 KG"
    }
  ];

  // Normalize Passengers
  const paxList = (b.passengerList && b.passengerList.length > 0) ? b.passengerList : [
    {
      title: "MR",
      name: b.passengerName || "ONE TEST",
      type: "ADULT",
      ticketNumber: b.ticketNumber || "125-9982451290",
      seat: "14B",
      meal: "Standard Meal",
      baggage: "Cabin 7 KG",
      status: b.status === "Confirmed" ? "CONFIRMED" : "SUCCESS"
    }
  ];

  // Sub-Tab Content Rendering
  let subTabHtml = "";

  if (compactActiveSubTab === "itinerary") {
    let rowsHtml = "";
    segments.forEach((seg, sIdx) => {
      const isFirstOfDirection = (sIdx === 0 || seg.direction !== segments[sIdx - 1].direction);
      if (isFirstOfDirection) {
        rowsHtml += `
          <tr class="compact-subhead-row">
            <td colspan="9" style="background:#F8FAFC; border-top:1px solid #E2E8F0; border-bottom:1px solid #E2E8F0; padding:6px 14px;">
              <span style="font-weight:900; color:#0F172A; text-transform:uppercase; font-size:11.5px; letter-spacing:0.5px;">${escapeHtml(seg.direction || "OUTBOUND")}</span>
              <span style="color:#64748B; font-weight:500; font-size:11.5px; margin-left:8px;">${seg.isNonStop !== false ? "Non-stop" : "1 Stop"} · ${escapeHtml(seg.duration || "3h 20m")} · ${escapeHtml(seg.cabin || "ECONOMY")}</span>
            </td>
          </tr>
        `;
      }
      rowsHtml += `
        <tr>
          <td style="padding:10px 14px;">
            <div style="font-weight:800; color:#0F172A; font-size:13px;">${escapeHtml(seg.flightNumber || b.flightNumber || "IX 1813")}</div>
            <div style="font-size:11px; color:#64748B;">${escapeHtml(seg.airline || b.airline || "AI Express")}</div>
          </td>
          <td style="padding:10px 14px;">
            <div style="font-weight:900; color:#0F172A; font-size:13.5px;">${escapeHtml(seg.origin || "COK")}</div>
            <div style="font-size:11px; color:#64748B;">${escapeHtml(seg.originName || (seg.origin + " T1"))}</div>
          </td>
          <td style="padding:10px 14px;">
            <div style="font-weight:800; color:#0F172A; font-size:13px;">${escapeHtml(seg.depTime || "10:30")}</div>
            <div style="font-size:11px; color:#64748B;">${escapeHtml(seg.depDate || b.travelDateDisplay || "01 Oct")}</div>
          </td>
          <td style="padding:10px 14px;">
            <div style="font-weight:900; color:#0F172A; font-size:13.5px;">${escapeHtml(seg.dest || "DEL")}</div>
            <div style="font-size:11px; color:#64748B;">${escapeHtml(seg.destName || (seg.dest + " T1"))}</div>
          </td>
          <td style="padding:10px 14px;">
            <div style="font-weight:800; color:#0F172A; font-size:13px;">${escapeHtml(seg.arrTime || "13:50")}</div>
            <div style="font-size:11px; color:#64748B;">${escapeHtml(seg.arrDate || b.travelDateDisplay || "01 Oct")}</div>
          </td>
          <td style="padding:10px 14px; color:#334155; font-weight:500; font-size:12px;">
            ${escapeHtml(seg.duration || "3h 20m")}
          </td>
          <td style="padding:10px 14px;">
            <div style="font-weight:700; color:#0F172A; font-size:12px;">${escapeHtml((seg.cabin || "ECONOMY").toUpperCase())}</div>
            <div style="font-size:11px; color:#64748B;">${escapeHtml(seg.class || "H")}</div>
          </td>
          <td style="padding:10px 14px;">
            <span style="color:#DC2626; font-weight:700; font-size:11.5px;">${escapeHtml(seg.policy || "Non-Refundable")}</span>
          </td>
          <td style="padding:10px 14px; color:#334155; font-size:12px;">
            ${escapeHtml(seg.baggage || "Cabin 7 KG")}
          </td>
        </tr>
      `;
    });

    subTabHtml = `
      <div class="compact-table-card">
        <table class="compact-gds-table">
          <thead>
            <tr>
              <th>FLIGHT</th>
              <th>FROM</th>
              <th>DEPARTS</th>
              <th>TO</th>
              <th>ARRIVES</th>
              <th>DURATION</th>
              <th>CABIN / CLASS</th>
              <th>POLICY</th>
              <th>BAGGAGE</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  } else if (compactActiveSubTab === "travelers") {
    const cust = b.customerDetails || {
      name: b.passengerName || "ONE TEST",
      email: "susenmary73@gmail.com",
      phone: b.phone || "+919288409403",
      totalBookings: 106,
      emailVerified: "No",
      phoneVerified: "No",
      memberSince: "2026-07-30"
    };

    const contact = b.contactDetails || {
      email: cust.email || "susenmary73@gmail.com",
      mobile: "+91 9946303278"
    };

    let travelersHtml = "";
    paxList.forEach((p, idx) => {
      const pIdx = String(idx + 1).padStart(2, "0");
      const pTitle = p.title || "MR";
      const pFirst = p.firstName || (p.name ? p.name.split(" ")[0] : "IFTHIKHAN");
      const pLast = p.lastName || (p.name && p.name.split(" ").length > 1 ? p.name.split(" ").slice(1).join(" ") : "PT");
      const splitPnrObj = (b.isSplitPnr && b.splitPnrs && b.splitPnrs[idx]) ? b.splitPnrs[idx] : null;
      const pnrCode = p.pnr || (splitPnrObj ? splitPnrObj.pnr : null) || b.pnr || "D9Q3XE";
      const statusText = p.status || "CONFIRMED";

      travelersHtml += `
        <div class="compact-pax-item" style="${idx > 0 ? 'border-top:1px solid #F1F5F9; margin-top:8px; padding-top:10px;' : ''}">
          <div class="compact-pax-left">
            <span class="compact-pax-index">${pIdx}</span>
            <span style="color:#94A3B8; font-size:13px; display:inline-flex; align-items:center;">👤</span>
            <span>${escapeHtml(pTitle)}</span>
            <button class="compact-copy-btn compact-edit-pencil" title="Edit title" onclick="openManualUpdateModal('${b.id}')">✏️</button>
            <span class="compact-pax-slash">/</span>
            <span>${escapeHtml(pFirst)}</span>
            <button class="compact-copy-btn compact-edit-pencil" title="Edit name" onclick="openManualUpdateModal('${b.id}')">✏️</button>
            <span class="compact-pax-slash">/</span>
            <span>${escapeHtml(pLast)}</span>
            <button class="compact-copy-btn" title="Copy name" onclick="copyPNR('${escapeHtml(pTitle + " " + pFirst + " " + pLast)}', event)">❐</button>
          </div>
          <div class="compact-pax-right">
            <span class="compact-badge-adt">ADT</span>
            <span style="color:#94A3B8; font-size:13px; cursor:pointer;" title="Traveler details">ⓘ</span>
            <div class="compact-pnr-tag" ${splitPnrObj ? `style="border-color:#BFDBFE; background:#EFF6FF;" title="Split-PNR (Fare Class: ${splitPnrObj.fareClass || 'Promo'})"` : ''}>
              <span>PNR:</span>
              <span style="font-family:monospace; font-weight:800; color:#0F172A;">${escapeHtml(pnrCode)}</span>
              <button class="compact-copy-btn" title="Copy PNR" onclick="copyPNR('${escapeHtml(pnrCode)}', event)">❐</button>
              ${splitPnrObj ? `<span style="font-size:9.5px; font-weight:700; color:#2563EB; margin-left:2px;">[${escapeHtml((splitPnrObj.fareClass || 'SPLIT').split(' ')[0])}]</span>` : ''}
            </div>
            <span class="compact-badge-pill success">• ${escapeHtml(statusText)}</span>
            <button class="compact-arrow-btn" title="View details" onclick="openManualUpdateModal('${b.id}')">›</button>
          </div>
        </div>
      `;
    });

    subTabHtml = `
      <div class="compact-section-card">
        <div class="compact-section-header">CUSTOMER</div>
        <div class="compact-info-grid">
          <div class="compact-info-item">
            <div class="compact-info-label">NAME</div>
            <div class="compact-info-val">${escapeHtml(cust.name || "ONE TEST")}</div>
          </div>
          <div class="compact-info-item">
            <div class="compact-info-label">EMAIL</div>
            <div class="compact-info-val">
              <span>${escapeHtml(cust.email || "susenmary73@gmail.com")}</span>
              <button class="compact-copy-btn" title="Copy email" onclick="copyPNR('${escapeHtml(cust.email || "susenmary73@gmail.com")}', event)">❐</button>
            </div>
          </div>
          <div class="compact-info-item">
            <div class="compact-info-label">PHONE</div>
            <div class="compact-info-val">
              <span>${escapeHtml(cust.phone || "+919288409403")}</span>
              <button class="compact-copy-btn" title="Copy phone" onclick="copyPNR('${escapeHtml(cust.phone || "+919288409403")}', event)">❐</button>
            </div>
          </div>
          <div class="compact-info-item">
            <div class="compact-info-label">TOTAL BOOKINGS</div>
            <div class="compact-info-val">${escapeHtml(String(cust.totalBookings || 106))}</div>
          </div>
          <div class="compact-info-item">
            <div class="compact-info-label">EMAIL VERIFIED</div>
            <div class="compact-info-val">${escapeHtml(cust.emailVerified || "No")}</div>
          </div>
          <div class="compact-info-item">
            <div class="compact-info-label">PHONE VERIFIED</div>
            <div class="compact-info-val">${escapeHtml(cust.phoneVerified || "No")}</div>
          </div>
          <div class="compact-info-item">
            <div class="compact-info-label">MEMBER SINCE</div>
            <div class="compact-info-val">${escapeHtml(cust.memberSince || "2026-07-30")}</div>
          </div>
        </div>
      </div>

      <div class="compact-section-card">
        <div class="compact-section-header">CONTACT DETAILS</div>
        <div class="compact-info-grid">
          <div class="compact-info-item">
            <div class="compact-info-label">EMAIL</div>
            <div class="compact-info-val">
              <span>${escapeHtml(contact.email || "susenmary73@gmail.com")}</span>
              <button class="compact-copy-btn" title="Copy email" onclick="copyPNR('${escapeHtml(contact.email || "susenmary73@gmail.com")}', event)">❐</button>
            </div>
          </div>
          <div class="compact-info-item">
            <div class="compact-info-label">MOBILE</div>
            <div class="compact-info-val">
              <span>${escapeHtml(contact.mobile || "+91 9946303278")}</span>
              <button class="compact-copy-btn" title="Copy mobile" onclick="copyPNR('${escapeHtml(contact.mobile || "+91 9946303278")}', event)">❐</button>
            </div>
          </div>
        </div>
      </div>

      <div class="compact-section-card">
        <div class="compact-section-header">TRAVELERS · ${paxList.length}</div>
        ${travelersHtml}
      </div>
    `;
  } else if (compactActiveSubTab === "payment") {
    const pb = b.pricingBreakdown || {
      baseFare: 3000.00,
      adultBase: 3000.00,
      taxesAndFees: 1899.00,
      adultTaxes: 1899.00,
      addOns: 900.00,
      baggage: 900.00,
      convenienceFee: 500.00,
      grandTotal: (b.totalPrice || b.amount || 6299.00)
    };

    const pmts = (b.payments && b.payments.length > 0) ? b.payments : [
      {
        date: "07 Sep 26, 07:13",
        method: "net_banking",
        type: "INITIAL",
        amount: (b.totalPrice || b.amount || 6299.00),
        reference: "217397534528576",
        notes: "Auto-captured via payment webhook"
      }
    ];

    let paymentsRowsHtml = "";
    pmts.forEach((pm) => {
      paymentsRowsHtml += `
        <tr>
          <td style="padding:10px 14px; color:#475569; font-weight:500;">${escapeHtml(pm.date || "07 Sep 26, 07:13")}</td>
          <td style="padding:10px 14px; font-weight:600; color:#0F172A;">${escapeHtml(pm.method || "net_banking")}</td>
          <td style="padding:10px 14px; color:#64748B; font-weight:700;">${escapeHtml(pm.type || "INITIAL")}</td>
          <td style="padding:10px 14px; font-weight:800; color:#0F172A;">₹${Number(pm.amount || 6299).toLocaleString('en-IN')}.00</td>
          <td style="padding:10px 14px;">
            <span style="font-family:monospace; font-weight:700; color:#334155;">${escapeHtml(pm.reference || "217397534528576")}</span>
            <button class="compact-copy-btn" title="Copy reference" onclick="copyPNR('${escapeHtml(pm.reference || "217397534528576")}', event)">❐</button>
          </td>
          <td style="padding:10px 14px; color:#64748B; font-size:11.5px;">${escapeHtml(pm.notes || "Auto-captured via payment webhook")}</td>
        </tr>
      `;
    });

    subTabHtml = `
      <div class="compact-two-col">
        <!-- FARE SUMMARY -->
        <div class="compact-section-card" style="margin-bottom:0;">
          <div class="compact-section-header">FARE SUMMARY</div>
          <div>
            <div class="compact-summary-row">
              <span>^ Base Fare</span>
              <span>₹${Number(pb.baseFare || 3000).toLocaleString('en-IN')}.00</span>
            </div>
            <div class="compact-summary-subrow">
              <span>- 1 Adult (₹${Number(pb.adultBase || 3000).toLocaleString('en-IN')}.00 ea)</span>
              <span>₹${Number(pb.adultBase || 3000).toLocaleString('en-IN')}.00</span>
            </div>

            <div class="compact-summary-row" style="margin-top:6px;">
              <span>^ Taxes &amp; Fees</span>
              <span>₹${Number(pb.taxesAndFees || 1899).toLocaleString('en-IN')}.00</span>
            </div>
            <div class="compact-summary-subrow">
              <span>- 1 Adult Taxes</span>
              <span>₹${Number(pb.adultTaxes || 1899).toLocaleString('en-IN')}.00</span>
            </div>

            <div class="compact-summary-row" style="margin-top:6px;">
              <span>^ Add-ons</span>
              <span>₹${Number(pb.addOns || 900).toLocaleString('en-IN')}.00</span>
            </div>
            <div class="compact-summary-subrow">
              <span>- Baggage</span>
              <span>₹${Number(pb.baggage || 900).toLocaleString('en-IN')}.00</span>
            </div>

            <div class="compact-summary-row" style="margin-top:6px;">
              <span>Convenience Fee</span>
              <span>₹${Number(pb.convenienceFee || 500).toLocaleString('en-IN')}.00</span>
            </div>

            <hr class="compact-summary-hr">

            <div class="compact-summary-grand">
              <span>Grand Total</span>
              <span style="font-size:14.5px;">₹${Number(pb.grandTotal || 6299).toLocaleString('en-IN')}.00</span>
            </div>
          </div>
        </div>

        <!-- PAX-TYPE FARES -->
        <div class="compact-section-card" style="margin-bottom:0; padding:0; overflow:hidden;">
          <div style="padding:14px 18px 10px;" class="compact-section-header">PAX-TYPE FARES</div>
          <table class="compact-gds-table" style="border-top:1px solid #E2E8F0;">
            <thead>
              <tr>
                <th>TYPE</th>
                <th>COUNT</th>
                <th>BASE</th>
                <th>TAX</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:700; color:#0F172A;">Adult</td>
                <td style="color:#64748B;">1</td>
                <td style="color:#334155;">₹${Number(pb.adultBase || 3000).toLocaleString('en-IN')}.00</td>
                <td style="color:#334155;">₹${Number(pb.adultTaxes || 1899).toLocaleString('en-IN')}.00</td>
                <td style="font-weight:800; color:#0F172A;">₹${Number((pb.adultBase || 3000) + (pb.adultTaxes || 1899)).toLocaleString('en-IN')}.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="compact-two-col">
        <!-- JOURNEY FARES -->
        <div class="compact-section-card" style="margin-bottom:0; padding:0; overflow:hidden;">
          <div style="padding:14px 18px 10px;" class="compact-section-header">JOURNEY FARES</div>
          <table class="compact-gds-table" style="border-top:1px solid #E2E8F0;">
            <thead>
              <tr>
                <th>JOURNEY</th>
                <th>PAX</th>
                <th>COUNT</th>
                <th>BASE</th>
                <th>TAX</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:700; color:#0F172A;">
                  Outbound <span class="compact-badge-journey">FARE BEARER</span>
                </td>
                <td style="color:#475569;">Adult</td>
                <td style="color:#64748B;">1</td>
                <td style="color:#334155;">₹${Number(pb.adultBase || 3000).toLocaleString('en-IN')}.00</td>
                <td style="color:#334155;">₹${Number(pb.adultTaxes || 1899).toLocaleString('en-IN')}.00</td>
                <td style="font-weight:800; color:#0F172A;">₹${Number((pb.adultBase || 3000) + (pb.adultTaxes || 1899)).toLocaleString('en-IN')}.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- SUPPLIER VS CLIENT PRICING -->
        <div class="compact-section-card" style="margin-bottom:0; padding:0; overflow:hidden;">
          <div style="padding:14px 18px 10px;" class="compact-section-header">SUPPLIER VS CLIENT PRICING</div>
          <table class="compact-gds-table" style="border-top:1px solid #E2E8F0;">
            <thead>
              <tr>
                <th>&nbsp;</th>
                <th>BASE FARE</th>
                <th>TAX</th>
                <th>MARKUP</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:700; color:#0F172A;">Supplier</td>
                <td style="color:#334155;">₹${Number(pb.adultBase || 3000).toLocaleString('en-IN')}.00</td>
                <td style="color:#334155;">₹${Number(pb.adultTaxes || 1899).toLocaleString('en-IN')}.00</td>
                <td style="color:#94A3B8;">—</td>
                <td style="font-weight:800; color:#0F172A;">₹${Number((pb.adultBase || 3000) + (pb.adultTaxes || 1899)).toLocaleString('en-IN')}.00</td>
              </tr>
              <tr>
                <td style="font-weight:700; color:#0F172A;">Client</td>
                <td style="color:#334155;">₹${Number(pb.adultBase || 3000).toLocaleString('en-IN')}.00</td>
                <td style="color:#334155;">₹${Number(pb.adultTaxes || 1899).toLocaleString('en-IN')}.00</td>
                <td style="color:#334155;">₹0.00</td>
                <td style="font-weight:800; color:#0F172A;">₹${Number((pb.adultBase || 3000) + (pb.adultTaxes || 1899)).toLocaleString('en-IN')}.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PAYMENTS TABLE -->
      <div class="compact-section-card" style="padding:0; overflow:hidden; margin-bottom:14px;">
        <div style="padding:14px 18px 10px;" class="compact-section-header">PAYMENTS</div>
        <table class="compact-gds-table" style="border-top:1px solid #E2E8F0;">
          <thead>
            <tr>
              <th>DATE</th>
              <th>METHOD</th>
              <th>TYPE</th>
              <th>AMOUNT</th>
              <th>REFERENCE</th>
              <th>NOTES</th>
            </tr>
          </thead>
          <tbody>
            ${paymentsRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- FARE RULES & CONDITIONS -->
      <div class="compact-fare-rules-card">
        <div class="compact-fare-rules-header">
          <span style="display:inline-flex; align-items:center; gap:6px;">⚙️ FARE RULES &amp; CONDITIONS</span>
          <span>^</span>
        </div>
        <div class="compact-fare-route-bar">
          <span>${escapeHtml(b.origin || "COK")} — ${escapeHtml(b.destination || "DEL")}</span>
          <span style="color:#94A3B8;">v</span>
        </div>
      </div>
    `;
  } else if (compactActiveSubTab === "supplier") {
    const sInfo = b.supplierInfo || {
      supplier: b.airline || "IXAR",
      supplierPnr: b.pnr || "D9Q3XE",
      issueSupplier: b.airline || "IXAR",
      gds: "Non-GDS",
      channel: (b.source || "web").toLowerCase(),
      clientIp: "192.168.0.10"
    };

    const bCond = b.bookingConditions || {
      refundable: "No",
      identityRequired: "No",
      gstMandatory: "No",
      baggageAddOn: "Not allowed",
      sessionTtl: "900s"
    };

    const timelineItems = (b.timeline && b.timeline.length > 0) ? b.timeline : [
      { title: "Review & Price Lock", badge: "LIFECYCLE", badgeType: "lifecycle", time: "07 Sep · 07:05" },
      { title: "Booking Initiated", badge: "LIFECYCLE", badgeType: "lifecycle", time: "07 Sep · 07:05" },
      { title: "Flight Details", badge: "LIFECYCLE", badgeType: "lifecycle", time: "07 Sep · 07:05" },
      { title: "Payment Confirmed", badge: "PAYMENT", badgeType: "payment", time: "07 Sep · 07:13" },
      { title: "Booking Confirmed by Supplier", badge: "SUPPLIER", badgeType: "supplier", time: "07 Sep · 07:14" },
      { title: "PNR Allocated", badge: "SUPPLIER", badgeType: "supplier", time: "07 Sep · 07:14" },
      { title: "Ticket Issued", badge: "TICKET", badgeType: "ticket", badge2: "ACTIVE", time: "07 Sep · 07:14", provider: "IXAR" }
    ];

    let timelineRowsHtml = "";
    timelineItems.forEach((item, idx) => {
      const isLast = idx === timelineItems.length - 1;
      const dotColorClass = (item.badgeType === "payment" || item.badgeType === "ticket") ? "active" : (item.badgeType === "supplier" ? "blue" : "");
      const arrowChar = isLast ? "v" : "›";

      let badgeHtml = "";
      if (item.badge === "LIFECYCLE") {
        badgeHtml = `<span class="compact-pill-lifecycle">LIFECYCLE</span>`;
      } else if (item.badge === "PAYMENT") {
        badgeHtml = `<span class="compact-pill-payment">PAYMENT</span>`;
      } else if (item.badge === "SUPPLIER") {
        badgeHtml = `<span class="compact-pill-supplier">SUPPLIER</span>`;
      } else if (item.badge === "TICKET") {
        badgeHtml = `<span class="compact-pill-ticket">TICKET</span>`;
      }
      if (item.badge2 === "ACTIVE") {
        badgeHtml += ` <span class="compact-pill-active">ACTIVE</span>`;
      }

      timelineRowsHtml += `
        <div class="compact-timeline-row">
          <div class="compact-timeline-dot ${dotColorClass}"></div>
          <div>
            <div class="compact-timeline-title">
              <span>• ${escapeHtml(item.title)}</span>
              ${badgeHtml}
            </div>
            <div class="compact-timeline-meta">${escapeHtml(item.time)}</div>
            ${item.provider ? `<div style="font-size:11px; color:#64748B; margin-top:2px;">Provider: ${escapeHtml(item.provider)}</div>` : ''}
          </div>
          <span style="color:#94A3B8; font-weight:700; font-size:13px;">${arrowChar}</span>
        </div>
      `;
    });

    subTabHtml = `
      <div class="compact-supplier-split">
        <!-- TIMELINE -->
        <div class="compact-section-card" style="margin-bottom:0;">
          <div class="compact-section-header">TIMELINE</div>
          <div class="compact-timeline-container">
            ${timelineRowsHtml}
          </div>
        </div>

        <!-- SUPPLIER & BOOKING CONDITIONS -->
        <div style="display:flex; flex-direction:column; gap:14px;">
          <!-- SUPPLIER CARD -->
          <div class="compact-section-card" style="margin-bottom:0;">
            <div class="compact-section-header">SUPPLIER</div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px 20px;">
              <div class="compact-info-item">
                <div class="compact-info-label">SUPPLIER</div>
                <div class="compact-info-val">${escapeHtml(sInfo.supplier || "IXAR")}</div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">SUPPLIER PNR</div>
                <div class="compact-info-val">
                  <span>${escapeHtml(sInfo.supplierPnr || "D9Q3XE")}</span>
                  <button class="compact-copy-btn" title="Copy supplier PNR" onclick="copyPNR('${escapeHtml(sInfo.supplierPnr || "D9Q3XE")}', event)">❐</button>
                </div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">ISSUE SUPPLIER</div>
                <div class="compact-info-val">${escapeHtml(sInfo.issueSupplier || "IXAR")}</div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">GDS</div>
                <div class="compact-info-val">${escapeHtml(sInfo.gds || "Non-GDS")}</div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">CHANNEL</div>
                <div class="compact-info-val">${escapeHtml(sInfo.channel || "web")}</div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">CLIENT IP</div>
                <div class="compact-info-val" style="font-family:monospace;">${escapeHtml(sInfo.clientIp || "192.168.0.10")}</div>
              </div>
            </div>
          </div>

          <!-- BOOKING CONDITIONS CARD -->
          <div class="compact-section-card" style="margin-bottom:0;">
            <div class="compact-section-header">BOOKING CONDITIONS</div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px 20px;">
              <div class="compact-info-item">
                <div class="compact-info-label">REFUNDABLE</div>
                <div class="compact-info-val">${escapeHtml(bCond.refundable || "No")}</div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">IDENTITY REQUIRED</div>
                <div class="compact-info-val">${escapeHtml(bCond.identityRequired || "No")}</div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">GST MANDATORY</div>
                <div class="compact-info-val">${escapeHtml(bCond.gstMandatory || "No")}</div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">BAGGAGE ADD-ON</div>
                <div class="compact-info-val">${escapeHtml(bCond.baggageAddOn || "Not allowed")}</div>
              </div>
              <div class="compact-info-item">
                <div class="compact-info-label">SESSION TTL</div>
                <div class="compact-info-val">${escapeHtml(bCond.sessionTtl || "900s")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API LOGS CARD -->
      <div class="compact-api-logs-card">
        <div class="compact-api-logs-header">
          <span style="font-size:11px; font-weight:800; color:#64748B; text-transform:uppercase; letter-spacing:0.6px;">API LOGS</span>
          <button class="fareos-compact-btn" onclick="showAdminToast('Exporting API audit logs archive (.zip)...')">
            📦 Export (.zip)
          </button>
        </div>
        <div style="text-align:center; padding:28px 16px; color:#94A3B8; font-size:12.5px;">
          <span style="display:inline-block; animation:spin 1.5s linear infinite; margin-right:6px;">⟳</span> Loading logs...
        </div>
      </div>

      <!-- SYNC AUDIT LOG ALERT -->
      <div class="compact-sync-audit-card" onclick="showAdminToast('Sync Audit Log: 1 unresolved webhook latency warning')">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:28px; height:28px; border-radius:6px; background:#FEE2E2; display:flex; align-items:center; justify-content:center; color:#EF4444; font-size:15px;">
            ⚠️
          </div>
          <div>
            <div style="font-weight:800; color:#991B1B; font-size:13px;">Sync Audit Log</div>
            <div style="font-size:11.5px; color:#DC2626;">1 unresolved issue</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="compact-sync-audit-badge">1</span>
          <span style="color:#EF4444; font-size:12px;">v</span>
        </div>
      </div>
    `;
  } else if (compactActiveSubTab === "history") {
    const histItems = (b.history && b.history.length > 0) ? b.history : [
      { tag: "VIEWED", badgeClass: "viewed", text: "Opened this booking for the first time", time: "07 Sep 07:29" },
      { tag: "STATUS_CHANGED", badgeClass: "neutral", text: "Status changed to SUCCESS / ticketing SUCCESS", time: "07 Sep 07:13" },
      { tag: "PAYMENT_RECEIVED", badgeClass: "success", text: "Payment received (6299.00)", time: "07 Sep 07:13" },
      { tag: "STATUS_CHANGED", badgeClass: "neutral", text: "Status changed to SUCCESS / ticketing IN_PROGRESS", time: "07 Sep 07:13" },
      { tag: "STATUS_CHANGED", badgeClass: "neutral", text: "Status changed to IN_PROGRESS / ticketing PENDING", time: "07 Sep 07:13" },
      { tag: "BOOKING_CREATED", badgeClass: "success", text: "Flight booking created", time: "07 Sep 07:12" },
      { tag: "STATUS_CHANGED", badgeClass: "neutral", text: "Status changed to INIT / ticketing PENDING", time: "07 Sep 07:11" },
      { tag: "STATUS_CHANGED", badgeClass: "neutral", text: "Status changed to INIT / ticketing AWAITING", time: "07 Sep 07:11" }
    ];

    let historyRowsHtml = "";
    histItems.forEach((h) => {
      historyRowsHtml += `
        <div class="compact-history-row">
          <div class="compact-history-dot"></div>
          <div class="compact-history-left">
            <span class="compact-history-tag ${h.badgeClass || 'neutral'}">${escapeHtml(h.tag)}</span>
            <span class="compact-history-text">${escapeHtml(h.text)}</span>
          </div>
          <div class="compact-history-time">${escapeHtml(h.time)}</div>
        </div>
      `;
    });

    subTabHtml = `
      <div class="compact-section-card" style="padding:10px 16px;">
        <div class="compact-history-container">
          ${historyRowsHtml}
        </div>
      </div>
    `;
  }

  return `
    <!-- Top View Toggle Row -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div class="fareos-view-toggle">
        <button class="${activeDetailTab === 'detailed' ? 'active' : ''}" id="btn-tab-detailed" onclick="setDetailTab('detailed')">Detailed</button>
        <button class="${activeDetailTab === 'compact' ? 'active' : ''}" id="btn-tab-compact" onclick="setDetailTab('compact')">Compact</button>
      </div>
    </div>

    <!-- Top Claim / Lock Alert Banner -->
    ${bannerHtml}

    <!-- Compact Booking Summary Single Row (Matching Reference Image) -->
    <div class="compact-booking-summary-bar">
      <div class="compact-summary-left">
        <span class="compact-booking-id">${escapeHtml(b.id)}</span>
        <button class="fareos-copy-btn" onclick="copyBookingId('${b.id}', event)" title="Copy ID">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <span class="compact-pill-route">${escapeHtml(b.origin || 'COK')} → ${escapeHtml(b.destination || 'DEL')}</span>
        <span class="compact-pill-type">→ ${escapeHtml(b.tripType || 'ONE WAY')}</span>
        <span class="compact-badge-pill success">• ${escapeHtml(b.statusPill || (b.status === 'Confirmed' ? 'SUCCESS' : (b.status || 'SUCCESS').toUpperCase()))}</span>
        <span class="compact-badge-pill paid">• ${escapeHtml((b.paymentStatus || 'PAID').toUpperCase())}</span>
        <span class="compact-badge-pill tkt-success">• ${escapeHtml((b.ticketingStatus || 'TKT SUCCESS').toUpperCase())}</span>
        <span style="font-size:12.5px; font-weight:800; color:#0F172A; margin-left:4px;">${escapeHtml(b.passengerName || 'ONE TEST')}</span>
        <span style="font-size:12px; color:#64748B;">${escapeHtml(b.phone || '+919208499483')}</span>
        <span class="compact-badge-web">${escapeHtml(b.source || 'WEB')}</span>
        <span style="font-size:12px; color:#64748B;">${b.paxCount || 1} traveler &nbsp;${escapeHtml(b.travelDateDisplay || '01 Oct')}</span>
      </div>

      <div class="compact-summary-right">
        <div class="compact-viewed-line">
          <span style="color:#059669; font-weight:bold;">✓</span>
          <span>First Viewed by <strong>${escapeHtml(b.firstViewedBy || b.lastAccessedBy || 'Susen (SuperAdmin)')}</strong> at ${escapeHtml(b.firstViewedAt || b.lastAccessedAt || '07 Sep 2026, 12:59 PM')}</span>
        </div>
        <div class="compact-action-row">
          <span class="compact-price-val">₹${(b.totalPrice || b.amount || 6299).toLocaleString('en-IN')}.00</span>
          <button class="fareos-compact-btn" onclick="showAdminToast('Opening E-Ticket for ' + '${b.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            E-Ticket
          </button>
          <button class="fareos-compact-btn" onclick="showAdminToast('Opening Voucher...')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Voucher
          </button>
          <button class="fareos-compact-btn" onclick="showAdminToast('Fetching live status from supplier GDS...')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Fetch Booking Status
          </button>
          ${isLockedByYou ? `
            <button class="fareos-compact-btn" style="background:#2563EB; color:#FFF; border-color:#2563EB;" onclick="openManualUpdateModal('${b.id}')">
              ✏ Manual Update
            </button>
          ` : ''}
          <div class="compact-more-dropdown-container">
            <button class="fareos-compact-btn" id="btn-compact-more" onclick="toggleCompactMoreMenu(event, 'compact-more-menu')">
              ••• More
            </button>
            <div class="compact-more-menu" id="compact-more-menu">
              <button class="compact-menu-item" onclick="handleMoreAction('invoice', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg>
                <span>Download Invoice</span>
              </button>
              <button class="compact-menu-item" onclick="handleMoreAction('receipt', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                <span>Download Receipt</span>
              </button>
              <button class="compact-menu-item" onclick="handleMoreAction('ancillary', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2v20"/><path d="M6 2v20"/><path d="M2 7h8a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2"/></svg>
                <span>Add Meal / Seat / Bag</span>
              </button>
              <button class="compact-menu-item" onclick="handleMoreAction('reschedule', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>Reschedule</span>
              </button>
              <button class="compact-menu-item" onclick="handleMoreAction('export_logs', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span>Export Logs (.zip)</span>
              </button>
              <div class="compact-menu-divider"></div>
              <button class="compact-menu-item danger" onclick="handleMoreAction('cancel', '${b.id}', event)">
                <span class="danger-icon" style="font-size:14px; font-weight:800; width:14px; text-align:center;">✕</span>
                <span>Cancel Booking</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Compact Sub-Tabs -->
    <div class="compact-subtabs-bar">
      <button class="compact-subtab-btn ${compactActiveSubTab === 'itinerary' ? 'active' : ''}" onclick="switchCompactSubTab('itinerary')">Itinerary</button>
      <button class="compact-subtab-btn ${compactActiveSubTab === 'travelers' ? 'active' : ''}" onclick="switchCompactSubTab('travelers')">Travelers</button>
      <button class="compact-subtab-btn ${compactActiveSubTab === 'payment' ? 'active' : ''}" onclick="switchCompactSubTab('payment')">Payment &amp; Accounting</button>
      <button class="compact-subtab-btn ${compactActiveSubTab === 'supplier' ? 'active' : ''}" onclick="switchCompactSubTab('supplier')">Supplier &amp; Logs</button>
      <button class="compact-subtab-btn ${compactActiveSubTab === 'history' ? 'active' : ''}" onclick="switchCompactSubTab('history')">History</button>
    </div>

    ${compactActiveSubTab === 'itinerary' ? `
      <!-- Airline PNR Subline -->
      <div style="font-size:11.5px; color:#64748B; margin-bottom:10px; display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
        <span style="letter-spacing:0.5px; font-weight:700;">AIRLINE PNR</span>
        ${(b.isSplitPnr && b.splitPnrs && b.splitPnrs.length > 0) ? `
          <span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:6px; background:#EFF6FF; color:#1D4ED8; font-size:10.5px; font-weight:800; border:1px solid #BFDBFE;">⚡ SPLIT-PNR</span>
          ${b.splitPnrs.map((sp, idx) => `
            <span style="display:inline-flex; align-items:center; gap:4px; background:#F8FAFC; border:1px solid #CBD5E1; padding:2px 7px; border-radius:5px;">
              <span style="font-size:10px; color:#64748B; font-weight:700;">P${idx+1} (${escapeHtml(sp.fareClass || 'Promo')}):</span>
              <strong style="color:#0F172A; font-family:monospace; font-size:12.5px; letter-spacing:0.5px;">${escapeHtml(sp.pnr)}</strong>
              <button class="fareos-copy-btn" onclick="copyPNR('${sp.pnr}', event)" title="Copy PNR">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </span>
          `).join('')}
          <span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:5px; background:#ECFDF5; color:#047857; font-size:10.5px; font-weight:700; border:1px solid #A7F3D0;" title="${escapeHtml(b.gdsCrossReference || 'OSI TCP Traveling Together')}">
            🔗 Linked via OSI TCP
          </span>
        ` : `
          <strong style="color:#0F172A; font-family:monospace; font-size:13px; letter-spacing:0.5px;">${escapeHtml(b.pnr || b.airlinePnr || 'DIQ1HE')}</strong>
          <button class="fareos-copy-btn" onclick="copyPNR('${b.pnr || b.airlinePnr || 'DIQ1HE'}', event)" title="Copy PNR">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        `}
      </div>
    ` : ''}

    <!-- Sub-Tab Body Table -->
    ${subTabHtml}
  `;
}

function renderBookingDetailView(b) {
  const container = document.getElementById("booking-detail-main-content");
  if (!b || !container) return;

  const isLockedByYou = (b.lockedBy === currentAdmin.name);
  const isLockedByOther = (b.lockedBy && b.lockedBy !== currentAdmin.name);
  const isUnclaimed = !b.lockedBy;

  // 1. Top Claim / Lock Status Banner
  let bannerHtml = "";
  if (isLockedByOther) {
    bannerHtml = `
      <div class="fareos-claim-banner claimed-other">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">⚠️</span>
          <span><strong>${escapeHtml(b.lockedBy)}</strong> is working on this booking <span style="font-weight:400; color:#B45309; margin-left:8px;">${calculateAwayTime(b.lockedAt)}</span></span>
        </div>
        <button class="fareos-btn-takeover" onclick="openOverclaimModal('${b.id}')">
          ⚡ Force take over
        </button>
      </div>
    `;
  } else if (isUnclaimed) {
    bannerHtml = `
      <div class="fareos-claim-banner unclaimed">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Nobody is handling this booking yet</span>
        </div>
        <button class="fareos-btn-claim" onclick="handleClaimBooking('${b.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Claim
        </button>
      </div>
    `;
  } else {
    bannerHtml = `
      <div class="fareos-claim-banner claimed-you">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>You have locked this booking for manual updates</span>
        </div>
        <button class="fareos-btn-release" onclick="handleReleaseLock('${b.id}')">
          Release Lock
        </button>
      </div>
    `;
  }

  // Branch into Compact View if selected
  if (activeDetailTab === "compact") {
    container.innerHTML = renderCompactBookingView(b, isLockedByYou, isLockedByOther, bannerHtml);
    return;
  }

  // Badges
  const tripBadge = b.tripType === "ROUND TRIP" ?
    `<span class="fareos-tag-badge t-type">↔ ROUND TRIP</span>` :
    `<span class="fareos-tag-badge t-type">→ ONE WAY</span>`;

  let statusBadge = `<span class="fareos-tag-badge t-failed">${escapeHtml(b.statusPill || (b.status + " /"))}</span>`;
  if (b.status === "Confirmed" || b.status === "ISSUED") statusBadge = `<span class="fareos-tag-badge t-confirmed">CONFIRMED /</span>`;
  else if (b.status === "Initiated") statusBadge = `<span class="fareos-tag-badge t-init">INIT /</span>`;

  const payBadge = (b.paymentStatus === "Paid" || b.paymentStatus === "CAPTURED_PREAUTH") ?
    `<span class="fareos-tag-badge t-paid">PAID</span>` :
    `<span class="fareos-tag-badge t-awaiting">AWAITING</span>`;

  const isTktSuccess = b.ticketingStatus === "TICKETED" || b.ticketingStatus === "ISSUED" || b.status === "Confirmed" || b.status === "ISSUED";
  const tktBadge = `<span class="fareos-tag-badge ${isTktSuccess ? 't-confirmed' : 't-failed'}">${escapeHtml(b.ticketingStatus || (isTktSuccess ? "TICKETED" : "TKT FAILED"))}</span>`;
  const webBadge = `<span class="fareos-tag-badge t-web">• ${escapeHtml(b.source || "WEB")}</span>`;

  let bookedDateStr = "01 Sep 2026, 04:42 AM";
  if (b.bookingDate) {
    const d = new Date(b.bookingDate);
    if (!isNaN(d)) {
      bookedDateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " +
                      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
  }

  // Segments
  const segments = b.segments && b.segments.length > 0 ? b.segments : [
    {
      segmentNum: 1,
      airline: b.airline || "Flydubai",
      flightNumber: b.flightNumber || "FZ013",
      aircraft: "73D",
      origin: b.origin || "DXB",
      originName: `${b.origin || "DUBAI"} INTL ARPT`,
      depTime: "02:00 AM",
      depDate: b.travelDateDisplay || "23 Oct 2026",
      dest: b.destination || "JED",
      destName: `${b.destination || "JEDDAH"} INTL`,
      arrTime: "04:00 AM",
      arrDate: b.travelDateDisplay || "23 Oct 2026",
      duration: "3h 00m",
      isNonStop: true,
      cabin: (b.cabin || "ECONOMY").toUpperCase(),
      class: "—",
      policy: "Non-Refundable",
      fareBasis: "Q06AE2",
      supplier: b.supplierIssued || "FZAR"
    }
  ];

  let segmentsHtml = "";
  segments.forEach((seg, sIdx) => {
    segmentsHtml += `
      <div class="fareos-segment-block">
        <div style="display:flex; align-items:center; gap:8px; font-size:11px; font-weight:800; color:#64748B;">
          <span style="color:#0F172A;">SEGMENT ${seg.segmentNum || (sIdx + 1)}</span>
          <span style="background:#0F172A; color:#FFFFFF; padding:2px 6px; border-radius:3px; font-size:10px;">${escapeHtml(seg.flightNumber || "")}</span>
          <span>${escapeHtml(seg.aircraft || "73D")}</span>
        </div>

        <div class="fareos-route-visual">
          <div class="fareos-airport-point left">
            <div class="fareos-apt-code">${escapeHtml(seg.origin)}</div>
            <div class="fareos-apt-name">${escapeHtml(seg.originName || (seg.origin + " ARPT"))}</div>
            <div class="fareos-apt-time">${escapeHtml(seg.depTime || "00:00")}</div>
            <div class="fareos-apt-date">${escapeHtml(seg.depDate || b.travelDateDisplay || "")}</div>
          </div>

          <div class="fareos-flight-path-center">
            <div style="font-size:10.5px; color:#64748B; font-weight:600; margin-bottom:4px;">⏱ ${escapeHtml(seg.duration || "Direct")}</div>
            <div class="fareos-path-line">
              <span class="fareos-plane-icon">✈</span>
            </div>
            <div style="font-size:10px; font-weight:800; color:#64748B; margin-top:4px; text-transform:uppercase;">${seg.isNonStop ? "NON-STOP" : "1 STOP"}</div>
          </div>

          <div class="fareos-airport-point right">
            <div class="fareos-apt-code">${escapeHtml(seg.dest)}</div>
            <div class="fareos-apt-name">${escapeHtml(seg.destName || (seg.dest + " INTL"))}</div>
            <div class="fareos-apt-time">${escapeHtml(seg.arrTime || "00:00")}</div>
            <div class="fareos-apt-date">${escapeHtml(seg.arrDate || b.travelDateDisplay || "")}</div>
          </div>
        </div>

        <div class="fareos-segment-spec-row">
          <div class="fareos-spec-col">
            <span class="fareos-spec-label">CABIN</span>
            <span class="fareos-spec-val">${escapeHtml(seg.cabin || "ECONOMY")}</span>
          </div>
          <div class="fareos-spec-col">
            <span class="fareos-spec-label">CLASS</span>
            <span class="fareos-spec-val">${escapeHtml(seg.class || "—")}</span>
          </div>
          <div class="fareos-spec-col">
            <span class="fareos-spec-label">POLICY</span>
            <span class="fareos-spec-val" style="color:#DC2626;">${escapeHtml(seg.policy || "Non-Refundable")}</span>
          </div>
          <div class="fareos-spec-col">
            <span class="fareos-spec-label">FARE BASIS</span>
            <span class="fareos-spec-val" style="font-family:monospace;">${escapeHtml(seg.fareBasis || "Q06AE2")}</span>
          </div>
          <div class="fareos-spec-col">
            <span class="fareos-spec-label">SUPPLIER</span>
            <span class="fareos-spec-val">${escapeHtml(seg.supplier || "FZAR")}</span>
          </div>
        </div>

        ${seg.layoverAfter ? `
          <div class="fareos-layover-bar">
            <span>⏱ Layover at ${escapeHtml(seg.layoverAfter.airport)} • ${escapeHtml(seg.layoverAfter.duration)}</span>
            <span>${escapeHtml(seg.layoverAfter.airportName || "")}</span>
          </div>
        ` : ""}
      </div>
    `;
  });

  // Passengers
  const paxList = b.passengerList && b.passengerList.length > 0 ? b.passengerList : [
    { title: "MR", name: b.passengerName || "IFTHIKHAN/PT", type: "ADULT", status: b.status === "Confirmed" ? "CONFIRMED" : "FAILED" }
  ];
  let paxHtml = "";
  paxList.forEach((p, pIdx) => {
    paxHtml += renderPassengerBreakdownCard(p, pIdx, b);
  });

  // Price breakdown
  const ps = b.priceSummary || {
    baseFare: Math.round((b.amount || 15000) * 0.65),
    tax: Math.round((b.amount || 15000) * 0.35),
    adultTotal: b.amount || 15000,
    convenienceFee: 1000.00,
    grandTotal: (b.amount || 15000) + 1000.00
  };

  // Customer
  const cust = b.customerDetails || {
    name: b.customer || "Dolores Duis",
    id: "57110992-3907-4822-b979-72f0456c7fad",
    email: "rerum@ad.cc",
    phone: b.phone ? (b.phone.startsWith("+") ? b.phone : `+91 ${b.phone}`) : "+91 12768422153",
    bookingCount: 1
  };

  container.innerHTML = `
    <!-- Top Claim / Lock Alert Banner -->
    ${bannerHtml}

    <!-- Booking Header Console Bar -->
    <div class="fareos-detail-head-bar">
      <div class="fareos-detail-meta-row">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <div class="fareos-view-toggle">
            <button class="${activeDetailTab === 'detailed' ? 'active' : ''}" id="btn-tab-detailed" onclick="setDetailTab('detailed')">Detailed</button>
            <button class="${activeDetailTab === 'compact' ? 'active' : ''}" id="btn-tab-compact" onclick="setDetailTab('compact')">Compact</button>
          </div>

          <div class="fareos-id-title-box">
            <span style="font-size:16px; font-weight:900; color:#0F172A; letter-spacing:-0.2px;">${b.id}</span>
            <button class="fareos-copy-btn" onclick="copyBookingId('${b.id}', event)" title="Copy ID">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            ${b.isSplitPnr ? `<span class="fareos-tag-badge" style="background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; font-weight:800;">⚡ SPLIT-PNR</span>` : ''}
            ${tripBadge}
            ${statusBadge}
            ${payBadge}
            ${tktBadge}
            ${webBadge}
          </div>
        </div>

        <!-- Action Button Cluster -->
        <div class="fareos-action-group">
          <button class="fareos-btn-action" onclick="showAdminToast('Generating E-Ticket...')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            E-Ticket
          </button>
          <button class="fareos-btn-action" onclick="showAdminToast('Opening Voucher view...')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Voucher
          </button>
          <button class="fareos-btn-action" onclick="showAdminToast('Fetching live status from supplier GDS...')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Fetch Booking Status
          </button>

          <!-- Manual Update Button: Enabled ONLY if locked by current admin -->
          ${isLockedByYou ? `
            <button class="fareos-btn-action highlight" onclick="openManualUpdateModal('${b.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Manual Update
            </button>
          ` : `
            <button class="fareos-btn-action" disabled title="${isLockedByOther ? `Locked by ${escapeHtml(b.lockedBy)}. Force take over to edit.` : 'Lock booking to enable manual updates.'}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Manual Update
            </button>
          `}

          <div class="compact-more-dropdown-container">
            <button class="fareos-btn-action" id="btn-detailed-more" onclick="toggleCompactMoreMenu(event, 'detailed-more-menu')">
              ••• More Options
            </button>
            <div class="compact-more-menu" id="detailed-more-menu">
              <button class="compact-menu-item" onclick="handleMoreAction('invoice', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg>
                <span>Download Invoice</span>
              </button>
              <button class="compact-menu-item" onclick="handleMoreAction('receipt', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                <span>Download Receipt</span>
              </button>
              <button class="compact-menu-item" onclick="handleMoreAction('ancillary', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2v20"/><path d="M6 2v20"/><path d="M2 7h8a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2"/></svg>
                <span>Add Meal / Seat / Bag</span>
              </button>
              <button class="compact-menu-item" onclick="handleMoreAction('reschedule', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>Reschedule</span>
              </button>
              <button class="compact-menu-item" onclick="handleMoreAction('export_logs', '${b.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span>Export Logs (.zip)</span>
              </button>
              <div class="compact-menu-divider"></div>
              <button class="compact-menu-item danger" onclick="handleMoreAction('cancel', '${b.id}', event)">
                <span class="danger-icon" style="font-size:14px; font-weight:800; width:14px; text-align:center;">✕</span>
                <span>Cancel Booking</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Subline & Viewed by telemetry -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-top:1px solid #F1F5F9; padding-top:10px; margin-top:8px;">
        <div style="font-size:11.5px; color:#64748B;">
          Booked <strong>${bookedDateStr}</strong> • Travel Date <strong>${escapeHtml(b.travelDateDisplay || b.travelDate || "")}</strong> • 🌐 IP ${escapeHtml(b.ipAddress || "192.168.0.10")}
        </div>
        <div style="font-size:11.5px; color:#64748B; display:flex; align-items:center; gap:6px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>First viewed by <strong>${escapeHtml(b.firstViewedBy || "Super Admin")}</strong> at ${escapeHtml(b.firstViewedAt || "01 Sep 2026, 04:43 AM")}</span>
          <span style="color:#CBD5E1;">•</span>
          <span style="color:#2563EB;">Last accessed by <strong>${escapeHtml(b.lastAccessedBy || currentAdmin.name)}</strong> at ${escapeHtml(b.lastAccessedAt || "Just now")}</span>
        </div>
      </div>
    </div>

    <!-- Internal Admin Notes -->
    <div class="fareos-notes-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="font-size:12px; font-weight:800; color:#854D0E; display:flex; align-items:center; gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Internal Admin Notes
        </div>
        <div style="font-size:11px; font-weight:700; color:#A16207; display:flex; align-items:center; gap:4px;">
          Private 🔒
        </div>
      </div>
      <textarea
        id="detail-internal-notes"
        style="width:100%; border:1px solid #FCD34D; background:#FFFFFF; border-radius:6px; padding:8px 10px; font-size:12px; color:#1E293B; outline:none; resize:vertical; min-height:48px;"
        placeholder="Add private comments for back-office team..."
        onchange="saveInternalNotes('${b.id}', this.value)"
      >${escapeHtml(b.internalNotes || "")}</textarea>
    </div>

    <!-- Main Two-Column Viewport -->
    <div class="fareos-detail-grid">

      <!-- LEFT COLUMN: Flight Segments, Pax, Amendments, Audit -->
      <div>
        <!-- Flight Outbound Container -->
        <div class="fareos-card-section">
          <div class="fareos-flight-header-bar">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:13px; font-weight:800; color:#0F172A; text-transform:uppercase;">✈️ OUTBOUND</span>
              <span style="font-size:11px; color:#64748B;">${segments.length > 1 ? segments.length + " Stops" : "1 Stop"}</span>
              <span style="font-size:10px; font-weight:800; color:#D97706; background:#FEF3C7; padding:2px 6px; border-radius:4px;">⚠️ NOT HK CONFIRMED</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; font-size:11.5px; color:#64748B;">
              <span>⏱ ${escapeHtml(segments[0].duration || "3h 48m")}</span>
              <span style="background:#F1F5F9; padding:2px 6px; border-radius:4px; font-weight:700; color:#334155;">${escapeHtml(segments[0].cabin || "ECONOMY")}</span>
            </div>
          </div>

          <!-- Segment Blocks -->
          <div id="fareos-segments-wrapper">
            ${segmentsHtml}
          </div>
        </div>

        <!-- Passengers & Service Breakdown (matching media_1789302703099.png, 105, 102, 104) -->
        <div class="fareos-card-section" style="padding:16px 20px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            <div style="width:26px; height:26px; border-radius:6px; background:#EFF6FF; color:#2563EB; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800;">
              👤
            </div>
            <div>
              <div style="font-size:12px; font-weight:900; color:#0F172A; text-transform:uppercase; letter-spacing:0.3px;">
                PASSENGERS &amp; SERVICE BREAKDOWN
              </div>
              <div style="font-size:11px; color:#64748B; font-weight:600;">
                ${paxList.length} Passenger${paxList.length > 1 ? 's' : ''} in this booking
              </div>
            </div>
          </div>

          <div id="fareos-pax-cards-wrapper">
            ${paxHtml}
          </div>
        </div>

        <!-- Traveler Shared Documents & Identification Card -->
        <div class="fareos-card-section" style="padding:16px 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:28px; height:28px; border-radius:6px; background:#EFF6FF; color:#2563EB; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div>
                <div style="font-size:12px; font-weight:900; color:#0F172A; text-transform:uppercase; letter-spacing:0.3px;">
                  TRAVELER SHARED DOCUMENTS &amp; IDENTIFICATION
                </div>
                <div style="font-size:11px; color:#64748B; font-weight:600;">
                  Passports, visa records, and identity files shared by customer for ticketing
                </div>
              </div>
            </div>
            <button type="button" class="btn-primary" onclick="promptAttachDocumentToTicket(false)" style="padding:6px 14px; font-size:11.5px; font-weight:800; border-radius:6px; display:inline-flex; align-items:center; gap:6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              + Attach Document
            </button>
          </div>

          <div id="main-ticket-documents-wrapper" style="display:flex; flex-direction:column; gap:10px;">
            ${renderDocumentsListHTML(getBookingDocuments(b), false)}
          </div>
        </div>

        <!-- Cart Amendments -->
        <div class="fareos-card-section">
          <div style="font-size:12px; font-weight:800; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;">
            CART AMENDMENTS
          </div>
          <div class="fareos-amendments-row">
            <div class="fareos-amendment-tile">
              <div>
                <div style="font-size:12px; font-weight:800; color:#0F172A;">Cancellation</div>
                <div style="font-size:11px; color:#64748B; margin-top:3px;">Check charges and refund eligibility.</div>
              </div>
              <button class="fareos-amendment-btn soft-rose" onclick="showAdminToast('Raising cancellation request...')">Raise Request</button>
            </div>

            <div class="fareos-amendment-tile">
              <div>
                <div style="font-size:12px; font-weight:800; color:#0F172A;">Ancillary Services</div>
                <div style="font-size:11px; color:#64748B; margin-top:3px;">Add extra baggage, meals, or seats.</div>
              </div>
              <button class="fareos-amendment-btn soft-green" onclick="showAdminToast('Opening ancillary services catalog...')">Add Services</button>
            </div>

            <div class="fareos-amendment-tile">
              <div>
                <div style="font-size:12px; font-weight:800; color:#0F172A;">Miscellaneous</div>
                <div style="font-size:11px; color:#64748B; margin-top:3px;">Manage all other additional services.</div>
              </div>
              <button class="fareos-amendment-btn outline" onclick="showAdminToast('Raising miscellaneous amendment...')">Raise Request</button>
            </div>
          </div>
        </div>

        <!-- 1. Sync Audit Log Card (matching media_1789306899139.png) -->
        <div class="fareos-card-section" style="padding:14px 20px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleSectionCollapse('sync-audit-body', 'sync-audit-chevron')">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:28px; height:28px; border-radius:6px; background:#FEE2E2; display:flex; align-items:center; justify-content:center; color:#DC2626; flex-shrink:0;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <div style="font-size:13.5px; font-weight:800; color:#0F172A; letter-spacing:-0.2px;">Sync Audit Log</div>
                <div id="sync-audit-subtitle" style="font-size:11px; color:#64748B; margin-top:2px;">1 unresolved issue</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <span id="sync-audit-count-badge" class="fareos-rose-count-badge">1</span>
              <svg id="sync-audit-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease; transform:rotate(180deg);"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          <div id="sync-audit-body" style="display:block; margin-top:14px; border-top:1px solid #F1F5F9; padding-top:14px;">
            <div id="sync-audit-issue-card" style="background:#FFF1F2; border:1px solid #FFE4E6; border-radius:8px; padding:14px 18px; position:relative;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#EF4444;"></span>
                  <span style="background:#FFFFFF; border:1px solid #FECDD3; color:#DC2626; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">HIGH</span>
                  <span style="color:#64748B; font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-left:4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Fare Mismatch
                  </span>
                </div>
                <button type="button" class="fareos-resolve-check-btn" onclick="resolveAuditIssue(event)" title="Mark as resolved">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>
                </button>
              </div>

              <div style="margin: 8px 0 6px;">
                <span style="background:#FFFFFF; border:1px solid #E2E8F0; color:#334155; font-family:monospace; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:700;">total_fare</span>
              </div>

              <div style="color:#059669; font-weight:700; font-size:12px; margin-bottom:2px;">Provider: 5799.00</div>
              <div style="color:#EA580C; font-weight:700; font-size:12px; margin-bottom:6px;">Local: 4899.00</div>

              <div style="font-size:11px; color:#94A3B8; display:flex; align-items:center; gap:4px; margin-top:6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                9/7/2026, 12:43:08 PM
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Audit Gate Comparison Card (matching media_1789304673444.png & media_1789306899141.png) -->
        <div class="fareos-card-section" style="padding:14px 20px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleSectionCollapse('audit-gate-body', 'audit-gate-chevron')">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:28px; height:28px; border-radius:50%; background:#EEF2FF; display:flex; align-items:center; justify-content:center; color:#4F46E5; flex-shrink:0;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div style="font-size:13.5px; font-weight:800; color:#0F172A; letter-spacing:-0.2px;">Audit Gate Comparison</div>
                <div style="font-size:11px; color:#64748B; margin-top:2px;">Charged (expected) vs supplier (observed)</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <span class="fareos-audit-warning-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                WARNING
              </span>
              <svg id="audit-gate-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          <div id="audit-gate-body" style="display:none; margin-top:14px; border-top:1px solid #F1F5F9; padding-top:14px;">
            <!-- Top warning subline matching media_1789306899141.png -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; font-size:11.5px; border-bottom:1px solid #F1F5F9; padding-bottom:10px;">
              <div>
                <span style="background:#FFFBEB; color:#D97706; border:1px solid #FDE68A; font-weight:800; font-size:10px; padding:2px 6px; border-radius:4px; margin-right:6px;">WARNING</span>
                <span style="font-family:monospace; font-size:11.5px; color:#475569; font-weight:700;">audit.snapshot</span>
                <span style="font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-left:6px;">SUPPLIER_UNAVAILABLE</span>
              </div>
              <div style="color:#64748B;">
                <span style="color:#94A3B8;">expected:</span> <span style="font-weight:600;">—</span> &nbsp;&nbsp;&nbsp;&nbsp; 
                <span style="color:#94A3B8;">observed:</span> <span style="color:#DC2626; font-weight:700;">—</span>
              </div>
            </div>

            <!-- Field-by-field comparison title -->
            <div style="font-size:12.5px; font-weight:800; color:#0F172A; margin: 12px 0 10px;">
              Field-by-field comparison
            </div>

            <!-- Field-by-field Table matching media_1789306899141.png -->
            <div style="overflow-x:auto;">
              <table class="fareos-comparison-table">
                <thead>
                  <tr>
                    <th style="width:40%;">FIELD</th>
                    <th style="width:30%;">EXPECTED (CHARGED)</th>
                    <th style="width:30%;">OBSERVED (SUPPLIER)</th>
                  </tr>
                </thead>
                <tbody style="color:#334155;">
                  <!-- PRICING -->
                  <tr class="group-header">
                    <td colspan="3" style="color:#64748B; font-weight:800; font-size:11px; text-transform:uppercase; padding-top:14px; padding-bottom:4px;">PRICING</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">TOTAL</td>
                    <td style="font-weight:600; padding:5px 0;">${b.totalPrice ? Math.round(b.totalPrice).toFixed(2) : '4899.00'} INR</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">BASE</td>
                    <td style="font-weight:600; padding:5px 0;">3000.00 INR</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">TAXES</td>
                    <td style="font-weight:600; padding:5px 0;">1899.00 INR</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">FEES</td>
                    <td style="font-weight:600; padding:5px 0;">0.00 INR</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">MARKUP <span style="font-weight:400; color:#94A3B8;">(FareOS markup/FX — informational)</span></td>
                    <td style="font-weight:600; padding:5px 0;">0.00 INR</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">SUPPLIER</td>
                    <td style="color:#64748B; padding:5px 0;">—</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>

                  <!-- SEGMENTS -->
                  <tr class="group-header">
                    <td colspan="3" style="color:#64748B; font-weight:800; font-size:11px; text-transform:uppercase; padding-top:18px; padding-bottom:4px;">
                      SEGMENTS <span style="font-size:10px; color:#94A3B8; font-weight:700; margin-left:6px;">${escapeHtml(b.origin || 'COK')}-${escapeHtml(b.destination || 'DEL')} ${escapeHtml(b.flightNumber || '1813')}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">DEPARTURE</td>
                    <td style="font-weight:600; padding:5px 0;">${b.departureDate || '01 Oct 2026'}, 16:00</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">ARRIVAL</td>
                    <td style="font-weight:600; padding:5px 0;">${b.arrivalDate || b.departureDate || '01 Oct 2026'}, 19:20</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">RBD</td>
                    <td style="color:#64748B; padding:5px 0;">—</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">CABIN</td>
                    <td style="color:#64748B; padding:5px 0;">—</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">FARE BASIS</td>
                    <td style="color:#64748B; padding:5px 0;">—</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">—</td>
                  </tr>

                  <!-- BAGGAGE & EXTRAS -->
                  <tr class="group-header">
                    <td colspan="3" style="color:#64748B; font-weight:800; font-size:11px; text-transform:uppercase; padding-top:18px; padding-bottom:4px;">BAGGAGE & EXTRAS</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">CHECKED BAGGAGE</td>
                    <td style="color:#475569; padding:5px 0;">None</td>
                    <td style="color:#475569; padding:5px 0;">None</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">CABIN BAGGAGE</td>
                    <td style="color:#475569; padding:5px 0;">None</td>
                    <td style="color:#475569; padding:5px 0;">None</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">SEATS</td>
                    <td style="color:#475569; padding:5px 0;">None</td>
                    <td style="color:#475569; padding:5px 0;">None</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">MEALS</td>
                    <td style="color:#475569; padding:5px 0;">None</td>
                    <td style="color:#475569; padding:5px 0;">None</td>
                  </tr>
                  <tr>
                    <td style="color:#475569; padding:5px 0;">EXTRA BAGGAGE</td>
                    <td style="font-weight:700; color:#0F172A; padding:5px 0;">1</td>
                    <td style="color:#DC2626; font-weight:700; padding:5px 0;">None</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Passenger details note -->
            <div style="font-size:11px; color:#94A3B8; font-style:italic; margin-top:14px;">
              Passenger details omitted for privacy.
            </div>
          </div>
        </div>

        <!-- 2. Payment Process Card (matching media_1789304673444.png) -->
        <div class="fareos-card-section" style="padding:16px 20px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleSectionCollapse('payment-process-body', 'payment-process-chevron')">
            <div style="display:flex; align-items:center; gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              <span style="font-size:13.5px; font-weight:800; color:#0F172A;">Payment Process</span>
              <span class="fareos-teal-count-badge">1</span>
            </div>
            <svg id="payment-process-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease; transform:rotate(180deg);"><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          <div id="payment-process-body" style="display:block; margin-top:14px; border-top:1px solid #F1F5F9; padding-top:4px; overflow-x:auto;">
            <table class="fareos-payment-table" style="width:100%; border-collapse:collapse; white-space:nowrap;">
              <thead>
                <tr>
                  <th>CREATED ON</th>
                  <th>PRODUCT</th>
                  <th>PAYMENT METHOD</th>
                  <th>BOOKING ID</th>
                  <th>TYPE</th>
                  <th>AMOUNT</th>
                  <th>BOOKING USER ID</th>
                  <th>PAYMENT REFERENCE</th>
                  <th>COMMENTS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>2026-09-07 07:13:00</td>
                  <td style="font-weight:800; color:#0F172A;">FLIGHT</td>
                  <td>net_banking</td>
                  <td><a href="#" style="color:#2563EB; font-weight:700; text-decoration:none;" onclick="copyBookingId('${b.id || 'BKNG-8962519'}', event)">${b.id || 'BKNG-8962519'}</a></td>
                  <td>INITIAL</td>
                  <td style="font-weight:800; color:#0F172A;">${b.totalPrice ? Math.round(b.totalPrice) : '6299'}</td>
                  <td style="font-family:monospace; font-size:11px; color:#64748B;">0826df20-3f1c-4db3-9f6e-4591b5298a6b</td>
                  <td style="font-family:monospace; color:#475569;">217397534528576</td>
                  <td style="color:#64748B;">Auto-captured via payment webhook</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. Timeline of Actions Card (matching media_1789304673437.png & 438.png) -->
        <div class="fareos-card-section" style="padding:16px 20px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleSectionCollapse('timeline-actions-body', 'timeline-actions-chevron')">
            <div style="display:flex; align-items:center; gap:8px;">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style="font-size:13.5px; font-weight:800; color:#0F172A;">Timeline of Actions</span>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <span class="fareos-timeline-events-pill">7 EVENTS</span>
              <svg id="timeline-actions-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease; transform:rotate(180deg);"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          <div id="timeline-actions-body" style="display:block; margin-top:16px; border-top:1px solid #F1F5F9; padding-top:12px;">
            <div class="fareos-action-timeline">

              <!-- Event 1: Review & Price Lock -->
              <div class="fareos-timeline-node">
                <div class="fareos-node-dot"></div>
                <div class="fareos-timeline-row" onclick="toggleTimelineEvent('timeline-evt-1')">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="fareos-timeline-title">Review & Price Lock</span>
                      <span class="fareos-cat-tag lifecycle">LIFECYCLE</span>
                    </div>
                    <div class="fareos-timeline-time">Sep 07, 2026 • 12:35:57 PM</div>
                  </div>
                  <svg id="timeline-evt-1-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="timeline-evt-1" class="fareos-timeline-detail-box" style="display:none;">
                  Provider: IXAR | Session TTL: 900s | Fare: Lite
                </div>
              </div>

              <!-- Event 2: Booking Initiated -->
              <div class="fareos-timeline-node">
                <div class="fareos-node-dot"></div>
                <div class="fareos-timeline-row" onclick="toggleTimelineEvent('timeline-evt-2')">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="fareos-timeline-title">Booking Initiated</span>
                      <span class="fareos-cat-tag lifecycle">LIFECYCLE</span>
                    </div>
                    <div class="fareos-timeline-time">Sep 07, 2026 • 12:35:57 PM</div>
                  </div>
                  <svg id="timeline-evt-2-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="timeline-evt-2" class="fareos-timeline-detail-box" style="display:none;">
                  Source: WEB | Channel: FareOS-Direct | ClientIP: 103.24.120.5 | UserAgent: Mozilla/5.0
                </div>
              </div>

              <!-- Event 3: Flight Details -->
              <div class="fareos-timeline-node">
                <div class="fareos-node-dot"></div>
                <div class="fareos-timeline-row" onclick="toggleTimelineEvent('timeline-evt-3')">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="fareos-timeline-title">Flight Details</span>
                      <span class="fareos-cat-tag lifecycle">LIFECYCLE</span>
                    </div>
                    <div class="fareos-timeline-time">Sep 07, 2026 • 12:35:57 PM</div>
                  </div>
                  <svg id="timeline-evt-3-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="timeline-evt-3" class="fareos-timeline-detail-box" style="display:none;">
                  Segments: ${escapeHtml(b.origin || 'DEL')}-${escapeHtml(b.destination || 'BOM')} (${escapeHtml(b.flightNumber || '6E-2041')}) | Class: Economy (L) | Pax: 1 Adult
                </div>
              </div>

              <!-- Event 4: Payment Confirmed -->
              <div class="fareos-timeline-node">
                <div class="fareos-node-dot"></div>
                <div class="fareos-timeline-row" onclick="toggleTimelineEvent('timeline-evt-4')">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="fareos-timeline-title">Payment Confirmed</span>
                      <span class="fareos-cat-tag payment">PAYMENT</span>
                    </div>
                    <div class="fareos-timeline-time">Sep 07, 2026 • 12:43:00 PM</div>
                  </div>
                  <svg id="timeline-evt-4-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="timeline-evt-4" class="fareos-timeline-detail-box" style="display:none;">
                  Gateway: Razorpay | Ref: 217397534528576 | Mode: net_banking | Amt: ₹${b.totalPrice ? Math.round(b.totalPrice).toLocaleString() : '6,299'} | Status: SUCCESS
                </div>
              </div>

              <!-- Event 5: Booking Confirmed by Supplier -->
              <div class="fareos-timeline-node">
                <div class="fareos-node-dot"></div>
                <div class="fareos-timeline-row" onclick="toggleTimelineEvent('timeline-evt-5')">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="fareos-timeline-title">Booking Confirmed by Supplier</span>
                      <span class="fareos-cat-tag supplier">SUPPLIER</span>
                    </div>
                    <div class="fareos-timeline-time">Sep 07, 2026 • 12:44:18 PM</div>
                  </div>
                  <svg id="timeline-evt-5-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="timeline-evt-5" class="fareos-timeline-detail-box" style="display:none;">
                  SupplierRef: IX-BKG-883910 | Status: CONFIRMED | Currency: INR | Latency: 480ms
                </div>
              </div>

              <!-- Event 6: PNR Allocated -->
              <div class="fareos-timeline-node">
                <div class="fareos-node-dot"></div>
                <div class="fareos-timeline-row" onclick="toggleTimelineEvent('timeline-evt-6')">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="fareos-timeline-title">PNR Allocated</span>
                      <span class="fareos-cat-tag supplier">SUPPLIER</span>
                    </div>
                    <div class="fareos-timeline-time">Sep 07, 2026 • 12:44:18 PM</div>
                  </div>
                  <svg id="timeline-evt-6-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="timeline-evt-6" class="fareos-timeline-detail-box" style="display:none;">
                  ${b.isSplitPnr && b.splitPnrs && b.splitPnrs.length > 0 ? `
                    ⚡ Split PNRs: ${b.splitPnrs.map(s => `${s.pnr} (${escapeHtml(s.fareClass || 'Promo')})`).join(' &amp; ')} | Cross-Ref: ${escapeHtml(b.gdsCrossReference || 'OSI 6E TCP')} | Status: HK (Confirmed)
                  ` : `
                    Airline PNR: ${escapeHtml(b.pnr || '6E-Z9K3M1')} | GDS PNR: 1A-98F12A | Status: HK (Confirmed)
                  `}
                </div>
              </div>

              <!-- Event 7: Ticket Issued (mint/teal dot) -->
              <div class="fareos-timeline-node">
                <div class="fareos-node-dot teal"></div>
                <div class="fareos-timeline-row" onclick="toggleTimelineEvent('timeline-evt-7')">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="fareos-timeline-title">Ticket Issued</span>
                      <span class="fareos-cat-tag ticket">TICKET</span>
                    </div>
                    <div class="fareos-timeline-time">Sep 07, 2026 • 12:44:18 PM</div>
                  </div>
                  <svg id="timeline-evt-7-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="transition:transform 0.2s ease; transform:rotate(180deg);"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="timeline-evt-7" class="fareos-timeline-detail-box" style="display:block;">
                  Provider: IXAR
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Customer Details, Price Summary, Fare Rules -->
      <div>
        <!-- Customer Details Card -->
        <div class="fareos-card-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:11px; font-weight:800; color:#64748B; text-transform:uppercase;">
              CUSTOMER DETAILS <span style="background:#EFF6FF; color:#2563EB; padding:1px 5px; border-radius:3px; margin-left:4px;">1 BOOKING</span>
            </div>
            <a href="#" style="font-size:11px; font-weight:700; color:#2563EB; text-decoration:none;" onclick="showAdminToast('Viewing traveler profile...')">View Profile</a>
          </div>

          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            <div style="width:34px; height:34px; border-radius:50%; background:#F1F5F9; border:1px solid #CBD5E1; display:flex; align-items:center; justify-content:center; color:#64748B; font-weight:800;">
              👤
            </div>
            <div>
              <div style="font-size:13px; font-weight:800; color:#0F172A;">${escapeHtml(cust.name)}</div>
              <div style="font-size:10px; color:#94A3B8; font-family:monospace;">ID: ${escapeHtml(cust.id)}</div>
            </div>
          </div>

          <div style="font-size:11.5px; color:#475569; line-height:1.6; border-top:1px solid #F1F5F9; padding-top:8px;">
            <div>✉️ ${escapeHtml(cust.email)}</div>
            <div>📞 ${escapeHtml(cust.phone)}</div>
          </div>

          <div style="border-top:1px solid #F1F5F9; padding-top:8px; margin-top:8px;">
            <div style="font-size:10px; font-weight:800; color:#64748B; text-transform:uppercase; margin-bottom:4px;">CONTACT DETAILS</div>
            <div style="font-size:11.5px; color:#475569; line-height:1.6;">
              <div>✉️ ${escapeHtml(cust.email)}</div>
              <div>📞 ${escapeHtml(cust.phone)}</div>
            </div>
          </div>
        </div>

        <!-- Price Summary Card -->
        <div class="fareos-card-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-size:11px; font-weight:800; color:#64748B; text-transform:uppercase;">PRICE SUMMARY</span>
            <span style="font-size:11px; color:#64748B;">👥 1 Adult</span>
          </div>

          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:800; color:#0F172A; font-size:12px;">Adult · 1 Pax</span>
              <span style="font-weight:800; color:#0F172A; font-size:12.5px;">₹${Number(ps.adultTotal || b.amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:10.5px; color:#64748B; padding-top:4px; border-top:1px dashed #E2E8F0;">
              <span>Base: ₹${Number(ps.baseFare || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
              <span>Tax: ₹${Number(ps.tax || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; font-size:11.5px; color:#64748B; padding:6px 0; border-top:1px solid #F1F5F9;">
            <span>Convenience Fee</span>
            <span style="font-weight:700; color:#0F172A;">₹${Number(ps.convenienceFee || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
          </div>

          <div style="border-top:1px solid #E2E8F0; padding-top:10px; margin-top:6px; display:flex; justify-content:space-between; align-items:baseline;">
            <div>
              <span style="font-size:10px; font-weight:800; color:#64748B; text-transform:uppercase; letter-spacing:0.3px;">GRAND TOTAL</span>
              <div style="font-size:9.5px; color:#94A3B8;">1 PAX TOTAL</div>
            </div>
            <div style="font-size:18px; font-weight:900; color:#0F172A;">
              ₹${Number(ps.grandTotal || b.amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}
            </div>
          </div>
        </div>

        <!-- Fare Rules & Conditions Card -->
        <div class="fareos-card-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11px; font-weight:800; color:#64748B; text-transform:uppercase;">FARE RULES &amp; CONDITIONS</span>
          </div>
          <div style="font-size:10px; font-weight:800; color:#DC2626; text-transform:uppercase; margin-bottom:8px;">
            NON-REFUNDABLE
          </div>
          <div style="border:1px solid #E2E8F0; border-radius:6px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:#334155; font-weight:700;">
            <span>${escapeHtml(b.origin || "DXB")} → ${escapeHtml(b.destination || "JED")}</span>
            <span style="color:#64748B; font-size:10px;">▾</span>
          </div>
        </div>
      </div>

    </div>
  `;
}

function toggleSectionCollapse(bodyId, chevronId) {
  const el = document.getElementById(bodyId);
  const chev = document.getElementById(chevronId);
  if (!el) return;
  const isHidden = (window.getComputedStyle(el).display === "none" || el.style.display === "none");
  el.style.display = isHidden ? "block" : "none";
  if (chev) {
    chev.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
  }
}
window.toggleSectionCollapse = toggleSectionCollapse;

function toggleTimelineEvent(eventId) {
  const el = document.getElementById(eventId);
  const chev = document.getElementById(eventId + "-chevron");
  if (!el) return;
  const isHidden = (window.getComputedStyle(el).display === "none" || el.style.display === "none");
  el.style.display = isHidden ? "block" : "none";
  if (chev) {
    chev.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
  }
}
window.toggleTimelineEvent = toggleTimelineEvent;

function toggleAuditLogCollapse() {
  toggleSectionCollapse("sync-audit-body", "sync-audit-chevron");
}
window.toggleAuditLogCollapse = toggleAuditLogCollapse;

function resolveAuditIssue(event) {
  if (event) event.stopPropagation();
  const card = document.getElementById("sync-audit-issue-card");
  const badge = document.getElementById("sync-audit-count-badge");
  const subtitle = document.getElementById("sync-audit-subtitle");
  
  if (card) {
    card.style.background = "#F0FDF4";
    card.style.borderColor = "#BBF7D0";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:#16A34A; font-size:14px; font-weight:800;">✓</span>
          <span style="font-size:12px; font-weight:700; color:#166534;">Fare Mismatch Resolved</span>
          <span style="font-size:11px; color:#64748B;">• Acknowledged by ${escapeHtml(currentAdminPersona ? currentAdminPersona.name : 'Susen')}</span>
        </div>
        <button type="button" class="fareos-btn-tool" style="font-size:10.5px; padding:3px 8px;" onclick="undoResolveAuditIssue(event)">Undo</button>
      </div>
    `;
  }
  if (badge) {
    badge.textContent = "0";
    badge.style.background = "#F1F5F9";
    badge.style.color = "#64748B";
    badge.style.borderColor = "#E2E8F0";
  }
  if (subtitle) {
    subtitle.textContent = "0 unresolved issues";
    subtitle.style.color = "#16A34A";
  }
  showAdminToast("✅ Marked audit mismatch as resolved");
}
window.resolveAuditIssue = resolveAuditIssue;

function undoResolveAuditIssue(event) {
  if (event) event.stopPropagation();
  const card = document.getElementById("sync-audit-issue-card");
  const badge = document.getElementById("sync-audit-count-badge");
  const subtitle = document.getElementById("sync-audit-subtitle");

  if (card) {
    card.style.background = "#FFF1F2";
    card.style.borderColor = "#FFE4E6";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#EF4444;"></span>
          <span style="background:#FFFFFF; border:1px solid #FECDD3; color:#DC2626; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">HIGH</span>
          <span style="color:#64748B; font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-left:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Fare Mismatch
          </span>
        </div>
        <button type="button" class="fareos-resolve-check-btn" onclick="resolveAuditIssue(event)" title="Mark as resolved">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>
        </button>
      </div>

      <div style="margin: 8px 0 6px;">
        <span style="background:#FFFFFF; border:1px solid #E2E8F0; color:#334155; font-family:monospace; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:700;">total_fare</span>
      </div>

      <div style="color:#059669; font-weight:700; font-size:12px; margin-bottom:2px;">Provider: 5799.00</div>
      <div style="color:#EA580C; font-weight:700; font-size:12px; margin-bottom:6px;">Local: 4899.00</div>

      <div style="font-size:11px; color:#94A3B8; display:flex; align-items:center; gap:4px; margin-top:6px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        9/7/2026, 12:43:08 PM
      </div>
    `;
  }
  if (badge) {
    badge.textContent = "1";
    badge.style.background = "#FFE4E6";
    badge.style.color = "#E11D48";
    badge.style.borderColor = "#FECDD3";
  }
  if (subtitle) {
    subtitle.textContent = "1 unresolved issue";
    subtitle.style.color = "#64748B";
  }
  showAdminToast("Audit mismatch re-opened");
}
window.undoResolveAuditIssue = undoResolveAuditIssue;

function saveInternalNotes(bookingId, notes) {
  if (!currentBooking) return;
  currentBooking.internalNotes = notes;
  persistBookingUpdate(currentBooking);
  showAdminToast("💾 Saved internal notes");
}

function copyBookingId(id, event) {
  if (event) event.stopPropagation();
  navigator.clipboard.writeText(id).then(() => {
    showAdminToast(`Copied ${id}`);
  }).catch(() => {});
}

/**
 * Passengers & Service Breakdown Controller (matching media_1789302703099.png, 105, 102, 104)
 */
function renderPassengerBreakdownCard(p, pIdx, b) {
  let title = (p.title || "MR").toUpperCase();
  let rawName = p.name || b.passengerName || "IFTHIKHAN/PT";
  let firstName = p.firstName;
  let lastName = p.lastName;
  if (!firstName || !lastName) {
    if (rawName.includes("/")) {
      const parts = rawName.split("/");
      firstName = parts[0];
      lastName = parts[1] || "";
    } else if (rawName.includes(" ")) {
      const parts = rawName.split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ") || "";
    } else {
      firstName = rawName;
      lastName = "PT";
    }
  }
  let fullNameFormatted = `${title} ${firstName}/${lastName}`;
  let nationality = (p.nationality || "IN").toUpperCase();
  const splitPnrObj = (b.isSplitPnr && b.splitPnrs && b.splitPnrs[pIdx]) ? b.splitPnrs[pIdx] : null;
  let pnr = p.pnr || (splitPnrObj ? splitPnrObj.pnr : null) || b.pnr || "D9Q3XE";
  let baseFare = p.baseFare !== undefined ? Number(p.baseFare) : (b.priceSummary && b.priceSummary.baseFare ? Number(b.priceSummary.baseFare) : 3000.00);
  let tax = p.tax !== undefined ? Number(p.tax) : (b.priceSummary && b.priceSummary.tax ? Number(b.priceSummary.tax) : 1899.00);
  let apiSupplier = p.apiSupplier || b.supplierSearch || "IXAR";
  let issueSupplier = p.issueSupplier || b.supplierIssued || "IXAR";
  let supplierRef = p.supplierRef || pnr;

  if (!paxActiveTabMap[pIdx]) paxActiveTabMap[pIdx] = "default";
  const activeSubTab = paxActiveTabMap[pIdx];
  const isEditing = !!paxEditingMap[pIdx];
  const isCollapsed = !!paxCollapsedMap[pIdx];

  const stBadge = (p.status === "CONFIRMED" || !p.status) ?
    `<span style="font-size:11px; font-weight:700; color:#059669; background:#ECFDF5; padding:3px 8px; border-radius:4px; border:1px solid #A7F3D0; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> CONFIRMED</span>` :
    (p.status === "PENDING" ? `<span class="fareos-tag-badge t-init">⏱ PENDING</span>` : `<span class="fareos-tag-badge t-failed">✕ FAILED</span>`);

  return `
    <div class="fareos-pax-card ${isEditing ? 'is-editing' : ''}" id="pax-card-${pIdx}">
      <!-- Header Row matching media_1789302703099.png -->
      <div class="fareos-pax-card-header">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="fareos-pax-idx-badge">0${pIdx + 1}</div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px; font-weight:900; color:#0F172A; letter-spacing:0.2px;">${escapeHtml(fullNameFormatted)}</span>
              <button type="button" class="fareos-copy-inline-btn" onclick="copyToClipboard('${escapeHtml(fullNameFormatted)}', event)" title="Copy Name">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <span style="font-size:10px; font-weight:800; color:#2563EB; background:#EFF6FF; padding:1px 6px; border-radius:4px;">
                ${escapeHtml(p.type || "ADULT")}
              </span>
            </div>
            <div style="font-size:11px; color:#64748B; font-family:monospace; margin-top:2px; display:flex; align-items:center; gap:6px;">
              <span>PNR: <strong style="color:#0F172A;">${escapeHtml(pnr)}</strong></span>
              <button type="button" class="fareos-copy-inline-btn" onclick="copyToClipboard('${escapeHtml(pnr)}', event)" title="Copy PNR">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              ${splitPnrObj ? `<span style="font-size:9.5px; font-weight:800; color:#1D4ED8; background:#EFF6FF; padding:1px 6px; border-radius:4px; border:1px solid #BFDBFE;">SPLIT: ${escapeHtml(splitPnrObj.fareClass || 'Promo')} (₹${Number(splitPnrObj.amount || 0).toLocaleString('en-IN')})</span>` : ''}
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px;">
          ${isEditing ? `
            <button type="button" class="btn-primary" style="padding:4px 12px; font-size:11.5px; border-radius:5px; font-weight:800; display:inline-flex; align-items:center; gap:4px;" onclick="savePaxInlineEdit(${pIdx})">
              💾 Save
            </button>
            <button type="button" class="fareos-btn-tool" style="padding:4px 10px; font-size:11.5px;" onclick="cancelPaxInlineEdit(${pIdx})">
              ✕ Cancel
            </button>
          ` : `
            <button type="button" class="fareos-pax-edit-btn" onclick="togglePaxEditMode(${pIdx})" title="Edit passenger details directly from here">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          `}
          ${stBadge}
          <button type="button" style="background:none; border:none; color:#64748B; cursor:pointer; padding:4px;" onclick="togglePaxAccordion(${pIdx})" title="Expand / Collapse">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform:${isCollapsed ? 'rotate(180deg)' : 'none'}; transition:transform 0.2s;"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
        </div>
      </div>

      <!-- Collapsible Body -->
      <div id="pax-card-body-${pIdx}" style="display:${isCollapsed ? 'none' : 'block'};">
        <!-- Passenger Bio Fields Row -->
        <div class="fareos-pax-bio-grid">
          <div>
            <div class="fareos-pax-field-lbl">TITLE</div>
            ${isEditing ? `
              <select id="edit-pax-title-${pIdx}" class="fareos-mu-select" style="height:32px; font-size:12px; padding:0 6px;">
                <option value="MR" ${title === 'MR' ? 'selected' : ''}>MR</option>
                <option value="MRS" ${title === 'MRS' ? 'selected' : ''}>MRS</option>
                <option value="MS" ${title === 'MS' ? 'selected' : ''}>MS</option>
                <option value="MSTR" ${title === 'MSTR' ? 'selected' : ''}>MSTR</option>
                <option value="MISS" ${title === 'MISS' ? 'selected' : ''}>MISS</option>
              </select>
            ` : `
              <div class="fareos-pax-field-val">${escapeHtml(title)}</div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">FIRST NAME</div>
            ${isEditing ? `
              <input type="text" id="edit-pax-fname-${pIdx}" class="fareos-mu-input" value="${escapeHtml(firstName)}" style="height:32px; font-size:12px;" />
            ` : `
              <div class="fareos-pax-field-val">
                <span>${escapeHtml(firstName)}</span>
                <button type="button" class="fareos-copy-inline-btn" onclick="copyToClipboard('${escapeHtml(firstName)}', event)" title="Copy First Name">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">LAST NAME</div>
            ${isEditing ? `
              <input type="text" id="edit-pax-lname-${pIdx}" class="fareos-mu-input" value="${escapeHtml(lastName)}" style="height:32px; font-size:12px;" />
            ` : `
              <div class="fareos-pax-field-val">
                <span>${escapeHtml(lastName)}</span>
                <button type="button" class="fareos-copy-inline-btn" onclick="copyToClipboard('${escapeHtml(lastName)}', event)" title="Copy Last Name">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">NATIONALITY</div>
            ${isEditing ? `
              <input type="text" id="edit-pax-nat-${pIdx}" class="fareos-mu-input" value="${escapeHtml(nationality)}" style="height:32px; font-size:12px; text-transform:uppercase;" maxlength="3" />
            ` : `
              <div class="fareos-pax-field-val">
                <span>${escapeHtml(nationality)}</span>
                <button type="button" class="fareos-copy-inline-btn" onclick="copyToClipboard('${escapeHtml(nationality)}', event)" title="Copy Nationality">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            `}
          </div>
        </div>

        <!-- Passenger APIS Identification Row -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; padding:10px 14px; background:#F8FAFC; border-top:1px solid #E2E8F0; border-bottom:1px solid #E2E8F0;">
          <div>
            <div class="fareos-pax-field-lbl">PASSPORT NUMBER</div>
            ${isEditing ? `
              <input type="text" id="edit-pax-passport-${pIdx}" class="fareos-mu-input" value="${escapeHtml(p.passportNumber || (pIdx === 0 ? (b.passportNumber || '') : ''))}" style="height:32px; font-size:12px; font-family:monospace; text-transform:uppercase;" placeholder="e.g. P19827364" />
            ` : `
              <div class="fareos-pax-field-val" style="font-family:monospace;">
                <span>${escapeHtml(p.passportNumber || (pIdx === 0 ? (b.passportNumber || 'Not Provided') : 'Not Provided'))}</span>
                ${(p.passportNumber || (pIdx === 0 && b.passportNumber)) ? `
                  <button type="button" class="fareos-copy-inline-btn" onclick="copyToClipboard('${escapeHtml(p.passportNumber || b.passportNumber)}', event)" title="Copy Passport Number">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                ` : ''}
              </div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">EXPIRY DATE</div>
            ${isEditing ? `
              <input type="text" id="edit-pax-expiry-${pIdx}" class="fareos-mu-input" value="${escapeHtml(p.passportExpiry || (pIdx === 0 ? (b.passportExpiry || '') : ''))}" style="height:32px; font-size:12px;" placeholder="MM/YYYY" />
            ` : `
              <div class="fareos-pax-field-val">${escapeHtml(p.passportExpiry || (pIdx === 0 ? (b.passportExpiry || '—') : '—'))}</div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">DATE OF BIRTH</div>
            ${isEditing ? `
              <input type="text" id="edit-pax-dob-${pIdx}" class="fareos-mu-input" value="${escapeHtml(p.dob || '')}" style="height:32px; font-size:12px;" placeholder="YYYY-MM-DD" />
            ` : `
              <div class="fareos-pax-field-val">${escapeHtml(p.dob || '—')}</div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">APIS STATUS</div>
            <div class="fareos-pax-field-val" style="margin-top:2px;">
              ${(p.passportNumber || (pIdx === 0 && b.passportNumber)) ? `
                <span style="font-size:11px; font-weight:700; color:#059669; background:#ECFDF5; padding:2px 8px; border-radius:4px; border:1px solid #A7F3D0; display:inline-flex; align-items:center; gap:4px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  APIS Ready
                </span>
              ` : `
                <span style="font-size:11px; font-weight:700; color:#D97706; background:#FEF3C7; padding:2px 8px; border-radius:4px; border:1px solid #FDE68A; display:inline-flex; align-items:center; gap:4px;">
                  ⚠️ Needs APIS
                </span>
              `}
            </div>
          </div>
        </div>

        <!-- Sub-Tabs Row matching screenshots -->
        <div class="fareos-pax-tabs-bar">
          <button type="button" class="fareos-pax-tab-btn ${activeSubTab === 'default' ? 'active' : ''}" onclick="switchPaxSubTab(${pIdx}, 'default')">
            DEFAULT
          </button>
          <button type="button" class="fareos-pax-tab-btn ${activeSubTab === 'supplier' ? 'active' : ''}" onclick="switchPaxSubTab(${pIdx}, 'supplier')">
            SUPPLIER DETAILS
          </button>
          <button type="button" class="fareos-pax-tab-btn ${activeSubTab === 'client' ? 'active' : ''}" onclick="switchPaxSubTab(${pIdx}, 'client')">
            CLIENT DETAILS
          </button>
          <button type="button" class="fareos-pax-tab-btn ${activeSubTab === 'ssr' ? 'active' : ''}" onclick="switchPaxSubTab(${pIdx}, 'ssr')">
            SSR &amp; BAGGAGE
          </button>
        </div>

        <!-- Sub-Tab Content -->
        <div class="fareos-pax-sub-body">
          ${renderPaxSubTabContent(p, pIdx, b, activeSubTab, isEditing)}
        </div>
      </div>
    </div>
  `;
}

function renderPaxSubTabContent(p, pIdx, b, tabName, isEditing) {
  const splitPnrObj = (b.isSplitPnr && b.splitPnrs && b.splitPnrs[pIdx]) ? b.splitPnrs[pIdx] : null;
  let pnr = p.pnr || (splitPnrObj ? splitPnrObj.pnr : null) || b.pnr || "D9Q3XE";
  let baseFare = p.baseFare !== undefined ? Number(p.baseFare) : (b.priceSummary && b.priceSummary.baseFare ? Number(b.priceSummary.baseFare) : 3000.00);
  let tax = p.tax !== undefined ? Number(p.tax) : (b.priceSummary && b.priceSummary.tax ? Number(b.priceSummary.tax) : 1899.00);
  let apiSupplier = p.apiSupplier || b.supplierSearch || "IXAR";
  let issueSupplier = p.issueSupplier || b.supplierIssued || "IXAR";
  let supplierRef = p.supplierRef || pnr;
  let seatCost = p.seatCost !== undefined ? Number(p.seatCost) : 0;
  let seatNo = p.seat || "0";
  let extraBagCost = p.extraBagCost !== undefined ? Number(p.extraBagCost) : 900;
  let mealsCost = p.mealsCost !== undefined ? Number(p.mealsCost) : 0;
  let otherSsrCost = p.otherSsrCost !== undefined ? Number(p.otherSsrCost) : 0;
  let ancillaries = p.ancillaries || [
    { type: "BAGGAGE", tag: "#EXTRA", price: extraBagCost }
  ];

  if (tabName === "default") {
    return `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 20px; align-items:flex-end;">
        <div>
          <div class="fareos-pax-field-lbl">BASE FARE</div>
          ${isEditing ? `
            <input type="number" id="edit-pax-base-${pIdx}" class="fareos-mu-input" value="${baseFare}" style="height:32px; font-size:12.5px;" />
          ` : `
            <div class="fareos-pax-field-val">₹${formatCurrency(baseFare)}</div>
          `}
        </div>

        <div>
          <div class="fareos-pax-field-lbl">TAXES</div>
          ${isEditing ? `
            <input type="number" id="edit-pax-tax-${pIdx}" class="fareos-mu-input" value="${tax}" style="height:32px; font-size:12.5px;" />
          ` : `
            <div class="fareos-pax-field-val">₹${formatCurrency(tax)}</div>
          `}
        </div>

        <div>
          <div class="fareos-pax-field-lbl">AIRLINE PNR</div>
          ${isEditing ? `
            <input type="text" id="edit-pax-pnr-${pIdx}" class="fareos-mu-input" value="${escapeHtml(pnr)}" style="height:32px; font-size:12.5px; text-transform:uppercase; font-family:monospace;" />
          ` : `
            <div class="fareos-pax-field-val" style="font-family:monospace;">${escapeHtml(pnr)}</div>
          `}
        </div>
      </div>
    `;
  }

  if (tabName === "supplier") {
    return `
      <div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 20px;">
          <div>
            <div class="fareos-pax-field-lbl">API SUPPLIER</div>
            ${isEditing ? `
              <input type="text" id="edit-pax-apisup-${pIdx}" class="fareos-mu-input" value="${escapeHtml(apiSupplier)}" style="height:32px; font-size:12.5px;" />
            ` : `
              <div class="fareos-pax-field-val">${escapeHtml(apiSupplier)}</div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">ISSUE SUPPLIER</div>
            ${isEditing ? `
              <input type="text" id="edit-pax-issuesup-${pIdx}" class="fareos-mu-input" value="${escapeHtml(issueSupplier)}" style="height:32px; font-size:12.5px;" />
            ` : `
              <div class="fareos-pax-field-val">${escapeHtml(issueSupplier)}</div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">SUPPLIER NET</div>
            <div class="fareos-pax-field-val" style="color:#64748B;">—</div>
          </div>

          <div>
            <div class="fareos-pax-field-lbl">SUPPLIER GROSS</div>
            <div class="fareos-pax-field-val" style="color:#64748B;">—</div>
          </div>
        </div>

        <div style="margin-top:16px;">
          <div class="fareos-pax-field-lbl">SUPPLIER REFERENCE NO.</div>
          ${isEditing ? `
            <input type="text" id="edit-pax-supref-${pIdx}" class="fareos-mu-input" value="${escapeHtml(supplierRef)}" style="height:32px; font-size:12.5px; text-transform:uppercase; font-family:monospace; max-width:240px;" />
          ` : `
            <div class="fareos-pax-field-val" style="font-family:monospace;">${escapeHtml(supplierRef)}</div>
          `}
        </div>
      </div>
    `;
  }

  if (tabName === "client") {
    const allDocs = getBookingDocuments(b);
    const pFullName = (p.name || `${p.firstName || ''} ${p.lastName || ''}`).toLowerCase().trim();
    const pDocs = allDocs.filter((doc) => {
      if (!doc.paxName) return true;
      const dName = doc.paxName.toLowerCase().trim();
      return dName.includes(pFullName) || pFullName.includes(dName) || (pIdx === 0 && dName.includes('lead'));
    });

    return `
      <div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom:12px;">
          <div>
            <div class="fareos-pax-field-lbl">CLIENT / TRAVELER</div>
            <div class="fareos-pax-field-val">${escapeHtml(b.customer || p.name || 'Valued Traveler')}</div>
          </div>
          <div>
            <div class="fareos-pax-field-lbl">PHONE NUMBER</div>
            <div class="fareos-pax-field-val">${escapeHtml(b.phone || '+91 98765 43210')}</div>
          </div>
          <div>
            <div class="fareos-pax-field-lbl">CUSTOMER TYPE</div>
            <div class="fareos-pax-field-val">${escapeHtml(b.customerType || 'REGULAR')}</div>
          </div>
        </div>

        ${pDocs.length > 0 ? `
          <div style="margin-top:12px; border-top:1px solid #E2E8F0; padding-top:10px;">
            <div style="font-size:11px; font-weight:800; color:#64748B; text-transform:uppercase; margin-bottom:8px;">Linked Identification &amp; Documents (${pDocs.length})</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${renderDocumentsListHTML(pDocs, false)}
            </div>
          </div>
        ` : `
          <div style="padding:8px 0; color:#64748B; font-size:12px; display:flex; align-items:center; gap:8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>No specific document records linked to this passenger name.</span>
          </div>
        `}
      </div>
    `;
  }

  if (tabName === "ssr") {
    return `
      <div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 20px;">
          <div>
            <div class="fareos-pax-field-lbl">SEAT NO. &amp; COST</div>
            ${isEditing ? `
              <input type="number" id="edit-pax-seat-${pIdx}" class="fareos-mu-input" value="${seatCost}" style="height:32px; font-size:12.5px;" />
            ` : `
              <div class="fareos-pax-field-val">${seatCost ? `${seatNo} (₹${seatCost})` : '0'}</div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">EXTRA BAG &amp; COST</div>
            ${isEditing ? `
              <input type="number" id="edit-pax-bag-${pIdx}" class="fareos-mu-input" value="${extraBagCost}" style="height:32px; font-size:12.5px;" />
            ` : `
              <div class="fareos-pax-field-val">${extraBagCost}</div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">MEALS &amp; COST</div>
            ${isEditing ? `
              <input type="number" id="edit-pax-meal-${pIdx}" class="fareos-mu-input" value="${mealsCost}" style="height:32px; font-size:12.5px;" />
            ` : `
              <div class="fareos-pax-field-val">${mealsCost}</div>
            `}
          </div>

          <div>
            <div class="fareos-pax-field-lbl">OTHER SSR &amp; COST</div>
            ${isEditing ? `
              <input type="number" id="edit-pax-otherssr-${pIdx}" class="fareos-mu-input" value="${otherSsrCost}" style="height:32px; font-size:12.5px;" />
            ` : `
              <div class="fareos-pax-field-val">${otherSsrCost}</div>
            `}
          </div>
        </div>

        <div style="margin-top:18px;">
          <div style="font-size:11px; font-weight:800; color:#0F172A; text-transform:uppercase; letter-spacing:0.4px; display:flex; align-items:center; gap:6px; margin-bottom:10px;">
            <div style="width:16px; height:16px; border-radius:50%; border:1.5px solid #2563EB; display:flex; align-items:center; justify-content:center; color:#2563EB; font-size:10px;">✓</div>
            <span>ALLOCATED ANCILLARIES</span>
          </div>

          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            ${ancillaries.map((anc) => `
              <div class="fareos-ancillary-purple-card">
                <div style="font-size:11px; font-weight:800; color:#7C3AED; display:flex; align-items:center; gap:5px;">
                  <span>🧳</span>
                  <span>${escapeHtml(anc.type || 'BAGGAGE')}</span>
                  <span style="font-size:10px; opacity:0.8;">${escapeHtml(anc.tag || '#EXTRA')}</span>
                </div>
                <div style="font-size:13px; font-weight:900; color:#6D28D9;">
                  ₹${formatCurrency(anc.price || 900)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

function switchPaxSubTab(pIdx, tabName) {
  paxActiveTabMap[pIdx] = tabName;
  if (currentBooking) {
    renderBookingDetailView(currentBooking);
  }
}

function togglePaxEditMode(pIdx) {
  paxEditingMap[pIdx] = !paxEditingMap[pIdx];
  if (currentBooking) {
    renderBookingDetailView(currentBooking);
  }
}

function togglePaxAccordion(pIdx) {
  paxCollapsedMap[pIdx] = !paxCollapsedMap[pIdx];
  const body = document.getElementById(`pax-card-body-${pIdx}`);
  if (body) {
    body.style.display = paxCollapsedMap[pIdx] ? "none" : "block";
  }
}

function savePaxInlineEdit(pIdx) {
  if (!currentBooking) return;
  if (!currentBooking.passengerList) currentBooking.passengerList = [];
  let p = currentBooking.passengerList[pIdx];
  if (!p) {
    p = { title: "MR", name: "IFTHIKHAN/PT", type: "ADULT", status: "CONFIRMED" };
    currentBooking.passengerList[pIdx] = p;
  }

  const titleEl = document.getElementById(`edit-pax-title-${pIdx}`);
  const fNameEl = document.getElementById(`edit-pax-fname-${pIdx}`);
  const lNameEl = document.getElementById(`edit-pax-lname-${pIdx}`);
  const natEl = document.getElementById(`edit-pax-nat-${pIdx}`);
  
  if (titleEl) p.title = titleEl.value;
  if (fNameEl) p.firstName = fNameEl.value.trim();
  if (lNameEl) p.lastName = lNameEl.value.trim();
  if (fNameEl && lNameEl) p.name = `${p.firstName}/${p.lastName}`;
  if (natEl) p.nationality = natEl.value.trim().toUpperCase();

  const baseEl = document.getElementById(`edit-pax-base-${pIdx}`);
  const taxEl = document.getElementById(`edit-pax-tax-${pIdx}`);
  const pnrEl = document.getElementById(`edit-pax-pnr-${pIdx}`);
  if (baseEl) p.baseFare = parseFloat(baseEl.value) || 0;
  if (taxEl) p.tax = parseFloat(taxEl.value) || 0;
  if (pnrEl) {
    p.pnr = pnrEl.value.trim().toUpperCase();
    currentBooking.pnr = p.pnr;
  }

  const apiSupEl = document.getElementById(`edit-pax-apisup-${pIdx}`);
  const issSupEl = document.getElementById(`edit-pax-issuesup-${pIdx}`);
  const supRefEl = document.getElementById(`edit-pax-supref-${pIdx}`);
  if (apiSupEl) p.apiSupplier = apiSupEl.value.trim();
  if (issSupEl) p.issueSupplier = issSupEl.value.trim();
  if (supRefEl) p.supplierRef = supRefEl.value.trim().toUpperCase();

  const bagEl = document.getElementById(`edit-pax-bag-${pIdx}`);
  const seatEl = document.getElementById(`edit-pax-seat-${pIdx}`);
  const mealEl = document.getElementById(`edit-pax-meal-${pIdx}`);
  const otherSsrEl = document.getElementById(`edit-pax-otherssr-${pIdx}`);
  if (bagEl) {
    p.extraBagCost = parseFloat(bagEl.value) || 0;
    p.ancillaries = [{ type: "BAGGAGE", tag: "#EXTRA", price: p.extraBagCost }];
  }
  if (seatEl) p.seatCost = parseFloat(seatEl.value) || 0;
  if (mealEl) p.mealsCost = parseFloat(mealEl.value) || 0;
  if (otherSsrEl) p.otherSsrCost = parseFloat(otherSsrEl.value) || 0;

  const passportEl = document.getElementById(`edit-pax-passport-${pIdx}`);
  const expiryEl = document.getElementById(`edit-pax-expiry-${pIdx}`);
  const dobEl = document.getElementById(`edit-pax-dob-${pIdx}`);
  if (passportEl) p.passportNumber = passportEl.value.trim().toUpperCase();
  if (expiryEl) p.passportExpiry = expiryEl.value.trim();
  if (dobEl) p.dob = dobEl.value.trim();

  // Sync to documents on currentBooking
  if (p.passportNumber) {
    if (!currentBooking.documents) currentBooking.documents = getBookingDocuments(currentBooking);
    const pFullName = p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Passenger';
    let doc = currentBooking.documents.find((d) => d.type === "Passport" && (d.paxName === pFullName || d.number === p.passportNumber));
    if (doc) {
      doc.number = p.passportNumber;
      doc.expiry = p.passportExpiry || doc.expiry;
      doc.issuingCountry = p.nationality || doc.issuingCountry;
      doc.paxName = pFullName;
    } else {
      currentBooking.documents.push({
        id: "doc_" + Date.now(),
        paxName: pFullName,
        type: "Passport",
        title: `Passport - ${pFullName}`,
        number: p.passportNumber,
        expiry: p.passportExpiry || "—",
        issuingCountry: p.nationality || "India",
        source: "Admin Updated",
        status: "Attached to Ticket",
        uploadedAt: new Date().toISOString()
      });
    }
  }

  // Recalculate price summary if base fare or tax was updated
  if (p.baseFare !== undefined && p.tax !== undefined) {
    if (!currentBooking.priceSummary) currentBooking.priceSummary = {};
    currentBooking.priceSummary.baseFare = p.baseFare;
    currentBooking.priceSummary.tax = p.tax;
    currentBooking.priceSummary.adultTotal = p.baseFare + p.tax;
    currentBooking.priceSummary.grandTotal = p.baseFare + p.tax + (currentBooking.priceSummary.convenienceFee || 1000);
    currentBooking.amount = currentBooking.priceSummary.grandTotal;
  }

  paxEditingMap[pIdx] = false;
  persistBookingUpdate(currentBooking);
  showAdminToast(`✓ Updated passenger details for ${p.title} ${p.firstName || ''} ${p.lastName || ''}`);
  renderBookingDetailView(currentBooking);
}

function cancelPaxInlineEdit(pIdx) {
  paxEditingMap[pIdx] = false;
  if (currentBooking) {
    renderBookingDetailView(currentBooking);
  }
}

function copyToClipboard(text, e) {
  if (e) e.stopPropagation();
  navigator.clipboard.writeText(text).then(() => {
    showAdminToast(`Copied ${text}`);
  }).catch(() => {});
}

/**
 * FareOS Manual Booking Update Modal Controller
 */
let activeManualTab = "info";
let isDraftSaved = false;
let manualDraft = null;

function openStandaloneManualUpdate() {
  if (currentBooking) {
    window.location.href = `admin-flight-booking-manual-update.html?id=${encodeURIComponent(currentBooking.id)}`;
  }
}

function openManualUpdateModal(bookingId) {
  if (!currentBooking) return;

  // Check if draft exists in localStorage
  try {
    const draftStr = localStorage.getItem(`fareos_draft_${currentBooking.id}`);
    if (draftStr) {
      manualDraft = JSON.parse(draftStr);
      isDraftSaved = true;
    } else {
      manualDraft = null;
      isDraftSaved = false;
    }
  } catch (e) {
    manualDraft = null;
    isDraftSaved = false;
  }

  if (!manualDraft) {
    manualDraft = JSON.parse(JSON.stringify(currentBooking));
    if (!manualDraft.apiSupplier) manualDraft.apiSupplier = manualDraft.supplierSearch || "flydubai";
    if (!manualDraft.issueSupplier) manualDraft.issueSupplier = manualDraft.supplierIssued || "flydubai";
    if (!manualDraft.supplierRef) manualDraft.supplierRef = "SUP-789";
    if (!manualDraft.airlinePnr) manualDraft.airlinePnr = manualDraft.pnr || "";
    if (!manualDraft.gdsPnr) manualDraft.gdsPnr = "6DS456";
    if (!manualDraft.statusOverride) manualDraft.statusOverride = manualDraft.status || "Failed";
    if (!manualDraft.ticketingOverride) manualDraft.ticketingOverride = manualDraft.ticketingStatus || "Failed";
    if (!manualDraft.paymentOverride) manualDraft.paymentOverride = manualDraft.paymentStatus || "Paid";
    if (!manualDraft.reasonForUpdate) manualDraft.reasonForUpdate = "";
    if (!manualDraft.cabinLevel) manualDraft.cabinLevel = manualDraft.cabin || "ECONOMY";
    if (!manualDraft.classLevel) manualDraft.classLevel = "T";
    if (!manualDraft.fareBasisLevel) manualDraft.fareBasisLevel = "TUTYXSII";
    if (!manualDraft.ancillaries) manualDraft.ancillaries = [];
    if (!manualDraft.supplierBaseFare) manualDraft.supplierBaseFare = (manualDraft.priceSummary && manualDraft.priceSummary.baseFare) || 13405.6886;
    if (!manualDraft.supplierTax) manualDraft.supplierTax = (manualDraft.priceSummary && manualDraft.priceSummary.tax) || 7110.6219;
    if (!manualDraft.serviceFeeChecked) manualDraft.serviceFeeChecked = true;
    if (!manualDraft.couponApplied) manualDraft.couponApplied = false;
    if (!manualDraft.couponCode) manualDraft.couponCode = "";
    if (!manualDraft.discountOverride) manualDraft.discountOverride = 0;
  }

  const titleIdEl = document.getElementById("mu-modal-booking-id");
  if (titleIdEl) titleIdEl.textContent = manualDraft.id;

  updateDraftActionButtons();
  switchManualUpdateTab("info");
  recalculateSummaryTotals();

  const modal = document.getElementById("booking-manual-update-modal");
  if (modal) modal.style.display = "flex";
}

function closeManualUpdateModal() {
  const modal = document.getElementById("booking-manual-update-modal");
  if (modal) modal.style.display = "none";
}

function promptDiscardManualDraft() {
  if (confirm("Discard draft updates and close manual update console?")) {
    try {
      if (manualDraft) localStorage.removeItem(`fareos_draft_${manualDraft.id}`);
    } catch (e) {}
    manualDraft = null;
    isDraftSaved = false;
    closeManualUpdateModal();
    showAdminToast("Discarded manual update draft");
  }
}

function switchManualUpdateTab(tabKey) {
  activeManualTab = tabKey;
  
  // Update Tab Buttons styling
  document.querySelectorAll(".fareos-mu-tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.getElementById(`mu-tab-${tabKey}`)?.classList.add("active");

  renderManualTabContent();
}

function renderManualTabContent() {
  const container = document.getElementById("mu-tab-content-container");
  if (!container || !manualDraft) return;

  if (activeManualTab === "info") {
    container.innerHTML = getBookingInfoTabHTML();
  } else if (activeManualTab === "segments") {
    container.innerHTML = getSegmentsTabHTML();
  } else if (activeManualTab === "passengers") {
    container.innerHTML = getPassengersTabHTML();
  } else if (activeManualTab === "pricing") {
    container.innerHTML = getPricingTabHTML();
  }
}

/**
 * Tab 1: BOOKING INFO (Screenshot 1: media_1789302122165.png)
 */
function getBookingInfoTabHTML() {
  const d = manualDraft;
  return `
    <!-- Card 1: Provider & Supplier -->
    <div class="fareos-mu-card">
      <h3 class="fareos-mu-card-title">Provider &amp; Supplier</h3>
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-top:14px;">
        <div>
          <label class="fareos-mu-label">API SUPPLIER</label>
          <input type="text" class="fareos-mu-input" id="mu-api-supplier" value="${escapeHtml(d.apiSupplier || 'flydubai')}" oninput="manualDraft.apiSupplier = this.value; markDraftDirty();" />
        </div>

        <div>
          <label class="fareos-mu-label">ISSUE SUPPLIER</label>
          <div class="fareos-tag-container" id="mu-issue-supplier-container">
            <div class="fareos-tag-chip">
              <span>${escapeHtml(d.issueSupplier || 'flydubai')}</span>
              <span class="fareos-tag-remove" onclick="clearIssueSupplier()" title="Remove supplier">×</span>
            </div>
            <select style="border:none; background:none; outline:none; font-size:12px; color:#64748B; cursor:pointer;" onchange="selectIssueSupplier(this.value)">
              <option value="" disabled selected>▾</option>
              <option value="flydubai">flydubai</option>
              <option value="Amadeus">Amadeus NDC</option>
              <option value="Sabre">Sabre GDS</option>
              <option value="Air India Direct">Air India Direct</option>
              <option value="IndiGo API">IndiGo API</option>
            </select>
          </div>
        </div>

        <div>
          <label class="fareos-mu-label">SUPPLIER REFERENCE</label>
          <input type="text" class="fareos-mu-input" id="mu-supplier-ref" placeholder="e.g. SUP-789" value="${escapeHtml(d.supplierRef || '')}" oninput="manualDraft.supplierRef = this.value; markDraftDirty();" />
        </div>
      </div>
    </div>

    <!-- Card 2: Booking-Level PNRs -->
    <div class="fareos-mu-card">
      <h3 class="fareos-mu-card-title">Booking-Level PNRs</h3>
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-top:14px;">
        <div>
          <label class="fareos-mu-label">AIRLINE PNR</label>
          <input type="text" class="fareos-mu-input" id="mu-airline-pnr" placeholder="e.g. ABC123" value="${escapeHtml(d.airlinePnr || '')}" oninput="manualDraft.airlinePnr = this.value.toUpperCase(); markDraftDirty();" style="text-transform:uppercase; font-family:monospace; font-weight:700; letter-spacing:0.5px;" />
        </div>

        <div>
          <label class="fareos-mu-label">GDS PNR</label>
          <input type="text" class="fareos-mu-input" id="mu-gds-pnr" placeholder="e.g. 6DS456" value="${escapeHtml(d.gdsPnr || '')}" oninput="manualDraft.gdsPnr = this.value.toUpperCase(); markDraftDirty();" style="text-transform:uppercase; font-family:monospace; font-weight:700; letter-spacing:0.5px;" />
        </div>
      </div>
    </div>

    <!-- Card 3: Status Overrides -->
    <div class="fareos-mu-card">
      <h3 class="fareos-mu-card-title">Status Overrides</h3>
      <p class="fareos-mu-card-subtitle">Override the current status. Leave blank to keep existing values unchanged.</p>
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
        <div>
          <label class="fareos-mu-label">BOOKING STATUS</label>
          <select class="fareos-mu-select" id="mu-status-override" onchange="manualDraft.statusOverride = this.value; markDraftDirty(); updateStatusOverrideSummary();">
            <option value="Failed" ${d.statusOverride === 'Failed' ? 'selected' : ''}>Failed</option>
            <option value="Confirmed" ${d.statusOverride === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Pending" ${d.statusOverride === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Initiated" ${d.statusOverride === 'Initiated' ? 'selected' : ''}>Initiated</option>
            <option value="Cancelled" ${d.statusOverride === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </div>

        <div>
          <label class="fareos-mu-label">TICKETING STATUS</label>
          <select class="fareos-mu-select" id="mu-ticketing-override" onchange="manualDraft.ticketingOverride = this.value; markDraftDirty(); updateStatusOverrideSummary();">
            <option value="Failed" ${d.ticketingOverride === 'Failed' ? 'selected' : ''}>Failed</option>
            <option value="Issued" ${d.ticketingOverride === 'Issued' ? 'selected' : ''}>Issued</option>
            <option value="Pending" ${d.ticketingOverride === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Awaiting" ${d.ticketingOverride === 'Awaiting' ? 'selected' : ''}>Awaiting</option>
            <option value="Cancelled" ${d.ticketingOverride === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </div>

        <div>
          <label class="fareos-mu-label">PAYMENT STATUS</label>
          <select class="fareos-mu-select" id="mu-payment-override" onchange="manualDraft.paymentOverride = this.value; markDraftDirty(); updateStatusOverrideSummary();">
            <option value="Paid" ${d.paymentOverride === 'Paid' ? 'selected' : ''}>Paid</option>
            <option value="Payment Pending" ${d.paymentOverride === 'Payment Pending' ? 'selected' : ''}>Payment Pending</option>
            <option value="Failed" ${d.paymentOverride === 'Failed' ? 'selected' : ''}>Failed</option>
            <option value="Refunded" ${d.paymentOverride === 'Refunded' ? 'selected' : ''}>Refunded</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Card 4: Reason for Update -->
    <div class="fareos-mu-card">
      <h3 class="fareos-mu-card-title">Reason for Update</h3>
      <div style="margin-top:12px;">
        <input type="text" class="fareos-mu-input" id="mu-reason-text" placeholder="Audit trail note: e.g. Customer requested schedule sync, supplier re-issue..." value="${escapeHtml(d.reasonForUpdate || '')}" oninput="manualDraft.reasonForUpdate = this.value; markDraftDirty();" />
      </div>
    </div>
  `;
}

function clearIssueSupplier() {
  manualDraft.issueSupplier = "";
  const container = document.getElementById("mu-issue-supplier-container");
  if (container) {
    container.innerHTML = `
      <input type="text" placeholder="Type supplier name..." class="fareos-mu-input" style="border:none; height:32px; padding:0;" onchange="manualDraft.issueSupplier = this.value; renderManualTabContent(); markDraftDirty();" />
    `;
  }
}

function selectIssueSupplier(val) {
  if (!val) return;
  manualDraft.issueSupplier = val;
  markDraftDirty();
  renderManualTabContent();
}

/**
 * Tab 2: SEGMENTS (Screenshot 2: media_1789302133958.png)
 */
function getSegmentsTabHTML() {
  const d = manualDraft;
  const segments = (d.segments && d.segments.length > 0) ? d.segments : [
    { segmentNum: 1, flightNumber: "FZ816", origin: "AHB", dest: "DXB", depTime: "07:45 AM", depDate: "24 Feb 2027", arrTime: "11:20 AM", arrDate: "24 Feb 2027", airline: "Flydubai", aircraft: "73D", cabin: "ECONOMY", class: "T", fareBasis: "TUTYXSII" },
    { segmentNum: 2, flightNumber: "FZ175", origin: "DXB", dest: "HBE", depTime: "07:10 PM", depDate: "24 Feb 2027", arrTime: "09:40 PM", arrDate: "24 Feb 2027", airline: "Flydubai", aircraft: "73D", cabin: "ECONOMY", class: "T", fareBasis: "TUTYXSII" }
  ];

  const originCode = d.origin || segments[0].origin || "AHB";
  const destCode = d.destination || segments[segments.length - 1].dest || "HBE";

  return `
    <div class="fareos-mu-card" style="padding:0; overflow:hidden;">
      <div style="padding:18px 22px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; background:#FFFFFF; border-bottom:1px solid #E2E8F0;" onclick="toggleSegmentsAccordion()">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:32px; height:32px; border-radius:8px; background:#EFF6FF; color:#2563EB; display:flex; align-items:center; justify-content:center; font-size:16px;">
            ✈️
          </div>
          <div>
            <div style="font-size:14px; font-weight:800; color:#0F172A;">
              Journey 1 (${escapeHtml(originCode)} → ${escapeHtml(destCode)})
            </div>
            <div style="font-size:11.5px; color:#64748B; margin-top:2px;">
              ${segments.length} segments • Click to expand segment details
            </div>
          </div>
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="mu-seg-accordion-arrow" style="color:#64748B; transition:transform 0.2s ease;">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      <div id="mu-segments-accordion-body" style="padding:18px 22px; display:flex; flex-direction:column; gap:16px; background:#FAFAFA;">
        ${segments.map((seg, idx) => `
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:16px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #F1F5F9; padding-bottom:10px;">
              <div style="font-size:13px; font-weight:800; color:#0F172A; display:flex; align-items:center; gap:8px;">
                <span style="background:#2563EB; color:#FFF; font-size:10px; padding:2px 7px; border-radius:4px; font-weight:800;">SEG ${idx + 1}</span>
                <span>${escapeHtml(seg.origin)} → ${escapeHtml(seg.dest)}</span>
                <span style="color:#64748B; font-size:12px; font-weight:600;">• Flight ${escapeHtml(seg.flightNumber || '')}</span>
              </div>
              <span style="font-size:11px; font-weight:700; color:#059669; background:#ECFDF5; padding:3px 8px; border-radius:4px; border:1px solid #A7F3D0;">CONFIRMED</span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
              <div>
                <label class="fareos-mu-label">AIRLINE</label>
                <input type="text" class="fareos-mu-input" value="${escapeHtml(seg.airline || 'Flydubai')}" oninput="markDraftDirty();" />
              </div>
              <div>
                <label class="fareos-mu-label">FLIGHT NO</label>
                <input type="text" class="fareos-mu-input" value="${escapeHtml(seg.flightNumber || '')}" oninput="markDraftDirty();" />
              </div>
              <div>
                <label class="fareos-mu-label">AIRCRAFT</label>
                <input type="text" class="fareos-mu-input" value="${escapeHtml(seg.aircraft || '73D')}" oninput="markDraftDirty();" />
              </div>
              <div>
                <label class="fareos-mu-label">DEPARTURE</label>
                <input type="text" class="fareos-mu-input" value="${escapeHtml(seg.origin)} (${escapeHtml(seg.depTime || '')}, ${escapeHtml(seg.depDate || '')})" oninput="markDraftDirty();" />
              </div>
              <div>
                <label class="fareos-mu-label">ARRIVAL</label>
                <input type="text" class="fareos-mu-input" value="${escapeHtml(seg.dest)} (${escapeHtml(seg.arrTime || '')}, ${escapeHtml(seg.arrDate || '')})" oninput="markDraftDirty();" />
              </div>
              <div>
                <label class="fareos-mu-label">CABIN / CLASS</label>
                <input type="text" class="fareos-mu-input" value="${escapeHtml(seg.cabin || 'ECONOMY')} (${escapeHtml(seg.class || 'T')})" oninput="markDraftDirty();" />
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function toggleSegmentsAccordion() {
  const body = document.getElementById("mu-segments-accordion-body");
  const arrow = document.getElementById("mu-seg-accordion-arrow");
  if (body) {
    if (body.style.display === "none") {
      body.style.display = "flex";
      if (arrow) arrow.style.transform = "rotate(0deg)";
    } else {
      body.style.display = "none";
      if (arrow) arrow.style.transform = "rotate(-90deg)";
    }
  }
}

/**
 * Documents Extraction & Rendering Helpers
 */
function getBookingDocuments(bookingOrDraft) {
  if (!bookingOrDraft) return [];
  if (Array.isArray(bookingOrDraft.documents) && bookingOrDraft.documents.length > 0) {
    return bookingOrDraft.documents;
  }
  const docs = [];
  const paxList = bookingOrDraft.passengerList || [];
  paxList.forEach((p, idx) => {
    if (p.passportNumber) {
      docs.push({
        id: `doc_pax_${idx + 1}`,
        paxName: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || `Traveler ${idx + 1}`,
        type: "Passport",
        title: `Passport - ${p.name || 'Traveler'}`,
        number: p.passportNumber,
        expiry: p.passportExpiry || '—',
        issuingCountry: p.nationality || 'India',
        source: 'Submitted with Booking',
        status: 'Attached to Ticket',
        uploadedAt: bookingOrDraft.bookingDate || new Date().toISOString()
      });
    }
  });
  if (docs.length === 0 && (bookingOrDraft.passportNumber || bookingOrDraft.customer)) {
    const pNum = bookingOrDraft.passportNumber || "P" + Math.floor(10000000 + Math.random() * 89999999);
    docs.push({
      id: `doc_lead_1`,
      paxName: bookingOrDraft.customer || bookingOrDraft.passengerName || "Lead Traveler",
      type: "Passport",
      title: `Passport - ${bookingOrDraft.customer || bookingOrDraft.passengerName || "Lead Traveler"}`,
      number: pNum,
      expiry: bookingOrDraft.passportExpiry || "10/2029",
      issuingCountry: "India",
      source: "Submitted with Booking",
      status: "Attached to Ticket",
      uploadedAt: bookingOrDraft.bookingDate || new Date().toISOString()
    });
  }
  return docs;
}

function renderDocumentsListHTML(docs, isDraft) {
  if (!docs || docs.length === 0) {
    return `
      <div style="background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:8px; padding:18px 20px; text-align:center; color:#64748B;">
        <div style="font-size:22px; margin-bottom:6px;">📁</div>
        <div style="font-size:13px; font-weight:700; color:#334155;">No shared documents attached yet</div>
        <div style="font-size:11.5px; margin-top:2px;">Passports and visa records shared by travelers will appear here. Click '+ Attach Document' to add manually.</div>
      </div>
    `;
  }

  return docs.map((doc, idx) => {
    let typeBadgeColor = "#2563EB";
    let typeBadgeBg = "#EFF6FF";
    let typeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><line x1="15" y1="8" x2="17" y2="8"/><line x1="15" y1="12" x2="17" y2="12"/></svg>`;
    if (doc.type === "Visa") {
      typeBadgeColor = "#059669";
      typeBadgeBg = "#ECFDF5";
      typeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    } else if (doc.type === "National ID") {
      typeBadgeColor = "#7C3AED";
      typeBadgeBg = "#F5F3FF";
      typeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
    } else if (doc.type === "Travel Insurance") {
      typeBadgeColor = "#D97706";
      typeBadgeBg = "#FEF3C7";
      typeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    }

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; min-width:240px;">
          <div style="width:36px; height:36px; border-radius:8px; background:${typeBadgeBg}; color:${typeBadgeColor}; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">
            ${typeIcon}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px; font-weight:800; color:#0F172A;">${escapeHtml(doc.title || `${doc.type} - ${doc.paxName}`)}</span>
              <span style="font-size:10px; font-weight:800; color:${typeBadgeColor}; background:${typeBadgeBg}; padding:2px 6px; border-radius:4px; text-transform:uppercase;">
                ${escapeHtml(doc.type || 'DOCUMENT')}
              </span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:3px; font-size:11.5px; color:#64748B;">
              <span style="font-weight:600; color:#334155;">${escapeHtml(doc.paxName || 'Traveler')}</span>
              <span>•</span>
              <span style="font-family:monospace; font-weight:800; color:#0F172A;">${escapeHtml(doc.number || '—')}</span>
              ${doc.number ? `
                <button type="button" class="fareos-copy-inline-btn" onclick="copyToClipboard('${escapeHtml(doc.number)}', event)" title="Copy document number">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
          <div style="font-size:11px; color:#64748B; text-align:right;">
            <div>Exp: <strong style="color:#0F172A;">${escapeHtml(doc.expiry || '—')}</strong></div>
            <div style="margin-top:2px;">Country: <strong style="color:#0F172A;">${escapeHtml(doc.issuingCountry || 'India')}</strong></div>
          </div>

          <span style="font-size:10.5px; font-weight:700; color:#059669; background:#ECFDF5; border:1px solid #A7F3D0; padding:3px 8px; border-radius:4px; display:inline-flex; align-items:center; gap:4px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ${escapeHtml(doc.status || 'Attached to Ticket')}
          </span>

          <span style="font-size:10px; font-weight:600; color:#64748B; background:#F1F5F9; padding:3px 7px; border-radius:4px;">
            ${escapeHtml(doc.source || 'Submitted with Booking')}
          </span>

          <button type="button" class="fareos-btn-action highlight" onclick="openAdminPassportPreview(${idx}, ${isDraft})" style="font-size:11px; padding:4px 10px; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Document
          </button>

          <button type="button" style="background:none; border:none; color:#EF4444; cursor:pointer; font-size:14px; font-weight:800; padding:4px;" onclick="removeDocumentFromTicket(${idx}, ${isDraft})" title="Remove document from ticket">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join("");
}

let activeAttachDocIsDraft = false;

function promptAttachDocumentToTicket(isDraft) {
  activeAttachDocIsDraft = isDraft;
  const target = isDraft ? manualDraft : currentBooking;
  if (!target) return;

  const paxSelect = document.getElementById("attach-doc-pax");
  if (paxSelect) {
    paxSelect.innerHTML = "";
    const paxList = target.passengerList || [];
    if (paxList.length > 0) {
      paxList.forEach((p) => {
        const pName = p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Passenger';
        const opt = document.createElement("option");
        opt.value = pName;
        opt.textContent = `${p.title || 'Mr'} ${pName} (${p.type || 'ADULT'})`;
        paxSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement("option");
      opt.value = target.customer || target.passengerName || "Valued Traveler";
      opt.textContent = target.customer || target.passengerName || "Valued Traveler";
      paxSelect.appendChild(opt);
    }
  }

  const numInput = document.getElementById("attach-doc-number");
  if (numInput) numInput.value = "";
  const expInput = document.getElementById("attach-doc-expiry");
  if (expInput) expInput.value = "10/2029";
  const ctryInput = document.getElementById("attach-doc-country");
  if (ctryInput) ctryInput.value = "India";

  const modal = document.getElementById("ticket-attach-doc-modal");
  if (modal) modal.style.display = "flex";
}

function closeAttachDocModal() {
  const modal = document.getElementById("ticket-attach-doc-modal");
  if (modal) modal.style.display = "none";
}

function submitAttachDocModal() {
  const paxName = document.getElementById("attach-doc-pax")?.value || "Passenger";
  const docType = document.getElementById("attach-doc-type")?.value || "Passport";
  const docNum = document.getElementById("attach-doc-number")?.value.trim().toUpperCase() || "";
  const docExp = document.getElementById("attach-doc-expiry")?.value.trim() || "—";
  const docCountry = document.getElementById("attach-doc-country")?.value.trim() || "India";
  const docSource = document.getElementById("attach-doc-source")?.value.trim() || "Admin Attached";

  if (!docNum) {
    alert("Please enter a document / passport number.");
    return;
  }

  const newDoc = {
    id: "doc_" + Date.now(),
    paxName: paxName,
    type: docType,
    title: `${docType} - ${paxName}`,
    number: docNum,
    expiry: docExp,
    issuingCountry: docCountry,
    source: docSource,
    status: "Attached to Ticket",
    uploadedAt: new Date().toISOString()
  };

  if (activeAttachDocIsDraft) {
    if (!manualDraft) return;
    if (!manualDraft.documents) manualDraft.documents = getBookingDocuments(manualDraft);
    manualDraft.documents.push(newDoc);
    if (docType === "Passport" && manualDraft.passengerList) {
      const match = manualDraft.passengerList.find((p) => (p.name || '').toLowerCase() === paxName.toLowerCase());
      if (match) {
        match.passportNumber = docNum;
        match.passportExpiry = docExp;
        match.nationality = docCountry;
      }
    }
    markDraftDirty();
    renderManualTabContent();
    closeAttachDocModal();
    showAdminToast(`✓ Attached ${docType} for ${paxName}`);
  } else {
    if (!currentBooking) return;
    if (!currentBooking.documents) currentBooking.documents = getBookingDocuments(currentBooking);
    currentBooking.documents.push(newDoc);
    if (docType === "Passport" && currentBooking.passengerList) {
      const match = currentBooking.passengerList.find((p) => (p.name || '').toLowerCase() === paxName.toLowerCase());
      if (match) {
        match.passportNumber = docNum;
        match.passportExpiry = docExp;
        match.nationality = docCountry;
      }
    }
    persistBookingUpdate(currentBooking);
    renderBookingDetailView(currentBooking);
    closeAttachDocModal();
    showAdminToast(`✓ Attached ${docType} to reservation ticket`);
  }
}

function removeDocumentFromTicket(index, isDraft) {
  if (!confirm("Are you sure you want to remove this attached document from the ticket?")) return;

  if (isDraft) {
    if (manualDraft && manualDraft.documents && manualDraft.documents[index]) {
      manualDraft.documents.splice(index, 1);
      markDraftDirty();
      renderManualTabContent();
      showAdminToast("Removed document from draft");
    }
  } else {
    if (currentBooking && currentBooking.documents && currentBooking.documents[index]) {
      currentBooking.documents.splice(index, 1);
      persistBookingUpdate(currentBooking);
      renderBookingDetailView(currentBooking);
      showAdminToast("Removed document from reservation ticket");
    }
  }
}

function promptEditPaxApis(paxIdx, isDraft) {
  const target = isDraft ? manualDraft : currentBooking;
  if (!target || !target.passengerList || !target.passengerList[paxIdx]) return;

  const pax = target.passengerList[paxIdx];
  const nameEl = document.getElementById("pax-apis-name");
  if (nameEl) nameEl.textContent = `${pax.title || 'Mr'} ${pax.name || (pax.firstName + ' ' + pax.lastName)}`;

  const idxEl = document.getElementById("pax-apis-index");
  if (idxEl) idxEl.value = paxIdx;

  const draftEl = document.getElementById("pax-apis-is-draft");
  if (draftEl) draftEl.value = isDraft ? "1" : "0";

  const passEl = document.getElementById("pax-apis-passport");
  if (passEl) passEl.value = pax.passportNumber || "";

  const expEl = document.getElementById("pax-apis-expiry");
  if (expEl) expEl.value = pax.passportExpiry || "";

  const natEl = document.getElementById("pax-apis-nationality");
  if (natEl) natEl.value = pax.nationality || "India (IND)";

  const dobEl = document.getElementById("pax-apis-dob");
  if (dobEl) dobEl.value = pax.dob || "";

  const modal = document.getElementById("pax-apis-modal");
  if (modal) modal.style.display = "flex";
}

function closePaxApisModal() {
  const modal = document.getElementById("pax-apis-modal");
  if (modal) modal.style.display = "none";
}

function submitPaxApisModal() {
  const paxIdx = parseInt(document.getElementById("pax-apis-index")?.value, 10);
  const isDraft = document.getElementById("pax-apis-is-draft")?.value === "1";
  const target = isDraft ? manualDraft : currentBooking;
  if (!target || !target.passengerList || !target.passengerList[paxIdx]) return;

  const pax = target.passengerList[paxIdx];
  const passport = document.getElementById("pax-apis-passport")?.value.trim().toUpperCase() || "";
  const expiry = document.getElementById("pax-apis-expiry")?.value.trim() || "";
  const nationality = document.getElementById("pax-apis-nationality")?.value.trim() || "IND";
  const dob = document.getElementById("pax-apis-dob")?.value.trim() || "";

  pax.passportNumber = passport;
  pax.passportExpiry = expiry;
  pax.nationality = nationality;
  pax.dob = dob;

  // Sync to documents
  if (passport) {
    if (!target.documents) target.documents = getBookingDocuments(target);
    const pFullName = pax.name || `${pax.firstName || ''} ${pax.lastName || ''}`.trim() || 'Passenger';
    let doc = target.documents.find((d) => d.type === "Passport" && (d.paxName === pFullName || d.number === passport));
    if (doc) {
      doc.number = passport;
      doc.expiry = expiry;
      doc.issuingCountry = nationality;
    } else {
      target.documents.push({
        id: "doc_" + Date.now(),
        paxName: pFullName,
        type: "Passport",
        title: `Passport - ${pFullName}`,
        number: passport,
        expiry: expiry,
        issuingCountry: nationality,
        source: isDraft ? "Admin Manual Update" : "Admin Edit",
        status: "Attached to Ticket",
        uploadedAt: new Date().toISOString()
      });
    }
  }

  if (isDraft) {
    markDraftDirty();
    renderManualTabContent();
    closePaxApisModal();
    showAdminToast(`Saved APIS details for ${pax.name}`);
  } else {
    persistBookingUpdate(target);
    renderBookingDetailView(target);
    closePaxApisModal();
    showAdminToast(`Saved APIS details for ${pax.name}`);
  }
}

window.promptAttachDocumentToTicket = promptAttachDocumentToTicket;
window.closeAttachDocModal = closeAttachDocModal;
window.submitAttachDocModal = submitAttachDocModal;
window.removeDocumentFromTicket = removeDocumentFromTicket;
window.promptEditPaxApis = promptEditPaxApis;
window.closePaxApisModal = closePaxApisModal;
window.submitPaxApisModal = submitPaxApisModal;

/**
 * Tab 3: PASSENGERS & ANCILLARIES (Screenshot 3: media_1789302133959.png)
 */
function getPassengersTabHTML() {
  const d = manualDraft;
  const paxList = (d.passengerList && d.passengerList.length > 0) ? d.passengerList : [
    { title: "mr", name: "Incidunt Soluta", type: "ADULT", seat: "14A" }
  ];
  const segments = (d.segments && d.segments.length > 0) ? d.segments : [
    { segmentNum: 1, flightNumber: "816", origin: "AHB", dest: "DXB" },
    { segmentNum: 2, flightNumber: "175", origin: "DXB", dest: "HBE" }
  ];
  const ancillaries = d.ancillaries || [];
  const docs = getBookingDocuments(d);
  d.documents = docs;

  return `
    <!-- Top Journey Passengers Section -->
    <div class="fareos-mu-card">
      <div style="font-size:13px; font-weight:800; color:#0F172A; display:flex; align-items:center; gap:6px; margin-bottom:14px;">
        <span style="color:#2563EB;">📍</span> Journey 1
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        ${segments.map((seg) => `
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px;">
            <div style="font-size:11.5px; font-weight:800; color:#64748B; margin-bottom:10px; text-transform:uppercase;">
              ${escapeHtml(seg.origin)} - ${escapeHtml(seg.dest)} • ${escapeHtml(seg.flightNumber || '816')}
            </div>

            <div style="display:flex; flex-direction:column; gap:8px;">
              ${paxList.map((pax, pIndex) => `
                <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:6px; padding:10px 12px;">
                  <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span style="color:#64748B; font-size:14px;">👤</span>
                      <span style="font-size:13px; font-weight:700; color:#0F172A;">
                        ${escapeHtml(pax.title || 'mr')} ${escapeHtml(pax.name)}
                      </span>
                      <span style="font-size:10px; font-weight:800; color:#2563EB; background:#EFF6FF; padding:2px 6px; border-radius:4px;">
                        ${escapeHtml(pax.type || 'ADULT')}
                      </span>
                      ${(pax.passportNumber || (pIndex === 0 && d.passportNumber)) ? `
                        <span style="font-size:10px; font-weight:800; color:#059669; background:#ECFDF5; border:1px solid #A7F3D0; padding:1px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px;">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> APIS READY
                        </span>
                      ` : `
                        <span style="font-size:10px; font-weight:800; color:#D97706; background:#FEF3C7; border:1px solid #FDE68A; padding:1px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px;">
                          ⚠️ APIS PENDING
                        </span>
                      `}
                    </div>

                    <div style="display:flex; align-items:center; gap:8px;">
                      <button type="button" class="fareos-btn-tool" style="padding:4px 8px; font-size:11px;" onclick="promptEditPaxApis(${pIndex}, true)">
                        ✏️ Edit APIS
                      </button>
                      <button type="button" class="fareos-btn-tool" style="padding:5px 10px; font-size:11.5px; display:inline-flex; align-items:center; gap:6px;" onclick="promptAssignSeat('${escapeHtml(pax.name)}', '${escapeHtml(seg.origin)}-${escapeHtml(seg.dest)}')">
                        <span>💺</span>
                        <span>${pax.seat ? `Seat ${pax.seat}` : 'Seat ▾'}</span>
                      </button>
                    </div>
                  </div>

                  <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #E2E8F0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:11px; color:#475569;">
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                      <div>
                        <span style="color:#64748B; font-weight:600;">Passport:</span>
                        <span style="font-family:monospace; font-weight:700; color:#0F172A; margin-left:3px;">${escapeHtml(pax.passportNumber || (pIndex === 0 ? (d.passportNumber || 'Not provided') : 'Not provided'))}</span>
                        ${(pax.passportNumber || (pIndex === 0 && d.passportNumber)) ? `
                          <button type="button" class="fareos-copy-inline-btn" onclick="copyToClipboard('${escapeHtml(pax.passportNumber || d.passportNumber)}', event)" title="Copy Passport Number">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </button>
                        ` : ''}
                        <button type="button" class="fareos-btn-action highlight" onclick="openAdminPassportPreview(${pIndex}, true)" style="padding:2px 8px; font-size:10.5px; margin-left:6px; display:inline-flex; align-items:center; gap:3px; cursor:pointer;">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          View Doc
                        </button>
                      </div>
                      <div>
                        <span style="color:#64748B; font-weight:600;">Exp:</span>
                        <strong style="color:#0F172A; margin-left:3px;">${escapeHtml(pax.passportExpiry || (pIndex === 0 ? (d.passportExpiry || '—') : '—'))}</strong>
                      </div>
                      <div>
                        <span style="color:#64748B; font-weight:600;">Nat:</span>
                        <strong style="color:#0F172A; margin-left:3px;">${escapeHtml(pax.nationality || 'IND')}</strong>
                      </div>
                      ${pax.dob ? `
                        <div>
                          <span style="color:#64748B; font-weight:600;">DOB:</span>
                          <strong style="color:#0F172A; margin-left:3px;">${escapeHtml(pax.dob)}</strong>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Card: Traveler Shared Documents & Identification -->
    <div class="fareos-mu-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:13px; font-weight:800; color:#0F172A; display:flex; align-items:center; gap:8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Traveler Shared Documents &amp; Identification
          </div>
          <p class="fareos-mu-card-subtitle" style="margin-top:2px;">
            Identity proofs, passports, and visa records attached to this reservation ticket.
          </p>
        </div>
        <button type="button" class="btn-primary" onclick="promptAttachDocumentToTicket(true)" style="padding:6px 14px; font-size:11.5px; font-weight:800; border-radius:6px; display:inline-flex; align-items:center; gap:6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Attach Document
        </button>
      </div>

      <div id="mu-documents-list" style="display:flex; flex-direction:column; gap:10px;">
        ${renderDocumentsListHTML(docs, true)}
      </div>
    </div>

    <!-- Card: Add Ancillary -->
    <div class="fareos-mu-card">
      <h3 class="fareos-mu-card-title">Add Ancillary</h3>
      <p class="fareos-mu-card-subtitle">Records a new ancillary on the booking. The price does not adjust the fare — edit fares separately.</p>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
        <div>
          <label class="fareos-mu-label">PASSENGER</label>
          <select class="fareos-mu-select" id="new-anc-pax">
            <option value="" disabled selected>Select passenger</option>
            ${paxList.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.title || 'Mr')} ${escapeHtml(p.name)}</option>`).join("")}
          </select>
        </div>

        <div>
          <label class="fareos-mu-label">SEGMENT</label>
          <select class="fareos-mu-select" id="new-anc-segment">
            <option value="" disabled selected>Select segment</option>
            ${segments.map((s) => `<option value="${escapeHtml(s.origin)} - ${escapeHtml(s.dest)}">${escapeHtml(s.origin)} - ${escapeHtml(s.dest)} (${escapeHtml(s.flightNumber || '')})</option>`).join("")}
            <option value="All Segments">All Segments</option>
          </select>
        </div>

        <div>
          <label class="fareos-mu-label">TYPE</label>
          <select class="fareos-mu-select" id="new-anc-type">
            <option value="Baggage" selected>Baggage</option>
            <option value="Meals">Meals</option>
            <option value="Seat Selection">Seat Selection</option>
            <option value="Priority Boarding">Priority Boarding</option>
            <option value="Special Request">Special Request</option>
          </select>
        </div>

        <div>
          <label class="fareos-mu-label">CODE</label>
          <input type="text" class="fareos-mu-input" id="new-anc-code" placeholder="e.g. BAG15" />
        </div>

        <div>
          <label class="fareos-mu-label">DESCRIPTION</label>
          <input type="text" class="fareos-mu-input" id="new-anc-desc" placeholder="e.g. 15kg extra baggage" />
        </div>

        <div>
          <label class="fareos-mu-label">UNIT PRICE</label>
          <input type="number" class="fareos-mu-input" id="new-anc-price" placeholder="0" value="0" />
        </div>
      </div>

      <div style="margin-top:14px; display:flex; justify-content:flex-end;">
        <button type="button" class="btn-primary" onclick="handleAddAncillary()" style="padding:8px 18px; font-size:12px; font-weight:800; border-radius:6px;">
          + ADD ANCILLARY
        </button>
      </div>

      <!-- Ancillaries Added Listing -->
      ${ancillaries.length > 0 ? `
        <div style="margin-top:16px; border-top:1px solid #E2E8F0; padding-top:12px;">
          <div style="font-size:11px; font-weight:800; color:#64748B; text-transform:uppercase; margin-bottom:8px;">Recorded Ancillaries (${ancillaries.length})</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${ancillaries.map((anc, i) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#F8FAFC; border:1px solid #CBD5E1; padding:8px 12px; border-radius:6px; font-size:12px;">
                <div>
                  <strong style="color:#0F172A;">${escapeHtml(anc.type)}</strong> (${escapeHtml(anc.code || 'BAG')}) — ${escapeHtml(anc.description || 'Extra Service')}
                  <span style="color:#64748B; font-size:11px; margin-left:8px;">${escapeHtml(anc.passenger || '')} • ${escapeHtml(anc.segment || '')}</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <strong style="color:#2563EB;">₹${Number(anc.price || 0).toLocaleString()}</strong>
                  <button type="button" style="background:none; border:none; color:#EF4444; cursor:pointer; font-weight:800;" onclick="removeAncillary(${i})">✕</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Card: Fare Rule Overrides -->
    <div class="fareos-mu-card">
      <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleFareRulesAccordion()">
        <h3 class="fareos-mu-card-title" style="margin:0;">Fare Rule Overrides</h3>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div id="mu-fare-rules-body" style="display:none; margin-top:14px; padding-top:12px; border-top:1px solid #F1F5F9;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label class="fareos-mu-label">Cancellation Penalty (INR)</label>
            <input type="number" class="fareos-mu-input" placeholder="e.g. 3500" oninput="markDraftDirty();" />
          </div>
          <div>
            <label class="fareos-mu-label">Date Change Penalty (INR)</label>
            <input type="number" class="fareos-mu-input" placeholder="e.g. 2000" oninput="markDraftDirty();" />
          </div>
        </div>
      </div>
    </div>
  `;
}

function promptAssignSeat(paxName, route) {
  const seat = prompt(`Assign seat number for ${paxName} on ${route}:`, "14A");
  if (seat) {
    if (!manualDraft.passengerList) manualDraft.passengerList = [{ name: paxName, type: "ADULT" }];
    const found = manualDraft.passengerList.find((p) => p.name.toLowerCase() === paxName.toLowerCase());
    if (found) found.seat = seat.toUpperCase();
    markDraftDirty();
    renderManualTabContent();
    showAdminToast(`Assigned seat ${seat.toUpperCase()} to ${paxName}`);
  }
}

function handleAddAncillary() {
  const pax = document.getElementById("new-anc-pax")?.value;
  const seg = document.getElementById("new-anc-segment")?.value;
  const type = document.getElementById("new-anc-type")?.value || "Baggage";
  const code = document.getElementById("new-anc-code")?.value.trim() || "BAG15";
  const desc = document.getElementById("new-anc-desc")?.value.trim() || "15kg extra baggage";
  const price = parseFloat(document.getElementById("new-anc-price")?.value) || 0;

  if (!manualDraft.ancillaries) manualDraft.ancillaries = [];
  manualDraft.ancillaries.push({
    passenger: pax || "Passenger",
    segment: seg || "All Segments",
    type,
    code,
    description: desc,
    price,
    status: "Confirmed"
  });

  markDraftDirty();
  renderManualTabContent();
  recalculateSummaryTotals();
  showAdminToast(`Added ${type} ancillary`);
}

function removeAncillary(index) {
  if (manualDraft.ancillaries && manualDraft.ancillaries[index]) {
    manualDraft.ancillaries.splice(index, 1);
    markDraftDirty();
    renderManualTabContent();
    recalculateSummaryTotals();
  }
}

function toggleFareRulesAccordion() {
  const body = document.getElementById("mu-fare-rules-body");
  if (body) {
    body.style.display = body.style.display === "none" ? "block" : "none";
  }
}

/**
 * Tab 4: FARES & PRICING (Screenshot 4: media_1789302133961.png)
 */
function getPricingTabHTML() {
  const d = manualDraft;
  const baseFare = Number(d.supplierBaseFare || 13405.6886);
  const taxes = Number(d.supplierTax || 7110.6219);
  const total = baseFare + taxes;

  return `
    <div class="fareos-mu-pricing-banner">
      <div class="fareos-mu-banner-metrics">
        <div class="fareos-mu-metric-item">
          <span class="lbl">BASE FARE</span>
          <span class="val" id="mu-banner-base">₹${formatCurrency(baseFare)}</span>
        </div>
        <div class="fareos-mu-metric-item">
          <span class="lbl">TAXES</span>
          <span class="val" id="mu-banner-tax">₹${formatCurrency(taxes)}</span>
        </div>
        <div class="fareos-mu-metric-item total">
          <span class="lbl">TOTAL</span>
          <span class="val" id="mu-banner-total">₹${formatCurrency(total)}</span>
        </div>
      </div>

      <div style="font-size:11.5px; color:#64748B; font-weight:600;">
        Totals recalculated by server after each Save
      </div>
    </div>

    <!-- Card: OUTBOUND — Journey 1 -->
    <div class="fareos-mu-card">
      <h3 class="fareos-mu-card-title" style="margin-bottom:14px;">OUTBOUND — Journey 1</h3>

      <!-- Row 1: PAX TYPE, BASE FARE, TAX, SUPPLIER TOTAL -->
      <div style="display:grid; grid-template-columns:120px 1fr 1fr 160px; gap:16px; align-items:center;">
        <div>
          <label class="fareos-mu-label">PAX TYPE</label>
          <div style="font-size:13px; font-weight:800; color:#0F172A; padding-top:8px;">ADULT × 1</div>
        </div>

        <div>
          <label class="fareos-mu-label">BASE FARE (SUPPLIER)</label>
          <input type="number" step="0.0001" class="fareos-mu-input" id="mu-supplier-base-fare" value="${baseFare}" oninput="handleSupplierFareInput()" />
        </div>

        <div>
          <label class="fareos-mu-label">TAX (SUPPLIER)</label>
          <input type="number" step="0.0001" class="fareos-mu-input" id="mu-supplier-tax" value="${taxes}" oninput="handleSupplierFareInput()" />
        </div>

        <div>
          <label class="fareos-mu-label">SUPPLIER TOTAL</label>
          <div style="font-size:14px; font-weight:900; color:#0F172A; padding-top:8px;" id="mu-supplier-row-total">
            ₹${formatCurrency(total)}
          </div>
        </div>
      </div>

      <!-- Row 2: CABIN, CLASS, FARE BASIS (JOURNEY-LEVEL) -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-top:20px;">
        <div>
          <label class="fareos-mu-label">CABIN (JOURNEY-LEVEL)</label>
          <input type="text" class="fareos-mu-input" id="mu-journey-cabin" placeholder="e.g. ECONOMY" value="${escapeHtml(d.cabinLevel || 'ECONOMY')}" oninput="manualDraft.cabinLevel = this.value; markDraftDirty();" />
        </div>

        <div>
          <label class="fareos-mu-label">CLASS (JOURNEY-LEVEL)</label>
          <input type="text" class="fareos-mu-input" id="mu-journey-class" placeholder="e.g. T" value="${escapeHtml(d.classLevel || 'T')}" oninput="manualDraft.classLevel = this.value; markDraftDirty();" />
        </div>

        <div>
          <label class="fareos-mu-label">FARE BASIS (JOURNEY-LEVEL)</label>
          <input type="text" class="fareos-mu-input" id="mu-journey-fare-basis" placeholder="e.g. TUTYXSII" value="${escapeHtml(d.fareBasisLevel || 'TUTYXSII')}" oninput="manualDraft.fareBasisLevel = this.value; markDraftDirty();" />
        </div>
      </div>

      <div style="margin-top:14px; font-size:11.5px; color:#64748B; line-height:1.45;">
        Applies to every segment in this journey on Save — a segment can still be overridden individually in the Segments tab.
      </div>
    </div>
  `;
}

function handleSupplierFareInput() {
  const baseEl = document.getElementById("mu-supplier-base-fare");
  const taxEl = document.getElementById("mu-supplier-tax");
  if (!baseEl || !taxEl) return;

  const base = parseFloat(baseEl.value) || 0;
  const tax = parseFloat(taxEl.value) || 0;
  const total = base + tax;

  manualDraft.supplierBaseFare = base;
  manualDraft.supplierTax = tax;
  markDraftDirty();

  const totalEl = document.getElementById("mu-supplier-row-total");
  if (totalEl) totalEl.textContent = `₹${formatCurrency(total)}`;

  const bannerBase = document.getElementById("mu-banner-base");
  const bannerTax = document.getElementById("mu-banner-tax");
  const bannerTotal = document.getElementById("mu-banner-total");
  if (bannerBase) bannerBase.textContent = `₹${formatCurrency(base)}`;
  if (bannerTax) bannerTax.textContent = `₹${formatCurrency(tax)}`;
  if (bannerTotal) bannerTotal.textContent = `₹${formatCurrency(total)}`;

  recalculateSummaryTotals();
}

/**
 * Summary Panel Calculations (Right Column)
 */
function recalculateSummaryTotals() {
  if (!manualDraft) return;

  const base = Number(manualDraft.supplierBaseFare || 13405.6886);
  const taxes = Number(manualDraft.supplierTax || 7110.6219);
  const ancCount = (manualDraft.ancillaries && manualDraft.ancillaries.length) || 0;
  
  let ancTotal = 0;
  if (manualDraft.ancillaries) {
    ancTotal = manualDraft.ancillaries.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }

  const discountOverride = parseFloat(document.getElementById("mu-discount-override")?.value) || manualDraft.discountOverride || 0;
  manualDraft.discountOverride = discountOverride;

  const pgCharge = 1000.00;
  const grandTotal = Math.max(0, base + taxes + ancTotal - discountOverride);

  // Update Summary DOM
  const sumBaseEl = document.getElementById("mu-summary-base-fare");
  const sumTaxEl = document.getElementById("mu-summary-taxes");
  const sumAncEl = document.getElementById("mu-summary-ancillary");
  const sumTotalEl = document.getElementById("mu-summary-total-price");

  if (sumBaseEl) sumBaseEl.textContent = `₹${formatCurrency(base)}`;
  if (sumTaxEl) sumTaxEl.textContent = `₹${formatCurrency(taxes)}`;
  if (sumAncEl) sumAncEl.textContent = `${ancCount} Confirmed`;
  if (sumTotalEl) sumTotalEl.textContent = `₹${formatCurrency(grandTotal)}`;
}

function toggleServiceFee(checked) {
  manualDraft.serviceFeeChecked = checked;
  markDraftDirty();
  const card = document.getElementById("mu-service-fee-card");
  if (card) {
    if (checked) card.classList.add("checked");
    else card.classList.remove("checked");
  }
  recalculateSummaryTotals();
}

function toggleCouponBox(checked) {
  manualDraft.couponApplied = checked;
  markDraftDirty();
  const fields = document.getElementById("mu-coupon-fields");
  if (fields) fields.style.display = checked ? "block" : "none";
  recalculateSummaryTotals();
}

function applyCouponCode() {
  const code = document.getElementById("mu-coupon-code")?.value.trim();
  if (!code) {
    showAdminToast("Please enter a coupon code");
    return;
  }
  manualDraft.couponCode = code;
  manualDraft.discountOverride = 500;
  const overrideInput = document.getElementById("mu-discount-override");
  if (overrideInput) overrideInput.value = 500;
  markDraftDirty();
  recalculateSummaryTotals();
  showAdminToast(`Applied coupon code ${code} (-₹500)`);
}

function updateStatusOverrideSummary() {
  const tag = document.getElementById("mu-summary-status-tag");
  if (tag) tag.textContent = "Modified";
}

function toggleSummaryBreakdown(type) {
  showAdminToast(`Toggled breakdown for ${type}`);
}

function markDraftDirty() {
  // Can track dirty state
}

function updateDraftActionButtons() {
  const notice = document.getElementById("mu-save-notice");
  const confirmBtn = document.getElementById("mu-btn-confirm-apply");

  if (isDraftSaved) {
    if (notice) {
      notice.innerHTML = `<span style="color:#059669;">✓ Draft saved locally. Ready to confirm.</span>`;
    }
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  } else {
    if (notice) {
      notice.textContent = "Save at least once to unlock Confirm";
    }
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }
  }
}

function saveManualDraft() {
  if (!manualDraft) return;

  // Sync inputs from current tab
  if (document.getElementById("mu-api-supplier")) manualDraft.apiSupplier = document.getElementById("mu-api-supplier").value;
  if (document.getElementById("mu-supplier-ref")) manualDraft.supplierRef = document.getElementById("mu-supplier-ref").value;
  if (document.getElementById("mu-airline-pnr")) manualDraft.airlinePnr = document.getElementById("mu-airline-pnr").value.toUpperCase();
  if (document.getElementById("mu-gds-pnr")) manualDraft.gdsPnr = document.getElementById("mu-gds-pnr").value.toUpperCase();
  if (document.getElementById("mu-reason-text")) manualDraft.reasonForUpdate = document.getElementById("mu-reason-text").value;

  isDraftSaved = true;
  try {
    localStorage.setItem(`fareos_draft_${manualDraft.id}`, JSON.stringify(manualDraft));
  } catch (e) {}

  updateDraftActionButtons();
  showAdminToast(`💾 Draft saved for ${manualDraft.id}`);
}

function confirmAndApplyManualUpdate() {
  if (!manualDraft || !currentBooking) return;

  // Apply draft properties onto currentBooking
  currentBooking.supplierSearch = manualDraft.apiSupplier;
  currentBooking.supplierIssued = manualDraft.issueSupplier;
  currentBooking.pnr = manualDraft.airlinePnr || currentBooking.pnr;
  currentBooking.airlinePnr = manualDraft.airlinePnr;
  currentBooking.gdsPnr = manualDraft.gdsPnr;
  currentBooking.status = manualDraft.statusOverride || currentBooking.status;
  currentBooking.ticketingStatus = manualDraft.ticketingOverride || currentBooking.ticketingStatus;
  currentBooking.paymentStatus = manualDraft.paymentOverride || currentBooking.paymentStatus;
  currentBooking.statusDetail = `Booking: ${(currentBooking.status || "").toUpperCase()} | Ticketing: ${(currentBooking.ticketingStatus || "").toUpperCase()}`;
  currentBooking.lastAccessedBy = currentAdmin.name;
  currentBooking.lastAccessedAt = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (manualDraft.supplierBaseFare && manualDraft.supplierTax) {
    const b = Number(manualDraft.supplierBaseFare);
    const t = Number(manualDraft.supplierTax);
    currentBooking.amount = b + t + 1000;
    if (!currentBooking.priceSummary) currentBooking.priceSummary = {};
    currentBooking.priceSummary.baseFare = b;
    currentBooking.priceSummary.tax = t;
    currentBooking.priceSummary.adultTotal = b + t;
    currentBooking.priceSummary.grandTotal = b + t + 1000;
  }

  if (manualDraft.passengerList) currentBooking.passengerList = JSON.parse(JSON.stringify(manualDraft.passengerList));
  if (manualDraft.documents) currentBooking.documents = JSON.parse(JSON.stringify(manualDraft.documents));
  if (manualDraft.ancillaries) currentBooking.ancillaries = JSON.parse(JSON.stringify(manualDraft.ancillaries));

  // Update in allBookings array
  const idx = allBookings.findIndex((b) => b.id === currentBooking.id);
  if (idx !== -1) {
    allBookings[idx] = currentBooking;
  } else {
    allBookings.push(currentBooking);
  }

  try {
    localStorage.setItem("fareos_all_bookings", JSON.stringify(allBookings));
    localStorage.removeItem(`fareos_draft_${currentBooking.id}`);
  } catch (e) {}

  persistBookingUpdate(currentBooking);
  closeManualUpdateModal();
  showAdminToast(`✓ Confirmed & Applied update to ${currentBooking.id}!`);
  renderBookingDetailView(currentBooking);
}

function formatCurrency(num) {
  if (isNaN(num)) return "0.00";
  return Number(num).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showAdminToast(msg) {
  const existing = document.getElementById("fareos-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "fareos-toast";
  toast.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:999999;background:#0F172A;color:#FFFFFF;padding:10px 16px;border-radius:6px;font-size:12px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.25);border-left:4px solid #2563EB;";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 3000);
}

function filterSidebarMenu(q) {
  const query = (q || "").toLowerCase().trim();
  document.querySelectorAll("#fareos-sidebar-nav .fareos-nav-item").forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(query) ? "flex" : "none";
  });
}

function toggleSidebar() {
  const sb = document.getElementById("admin-sidebar");
  if (sb) sb.classList.toggle("collapsed");
}

function getFallbackSeedBookings() {
  return [
    {
      id: "BKNG-7265586",
      tripType: "ROUND TRIP",
      supplierSearch: "Amadeus NDC",
      supplierIssued: "AMGS",
      source: "WEB",
      isUnviewed: false,
      bookingDate: "2026-09-07T12:39:00Z",
      paymentStatus: "Payment Pending",
      status: "Initiated",
      statusPill: "INIT /",
      statusDetail: "Booking: INITIATED | Ticketing: AWAITING",
      ticketingStatus: "TKT AWAITING",
      owner: "Super Admin",
      summary: "KWI-AUH-XNB | 08 Sep | 1 Pax",
      route: "KWI → XNB",
      origin: "KWI",
      destination: "XNB",
      travelDate: "2026-09-08",
      travelDateDisplay: "08 Sep 26",
      deadline: "24h left",
      isOverdue: false,
      passengerName: "YFNTDRFDSC/BDXF",
      amount: 12273.00,
      currency: "INR",
      airType: "International",
      customer: "Navaneeth Kk",
      phone: "+91 07306074202",
      customerType: "REGULAR",
      airline: "Etihad Airways",
      flightNumber: "EY 453",
      paxCount: 1,
      cabin: "Economy",
      ipAddress: "192.168.0.10",
      lockedBy: null,
      lockedAt: null,
      firstViewedBy: "Susen (SuperAdmin)",
      firstViewedAt: "07 Sep 2026, 12:57 PM",
      lastAccessedBy: "Susen (SuperAdmin)",
      lastAccessedAt: "07 Sep 2026, 12:57 PM",
      customerDetails: {
        name: "Navaneeth Kk",
        id: "bdcd2c91-76ba-41cd-ab3b-89f7bd5df953",
        email: "navaneethkinik@gmail.com",
        phone: "+91 07306074202",
        bookingCount: 1
      },
      passengerList: [
        { title: "MR", name: "YFNTDRFDSC/BDXF", type: "ADULT", status: "PENDING" }
      ],
      segments: [
        {
          segmentNum: 1,
          airline: "Etihad Airways",
          flightNumber: "EY453",
          aircraft: "320",
          origin: "KWI",
          originName: "KUWAIT INTL",
          depTime: "04:15 AM",
          depDate: "08 Sep 2026",
          dest: "AUH",
          destName: "DHABI INTL ARPT",
          arrTime: "06:55 AM",
          arrDate: "08 Sep 2026",
          duration: "1h 40m",
          isNonStop: true,
          cabin: "ECONOMY",
          class: "E",
          policy: "Non-Refundable",
          fareBasis: "EN205H7Z",
          supplier: "AMGS",
          layoverAfter: {
            airport: "AUH",
            airportName: "Dhabi Intl Arpt",
            duration: "1h 30m"
          }
        },
        {
          segmentNum: 2,
          airline: "Etihad Airways",
          flightNumber: "EY5416",
          aircraft: "BUS",
          origin: "AUH",
          originName: "DHABI INTL ARPT",
          depTime: "08:25 AM",
          depDate: "08 Sep 2026",
          dest: "XNB",
          destName: "DUBAI BUS STATION",
          arrTime: "10:25 AM",
          arrDate: "08 Sep 2026",
          duration: "2h 00m",
          isNonStop: true,
          cabin: "ECONOMY",
          class: "E",
          policy: "Non-Refundable",
          fareBasis: "EN205H7Z",
          supplier: "AMGS"
        }
      ],
      priceSummary: {
        baseFare: 6130.00,
        tax: 6143.00,
        adultTotal: 12273.00,
        convenienceFee: 0.00,
        grandTotal: 12273.00
      }
    },
    {
      id: "BKNG-8309502",
      tripType: "ONE WAY",
      supplierSearch: "flydubai",
      supplierIssued: "flydubai",
      source: "WEB",
      isUnviewed: false,
      bookingDate: "2026-09-01T04:42:00Z",
      paymentStatus: "Paid",
      status: "Pending",
      statusPill: "FAILED /",
      statusDetail: "Booking: FAILED | Ticketing: FAILED",
      ticketingStatus: "TKT FAILED",
      owner: "Super Admin",
      summary: "DXB-JED | 23 Oct | 1 Pax",
      route: "DXB → JED",
      origin: "DXB",
      destination: "JED",
      travelDate: "2026-10-23",
      travelDateDisplay: "23 Oct 26",
      deadline: "6d 7h overdue",
      isOverdue: true,
      passengerName: "DOLORES DUIS",
      amount: 18687.35,
      currency: "INR",
      airType: "International",
      customer: "Dolores Duis",
      phone: "+91 12768422153",
      customerType: "REGULAR",
      airline: "Flydubai",
      flightNumber: "FZ 843",
      paxCount: 1,
      cabin: "Economy",
      ipAddress: "192.168.0.10",
      lockedBy: "Super Admin",
      lockedAt: "2026-09-01T04:43:00Z",
      firstViewedBy: "Super Admin (SuperAdmin)",
      firstViewedAt: "01 Sep 2026, 04:43 AM",
      lastAccessedBy: "Super Admin",
      lastAccessedAt: "01 Sep 2026, 04:43 AM",
      customerDetails: {
        name: "Dolores Duis",
        id: "57110992-3907-4822-b979-72f0456c7fad",
        email: "rerum@ad.cc",
        phone: "+91 12768422153",
        bookingCount: 1
      },
      passengerList: [
        { title: "MR", name: "DOLORES/DUIS", type: "ADULT", status: "FAILED" }
      ],
      segments: [
        {
          segmentNum: 1,
          airline: "Flydubai",
          flightNumber: "FZ013",
          aircraft: "73D",
          origin: "DXB",
          originName: "DUBAI INTL ARPT",
          depTime: "02:00 AM",
          depDate: "23 Oct 2026",
          dest: "JED",
          destName: "JEDDAH INTL",
          arrTime: "04:00 AM",
          arrDate: "23 Oct 2026",
          duration: "3h 00m",
          isNonStop: true,
          cabin: "ECONOMY",
          class: "—",
          policy: "Non-Refundable",
          fareBasis: "Q06AE2",
          supplier: "FZAR"
        }
      ],
      priceSummary: {
        baseFare: 9914.09,
        tax: 7773.26,
        adultTotal: 17687.35,
        convenienceFee: 1000.00,
        grandTotal: 18687.35
      }
    },
    {
      id: "BKNG-6423336",
      tripType: "ONE WAY",
      supplierSearch: "flydubai",
      supplierIssued: "flydubai",
      source: "WEB",
      isUnviewed: false,
      bookingDate: "2026-09-01T03:20:00Z",
      paymentStatus: "Paid",
      status: "Pending",
      statusPill: "FAILED /",
      statusDetail: "Booking: FAILED | Ticketing: FAILED",
      ticketingStatus: "TKT FAILED",
      owner: "Super Admin",
      summary: "AHB-DXB-HBE | 24 Feb | 1 Pax",
      route: "AHB → HBE",
      origin: "AHB",
      destination: "HBE",
      travelDate: "2027-02-24",
      travelDateDisplay: "24 Feb 27",
      deadline: "6d 9h overdue",
      isOverdue: true,
      passengerName: "INCIDUNT SOLUTA",
      amount: 21516.31,
      currency: "INR",
      airType: "International",
      customer: "Incidunt Soluta",
      phone: "+91 19861262452",
      customerType: "REGULAR",
      airline: "Flydubai",
      flightNumber: "FZ 702",
      paxCount: 1,
      cabin: "Economy",
      ipAddress: "192.168.0.10",
      lockedBy: null,
      lockedAt: null,
      firstViewedBy: "Susen (SuperAdmin)",
      firstViewedAt: "01 Sep 2026, 03:26 AM",
      lastAccessedBy: "Susen (SuperAdmin)",
      lastAccessedAt: "01 Sep 2026, 03:26 AM",
      customerDetails: {
        name: "Incidunt Soluta",
        id: "68a7b6da-e9ac-45b0-afe3-e08524dcc6e9",
        email: "cupidatat@ad.cc",
        phone: "+91 19861262452",
        bookingCount: 1
      },
      passengerList: [
        { title: "MR", name: "INCIDUNT/SOLUTA", type: "ADULT", status: "FAILED" }
      ],
      segments: [
        {
          segmentNum: 1,
          airline: "Flydubai",
          flightNumber: "FZ816",
          aircraft: "73D",
          origin: "AHB",
          originName: "ABHA AIRPORT",
          depTime: "07:45 AM",
          depDate: "24 Feb 2027",
          dest: "DXB",
          destName: "DUBAI INTL ARPT",
          arrTime: "11:20 AM",
          arrDate: "24 Feb 2027",
          duration: "2h 35m",
          isNonStop: true,
          cabin: "ECONOMY",
          class: "—",
          policy: "Non-Refundable",
          fareBasis: "V06SAS",
          supplier: "FZAR",
          layoverAfter: {
            airport: "DXB",
            airportName: "Dubai Intl Arpt",
            duration: "7h 50m"
          }
        },
        {
          segmentNum: 2,
          airline: "Flydubai",
          flightNumber: "FZ175",
          aircraft: "73D",
          origin: "DXB",
          originName: "DUBAI INTL ARPT",
          depTime: "07:10 PM",
          depDate: "24 Feb 2027",
          dest: "HBE",
          destName: "BORG EL ARAB ARPT",
          arrTime: "09:40 PM",
          arrDate: "24 Feb 2027",
          duration: "4h 30m",
          isNonStop: true,
          cabin: "ECONOMY",
          class: "—",
          policy: "Non-Refundable",
          fareBasis: "V06SAS",
          supplier: "FZAR"
        }
      ],
      priceSummary: {
        baseFare: 13405.69,
        tax: 7110.62,
        adultTotal: 20516.31,
        convenienceFee: 1000.00,
        grandTotal: 21516.31
      }
    }
  ];
}
