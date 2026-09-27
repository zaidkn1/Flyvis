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

  if (!visaId) { showNotFound(); return; }

  let visas;
  try {
    visas = await loadVisasFromDB();
  } catch(err) {
    console.error('Failed to load visas:', err);
    showNotFound(); return;
  }

  const visa = visas.find(v => v.id === visaId);
  if (!visa || !visa.active) { showNotFound(); return; }

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
  heroBg.style.backgroundImage = "url('" + bgImage + "')";

  const heroFlag = document.getElementById('main-hero-flag');
  heroFlag.src = flagUrl;

  const hasArrivalCard = !!(visa.hasArrivalCard === true || visa.hasArrivalCard === 'true' || visa.hasArrivalCard === 1 || String(visa.hasArrivalCard).toLowerCase() === 'true');

  if (hasArrivalCard) {
    // ==========================================
    // ARRIVAL CARD HERO (Reference Image 4)
    // ==========================================
    document.getElementById('main-hero-title').textContent =
      visa.arrivalCardName || ('Official ' + visa.country + ' Digital Arrival Card');
    document.getElementById('main-hero-green').textContent =
      visa.arrivalCardTagline || 'free and instant';
    
    document.getElementById('main-stat-valid').textContent = (visa.validity || '90 DAYS').toUpperCase();
    document.getElementById('main-stat-purpose').textContent = 'TOURISM';
    document.getElementById('main-stat-maxstay').textContent = (visa.arrivalCardMaxStay || '30 DAYS').toUpperCase();

    const ctaBtn = document.getElementById('main-hero-cta');
    ctaBtn.textContent = 'Get my arrival card for free →';
    ctaBtn.onclick = openArrivalCardModal;

    // Show Arrival Card Info Section (Reference Image 3)
    const acSection = document.getElementById('ac-details-section');
    acSection.style.display = 'block';

    document.getElementById('ac-overview-title').textContent =
      visa.arrivalCardName || (visa.country + ' Digital Arrival Card');
    document.getElementById('ac-overview-desc').textContent =
      'The ' + (visa.arrivalCardName || 'Arrival Card') + ' is a mandatory online form every traveller submits before flying to ' +
      visa.country + '. It is completely free - Indian passport holders enter visa-free for up to ' + (visa.arrivalCardMaxStay || '30 days') + '.';

    document.getElementById('ac-mini-price').textContent = visa.arrivalCardFee || 'Free';
    document.getElementById('ac-mini-processing').textContent = 'Instant';
    document.getElementById('ac-mini-maxstay').textContent = visa.arrivalCardMaxStay || '30 days';

    document.getElementById('ac-metallic-sub').textContent = 'NO VISA REQUIRED ONLY ' + (visa.arrivalCardName ? visa.arrivalCardName.toUpperCase() : 'ARRIVAL CARD');

    // Pre-fill Modal header
    document.getElementById('ac-modal-flag').src = flagUrl;
    document.getElementById('ac-modal-country-label').textContent = visa.country.toUpperCase() + ' ARRIVAL CARD';
    const locLbl = document.getElementById('ac-hotel-location-lbl');
    if (locLbl) locLbl.innerHTML = 'LOCATION IN ' + visa.country.toUpperCase() + ' <span class="req">*</span>';

  } else {
    // ==========================================
    // NORMAL VISA HERO (Reference Image 5)
    // ==========================================
    document.getElementById('main-hero-title').textContent = visa.country + ' Visa for Indians';
    document.getElementById('main-hero-green').textContent = 'in exactly ' + (visa.processingTime || 'a few days');

    document.getElementById('main-stat-valid').textContent = (visa.validity || '90 DAYS').toUpperCase();
    document.getElementById('main-stat-purpose').textContent = 'TOURISM';
    document.getElementById('main-stat-maxstay').textContent = (visa.validity || '30 DAYS').toUpperCase();

    const ctaBtn = document.getElementById('main-hero-cta');
    ctaBtn.textContent = 'Check Required Documents →';
    ctaBtn.onclick = function() {
      const el = document.getElementById('section-requirements');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    // Hide Arrival Card section
    document.getElementById('ac-details-section').style.display = 'none';
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

  // Info grid
  const infoItems = [
    { label: 'Visa Type', value: visa.visaType },
    { label: 'Government Fee', value: visa.fee, highlight: true },
    { label: 'Processing Time', value: visa.processingTime },
    { label: 'Validity', value: visa.validity },
    { label: 'Country Code', value: visa.countryCode || '—' }
  ];
  document.getElementById('detail-info-grid').innerHTML = infoItems.map(function(item) {
    return '<div class="detail-info-item"><div class="detail-info-item-label">' + item.label +
      '</div><div class="detail-info-item-value' + (item.highlight ? ' highlight' : '') + '">' +
      (item.value || '—') + '</div></div>';
  }).join('');

  // Documents Required
  const docs = (visa.documents || '').split(',').map(function(d) { return d.trim(); }).filter(Boolean);
  const docsList = document.getElementById('detail-docs-list');
  if (docs.length > 0) {
    docsList.innerHTML = docs.map(function(doc) {
      return '<div class="detail-doc-item"><div class="detail-doc-check">' +
        '<svg width="12" height="12" viewBox="0 0 12 12" fill="none">' +
        '<path d="M2 6L5 9L10 3" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg></div>' + doc + '</div>';
    }).join('');
  } else {
    docsList.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Please contact us via WhatsApp for the full document checklist.</p>';
  }

  renderFAQ(visa);

  // WhatsApp CTA
  const waMsg = encodeURIComponent(
    'Hi, I am interested in applying for a ' + visa.country + ' ' + visa.visaType + '.\n\n' +
    'Visa Details:\n- Type: ' + visa.visaType + '\n- Fee: ' + visa.fee +
    '\n- Processing: ' + visa.processingTime + '\n- Validity: ' + visa.validity +
    '\n\nPlease guide me through the application process.'
  );
  const waUrl = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + waMsg;
  document.getElementById('whatsapp-cta').href = waUrl;
  document.getElementById('floating-wa-link').href = waUrl;

  // Sidebar
  document.getElementById('sidebar-flag').src = flagUrl;
  document.getElementById('sidebar-flag').onerror = function() { this.style.display = 'none'; };
  document.getElementById('sidebar-country').textContent = visa.country;
  document.getElementById('sidebar-type-badge').textContent = visa.visaType;
  document.getElementById('sidebar-fee').textContent = visa.fee || '—';
  document.getElementById('sidebar-processing').textContent = visa.processingTime || '—';
  document.getElementById('sidebar-validity').textContent = visa.validity || '—';
  document.getElementById('sidebar-type').textContent = visa.visaType || '—';

  const sidebarHeader = document.getElementById('sidebar-header');
  sidebarHeader.style.background = 'linear-gradient(135deg, ' + (visa.bgColor || '#1a1a2e') + '18, transparent)';

  renderSidebarMore(allVisas, visa.id);
}

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
      a: 'The government fee for the ' + visa.country + ' ' + visa.visaType + ' is ' + visa.fee +
         '. Our service charges will be discussed transparently on WhatsApp before you proceed.'
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
