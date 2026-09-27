/**
 * Flyvis Flight Desk & Price Intelligence Admin
 * js/admin_flights.js
 */

let allAlerts = [];
let allPromos = [];

const DEFAULT_INDIAN_AIRPORTS = [
  { code: "DEL", city: "Delhi", name: "Indira Gandhi International", state: "Delhi", tier: "Tier 1 Mega Hub" },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International", state: "Maharashtra", tier: "Tier 1 Mega Hub" },
  { code: "BLR", city: "Bengaluru", name: "Kempegowda International", state: "Karnataka", tier: "Tier 1 Hub" },
  { code: "MAA", city: "Chennai", name: "Chennai International", state: "Tamil Nadu", tier: "Tier 1 Hub" },
  { code: "HYD", city: "Hyderabad", name: "Rajiv Gandhi International", state: "Telangana", tier: "Tier 1 Hub" },
  { code: "CCU", city: "Kolkata", name: "Netaji Subhash Chandra Bose", state: "West Bengal", tier: "Tier 1 Hub" },
  { code: "COK", city: "Kochi", name: "Cochin International", state: "Kerala", tier: "International Gateway" },
  { code: "CNN", city: "Kannur", name: "Kannur International", state: "Kerala", tier: "International Hub" },
  { code: "CCJ", city: "Kozhikode", name: "Calicut International", state: "Kerala", tier: "Gulf Hub" },
  { code: "TRV", city: "Thiruvananthapuram", name: "Trivandrum International", state: "Kerala", tier: "International Gateway" },
  { code: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International", state: "Gujarat", tier: "Tier 2 Hub" },
  { code: "GOI", city: "Goa (Dabolim)", name: "Dabolim Airport", state: "Goa", tier: "Tourist Hub" },
  { code: "GOX", city: "Goa (Mopa)", name: "Manohar International Airport", state: "Goa", tier: "New Hub" },
  { code: "PNQ", city: "Pune", name: "Pune International", state: "Maharashtra", tier: "Tier 2 Hub" },
  { code: "JAI", city: "Jaipur", name: "Jaipur International", state: "Rajasthan", tier: "Heritage Hub" },
  { code: "LKO", city: "Lucknow", name: "Chaudhary Charan Singh International", state: "Uttar Pradesh", tier: "Tier 2 Hub" },
  { code: "DXB", city: "Dubai", name: "Dubai International", state: "United Arab Emirates", tier: "Global Hub" },
  { code: "LHR", city: "London", name: "Heathrow Airport", state: "United Kingdom", tier: "Global Hub" },
  { code: "SIN", city: "Singapore", name: "Singapore Changi Airport", state: "Singapore", tier: "Global Hub" },
  { code: "BKK", city: "Bangkok", name: "Suvarnabhumi Airport", state: "Thailand", tier: "Global Hub" }
];

document.addEventListener('DOMContentLoaded', async () => {
  await loadAlertsFromDB();
  loadPromosFromCardsData();
  refreshFlightStats();
  renderAlertsTable();
  renderAirportsTable();

  const handleFlightHash = () => {
    if (window.location.hash) {
      const tabName = window.location.hash.replace('#', '');
      if (document.getElementById(`tab-btn-${tabName}`)) {
        switchFlightTab(tabName);
      }
    }
  };
  handleFlightHash();
  window.addEventListener('hashchange', handleFlightHash);
});

function switchFlightTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('[id^="tab-panel-"]').forEach(p => p.style.display = 'none');

  const targetBtn = document.getElementById(`tab-btn-${tabName}`);
  const targetPanel = document.getElementById(`tab-panel-${tabName}`);
  if (targetBtn) targetBtn.classList.add('active');
  if (targetPanel) targetPanel.style.display = 'block';

  if (tabName === 'alerts') renderAlertsTable();
  if (tabName === 'promos') renderCardPromosTable();
  if (tabName === 'airports') renderAirportsTable();
}

