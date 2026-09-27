// ===== MAIN PAGE JS =====

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initMobileNav();
  initSearchTextSlider();
  await loadVisasFromDB(); // Fetch from Firebase
  await loadFlightsFromDB(); // Fetch Flights from Firebase
  loadVisaCards();
  renderFlights();
  initScrollAnimations();

  window.addEventListener('flyvisCurrencyChanged', () => {
    loadVisaCards();
    renderFlights();
  });
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
        <div class="empty-state-icon"></div>
        <h3>No Visas Available</h3>
        <p>The admin hasn't added any visa destinations yet.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';

  // Show exactly 2 rows (up to 8 visas) on the homepage
  const displayVisas = visas.slice(0, 8);

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
      <div class="visa-card" style="background-color: ${visa.bgColor || '#0f172a'};">
        <div class="visa-card-bg" style="background-color: ${visa.bgColor || '#0f172a'}; background-image: url('${bgImage}'), ${visa.bgGradient || 'linear-gradient(135deg, #020617 0%, #1e293b 100%)'}; background-size: cover; background-position: center;"></div>
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
              <span class="visa-meta-value">${formatCurrencyPrice(visa.fee)}</span>
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
        <div class="visa-card-info-type" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span class="visa-type-badge ${typeClass}">${visa.visaType}</span>
          <span class="visa-purpose-badge">${visa.purpose || visa.category || 'Tourism'}</span>
          <span>&middot; ${visa.processingTime}</span>
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
  toast.innerHTML = `${type === 'success' ? '' : type === 'error' ? '' : 'ℹ️'} ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ===== FLIGHT DEALS =====
function formatPriceDisplay(priceVal) {
  if (!priceVal) return 'Ask on WhatsApp';
  return formatCurrencyPrice(priceVal);
}

function buildFlightTicketHTML(flight, index) {
  const flightBg = flight.customPhoto || '';
  const hasPhoto = !!flightBg;
  
  const routeParts = (flight.route || 'ORIGIN → DESTINATION').split(/→|->|-|to/i).map(s => s.trim()).filter(Boolean);
  let origCity = routeParts[0] || 'Origin';
  let destCity = routeParts[1] || 'Destination';
  let origCode = (origCity.length <= 4 ? origCity : origCity.substring(0, 3)).toUpperCase();
  let destCode = (destCity.length <= 4 ? destCity : destCity.substring(0, 3)).toUpperCase();

  const flightNum = 'FLV' + (100 + (index % 899));
  const seatNum = (10 + (index * 4) % 28) + ['A', 'B', 'F', 'K'][index % 4];
  const gateNum = ['A04', 'B12', 'C07', 'D19'][index % 4];
  const formattedPrice = formatPriceDisplay(flight.price);

  const waMsg = encodeURIComponent(
    `Hi Flyvis Team, I am interested in booking the flight deal: ${flight.route} with ${flight.airline || 'Airline'} starting at ${flight.price || ''}. Please share availability and details.`
  );
  const waUrl = `https://wa.me/919207021258?text=${waMsg}`;

  return `
    <div class="flight-ticket-card animate-on-scroll ${hasPhoto ? 'has-bg' : ''}" style="transition-delay:${(index || 0) * 0.08}s; ${hasPhoto ? `--flight-bg: url('${flightBg}');` : ''}">
      
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
            <span>${flight.airline || 'COMMERCIAL AIRLINE'}</span>
          </div>
          ${flight.tag ? `<div class="ticket-tag">${flight.tag}</div>` : `<div class="ticket-tag">SPECIAL FARE</div>`}
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

        ${flight.notes ? `<div class="ticket-notes">${flight.notes}</div>` : ''}

        <div class="ticket-footer">
          <div class="ticket-price-box">
            <span class="tprice-label">STARTING FROM</span>
            <span class="tprice-val" title="${formattedPrice}">${formattedPrice}</span>
          </div>
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="ticket-book-btn">
            <span>Book Deal</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>

    </div>
  `;
}

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
  
  // Show exactly 2 rows (up to 4 flight cards) on the homepage
  const displayFlights = flights.slice(0, 4);
  grid.innerHTML = displayFlights.map((flight, index) => buildFlightTicketHTML(flight, index)).join('');
}

// Listen for real-time Firebase updates
window.addEventListener('visasUpdated', loadVisaCards);
window.addEventListener('flightsUpdated', renderFlights);


