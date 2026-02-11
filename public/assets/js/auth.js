// --- IMPORT DOMPURIFY FOR SANITIZATION ---
DOMPurify.setConfig({
  FORBID_TAGS: ['img', 'svg', 'script', 'style'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload'],
});

function safeHTML(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['br', 'span', 'i'],
    ALLOWED_ATTR: ['class'],
  });
}

// --- 1. INITIALIZE SUPABASE ---
let supabaseClient = window.supabaseClient || null;

async function ensureSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (window.supabaseReady) {
    await window.supabaseReady;
  }
  supabaseClient = window.supabaseClient || null;
  if (!supabaseClient) {
    throw new Error('Supabase client is not available');
  }
  return supabaseClient;
}

// --- 2. CONFIGURATION ---
const MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 5;
const OTP_CLICK_SPAM_WINDOW_MS = 1000;
const OTP_CLICK_SPAM_THRESHOLD = 3;
const OTP_CLICK_SPAM_LOCK_SECONDS = 30;
const OTP_COOLDOWN_STORAGE_KEY = 'wolf_otp_cooldown_ends_at';
const REMEMBER_DEVICE_KEY = 'wolf_remember_device';
const QUICK_LOGIN_QR_CACHE_KEY = 'wolf_quick_login_qr_cache';
const QUICK_LOGIN_POLL_MS = 1800;
const QUICK_LOGIN_EXPIRE_FALLBACK_SECONDS = 120;
const QUICK_LOGIN_REGEN_COOLDOWN_FALLBACK_SECONDS = 8;
const typewriterWords = [
  'Beyond Strength',
  'Beyond Limit',
  'Wolf Palomar',
  'Secure. Reliable. Fast.',
];

let wordIdx = 0;
let charIdx = 0;
let isDeleting = false;

function typeCarousel() {
  const typewriterEl = document.getElementById('typewriterText');
  if (!typewriterEl) return;

  const currentFullText = typewriterWords[wordIdx];

  // Determine the text to display
  let displayText = currentFullText.substring(0, charIdx);

  // Apply your specific design: Split by space and wrap second word in <span>
  if (displayText.includes(' ')) {
    const parts = displayText.split(' ');
    typewriterEl.innerHTML = safeHTML(
      `${parts[0]} <br> <span>${parts[1]}</span>`,
    );
  } else {
    typewriterEl.innerHTML = displayText;
  }

  // Logic for typing speed
  let typeSpeed = isDeleting ? 50 : 150;

  if (!isDeleting && charIdx === currentFullText.length) {
    // Pause at the end of the word for 3 seconds as requested
    typeSpeed = 3000;
    isDeleting = true;
  } else if (isDeleting && charIdx === 0) {
    isDeleting = false;
    // Move to next word
    wordIdx = (wordIdx + 1) % typewriterWords.length;
    typeSpeed = 500;
  }

  // Adjust char index for next frame
  if (isDeleting) {
    charIdx--;
  } else {
    charIdx++;
  }

  setTimeout(typeCarousel, typeSpeed);
}

// --- UTILS: LOGIN LOCKOUT TIMER ---
let loginTimerInterval = null;
let loginOutputHideTimer = null;
let loginOutputHideAnimationTimer = null;
const resetOutputHideTimers = new WeakMap();
const resetOutputHideAnimationTimers = new WeakMap();

// --- UTILS: GET IP ---
async function getClientIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch {
    return 'unknown_device';
  }
}

function isRememberDeviceEnabled() {
  try {
    if (window.wolfAuthStorage?.shouldRememberDevice) {
      return Boolean(window.wolfAuthStorage.shouldRememberDevice());
    }
    return window.localStorage.getItem(REMEMBER_DEVICE_KEY) === '1';
  } catch {
    return false;
  }
}

