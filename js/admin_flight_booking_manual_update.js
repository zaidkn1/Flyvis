/**
 * FareOS Enterprise Manual Booking Update Controller (Standalone Page)
 * js/admin_flight_booking_manual_update.js
 */

let currentBooking = null;
let currentBookingId = null;
let allBookings = [];
let activeManualTab = "info";
let isDraftSaved = false;
let manualDraft = null;

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

  const urlParams = new URLSearchParams(window.location.search);
  let bId = urlParams.get("id");
  if (!bId && window.location.hash) {
    bId = window.location.hash.replace("#", "").replace("booking/", "").trim();
  }
  if (!bId) bId = "BKNG-6423336"; // Default sample matching screenshot
  currentBookingId = bId;

  // Set Back link to booking detail page
  const backLink = document.getElementById("back-to-booking-link");
  if (backLink) {
    backLink.href = `admin-flight-booking-detail.html?id=${encodeURIComponent(bId)}`;
  }

  await initManualUpdateData(bId);
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
  else if (currentAdmin.name.includes("Support")) document.getElementById("persona-support")?.classList.add("active");
}

async function initManualUpdateData(bookingId) {
  // Load bookings
  try {
    const saved = localStorage.getItem("fareos_all_bookings");
    if (saved) {
      allBookings = JSON.parse(saved);
      currentBooking = allBookings.find((b) => b.id === bookingId);
    }
  } catch (e) {}

  if (!currentBooking) {
    try {
      const res = await fetch("data/flight_bookings.json");
      if (res.ok) {
        const data = await res.json();
        allBookings = data;
        currentBooking = allBookings.find((b) => b.id === bookingId);
      }
    } catch (e) {}
  }

  if (!currentBooking) {
    // Fallback sample matching BKNG-6423336
    currentBooking = createSampleManualBooking(bookingId);
  }

  // Check if draft exists in localStorage
  try {
    const draftStr = localStorage.getItem(`fareos_draft_${bookingId}`);
    if (draftStr) {
      manualDraft = JSON.parse(draftStr);
      isDraftSaved = true;
    }
  } catch (e) {}

  if (!manualDraft) {
    manualDraft = JSON.parse(JSON.stringify(currentBooking));
    // Initialize default fields if missing
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

  document.getElementById("page-mu-booking-id").textContent = manualDraft.id;
  updateDraftActionButtons();
  renderManualTabContent();
  recalculateSummaryTotals();
}

function switchManualUpdateTab(tabKey) {
  activeManualTab = tabKey;
  
  // Update Tab Buttons styling
  document.querySelectorAll(".fareos-mu-tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.getElementById(`p-mu-tab-${tabKey}`)?.classList.add("active");

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
      <!-- Accordion Header matching media_1789302133958.png -->
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

      <!-- Segment Items View -->
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
    let typeIcon = "🛂";
    if (doc.type === "Visa") {
      typeBadgeColor = "#059669";
      typeBadgeBg = "#ECFDF5";
      typeIcon = "📋";
    } else if (doc.type === "National ID") {
      typeBadgeColor = "#7C3AED";
      typeBadgeBg = "#F5F3FF";
      typeIcon = "🪪";
    } else if (doc.type === "Travel Insurance") {
      typeBadgeColor = "#D97706";
      typeBadgeBg = "#FEF3C7";
      typeIcon = "🛡️";
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

          <button type="button" style="background:none; border:none; color:#EF4444; cursor:pointer; font-size:14px; font-weight:800; padding:4px;" onclick="removeDocumentFromTicket(${idx}, true)" title="Remove document from ticket">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function promptAttachDocumentToTicket(isDraft) {
  const target = manualDraft;
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
}

function removeDocumentFromTicket(index, isDraft) {
  if (!confirm("Are you sure you want to remove this attached document from the ticket?")) return;

  if (manualDraft && manualDraft.documents && manualDraft.documents[index]) {
    manualDraft.documents.splice(index, 1);
    markDraftDirty();
    renderManualTabContent();
    showAdminToast("Removed document from draft");
  }
}

function promptEditPaxApis(paxIdx, isDraft) {
  const target = manualDraft;
  if (!target || !target.passengerList || !target.passengerList[paxIdx]) return;

  const pax = target.passengerList[paxIdx];
  const nameEl = document.getElementById("pax-apis-name");
  if (nameEl) nameEl.textContent = `${pax.title || 'Mr'} ${pax.name || (pax.firstName + ' ' + pax.lastName)}`;

  const idxEl = document.getElementById("pax-apis-index");
  if (idxEl) idxEl.value = paxIdx;

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
  const target = manualDraft;
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
        source: "Admin Manual Update",
        status: "Attached to Ticket",
        uploadedAt: new Date().toISOString()
      });
    }
  }

  markDraftDirty();
  renderManualTabContent();
  closePaxApisModal();
  showAdminToast(`Saved APIS details for ${pax.name}`);
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
    <!-- Top KPI Metrics Banner matching media_1789302133961.png -->
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

  const pgCharge = 1000.00; // matching screenshot '+₹1,000.00'
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
  manualDraft.discountOverride = 500; // Sample discount
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

/**
 * Draft Persistence & Confirm Actions
 */
function markDraftDirty() {
  // If user modifies, note that save is needed to unlock confirm if not saved
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
  if (!manualDraft) return;

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

  if (typeof db !== "undefined") {
    try {
      db.collection("flight_bookings").doc(currentBooking.id).set(currentBooking, { merge: true });
    } catch (e) {}
    try {
      db.collection("flyvis_flight_bookings").doc(currentBooking.id).set(currentBooking, { merge: true });
    } catch (e) {}
  }

  showAdminToast(`✓ Confirmed & Applied update to ${currentBooking.id}!`);

  // Redirect back to booking detail view
  setTimeout(() => {
    window.location.href = `admin-flight-booking-detail.html?id=${encodeURIComponent(currentBooking.id)}`;
  }, 1000);
}

function discardManualDraftAndExit() {
  if (confirm("Discard all unsaved draft updates and return to booking details?")) {
    try {
      localStorage.removeItem(`fareos_draft_${currentBookingId}`);
    } catch (e) {}
    window.location.href = `admin-flight-booking-detail.html?id=${encodeURIComponent(currentBookingId)}`;
  }
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
  if (sb) {
    sb.style.display = sb.style.display === "none" ? "block" : "none";
  }
}

function createSampleManualBooking(id) {
  return {
    id: id || "BKNG-6423336",
    supplierSearch: "flydubai",
    supplierIssued: "flydubai",
    source: "WEB",
    isUnviewed: false,
    bookingDate: "2026-09-01T03:20:00Z",
    paymentStatus: "Paid",
    status: "Failed",
    statusPill: "FAILED /",
    statusDetail: "Booking: FAILED | Ticketing: FAILED",
    ticketingStatus: "Failed",
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
    amount: 20516.31,
    currency: "INR",
    airType: "International",
    customer: "Incidunt Soluta",
    phone: "+91 19861262452",
    customerType: "REGULAR",
    airline: "Flydubai",
    flightNumber: "FZ 816",
    paxCount: 1,
    cabin: "Economy",
    ipAddress: "192.168.0.10",
    passengerList: [
      { title: "mr", name: "Incidunt Soluta", type: "ADULT", seat: "14A" }
    ],
    segments: [
      {
        segmentNum: 1,
        airline: "Flydubai",
        flightNumber: "FZ816",
        aircraft: "73D",
        origin: "AHB",
        depTime: "07:45 AM",
        depDate: "24 Feb 2027",
        dest: "DXB",
        arrTime: "11:20 AM",
        arrDate: "24 Feb 2027",
        cabin: "ECONOMY",
        class: "T",
        fareBasis: "TUTYXSII"
      },
      {
        segmentNum: 2,
        airline: "Flydubai",
        flightNumber: "FZ175",
        aircraft: "73D",
        origin: "DXB",
        depTime: "07:10 PM",
        depDate: "24 Feb 2027",
        dest: "HBE",
        arrTime: "09:40 PM",
        arrDate: "24 Feb 2027",
        cabin: "ECONOMY",
        class: "T",
        fareBasis: "TUTYXSII"
      }
    ],
    priceSummary: {
      baseFare: 13405.6886,
      tax: 7110.6219,
      adultTotal: 20516.31,
      convenienceFee: 1000.00,
      grandTotal: 20516.31
    }
  };
}
