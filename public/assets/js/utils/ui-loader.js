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

async function initUI() {
    // 1. Load Components (Ensuring correct paths to your assets folder)
    await loadComponent('topbar-container', '/assets/components/topbar.html');
    await loadComponent('sidebar-container', '/assets/components/sidebar.html');
    await loadComponent('nav-container', '/assets/components/floating-nav.html');

    // 2. Identify Elements
    const sidebar = document.getElementById('wolfSidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const moreBtn = document.getElementById('moreNavBtn'); 
    const closeBtn = document.getElementById('sidebarClose'); 

    // 3. LOGOUT / DISCONNECT LOGIC (Multi-device support)
    const logoutButtons = document.querySelectorAll('.logout-btn');
    
    logoutButtons.forEach(btn => {
        btn.onclick = async (e) => {
            e.preventDefault();
            
            // Visual feedback
            const originalText = btn.textContent;
            btn.textContent = "DISCONNECTING...";
            btn.style.opacity = "0.5";

            const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
            const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
            const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

            try {
                await supabase.auth.signOut();
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace("/index.html");
            } catch (err) {
                console.error("Logout failed:", err);
                window.location.replace("/index.html");
            }
        };
    });

    // 4. CLEAN SIDEBAR TOGGLE LOGIC
    const toggleSidebar = () => {
       
        // Find state
        const isActive = sidebar.classList.toggle('active');
        const isMobile = window.innerWidth < 768;
        const icon = document.getElementById('closeIcon');

        // Toggle a class on the body to shift the main content margin
        document.body.classList.toggle('sidebar-open');
        

        const moreBtn = document.getElementById('moreNavBtn');
        if (moreBtn) {
            moreBtn.classList.toggle('active');
        }


         // Handle Icons & Backdrop
        if (isMobile) {
            // Mobile logic: handle backdrop
            if (backdrop) backdrop.classList.toggle('active', isActive);
            if (icon) icon.className = 'bx bx-menu-alt-left'; // Simple X for mobile
        } else {
            // PC logic: Swap arrow directions
            if (icon) {
                icon.className = isActive ? 'bx bx-chevron-left' : 'bx bx-chevron-right';
            }
        }


        // Toggle the highlight on the "More" button
        if (moreBtn) {
            moreBtn.classList.toggle('sidebar-active');
        }

        // Toggle Backdrop Blur
        if (backdrop) {
            // We only care about the backdrop on Mobile
            if (isMobile && isActive) {
                backdrop.classList.add('active'); 
            } else {
                backdrop.classList.remove('active');
            }
        }
    };

    // 5. ATTACH EVENT LISTENERS
    if (moreBtn) moreBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (backdrop) backdrop.addEventListener('click', toggleSidebar);
}

document.addEventListener('DOMContentLoaded', initUI);