function setRememberDeviceEnabled(enabled) {
  try {
    if (window.wolfAuthStorage?.setRememberDevice) {
      window.wolfAuthStorage.setRememberDevice(Boolean(enabled));
      return;
    }
    if (enabled) {
      window.localStorage.setItem(REMEMBER_DEVICE_KEY, '1');
    } else {
      window.localStorage.removeItem(REMEMBER_DEVICE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

function shakeField(el) {
  if (!el) return;
  el.classList.remove('shake-error');
  void el.offsetWidth;
  el.classList.add('shake-error');

  setTimeout(() => {
    el.classList.remove('shake-error');
  }, 420);
}

function hideLoginOutput(immediate = false) {
  const loginOutput = document.getElementById('loginOutput');
  if (!loginOutput) return;

  if (loginOutputHideTimer) {
    clearTimeout(loginOutputHideTimer);
    loginOutputHideTimer = null;
  }
  if (loginOutputHideAnimationTimer) {
    clearTimeout(loginOutputHideAnimationTimer);
    loginOutputHideAnimationTimer = null;
  }

  if (immediate) {
    loginOutput.classList.remove('is-entering', 'is-hiding', 'is-visible');
    loginOutput.textContent = '';
    return;
  }

  loginOutput.classList.remove('is-entering');
  loginOutput.classList.add('is-hiding');

  loginOutputHideAnimationTimer = setTimeout(() => {
    loginOutput.classList.remove('is-hiding', 'is-visible');
    loginOutput.textContent = '';
    loginOutputHideAnimationTimer = null;
  }, 220);
}

function showLoginOutput(
  message,
  {
    color = 'var(--wolf-red)',
    html = false,
    autoHide = true,
    duration = 5000,
    animate = true,
  } = {},
) {
  const loginOutput = document.getElementById('loginOutput');
  if (!loginOutput) return;

  if (loginOutputHideTimer) {
    clearTimeout(loginOutputHideTimer);
    loginOutputHideTimer = null;
  }
  if (loginOutputHideAnimationTimer) {
    clearTimeout(loginOutputHideAnimationTimer);
    loginOutputHideAnimationTimer = null;
  }

  loginOutput.style.color = color;
  loginOutput.classList.remove('is-hiding');
  if (html) {
    loginOutput.innerHTML = message;
  } else {
    loginOutput.textContent = message;
  }

  if (animate) {
    loginOutput.classList.remove('is-visible', 'is-entering');
    void loginOutput.offsetWidth;
    loginOutput.classList.add('is-visible', 'is-entering');
    setTimeout(() => {
      loginOutput.classList.remove('is-entering');
    }, 260);
  } else {
    loginOutput.classList.remove('is-entering');
    loginOutput.classList.add('is-visible');
  }

  if (autoHide) {
    loginOutputHideTimer = setTimeout(() => {
      hideLoginOutput(false);
      loginOutputHideTimer = null;
    }, duration);
  }
}

function getResetOutputElement(preferredElement = null) {
  if (preferredElement) return preferredElement;

  const step1Output = document.querySelector('#recoveryStep1 #resetOutput');
  const step2Output = document.querySelector('#recoveryStep2 #resetOutput');

  if (step2Output && step2Output.offsetParent !== null) return step2Output;
  if (step1Output) return step1Output;
  if (step2Output) return step2Output;

  return document.getElementById('resetOutput');
}

function clearResetOutputTimers(outputEl) {
  const hideTimer = resetOutputHideTimers.get(outputEl);
  if (hideTimer) {
    clearTimeout(hideTimer);
    resetOutputHideTimers.delete(outputEl);
  }

  const animTimer = resetOutputHideAnimationTimers.get(outputEl);
  if (animTimer) {
    clearTimeout(animTimer);
    resetOutputHideAnimationTimers.delete(outputEl);
  }
}

function hideResetOutput({ immediate = false, targetEl = null } = {}) {
  const outputEl = getResetOutputElement(targetEl);
  if (!outputEl) return;

  clearResetOutputTimers(outputEl);

  if (immediate) {
    outputEl.classList.remove('is-entering', 'is-hiding', 'is-visible');
    outputEl.textContent = '';
    return;
  }

  outputEl.classList.remove('is-entering');
  outputEl.classList.add('is-hiding');

  const animTimer = setTimeout(() => {
    outputEl.classList.remove('is-hiding', 'is-visible');
    outputEl.textContent = '';
    resetOutputHideAnimationTimers.delete(outputEl);
  }, 220);
  resetOutputHideAnimationTimers.set(outputEl, animTimer);
}

function showResetOutput(
  message,
  {
    color = 'var(--wolf-red)',
    autoHide = false,
    duration = 5000,
    animate = true,
    targetEl = null,
  } = {},
) {
  const outputEl = getResetOutputElement(targetEl);
  if (!outputEl) return;

  clearResetOutputTimers(outputEl);

  outputEl.style.color = color;
  outputEl.classList.remove('is-hiding');
  outputEl.textContent = message;

  if (animate) {
    outputEl.classList.remove('is-visible', 'is-entering');
    void outputEl.offsetWidth;
    outputEl.classList.add('is-visible', 'is-entering');
    const animTimer = setTimeout(() => {
      outputEl.classList.remove('is-entering');
      resetOutputHideAnimationTimers.delete(outputEl);
    }, 260);
    resetOutputHideAnimationTimers.set(outputEl, animTimer);
  } else {
    outputEl.classList.remove('is-entering');
    outputEl.classList.add('is-visible');
  }

  if (autoHide) {
    const hideTimer = setTimeout(() => {
      hideResetOutput({ immediate: false, targetEl: outputEl });
      resetOutputHideTimers.delete(outputEl);
    }, duration);
    resetOutputHideTimers.set(outputEl, hideTimer);
  }
}

function startLoginCountdown(seconds) {
  if (loginTimerInterval) clearInterval(loginTimerInterval);
  const loginBtn = document.getElementById('loginBtn');

  const updateUI = (secs) => {
    if (secs <= 0) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'AUTHORIZE ACCESS';
      hideLoginOutput(true);
      clearInterval(loginTimerInterval);
      return;
    }
    loginBtn.disabled = true;
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    loginBtn.textContent = `LOCKED: ${mins}m ${remainingSecs}s`;
    showLoginOutput('[ERR_403] Security protocol active. Terminal locked.', {
      color: 'var(--wolf-red)',
      autoHide: false,
      animate: false,
    });
  };

  let timeLeft = seconds;
  updateUI(timeLeft);
  loginTimerInterval = setInterval(() => {
    timeLeft--;
    updateUI(timeLeft);
  }, 1000);
}

// --- UTILS: CHECK DATABASE LOCKOUT ---
async function checkLoginLockoutStatus() {
  await ensureSupabaseClient();
  const userIP = await getClientIP();
  const { data: log } = await supabaseClient
    .from('login_attempts')
    .select('*')
    .eq('ip_address', userIP)
    .maybeSingle();

  if (log) {
    const diff = (Date.now() - new Date(log.last_attempt_at).getTime()) / 60000;

    // If they hit max attempts and are still within the 5-minute window
    if (log.attempts >= MAX_ATTEMPTS && diff < LOGIN_LOCKOUT_MINUTES) {
      const remainingSeconds = Math.ceil((LOGIN_LOCKOUT_MINUTES - diff) * 60);
      startLoginCountdown(remainingSeconds);
      return true;
    }
    // If 5 minutes passed, reset their record
    else if (diff >= LOGIN_LOCKOUT_MINUTES) {
      await supabaseClient
        .from('login_attempts')
        .delete()
        .eq('ip_address', userIP);
    }
  }
  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await ensureSupabaseClient();
  } catch (err) {
    showLoginOutput(
      '[ERR_503] Secure database handshake failed. Try again later.',
    );
    return;
  }

  const inner = document.getElementById('flipCardInner');
  const recoveryContainer = document.getElementById('recoveryContainer');
  const exitModal = document.getElementById('confirmExitModal');
  const container = document.querySelector('.auth-split-container');
  let otpTimerInterval = null;
  let otpCooldownEndsAt = 0;
  let otpRapidClickTimestamps = [];
  let quickLoginPollTimer = null;
  let quickLoginClockTimer = null;
  let quickLoginRefreshTimer = null;
  let quickLoginRefreshEndsAt = 0;
  let quickLoginActiveRequest = null;
  let quickLoginIsRequesting = false;

  const quickLoginModal = document.getElementById('quickLoginModal');
  const quickLoginLaunchBtn = document.getElementById('quickLoginLaunch');
  const quickLoginCloseBtn = document.getElementById('quickLoginClose');
  const quickLoginBackdrop = document.getElementById('quickLoginBackdrop');
  const quickLoginRefreshBtn = document.getElementById('quickLoginRefresh');
  const quickLoginStatusEl = document.getElementById('quickLoginStatus');
  const quickLoginRefEl = document.getElementById('quickLoginRef');
  const quickLoginTimerEl = document.getElementById('quickLoginTimer');
  const quickLoginCanvas = document.getElementById('quickLoginQrCanvas');

  // --- DYNAMIC STAR GENERATOR ---

  setTimeout(() => {
    container.classList.add('is-ready');

    // Play a "System Boot" sound if you have one
    if (window.wolfAudio) window.wolfAudio.play('notif');
  }, 100);
  //createStars();
  typeCarousel();

  async function runAdminBootSequence() {
    const card = document.querySelector('.flip-card');

    // ------------------------------------------
    // PHASE 1: IDENTITY HANDSHAKE (Intro Anim)
    // ------------------------------------------
    container.classList.add('auth-verifying');
    showLoginOutput(
      safeHTML(
        "<i class='bx bx-loader-alt bx-spin'></i> LOGIN SUCCESSFUL. INITIATING SYSTEM...",
      ),
      {
        color: 'var(--wolf-blue)',
        html: true,
        autoHide: false,
      },
    );

    if (window.wolfAudio) window.wolfAudio.play('notif');

    setTimeout(async () => {
      // ------------------------------------------
      // PHASE 2: TERMINAL EXIT (Outro Anim + Canvas Warp)
      // ------------------------------------------
      window.WOLF_IS_ANIMATING_OUT = true;

      // Clear lockout record
      const userIP = await getClientIP();
      await supabaseClient
        .from('login_attempts')
        .delete()
        .eq('ip_address', userIP);

      if (window.wolfAudio) {
        wolfAudio.play('woosh');
        wolfAudio.play('success');
      }

      // Add outro classes for flip-card and container
      if (container) container.classList.add('outro');
      if (card) card.classList.add('outro');

      showLoginOutput(
        safeHTML(
          "<i class='bx bx-check-shield'></i> ACCESS GRANTED. BOOTING SYSTEM...",
        ),
        {
          color: '#4ade80',
          html: true,
          autoHide: false,
        },
      );

      // --- TRIGGER CANVAS STAR WARP ---
      if (window.triggerStarWarp) {
        window.triggerStarWarp();
      }

      // Final Redirect
      setTimeout(() => {
        if (
          window.wolfRouter &&
          typeof window.wolfRouter.goToMain === 'function'
        ) {
          window.wolfRouter.goToMain('dashboard', {
            replace: true,
            seamless: true,
          });
        } else {
          window.location.replace('/pages/main.html');
        }
      }, 5000);
    }, 1200);
  }

  function setQuickLoginStatus(message, tone = 'info') {
    if (!quickLoginStatusEl) return;
    quickLoginStatusEl.textContent = message;
    quickLoginStatusEl.classList.remove('is-error', 'is-success');
    if (tone === 'error') quickLoginStatusEl.classList.add('is-error');
    if (tone === 'success') quickLoginStatusEl.classList.add('is-success');
  }

  function clearQuickLoginTimers() {
    if (quickLoginPollTimer) {
      clearInterval(quickLoginPollTimer);
      quickLoginPollTimer = null;
    }
    if (quickLoginClockTimer) {
      clearInterval(quickLoginClockTimer);
      quickLoginClockTimer = null;
    }
  }

  function readQuickLoginQrCache() {
    try {
      const raw = localStorage.getItem(QUICK_LOGIN_QR_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function clearQuickLoginQrCache() {
    try {
      localStorage.removeItem(QUICK_LOGIN_QR_CACHE_KEY);
    } catch (_) {
      // ignore storage failures
    }
  }

  function getValidQuickLoginQrCache() {
    const cached = readQuickLoginQrCache();
    if (!cached) return null;

    const expiresAtMs = cached.expiresAt ? new Date(cached.expiresAt).getTime() : 0;
    if (expiresAtMs > 0 && expiresAtMs <= Date.now()) {
      clearQuickLoginQrCache();
      return null;
    }

    return cached;
  }

  function saveQuickLoginQrCache(payload) {
    try {
      localStorage.setItem(QUICK_LOGIN_QR_CACHE_KEY, JSON.stringify(payload));
    } catch (_) {
      // ignore storage failures
    }
  }

  function setQuickLoginRefreshLabel(label, iconClass = 'bx bx-refresh') {
    if (!quickLoginRefreshBtn) return;
    quickLoginRefreshBtn.innerHTML = `<i class="${iconClass}"></i><span>${label}</span>`;
  }

  function clearQuickLoginRefreshCooldown(resetLabel = true) {
    if (quickLoginRefreshTimer) {
      clearInterval(quickLoginRefreshTimer);
      quickLoginRefreshTimer = null;
    }
    quickLoginRefreshEndsAt = 0;

    if (!quickLoginRefreshBtn) return;
    if (!quickLoginIsRequesting) {
      quickLoginRefreshBtn.disabled = false;
    }
    if (resetLabel) {
      setQuickLoginRefreshLabel('Regenerate QR', 'bx bx-refresh');
    }
  }

  function startQuickLoginRefreshCooldown(seconds) {
    const safeSeconds = Math.max(0, Number(seconds || 0));
    if (safeSeconds <= 0) {
      clearQuickLoginRefreshCooldown(true);
      return;
    }

    if (quickLoginRefreshTimer) {
      clearInterval(quickLoginRefreshTimer);
      quickLoginRefreshTimer = null;
    }

    quickLoginRefreshEndsAt = Date.now() + safeSeconds * 1000;

    const render = () => {
      const remaining = Math.max(
        0,
        Math.ceil((quickLoginRefreshEndsAt - Date.now()) / 1000),
      );

      if (!quickLoginRefreshBtn) return;

      if (remaining <= 0) {
        clearQuickLoginRefreshCooldown(true);
        return;
      }

      quickLoginRefreshBtn.disabled = true;
      setQuickLoginRefreshLabel(
        `Regenerate in ${remaining}s`,
        'bx bx-time-five',
      );
    };

    render();
    quickLoginRefreshTimer = setInterval(render, 1000);
  }

  function updateQuickLoginTimer(expiryIso) {
    const fallbackMs = Date.now() + QUICK_LOGIN_EXPIRE_FALLBACK_SECONDS * 1000;
    const expiryMs = expiryIso ? new Date(expiryIso).getTime() : fallbackMs;

    const render = () => {
      const remain = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      if (quickLoginTimerEl) quickLoginTimerEl.textContent = `${remain}s`;

      if (remain <= 0) {
        clearQuickLoginTimers();
        setQuickLoginStatus(
          'QR session expired. Regenerate to continue.',
          'error',
        );
      }
    };

    render();
    quickLoginClockTimer = setInterval(render, 1000);
  }

  async function renderQuickLoginQr(qrValue) {
    if (!quickLoginCanvas) return;
    quickLoginCanvas.classList.remove('is-ready');
    const qrCanvasSize = window.matchMedia('(max-width: 640px)').matches
      ? 300
      : 340;

    if (window.QRCode?.toCanvas) {
      await window.QRCode.toCanvas(quickLoginCanvas, qrValue, {
        width: qrCanvasSize,
        margin: 1,
        errorCorrectionLevel: 'L',
        color: {
          dark: '#0f1012',
          light: '#ffffff',
        },
      });

      quickLoginCanvas.classList.add('is-ready');
      return;
    }

    if (typeof window.qrcode !== 'function') {
      throw new Error('QR renderer is not available. Reload and try again.');
    }

    const qr = window.qrcode(0, 'M');
    qr.addData(String(qrValue || ''));
    qr.make();

    const ctx = quickLoginCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('QR canvas context is unavailable');
    }

    const canvasSize = qrCanvasSize;
    const margin = 6;
    const moduleCount = qr.getModuleCount();
    const innerSize = canvasSize - margin * 2;

    quickLoginCanvas.width = canvasSize;
    quickLoginCanvas.height = canvasSize;
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = '#0f1012';

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (!qr.isDark(row, col)) continue;
        const x = margin + Math.floor((col * innerSize) / moduleCount);
        const y = margin + Math.floor((row * innerSize) / moduleCount);
        const w =
          Math.ceil(((col + 1) * innerSize) / moduleCount) -
          Math.floor((col * innerSize) / moduleCount);
        const h =
          Math.ceil(((row + 1) * innerSize) / moduleCount) -
          Math.floor((row * innerSize) / moduleCount);
        ctx.fillRect(x, y, w, h);
      }
    }

    quickLoginCanvas.classList.add('is-ready');
  }

  async function createQuickLoginRequest(forceNew = false) {
    if (!quickLoginModal || quickLoginIsRequesting) return;
    quickLoginIsRequesting = true;

    try {
      if (quickLoginRefreshBtn) {
        quickLoginRefreshBtn.disabled = true;
        setQuickLoginRefreshLabel('Generating...', 'bx bx-loader-alt bx-spin');
      }

      setQuickLoginStatus('Generating one-time QR session...', 'info');
      clearQuickLoginTimers();
      const cachedQuickLogin = getValidQuickLoginQrCache();
      const cachedPreviewContext = cachedQuickLogin?.previewContext || null;
      const cachedPreviewSig = cachedQuickLogin?.previewSig || null;

      const res = await fetch('/.netlify/functions/quick-login-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceNew: Boolean(forceNew),
          cachedPreviewContext,
          cachedPreviewSig,
        }),
      });

      let payload = {};
      try {
        payload = await res.json();
      } catch (_) {
        payload = {};
      }

      if (!res.ok) {
        if (res.status === 429) {
          const waitFor = Number(payload.remainingTime || 0);
          if (waitFor > 0) {
            startQuickLoginRefreshCooldown(waitFor);
          }
        }
        throw new Error(
          payload.error || 'Unable to create quick login request',
        );
      }

      let effectiveQrValue = payload.qrValue;
      let effectivePreviewContext = payload.previewContext || null;
      let effectivePreviewSig = payload.previewSig || null;

      if (
        (!effectivePreviewContext || !effectivePreviewSig) &&
        cachedQuickLogin &&
        cachedQuickLogin.requestId === payload.requestId &&
        cachedQuickLogin.qrValue
      ) {
        effectiveQrValue = cachedQuickLogin.qrValue;
        effectivePreviewContext =
          cachedQuickLogin.previewContext || effectivePreviewContext;
        effectivePreviewSig = cachedQuickLogin.previewSig || effectivePreviewSig;
      }

      quickLoginActiveRequest = {
        ...payload,
        qrValue: effectiveQrValue,
        previewContext: effectivePreviewContext,
        previewSig: effectivePreviewSig,
      };
      if (quickLoginRefEl) {
        quickLoginRefEl.textContent = String(payload.requestId || '---')
          .slice(0, 8)
          .toUpperCase();
      }

      await renderQuickLoginQr(effectiveQrValue);
      if (effectivePreviewContext && effectivePreviewSig) {
        saveQuickLoginQrCache({
          requestId: payload.requestId,
          qrValue: effectiveQrValue,
          expiresAt: payload.expiresAt,
          previewContext: effectivePreviewContext,
          previewSig: effectivePreviewSig,
        });
      }
      updateQuickLoginTimer(payload.expiresAt);
      setQuickLoginStatus(
        payload.reusedPending
          ? 'Resumed pending QR session on this device.'
          : 'Waiting for secure approval from trusted device...',
      );
      startQuickLoginRefreshCooldown(
        Number(
          payload.regenerateRemainingSeconds ||
          payload.regenerateCooldownSeconds ||
            QUICK_LOGIN_REGEN_COOLDOWN_FALLBACK_SECONDS,
        ),
      );
      startQuickLoginPolling();
    } catch (err) {
      setQuickLoginStatus(`[ERR_QL1] ${err.message}`, 'error');
      if (quickLoginRefEl) quickLoginRefEl.textContent = '---';
      if (quickLoginTimerEl) quickLoginTimerEl.textContent = '--s';
    } finally {
      quickLoginIsRequesting = false;
      if (!quickLoginRefreshBtn) return;
      if (quickLoginRefreshEndsAt > Date.now()) return;
      quickLoginRefreshBtn.disabled = false;
      setQuickLoginRefreshLabel('Regenerate QR', 'bx bx-refresh');
    }
  }

  async function pollQuickLoginStatus() {
    if (!quickLoginActiveRequest || quickLoginIsRequesting) return;

    try {
      const res = await fetch('/.netlify/functions/quick-login-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: quickLoginActiveRequest.requestId,
          requestSecret: quickLoginActiveRequest.requestSecret,
          consume: true,
        }),
      });

      let payload = {};
      try {
        payload = await res.json();
      } catch (_) {
        payload = {};
      }

      if (!res.ok) {
        if (res.status === 404 || res.status === 410) {
          clearQuickLoginTimers();
          setQuickLoginStatus(
            'Quick-login request expired. Regenerate QR.',
            'error',
          );
          return;
        }
        throw new Error(payload.error || 'Failed to verify quick-login status');
      }

      if (payload.status === 'pending') {
        return;
      }

      if (
        payload.status === 'expired' ||
        payload.status === 'rejected' ||
        payload.status === 'consumed'
      ) {
        clearQuickLoginTimers();
        clearQuickLoginQrCache();
        setQuickLoginStatus(
          payload.status === 'consumed'
            ? 'Quick-login code already used. Regenerate QR.'
            : 'Quick-login request was not approved.',
          'error',
        );
        return;
      }

      if (payload.status !== 'approved') {
        return;
      }

      clearQuickLoginTimers();
      clearQuickLoginQrCache();
      setQuickLoginStatus(
        'Approval received. Synchronizing secure session...',
        'success',
      );

      const { data: sessionData, error: sessionErr } =
        await supabaseClient.auth.setSession({
          access_token: payload.accessToken,
          refresh_token: payload.refreshToken,
        });

      if (sessionErr) {
        throw new Error(
          sessionErr.message || 'Unable to restore quick-login session',
        );
      }

      const user = sessionData?.user;
      if (!user || user.user_metadata?.role !== 'admin') {
        await supabaseClient.auth.signOut();
        throw new Error('Quick-login approved by a non-admin account');
      }

      if (window.wolfAudio) window.wolfAudio.play('success');
      setTimeout(() => {
        if (quickLoginModal) {
          quickLoginModal.classList.remove('is-open');
          quickLoginModal.setAttribute('aria-hidden', 'true');
        }
        runAdminBootSequence();
      }, 550);
    } catch (err) {
      setQuickLoginStatus(`[ERR_QL2] ${err.message}`, 'error');
    }
  }

  function startQuickLoginPolling() {
    if (quickLoginPollTimer) clearInterval(quickLoginPollTimer);
    quickLoginPollTimer = setInterval(
      pollQuickLoginStatus,
      QUICK_LOGIN_POLL_MS,
    );
    pollQuickLoginStatus();
  }

  function closeQuickLoginModal() {
    if (!quickLoginModal) return;
    quickLoginModal.classList.remove('is-open');
    quickLoginModal.setAttribute('aria-hidden', 'true');
    clearQuickLoginTimers();
    clearQuickLoginRefreshCooldown(true);
    quickLoginActiveRequest = null;
    if (quickLoginCanvas) quickLoginCanvas.classList.remove('is-ready');
    if (quickLoginRefEl) quickLoginRefEl.textContent = '---';
    if (quickLoginTimerEl) quickLoginTimerEl.textContent = '--s';
    setQuickLoginStatus('Initializing secure QR channel...');
  }

  function openQuickLoginModal() {
    if (!quickLoginModal) return;
    quickLoginModal.classList.add('is-open');
    quickLoginModal.setAttribute('aria-hidden', 'false');
    createQuickLoginRequest(false);
  }

  function initQuickLoginFlow() {
    if (!quickLoginModal || !quickLoginLaunchBtn) return;

    quickLoginLaunchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openQuickLoginModal();
    });

    quickLoginCloseBtn?.addEventListener('click', closeQuickLoginModal);
    quickLoginBackdrop?.addEventListener('click', closeQuickLoginModal);

    quickLoginRefreshBtn?.addEventListener('click', async () => {
      await createQuickLoginRequest(true);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && quickLoginModal.classList.contains('is-open')) {
        closeQuickLoginModal();
      }
    });
  }

  function resetRecoveryFlowToLogin() {
    if (otpTimerInterval) {
      clearInterval(otpTimerInterval);
      otpTimerInterval = null;
    }

    otpRapidClickTimestamps = [];
    isProcessingOtp = false;

    const step2 = document.getElementById('recoveryStep2');
    if (step2) step2.remove();

    recoveryContainer.classList.remove('step1-exit', 'step2-enter');
    hideResetOutput({ immediate: true });
    hideLoginOutput(true);

    const otpForm = document.getElementById('otpForm');
    if (otpForm) otpForm.reset();

    const forgotEmail = document.getElementById('forgotEmail');
    if (forgotEmail) forgotEmail.value = '';

    const sendBtn = document.getElementById('sendOtpBtn');
    const resendBtn = document.getElementById('resendOtpBtn');
    const remainingCooldown = getRemainingOtpCooldownSeconds();
    if (remainingCooldown > 0) {
      startOtpCountdown(remainingCooldown);
    } else {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.pointerEvents = 'auto';
        sendBtn.style.opacity = '1';
        sendBtn.setAttribute('aria-disabled', 'false');
        sendBtn.textContent = 'SEND SECURITY OTP';
      }
      if (resendBtn) {
        resendBtn.style.pointerEvents = 'auto';
        resendBtn.style.opacity = '1';
        resendBtn.textContent = 'RESEND SECURITY CODE';
      }
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.disabled = false;
      resetBtn.textContent = 'RESTORE SYSTEM ACCESS';
    }

    const otpFields = document.querySelectorAll('.otp-field');
    otpFields.forEach((field) => {
      field.value = '';
    });

    const newPasswordField = document.getElementById('newPassword');
    if (newPasswordField) newPasswordField.value = '';

    if (exitModal) exitModal.style.display = 'none';
    inner.classList.remove('flipped');
  }

  // --- LOGIN HANDLER WITH OUTRO ANIMATION ---
  async function handleLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const loginAgreement = document.getElementById('loginAgreement');
    const rememberDeviceCheckbox = document.getElementById('rememberDevice');

    if (loginBtn.disabled) return;
    loginBtn.disabled = true;
    loginBtn.textContent = 'AUTHORIZING...';
    hideLoginOutput(true);

    try {
      if (loginAgreement && !loginAgreement.checked) {
        showLoginOutput(
          '[ERR_105] Please agree to the data security policy to continue.',
          { color: 'var(--wolf-red)' },
        );
        if (window.wolfAudio) window.wolfAudio.play('denied');
        loginBtn.disabled = false;
        loginBtn.textContent = 'AUTHORIZE ACCESS';
        return;
      }

      const userIP = await getClientIP();
      const isLocked = await checkLoginLockoutStatus();

      if (isLocked) return;

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      setRememberDeviceEnabled(Boolean(rememberDeviceCheckbox?.checked));

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        shakeField(document.getElementById('password'));
        wolfAudio.play('denied');
        const { data: check } = await supabaseClient
          .from('login_attempts')
          .select('*')
          .eq('ip_address', userIP)
          .maybeSingle();

        let newCount = 1;
        if (check) {
          const diff =
            (Date.now() - new Date(check.last_attempt_at).getTime()) / 60000;
          newCount = diff < LOGIN_LOCKOUT_MINUTES ? check.attempts + 1 : 1;
        }

        await supabaseClient.from('login_attempts').upsert({
          ip_address: userIP,
          attempts: newCount,
          last_attempt_at: new Date().toISOString(),
        });

        if (newCount >= MAX_ATTEMPTS) {
          startLoginCountdown(LOGIN_LOCKOUT_MINUTES * 60);
        } else {
          showLoginOutput(
            `[ERR_101] Access denied. ${MAX_ATTEMPTS - newCount} attempts left.`,
            { color: 'var(--wolf-red)' },
          );
          document.getElementById('password').value = '';
          loginBtn.disabled = false;
          loginBtn.textContent = 'AUTHORIZE ACCESS';
        }
      } else if (data.user.user_metadata.role === 'admin') {
        await runAdminBootSequence();
      } else {
        wolfAudio.play('error');
        showLoginOutput('[ERR_102] Unauthorized role.');
        await supabaseClient.auth.signOut();
        loginBtn.disabled = false;
        loginBtn.textContent = 'AUTHORIZE ACCESS';
      }
    } catch (err) {
      showLoginOutput('[ERR_500] System Fault.');

      if (window.wolfAudio) window.wolfAudio.play('error');
      window.Swal.fire({
        title: '[ERR_500] TERMINAL_FAULT',
        html: `<div style="color:var(--wolf-red); font-size:4rem; margin-bottom:15px;"><i class='bx bx-error-alt'></i></div>
               <p style="color:#888; font-size:14px;">CRITICAL_ERROR: ${err.message}</p>`,
        background: '#111',
        buttonsStyling: false,
        customClass: {
          popup: 'wolf-swal-popup wolf-border-red', // RED BORDER
          title: 'wolf-swal-title',
          confirmButton: 'btn-wolf-red',
        },
        confirmButtonText: 'RE-INITIALIZE',
      });

      loginBtn.disabled = false;
    }
  }

  checkLoginLockoutStatus();
  initQuickLoginFlow();

  const loginAgreement = document.getElementById('loginAgreement');
  if (loginAgreement) {
    loginAgreement.addEventListener('change', () => {
      if (loginAgreement.checked) {
        const loginOutputText =
          document.getElementById('loginOutput')?.textContent || '';
        if (
          loginOutputText.includes('Please agree to the data security policy')
        ) {
          hideLoginOutput(true);
        }
      }
    });
  }

  const rememberDeviceCheckbox = document.getElementById('rememberDevice');
  if (rememberDeviceCheckbox) {
    rememberDeviceCheckbox.checked = isRememberDeviceEnabled();
    rememberDeviceCheckbox.addEventListener('change', () => {
      setRememberDeviceEnabled(Boolean(rememberDeviceCheckbox.checked));
    });
  }

  // --- UTILS: START COOLDOWN TIMER ---
  function readOtpCooldownEndsAtFromStorage() {
    try {
      const raw = localStorage.getItem(OTP_COOLDOWN_STORAGE_KEY);
      if (!raw) return 0;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) return 0;
      return parsed;
    } catch {
      return 0;
    }
  }

  function writeOtpCooldownEndsAtToStorage(endsAtMs) {
    try {
      if (!Number.isFinite(endsAtMs) || endsAtMs <= Date.now()) {
        localStorage.removeItem(OTP_COOLDOWN_STORAGE_KEY);
        return;
      }
      localStorage.setItem(OTP_COOLDOWN_STORAGE_KEY, String(Math.ceil(endsAtMs)));
    } catch {
      // no-op
    }
  }

  function getRemainingOtpCooldownSeconds() {
    const nowMs = Date.now();
    const storedEndsAt = readOtpCooldownEndsAtFromStorage();
    const effectiveEndsAt = Math.max(otpCooldownEndsAt || 0, storedEndsAt || 0);

    if (!effectiveEndsAt || effectiveEndsAt <= nowMs) {
      otpCooldownEndsAt = 0;
      writeOtpCooldownEndsAtToStorage(0);
      return 0;
    }

    otpCooldownEndsAt = effectiveEndsAt;
    return Math.max(0, Math.ceil((effectiveEndsAt - nowMs) / 1000));
  }

  function formatOtpCooldownText(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds || 0)));
    return `Wait for ${safeSeconds}s to resend code`;
  }

  function startOtpCountdown(seconds) {
    if (otpTimerInterval) clearInterval(otpTimerInterval);
    const safeSeconds = Math.max(0, Number(seconds || 0));
    otpCooldownEndsAt = safeSeconds > 0 ? Date.now() + safeSeconds * 1000 : 0;
    writeOtpCooldownEndsAtToStorage(otpCooldownEndsAt);

    const updateUI = (secs) => {
      const sendBtn = document.getElementById('sendOtpBtn');
      const resendBtn = document.getElementById('resendOtpBtn');
      const text = secs > 0 ? formatOtpCooldownText(secs) : null;

      if (sendBtn) {
        sendBtn.disabled = secs > 0;
        sendBtn.style.pointerEvents = secs > 0 ? 'none' : 'auto';
        sendBtn.style.opacity = secs > 0 ? '0.65' : '1';
        sendBtn.setAttribute('aria-disabled', secs > 0 ? 'true' : 'false');
        sendBtn.textContent = text || 'SEND SECURITY OTP';
      }
      if (resendBtn) {
        resendBtn.style.pointerEvents = secs > 0 ? 'none' : 'auto';
        resendBtn.style.opacity = secs > 0 ? '0.5' : '1';
        resendBtn.textContent = text || 'RESEND SECURITY CODE';
      }

      if (secs <= 0) {
        otpCooldownEndsAt = 0;
        writeOtpCooldownEndsAtToStorage(0);
      }
    };

    let timeLeft = safeSeconds;
    updateUI(timeLeft);

    otpTimerInterval = setInterval(() => {
      timeLeft--;
      updateUI(timeLeft);
      if (timeLeft <= 0) clearInterval(otpTimerInterval);
    }, 1000);
  }

  // --- UTILS: CHECK SUPABASE COOLDOWN ---
  async function checkExistingCooldown() {
    try {
      const res = await fetch('/.netlify/functions/check-otp-cooldown', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return getRemainingOtpCooldownSeconds();

      const data = await res.json();
      if (data?.canSend === false) {
        return Number(data.remainingTime || 0);
      }
      return 0;
    } catch {
      return getRemainingOtpCooldownSeconds();
    }
  }

  // --- UTILS: AJAX LOAD & TRANSITION ---
  async function loadVerifyFragment(preferredCooldownSeconds = 0) {
    try {
      const res = await fetch('pages/verifyotp.html');

      // 1. Get raw HTML
      const rawHTML = await res.text();

      // 2. Sanitize HTML BEFORE parsing
      const cleanHTML = DOMPurify.sanitize(rawHTML, {
        ALLOWED_TAGS: ['div', 'p', 'form', 'input', 'button', 'a', 'span', 'i'],
        ALLOWED_ATTR: [
          'id',
          'class',
          'type',
          'placeholder',
          'required',
          'maxlength',
          'inputmode',
          'pattern',
          'title',
          'href',
          'style',
        ],
      });

      // 3. Parse sanitized HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanHTML, 'text/html');

      // 4. Extract only what you need
      const step2Content = doc.getElementById('recoveryStep2');

      if (step2Content) {
        recoveryContainer.appendChild(step2Content);
        recoveryContainer.classList.add('step1-exit');

        setTimeout(async () => {
          recoveryContainer.classList.add('step2-enter');
          initOtpFields();
          initVerifyForm();

          const localRemaining = getRemainingOtpCooldownSeconds();
          let serverRemaining = 0;
          if (localRemaining <= 0) {
            serverRemaining = await checkExistingCooldown();
          }
          const remaining = Math.max(
            Number(preferredCooldownSeconds || 0),
            localRemaining,
            serverRemaining,
          );
          if (remaining > 0) startOtpCountdown(remaining);
        }, 50);
      }
    } catch (err) {
      showResetOutput('[ERR_500] Failed to load verification module.');
    }
  }

  // --- OTP REQUEST HANDLER ---
  // 1. Add this variable at the top of your script (outside handleOtpRequest)
  let isProcessingOtp = false;

  // 2. Update your handleOtpRequest function
  async function handleOtpRequest() {
    const earlyCooldown = getRemainingOtpCooldownSeconds();
    if (earlyCooldown > 0) {
      startOtpCountdown(earlyCooldown);
      showResetOutput(`[ERR_429] ${formatOtpCooldownText(earlyCooldown)}.`, {
        color: 'var(--wolf-red)',
        autoHide: false,
      });
      return;
    }

    const clickNowMs = Date.now();
    otpRapidClickTimestamps = otpRapidClickTimestamps.filter(
      (ts) => clickNowMs - ts <= OTP_CLICK_SPAM_WINDOW_MS,
    );
    otpRapidClickTimestamps.push(clickNowMs);

    if (otpRapidClickTimestamps.length >= OTP_CLICK_SPAM_THRESHOLD) {
      otpRapidClickTimestamps = [];
      startOtpCountdown(OTP_CLICK_SPAM_LOCK_SECONDS);
      showResetOutput(
        `[ERR_429] ${formatOtpCooldownText(OTP_CLICK_SPAM_LOCK_SECONDS)}.`,
        {
          color: 'var(--wolf-red)',
          autoHide: false,
        },
      );
      isProcessingOtp = false;
      return;
    }

    if (isProcessingOtp) return; // Prevent overlapping requests

    const sendBtn = document.getElementById('sendOtpBtn');
    const resendBtn = document.getElementById('resendOtpBtn');

    // --- 1. INSTANT FEEDBACK ---
    isProcessingOtp = true;
    showResetOutput('Establishing connection to server...', {
      color: '#888',
      autoHide: false,
    }); // Status message

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'TRANSMITTING...'; // Button loading state
    }
    if (resendBtn) {
      resendBtn.style.pointerEvents = 'none';
      resendBtn.style.opacity = '0.5';
      resendBtn.textContent = 'RESENDING OTP CODES TO EMAIL...';
    }

    const email = document.getElementById('forgotEmail')?.value || '';

    try {
      // Local guard so newly inserted Step 2 resend link cannot bypass cooldown.
      const localRemaining = getRemainingOtpCooldownSeconds();
      if (localRemaining > 0) {
        startOtpCountdown(localRemaining);
        showResetOutput(
          `[ERR_429] ${formatOtpCooldownText(localRemaining)}.`,
          {
            color: 'var(--wolf-red)',
            autoHide: false,
          },
        );
        isProcessingOtp = false;
        return;
      }

      // Check cooldown in DB first
      const remaining = await checkExistingCooldown();
      if (remaining > 0) {
        startOtpCountdown(remaining);
        showResetOutput(`[ERR_429] ${formatOtpCooldownText(remaining)}.`, {
          color: 'var(--wolf-red)',
          autoHide: false,
        });
        isProcessingOtp = false;
        return;
      }

      // --- 2. TRANSMISSION STATUS ---
      showResetOutput('Checking existing email...', {
        color: '#888',
        autoHide: false,
      });

      const res = await fetch('/.netlify/functions/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        let okData = {};
        try {
          okData = await res.json();
        } catch (_) {
          okData = {};
        }

        const serverCooldown = Number(okData?.remainingTime || 0);
        const cooldownNow =
          Number.isFinite(serverCooldown) && serverCooldown > 0
            ? serverCooldown
            : 60;
        startOtpCountdown(cooldownNow);

        // --- 3. SUCCESS STATUS ---
        wolfAudio.play('notif');
        showResetOutput('Your OTP key has been sent to your email.', {
          color: '#4ade80',
          autoHide: false,
        });

        if (!document.getElementById('recoveryStep2')) {
          await loadVerifyFragment(cooldownNow);
        }
      } else {
        let serverMsg = '';
        let waitSecs = 0;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.error || '';
          waitSecs = Number(errJson?.remainingTime || 0);
        } catch (_) {
          // ignore parse failures
        }

        // --- 4. ERROR STATUS ---
        wolfAudio.play('error');
        if (res.status === 404) {
          if (waitSecs > 0) startOtpCountdown(waitSecs);
          showResetOutput(
            '[ERR_401] Identification failed. Email unauthorized.',
          );
        } else if (res.status === 429) {
          const isAntiSpam = String(serverMsg || '').includes(
            'OTP cooldown active',
          );
          const fallbackWait = isAntiSpam ? 30 : 60;
          const effectiveWait = waitSecs > 0 ? waitSecs : fallbackWait;
          startOtpCountdown(effectiveWait);
          showResetOutput(
            `[ERR_429] ${formatOtpCooldownText(effectiveWait)}.`,
            { color: 'var(--wolf-red)', autoHide: false },
          );
        } else if (res.status === 400) {
          showResetOutput(`[ERR_400] ${serverMsg || 'Invalid request.'}`);
        } else {
          showResetOutput(
            `[ERR_500] ${serverMsg || 'Server error while requesting OTP.'}`,
          );
        }
        isProcessingOtp = false;
        if (res.status !== 429 && waitSecs <= 0) {
          if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'SEND SECURITY OTP';
          }
          if (resendBtn) {
            resendBtn.style.pointerEvents = 'auto';
            resendBtn.style.opacity = '1';
            resendBtn.textContent = 'RESEND SECURITY CODE';
          }
        }
      }
    } catch (err) {
      const localRemaining = getRemainingOtpCooldownSeconds();
      if (localRemaining > 0) {
        startOtpCountdown(localRemaining);
        showResetOutput(`[ERR_429] ${formatOtpCooldownText(localRemaining)}.`, {
          color: 'var(--wolf-red)',
          autoHide: false,
        });
      } else {
        showResetOutput('[ERR_503] Gateway timeout. Terminal offline.');
      }
      isProcessingOtp = false;
      if (localRemaining <= 0) {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.style.pointerEvents = 'auto';
          sendBtn.style.opacity = '1';
          sendBtn.setAttribute('aria-disabled', 'false');
          sendBtn.textContent = 'SEND SECURITY OTP';
        }
        if (resendBtn) {
          resendBtn.style.pointerEvents = 'auto';
          resendBtn.style.opacity = '1';
          resendBtn.textContent = 'RESEND SECURITY CODE';
        }
      }
    } finally {
      setTimeout(() => {
        isProcessingOtp = false;
      }, 1000);
    }
  }

  // --- RESET PASSWORD HANDLER (FOR AJAX INJECTED FORM) ---
  function initVerifyForm() {
    const verifyForm = document.getElementById('verifyResetForm');
    const step2 = document.getElementById('recoveryStep2');
    if (!verifyForm || !step2) return;

    // Target the specific output inside Step 2
    const localOutput = step2.querySelector('#resetOutput');

    verifyForm.onsubmit = async (e) => {
      e.preventDefault();
      const resetBtn = verifyForm.querySelector('button[type="submit"]');

      // 1. INSTANT FEEDBACK
      resetBtn.disabled = true;
      resetBtn.textContent = 'RECONFIGURING...';
      showResetOutput('Verifying OTP Code Credential...', {
        color: '#888',
        autoHide: false,
        targetEl: localOutput,
      });

      const email = document.getElementById('forgotEmail').value;
      const newPassword = document.getElementById('newPassword').value;
      const otp = Array.from(document.querySelectorAll('.otp-field'))
        .map((f) => f.value)
        .join('');

      try {
        const res = await fetch('/.netlify/functions/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp, newPassword }),
        });

        if (res.ok) {
          wolfAudio.play('success');
          showResetOutput('Protocol success. Password updated.', {
            color: '#4ade80',
            autoHide: false,
            targetEl: localOutput,
          });
          if (window.wolfAudio) window.wolfAudio.play('success');
          window.Swal.fire({
            title: 'SUCCESS',
            html: `<div style="color:#08ea1b; font-size:4rem; margin-bottom:15px;"><i class='bx bx-check-shield'></i></div>
               <p style="color:#888; font-size:14px;">Credentials re-mapped successfully. Terminal access granted.</p>`,
            background: '#111',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            customClass: {
              popup: 'wolf-swal-popup wolf-border-green', // GREEN BORDER
              title: 'wolf-swal-title',
            },
            didClose: () => {
              resetRecoveryFlowToLogin();
            },
          });
        } else {
          await res.json();
          wolfAudio.play('denied');
          showResetOutput('[ERR_602] Security key invalid or expired.', {
            targetEl: localOutput,
          });
          resetBtn.disabled = false;
          resetBtn.textContent = 'RESTORE SYSTEM ACCESS';
        }
      } catch (err) {
        wolfAudio.play('error');
        resetBtn.disabled = false;
        showResetOutput('[ERR_500] Database synchronization fault.', {
          targetEl: localOutput,
        });
      }
    };
  }

  (async () => {
    const localRemaining = getRemainingOtpCooldownSeconds();
    if (localRemaining > 0) startOtpCountdown(localRemaining);

    const serverRemaining = await checkExistingCooldown();
    const effectiveRemaining = Math.max(
      localRemaining,
      Number(serverRemaining || 0),
    );
    if (effectiveRemaining > 0) startOtpCountdown(effectiveRemaining);
  })();

  // --- EVENT LISTENERS ---
  document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    handleLogin();
  };

  document.getElementById('otpForm').onsubmit = (e) => {
    e.preventDefault();
    const cooldownSeconds = getRemainingOtpCooldownSeconds();
    if (cooldownSeconds > 0) {
      startOtpCountdown(cooldownSeconds);
      showResetOutput(`[ERR_429] ${formatOtpCooldownText(cooldownSeconds)}.`, {
        color: 'var(--wolf-red)',
        autoHide: false,
      });
      return;
    }
    handleOtpRequest('sendOtpBtn');
  };

  document.getElementById('forgotLink').onclick = (e) => {
    e.preventDefault();
    inner.classList.add('flipped');
  };

  // EXIT LOGIC (Event Delegation for AJAX buttons)
  document.addEventListener('click', (e) => {
    // 1. Handle "Forgot Password" flip
    if (e.target.id === 'forgotLink') {
      e.preventDefault();
      document.getElementById('flipCardInner').classList.add('flipped');
    }

    // 2. Handle the "RESEND" link (Works for AJAX injected content)
    if (e.target.id === 'resendOtpBtn' || e.target.closest('#resendOtpBtn')) {
      e.preventDefault();
      console.log('Wolf OS: Resend requested...');
      handleOtpRequest();
    }
    // 3. Handle "Back to Login" triggers
    if (
      e.target.id === 'backToLoginTrigger' ||
      e.target.id === 'backToLoginTriggerSecondary'
    ) {
      e.preventDefault();

      // If we are in the middle of OTP (Step 2 loaded)
      if (document.getElementById('recoveryStep2')) {
        if (window.wolfAudio) window.wolfAudio.play('notif');
        window.Swal.fire({
          title: 'ABANDON RECOVERY?',
          html: `<div style="color:#b47023; font-size:4rem; margin-bottom:15px;"><i class='bx bx-shield-quarter'></i></div>
               <p style="color:#888; font-size:14px;">Terminating handshake will void the current security key. Proceed?</p>`,
          showCancelButton: true,
          confirmButtonText: 'YES, EXIT',
          cancelButtonText: 'STAY',
          reverseButtons: true,
          background: '#111',
          buttonsStyling: false,
          customClass: {
            popup: 'wolf-swal-popup wolf-border-orange', // ORANGE BORDER
            title: 'wolf-swal-title',
            confirmButton: 'btn-wolf-orange',
            cancelButton: 'btn-wolf-secondary',
          },
        }).then((res) => {
          if (res.isConfirmed) resetRecoveryFlowToLogin();
        });
      } else {
        inner.classList.remove('flipped');
      }
    }
  });

  document.getElementById('confirmExitBtn').onclick = () => {
    exitModal.style.display = 'none';
    resetRecoveryFlowToLogin();
  };

  document.getElementById('cancelExitBtn').onclick = () =>
    (exitModal.style.display = 'none');
  document.getElementById('closeModalBtn').onclick = () =>
    resetRecoveryFlowToLogin();
  document.getElementById('descContainer').onclick = function () {
    this.classList.toggle('expanded');
  };

  function initOtpFields() {
    const fields = document.querySelectorAll('.otp-field');

    fields.forEach((f, idx) => {
      // 1. Handle Typing & Numeric Filter
      f.oninput = (e) => {
        // REGEX: Replace any character that is NOT 0-9 with an empty string
        f.value = f.value.replace(/[^0-9]/g, '');

        // Auto-focus next field
        if (f.value && idx < 5) {
          fields[idx + 1].focus();
        }
      };

      // 2. Handle Backspace Navigation
      f.onkeydown = (e) => {
        if (e.key === 'Backspace' && !f.value && idx > 0) {
          fields[idx - 1].focus();
        }
      };

      // 3. Handle Numeric-Only Paste
      f.onpaste = (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData(
          'text',
        );

        // Strip everything except numbers from the pasted text
        const numbersOnly = pasteData.replace(/[^0-9]/g, '');

        // Distribute the digits across the fields starting from current index
        for (
          let i = 0;
          i < numbersOnly.length && idx + i < fields.length;
          i++
        ) {
          fields[idx + i].value = numbersOnly[i];
        }

        // Move focus to the last filled box or the next empty one
        const nextFocus = Math.min(idx + numbersOnly.length, 5);
        fields[nextFocus].focus();
      };
    });
  }
});
