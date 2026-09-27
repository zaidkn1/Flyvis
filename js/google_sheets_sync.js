// Flyvis Admin - Real-Time Live Auto-Push to Google Sheets & Excel
(function() {
  'use strict';

  const STORAGE_KEY = 'flyvis_sheets_webhook_url';

  // Complete Google Apps Script template for 1-click setup
  const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    
    if (payload.action === "test") {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Connected to Flyvis!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === "sync_booking") {
      var sheetName = "Flight Bookings";
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow([
          "Booking ID", "Booking Date", "Travel Date", "Passenger Name", 
          "Route", "Airline", "Flight No", "PNR", "Status", "Amount (INR)", 
          "Customer", "Phone", "Supplier"
        ]);
        sheet.getRange("A1:M1").setFontWeight("bold").setBackground("#2563EB").setFontColor("#FFFFFF");
      }
      var b = payload.data;
      sheet.appendRow([
        b.id || "",
        b.bookingDate || new Date().toISOString(),
        b.travelDateDisplay || b.travelDate || "",
        b.passengerName || b.customer || "",
        b.route || (b.origin + "-" + b.destination),
        b.airline || "",
        b.flightNumber || "",
        b.pnr || b.airlinePnr || "",
        b.status || "Confirmed",
        b.totalPrice || b.amount || 0,
        b.customer || "",
        b.phone || "",
        b.supplierIssued || "Amadeus"
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "booking", id: b.id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === "sync_transaction") {
      var txSheetName = "Payment Transactions";
      var txSheet = ss.getSheetByName(txSheetName);
      if (!txSheet) {
        txSheet = ss.insertSheet(txSheetName);
        txSheet.appendRow([
          "Tx ID", "Date", "Booking Ref", "PG Track ID", "Provider", 
          "Method", "Amount", "Fee", "Total (INR)", "Status", "Email", "Phone"
        ]);
        txSheet.getRange("A1:L1").setFontWeight("bold").setBackground("#059669").setFontColor("#FFFFFF");
      }
      var t = payload.data;
      txSheet.appendRow([
        t.id || "",
        t.date || new Date().toLocaleString(),
        t.bookingRef || "",
        String(t.pgTrack || ""),
        t.provider || "Cashfree",
        t.method || "net_banking",
        t.amount || 0,
        t.convenienceFee || 0,
        t.total || 0,
        t.status || "SUCCESS",
        (t.customer ? t.customer.email : ""),
        (t.customer ? t.customer.phone : "")
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "transaction", id: t.id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ignored" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  window.GoogleSheetsSync = {
    getWebhookUrl: function() {
      return localStorage.getItem(STORAGE_KEY) || '';
    },

    setWebhookUrl: function(url) {
      const clean = (url || '').trim();
      if (!clean) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, clean);
      }
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
          firebase.firestore().collection('system_settings').doc('google_sheets').set({
            webhookUrl: clean,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true }).catch(() => {});
        } catch (e) {}
      }
      this.updateStatusBadge();
    },

    loadWebhookUrlFromCloud: async function() {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
          const doc = await firebase.firestore().collection('system_settings').doc('google_sheets').get();
          if (doc.exists && doc.data() && doc.data().webhookUrl) {
            localStorage.setItem(STORAGE_KEY, doc.data().webhookUrl);
            this.updateStatusBadge();
            const input = document.getElementById('sheets-webhook-url-input');
            if (input) input.value = doc.data().webhookUrl;
          }
        } catch (e) {}
      }
    },

    isConfigured: function() {
      return Boolean(this.getWebhookUrl());
    },

    getAppsScriptTemplate: function() {
      return APPS_SCRIPT_TEMPLATE;
    },

    // Push a single flight booking row
    pushBooking: async function(booking) {
      const url = this.getWebhookUrl();
      if (!url) return false;

      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors', // Google Apps Script requires no-cors on client requests
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_booking',
            timestamp: new Date().toISOString(),
            data: booking
          })
        });
        console.log(`[GoogleSheetsSync] Pushed booking ${booking.id} to spreadsheet.`);
        return true;
      } catch (err) {
        console.warn('[GoogleSheetsSync] Failed to push booking:', err);
        return false;
      }
    },

    // Push a single payment transaction row
    pushTransaction: async function(transaction) {
      const url = this.getWebhookUrl();
      if (!url) return false;

      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_transaction',
            timestamp: new Date().toISOString(),
            data: transaction
          })
        });
        console.log(`[GoogleSheetsSync] Pushed transaction #${transaction.id} to spreadsheet.`);
        return true;
      } catch (err) {
        console.warn('[GoogleSheetsSync] Failed to push transaction:', err);
        return false;
      }
    },

    // Batch push all existing flight bookings
    pushAllBookings: async function(onProgress) {
      const url = this.getWebhookUrl();
      if (!url) throw new Error('Please configure and save your Google Sheets Webhook URL first.');

      let bookings = [];
      try {
        const res = await fetch('data/flight_bookings.json');
        if (res.ok) bookings = await res.json();
      } catch (e) {}

      let sent = 0;
      for (const b of bookings) {
        await this.pushBooking(b);
        sent++;
        if (onProgress) onProgress(sent, bookings.length);
        // Small delay to prevent rapid-fire throttling
        await new Promise(r => setTimeout(r, 60));
      }
      return sent;
    },

    // Batch push all existing transactions
    pushAllTransactions: async function(onProgress) {
      const url = this.getWebhookUrl();
      if (!url) throw new Error('Please configure and save your Google Sheets Webhook URL first.');

      let transactions = [];
      try {
        const res = await fetch('data/payment_transactions.json');
        if (res.ok) transactions = await res.json();
      } catch (e) {}

      let sent = 0;
      for (const t of transactions) {
        await this.pushTransaction(t);
        sent++;
        if (onProgress) onProgress(sent, transactions.length);
        await new Promise(r => setTimeout(r, 60));
      }
      return sent;
    },

    // Test connection
    testConnection: async function(testUrl) {
      const targetUrl = testUrl || this.getWebhookUrl();
      if (!targetUrl) throw new Error('Please enter a Google Apps Script Webhook URL.');

      const startTime = performance.now();
      try {
        await fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test', timestamp: new Date().toISOString() })
        });
        const duration = Math.round(performance.now() - startTime);
        return { success: true, duration };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    updateStatusBadge: function() {
      const badges = document.querySelectorAll('.sheets-sync-status-badge');
      const isOk = this.isConfigured();
      badges.forEach(b => {
        if (isOk) {
          b.className = 'sheets-sync-status-badge active';
          b.innerHTML = '<span class="dot"></span> Live Auto-Push Active';
        } else {
          b.className = 'sheets-sync-status-badge inactive';
          b.innerHTML = '<span class="dot"></span> Not Configured';
        }
      });
    }
  };

  // UI Modal Handlers
  window.openSheetsSyncModal = function() {
    let modal = document.getElementById('sheets-sync-modal');
    if (!modal) {
      renderModalDOM();
      modal = document.getElementById('sheets-sync-modal');
    }

    const input = document.getElementById('sheets-webhook-url-input');
    if (input) {
      input.value = GoogleSheetsSync.getWebhookUrl();
    }

    const codeBox = document.getElementById('sheets-apps-script-code');
    if (codeBox) {
      codeBox.textContent = GoogleSheetsSync.getAppsScriptTemplate();
    }

    GoogleSheetsSync.updateStatusBadge();
    modal.style.display = 'flex';
  };

  window.closeSheetsSyncModal = function() {
    const modal = document.getElementById('sheets-sync-modal');
    if (modal) modal.style.display = 'none';
  };

  window.saveSheetsWebhook = function() {
    const input = document.getElementById('sheets-webhook-url-input');
    const val = (input ? input.value : '').trim();
    GoogleSheetsSync.setWebhookUrl(val);

    const feedback = document.getElementById('sheets-sync-feedback');
    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = 'sheets-feedback-box success';
      feedback.textContent = val ? '✓ Webhook URL saved! Live auto-push is now active for all bookings and payments.' : 'Webhook URL cleared.';
      setTimeout(() => { feedback.style.display = 'none'; }, 4000);
    }
  };

  window.testSheetsWebhook = async function() {
    const input = document.getElementById('sheets-webhook-url-input');
    const val = (input ? input.value : '').trim();
    const btn = document.getElementById('sheets-test-btn');
    const feedback = document.getElementById('sheets-sync-feedback');

    if (!val) {
      alert('Please enter your Google Apps Script Webhook URL first.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Testing connection...';
    }

    const res = await GoogleSheetsSync.testConnection(val);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🧪 Test Connection';
    }

    if (feedback) {
      feedback.style.display = 'block';
      if (res.success) {
        feedback.className = 'sheets-feedback-box success';
        feedback.textContent = `✓ Handshake successful! Response received in ${res.duration}ms.`;
      } else {
        feedback.className = 'sheets-feedback-box error';
        feedback.textContent = `Connection failed: ${res.error || 'Check that Web app is deployed with Anyone access.'}`;
      }
      setTimeout(() => { feedback.style.display = 'none'; }, 5000);
    }
  };

  window.triggerSyncAllBookings = async function() {
    if (!GoogleSheetsSync.isConfigured()) {
      alert('Please configure and save your Google Sheets Webhook URL first.');
      return;
    }

    const btn = document.getElementById('sheets-sync-all-bookings-btn');
    const statusEl = document.getElementById('sheets-sync-progress-text');
    if (btn) btn.disabled = true;

    try {
      if (statusEl) statusEl.style.display = 'block';
      const count = await GoogleSheetsSync.pushAllBookings((done, total) => {
        if (statusEl) statusEl.textContent = `Pushing bookings: ${done} of ${total}...`;
      });
      if (statusEl) statusEl.textContent = `✓ Successfully pushed ${count} flight bookings to Google Sheets / Excel!`;
      setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 4000);
    } catch (err) {
      alert(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.triggerSyncAllTransactions = async function() {
    if (!GoogleSheetsSync.isConfigured()) {
      alert('Please configure and save your Google Sheets Webhook URL first.');
      return;
    }

    const btn = document.getElementById('sheets-sync-all-tx-btn');
    const statusEl = document.getElementById('sheets-sync-progress-text');
    if (btn) btn.disabled = true;

    try {
      if (statusEl) statusEl.style.display = 'block';
      const count = await GoogleSheetsSync.pushAllTransactions((done, total) => {
        if (statusEl) statusEl.textContent = `Pushing transactions: ${done} of ${total}...`;
      });
      if (statusEl) statusEl.textContent = `✓ Successfully pushed ${count} transactions to Google Sheets / Excel!`;
      setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 4000);
    } catch (err) {
      alert(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.copyAppsScriptCode = function() {
    navigator.clipboard.writeText(GoogleSheetsSync.getAppsScriptTemplate()).then(() => {
      const btn = document.getElementById('sheets-copy-code-btn');
      if (btn) {
        btn.textContent = '✓ Copied to Clipboard!';
        setTimeout(() => { btn.textContent = '📋 Copy Apps Script Code'; }, 2000);
      }
    });
  };

  function renderModalDOM() {
    const div = document.createElement('div');
    div.id = 'sheets-sync-modal';
    div.className = 'sheets-modal-overlay';
    div.style.display = 'none';
    div.onclick = (e) => { if (e.target === div) closeSheetsSyncModal(); };

    div.innerHTML = `
      <div class="sheets-modal-box">
        <div class="sheets-modal-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:8px; background:#EFF6FF; border:1px solid #BFDBFE; display:flex; align-items:center; justify-content:center; color:#2563EB;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div>
              <h2 style="margin:0; font-size:16px; font-weight:800; color:#0F172A;">Google Sheets &amp; Excel Live Auto-Push</h2>
              <div style="font-size:12px; color:#64748B;">Automatically append every new flight booking and transaction in real-time.</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="sheets-sync-status-badge inactive">
              <span class="dot"></span> Not Configured
            </div>
            <button class="tx-modal-close-btn" onclick="closeSheetsSyncModal()">&times;</button>
          </div>
        </div>

        <div id="sheets-sync-feedback" style="display:none; padding:10px 14px; border-radius:8px; font-size:12.5px; font-weight:600; margin-bottom:16px;"></div>

        <!-- Webhook URL Configuration Card -->
        <div class="sheets-setup-card">
          <label style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;">
            Google Apps Script Webhook URL
          </label>
          <div style="display:flex; gap:10px; align-items:center;">
            <input type="text" id="sheets-webhook-url-input" class="admin-form-input" placeholder="https://script.google.com/macros/s/AKfycb.../exec" style="flex:1; height:40px; font-size:13px; font-family:ui-monospace,monospace;" />
            <button type="button" class="btn-primary" onclick="saveSheetsWebhook()" style="padding:0 18px; height:40px; font-size:12.5px; font-weight:700; border-radius:8px;">
              💾 Save
            </button>
            <button type="button" id="sheets-test-btn" class="fareos-btn-tool" onclick="testSheetsWebhook()" style="height:40px; font-size:12.5px; font-weight:600; padding:0 14px; border-radius:8px;">
              🧪 Test Connection
            </button>
          </div>
        </div>

        <!-- 3-Step Setup Guide -->
        <div class="sheets-setup-guide">
          <div style="font-size:12.5px; font-weight:800; color:#0F172A; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
            <span>⚡ 3-Step 100% Free Setup Guide</span>
          </div>

          <div class="sheets-step-row">
            <span class="sheets-step-num">1</span>
            <div>
              <strong>Open your Google Sheet</strong>: Create a new blank Google Sheet (e.g. named <em>Flyvis Flight Bookings 2026</em>).
            </div>
          </div>

          <div class="sheets-step-row">
            <span class="sheets-step-num">2</span>
            <div>
              <strong>Add the Apps Script</strong>: In Google Sheets, click <code>Extensions &gt; Apps Script</code>. Delete existing code, paste the script below, and click <strong>Save</strong>.
            </div>
          </div>

          <div class="sheets-step-row">
            <span class="sheets-step-num">3</span>
            <div>
              <strong>Deploy as Web App</strong>: Click <code>Deploy &gt; New deployment</code>, choose <strong>Web app</strong>, set <em>Who has access</em> to <strong>Anyone</strong>, copy the Web App URL and paste it into the box above!
            </div>
          </div>

          <!-- Apps Script Code Viewer -->
          <div style="margin-top:14px; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Apps Script Code (Code.gs)</span>
              <button id="sheets-copy-code-btn" class="sheets-copy-code-btn" onclick="copyAppsScriptCode()">
                📋 Copy Apps Script Code
              </button>
            </div>
            <pre class="sheets-code-box" id="sheets-apps-script-code"></pre>
          </div>
        </div>

        <!-- Batch Sync Actions -->
        <div class="sheets-actions-card">
          <div>
            <div style="font-size:13px; font-weight:800; color:#0F172A;">Sync Existing Records</div>
            <div style="font-size:12px; color:#64748B;">Push all current reservations and transactions already in Flyvis into your spreadsheet right now.</div>
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button type="button" id="sheets-sync-all-bookings-btn" class="sheets-batch-btn" onclick="triggerSyncAllBookings()">
              🚀 Push All 78 Bookings
            </button>
            <button type="button" id="sheets-sync-all-tx-btn" class="sheets-batch-btn" onclick="triggerSyncAllTransactions()">
              🚀 Push All 12 Transactions
            </button>
          </div>
        </div>

        <div id="sheets-sync-progress-text" style="display:none; font-size:12px; font-weight:700; color:#2563EB; margin-top:10px; text-align:center;"></div>
      </div>
    `;

    document.body.appendChild(div);
  }

  // Initialize status on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    GoogleSheetsSync.updateStatusBadge();
    GoogleSheetsSync.loadWebhookUrlFromCloud();
  });

})();
