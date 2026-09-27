import os

js_content = """/**
 * FareOS Enterprise Flight Bookings Admin Controller
 * js/admin_flight_bookings.js
 */

let allBookings = [];
let activeFilters = {
  search: "",
  dateRange: "7d",
  txnType: "all",
  status: "all",
  payment: "all",
  owner: "all",
  airType: "all"
};

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
          // Sort by bookingDate desc
          list.sort((a, b) => new Date(b.bookingDate || 0) - new Date(a.bookingDate || 0));
          allBookings = list;
          firestoreLoaded = true;
          renderTableAndKPIs();
        } else if (!firestoreLoaded) {
          // If Firestore collection is empty, load seed data and upload
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

  // Static Fallback if server is offline
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
    // Search Query
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

    // Status
    if (activeFilters.status !== "all" && b.status !== activeFilters.status) {
      return false;
    }

    // Payment Status
    if (activeFilters.payment !== "all" && b.paymentStatus !== activeFilters.payment) {
      return false;
    }

    // Owner
    if (activeFilters.owner !== "all" && b.owner !== activeFilters.owner) {
      return false;
    }

    // Air Type
    if (activeFilters.airType !== "all" && b.airType !== activeFilters.airType) {
      return false;
    }

    // Txn Type
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
        <td colspan="16" style="text-align:center; padding:48px 20px; color:#64748B;">
          <div style="font-size:32px; margin-bottom:8px;">🔍</div>
          <div style="font-size:15px; font-weight:800; color:#0F172A;">No Flight Bookings Found</div>
          <div style="font-size:12.5px; margin-top:4px;">Try adjusting your filter options or search keyword.</div>
          <button class="fareos-btn-tool" style="margin-top:14px;" onclick="resetAllFilters()">Reset All Filters</button>
        </td>
      </tr>
    `;
    return;
  }

  let html = "";
  filtered.forEach((b) => {
    const isUrgent = b.isOverdue || b.status === "Pending";
    const rowClass = isUrgent ? "row-urgent" : "";

    // Payment Class
    let payClass = "pending";
    if (b.paymentStatus === "Paid") payClass = "paid";
    else if (b.paymentStatus === "Failed") payClass = "failed";

    // Status Class
    let statusClass = "pending";
    let statusIcon = "⏱";
    if (b.status === "Confirmed") { statusClass = "confirmed"; statusIcon = "✓"; }
    else if (b.status === "Processing") { statusClass = "processing"; statusIcon = "⏱"; }
    else if (b.status === "Initiated") { statusClass = "initiated"; statusIcon = "↗"; }
    else if (b.status === "Cancelled") { statusClass = "cancelled"; statusIcon = "✕"; }

    // Date formatting
    let dateLine = "Sep 01, 2026";
    let timeLine = "04:42 AM";
    if (b.bookingDate) {
      const d = new Date(b.bookingDate);
      if (!isNaN(d)) {
        dateLine = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        timeLine = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }

    // Currency Formatting
    const amtStr = "₹" + Number(b.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    html += `
      <tr class="${rowClass}">
        <!-- 1. SUPPLIER -->
        <td>
          <div class="fareos-supplier-cell">
            <span class="fareos-supplier-search">SEARCH ${escapeHtml(b.supplierSearch || "Google Flights")}</span>
            <span class="fareos-supplier-issued">ISSUED ${escapeHtml(b.supplierIssued || "Flyvis")}</span>
          </div>
        </td>

        <!-- 2. BOOKING ID -->
        <td>
          <div class="fareos-booking-id-cell">
            <div class="fareos-id-row">
              <span class="fareos-id-link" onclick="openBookingDrawer('${b.id}')">${b.id}</span>
              <button class="fareos-copy-btn" onclick="copyBookingId('${b.id}', event)" title="Copy Booking ID">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            <div style="display:flex; align-items:center; gap:5px; margin-top:2px;">
              <span class="fareos-source-tag">• ${escapeHtml(b.source || "WEB")}</span>
              ${b.pnr ? `<span style="font-size:10px; color:#2563EB; font-weight:800;">${escapeHtml(b.pnr)}</span>` : ""}
              ${b.isUnviewed ? `<span class="fareos-badge-unviewed">UNVIEWED</span>` : ""}
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
        <td>
          <span class="fareos-pay-pill ${payClass}">
            ● ${escapeHtml(b.paymentStatus || "Payment Pending")}
          </span>
        </td>

        <!-- 5. STATUS -->
        <td>
          <div class="fareos-tooltip">
            <span class="fareos-status-pill ${statusClass}" onclick="toggleQuickStatus('${b.id}', event)">
              <span>${statusIcon}</span>
              <span>${escapeHtml(b.status || "Pending")}</span>
            </span>
            <span class="fareos-tooltip-text">${escapeHtml(b.statusDetail || "Booking: Active")}</span>
          </div>
        </td>

        <!-- 6. OWNER -->
        <td>
          <span class="fareos-owner-pill" onclick="openReassignModal('${b.id}', '${escapeHtml(b.owner || "Super Admin")}')" title="Click to reassign handling admin">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>${escapeHtml(b.owner || "Super Admin")}</span>
          </span>
        </td>

        <!-- 7. SUMMARY -->
        <td>
          <div style="font-weight:700; color:#0F172A;">${escapeHtml(b.summary || (b.route || "DEL → DXB"))}</div>
          <div style="font-size:11px; color:#64748B;">${escapeHtml(b.airline || "Partner Airline")} ${b.flightNumber ? `• ${b.flightNumber}` : ""}</div>
        </td>

        <!-- 8. TRAVEL DATE -->
        <td>
          <span style="font-weight:700; color:#334155; display:inline-flex; align-items:center; gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${escapeHtml(b.travelDateDisplay || b.travelDate || "Flexible")}
          </span>
        </td>

        <!-- 9. DEADLINE -->
        <td>
          <div class="fareos-deadline-wrap">
            <span class="fareos-deadline-text ${b.isOverdue ? "overdue" : ""}">${escapeHtml(b.deadline || "On Schedule")}</span>
            ${b.isOverdue ? `<div class="fareos-deadline-bar"></div>` : ""}
          </div>
        </td>

        <!-- 10. PASSENGER NAME -->
        <td>
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-weight:800; color:#0F172A; text-transform:uppercase;">${escapeHtml(b.passengerName || "VALUED PASSENGER")}</span>
            <button style="background:none; border:none; padding:0; color:#94A3B8; cursor:pointer;" onclick="openBookingDrawer('${b.id}')" title="Inspect Traveler Vault">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
          </div>
        </td>

        <!-- 11. AMOUNT -->
        <td>
          <span style="font-weight:800; color:#0F172A;">${amtStr}</span>
        </td>

        <!-- 12. AIR TYPE -->
        <td>
          <span style="font-size:11.5px; font-weight:700; color:#475569; display:inline-flex; align-items:center; gap:4px;">
            ${b.airType === "Domestic" ? "✈️ Domestic" : "🌐 International"}
          </span>
        </td>

        <!-- 13. CUSTOMER -->
        <td>
          <span style="font-weight:600; color:#334155;">${escapeHtml(b.customer || b.passengerName || "Customer")}</span>
        </td>

        <!-- 14. PHONE -->
        <td>
          <a href="https://wa.me/${cleanPhone(b.phone)}?text=Hi%20${encodeURIComponent(b.customer || "Traveler")},%20regarding%20your%20Flyvis%20booking%20${b.id}..." target="_blank" style="text-decoration:none; color:#059669; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
            ${escapeHtml(b.phone || "-")}
          </a>
        </td>

        <!-- 15. CUSTOMER TYPE -->
        <td>
          <span style="font-size:10.5px; font-weight:800; color:#64748B; background:#F1F5F9; padding:3px 7px; border-radius:4px;">
            ${escapeHtml(b.customerType || "REGULAR")}
          </span>
        </td>

        <!-- 16. ACTIONS -->
        <td style="text-align:center;">
          <button class="fareos-btn-tool" style="padding:4px 8px; font-size:11.5px;" onclick="openBookingDrawer('${b.id}')">
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

  // Mark as viewed if it was unviewed
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
  // Update local memory
  const target = allBookings.find((b) => b.id === bookingId);
  if (target) {
    Object.assign(target, updateFields);
    renderTableAndKPIs();
  }

  // Sync to Firestore
  if (typeof db !== "undefined") {
    try {
      await db.collection("flight_bookings").doc(bookingId).update(updateFields);
      console.log("✅ Firestore updated:", bookingId, updateFields);
    } catch (e) {
      console.warn("Firestore update notice:", e);
    }
  }

  // Sync to Server REST API
  try {
    await fetch("/api/flight-bookings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookingId, ...updateFields })
    });
  } catch (e) {
    console.log("Local API update notice:", e);
  }
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
  document.querySelectorAll("[id$=\"-menu\"]").forEach((m) => m.style.display = "none");
  menu.style.display = isShown ? "none" : "block";
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".fareos-btn-tool") && !e.target.closest("[id$=\"-menu\"]")) {
    document.querySelectorAll("[id$=\"-menu\"]").forEach((m) => m.style.display = "none");
  }
});

function setDateFilter(rangeKey, label) {
  activeFilters.dateRange = rangeKey;
  document.getElementById("selected-date-label").textContent = label;
  document.querySelectorAll("#date-filter-menu .fareos-dropdown-item").forEach((item) => item.classList.remove("active"));
  event.target.classList.add("active");
  toggleDropdown("date-filter-menu");
  renderBookingsTable();
}

function setTxnFilter(txnKey, label) {
  activeFilters.txnType = txnKey;
  document.getElementById("selected-txn-label").textContent = label;
  document.querySelectorAll("#txn-filter-menu .fareos-dropdown-item").forEach((item) => item.classList.remove("active"));
  event.target.classList.add("active");
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
  activeFilters = {
    search: "",
    dateRange: "7d",
    txnType: "all",
    status: "all",
    payment: "all",
    owner: "all",
    airType: "all"
  };

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

  // Dual Sync
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
  toast.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:999999;background:#0F172A;color:#FFFFFF;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.25);border-left:4px solid #2563EB;";
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
    f.write(js_content)
print("js/admin_flight_bookings.js created.")
