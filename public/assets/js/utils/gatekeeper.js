(function () {
  /**
   * This page is an internal view.
   * If opened directly (top-level document), redirect to shell.
   */
  if (window.self === window.top) {
    document.documentElement.style.display = 'none';

    if (window.wolfRouter && typeof window.wolfRouter.goToMain === 'function') {
      window.wolfRouter.goToMain('logbook', { replace: true, seamless: true });
      return;
    }

    window.location.replace('/pages/main.html?p=logbook');
  }
})();
