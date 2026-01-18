(async function() {
    // 1. Setup Supabase with Mobile-optimized flags
    const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
    const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
    
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });

    // 2. Define Absolute Paths
    const PATH_LOGIN = "/index.html";
    const PATH_MAIN = "/pages/main.html";
    const PATH_UNAUTHORIZED = "/pages/unauthorized.html";

    // 3. Normalize Environment Detection (Supports Pretty URLs)
    const fullPath = window.location.pathname.toLowerCase();
    const cleanPath = fullPath.replace(/\.html$/, ''); 

    const isLoginPage = cleanPath === "/" || cleanPath === "/index" || cleanPath === "";
    const isProtectedPage = cleanPath.includes("main") || cleanPath.includes("/pages/");

    // --- UTILS: IP SECURITY ---
    async function getTerminalIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch { return "unknown_terminal"; }
    }

    async function checkIPLockout(ip) {
        const { data } = await supabase.from('login_attempts').select('*').eq('ip_address', ip).single();
        
        if (data && data.attempts >= 5) {
            const diff = (Date.now() - new Date(data.last_attempt_at).getTime()) / 1000;
            const remaining = Math.ceil(600 - diff); // 10 minutes (600s)
            if (remaining > 0) return remaining;
        }
        return 0;
    }

    // --- CORE SECURITY ENGINE ---
    async function evaluateSecurity() {
        const userIP = await getTerminalIP();
        const { data: { session } } = await supabase.auth.getSession();
        
        const user = session?.user;
        const isAdmin = user && user.user_metadata?.role === 'admin';

        // RULE 1: IP LOCKOUT PROTECTION [ERR_403]
        const lockoutSeconds = await checkIPLockout(userIP);
        if (lockoutSeconds > 0) {
            console.warn(`[ERR_403] Terminal Locked: ${userIP}`);
            if (isProtectedPage || isLoginPage) {
                window.location.replace(`${PATH_UNAUTHORIZED}?err=403&time=${lockoutSeconds}`);
                return;
            }
        }

        // RULE 2: ACCESS REDIRECTS (Already Logged In)
        if (isLoginPage && user && isAdmin) {
            console.log("Wolf OS: Session active. Accessing Main Panel...");
            window.location.replace(PATH_MAIN);
            return;
        }

        // RULE 3: PROTECTED AREA VALIDATION
        if (isProtectedPage) {
            if (!user) {
                console.error("[ERR_101] No session detected.");
                window.location.replace(`${PATH_UNAUTHORIZED}?err=101`);
                return;
            }
            if (!isAdmin) {
                console.error("[ERR_102] Administrative privileges required.");
                window.location.replace(`${PATH_UNAUTHORIZED}?err=102`);
                return;
            }
        }

        console.log("Wolf OS Guard: Terminal Secure.");
    }

    // Run Logic
    await evaluateSecurity();

    // 4. THE REAL-TIME LISTENER (Kicks out instantly on logout)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace(PATH_LOGIN);
        }
    });

})();