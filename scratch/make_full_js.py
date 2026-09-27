import json

js_code = """/**
 * FareOS Enterprise Flight Bookings Admin Controller
 * js/admin_flight_bookings.js
 */

let allBookings = [];
let activeTileFilter = "all"; // "all", "Confirmed", "Pending", "Cancelled", "Other"
let activeFilters = {
  search: "",
  dateRange: "7d",
  txnType: "all",
  status: "all",
  payment: "all",
  owner: "all",
  airType: "all"
};

// Analytics Tiles Configuration
let bookingTilesConfig = [
  {
    id: "total",
    order: 1,
    color: "#2E7D7E",
    name: "Total Bookings",
    sub: "__total__ · full card · Plane",
    desc: "Every booking matching the current filters. Selecting a tile does not change this number, so the tiles below always add up to it.",
    clientStatus: "Every booking",
    active: true,
    canDelete: false
  },
  {
    id: "confirmed",
    order: 2,
    color: "#059669",
    name: "Confirmed",
    sub: "confirmed · full card · CheckCircle",
    desc: "Bookings whose client status is Confirmed.",
    clientStatus: "Confirmed",
    active: true,
    canDelete: true
  },
  {
    id: "pending",
    order: 3,
    color: "#4F46E5",
    name: "Pending",
    sub: "pending · full card · AlertTriangle",
    desc: "Bookings still moving through the flow — client status Processing or Payment Pending.",
    clientStatus: "In Process  Pending",
    active: true,
    canDelete: true
  },
  {
    id: "cancelled",
    order: 4,
    color: "#334155",
    name: "Cancelled",
    sub: "cancelled · icon well · XCircle",
    desc: "Bookings that ended without travel — client status Cancelled.",
    clientStatus: "Cancelled",
    active: true,
    canDelete: true
  }
];

// Deadline Timeline Rules
let deadlineTimelineRules = [
  {
    id: "rule_1",
    appliesTo: "Pending",
    windowHours: 24,
    windowDisplay: "18m",
    amberAt: 50,
    redAt: 80,
    stopsWhen: "Confirmed"
  }
];

// Load configs from localStorage if available
try {
  const savedTiles = localStorage.getItem("fareos_tiles_config");
  if (savedTiles) bookingTilesConfig = JSON.parse(savedTiles);
  const savedRules = localStorage.getItem("fareos_timeline_rules");
  if (savedRules) deadlineTimelineRules = JSON.parse(savedRules);
} catch (e) {}

document.addEventListener("DOMContentLoaded", async () => {
  setupKeyboardShortcuts();
  await initBookingsData();
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

/**
 * Dual Data Engine:
 * 1. Listen in real-time to Firestore collection "flight_bookings"
 * 2. Fallback to /api/flight-bookings (server.py + data/flight_bookings.json)
 */
async function initBookingsData() {
  let firestoreLoaded = false;

  if (typeof db !== "undefined") {
    try {
      db.collection("flight_bookings").onSnapshot((snapshot) => {
        if (!snapshot.empty) {
          const list = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
          });
          list.sort((a, b) => new Date(b.bookingDate || 0) - new Date(a.bookingDate || 0));
          allBookings = list;
          firestoreLoaded = true;
          renderTableAndKPIs();
        } else if (!firestoreLoaded) {
          fetchServerBookings(true);
        }
      }, (err) => {
        console.warn("Firestore snapshot listener:", err);
        fetchServerBookings(false);
      });
    } catch (e) {
      console.warn("Firestore init warning:", e);
      fetchServerBookings(false);
    }
  } else {
    fetchServerBookings(false);
  }
}

async function fetchServerBookings(seedFirestoreIfFound = false) {
  try {
    const res = await fetch("/api/flight-bookings");
    if (res.ok) {
      const data = await res.json();
      if (data && data.bookings && data.bookings.length > 0) {
        allBookings = data.bookings;
        renderTableAndKPIs();

        if (seedFirestoreIfFound && typeof db !== "undefined") {
          allBookings.forEach((b) => {
            try {
              db.collection("flight_bookings").doc(b.id).set(b);
            } catch (e) {}
          });
        }
        return;
      }
    }
  } catch (e) {
    console.log("Local API notice, loading local fallback records:", e);
  }

  if (allBookings.length === 0) {
    allBookings = getFallbackSeedBookings();
    renderTableAndKPIs();
  }
}

function getFallbackSeedBookings() {
  return [
    {
      id: "BKNG-8309502",
      supplierSearch: "flydubai",
      supplierIssued: "flydubai",
      source: "WEB",
      isUnviewed: true,
      bookingDate: "2026-09-01T04:42:00Z",
      paymentStatus: "Paid",
      status: "Pending",
      statusDetail: "Booking: FAILED | Ticketing: FAILED",
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
      phone: "12768422153",
      customerType: "REGULAR",
      airline: "Flydubai",
      flightNumber: "FZ 843",
      paxCount: 1,
      cabin: "Economy"
    },
    {
      id: "BKNG-1923219",
      supplierSearch: "flydubai",
      supplierIssued: "flydubai",
      source: "WEB",
      isUnviewed: false,
      bookingDate: "2026-09-01T03:29:00Z",
      paymentStatus: "Paid",
      status: "Pending",
      statusDetail: "Booking: SUCCESS | Ticketing: PENDING",
      owner: "Super Admin",
      summary: "DXB-JED | 23 Oct | 1 Pax",
      route: "DXB → JED",
      origin: "DXB",
      destination: "JED",
      travelDate: "2026-10-23",
      travelDateDisplay: "23 Oct 26",
      deadline: "6d 9h overdue",
      isOverdue: true,
      passengerName: "DELENITI ATQUE",
      amount: 18687.35,
      currency: "INR",
      airType: "International",
      customer: "deleniti Atque",
      phone: "10817765775",
      customerType: "REGULAR",
      airline: "Flydubai",
      flightNumber: "FZ 845",
      paxCount: 1,
      cabin: "Economy"
    },
    {
      id: "BKNG-5044184",
      supplierSearch: "IndiGo",
      supplierIssued: "IndiGo",
      source: "WEB",
      pnr: "6IR5GE",
      isUnviewed: false,
      bookingDate: "2026-09-01T03:27:00Z",
      paymentStatus: "Paid",
      status: "Confirmed",
      statusDetail: "Booking: CONFIRMED | Ticketing: ISSUED",
      owner: "Flight Desk Admin",
      summary: "BLR-DEL | 16 Sep | 1 Pax",
      route: "BLR → DEL",
      origin: "BLR",
      destination: "DEL",
      travelDate: "2026-09-16",
      travelDateDisplay: "16 Sep 26",
      deadline: "On Schedule",
      isOverdue: false,
      passengerName: "ALI KIZHAKKUPARAMBIL",
      amount: 3217.00,
      currency: "INR",
      airType: "Domestic",
      customer: "ALI KIZHAKKUPARAMBIL",
      phone: "9321116965",
      customerType: "REGULAR",
      airline: "IndiGo",
      flightNumber: "6E 2134",
      paxCount: 1,
      cabin: "Economy"
    },
    {
      id: "BKNG-6423336",
      supplierSearch: "flydubai",
      supplierIssued: "flydubai",
      source: "WEB",
      isUnviewed: true,
      bookingDate: "2026-09-01T03:20:00Z",
      paymentStatus: "Paid",
      status: "Pending",
      statusDetail: "Booking: FAILED | Ticketing: FAILED",
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
      phone: "19861262452",
      customerType: "REGULAR",
      airline: "Flydubai",
      flightNumber: "FZ 702",
      paxCount: 1,
      cabin: "Economy"
    },
    {
      id: "BKNG-9284102",
      supplierSearch: "Google Flights",
      supplierIssued: "Flyvis",
      source: "WEB",
      isUnviewed: true,
      bookingDate: "2026-09-12T01:05:00Z",
      paymentStatus: "Paid",
      status: "Confirmed",
      statusDetail: "Booking: CONFIRMED | Ticketing: ISSUED",
      owner: "Zaid Khaleel",
      summary: "DEL-DXB | 17 Sep | 1 Pax",
      route: "DEL → DXB",
      origin: "DEL",
      destination: "DXB",
      travelDate: "2026-09-17",
      travelDateDisplay: "17 Sep 26",
      deadline: "On Schedule",
      isOverdue: false,
      passengerName: "ZAID KHALEEL",
      amount: 18011.00,
      currency: "INR",
      airType: "International",
      customer: "Zaid Khaleel",
      phone: "919207021258",
      customerType: "REGULAR",
      airline: "Emirates",
      flightNumber: "EK 513",
      paxCount: 1,
      cabin: "Economy"
    }
  ];
}

/**
 * Handle KPI Card Tile Click
 * Filters the table by that specific category
 */
function handleTileClick(tileCategory) {
  if (activeTileFilter === tileCategory && tileCategory !== "all") {
    activeTileFilter = "all"; // Toggle off
  } else {
    activeTileFilter = tileCategory;
  }

  // Update card active classes
  document.querySelectorAll(".fareos-kpi-card").forEach((c) => c.classList.remove("active-filter"));
  if (activeTileFilter === "Confirmed") document.getElementById("card-tile-confirmed")?.classList.add("active-filter");
  else if (activeTileFilter === "Pending") document.getElementById("card-tile-pending")?.classList.add("active-filter");
  else if (activeTileFilter === "Cancelled") document.getElementById("card-tile-cancelled")?.classList.add("active-filter");
  else if (activeTileFilter === "Other") document.getElementById("card-tile-other")?.classList.add("active-filter");
  else document.getElementById("card-tile-total")?.classList.add("active-filter");

  renderBookingsTable();
  const label = activeTileFilter === "all" ? "Showing all bookings" : `Filtering by: ${activeTileFilter}`;
  showAdminToast(label);
}

/**
 * Render KPI Cards and Table
 */
function renderTableAndKPIs() {
  updateKPICards();
  renderBookingsTable();
}

function updateKPICards() {
  const total = allBookings.length;
  const confirmed = allBookings.filter((b) => b.status === "Confirmed").length;
  const pending = allBookings.filter((b) => b.status === "Pending").length;
  const cancelled = allBookings.filter((b) => b.status === "Cancelled").length;
  const other = total - confirmed - pending - cancelled;

  const setT = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setT("kpi-total-bookings", total);
  setT("kpi-confirmed-bookings", confirmed);
  setT("kpi-pending-bookings", pending);
  setT("kpi-cancelled-bookings", cancelled);
  setT("kpi-other-bookings", other);

  const sidebarCount = document.getElementById("sidebar-flight-count");
  if (sidebarCount) sidebarCount.textContent = total > 0 ? (total + 543) : "559";
}

function getFilteredBookings() {
  return allBookings.filter((b) => {
    // 1. Interactive KPI Tile Filter
    if (activeTileFilter && activeTileFilter !== "all") {
      if (activeTileFilter === "Confirmed" && b.status !== "Confirmed") return false;
      if (activeTileFilter === "Pending" && b.status !== "Pending") return false;
      if (activeTileFilter === "Cancelled" && b.status !== "Cancelled") return false;
      if (activeTileFilter === "Other") {
        if (b.status === "Confirmed" || b.status === "Pending" || b.status === "Cancelled") return false;
      }
    }

    // 2. Search Query
    if (activeFilters.search) {
      const q = activeFilters.search.toLowerCase();
      const match =
        (b.id || "").toLowerCase().includes(q) ||
        (b.passengerName || "").toLowerCase().includes(q) ||
        (b.customer || "").toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q) ||
        (b.summary || "").toLowerCase().includes(q) ||
        (b.airline || "").toLowerCase().includes(q) ||
        (b.pnr || "").toLowerCase().includes(q) ||
        (b.owner || "").toLowerCase().includes(q);
      if (!match) return false;
    }

    // 3. Dropdown Status Filter
    if (activeFilters.status !== "all" && b.status !== activeFilters.status) {
      return false;
    }

    // 4. Payment Status
    if (activeFilters.payment !== "all" && b.paymentStatus !== activeFilters.payment) {
      return false;
    }

    // 5. Owner
    if (activeFilters.owner !== "all" && b.owner !== activeFilters.owner) {
      return false;
    }

    // 6. Air Type
    if (activeFilters.airType !== "all" && b.airType !== activeFilters.airType) {
      return false;
    }

    // 7. Txn Type
    if (activeFilters.txnType === "unviewed" && !b.isUnviewed) return false;
    if (activeFilters.txnType === "agent" && b.customerType !== "AGENT") return false;
    if (activeFilters.txnType === "web" && b.source !== "WEB") return false;

    return true;
  });
}

function renderBookingsTable() {
  const tbody = document.getElementById("bookings-table-body");
  if (!tbody) return;

  const filtered = getFilteredBookings();
  const counter = document.getElementById("table-record-count");
  if (counter) counter.textContent = `${filtered.length} / ${allBookings.length} BOOKINGS`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="16" style="text-align:center; padding:36px 12px; color:#64748B;">
          <div style="font-size:26px; margin-bottom:6px;">🔍</div>
          <div style="font-size:14px; font-weight:800; color:#0F172A;">No Matching Flight Bookings</div>
          <div style="font-size:11.5px; margin-top:3px;">No reservations found matching the active tile or filter criteria.</div>
          <button class="fareos-btn-tool" style="margin-top:10px; font-size:11px; padding:4px 10px;" onclick="resetAllFilters()">Clear Filters</button>
        </td>
      </tr>
    `;
    return;
  }

  let html = "";
  filtered.forEach((b) => {
    const isUrgent = b.isOverdue || b.status === "Pending";
    const rowClass = isUrgent ? "row-urgent" : "";

    let payClass = "pending";
    if (b.paymentStatus === "Paid") payClass = "paid";
    else if (b.paymentStatus === "Failed") payClass = "failed";

    let statusClass = "pending";
    let statusIcon = "⏱";
    if (b.status === "Confirmed") { statusClass = "confirmed"; statusIcon = "✓"; }
    else if (b.status === "Processing") { statusClass = "processing"; statusIcon = "⏱"; }
    else if (b.status === "Initiated") { statusClass = "initiated"; statusIcon = "↗"; }
    else if (b.status === "Cancelled") { statusClass = "cancelled"; statusIcon = "✕"; }

    let dateLine = "Sep 01, 2026";
    let timeLine = "04:42 AM";
    if (b.bookingDate) {
      const d = new Date(b.bookingDate);
      if (!isNaN(d)) {
        dateLine = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
        timeLine = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }

    const amtStr = "₹" + Math.round(Number(b.amount || 0)).toLocaleString("en-IN");

    html += `
      <tr class="${rowClass}">
        <!-- 1. SUPPLIER -->
        <td title="Search: ${escapeHtml(b.supplierSearch || "Google Flights")} / Issued: ${escapeHtml(b.supplierIssued || "Flyvis")}">
          <div class="fareos-supplier-cell">
            <span class="fareos-supplier-search">${escapeHtml(b.supplierSearch || "Google Flights")}</span>
            <span class="fareos-supplier-issued">${escapeHtml(b.supplierIssued || "Flyvis")}</span>
          </div>
        </td>

        <!-- 2. BOOKING ID -->
        <td>
          <div class="fareos-booking-id-cell">
            <div class="fareos-id-row">
              <span class="fareos-id-link" onclick="openBookingDrawer('${b.id}')" title="Inspect Booking">${b.id}</span>
              <button class="fareos-copy-btn" onclick="copyBookingId('${b.id}', event)" title="Copy ID">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            <div style="display:flex; align-items:center; gap:3px;">
              <span class="fareos-source-tag">• ${escapeHtml(b.source || "WEB")}</span>
              ${b.isUnviewed ? `<span class="fareos-badge-unviewed">NEW</span>` : ""}
            </div>
          </div>
        </td>

        <!-- 3. BOOKING DATE -->
        <td>
          <div class="fareos-date-cell">
            <span class="fareos-date-primary">${dateLine}</span>
            <span class="fareos-date-sub">${timeLine}</span>
          </div>
        </td>

        <!-- 4. PAYMENT STATUS -->
        <td title="${escapeHtml(b.paymentStatus || "Pending")}">
          <span class="fareos-pay-pill ${payClass}">
            ● ${escapeHtml(b.paymentStatus === "Payment Pending" ? "Pending" : (b.paymentStatus || "Pending"))}
          </span>
        </td>

        <!-- 5. STATUS -->
        <td title="${escapeHtml(b.statusDetail || b.status)}">
          <span class="fareos-status-pill ${statusClass}" onclick="toggleQuickStatus('${b.id}', event)">
            <span>${statusIcon}</span>
            <span>${escapeHtml(b.status || "Pending")}</span>
          </span>
        </td>

        <!-- 6. OWNER -->
        <td>
          <span class="fareos-owner-pill" onclick="openReassignModal('${b.id}', '${escapeHtml(b.owner || "Super Admin")}')" title="Click to reassign owner">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>${escapeHtml(b.owner || "Super Admin")}</span>
          </span>
        </td>

        <!-- 7. SUMMARY -->
        <td title="${escapeHtml(b.summary || b.route)} - ${escapeHtml(b.airline || "")}">
          <div style="font-weight:700; color:#0F172A; text-overflow:ellipsis; overflow:hidden;">${escapeHtml(b.summary || (b.route || "DEL → DXB"))}</div>
          <div style="font-size:9.5px; color:#64748B; text-overflow:ellipsis; overflow:hidden;">${escapeHtml(b.airline || "Airline")} ${b.flightNumber ? `• ${b.flightNumber}` : ""}</div>
        </td>

        <!-- 8. TRAVEL DATE -->
        <td>
          <span style="font-weight:700; color:#334155;">
            ${escapeHtml(b.travelDateDisplay || b.travelDate || "Scheduled")}
          </span>
        </td>

        <!-- 9. DEADLINE -->
        <td title="${escapeHtml(b.deadline || "On Schedule")}">
          <div class="fareos-deadline-wrap">
            <span class="fareos-deadline-text ${b.isOverdue ? "overdue" : ""}">${escapeHtml(b.deadline || "On Schedule")}</span>
            ${b.isOverdue ? `<div class="fareos-deadline-bar"></div>` : ""}
          </div>
        </td>

        <!-- 10. PASSENGER NAME -->
        <td title="${escapeHtml(b.passengerName)}">
          <span style="font-weight:800; color:#0F172A; text-transform:uppercase; text-overflow:ellipsis; overflow:hidden; display:block;">
            ${escapeHtml(b.passengerName || "PASSENGER")}
          </span>
        </td>

        <!-- 11. AMOUNT -->
        <td>
          <span style="font-weight:800; color:#0F172A;">${amtStr}</span>
        </td>

        <!-- 12. AIR TYPE -->
        <td>
          <span style="font-size:10.5px; font-weight:700; color:#475569;">
            ${b.airType === "Domestic" ? "✈️ Dom" : "🌐 Intl"}
          </span>
        </td>

        <!-- 13. CUSTOMER -->
        <td title="${escapeHtml(b.customer || b.passengerName)}">
          <span style="font-weight:600; color:#334155; text-overflow:ellipsis; overflow:hidden; display:block;">
            ${escapeHtml(b.customer || b.passengerName || "Traveler")}
          </span>
        </td>

        <!-- 14. PHONE -->
        <td>
          <a href="https://wa.me/${cleanPhone(b.phone)}?text=Hi%20${encodeURIComponent(b.customer || "Traveler")},%20regarding%20your%20Flyvis%20booking%20${b.id}..." target="_blank" style="text-decoration:none; color:#059669; font-weight:700; display:inline-flex; align-items:center; gap:3px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
            ${escapeHtml(b.phone || "-")}
          </a>
        </td>

        <!-- 15. CUSTOMER TYPE -->
        <td>
          <span style="font-size:9.5px; font-weight:800; color:#64748B; background:#F1F5F9; padding:2px 5px; border-radius:3px;">
            ${escapeHtml(b.customerType || "REGULAR")}
          </span>
        </td>

        <!-- 16. ACTIONS -->
        <td style="text-align:center;">
          <button class="fareos-btn-tool" style="padding:2px 6px; font-size:10.5px;" onclick="openBookingDrawer('${b.id}')" title="Inspect">
            View
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Slide-Over Booking Details Inspection Drawer
 */
function openBookingDrawer(bookingId) {
  const booking = allBookings.find((b) => b.id === bookingId);
  if (!booking) return;

  if (booking.isUnviewed) {
    booking.isUnviewed = false;
    syncBookingUpdate(bookingId, { isUnviewed: false });
  }

  const overlay = document.getElementById("booking-drawer-overlay");
  const title = document.getElementById("drawer-booking-id");
  const content = document.getElementById("drawer-content-body");
  const waBtn = document.getElementById("drawer-wa-btn");

  if (title) title.textContent = `${booking.id} — ${booking.passengerName}`;

  if (waBtn) {
    waBtn.onclick = () => {
      const waMsg = `Hi ${booking.customer || "Traveler"}, this is ${booking.owner || "Super Admin"} from Flyvis Concierge regarding your flight reservation ${booking.id} (${booking.summary}).`;
      window.open(`https://wa.me/${cleanPhone(booking.phone)}?text=${encodeURIComponent(waMsg)}`, "_blank");
    };
  }

  if (content) {
    content.innerHTML = `
      <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:10px; padding:14px 18px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12px; font-weight:800; color:#15803D; text-transform:uppercase;">Ticketing &amp; GDS Status</div>
            <div style="font-size:16px; font-weight:900; color:#064E3B; margin-top:2px;">${escapeHtml(booking.statusDetail || "Active")}</div>
          </div>
          <span class="fareos-status-pill ${booking.status.toLowerCase()}">${booking.status}</span>
        </div>
      </div>

      <!-- Quick Action Updates -->
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:18px;">
        <div style="font-size:12.5px; font-weight:800; color:#0F172A; margin-bottom:10px;">Quick Status &amp; Owner Update</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <label style="font-size:11px; font-weight:700; color:#64748B;">Reservation Status</label>
            <select class="admin-form-select" style="height:34px; font-size:12px; margin-top:4px;" onchange="syncBookingUpdate('${booking.id}', { status: this.value })">
              <option value="Pending" ${booking.status === "Pending" ? "selected" : ""}>Pending</option>
              <option value="Confirmed" ${booking.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
              <option value="Processing" ${booking.status === "Processing" ? "selected" : ""}>Processing</option>
              <option value="Initiated" ${booking.status === "Initiated" ? "selected" : ""}>Initiated</option>
              <option value="Cancelled" ${booking.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px; font-weight:700; color:#64748B;">Payment Status</label>
            <select class="admin-form-select" style="height:34px; font-size:12px; margin-top:4px;" onchange="syncBookingUpdate('${booking.id}', { paymentStatus: this.value })">
              <option value="Paid" ${booking.paymentStatus === "Paid" ? "selected" : ""}>Paid</option>
              <option value="Payment Pending" ${booking.paymentStatus === "Payment Pending" ? "selected" : ""}>Payment Pending</option>
              <option value="Failed" ${booking.paymentStatus === "Failed" ? "selected" : ""}>Failed</option>
            </select>
          </div>
        </div>
        <div style="margin-top:10px;">
          <label style="font-size:11px; font-weight:700; color:#64748B;">Assigned Handling Admin</label>
          <select class="admin-form-select" style="height:34px; font-size:12px; margin-top:4px;" onchange="syncBookingUpdate('${booking.id}', { owner: this.value })">
            <option value="Super Admin" ${booking.owner === "Super Admin" ? "selected" : ""}>Super Admin</option>
            <option value="Zaid Khaleel" ${booking.owner === "Zaid Khaleel" ? "selected" : ""}>Zaid Khaleel</option>
            <option value="Flight Desk Admin" ${booking.owner === "Flight Desk Admin" ? "selected" : ""}>Flight Desk Admin</option>
            <option value="Susen" ${booking.owner === "Susen" ? "selected" : ""}>Susen</option>
          </select>
        </div>
      </div>

      <!-- Route & Flight Specs -->
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:18px;">
        <div style="font-size:12px; font-weight:800; color:#64748B; text-transform:uppercase; margin-bottom:10px;">Flight &amp; Airline Itinerary</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:14px; font-weight:800; color:#0F172A;">${escapeHtml(booking.route || booking.summary)}</span>
          <span style="font-size:12px; font-weight:700; color:#2563EB; background:#EFF6FF; padding:3px 8px; border-radius:4px;">${escapeHtml(booking.airType || "International")}</span>
        </div>
        <div style="font-size:13px; color:#334155; line-height:1.6;">
          <div><strong>Carrier:</strong> ${escapeHtml(booking.airline || "Airline")} (${escapeHtml(booking.flightNumber || "N/A")})</div>
          <div><strong>Travel Date:</strong> ${escapeHtml(booking.travelDateDisplay || booking.travelDate || "Scheduled")}</div>
          <div><strong>Passengers:</strong> ${booking.paxCount || 1} Pax (${escapeHtml(booking.cabin || "Economy")})</div>
          <div><strong>Supplier Provider:</strong> Search: ${escapeHtml(booking.supplierSearch || "Google Flights")} / Issued: ${escapeHtml(booking.supplierIssued || "Flyvis")}</div>
        </div>
      </div>

      <!-- Passenger & Vault Details -->
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:18px;">
        <div style="font-size:12px; font-weight:800; color:#64748B; text-transform:uppercase; margin-bottom:10px;">Traveler &amp; Contact Information</div>
        <div style="font-size:13px; color:#334155; line-height:1.6;">
          <div><strong>Primary Passenger:</strong> ${escapeHtml(booking.passengerName)}</div>
          <div><strong>Customer Account:</strong> ${escapeHtml(booking.customer)} (${escapeHtml(booking.customerType || "REGULAR")})</div>
          <div><strong>Contact Phone:</strong> ${escapeHtml(booking.phone)}</div>
          <div><strong>Special Notes / Vault:</strong> ${escapeHtml(booking.notes || "Standard Booking")}</div>
        </div>
      </div>

      <!-- Fare Breakdown -->
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px;">
        <div style="font-size:12px; font-weight:800; color:#64748B; text-transform:uppercase; margin-bottom:10px;">Commercial Fare Structure</div>
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
          <span style="color:#64748B;">Published Fare</span>
          <span style="font-weight:700;">₹${Number(booking.amount || 0).toLocaleString("en-IN")}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:900; color:#0F172A; border-top:1px solid #E2E8F0; padding-top:8px; margin-top:8px;">
          <span>Net Payable</span>
          <span style="color:#2563EB;">₹${Number(booking.amount || 0).toLocaleString("en-IN")}</span>
        </div>
      </div>
    `;
  }

  if (overlay) overlay.style.display = "flex";
}

function closeBookingDrawer() {
  const overlay = document.getElementById("booking-drawer-overlay");
  if (overlay) overlay.style.display = "none";
}

/**
 * Booking List Configuration Modal (matching screenshot media_1789157040943.png)
 */
function openBookingConfigModal() {
  renderConfigModalData();
  const modal = document.getElementById("booking-config-modal");
  if (modal) modal.style.display = "flex";
}

function closeBookingConfigModal() {
  const modal = document.getElementById("booking-config-modal");
  if (modal) modal.style.display = "none";
}

function renderConfigModalData() {
  // 1. Render Analytics Tiles Table
  const tilesTbody = document.getElementById("config-tiles-tbody");
  if (tilesTbody) {
    let rowsHtml = "";
    bookingTilesConfig.forEach((tile, idx) => {
      rowsHtml += `
        <tr>
          <!-- ORDER -->
          <td>
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-weight:800; color:#64748B;">${tile.order}</span>
              <button onclick="moveTileOrder(${idx}, -1)" style="background:none; border:none; color:#94A3B8; cursor:pointer; padding:1px;" title="Move up">↑</button>
              <button onclick="moveTileOrder(${idx}, 1)" style="background:none; border:none; color:#94A3B8; cursor:pointer; padding:1px;" title="Move down">↓</button>
            </div>
          </td>

          <!-- TILE -->
          <td>
            <div style="display:flex; align-items:flex-start; gap:8px;">
              <div class="tile-color-chip" style="background:${tile.color}; margin-top:3px;"></div>
              <div>
                <div style="font-weight:800; color:#0F172A; font-size:12.5px;">${escapeHtml(tile.name)}</div>
                <div style="font-size:10.5px; color:#64748B; font-family:monospace; margin-top:1px;">${escapeHtml(tile.sub)}</div>
                <div style="font-size:11px; color:#475569; margin-top:3px; line-height:1.35;">${escapeHtml(tile.desc)}</div>
              </div>
            </div>
          </td>

          <!-- CLIENT STATUSES -->
          <td>
            <span style="font-size:11.5px; color:#334155; font-weight:600;">${escapeHtml(tile.clientStatus)}</span>
          </td>

          <!-- ACTIVE -->
          <td>
            <span style="color:${tile.active ? "#059669" : "#94A3B8"}; font-weight:700; font-size:11.5px; cursor:pointer;" onclick="toggleTileActive(${idx})">
              ${tile.active ? "Active" : "Inactive"}
            </span>
          </td>

          <!-- ACTIONS -->
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:6px;">
              <button onclick="promptEditTile(${idx})" style="background:none; border:none; color:#94A3B8; cursor:pointer;" title="Edit Tile">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              ${tile.canDelete ? `
                <button onclick="deleteTile(${idx})" style="background:none; border:none; color:#94A3B8; cursor:pointer;" title="Delete Tile">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              ` : ""}
            </div>
          </td>
        </tr>
      `;
    });
    tilesTbody.innerHTML = rowsHtml;
  }

  // 2. Render Timeline Rules List
  const rulesWrap = document.getElementById("config-timeline-rules-wrap");
  if (rulesWrap) {
    if (deadlineTimelineRules.length === 0) {
      rulesWrap.innerHTML = `<div style="font-size:11.5px; color:#94A3B8; padding:8px;">No custom deadline windows set.</div>`;
    } else {
      let rulesHtml = "";
      deadlineTimelineRules.forEach((rule, idx) => {
        rulesHtml += `
          <div style="display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr 1.5fr 40px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:8px 12px; margin-bottom:6px; font-size:11.5px;">
            <div><span style="color:#64748B; font-size:10px; font-weight:800; display:block;">APPLIES TO</span><strong>${escapeHtml(rule.appliesTo)}</strong></div>
            <div><span style="color:#64748B; font-size:10px; font-weight:800; display:block;">WINDOW</span>${rule.windowHours}h (${rule.windowDisplay || rule.windowHours + "h"})</div>
            <div><span style="color:#64748B; font-size:10px; font-weight:800; display:block;">AMBER AT</span>${rule.amberAt}%</div>
            <div><span style="color:#64748B; font-size:10px; font-weight:800; display:block;">RED AT</span>${rule.redAt}%</div>
            <div><span style="color:#64748B; font-size:10px; font-weight:800; display:block;">STOPS WHEN</span><strong>${escapeHtml(rule.stopsWhen)}</strong></div>
            <div style="text-align:right;">
              <button onclick="deleteTimelineRule(${idx})" style="background:none; border:none; color:#EF4444; cursor:pointer;" title="Delete rule">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;
      });
      rulesWrap.innerHTML = rulesHtml;
    }
  }
}

function moveTileOrder(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= bookingTilesConfig.length) return;
  const temp = bookingTilesConfig[idx];
  bookingTilesConfig[idx] = bookingTilesConfig[target];
  bookingTilesConfig[target] = temp;
  // Re-order numbers
  bookingTilesConfig.forEach((t, i) => t.order = i + 1);
  saveTilesConfig();
  renderConfigModalData();
}

function toggleTileActive(idx) {
  bookingTilesConfig[idx].active = !bookingTilesConfig[idx].active;
  saveTilesConfig();
  renderConfigModalData();
  showAdminToast(`Tile ${bookingTilesConfig[idx].name} toggled.`);
}

function promptEditTile(idx) {
  const tile = bookingTilesConfig[idx];
  const newName = prompt("Edit Tile Name:", tile.name);
  if (newName) {
    tile.name = newName.trim();
    saveTilesConfig();
    renderConfigModalData();
  }
}

function deleteTile(idx) {
  if (!confirm(`Delete tile "${bookingTilesConfig[idx].name}"?`)) return;
  bookingTilesConfig.splice(idx, 1);
  bookingTilesConfig.forEach((t, i) => t.order = i + 1);
  saveTilesConfig();
  renderConfigModalData();
}

function openNewTilePrompt() {
  const name = prompt("Enter Tile Name (e.g. VIP Urgent):");
  if (!name) return;
  const newTile = {
    id: "tile_" + Date.now(),
    order: bookingTilesConfig.length + 1,
    color: "#0284C7",
    name: name.trim(),
    sub: `${name.toLowerCase()} · custom · Tag`,
    desc: `Bookings filtered under ${name.trim()}.`,
    clientStatus: name.trim(),
    active: true,
    canDelete: true
  };
  bookingTilesConfig.push(newTile);
  saveTilesConfig();
  renderConfigModalData();
  showAdminToast(`Added new tile ${name.trim()}`);
}

function saveTilesConfig() {
  try {
    localStorage.setItem("fareos_tiles_config", JSON.stringify(bookingTilesConfig));
  } catch (e) {}
}

function refreshAnalyticsConfig() {
  renderConfigModalData();
  showAdminToast("Analytics configuration refreshed.");
}

function handleSaveTimelineWindow(e) {
  e.preventDefault();
  const appliesTo = document.getElementById("tw-applies-to").value;
  const windowHours = parseInt(document.getElementById("tw-window-hours").value) || 24;
  const amberAt = parseInt(document.getElementById("tw-amber-pct").value) || 50;
  const redAt = parseInt(document.getElementById("tw-red-pct").value) || 80;
  const stopsWhen = document.getElementById("tw-stops-when").value;

  const newRule = {
    id: "rule_" + Date.now(),
    appliesTo: appliesTo,
    windowHours: windowHours,
    windowDisplay: `${windowHours}h`,
    amberAt: amberAt,
    redAt: redAt,
    stopsWhen: stopsWhen
  };

  // Replace existing rule for same scope or add
  const existingIdx = deadlineTimelineRules.findIndex((r) => r.appliesTo === appliesTo);
  if (existingIdx >= 0) {
    deadlineTimelineRules[existingIdx] = newRule;
  } else {
    deadlineTimelineRules.push(newRule);
  }

  try {
    localStorage.setItem("fareos_timeline_rules", JSON.stringify(deadlineTimelineRules));
  } catch (err) {}

  renderConfigModalData();
  showAdminToast(`Saved timeline window for ${appliesTo}`);
}

function deleteTimelineRule(idx) {
  deadlineTimelineRules.splice(idx, 1);
  try {
    localStorage.setItem("fareos_timeline_rules", JSON.stringify(deadlineTimelineRules));
  } catch (err) {}
  renderConfigModalData();
  showAdminToast("Timeline rule removed.");
}

/**
 * Owner Reassignment Modal
 */
function openReassignModal(bookingId, currentOwner) {
  document.getElementById("reassign-target-booking-id").value = bookingId;
  const select = document.getElementById("reassign-owner-select");
  if (select) select.value = currentOwner || "Super Admin";
  document.getElementById("reassign-owner-modal").style.display = "flex";
}

function closeReassignModal() {
  document.getElementById("reassign-owner-modal").style.display = "none";
}

async function submitOwnerReassignment() {
  const bookingId = document.getElementById("reassign-target-booking-id").value;
  const newOwner = document.getElementById("reassign-owner-select").value;
  if (!bookingId || !newOwner) return;

  await syncBookingUpdate(bookingId, { owner: newOwner });
  closeReassignModal();
  showAdminToast(`Assigned ${bookingId} to ${newOwner}`);
}

/**
 * Universal Sync Function: Updates local array, Firestore, and Python server
 */
async function syncBookingUpdate(bookingId, updateFields) {
  const target = allBookings.find((b) => b.id === bookingId);
  if (target) {
    Object.assign(target, updateFields);
    renderTableAndKPIs();
  }

  if (typeof db !== "undefined") {
    try {
      await db.collection("flight_bookings").doc(bookingId).update(updateFields);
    } catch (e) {
      console.warn("Firestore update notice:", e);
    }
  }

  try {
    await fetch("/api/flight-bookings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookingId, ...updateFields })
    });
  } catch (e) {}
}

function toggleQuickStatus(bookingId, event) {
  if (event) event.stopPropagation();
  const booking = allBookings.find((b) => b.id === bookingId);
  if (!booking) return;

  const cycle = {
    "Pending": "Confirmed",
    "Confirmed": "Processing",
    "Processing": "Initiated",
    "Initiated": "Cancelled",
    "Cancelled": "Pending"
  };

  const nextStatus = cycle[booking.status] || "Confirmed";
  const detail = nextStatus === "Confirmed" ? "Booking: CONFIRMED | Ticketing: ISSUED" : `Booking: ${nextStatus.toUpperCase()} | Ticketing: PENDING`;
  syncBookingUpdate(bookingId, { status: nextStatus, statusDetail: detail });
  showAdminToast(`Status changed to ${nextStatus}`);
}

/**
 * Filter Handlers
 */
function handleTableSearch(val) {
  activeFilters.search = val.trim();
  renderBookingsTable();
}

function toggleDropdown(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isShown = menu.style.display === "block";
  document.querySelectorAll("[id$='-menu']").forEach((m) => m.style.display = "none");
  menu.style.display = isShown ? "none" : "block";
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".fareos-btn-tool") && !e.target.closest("[id$='-menu']")) {
    document.querySelectorAll("[id$='-menu']").forEach((m) => m.style.display = "none");
  }
});

function setDateFilter(rangeKey, label) {
  activeFilters.dateRange = rangeKey;
  document.getElementById("selected-date-label").textContent = label;
  document.querySelectorAll("#date-filter-menu .fareos-dropdown-item").forEach((item) => item.classList.remove("active"));
  if (event && event.target) event.target.classList.add("active");
  toggleDropdown("date-filter-menu");
  renderBookingsTable();
}

function setTxnFilter(txnKey, label) {
  activeFilters.txnType = txnKey;
  document.getElementById("selected-txn-label").textContent = label;
  document.querySelectorAll("#txn-filter-menu .fareos-dropdown-item").forEach((item) => item.classList.remove("active"));
  if (event && event.target) event.target.classList.add("active");
  toggleDropdown("txn-filter-menu");
  renderBookingsTable();
}

function toggleFilterDrawer() {
  const drawer = document.getElementById("advanced-filter-drawer");
  const btn = document.getElementById("btn-toggle-filters");
  if (!drawer) return;
  const isHidden = drawer.style.display === "none";
  drawer.style.display = isHidden ? "block" : "none";
  if (btn) btn.classList.toggle("active", isHidden);
}

function applyAllFilters() {
  activeFilters.status = document.getElementById("filter-status")?.value || "all";
  activeFilters.payment = document.getElementById("filter-payment")?.value || "all";
  activeFilters.owner = document.getElementById("filter-owner")?.value || "all";
  activeFilters.airType = document.getElementById("filter-airtype")?.value || "all";
  renderBookingsTable();
}

function resetAllFilters() {
  activeTileFilter = "all";
  activeFilters = {
    search: "",
    dateRange: "7d",
    txnType: "all",
    status: "all",
    payment: "all",
    owner: "all",
    airType: "all"
  };

  document.querySelectorAll(".fareos-kpi-card").forEach((c) => c.classList.remove("active-filter"));
  document.getElementById("card-tile-total")?.classList.add("active-filter");

  const setSearch = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setSearch("universal-search", "");
  setSearch("filter-status", "all");
  setSearch("filter-payment", "all");
  setSearch("filter-owner", "all");
  setSearch("filter-airtype", "all");

  const dateLbl = document.getElementById("selected-date-label");
  if (dateLbl) dateLbl.textContent = "Last 7 Days";

  const txnLbl = document.getElementById("selected-txn-label");
  if (txnLbl) txnLbl.textContent = "Recent Transactions";

  renderBookingsTable();
}

function refreshBookingsData() {
  initBookingsData();
  showAdminToast("Refreshed bookings data!");
}

/**
 * Manual Booking Creation
 */
function openNewBookingModal() {
  document.getElementById("manual-booking-modal").style.display = "flex";
}
function closeNewBookingModal() {
  document.getElementById("manual-booking-modal").style.display = "none";
}

async function handleCreateManualBooking(e) {
  e.preventDefault();
  const name = document.getElementById("nb-pax-name").value.trim();
  const phone = document.getElementById("nb-phone").value.trim();
  const orig = document.getElementById("nb-orig").value.trim().toUpperCase();
  const dest = document.getElementById("nb-dest").value.trim().toUpperCase();
  const date = document.getElementById("nb-date").value;
  const airline = document.getElementById("nb-airline").value.trim();
  const amount = parseFloat(document.getElementById("nb-amount").value) || 0;
  const owner = document.getElementById("nb-owner").value;

  const bookingId = "BKNG-" + Math.floor(1000000 + Math.random() * 9000000);
  const nowIso = new Date().toISOString();

  const indianHubs = ["DEL", "BOM", "BLR", "MAA", "HYD", "CCU", "COK", "CNN", "CCJ", "TRV", "AMD", "GOI", "GOX", "PNQ", "JAI", "LKO", "SXR"];
  const isDomestic = indianHubs.includes(orig) && indianHubs.includes(dest);

  const newBooking = {
    id: bookingId,
    supplierSearch: "Manual GDS",
    supplierIssued: "Flyvis",
    source: "ADMIN_DESK",
    pnr: "MAN" + Math.floor(1000 + Math.random() * 9000),
    isUnviewed: true,
    bookingDate: nowIso,
    paymentStatus: "Paid",
    status: "Confirmed",
    statusDetail: "Booking: CONFIRMED | Ticketing: MANUAL_ISSUANCE",
    owner: owner,
    summary: `${orig}-${dest} | ${date} | 1 Pax`,
    route: `${orig} → ${dest}`,
    origin: orig,
    destination: dest,
    travelDate: date,
    travelDateDisplay: date,
    deadline: "On Schedule",
    isOverdue: false,
    passengerName: name.toUpperCase(),
    amount: amount,
    currency: "INR",
    airType: isDomestic ? "Domestic" : "International",
    customer: name,
    phone: phone,
    customerType: "REGULAR",
    airline: airline,
    flightNumber: airline.slice(0, 2).toUpperCase() + " " + Math.floor(100 + Math.random() * 899),
    paxCount: 1,
    cabin: "Economy"
  };

  allBookings.unshift(newBooking);
  renderTableAndKPIs();
  closeNewBookingModal();
  document.getElementById("new-booking-form").reset();

  if (typeof db !== "undefined") {
    try {
      await db.collection("flight_bookings").doc(bookingId).set(newBooking);
    } catch (err) {}
  }
  try {
    await fetch("/api/flight-bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBooking)
    });
  } catch (err) {}

  showAdminToast(`Created booking ${bookingId}`);
}

/**
 * Utility Helpers
 */
function copyBookingId(id, event) {
  if (event) event.stopPropagation();
  navigator.clipboard.writeText(id).then(() => {
    showAdminToast(`Copied ${id}`);
  }).catch(() => {});
}

function cleanPhone(phone) {
  return (phone || "").replace(/[^0-9]/g, "");
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

function toggleUserMenu() {
  alert("Logged in as Super Admin (Susen). Multi-role access enabled.");
}
"""

with open("js/admin_flight_bookings.js", "w", encoding="utf-8") as f:
    f.write(js_code)
print("Updated js/admin_flight_bookings.js successfully.")
