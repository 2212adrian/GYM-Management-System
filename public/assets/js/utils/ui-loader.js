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

function updateNavHighlights(pageName) {
    // Select both Sidebar and Nav bar items
    const navItems = document.querySelectorAll('[data-page]');

    navItems.forEach(el => {
        const isTarget = el.getAttribute('data-page') === pageName;
        const icon = el.querySelector('i');

        if (isTarget) {
            el.classList.add('active');
            // SWAP TO SOLID (bxs)
            if (icon) {
                icon.className = icon.className.replace(/\bbx-([a-z0-9-]+)\b/g, 'bxs-$1');
            }
        } else {
            el.classList.remove('active');
            // REVERT TO OUTLINE (bx)
            if (icon) {
                icon.className = icon.className.replace(/\bbxs-([a-z0-9-]+)\b/g, 'bx-$1');
            }
        }
    });
}

// --- 1. SETUP PAGE NAVIGATION ---
document.querySelectorAll('[data-page]').forEach(button => {
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
        
        console.log("Wolf OS: Switching Theme...");
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

    // 1. Transition Out
    mainContent.style.transition = 'opacity 0.2s ease';
    mainContent.style.opacity = '0';

    try {
        const path = `/pages/${pageName}.html`;
        const res = await fetch(path);
        
        let html;
        if (!res.ok) {
            // --- THE 404 PROTOCOL: Fetch your actual 404.html design ---
            console.warn(`Wolf OS: Protocol ${pageName} fault. Loading 404 UI.`);
            const errRes = await fetch('/404.html');
            html = await errRes.text();
            // Clear highlights since we are in a fault state
            pageName = null; 
        } else {
            html = await res.text();
        }

        // 2. Slap HTML and Transition In
        setTimeout(() => {
            mainContent.innerHTML = html;
            mainContent.style.opacity = '1';
            updateNavHighlights(pageName);
        }, 200);

        // 3. Update URL if valid page
        if (pageName) {
            window.history.pushState({page: pageName}, '', `?p=${pageName}`);
        }
        
    } catch (err) {
        console.error("Critical link fault:", err);
        mainContent.innerHTML = `<div style="color:var(--accent-red); padding:50px; text-align:center;"><h1>[ERR_500]</h1><p>SYSTEM LINK OFFLINE</p></div>`;
        mainContent.style.opacity = '1';
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

    try {
        // 1. Load Components
        const [topbar, sidebar, nav] = await Promise.all([
            loadHTML('/assets/components/topbar.html'),
            loadHTML('/assets/components/sidebar.html'),
            loadHTML('/assets/components/floating-nav.html')
        ]);

        document.getElementById('topbar-container').innerHTML = topbar;
        document.getElementById('sidebar-container').innerHTML = sidebar;
        document.getElementById('nav-container').innerHTML = nav;

        // 2. GLOBAL CLICK DELEGATION
        // This is the "Magic Fix" - it handles clicks even for items not loaded yet.
        document.addEventListener('click', async (e) => {
            
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
                logoutBtn.style.opacity = "0.5";
                logoutBtn.innerText = "ENDING...";

                const supabase = window.supabase.createClient('https://xhahdzyjhwutgqfcrzfc.supabase.co', 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT');
                await supabase.auth.signOut();
                localStorage.clear();
                window.location.replace("/index.html");
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
            const sidebar = document.getElementById('wolfSidebar');
            const backdrop = document.getElementById('sidebar-backdrop');
            
            if (e.target.closest('#moreNavBtn') || e.target.closest('#sidebarClose') || e.target === backdrop) {
                if (!sidebar) return;
                const isActive = sidebar.classList.toggle('active');
                const isMobile = window.innerWidth < 768;

                document.body.classList.toggle('sidebar-open', isActive);
                if (document.getElementById('moreNavBtn')) document.getElementById('moreNavBtn').classList.toggle('sidebar-active', isActive);
                if (isMobile && backdrop) backdrop.classList.toggle('active', isActive);
                
                const closeIcon = document.getElementById('closeIcon');
                if (!isMobile && closeIcon) closeIcon.className = isActive ? 'bx bx-chevron-left' : 'bx bx-chevron-right';
                
                const mobileMoreIcon = document.getElementById('navMoreIcon');
                if (isMobile && mobileMoreIcon) mobileMoreIcon.className = isActive ? 'bx bx-x' : 'bx bx-menu';
            }
        });

        // 3. LOAD INITIAL PAGE
        const urlParams = new URLSearchParams(window.location.search);
        await navigateTo(urlParams.get('p') || 'dashboard');

    } catch (err) {
        console.error("Wolf OS Boot Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', initUI);