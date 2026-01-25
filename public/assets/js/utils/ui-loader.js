/**
 * WOLF OS - UI LOADER (main.html) & NAVIGATION ENGINE
 * Handles AJAX page swapping, component injection, and UI state synchronization.
 */

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

async function navigateTo(pageName) {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.style.opacity = '0';

  try {
    let path;
    let isLedger = false;

    // Ledger pages
    if (pageName === 'sales' || pageName === 'logbook') {
      path = '/assets/views/daily-ledger.html';
      isLedger = true;
    } else {
      path = `/pages/${pageName}.html`;
    }

    const res = await fetch(path);
    if (!res.ok) throw new Error(`Page "${pageName}" not found`);

    const html = await res.text();
    mainContent.innerHTML = html;

    if (isLedger) {
      wolfData.activeMode = pageName;
      wolfData.initLedger(pageName);
    }

    mainContent.style.opacity = '1';
    updateNavHighlights(pageName);

    if (pageName) {
      window.history.pushState({ page: pageName }, '', `?p=${pageName}`);
    }

    if (window.applyVersioning) window.applyVersioning();
  } catch (err) {
    console.warn(
      `Wolf OS: Could not load page "${pageName}". Falling back to 404.`,
    );

    try {
      const errRes = await fetch('/404.html');
      const fullHtml = errRes.ok
        ? await errRes.text()
        : '<h1>404 Not Found</h1>';

      const parser = new DOMParser();
      const doc = parser.parseFromString(fullHtml, 'text/html');

      const styleTag = doc.querySelector('style');
      const styleHtml = styleTag ? styleTag.outerHTML : '';
      const bodyContent = doc.body.innerHTML;

      mainContent.innerHTML = styleHtml + bodyContent;
      mainContent.style.opacity = '1';

      // Safe path display
      const pathEl = document.getElementById('display-path');
      if (pathEl && typeof DOMPurify !== 'undefined') {
        pathEl.innerHTML = DOMPurify.sanitize(window.location.pathname);
      }

      document
        .querySelectorAll('[data-page]')
        .forEach((el) => el.classList.remove('active'));
    } catch (fatal) {
      mainContent.innerHTML =
        typeof DOMPurify !== 'undefined'
          ? DOMPurify.sanitize(
              '<h1 style="color:red;text-align:center;">[FATAL_ERROR]</h1>',
              {
                ALLOWED_TAGS: ['h1'],
                ALLOWED_ATTR: ['style'],
              },
            )
          : '<h1 style="color:red;text-align:center;">[FATAL_ERROR]</h1>';
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
      // --- 1. GENERIC SIDEBAR DROPDOWN LOGIC ---
      // Targets any link inside a .nav-dropdown that acts as a toggle
      const dropdownToggle = e.target.closest('.nav-dropdown > .nav-item-side');
      if (dropdownToggle) {
        e.preventDefault();
        const sidebar = document.getElementById('wolfSidebar');
        const dropdownParent = dropdownToggle.parentElement;

        // A. RAIL MODE PROTECTION: If sidebar is mini/collapsed, expand it first
        if (!sidebar.classList.contains('active')) {
          sidebar.classList.add('active');
          document.body.classList.add('sidebar-open');

          // Update the sidebar chevron icon to "Left" (Open state)
          const closeIcon = document.getElementById('closeIcon');
          if (closeIcon) closeIcon.className = 'bxf bx-caret-big-right';

          // Highlight the "More" button in the floating nav
          const moreBtn = document.getElementById('moreNavBtn');
          if (moreBtn) moreBtn.classList.add('sidebar-active');
        }

        // B. ACCORDION EFFECT: Close other dropdowns when one is opened
        document.querySelectorAll('.nav-dropdown').forEach((other) => {
          if (other !== dropdownParent) other.classList.remove('open');
        });

        // C. TOGGLE the clicked dropdown
        dropdownParent.classList.toggle('open');

        if (window.wolfAudio) window.wolfAudio.play('notif');
        return;
      }

      // --- 2. SEARCH ENGINE LOGIC ---
      const searchToggle = e.target.closest('#toggle-search-btn');
      if (searchToggle) {
        const container = document.getElementById('ledger-search-container');
        const input = document.getElementById('ledger-main-search');
        const clearBtn = document.getElementById('search-clear-btn');
        if (!container || !input) return;

        const isOpening = container.classList.toggle('active');
        searchToggle.classList.toggle('active');

        if (isOpening) {
          setTimeout(() => input.focus(), 300);
          if (window.wolfAudio) window.wolfAudio.play('notif');
        } else {
          input.value = '';
          if (clearBtn) clearBtn.style.display = 'none';
          const dataCore = window.wolfData || wolfData;
          if (dataCore) {
            dataCore.isFetching = false;
            const dayIndex =
              dataCore.selectedDate?.getDay?.() ?? new Date().getDay();
            dataCore.activeMode === 'sales'
              ? dataCore.renderSales(dayIndex, '')
              : dataCore.loadLogbook();
          }
          if (window.wolfAudio) window.wolfAudio.play('notif');
        }
        return;
      }

      const clearBtn = e.target.closest('#search-clear-btn');
      if (clearBtn) {
        const input = document.getElementById('ledger-main-search');
        if (input) {
          input.value = '';
          clearBtn.style.display = 'none';
          input.focus();
          const dataCore = window.wolfData || wolfData;
          if (dataCore) {
            dataCore.isFetching = false;
            const dayIndex =
              dataCore.selectedDate?.getDay?.() ?? new Date().getDay();
            dataCore.activeMode === 'sales'
              ? dataCore.renderSales(dayIndex, '')
              : dataCore.loadLogbook();
          }
          if (window.wolfAudio) window.wolfAudio.play('notif');
        }
        return;
      }

      // --- 3. UTILITY BUTTONS (QR & MUTE) ---
      if (e.target.closest('#qrScannerBtn')) {
        window.wolfScanner.start(null, false);
      }

      const muteBtn = e.target.closest('#muteToggleBtn');
      if (muteBtn) {
        e.preventDefault();
        const isMuted = wolfAudio.toggleMute();
        const icon = muteBtn.querySelector('i');
        icon.className = isMuted ? 'bx bx-volume-mute' : 'bx bx-volume-full';
        muteBtn.style.opacity = isMuted ? '0.5' : '1';
      }

      // --- 4. NAVIGATION ENGINE (AJAX Swap) ---
      const navBtn = e.target.closest('[data-page]');
      if (navBtn) {
        e.preventDefault();
        navigateTo(navBtn.getAttribute('data-page'));
        return;
      }

      // --- 5. LOGOUT PROTOCOL ---
      const logoutBtn = e.target.closest('.logout-btn');
      if (logoutBtn) {
        e.preventDefault();
        Toastify({
          text: 'Logging out of Wolf OS...',
          duration: 3000,
          gravity: 'top', // top or bottom
          position: 'right', // left, center or right
          stopOnFocus: true,
          style: {
            background: '#a63429', // Your Wolf Red variable
            borderRadius: '10px',
            fontWeight: 'bold',
          },
        }).showToast();
        if (window.wolfAudio) window.wolfAudio.play('logoff');

        [
          '#topbar-container',
          '#sidebar-container',
          '#wolf-layout',
          '#nav-container',
          '#sidebar-backdrop',
        ].forEach((sel) => {
          document.querySelector(sel)?.classList.add('logoff-anim');
        });

        setTimeout(async () => {
          if (window.supabaseClient) await window.supabaseClient.auth.signOut();
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace('/index.html');
        }, 4000);
        return;
      }

      // --- 6. THEME SWITCHER ---
      const themeBtn = e.target.closest('#themeToggleBtn');
      if (themeBtn) {
        e.preventDefault();
        themeManager.toggle();
        return;
      }

      // --- 7. SIDEBAR TOGGLE & BACKDROP ---
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
        document
          .getElementById('moreNavBtn')
          ?.classList.toggle('sidebar-active', isActive);
        if (isMobile && backdrop) backdrop.classList.toggle('active', isActive);

        const closeIcon = document.getElementById('closeIcon');
        if (!isMobile && closeIcon)
          closeIcon.className = isActive
            ? 'bxf bx-caret-big-left'
            : 'bxf bx-caret-big-right';

        // UX: Close all sub-menus when the sidebar itself is closed
        if (!isActive) {
          document
            .querySelectorAll('.nav-dropdown')
            .forEach((d) => d.classList.remove('open'));
        }
      }

      if (typeof window.applyVersioning === 'function')
        window.applyVersioning();
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

  document.addEventListener('input', (e) => {
    if (e.target.id === 'ledger-main-search') {
      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn) {
        clearBtn.style.display = e.target.value.length > 0 ? 'block' : 'none';
      }
      // Use a debounce to prevent lagging the database
      clearTimeout(window.searchDebounce);
      window.searchDebounce = setTimeout(() => {
        wolfRefreshView();
      }, 300);
    }
  });
}

document.addEventListener('DOMContentLoaded', initUI);