// ===== SEARCH TEXT TICKER & LIVE AUTOCOMPLETE ENGINE =====
function initSearchTextSlider() {
  const ticker = document.getElementById('search-ticker-wrap');
  const input = document.getElementById('hero-search-input');
  const dropdown = document.getElementById('universal-search-dropdown');
  const dropContent = document.getElementById('search-drop-content');
  if (!input) return;

  const wrapper = input.parentElement;

  // Handle focus & input typing states
  input.addEventListener('focus', () => {
    if (wrapper) wrapper.classList.add('has-value');
    if (input.value.trim().length >= 1) {
      renderSearchAutocomplete(input.value.trim());
    }
  });

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (wrapper) {
      if (val.length > 0) {
        wrapper.classList.add('has-value');
      } else {
        wrapper.classList.remove('has-value');
      }
    }
    renderSearchAutocomplete(val);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && (!dropdown || !dropdown.contains(e.target))) {
      if (dropdown) dropdown.style.display = 'none';
      if (!input.value.trim() && wrapper) {
        wrapper.classList.remove('has-value');
      }
    }
  });

  // Clicking ticker container focuses the input
  if (ticker) {
    ticker.addEventListener('click', () => {
      input.focus();
    });
  }

  // Keyboard navigation inside search dropdown
  input.addEventListener('keydown', (e) => {
    if (!dropdown || dropdown.style.display === 'none') return;
    const items = dropdown.querySelectorAll('.search-drop-item');
    if (!items.length) return;

    let selectedIndex = Array.from(items).findIndex(el => el.classList.contains('selected'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selectedIndex >= 0) items[selectedIndex].classList.remove('selected');
      selectedIndex = (selectedIndex + 1) % items.length;
      items[selectedIndex].classList.add('selected');
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedIndex >= 0) items[selectedIndex].classList.remove('selected');
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      items[selectedIndex].classList.add('selected');
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        items[selectedIndex].click();
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });
}

