(function initWolfRouter() {
  if (window.wolfRouter) return;

  function isMainShell() {
    return window.location.pathname.toLowerCase().includes('/pages/main.html');
  }

  function isLoginShell() {
    const path = window.location.pathname.toLowerCase();
    return (
      path === '/' ||
      path === '' ||
      path.endsWith('/index.html') ||
      path.endsWith('/index')
    );
  }

  async function softLoad(url, { replace = false } = {}) {
    // Full-document soft swaps with document.write() cause global redeclaration
    // errors for scripts that define top-level const/let. Use real navigation.
    const fullUrl = new URL(url, window.location.origin).toString();
    if (replace) {
      window.location.replace(fullUrl);
      return;
    }
    window.location.assign(fullUrl);
  }

  async function goToMain(page = 'dashboard', opts = {}) {
    const options = {
      replace: true,
      seamless: true,
      ...opts,
    };

    if (isMainShell()) {
      if (typeof window.navigateTo === 'function') {
        await window.navigateTo(page, { updateRoute: true });
        return;
      }

      const url = `/pages/main.html${page ? `?p=${encodeURIComponent(page)}` : ''}`;
      if (options.replace) {
        window.history.replaceState({}, '', url);
      } else {
        window.history.pushState({}, '', url);
      }
      return;
    }

    const target = `/pages/main.html${page ? `?p=${encodeURIComponent(page)}` : ''}`;
    // Cross-shell transition requires real navigation to reset JS runtime scope.
    if (options.replace) window.location.replace(target);
    else window.location.assign(target);
  }

  async function goToLogin(opts = {}) {
    const options = {
      replace: true,
      seamless: true,
      ...opts,
    };

    const target = '/index.html';

    if (isLoginShell()) {
      if (options.replace) {
        window.history.replaceState({}, '', target);
      }
      return;
    }

    // Cross-shell transition requires real navigation to reset JS runtime scope.
    if (options.replace) window.location.replace(target);
    else window.location.assign(target);
  }

  async function refreshCurrent(opts = {}) {
    const options = {
      replace: true,
      ...opts,
    };

    if (isMainShell() && typeof window.navigateTo === 'function') {
      const queryPage = new URLSearchParams(window.location.search).get('p');
      const currentPage =
        window.WOLF_LAST_REQUESTED_PAGE ||
        window.WOLF_CURRENT_PAGE ||
        queryPage ||
        'dashboard';

      await window.navigateTo(currentPage, { updateRoute: false });
      return;
    }

    const current =
      window.location.pathname + window.location.search + window.location.hash;
    if (options.replace) {
      window.location.replace(current);
      return;
    }
    window.location.assign(current);
  }

  window.wolfRouter = {
    goToMain,
    goToLogin,
    refreshCurrent,
    softLoad,
    isMainShell,
    isLoginShell,
  };
})();
