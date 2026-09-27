// FareOS Admin - Accounting Logs Console & Detail Viewer
// Matching media_1789327428289.png and media_1789327421650.png
(function() {
  "use strict";

  let allLogs = [];
  let currentFiltered = [];
  let activeLogForModal = null;

  const filters = {
    searchBookingRef: "",
    searchPortalId: "",
    client: "All Clients",
    dateRange: "all",
    dateLabel: "Today",
    status: "all",
    type: "all",
    docSeries: "all"
  };

  document.addEventListener("DOMContentLoaded", () => {
    initPersona();
    loadAccountingLogs();
    setupEventListeners();
  });

  // Persona
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
    showToast("Switched active admin to " + name);
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

  function showToast(msg) {
    let t = document.getElementById("acc-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "acc-toast";
      t.style.cssText = "position:fixed; bottom:24px; right:24px; background:#0F172A; color:#FFF; padding:10px 18px; border-radius:8px; font-size:13px; font-weight:600; box-shadow:0 10px 25px rgba(0,0,0,0.25); z-index:999999; transition:opacity 0.2s ease;";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    t.style.display = "block";
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => { t.style.display = "none"; }, 200);
    }, 2800);
  }

  // Load Data
  async function loadAccountingLogs() {
    const tbody = document.getElementById("acc-table-body");
    if (tbody) {
      tbody.innerHTML = "<tr><td colspan=\"10\" style=\"text-align:center; padding:32px; color:#64748B;\">Loading accounting logs...</td></tr>";
    }

    try {
      const res = await fetch("data/accounting_logs.json");
      if (res.ok) {
        allLogs = await res.json();
      }
    } catch (e) {
      console.warn("Could not load data/accounting_logs.json:", e);
    }

    applyFilters();
  }

  function setupEventListeners() {
    const sBooking = document.getElementById("acc-search-booking");
    if (sBooking) {
      sBooking.addEventListener("input", (e) => {
        filters.searchBookingRef = e.target.value.trim().toLowerCase();
        applyFilters();
      });
    }

    const sPortal = document.getElementById("acc-search-portal");
    if (sPortal) {
      sPortal.addEventListener("input", (e) => {
        filters.searchPortalId = e.target.value.trim().toLowerCase();
        applyFilters();
      });
    }

    // Close quick menus on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#acc-client-select-btn") && !e.target.closest("#acc-client-menu")) {
        const m = document.getElementById("acc-client-menu");
        if (m) m.style.display = "none";
      }
      if (!e.target.closest("#acc-quick-date-btn") && !e.target.closest("#acc-quick-date-menu")) {
        const m = document.getElementById("acc-quick-date-menu");
        if (m) m.style.display = "none";
      }
      if (!e.target.closest("#admin-persona-dropdown") && !e.target.closest("#header-user-avatar")) {
        const m = document.getElementById("admin-persona-dropdown");
        if (m) m.style.display = "none";
      }
    });
  }

  window.toggleClientMenu = function(e) {
    if (e) e.stopPropagation();
    const m = document.getElementById("acc-client-menu");
    if (m) m.style.display = m.style.display === "block" ? "none" : "block";
  };

  window.setClientFilter = function(client, label) {
    filters.client = client;
    const labelEl = document.getElementById("acc-selected-client-label");
    if (labelEl) labelEl.textContent = label;

    const items = document.querySelectorAll("#acc-client-menu .quick-date-item");
    items.forEach(item => {
      const spanText = item.querySelector("span") ? item.querySelector("span").textContent.trim() : item.textContent.trim();
      if (spanText === label) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    const m = document.getElementById("acc-client-menu");
    if (m) m.style.display = "none";
    applyFilters();
  };

  window.toggleQuickDateMenu = function(e) {
    if (e) e.stopPropagation();
    const m = document.getElementById("acc-quick-date-menu");
    if (m) m.style.display = m.style.display === "block" ? "none" : "block";
  };

  window.setDateFilter = function(range, label) {
    filters.dateRange = range;
    filters.dateLabel = label;
    const labelEl = document.getElementById("acc-selected-date-label");
    if (labelEl) labelEl.textContent = label;
    const m = document.getElementById("acc-quick-date-menu");
    if (m) m.style.display = "none";
    applyFilters();
  };

  window.toggleFilterOptions = function() {
    const drawer = document.getElementById("acc-advanced-filters");
    const btn = document.getElementById("acc-filter-options-btn");
    if (!drawer) return;
    const isHidden = drawer.style.display === "none";
    drawer.style.display = isHidden ? "block" : "none";
    if (btn) {
      if (isHidden) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  };

  window.handleStatusFilterChange = function(val) {
    filters.status = val;
    applyFilters();
  };

  window.handleTypeFilterChange = function(val) {
    filters.type = val;
    applyFilters();
  };

  window.handleDocSeriesFilterChange = function(val) {
    filters.docSeries = val;
    applyFilters();
  };

  window.refreshAccountingLogs = function() {
    loadAccountingLogs();
    showToast("Refreshed accounting logs data");
  };

  // Filter & Render
  function applyFilters() {
    currentFiltered = allLogs.filter(item => {
      if (filters.searchBookingRef && !item.bookingRef.toLowerCase().includes(filters.searchBookingRef)) {
        return false;
      }
      if (filters.searchPortalId && !item.portalId.toLowerCase().includes(filters.searchPortalId)) {
        return false;
      }
      if (filters.client && filters.client !== "All Clients" && item.client !== filters.client) {
        return false;
      }
      if (filters.status !== "all" && item.status !== filters.status) {
        return false;
      }
      if (filters.type !== "all" && item.type !== filters.type) {
        return false;
      }
      if (filters.docSeries !== "all" && item.docSeries !== filters.docSeries) {
        return false;
      }
      if (filters.dateRange === "today") {
        if (!item.date.includes("07/09/2026")) return false;
      } else if (filters.dateRange === "yesterday") {
        if (!item.date.includes("06/09/2026")) return false;
      } else if (filters.dateRange === "7d") {
        const day = parseInt(item.date.substring(0, 2), 10);
        if (day < 1 || day > 7) return false;
      }
      return true;
    });

    renderTable();
    updateCountBadge();
  }

  function updateCountBadge() {
    const badge = document.getElementById("acc-records-count");
    if (badge) {
      badge.textContent = currentFiltered.length + " Records";
    }
  }

  function renderTable() {
    const tbody = document.getElementById("acc-table-body");
    if (!tbody) return;

    if (currentFiltered.length === 0) {
      tbody.innerHTML = "<tr><td colspan=\"10\" style=\"text-align:center; padding:36px; color:#94A3B8; font-size:13px;\">No accounting records match the active filters.</td></tr>";
      return;
    }

    let html = "";
    currentFiltered.forEach((log, idx) => {
      const rowNum = idx + 1;

      // Status pill
      let statusClass = "failed";
      if (log.status === "successful") statusClass = "successful";
      else if (log.status === "exhausted") statusClass = "exhausted";

      const statusHtml = `<span class="acc-status-pill ${statusClass}">${log.statusLabel}</span>`;

      // Error block
      let errorHtml = "—";
      if (log.errorCategory) {
        const catClass = log.errorCategory.toLowerCase();
        errorHtml = `<span class="acc-error-badge ${catClass}">${log.errorCategory}</span><span class="acc-error-text" title="${escapeHtml(log.errorText)}">${escapeHtml(log.errorText)}</span>`;
      }

      // Actions
      const retryBtn = (log.status !== "successful")
        ? `<button type="button" class="acc-action-btn-retry" onclick="retryPosting('${log.id}', event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Retry</button>`
        : "";

      html += `
        <tr>
          <td style="color:#64748B; font-weight:600;">${rowNum}</td>
          <td>${log.date}</td>
          <td><span class="acc-link-booking" onclick="openLogDetail('${log.id}')">${log.bookingRef}</span></td>
          <td style="color:#475569;">${log.portalId}</td>
          <td style="font-weight:600; color:#1E293B;">${log.type}</td>
          <td style="color:#64748B; font-weight:700;">${log.docSeries}</td>
          <td>${statusHtml}</td>
          <td style="color:#64748B; font-weight:600;">${log.retries}</td>
          <td>${errorHtml}</td>
          <td>
            <button type="button" class="acc-action-btn-view" onclick="openLogDetail('${log.id}')">View</button>
            ${retryBtn}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Detail Modal
  window.openLogDetail = function(logId) {
    const log = allLogs.find(l => l.id === logId);
    if (!log) return;
    activeLogForModal = log;

    const modal = document.getElementById("acc-detail-modal");
    if (!modal) return;

    // Title & Client Badge
    const titleEl = document.getElementById("acc-modal-title-text");
    if (titleEl) titleEl.textContent = `ACCOUNTING LOG DETAIL #${log.id}`;

    const clientBadge = document.getElementById("acc-modal-client-badge");
    if (clientBadge) clientBadge.textContent = log.client || "All Clients";

    // Top Card 1: Status
    const statusValEl = document.getElementById("acc-modal-status-val");
    if (statusValEl) {
      let statusClass = "failed";
      if (log.status === "successful") statusClass = "successful";
      else if (log.status === "exhausted") statusClass = "exhausted";
      statusValEl.innerHTML = `<span class="acc-status-pill ${statusClass}">${log.statusLabel}</span>`;
    }

    // Top Card 2: Booking Ref
    const bRefEl = document.getElementById("acc-modal-booking-ref");
    if (bRefEl) bRefEl.textContent = log.bookingRef;

    // Top Card 3: Portal ID
    const portalEl = document.getElementById("acc-modal-portal-id");
    if (portalEl) portalEl.textContent = log.portalId;

    // Top Card 4: Type / Series
    const typeSeriesEl = document.getElementById("acc-modal-type-series");
    if (typeSeriesEl) typeSeriesEl.textContent = `${log.type} (${log.docSeries})`;

    // Row 2: Provider, Provider Ref, Created At, Updated At
    const provEl = document.getElementById("acc-modal-provider");
    if (provEl) provEl.textContent = log.provider;

    const provRefEl = document.getElementById("acc-modal-provider-ref");
    if (provRefEl) provRefEl.textContent = log.providerRef;

    const createdEl = document.getElementById("acc-modal-created-at");
    if (createdEl) createdEl.textContent = log.createdAt;

    const updatedEl = document.getElementById("acc-modal-updated-at");
    if (updatedEl) updatedEl.textContent = log.updatedAt;

    // Retry Information Card
    const retriesEl = document.getElementById("acc-modal-retries");
    if (retriesEl) retriesEl.textContent = log.retries;

    const lastRetryEl = document.getElementById("acc-modal-last-retry");
    if (lastRetryEl) lastRetryEl.textContent = log.lastRetry;

    const nextRetryEl = document.getElementById("acc-modal-next-retry");
    if (nextRetryEl) nextRetryEl.textContent = log.nextRetry;

    // Why It Failed Box
    const whyFailedBox = document.getElementById("acc-modal-why-failed-box");
    if (whyFailedBox) {
      if (log.status !== "successful" && log.errorCategory) {
        whyFailedBox.style.display = "block";
        const catBadge = document.getElementById("acc-modal-why-failed-cat");
        const textEl = document.getElementById("acc-modal-why-failed-text");
        if (catBadge) catBadge.textContent = log.errorCategory;
        if (textEl) textEl.textContent = log.errorText;
      } else {
        whyFailedBox.style.display = "none";
      }
    }

    // Technical Detail Card
    const techBox = document.getElementById("acc-modal-tech-box");
    const techVal = document.getElementById("acc-modal-tech-val");
    if (techBox && techVal) {
      if (log.technicalDetail) {
        techBox.style.display = "block";
        techVal.textContent = log.technicalDetail;
      } else {
        techBox.style.display = "none";
      }
    }

    // Request Payload
    const reqCodeEl = document.getElementById("acc-modal-request-payload");
    if (reqCodeEl) {
      reqCodeEl.textContent = log.requestPayload || "No request payload recorded";
      reqCodeEl.style.color = log.requestPayload ? "#34D399" : "#64748B";
    }

    // Response Payload
    const resCodeEl = document.getElementById("acc-modal-response-payload");
    if (resCodeEl) {
      resCodeEl.textContent = log.responsePayload || "No response payload recorded";
      resCodeEl.style.color = log.responsePayload ? "#34D399" : "#64748B";
    }

    // Bottom Retry Button
    const mainRetryBtn = document.getElementById("acc-modal-main-retry-btn");
    if (mainRetryBtn) {
      if (log.status === "successful") {
        mainRetryBtn.style.display = "none";
      } else {
        mainRetryBtn.style.display = "inline-flex";
        mainRetryBtn.disabled = false;
        mainRetryBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Retry This Posting`;
      }
    }

    modal.style.display = "flex";
  };

  window.closeLogDetailModal = function() {
    const modal = document.getElementById("acc-detail-modal");
    if (modal) modal.style.display = "none";
    activeLogForModal = null;
  };

  // Copy Payload Helpers
  window.copyRequestPayload = function() {
    if (!activeLogForModal) return;
    const text = activeLogForModal.requestPayload || "No request payload recorded";
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied Request Payload to clipboard");
    });
  };

  window.copyResponsePayload = function() {
    if (!activeLogForModal) return;
    const text = activeLogForModal.responsePayload || "No response payload recorded";
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied Response Payload to clipboard");
    });
  };

  // Interactive Retry Action
  window.retryPosting = function(logId, event) {
    if (event) event.stopPropagation();
    const log = allLogs.find(l => l.id === logId);
    if (!log) return;

    showToast(`🔄 Re-attempting posting to ${log.provider} for ${log.bookingRef}...`);

    const mainRetryBtn = document.getElementById("acc-modal-main-retry-btn");
    if (mainRetryBtn && activeLogForModal && activeLogForModal.id === logId) {
      mainRetryBtn.disabled = true;
      mainRetryBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Processing Retry...`;
    }

    setTimeout(() => {
      // Simulate successful re-posting
      log.status = "successful";
      log.statusLabel = "Accounting push successful";
      log.retries = "1/3";
      log.providerRef = "INV-2026-" + Math.floor(2000 + Math.random() * 8000);
      log.updatedAt = new Date().toISOString().replace("T", " ").substring(0, 19);
      log.lastRetry = log.updatedAt;
      log.errorCategory = null;
      log.errorText = "—";
      log.technicalDetail = `Posting resolved via automated retry mechanism to ${log.provider} ledger`;
      log.requestPayload = JSON.stringify({
        booking_ref: log.bookingRef,
        portal_id: log.portalId,
        type: log.type,
        doc_series: log.docSeries,
        retry_sequence: 1
      }, null, 2);
      log.responsePayload = JSON.stringify({
        status: "200 OK",
        provider: log.provider,
        ref: log.providerRef,
        posted_at: log.updatedAt,
        message: "Ledger posting verified and balanced"
      }, null, 2);

      applyFilters();

      if (activeLogForModal && activeLogForModal.id === logId) {
        openLogDetail(logId);
      }

      showToast(`✓ Successfully posted ${log.bookingRef} (${log.type}) to ${log.provider}!`);
    }, 700);
  };

  // Modal retry trigger
  window.triggerModalRetry = function() {
    if (activeLogForModal) {
      retryPosting(activeLogForModal.id);
    }
  };

  // Export Accounting Logs to CSV / Excel
  window.exportAccountingLogsCSV = function() {
    if (!currentFiltered || currentFiltered.length === 0) {
      showToast("No accounting records to export");
      return;
    }

    const headers = [
      "Log ID", "Date", "Booking Ref", "Portal ID", "Client", "Document Type",
      "Doc Series", "Status", "Retries", "Provider", "Provider Ref",
      "Error Category", "Error Detail", "Technical Detail"
    ];

    const rows = currentFiltered.map(l => [
      l.id,
      `"${l.date}"`,
      l.bookingRef,
      l.portalId,
      `"${l.client || 'All Clients'}"`,
      `"${l.type}"`,
      l.docSeries,
      `"${l.statusLabel || l.status}"`,
      l.retries,
      l.provider,
      l.providerRef,
      `"${l.errorCategory || ''}"`,
      `"${(l.errorText || '').replace(/"/g, '""')}"`,
      `"${(l.technicalDetail || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${currentFiltered.length} accounting records to CSV / Excel`);
  };

})();