function highlightMatch(text, query) {
  if (!text || !query) return escapeHTML(text || '');
  const escapedText = escapeHTML(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapedText.replace(regex, '<mark>$1</mark>');
}

function getVisaRelevance(v, q) {
  const country = (v.country || '').toLowerCase().trim();
  const name = (v.name || '').toLowerCase().trim();
  const code = (v.countryCode || '').toLowerCase().trim();
  const type = (v.type || v.visa_type || '').toLowerCase().trim();

  // 1. Exact match
  if (country === q) return 1000;

  // 2. Country STARTS WITH query (e.g. "la" -> "Laos", "Latvia")
  if (country.startsWith(q)) {
    return 900 - country.length;
  }

  // 3. Word starts with query (e.g. "Sri Lanka", "Saudi Arabia")
  if (country.includes(' ' + q) || country.includes('(' + q) || country.includes('-' + q)) {
    return 700 - country.length;
  }

  // 4. Country Code match (e.g. "LA", "IN", "US")
  if (code === q || code.startsWith(q)) {
    return 600;
  }

  // 5. Country contains query substring (e.g. "Malaysia", "Australia")
  if (country.includes(q)) {
    return 400 - country.indexOf(q);
  }

  // 6. Visa name starts with query
  if (name.startsWith(q)) {
    return 300;
  }

  // 7. Visa name contains query
  if (name.includes(q)) {
    return 200;
  }

  // 8. Visa type match (e.g. "Tourist", "Business")
  if (type.includes(q)) {
    return 100;
  }

  return 0;
}

function getFlightRelevance(f, q) {
  const toCity = (f.toCity || f.destination || '').toLowerCase().trim();
  const fromCity = (f.fromCity || f.origin || '').toLowerCase().trim();
  const airline = (f.airline || '').toLowerCase().trim();
  const title = (f.title || '').toLowerCase().trim();

  if (toCity === q) return 1000;
  if (toCity.startsWith(q)) return 900 - toCity.length;
  if (toCity.includes(' ' + q) || toCity.includes(q)) return 600;
  if (fromCity.startsWith(q) || fromCity.includes(q)) return 400;
  if (title.includes(q)) return 300;
  if (airline.includes(q)) return 200;
  if (q.includes('flight') || q.includes('deal') || q.includes('fare')) return 100;
  return 0;
}

function renderSearchAutocomplete(query) {
  const dropdown = document.getElementById('universal-search-dropdown');
  const dropContent = document.getElementById('search-drop-content');
  const input = document.getElementById('hero-search-input');
  const wrapper = input ? input.closest('.hero-search-slider-box') : null;
  if (!dropdown || !dropContent) return;

  if (!query || query.length < 1) {
    dropdown.style.display = 'none';
    if (wrapper) wrapper.classList.remove('dropdown-open');
    return;
  }

  const q = query.toLowerCase().trim();
  const visas = window.cachedVisas || [];
  const flights = (window.cachedFlights || []).filter(f => f.active !== false);

  // 1. Score and Filter Visas (Top 4 by relevance)
  const matchedVisas = visas
    .map(v => ({ visa: v, score: getVisaRelevance(v, q) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(item => item.visa);

  // 2. Score and Filter Flights (Top 3 by relevance)
  const matchedFlights = flights
    .map(f => ({ flight: f, score: getFlightRelevance(f, q) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.flight);

  // Build HTML sections
  let html = '';
  let totalMatches = 0;

  // A. Visas Section
  if (matchedVisas.length > 0) {
    totalMatches += matchedVisas.length;
    html += `
      <div class="search-drop-group">
        <div class="search-drop-header">
          <span class="search-drop-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2.2"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M7 16h10"/></svg>
            Visas (${matchedVisas.length})
          </span>
          <span class="search-drop-count">166+ Countries</span>
        </div>
        <div class="search-drop-list">
          ${matchedVisas.map(v => {
            const rawFee = v.fee || (v.validityPricing && v.validityPricing[0] ? v.validityPricing[0].fee : '') || (v.price ? '₹' + v.price : '₹0');
            const priceDisplay = typeof formatCurrencyPrice === 'function' ? formatCurrencyPrice(rawFee) : rawFee;
            const flagSrc = typeof getFlagUrl === 'function' ? getFlagUrl(v.countryCode) : '';
            const flagOrImg = flagSrc
              ? `<img src="${flagSrc}" alt="${escapeHTML(v.country)}" loading="lazy" onerror="this.src='assets/brand/flyvis-icon.png'" />`
              : (v.customPhoto 
                  ? `<img src="${v.customPhoto}" alt="${escapeHTML(v.country)}" loading="lazy" onerror="this.src='assets/brand/flyvis-icon.png'" />`
                  : `<img src="assets/brand/flyvis-icon.png" alt="Visa" />`);
            const validityText = v.validity || v.processingTime || 'Fast processing';
            const visaTypeName = v.visaType || v.type || 'Visa';

            return `
              <a href="visa-detail.html?id=${encodeURIComponent(v.id)}" class="search-drop-item">
                <div class="search-item-left">
                  <div class="search-item-icon-badge">${flagOrImg}</div>
                  <div class="search-item-texts">
                    <span class="search-item-title">${highlightMatch(v.country || v.name, query)} <small style="color:#718894; font-weight:400;">(${escapeHTML(visaTypeName)})</small></span>
                    <span class="search-item-subtitle">${escapeHTML(validityText)} &bull; Guaranteed delivery</span>
                  </div>
                </div>
                <div class="search-item-right">
                  <span class="search-item-price">${priceDisplay}</span>
                  <span class="search-item-tag">Apply</span>
                </div>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // B. Flight Deals Section
  if (matchedFlights.length > 0) {
    totalMatches += matchedFlights.length;
    html += `
      <div class="search-drop-group">
        <div class="search-drop-header">
          <span class="search-drop-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2.2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.2-1.9.9l-.3.7 5.7 3.3-3.2 3.2-2.3-.6c-.5-.1-1 .1-1.2.5l-.2.4 2.8 1.8 1.8 2.8c.3.5.8.6 1.2.5l.4-.2-.6-2.3 3.2-3.2 3.3 5.7.7-.3c.7-.3 1.1-1.1.9-1.9Z"/></svg>
            Flight Deals (${matchedFlights.length})
          </span>
          <span class="search-drop-count">Special Offers</span>
        </div>
        <div class="search-drop-list">
          ${matchedFlights.map(f => {
            const rawFlightFee = f.fee || f.price || f.fare || '₹0';
            const priceDisplay = typeof formatCurrencyPrice === 'function' ? formatCurrencyPrice(rawFlightFee) : rawFlightFee;
            const route = (f.fromCity || 'India') + ' → ' + (f.toCity || f.destination || 'Destination');
            
            return `
              <a href="flight-fares.html?q=${encodeURIComponent(f.toCity || f.destination || query)}" class="search-drop-item">
                <div class="search-item-left">
                  <div class="search-item-icon-badge" style="background:rgba(46,125,126,0.1); color:#2E7D7E;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.2-1.9.9l-.3.7 5.7 3.3-3.2 3.2-2.3-.6c-.5-.1-1 .1-1.2.5l-.2.4 2.8 1.8 1.8 2.8c.3.5.8.6 1.2.5l.4-.2-.6-2.3 3.2-3.2 3.3 5.7.7-.3c.7-.3 1.1-1.1.9-1.9Z"/></svg>
                  </div>
                  <div class="search-item-texts">
                    <span class="search-item-title">${highlightMatch(f.title || route, query)}</span>
                    <span class="search-item-subtitle">${escapeHTML(f.airline || 'Top Airlines')} &bull; ${escapeHTML(f.tripType || 'Round Trip / One Way')}</span>
                  </div>
                </div>
                <div class="search-item-right">
                  <span class="search-item-price">${priceDisplay}</span>
                  <span class="search-item-tag" style="background:#0D1B2A; color:#FFF;">View Fare</span>
                </div>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // C. Dummy Ticket Section (Always Relevant for Travel Searches)
  html += `
    <div class="search-drop-group">
      <div class="search-drop-header">
        <span class="search-drop-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2E7D7E" stroke-width="2.2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>
          Dummy Ticket / Flight Proof
        </span>
        <span class="search-drop-count">Embassy-Approved</span>
      </div>
      <div class="search-drop-list">
        <a href="dummy-ticket.html?dest=${encodeURIComponent(query)}" class="search-drop-item" style="border: 1px dashed rgba(46, 125, 126, 0.35); background: rgba(46, 125, 126, 0.03);">
          <div class="search-item-left">
            <div class="search-item-icon-badge" style="background:rgba(46,125,126,0.12); color:#2E7D7E;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div class="search-item-texts">
              <span class="search-item-title">Book Flight Proof for <strong>${highlightMatch(query, query)}</strong></span>
              <span class="search-item-subtitle">Live PNR on Airline Website &bull; Instant PDF for Visa Application</span>
            </div>
          </div>
          <div class="search-item-right">
            <span class="search-item-tag" style="background:linear-gradient(135deg, #0D1B2A, #2E7D7E); color:#FFF;">Instant PDF &rarr;</span>
          </div>
        </a>
      </div>
    </div>
  `;

  // D. Search Dropdown Footer
  html += `
    <div class="search-drop-footer">
      <a href="visas.html?q=${encodeURIComponent(query)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        See all visa matches for "<strong>${escapeHTML(query)}</strong>"
      </a>
      <a href="flight-fares.html?q=${encodeURIComponent(query)}">
        Browse Flight Deals &rarr;
      </a>
    </div>
  `;

  dropContent.innerHTML = html;
  dropdown.style.display = 'block';
}

function escapeHTML(str) {
  return (str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ===== UNIVERSAL SEARCH HANDLER (ON SUBMIT) =====
function handleUniversalSearch(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('hero-search-input');
  const query = (input ? input.value : '').trim();

  if (!query) {
    window.location.href = 'visas.html';
    return;
  }

  const qLower = query.toLowerCase();

  // Check for Dummy Ticket intent
  if (
    qLower.includes('dummy') ||
    qLower.includes('reservation') ||
    qLower.includes('embassy') ||
    qLower.includes('pnr') ||
    qLower.includes('proof')
  ) {
    window.location.href = 'dummy-ticket.html?dest=' + encodeURIComponent(query);
    return;
  }

  // Check for Flight Deals intent
  if (
    qLower.includes('flight') ||
    qLower.includes('fare') ||
    qLower.includes('airfare') ||
    qLower.includes('deal')
  ) {
    window.location.href = 'flight-fares.html?q=' + encodeURIComponent(query);
    return;
  }

  // Default: Open Visas catalog filtered with query
  window.location.href = 'visas.html?q=' + encodeURIComponent(query);
}

// Legacy alias for backwards compatibility
function handleHeroSearch(e) {
  handleUniversalSearch(e);
}
