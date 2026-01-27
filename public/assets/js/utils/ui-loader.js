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

    // If we reach here, connection is back!
    // Now we can safely reload the page to restore the OS state
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

const WOLF_PURIFIER = (dirty) => {
  return DOMPurify.sanitize(dirty, {
    // Allow styling
    ALLOWED_TAGS: [
      'div',
      'span',
      'p',
      'a',
      'button',
      'input',
      'label',
      'ul',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'section',
      'header',
      'footer',
      'main',
      'nav',
      'i',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'style', // ✅ THIS is the big one
    ],

    // Allow layout + UI attributes
    ALLOWED_ATTR: [
      'class',
      'id',
      'style', // ✅ inline styles
      'data-page',
      'data-date',
      'data-day',
      'data-id',
      'href',
      'type',
      'value',
      'placeholder',
      'aria-label',
      'role',
    ],

    // Keep CSS working
    KEEP_CONTENT: true,

    // Explicitly forbid scripts
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
};

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

// --- 1. CORE UTILS ---
async function loadComponent(id, path) {
  if (window.applySystemConfig) window.applySystemConfig(); // Apply system config if available
  const el = document.getElementById(id);
  if (!el) return;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    el.innerHTML = WOLF_PURIFIER(await res.text());
  } catch (err) {
    console.error('Component Load Error:', err);
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
        icon.className = icon.className.replace(
          /\bbx-([a-z0-9-]+)\b/g,
          'bxs-$1',
        );
      }
    } else {
      el.classList.remove('active');
      // REVERT TO OUTLINE (bx)
      if (icon) {
        icon.className = icon.className.replace(
          /\bbxs-([a-z0-9-]+)\b/g,
          'bx-$1',
        );
      }
    }
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
async function navigateTo(pageName) {
  const mainContent = document.getElementById('main-content');
  const brandEl = document.getElementById('topbar-brand');
  if (!mainContent) return;

  const navigationMap = {
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
          background: linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%);
          background-size: 200% 100%;
          animation: skel-loading 1.5s infinite linear;
          border-radius: 8px;
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
    <div class="wolf-page-intro" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:70vh; text-align:center; color:white;">
      <i class='bx bx-wifi-off' style="font-size:80px; color:#a63429; margin-bottom:20px;"></i>
      <h1 style="font-size:32px; font-weight:900; margin:0; letter-spacing:-1px;">SIGNAL LOST</h1>
      <p style="color:#888; max-width:400px; margin:15px 0 30px 0; line-height:1.6;">The encrypted uplink to Wolf OS was severed.</p>
      <button class="retry-btn" onclick="window.wolfRetry()" style="background:#a63429; color:white; border:none; padding:12px 30px; font-weight:bold; border-radius:8px; cursor:pointer; text-transform:uppercase; display:flex; align-items:center; gap:10px;">
        <i class='bx bx-refresh' style="font-size:20px;"></i>
        <span>RETRY CONNECTION</span>
      </button>
    </div>
  `;

  // 1. Immediate Network Guard
  if (!navigator.onLine) {
    mainContent.innerHTML = offlineUI;
    mainContent.style.opacity = '1';
    return;
  }

  // 2. Show Skeleton immediately
  mainContent.innerHTML = skeletonUI;
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
    } else {
      path = `/pages/${pageName}.html`;
    }

    const fetchPromise = fetch(path);
    const [res] = await Promise.all([fetchPromise, delay]);

    if (!res.ok) throw new Error('404');

    const html = await res.text();

    // 5. Start swapping process: Fade out the skeleton
    mainContent.style.opacity = '0';

    setTimeout(() => {
      // 6. Wrap incoming HTML in the intro animation class
      mainContent.innerHTML = `<div class="wolf-page-intro">${html}</div>`;

      if (brandEl) {
        const isMobile = window.innerWidth <= 1024;
        const info = navigationMap[pageName];

        if (!info || pageName === 'home') {
          // Reset to Logo for Home
          brandEl.innerHTML = 'WOLF <span>PALOMAR</span> GYM';
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

          brandEl.innerHTML = `
      <div class="breadcrumb-container" style="display: flex; align-items: center; gap: ${isMobile ? '5px' : '8px'};">
        ${parentHTML}
        <i class='bx bx-chevron-right' style="color: #3498db; font-size: ${isMobile ? '1.1rem' : '1.3rem'}; font-weight: bold;"></i>
        <span style="letter-spacing: 1px; font-weight: 800; color: white;">${info.label}</span>
      </div>
    `;
        }
      }

      // 7. INITIALIZE PAGE MANAGERS
      if (isLedger && window.wolfData) {
        wolfData.activeMode = pageName;
        wolfData.initLedger(pageName);
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
      }

      // 8. Reveal content
      mainContent.style.opacity = '1';
      updateNavHighlights(pageName);

      if (pageName)
        window.history.pushState({ page: pageName }, '', `?p=${pageName}`);

      if (window.applyVersioning) window.applyVersioning();
    }, 200);
  } catch (err) {
    console.warn(`Wolf OS: Navigation Error ->`, err);

    if (!navigator.onLine || err instanceof TypeError) {
      mainContent.innerHTML = offlineUI;
      mainContent.style.opacity = '1';
      return;
    }

    try {
      const errRes = await fetch('/404.html');
      const fullHtml = await errRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(fullHtml, 'text/html');

      // Add intro animation to 404 page too
      mainContent.innerHTML = `<div class="wolf-page-intro">
        ${doc.querySelector('style')?.outerHTML || ''}
        ${doc.body.innerHTML}
      </div>`;

      mainContent.style.opacity = '1';
      const pathEl = document.getElementById('display-path');
      if (pathEl) pathEl.innerText = pageName;

      document
        .querySelectorAll('[data-page]')
        .forEach((el) => el.classList.remove('active'));
    } catch (fatal) {
      if (brandEl) brandEl.innerHTML = 'WOLF <span>PALOMAR</span> GYM';
      mainContent.innerHTML = offlineUI;
      mainContent.style.opacity = '1';
    }
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

      document.getElementById('topbar-container').innerHTML = topbar;
      document.getElementById('sidebar-container').innerHTML = sidebar;
      document.getElementById('nav-container').innerHTML = nav;

      // Auto-load initial page based on URL or default to dashboard
      const urlParams = new URLSearchParams(window.location.search);
      await navigateTo(urlParams.get('p') || 'dashboard');

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

  document.addEventListener('click', async (e) => {
    // 1. SIDEBAR DROPDOWNS
    const dropdownToggle = e.target.closest('.nav-dropdown > .nav-item-side');
    if (dropdownToggle) {
      e.preventDefault();
      const sidebar = document.getElementById('wolfSidebar');
      const dropdownParent = dropdownToggle.parentElement;
      const closeIcon = document.getElementById('closeIcon');
      const versionLabel = sidebar ? sidebar.querySelector('.version') : null;

      // 1. If sidebar is collapsed (mini), expand it first
      if (sidebar && !sidebar.classList.contains('active')) {
        sidebar.classList.add('active');
        document.body.classList.add('sidebar-open');
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
    const searchToggle = e.target.closest('#toggle-search-btn');
    if (searchToggle) {
      const container = document.getElementById('ledger-search-container');
      const input = document.getElementById('ledger-main-search');
      if (!container || !input) return;

      const isOpening = container.classList.toggle('active');
      searchToggle.classList.toggle('active');

      if (isOpening) {
        setTimeout(() => input.focus(), 300);
        if (window.wolfAudio) window.wolfAudio.play('notif');
      }
      return;
    }

    // 3. NAVIGATION
    const navBtn = e.target.closest('[data-page]');
    if (navBtn) {
      e.preventDefault();
      const targetPage = navBtn.getAttribute('data-page');

      // Global Page Router
      navigateTo(targetPage);

      // LOCKDOWN: Sync UI immediately (Active turns Red + Unclickable)
      if (window.wolfData && window.wolfData.syncNavigationUI) {
        window.wolfData.syncNavigationUI(targetPage);
      }
      return;
    }

    // 4. THEME
    if (e.target.closest('#themeToggleBtn')) {
      e.preventDefault();
      themeManager.toggle();
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
      if (!sidebarElement) return;

      // Toggle state
      const isActive = sidebarElement.classList.toggle('active');
      document.body.classList.toggle('sidebar-open', isActive);
      if (backdrop) backdrop.classList.toggle('active', isActive);

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

      if (window.wolfAudio) window.wolfAudio.play('notif');
    }
  });

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
