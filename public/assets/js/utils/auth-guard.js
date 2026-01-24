(async function () {
  /**
   * WOLF OS - SECURITY GUARD (REINFORCED)
   * Handles session persistence and dashboard protection.
   */

  // --- 1. WAIT FOR GLOBAL CLIENT ---
  const getClient = async () => {
    for (let i = 0; i < 20; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise((res) => setTimeout(res, 100));
    }
    return null;
  };

  const db = await getClient();
  if (!db) return;

  // --- 2. DEFINE PATHS ---
  const PATH_LOGIN = '/index.html';
  const PATH_MAIN = '/pages/main.html';
  const PATH_UNAUTHORIZED = '/pages/unauthorized.html';

  const fullPath = window.location.pathname.toLowerCase();

  const isLoginPage =
    fullPath === '/' ||
    fullPath === '' ||
    fullPath.endsWith('index.html') ||
    fullPath.endsWith('/index');

  const isProtectedPage =
    fullPath.includes('/pages/main') ||
    fullPath.includes('/pages/dashboard') ||
    (fullPath.includes('/pages/') && !fullPath.includes('unauthorized'));

  // --- 3. CORE SECURITY ENGINE ---
  async function evaluateSecurity() {
    // This runs ONCE when the script loads (e.g., on page refresh)
    const {
      data: { session },
    } = await db.auth.getSession();

    const user = session?.user;
    const isAdmin = user && user.user_metadata?.role === 'admin';

    // AUTO-FORWARD: If user refreshes index.html while already logged in
    if (isLoginPage && user && isAdmin) {
      console.log('Wolf OS Guard: Active session found. Forwarding...');
      window.location.replace(PATH_MAIN);
      return;
    }

    // PROTECT: Kick out if trying to access dashboard without session
    if (isProtectedPage) {
      if (!user) {
        window.location.replace(`${PATH_UNAUTHORIZED}?err=102`);
        return;
      }
      if (!isAdmin) {
        window.location.replace(`${PATH_UNAUTHORIZED}?err=102`);
        return;
      }
    }
  }

  // Run initial check
  await evaluateSecurity();

  // --- 4. REAL-TIME LISTENER ---
  db.auth.onAuthStateChange(async (event, session) => {
    console.log('Guard Event:', event);

    /**
     * THE CINEMATIC FIX:
     * If a user just signed in while on the login page, DO NOTHING.
     * This prevents the guard from jumping to main.html instantly,
     * allowing auth.js to play the exit animation first.
     */
    if (event === 'SIGNED_IN' && isLoginPage) {
      console.log(
        'Wolf OS Guard: Sign-in detected. Deferring to auth.js for animation.',
      );
      return;
    }

    // Handle session restoration (e.g., opening a new tab or refreshing)
    if (event === 'INITIAL_SESSION' && isLoginPage) {
      const user = session?.user;
      const isAdmin = user && user.user_metadata?.role === 'admin';
      if (isAdmin) window.location.replace(PATH_MAIN);
    }

    // Handle global logout
    if (event === 'SIGNED_OUT') {
      sessionStorage.clear();
      // Only redirect if we aren't already on the login page
      if (!isLoginPage) window.location.replace(PATH_LOGIN);
    }
  });
})();
