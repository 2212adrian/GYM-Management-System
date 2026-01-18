(function () {
    /**
     * This page is an internal view.
     * If opened directly (top-level document), redirect to shell.
     */
    if (window.self === window.top) {
        document.documentElement.style.display = 'none';
        window.location.replace('/pages/main.html?p=logbook');
    }
})();