// ===== ADMIN DASHBOARD JS =====

const ADMIN_CREDS = { username: 'admin', password: 'admin123' };
let pendingDeleteId = null;
let editMode = false;

// ===== INIT (Direct Dashboard Access) =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminSettingsFromDB();
  } catch(e) {
    console.warn('Admin settings prefetch:', e);
  }

  // Load and show dashboard directly
  await showDashboard();
});

// ===== AUTH (Bypassed) =====
async function handleLogin(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  await showDashboard();
  return false;
}

function handleLogout() {
  try {
    localStorage.removeItem('fareos_current_admin');
    localStorage.removeItem('fareos_admin_session');
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().catch(() => {});
    }
  } catch(e) {}
  window.location.href = 'admin-login.html?logout=true';
}

async function showDashboard() {
  const loginPage = document.getElementById('login-page');
  const dashboard = document.getElementById('admin-dashboard');
  if (loginPage) loginPage.style.display = 'none';
  if (dashboard) dashboard.style.display = 'flex';
  
  try {
    // Load data from Firebase
    await loadVisasFromDB();
    await loadFlightsFromDB();
  } catch(err) {
    console.warn('Data load error:', err);
  }
  
  refreshStats();
  renderDashboardTable();
  const manageFlightsSec = document.getElementById('section-manage-flights');
  if (manageFlightsSec && manageFlightsSec.style.display !== 'none') {
    renderFlightsTable();
  }
}

