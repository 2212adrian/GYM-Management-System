/**
 * WOLF OS - UI LOADER (main.html) & NAVIGATION ENGINE
 * Handles AJAX page swapping, component injection, and UI state synchronization.
 */

// 1. SMART RETRY LOGIC (Global so the button can see it)
window.wolfRetry = async function () {
  const btn = document.querySelector('.retry-btn');
  const statusIcon = btn?.querySelector('i');
  const statusText = btn?.querySelector('span');

  if (btn) {
    btn.disabled = true;
    if (statusIcon) statusIcon.className = 'bx bx-loader-alt bx-spin';
    if (statusText) statusText.innerText = 'RE-ESTABLISHING LINK...';
  }

  try {
    // Attempt to fetch a tiny asset to verify real internet
    const check = await fetch('/favicon.ico', {
      mode: 'no-cors',
      cache: 'no-store',
    });

    // If we reach here, connection is back.
    // Restore current in-app route without hard reload.
    const activePage =
      window.WOLF_LAST_REQUESTED_PAGE ||
      window.WOLF_CURRENT_PAGE ||
      new URLSearchParams(window.location.search).get('p') ||
      'dashboard';

    if (typeof navigateTo === 'function') {
      await navigateTo(activePage, { updateRoute: false });
      return;
    }

    if (
      window.wolfRouter &&
      typeof window.wolfRouter.refreshCurrent === 'function'
    ) {
      await window.wolfRouter.refreshCurrent({ replace: true });
      return;
    }

    window.location.reload();
  } catch (err) {
    // Still no signal
    console.warn('Wolf OS: Link attempt failed. Signal still dead.');

    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        if (statusIcon) statusIcon.className = 'bx bx-refresh';
        if (statusText) statusText.innerText = 'RETRY CONNECTION';
      }
    }, 1500); // Give it a slight delay for better UX
  }
};

// --- 0. DOM PURIFY SETUP ---
// Create a global purifier function for consistent use

const WOLF_PURIFIER = (dirty) =>
  DOMPurify.sanitize(String(dirty ?? ''), {
    KEEP_CONTENT: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });

window.WOLF_PURIFIER = WOLF_PURIFIER;

function safeSetHTML(target, html) {
  if (!target) return;
  target.innerHTML = String(html ?? '');
}

function safeInsertHTML(target, position, html) {
  if (!target) return;
  target.insertAdjacentHTML(position, String(html ?? ''));
}

const getSkeletonUI = () => `
  <div class="skeleton-wrapper">
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text" style="width: 80%"></div>
    <div class="skeleton skeleton-box" style="margin-top: 20px;"></div>
    <div class="skeleton skeleton-box"></div>
  </div>
`;

// --- 1. THEME MANAGER (Place this at the very top) ---
const themeManager = {
  init() {
    const savedTheme = localStorage.getItem('wolf-theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    }
  },
  toggle() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('wolf-theme', isLight ? 'light' : 'dark');

    // Find all theme toggle icons
    const icons = document.querySelectorAll('#themeToggleBtn i, .theme-icon');
    icons.forEach((icon) => {
      // Switch between moon and sun
      if (isLight) {
        icon.classList.replace('bx-moon', 'bx-sun');
      } else {
        icon.classList.replace('bx-sun', 'bx-moon');
      }
    });
  },
};

// Initialize theme immediately to prevent "white flash"
themeManager.init();

let wolfMainRouter = null;
let wolfMainRouterSyncing = false;
let wolfLogoutInProgress = false;
let wolfNavInFlight = false;
let wolfNavCooldownUntil = 0;
const WOLF_MAIN_PAGE_ALIASES = Object.freeze({
  audit: 'audit-log',
});

