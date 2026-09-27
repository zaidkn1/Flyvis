// FareOS Admin - Booking Calendar Timeline Controller
(function() {
  'use strict';

  let allBookings = [];
  let currentFilterResults = [];
  let activeMode = 'flights'; // 'flights' | 'hotels'
  let activeView = 'list';    // 'list' | 'grid'
  let hasSearched = false;

  // Month names map
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Initialize once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initPersona();
    loadBookingData();
    setupEventListeners();
  });

  // Persona & Header
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
    // Redirect to search or populate local filter
    const input = document.getElementById('calendar-search-input');
    if (input) {
      input.value = query;
      handleCalendarSearch();
    }
  };

  // Toast utility
  function showToast(msg) {
    let t = document.getElementById('calendar-admin-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'calendar-admin-toast';
      t.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#0F172A; color:#FFF; padding:10px 18px; border-radius:8px; font-size:13px; font-weight:600; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:99999; transition:opacity 0.2s ease;';
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

  // Load Data
  async function loadBookingData() {
    try {
      // 1. Try local JSON first for fast reliable timeline matching
      const res = await fetch('data/flight_bookings.json');
      if (res.ok) {
        allBookings = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch data/flight_bookings.json:', e);
    }

    // 2. Try Firestore flight_bookings if Firebase is present
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const snap = await firebase.firestore().collection('flight_bookings').get();
        if (!snap.empty) {
          const fbList = [];
          snap.forEach(doc => {
            const d = doc.data();
            d.id = d.id || doc.id;
            fbList.push(d);
          });
          // Merge unique by id
          const map = new Map();
          allBookings.forEach(b => map.set(b.id, b));
          fbList.forEach(b => map.set(b.id, Object.assign({}, map.get(b.id) || {}, b)));
          allBookings = Array.from(map.values());
        }
      } catch (err) {
        console.warn('Firestore load failed (offline or unauthenticated):', err);
      }
    }

    updateCounter(0, allBookings.length);
  }

  function setupEventListeners() {
    const searchBtn = document.getElementById('calendar-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => handleCalendarSearch());
    }

    const resetBtn = document.getElementById('calendar-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => resetCalendarFilters());
    }

    const refreshBtn = document.getElementById('calendar-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadBookingData().then(() => {
          if (hasSearched) handleCalendarSearch();
        });
      });
    }

    const searchInput = document.getElementById('calendar-search-input');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCalendarSearch();
      });
    }

    // Mode toggles (Flights vs Hotels)
    const modeFlights = document.getElementById('mode-flights-btn');
    const modeHotels = document.getElementById('mode-hotels-btn');
    if (modeFlights && modeHotels) {
      modeFlights.addEventListener('click', () => {
        activeMode = 'flights';
        modeFlights.classList.add('active');
        modeHotels.classList.remove('active');
        if (hasSearched) handleCalendarSearch();
      });
      modeHotels.addEventListener('click', () => {
        activeMode = 'hotels';
        modeHotels.classList.add('active');
        modeFlights.classList.remove('active');
        renderHotelsPlaceholder();
      });
    }

    // View toggles (List View vs Grid View)
    const viewList = document.getElementById('view-list-btn');
    const viewGrid = document.getElementById('view-grid-btn');
    if (viewList && viewGrid) {
      viewList.addEventListener('click', () => {
        activeView = 'list';
        viewList.classList.add('active');
        viewGrid.classList.remove('active');
        if (hasSearched) renderTimeline(currentFilterResults);
      });
      viewGrid.addEventListener('click', () => {
        activeView = 'grid';
        viewGrid.classList.add('active');
        viewList.classList.remove('active');
        if (hasSearched) renderTimeline(currentFilterResults);
      });
    }
  }

  // Core Search Engine: When user clicks search
  // "also if i dont provide any filters and hit search it gives all the flight booking as per the date"
  window.handleCalendarSearch = function() {
    if (activeMode === 'hotels') {
      renderHotelsPlaceholder();
      return;
    }

    hasSearched = true;

    const fromDateVal = (document.getElementById('cal-from-date')?.value || '').trim();
    const toDateVal = (document.getElementById('cal-to-date')?.value || '').trim();
    const monthVal = document.getElementById('cal-month')?.value || '';
    const yearVal = document.getElementById('cal-year')?.value || '';
    const supplierVal = document.getElementById('cal-supplier')?.value || '';
    const clientVal = document.getElementById('cal-client')?.value || '';
    const statusVal = document.getElementById('cal-status')?.value || '';
    const queryVal = (document.getElementById('calendar-search-input')?.value || '').trim().toLowerCase();

    // Check if user has provided any filter
    const hasAnyFilter = fromDateVal || toDateVal || 
      (supplierVal && supplierVal !== 'all') || 
      (clientVal && clientVal !== 'all') || 
      (statusVal && statusVal !== 'all') || 
      queryVal;

    let filtered = [...allBookings];

    if (!hasAnyFilter) {
      // User provided NO filters: Return all flight bookings grouped as per date!
      filtered = [...allBookings];
    } else {
      // Apply filters
      filtered = filtered.filter(b => {
        const bDate = b.travelDate || b.depDateIso || '';
        
        // Date range filter
        if (fromDateVal && bDate && bDate < fromDateVal) return false;
        if (toDateVal && bDate && bDate > toDateVal) return false;

        // Month filter (if month is chosen and user selected a specific month)
        if (monthVal && monthVal !== 'all') {
          // Check travelDate format YYYY-MM-DD or display
          const mIndex = parseInt(monthVal, 10);
          if (bDate) {
            const dateObj = new Date(bDate);
            if (!isNaN(dateObj.getTime()) && (dateObj.getMonth() + 1) !== mIndex) {
              return false;
            }
          }
        }

        // Year filter
        if (yearVal && yearVal !== 'all' && bDate) {
          const dateObj = new Date(bDate);
          if (!isNaN(dateObj.getTime()) && dateObj.getFullYear().toString() !== yearVal) {
            return false;
          }
        }

        // Supplier
        if (supplierVal && supplierVal !== 'all') {
          const supp = (b.supplierIssued || b.supplierSearch || b.airline || '').toLowerCase();
          if (!supp.includes(supplierVal.toLowerCase())) return false;
        }

        // Client
        if (clientVal && clientVal !== 'all') {
          const cType = (b.customerType || '').toLowerCase();
          if (clientVal === 'regular' && !cType.includes('regular')) return false;
          if (clientVal === 'b2b' && !cType.includes('b2b')) return false;
        }

        // Status
        if (statusVal && statusVal !== 'all') {
          const st = (b.status || '').toLowerCase();
          if (st !== statusVal.toLowerCase()) return false;
        }

        // Universal Text Query (PNR, Passenger Name, Booking ID, Route)
        if (queryVal) {
          const haystack = [
            b.id || '',
            b.pnr || '',
            b.airlinePnr || '',
            b.passengerName || '',
            b.customer || '',
            b.route || '',
            b.summary || '',
            b.flightNumber || ''
          ].join(' ').toLowerCase();

          if (!haystack.includes(queryVal)) return false;
        }

        return true;
      });
    }

    currentFilterResults = filtered;

    // Update Counter
    updateCounter(filtered.length, allBookings.length);

    // Hide Empty State, Show Results
    const emptyState = document.getElementById('calendar-empty-state');
    const resultsContainer = document.getElementById('calendar-timeline-results');
    if (emptyState) emptyState.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'block';

    renderTimeline(filtered);
  };

  // Reset Filters
  window.resetCalendarFilters = function() {
    const fromDateEl = document.getElementById('cal-from-date');
    const toDateEl = document.getElementById('cal-to-date');
    const monthEl = document.getElementById('cal-month');
    const yearEl = document.getElementById('cal-year');
    const supplierEl = document.getElementById('cal-supplier');
    const clientEl = document.getElementById('cal-client');
    const statusEl = document.getElementById('cal-status');
    const searchInput = document.getElementById('calendar-search-input');

    if (fromDateEl) fromDateEl.value = '';
    if (toDateEl) toDateEl.value = '';
    if (monthEl) monthEl.value = '9'; // September default
    if (yearEl) yearEl.value = '2026';
    if (supplierEl) supplierEl.value = 'all';
    if (clientEl) clientEl.value = 'all';
    if (statusEl) statusEl.value = 'all';
    if (searchInput) searchInput.value = '';

    // Revert to empty state
    hasSearched = false;
    currentFilterResults = [];
    updateCounter(0, allBookings.length);

    const emptyState = document.getElementById('calendar-empty-state');
    const resultsContainer = document.getElementById('calendar-timeline-results');
    if (emptyState) emptyState.style.display = 'flex';
    if (resultsContainer) {
      resultsContainer.style.display = 'none';
      resultsContainer.innerHTML = '';
    }
  };

  function updateCounter(shown, total) {
    const shownEl = document.getElementById('calendar-shown-count');
    const totalEl = document.getElementById('calendar-total-count');
    if (shownEl) shownEl.textContent = shown;
    if (totalEl) totalEl.textContent = total;
  }

  // Group Bookings by Date and sort chronologically descending
  function groupBookingsByDate(list) {
    const groups = new Map();

    list.forEach(b => {
      // Determine date key
      let dateKey = b.travelDateDisplay || b.depDate;
      let sortKey = b.travelDate || '2026-09-01';

      if (!dateKey && b.travelDate) {
        const parts = b.travelDate.split('-');
        if (parts.length === 3) {
          const day = parts[2];
          const m = parseInt(parts[1], 10) - 1;
          dateKey = `${day} ${monthNames[m]?.substring(0, 3) || 'Sep'}`;
        }
      }

      if (!dateKey) dateKey = '26 Sep';

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          dateKey: dateKey,
          sortKey: sortKey,
          day: dateKey.split(' ')[0] || '26',
          month: dateKey.split(' ')[1] || 'Sep',
          bookings: []
        });
      }

      groups.get(dateKey).bookings.push(b);
    });

    // Sort groups descending by sortKey
    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    // Sort bookings within each group by departureTime descending
    sortedGroups.forEach(g => {
      g.bookings.sort((a, b) => {
        const timeA = a.departureTime || a.depTime || '00:00';
        const timeB = b.departureTime || b.depTime || '00:00';
        return timeB.localeCompare(timeA);
      });
    });

    return sortedGroups;
  }

  // Render Timeline View matching reference screenshots
  function renderTimeline(bookings) {
    const container = document.getElementById('calendar-timeline-results');
    if (!container) return;

    if (!bookings || bookings.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:50px 20px; color:#64748B;">
          <div style="font-size:28px; margin-bottom:10px;">🔍</div>
          <div style="font-size:15px; font-weight:700; color:#0F172A;">No Bookings Found</div>
          <div style="font-size:12.5px; margin-top:4px;">Try loosening your filters or clearing your search term.</div>
        </div>
      `;
      return;
    }

    const groups = groupBookingsByDate(bookings);

    let html = `<div class="calendar-timeline-container">`;

    groups.forEach(g => {
      html += `
        <div class="calendar-date-group">
          <!-- Date Left Marker -->
          <div class="calendar-date-sidebar">
            <div class="cal-day">${escapeHtml(g.day)}</div>
            <div class="cal-month">${escapeHtml(g.month)}</div>
          </div>

          <!-- Timeline Content Track -->
          <div class="calendar-date-content">
      `;

      g.bookings.forEach(b => {
        const timeStr = b.departureTime || b.depTime || '11:00';
        const paxName = b.passengerName || b.customer || 'PASSENGER';
        const bId = b.id || 'BKNG-0000000';
        const pnr = b.pnr || b.airlinePnr || 'PNR123';
        const summary = b.summary || `${b.route || (b.origin + '-' + b.destination)} | ${g.dateKey} | ${b.paxCount || 1} Pax`;
        const price = Number(b.totalPrice || b.amount || 6166).toLocaleString('en-IN');

        html += `
          <div class="calendar-booking-row">
            <!-- Departure Time -->
            <div class="calendar-booking-time">${escapeHtml(timeStr)}</div>

            <!-- Airplane Node on Continuous Line -->
            <div class="calendar-plane-node" title="Flight Departure">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>

            <!-- Passenger Name -->
            <div class="calendar-booking-pax" title="${escapeHtml(paxName)}">
              ${escapeHtml(paxName)}
            </div>

            <!-- Booking Ref Link -->
            <div class="calendar-booking-ref-box">
              <span class="lbl">BOOKING REF</span>
              <a href="admin-flight-booking-detail.html?id=${encodeURIComponent(bId)}&view=compact" title="Open Compact Booking Detail">
                ${escapeHtml(bId)}
              </a>
            </div>

            <!-- PNR -->
            <div class="calendar-booking-pnr-box">
              <span class="lbl">PNR</span>
              <span class="pnr-val">${escapeHtml(pnr)}</span>
            </div>

            <!-- Summary / Route -->
            <div class="calendar-booking-summary" title="${escapeHtml(summary)}">
              ${escapeHtml(summary)}
            </div>

            <!-- Info Icon Button -->
            <button class="calendar-booking-info-btn" onclick="showBookingQuickInfo('${escapeHtml(bId)}', event)" title="Quick View">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </button>

            <!-- Price -->
            <div class="calendar-booking-price">
              ₹${price}
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `</div>`;

    container.innerHTML = html;
  }

  // Quick Info Modal/Toast
  window.showBookingQuickInfo = function(bookingId, event) {
    if (event) event.stopPropagation();
    const b = allBookings.find(x => x.id === bookingId);
    if (!b) return;

    const info = `Booking: ${b.id}\nPNR: ${b.pnr}\nPassenger: ${b.passengerName}\nAirline: ${b.airline || b.supplierIssued || 'N/A'}\nRoute: ${b.route || (b.origin + ' - ' + b.destination)}\nStatus: ${b.status} (${b.paymentStatus || 'Paid'})`;
    alert(info);
  };

  function renderHotelsPlaceholder() {
    const emptyState = document.getElementById('calendar-empty-state');
    const resultsContainer = document.getElementById('calendar-timeline-results');
    if (emptyState) emptyState.style.display = 'none';
    if (resultsContainer) {
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = `
        <div class="calendar-timeline-container" style="text-align:center; padding:60px 20px;">
          <div style="font-size:36px; margin-bottom:12px;">🏨</div>
          <div style="font-size:16px; font-weight:800; color:#0F172A;">Hotel Bookings Timeline</div>
          <div style="font-size:13px; color:#64748B; margin-top:6px; max-width:440px; margin-left:auto; margin-right:auto;">
            Hotel reservations and check-in timeline integration will be available soon. Please switch back to <strong>Flights</strong> above.
          </div>
          <button class="calendar-btn-search" style="margin-top:18px;" onclick="document.getElementById('mode-flights-btn').click()">
            Switch to Flights Calendar
          </button>
        </div>
      `;
    }
    updateCounter(0, 0);
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