// ===== SECTION NAVIGATION =====
function showSection(sectionName, navEl) {
  // Hide all sections
  document.querySelectorAll('[id^="section-"]').forEach(s => s.style.display = 'none');
  
  // Show requested section
  const section = document.getElementById(`section-${sectionName}`);
  if (section) section.style.display = 'block';

  // Update nav active states
  document.querySelectorAll('.admin-nav-item').forEach(item => item.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  // Update topbar title
  const titles = {
    'dashboard': 'Dashboard Overview',
    'add-visa': editMode ? 'Edit Visa' : 'Add New Visa',
    'manage-visas': 'Manage Visas',
    'add-flight': editFlightMode ? 'Edit Flight Deal' : 'Add New Flight Deal',
    'manage-flights': 'Manage Flight Deals',
    'arrival-cards': 'Arrival Card Submissions',
    'card-offers': 'Credit Card & Bank Promos',
    'admin-info': 'Admin Info & Settings'
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[sectionName] || 'Admin Console';

  // Load data for sections
  if (sectionName === 'manage-visas') renderManageTable();
  if (sectionName === 'manage-flights') renderFlightsTable();
  if (sectionName === 'arrival-cards') renderArrivalCardsTable();
  if (sectionName === 'card-offers') renderAdminCardPromos();
  if (sectionName === 'admin-info') renderAdminInfoForm();
  if (sectionName === 'dashboard') { refreshStats(); renderDashboardTable(); }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  return false;
}

// ===== STATS =====
function refreshStats() {
  const visas = getVisas();
  const active = visas.filter(v => v.active);
  const inactive = visas.filter(v => !v.active);
  const evisa = visas.filter(v => (v.visaType || '').toLowerCase().includes('e-visa'));

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('stat-total', visas.length);
  setEl('stat-active', active.length);
  setEl('stat-inactive', inactive.length);
  setEl('stat-evisa', evisa.length);
}

// ===== DASHBOARD TABLE =====
function renderDashboardTable() {
  const tbody = document.getElementById('dashboard-table-body');
  if (!tbody) return;
  const visas = getVisas();
  renderTableRows(tbody, visas);
}

// ===== MANAGE TABLE =====
function renderManageTable() {
  const tbody = document.getElementById('manage-table-body');
  if (!tbody) return;

  let visas = getVisas();
  const search = document.getElementById('manage-search')?.value?.toLowerCase().trim();
  if (search) {
    visas = visas.filter(v => 
      v.country.toLowerCase().includes(search) ||
      (v.visaType || '').toLowerCase().includes(search)
    );
  }

  renderTableRows(tbody, visas);
}

function renderTableRows(tbody, visas) {
  if (visas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No visa listings found.</td></tr>`;
    return;
  }

  tbody.innerHTML = visas.map(visa => {
    const flagUrl = getFlagUrl(visa.countryCode);
    const isActive = visa.active;
    const hasAc = !!(visa.hasArrivalCard === true || visa.hasArrivalCard === 'true' || visa.hasArrivalCard === 1 || String(visa.hasArrivalCard).toLowerCase() === 'true');
    return `
      <tr id="row-${visa.id}">
        <td>
          <div class="table-visa-name">
            <div class="table-flag">
              <img src="${flagUrl}" alt="${visa.country}" onerror="this.parentElement.innerHTML='<span style=font-size:18px>${visa.flag || ''}</span>'" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <div>
              <div style="font-weight:700;">${visa.country}</div>
              ${hasAc ? `<span style="display:inline-block;padding:2px 8px;background:rgba(46,125,126,0.15);color:#2E7D7E;border-radius:999px;font-size:10.5px;font-weight:700;margin-top:2px;">Arrival Card</span>` : ''}
            </div>
          </div>
        </td>
        <td>${visa.visaType || '—'}</td>
        <td style="font-weight:700;color:var(--navy);">${visa.fee || '—'}</td>
        <td>${visa.processingTime || '—'}</td>
        <td>${visa.validity || '—'}</td>
        <td>
          <span class="status-badge ${isActive ? 'active' : 'inactive'}">
            ${isActive ? 'Active' : 'Hidden'}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <a href="visa-detail.html?id=${visa.id}" target="_blank" class="action-btn" style="color:#0ea5e9;text-decoration:none;" title="Preview Detail Page">View</a>
            <button class="action-btn edit" onclick="editVisa('${visa.id}')" id="edit-btn-${visa.id}">Edit</button>
            <button class="action-btn toggle ${!isActive ? 'inactive' : ''}" onclick="toggleVisa('${visa.id}')" id="toggle-btn-${visa.id}">
              ${isActive ? 'Hide' : 'Show'}
            </button>
            <button class="action-btn delete" onclick="promptDelete('${visa.id}')" id="delete-btn-${visa.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ===== DOCUMENT CHECKBOX HELPERS =====
function syncSelectedDocuments() {
  const checkboxes = document.querySelectorAll('input[name="doc-check"]:checked');
  const selectedDocs = Array.from(checkboxes).map(cb => cb.value.trim());
  const customDoc = document.getElementById('f-doc-custom')?.value.trim();
  if (customDoc) {
    customDoc.split(',').map(s => s.trim()).filter(Boolean).forEach(d => {
      if (!selectedDocs.includes(d)) selectedDocs.push(d);
    });
  }
  const fullDocsStr = selectedDocs.join(', ');
  const hiddenInput = document.getElementById('f-documents');
  if (hiddenInput) hiddenInput.value = fullDocsStr;
  return fullDocsStr;
}

function setDocumentCheckboxes(docsString) {
  const checkboxes = document.querySelectorAll('input[name="doc-check"]');
  checkboxes.forEach(cb => cb.checked = false);
  const customInput = document.getElementById('f-doc-custom');
  if (customInput) customInput.value = '';

  if (!docsString) {
    syncSelectedDocuments();
    return;
  }

  const rawDocs = (typeof docsString === 'string' ? docsString.split(',') : docsString).map(d => d.trim()).filter(Boolean);
  const unselected = [];

  rawDocs.forEach(item => {
    let matched = false;
    const itemLower = item.toLowerCase();

    checkboxes.forEach(cb => {
      const cbVal = cb.value.toLowerCase();
      if (cbVal === itemLower ||
          (cbVal.includes('passport') && itemLower.includes('passport') && !cbVal.includes('photo') && !itemLower.includes('photo')) ||
          (cbVal.includes('photo') && itemLower.includes('photo')) ||
          (cbVal.includes('bank') && itemLower.includes('bank')) ||
          (cbVal.includes('hotel') && (itemLower.includes('hotel') || itemLower.includes('accommodation'))) ||
          (cbVal.includes('flight') && (itemLower.includes('flight') || itemLower.includes('ticket') || itemLower.includes('itinerary'))) ||
          (cbVal.includes('insurance') && itemLower.includes('insurance')) ||
          (cbVal.includes('tax') && (itemLower.includes('tax') || itemLower.includes('itr') || itemLower.includes('form 16'))) ||
          (cbVal.includes('employment') && (itemLower.includes('employment') || itemLower.includes('noc') || itemLower.includes('leave') || itemLower.includes('job'))) ||
          (cbVal.includes('invitation') && (itemLower.includes('invitation') || itemLower.includes('sponsor'))) ||
          (cbVal.includes('national id') && (itemLower.includes('national id') || itemLower.includes('aadhaar') || itemLower.includes('resident card') || itemLower.includes('id card'))) ||
          (cbVal.includes('cover letter') && (itemLower.includes('cover letter') || itemLower.includes('travel plan'))) ||
          (cbVal.includes('previous visas') && (itemLower.includes('previous') || itemLower.includes('travel history')))) {
        cb.checked = true;
        matched = true;
      }
    });

    if (!matched) {
      unselected.push(item);
    }
  });

  if (customInput && unselected.length > 0) {
    customInput.value = unselected.join(', ');
  }

  syncSelectedDocuments();
}

// ===== PURPOSE CHECKBOX HELPERS =====
function syncSelectedPurpose() {
  const checkboxes = document.querySelectorAll('input[name="purpose-check"]:checked');
  const selectedPurposes = Array.from(checkboxes).map(cb => cb.value.trim());
  
  if (selectedPurposes.length === 0) {
    selectedPurposes.push('Tourism');
  }

  const fullPurposeStr = selectedPurposes.join(', ');
  const hiddenInput = document.getElementById('f-purpose');
  if (hiddenInput) hiddenInput.value = fullPurposeStr;

  updatePreview();
  return fullPurposeStr;
}

function setPurposeCheckboxes(purposeStr) {
  const checkboxes = document.querySelectorAll('input[name="purpose-check"]');
  checkboxes.forEach(cb => cb.checked = false);

  if (!purposeStr) {
    const tourismCb = Array.from(checkboxes).find(cb => cb.value === 'Tourism');
    if (tourismCb) tourismCb.checked = true;
    syncSelectedPurpose();
    return;
  }

  const rawPurposes = String(purposeStr).split(/,|\/|&|\+/).map(p => p.trim().toLowerCase()).filter(Boolean);
  
  checkboxes.forEach(cb => {
    const cbLower = cb.value.toLowerCase();
    const matched = rawPurposes.some(rp => {
      return cbLower.includes(rp) || rp.includes(cbLower) || 
             (cbLower.includes('family') && rp.includes('visit')) ||
             (cbLower.includes('work') && (rp.includes('work') || rp.includes('employment')));
    });
    if (matched) {
      cb.checked = true;
    }
  });

  // If none matched, check Tourism
  const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
  if (!anyChecked) {
    const tourismCb = Array.from(checkboxes).find(cb => cb.value === 'Tourism');
    if (tourismCb) tourismCb.checked = true;
  }

  syncSelectedPurpose();
}

// ===== VALIDITY & ENTRY PRICING MATRIX HELPERS =====
let customPricingTiers = [];

function onValidityCheckboxToggle(cb) {
  readCurrentTierInputs();
  const valName = cb.value.trim();
  const entryTypeVal = document.getElementById('f-entry-type')?.value || 'Single Entry';
  const baseFee = document.getElementById('f-fee')?.value.trim() || '₹7,000';

  if (cb.checked) {
    // Add default tiers for this checked validity if none exist
    const hasTiers = customPricingTiers.some(t => t.validity === valName);
    if (!hasTiers) {
      const entriesToGen = (entryTypeVal === 'Single & Multiple Entry') 
        ? ['Single Entry', 'Multiple Entry']
        : [entryTypeVal];
      entriesToGen.forEach(eName => {
        customPricingTiers.push({
          id: 'tier_' + Math.random().toString(36).substr(2, 9),
          validity: valName,
          entry: eName,
          fee: baseFee
        });
      });
    }
  } else {
    // Unchecked: remove tiers for this validity
    customPricingTiers = customPricingTiers.filter(t => t.validity !== valName);
  }

  const container = document.getElementById('validity-pricing-container');
  if (container) {
    container.style.display = customPricingTiers.length > 0 ? 'block' : 'none';
  }

  renderValidityPricingList();
  syncSelectedValidity(false);
}

function syncSelectedValidity(autoGenerate = false) {
  readCurrentTierInputs();
  const checkboxes = document.querySelectorAll('input[name="validity-check"]:checked');
  const selectedVals = Array.from(checkboxes).map(cb => cb.value.trim());
  const customVal = document.getElementById('f-validity-custom')?.value.trim();
  if (customVal) {
    customVal.split(',').map(s => s.trim()).filter(Boolean).forEach(v => {
      if (!selectedVals.includes(v)) selectedVals.push(v);
    });
  }

  // Also include validities present in customPricingTiers
  customPricingTiers.forEach(t => {
    if (t.validity && !selectedVals.includes(t.validity)) {
      selectedVals.push(t.validity);
    }
  });

  const fullValStr = selectedVals.join(', ');
  const hiddenInput = document.getElementById('f-validity');
  if (hiddenInput) hiddenInput.value = fullValStr;
  
  if (autoGenerate) {
    autoSyncPricingTiers(selectedVals);
  } else {
    const container = document.getElementById('validity-pricing-container');
    if (container) {
      container.style.display = (customPricingTiers.length > 0 || selectedVals.length > 0) ? 'block' : 'none';
    }
  }

  updatePreview();
  return fullValStr;
}

function autoSyncPricingTiers(selectedVals) {
  const container = document.getElementById('validity-pricing-container');
  const listEl = document.getElementById('validity-pricing-list');
  if (!container || !listEl) return;

  if (!selectedVals || selectedVals.length === 0) {
    container.style.display = 'none';
    listEl.innerHTML = '';
    customPricingTiers = [];
    return;
  }

  container.style.display = 'block';
  const entryTypeVal = document.getElementById('f-entry-type')?.value || 'Single Entry';
  const baseFee = document.getElementById('f-fee')?.value.trim() || '₹7,000';

  readCurrentTierInputs();

  const entriesToGenerate = (entryTypeVal === 'Single & Multiple Entry') 
    ? ['Single Entry', 'Multiple Entry']
    : [entryTypeVal];

  const newTiers = [];
  selectedVals.forEach(valName => {
    entriesToGenerate.forEach(entryName => {
      const existing = customPricingTiers.find(t => t.validity === valName && t.entry === entryName);
      if (existing) {
        newTiers.push(existing);
      } else {
        newTiers.push({
          id: 'tier_' + Math.random().toString(36).substr(2, 9),
          validity: valName,
          entry: entryName,
          fee: baseFee
        });
      }
    });
  });

  customPricingTiers.forEach(t => {
    if (!newTiers.some(nt => nt.id === t.id) && selectedVals.includes(t.validity)) {
      newTiers.push(t);
    }
  });

  customPricingTiers = newTiers;
  renderValidityPricingList();
}

function readCurrentTierInputs() {
  document.querySelectorAll('.val-pricing-row').forEach(row => {
    const tierId = row.getAttribute('data-tier-id');
    const valSelect = row.querySelector('.val-tier-validity');
    const entrySelect = row.querySelector('.val-tier-entry');
    const feeInput = row.querySelector('.val-tier-fee');

    const tier = customPricingTiers.find(t => t.id === tierId);
    if (tier) {
      if (valSelect) tier.validity = valSelect.value;
      if (entrySelect) tier.entry = entrySelect.value;
      if (feeInput) tier.fee = feeInput.value.trim();
    }
  });
}

function renderValidityPricingList() {
  const listEl = document.getElementById('validity-pricing-list');
  if (!listEl) return;

  const checkboxes = document.querySelectorAll('input[name="validity-check"]:checked');
  const selectedVals = Array.from(checkboxes).map(cb => cb.value.trim());
  const customVal = document.getElementById('f-validity-custom')?.value.trim();
  if (customVal) {
    customVal.split(',').map(s => s.trim()).filter(Boolean).forEach(v => {
      if (!selectedVals.includes(v)) selectedVals.push(v);
    });
  }
  
  // Standard validities list for dropdown
  const allAvailableValidities = ['14 Days', '30 Days', '60 Days', '90 Days', '6 Months', '1 Year', '2 Years', '5 Years', '10 Years'];
  selectedVals.forEach(v => {
    if (!allAvailableValidities.includes(v)) allAvailableValidities.push(v);
  });

  if (customPricingTiers.length === 0) {
    listEl.innerHTML = '<div style="font-size:12.5px; color:var(--text-muted); text-align:center; padding:8px;">No validity options added yet. Click "+ Add Option" above.</div>';
    return;
  }

  listEl.innerHTML = customPricingTiers.map(tier => `
    <div class="val-pricing-row" data-tier-id="${tier.id}" style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:#FFFFFF; border:1.5px solid var(--border); border-radius:10px; padding:10px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03); flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:240px;">
        <select class="form-select val-tier-validity" style="padding:6px 10px; font-size:13px; font-weight:700; color:#0D1B2A; background:#f8fafc; border-radius:8px;" onchange="readCurrentTierInputs(); updatePreview();">
          ${allAvailableValidities.map(v => `<option value="${v}" ${v === tier.validity ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <span style="color:#CBD5E1; font-weight:700;">&middot;</span>
        <select class="form-select val-tier-entry" style="padding:6px 10px; font-size:13px; font-weight:700; color:#0F766E; background:#F0FDFA; border-color:#99F6E4; border-radius:8px;" onchange="readCurrentTierInputs(); updatePreview();">
          <option value="Single Entry" ${tier.entry === 'Single Entry' ? 'selected' : ''}>Single Entry</option>
          <option value="Multiple Entry" ${tier.entry === 'Multiple Entry' ? 'selected' : ''}>Multiple Entry</option>
          <option value="Double Entry" ${tier.entry === 'Double Entry' ? 'selected' : ''}>Double Entry</option>
          <option value="Triple Entry" ${tier.entry === 'Triple Entry' ? 'selected' : ''}>Triple Entry</option>
          <option value="Visa Free" ${tier.entry === 'Visa Free' ? 'selected' : ''}>Visa Free</option>
        </select>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:12px; font-weight:700; color:var(--text-muted);">Total Fee:</span>
        <div style="position:relative; display:flex; align-items:center;">
          <span style="position:absolute; left:8px; font-weight:800; color:#2E7D7E; font-size:13px; pointer-events:none;">₹</span>
          <input type="text" class="form-input val-tier-fee" value="${tier.fee || ''}" placeholder="7,000" style="width:115px; padding:6px 8px 6px 20px; font-size:13px; font-weight:700; color:#2E7D7E; background:#f8fafc; border-radius:8px;" oninput="readCurrentTierInputs(); updatePreview();" />
        </div>
        <button type="button" onclick="removeValidityTierRow('${tier.id}')" style="background:#fee2e2; border:1px solid #fca5a5; color:#dc2626; width:26px; height:26px; border-radius:6px; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Delete this option">&times;</button>
      </div>
    </div>
  `).join('');
}

function addCustomValidityTierRow() {
  readCurrentTierInputs();
  const checkboxes = document.querySelectorAll('input[name="validity-check"]:checked');
  const selectedVals = Array.from(checkboxes).map(cb => cb.value.trim());
  const defaultVal = selectedVals[0] || '30 Days';
  const baseFee = document.getElementById('f-fee')?.value.trim() || '₹7,000';

  customPricingTiers.push({
    id: 'tier_' + Math.random().toString(36).substr(2, 9),
    validity: defaultVal,
    entry: 'Multiple Entry',
    fee: baseFee
  });

  const container = document.getElementById('validity-pricing-container');
  if (container) container.style.display = 'block';
  renderValidityPricingList();
  syncSelectedValidity(false);
  updatePreview();
}

function removeValidityTierRow(tierId) {
  readCurrentTierInputs();
  customPricingTiers = customPricingTiers.filter(t => t.id !== tierId);
  renderValidityPricingList();
  syncSelectedValidity(false);
  updatePreview();
}

function getCollectedValidityPricing() {
  readCurrentTierInputs();
  const baseFee = document.getElementById('f-fee')?.value.trim() || '₹7,000';
  return customPricingTiers.map(t => ({
    validity: t.validity || '30 Days',
    entry: t.entry || 'Single Entry',
    fee: t.fee || baseFee
  }));
}

function setValidityCheckboxes(valString, pricingArray) {
  const checkboxes = document.querySelectorAll('input[name="validity-check"]');
  checkboxes.forEach(cb => cb.checked = false);
  const customInput = document.getElementById('f-validity-custom');
  if (customInput) customInput.value = '';
  
  customPricingTiers = [];

  if (pricingArray && Array.isArray(pricingArray) && pricingArray.length > 0) {
    pricingArray.forEach(item => {
      if (item.validity && item.fee) {
        customPricingTiers.push({
          id: 'tier_' + Math.random().toString(36).substr(2, 9),
          validity: item.validity,
          entry: item.entry || 'Single Entry',
          fee: item.fee
        });
      }
    });
  }

  if (!valString && customPricingTiers.length === 0) {
    syncSelectedValidity();
    return;
  }

  const rawVals = (typeof valString === 'string' ? valString.split(/,|\/|\|/) : valString).map(v => v.trim()).filter(Boolean);
  const unselected = [];

  rawVals.forEach(item => {
    let matched = false;
    const itemClean = item.toLowerCase().replace(/\s+/g, '');

    checkboxes.forEach(cb => {
      const cbClean = cb.value.toLowerCase().replace(/\s+/g, '');
      if (cbClean === itemClean) {
        cb.checked = true;
        matched = true;
      }
    });

    if (!matched) {
      unselected.push(item);
    }
  });

  if (customInput && unselected.length > 0) {
    customInput.value = unselected.join(', ');
  }

  const selectedVals = Array.from(document.querySelectorAll('input[name="validity-check"]:checked')).map(cb => cb.value.trim());
  if (customInput?.value.trim()) {
    customInput.value.trim().split(',').map(s => s.trim()).filter(Boolean).forEach(v => {
      if (!selectedVals.includes(v)) selectedVals.push(v);
    });
  }

  const container = document.getElementById('validity-pricing-container');
  if (customPricingTiers.length > 0) {
    if (container) container.style.display = 'block';
    renderValidityPricingList();
  } else {
    autoSyncPricingTiers(selectedVals);
  }
}

// ===== VISA FORM SUBMIT =====
async function handleVisaSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('edit-visa-id').value;
  const bgColor = document.getElementById('f-bg-color').value;
  const submitBtn = document.getElementById('form-submit-btn');
  const originalText = submitBtn.textContent;
  
  const documentsVal = syncSelectedDocuments();
  if (!documentsVal) {
    showToast('Please select or specify at least one required document.', 'error');
    return;
  }

  readCurrentTierInputs();
  const validityPricing = getCollectedValidityPricing();
  const validityVal = syncSelectedValidity(false);
  if (!validityVal && validityPricing.length === 0) {
    showToast('Please select or enter at least one validity period.', 'error');
    return;
  }

  const mainFee = document.getElementById('f-fee').value.trim() || (validityPricing[0]?.fee) || '₹7,000';
  const entryTypeVal = document.getElementById('f-entry-type')?.value || 'Single Entry';

  submitBtn.textContent = 'Saving...';
  submitBtn.disabled = true;
  
  const visaData = {
    country: document.getElementById('f-country').value.trim(),
    countryCode: document.getElementById('f-country-code').value.trim().toUpperCase(),
    flag: document.getElementById('f-flag')?.value?.trim() || '',
    visaType: document.getElementById('f-visa-type').value,
    purpose: syncSelectedPurpose(),
    category: syncSelectedPurpose(),
    entryType: entryTypeVal,
    entries: entryTypeVal,
    fee: mainFee,
    processingTime: document.getElementById('f-processing').value.trim(),
    validity: validityVal,
    validityPricing: validityPricing,
    documents: documentsVal,
    description: document.getElementById('f-description').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    customPhoto: document.getElementById('f-photo-data').value, // Get base64 string
    bgColor: bgColor,
    bgGradient: generateGradient(bgColor),
    featured: document.getElementById('f-featured').checked,
    active: document.getElementById('f-active').checked,
    hasArrivalCard: document.getElementById('f-has-arrival-card')?.checked || false,
    arrivalCardName: document.getElementById('f-ac-name')?.value?.trim() || '',
    arrivalCardTagline: document.getElementById('f-ac-tagline')?.value?.trim() || '',
    arrivalCardMaxStay: document.getElementById('f-ac-maxstay')?.value?.trim() || '',
    arrivalCardFee: document.getElementById('f-ac-fee')?.value?.trim() || '',
    arrivalCardBgPhoto: document.getElementById('f-ac-bg-photo-data')?.value || '',
  };

  try {
    if (id) {
      // Edit mode
      await updateVisaDB(id, visaData);
      showToast(`"${visaData.country}" updated successfully!`, 'success');
    } else {
      // Add mode
      await addVisaDB(visaData);
      showToast(`"${visaData.country}" added successfully!`, 'success');
    }

    resetForm();
    refreshStats();
    renderDashboardTable();
    
    // Switch to manage view
    setTimeout(() => {
      showSection('manage-visas', document.getElementById('nav-manage-visas'));
    }, 500);
  } catch (error) {
    showToast('Failed to save visa. Check permissions.', 'error');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function generateGradient(baseColor) {
  // Generate a nice gradient from the base color
  const darken = (hex, amount) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
    const b = Math.max(0, (num & 0x0000FF) - amount);
    return '#' + (r * 65536 + g * 256 + b).toString(16).padStart(6, '0');
  };
  const lighten = (hex, amount) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
    const b = Math.min(255, (num & 0x0000FF) + amount);
    return '#' + (r * 65536 + g * 256 + b).toString(16).padStart(6, '0');
  };
  
  try {
    const dark = darken(baseColor, 30);
    const light = lighten(baseColor, 40);
    return `linear-gradient(135deg, ${dark} 0%, ${baseColor} 50%, ${light} 100%)`;
  } catch {
    return `linear-gradient(135deg, #020617 0%, ${baseColor} 100%)`;
  }
}

// ===== EDIT VISA =====
function editVisa(id) {
  const visa = getVisas().find(v => v.id === id);
  if (!visa) return;

  // Switch to add-visa section (which becomes edit form)
  editMode = true;
  showSection('add-visa', document.getElementById('nav-add-visa'));

  // Populate form
  document.getElementById('edit-visa-id').value = visa.id;
  document.getElementById('f-country').value = visa.country || '';
  document.getElementById('f-country-code').value = visa.countryCode || '';
  if(document.getElementById('f-flag')) document.getElementById('f-flag').value = visa.flag || '';
  document.getElementById('f-visa-type').value = visa.visaType || '';
  document.getElementById('f-fee').value = visa.fee || '';
  document.getElementById('f-processing').value = visa.processingTime || '';
  setPurposeCheckboxes(visa.purpose || visa.category || 'Tourism');
  if (document.getElementById('f-entry-type')) {
    document.getElementById('f-entry-type').value = visa.entryType || visa.entries || 'Single Entry';
  }
  setValidityCheckboxes(visa.validity || '', visa.validityPricing || null);
  setDocumentCheckboxes(visa.documents || '');
  document.getElementById('f-description').value = visa.description || '';
  document.getElementById('f-notes').value = visa.notes || '';
  document.getElementById('f-bg-color').value = visa.bgColor || '#020617';
  document.getElementById('f-bg-color-hex').value = visa.bgColor || '#020617';
  document.getElementById('f-featured').checked = visa.featured || false;
  document.getElementById('f-active').checked = visa.active !== false;

  // Arrival Card fields
  const hasAc = !!(visa.hasArrivalCard === true || visa.hasArrivalCard === 'true' || visa.hasArrivalCard === 1 || String(visa.hasArrivalCard).toLowerCase() === 'true');
  const acCb = document.getElementById('f-has-arrival-card');
  if (acCb) { acCb.checked = hasAc; toggleArrivalCardFields(hasAc); }
  const setAcField = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setAcField('f-ac-name', visa.arrivalCardName || (hasAc && visa.country ? `${visa.country} Digital Arrival Card` : ''));
  setAcField('f-ac-tagline', visa.arrivalCardTagline || (hasAc ? 'free and instant' : ''));
  setAcField('f-ac-maxstay', visa.arrivalCardMaxStay || (hasAc ? '30 Days' : ''));
  setAcField('f-ac-fee', visa.arrivalCardFee || (hasAc ? 'Free' : ''));

  // Restore Arrival Card background photo if exists
  if (visa.arrivalCardBgPhoto) {
    const acPreviewImg = document.getElementById('ac-bg-preview-img');
    const acUploadText = document.getElementById('ac-bg-upload-text');
    const acRemoveBtn = document.getElementById('ac-bg-remove-btn');
    document.getElementById('f-ac-bg-photo-data').value = visa.arrivalCardBgPhoto;
    if (acPreviewImg) { acPreviewImg.src = visa.arrivalCardBgPhoto; acPreviewImg.style.display = 'block'; }
    if (acUploadText) acUploadText.style.display = 'none';
    if (acRemoveBtn) acRemoveBtn.style.display = 'inline-block';
  } else {
    removeAcBgPhoto();
  }

  // Restore photo if exists
  if (visa.customPhoto) {
    const previewImg = document.getElementById('photo-preview-img');
    const uploadText = document.getElementById('photo-upload-text');
    const removeBtn = document.getElementById('photo-remove-btn');
    document.getElementById('f-photo-data').value = visa.customPhoto;
    previewImg.src = visa.customPhoto;
    previewImg.style.display = 'block';
    uploadText.style.display = 'none';
    removeBtn.style.display = 'inline-block';
  } else {
    removePhoto(new Event('click')); // clear UI
  }

  // Update UI
  document.getElementById('form-panel-title').textContent = `Edit Visa — ${visa.country}`;
  document.getElementById('form-submit-btn').textContent = 'Update Visa';
  document.getElementById('topbar-title').textContent = `Edit Visa — ${visa.country}`;

  updatePreview();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== TOGGLE ACTIVE =====
async function toggleVisa(id) {
  const visa = getVisas().find(v => v.id === id);
  if (!visa) return;
  
  const btn = document.getElementById(`toggle-btn-${id}`);
  if(btn) btn.disabled = true;

  try {
    await updateVisaDB(id, { active: !visa.active });
    const newState = !visa.active;
    showToast(`${newState ? 'Shown' : 'Hidden'}: ${visa.country}`, 'info');
    
    renderDashboardTable();
    if (document.getElementById('section-manage-visas').style.display !== 'none') {
      renderManageTable();
    }
    refreshStats();
  } catch (err) {
    showToast('Failed to update status.', 'error');
  } finally {
    if(btn) btn.disabled = false;
  }
}

// ===== DELETE =====
function promptDelete(id) {
  pendingDeleteId = id;
  document.getElementById('delete-modal').style.display = 'flex';
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  
  const visa = getVisas().find(v => v.id === pendingDeleteId);
  const name = visa ? visa.country : 'Visa';
  const idToDelete = pendingDeleteId;
  const btn = document.getElementById('confirm-delete-btn');
  btn.textContent = 'Deleting...';
  btn.disabled = true;
  
  deleteVisaDB(idToDelete).then(() => {
    pendingDeleteId = null;
    document.getElementById('delete-modal').style.display = 'none';
    
    showToast(`"${name}" deleted successfully`, 'error');
    renderDashboardTable();
    if (document.getElementById('section-manage-visas').style.display !== 'none') {
      renderManageTable();
    }
    refreshStats();
  }).catch(err => {
    showToast('Failed to delete visa.', 'error');
  }).finally(() => {
    btn.textContent = 'Delete';
    btn.disabled = false;
  });
}

// ===== BULK SEED / SYNC 166 VISAS FROM CSV =====
async function resetAndSeedAllVisas() {
  const dataset = (typeof window.FRESH_ALL_COUNTRIES_DATA !== 'undefined' && Array.isArray(window.FRESH_ALL_COUNTRIES_DATA))
    ? window.FRESH_ALL_COUNTRIES_DATA
    : null;

  if (!dataset || dataset.length === 0) {
    showToast('Dataset not found or empty.', 'error');
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to delete all existing visas and import the fresh ${dataset.length} country visas with all complete validity and entry tiers from the dataset?`
  );
  if (!confirmed) return;

  const btnSeed = document.getElementById('btn-seed-dataset');
  const prevText = btnSeed ? btnSeed.textContent : '';
  if (btnSeed) {
    btnSeed.disabled = true;
    btnSeed.textContent = 'Clearing & Uploading...';
  }

  try {
    showToast('Deleting existing visas...', 'info');
    
    // 1. Delete existing docs in chunks
    const snapshot = await db.collection('visas').get();
    const docs = snapshot.docs;
    const chunkSize = 400;
    
    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + chunkSize);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    showToast(`Uploading ${dataset.length} country visas...`, 'info');

    // 2. Upload new dataset in chunks
    for (let i = 0; i < dataset.length; i += chunkSize) {
      const batch = db.batch();
      const chunk = dataset.slice(i, i + chunkSize);
      chunk.forEach(vData => {
        const docRef = db.collection('visas').doc();
        const clean = cleanDocData(vData);
        delete clean.id;
        batch.set(docRef, clean);
      });
      await batch.commit();
    }

    showToast(`Successfully synced ${dataset.length} country visas!`, 'success');
    
    // Reload local cache
    await loadVisasFromDB();
    renderDashboardTable();
    if (document.getElementById('section-manage-visas').style.display !== 'none') {
      renderManageTable();
    }
    refreshStats();
  } catch (err) {
    console.error('Error seeding visas:', err);
    showToast('Failed to sync dataset: ' + (err.message || err), 'error');
  } finally {
    if (btnSeed) {
      btnSeed.disabled = false;
      btnSeed.textContent = prevText || ' Sync 166 Visas';
    }
  }
}

// ===== RESET FORM =====
function resetForm() {
  document.getElementById('visa-form').reset();
  document.getElementById('edit-visa-id').value = '';
  document.getElementById('f-bg-color').value = '#020617';
  document.getElementById('f-bg-color-hex').value = '#020617';
  document.getElementById('f-notes').value = '';
  document.querySelectorAll('input[name="doc-check"]').forEach(cb => cb.checked = false);
  if (document.getElementById('f-doc-custom')) document.getElementById('f-doc-custom').value = '';
  if (document.getElementById('f-documents')) document.getElementById('f-documents').value = '';
  document.querySelectorAll('input[name="validity-check"]').forEach(cb => cb.checked = false);
  if (document.getElementById('f-validity-custom')) document.getElementById('f-validity-custom').value = '';
  if (document.getElementById('f-validity')) document.getElementById('f-validity').value = '';
  setPurposeCheckboxes('Tourism');
  if (document.getElementById('f-entry-type')) document.getElementById('f-entry-type').value = 'Single Entry';
  cachedValidityPrices = {};
  renderValidityPricingList([]);
  removePhoto(new Event('click')); // Reset photo UI
  removeAcBgPhoto(new Event('click')); // Reset arrival card photo UI
  const acCb = document.getElementById('f-has-arrival-card');
  if (acCb) { acCb.checked = false; toggleArrivalCardFields(false); }
  ['f-ac-name','f-ac-tagline','f-ac-maxstay','f-ac-fee'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('form-panel-title').textContent = 'Add New Visa Destination';
  document.getElementById('form-submit-btn').textContent = 'Save Visa';
  editMode = false;
  updatePreview();
}

// ===== LIVE PREVIEW =====
function updatePreview() {
  const country = document.getElementById('f-country')?.value || 'Country Name';
  const type = document.getElementById('f-visa-type')?.value || 'Visa Type';
  const fee = document.getElementById('f-fee')?.value || '$0';
  const countryCode = document.getElementById('f-country-code')?.value || '';
  const flag = document.getElementById('f-flag')?.value || '';
  const bgColor = document.getElementById('f-bg-color')?.value || '#020617';
  const processing = document.getElementById('f-processing')?.value || 'Processing';

  // Update preview card background
  const bgEl = document.getElementById('preview-bg');
  const customPhotoData = document.getElementById('f-photo-data')?.value;
  
  if (bgEl) {
    const gradient = generateGradient(bgColor);
    
    if (customPhotoData) {
      bgEl.style.background = gradient;
      bgEl.style.backgroundImage = `url('${customPhotoData}')`;
      bgEl.style.backgroundSize = 'cover';
      bgEl.style.backgroundPosition = 'center';
    } else if (countryCode && countryCode.length === 2) {
      bgEl.style.background = gradient;
      const imgUrl = getCountryImage(countryCode.toUpperCase());
      bgEl.style.backgroundImage = `url('${imgUrl}')`;
      bgEl.style.backgroundSize = 'cover';
      bgEl.style.backgroundPosition = 'center';
    } else {
      bgEl.style.background = gradient;
      bgEl.style.backgroundImage = 'none';
    }
  }

  // Update flag
  const flagEl = document.getElementById('preview-flag');
  if (flagEl) {
    if (countryCode && countryCode.length === 2) {
      const flagUrl = getFlagUrl(countryCode.toUpperCase());
      flagEl.innerHTML = `<img src="${flagUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='${flag}'" />`;
    } else {
      flagEl.textContent = flag || '';
    }
  }

  // Update text
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText('preview-country', country.toUpperCase());
  setText('preview-type', type || 'Visa Type');
  setText('preview-fee', fee || '$0');
  setText('preview-name-below', country);
  setText('preview-type-below', `${type || 'Visa Type'} · ${processing}`);
}

function syncColorPicker() {
  const hexInput = document.getElementById('f-bg-color-hex');
  const colorPicker = document.getElementById('f-bg-color');
  if (hexInput && colorPicker) {
    const val = hexInput.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      colorPicker.value = val;
      updatePreview();
    }
  }
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('delete-modal').style.display = 'none';
  }
});

// Close delete modal on overlay click
document.getElementById('delete-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('delete-modal')) {
    document.getElementById('delete-modal').style.display = 'none';
  }
});

// ===== PHOTO UPLOAD (VISAS) =====
const countryStockImages = {
  'AE': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1600&auto=format&fit=crop',
  'US': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=1600&auto=format&fit=crop',
  'GB': 'https://images.unsplash.com/photo-1513635269975-5969336cd100?q=80&w=1600&auto=format&fit=crop',
  'TH': 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1600&auto=format&fit=crop',
  'SG': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=1600&auto=format&fit=crop',
  'FR': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1600&auto=format&fit=crop',
  'JP': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
  'TR': 'https://images.unsplash.com/photo-1522206090729-10526e0e2cb0?q=80&w=1600&auto=format&fit=crop',
  'EG': 'https://images.unsplash.com/photo-1539667468225-eebb663053e6?q=80&w=1600&auto=format&fit=crop',
  'IT': 'https://images.unsplash.com/photo-1516483638261-f40889eba3f2?q=80&w=1600&auto=format&fit=crop',
  'IN': 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=1600&auto=format&fit=crop',
  'AU': 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?q=80&w=1600&auto=format&fit=crop',
  'CA': 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1600&auto=format&fit=crop',
  'DE': 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1600&auto=format&fit=crop',
  'CH': 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=1600&auto=format&fit=crop',
  'SA': 'https://images.unsplash.com/photo-1580619305218-8423a7ef79b4?q=80&w=1600&auto=format&fit=crop'
};

function handleCountryCodeInput(code) {
  const currentPhoto = document.getElementById('f-photo-data').value;
  // Don't override if user already uploaded a custom local file
  if (currentPhoto.startsWith('data:image')) {
    return;
  }
  
  if (code.length === 2) {
    const stockUrl = countryStockImages[code.toUpperCase()];
    if (stockUrl) {
      setPhotoFromUrl(stockUrl);
    }
  }
}

function setPhotoFromUrl(url) {
  document.getElementById('f-photo-data').value = url;
  const previewImg = document.getElementById('photo-preview-img');
  previewImg.src = url;
  previewImg.style.display = 'block';
  document.getElementById('photo-upload-text').style.display = 'none';
  const icon = document.querySelector('.photo-upload-icon');
  if(icon) icon.style.display = 'none';
  document.getElementById('photo-remove-btn').style.display = 'inline-block';
  updatePreview();
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large. Max 5MB.', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Str = e.target.result;
    document.getElementById('f-photo-data').value = base64Str;
    
    const previewImg = document.getElementById('photo-preview-img');
    const uploadText = document.getElementById('photo-upload-text');
    const removeBtn = document.getElementById('photo-remove-btn');
    
    previewImg.src = base64Str;
    previewImg.style.display = 'block';
    uploadText.style.display = 'none';
    removeBtn.style.display = 'inline-block';
    
    updatePreview(); // update the live card preview
  };
  reader.readAsDataURL(file);
}

function removePhoto(event) {
  if(event) {
    event.preventDefault();
    event.stopPropagation();
  }
  document.getElementById('f-photo-upload').value = '';
  document.getElementById('f-photo-data').value = '';
  
  document.getElementById('photo-preview-img').style.display = 'none';
  document.getElementById('photo-upload-text').style.display = 'block';
  document.getElementById('photo-remove-btn').style.display = 'none';
  
  updatePreview(); // update the live card preview
}

// ===== ARRIVAL CARD BACKGROUND PHOTO UPLOAD =====
function handleAcBgUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large. Max 5MB.', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Str = e.target.result;
    document.getElementById('f-ac-bg-photo-data').value = base64Str;
    
    const previewImg = document.getElementById('ac-bg-preview-img');
    const uploadText = document.getElementById('ac-bg-upload-text');
    const removeBtn = document.getElementById('ac-bg-remove-btn');
    
    if (previewImg) { previewImg.src = base64Str; previewImg.style.display = 'block'; }
    if (uploadText) uploadText.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-block';
  };
  reader.readAsDataURL(file);
}

function removeAcBgPhoto(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const fileInput = document.getElementById('f-ac-bg-upload');
  if (fileInput) fileInput.value = '';
  const dataInput = document.getElementById('f-ac-bg-photo-data');
  if (dataInput) dataInput.value = '';
  
  const previewImg = document.getElementById('ac-bg-preview-img');
  if (previewImg) previewImg.style.display = 'none';
  const uploadText = document.getElementById('ac-bg-upload-text');
  if (uploadText) uploadText.style.display = 'block';
  const removeBtn = document.getElementById('ac-bg-remove-btn');
  if (removeBtn) removeBtn.style.display = 'none';
}

// ===== FLIGHT DEALS LOGIC =====
let editFlightMode = false;

function renderFlightsTable() {
  const tbody = document.getElementById('flights-table-body');
  if (!tbody) return;

  let flights = getFlights();
  const search = document.getElementById('manage-flights-search')?.value?.toLowerCase().trim();
  if (search) {
    flights = flights.filter(f => 
      (f.route || '').toLowerCase().includes(search) ||
      (f.airline || '').toLowerCase().includes(search) ||
      (f.tag || '').toLowerCase().includes(search)
    );
  }

  if (flights.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No flight deals found.</td></tr>`;
    return;
  }

  tbody.innerHTML = flights.map(flight => {
    const isActive = flight.active !== false;
    return `
      <tr>
        <td style="font-weight:600;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${flight.customPhoto ? `<img src="${flight.customPhoto}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;">` : `<div style="width:36px;height:36px;border-radius:6px;background:rgba(14,165,233,0.1);display:flex;align-items:center;justify-content:center;color:#0ea5e9;font-size:16px;"></div>`}
            <div>
              <div style="font-weight:700;color:var(--navy);">${flight.route}</div>
              ${flight.notes ? `<div style="font-size:11px;color:var(--text-muted);">${flight.notes.slice(0,35)}${flight.notes.length > 35 ? '...' : ''}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${flight.airline}</td>
        <td style="font-weight:700;color:var(--navy);">${flight.price}</td>
        <td>${flight.tag ? `<span class="visa-type-badge visa-type-sticker" style="font-size:11px;">${flight.tag}</span>` : '—'}</td>
        <td>
          <span class="status-badge ${isActive ? 'active' : 'inactive'}">
            ${isActive ? 'Active' : 'Hidden'}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" onclick="editFlight('${flight.id}')" id="f-edit-btn-${flight.id}">Edit</button>
            <button class="action-btn toggle ${!isActive ? 'inactive' : ''}" onclick="toggleFlight('${flight.id}')" id="f-toggle-btn-${flight.id}">
              ${isActive ? 'Hide' : 'Show'}
            </button>
            <button class="action-btn delete" onclick="deleteFlight('${flight.id}')" id="f-delete-btn-${flight.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleFlightSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-flight-id').value;
  const submitBtn = document.getElementById('flight-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Saving...';
  submitBtn.disabled = true;

  const origin = document.getElementById('f-flight-origin')?.value.trim() || '';
  const destination = document.getElementById('f-flight-destination')?.value.trim() || '';
  const route = origin && destination ? `${origin}  ${destination}` : (document.getElementById('f-flight-route')?.value.trim() || origin || destination);

  const flightData = {
    origin: origin,
    destination: destination,
    route: route,
    airline: document.getElementById('f-flight-airline').value.trim(),
    price: document.getElementById('f-flight-price').value.trim(),
    tag: document.getElementById('f-flight-tag').value.trim(),
    notes: document.getElementById('f-flight-notes').value.trim(),
    customPhoto: document.getElementById('f-flight-photo-data').value || '',
    active: document.getElementById('f-flight-active').checked
  };

  try {
    if (id) {
      await updateFlightDB(id, flightData);
      showToast(`"${flightData.route}" updated successfully!`, 'success');
    } else {
      await addFlightDB(flightData);
      showToast(`"${flightData.route}" added successfully!`, 'success');
    }
    resetFlightForm();
    renderFlightsTable();

    // Switch to manage view
    setTimeout(() => {
      showSection('manage-flights', document.getElementById('nav-manage-flights'));
    }, 400);
  } catch (error) {
    showToast('Failed to save flight.', 'error');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

async function toggleFlight(id) {
  const flight = getFlights().find(f => f.id === id);
  if (!flight) return;
  const btn = document.getElementById(`f-toggle-btn-${id}`);
  if(btn) btn.disabled = true;

  try {
    await updateFlightDB(id, { active: !flight.active });
    showToast(`Flight status updated`, 'info');
    renderFlightsTable();
  } catch(err) {
    showToast('Failed to update status', 'error');
  } finally {
    if(btn) btn.disabled = false;
  }
}

async function deleteFlight(id) {
  if (!confirm("Are you sure you want to delete this flight deal?")) return;
  
  const btn = document.getElementById(`f-delete-btn-${id}`);
  if(btn) { btn.textContent = '...'; btn.disabled = true; }

  try {
    await deleteFlightDB(id);
    showToast(`Flight deal deleted`, 'error');
    renderFlightsTable();
  } catch(err) {
    showToast('Failed to delete', 'error');
    if(btn) { btn.textContent = 'Delete'; btn.disabled = false; }
  }
}

function resetFlightForm() {
  document.getElementById('flight-form').reset();
  document.getElementById('edit-flight-id').value = '';
  if (document.getElementById('f-flight-origin')) document.getElementById('f-flight-origin').value = '';
  if (document.getElementById('f-flight-destination')) document.getElementById('f-flight-destination').value = '';
  if (document.getElementById('f-flight-route')) document.getElementById('f-flight-route').value = '';
  document.getElementById('flight-form-panel-title').textContent = 'Add New Flight Deal';
  document.getElementById('flight-submit-btn').textContent = 'Save Deal';
  editFlightMode = false;
  removeFlightPhoto();
  updateFlightPreview();
}

function editFlight(id) {
  const flight = getFlights().find(f => f.id === id);
  if (!flight) return;

  editFlightMode = true;
  showSection('add-flight', document.getElementById('nav-add-flight'));

  document.getElementById('flight-form-panel-title').textContent = 'Edit Flight Deal';
  document.getElementById('edit-flight-id').value = flight.id;

  if (flight.origin && flight.destination) {
    document.getElementById('f-flight-origin').value = flight.origin;
    document.getElementById('f-flight-destination').value = flight.destination;
  } else if (flight.route) {
    const parts = flight.route.split(/|→|->|-|to/i).map(s => s.trim());
    document.getElementById('f-flight-origin').value = parts[0] || '';
    document.getElementById('f-flight-destination').value = parts[1] || '';
  } else {
    document.getElementById('f-flight-origin').value = '';
    document.getElementById('f-flight-destination').value = '';
  }

  if (document.getElementById('f-flight-route')) {
    document.getElementById('f-flight-route').value = flight.route || '';
  }

  document.getElementById('f-flight-airline').value = flight.airline || '';
  document.getElementById('f-flight-price').value = flight.price || '';
  document.getElementById('f-flight-tag').value = flight.tag || '';
  document.getElementById('f-flight-notes').value = flight.notes || '';
  document.getElementById('f-flight-active').checked = flight.active !== false;

  if (flight.customPhoto) {
    const previewImg = document.getElementById('flight-photo-preview-img');
    const uploadText = document.getElementById('flight-photo-upload-text');
    const removeBtn = document.getElementById('flight-photo-remove-btn');
    document.getElementById('f-flight-photo-data').value = flight.customPhoto;
    if (previewImg) { previewImg.src = flight.customPhoto; previewImg.style.display = 'block'; }
    if (uploadText) uploadText.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-block';
  } else {
    removeFlightPhoto();
  }

  document.getElementById('flight-submit-btn').textContent = 'Update Deal';
  updateFlightPreview();
}

function handleFlightPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('File too large. Max 5MB.', 'error'); return; }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Str = e.target.result;
    document.getElementById('f-flight-photo-data').value = base64Str;
    const previewImg = document.getElementById('flight-photo-preview-img');
    const uploadText = document.getElementById('flight-photo-upload-text');
    const removeBtn = document.getElementById('flight-photo-remove-btn');
    previewImg.src = base64Str;
    previewImg.style.display = 'block';
    uploadText.style.display = 'none';
    removeBtn.style.display = 'inline-block';
    updateFlightPreview();
  };
  reader.readAsDataURL(file);
}

function removeFlightPhoto(event) {
  if(event) { event.preventDefault(); event.stopPropagation(); }
  document.getElementById('f-flight-photo-upload').value = '';
  document.getElementById('f-flight-photo-data').value = '';
  document.getElementById('flight-photo-preview-img').style.display = 'none';
  document.getElementById('flight-photo-upload-text').style.display = 'block';
  document.getElementById('flight-photo-remove-btn').style.display = 'none';
  updateFlightPreview();
}

function updateFlightPreview() {
  const origInput = document.getElementById('f-flight-origin')?.value.trim() || '';
  const destInput = document.getElementById('f-flight-destination')?.value.trim() || '';
  const fallbackRoute = document.getElementById('f-flight-route')?.value || 'Delhi → Dubai';
  
  let route = fallbackRoute;
  if (origInput || destInput) {
    route = `${origInput || 'Origin'}  ${destInput || 'Destination'}`;
    if (document.getElementById('f-flight-route')) {
      document.getElementById('f-flight-route').value = route;
    }
  }

  const airline = document.getElementById('f-flight-airline')?.value || 'Emirates';
  const rawPrice = document.getElementById('f-flight-price')?.value || '$299';
  const price = typeof formatCurrencyPrice === 'function' ? formatCurrencyPrice(rawPrice) : rawPrice;
  const tag = document.getElementById('f-flight-tag')?.value || 'NON-STOP';
  const notes = document.getElementById('f-flight-notes')?.value || '';
  const photo = document.getElementById('f-flight-photo-data')?.value || '';

  const container = document.getElementById('preview-flight-ticket-wrap');
  if (!container) return;

  const hasPhoto = !!photo;
  const routeParts = route.split(/|→|->|-|to/i).map(s => s.trim()).filter(Boolean);
  let origCity = routeParts[0] || 'Origin';
  let destCity = routeParts[1] || 'Destination';
  let origCode = (origCity.length <= 4 ? origCity : origCity.substring(0, 3)).toUpperCase();
  let destCode = (destCity.length <= 4 ? destCity : destCity.substring(0, 3)).toUpperCase();

  const flightNum = 'FLV-PREVIEW';
  const seatNum = '14B';
  const gateNum = 'B08';

  container.innerHTML = `
    <div class="flight-ticket-card ${hasPhoto ? 'has-bg' : ''}" style="width:100%; margin:0; ${hasPhoto ? `--flight-bg: url('${photo}');` : ''}">
      
      <!-- Left Boarding Pass Stub -->
      <div class="ticket-stub">
        <div class="stub-header">
          <span class="stub-brand">BOARDING PASS</span>
          <span class="stub-flight-num">${flightNum}</span>
        </div>
        <div class="stub-barcode-wrap">
          <div class="stub-barcode">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="stub-code">${flightNum}-TKT</div>
        </div>
        <div class="stub-meta">
          <div class="stub-meta-item"><span class="sm-lbl">SEAT</span><span class="sm-val">${seatNum}</span></div>
          <div class="stub-meta-item"><span class="sm-lbl">GATE</span><span class="sm-val">${gateNum}</span></div>
        </div>
      </div>

      <!-- Perforation Line with Half-Circle Cutout Notches -->
      <div class="ticket-perforation">
        <div class="ticket-notch notch-top"></div>
        <div class="ticket-notch notch-bottom"></div>
      </div>

      <!-- Main Ticket Body -->
      <div class="ticket-main">
        <div class="ticket-header">
          <div class="ticket-airline">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            <span>${airline}</span>
          </div>
          ${tag ? `<div class="ticket-tag">${tag}</div>` : `<div class="ticket-tag">SPECIAL FARE</div>`}
        </div>

        <div class="ticket-route-corridor">
          <div class="route-origin">
            <span class="route-city">${origCity}</span>
            <span class="route-code">${origCode}</span>
          </div>
          <div class="route-flight-path">
            <div class="flight-track-line"></div>
            <svg class="route-plane-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          </div>
          <div class="route-dest">
            <span class="route-city">${destCity}</span>
            <span class="route-code">${destCode}</span>
          </div>
        </div>

        ${notes ? `<div class="ticket-notes">${notes}</div>` : ''}

        <div class="ticket-footer">
          <div class="ticket-price-box">
            <span class="tprice-label">STARTING FROM</span>
            <span class="tprice-val" title="${price}">${price}</span>
          </div>
          <div class="ticket-book-btn" style="pointer-events:none;">
            <span>Book Deal</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ===== REAL-TIME LISTENERS =====
window.addEventListener('visasUpdated', () => {
  refreshStats();
  renderDashboardTable();
  const manageSec = document.getElementById('section-manage-visas');
  if (manageSec && manageSec.style.display !== 'none') {
    renderManageTable();
  }
});

window.addEventListener('flightsUpdated', () => {
  const flightSec = document.getElementById('section-manage-flights');
  if (flightSec && flightSec.style.display !== 'none') {
    renderFlightsTable();
  }
});


// Toggle Arrival Card extra fields in visa form
function toggleArrivalCardFields(isChecked) {
  const el = document.getElementById('ac-extra-fields');
  if (el) el.style.display = isChecked ? 'block' : 'none';
  if (isChecked) {
    const country = document.getElementById('f-country')?.value?.trim() || '';
    const nameInput = document.getElementById('f-ac-name');
    if (nameInput && !nameInput.value && country) {
      nameInput.value = `${country} Digital Arrival Card`;
    }
    const tagInput = document.getElementById('f-ac-tagline');
    if (tagInput && !tagInput.value) {
      tagInput.value = 'free and instant';
    }
    const maxStayInput = document.getElementById('f-ac-maxstay');
    if (maxStayInput && !maxStayInput.value) {
      maxStayInput.value = '30 Days';
    }
    const feeInput = document.getElementById('f-ac-fee');
    if (feeInput && !feeInput.value) {
      feeInput.value = 'Free';
    }
  }
}

// Render Admin Info Form
async function renderAdminInfoForm() {
  await loadAdminSettingsFromDB();
  const info = window.cachedAdminSettings || {};
  const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setV('admin-info-username', info.username || 'admin');
  setV('admin-info-password', info.password || 'admin123');
  setV('admin-info-email', info.email || 'admin@flyvis.com');
  setV('admin-info-phone', info.phone || '919207021258');
  setV('admin-info-business', info.businessName || 'Flyvis Travel & Visas');

  // Load Flight API Config
  const apiCfg = typeof getLiveFlightApiConfig === 'function' ? getLiveFlightApiConfig() : {};
  setV('admin-api-provider', apiCfg.provider || info.flightApiProvider || 'local_scraper');
  setV('admin-scraper-endpoint', apiCfg.scraperEndpoint || info.flightScraperEndpoint || 'http://localhost:5050/api/scrape-flights');
  setV('admin-api-key', apiCfg.apiKey || info.flightApiKey || '');
}

async function handleSaveAdminInfo(e) {
  e.preventDefault();
  const btn = document.getElementById('save-admin-info-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const provider = document.getElementById('admin-api-provider')?.value || 'local_scraper';
  const scraperEndpoint = document.getElementById('admin-scraper-endpoint')?.value || 'http://localhost:5050/api/scrape-flights';
  const apiKey = document.getElementById('admin-api-key')?.value || '';

  const data = {
    username: document.getElementById('admin-info-username').value.trim() || 'admin',
    password: document.getElementById('admin-info-password').value.trim() || 'admin123',
    email: document.getElementById('admin-info-email').value.trim(),
    phone: document.getElementById('admin-info-phone').value.trim(),
    businessName: document.getElementById('admin-info-business').value.trim(),
    flightApiProvider: provider,
    flightScraperEndpoint: scraperEndpoint,
    flightApiKey: apiKey
  };

  if (typeof saveLiveFlightApiConfig === 'function') {
    saveLiveFlightApiConfig({
      provider,
      scraperEndpoint,
      apiKey,
      liveStreamingEnabled: true
    });
  }

  try {
    await saveAdminSettingsToDB(data);
    showToast('Admin credentials and live flight scraper settings updated!', 'success');
  } catch(err) {
    showToast('Failed to save settings: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Admin Settings';
  }
}

// Render Arrival Cards Table
async function renderArrivalCardsTable() {
  await loadArrivalCardsFromDB();
  const tbody = document.getElementById('arrival-cards-table-body');
  if (!tbody) return;

  let cards = window.cachedArrivalCards || [];
  const search = document.getElementById('arrival-cards-search')?.value?.toLowerCase().trim();
  if (search) {
    cards = cards.filter(c => {
      const t = (c.travelers && c.travelers[0]) || {};
      return (c.country || '').toLowerCase().includes(search) ||
        (c.leadTraveler || '').toLowerCase().includes(search) ||
        (t.passportNumber || '').toLowerCase().includes(search) ||
        (c.contact?.email || '').toLowerCase().includes(search) ||
        (c.contact?.phone || '').toLowerCase().includes(search);
    });
  }

  if (cards.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No arrival card applications submitted yet.</td></tr>';
    return;
  }

  tbody.innerHTML = cards.map(c => {
    const t = (c.travelers && c.travelers[0]) || {};
    const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—';
    const flagUrl = getFlagUrl(c.countryCode || 'TH');

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;font-weight:700;">
            <img src="${flagUrl}" style="width:22px;border-radius:3px;" onerror="this.style.display='none'" />
            ${c.country || 'Destination'}
          </div>
        </td>
        <td style="font-weight:600;">${c.leadTraveler || (t.firstName + ' ' + t.lastName)}</td>
        <td><code>${t.passportNumber || '—'}</code></td>
        <td>${c.arrivalFlight ? (c.arrivalFlight.number + ' (' + c.arrivalFlight.date + ')') : '—'}</td>
        <td>${c.hotel ? (c.hotel.name + ', ' + c.hotel.location) : '—'}</td>
        <td>
          <div style="font-size:12px;">${c.contact?.email || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted);">${c.contact?.phone || '—'}</div>
        </td>
        <td>${dateStr}</td>
        <td>
          <div class="table-actions">
            <a href="mailto:${c.contact?.email || ''}?subject=Arrival Card Confirmation: ${c.country}" class="action-btn" title="Email traveler" style="color:#0ea5e9;text-decoration:none;">Email</a>
            <a href="https://wa.me/${(c.contact?.phone || '').replace(/[^0-9]/g, '')}" target="_blank" class="action-btn" title="WhatsApp traveler" style="color:#10b981;text-decoration:none;">WhatsApp</a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ===== CREDIT CARD PROMOS & BANK OFFERS MANAGEMENT =====
let activeCardPromos = [...(window.GLOBAL_BANK_FLIGHT_PROMOS || [])];

function renderAdminCardPromos() {
  const tbody = document.getElementById('card-promos-table-body');
  if (!tbody) return;

  if (!activeCardPromos.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No bank promo codes configured yet.</td></tr>';
    return;
  }

  tbody.innerHTML = activeCardPromos.map((p, idx) => `
    <tr>
      <td>
        <div style="font-weight:700; color:var(--text-dark);">${escapeHTML(p.airline || 'All Airlines')}</div>
      </td>
      <td>
        <span style="font-weight:600;">${escapeHTML(p.bank || 'Bank Partner')}</span>
      </td>
      <td>
        <code style="background:#0F172A; color:#FFF; padding:3px 8px; border-radius:6px; font-weight:700;">${escapeHTML(p.code)}</code>
      </td>
      <td>
        <span style="color:#059669; font-weight:700;">${Math.round((p.discountPct || 0) * 100)}% Off (Max ₹${(p.maxDiscount || 0).toLocaleString()})</span>
      </td>
      <td>
        <span>₹${(p.minSpend || 0).toLocaleString()}</span>
      </td>
      <td>
        <div class="table-actions">
          <button type="button" class="action-btn" onclick="editPromo(${idx})" title="Edit" style="color:#0ea5e9;">Edit</button>
          <button type="button" class="action-btn" onclick="deletePromo(${idx})" title="Delete" style="color:#ef4444;">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddPromoModal() {
  const form = document.getElementById('promo-form');
  if (form) form.reset();
  document.getElementById('promo-edit-id').value = '';
  document.getElementById('promo-modal-title').textContent = 'Add Bank Promo Code';
  document.getElementById('promo-modal').style.display = 'flex';
}

function editPromo(idx) {
  const promo = activeCardPromos[idx];
  if (!promo) return;
  document.getElementById('promo-edit-id').value = idx;
  document.getElementById('promo-airline').value = promo.airline || 'All Airlines';
  document.getElementById('promo-bank').value = promo.bank || '';
  document.getElementById('promo-code').value = promo.code || '';
  document.getElementById('promo-pct').value = Math.round((promo.discountPct || 0.1) * 100);
  document.getElementById('promo-max').value = promo.maxDiscount || 2500;
  document.getElementById('promo-min-spend').value = promo.minSpend || 5000;
  document.getElementById('promo-modal-title').textContent = 'Edit Bank Promo Code';
  document.getElementById('promo-modal').style.display = 'flex';
}

function handleSavePromo(e) {
  if (e) e.preventDefault();
  const editIdx = document.getElementById('promo-edit-id').value;
  const airline = document.getElementById('promo-airline').value.trim();
  const bank = document.getElementById('promo-bank').value.trim();
  const code = document.getElementById('promo-code').value.trim().toUpperCase();
  const pct = parseFloat(document.getElementById('promo-pct').value) / 100;
  const maxDisc = parseFloat(document.getElementById('promo-max').value) || 2000;
  const minSpend = parseFloat(document.getElementById('promo-min-spend').value) || 5000;

  const promoData = {
    id: editIdx !== '' ? activeCardPromos[editIdx].id : 'promo_' + Date.now(),
    airline,
    bank,
    cardIds: ['all_' + bank.toLowerCase().split(' ')[0]],
    code,
    title: `${Math.round(pct * 100)}% Instant Off on ${airline} with ${bank}`,
    discountPct: pct,
    maxDiscount: maxDisc,
    minSpend,
    validDays: 'All Days',
    description: `Save ${Math.round(pct * 100)}% up to ₹${maxDisc} on ${airline} using ${code}.`
  };

  if (editIdx !== '') {
    activeCardPromos[parseInt(editIdx, 10)] = promoData;
  } else {
    activeCardPromos.unshift(promoData);
  }

  // Update window global
  window.GLOBAL_BANK_FLIGHT_PROMOS = activeCardPromos;

  // Sync to Firestore if available
  try {
    if (typeof db !== 'undefined' && db) {
      db.collection('credit_card_offers').doc('active_promos').set({ promos: activeCardPromos });
    }
  } catch (err) {}

  document.getElementById('promo-modal').style.display = 'none';
  renderAdminCardPromos();
  showToast('Bank promo code saved successfully!');
}

function deletePromo(idx) {
  if (!confirm('Are you sure you want to delete this bank promo?')) return;
  activeCardPromos.splice(idx, 1);
  window.GLOBAL_BANK_FLIGHT_PROMOS = activeCardPromos;
  try {
    if (typeof db !== 'undefined' && db) {
      db.collection('credit_card_offers').doc('active_promos').set({ promos: activeCardPromos });
    }
  } catch (err) {}
  renderAdminCardPromos();
  showToast('Bank promo deleted.');
}

// ===== UNIFIED FAREOS SIDEBAR & PERSONA HELPERS =====
function initUnifiedPersona() {
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
  initUnifiedPersona();
  const menu = document.getElementById("admin-persona-dropdown");
  if (menu) menu.style.display = "none";
};

window.toggleSidebar = function() {
  const aside = document.getElementById("admin-sidebar");
  const main = document.querySelector(".admin-main");
  if (!aside || !main) return;
  if (aside.style.display === "none") {
    aside.style.display = "flex";
    main.style.marginLeft = "210px";
    main.style.width = "calc(100% - 210px)";
  } else {
    aside.style.display = "none";
    main.style.marginLeft = "0";
    main.style.width = "100%";
  }
};

window.filterSidebarMenu = function(query) {
  const q = (query || "").toLowerCase().trim();
  const items = document.querySelectorAll("#admin-sidebar .fareos-nav-item, #admin-sidebar .admin-nav-item");
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
  const titles = document.querySelectorAll("#admin-sidebar .fareos-nav-section-title, #admin-sidebar .admin-nav-group-title");
  titles.forEach(t => {
    t.style.display = q ? "none" : "block";
  });
};

document.addEventListener("DOMContentLoaded", () => {
  initUnifiedPersona();
  const handleHash = () => {
    if (window.location.hash) {
      const sec = window.location.hash.replace('#', '');
      const navItem = document.getElementById(`nav-${sec}`);
      if (document.getElementById(`section-${sec}`)) {
        showSection(sec, navItem);
      }
    }
  };
  handleHash();
  window.addEventListener("hashchange", handleHash);

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#admin-persona-dropdown") && !e.target.closest("#header-user-avatar")) {
      const m = document.getElementById("admin-persona-dropdown");
      if (m) m.style.display = "none";
    }
  });
});


