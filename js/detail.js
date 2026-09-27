// ===== VISA DETAIL PAGE JS =====
const WHATSAPP_NUMBER = '919207021258';

let currentVisaData = null;
let acTravelerCount = 1;

function handleHeroCtaClick() {
  if (currentVisaData && (currentVisaData.hasArrivalCard === true || currentVisaData.hasArrivalCard === 'true' || currentVisaData.hasArrivalCard === 1)) {
    openArrivalCardModal();
  } else {
    const el = document.getElementById('section-requirements');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initNavbarScroll();

  const params = new URLSearchParams(window.location.search);
  const visaId = params.get('id');
  const countryParam = params.get('country');

  let visas;
  try {
    visas = await loadVisasFromDB();
  } catch(err) {
    console.error('Failed to load visas:', err);
    showNotFound(); return;
  }

  if (!visas || visas.length === 0) {
    showNotFound(); return;
  }

  let visa = null;
  if (visaId) {
    visa = visas.find(v => v.id === visaId) ||
           visas.find(v => (v.country || '').toLowerCase() === visaId.toLowerCase());
  }
  if (!visa && countryParam) {
    visa = visas.find(v => (v.country || '').toLowerCase() === countryParam.toLowerCase());
  }
  if (!visa) {
    // Default to first active visa if no param is given
    visa = visas.find(v => v.active) || visas[0];
  }

  if (!visa) { showNotFound(); return; }

  currentVisaData = visa;
  renderDetailPage(visa, visas);
});

