(async function() {
    // 1. Initialize Supabase
    const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
    const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    /**
     * UTILS: Path Resolver
     * Ensures we redirect to the correct location regardless of current folder
     */
    const getRootPath = () => {
        const isSubPage = window.location.pathname.includes('/pages/');
        return isSubPage ? '../' : './';
    };

    // 2. THE INSTANT CHECK (Runs on load)
    async function checkCurrentSession() {
        // Here, error IS defined because it's returned by getSession()
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
            console.error("Wolf OS: No valid session found.");
            redirectToLogin();
            return;
        }

        // ROLE VALIDATION
        const role = session.user.user_metadata?.role;
        if (role !== 'admin') {
            console.warn("Wolf OS: Unauthorized role detected:", role);
            window.location.replace(getRootPath() + "pages/unauthorized.html");
            return;
        }
        
        console.log("Wolf OS: Access Granted. Verified:", session.user.email);
    }

    function redirectToLogin() {
        // Redirects to index.html at the root
        window.location.replace(getRootPath() + "index.html");
    }

    // Run the instant check
    await checkCurrentSession();

    // 3. THE REAL-TIME LISTENER (Monitors for Logouts)
    // Removed 'error' here as Supabase does not provide it in this callback
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Wolf OS Auth Event:", event);
        
        // If the user signs out or the session expires/is deleted
        if (event === 'SIGNED_OUT' || !session) {
            console.error("Wolf OS: Session terminated.");
            redirectToLogin();
        }

        // Optional: If metadata changes and role is lost
        if (session && session.user.user_metadata?.role !== 'admin') {
            window.location.replace(getRootPath() + "pages/unauthorized.html");
        }
    });

})();