function normalizeMainPage(pageName) {
  const raw = String(pageName || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'dashboard';
  return WOLF_MAIN_PAGE_ALIASES[raw] || raw;
}

function getWolfAccessContext() {
  const context = window.WOLF_ACCESS_CONTEXT || {};
  const role = String(context.role || window.WOLF_USER_ROLE || '')
    .trim()
    .toLowerCase();
  const email = String(context.email || window.WOLF_USER_EMAIL || '')
    .trim()
    .toLowerCase();
  const isAdmin =
    role === 'admin' ||
    email === 'adrianangeles2212@gmail.com' ||
    email === 'ktorrazo123@gmail.com';
  const isStaff = role === 'staff' || email === 'adrianangeles2213@gmail.com';
  return { role, email, isAdmin, isStaff };
}

function canAccessMainPage(pageName) {
  const normalizedPage = normalizeMainPage(pageName);
  const access = getWolfAccessContext();
  const adminOnlyPages = new Set(['audit-log', 'goal-center']);
  if (adminOnlyPages.has(normalizedPage) && !access.isAdmin) return false;
  return true;
}

function applyRoleBasedVisibility(scope = document) {
  const access = getWolfAccessContext();
  const hideForStaff = ['audit-log', 'goal-center'];

  hideForStaff.forEach((page) => {
    scope.querySelectorAll(`[data-page="${page}"]`).forEach((el) => {
      el.style.display = access.isAdmin ? '' : 'none';
    });
  });
}

function syncTopbarSettingsMenu() {
  const access = getWolfAccessContext();
  const menu = document.getElementById('topbarSettingsMenu');
  if (!menu) return;
  menu.querySelectorAll('[data-settings-menu-tab]').forEach((item) => {
    const tab = String(item.getAttribute('data-settings-menu-tab') || '')
      .trim()
      .toLowerCase();
    if (tab === 'users') {
      item.style.display = access.isAdmin ? '' : 'none';
      return;
    }
    item.style.display = '';
  });
}

function positionTopbarSettingsMenu() {
  const menu = document.getElementById('topbarSettingsMenu');
  const profileBtn = document.getElementById('topbarProfileBtn');
  if (!menu || !profileBtn) return;
  if (window.innerWidth < 768) return;

  const rect = profileBtn.getBoundingClientRect();
  const menuWidth = Math.max(menu.offsetWidth || 210, 210);
  const viewportPad = 12;
  const centeredLeft = rect.left + rect.width / 2 - menuWidth / 2;
  const maxLeft = window.innerWidth - menuWidth - viewportPad;
  const clampedLeft = Math.max(viewportPad, Math.min(centeredLeft, maxLeft));
  const top = rect.bottom + 10;

  menu.style.left = `${Math.round(clampedLeft)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function closeTopbarSettingsMenu() {
  const menu = document.getElementById('topbarSettingsMenu');
  if (!menu) return;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
}

function toggleTopbarSettingsMenu() {
  const menu = document.getElementById('topbarSettingsMenu');
  if (!menu) return;
  syncTopbarSettingsMenu();
  const willOpen = !menu.classList.contains('is-open');
  if (willOpen) {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    positionTopbarSettingsMenu();
  } else {
    closeTopbarSettingsMenu();
  }
}

function openSettingsTab(tabName = 'personalize') {
  const normalized = String(tabName || 'personalize')
    .trim()
    .toLowerCase();
  try {
    localStorage.setItem('wolf_settings_open_tab', normalized);
  } catch (_) {
    // ignore storage failures
  }

  if (
    typeof window.SettingsManager !== 'undefined' &&
    typeof window.SettingsManager.setActiveTab === 'function' &&
    document.querySelector('.settings-wrapper')
  ) {
    window.SettingsManager.setActiveTab(normalized);
    return;
  }

  navigateTo('settings');
}

async function hydrateSidebarAuthIdentity() {
  const sidebarName = document.querySelector('#wolfSidebar .user-name');
  const sidebarEmail = document.querySelector('#wolfSidebar .user-email');
  const topbarName = document.getElementById('topbar-settings-user-name');
  const topbarEmail = document.getElementById('topbar-settings-user-email');
  if (!sidebarName && !sidebarEmail && !topbarName && !topbarEmail) return;

  const context = window.WOLF_ACCESS_CONTEXT || {};
  let email = String(context.email || window.WOLF_USER_EMAIL || '')
    .trim()
    .toLowerCase();
  let displayName = String(
    context.displayName || context.full_name || context.name || '',
  ).trim();

  try {
    if (!email || !displayName) {
      if (
        window.supabaseReady &&
        typeof window.supabaseReady.then === 'function'
      ) {
        await window.supabaseReady;
      }
      if (window.supabaseClient?.auth?.getUser) {
        const { data } = await window.supabaseClient.auth.getUser();
        const user = data?.user || null;
        if (user?.email) email = String(user.email).trim().toLowerCase();
        if (!displayName) {
          displayName = String(
            user?.user_metadata?.display_name ||
              user?.user_metadata?.full_name ||
              '',
          ).trim();
        }
      }
    }
  } catch (_) {
    // ignore identity fetch errors
  }

  if (!displayName) {
    displayName = email ? email.split('@')[0] : 'Wolf User';
  }

  if (sidebarName) sidebarName.textContent = String(displayName).toUpperCase();
  if (sidebarEmail && email) sidebarEmail.textContent = email;
  if (topbarName) topbarName.textContent = String(displayName).toUpperCase();
  if (topbarEmail) topbarEmail.textContent = email || 'N/A';
}

function getUnauthorizedUI(pageName) {
  const target = String(pageName || 'module').toUpperCase();
  return `
    <div class="wolf-page-intro" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:62vh; text-align:center; color:var(--text-main); padding: 24px;">
      <i class='bx bx-shield-quarter' style="font-size:74px; color:var(--wolf-red); margin-bottom:16px;"></i>
      <h1 style="font-size:30px; font-weight:900; letter-spacing:0.5px; margin:0;">ACCESS DENIED</h1>
      <p style="margin:10px 0 0 0; color:var(--text-muted); font-size:13px; letter-spacing:0.8px; text-transform:uppercase;">
        You do not have permission to enter ${target}.
      </p>
      <p style="margin:8px 0 22px 0; color:var(--text-muted); font-size:12px;">
        User is unauthorized for this module.
      </p>
      <button
        type="button"
        onclick="navigateTo('hub')"
        style="background:var(--wolf-red); color:var(--text-on-accent); border:none; padding:10px 18px; border-radius:10px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; cursor:pointer;"
      >
        Return to Hub
      </button>
    </div>
  `;
}

function getInitialMainPage() {
  const hash = String(window.location.hash || '');
  const hashPage = hash.startsWith('#/') ? hash.slice(2).trim() : '';
  const queryPage = new URLSearchParams(window.location.search).get('p');
  return normalizeMainPage(hashPage || queryPage || 'dashboard');
}

function initMainRouter() {
  if (typeof Navigo === 'undefined' || wolfMainRouter) return;

  wolfMainRouter = new Navigo('/', { hash: true });

  wolfMainRouter.on('/:page', (match) => {
    if (wolfMainRouterSyncing) return;
    const page = normalizeMainPage(
      String(match?.data?.page || '').trim() || 'dashboard',
    );
    navigateTo(page, { updateRoute: false });
  });

  wolfMainRouter.notFound(() => {
    if (wolfMainRouterSyncing) return;
    navigateTo('dashboard', { updateRoute: false });
  });
}

async function playLogoutOutro() {
  if (wolfLogoutInProgress) return;

  wolfLogoutInProgress = true;
  document.body.classList.remove('logout-outro-final');
  document.body.classList.add('logout-outro-active');

  const overlay = document.getElementById('logout-overlay');
  if (overlay) overlay.setAttribute('aria-hidden', 'false');

  if (window.wolfAudio) {
    window.wolfAudio.play('woosh');
    setTimeout(() => {
      window.wolfAudio.play('logoff');
    }, 180);
  }

  await new Promise((resolve) => setTimeout(resolve, 1550));
  document.body.classList.add('logout-outro-final');
  await new Promise((resolve) => setTimeout(resolve, 950));
}

function rollbackLogoutOutro() {
  document.body.classList.remove('logout-outro-final');
  document.body.classList.remove('logout-outro-active');
  const overlay = document.getElementById('logout-overlay');
  if (overlay) overlay.setAttribute('aria-hidden', 'true');
  wolfLogoutInProgress = false;
}

// --- GLOBAL LOGOUT HANDLER (SweetAlert confirm) ---
window.handleLogout = async function () {
  const swal = window.Swal;
  const db = window.supabaseClient;

  const confirmLogout = async () => {
    if (wolfLogoutInProgress) return;

    try {
      await playLogoutOutro();

      if (db?.auth?.signOut) {
        await db.auth.signOut();
      } else {
        // Fallback if client is missing for any reason
        sessionStorage.clear();
      }

      if (
        window.wolfRouter &&
        typeof window.wolfRouter.goToLogin === 'function'
      ) {
        await window.wolfRouter.goToLogin({ replace: true, seamless: true });
      } else {
        window.location.replace('/index.html');
      }
    } catch (err) {
      rollbackLogoutOutro();

      if (swal) {
        swal.fire({
          title: 'LOGOUT FAILED',
          html: `<div style="color:var(--wolf-red); font-size:3rem; margin-bottom:12px;"><i class='bx bx-error-alt'></i></div>
                 <p style="color:#888; font-size:13px;">${err.message || 'Unknown error'}</p>`,
          background: '#111',
          buttonsStyling: false,
          customClass: {
            popup: 'wolf-swal-popup wolf-border-red',
            title: 'wolf-swal-title',
            confirmButton: 'btn-wolf-red',
          },
          confirmButtonText: 'OK',
        });
      } else {
        alert(`Logout failed: ${err.message || 'Unknown error'}`);
      }
    }
  };

  if (swal) {
    const res = await swal.fire({
      title: 'TERMINATE SESSION?',
      html: `<div style="color:#ff4d4d; font-size:3rem; margin-bottom:12px;"><i class='bx bx-power-off'></i></div>
             <p style="color:#888; font-size:13px;">You will be logged out of Wolf OS.</p>`,
      showCancelButton: true,
      confirmButtonText: 'LOGOUT',
      cancelButtonText: 'CANCEL',
      reverseButtons: true,
      background: '#111',
      buttonsStyling: false,
      customClass: {
        popup: 'wolf-swal-popup wolf-border-red',
        title: 'wolf-swal-title',
        confirmButton: 'btn-wolf-red',
        cancelButton: 'btn-wolf-secondary',
      },
    });

    if (res.isConfirmed) await confirmLogout();
  } else {
    if (confirm('Log out of Wolf OS?')) await confirmLogout();
  }
};

// --- 1. CORE UTILS ---
async function loadComponent(targetId, url) {
  const container = document.getElementById(targetId);
  if (!container) return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load component');
    const html = await res.text();

    safeInsertHTML(container, 'beforeend', html);

    // After injecting, move any <style> tags to <head>
    const styles = container.querySelectorAll('style');
    styles.forEach((styleEl) => {
      document.head.appendChild(styleEl); // moves it from container to head
    });
  } catch (err) {
    console.error('loadComponent error:', err);
  }
}

// --- 2. AJAX PAGE LOADER ---

function updateNavHighlights(pageName) {
  // Select both Sidebar and Nav bar items
  const navItems = document.querySelectorAll('[data-page]');

  navItems.forEach((el) => {
    const isTarget = el.getAttribute('data-page') === pageName;
    const icon = el.querySelector('i');

    if (isTarget) {
      el.classList.add('active');
      // SWAP TO SOLID (bxs)
      if (icon) {
        if (icon.classList.contains('bx-target')) {
          icon.className = 'bxf bx-target';
        } else {
          icon.className = icon.className.replace(
            /\bbx-([a-z0-9-]+)\b/g,
            'bxs-$1',
          );
        }
      }
    } else {
      el.classList.remove('active');
      // REVERT TO OUTLINE (bx)
      if (icon) {
        if (
          icon.classList.contains('bx-target') ||
          icon.classList.contains('bxf')
        ) {
          icon.className = 'bx bx-target';
        } else {
          icon.className = icon.className.replace(
            /\bbxs-([a-z0-9-]+)\b/g,
            'bx-$1',
          );
        }
      }
    }
  });

  syncDropdownActiveLabels();
}

function syncDropdownActiveLabels() {
  document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
    const activeSub = dropdown.querySelector('.sub-item.active');
    if (activeSub) dropdown.classList.add('active-only');
    else dropdown.classList.remove('active-only');
  });
}

// --- 1. SETUP PAGE NAVIGATION ---
document.querySelectorAll('[data-page]').forEach((button) => {
  button.onclick = (e) => {
    e.preventDefault();
    const page = button.getAttribute('data-page');
    if (page) navigateTo(page); // This handles the fetch and calling updateNavHighlights
  };
});

// --- 2. SETUP DARK MODE ---
const themeBtn = document.getElementById('themeToggleBtn');
if (themeBtn) {
  themeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Stops it from interfering with page navigation

    // Bonus: Swap the icon between moon and sun
    const themeIcon = themeBtn.querySelector('i');
    if (themeIcon) {
      themeIcon.classList.toggle('bx-moon');
      themeIcon.classList.toggle('bx-sun');
    }
  };
}

function wolfRefreshView() {
  const title = document.getElementById('ledger-title')?.innerText || '';
  const searchInp = document.getElementById('ledger-main-search');
  const term = searchInp ? searchInp.value.trim() : '';
  if (title.includes('LOGBOOK')) {
    if (window.wolfData && typeof window.wolfData.loadLogbook === 'function') {
      // Force a re-fetch/re-render with the empty term
      window.wolfData.loadLogbook();
    }
  } else {
    if (window.wolfData && typeof window.wolfData.loadSales === 'function') {
      // Force loadSales which now grabs the empty term from the DOM
      window.wolfData.loadSales();
    }
  }

  // If we are in Logbook mode
  if (title.includes('LOGBOOK')) {
    if (window.wolfData && typeof window.wolfData.loadLogs === 'function') {
      window.wolfData.loadLogs();
    }
  }
  // Default to Sales/Ledger mode
  else {
    if (window.wolfData && typeof window.wolfData.loadSales === 'function') {
      window.wolfData.loadSales();
    }
  }
}

/**
 * WOLF OS - NAVIGATION ENGINE (NETLIFY & OFFLINE OPTIMIZED)
 */
async function closeAllActiveModals() {
  const forceHideModalElement = (modal) => {
    if (!modal) return;

    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.classList.remove('is-open', 'is-closing', 'closing');

    const container = modal.querySelector('.master-terminal-container');
    if (container) {
      container.classList.remove('modal-open', 'modal-closing');
    }
  };

  const forceHideModal = (id) => {
    const modal = document.getElementById(id);
    forceHideModalElement(modal);
  };

  try {
    if (typeof closeProductModal === 'function' && window.isProductModalOpen) {
      closeProductModal();
    }
  } catch (err) {
    console.warn('Wolf OS: Product modal close handler failed.', err);
  }
  forceHideModal('product-modal-overlay');
  window.isProductModalOpen = false;

  try {
    if (
      window.salesManager &&
      typeof window.salesManager.closeSaleTerminal === 'function'
    ) {
      window.salesManager.closeSaleTerminal();
    }
  } catch (err) {
    console.warn('Wolf OS: Sales terminal close handler failed.', err);
  }
  forceHideModal('sale-terminal-overlay');

  try {
    if (
      window.logbookManager &&
      typeof window.logbookManager.closeLogbookTerminal === 'function'
    ) {
      window.logbookManager.closeLogbookTerminal();
    }
  } catch (err) {
    console.warn('Wolf OS: Logbook terminal close handler failed.', err);
  }
  forceHideModal('logbook-modal-overlay');

  try {
    if (
      window.salesManager &&
      typeof window.salesManager.closeTrash === 'function'
    ) {
      window.salesManager.closeTrash();
    }
  } catch (err) {
    console.warn('Wolf OS: Trash modal close handler failed.', err);
  }
  forceHideModal('sales-trash-overlay');

  try {
    if (
      window.wolfScanner &&
      typeof window.wolfScanner.stop === 'function' &&
      document.getElementById('wolf-scanner-overlay')
    ) {
      await window.wolfScanner.stop({ skipOnClose: true });
    }
  } catch (err) {
    console.warn('Wolf OS: Scanner close handler failed.', err);
  }
  forceHideModal('wolf-scanner-overlay');
  forceHideModal('scanResultModal');

  document
    .querySelectorAll(
      '.master-modal-overlay, .wolf-modal-overlay, .modal-overlay',
    )
    .forEach((modal) => forceHideModalElement(modal));
}

async function navigateTo(pageName, options = {}) {
  const nowMs = Date.now();
  if (wolfNavInFlight) return;
  if (nowMs < wolfNavCooldownUntil) return;

  wolfNavInFlight = true;
  document.body.classList.add('wolf-nav-lock');

  const mainContent = document.getElementById('main-content');
  const brandEl = document.getElementById('topbar-brand');
  if (!mainContent) {
    wolfNavInFlight = false;
    wolfNavCooldownUntil = Date.now() + 220;
    document.body.classList.remove('wolf-nav-lock');
    return;
  }
  const { updateRoute = true } = options;
  pageName = normalizeMainPage(pageName);

  if (!canAccessMainPage(pageName)) {
    const deniedUI = getUnauthorizedUI(pageName);
    safeSetHTML(mainContent, deniedUI);
    mainContent.style.opacity = '1';
    updateNavHighlights('');
    window.WOLF_CURRENT_PAGE = 'unauthorized';
    window.WOLF_LAST_REQUESTED_PAGE = pageName;

    if (brandEl) {
      safeSetHTML(
        brandEl,
        `
        <div class="breadcrumb-container" style="display: flex; align-items: center; gap: 8px;">
          <span style="opacity:0.5;">SYSTEM</span>
          <i class='bx bx-chevron-right' style="color: var(--wolf-red); font-size:1.2rem; font-weight:bold;"></i>
          <span style="letter-spacing: 1px; font-weight: 800; color: var(--wolf-red);">UNAUTHORIZED</span>
        </div>
      `,
      );
    }
    wolfNavInFlight = false;
    wolfNavCooldownUntil = Date.now() + 280;
    document.body.classList.remove('wolf-nav-lock');
    return;
  }

  window.WOLF_LAST_REQUESTED_PAGE = pageName;

  await closeAllActiveModals();

  const navigationMap = {
    dashboard: {
      label: 'DASHBOARD',
      parent: 'MAIN',
      parentRoute: 'hub',
      section: 'main',
    },
    home: { label: 'WOLF <span>PALOMAR</span> GYM', parent: null },
    hub: { label: 'COMMAND CENTER', parent: 'WOLF OS', section: 'main' },
    // Admin Category
    members: {
      label: 'MEMBERS',
      parent: 'MANAGEMENT',
      parentRoute: 'hub',
      section: 'admin',
    },
    products: {
      label: 'PRODUCTS',
      parent: 'MANAGEMENT',
      parentRoute: 'hub',
      section: 'admin',
    },
    'management/products': {
      label: 'PRODUCTS',
      parent: 'MANAGEMENT',
      parentRoute: 'hub',
      section: 'admin',
    },
    equipments: {
      label: 'EQUIPMENTS',
      parent: 'MANAGEMENT',
      parentRoute: 'hub',
      section: 'admin',
    },
    // Ledger Category
    sales: {
      label: 'SALES',
      parent: 'LEDGER',
      parentRoute: 'hub',
      section: 'main',
    },
    logbook: {
      label: 'LOGBOOK',
      parent: 'LEDGER',
      parentRoute: 'hub',
      section: 'main',
    },
    // System Category
    settings: {
      label: 'SETTINGS',
      parent: 'SYSTEM',
      parentRoute: 'hub',
      section: 'system',
    },
    'id-maker': {
      label: 'ID MAKER',
      parent: 'SYSTEM TOOLS',
      parentRoute: 'hub',
      section: 'system',
    },
    'goal-center': {
      label: 'GOAL CENTER',
      parent: 'SYSTEM TOOLS',
      parentRoute: 'hub',
      section: 'system',
    },
    feedback: {
      label: 'FEEDBACK',
      parent: 'SYSTEM TOOLS',
      parentRoute: 'hub',
      section: 'system',
    },
    'audit-log': {
      label: 'AUDIT LOG',
      parent: 'SYSTEM',
      parentRoute: 'hub',
      section: 'system',
    },
  };

  // --- SKELETON UI ---
  const skeletonUI = `
    <div class="wolf-skeleton">
      <style>
        .wolf-skeleton { padding: 40px; max-width: 1200px; margin: 0 auto; opacity: 0; animation: fadeInSkel 0.3s forwards; }
        .skel-shimmer {
          background: linear-gradient(90deg, var(--skeleton-base, #242a32) 25%, var(--skeleton-mid, #313844) 50%, var(--skeleton-base, #242a32) 75%);
          background-size: 200% 100%;
          animation: skel-loading 1.5s infinite linear;
          border-radius: 8px;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        }
        @keyframes skel-loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fadeInSkel { from { opacity: 0; } to { opacity: 1; } }
        .skel-title { width: 150px; height: 35px; margin-bottom: 40px; }
        .skel-income-card { width: 100%; height: 180px; border-radius: 20px; margin-bottom: 30px; }
        .skel-nav-bar { width: 100%; height: 50px; margin-bottom: 20px; display: flex; gap: 10px; }
        .skel-entry { width: 100%; height: 80px; margin-bottom: 15px; border-radius: 15px; }
      </style>
      <div class="skel-shimmer skel-title"></div>
      <div class="skel-shimmer skel-income-card"></div>
      <div class="skel-nav-bar"><div class="skel-shimmer" style="flex:1"></div><div class="skel-shimmer" style="flex:3"></div><div class="skel-shimmer" style="flex:1"></div></div>
      <div class="skel-shimmer skel-entry"></div><div class="skel-shimmer skel-entry"></div><div class="skel-shimmer skel-entry"></div><div class="skel-shimmer skel-entry"></div>
    </div>
  `;

  // --- OFFLINE UI ---
  const offlineUI = `
    <div class="wolf-page-intro" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:70vh; text-align:center; color:var(--text-main);">
      <i class='bx bx-wifi-off' style="font-size:80px; color:var(--wolf-red); margin-bottom:20px;"></i>
      <h1 style="font-size:32px; font-weight:900; margin:0; letter-spacing:-1px;">SIGNAL LOST</h1>
      <p style="color:var(--text-muted); max-width:400px; margin:15px 0 30px 0; line-height:1.6;">The encrypted uplink to Wolf OS was severed.</p>
      <button class="retry-btn" onclick="window.wolfRetry()" style="background:var(--wolf-red); color:var(--text-on-accent); border:none; padding:12px 30px; font-weight:bold; border-radius:8px; cursor:pointer; text-transform:uppercase; display:flex; align-items:center; gap:10px;">
        <i class='bx bx-refresh' style="font-size:20px;"></i>
        <span>RETRY CONNECTION</span>
      </button>
    </div>
  `;

  // 1. Immediate Network Guard
  if (!navigator.onLine) {
    safeSetHTML(mainContent, offlineUI);
    mainContent.style.opacity = '1';
    wolfNavInFlight = false;
    wolfNavCooldownUntil = Date.now() + 220;
    document.body.classList.remove('wolf-nav-lock');
    return;
  }

  // 2. Show Skeleton immediately
  safeSetHTML(mainContent, skeletonUI);
  mainContent.style.opacity = '1';

  // 3. Forced Delay for smooth perception
  const delay = new Promise((resolve) => setTimeout(resolve, 600));

  try {
    let path;
    let isLedger = false;
    // 4. ROUTING LOGIC
    if (pageName === 'sales' || pageName === 'logbook') {
      path = '/assets/views/daily-ledger.html';
      isLedger = true;
    } else if (pageName === 'members') {
      path = '/pages/management/members.html';
    } else if (pageName === 'management/products' || pageName === 'products') {
      path = '/pages/management/products.html';
    } else if (pageName === 'audit-log') {
      path = '/pages/audit.html';
    } else {
      path = `/pages/${pageName}.html`;
    }

    const fetchPromise = fetch(path);
    const [res] = await Promise.all([fetchPromise, delay]);

    if (!res.ok) throw new Error('404');

    const html = await res.text();

    // 5. Start swapping process: Fade out the skeleton
    mainContent.style.opacity = '0';

    await new Promise((resolveSwap) => {
      setTimeout(() => {
        // 6. Wrap incoming HTML in the intro animation class
        safeSetHTML(mainContent, `<div class="wolf-page-intro">${html}</div>`);
        applyRoleBasedVisibility(document);

        if (brandEl) {
          const isMobile = window.innerWidth <= 1024;
          const info = navigationMap[pageName];

          if (!info || pageName === 'home') {
            // Reset to Logo for Home
            safeSetHTML(brandEl, 'WOLF <span>PALOMAR</span> GYM');
            brandEl.style.fontSize = ''; // Reset size
          } else {
            // 1. Determine sizes
            const baseFontSize = isMobile ? '0.85rem' : '1rem';
            const parentOpacity = '0.5';

            // 2. Clickable Parent Logic
            const isAlreadyOnParent = pageName === info.parentRoute;
            const parentHTML = isAlreadyOnParent
              ? `<span style="opacity: ${parentOpacity};">${info.parent}</span>`
              : `<span class="breadcrumb-link" 
               onclick="window.pendingHubSection='${info.section}'; navigateTo('hub')" 
               style="cursor:pointer; opacity: ${parentOpacity}; transition: opacity 0.2s;">
            ${info.parent}
          </span>`;

            // 3. Set the HTML with the Blue Arrow
            brandEl.style.fontSize = baseFontSize;
            brandEl.style.display = 'flex';
            brandEl.style.alignItems = 'center';
            brandEl.style.justifyContent = 'center'; // Keeps it centered in the top bar

            safeSetHTML(
              brandEl,
              `
          <div class="breadcrumb-container" style="display: flex; align-items: center; gap: ${isMobile ? '5px' : '8px'};">
            ${parentHTML}
            <i class='bx bx-chevron-right' style="color: var(--wolf-red); font-size: ${isMobile ? '1.1rem' : '1.3rem'}; font-weight: bold;"></i>
            <span style="letter-spacing: 1px; font-weight: 800; color: var(--breadcrumb-current-color, var(--text-main));">${info.label}</span>
          </div>
        `,
            );
          }
        }

        // 7. INITIALIZE PAGE MANAGERS
        if (isLedger && window.wolfData) {
          wolfData.activeMode = pageName;
          wolfData.initLedger(pageName);
        } else if (
          pageName === 'dashboard' &&
          typeof window.DashboardManager !== 'undefined'
        ) {
          window.DashboardManager.init();
        } else if (
          pageName === 'members' &&
          typeof MemberManager !== 'undefined'
        ) {
          MemberManager.init();
        } else if (
          (pageName === 'management/products' || pageName === 'products') &&
          typeof ProductManager !== 'undefined'
        ) {
          ProductManager.init();
        } else if (
          pageName === 'equipments' &&
          typeof window.EquipmentManager !== 'undefined'
        ) {
          window.EquipmentManager.init();
        } else if (
          pageName === 'feedback' &&
          typeof window.FeedbackManager !== 'undefined'
        ) {
          window.FeedbackManager.init();
        } else if (
          pageName === 'id-maker' &&
          typeof window.IdMakerManager !== 'undefined'
        ) {
          window.IdMakerManager.init();
        } else if (
          pageName === 'audit-log' &&
          typeof window.AuditManager !== 'undefined'
        ) {
          window.AuditManager.init();
        } else if (
          pageName === 'settings' &&
          typeof window.SettingsManager !== 'undefined'
        ) {
          window.SettingsManager.init();
        } else if (
          pageName === 'goal-center' &&
          typeof window.GoalCenterManager !== 'undefined'
        ) {
          window.GoalCenterManager.init();
        }

        // 8. Reveal content
        mainContent.style.opacity = '1';
        updateNavHighlights(pageName);

        window.WOLF_CURRENT_PAGE = pageName;
        window.WOLF_LAST_REQUESTED_PAGE = pageName;

        if (updateRoute && pageName) {
          if (wolfMainRouter) {
            const nextRoute = `/${pageName}`;
            const currentRoute =
              String(window.location.hash || '').replace('#', '') || '/';

            if (currentRoute !== nextRoute) {
              wolfMainRouterSyncing = true;
              wolfMainRouter.navigate(nextRoute);
              setTimeout(() => {
                wolfMainRouterSyncing = false;
              }, 0);
            }
          } else {
            window.history.pushState({ page: pageName }, '', `?p=${pageName}`);
          }
        }

        if (window.applyVersioning) window.applyVersioning();
        resolveSwap();
      }, 200);
    });
  } catch (err) {
    console.warn(`Wolf OS: Navigation Error ->`, err);

    if (!navigator.onLine || err instanceof TypeError) {
      safeSetHTML(mainContent, offlineUI);
      mainContent.style.opacity = '1';
      wolfNavInFlight = false;
      wolfNavCooldownUntil = Date.now() + 260;
      document.body.classList.remove('wolf-nav-lock');
      return;
    }

    try {
      const errRes = await fetch('/404.html');
      const fullHtml = await errRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(fullHtml, 'text/html');

      // Add intro animation to 404 page too
      safeSetHTML(
        mainContent,
        `<div class="wolf-page-intro">
        ${doc.querySelector('style')?.outerHTML || ''}
        ${doc.body.innerHTML}
      </div>`,
      );

      mainContent.style.opacity = '1';
      const pathEl = document.getElementById('display-path');
      if (pathEl) pathEl.innerText = pageName;

      document
        .querySelectorAll('[data-page]')
        .forEach((el) => el.classList.remove('active'));
    } catch (fatal) {
      if (brandEl) safeSetHTML(brandEl, 'WOLF <span>PALOMAR</span> GYM');
      safeSetHTML(mainContent, offlineUI);
      mainContent.style.opacity = '1';
    }
  } finally {
    wolfNavInFlight = false;
    wolfNavCooldownUntil = Date.now() + 260;
    document.body.classList.remove('wolf-nav-lock');
  }
}

// --- 4. MAIN UI INITIALIZATION ---

async function loadHTML(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`[ERR_503] Failed to fetch: ${path}`);
  return await res.text();
}
/**
 * FIXED WOLF OS - UI INITIALIZATION
 */
async function initUI() {
  // 1. Setup Theme and DOM References
  themeManager.init();
  initMainRouter();

  const loadingScreen = document.getElementById('loading-screen');
  const loadingOverlay = document.getElementById('loading-overlay');
  const layout = document.getElementById('wolf-layout');
  const starsContainer = document.getElementById('stars-container');
  const statusText = document.querySelector('.boot-status');
  const progressBar = document.querySelector('.progress-bar-fill');

  /**
   * Helper: Loads the Shell Components (Topbar, Sidebar, Nav)
   */
  const finalizeSystemBoot = async () => {
    try {
      const [topbar, sidebar, nav] = await Promise.all([
        loadHTML('/assets/components/topbar.html'),
        loadHTML('/assets/components/sidebar.html'),
        loadHTML('/assets/components/floating-nav.html'),
      ]);

      safeSetHTML(document.getElementById('topbar-container'), topbar);
      safeSetHTML(document.getElementById('sidebar-container'), sidebar);
      safeSetHTML(document.getElementById('nav-container'), nav);
      applyRoleBasedVisibility(document);
      await hydrateSidebarAuthIdentity();

      // Auto-load initial page based on Navigo hash route, query fallback, then dashboard.
      const initialPage = getInitialMainPage();
      await navigateTo(initialPage, { updateRoute: true });

      if (window.applyVersioning) window.applyVersioning();
    } catch (err) {
      console.error('Wolf OS: Component Load Error:', err);
    }
  };

  /**
   * Helper: Terminal Message Simulation
   */
  function runBootSimulation(callback) {
    const bootSteps = [
      { progress: 15, msg: 'INITIALIZING CORE SYSTEMS...' },
      { progress: 35, msg: 'ESTABLISHING SUPABASE UPLINK...' },
      { progress: 60, msg: 'LOADING SECURE ENCRYPTION...' },
      { progress: 85, msg: 'SYNCING DATABASE_MEMBERS...' },
      { progress: 100, msg: 'SYSTEM READY.' },
    ];
    let currentStep = 0;
    const bootInterval = setInterval(() => {
      if (currentStep < bootSteps.length) {
        const step = bootSteps[currentStep];
        if (statusText) statusText.innerText = step.msg;
        if (progressBar) progressBar.style.width = `${step.progress}%`;
        currentStep++;
      } else {
        clearInterval(bootInterval);
        if (callback) callback();
      }
    }, 300);
  }

  /**
   * Helper: Final Transition out of Loading Screen
   */
  function finishBootSequence() {
    setTimeout(() => {
      if (loadingScreen) loadingScreen.style.opacity = '0';
      if (window.wolfAudio) window.wolfAudio.play('intro');
      setTimeout(() => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (layout) {
          layout.style.display = 'block';
          void layout.offsetWidth; // Trigger reflow
          layout.style.opacity = '1';
        }
        // Final fade for the simple overlay if it exists
        if (loadingOverlay) {
          loadingOverlay.classList.add('fade-out');
          setTimeout(() => (loadingOverlay.style.display = 'none'), 100);
        }
      }, 300);
    }, 700);
  }

  // --- START BOOT LOGIC ---

  // PATH A: FAST BOOT (No animations)
  if (typeof WOLF_CONFIG !== 'undefined' && WOLF_CONFIG.noLoadingScreen) {
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (starsContainer) starsContainer.style.display = 'none';
    if (loadingOverlay) loadingOverlay.style.display = 'none';

    await finalizeSystemBoot();

    if (layout) {
      layout.style.display = 'block';
      layout.style.opacity = '1';
    }
    setupGlobalClickHandlers(); // Moved into a named function below
    return;
  }

  // PATH B: CINEMATIC BOOT
  console.log('Wolf OS: Cinematic Boot Initialized.');

  setTimeout(async () => {
    if (starsContainer) starsContainer.style.display = 'none';
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
      loadingScreen.classList.add('show');
    }

    setupGlobalClickHandlers();

    // Run simulation and load components in parallel
    runBootSimulation(() => {
      finishBootSequence();
    });

    await finalizeSystemBoot();
  }, 1000);
}

/**
 * Consistently handle all clicks across the OS
 */
function setupGlobalClickHandlers() {
  // Prevent double-attaching
  if (window.wolfEventHandlersAttached) return;
  window.wolfEventHandlersAttached = true;
  const interactionLockUntil = {
    nav: 0,
    sidebar: 0,
    dropdown: 0,
  };

  const tryLock = (key, ms = 420) => {
    const now = Date.now();
    if ((interactionLockUntil[key] || 0) > now) return false;
    interactionLockUntil[key] = now + ms;
    return true;
  };

  const syncMoreButtonState = (isSidebarActive) => {
    const moreBtn = document.getElementById('moreNavBtn');
    if (moreBtn) moreBtn.classList.toggle('sidebar-active', !!isSidebarActive);
  };

  const collapseSidebar = () => {
    const sidebarElement = document.getElementById('wolfSidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebarElement) return;

    sidebarElement.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.remove('active');

    const closeIcon = document.getElementById('closeIcon');
    const versionLabel = sidebarElement.querySelector('.version');
    if (closeIcon) closeIcon.className = 'bxf bx-caret-big-right';
    if (versionLabel) versionLabel.style.display = 'none';
    syncMoreButtonState(false);

    // Close all dropdowns for a clean collapse
    document
      .querySelectorAll('.nav-dropdown')
      .forEach((d) => d.classList.remove('open'));
  };

  document.addEventListener('click', async (e) => {
    // LOGOUT (sidebar + hub button)
    const logoutBtn = e.target.closest('.logout-btn, .logout-btn2');
    if (logoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (window.handleLogout) window.handleLogout();
      return;
    }

    // ADD PRODUCT BUTTON (products page header)
    const addProductBtn = e.target.closest('#btn-add-product');
    if (addProductBtn) {
      e.preventDefault();
      e.stopPropagation();

      const modal = document.getElementById('product-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
      } else {
        alert('Add Product modal not found in DOM');
      }
      return;
    }

    // 1. SIDEBAR DROPDOWNS
    const dropdownToggle = e.target.closest('.nav-dropdown > .nav-item-side');
    if (dropdownToggle) {
      if (!tryLock('dropdown', 260)) return;
      e.preventDefault();
      const sidebar = document.getElementById('wolfSidebar');
      const dropdownParent = dropdownToggle.parentElement;
      const closeIcon = document.getElementById('closeIcon');
      const versionLabel = sidebar ? sidebar.querySelector('.version') : null;

      // 1. If sidebar is collapsed (mini), expand it first
      if (sidebar && !sidebar.classList.contains('active')) {
        sidebar.classList.add('active');
        document.body.classList.add('sidebar-open');
        syncMoreButtonState(true);
      }

      // 2. SYNC UI: Sidebar is now expanded, flip icon to LEFT and hide .version
      if (closeIcon) closeIcon.className = 'bxf bx-caret-big-left';
      if (versionLabel) versionLabel.style.display = 'none';

      // 3. Close all other dropdowns to keep UI clean
      document.querySelectorAll('.nav-dropdown').forEach((other) => {
        if (other !== dropdownParent) other.classList.remove('open');
      });

      // 4. Toggle the clicked dropdown
      dropdownParent.classList.toggle('open');

      if (window.wolfAudio) window.wolfAudio.play('notif');
      return;
    }

    // 2. SEARCH ENGINE
    // 2. SEARCH ENGINE
    const searchToggle = e.target.closest('#toggle-search-btn');
    if (searchToggle) {
      const scope =
        searchToggle.closest(
          '#product-main-view, #member-main-view, #sales-main-view, #logbook-main-view, #main-content, .ledger-page-wrapper',
        ) || document;
      const container = scope.querySelector('#ledger-search-container');
      // Keep global handler for Daily Ledger only.
      // Members/Products have their own scoped handlers.
      const input = scope.querySelector('#ledger-main-search');
      if (!container || !input) return;

      e.preventDefault();
      e.stopPropagation();

      const isActive = container.classList.toggle('active');
      searchToggle.classList.toggle('active', isActive);

      if (isActive) {
        setTimeout(() => input.focus(), 150);
      } else {
        input.value = '';
        const clearBtn = scope.querySelector('#search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';
      }
      return;
    }

    // 2.1 TRASH / ARCHIVE (Ledger header)
    const clearSalesBtn = e.target.closest('#clear-sales-btn');
    if (clearSalesBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (
        window.salesManager &&
        typeof window.salesManager.openTrashBin === 'function'
      ) {
        window.salesManager.openTrashBin();
      } else {
        console.warn('Wolf OS: salesManager not available for trash modal.');
      }
      return;
    }

    // 3. NAVIGATION
    const navBtn = e.target.closest('[data-page]');
    if (navBtn) {
      if (!tryLock('nav', 650)) return;
      e.preventDefault();
      const targetPage = normalizeMainPage(navBtn.getAttribute('data-page'));

      // Global Page Router
      navigateTo(targetPage);

      // LOCKDOWN: Sync UI immediately (Active turns Red + Unclickable)
      if (window.wolfData && window.wolfData.syncNavigationUI) {
        window.wolfData.syncNavigationUI(targetPage);
      }

      // Close sidebar after any navigation click on mobile only
      if (navBtn.closest('#wolfSidebar') && window.innerWidth < 768) {
        collapseSidebar();
      }
      return;
    }

    // 4. THEME
    if (e.target.closest('#themeToggleBtn')) {
      e.preventDefault();
      themeManager.toggle();
      closeTopbarSettingsMenu();
      return;
    }

    const topbarProfileBtn = e.target.closest('#topbarProfileBtn');
    if (topbarProfileBtn) {
      e.preventDefault();
      const profileBtn = document.getElementById('topbarProfileBtn');
      if (profileBtn) {
        profileBtn.classList.remove('is-splash');
        // force restart animation
        void profileBtn.offsetWidth;
        profileBtn.classList.add('is-splash');
      }
      toggleTopbarSettingsMenu();
      return;
    }

    const settingsTabMenuBtn = e.target.closest('[data-settings-menu-tab]');
    if (settingsTabMenuBtn) {
      e.preventDefault();
      const requestedTab = settingsTabMenuBtn.getAttribute(
        'data-settings-menu-tab',
      );
      closeTopbarSettingsMenu();
      openSettingsTab(requestedTab || 'personalize');
      return;
    }

    if (e.target.closest('#topbar-settings-logout-btn')) {
      e.preventDefault();
      closeTopbarSettingsMenu();
      if (typeof window.handleLogout === 'function') window.handleLogout();
      return;
    }

    // 5. SIDEBAR TOGGLES (More Button, Close Arrow, or Backdrop)
    const sidebarElement = document.getElementById('wolfSidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (
      e.target.closest('#moreNavBtn') ||
      e.target.closest('#sidebarToggle') || // Matches your button id
      e.target.closest('#sidebarClose') ||
      e.target === backdrop
    ) {
      if (!tryLock('sidebar', 340)) return;
      if (!sidebarElement) return;

      // Toggle state
      const isActive = sidebarElement.classList.toggle('active');
      document.body.classList.toggle('sidebar-open', isActive);
      if (backdrop) backdrop.classList.toggle('active', isActive);
      syncMoreButtonState(isActive);

      // --- CRITICAL UI SYNC FIX ---
      const closeIcon = document.getElementById('closeIcon');
      const versionLabel = sidebarElement.querySelector('.version');

      if (isActive) {
        // Expanded: Icon points LEFT, version HIDDEN
        if (closeIcon) closeIcon.className = 'bxf bx-caret-big-left';
        if (versionLabel) versionLabel.style.display = 'block';
      } else {
        // Collapsed: Icon points RIGHT, version VISIBLE
        if (closeIcon) closeIcon.className = 'bxf bx-caret-big-right';
        if (versionLabel) versionLabel.style.display = 'none';

        // Bonus: Close all dropdowns for a clean collapse
        document
          .querySelectorAll('.nav-dropdown')
          .forEach((d) => d.classList.remove('open'));
      }
    }

    if (
      !e.target.closest('#topbarSettingsMenu') &&
      !e.target.closest('#topbarProfileBtn')
    ) {
      closeTopbarSettingsMenu();
    }
  });

  // Initial sync in case sidebar is restored in active state.
  const initialSidebar = document.getElementById('wolfSidebar');
  syncMoreButtonState(initialSidebar?.classList.contains('active'));

  // Global Input Handler for Search
  document.addEventListener('input', (e) => {
    if (e.target.id === 'ledger-main-search') {
      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn)
        clearBtn.style.display = e.target.value.length > 0 ? 'block' : 'none';

      clearTimeout(window.searchDebounce);
      window.searchDebounce = setTimeout(() => {
        // Call the loader of whichever mode we are in (Sales or Logbook)
        if (window.wolfData) {
          if (window.wolfData.activeMode === 'sales')
            window.wolfData.loadSales();
          else window.wolfData.loadLogbook();
        }
      }, 300);
    }
  });
}

// --- INITIAL TRIGGER ---
document.addEventListener('DOMContentLoaded', () => {
  initUI().catch((err) => console.error('System Boot Failure:', err));
});

window.addEventListener('resize', () => {
  const menu = document.getElementById('topbarSettingsMenu');
  if (!menu || !menu.classList.contains('is-open')) return;
  positionTopbarSettingsMenu();
});
