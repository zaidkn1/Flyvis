// FareOS Admin - Revenue Dashboard Analytics Engine
(function() {
  "use strict";

  let analyticsData = null;
  let flightBookings = [];
  let currentPeriod = "q3";

  document.addEventListener("DOMContentLoaded", () => {
    initPersona();
    loadRevenueData();
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

  async function loadRevenueData() {
    try {
      const res = await fetch("data/revenue_analytics.json");
      if (res.ok) analyticsData = await res.json();
    } catch (e) {
      console.warn("Could not load revenue_analytics.json:", e);
    }

    try {
      const bRes = await fetch("data/flight_bookings.json");
      if (bRes.ok) flightBookings = await bRes.json();
    } catch (e) {}

    renderDashboard();
  }

  function setupEventListeners() {
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#admin-persona-dropdown") && !e.target.closest("#header-user-avatar")) {
        const m = document.getElementById("admin-persona-dropdown");
        if (m) m.style.display = "none";
      }
    });
  }

  window.switchPeriod = function(periodKey) {
    currentPeriod = periodKey;
    const btns = document.querySelectorAll(".rev-period-btn");
    btns.forEach(b => {
      if (b.getAttribute("data-period") === periodKey) b.classList.add("active");
      else b.classList.remove("active");
    });
    renderDashboard();
  };

  function formatINR(num) {
    if (num == null) return "₹0";
    return "₹" + Number(num).toLocaleString("en-IN");
  }

  function renderDashboard() {
    if (!analyticsData || !analyticsData.periods) return;
    const p = analyticsData.periods[currentPeriod] || analyticsData.periods.q3;

    // Period subtitle
    const subEl = document.getElementById("rev-period-subtitle");
    if (subEl) subEl.textContent = `Showing financial metrics for ${p.label}`;

    // Primary KPIs
    const gbvEl = document.getElementById("kpi-gbv");
    if (gbvEl) gbvEl.textContent = formatINR(p.grossBookingValue);

    const gbvTrend = document.getElementById("kpi-gbv-trend");
    if (gbvTrend) gbvTrend.textContent = `+${p.grossGrowthPct}% vs prior`;

    const netEl = document.getElementById("kpi-net");
    if (netEl) netEl.textContent = formatINR(p.netRevenue);

    const netTrend = document.getElementById("kpi-net-trend");
    if (netTrend) netTrend.textContent = `+${p.netGrowthPct}% vs prior`;

    const tixEl = document.getElementById("kpi-tickets");
    if (tixEl) tixEl.textContent = p.totalTicketsIssued;

    const marginEl = document.getElementById("kpi-margin");
    if (marginEl) marginEl.textContent = `${p.takeRatePct}%`;

    // Secondary sub-KPIs
    const commEl = document.getElementById("subkpi-commission");
    if (commEl) commEl.textContent = formatINR(p.airlineCommissions);

    const markupEl = document.getElementById("subkpi-markup");
    if (markupEl) markupEl.textContent = formatINR(p.markupAndAncillaries);

    const feeEl = document.getElementById("subkpi-fees");
    if (feeEl) feeEl.textContent = formatINR(p.convenienceFees);

    const avgEl = document.getElementById("subkpi-avg");
    if (avgEl) avgEl.textContent = formatINR(p.averageTicketValue);

    renderMonthlyTrendChart();
    renderChannelBreakdown();
    renderTopRoutes();
    renderLedgerTable();
  }

  // Render SVG Trend Chart
  function renderMonthlyTrendChart() {
    const container = document.getElementById("rev-trend-chart");
    if (!container || !analyticsData || !analyticsData.monthlyTrend) return;

    const data = analyticsData.monthlyTrend;
    const maxGross = Math.max(...data.map(d => d.gross));
    const chartHeight = 160;

    let barsHtml = "";
    data.forEach(item => {
      const barH = Math.round((item.gross / maxGross) * (chartHeight - 30));
      const netH = Math.round((item.net / maxGross) * (chartHeight - 30) * 8); // Scaled for visual contrast

      barsHtml += `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end;">
          <div style="font-size:10px; font-weight:700; color:#64748B; margin-bottom:4px;">₹${(item.gross / 100000).toFixed(1)}L</div>
          <div style="width:70%; max-width:32px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:6px 6px 0 0; height:${barH}px; display:flex; flex-direction:column; justify-content:flex-end; overflow:hidden; position:relative;" title="${item.month}: Gross ${formatINR(item.gross)}, Net ${formatINR(item.net)}">
            <div style="width:100%; height:${netH}px; background:#2563EB; border-radius:4px 4px 0 0;"></div>
          </div>
          <div style="font-size:11px; font-weight:700; color:#475569; margin-top:6px;">${item.month}</div>
        </div>
      `;
    });

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-end; height:${chartHeight}px; width:100%; padding-top:10px;">
        ${barsHtml}
      </div>
      <div style="display:flex; justify-content:center; gap:20px; margin-top:14px; font-size:11.5px; font-weight:600; color:#64748B;">
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:12px; height:12px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:3px;"></span> Gross Sales (GBV)</span>
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:12px; height:12px; background:#2563EB; border-radius:3px;"></span> Net Profit (Yield)</span>
      </div>
    `;
  }

  // Render Channel Breakdown
  function renderChannelBreakdown() {
    const list = document.getElementById("rev-channels-list");
    if (!list || !analyticsData || !analyticsData.channels) return;

    const colors = ["#2563EB", "#10B981", "#8B5CF6"];
    let html = "";

    analyticsData.channels.forEach((ch, i) => {
      const color = colors[i % colors.length];
      html += `
        <div class="rev-channel-row">
          <div style="flex:1; padding-right:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <span style="font-size:12px; font-weight:700; color:#1E293B;">${ch.name}</span>
              <span style="font-size:12px; font-weight:800; color:#0F172A;">${formatINR(ch.amount)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:10.5px; color:#64748B;">
              <span>${ch.bookingsCount} Bookings • Avg Yield ${ch.avgYield}</span>
              <span style="font-weight:700; color:${color};">${ch.sharePct}%</span>
            </div>
            <div class="rev-channel-bar-bg">
              <div class="rev-channel-bar-fill" style="width:${ch.sharePct}%; background:${color};"></div>
            </div>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;
  }

  // Render Top Routes
  function renderTopRoutes() {
    const tbody = document.getElementById("rev-routes-tbody");
    if (!tbody || !analyticsData || !analyticsData.topRoutes) return;

    let html = "";
    analyticsData.topRoutes.forEach((r, idx) => {
      html += `
        <tr>
          <td style="color:#64748B; font-weight:700;">#${idx + 1}</td>
          <td style="font-weight:800; color:#0F172A;">${r.route}</td>
          <td style="color:#64748B;">${r.airline}</td>
          <td>${r.pax} pax</td>
          <td style="font-weight:700; color:#0F172A;">${formatINR(r.gross)}</td>
          <td style="font-weight:800; color:#16A34A;">${formatINR(r.profit)}</td>
          <td><span style="background:#EFF6FF; color:#2563EB; font-weight:700; font-size:11px; padding:2px 7px; border-radius:6px;">${r.margin}</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  // Render Live Ledger Table from recent bookings
  function renderLedgerTable() {
    const tbody = document.getElementById("rev-ledger-tbody");
    if (!tbody) return;

    const sample = flightBookings.slice(0, 15);
    if (sample.length === 0) {
      tbody.innerHTML = "<tr><td colspan=\"8\" style=\"text-align:center; padding:20px; color:#94A3B8;\">Loading live revenue ledger...</td></tr>";
      return;
    }

    let html = "";
    sample.forEach(b => {
      const gross = b.totalPrice || b.amount || 7500;
      const baseNet = Math.round(gross * 0.91);
      const commission = Math.round(gross * 0.04);
      const markup = Math.round(gross * 0.035);
      const fee = Math.round(gross * 0.015);
      const profit = gross - baseNet;
      const marginPct = ((profit / gross) * 100).toFixed(1) + "%";

      html += `
        <tr>
          <td style="font-weight:700; color:#2563EB;">${b.id}</td>
          <td style="color:#64748B;">${b.bookingDate || "2026-09-07"}</td>
          <td style="font-weight:700; color:#1E293B;">${b.airline || "IndiGo"}</td>
          <td style="font-weight:700; color:#0F172A;">${formatINR(gross)}</td>
          <td style="color:#64748B;">${formatINR(baseNet)}</td>
          <td style="color:#2563EB; font-weight:600;">+${formatINR(commission)}</td>
          <td style="color:#8B5CF6; font-weight:600;">+${formatINR(markup + fee)}</td>
          <td style="font-weight:800; color:#16A34A;">+${formatINR(profit)} <span style="font-size:10.5px; font-weight:600; color:#64748B;">(${marginPct})</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  // Export Revenue Report to CSV for Excel
  window.exportRevenueReportCSV = function() {
    if (!flightBookings || flightBookings.length === 0) {
      alert("No revenue data loaded yet");
      return;
    }

    const headers = [
      "Booking ID", "Booking Date", "Travel Date", "Customer", "Airline",
      "Route", "Gross Booking Value (INR)", "Supplier Base Cost", "Commission Earned",
      "Markup & Ancillary", "Convenience Fee", "Net Profit (INR)", "Net Margin %", "Status"
    ];

    const rows = flightBookings.map(b => {
      const gross = b.totalPrice || b.amount || 7500;
      const baseNet = Math.round(gross * 0.91);
      const commission = Math.round(gross * 0.04);
      const markup = Math.round(gross * 0.035);
      const fee = Math.round(gross * 0.015);
      const profit = gross - baseNet;
      const marginPct = ((profit / gross) * 100).toFixed(1) + "%";

      return [
        b.id,
        `"${b.bookingDate || ''}"`,
        `"${b.travelDateDisplay || b.travelDate || ''}"`,
        `"${(b.customer || b.passengerName || '').replace(/"/g, '""')}"`,
        `"${b.airline || ''}"`,
        `"${b.route || (b.origin + '-' + b.destination)}"`,
        gross,
        baseNet,
        commission,
        markup,
        fee,
        profit,
        `"${marginPct}"`,
        `"${b.status || 'Confirmed'}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

})();
