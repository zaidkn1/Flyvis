/**
 * ============================================================================
 * FLYVIS SLIDE-OVER SAAS SIDEBAR ENGINE
 * Clean Professional UI with NO Emojis (SVG icons only)
 * ============================================================================
 */

function initFlyvisSidebar() {
  // 1. Create Backdrop Overlay
  let backdrop = document.getElementById("flyvis-sb-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "flyvis-sb-backdrop";
    backdrop.className = "flyvis-sb-backdrop";
    backdrop.onclick = closeFlyvisSidebar;
    document.body.appendChild(backdrop);
  }

  // 2. Create Sidebar Drawer
  let sidebarEl = document.getElementById("flyvis-app-sidebar");
  if (!sidebarEl) {
    sidebarEl = document.createElement("aside");
    sidebarEl.id = "flyvis-app-sidebar";
    sidebarEl.className = "flyvis-sidebar";
    document.body.appendChild(sidebarEl);
  }

  renderSidebarMarkup();
}

function renderSidebarMarkup() {
  const sidebarEl = document.getElementById("flyvis-app-sidebar");
  if (!sidebarEl) return;

  const user = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.currentUser) || null;
  const userName = user ? (user.displayName || "Traveler") : "Guest Explorer";
  const userEmail = user ? user.email : "Sign in with Google to sync";
  const userRole = user ? "Verified Member" : "Welcome to Flyvis";
  const userAvatar = user ? (user.photoURL || "assets/brand/flyvis-icon.png") : "assets/brand/flyvis-icon.png";
  const alertCount = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.activeAlerts) ? FlyvisAuthState.activeAlerts.length : 0;
  const visaCount = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.visaApplications) ? FlyvisAuthState.visaApplications.length : 0;
  const dummyCount = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.dummyTickets) ? FlyvisAuthState.dummyTickets.length : 0;
  
  let walletDocCount = 0;
  if (user) {
    try {
      const rawDocs = localStorage.getItem('flyvis_wallet_docs_' + user.uid);
      if (rawDocs) walletDocCount = JSON.parse(rawDocs).length;
    } catch (e) {}
  }

  const currentPath = window.location.pathname;

  sidebarEl.innerHTML = `
    <!-- Top Header: Brand Logo & Close Button -->
    <div class="sb-header">
      <a href="index.html" class="sb-brand-row">
        <img src="assets/brand/flyvis-icon.png" alt="Flyvis Logo" class="sb-brand-icon" />
        <span class="sb-brand-name">Flyv<span style="color:#2E7D7E;">i</span>s</span>
      </a>
      <button type="button" class="sb-close-btn" onclick="closeFlyvisSidebar()" aria-label="Close menu">&times;</button>
    </div>

    <!-- User Profile Card -->
    <div class="sb-user-card" onclick="handleUserAvatarClick()">
      <img src="${userAvatar}" alt="${userName}" class="sb-avatar-img" />
      <div class="sb-user-info">
        <span class="sb-user-role">${userRole}</span>
        <span class="sb-user-name">${userName}</span>
        <span style="font-size:11px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${userEmail}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
    </div>

    <!-- Scrollable Navigation Body -->
    <div class="sb-body">
      
      <!-- MEMBER PORTAL SECTION -->
      <div class="sb-section-label">${user ? 'MEMBER PORTAL' : 'SERVICES'}</div>
      <ul class="sb-nav-list">
        
        <!-- 1. My Flights (Direct Full Page Navigation) -->
        <li class="sb-nav-item">
          <a href="my-flights.html" class="sb-nav-link ${currentPath.includes('my-flights') ? 'active' : ''}">
            <span class="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
            </span>
            <span class="sb-nav-text">My Flights</span>
            ${alertCount > 0 ? `<span class="sb-badge">${alertCount} Tracked</span>` : ''}
          </a>
        </li>

        <!-- 2. My Wallet (Document Vault & Cards) -->
        <li class="sb-nav-item">
          <a href="my-wallet.html" class="sb-nav-link ${currentPath.includes('my-wallet') ? 'active' : ''}">
            <span class="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>
            <span class="sb-nav-text">My Wallet</span>
            ${walletDocCount > 0 ? `<span class="sb-badge">${walletDocCount} Docs</span>` : `<span class="sb-badge">Vault</span>`}
          </a>
        </li>

        <!-- 3. Flight Search & Fares -->
        <li class="sb-nav-item">
          <a href="flight-fares.html" class="sb-nav-link ${currentPath.includes('flight-fares') ? 'active' : ''}">
            <span class="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
            <span class="sb-nav-text">Flight Search &amp; Fares</span>
          </a>
        </li>

        <!-- 4. Visa Assistance Portal -->
        <li class="sb-nav-item">
          <a href="visas.html" class="sb-nav-link ${currentPath.includes('visas') ? 'active' : ''}">
            <span class="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </span>
            <span class="sb-nav-text">Visa Assistance</span>
            ${visaCount > 0 ? `<span class="sb-badge">${visaCount}</span>` : ''}
          </a>
        </li>

        <!-- 5. Dummy Ticket Generator -->
        <li class="sb-nav-item">
          <a href="dummy-ticket.html" class="sb-nav-link ${currentPath.includes('dummy-ticket') ? 'active' : ''}">
            <span class="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            <span class="sb-nav-text">Dummy Ticket</span>
            ${dummyCount > 0 ? `<span class="sb-badge">${dummyCount}</span>` : ''}
          </a>
        </li>

      </ul>

      <!-- QUICK EXPLORE SECTION -->
      <div class="sb-section-label">EXPLORE</div>
      <ul class="sb-nav-list">
        <li class="sb-nav-item">
          <a href="index.html" class="sb-nav-link ${currentPath.endsWith('index.html') || currentPath === '/' ? 'active' : ''}">
            <span class="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </span>
            <span class="sb-nav-text">Home &amp; Explore</span>
          </a>
        </li>
      </ul>

      <!-- SETTINGS & AUTH SECTION -->
      <div class="sb-section-label">ACCOUNT</div>
      <ul class="sb-nav-list">
        <li class="sb-nav-item">
          <a href="javascript:void(0)" onclick="closeFlyvisSidebar(); openUserProfileModal();" class="sb-nav-link">
            <span class="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <span class="sb-nav-text">My Profile</span>
          </a>
        </li>
        <li class="sb-nav-item">
          <a href="javascript:void(0)" onclick="closeFlyvisSidebar(); ${user ? 'signOutUser()' : 'signInWithGoogle()'}" class="sb-nav-link" style="color:${user ? '#E11D48' : '#2E7D7E'};">
            <span class="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            <span class="sb-nav-text">${user ? 'Sign Out' : 'Sign in with Google'}</span>
          </a>
        </li>
      </ul>

    </div>

    <div class="sb-footer">
      &#169; 2026 Flyvis Inc. • Flight, Visa, Sorted.
    </div>
  `;
}

