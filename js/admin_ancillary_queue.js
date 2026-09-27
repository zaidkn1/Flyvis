/**
 * FareOS - Ancillary Manual Queue Controller
 * Handles post-booking ancillary requests, manual pricing, SLA monitoring, and fulfillment.
 */
(function() {
  "use strict";

  let queueItems = [];
  let currentActiveItem = null;

  document.addEventListener("DOMContentLoaded", () => {
    initPersona();
    loadAncillaryQueue();
    setupEventListeners();
  });

  function initPersona() {
    const saved = localStorage.getItem("fareos_active_admin");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        const nameEl = document.getElementById("header-user-name");
        const roleEl = document.getElementById("header-user-role");
        const avEl = document.getElementById("header-user-avatar");
        if (nameEl) nameEl.textContent = p.name;
        if (roleEl) roleEl.textContent = p.role;
        if (avEl) avEl.textContent = p.initial || p.name.charAt(0);
      } catch (e) {}
    }
  }

  window.toggleUserMenu = function() {
    const menu = document.getElementById("admin-persona-dropdown");
    if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
  };

  window.switchCurrentAdmin = function(name, role, initial) {
    localStorage.setItem("fareos_active_admin", JSON.stringify({ name, role, initial }));
    initPersona();
    const menu = document.getElementById("admin-persona-dropdown");
    if (menu) menu.style.display = "none";
  };

  window.logoutAdmin = function() {
    if (confirm("Are you sure you want to sign out?")) {
      window.location.href = "admin-login.html";
    }
  };

  window.toggleSidebar = function() {
    const aside = document.getElementById("admin-sidebar");
    const main = document.querySelector(".admin-main");
    if (!aside || !main) return;
    if (aside.style.display === "none") {
      aside.style.display = "block";
      main.style.marginLeft = "200px";
      main.style.width = "calc(100% - 200px)";
    } else {
      aside.style.display = "none";
      main.style.marginLeft = "0";
      main.style.width = "100%";
    }
  };

  function setupEventListeners() {
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#admin-persona-dropdown") && !e.target.closest("#header-user-avatar")) {
        const m = document.getElementById("admin-persona-dropdown");
        if (m) m.style.display = "none";
      }
    });

    // Close modal on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAncModal();
    });
  }

  window.loadAncillaryQueue = async function() {
    try {
      const res = await fetch("data/ancillaries.json");
      if (res.ok) {
        queueItems = await res.json();
      }
    } catch (e) {
      console.warn("Could not fetch data/ancillaries.json:", e);
      queueItems = [];
    }

    // Merge any locally requested ancillaries from customer session
    try {
      const customRaw = localStorage.getItem("flyvis_post_booking_ancillaries");
      if (customRaw) {
        const customItems = JSON.parse(customRaw);
        if (Array.isArray(customItems)) {
          // Put custom ones on top
          const existingIds = new Set(queueItems.map(q => q.ancillaryRef));
          customItems.forEach(c => {
            if (!existingIds.has(c.ancillaryRef)) {
              queueItems.unshift(c);
            }
          });
        }
      }
    } catch (e) {}

    // Check SLA timers
    checkSlaOverdue();
    applyFilters();
  };

  function checkSlaOverdue() {
    const now = new Date();
    queueItems.forEach(item => {
      if (item.manualSlaDeadline) {
        const deadline = new Date(item.manualSlaDeadline);
        if (now > deadline && item.status !== "FULFILLED" && item.status !== "REJECTED") {
          item.isOverdue = true;
        }
      }
    });
  }

  function formatINR(num) {
    if (num == null) return "₹0.00";
    return "₹" + Number(num).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  window.applyFilters = function() {
    const statusVal = document.getElementById("anc-status-filter")?.value || "ALL";
    const providerVal = document.getElementById("anc-provider-filter")?.value || "ALL";
    const searchVal = (document.getElementById("universal-search")?.value || "").toLowerCase().trim();

    const filtered = queueItems.filter(item => {
      if (statusVal !== "ALL" && item.status !== statusVal) return false;
      if (providerVal !== "ALL" && item.provider !== providerVal) return false;
      if (searchVal) {
        const matchRef = (item.ancillaryRef || "").toLowerCase().includes(searchVal);
        const matchBook = (item.bookingRef || "").toLowerCase().includes(searchVal);
        const matchCust = (item.customer || "").toLowerCase().includes(searchVal);
        const matchRoute = (item.route || "").toLowerCase().includes(searchVal);
        const matchPnr = (item.pnr || "").toLowerCase().includes(searchVal);
        if (!matchRef && !matchBook && !matchCust && !matchRoute && !matchPnr) return false;
      }
      return true;
    });

    renderTable(filtered);
    updateCounters(filtered.length);
  };

  window.resetFilters = function() {
    const sf = document.getElementById("anc-status-filter");
    const pf = document.getElementById("anc-provider-filter");
    const us = document.getElementById("universal-search");
    if (sf) sf.value = "ALL";
    if (pf) pf.value = "ALL";
    if (us) us.value = "";
    applyFilters();
  };

  window.handleSearch = function() {
    applyFilters();
  };

  function updateCounters(count) {
    const el = document.getElementById("records-count-text");
    if (el) el.textContent = `${count} RECORDS`;

    const pendingCount = queueItems.filter(q => q.status === "AWAITING_MANUAL_REVIEW").length;
    const badgeEl = document.getElementById("sidebar-anc-count");
    if (badgeEl) {
      badgeEl.textContent = pendingCount;
      badgeEl.style.display = pendingCount > 0 ? "inline-block" : "none";
    }
  }

  function renderTable(items) {
    const tbody = document.getElementById("anc-table-tbody");
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="14" style="text-align:center; padding:40px 20px; color:#94A3B8;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2" style="margin-bottom:8px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div style="font-weight:700; font-size:13px; color:#64748B;">No ancillary orders match the current filter</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    items.forEach((item, index) => {
      // Status badge
      let statusBadge = "";
      if (item.status === "AWAITING_MANUAL_REVIEW") {
        statusBadge = `<span class="badge-status-awaiting">AWAITING_MANUAL_REVIEW</span>`;
      } else if (item.status === "IN_REVIEW") {
        statusBadge = `<span class="badge-status-review">IN_REVIEW</span>`;
      } else if (item.status === "FULFILLED") {
        statusBadge = `<span class="badge-status-fulfilled">FULFILLED</span>`;
      } else {
        statusBadge = `<span class="badge-status-rejected">${item.status}</span>`;
      }

      // SLA display
      const slaStr = item.manualSlaDeadline || "2026-07-31T05:09:06.0296Z";
      const slaBadge = item.isOverdue 
        ? `<span class="badge-overdue">OVERDUE</span>` 
        : (item.status === "FULFILLED" ? "" : `<span class="badge-ontrack">ACTIVE</span>`);

      // Financials
      const ancTotalHtml = item.ancillaryTotal != null 
        ? `<span style="font-weight:700;">${formatINR(item.ancillaryTotal)}</span>` 
        : `<span style="color:#94A3B8;">Not priced yet</span>`;

      const svcChargeHtml = item.serviceCharge != null 
        ? `<span style="font-weight:600;">${formatINR(item.serviceCharge)}</span>` 
        : `<span style="color:#94A3B8;">Not priced yet</span>`;

      const platformFeeHtml = item.platformFee != null 
        ? `<span style="font-weight:600;">${formatINR(item.platformFee)}</span>` 
        : `<span style="color:#94A3B8;">Not priced yet</span>`;

      const payableHtml = item.payable != null 
        ? `<span style="font-weight:800; color:#16A34A;">${formatINR(item.payable)}</span>` 
        : `<span style="color:#94A3B8;">Not priced yet</span>`;

      html += `
        <tr>
          <td style="color:#64748B; font-weight:700;">${index + 1}</td>
          <td>
            <a href="javascript:void(0)" onclick="openAncModal('${item.ancillaryRef}')" style="color:#2563EB; font-weight:800; text-decoration:none;">
              ${item.ancillaryRef}
            </a>
          </td>
          <td>
            <a href="admin-flight-booking-detail.html?id=${item.bookingRef}" style="color:#475569; font-weight:700; text-decoration:none;">
              ${item.bookingRef}
            </a>
          </td>
          <td style="font-weight:800; color:#0F172A;">${item.provider || "AMGS"}</td>
          <td>${statusBadge}</td>
          <td style="font-family:monospace; font-weight:600; color:#475569;">${item.routingReason || "not_supported"}</td>
          <td style="font-weight:700; color:#0F172A;">${item.currency || "INR"}</td>
          <td>
            <span style="font-family:monospace; font-size:10.5px; color:#475569;">${slaStr}</span>
            ${slaBadge}
          </td>
          <td style="font-family:monospace; font-size:10.5px; color:#64748B;">${item.createdAt || "—"}</td>
          <td>${ancTotalHtml}</td>
          <td>${svcChargeHtml}</td>
          <td>${platformFeeHtml}</td>
          <td>${payableHtml}</td>
          <td style="text-align:center;">
            <button type="button" class="btn-view-anc" onclick="openAncModal('${item.ancillaryRef}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>VIEW</span>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  // ===== Modal Details & Fulfillment Handling =====
  window.openAncModal = function(ancRef) {
    const item = queueItems.find(q => q.ancillaryRef === ancRef);
    if (!item) return;

    currentActiveItem = item;

    document.getElementById("modal-anc-ref").textContent = item.ancillaryRef;
    document.getElementById("modal-booking-ref").textContent = item.bookingRef;
    document.getElementById("modal-provider").textContent = item.provider || "AMGS";
    document.getElementById("modal-customer").textContent = item.customer || "Primary Passenger";
    document.getElementById("modal-phone").textContent = item.phone || "+91 —";
    document.getElementById("modal-route").textContent = `${item.route || 'Sector'} (${item.airline || 'Airline'})`;
    document.getElementById("modal-pnr").textContent = item.pnr || "—";
    document.getElementById("modal-routing-reason").textContent = item.routingReason || "not_supported";
    document.getElementById("modal-notes").textContent = item.notes || "Customer submitted request requiring manual ticketing desk fulfillment.";

    // Status Badge
    const statusBadgeEl = document.getElementById("modal-status-badge");
    if (statusBadgeEl) {
      statusBadgeEl.textContent = item.status;
      statusBadgeEl.className = item.status === "AWAITING_MANUAL_REVIEW" 
        ? "badge-status-awaiting" 
        : (item.status === "FULFILLED" ? "badge-status-fulfilled" : "badge-status-review");
    }

    // Render items list
    const itemsCont = document.getElementById("modal-items-container");
    if (itemsCont) {
      if (item.items && item.items.length > 0) {
        itemsCont.innerHTML = item.items.map(it => `
          <div style="background:#F1F5F9; border:1px solid #CBD5E1; border-radius:6px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; color:#0F172A; font-size:12.5px;">${it.name}</div>
              <div style="font-size:11px; color:#64748B;">${it.details || ''}</div>
            </div>
            <span style="font-size:10.5px; font-weight:700; background:#E2E8F0; color:#334155; padding:2px 8px; border-radius:10px;">${it.status || 'Requested'}</span>
          </div>
        `).join("");
      } else {
        itemsCont.innerHTML = `<div style="font-size:12px; color:#94A3B8;">No specific items attached</div>`;
      }
    }

    // Set pricing inputs
    document.getElementById("input-anc-total").value = item.ancillaryTotal || "";
    document.getElementById("input-svc-charge").value = item.serviceCharge || "";
    document.getElementById("input-platform-fee").value = item.platformFee || "";
    calcPayable();

    const modal = document.getElementById("anc-detail-modal");
    if (modal) modal.style.display = "flex";
  };

  window.closeAncModal = function() {
    const modal = document.getElementById("anc-detail-modal");
    if (modal) modal.style.display = "none";
    currentActiveItem = null;
  };

  window.calcPayable = function() {
    const anc = parseFloat(document.getElementById("input-anc-total")?.value) || 0;
    const svc = parseFloat(document.getElementById("input-svc-charge")?.value) || 0;
    const fee = parseFloat(document.getElementById("input-platform-fee")?.value) || 0;
    const total = anc + svc + fee;

    const el = document.getElementById("modal-calc-payable");
    if (el) el.textContent = formatINR(total);
    return total;
  };

  window.fulfillAncOrder = function() {
    if (!currentActiveItem) return;

    const emd = prompt("Enter Airline EMD / Ticket Document Reference Number:", currentActiveItem.emdNumber || `098-${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    if (emd === null) return;

    const ancTotal = parseFloat(document.getElementById("input-anc-total")?.value) || 0;
    const svcCharge = parseFloat(document.getElementById("input-svc-charge")?.value) || 0;
    const platformFee = parseFloat(document.getElementById("input-platform-fee")?.value) || 0;
    const totalPayable = ancTotal + svcCharge + platformFee;

    currentActiveItem.status = "FULFILLED";
    currentActiveItem.isOverdue = false;
    currentActiveItem.ancillaryTotal = ancTotal;
    currentActiveItem.serviceCharge = svcCharge;
    currentActiveItem.platformFee = platformFee;
    currentActiveItem.payable = totalPayable;
    currentActiveItem.emdNumber = emd;

    if (currentActiveItem.items) {
      currentActiveItem.items.forEach(it => it.status = "EMD Issued");
    }

    saveLocalState();
    closeAncModal();
    applyFilters();
    alert(`Order ${currentActiveItem.ancillaryRef} marked as FULFILLED!\nEMD ${emd} attached to booking ${currentActiveItem.bookingRef}.`);
  };

  window.markInReview = function() {
    if (!currentActiveItem) return;
    currentActiveItem.status = "IN_REVIEW";
    currentActiveItem.ancillaryTotal = parseFloat(document.getElementById("input-anc-total")?.value) || null;
    currentActiveItem.serviceCharge = parseFloat(document.getElementById("input-svc-charge")?.value) || null;
    currentActiveItem.platformFee = parseFloat(document.getElementById("input-platform-fee")?.value) || null;
    currentActiveItem.payable = calcPayable();

    saveLocalState();
    closeAncModal();
    applyFilters();
  };

  window.rejectAncOrder = function() {
    if (!currentActiveItem) return;
    if (confirm(`Reject ancillary request ${currentActiveItem.ancillaryRef}? Passenger will be notified and any pending charge cancelled.`)) {
      currentActiveItem.status = "REJECTED";
      saveLocalState();
      closeAncModal();
      applyFilters();
    }
  };

  function saveLocalState() {
    try {
      localStorage.setItem("flyvis_post_booking_ancillaries", JSON.stringify(queueItems));
    } catch (e) {}
  }

  // ===== CSV Export =====
  window.exportAncillariesCSV = function() {
    if (!queueItems || queueItems.length === 0) {
      alert("No ancillary records to export.");
      return;
    }

    const headers = [
      "S.No", "Ancillary Reference", "Booking Reference", "Provider", "Status",
      "Routing Reason", "Currency", "Manual SLA Deadline", "Overdue", "Created At",
      "Ancillary Total", "Service Charge", "Platform Fee", "Payable", "Customer", "Route", "PNR", "EMD"
    ];

    const rows = queueItems.map((item, idx) => [
      idx + 1,
      `"${item.ancillaryRef || ''}"`,
      `"${item.bookingRef || ''}"`,
      `"${item.provider || ''}"`,
      `"${item.status || ''}"`,
      `"${item.routingReason || ''}"`,
      `"${item.currency || 'INR'}"`,
      `"${item.manualSlaDeadline || ''}"`,
      item.isOverdue ? "YES" : "NO",
      `"${item.createdAt || ''}"`,
      item.ancillaryTotal != null ? item.ancillaryTotal : "",
      item.serviceCharge != null ? item.serviceCharge : "",
      item.platformFee != null ? item.platformFee : "",
      item.payable != null ? item.payable : "",
      `"${(item.customer || '').replace(/"/g, '""')}"`,
      `"${item.route || ''}"`,
      `"${item.pnr || ''}"`,
      `"${item.emdNumber || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ancillary_manual_queue_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

})();
