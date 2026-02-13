// --- WOLF OS AUDIO ENGINE ---
window.wolfAudio = {
  success: new Audio('/assets/sounds/success.mp3'),
  error: new Audio('/assets/sounds/error.mp3'),
  denied: new Audio('/assets/sounds/rejected.wav'),
  notif: new Audio('/assets/sounds/notif.mp3'),
  click: new Audio('/assets/sounds/click.mp3'),
  confetti: new Audio('/assets/sounds/surprise-confetti.mp3'),
  bgm: new Audio('/assets/sounds/intro.mp3'),
  woosh: new Audio('/assets/sounds/woosh-large-sub.mp3'),
  logoff: new Audio('/assets/sounds/log-off.mp3'),
  swipe: new Audio('/assets/sounds/swipe.mp3'),
  isMuted: localStorage.getItem('wolf-bgm-muted') === 'true',
  clickHookBound: false,
  lastClickSfxAt: 0,

  init() {
    this.bgm.loop = true;
    this.bgm.volume = 0.15;

    const startBGM = () => {
      if (!this.isMuted) this.bgm.play().catch(() => {});
      document.removeEventListener('click', startBGM);
    };
    document.addEventListener('click', startBGM);
    this.bindGlobalClickSfx();
  },

  bindGlobalClickSfx() {
    if (this.clickHookBound) return;
    this.clickHookBound = true;
    const selector = [
      'button',
      'input[type="button"]',
      'input[type="submit"]',
      'input[type="reset"]',
      '[role="button"]',
      '.btn',
      '.icon-btn',
      '.toggle',
      '.hub-card',
      '.nav-item-side',
      '.nav-item',
      '.sidebar-link',
      '[data-page]',
      '#moreNavBtn',
      '#themeToggleBtn',
      '#muteToggleBtn',
    ].join(',');

    const playClickIfTargeted = (event) => {
      const control = event.target?.closest?.(selector);
      if (!control) return;
      const now = Date.now();
      if (now - this.lastClickSfxAt < 220) return;
      this.lastClickSfxAt = now;
      this.play('click');
    };

    // Capture phase so sound still plays even if downstream handlers stop propagation.
    // Pointerdown only: one physical press should produce one click SFX.
    document.addEventListener('pointerdown', playClickIfTargeted, {
      passive: true,
      capture: true,
    });
  },

  play(type) {
    if (localStorage.getItem('wolf_action_sounds_muted') === 'true') return;
    const sound = this[type];
    if (!sound) return;
    sound.currentTime = 0;
    sound.volume = type === 'click' ? 0.28 : 0.4;
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
    icons.forEach((icon) => {
      icon.className = this.isMuted ? 'bx bx-volume-mute' : 'bx bx-volume-full';
    });

    const text = document.querySelectorAll('#muteToggleBtn .nav-text');
    text.forEach(
      (t) => (t.textContent = this.isMuted ? 'AUDIO: OFF' : 'AUDIO: ON'),
    );
  },
};

wolfAudio.init();

// Start listener immediately
window.wolfAudio.init();
