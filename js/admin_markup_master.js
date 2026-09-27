/**
 * FareOS Markup Master Engine
 * Flight Pricing & Profit Margin Management
 * Matches reference screenshots media_1789584777586.png & media_1789584777591.png
 */

(function () {
  "use strict";

  const STORAGE_KEY = "fareos_markup_master_rules_v3";
  const GROUPS_KEY = "fareos_markup_groups_v3";

  // Default virtual groups matching screenshots
  const DEFAULT_GROUPS = [
    { id: "b2b_top", name: "B2B top agents", segment: "B2B", badgeClass: "b2b", expanded: true },
    { id: "general", name: "general", segment: "B2C", badgeClass: "b2c", expanded: false },
    { id: "test", name: "test", segment: "B2C", badgeClass: "b2c", expanded: false },
    { id: "abc", name: "abc", segment: "B2B", badgeClass: "b2b", expanded: false },
    { id: "unlinked", name: "Unlinked", segment: "ALL", badgeClass: "no-group", expanded: false }
  ];

  // Default 9 markup rules matching screenshot KPI metrics (Status: Active or Passive)
  const DEFAULT_RULES = [
    {
      id: "MK-101",
      name: "Markup Test",
      description: "Primary baseline markup test rule applied to VIP agency accounts",
      groupId: "b2b_top",
      virtualGroups: ["b2b_top", "general", "test"],
      inGroupsTag: "in 3 groups",
      segment: "B2B",
      ruleType: "Fixed",
      amount: 500,
      priority: 1,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "All Suppliers",
      market: "All Markets",
      airline: "AI, 6E, UK",
      classCode: "Y, M, B",
      client: "B2B Agents",
      status: "Active",
      slabs: [
        { minFare: 0, maxFare: 999999, type: "Fixed", val: 500 }
      ],
      createdAt: "2026-09-10T10:00:00Z"
    },
    {
      id: "MK-102",
      name: "IndiGo Domestic B2B Corporate",
      description: "Special corporate rate markup for 6E sector bookings",
      groupId: "unlinked",
      virtualGroups: [],
      inGroupsTag: "in 1 group",
      segment: "B2B",
      ruleType: "Fixed",
      amount: 350,
      priority: 2,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "IndiGo Direct NDC",
      market: "Domestic (India)",
      airline: "6E",
      classCode: "All",
      client: "B2B Agents",
      status: "Passive",
      slabs: [
        { minFare: 0, maxFare: 999999, type: "Fixed", val: 350 }
      ],
      createdAt: "2026-09-11T12:00:00Z"
    },
    {
      id: "MK-103",
      name: "Air India Direct B2C Margin",
      description: "Consumer website margin for Air India flights",
      groupId: "general",
      virtualGroups: ["general"],
      inGroupsTag: "in 1 group",
      segment: "B2C",
      ruleType: "Fixed",
      amount: 450,
      priority: 3,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "Air India Direct",
      market: "All Markets",
      airline: "AI",
      classCode: "Economy",
      client: "B2C Retail",
      status: "Passive",
      slabs: [
        { minFare: 0, maxFare: 999999, type: "Fixed", val: 450 }
      ],
      createdAt: "2026-09-12T09:30:00Z"
    },
    {
      id: "MK-104",
      name: "Vistara Premium Tier Test",
      description: "Tiered slab markup for premium cabins",
      groupId: "test",
      virtualGroups: ["test"],
      inGroupsTag: "in 1 group",
      segment: "B2C",
      ruleType: "Fixed",
      amount: 600,
      priority: 4,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "All Suppliers",
      market: "All Markets",
      airline: "UK",
      classCode: "Y, M",
      client: "B2C Retail",
      status: "Passive",
      slabs: [
        { minFare: 0, maxFare: 8000, type: "Fixed", val: 400 },
        { minFare: 8001, maxFare: 999999, type: "Fixed", val: 800 }
      ],
      createdAt: "2026-09-12T14:20:00Z"
    },
    {
      id: "MK-105",
      name: "Akasa Air Promo B2C",
      description: "Low cost promotional margin for budget travelers",
      groupId: "test",
      virtualGroups: ["test"],
      inGroupsTag: "in 1 group",
      segment: "B2C",
      ruleType: "Fixed",
      amount: 250,
      priority: 5,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "All Suppliers",
      market: "Domestic (India)",
      airline: "QP",
      classCode: "Economy",
      client: "B2C Retail",
      status: "Passive",
      slabs: [
        { minFare: 0, maxFare: 999999, type: "Fixed", val: 250 }
      ],
      createdAt: "2026-09-13T11:15:00Z"
    },
    {
      id: "MK-106",
      name: "GDS Amadeus International Surcharge",
      description: "High-yield international GDS long-haul distribution markup",
      groupId: "unlinked",
      virtualGroups: [],
      inGroupsTag: "in 1 group",
      segment: "API",
      ruleType: "Fixed",
      amount: 1200,
      priority: 6,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "Amadeus GDS",
      market: "International",
      airline: "All Airlines",
      classCode: "All",
      client: "API Partners",
      status: "Passive",
      slabs: [
        { minFare: 0, maxFare: 999999, type: "Fixed", val: 1200 }
      ],
      createdAt: "2026-09-13T16:00:00Z"
    },
    {
      id: "MK-107",
      name: "Sabre Wholesale B2B Tier 2",
      description: "Standard offline sub-agent consolidator markup",
      groupId: "unlinked",
      virtualGroups: [],
      inGroupsTag: "in 1 group",
      segment: "B2B",
      ruleType: "Fixed",
      amount: 800,
      priority: 7,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "Sabre GDS",
      market: "All Markets",
      airline: "All Airlines",
      classCode: "All",
      client: "B2B Agents",
      status: "Passive",
      slabs: [
        { minFare: 0, maxFare: 999999, type: "Fixed", val: 800 }
      ],
      createdAt: "2026-09-14T08:45:00Z"
    },
    {
      id: "MK-108",
      name: "Low Cost Carrier Ancillary Markup",
      description: "Fixed service fee on budget carrier ticket issuances",
      groupId: "unlinked",
      virtualGroups: [],
      inGroupsTag: "in 1 group",
      segment: "B2C",
      ruleType: "Fixed",
      amount: 150,
      priority: 8,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "All Suppliers",
      market: "Domestic (India)",
      airline: "SG",
      classCode: "Economy",
      client: "B2C Retail",
      status: "Passive",
      slabs: [
        { minFare: 0, maxFare: 999999, type: "Fixed", val: 150 }
      ],
      createdAt: "2026-09-14T15:10:00Z"
    },
    {
      id: "MK-109",
      name: "Meta API Skyscanner Search Feed",
      description: "Meta clickout aggregator channel fee",
      groupId: "unlinked",
      virtualGroups: [],
      inGroupsTag: "in 1 group",
      segment: "API",
      ruleType: "Fixed",
      amount: 300,
      priority: 9,
      feeMode: "Exclusive Tax",
      appliesTo: "Flight booking (search-time)",
      tax: "Tax Excluded",
      suppliers: "All Suppliers",
      market: "All Markets",
      airline: "All Airlines",
      classCode: "All",
      client: "API Partners",
      status: "Passive",
      slabs: [
        { minFare: 0, maxFare: 999999, type: "Fixed", val: 300 }
      ],
      createdAt: "2026-09-15T18:00:00Z"
    }
  ];

  // State
  let rules = [];
  let groups = [];
  let activeSegment = "B2B";
  let searchQuery = "";
  let filterStatus = "ALL";
  let filterType = "ALL";
  let filterClient = "ALL";
  let currentEditingRuleId = null;
  let selectedModalVGs = [];
  let modalMode = "simple";

  function loadData() {
    try {
      const storedRules = localStorage.getItem(STORAGE_KEY);
      rules = storedRules ? JSON.parse(storedRules) : JSON.parse(JSON.stringify(DEFAULT_RULES));
      const storedGroups = localStorage.getItem(GROUPS_KEY);
      groups = storedGroups ? JSON.parse(storedGroups) : JSON.parse(JSON.stringify(DEFAULT_GROUPS));
    } catch (e) {
      rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
      groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }

  function updateKPICards() {
    const totalCount = rules.length;
    const activeCount = rules.filter(r => r.status === "Active").length;
    const percentageCount = rules.filter(r => r.ruleType === "Percentage").length;
    const fixedCount = rules.filter(r => r.ruleType === "Fixed").length;

    const elTotal = document.getElementById("kpi-total-markup");
    const elActive = document.getElementById("kpi-active-markup");
    const elPercentage = document.getElementById("kpi-percentage-markup");
    const elFixed = document.getElementById("kpi-fixed-markup");

    if (elTotal) elTotal.textContent = totalCount;
    if (elActive) elActive.textContent = activeCount;
    if (elPercentage) elPercentage.textContent = percentageCount;
    if (elFixed) elFixed.textContent = fixedCount;
  }

  function getFilteredRules() {
    return rules.filter(rule => {
      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (rule.name || "").toLowerCase().includes(q);
        const matchDesc = (rule.description || "").toLowerCase().includes(q);
        const matchId = (rule.id || "").toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchId) return false;
      }
      // Status (Active or Passive)
      if (filterStatus !== "ALL") {
        if (filterStatus === "ACTIVE" && rule.status !== "Active") return false;
        if (filterStatus === "PASSIVE" && (rule.status !== "Passive" && rule.status !== "Inactive")) return false;
      }
      // Type
      if (filterType !== "ALL" && rule.ruleType.toUpperCase() !== filterType) return false;
      // Client
      if (filterClient !== "ALL") {
        if (filterClient === "B2B" && rule.segment !== "B2B") return false;
        if (filterClient === "B2C" && rule.segment !== "B2C") return false;
        if (filterClient === "API" && rule.segment !== "API") return false;
      }
      // Segment Filter
      if (activeSegment !== "ALL") {
        if (rule.groupId === "unlinked") {
          // Unlinked shown if applicable
        } else {
          const grp = groups.find(g => g.id === rule.groupId);
          if (grp && grp.segment !== "ALL" && grp.segment !== activeSegment) {
            if (rule.segment !== activeSegment) return false;
          }
        }
      }
      return true;
    });
  }

  function renderAccordions() {
    const container = document.getElementById("markup-accordions-container");
    if (!container) return;

    const filtered = getFilteredRules();
    const totalCountEl = document.getElementById("markup-results-counter");
    if (totalCountEl) {
      totalCountEl.textContent = `${filtered.length} RULES`;
    }

    container.innerHTML = "";

    if (groups.length === 0) {
      container.innerHTML = `<div style="padding:40px; text-align:center; color:#64748B;">No virtual groups available.</div>`;
      return;
    }

    groups.forEach(group => {
      const groupRules = filtered.filter(r => r.groupId === group.id);
      const allGroupRules = rules.filter(r => r.groupId === group.id);
      const activeInGroup = allGroupRules.filter(r => r.status === "Active").length;

      if (activeSegment !== "ALL" && group.segment !== "ALL" && group.segment !== activeSegment && groupRules.length === 0) {
        return;
      }

      const card = document.createElement("div");
      card.className = `markup-group-card ${group.expanded ? "expanded" : ""}`;
      card.id = `group-card-${group.id}`;

      let badgeHtml = "";
      if (group.badgeClass === "b2b") {
        badgeHtml = `<span class="markup-badge b2b">B2B</span>`;
      } else if (group.badgeClass === "b2c") {
        badgeHtml = `<span class="markup-badge b2c">B2C</span>`;
      } else if (group.badgeClass === "api") {
        badgeHtml = `<span class="markup-badge api">API</span>`;
      } else {
        badgeHtml = `<span class="markup-badge no-group">No group</span>`;
      }

      card.innerHTML = `
        <div class="markup-group-header" onclick="window.FareOSMarkup.toggleGroup('${group.id}')">
          <div class="markup-group-title-wrap">
            <svg class="markup-group-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="markup-group-title">${escapeHtml(group.name)}</span>
            ${badgeHtml}
          </div>
          <div class="markup-group-counter">
            ${activeInGroup} active / ${allGroupRules.length} rules
          </div>
        </div>
        <div class="markup-group-body" id="group-body-${group.id}">
          ${renderGroupRules(groupRules, group.id)}
        </div>
      `;

      container.appendChild(card);
    });
  }

  function renderGroupRules(ruleList, groupId) {
    if (ruleList.length === 0) {
      return `<div style="padding:14px 42px; font-size:12px; color:#94A3B8; font-style:italic;">No rules matching current filter in this group.</div>`;
    }

    return ruleList.map(rule => {
      const slabCount = rule.slabs ? rule.slabs.length : 1;
      const isActive = rule.status === "Active";
      const statusLabel = isActive ? "Active" : "Passive";

      return `
        <div class="markup-rule-row" id="rule-row-${rule.id}">
          <div class="markup-rule-info-left">
            <span class="markup-rule-name" onclick="window.FareOSMarkup.viewRule('${rule.id}')" title="Click to view full details and simulator">
              ${escapeHtml(rule.name)}
            </span>
            ${rule.inGroupsTag ? `<span class="markup-in-groups-tag">${escapeHtml(rule.inGroupsTag)}</span>` : ""}
          </div>
          <div class="markup-rule-meta-right">
            <span class="markup-slabs-pill">${slabCount} slabs</span>
            <span class="markup-status-pill ${isActive ? "active" : "passive"}" style="cursor:pointer;" onclick="window.FareOSMarkup.toggleRuleStatus('${rule.id}')" title="Click to toggle Active / Passive">
              <span class="markup-status-dot"></span>
              ${statusLabel}
            </span>
            <div class="markup-action-btns">
              <button class="markup-action-btn" title="View details & Simulator" onclick="window.FareOSMarkup.viewRule('${rule.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="markup-action-btn" title="Edit rule" onclick="window.FareOSMarkup.editRule('${rule.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="markup-action-btn delete" title="Delete rule" onclick="window.FareOSMarkup.confirmDeleteRule('${rule.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
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

  // Simulator Calculator
  function calculateMarkupForFare(rule, baseFare) {
    const fare = parseFloat(baseFare) || 0;
    if (!rule || !rule.slabs || rule.slabs.length === 0) {
      const val = rule.amount || 0;
      const profit = rule.ruleType === "Percentage" ? (fare * val) / 100 : val;
      return {
        baseFare: fare,
        markupAdded: profit,
        finalFare: fare + profit,
        appliedSlab: "Flat standard rate"
      };
    }

    let matchedSlab = rule.slabs.find(s => fare >= s.minFare && fare <= s.maxFare) || rule.slabs[0];
    const val = parseFloat(matchedSlab.val) || 0;
    const profit = matchedSlab.type === "Percentage" ? (fare * val) / 100 : val;
    return {
      baseFare: fare,
      markupAdded: profit,
      finalFare: fare + profit,
      appliedSlab: `₹${matchedSlab.minFare.toLocaleString()} - ₹${matchedSlab.maxFare > 900000 ? "No limit" : matchedSlab.maxFare.toLocaleString()} (${matchedSlab.type === "Percentage" ? val + "%" : "₹" + val})`
    };
  }

  // Update Virtual Group Chips in Modal
  function updateVGChipsUI() {
    const chips = document.querySelectorAll(".markup-vg-chip[data-vg-id]");
    chips.forEach(chip => {
      const vgId = chip.getAttribute("data-vg-id");
      if (selectedModalVGs.includes(vgId)) {
        chip.classList.add("selected");
      } else {
        chip.classList.remove("selected");
      }
    });

    const selectAllBtn = document.getElementById("vg-chip-select-all");
    const allAvailable = ["abc", "test", "b2b_top", "general"];
    if (selectAllBtn) {
      if (selectedModalVGs.length >= allAvailable.length) {
        selectAllBtn.classList.add("selected");
        selectAllBtn.textContent = "Deselect All";
      } else {
        selectAllBtn.classList.remove("selected");
        selectAllBtn.textContent = "Select All";
      }
    }

    const summaryEl = document.getElementById("vg-chips-summary");
    const footerSummaryEl = document.getElementById("modal-footer-summary");

    if (selectedModalVGs.length === 0) {
      if (summaryEl) summaryEl.textContent = "No groups selected — this rule will not be linked to any virtual group.";
      if (footerSummaryEl) footerSummaryEl.textContent = "Will create 1 rule, linked to no virtual group";
    } else if (selectedModalVGs.length === 1) {
      const gObj = groups.find(g => g.id === selectedModalVGs[0]);
      const name = gObj ? gObj.name : selectedModalVGs[0];
      if (summaryEl) summaryEl.textContent = `Linked to 1 virtual group (${name}).`;
      if (footerSummaryEl) footerSummaryEl.textContent = `Will create 1 rule, linked to 1 virtual group (${name})`;
    } else {
      if (summaryEl) summaryEl.textContent = `Linked to ${selectedModalVGs.length} virtual groups.`;
      if (footerSummaryEl) footerSummaryEl.textContent = `Will create 1 rule, linked to ${selectedModalVGs.length} virtual groups`;
    }
  }

  // Public Interface
  window.FareOSMarkup = {
    init: function () {
      loadData();
      updateKPICards();
      renderAccordions();
      this.bindEvents();
    },

    bindEvents: function () {
      const searchInput = document.getElementById("markup-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", function (e) {
          searchQuery = e.target.value.trim();
          renderAccordions();
        });
      }

      const statusSelect = document.getElementById("filter-rule-status");
      if (statusSelect) {
        statusSelect.addEventListener("change", function (e) {
          filterStatus = e.target.value;
          renderAccordions();
        });
      }

      const typeSelect = document.getElementById("filter-rule-type");
      if (typeSelect) {
        typeSelect.addEventListener("change", function (e) {
          filterType = e.target.value;
          renderAccordions();
        });
      }

      const clientSelect = document.getElementById("filter-client");
      if (clientSelect) {
        clientSelect.addEventListener("change", function (e) {
          filterClient = e.target.value;
          renderAccordions();
        });
      }
    },

    setSegment: function (segment) {
      activeSegment = segment;
      document.querySelectorAll(".markup-segment-pill").forEach(pill => {
        if (pill.getAttribute("data-segment") === segment) {
          pill.classList.add("active");
        } else {
          pill.classList.remove("active");
        }
      });
      renderAccordions();
    },

    toggleGroup: function (groupId) {
      const grp = groups.find(g => g.id === groupId);
      if (grp) {
        grp.expanded = !grp.expanded;
        saveData();
        const card = document.getElementById(`group-card-${groupId}`);
        if (card) {
          card.classList.toggle("expanded", grp.expanded);
        }
      }
    },

    toggleRuleStatus: function (ruleId) {
      const rule = rules.find(r => r.id === ruleId);
      if (rule) {
        rule.status = rule.status === "Active" ? "Passive" : "Active";
        saveData();
        updateKPICards();
        renderAccordions();
      }
    },

    setModalMode: function (mode) {
      modalMode = mode;
      const simpleBtn = document.getElementById("mode-pill-simple");
      const advBtn = document.getElementById("mode-pill-advanced");
      if (simpleBtn && advBtn) {
        if (mode === "simple") {
          simpleBtn.className = "markup-mode-pill active";
          advBtn.className = "markup-mode-pill inactive";
        } else {
          simpleBtn.className = "markup-mode-pill inactive";
          advBtn.className = "markup-mode-pill active";
        }
      }
    },

    toggleVGChip: function (vgId) {
      const idx = selectedModalVGs.indexOf(vgId);
      if (idx > -1) {
        selectedModalVGs.splice(idx, 1);
      } else {
        selectedModalVGs.push(vgId);
      }
      updateVGChipsUI();
    },

    toggleSelectAllVGs: function () {
      const all = ["abc", "test", "b2b_top", "general"];
      if (selectedModalVGs.length >= all.length) {
        selectedModalVGs = [];
      } else {
        selectedModalVGs = [...all];
      }
      updateVGChipsUI();
    },

    openNewMarkupModal: function () {
      currentEditingRuleId = null;
      document.getElementById("modal-markup-title").textContent = "New Markup Rule";
      document.getElementById("modal-markup-subtitle").textContent = "Configure the rule and link it to virtual groups";
      document.getElementById("modal-submit-btn-text").textContent = "+ Create Markup";

      // Reset fields (Default Active)
      document.getElementById("rule-name").value = "";
      document.getElementById("rule-status").value = "Active";
      document.getElementById("rule-priority").value = "1";
      document.getElementById("rule-fee-mode").value = "Exclusive Tax";
      document.getElementById("rule-applies-to").value = "Flight booking (search-time)";
      
      document.getElementById("rule-markup-in").value = "Flat";
      document.getElementById("rule-value").value = "";
      document.getElementById("rule-tax").value = "Tax Excluded";

      document.getElementById("rule-suppliers").value = "All Suppliers";
      document.getElementById("rule-market").value = "All Markets";
      document.getElementById("rule-airline-targeting").value = "";
      document.getElementById("rule-class-code").value = "";

      document.getElementById("rule-fee-desc").value = "";
      document.getElementById("rule-internal-remarks").value = "";

      // Reset VGs
      selectedModalVGs = [];
      updateVGChipsUI();
      this.setModalMode("simple");

      const overlay = document.getElementById("modal-markup-form-overlay");
      if (overlay) overlay.classList.add("open");
    },

    editRule: function (ruleId) {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      currentEditingRuleId = ruleId;
      document.getElementById("modal-markup-title").textContent = `Edit Markup Rule`;
      document.getElementById("modal-markup-subtitle").textContent = `Update configuration for ${rule.name}`;
      document.getElementById("modal-submit-btn-text").textContent = "Save Changes";

      document.getElementById("rule-name").value = rule.name || "";
      document.getElementById("rule-status").value = rule.status === "Active" ? "Active" : "Passive";
      document.getElementById("rule-priority").value = rule.priority || "1";
      document.getElementById("rule-fee-mode").value = rule.feeMode || "Exclusive Tax";
      document.getElementById("rule-applies-to").value = rule.appliesTo || "Flight booking (search-time)";
      
      document.getElementById("rule-markup-in").value = rule.ruleType === "Percentage" ? "Percentage" : "Flat";
      document.getElementById("rule-value").value = rule.amount !== undefined ? rule.amount : 250;
      document.getElementById("rule-tax").value = rule.tax || "Tax Excluded";

      document.getElementById("rule-suppliers").value = rule.suppliers || "All Suppliers";
      document.getElementById("rule-market").value = rule.market || "All Markets";
      document.getElementById("rule-airline-targeting").value = rule.airline || "";
      document.getElementById("rule-class-code").value = rule.classCode || "";

      document.getElementById("rule-fee-desc").value = rule.description || "";
      document.getElementById("rule-internal-remarks").value = rule.internalRemarks || "";

      selectedModalVGs = rule.virtualGroups ? [...rule.virtualGroups] : (rule.groupId && rule.groupId !== "unlinked" ? [rule.groupId] : []);
      updateVGChipsUI();
      this.setModalMode("simple");

      const overlay = document.getElementById("modal-markup-form-overlay");
      if (overlay) overlay.classList.add("open");
    },

    saveRuleForm: function () {
      const name = document.getElementById("rule-name").value.trim();
      if (!name) {
        alert("Please provide a Markup Name.");
        document.getElementById("rule-name").focus();
        return;
      }

      const status = document.getElementById("rule-status").value;
      const priority = parseInt(document.getElementById("rule-priority").value, 10) || 1;
      const feeMode = document.getElementById("rule-fee-mode").value;
      const appliesTo = document.getElementById("rule-applies-to").value;

      const markupIn = document.getElementById("rule-markup-in").value;
      const ruleType = markupIn === "Percentage" ? "Percentage" : "Fixed";
      const amountVal = parseFloat(document.getElementById("rule-value").value) || 0;
      const tax = document.getElementById("rule-tax").value;

      const suppliers = document.getElementById("rule-suppliers").value;
      const market = document.getElementById("rule-market").value;
      const airline = document.getElementById("rule-airline-targeting").value.trim() || "All Airlines";
      const classCode = document.getElementById("rule-class-code").value.trim() || "All Classes";

      const feeDesc = document.getElementById("rule-fee-desc").value.trim();
      const internalRemarks = document.getElementById("rule-internal-remarks").value.trim();

      const primaryGroupId = selectedModalVGs.length > 0 ? selectedModalVGs[0] : "unlinked";
      const groupTag = selectedModalVGs.length > 1 ? `in ${selectedModalVGs.length} groups` : (selectedModalVGs.length === 1 ? "in 1 group" : "");
      const segment = primaryGroupId === "b2b_top" || primaryGroupId === "abc" ? "B2B" : (primaryGroupId === "general" || primaryGroupId === "test" ? "B2C" : "ALL");

      if (currentEditingRuleId) {
        const rule = rules.find(r => r.id === currentEditingRuleId);
        if (rule) {
          rule.name = name;
          rule.status = status;
          rule.priority = priority;
          rule.feeMode = feeMode;
          rule.appliesTo = appliesTo;
          rule.ruleType = ruleType;
          rule.amount = amountVal;
          rule.tax = tax;
          rule.suppliers = suppliers;
          rule.market = market;
          rule.airline = airline;
          rule.classCode = classCode;
          rule.groupId = primaryGroupId;
          rule.virtualGroups = [...selectedModalVGs];
          rule.inGroupsTag = groupTag;
          rule.segment = segment;
          rule.description = feeDesc;
          rule.internalRemarks = internalRemarks;
          rule.slabs = [
            { minFare: 0, maxFare: 999999, type: ruleType, val: amountVal }
          ];
        }
      } else {
        const newId = `MK-${Math.floor(100 + Math.random() * 900)}`;
        const newRule = {
          id: newId,
          name: name,
          status: status,
          priority: priority,
          feeMode: feeMode,
          appliesTo: appliesTo,
          ruleType: ruleType,
          amount: amountVal,
          tax: tax,
          suppliers: suppliers,
          market: market,
          airline: airline,
          classCode: classCode,
          groupId: primaryGroupId,
          virtualGroups: [...selectedModalVGs],
          inGroupsTag: groupTag,
          segment: segment,
          client: segment === "B2B" ? "B2B Agents" : (segment === "API" ? "API Partners" : "B2C Retail"),
          description: feeDesc,
          internalRemarks: internalRemarks,
          slabs: [
            { minFare: 0, maxFare: 999999, type: ruleType, val: amountVal }
          ],
          createdAt: new Date().toISOString()
        };
        rules.unshift(newRule);
      }

      saveData();
      updateKPICards();
      renderAccordions();
      this.closeModal("modal-markup-form-overlay");
    },

    viewRule: function (ruleId) {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const isAct = rule.status === "Active";
      const statusLabel = isAct ? "Active" : "Passive";

      document.getElementById("view-rule-name").textContent = rule.name;
      document.getElementById("view-rule-desc").textContent = rule.description || "No customer-facing description.";
      document.getElementById("view-rule-id").textContent = rule.id;
      document.getElementById("view-rule-segment").textContent = rule.segment;
      document.getElementById("view-rule-type").textContent = `${rule.ruleType} (${rule.ruleType === "Percentage" ? rule.amount + "%" : "₹" + rule.amount})`;
      document.getElementById("view-rule-airline").textContent = rule.airline || "All Airlines";
      document.getElementById("view-rule-scope").textContent = rule.market || "All Markets";
      document.getElementById("view-rule-status").textContent = statusLabel;
      document.getElementById("view-rule-status").className = `markup-status-pill ${isAct ? "active" : "passive"}`;

      const slabsTbody = document.getElementById("view-slabs-tbody");
      if (slabsTbody && rule.slabs) {
        slabsTbody.innerHTML = rule.slabs.map((s, idx) => `
          <tr>
            <td>Tier ${idx + 1}</td>
            <td>₹${s.minFare.toLocaleString()} - ₹${s.maxFare > 900000 ? "No limit" : s.maxFare.toLocaleString()}</td>
            <td><strong>${s.type === "Percentage" ? s.val + "%" : "₹" + s.val}</strong></td>
          </tr>
        `).join("");
      }

      const simInput = document.getElementById("sim-base-fare-input");
      if (simInput) {
        simInput.value = "4500";
        this.runSimulation(rule.id);
        simInput.oninput = () => this.runSimulation(rule.id);
      }

      const overlay = document.getElementById("modal-markup-view-overlay");
      if (overlay) overlay.classList.add("open");
    },

    runSimulation: function (ruleId) {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const simInput = document.getElementById("sim-base-fare-input");
      const baseFare = parseFloat(simInput ? simInput.value : 4500) || 0;
      const res = calculateMarkupForFare(rule, baseFare);

      const elProfit = document.getElementById("sim-result-profit");
      const elFinal = document.getElementById("sim-result-final");
      const elSlab = document.getElementById("sim-result-slab");

      if (elProfit) elProfit.textContent = `+ ₹${res.markupAdded.toLocaleString()}`;
      if (elFinal) elFinal.textContent = `₹${res.finalFare.toLocaleString()}`;
      if (elSlab) elSlab.textContent = res.appliedSlab;
    },

    confirmDeleteRule: function (ruleId) {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      if (confirm(`Are you sure you want to delete markup rule "${rule.name}" (${rule.id})?`)) {
        rules = rules.filter(r => r.id !== ruleId);
        saveData();
        updateKPICards();
        renderAccordions();
      }
    },

    resetDefaults: function () {
      if (confirm("Reset all markup rules to factory screenshot defaults?")) {
        rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
        groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
        saveData();
        updateKPICards();
        renderAccordions();
      }
    },

    closeModal: function (modalId) {
      const overlay = document.getElementById(modalId);
      if (overlay) overlay.classList.remove("open");
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    window.FareOSMarkup.init();
  });
})();