// ===== RENDER DETAIL PAGE =====
function renderDetailPage(visa, allVisas) {
  document.getElementById('detail-content').style.display = 'block';
  document.getElementById('not-found').style.display = 'none';

  const flagUrl = getFlagUrl(visa.countryCode);
  const bgImage = visa.arrivalCardBgPhoto || visa.customPhoto || getCountryImage(visa.countryCode);

  // SEO
  document.getElementById('page-title').textContent =
    visa.country + ' Visa — Requirements, Fees & Application | Flyvis';
  document.getElementById('page-desc').setAttribute('content',
    'Full details for ' + visa.country + ' ' + visa.visaType +
    '. Fee: ' + visa.fee + ', Processing: ' + visa.processingTime + ', Validity: ' + visa.validity + '.'
  );

  // Top Hero Background (Uses the photo uploaded by admin / visa's custom photo)
  const heroBg = document.getElementById('main-hero-bg');
  if (heroBg) {
    heroBg.style.backgroundColor = visa.bgColor || '#0f172a';
    heroBg.style.backgroundImage = "url('" + bgImage + "'), " + (visa.bgGradient || "linear-gradient(135deg, #020617 0%, #1e293b 100%)");
  }

  const heroFlag = document.getElementById('main-hero-flag');
  heroFlag.src = flagUrl;

  const hasArrivalCard = !!(visa.hasArrivalCard === true || visa.hasArrivalCard === 'true' || visa.hasArrivalCard === 1 || String(visa.hasArrivalCard).toLowerCase() === 'true');

  if (hasArrivalCard) {
    // ==========================================
    // ARRIVAL CARD HERO
    // ==========================================
    document.getElementById('main-hero-title').textContent =
      visa.arrivalCardName || ('Official ' + visa.country + ' Digital Arrival Card');
    document.getElementById('main-hero-green').textContent =
      visa.arrivalCardTagline || 'free and instant';
    
    document.getElementById('main-stat-valid').textContent = '—';
    document.getElementById('main-stat-purpose').textContent = 'TO BE SELECTED';
    document.getElementById('main-stat-maxstay').textContent = (visa.arrivalCardMaxStay || '30 DAYS').toUpperCase();

    const ctaBtn = document.getElementById('main-hero-cta');
    ctaBtn.textContent = 'Get my arrival card for free →';
    ctaBtn.onclick = openArrivalCardModal;

    // Pre-fill Modal header
    const mFlag = document.getElementById('ac-modal-flag');
    if (mFlag) mFlag.src = flagUrl;
    const mCountry = document.getElementById('ac-modal-country-label');
    if (mCountry) mCountry.textContent = visa.country.toUpperCase() + ' ARRIVAL CARD';
    const locLbl = document.getElementById('ac-hotel-location-lbl');
    if (locLbl) locLbl.innerHTML = 'LOCATION IN ' + visa.country.toUpperCase() + ' <span class="req">*</span>';

  } else {
    // ==========================================
    // NORMAL VISA HERO
    // ==========================================
    document.getElementById('main-hero-title').textContent = visa.country + ' Visa for Indians';
    document.getElementById('main-hero-green').textContent = 'in exactly ' + (visa.processingTime || 'a few days');

    document.getElementById('main-stat-valid').textContent = '—';
    document.getElementById('main-stat-purpose').textContent = 'TO BE SELECTED';
    document.getElementById('main-stat-maxstay').textContent = '30 DAYS';

    const ctaBtn = document.getElementById('main-hero-cta');
    ctaBtn.textContent = 'Check Required Documents →';
    ctaBtn.onclick = function() {
      const el = document.getElementById('section-requirements');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };
  }

  // ==========================================
  // NORMAL VISA DETAILS CONTENT (Common to both)
  // ==========================================
  const overviewText = visa.description ||
    'The ' + visa.country + ' ' + visa.visaType + ' allows eligible travelers to visit ' + visa.country +
    ' for tourism, business, or transit purposes. Processing typically takes ' + visa.processingTime +
    ', and the visa is valid for ' + visa.validity + ' from the date of issue.';
  document.getElementById('overview-text').textContent = overviewText;

  if (visa.notes && visa.notes.trim()) {
    document.getElementById('notes-block').style.display = 'block';
    document.getElementById('notes-text').textContent = visa.notes.trim();
  }

  // Populate Authentic Visa Sticker Card
  const cCountry = (visa.country || 'Destination').toUpperCase();
  const cCode = (visa.countryCode || 'IND').toUpperCase().padEnd(3, 'X').slice(0, 3);
  const serialNum = 'FLV' + (Math.abs(cCountry.split('').reduce(function(a,b){return (((a<<5)-a)+b.charCodeAt(0))|0;}, 0) % 900000) + 100000);

  const vCountryHeader = document.getElementById('vcard-country-header');
  if (vCountryHeader) vCountryHeader.textContent = cCountry;

  const vEmblemFlag = document.getElementById('vcard-emblem-flag');
  if (vEmblemFlag) vEmblemFlag.src = flagUrl;

  const vAuth = document.getElementById('vcard-authority');
  if (vAuth) vAuth.textContent = cCountry + ' CONSULAR POST';

  const vControl = document.getElementById('vcard-control');
  if (vControl) vControl.textContent = '2026' + cCode + '98401';

  const vType = document.getElementById('vcard-type');
  if (vType) vType.textContent = (visa.visaType || 'E-VISA').toUpperCase();

  const vPurpose = document.getElementById('vcard-purpose');
  if (vPurpose) vPurpose.textContent = (visa.purpose || visa.category || 'TOURISM').toUpperCase();

  const vFee = document.getElementById('vcard-fee');
  if (vFee) vFee.textContent = formatCurrencyPrice(visa.fee || '100% Free');

  const vProc = document.getElementById('vcard-processing');
  if (vProc) vProc.textContent = visa.processingTime || 'Instant';

  const vVal = document.getElementById('vcard-validity');
  if (vVal) vVal.textContent = (visa.validity || '90 DAYS').toUpperCase();

  const vStay = document.getElementById('vcard-stay');
  if (vStay) vStay.textContent = (visa.arrivalCardMaxStay || '30 DAYS').toUpperCase();

  const vEntries = document.getElementById('vcard-entries');
  if (vEntries) vEntries.textContent = (visa.entryType || visa.entries || 'SINGLE (S)').toUpperCase();

  const vSerial = document.getElementById('vcard-serial');
  if (vSerial) vSerial.textContent = serialNum;

  const mrz1 = document.getElementById('vcard-mrz-1');
  if (mrz1) mrz1.textContent = 'V<' + cCode + 'FLYVIS<<INDIAN<TRAVELLER<<<<<<<<<<<<<<<<<<<<<<<';

  const mrz2 = document.getElementById('vcard-mrz-2');
  if (mrz2) mrz2.textContent = serialNum + '<9IND9603218M3402120<<<<<<<<<<<<<<04';

  // 3. Render Travel Organizer Sleeve (Concept 3)
  renderDocumentSleeve(visa);

  renderFAQ(visa);

  // WhatsApp CTA
  const formattedFee = formatCurrencyPrice(visa.fee || 'Free');
  const visaPurposeVal = visa.purpose || visa.category || 'Tourism';
  const waMsg = encodeURIComponent(
    'Hi, I am interested in applying for a ' + visa.country + ' ' + visa.visaType + '.\n\n' +
    'Visa Details:\n- Purpose: ' + visaPurposeVal + '\n- Type: ' + visa.visaType + '\n- Fee: ' + formattedFee +
    '\n- Processing: ' + visa.processingTime + '\n- Validity: ' + visa.validity +
    '\n\nPlease guide me through the application process.'
  );
  const waUrl = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + waMsg;
  document.getElementById('whatsapp-cta').href = waUrl;
  document.getElementById('floating-wa-link').href = waUrl;

  // Sidebar
  const sbFlag = document.getElementById('sidebar-flag');
  if (sbFlag) {
    sbFlag.src = flagUrl;
    sbFlag.onerror = function() { this.style.display = 'none'; };
  }
  const sbCountry = document.getElementById('sidebar-country');
  if (sbCountry) sbCountry.textContent = visa.country;
  
  const sbTypeBadge = document.getElementById('sidebar-type-badge');
  if (sbTypeBadge) sbTypeBadge.textContent = visa.visaType;

  if (document.getElementById('sidebar-visa-type')) {
    document.getElementById('sidebar-visa-type').textContent = visa.visaType || '—';
  }
  if (document.getElementById('sidebar-visa-purpose')) {
    document.getElementById('sidebar-visa-purpose').textContent = visa.purpose || visa.category || 'Tourism';
  }
  if (document.getElementById('sidebar-fee')) {
    document.getElementById('sidebar-fee').textContent = formattedFee || '—';
  }
  if (document.getElementById('sidebar-processing')) {
    document.getElementById('sidebar-processing').textContent = visa.processingTime || '—';
  }
  if (document.getElementById('sidebar-validity')) {
    document.getElementById('sidebar-validity').textContent = visa.validity || '—';
  }
  if (document.getElementById('sidebar-stay')) {
    document.getElementById('sidebar-stay').textContent = visa.stayDuration || visa.maxStay || visa.validity || '30 Days';
  }
  if (document.getElementById('sidebar-entries')) {
    document.getElementById('sidebar-entries').textContent = visa.entries || visa.entryType || 'Single (S)';
  }
  renderSidebarMore(allVisas, visa.id);

  // Initialize Modern Booking / Price Calculator Widget
  initCalculatorWidget(visa);

  // Initialize interactive micro-movements & animations
  initCard3DTilt();
  initScrollRevealAndStamp();
  initParallaxWatermarks();
}

