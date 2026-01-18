// --- WOLF OS AUDIO ENGINE ---
window.wolfAudio = {
    success: new Audio('/assets/sounds/success.wav'),
    error:   new Audio('/assets/sounds/error.mp3'),
    denied:  new Audio('/assets/sounds/rejected.wav'),
    notif:   new Audio('/assets/sounds/notif.wav'),
    bgm:     new Audio('/assets/sounds/intro.mp3'),
    
    isMuted: localStorage.getItem('wolf-bgm-muted') === 'true',

    init() {
        this.bgm.loop = true;
        this.bgm.volume = 0.15;

        const startBGM = () => {
            if (!this.isMuted) this.bgm.play().catch(() => {});
            document.removeEventListener('click', startBGM);
        };
        document.addEventListener('click', startBGM);
    },

    play(type) {
        const sound = this[type];
        if (!sound) return;
        sound.currentTime = 0;
        sound.volume = 0.4;
        sound.play().catch(() => {});
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('wolf-bgm-muted', this.isMuted);
        
        if (this.isMuted) {
            this.bgm.pause();
        } else {
            this.bgm.play().catch(() => {});
        }

        // Trigger icon update across all UI components
        this.updateIcons();
        return this.isMuted;
    },

    updateIcons() {
        const icons = document.querySelectorAll('#muteToggleBtn i');
        icons.forEach(icon => {
            icon.className = this.isMuted ? 'bx bx-volume-mute' : 'bx bx-volume-full';
        });
        
        const text = document.querySelectorAll('#muteToggleBtn .nav-text');
        text.forEach(t => t.textContent = this.isMuted ? 'AUDIO: OFF' : 'AUDIO: ON');
    }
};

wolfAudio.init();

// Start listener immediately
window.wolfAudio.init();