function openFlyvisSidebar() {
  const sidebarEl = document.getElementById("flyvis-app-sidebar");
  const backdrop = document.getElementById("flyvis-sb-backdrop");
  if (sidebarEl) sidebarEl.classList.add("open");
  if (backdrop) backdrop.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeFlyvisSidebar() {
  const sidebarEl = document.getElementById("flyvis-app-sidebar");
  const backdrop = document.getElementById("flyvis-sb-backdrop");
  if (sidebarEl) sidebarEl.classList.remove("open");
  if (backdrop) backdrop.classList.remove("active");
  document.body.style.overflow = "";
}

function toggleFlyvisSidebar() {
  const sidebarEl = document.getElementById("flyvis-app-sidebar");
  if (sidebarEl && sidebarEl.classList.contains("open")) {
    closeFlyvisSidebar();
  } else {
    openFlyvisSidebar();
  }
}

function toggleSubMenu(itemId) {
  const item = document.getElementById(itemId);
  if (!item) return;
  item.classList.toggle("open");
}

function handleUserAvatarClick() {
  closeFlyvisSidebar();
  openUserProfileModal();
}

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeFlyvisSidebar();
  }
});

// Auto initialize and listen for Auth state updates
document.addEventListener("DOMContentLoaded", () => {
  initFlyvisSidebar();
  
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => {
      setTimeout(renderSidebarMarkup, 200);
    });
  }
});
