import re

# 1. Update admin-flight-bookings.html
with open("admin-flight-bookings.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace sidebar width 240px with 200px
content = content.replace('style="width:240px; background:#0F172A; border-right:1px solid #1E293B;"', 'style="width:200px; background:#0F172A; border-right:1px solid #1E293B;"')
content = content.replace('style="margin-left:240px; width:calc(100% - 240px); background:#F8FAFC; min-height:100vh;"', 'style="margin-left:200px; width:calc(100% - 200px); background:#F8FAFC; min-height:100vh;"')
content = content.replace('<main style="padding:20px 24px;">', '<main style="padding:14px 16px;">')

# Add gear settings button above KPI cards
gear_button = """        <!-- Settings Action & KPI Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="font-size:12px; font-weight:800; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;">Flight Operations Analytics</div>
          <button class="fareos-btn-tool" onclick="openBookingConfigModal()" title="Booking list configuration" style="padding:4px 8px; font-size:12px; display:inline-flex; align-items:center; gap:5px; background:#FFFFFF; border:1px solid #CBD5E1; color:#334155; cursor:pointer; border-radius:6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Analytics Settings</span>
          </button>
        </div>"""

if "<!-- Settings Action & KPI Header -->" not in content:
    content = content.replace('<div class="fareos-kpi-grid">', gear_button + '\n        <div class="fareos-kpi-grid">')

# Add tile click handlers
content = content.replace('<div class="fareos-kpi-card blue">', '<div class="fareos-kpi-card blue" id="card-tile-total" onclick="handleTileClick(\'all\')" title="Click to view all bookings">')
content = content.replace('<div class="fareos-kpi-card green">', '<div class="fareos-kpi-card green" id="card-tile-confirmed" onclick="handleTileClick(\'Confirmed\')" title="Click to filter by Confirmed">')
content = content.replace('<div class="fareos-kpi-card purple">', '<div class="fareos-kpi-card purple" id="card-tile-pending" onclick="handleTileClick(\'Pending\')" title="Click to filter by Pending">')
content = content.replace('<div class="fareos-kpi-card slate">', '<div class="fareos-kpi-card slate" id="card-tile-cancelled" onclick="handleTileClick(\'Cancelled\')" title="Click to filter by Cancelled">')
content = content.replace('<div class="fareos-kpi-card neutral">', '<div class="fareos-kpi-card neutral" id="card-tile-other" onclick="handleTileClick(\'Other\')" title="Click to filter by Other (In-Process / Initiated)">')

# Replace table headers with fixed percentage widths
old_thead = """            <thead>
              <tr>
                <th style="min-width:130px;">SUPPLIER</th>
                <th style="min-width:135px;">BOOKING ID</th>
                <th style="min-width:115px;">BOOKING DATE</th>
                <th style="min-width:125px;">PAYMENT STATUS</th>
                <th style="min-width:110px;">STATUS</th>
                <th style="min-width:135px;">OWNER</th>
                <th style="min-width:160px;">SUMMARY</th>
                <th style="min-width:105px;">TRAVEL DATE</th>
                <th style="min-width:115px;">DEADLINE</th>
                <th style="min-width:160px;">PASSENGER NAME</th>
                <th style="min-width:105px;">AMOUNT</th>
                <th style="min-width:110px;">AIR TYPE</th>
                <th style="min-width:140px;">CUSTOMER</th>
                <th style="min-width:120px;">PHONE</th>
                <th style="min-width:100px;">CUSTOMER TYPE</th>
                <th style="min-width:70px; text-align:center;">ACTIONS</th>
              </tr>
            </thead>"""

new_thead = """            <thead>
              <tr>
                <th style="width:7.5%;">SUPPLIER</th>
                <th style="width:8.5%;">BOOKING ID</th>
                <th style="width:7.5%;">BOOKING DATE</th>
                <th style="width:7.5%;">PAYMENT</th>
                <th style="width:7%;">STATUS</th>
                <th style="width:8%;">OWNER</th>
                <th style="width:10%;">SUMMARY</th>
                <th style="width:6.5%;">TRAVEL DATE</th>
                <th style="width:6.5%;">DEADLINE</th>
                <th style="width:9%;">PASSENGER</th>
                <th style="width:6%;">AMOUNT</th>
                <th style="width:5.5%;">AIR TYPE</th>
                <th style="width:7.5%;">CUSTOMER</th>
                <th style="width:7%;">PHONE</th>
                <th style="width:5%;">TYPE</th>
                <th style="width:3.5%; text-align:center;">ACT</th>
              </tr>
            </thead>"""

content = content.replace(old_thead, new_thead)

# Add Booking list configuration modal before </body>
config_modal = """  <!-- Booking list configuration Modal (matching reference screenshot) -->
  <div class="admin-modal-overlay" id="booking-config-modal" style="display:none;" onclick="if(event.target===this) closeBookingConfigModal()">
    <div class="fareos-config-modal-card">
      <div class="admin-modal-header" style="padding:16px 20px;">
        <h3 class="admin-modal-title" style="font-size:16px;">Booking list configuration</h3>
        <button class="admin-modal-close" onclick="closeBookingConfigModal()">&times;</button>
      </div>
      <div class="admin-modal-body" style="padding:20px;">

        <!-- Section 1: Booking list analytics -->
        <div class="fareos-config-section">
          <div class="fareos-config-header-row">
            <div>
              <h4 class="fareos-config-title">Booking list analytics</h4>
              <p class="fareos-config-desc">Define the tiles above the flight booking list: their labels, the help text ops sees on hover, and which statuses each one counts. A booking is counted by the first tile it matches, so the tiles always add up to the Total tile.</p>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="fareos-btn-tool" onclick="refreshAnalyticsConfig()" style="font-size:11.5px; padding:5px 10px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Refresh
              </button>
              <button class="btn-primary" onclick="openNewTilePrompt()" style="font-size:11.5px; padding:5px 12px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                + New tile
              </button>
            </div>
          </div>

          <table class="fareos-config-table">
            <thead>
              <tr>
                <th style="width:70px;">ORDER</th>
                <th>TILE</th>
                <th style="width:130px;">CLIENT STATUSES</th>
                <th style="width:70px;">ACTIVE</th>
                <th style="width:60px; text-align:right;"></th>
              </tr>
            </thead>
            <tbody id="config-tiles-tbody">
              <!-- Rendered by JS -->
            </tbody>
          </table>
        </div>

        <!-- Section 2: Deadline timeline -->
        <div class="fareos-config-section">
          <div class="fareos-config-header-row">
            <div>
              <h4 class="fareos-config-title">Deadline timeline</h4>
              <p class="fareos-config-desc">Each booking row shows a progress bar for how much of its window has elapsed, measured from when the booking was created. Windows are scoped to a tile group — a booking in a group with no window simply has no deadline.</p>
            </div>
          </div>

          <!-- Existing timeline window rows -->
          <div id="config-timeline-rules-wrap" style="margin-bottom:16px;">
            <!-- Injected by js -->
          </div>

          <!-- New / Edit Timeline Window Form -->
          <form id="timeline-window-form" onsubmit="handleSaveTimelineWindow(event)" style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:14px;">
            <div style="display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr; gap:10px; margin-bottom:12px;">
              <div>
                <label style="font-size:10px; font-weight:800; color:#64748B; text-transform:uppercase;">APPLIES TO</label>
                <select id="tw-applies-to" class="admin-form-select" style="height:32px; font-size:12px; margin-top:3px;" required>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Initiated">Initiated</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="All">All Active</option>
                </select>
              </div>
              <div>
                <label style="font-size:10px; font-weight:800; color:#64748B; text-transform:uppercase;">WINDOW (HOURS)</label>
                <input type="number" id="tw-window-hours" class="admin-form-input" value="24" min="1" max="168" style="height:32px; font-size:12px; margin-top:3px;" required />
              </div>
              <div>
                <label style="font-size:10px; font-weight:800; color:#64748B; text-transform:uppercase;">AMBER AT (%)</label>
                <input type="number" id="tw-amber-pct" class="admin-form-input" value="50" min="1" max="99" style="height:32px; font-size:12px; margin-top:3px;" required />
              </div>
              <div>
                <label style="font-size:10px; font-weight:800; color:#64748B; text-transform:uppercase;">RED AT (%)</label>
                <input type="number" id="tw-red-pct" class="admin-form-input" value="80" min="1" max="100" style="height:32px; font-size:12px; margin-top:3px;" required />
              </div>
            </div>

            <div style="margin-bottom:12px;">
              <label style="font-size:10px; font-weight:800; color:#64748B; text-transform:uppercase;">STOPS WHEN THE STATUS BECOMES</label>
              <select id="tw-stops-when" class="admin-form-select" style="height:32px; font-size:12px; margin-top:3px;" required>
                <option value="Confirmed">Confirmed (Issued / Ticketed)</option>
                <option value="Processing">Processing</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <div style="font-size:10.5px; color:#64748B; margin-top:4px;">The clock runs from booking creation and stops the moment the booking reaches one of these. At least one is required — without it the deadline would never stop.</div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #E2E8F0; padding-top:10px;">
              <span style="font-size:11px; color:#64748B;">Saving replaces the existing window for this scope.</span>
              <button type="submit" class="btn-primary" style="font-size:12px; padding:6px 14px; border-radius:6px;">
                Save window
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  </div>
"""

if "<!-- Booking list configuration Modal" not in content:
    content = content.replace('</body>', config_modal + '\n</body>')

with open("admin-flight-bookings.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated admin-flight-bookings.html successfully.")
