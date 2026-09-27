// ===== ADMIN DASHBOARD JS =====

const ADMIN_CREDS = { username: 'admin', password: 'admin123' };
let pendingDeleteId = null;
let editMode = false;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminSettingsFromDB();
  } catch(e) {
    console.warn('Admin settings prefetch:', e);
  }

  // Check if already logged in
  if (sessionStorage.getItem('flyvis_admin_logged_in') === 'true') {
    showDashboard();
  }
});

// ===== AUTH =====
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');

  // Ensure latest settings loaded from DB
  await loadAdminSettingsFromDB();
  const expectedUser = window.cachedAdminSettings?.username || 'admin';
  const expectedPass = window.cachedAdminSettings?.password || 'admin123';

  if (username === expectedUser && password === expectedPass) {
    sessionStorage.setItem('flyvis_admin_logged_in', 'true');
    errorEl.classList.remove('visible');
    showDashboard();
  } else {
    errorEl.classList.add('visible');
    const input = document.getElementById('login-password');
    input.value = '';
    input.focus();
  }
}

function handleLogout() {
  sessionStorage.removeItem('flyvis_admin_logged_in');
  document.getElementById('admin-dashboard').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

async function showDashboard() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'flex';
  
  // Load data from Firebase
  await loadVisasFromDB();
  await loadFlightsFromDB();
  
  refreshStats();
  renderDashboardTable();
  if (document.getElementById('section-flights').style.display !== 'none') {
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
    'admin-info': 'Admin Info & Settings'
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[sectionName] || 'Admin Console';

  // Load data for sections
  if (sectionName === 'manage-visas') renderManageTable();
  if (sectionName === 'manage-flights') renderFlightsTable();
  if (sectionName === 'arrival-cards') renderArrivalCardsTable();
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
              <img src="${flagUrl}" alt="${visa.country}" onerror="this.parentElement.innerHTML='<span style=font-size:18px>${visa.flag || '🏴'}</span>'" style="width:100%;height:100%;object-fit:cover;" />
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

// ===== VISA FORM SUBMIT =====
async function handleVisaSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('edit-visa-id').value;
  const bgColor = document.getElementById('f-bg-color').value;
  const submitBtn = document.getElementById('form-submit-btn');
  const originalText = submitBtn.textContent;
  
  submitBtn.textContent = 'Saving...';
  submitBtn.disabled = true;
  
  const visaData = {
    country: document.getElementById('f-country').value.trim(),
    countryCode: document.getElementById('f-country-code').value.trim().toUpperCase(),
    flag: document.getElementById('f-flag')?.value?.trim() || '',
    visaType: document.getElementById('f-visa-type').value,
    fee: document.getElementById('f-fee').value.trim(),
    processingTime: document.getElementById('f-processing').value.trim(),
    validity: document.getElementById('f-validity').value.trim(),
    documents: document.getElementById('f-documents').value.trim(),
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
  document.getElementById('f-validity').value = visa.validity || '';
  document.getElementById('f-documents').value = visa.documents || '';
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

// ===== RESET FORM =====
function resetForm() {
  document.getElementById('visa-form').reset();
  document.getElementById('edit-visa-id').value = '';
  document.getElementById('f-bg-color').value = '#020617';
  document.getElementById('f-bg-color-hex').value = '#020617';
  document.getElementById('f-notes').value = '';
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
  const flag = document.getElementById('f-flag')?.value || '🏴';
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
      flagEl.textContent = flag || '🏴';
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
            ${flight.customPhoto ? `<img src="${flight.customPhoto}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;">` : `<div style="width:36px;height:36px;border-radius:6px;background:rgba(14,165,233,0.1);display:flex;align-items:center;justify-content:center;color:#0ea5e9;font-size:16px;">✈</div>`}
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

  const flightData = {
    route: document.getElementById('f-flight-route').value.trim(),
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
  document.getElementById('f-flight-route').value = flight.route || '';
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
  const route = document.getElementById('f-flight-route')?.value || 'Route';
  const airline = document.getElementById('f-flight-airline')?.value || 'Airline';
  const price = document.getElementById('f-flight-price')?.value || '$0';
  const tag = document.getElementById('f-flight-tag')?.value || '';
  const notes = document.getElementById('f-flight-notes')?.value || '';
  const photo = document.getElementById('f-flight-photo-data')?.value || '';

  const card = document.getElementById('preview-flight-card');
  const overlay = document.getElementById('preview-flight-overlay');
  if (photo) {
    card.classList.add('has-bg');
    card.style.backgroundImage = `url('${photo}')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    overlay.style.display = 'block';
    document.getElementById('preview-flight-airline').style.color = 'rgba(255,255,255,0.9)';
    document.getElementById('preview-flight-route').style.color = '#ffffff';
    document.getElementById('preview-flight-price-box').style.borderColor = 'rgba(255,255,255,0.2)';
    document.getElementById('preview-flight-price-label').style.color = 'rgba(255,255,255,0.8)';
    document.getElementById('preview-flight-price').style.color = '#0ea5e9';
  } else {
    card.classList.remove('has-bg');
    card.style.backgroundImage = 'none';
    overlay.style.display = 'none';
    document.getElementById('preview-flight-airline').style.color = '';
    document.getElementById('preview-flight-route').style.color = '';
    document.getElementById('preview-flight-price-box').style.borderColor = '';
    document.getElementById('preview-flight-price-label').style.color = '';
    document.getElementById('preview-flight-price').style.color = '';
  }

  const setText = (id, text) => { const el = document.getElementById(id); if(el) el.innerHTML = text; };
  setText('preview-flight-airline', airline);
  setText('preview-flight-route', `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ocean); flex-shrink:0;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> <span>${route}</span>`);
  setText('preview-flight-price', price);

  const tagEl = document.getElementById('preview-flight-tag');
  if (tag) { tagEl.style.display = 'block'; tagEl.textContent = tag; } 
  else { tagEl.style.display = 'none'; }

  const notesEl = document.getElementById('preview-flight-notes');
  if (notes) {
    notesEl.style.display = 'block';
    notesEl.textContent = notes;
    if (photo) {
      notesEl.style.color = 'rgba(255,255,255,0.8)';
      notesEl.style.borderColor = 'rgba(255,255,255,0.2)';
    } else {
      notesEl.style.color = '';
      notesEl.style.borderColor = '';
    }
  } else {
    notesEl.style.display = 'none';
  }
}

// ===== REAL-TIME LISTENERS =====
window.addEventListener('visasUpdated', () => {
  refreshStats();
  renderDashboardTable();
  if (document.getElementById('section-manage-visas').style.display !== 'none') {
    renderManageTable();
  }
});

window.addEventListener('flightsUpdated', () => {
  if (document.getElementById('section-flights').style.display !== 'none') {
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
}

async function handleSaveAdminInfo(e) {
  e.preventDefault();
  const btn = document.getElementById('save-admin-info-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const data = {
    username: document.getElementById('admin-info-username').value.trim() || 'admin',
    password: document.getElementById('admin-info-password').value.trim() || 'admin123',
    email: document.getElementById('admin-info-email').value.trim(),
    phone: document.getElementById('admin-info-phone').value.trim(),
    businessName: document.getElementById('admin-info-business').value.trim()
  };

  try {
    await saveAdminSettingsToDB(data);
    showToast('Admin credentials and contact settings updated successfully!', 'success');
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
