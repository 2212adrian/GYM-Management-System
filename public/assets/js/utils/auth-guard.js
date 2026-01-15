(async function() {
    // 1. Setup Supabase
    const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
    const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // 2. Define our "One Path" system
    const PATH_LOGIN = "/index.html";
    const PATH_DASHBOARD = "dashboard.html";
    const PATH_UNAUTHORIZED = "/pages/unauthorized.html";

    // Detect where we are
    const path = window.location.pathname;
    const isLoginPage = path === "/" || path.endsWith("index.html");
    const isProtectedPage = path.includes("dashboard.html");
    const isUnauthorizedPage = path.includes("unauthorized.html");

    async function evaluateSecurity() {
        // Get session (Supabase "Cookie")
        const { data: { session } } = await supabase.auth.getSession();
        
        // Ensure we have a user, an email, and the admin role
        const user = session?.user;
        const hasAccess = user && user.email && user.user_metadata?.role === 'admin';

        // --- THE SIMPLE LOGIC ---

        // 1. If I'm on Login and I have a session/email -> GO TO DASHBOARD
        if (isLoginPage && hasAccess) {
            console.log("Wolf OS: Admin detected. Forwarding to Dashboard...");
            window.location.replace(PATH_DASHBOARD);
            return;
        }

        // 2. If I'm on Dashboard and I DON'T have a session -> GO TO UNAUTHORIZED
        if (isProtectedPage && !user) {
            window.location.replace(PATH_UNAUTHORIZED);
            return;
        }

        // 3. If I'm on Dashboard and I have a session but NO email/admin role -> GO TO UNAUTHORIZED
        if (isProtectedPage && !hasAccess) {
            window.location.replace(PATH_UNAUTHORIZED);
            return;
        }

        console.log("Wolf OS Guard: System standing by.");
    }

    // Run immediately
    await evaluateSecurity();

    // Watch for state changes (Logout button or session expiry)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.replace(PATH_LOGIN);
        }
        if (event === 'SIGNED_IN' && isLoginPage) {
            evaluateSecurity(); // Re-run logic if they just logged in
        }
    });
})();