// ===== AIRLINE BOOKING / PRICING CALCULATOR WIDGET =====
let calculatorTravellerCount = 1;
let selectedCalculatorPurpose = 'Tourism';
let selectedCalculatorValidityIndex = 0;
let calculatorValidityTiers = [];

function initCalculatorWidget(visa) {
  calculatorTravellerCount = 1;
  selectedCalculatorValidityIndex = 0;
  
  // Set Purpose(s)
  const rawPurposes = String(visa.purpose || visa.category || 'Tourism').split(',').map(p => p.trim()).filter(Boolean);
  const purposesList = rawPurposes.length > 0 ? rawPurposes : ['Tourism'];
  selectedCalculatorPurpose = purposesList[0];

  const typeSelect = document.getElementById('calc-type-select');
  const typeVal = document.getElementById('calc-type-val');
  const typeMenu = document.getElementById('menu-calc-type');

  if (typeSelect) {
    typeSelect.value = selectedCalculatorPurpose;
  }
  if (typeVal) typeVal.textContent = selectedCalculatorPurpose;

  if (typeMenu) {
    typeMenu.innerHTML = purposesList.map((p, idx) => `
      <div class="fv-dropdown-item ${idx === 0 ? 'selected' : ''}" data-val="${p}" onclick="selectFvVisaType('${p}')">
        <span class="fv-item-label">${p}</span>
        <svg class="fv-check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `).join('');
  }

  // Build Validity Tiers
  calculatorValidityTiers = [];
  const pricing = visa.validityPricing || [];
  if (Array.isArray(pricing) && pricing.length > 0) {
    calculatorValidityTiers = pricing.map(p => ({
      validity: p.validity,
      entry: p.entry || visa.entryType || visa.entries || 'Single Entry',
      fee: p.fee
    }));
  } else {
    calculatorValidityTiers = [{
      validity: visa.validity || '30 Days',
      entry: visa.entryType || visa.entries || 'Single Entry',
      fee: visa.fee || '₹7,000'
    }];
  }

  const valSelect = document.getElementById('calc-validity-select');
  const valMenu = document.getElementById('menu-calc-validity');
  if (valSelect) {
    valSelect.value = "0";
  }

  if (valMenu) {
    valMenu.innerHTML = calculatorValidityTiers.map((t, idx) => `
      <div class="fv-dropdown-item ${idx === 0 ? 'selected' : ''}" data-val="${idx}" onclick="selectFvVisaValidity('${idx}')">
        <div style="display:flex; flex-direction:column; gap:2px; text-align:left;">
          <span class="fv-item-label" style="font-weight:700;">${t.validity} &middot; ${t.entry}</span>
          <span style="font-size:11px; color:#56727D; font-weight:600;">${formatCurrencyPrice(t.fee || '₹7,000')}</span>
        </div>
        <svg class="fv-check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `).join('');
  }

  const valDisplay = document.getElementById('calc-validity-val');
  if (valDisplay && calculatorValidityTiers[0]) {
    valDisplay.textContent = `${calculatorValidityTiers[0].validity} · ${calculatorValidityTiers[0].entry}`;
  }

  // Synchronize single selected validity and purpose across the entire page
  const initialTier = calculatorValidityTiers[0];
  if (initialTier) {
    const mainStatValid = document.getElementById('main-stat-valid');
    if (mainStatValid) mainStatValid.textContent = initialTier.validity.toUpperCase();

    const mainStatMaxStay = document.getElementById('main-stat-maxstay');
    if (mainStatMaxStay) mainStatMaxStay.textContent = initialTier.validity.toUpperCase();

    const vVal = document.getElementById('vcard-validity');
    if (vVal) vVal.textContent = initialTier.validity.toUpperCase();

    const vStay = document.getElementById('vcard-stay');
    if (vStay) vStay.textContent = initialTier.validity.toUpperCase();

    const vEntries = document.getElementById('vcard-entries');
    if (vEntries) vEntries.textContent = initialTier.entry.toUpperCase();

    const sidebarVal = document.getElementById('sidebar-validity');
    if (sidebarVal) sidebarVal.textContent = initialTier.validity;

    const sidebarStay = document.getElementById('sidebar-stay');
    if (sidebarStay) sidebarStay.textContent = initialTier.validity;

    const sidebarEntries = document.getElementById('sidebar-entries');
    if (sidebarEntries) sidebarEntries.textContent = initialTier.entry;
  }

  const mainStatPurpose = document.getElementById('main-stat-purpose');
  if (mainStatPurpose) mainStatPurpose.textContent = selectedCalculatorPurpose.toUpperCase();

  const vPurpose = document.getElementById('vcard-purpose');
  if (vPurpose) vPurpose.textContent = selectedCalculatorPurpose.toUpperCase();

  const sidebarPurpose = document.getElementById('sidebar-visa-purpose');
  if (sidebarPurpose) sidebarPurpose.textContent = selectedCalculatorPurpose;

  const travellersCountEl = document.getElementById('calc-travellers-count');
  if (travellersCountEl) travellersCountEl.textContent = '1';

  const minusBtn = document.getElementById('calc-step-minus');
  if (minusBtn) minusBtn.disabled = true;

  updateCalculatorTotal();
}