function refreshFlightStats() {
  const values = {
    'stat-active-alerts': allAlerts.length,
    'stat-alerts-sent': '—',
    'stat-airport-count': DEFAULT_INDIAN_AIRPORTS.length,
    'stat-scraper-status': 'Pending',
    'stat-l2b-ratio': '—'
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

// Load Alerts from both collections
async function loadAlertsFromDB() {
  allAlerts = [];
  try {
    if (typeof db !== 'undefined') {
      const mergedMap = new Map();

      // 1. Fetch from flight_price_alerts
      try {
        const snap1 = await db.collection('flight_price_alerts').orderBy('createdAt', 'desc').limit(50).get();
        snap1.docs.forEach(doc => {
          mergedMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      } catch (e1) {}

      // 2. Fetch from price_alerts
      try {
        const snap2 = await db.collection('price_alerts').orderBy('createdAt', 'desc').limit(50).get();
        snap2.docs.forEach(doc => {
          const item = { id: doc.id, ...doc.data() };
          if (!mergedMap.has(doc.id)) {
            mergedMap.set(doc.id, item);
          } else {
            mergedMap.set(doc.id, { ...mergedMap.get(doc.id), ...item });
          }
        });
      } catch (e2) {}

      allAlerts = Array.from(mergedMap.values());
    }
  } catch (e) {
    console.warn('Alerts fetch warning:', e);
  }
}

function renderAlertsTable() {
  const tbody = document.getElementById('alerts-table-body');
  if (!tbody) return;
  const query = (document.getElementById('alert-search-input')?.value || '').toLowerCase();
  const filter = document.getElementById('alert-status-filter')?.value || 'all';
  const filtered = allAlerts.filter(a => {
    const text = `${a.origCode || a.from || ''} ${a.destCode || a.to || ''} ${a.email || a.userEmail || ''} ${a.whatsapp || a.phone || ''} ${a.travelerName || ''}`.toLowerCase();
    const observed = Number.isFinite(Number(a.bestLivePrice)) && Number(a.bestLivePrice) > 0 && Number(a.bestLivePrice) <= Number(a.targetPrice);
    const matchesStatus = filter === 'all' || (filter === 'active' && String(a.status || '').toLowerCase() === 'active') || (filter === 'triggered' && observed);
    return text.includes(query) && matchesStatus;
  });
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:#64748B;">No monitor requests found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(a => {
    const id = escapeAdminText(a.id || '');
    const routeFrom = escapeAdminText(a.origCode || a.from || '—');
    const routeTo = escapeAdminText(a.destCode || a.to || '—');
    const target = Number(a.targetPrice);
    const observed = Number(a.bestLivePrice);
    const targetText = Number.isFinite(target) && target > 0 ? `₹${target.toLocaleString('en-IN')}` : 'Not recorded';
    const observedText = Number.isFinite(observed) && observed > 0 ? `₹${observed.toLocaleString('en-IN')}` : 'No observation';
    const gateText = a.lastScenario ? 'Demo record — no ticket proof' : 'Provider quote unverified';
    return `<tr>
      <td><strong>${routeFrom} &rarr; ${routeTo}</strong><div style="font-size:11px;color:#64748B;">${escapeAdminText(a.flightSpecific || 'Flight rule not recorded')}</div></td>
      <td>${a.mode === 'auto_book' ? 'Auto-book requested' : 'Notify requested'}</td>
      <td>${escapeAdminText(a.date || 'Not recorded')}</td>
      <td>${targetText}</td>
      <td>${observedText}</td>
      <td><strong>${escapeAdminText(a.travelerName || a.userName || 'Traveler')}</strong><div style="font-size:11px;color:#64748B;">${escapeAdminText(a.whatsapp || a.phone || a.email || '—')}</div></td>
      <td><span class="status-pill pending">${gateText}</span></td>
      <td><div style="display:flex;gap:6px;">
        <button class="btn-admin-secondary" data-alert-id="${id}" onclick="openQuoteReviewModal(this.dataset.alertId)" title="Review quote evidence">Review</button>
        <button class="btn-admin-secondary" data-alert-id="${id}" onclick="deleteAlert(this.dataset.alertId)" title="Delete monitor">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

function escapeAdminText(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function openQuoteReviewModal(alertId) {
  const item = allAlerts.find(a => String(a.id) === String(alertId));
  const modal = document.getElementById('quote-review-modal');
  const body = document.getElementById('quote-review-body');
  if (!item || !modal || !body) return;
  const route = `${item.origCode || item.from || '—'} → ${item.destCode || item.to || '—'}`;
  const bags = item.requiredPackage?.baggageKg ?? item.minCheckedBagsKg ?? 'Not recorded';
  const people = item.travelersCount ?? item.paxCount ?? 'Not recorded';
  const budget = item.allInclusiveTotalBudget ?? item.maxTotalBudget ?? 'Not recorded';
  const requirements = [
    ['Route / date', `${route} · ${item.date || 'Not recorded'}`],
    ['Travelers', people],
    ['Checked baggage per traveler', bags === 'Not recorded' ? bags : `${bags} kg requested`],
    ['Complete budget', typeof budget === 'number' ? `₹${budget.toLocaleString('en-IN')}` : budget],
    ['Flight rule', item.flightSpecific || item.flightMatchRule || 'Not recorded']
  ];
  body.innerHTML = `
    <p style="margin:0 0 12px;color:#9A3412;font-weight:700;">No live provider offer or reprice is attached to this monitor. Booking is blocked until each requirement is verified.</p>
    <table class="admin-table"><tbody>${requirements.map(([label,value]) => `<tr><th scope="row">${escapeAdminText(label)}</th><td>${escapeAdminText(value)}</td></tr>`).join('')}</tbody></table>
    <p style="font-size:12px;color:#64748B;margin:12px 0 0;">Still required: live offer ID and expiry, passenger availability, exact segment and fare family, baggage entitlement and all-in total, fresh same-itinerary reprice, and supplier ticket numbers after order creation.</p>`;
  modal.style.display = 'flex';
}

function closeQuoteReviewModal() {
  const modal = document.getElementById('quote-review-modal');
  if (modal) modal.style.display = 'none';
}

function loadPromosFromCardsData() {
  if (typeof FLYVIS_CREDIT_CARDS !== 'undefined') {
    allPromos = Object.values(FLYVIS_CREDIT_CARDS);
  } else {
    allPromos = [
      { name: "HDFC Infinia Metal", bank: "HDFC Bank", multiplier: "5X SmartBuy Points", discount: "Up to ₹5,000 off", code: "HDFCSMART" },
      { name: "Axis Atlas Credit Card", bank: "Axis Bank", multiplier: "5 Edge Miles per ₹100", discount: "2,500 Miles Bonus", code: "AXISATLAS" },
      { name: "Amex Platinum Travel", bank: "American Express", multiplier: "3X Rewards", discount: "₹3,000 Flight Voucher", code: "AMEXTRAVEL" },
      { name: "SBI Cashback Card", bank: "State Bank of India", multiplier: "5% Direct Cashback", discount: "5% Instant", code: "SBICASH5" },
      { name: "ICICI Emeralde Private", bank: "ICICI Bank", multiplier: "6 Reward Points", discount: "Free Lounge + ₹2,000 off", code: "EMERALDE" }
    ];
  }
}

function renderCardPromosTable() {
  const tbody = document.getElementById('card-promos-table-body');
  if (!tbody) return;

  tbody.innerHTML = allPromos.map(p => `
    <tr>
      <td>
        <div style="font-weight:800; color:var(--admin-navy);">${p.name}</div>
        <div style="font-size:11.5px; color:var(--admin-text-muted);">${p.bank || 'Premium Bank'}</div>
      </td>
      <td style="font-weight:800; color:var(--admin-teal);">${p.multiplier || '3X Points'}</td>
      <td>${p.discount || 'Standard Perks'}</td>
      <td><code>${p.code || 'FLYVIS' + p.name.slice(0,4).toUpperCase()}</code></td>
      <td><span class="status-pill active">Active</span></td>
      <td>
        <button class="btn-admin-secondary" style="padding:4px 10px; font-size:12px;">Edit Promo</button>
      </td>
    </tr>
  `).join('');
}

function renderAirportsTable() {
  const tbody = document.getElementById('airports-table-body');
  if (!tbody) return;

  const search = (document.getElementById('airport-search-input')?.value || '').toLowerCase();
  const filtered = DEFAULT_INDIAN_AIRPORTS.filter(a => {
    return a.code.toLowerCase().includes(search) || a.city.toLowerCase().includes(search) || a.state.toLowerCase().includes(search);
  });

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td><code style="font-weight:800; font-size:13px; color:var(--admin-teal);">${a.code}</code></td>
      <td>
        <div style="font-weight:700; color:var(--admin-navy);">${a.city}</div>
        <div style="font-size:11.5px; color:var(--admin-text-muted);">${a.name}</div>
      </td>
      <td>${a.state}</td>
      <td>
        <span style="font-size:11px; font-weight:700; background:#F1F5F9; color:#0D1B2A; padding:3px 8px; border-radius:6px;">
          ${a.tier}
        </span>
      </td>
    </tr>
  `).join('');
}

async function deleteAlert(alertId) {
  if (!confirm("Are you sure you want to delete this price monitor?")) return;

  allAlerts = allAlerts.filter(a => a.id !== alertId);
  renderAlertsTable();
  refreshFlightStats();

  if (typeof db !== 'undefined' && alertId && !alertId.startsWith('al_')) {
    try {
      await db.collection('price_alerts').doc(alertId).delete().catch(() => {});
      await db.collection('flight_price_alerts').doc(alertId).delete().catch(() => {});
    } catch (e) {
      console.warn('Error deleting alert from Firestore:', e);
    }
  }

  alert('Price alert monitor removed.');
}

function openAddCardPromoModal() {
  const name = prompt("Enter Card / Bank Name (e.g. HDFC Regalia Gold):");
  if (!name) return;
  const bank = prompt("Enter Bank Name (e.g. HDFC Bank):") || "Bank";
  const multiplier = prompt("Enter Reward Multiplier (e.g. 4X Reward Points):") || "3X Points";
  const discount = prompt("Enter Discount / Perk (e.g. ₹2,000 Instant Off):") || "Instant Discount";
  const code = prompt("Enter Promo Code (e.g. HDFC2000):") || "PROMO";

  allPromos.unshift({ name, bank, multiplier, discount, code });
  renderCardPromosTable();
  alert(`Bank Promo '${name}' added successfully!`);
}
