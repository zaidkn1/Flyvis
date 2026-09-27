// ===== MAIN PAGE JS =====

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initMobileNav();
  await loadVisasFromDB(); // Fetch from Firebase
  await loadFlightsFromDB(); // Fetch Flights from Firebase
  loadVisaCards();
  renderFlights();
  initScrollAnimations();
});

// ===== NAVBAR =====
function initNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// ===== MOBILE NAV =====
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
    });
  }

  // Close on link click
  if (mobileNav) {
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }
}

// ===== LOAD VISA CARDS =====
function loadVisaCards() {
  const grid = document.getElementById('visa-grid');
  if (!grid) return;

  const visas = getActiveVisas();
  
  if (visas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">🌍</div>
        <h3>No Visas Available</h3>
        <p>The admin hasn't added any visa destinations yet.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';

  // Show up to 12 visas on the homepage
  const displayVisas = visas.slice(0, 12);

  displayVisas.forEach((visa, index) => {
    const card = createVisaCard(visa, index);
    grid.appendChild(card);
  });
}

// ===== CREATE VISA CARD =====
function createVisaCard(visa, index = 0) {
  const wrapper = document.createElement('div');
  wrapper.className = 'animate-on-scroll';
  wrapper.style.transitionDelay = `${Math.min(index * 0.05, 0.5)}s`;

  let bgImage = visa.customPhoto || getCountryImage(visa.countryCode);
  if (bgImage && bgImage.includes('images.unsplash.com') && bgImage.includes('w=1600')) {
    bgImage = bgImage.replace('w=1600', 'w=600');
  }
  const flagUrl = getFlagUrl(visa.countryCode);
  const typeClass = getVisaTypeClass(visa.visaType);

  wrapper.innerHTML = `
    <a href="visa-detail.html?id=${visa.id}" class="visa-card-link" aria-label="View ${visa.country} visa details">
      <div class="visa-card">
        <div class="visa-card-bg" style="background: ${visa.bgGradient || visa.bgColor || '#1a1a2e'};background-image:url('${bgImage}');background-size:cover;background-position:center;"></div>
        <div class="visa-card-overlay"></div>
        <div class="visa-card-content">
          <div class="visa-card-flag">
            <img src="${flagUrl}" alt="${visa.country} flag"
              onerror="this.parentElement.innerHTML='<span style=font-size:16px>${visa.flag || ''}</span>'" />
          </div>
          <p class="visa-card-country">${visa.country}</p>
          <div class="visa-card-meta">
            <div class="visa-meta-item">
              <span class="visa-meta-label">Type</span>
              <span class="visa-meta-value">${visa.visaType}</span>
            </div>
            <div class="visa-meta-item" style="text-align:right;">
              <span class="visa-meta-label">Valid</span>
              <span class="visa-meta-value">${visa.validity}</span>
            </div>
            <div class="visa-meta-item" style="text-align:right;">
              <span class="visa-meta-label">Fee</span>
              <span class="visa-meta-value">${visa.fee}</span>
            </div>
          </div>
          <div class="visa-card-hover">
            <div class="visa-card-docs-label">Documents Required:</div>
            <div class="visa-card-docs">${visa.documents}</div>
            <div class="visa-card-apply-btn">View Full Details</div>
          </div>
        </div>
      </div>
      <div class="visa-card-info">
        <div class="visa-card-info-name">${visa.country}</div>
        <div class="visa-card-info-type">
          <span class="visa-type-badge ${typeClass}">${visa.visaType}</span>
          &middot; ${visa.processingTime}
        </div>
      </div>
    </a>
  `;

  return wrapper;
}

function getVisaTypeClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('e-visa') || t.includes('evisa')) return 'visa-type-evisa';
  if (t.includes('sticker')) return 'visa-type-sticker';
  if (t.includes('arrival')) return 'visa-type-arrival';
  if (t.includes('eta') || t.includes('eta')) return 'visa-type-eta';
  return 'visa-type-evisa';
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
  const elements = document.querySelectorAll('.animate-on-scroll');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => observer.observe(el));
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ===== FLIGHT DEALS =====
function renderFlights() {
  const section = document.getElementById('flights-section');
  const grid = document.getElementById('flights-grid');
  if (!section || !grid) return;

  // Filter for active flights
  const flights = (window.cachedFlights || []).filter(f => f.active !== false);
  
  if (flights.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  grid.innerHTML = flights.map((flight, index) => {
    const flightBg = flight.customPhoto || '';
    const hasPhoto = flightBg ? true : false;
    
    return `
      <div class="flight-card animate-on-scroll ${hasPhoto ? 'has-bg' : ''}" style="transition-delay: ${index * 0.1}s; ${hasPhoto ? `background-image: url('${flightBg}'); background-size: cover; background-position: center;` : ''}">
        ${hasPhoto ? '<div class="flight-card-overlay"></div>' : ''}
        <div class="flight-card-content">
          <div class="flight-card-header">
            <div class="flight-airline" style="${hasPhoto ? 'color: rgba(255,255,255,0.9);' : ''}">${flight.airline}</div>
            ${flight.tag ? `<div class="flight-tag">${flight.tag}</div>` : ''}
          </div>
          <div class="flight-route" style="${hasPhoto ? 'color: #ffffff;' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ocean); flex-shrink:0;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            ${flight.route}
          </div>
          ${flight.notes ? `<div class="flight-notes" style="${hasPhoto ? 'color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.2);' : ''}">${flight.notes}</div>` : ''}
          <div class="flight-price-box" style="${hasPhoto ? 'border-color: rgba(255,255,255,0.2);' : ''}">
            <div class="flight-price-label" style="${hasPhoto ? 'color: rgba(255,255,255,0.8);' : ''}">Starting from</div>
            <div class="flight-price" style="${hasPhoto ? 'color: #0ea5e9;' : ''}">${flight.price}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Listen for real-time Firebase updates
window.addEventListener('visasUpdated', loadVisaCards);
window.addEventListener('flightsUpdated', renderFlights);


// ===== HERO SEARCH HANDLER =====
function handleHeroSearch(e) {
  if (e) e.preventDefault();
  const dest = (document.getElementById('destination-input')?.value || '').trim();
  const type = (document.getElementById('visa-type-select')?.value || '').trim();
  const proc = (document.getElementById('processing-select')?.value || '').trim();
  
  const params = new URLSearchParams();
  if (dest) params.set('q', dest);
  if (type) params.set('type', type);
  if (proc) params.set('proc', proc);
  
  window.location.href = 'visas.html' + (params.toString() ? '?' + params.toString() : '');
}