function toggleFvCalcDropdown(name, event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById(`menu-${name}`);
  const btn = document.getElementById(`btn-${name}`);
  if (!menu) return;

  const isOpen = menu.style.display === "block";
  closeAllFvCalcDropdowns();

  if (!isOpen) {
    menu.style.display = "block";
    if (btn) btn.classList.add("open");
  }
}

function closeAllFvCalcDropdowns() {
  document.querySelectorAll(".fv-dropdown-menu").forEach(m => m.style.display = "none");
  document.querySelectorAll(".fv-calc-trigger, .fv-dropdown-trigger").forEach(b => b.classList.remove("open"));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".fv-custom-dropdown")) {
    closeAllFvCalcDropdowns();
  }
});

function selectFvVisaType(val) {
  onCalculatorTypeChange(val);
  document.querySelectorAll("#menu-calc-type .fv-dropdown-item").forEach(item => {
    item.classList.toggle("selected", item.getAttribute("data-val") === val);
  });
  closeAllFvCalcDropdowns();
}

function selectFvVisaValidity(indexStr) {
  onCalculatorValidityChange(indexStr);
  document.querySelectorAll("#menu-calc-validity .fv-dropdown-item").forEach(item => {
    item.classList.toggle("selected", item.getAttribute("data-val") === String(indexStr));
  });
  closeAllFvCalcDropdowns();
}

function onCalculatorTypeChange(val) {
  selectedCalculatorPurpose = val;
  const hiddenInput = document.getElementById('calc-type-select');
  if (hiddenInput) hiddenInput.value = val;
  const typeVal = document.getElementById('calc-type-val');
  if (typeVal) typeVal.textContent = val;

  const mainStatPurpose = document.getElementById('main-stat-purpose');
  if (mainStatPurpose) mainStatPurpose.textContent = val.toUpperCase();

  const vPurpose = document.getElementById('vcard-purpose');
  if (vPurpose) vPurpose.textContent = val.toUpperCase();

  const sidebarPurpose = document.getElementById('sidebar-visa-purpose');
  if (sidebarPurpose) sidebarPurpose.textContent = val;

  updateCalculatorTotal();
}

function onCalculatorValidityChange(indexStr) {
  selectedCalculatorValidityIndex = parseInt(indexStr) || 0;
  const hiddenInput = document.getElementById('calc-validity-select');
  if (hiddenInput) hiddenInput.value = indexStr;
  const tier = calculatorValidityTiers[selectedCalculatorValidityIndex];
  if (tier) {
    const valDisplay = document.getElementById('calc-validity-val');
    if (valDisplay) valDisplay.textContent = `${tier.validity} · ${tier.entry}`;

    const mainStatValid = document.getElementById('main-stat-valid');
    if (mainStatValid) mainStatValid.textContent = tier.validity.toUpperCase();

    const mainStatMaxStay = document.getElementById('main-stat-maxstay');
    if (mainStatMaxStay) mainStatMaxStay.textContent = tier.validity.toUpperCase();

    const vVal = document.getElementById('vcard-validity');
    if (vVal) vVal.textContent = tier.validity.toUpperCase();

    const vStay = document.getElementById('vcard-stay');
    if (vStay) vStay.textContent = tier.validity.toUpperCase();

    const vEntries = document.getElementById('vcard-entries');
    if (vEntries) vEntries.textContent = tier.entry.toUpperCase();

    const sidebarVal = document.getElementById('sidebar-validity');
    if (sidebarVal) sidebarVal.textContent = tier.validity;

    const sidebarStay = document.getElementById('sidebar-stay');
    if (sidebarStay) sidebarStay.textContent = tier.validity;

    const sidebarEntries = document.getElementById('sidebar-entries');
    if (sidebarEntries) sidebarEntries.textContent = tier.entry;
  }
  updateCalculatorTotal();
}

function stepCalculatorTraveller(delta) {
  calculatorTravellerCount = Math.max(1, Math.min(20, calculatorTravellerCount + delta));
  
  const countEl = document.getElementById('calc-travellers-count');
  if (countEl) countEl.textContent = calculatorTravellerCount;

  const minusBtn = document.getElementById('calc-step-minus');
  if (minusBtn) minusBtn.disabled = calculatorTravellerCount <= 1;

  updateCalculatorTotal();
}

