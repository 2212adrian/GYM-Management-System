// --- THEME MANAGER ---

const themeManager = {
    init() {
        const savedTheme = localStorage.getItem('wolf-theme');
        // If the user previously chose light theme, apply it immediately
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        }
    },

    toggle() {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('wolf-theme', isLight ? 'light' : 'dark');
        console.log(`Wolf OS: Theme set to ${isLight ? 'Light' : 'Dark'}`);
    }
};

// Initialize immediately to prevent "white flash"
themeManager.init();