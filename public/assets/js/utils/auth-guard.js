(async function () {
  /**
   * WOLF OS - SECURITY GUARD (REINFORCED)
   * Handles session persistence and dashboard protection.
   */

  // --- 1. WAIT FOR GLOBAL CLIENT ---
  const getClient = async () => {
    if (window.supabaseReady) {
      await window.supabaseReady;
      if (window.supabaseClient) return window.supabaseClient;
    }

    for (let i = 0; i < 20; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise((res) => setTimeout(res, 100));
    }
    return null;
  };

  const db = await getClient();
  if (!db) return;

  const WOLF_ADMIN_EMAILS = new Set([
    'adrianangeles2212@gmail.com',
    'ktorrazo123@gmail.com',
  ]);
  const WOLF_STAFF_EMAILS = new Set(['adrianangeles2213@gmail.com']);

  const normalizeRoleEmail = (email) =>
    String(email || '')
      .trim()
      .toLowerCase();

  const resolveRoleFromUser = (user) => {
    const normalizedEmail = normalizeRoleEmail(user?.email);
    if (!normalizedEmail) return null;
    if (WOLF_ADMIN_EMAILS.has(normalizedEmail)) return 'admin';
    if (WOLF_STAFF_EMAILS.has(normalizedEmail)) return 'staff';
    const appRole = String(user?.app_metadata?.role || '')
      .trim()
      .toLowerCase();
    if (appRole === 'admin' || appRole === 'staff') return appRole;
    return null;
  };

  const applyAccessContext = (user) => {
    const email = normalizeRoleEmail(user?.email);
    const role = resolveRoleFromUser(user);
    const context = {
      email: email || null,
      role,
      isAdmin: role === 'admin',
      isStaff: role === 'staff',
      isAuthorized: role === 'admin' || role === 'staff',
    };

    window.WOLF_USER_EMAIL = context.email;
    window.WOLF_USER_ROLE = context.role;
    window.WOLF_ACCESS_CONTEXT = context;

    return context;
  };

  // --- 2. DEFINE PATHS ---
  const PATH_LOGIN = '/index.html';
  const PATH_MAIN = '/pages/main.html';
  const PATH_UNAUTHORIZED = '/pages/unauthorized.html';

  const seamlessRedirect = async (targetPath) => {
    try {
      if (window.wolfRouter) {
        if (targetPath === PATH_MAIN) {
          await window.wolfRouter.goToMain('dashboard', {
            replace: true,
            seamless: true,
          });
          return;
        }

        if (targetPath === PATH_LOGIN) {
          await window.wolfRouter.goToLogin({
            replace: true,
            seamless: true,
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Wolf OS Guard: Seamless redirect fallback ->', err);
    }

    window.location.replace(targetPath);
  };

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
    const access = applyAccessContext(user);

    if (user && !access.isAuthorized) {
      await db.auth.signOut();
      if (isProtectedPage) {
        window.location.replace(`${PATH_UNAUTHORIZED}?err=102`);
      }
      return;
    }

    // AUTO-FORWARD: If user refreshes index.html while already logged in
    if (isLoginPage && access.isAuthorized) {
      console.log('Wolf OS Guard: Active session found. Forwarding...');
      await seamlessRedirect(PATH_MAIN);
      return;
    }

    // PROTECT: Kick out if trying to access dashboard without session
    if (isProtectedPage && !access.isAuthorized) {
      window.location.replace(`${PATH_UNAUTHORIZED}?err=102`);
      return;
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
      applyAccessContext(session?.user);
      console.log(
        'Wolf OS Guard: Sign-in detected. Deferring to auth.js for animation.',
      );
      return;
    }

    // Handle session restoration (e.g., opening a new tab or refreshing)
    if (event === 'INITIAL_SESSION' && isLoginPage) {
      const user = session?.user;
      const access = applyAccessContext(user);
      if (user && !access.isAuthorized) {
        await db.auth.signOut();
        return;
      }
      if (access.isAuthorized) await seamlessRedirect(PATH_MAIN);
    }

    // Handle global logout
    if (event === 'SIGNED_OUT') {
      applyAccessContext(null);
      sessionStorage.clear();
      // Only redirect if we aren't already on the login page
      if (!isLoginPage) await seamlessRedirect(PATH_LOGIN);
    }
  });
})();