function updateCalculatorTotal() {
  if (!currentVisaData) return;
  const tier = calculatorValidityTiers[selectedCalculatorValidityIndex] || { fee: currentVisaData.fee, validity: currentVisaData.validity, entry: currentVisaData.entryType || 'Single-entry' };
  
  const rawFeeStr = String(tier.fee || currentVisaData.fee || '₹7000');
  
  let formattedTotal = '—';
  if (/^free/i.test(rawFeeStr) || /^100%\s*free/i.test(rawFeeStr)) {
    formattedTotal = 'FREE';
  } else {
    // Extract numbers
    const numMatch = rawFeeStr.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
    if (numMatch) {
      const unitAmount = parseFloat(numMatch[1]);
      const totalAmount = unitAmount * calculatorTravellerCount;
      
      let currencyPrefix = '₹';
      if (rawFeeStr.includes('$') || /usd/i.test(rawFeeStr)) currencyPrefix = '$';
      else if (rawFeeStr.includes('AED') || /aed/i.test(rawFeeStr)) currencyPrefix = 'AED ';
      else if (rawFeeStr.includes('€') || /eur/i.test(rawFeeStr)) currencyPrefix = '€';
      else if (rawFeeStr.includes('£') || /gbp/i.test(rawFeeStr)) currencyPrefix = '£';
      else if (rawFeeStr.includes('SAR') || /sar/i.test(rawFeeStr)) currencyPrefix = 'SAR ';

      formattedTotal = formatCurrencyPrice(currencyPrefix + totalAmount);
    } else {
      formattedTotal = formatCurrencyPrice(rawFeeStr);
    }
  }

  const priceEl = document.getElementById('calc-total-price');
  if (priceEl) priceEl.textContent = formattedTotal;

  // Also update vcard-fee
  const vFee = document.getElementById('vcard-fee');
  if (vFee) vFee.textContent = formatCurrencyPrice(tier.fee || currentVisaData.fee);

  // Update WhatsApp Application Link
  const selectedValidityLabel = `${tier.validity} (${tier.entry})`;
  const waMsg = encodeURIComponent(
    `Hi Flyvis Team, I want to start my visa application for ${currentVisaData.country}!\n\n` +
    `Application Details:\n` +
    `- Country: ${currentVisaData.country}\n` +
    `- Visa Type: ${currentVisaData.visaType || 'e-Visa'}\n` +
    `- Visa Purpose: ${selectedCalculatorPurpose}\n` +
    `- Validity & Entry: ${selectedValidityLabel}\n` +
    `- Travellers: ${calculatorTravellerCount} Person${calculatorTravellerCount > 1 ? 's' : ''}\n` +
    `- Total Amount: ${formattedTotal}\n\n` +
    `Please guide me with the document submission.`
  );

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`;
  const startBtn = document.getElementById('whatsapp-cta');
  if (startBtn) startBtn.href = waUrl;
  const floatWa = document.getElementById('floating-wa-link');
  if (floatWa) floatWa.href = waUrl;
}

window.addEventListener('flyvisCurrencyChanged', () => {
  if (currentVisaData && window.cachedVisas) {
    renderDetailPage(currentVisaData, window.cachedVisas);
  }
});

// ===== ARRIVAL CARD MODAL =====
function openArrivalCardModal() {
  document.getElementById('ac-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeArrivalCardModal() {
  document.getElementById('ac-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function closeArrivalCardModalOnBg(e) {
  if (e.target === document.getElementById('ac-modal-overlay')) closeArrivalCardModal();
}

// ===== VISA INSPECTION SPECIFICATIONS MODAL =====
function openVisaDetailModal() {
  if (!currentVisaData) return;
  const v = currentVisaData;

  const flagUrl = getFlagUrl(v.countryCode);
  const mFlag = document.getElementById('vmodal-flag');
  if (mFlag) {
    mFlag.src = flagUrl;
    mFlag.style.display = 'block';
  }

  const mTitle = document.getElementById('vmodal-title');
  if (mTitle) mTitle.textContent = v.country + ' Visa Regulations';

  const mSub = document.getElementById('vmodal-sub');
  if (mSub) mSub.textContent = (v.visaType || 'Tourist Visa').toUpperCase();

  const mType = document.getElementById('vmodal-type');
  if (mType) mType.textContent = v.visaType || '—';

  const mFee = document.getElementById('vmodal-fee');
  if (mFee) mFee.textContent = v.fee || 'Free';

  const mProc = document.getElementById('vmodal-proc');
  if (mProc) mProc.textContent = v.processingTime || 'Instant';

  const mVal = document.getElementById('vmodal-val');
  if (mVal) mVal.textContent = v.validity || '—';

  const mStay = document.getElementById('vmodal-stay');
  if (mStay) mStay.textContent = v.arrivalCardMaxStay || v.validity || '30 Days';

  const mDesc = document.getElementById('vmodal-desc');
  if (mDesc) {
    mDesc.textContent = v.description ||
      'Official consular authorization for ' + v.country + '. Allows eligible travelers to enter for tourism, business or family visits.';
  }

  const notesBox = document.getElementById('vmodal-notes-box');
  const mNotes = document.getElementById('vmodal-notes');
  if (v.notes && v.notes.trim()) {
    if (notesBox) notesBox.style.display = 'block';
    if (mNotes) mNotes.textContent = v.notes.trim();
  } else {
    if (notesBox) notesBox.style.display = 'none';
  }

  const overlay = document.getElementById('visa-inspect-modal');
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeVisaDetailModal() {
  const overlay = document.getElementById('visa-inspect-modal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function closeVisaDetailModalOnBg(e) {
  if (e.target === document.getElementById('visa-inspect-modal')) {
    closeVisaDetailModal();
  }
}

function handleVisaModalApply() {
  closeVisaDetailModal();
  const waBtn = document.getElementById('whatsapp-cta');
  if (waBtn && waBtn.href) {
    window.open(waBtn.href, '_blank');
  }
}

function setPill(btn, hiddenId, val) {
  const parent = btn.parentElement;
  parent.querySelectorAll('.ac-pill-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById(hiddenId).value = val;
}

function addAcTraveler() {
  acTravelerCount++;
  const container = document.getElementById('ac-travelers-container');
  const div = document.createElement('div');
  div.className = 'ac-traveler-block';
  div.innerHTML =
    '<div class="ac-traveler-divider">' +
      '<button type="button" class="ac-remove-traveler" onclick="this.parentElement.parentElement.remove()">Remove Traveler ' + acTravelerCount + '</button>' +
    '</div>' +
    '<div class="ac-sec-title"><div class="ac-sec-icon blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>Traveler ' + acTravelerCount + '</div>' +
    '<div class="ac-fields-2">' +
      '<div class="ac-field"><label>FIRST NAME <span class="req">*</span></label><input type="text" class="ac-input" name="firstName" placeholder="First Name" required /></div>' +
      '<div class="ac-field"><label>LAST NAME <span class="req">*</span></label><input type="text" class="ac-input" name="lastName" placeholder="Last Name" required /></div>' +
      '<div class="ac-field"><label>PASSPORT NUMBER <span class="req">*</span></label><input type="text" class="ac-input" name="passportNumber" placeholder="Passport Number" required /></div>' +
      '<div class="ac-field"><label>PASSPORT VALID TILL <span class="req">*</span></label><input type="date" class="ac-input" name="passportExpiry" required /></div>' +
    '</div>';
  container.appendChild(div);
}

async function handleAcSubmit(e) {
  e.preventDefault();
  if (!currentVisaData) return;

  const btn = document.getElementById('ac-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const form = document.getElementById('ac-form');
  const travelers = [];
  document.querySelectorAll('.ac-traveler-block').forEach(function(block) {
    const get = function(n) { const el = block.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    travelers.push({
      firstName: get('firstName'), lastName: get('lastName'),
      dob: get('dob'), gender: get('gender'),
      passportNumber: get('passportNumber'), passportExpiry: get('passportExpiry'),
      passportPlace: get('passportPlace'), maritalStatus: get('maritalStatus'),
      occupation: get('occupation')
    });
  });

  const payload = {
    country: currentVisaData.country,
    countryCode: currentVisaData.countryCode || '',
    arrivalCardName: currentVisaData.arrivalCardName || (currentVisaData.country + ' Digital Arrival Card'),
    leadTraveler: (travelers[0] ? travelers[0].firstName + ' ' + travelers[0].lastName : ''),
    travelers: travelers,
    arrivalFlight: {
      type: document.getElementById('ac-arr-type').value,
      number: form.arrFlightNo.value,
      date: form.arrDate.value
    },
    returnFlight: {
      type: document.getElementById('ac-ret-type').value,
      number: form.retFlightNo.value,
      date: form.retDate.value
    },
    hotel: { name: form.hotelName.value, location: form.hotelLocation.value },
    contact: { email: form.contactEmail.value, phone: form.countryCode.value + ' ' + form.contactPhone.value }
  };

  try {
    const saved = await submitArrivalCardDB(payload);
    const refId = saved.id ? ('FV-' + saved.id.slice(0, 8).toUpperCase()) : ('FV-AC-' + Math.floor(10000 + Math.random() * 90000));
    document.getElementById('ac-ref-id').textContent = 'Ref: ' + refId;

    // Retrieve Admin Settings from DB
    let adminEmail = 'admin@flyvis.com';
    let adminPhone = WHATSAPP_NUMBER;
    try {
      const adminSettings = await loadAdminSettingsFromDB();
      if (adminSettings && adminSettings.email) adminEmail = adminSettings.email;
      if (adminSettings && adminSettings.phone) adminPhone = adminSettings.phone.replace(/[^0-9]/g, '');
    } catch(e) {
      console.warn('Could not read admin settings:', e);
    }

    // Send Email to Admin via FormSubmit.co AJAX
    try {
      fetch('https://formsubmit.co/ajax/' + encodeURIComponent(adminEmail), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: 'New Arrival Card: ' + currentVisaData.country + ' - ' + payload.leadTraveler + ' (' + refId + ')',
          _template: 'table',
          Reference_ID: refId,
          Destination_Country: currentVisaData.country,
          Lead_Traveler: payload.leadTraveler,
          Total_Travelers: payload.travelers.length,
          Passport_Number: payload.travelers[0]?.passportNumber || 'N/A',
          Passport_Expiry: payload.travelers[0]?.passportExpiry || 'N/A',
          Date_of_Birth: payload.travelers[0]?.dob || 'N/A',
          Gender: payload.travelers[0]?.gender || 'N/A',
          Occupation: payload.travelers[0]?.occupation || 'N/A',
          Arrival_Flight: payload.arrivalFlight.number + ' on ' + payload.arrivalFlight.date + ' (' + payload.arrivalFlight.type + ')',
          Return_Flight: payload.returnFlight.number + ' on ' + payload.returnFlight.date + ' (' + payload.returnFlight.type + ')',
          Accommodation_Hotel: payload.hotel.name + ', ' + payload.hotel.location,
          Customer_Email: payload.contact.email,
          Customer_Phone: payload.contact.phone,
          Submission_Time: new Date().toLocaleString()
        })
      }).catch(function(e) { console.warn('Email dispatch warning:', e); });
    } catch(errEmail) {
      console.warn('Email sending error:', errEmail);
    }

    // Send WhatsApp notification
    const waPhone = adminPhone || WHATSAPP_NUMBER;
    const waText = encodeURIComponent(
      'New Arrival Card Application Received!\n\n' +
      'Ref: ' + refId + '\n' +
      'Destination: ' + currentVisaData.country + '\n' +
      'Traveler: ' + payload.leadTraveler + '\n' +
      'Passport: ' + (travelers[0]?.passportNumber || 'N/A') + '\n' +
      'Arrival Flight: ' + payload.arrivalFlight.number + ' (' + payload.arrivalFlight.date + ')\n' +
      'Return Flight: ' + payload.returnFlight.number + ' (' + payload.returnFlight.date + ')\n' +
      'Hotel: ' + payload.hotel.name + ', ' + payload.hotel.location + '\n' +
      'Contact: ' + payload.contact.phone + ' / ' + payload.contact.email
    );
    window.open('https://wa.me/' + waPhone + '?text=' + waText, '_blank');

    document.getElementById('ac-modal-overlay').classList.remove('open');
    document.getElementById('ac-success-overlay').classList.add('open');
    document.body.style.overflow = '';
  } catch(err) {
    alert('Submission failed. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit application';
  }
}

// ===== FAQ =====
function renderFAQ(visa) {
  const faqs = [
    {
      q: 'What type of visa is the ' + visa.country + ' ' + visa.visaType + '?',
      a: 'The ' + visa.country + ' ' + visa.visaType + ' is ' + getVisaTypeDesc(visa.visaType) +
         ' It allows eligible travelers to visit ' + visa.country + ' for the permitted duration.'
    },
    {
      q: 'How long does it take to process the ' + visa.country + ' visa?',
      a: 'Standard processing time for the ' + visa.country + ' ' + visa.visaType + ' is ' + visa.processingTime +
         '. Processing times may vary depending on embassy workloads and the completeness of your application.'
    },
    {
      q: 'How long is the ' + visa.country + ' visa valid?',
      a: 'The ' + visa.country + ' ' + visa.visaType + ' is valid for ' + visa.validity +
         ' from the date of issue or first entry, depending on the visa category.'
    },
    {
      q: 'What documents do I need for the ' + visa.country + ' visa?',
      a: 'You will need: ' + (visa.documents || 'as advised by our team') +
         '. Additional documents may be required based on your profile. Contact us on WhatsApp for a personalised document checklist.'
    },
    {
      q: 'How do I apply through Flyvis?',
      a: 'Simply click "Book via WhatsApp" and send us a message. Our visa specialists will guide you step-by-step, collect your documents, and submit the application on your behalf.'
    },
    {
      q: 'What is the visa fee?',
      a: 'The total fee for the ' + visa.country + ' ' + visa.visaType + ' is ' + formatCurrencyPrice(visa.fee || 'Free') +
         '. Everything is transparent and confirmed on WhatsApp before you proceed.'
    }
  ];

  document.getElementById('detail-faq').innerHTML = faqs.map(function(faq, i) {
    return '<div class="faq-item" id="faq-' + i + '">' +
      '<div class="faq-question" onclick="toggleFAQ(' + i + ')">' +
        '<span>' + faq.q + '</span>' +
        '<div class="faq-arrow"><svg width="10" height="6" viewBox="0 0 10 6" fill="none">' +
          '<path d="M1 1L5 5L9 1" stroke="#374151" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg></div>' +
      '</div>' +
      '<div class="faq-answer"><div class="faq-answer-inner">' + faq.a + '</div></div>' +
    '</div>';
  }).join('');
}

function getVisaTypeDesc(type) {
  const t = (type || '').toLowerCase();
  if (t.indexOf('e-visa') !== -1) return 'an electronic visa issued online before travel.';
  if (t.indexOf('sticker') !== -1) return 'a physical sticker visa affixed to your passport by the embassy.';
  if (t.indexOf('arrival') !== -1) return "a visa issued on arrival at the destination's port of entry.";
  if (t.indexOf('eta') !== -1) return 'an Electronic Travel Authorization linked electronically to your passport.';
  return 'a visa issued by the relevant immigration authority.';
}

function toggleFAQ(index) {
  const item = document.getElementById('faq-' + index);
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(function(f) { f.classList.remove('open'); });
  if (!isOpen) item.classList.add('open');
}

// ===== SIDEBAR MORE VISAS =====
function renderSidebarMore(allVisas, currentId) {
  const container = document.getElementById('sidebar-more-list');
  const others = allVisas.filter(function(v) { return v.id !== currentId && v.active; }).slice(0, 5);
  container.innerHTML = others.map(function(v) {
    const fUrl = getFlagUrl(v.countryCode);
    return '<a href="visa-detail.html?id=' + v.id + '" class="sidebar-more-item">' +
      '<img src="' + fUrl + '" alt="' + v.country + '" class="sidebar-more-flag" onerror="this.style.display=\'none\'" />' +
      '<div class="sidebar-more-info">' +
        '<div class="sidebar-more-name">' + v.country + '</div>' +
        '<div class="sidebar-more-type">' + v.visaType + '</div>' +
      '</div>' +
      '<div class="sidebar-more-fee">' + v.fee + '</div>' +
    '</a>';
  }).join('');
}

// ===== NAVBAR =====
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', function() {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// ===== NOT FOUND =====
function showNotFound() {
  const nf = document.getElementById('not-found');
  const dc = document.getElementById('detail-content');
  if (nf) nf.style.display = 'block';
  if (dc) dc.style.display = 'none';
}

function getDocumentIcon(doc) {
  const d = (doc || '').toLowerCase();
  if (d.includes('passport') && !d.includes('photo') && !d.includes('photograph')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="3"/><circle cx="12" cy="10" r="3"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`;
  }
  if (d.includes('photo') || d.includes('photograph')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M7 21v-1a5 5 0 0 1 10 0v1"/></svg>`;
  }
  if (d.includes('flight') || d.includes('ticket') || d.includes('itinerary')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
  }
  if (d.includes('hotel') || d.includes('accommodation') || d.includes('stay')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1"/></svg>`;
  }
  if (d.includes('bank') || d.includes('statement') || d.includes('financial')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="6" y1="10" x2="6" y2="21"/><line x1="10" y1="10" x2="10" y2="21"/><line x1="14" y1="10" x2="14" y2="21"/><line x1="18" y1="10" x2="18" y2="21"/></svg>`;
  }
  if (d.includes('tax') || d.includes('itr') || d.includes('form 16')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="11" y2="11"/></svg>`;
  }
  if (d.includes('employment') || d.includes('noc') || d.includes('salary') || d.includes('leave') || d.includes('job')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
  }
  if (d.includes('invitation') || d.includes('sponsor')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>`;
  }
  if (d.includes('insurance') || d.includes('medical')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>`;
  }
  if (d.includes('national id') || d.includes('aadhaar') || d.includes('resident') || d.includes('id card')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4M14 14h3"/></svg>`;
  }
  if (d.includes('cover') || d.includes('plan')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;
  }
  if (d.includes('previous') || d.includes('history')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;
}

