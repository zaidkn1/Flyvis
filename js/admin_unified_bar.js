// Universal Flyvis FareOS Sidebar & Persona Controller
// Standard across all admin pages for a seamless single-brand experience

function initUnifiedPersona() {
  const active = localStorage.getItem("fareos_active_admin");
  if (active) {
    try {
      const p = JSON.parse(active);
      const nameEl = document.getElementById("header-user-name");
      const roleEl = document.getElementById("header-user-role");
      const avEl = document.getElementById("header-user-avatar");
      if (nameEl) nameEl.textContent = p.name;
      if (roleEl) roleEl.textContent = p.role;
      if (avEl) avEl.textContent = p.initial || (p.name ? p.name.charAt(0) : "S");
    } catch (e) {}
  }
}

window.toggleUserMenu = function() {
  const menu = document.getElementById("admin-persona-dropdown");
  if (menu) {
    menu.style.display = (menu.style.display === "block") ? "none" : "block";
  }
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

window.logoutAdmin = function() {
  localStorage.removeItem("fareos_active_admin");
  localStorage.removeItem("flyvis_admin_auth");
  window.location.href = "admin-login.html";
};

window.handleLogout = window.logoutAdmin;

document.addEventListener("DOMContentLoaded", () => {
  initUnifiedPersona();
  
  // Close persona dropdown on outside click
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("admin-persona-dropdown");
    if (menu && menu.style.display === "block") {
      if (!e.target.closest("#admin-persona-dropdown") && !e.target.closest("[onclick*='toggleUserMenu']") && !e.target.closest("#header-user-avatar")) {
        menu.style.display = "none";
      }
    }
  });

  // Global shortcut ⌘K / Ctrl+K to jump to sidebar search
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      const searchInput = document.getElementById("sidebar-menu-search");
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
  });
});
