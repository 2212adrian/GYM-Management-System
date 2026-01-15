(function() {
    // --- 1. THE ONLY-DASHBOARD RULE ---
    const url = window.location.href.toLowerCase();
    
    // If the URL DOES NOT contain 'dashboard', kill the script immediately.
    if (!url.includes('dashboard')) {
        console.log("Wolf OS Guard: Not a protected page. Exiting.");
        return; 
    }

    // --- 2. INITIALIZE SUPABASE ---
    const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
    const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    async function checkAccess() {
        console.log("Wolf OS Guard: Verifying credentials for Dashboard...");
        
        const { data: { session }, error } = await supabase.auth.getSession();

        // A. No session? 
        if (error || !session) {
            console.error("Wolf OS Guard: No session found. Redirecting to Login.");
            window.location.replace("pages/unauthorized.html");
            return;
        }

        // B. No Admin Role?
        const role = session.user.user_metadata?.role;
        if (role !== 'admin') {
            console.error("Wolf OS Guard: Role is not Admin. Redirecting to Unauthorized.");
            window.location.replace("pages/unauthorized.html");
            return;
        }

        console.log("Wolf OS Guard: Welcome Admin.");
    }

    checkAccess();

    // Listen for logouts
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            window.location.replace("../index.html");
        }
    });
})();