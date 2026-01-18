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

async function navigateTo(pageName) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // 1. Start Transition (Fade out current view)
    mainContent.style.opacity = '0';

    try {
        // Attempt to fetch the specific snippet
        const path = `/pages/${pageName}.html`;
        const res = await fetch(path);
        
        if (!res.ok) {
            // --- THE FIX: If snippet is missing, fetch the custom 404 design instead ---
            console.warn(`Wolf OS: Path fault at /pages/${pageName}.html. Triggering 404 protocol.`);
            const errorPage = await fetch('/404.html');
            const errorHtml = await errorPage.text();
            
            setTimeout(() => {
                mainContent.innerHTML = errorHtml;
                mainContent.style.opacity = '1';
                // Remove active highlights since we are in a fault state
                document.querySelectorAll('[data-page]').forEach(el => el.classList.remove('active'));
            }, 150);
            return; // Stop execution here
        }
        
        // --- Normal Load Protocol ---
        const html = await res.text();
        
        setTimeout(() => {
            mainContent.innerHTML = html;
            mainContent.style.opacity = '1';
            
            // Sync highlights and swap icons (bx to bxs)
            updateNavHighlights(pageName);
        }, 150);

        // Update URL state
        window.history.pushState({page: pageName}, '', `?p=${pageName}`);

    } catch (err) {
        console.error("Critical System Fault:", err);
        // Fallback in case even 404.html is missing
        mainContent.innerHTML = `<div style="color:var(--accent-red); padding:50px; text-align:center;"><h1>[ERR_503]</h1><p>SECURITY LINK OFFLINE</p></div>`;
        mainContent.style.opacity = '1';
    }
}

// --- 3. UI HIGHLIGHT SYNCHRONIZATION ---

// 1. Navigation Listeners (Only targets elements with data-page)
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
    try {
        // 1. Load Shell Components (Topbar, Sidebar, and Floating Nav)
        const elTopbar = document.getElementById('topbar-container');
        const elSidebar = document.getElementById('sidebar-container');
        const elNav = document.getElementById('nav-container');

        if (elTopbar) elTopbar.innerHTML = await loadHTML('/assets/components/topbar.html');
        if (elSidebar) elSidebar.innerHTML = await loadHTML('/assets/components/sidebar.html');
        if (elNav) elNav.innerHTML = await loadHTML('/assets/components/floating-nav.html');

        // 2. ATTACH NAVIGATION LISTENERS (Targeting both Sidebar + Navbar)
        document.querySelectorAll('[data-page]').forEach(button => {
            button.onclick = (e) => {
                e.preventDefault();
                const page = button.getAttribute('data-page');
                if (page) navigateTo(page); // navigateTo handles the icon swap (bx to bxs)
            };
        });

        // 3. ATTACH THEME TOGGLE LISTENER
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
        // Apply saved theme on load
        if (localStorage.getItem('wolf-theme') === 'light') {
            document.body.classList.add('light-theme');
        }

        themeBtn.onclick = (e) => {
            e.preventDefault();
            // Toggle the class on the BODY
            const isLight = document.body.classList.toggle('light-theme');
            
            // Save preference so it doesn't reset on refresh
            localStorage.setItem('wolf-theme', isLight ? 'light' : 'dark');

            // Optional: Swap icon visually
            const icon = themeBtn.querySelector('i');
            if (icon) {
                icon.className = isLight ? 'bx bx-sun' : 'bx bx-moon';
            }
            
            console.log("Wolf OS: Theme switched to " + (isLight ? "Light" : "Dark"));
        };
    }

        // 4. LOAD DEFAULT PAGE: 'main'
        const urlParams = new URLSearchParams(window.location.search);
        const startPage = urlParams.get('p') || 'main'; 
        await navigateTo(startPage);

        // 5. SIDEBAR TOGGLE LOGIC
        const sidebar = document.getElementById('wolfSidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        const moreBtn = document.getElementById('moreNavBtn');
        const closeBtn = document.getElementById('sidebarClose');
        const closeIcon = document.getElementById('closeIcon'); // The Chevron icon

        const toggleSidebar = () => {
            if (!sidebar) return;
            const isActive = sidebar.classList.toggle('active');
            const isMobile = window.innerWidth < 768;

            // Sync UI state to Body (for PC Margin shifting)
            document.body.classList.toggle('sidebar-open', isActive);
            
            // Sync highlight to the "More" button on the Nav bar
            if (moreBtn) moreBtn.classList.toggle('sidebar-active', isActive);

            // Handle Backdrop Blur (Mobile Only)
            if (isMobile && backdrop) {
                backdrop.classList.toggle('active', isActive);
            }

            // Handle PC Chevron direction (pointing toward the exit)
            if (!isMobile && closeIcon) {
                closeIcon.className = isActive ? 'bx bx-chevron-left' : 'bx bx-chevron-right';
            }
        };

        // Attach toggle events
        if (moreBtn) moreBtn.onclick = toggleSidebar;
        if (backdrop) backdrop.onclick = toggleSidebar;
        if (closeBtn) closeBtn.onclick = toggleSidebar;

    } catch (err) {
        console.error("Wolf OS Boot Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', initUI);