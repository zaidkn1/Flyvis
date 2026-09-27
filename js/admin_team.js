/**
 * FareOS Enterprise Admin Users & RBAC Authorization Hub
 * Handles Super Admin Email Whitelisting, Productivity Telemetry ("How Many Done"),
 * and Active/Passive access controls.
 */

(function () {
  "use strict";

  const STORAGE_KEY = "fareos_authorized_admins_v1";

  // Default pre-seeded admin accounts with productivity stats
  const DEFAULT_ADMINS = [
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
      ],
      activityLog: [
        { time: "Just now", action: "Reviewing Admin Users & Access Authorization Hub", module: "Admin Team" },
        { time: "25 mins ago", action: "Approved manual ticket issuance for PNR 6E-2849 (DEL-BOM)", module: "Flight Bookings" },
        { time: "42 mins ago", action: "Configured markup rule 'Markup Test' in B2B top agents", module: "Markup Master" },
        { time: "2 hours ago", action: "Reconciled Q3 Revenue Ledger against bank settlement", module: "Accounting Logs" }
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
      ],
      activityLog: [
        { time: "14 mins ago", action: "Updated flight ancillary queue: Baggage excess on UK-954", module: "Ancillary Queue" },
        { time: "1 hour ago", action: "Issued e-ticket confirmation receipt for PNR AI-8491", module: "Flight Bookings" },
        { time: "3 hours ago", action: "Approved Dubai Express Visa application #DXB-9921", module: "Visa Operations" }
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
      ],
      activityLog: [
        { time: "2 hours ago", action: "Synchronized NDC fare feed with IndiGo Direct API", module: "Flight Desk" },
        { time: "4 hours ago", action: "Dispatched automated 24/7 price alert check cycle", module: "Flight Desk" },
        { time: "Yesterday", action: "Mapped Amadeus 1A supplier credentials to production desk", module: "Supplier Mapping" }
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
      ],
      activityLog: [
        { time: "4 hours ago", action: "Approved 12 Singapore e-Visa submissions", module: "Visa Operations" },
        { time: "6 hours ago", action: "Updated UAE 30-Day Single Entry government fee schedule", module: "Visa Operations" },
        { time: "Yesterday", action: "Verified biometric arrival documents for Saudi Tourist Visa", module: "Visa Operations" }
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
      ],
      activityLog: [
        { time: "Yesterday", action: "Responded to traveler reschedule request for booking #BK-8291", module: "Customer Support" },
        { time: "2 days ago", action: "Processed baggage add-on payment verification", module: "Ancillary Queue" }
      ]
    }
  ];

  // State
  let admins = [];
  let searchQuery = "";
  let filterRole = "ALL";
  let filterStatus = "ALL";
  let editingAdminId = null;

  function loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      admins = stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULT_ADMINS));
    } catch (e) {
      admins = JSON.parse(JSON.stringify(DEFAULT_ADMINS));
    }
    // Auto-save initial defaults for login page whitelist check
    saveData();
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(admins));
    } catch (e) {
      console.warn("Could not save admins to localStorage", e);
    }
  }

  function isCurrentAdminSuper() {
    try {
      const current = localStorage.getItem("fareos_current_admin") || localStorage.getItem("flyvis_current_admin");
      if (current) {
        const parsed = JSON.parse(current);
        const role = (parsed.role || "").toLowerCase();
        return role.includes("super") || role.includes("lead") || (parsed.name || "").toLowerCase().includes("susen");
      }
    } catch (e) {}
    return true; // Default to true in dev
  }

  function updateKPIs() {
    const total = admins.length;
    const active = admins.filter(a => a.status === "Active").length;
    const superCount = admins.filter(a => a.role.toLowerCase().includes("super") || a.isOwner).length;
    const totalOps = admins.reduce((sum, a) => sum + (a.stats.bookingsProcessed || 0) + (a.stats.visasHandled || 0), 0);

    const elTotal = document.getElementById("kpi-team-total");
    const elActive = document.getElementById("kpi-team-active");
    const elOps = document.getElementById("kpi-team-ops");
    const elSuper = document.getElementById("kpi-team-super");

    if (elTotal) elTotal.textContent = total;
    if (elActive) elActive.textContent = active;
    if (elOps) elOps.textContent = totalOps + "+";
    if (elSuper) elSuper.textContent = superCount;
  }

  function getFilteredAdmins() {
    return admins.filter(a => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (a.name || "").toLowerCase().includes(q);
        const matchEmail = (a.email || "").toLowerCase().includes(q);
        const matchRole = (a.role || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole) return false;
      }
      if (filterRole !== "ALL" && a.role.toUpperCase() !== filterRole.toUpperCase()) return false;
      if (filterStatus !== "ALL" && a.status.toUpperCase() !== filterStatus.toUpperCase()) return false;
      return true;
    });
  }

  function renderAdminTable() {
    const tbody = document.getElementById("team-table-body");
    if (!tbody) return;

    const filtered = getFilteredAdmins();
    const isSuper = isCurrentAdminSuper();

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding:36px; text-align:center; color:#64748B;">
            No admin users found matching current filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(a => {
      const isActive = a.status === "Active";
      const statusLabel = isActive ? "Active" : "Passive";
      const isOwner = Boolean(a.isOwner);

      // Role badge class
      let roleClass = "support";
      if (a.role.toLowerCase().includes("super")) roleClass = "super";
      else if (a.role.toLowerCase().includes("flight")) roleClass = "flight";
      else if (a.role.toLowerCase().includes("visa")) roleClass = "visa";
      else if (a.role.toLowerCase().includes("lead")) roleClass = "super";

      // Productivity metrics format
      const bCount = a.stats.bookingsProcessed || 0;
      const gmvFormatted = a.stats.gmvHandled ? "₹" + (a.stats.gmvHandled / 100000).toFixed(1) + "L GMV" : "";
      const vCount = a.stats.visasHandled ? `${a.stats.visasHandled} visas` : "";
      const mCount = a.stats.markupsCreated ? `${a.stats.markupsCreated} markups` : "";

      const workItems = [];
      if (bCount > 0) workItems.push(`<strong>${bCount} bookings</strong> (${gmvFormatted})`);
      if (vCount) workItems.push(vCount);
      if (mCount) workItems.push(mCount);
      if (workItems.length === 0) workItems.push("Support / Review");

      const workSummary = workItems.join(" &bull; ");

      return `
        <tr id="admin-row-${a.id}">
          <!-- Admin User Details -->
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:34px; height:34px; border-radius:50%; background:${isOwner ? '#2563EB' : '#475569'}; color:#FFFFFF; font-weight:800; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                ${escapeHtml(a.avatar || a.name.charAt(0))}
              </div>
              <div>
                <div style="font-weight:800; color:#0F172A; display:flex; align-items:center; gap:6px;">
                  ${escapeHtml(a.name)}
                  ${isOwner ? `<span style="background:#EFF6FF; color:#2563EB; font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px; border:1px solid #BFDBFE;">SUPER ADMIN</span>` : ""}
                </div>
                <div style="font-size:12px; color:#64748B; font-family:monospace;">${escapeHtml(a.email)}</div>
              </div>
            </div>
          </td>

          <!-- Role & Permissions -->
          <td>
            <span class="admin-role-badge ${roleClass}">${escapeHtml(a.role)}</span>
            <div style="font-size:11px; color:#64748B; margin-top:4px;">
              ${(a.modules || []).slice(0, 3).join(", ")}${a.modules && a.modules.length > 3 ? "..." : ""}
            </div>
          </td>

          <!-- Work Completed ("How Many Done") -->
          <td>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:6px 10px; display:inline-block;">
              <div style="font-size:12px; color:#0F172A;">
                ${workSummary}
              </div>
              <div style="font-size:10.5px; color:#059669; font-weight:700; margin-top:2px;">
                Verified Ops Telemetry
              </div>
            </div>
          </td>

          <!-- Last Active -->
          <td>
            <span style="font-size:12px; color:#334155; font-weight:600;">${escapeHtml(a.lastActive || "Active")}</span>
          </td>

          <!-- Status Pill (Active / Passive) -->
          <td>
            <span class="markup-status-pill ${isActive ? 'active' : 'passive'}" 
                  style="${isOwner ? 'cursor:not-allowed;' : 'cursor:pointer;'}"
                  onclick="${isOwner ? '' : `window.FareOSTeam.toggleStatus('${a.id}')`}"
                  title="${isOwner ? 'Super Admin owner status cannot be changed' : 'Click to toggle Active / Passive'}">
              <span class="markup-status-dot"></span>
              ${statusLabel}
            </span>
          </td>

          <!-- Action Buttons -->
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="btn-admin-secondary" style="padding:4px 9px; font-size:11.5px; gap:4px;" onclick="window.FareOSTeam.viewActivity('${a.id}')" title="View detailed work audit log">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Work Log
              </button>
              ${isOwner ? `
                <span style="font-size:11px; color:#94A3B8; font-weight:700; padding:4px 6px;">Owner</span>
              ` : `
                <button class="btn-admin-secondary" style="padding:4px 9px; font-size:11.5px;" onclick="window.FareOSTeam.editAdmin('${a.id}')" title="Edit permissions">
                  Edit
                </button>
                <button class="btn-admin-secondary" style="padding:4px 8px; font-size:11.5px; color:#EF4444;" onclick="window.FareOSTeam.revokeAccess('${a.id}')" title="Revoke authorization">
                  Revoke
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join("");
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

  // Public Interface
  window.FareOSTeam = {
    init: function () {
      loadData();
      updateKPIs();
      renderAdminTable();
      this.bindEvents();
    },

    bindEvents: function () {
      const searchInput = document.getElementById("team-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", function (e) {
          searchQuery = e.target.value.trim();
          renderAdminTable();
        });
      }

      const roleSelect = document.getElementById("team-filter-role");
      if (roleSelect) {
        roleSelect.addEventListener("change", function (e) {
          filterRole = e.target.value;
          renderAdminTable();
        });
      }

      const statusSelect = document.getElementById("team-filter-status");
      if (statusSelect) {
        statusSelect.addEventListener("change", function (e) {
          filterStatus = e.target.value;
          renderAdminTable();
        });
      }
    },

    openAuthorizeModal: function () {
      editingAdminId = null;
      document.getElementById("modal-admin-title").textContent = "Authorize New Admin Email";
      document.getElementById("auth-admin-name").value = "";
      document.getElementById("auth-admin-email").value = "";
      document.getElementById("auth-admin-email").disabled = false;
      document.getElementById("auth-admin-role").value = "Flight Desk Admin";
      document.getElementById("auth-admin-status").value = "Active";

      // Reset checkboxes
      document.querySelectorAll(".module-checkbox").forEach(cb => {
        cb.checked = cb.getAttribute("data-default-check") === "true";
      });

      const overlay = document.getElementById("modal-authorize-admin");
      if (overlay) overlay.classList.add("open");
    },

    editAdmin: function (adminId) {
      const admin = admins.find(a => a.id === adminId);
      if (!admin) return;

      editingAdminId = adminId;
      document.getElementById("modal-admin-title").textContent = `Edit Admin: ${admin.name}`;
      document.getElementById("auth-admin-name").value = admin.name || "";
      document.getElementById("auth-admin-email").value = admin.email || "";
      document.getElementById("auth-admin-email").disabled = true; // Email cannot be changed once authorized
      document.getElementById("auth-admin-role").value = admin.role || "Flight Desk Admin";
      document.getElementById("auth-admin-status").value = admin.status || "Active";

      document.querySelectorAll(".module-checkbox").forEach(cb => {
        const mod = cb.value;
        cb.checked = (admin.modules || []).includes(mod);
      });

      const overlay = document.getElementById("modal-authorize-admin");
      if (overlay) overlay.classList.add("open");
    },

    saveAdminAuthorization: function () {
      const name = document.getElementById("auth-admin-name").value.trim();
      const email = document.getElementById("auth-admin-email").value.trim().toLowerCase();
      const role = document.getElementById("auth-admin-role").value;
      const status = document.getElementById("auth-admin-status").value;

      if (!name) {
        alert("Please enter the admin full name.");
        return;
      }
      if (!email || !email.includes("@")) {
        alert("Please enter a valid work email address to authorize.");
        return;
      }

      // Collect selected modules
      const selectedModules = [];
      document.querySelectorAll(".module-checkbox:checked").forEach(cb => {
        selectedModules.push(cb.value);
      });

      if (editingAdminId) {
        // Edit existing
        const admin = admins.find(a => a.id === editingAdminId);
        if (admin) {
          admin.name = name;
          admin.role = role;
          admin.status = status;
          admin.modules = selectedModules;
        }
      } else {
        // Check for duplicate email
        if (admins.some(a => a.email.toLowerCase() === email)) {
          alert(`The email ${email} is already authorized in the admin directory!`);
          return;
        }

        const newId = `adm_${Math.floor(100 + Math.random() * 900)}`;
        const initialAvatar = name.charAt(0).toUpperCase();

        const newAdmin = {
          id: newId,
          name: name,
          email: email,
          role: role,
          avatar: initialAvatar,
          status: status,
          isOwner: false,
          lastActive: "Just Authorized",
          stats: {
            bookingsProcessed: 0,
            gmvHandled: 0,
            visasHandled: 0,
            markupsCreated: 0
          },
          modules: selectedModules,
          activityLog: [
            { time: "Just now", action: `Granted ${role} authorization rights by Super Admin`, module: "Admin Team" }
          ]
        };
        admins.push(newAdmin);
      }

      saveData();
      updateKPIs();
      renderAdminTable();
      this.closeModal("modal-authorize-admin");
    },

    toggleStatus: function (adminId) {
      const admin = admins.find(a => a.id === adminId);
      if (!admin) return;

      if (admin.isOwner) {
        alert("Master Super Admin account status cannot be changed.");
        return;
      }

      admin.status = admin.status === "Active" ? "Passive" : "Active";
      admin.activityLog.unshift({
        time: "Just now",
        action: `Account status toggled to ${admin.status} by Super Admin`,
        module: "Security"
      });

      saveData();
      updateKPIs();
      renderAdminTable();
    },

    revokeAccess: function (adminId) {
      const admin = admins.find(a => a.id === adminId);
      if (!admin) return;

      if (admin.isOwner) {
        alert("Cannot revoke access for the master Super Admin.");
        return;
      }

      if (confirm(`Are you sure you want to completely revoke authorization rights for ${admin.name} (${admin.email})? They will immediately lose access to the FareOS portal.`)) {
        admins = admins.filter(a => a.id !== adminId);
        saveData();
        updateKPIs();
        renderAdminTable();
      }
    },

    viewActivity: function (adminId) {
      const admin = admins.find(a => a.id === adminId);
      if (!admin) return;

      document.getElementById("work-log-admin-name").textContent = `${admin.name} — Work & Productivity Log`;
      document.getElementById("work-log-admin-email").textContent = `${admin.email} (${admin.role})`;

      // Fill KPI stats
      document.getElementById("work-stat-bookings").textContent = admin.stats.bookingsProcessed || 0;
      document.getElementById("work-stat-gmv").textContent = admin.stats.gmvHandled ? "₹" + (admin.stats.gmvHandled).toLocaleString() : "₹0";
      document.getElementById("work-stat-visas").textContent = admin.stats.visasHandled || 0;
      document.getElementById("work-stat-markups").textContent = admin.stats.markupsCreated || 0;

      // Render activity trail
      const listEl = document.getElementById("work-log-activity-list");
      if (listEl) {
        const logs = admin.activityLog || [];
        if (logs.length === 0) {
          listEl.innerHTML = `<div style="padding:20px; text-align:center; color:#64748B;">No recent activity records found.</div>`;
        } else {
          listEl.innerHTML = logs.map(l => `
            <div style="padding:10px 14px; border-bottom:1px solid #F1F5F9; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:12.5px; font-weight:700; color:#1E293B;">${escapeHtml(l.action)}</div>
                <div style="font-size:11px; color:#64748B; margin-top:2px;">Module: <strong>${escapeHtml(l.module)}</strong></div>
              </div>
              <div style="font-size:11.5px; color:#94A3B8; font-weight:600; white-space:nowrap;">
                ${escapeHtml(l.time)}
              </div>
            </div>
          `).join("");
        }
      }

      const overlay = document.getElementById("modal-admin-work-log");
      if (overlay) overlay.classList.add("open");
    },

    closeModal: function (modalId) {
      const overlay = document.getElementById(modalId);
      if (overlay) overlay.classList.remove("open");
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    window.FareOSTeam.init();
  });
})();
