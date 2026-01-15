/**
 * WOLF OS - UI LOADER & NAVIGATION ENGINE
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
    icons.forEach(icon => {
        // Switch between moon and sun
        if (isLight) {
            icon.classList.replace('bx-moon', 'bx-sun');
        } else {
            icon.classList.replace('bx-sun', 'bx-moon');
        }
    });
}
};

// Initialize theme immediately to prevent "white flash"
themeManager.init();

// --- 1. CORE UTILS ---
async function loadComponent(id, path) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Failed to load ${path}`);
        el.innerHTML = await res.text();
    } catch (err) {
        console.error("Component Load Error:", err);
    }
}

// --- 2. AJAX PAGE LOADER ---

async function navigateTo(pageName) {
    const mainContent = document.querySelector('main');
    if (!mainContent) return;

    // Transition Out
    mainContent.style.transition = 'opacity 0.3s ease';
    mainContent.style.opacity = '0';

    try {
        // Path logic: dashboard content is separate from the shell dashboard.html
        const path = pageName === 'dashboard' ? '/dashboard.html' : `/pages/${pageName}.html`;
        
        const res = await fetch(path);
        if (!res.ok) throw new Error("Page not found");
        
        const html = await res.text();
        
        // Delay slightly for smooth transition
        setTimeout(() => {
            mainContent.innerHTML = html;
            mainContent.style.opacity = '1';
            updateNavHighlights(pageName);
        }, 300);
        
        // Update URL
        window.history.pushState({page: pageName}, '', `?p=${pageName}`);
        
    } catch (err) {
        console.error("Navigation Error:", err);
        mainContent.innerHTML = `
            <div class="error-container">
                <i class='bx bx-sad error-face'></i>
                <div class="brand">SYSTEM <span>ERROR 404</span></div>
                <p class="desc">The requested resource is missing, offline, or restricted.</p>
                <button onclick="navigateTo('dashboard')" class="btn-error-recovery">
                    INITIATE RECOVERY PROTOCOL
                </button>
            </div>
        `;
        mainContent.style.opacity = '1';
    }
}

// --- 3. UI HIGHLIGHT SYNCHRONIZATION ---

function updateNavHighlights(pageName) {
    // Update all elements with data-page (Sidebar + Floating Nav)
    document.querySelectorAll('[data-page]').forEach(el => {
        if (el.getAttribute('data-page') === pageName) {
            el.classList.add('active');
            // If it's a sidebar item, we also apply the specific color
            if (el.classList.contains('nav-item-side')) {
                el.style.color = 'var(--accent-red)';
            }
        } else {
            el.classList.remove('active');
            if (el.classList.contains('nav-item-side')) {
                el.style.color = '';
            }
        }
    });
}

// --- 4. MAIN UI INITIALIZATION ---

async function initUI() {
    // 1. Load Components
    await loadComponent('topbar-container', '/assets/components/topbar.html');
    await loadComponent('sidebar-container', '/assets/components/sidebar.html');
    await loadComponent('nav-container', '/assets/components/floating-nav.html');

    // 2. Identify Elements
    const sidebar = document.getElementById('wolfSidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const moreBtn = document.getElementById('moreNavBtn'); 

    // 3. GLOBAL EVENT DELEGATION (Clicks)
    document.addEventListener('click', async (e) => {
        
        // THEME TOGGLE HANDLER
        const themeBtn = e.target.closest('#themeToggleBtn');
        if (themeBtn) {
            e.preventDefault();
            themeManager.toggle();
            return;
        }


        // A. Handle Navigation Clicks
        const navItem = e.target.closest('[data-page]');
        if (navItem) {
            const page = navItem.getAttribute('data-page');
            navigateTo(page);
            
            // Auto-close sidebar on mobile after choosing a page
            if (window.innerWidth < 768 && sidebar.classList.contains('active')) {
                toggleSidebar();
            }
            return;
        }

        // B. Handle Logout Clicks
        const logoutBtn = e.target.closest('.logout-btn');
        if (logoutBtn) {
            e.preventDefault();
            logoutBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> <span>ENDING...</span>";
            
            const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
            const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
            const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

            try {
                await supabase.auth.signOut();
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace("/index.html");
            } catch (err) {
                window.location.replace("/index.html");
            }
            return;
        }

        // C. Sidebar Specific Toggles (More Button, Close Button, Backdrop)
        if (e.target.closest('#moreNavBtn') || e.target.closest('#sidebarClose') || e.target === backdrop) {
            toggleSidebar();
        }
    });

    // 4. SIDEBAR TOGGLE CORE LOGIC
    const toggleSidebar = () => {
        if (!sidebar) return;

        const isActive = sidebar.classList.toggle('active');
        const isMobile = window.innerWidth < 768;
        const pcIcon = document.getElementById('closeIcon'); // Desktop chevron
        const mobileMoreIcon = document.getElementById('navMoreIcon'); // Floating bar burger

        // Handle Body Shift (Desktop Only)
        document.body.classList.toggle('sidebar-open', isActive);

        // Highlight the "More" button on floating nav if sidebar is active
        if (moreBtn) {
            moreBtn.classList.toggle('sidebar-active', isActive);
        }

        // Desktop Icon Flip (Chevron left/right)
        if (!isMobile && pcIcon) {
            pcIcon.className = isActive ? 'bx bx-chevron-left' : 'bx bx-chevron-right';
        }

        // Mobile Icon Swap (Burger to X)
        if (isMobile && mobileMoreIcon) {
            mobileMoreIcon.className = 'bx bx-menu';
        }

        // Backdrop Logic (Mobile Only)
        if (backdrop) {
            if (isMobile && isActive) {
                backdrop.classList.add('active');
            } else {
                backdrop.classList.remove('active');
            }
        }
    };

    // 5. INITIAL STATE: Check URL for page parameter (e.g., ?p=sales)
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = urlParams.get('p') || 'dashboard';
    updateNavHighlights(initialPage);
}

// Launch
document.addEventListener('DOMContentLoaded', initUI);