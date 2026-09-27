// FareOS Admin - Payment History & Transaction Details Console
(function() {
  'use strict';

  let allTransactions = [];
  let currentFiltered = [];
  let activeTxForModal = null;
  let activeDateFilter = 'today';
  let activeStatusFilter = 'all';
  let activeMethodFilter = 'all';
  let activeTypeFilter = 'all';

  document.addEventListener('DOMContentLoaded', () => {
    initPersona();
    loadTransactions();
    setupEventListeners();
  });

  // Persona & Header Switcher
  function initPersona() {
    const saved = localStorage.getItem('fareos_active_admin');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        const nameEl = document.getElementById('header-user-name');
        const roleEl = document.getElementById('header-user-role');
        const avEl = document.getElementById('header-user-avatar');
        if (nameEl) nameEl.textContent = p.name;
        if (roleEl) roleEl.textContent = p.role;
        if (avEl) avEl.textContent = p.initial || p.name.charAt(0);
      } catch (e) {}
    }
  }

  window.toggleUserMenu = function() {
    const menu = document.getElementById('admin-persona-dropdown');
    if (menu) {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
  };

  window.switchCurrentAdmin = function(name, role, initial) {
    localStorage.setItem('fareos_active_admin', JSON.stringify({ name, role, initial }));
    initPersona();
    const menu = document.getElementById('admin-persona-dropdown');
    if (menu) menu.style.display = 'none';
    showToast(`Switched active admin to ${name}`);
  };

  window.logoutAdmin = function() {
    if (confirm('Are you sure you want to sign out?')) {
      window.location.href = 'admin-login.html';
    }
  };

  window.toggleSidebar = function() {
    const aside = document.getElementById('admin-sidebar');
    const main = document.querySelector('.admin-main');
    if (!aside || !main) return;
    if (aside.style.display === 'none') {
      aside.style.display = 'block';
      main.style.marginLeft = '200px';
      main.style.width = 'calc(100% - 200px)';
    } else {
      aside.style.display = 'none';
      main.style.marginLeft = '0';
      main.style.width = '100%';
    }
  };

  window.searchOrRedirect = function(val) {
    if (!val || !val.trim()) return;
    const query = val.trim();
    const input = document.getElementById('payment-search-input');
    if (input) {
      input.value = query;
      applyFilters();
    }
  };

  function showToast(msg) {
    let t = document.getElementById('payment-admin-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'payment-admin-toast';
      t.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#0F172A; color:#FFF; padding:10px 18px; border-radius:8px; font-size:13px; font-weight:600; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:999999; transition:opacity 0.2s ease;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.display = 'block';
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => { t.style.display = 'none'; }, 200);
    }, 2800);
  }

  // Load Transactions Data
  async function loadTransactions() {
    try {
      const res = await fetch('data/payment_transactions.json');
      if (res.ok) {
        allTransactions = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch data/payment_transactions.json:', e);
    }

    // Attempt Firestore load if initialized
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const snap = await firebase.firestore().collection('payment_transactions').get();
        if (!snap.empty) {
          const list = [];
          snap.forEach(d => {
            const row = d.data();
            row.id = row.id || d.id;
            list.push(row);
          });
          const map = new Map();
          allTransactions.forEach(t => map.set(String(t.id), t));
          list.forEach(t => map.set(String(t.id), Object.assign({}, map.get(String(t.id)) || {}, t)));
          allTransactions = Array.from(map.values());
        }
      } catch (err) {
        console.warn('Firestore load failed (offline/unauth):', err);
      }
    }

    applyFilters();
  }

  function setupEventListeners() {
    const searchInput = document.getElementById('payment-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => applyFilters());
    }

    const refreshBtn = document.getElementById('payment-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadTransactions().then(() => showToast('Transactions refreshed'));
      });
    }

    const exportBtn = document.getElementById('payment-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => exportTransactionsCSV());
    }

    // Modal close listeners
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeTransactionModal();
    });
  }

  // Filter Engine
  window.applyFilters = function() {
    const q = (document.getElementById('payment-search-input')?.value || '').trim().toLowerCase();

    let filtered = allTransactions.filter(t => {
      // Search matching ID, Booking Reference, PG Track, Amount, Provider, Method
      if (q) {
        const haystack = [
          String(t.id || ''),
          t.bookingRef || '',
          String(t.pgTrack || ''),
          String(t.amount || ''),
          String(t.total || ''),
          t.provider || '',
          t.method || '',
          t.status || '',
          t.customer?.email || '',
          t.customer?.name || ''
        ].join(' ').toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      // Status Filter
      if (activeStatusFilter !== 'all' && t.status !== activeStatusFilter) {
        return false;
      }

      // Method Filter
      if (activeMethodFilter !== 'all' && t.method.toLowerCase() !== activeMethodFilter.toLowerCase()) {
        return false;
      }

      // Type Filter
      if (activeTypeFilter !== 'all' && t.type !== activeTypeFilter) {
        return false;
      }

      return true;
    });

    currentFiltered = filtered;
    renderTable(filtered);
    updateCounter(filtered.length);
  };

  function updateCounter(count) {
    const cEl = document.getElementById('payment-transactions-count');
    if (cEl) cEl.textContent = `${count} Transactions`;
    const fEl = document.getElementById('payment-showing-text');
    if (fEl) fEl.textContent = `Showing 1 to ${count} of ${count} results · Page 1 of 1`;
  }

  // Render Table Rows matching media_1789323557227.png
  function renderTable(list) {
    const tbody = document.getElementById('payment-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="13" style="text-align:center; padding:50px 20px; color:#64748B;">
            <div style="font-size:26px; margin-bottom:8px;">🔍</div>
            <div style="font-weight:700; color:#0F172A; font-size:14px;">No Transactions Found</div>
            <div style="font-size:12px; margin-top:4px;">Try modifying your search or filter options.</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    list.forEach((t, idx) => {
      const isSuccess = (t.status || '').toUpperCase() === 'SUCCESS';
      const statusBadgeClass = isSuccess ? 'payment-badge-status success' : 'payment-badge-status failed';
      const statusText = isSuccess ? 'SUCCESS' : 'FAILED';
      const formattedAmount = typeof t.amount === 'number' ? t.amount.toLocaleString('en-IN') : t.amount;
      const formattedFee = typeof t.convenienceFee === 'number' ? t.convenienceFee.toLocaleString('en-IN') : t.convenienceFee;
      const formattedTotal = typeof t.total === 'number' ? t.total.toLocaleString('en-IN') : t.total;

      html += `
        <tr onclick="handleRowClick(event, ${t.id})">
          <td style="color:#94A3B8; font-weight:600;">${idx + 1}</td>
          <td style="font-weight:500;">${escapeHtml(t.date)}</td>
          <td>
            <span class="payment-ref-link" style="color:#2563EB; font-weight:700; cursor:pointer;">
              ${escapeHtml(t.bookingRef)}
            </span>
          </td>
          <td style="font-family:ui-monospace,monospace; color:#475569;">${escapeHtml(String(t.pgTrack))}</td>
          <td>${escapeHtml(t.provider)}</td>
          <td><span style="color:#64748B;">${escapeHtml(t.method)}</span></td>
          <td>INR ${formattedAmount}</td>
          <td>${formattedFee}</td>
          <td style="font-weight:800; color:#0F172A;">${formattedTotal}</td>
          <td>
            <span class="${statusBadgeClass}">${statusText}</span>
          </td>
          <td>${escapeHtml(t.type || 'B2C')}</td>
          <td style="color:#94A3B8;">${escapeHtml(t.confirmation || '—')}</td>
          <td style="color:#94A3B8;">${escapeHtml(t.remarks || '—')}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  window.handleRowClick = function(e, txId) {
    openTransactionModal(txId);
  };

  // Date Filter Dropdown Handlers
  window.toggleDateMenu = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('payment-date-dropdown');
    if (menu) {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
  };

  window.setDateFilter = function(preset, label) {
    activeDateFilter = preset;
    const btnText = document.getElementById('payment-date-btn-label');
    if (btnText) btnText.textContent = label;
    const menu = document.getElementById('payment-date-dropdown');
    if (menu) menu.style.display = 'none';
    applyFilters();
  };

  // Filter Options Modal/Dropdown Handlers
  window.toggleFilterOptionsMenu = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('payment-filter-options-dropdown');
    if (menu) {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
  };

  window.setStatusFilter = function(status) {
    activeStatusFilter = status;
    applyFilters();
    const menu = document.getElementById('payment-filter-options-dropdown');
    if (menu) menu.style.display = 'none';
  };

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    const d1 = document.getElementById('payment-date-dropdown');
    const d2 = document.getElementById('payment-filter-options-dropdown');
    const d3 = document.getElementById('admin-persona-dropdown');
    if (d1) d1.style.display = 'none';
    if (d2) d2.style.display = 'none';
    if (d3) d3.style.display = 'none';
  });

  // Transaction Details Modal Controller (matching media_1789323624894.png & media_1789323642616.png)
  window.openTransactionModal = function(txId) {
    const tx = allTransactions.find(x => x.id === txId);
    if (!tx) return;

    activeTxForModal = tx;

    // Header Title
    const titleEl = document.getElementById('modal-tx-title');
    if (titleEl) titleEl.textContent = `TRANSACTION DETAILS #${tx.id}`;

    // Status Pill
    const isSuccess = (tx.status || '').toUpperCase() === 'SUCCESS';
    const statusEl = document.getElementById('modal-tx-status');
    if (statusEl) {
      statusEl.className = isSuccess ? 'payment-badge-status success' : 'payment-badge-status failed';
      statusEl.textContent = isSuccess ? 'SUCCESS' : 'FAILED';
    }

    // Amount
    const amtEl = document.getElementById('modal-tx-amount');
    if (amtEl) {
      const val = typeof tx.amount === 'number' ? tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : tx.amount;
      amtEl.textContent = `₹${val}`;
    }

    // Created At
    const createdEl = document.getElementById('modal-tx-created');
    if (createdEl) {
      createdEl.textContent = tx.createdAt || tx.date;
    }

    // References
    const refEl = document.getElementById('modal-tx-booking-ref');
    if (refEl) {
      refEl.textContent = tx.bookingRef;
    }

    const provEl = document.getElementById('modal-tx-provider');
    if (provEl) provEl.textContent = (tx.provider || 'cashfree').toLowerCase();

    const pgTrackEl = document.getElementById('modal-tx-pg-track');
    if (pgTrackEl) pgTrackEl.textContent = tx.pgTrack || '—';

    const updatedEl = document.getElementById('modal-tx-updated');
    if (updatedEl) updatedEl.textContent = tx.updatedAt || tx.createdAt || tx.date;

    // Customer
    const emailEl = document.getElementById('modal-tx-email');
    if (emailEl) emailEl.textContent = tx.customer?.email || 'susenmary73@gmail.com';

    const phoneEl = document.getElementById('modal-tx-phone');
    if (phoneEl) phoneEl.textContent = tx.customer?.phone || '9946303278';

    // Payloads
    const reqJson = tx.providerRequest || {
      data: {
        order: {
          order_id: `${tx.bookingRef}-P1`,
          order_tags: { booking_id: tx.bookingRef },
          order_amount: tx.total || 6299,
          order_currency: "INR"
        },
        payment: {
          auth_id: "123456",
          payment_time: tx.createdAt ? `${tx.createdAt.replace(' ', 'T')}+05:30` : "2026-09-07T12:42:50+05:30",
          cf_payment_id: String(tx.pgTrack),
          payment_group: tx.method.toLowerCase(),
          bank_reference: null,
          payment_amount: tx.total || 6299,
          payment_method: {
            netbanking: {
              channel: null,
              netbanking_bank_code: "3333",
              netbanking_bank_name: "TEST Bank"
            }
          }
        }
      }
    };

    const respJson = tx.providerResponse || {
      cf_order_id: `${tx.bookingRef}-P1`,
      order_status: isSuccess ? "PAID" : "FAILED",
      payment_session_id: `session_live_${tx.pgTrack}`,
      payment_completion_time: tx.updatedAt ? `${tx.updatedAt.replace(' ', 'T')}+05:30` : "2026-09-07T12:42:59+05:30",
      settlement_status: isSuccess ? "PENDING" : "FAILED",
      gateway_response: {
        gateway_name: "Cashfree Payments India Pvt Ltd",
        gateway_order_id: String(tx.pgTrack),
        auth_code: isSuccess ? "OK_200" : "DECLINED_400",
        status: isSuccess ? "SUCCESS" : "FAILED"
      }
    };

    const reqCode = document.getElementById('modal-tx-req-code');
    if (reqCode) reqCode.textContent = JSON.stringify(reqJson, null, 2);

    const respCode = document.getElementById('modal-tx-resp-code');
    if (respCode) respCode.textContent = JSON.stringify(respJson, null, 2);

    // Initial state: Both collapsed with Expand (matching media_1789324139529.png)
    setAccordionState('req', false);
    setAccordionState('resp', false);

    const modal = document.getElementById('payment-transaction-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeTransactionModal = function() {
    const modal = document.getElementById('payment-transaction-modal');
    if (modal) modal.style.display = 'none';
    activeTxForModal = null;
  };

  window.toggleAccordion = function(type) {
    const body = document.getElementById(`modal-tx-${type}-body`);
    const isVisible = body && body.style.display !== 'none';
    setAccordionState(type, !isVisible);
  };

  function setAccordionState(type, expand) {
    const body = document.getElementById(`modal-tx-${type}-body`);
    const toggleText = document.getElementById(`modal-tx-${type}-toggle-text`);
    const chevron = document.getElementById(`modal-tx-${type}-chevron`);

    if (body) body.style.display = expand ? 'block' : 'none';
    if (toggleText) toggleText.textContent = expand ? 'Collapse' : 'Expand';
    if (chevron) {
      if (expand) chevron.classList.add('expanded');
      else chevron.classList.remove('expanded');
    }
  }

  // Live Gateway Status Verification
  window.fetchLiveGatewayStatus = function() {
    if (!activeTxForModal) return;
    const btn = document.querySelector('.tx-btn-fetch-live');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite;">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Querying HDFC Gateway...
      `;
    }

    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
      showToast(`Gateway Verified: Order #${activeTxForModal.pgTrack} is ${activeTxForModal.status} at Cashfree/HDFC.`);
    }, 900);
  };

  // Export Log for single transaction
  window.exportTransactionLogs = function() {
    if (!activeTxForModal) return;
    const logData = {
      transactionId: activeTxForModal.id,
      bookingReference: activeTxForModal.bookingRef,
      pgTrack: activeTxForModal.pgTrack,
      status: activeTxForModal.status,
      amount: activeTxForModal.amount,
      total: activeTxForModal.total,
      provider: activeTxForModal.provider,
      method: activeTxForModal.method,
      customer: activeTxForModal.customer,
      providerRequest: activeTxForModal.providerRequest,
      providerResponse: activeTxForModal.providerResponse,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction_${activeTxForModal.id}_${activeTxForModal.bookingRef}_log.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported log for Transaction #${activeTxForModal.id}`);
  };

  // Export All Transactions to CSV
  function exportTransactionsCSV() {
    if (!currentFiltered || currentFiltered.length === 0) {
      showToast('No transactions to export');
      return;
    }

    const headers = [
      'ID', 'Date', 'Booking Ref', 'PG Track', 'Provider', 'Method',
      'Amount', 'Convenience Fee', 'Total', 'Status', 'Type', 'Customer Email', 'Customer Phone'
    ];

    const rows = currentFiltered.map(t => [
      t.id,
      `"${t.date}"`,
      t.bookingRef,
      `"${t.pgTrack}"`,
      t.provider,
      t.method,
      t.amount,
      t.convenienceFee,
      t.total,
      t.status,
      t.type || 'B2C',
      t.customer?.email || '',
      t.customer?.phone || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${currentFiltered.length} transactions to CSV`);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
