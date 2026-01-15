(async function() {
    // 1. Initialize Supabase
    const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
    const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // 2. THE INSTANT CHECK (Runs as soon as the file loads)
    async function checkCurrentSession() {
        const { data: { session }, error } = await supabase.auth.getSession();

        // Handle no session / error
        if (error || !session) {
            console.error("Wolf OS: Unauthorized. Redirecting to restricted screen...");
            // Update path to point to your new page
            window.location.replace("/pages/unauthorized.html"); 
            return;
        }

        // Check Role
        //const role = session.user.user_metadata.role;
        //if (role !== 'admin') {
        //    alert("Wolf OS Error: Admin Credentials Required.");
        //    window.location.replace("../index.html");
        //    return;
        //}
        
        console.log("Wolf OS: Session Valid. Welcome, " + session.user.email);
    }

    // Run the instant check
    await checkCurrentSession();

    // 3. THE REAL-TIME LISTENER (Monitors for Logouts)
    // This triggers the moment you click "Disconnect" or if the session expires
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Wolf OS Auth Event:", event);
        
        if (error || !session) {
            console.error("Wolf OS: Unauthorized. Redirecting to restricted screen...");
            // Update path to point to your new page
            window.location.replace("/pages/unauthorized.html"); 
            return;
        }
    });

})();