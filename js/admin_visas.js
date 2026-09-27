/**
 * Flyvis Visa Operations Management Studio
 * js/admin_visas.js
 */

let allVisas = [];
let allApplications = [];
let currentStudioTierCount = 0;
let activeEditingVisaId = null;
let currentActiveApplication = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof loadVisasFromDB === 'function') {
      await loadVisasFromDB();
    }
    allVisas = typeof getVisas === 'function' ? getVisas() : [];
  } catch (err) {
    console.warn('Error fetching visas:', err);
  }

  await loadApplicationsFromDB();
  refreshVisaStats();
  renderVisaCatalog();
});

// Switch Tab
function switchVisaTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('[id^="tab-panel-"]').forEach(p => p.style.display = 'none');

  const targetBtn = document.getElementById(`tab-btn-${tabName}`);
  const targetPanel = document.getElementById(`tab-panel-${tabName}`);
  if (targetBtn) targetBtn.classList.add('active');
  if (targetPanel) targetPanel.style.display = 'block';

  if (tabName === 'catalog') renderVisaCatalog();
  if (tabName === 'applications') renderApplicationsTable();
}

function refreshVisaStats() {
  const activeCount = allVisas.filter(v => v.active !== false).length;
  const evisaCount = allVisas.filter(v => (v.visaType || '').toLowerCase().includes('e-visa')).length;
  const pendingCount = allApplications.filter(a => (a.status || 'Pending').toLowerCase() === 'pending').length;

  const setT = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setT('stat-visa-active', activeCount);
  setT('stat-visa-evisa', evisaCount);
  setT('stat-visa-submissions', allApplications.length);
  setT('stat-visa-pending', `${pendingCount} Pending Review`);
  setT('sidebar-visa-count', allVisas.length);
  setT('sidebar-app-count', pendingCount);
}