// ===== CHECKLIST CLIPBOARD & PAPER SHEET =====
function renderDocumentSleeve(visa) {
  const badgeEl = document.getElementById('cboard-dest-badge');
  if (badgeEl) {
    badgeEl.textContent = (visa.country || 'DESTINATION').toUpperCase() + ' VISA CHECKLIST';
  }

  const itemsContainer = document.getElementById('cboard-items-list');
  if (!itemsContainer) return;

  const rawDocs = (visa.documents || '').split(',').map(function(d) { return d.trim(); }).filter(Boolean);
  const docs = rawDocs.length > 0 ? rawDocs : ['Original Passport (Valid 6+ Months)', 'Passport Size Photograph (White Background)', 'Flight Itinerary / Return Ticket'];

  let html = '';
  docs.forEach(function(doc, idx) {
    let slotNum = (idx + 1 < 10 ? '0' : '') + (idx + 1);
    let docIcon = getDocumentIcon(doc);

    html += '<div class="paper-check-row" onclick="togglePaperCheck(this)">' +
      '<div class="paper-checkbox-wrap">' +
        '<div class="paper-checkbox">' +
          '<svg class="check-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="20 6 9 17 4 12"/>' +
          '</svg>' +
        '</div>' +
      '</div>' +
      '<div class="doc-icon-badge">' + docIcon + '</div>' +
      '<div class="paper-row-content">' +
        '<div class="paper-row-title-bar">' +
          '<span class="paper-item-index">' + slotNum + '.</span>' +
          '<h4 class="paper-item-title">' + doc + '</h4>' +
          '<span class="check-ready-tag">Required</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  });

  itemsContainer.innerHTML = html;
}

function togglePaperCheck(rowEl) {
  if (!rowEl) return;
  rowEl.classList.toggle('is-checked');
}

// ===== 3D MOUSE-TRACKING TILT & HOLOGRAPHIC FOIL SHEEN =====
function initCard3DTilt() {
  const card = document.querySelector('.visa-sticker-card');
  if (!card) return;

  card.addEventListener('mousemove', function(e) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((centerY - y) / centerY) * 7.5;
    const rotateY = ((x - centerX) / centerX) * 7.5;

    card.style.transform = 'perspective(1000px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg) scale3d(1.015, 1.015, 1.015)';

    const sheenX = ((x / rect.width) * 100 - 50).toFixed(2);
    const sheenY = ((y / rect.height) * 100 - 50).toFixed(2);
    card.style.setProperty('--sheen-x', sheenX + '%');
    card.style.setProperty('--sheen-y', sheenY + '%');
  });

  card.addEventListener('mouseleave', function() {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    card.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease';
  });

  card.addEventListener('mouseenter', function() {
    card.style.transition = 'transform 0.1s ease-out, box-shadow 0.25s ease';
  });
}

// ===== SCROLL-DRIVEN REVEAL & STAMP THUMP =====
function initScrollRevealAndStamp() {
  const stamp = document.querySelector('.paper-official-stamp');
  if (stamp) {
    stamp.onclick = function() {
      stamp.classList.remove('stamped');
      void stamp.offsetWidth; // Trigger reflow to restart CSS animation
      stamp.classList.add('stamped');
    };
  }

  const elementsToReveal = document.querySelectorAll(
    '#section-overview, .visa-sticker-card, .clipboard-section, #sidebar-card, .flight-airway-section, #section-faq'
  );
  elementsToReveal.forEach(function(el) {
    el.classList.add('scroll-reveal');
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          if (entry.target.classList.contains('clipboard-section') || entry.target.id === 'section-requirements') {
            const st = document.querySelector('.paper-official-stamp');
            if (st && !st.classList.contains('stamped')) st.classList.add('stamped');
          }
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

    elementsToReveal.forEach(function(el) {
      observer.observe(el);
    });
  } else {
    elementsToReveal.forEach(function(el) { el.classList.add('revealed'); });
    if (stamp) stamp.classList.add('stamped');
  }
}

// ===== PARALLAX WATERMARK DRIFT =====
function initParallaxWatermarks() {
  const container = document.querySelector('.detail-body-watermarks');
  if (!container) return;
  let ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(function() {
        const scrolled = window.pageYOffset || document.documentElement.scrollTop;
        const yPos = -(scrolled * 0.05);
        container.style.transform = 'translateY(' + yPos.toFixed(1) + 'px)';
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}
