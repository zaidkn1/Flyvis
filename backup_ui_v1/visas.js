// ===== VISAS BROWSE PAGE JS =====
// Cards now link to visa-detail.html?id=<id> — no modal

let currentFilter = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initMobileNav();
  await loadVisasFromDB(); // Fetch from Firebase

  // Check URL params for search & filters
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  const type = params.get('type');
  
  if (type) {
    currentFilter = type;
    document.querySelectorAll('.filter-chip').forEach(b => {
      const bf = b.getAttribute('data-filter');
      if (bf && (bf.toLowerCase() === type.toLowerCase() || (type.toLowerCase() === 'eta' && bf.toLowerCase() === 'eta'))) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }
  if (q) {
    const input = document.getElementById('browse-search-input');
    if (input) {
      input.value = q;
      searchQuery = q.toLowerCase();
    }
  }

  renderVisas();
  initSearchInput();
  initScrollAnimations();
});

function initNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });
}

function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
    });
  }
}

function initSearchInput() {
  const input = document.getElementById('browse-search-input');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = input.value.toLowerCase().trim();
      renderVisas();
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') filterVisas();
  });
}

function filterVisas() {
  const input = document.getElementById('browse-search-input');
  if (input) searchQuery = input.value.toLowerCase().trim();
  renderVisas();
}

function setFilter(btn, filter) {
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = filter;
  renderVisas();
}

function renderVisas() {
  const grid = document.getElementById('browse-grid');
  const countEl = document.getElementById('results-num');
  if (!grid) return;

  let visas = getActiveVisas();

  // Apply type filter
  if (currentFilter !== 'all') {
    visas = visas.filter(v => {
      const vt = (v.visaType || '').toLowerCase();
      const cf = currentFilter.toLowerCase();
      if (cf === 'eta') return vt.includes('eta');
      return vt.includes(cf);
    });
  }

  // Apply search filter
  if (searchQuery) {
    visas = visas.filter(v =>
      v.country.toLowerCase().includes(searchQuery) ||
      (v.visaType || '').toLowerCase().includes(searchQuery) ||
      (v.countryCode || '').toLowerCase().includes(searchQuery)
    );
  }

  if (countEl) countEl.textContent = visas.length;

  if (visas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon" style="font-size:48px;opacity:0.3;margin-bottom:16px;">—</div>
        <h3>No Results Found</h3>
        <p>Try a different search term or filter.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';
  visas.forEach((visa, index) => {
    const card = createVisaCard(visa, index);
    grid.appendChild(card);
  });

  initScrollAnimations();
}

function createVisaCard(visa, index = 0) {
  const wrapper = document.createElement('div');
  wrapper.className = 'animate-on-scroll';
  wrapper.style.transitionDelay = `${Math.min(index * 0.04, 0.4)}s`;

  let bgImage = visa.customPhoto || getCountryImage(visa.countryCode);
  if (bgImage && bgImage.includes('images.unsplash.com') && bgImage.includes('w=1600')) {
    bgImage = bgImage.replace('w=1600', 'w=600');
  }
  const flagUrl = getFlagUrl(visa.countryCode);
  const typeClass = getVisaTypeClass(visa.visaType);

  wrapper.innerHTML = `
    <a href="visa-detail.html?id=${visa.id}"
       class="visa-card-link"
       aria-label="View ${visa.country} visa details"
       id="visa-card-${visa.id}">
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

// Listen for real-time Firebase updates
window.addEventListener('visasUpdated', renderVisas);

function getVisaTypeClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('e-visa') || t.includes('evisa')) return 'visa-type-evisa';
  if (t.includes('sticker')) return 'visa-type-sticker';
  if (t.includes('arrival')) return 'visa-type-arrival';
  if (t.includes('eta')) return 'visa-type-eta';
  return 'visa-type-evisa';
}

function initScrollAnimations() {
  const elements = document.querySelectorAll('.animate-on-scroll:not(.visible)');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.05 });
  elements.forEach(el => observer.observe(el));
}
