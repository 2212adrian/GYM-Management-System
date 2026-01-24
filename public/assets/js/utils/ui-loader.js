/**
 * WOLF OS - UI LOADER (main.html) & NAVIGATION ENGINE
 * Handles AJAX page swapping, component injection, and UI state synchronization.
 */

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

// --- STAR GENERATOR FOR LOADING ---
function createLoadingStars() {
  const container = document.getElementById('stars-container');
  if (!container) return;

  for (let i = 0; i < 50; i++) {
    const star = document.createElement('div');
    star.className = 'star';

    // Random Position
    const x = Math.random() * 100;
    const y = Math.random() * 100;

    // Random Size
    const size = Math.random() * 4 + 1;

    // Random Delay & Duration
    const delay = Math.random() * 3;
    const duration = Math.random() * 2 + 2;

    star.style.left = `${x}%`;
    star.style.top = `${y}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.animationDelay = `${delay}s`;
    star.style.animationDuration = `${duration}s`;

    container.appendChild(star);
  }
}

// --- 1. CORE UTILS ---
async function loadComponent(id, path) {
  if (window.applySystemConfig) window.applySystemConfig(); // Apply system config if available
  const el = document.getElementById(id);
  if (!el) return;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    el.innerHTML = await res.text();
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

// --- 2. SETUP DARK MODE (THE THEME FIX) ---
const themeBtn = document.getElementById('themeToggleBtn');
if (themeBtn) {
  themeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Stops it from interfering with page navigation

    console.log('Wolf OS: Switching Theme...');
    document.body.classList.toggle('dark-theme'); // Or your specific class

    // Bonus: Swap the icon between moon and sun
    const themeIcon = themeBtn.querySelector('i');
    if (themeIcon) {
      themeIcon.classList.toggle('bx-moon');
      themeIcon.classList.toggle('bx-sun');
    }
  };
}

async function navigateTo(pageName) {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  // 1. Start Transition
  mainContent.style.opacity = '0';

  try {
    let path;
    let isLedger = false;

    // AJAX Redirect
    if (pageName === 'sales' || pageName === 'logbook') {
      path = '/assets/views/daily-ledger.html';
      isLedger = true;
    } else {
      path = `/pages/${pageName}.html`;
    }

    const res = await fetch(path);
    if (!res.ok) throw new Error('Page not found');
    const html = await res.text();

    // 2. Inject HTML Immediately
    mainContent.innerHTML = html;
    // 3. Initialize based on type
    if (isLedger) {
      wolfData.activeMode = pageName;
      wolfData.initLedger(pageName);
    }

    // 4. Finalize UI
    mainContent.style.opacity = '1';
    updateNavHighlights(pageName);

    if (pageName) {
      window.history.pushState({ page: pageName }, '', `?p=${pageName}`);
    }

    if (window.applyVersioning) window.applyVersioning();
  } catch (err) {
    console.warn(`Wolf OS: Protocol fault. Loading 404.`);

    try {
      const errRes = await fetch('/404.html');
      const fullHtml = await errRes.text();

      // --- THE FIX: Extract Styles & Body ---
      const parser = new DOMParser();
      const doc = parser.parseFromString(fullHtml, 'text/html');

      // Get the CSS from the 404 page
      const styleTag = doc.querySelector('style');
      const styleHtml = styleTag ? styleTag.outerHTML : '';

      // Get the content from the 404 page
      const bodyContent = doc.body.innerHTML;

      setTimeout(() => {
        // Slap the styles AND the body into the main container
        mainContent.innerHTML = styleHtml + bodyContent;
        mainContent.style.opacity = '1';

        // Re-run the path detection for the 404 screen
        const pathEl = document.getElementById('display-path');
        if (pathEl) pathEl.textContent = window.location.pathname;

        document
          .querySelectorAll('[data-page]')
          .forEach((el) => el.classList.remove('active'));
      }, 200);
    } catch (fatal) {
      mainContent.innerHTML = `<h1 style="color:var(--wolf-red); text-align:center;">[FATAL_ERROR]</h1>`;
    }
  }
}

// --- 4. MAIN UI INITIALIZATION ---

async function loadHTML(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`[ERR_503] Failed to fetch: ${path}`);
  return await res.text();
}

async function initUI() {
  themeManager.init();

  // Start loading sequence
  // createLoadingStars();

  // Show stars for 2 seconds, then transition to loading screen
  setTimeout(() => {
    // Hide stars and show loading screen immediately
    const starsContainer = document.getElementById('stars-container');
    if (starsContainer) starsContainer.style.display = 'none';

    // Example: Fade out after 3 seconds
    setTimeout(() => {
      document.getElementById('loading-screen').style.opacity = '0';
      setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
      }, 800);
    }, 3000);

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
      loadingScreen.classList.add('show');
    }

    const overlay = document.getElementById('loading-overlay');
    const layout = document.getElementById('wolf-layout');

    if (overlay) overlay.classList.add('fade-out');
    if (layout) layout.style.display = 'block';

    // PLAY INTRO HERE
    if (window.wolfAudio) {
      window.wolfAudio.play('intro');
    } else {
      console.warn('Wolf OS Audio Engine not detected.');
    }

    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
    }, 800);
  }, 2000);

  try {
    // 1. Load Components
    const [topbar, sidebar, nav] = await Promise.all([
      loadHTML('/assets/components/topbar.html'),
      loadHTML('/assets/components/sidebar.html'),
      loadHTML('/assets/components/floating-nav.html'),
    ]);

    document.getElementById('topbar-container').innerHTML = topbar;
    document.getElementById('sidebar-container').innerHTML = sidebar;
    document.getElementById('nav-container').innerHTML = nav;

    // 2. GLOBAL CLICK DELEGATION
    document.addEventListener('click', async (e) => {
      if (e.target.closest('#qrScannerBtn')) {
        window.wolfScanner.start(null, false);
      }

      const muteBtn = e.target.closest('#muteToggleBtn');
      if (muteBtn) {
        e.preventDefault();
        const isMuted = wolfAudio.toggleMute();
        const icon = muteBtn.querySelector('i');
        if (isMuted) {
          icon.className = 'bx bx-volume-mute';
          muteBtn.style.opacity = '0.5';
        } else {
          icon.className = 'bx bx-volume-full';
          muteBtn.style.opacity = '1';
        }
      }

      // A. Handle Navigation (data-page)
      const navBtn = e.target.closest('[data-page]');
      if (navBtn) {
        e.preventDefault();
        navigateTo(navBtn.getAttribute('data-page'));
        return;
      }

      // B. Handle Logout (.logout-btn)
      const logoutBtn = e.target.closest('.logout-btn');
      if (logoutBtn) {
        e.preventDefault();

        logoutBtn.style.opacity = '0.5';
        logoutBtn.innerHTML =
          "<i class='bx bx-loader-alt bx-spin'></i> <span>ENDING...</span>";
        if (window.wolfAudio) window.wolfAudio.play('logoff');

        // --- NEW: TRIGGER OUTRO ANIMATION ---
        // We target the containers so the body background color stays visible
        const uiContainers = [
          '#topbar-container',
          '#sidebar-container',
          '#wolf-layout',
          '#nav-container',
          '#sidebar-backdrop',
        ];

        uiContainers.forEach((selector) => {
          const el = document.querySelector(selector);
          if (el) el.classList.add('logoff-anim');
        });

        try {
          const db = window.supabaseClient;

          setTimeout(async () => {
            if (db) {
              await db.auth.signOut();
            }
            // Clear both storages for full system reset
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace('/index.html');
          }, 2000); // 2 second delay to let user see the "Shutdown"
        } catch (err) {
          console.error('Logout Protocol Fault:', err);
          window.location.replace('/index.html');
        }
        return;
      }

      // C. Handle Theme Toggle (#themeToggleBtn)
      const themeBtn = e.target.closest('#themeToggleBtn');
      if (themeBtn) {
        e.preventDefault();
        themeManager.toggle();
        return;
      }

      // D. Sidebar Toggle Logic
      const sidebarElement = document.getElementById('wolfSidebar');
      const backdrop = document.getElementById('sidebar-backdrop');

      if (
        e.target.closest('#moreNavBtn') ||
        e.target.closest('#sidebarClose') ||
        e.target === backdrop
      ) {
        if (!sidebarElement) return;
        const isActive = sidebarElement.classList.toggle('active');
        const isMobile = window.innerWidth < 768;

        document.body.classList.toggle('sidebar-open', isActive);

        const moreBtn = document.getElementById('moreNavBtn');
        if (moreBtn) moreBtn.classList.toggle('sidebar-active', isActive);

        if (isMobile && backdrop) backdrop.classList.toggle('active', isActive);

        const closeIcon = document.getElementById('closeIcon');
        if (!isMobile && closeIcon)
          closeIcon.className = isActive
            ? 'bx bx-chevron-left'
            : 'bx bx-chevron-right';

        const mobileMoreIcon = document.getElementById('navMoreIcon');
        if (isMobile && mobileMoreIcon)
          mobileMoreIcon.className = isActive ? 'bx bx-x' : 'bx bx-menu';
      }

      // E. Re-apply Versioning after component loads
      if (typeof window.applyVersioning === 'function') {
        window.applyVersioning();
      }
    });

    // 3. LOAD INITIAL PAGE
    const urlParams = new URLSearchParams(window.location.search);
    await navigateTo(urlParams.get('p') || 'dashboard');

    // 4. Fade out loading overlay after everything is loaded
    setTimeout(() => {
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
        }, 500);
      }
    }, 2000);
  } catch (err) {
    console.error('Wolf OS Boot Error:', err);
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('fade-out');
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
  }
}

document.addEventListener('DOMContentLoaded', initUI);