// Render Visa Catalog Table
function renderVisaCatalog() {
  const tbody = document.getElementById('visa-catalog-body');
  if (!tbody) return;

  const search = (document.getElementById('visa-search-input')?.value || '').toLowerCase();
  const continent = document.getElementById('visa-continent-filter')?.value || 'all';
  const status = document.getElementById('visa-status-filter')?.value || 'all';

  const filtered = allVisas.filter(v => {
    const matchSearch = (v.country || '').toLowerCase().includes(search) || (v.visaType || '').toLowerCase().includes(search);
    const matchContinent = continent === 'all' || (v.continent || '').toLowerCase() === continent.toLowerCase();
    const isActive = v.active !== false;
    const matchStatus = status === 'all' || (status === 'active' && isActive) || (status === 'inactive' && !isActive);
    return matchSearch && matchContinent && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--admin-text-muted);">No visa destinations found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(v => {
    const isActive = v.active !== false;
    const tiers = Array.isArray(v.validityPricing) && v.validityPricing.length > 0 ? v.validityPricing : [{ validity: v.validity || '30 Days', entry: v.entryType || 'Single Entry', fee: v.fee || '₹7,000' }];
    const tierChips = tiers.map(t => `<span style="display:inline-block; font-size:11px; font-weight:700; background:#F1F5F9; color:#0D1B2A; padding:2px 6px; border-radius:6px; margin:2px;">${t.validity} · ${t.entry}</span>`).join(' ');

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="font-size:22px;">${v.flagEmoji || '✈️'}</div>
            <div>
              <div style="font-weight:800; color:var(--admin-navy);">${v.country}</div>
              <div style="font-size:11.5px; color:var(--admin-text-muted);">${v.continent || 'Global'}</div>
            </div>
          </div>
        </td>
        <td>
          <span style="display:inline-block; padding:3px 8px; border-radius:6px; font-size:11.5px; font-weight:700; background:rgba(46,125,126,0.1); color:#2E7D7E;">
            ${v.visaType || 'e-Visa'}
          </span>
        </td>
        <td style="font-weight:800; color:var(--admin-navy);">${v.fee || '₹7,000'}</td>
        <td style="max-width:240px;">${tierChips}</td>
        <td>${v.processingTime || '3-5 Days'}</td>
        <td>
          <span class="status-pill ${isActive ? 'active' : 'inactive'}">
            ${isActive ? 'Active' : 'Hidden'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-admin-icon" onclick="editVisaInStudio('${v.id}')" title="Edit Visa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button type="button" class="btn-admin-icon" onclick="toggleVisaActive('${v.id}')" title="${isActive ? 'Hide' : 'Activate'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </button>
            <a href="visa-detail.html?country=${encodeURIComponent(v.country)}" target="_blank" class="btn-admin-icon" title="View Detail Page">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterVisaCatalog() {
  renderVisaCatalog();
}

function generateSlugFromCountry(val) {
  const slugEl = document.getElementById('studio-slug');
  if (slugEl) {
    slugEl.value = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}

// Visa Studio (Add / Edit)
function startNewVisa() {
  activeEditingVisaId = null;
  document.getElementById('studio-visa-id').value = '';
  document.getElementById('visa-studio-form').reset();
  document.getElementById('studio-tiers-container').innerHTML = '';
  currentStudioTierCount = 0;

  // Add default tier
  addStudioValidityTier('30 Days', 'Single Entry', '₹7,000');
  switchVisaTab('editor');
}

function editVisaInStudio(id) {
  const visa = allVisas.find(v => v.id === id);
  if (!visa) return;

  activeEditingVisaId = id;
  document.getElementById('studio-visa-id').value = id;
  document.getElementById('studio-country').value = visa.country || '';
  document.getElementById('studio-slug').value = visa.slug || visa.id;
  document.getElementById('studio-continent').value = visa.continent || 'Asia';
  document.getElementById('studio-visa-type').value = visa.visaType || 'e-Visa';
  document.getElementById('studio-base-fee').value = visa.fee || '₹7,000';
  document.getElementById('studio-processing').value = visa.processingTime || '3-5 Working Days';
  document.getElementById('studio-image').value = visa.heroImage || visa.image || '';

  // Validity Tiers
  const tiersContainer = document.getElementById('studio-tiers-container');
  tiersContainer.innerHTML = '';
  currentStudioTierCount = 0;

  const tiers = Array.isArray(visa.validityPricing) && visa.validityPricing.length > 0 
    ? visa.validityPricing 
    : [{ validity: visa.validity || '30 Days', entry: visa.entryType || 'Single Entry', fee: visa.fee || '₹7,000' }];

  tiers.forEach(t => {
    addStudioValidityTier(t.validity, t.entry, t.fee);
  });

  switchVisaTab('editor');
}

function addStudioValidityTier(validity = '30 Days', entry = 'Single Entry', fee = '₹7,000') {
  currentStudioTierCount++;
  const container = document.getElementById('studio-tiers-container');
  if (!container) return;

  const tierId = `tier-row-${currentStudioTierCount}`;
  const div = document.createElement('div');
  div.className = 'tier-builder-card';
  div.id = tierId;
  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <span style="font-size:12px; font-weight:800; color:var(--admin-teal); text-transform:uppercase;">Tier #${currentStudioTierCount}</span>
      <button type="button" class="btn-admin-danger" style="padding:3px 8px; font-size:11px;" onclick="document.getElementById('${tierId}').remove()">Remove</button>
    </div>
    <div class="form-grid-3">
      <div>
        <label class="admin-form-label">Validity Duration</label>
        <input type="text" class="admin-form-input studio-tier-val" value="${validity}" placeholder="e.g. 30 Days" required />
      </div>
      <div>
        <label class="admin-form-label">Entry Type</label>
        <select class="admin-form-select studio-tier-entry">
          <option value="Single Entry" ${entry === 'Single Entry' ? 'selected' : ''}>Single Entry</option>
          <option value="Multiple Entry" ${entry === 'Multiple Entry' ? 'selected' : ''}>Multiple Entry</option>
          <option value="Double Entry" ${entry === 'Double Entry' ? 'selected' : ''}>Double Entry</option>
        </select>
      </div>
      <div>
        <label class="admin-form-label">Total Fee</label>
        <input type="text" class="admin-form-input studio-tier-fee" value="${fee}" placeholder="e.g. ₹7,000" required />
      </div>
    </div>
  `;
  container.appendChild(div);
}

async function handleSaveVisaStudio(e) {
  e.preventDefault();
  const id = document.getElementById('studio-visa-id').value || document.getElementById('studio-slug').value || `visa_${Date.now()}`;
  const country = document.getElementById('studio-country').value.trim();
  const continent = document.getElementById('studio-continent').value;
  const visaType = document.getElementById('studio-visa-type').value;
  const baseFee = document.getElementById('studio-base-fee').value.trim();
  const processingTime = document.getElementById('studio-processing').value.trim();
  const heroImage = document.getElementById('studio-image').value.trim();

  // Extract tiers
  const tierCards = document.querySelectorAll('#studio-tiers-container .tier-builder-card');
  const validityPricing = [];
  tierCards.forEach(card => {
    const val = card.querySelector('.studio-tier-val')?.value.trim() || '30 Days';
    const entry = card.querySelector('.studio-tier-entry')?.value.trim() || 'Single Entry';
    const fee = card.querySelector('.studio-tier-fee')?.value.trim() || baseFee;
    validityPricing.push({ validity: val, entry, fee });
  });

  // Extract docs
  const docCheckboxes = document.querySelectorAll('input[name="studio-doc-check"]:checked');
  const documents = Array.from(docCheckboxes).map(cb => cb.value);

  const visaPayload = {
    id,
    country,
    continent,
    visaType,
    fee: baseFee,
    processingTime,
    heroImage: heroImage || 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
    validity: validityPricing[0]?.validity || '30 Days',
    entryType: validityPricing[0]?.entry || 'Single Entry',
    validityPricing: validityPricing.length > 0 ? validityPricing : [{ validity: '30 Days', entry: 'Single Entry', fee: baseFee }],
    documents: documents.length > 0 ? documents : ['Passport Front & Back', 'Passport Size Photo'],
    active: true,
    updatedAt: new Date().toISOString()
  };

  try {
    if (typeof db !== 'undefined') {
      await db.collection('visas').doc(id).set(visaPayload, { merge: true });
    }
    
    // Update local cache
    const existingIdx = allVisas.findIndex(v => v.id === id);
    if (existingIdx >= 0) {
      allVisas[existingIdx] = { ...allVisas[existingIdx], ...visaPayload };
    } else {
      allVisas.unshift(visaPayload);
    }

    alert(`Visa for ${country} saved successfully!`);
    refreshVisaStats();
    switchVisaTab('catalog');
  } catch (err) {
    console.error('Error saving visa:', err);
    alert('Error saving visa: ' + err.message);
  }
}

async function toggleVisaActive(id) {
  const visa = allVisas.find(v => v.id === id);
  if (!visa) return;
  const nextActive = visa.active === false ? true : false;
  visa.active = nextActive;

  try {
    if (typeof db !== 'undefined') {
      await db.collection('visas').doc(id).update({ active: nextActive });
    }
    refreshVisaStats();
    renderVisaCatalog();
  } catch (err) {
    console.error('Error toggling visa:', err);
  }
}

// Applications Queue
async function loadApplicationsFromDB() {
  allApplications = [];
  try {
    if (typeof db !== 'undefined') {
      const snap = await db.collection('arrival_cards').orderBy('createdAt', 'desc').limit(50).get();
      snap.forEach(doc => {
        allApplications.push({ id: doc.id, ...doc.data() });
      });
    }
  } catch (e) {
    console.warn('Applications fetch warning:', e);
  }
}

function renderApplicationsTable() {
  const tbody = document.getElementById('applications-table-body');
  if (!tbody) return;

  const search = (document.getElementById('app-search-input')?.value || '').toLowerCase();
  const status = document.getElementById('app-status-filter')?.value || 'all';

  const filtered = allApplications.filter(a => {
    const applicantName = `${a.travelers?.[0]?.firstName || a.firstName || ''} ${a.travelers?.[0]?.lastName || a.lastName || ''}`.toLowerCase();
    const phone = (a.contactPhone || a.phone || '').toLowerCase();
    const dest = (a.destination || a.country || '').toLowerCase();
    const appStatus = a.status || 'Pending';

    const matchSearch = applicantName.includes(search) || phone.includes(search) || dest.includes(search);
    const matchStatus = status === 'all' || appStatus.toLowerCase() === status.toLowerCase();
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--admin-text-muted);">No submissions found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const lead = a.travelers?.[0] || a;
    const name = `${lead.firstName || 'Traveler'} ${lead.lastName || ''}`;
    const travelersCount = Array.isArray(a.travelers) ? a.travelers.length : 1;
    const st = a.status || 'Pending';
    const statusClass = st.toLowerCase().replace(/\s+/g, '-');
    const createdDate = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'Today';

    return `
      <tr>
        <td><code>#${a.id.slice(0, 8)}</code></td>
        <td style="font-weight:700; color:var(--admin-navy);">${a.destination || 'UAE'}</td>
        <td style="font-weight:700;">${name}</td>
        <td>${travelersCount} Traveler${travelersCount > 1 ? 's' : ''}</td>
        <td>
          <div>${a.contactEmail || '—'}</div>
          <div style="font-size:11.5px; color:var(--admin-text-muted);">${a.countryCode || '+91'} ${a.contactPhone || '—'}</div>
        </td>
        <td>${createdDate}</td>
        <td>
          <span class="status-pill ${statusClass}">${st}</span>
        </td>
        <td>
          <button class="btn-admin-secondary" style="padding:5px 10px; font-size:12px;" onclick="viewApplicationDetail('${a.id}')">
            View Application
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterApplicationsTable() {
  renderApplicationsTable();
}

function viewApplicationDetail(id) {
  const app = allApplications.find(a => a.id === id);
  if (!app) return;
  currentActiveApplication = app;

  const modal = document.getElementById('app-detail-modal');
  const body = document.getElementById('app-modal-body');
  const title = document.getElementById('app-modal-title');
  if (!modal || !body) return;

  const lead = app.travelers?.[0] || app;
  const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Lead Traveler';
  title.textContent = `Submission #${id.slice(0, 8)} — ${app.destination || 'Visa Application'}`;

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--admin-border);">
      <div>
        <div style="font-size:18px; font-weight:800; color:var(--admin-navy);">${name}</div>
        <div style="font-size:12.5px; color:var(--admin-text-muted);">${app.contactEmail || ''} · ${app.countryCode || '+91'} ${app.contactPhone || ''}</div>
      </div>
      <div>
        <select class="admin-form-select" style="width:140px; font-weight:700;" onchange="updateApplicationStatus('${id}', this.value)">
          <option value="Pending" ${app.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="In Review" ${app.status === 'In Review' ? 'selected' : ''}>In Review</option>
          <option value="Approved" ${app.status === 'Approved' ? 'selected' : ''}>Approved</option>
          <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
    </div>

    <div class="form-grid-2" style="margin-bottom:18px;">
      <div style="background:#F8FAFC; padding:14px; border-radius:10px;">
        <div style="font-size:11px; font-weight:800; color:var(--admin-text-muted); text-transform:uppercase;">Arrival Flight</div>
        <div style="font-weight:700; color:var(--admin-navy); margin-top:4px;">${app.arrFlightNumber || app.flightNo || 'AI 933'}</div>
        <div style="font-size:12px; color:var(--admin-text-muted);">Arrival Date: ${app.arrDate || '—'}</div>
      </div>
      <div style="background:#F8FAFC; padding:14px; border-radius:10px;">
        <div style="font-size:11px; font-weight:800; color:var(--admin-text-muted); text-transform:uppercase;">Hotel &amp; Stay</div>
        <div style="font-weight:700; color:var(--admin-navy); margin-top:4px;">${app.hotelName || 'Grand Hyatt'}</div>
        <div style="font-size:12px; color:var(--admin-text-muted);">${app.hotelLocation || 'City Center'}</div>
      </div>
    </div>

    <div>
      <div style="font-size:13px; font-weight:800; color:var(--admin-navy); margin-bottom:8px;">Traveler(s) Information</div>
      ${(app.travelers || [app]).map((t, idx) => `
        <div style="padding:12px; background:#FAFCFC; border:1px solid var(--admin-border); border-radius:8px; margin-bottom:8px; font-size:12.5px;">
          <strong>Traveler #${idx + 1}:</strong> ${t.firstName || ''} ${t.lastName || ''} | Passport: <code>${t.passportNumber || 'N/A'}</code> | Expiry: ${t.passportExpiry || 'N/A'} | DOB: ${t.dob || 'N/A'}
        </div>
      `).join('')}
    </div>
  `;

  modal.style.display = 'flex';
}

function closeAppModal() {
  const modal = document.getElementById('app-detail-modal');
  if (modal) modal.style.display = 'none';
}

async function updateApplicationStatus(id, newStatus) {
  try {
    if (typeof db !== 'undefined') {
      await db.collection('arrival_cards').doc(id).update({ status: newStatus });
    }
    const app = allApplications.find(a => a.id === id);
    if (app) app.status = newStatus;
    refreshVisaStats();
    renderApplicationsTable();
  } catch (err) {
    console.error('Status update failed:', err);
  }
}

function contactApplicantWhatsApp() {
  if (!currentActiveApplication) return;
  const phone = (currentActiveApplication.countryCode || '91') + (currentActiveApplication.contactPhone || '');
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const lead = currentActiveApplication.travelers?.[0] || currentActiveApplication;
  const name = lead.firstName || 'Customer';
  const msg = encodeURIComponent(`Hi ${name}, this is the Flyvis Visa Team regarding your application for ${currentActiveApplication.destination || 'your trip'}.`);
  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
}

function exportVisasToCsv() {
  let csv = 'ID,Country,Continent,VisaType,Fee,ProcessingTime,Status\n';
  allVisas.forEach(v => {
    csv += `"${v.id}","${v.country}","${v.continent || ''}","${v.visaType || ''}","${v.fee || ''}","${v.processingTime || ''}","${v.active !== false ? 'Active' : 'Hidden'}"\n`;
  });
  downloadCsv(csv, 'flyvis_visas_catalog.csv');
}

function exportApplicationsToCsv() {
  let csv = 'ID,Destination,Name,Phone,Email,Status,Date\n';
  allApplications.forEach(a => {
    const lead = a.travelers?.[0] || a;
    const name = `${lead.firstName || ''} ${lead.lastName || ''}`;
    csv += `"${a.id}","${a.destination || ''}","${name}","${a.contactPhone || ''}","${a.contactEmail || ''}","${a.status || 'Pending'}","${a.createdAt || ''}"\n`;
  });
  downloadCsv(csv, 'flyvis_applications_queue.csv');
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
