const WOLF_CONFIG = {
  noLoadingScreen: false,
  VERSION: 'v0.6.62',
  FULL_VERSION: 'GYM V0.6.62',
  BRAND_WHITE: 'WOLF',
  BRAND_RED: 'PALOMAR',
  COMPANY: 'WOLF PALOMAR',
  YEAR: '2026',
};

const WOLF_UPDATE_CHECK_INTERVAL_MS = 45000;
const WOLF_UPDATE_BANNER_ID = 'wolf-update-banner';
const WOLF_UPDATE_BANNER_STYLE_ID = 'wolf-update-banner-style';
const WOLF_UPDATE_DISMISS_KEY = 'wolf_update_banner_dismissed_signature';
const WOLF_NETWORK_STYLE_ID = 'wolf-network-monitor-style';
const WOLF_NETWORK_OVERLAY_ID = 'wolf-network-overlay';
const WOLF_NETWORK_CHECK_INTERVAL_MS = 12000;
const WOLF_NETWORK_CHECK_TIMEOUT_MS = 4500;
const WOLF_KEYBOARD_OPEN_CLASS = 'wolf-keyboard-open';
const WOLF_APP_HEIGHT_VAR = '--wolf-app-height';
const WOLF_KEYBOARD_OFFSET_VAR = '--wolf-keyboard-offset';
const WOLF_KEYBOARD_OPEN_THRESHOLD_PX = 110;
const WOLF_THEME_META_SELECTOR = 'meta[name="theme-color"]';
const WOLF_THEME_COLOR_DARK = '#0f1012';
const WOLF_THEME_COLOR_LIGHT = '#ebe5dd';
const WOLF_PWA_BUTTON_ID = 'wolf-pwa-install-button';
const WOLF_PWA_STYLE_ID = 'wolf-pwa-install-style';
const WOLF_PWA_INSTALL_LABEL = 'Install App';
const WOLF_PWA_IOS_LABEL = 'Add to Home Screen';
const WOLF_PWA_IOS_HELP_TEXT =
  'On iPhone/iPad: tap Share, then choose "Add to Home Screen".';
const WOLF_PWA_BUTTON_AUTO_COMPACT_MS = 3200;
const WOLF_PWA_TOUCH_HELP_HOLD_MS = 360;
const WOLF_PWA_TOUCH_HELP_HIDE_MS = 2200;
const WOLF_PWA_INLINE_HELP_DURATION_MS = 2800;
const WOLF_SW_UPDATE_CHECK_INTERVAL_MS = 60000;
const WOLF_PWA_PROMPT_RECHECK_MS = 1200;
let wolfUpdateCheckTimer = null;
let wolfKnownPageSignature = null;
let wolfPendingUpdateSignature = null;
let wolfNetworkMonitorTimer = null;
let wolfNetworkCheckInFlight = false;
let wolfNetworkIsOnline = true;
let wolfNetworkDetailsExpanded = false;
let wolfKeyboardLayoutWatchBound = false;
let wolfThemeColorWatchBound = false;
let wolfPwaPromptEvent = null;
let wolfPwaInstallWatchBound = false;
let wolfSwUpdateTimer = null;
let wolfPwaCompactTimer = null;
let wolfPwaTouchHoldTimer = null;
let wolfPwaTouchHelpTimer = null;
let wolfPwaSuppressNextInstallClick = false;
let wolfPwaBeforeInstallSeen = false;
let wolfPwaSwReady = false;

// Make this globally accessible
window.applyVersioning = function () {
  console.log('Wolf OS: Applying Versioning:', WOLF_CONFIG.FULL_VERSION);

  document
    .querySelectorAll('.sys-full-version')
    .forEach((el) => (el.textContent = WOLF_CONFIG.FULL_VERSION));
  document
    .querySelectorAll('.sys-version')
    .forEach((el) => (el.textContent = WOLF_CONFIG.VERSION));
  document
    .querySelectorAll('.sys-os-version')
    .forEach((el) => (el.textContent = `OS ${WOLF_CONFIG.VERSION}`));

  document.querySelectorAll('.brand-container').forEach((el) => {
    el.innerHTML = `${WOLF_CONFIG.BRAND_WHITE} <span>${WOLF_CONFIG.BRAND_RED}</span>`;
  });

  document.querySelectorAll('.sys-copyright').forEach((el) => {
    el.innerHTML = `&copy; ${WOLF_CONFIG.YEAR} ${WOLF_CONFIG.COMPANY}. All Rights Reserved.`;
  });
};

function wolfHashText(input) {
  const value = String(input || '');
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

async function fetchNoStoreText(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const joiner = url.includes('?') ? '&' : '?';
    const probeUrl = `${url}${joiner}_vchk=${Date.now()}`;
    const res = await fetch(probeUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (!res.ok) {
      throw new Error(`Probe failed (${res.status}) for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeVersionLabel(value) {
  return String(value || '').trim();
}

function extractVersionFromSystemConfigSource(source) {
  const raw = String(source || '');
  if (!raw) return null;

  const versionMatch = raw.match(/VERSION\s*:\s*['"]([^'"]+)['"]/i);
  if (versionMatch && versionMatch[1]) {
    return normalizeVersionLabel(versionMatch[1]);
  }
  return null;
}

async function fetchRemoteSystemConfigSource() {
  try {
    return await fetchNoStoreText('/assets/js/utils/system-config.js');
  } catch (_) {
    // Fallback to manifest-resolved hashed path.
  }

  try {
    const manifestText = await fetchNoStoreText('/asset-manifest.json');
    const manifest = JSON.parse(manifestText);
    const resolvedPath =
      manifest &&
      typeof manifest === 'object' &&
      manifest['/assets/js/utils/system-config.js'];
    if (!resolvedPath) return null;
    return await fetchNoStoreText(String(resolvedPath));
  } catch (_) {
    return null;
  }
}

async function fetchLatestVersionLabel() {
  const source = await fetchRemoteSystemConfigSource();
  return extractVersionFromSystemConfigSource(source);
}

function buildUpdateBannerMessage(currentVersion, latestVersion) {
  const current = normalizeVersionLabel(currentVersion);
  const latest = normalizeVersionLabel(latestVersion);

  if (current && latest && current !== latest) {
    return `A newer version is available (${current} -> ${latest}). Click to refresh.`;
  }
  if (latest) {
    return `A newer version (${latest}) is available. Click to refresh.`;
  }
  return 'A newer version is available. Click to refresh.';
}

async function fetchCurrentPageSignature() {
  const probes = [
    '/asset-manifest.json',
    '/assets/js/utils/system-config.js',
    `${window.location.pathname}${window.location.search}`,
    '/index.html',
  ];

  for (const probe of probes) {
    try {
      const text = await fetchNoStoreText(probe);
      if (text) return wolfHashText(text);
    } catch (_) {
      // Try the next probe; some routes/files may not exist in every context.
    }
  }

  throw new Error('Update check failed for all probes');
}

function ensureUpdateBannerStyle() {
  if (document.getElementById(WOLF_UPDATE_BANNER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = WOLF_UPDATE_BANNER_STYLE_ID;
  style.textContent = `
#${WOLF_UPDATE_BANNER_ID} {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(92vw, 640px);
  background: linear-gradient(120deg, #101010, #191919);
  color: #f2f2f2;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-left: 4px solid #f5b22a;
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
  font-size: 13px;
  line-height: 1.4;
}
#${WOLF_UPDATE_BANNER_ID} button {
  border: none;
  background: #f5b22a;
  color: #1b1b1b;
  border-radius: 7px;
  padding: 8px 10px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}
#${WOLF_UPDATE_BANNER_ID} button:hover {
  filter: brightness(1.05);
}
#${WOLF_UPDATE_BANNER_ID} .wolf-update-banner-dismiss {
  background: transparent;
  color: #bfc3ca;
  border: 1px solid rgba(191, 195, 202, 0.35);
}
#${WOLF_UPDATE_BANNER_ID} .wolf-update-banner-dismiss:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.45);
}
  `;
  document.head.appendChild(style);
}

function dismissUpdateBanner() {
  const existing = document.getElementById(WOLF_UPDATE_BANNER_ID);
  if (existing) existing.remove();
}

function showUpdateBanner(message, onRefresh, onDismiss = null) {
  ensureUpdateBannerStyle();

  const existing = document.getElementById(WOLF_UPDATE_BANNER_ID);
  if (existing) {
    existing.querySelector('.wolf-update-banner-text').textContent = message;
    return;
  }

  const banner = document.createElement('div');
  banner.id = WOLF_UPDATE_BANNER_ID;
  banner.innerHTML = `
    <span class="wolf-update-banner-text"></span>
    <button type="button" class="wolf-update-banner-refresh">Refresh Now</button>
    <button type="button" class="wolf-update-banner-dismiss">Dismiss</button>
  `;
  banner.querySelector('.wolf-update-banner-text').textContent = message;
  const refreshButton = banner.querySelector('.wolf-update-banner-refresh');
  const dismissButton = banner.querySelector('.wolf-update-banner-dismiss');

  refreshButton.addEventListener('click', () => {
    if (typeof onRefresh === 'function') onRefresh();
  });
  dismissButton.addEventListener('click', () => {
    dismissUpdateBanner();
    if (typeof onDismiss === 'function') onDismiss();
  });
  document.body.appendChild(banner);
}

window.showUpdateBanner = showUpdateBanner;
window.newVersionAvailable = false;
window.currentAppVersion = WOLF_CONFIG.VERSION;
window.latestAvailableVersion = null;
window.forceShowUpdateNotification = function (forcedLatestVersion = null) {
  window.newVersionAvailable = true;
  const latestLabel = normalizeVersionLabel(forcedLatestVersion);
  if (latestLabel) {
    window.latestAvailableVersion = latestLabel;
  }
  showUpdateBanner(
    buildUpdateBannerMessage(
      WOLF_CONFIG.VERSION,
      window.latestAvailableVersion,
    ),
    () => {
      window.location.reload();
    },
    () => {
      window.newVersionAvailable = false;
    },
  );
};
window.hideUpdateNotification = function () {
  dismissUpdateBanner();
  window.newVersionAvailable = false;
};

async function checkForNewVersion() {
  try {
    const latestSignature = await fetchCurrentPageSignature();
    if (!wolfKnownPageSignature) {
      wolfKnownPageSignature = latestSignature;
      window.newVersionAvailable = false;
      return;
    }

    const hasNewVersion = latestSignature !== wolfKnownPageSignature;
    window.newVersionAvailable = hasNewVersion;
    if (!hasNewVersion) {
      wolfPendingUpdateSignature = null;
      window.latestAvailableVersion = null;
      dismissUpdateBanner();
      return;
    }

    const latestVersion = await fetchLatestVersionLabel();
    window.latestAvailableVersion =
      normalizeVersionLabel(latestVersion) || null;
    wolfPendingUpdateSignature = latestSignature;
    let dismissedSignature = '';
    try {
      dismissedSignature =
        window.sessionStorage.getItem(WOLF_UPDATE_DISMISS_KEY) || '';
    } catch (_) {
      dismissedSignature = '';
    }
    if (dismissedSignature === latestSignature) {
      dismissUpdateBanner();
      return;
    }

    if (window.newVersionAvailable) {
      showUpdateBanner(
        buildUpdateBannerMessage(
          WOLF_CONFIG.VERSION,
          window.latestAvailableVersion,
        ),
        () => {
          window.location.reload();
        },
        () => {
          try {
            if (wolfPendingUpdateSignature) {
              window.sessionStorage.setItem(
                WOLF_UPDATE_DISMISS_KEY,
                wolfPendingUpdateSignature,
              );
            }
          } catch (_) {
            // ignore storage failures
          }
        },
      );
    }
  } catch (_) {
    // Ignore transient network/CDN errors during update checks.
  }
}

function startVersionWatch() {
  if (wolfUpdateCheckTimer) return;
  checkForNewVersion();
  wolfUpdateCheckTimer = setInterval(
    checkForNewVersion,
    WOLF_UPDATE_CHECK_INTERVAL_MS,
  );
}

function ensureNetworkMonitorStyle() {
  if (document.getElementById(WOLF_NETWORK_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = WOLF_NETWORK_STYLE_ID;
  style.textContent = `
#${WOLF_NETWORK_OVERLAY_ID} {
  position: fixed;
  top: calc(8px + env(safe-area-inset-top, 0px));
  left: 50%;
  width: min(94vw, 560px);
  transform: translateX(-50%) translateY(-12px);
  z-index: 100000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease, transform 220ms ease;
}
#${WOLF_NETWORK_OVERLAY_ID}.is-active {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-card {
  pointer-events: auto;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-left: 4px solid rgba(255, 98, 83, 0.96);
  background: linear-gradient(150deg, rgba(14, 16, 20, 0.93), rgba(10, 13, 18, 0.95));
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
  padding: 10px 12px;
  color: #edf3ff;
  position: relative;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ff6253;
  box-shadow: 0 0 0 0 rgba(255, 98, 83, 0.62);
  animation: wolfNetPulse 1.55s infinite;
  flex-shrink: 0;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-head-copy {
  min-width: 0;
  flex: 1;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-title {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  font-weight: 800;
  line-height: 1.15;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-code {
  margin: 3px 0 0;
  color: #b8c0ce;
  font-size: 10px;
  letter-spacing: 0.25px;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex-shrink: 0;
  min-height: 40px;
  min-width: 40px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.09);
  color: #f2f6ff;
  border-radius: 12px;
  padding: 0 11px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.24px;
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-toggle:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.38);
  background: rgba(255, 255, 255, 0.14);
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-toggle i {
  font-size: 22px;
  line-height: 1;
  transform-origin: center;
  color: #ffddd9;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-details {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  margin-top: 0;
  transition:
    max-height 220ms ease,
    opacity 180ms ease,
    margin-top 180ms ease;
}
#${WOLF_NETWORK_OVERLAY_ID}.is-expanded .wolf-net-details {
  max-height: 220px;
  opacity: 1;
  margin-top: 8px;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-desc {
  margin: 0;
  color: #d6ddeb;
  font-size: 12px;
  line-height: 1.45;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-foot {
  margin: 8px 0 0;
  font-size: 11px;
  color: #8f98a8;
}
body.light-theme #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-card {
  border-color: rgba(54, 45, 35, 0.24);
  border-left-color: rgba(186, 67, 58, 0.9);
  background: linear-gradient(150deg, rgba(242, 236, 228, 0.96), rgba(234, 227, 218, 0.94));
  color: #362c23;
  box-shadow: 0 10px 24px rgba(59, 45, 31, 0.16);
}
body.light-theme #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-code {
  color: #715f4c;
}
body.light-theme #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-desc {
  color: #584838;
}
body.light-theme #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-foot {
  color: #7f6c58;
}
body.light-theme #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-toggle {
  border-color: rgba(54, 45, 35, 0.34);
  background: rgba(54, 45, 35, 0.09);
  color: #3a3028;
}
body.light-theme #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-toggle i {
  color: #a4362a;
}
@media (max-width: 767px) {
  #${WOLF_NETWORK_OVERLAY_ID} {
    width: calc(100vw - 12px);
    top: calc(6px + env(safe-area-inset-top, 0px));
  }
  #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-card {
    padding: 9px 10px;
  }
  #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-toggle-text {
    display: none;
  }
  #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-toggle {
    width: 40px;
    height: 40px;
    min-width: 40px;
    padding: 0;
    border-radius: 11px;
  }
  #${WOLF_NETWORK_OVERLAY_ID} .wolf-net-toggle i {
    font-size: 24px;
  }
}
@keyframes wolfNetPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 98, 83, 0.62);
  }
  70% {
    box-shadow: 0 0 0 11px rgba(255, 98, 83, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 98, 83, 0);
  }
}
  `;
  document.head.appendChild(style);
}

function setNetworkOverlayExpanded(expanded) {
  const overlay = ensureNetworkOverlay();
  if (!overlay) return;

  const next = Boolean(expanded);
  wolfNetworkDetailsExpanded = next;
  overlay.classList.toggle('is-expanded', next);

  const toggle = overlay.querySelector('.wolf-net-toggle');
  if (!toggle) return;

  toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
  toggle.setAttribute(
    'aria-label',
    next ? 'Hide network details' : 'Show network details',
  );

  const toggleText = toggle.querySelector('.wolf-net-toggle-text');
  if (toggleText) {
    toggleText.textContent = next ? 'Hide details' : 'Show details';
  }

  const icon = toggle.querySelector('i');
  if (icon) {
    icon.className = `bx ${next ? 'bxs-chevron-up' : 'bxs-chevron-down'}`;
  }
}

function ensureNetworkOverlay() {
  ensureNetworkMonitorStyle();
  let overlay = document.getElementById(WOLF_NETWORK_OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = WOLF_NETWORK_OVERLAY_ID;
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'assertive');
  overlay.innerHTML = `
    <div class="wolf-net-card">
      <div class="wolf-net-head">
        <span class="wolf-net-dot" aria-hidden="true"></span>
        <div class="wolf-net-head-copy">
          <h3 class="wolf-net-title">Connection Lost</h3>
          <p class="wolf-net-code">[ERR_503] LINK_OFFLINE</p>
        </div>
        <button type="button" class="wolf-net-toggle" aria-expanded="false" aria-label="Show network details">
          <span class="wolf-net-toggle-text">Show details</span>
          <i class="bx bxs-chevron-down" aria-hidden="true"></i>
        </button>
      </div>
      <div class="wolf-net-details">
        <p class="wolf-net-desc">
          Live connection to Wolf Palomar servers is unavailable.
          The interface will automatically resume once internet access is restored.
        </p>
        <p class="wolf-net-foot">Realtime auto-reconnect is active.</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const toggle = overlay.querySelector('.wolf-net-toggle');
  if (toggle) {
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      setNetworkOverlayExpanded(!wolfNetworkDetailsExpanded);
    });
  }

  setNetworkOverlayExpanded(false);
  return overlay;
}

function setNetworkOverlayVisible(visible) {
  const overlay = ensureNetworkOverlay();
  if (!overlay) return;
  const shouldShow = Boolean(visible);
  const wasShown = overlay.classList.contains('is-active');
  overlay.classList.toggle('is-active', shouldShow);
  if (!shouldShow) {
    setNetworkOverlayExpanded(false);
    return;
  }
  if (!wasShown) {
    setNetworkOverlayExpanded(false);
  }
}

async function pingInternet() {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WOLF_NETWORK_CHECK_TIMEOUT_MS,
  );
  try {
    await fetch(`/assets/images/favicon.ico?_netchk=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    // Any resolved response means network path to server is alive (even 3xx/4xx).
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function evaluateNetworkState() {
  if (wolfNetworkCheckInFlight) return;
  wolfNetworkCheckInFlight = true;
  try {
    // Use active probe as source of truth to avoid false offline/online events.
    const online = await pingInternet();

    if (online !== wolfNetworkIsOnline) {
      wolfNetworkIsOnline = online;
      setNetworkOverlayVisible(!online);
    } else if (!online) {
      // Keep overlay active while still offline.
      setNetworkOverlayVisible(true);
    }
  } finally {
    wolfNetworkCheckInFlight = false;
  }
}

function startNetworkMonitor() {
  if (wolfNetworkMonitorTimer) return;
  ensureNetworkOverlay();
  wolfNetworkIsOnline = navigator.onLine;
  setNetworkOverlayVisible(!wolfNetworkIsOnline);

  window.addEventListener('offline', () => {
    wolfNetworkIsOnline = false;
    setNetworkOverlayVisible(true);
  });

  window.addEventListener('online', () => {
    evaluateNetworkState();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) evaluateNetworkState();
  });

  evaluateNetworkState();
  wolfNetworkMonitorTimer = setInterval(
    evaluateNetworkState,
    WOLF_NETWORK_CHECK_INTERVAL_MS,
  );
}

function setWolfCssVariable(name, value) {
  if (!document.documentElement) return;
  document.documentElement.style.setProperty(name, value);
}

function isTextEntryElement(element) {
  if (!element || !element.tagName) return false;
  const tagName = String(element.tagName).toLowerCase();
  if (tagName === 'textarea' || tagName === 'select') return true;
  if (tagName !== 'input') {
    return Boolean(
      element.isContentEditable ||
      element.getAttribute('contenteditable') === 'true',
    );
  }

  const inputType = String(element.type || 'text').toLowerCase();
  const blockedTypes = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ]);
  return !blockedTypes.has(inputType);
}

function getViewportHeightPx() {
  if (window.visualViewport && Number.isFinite(window.visualViewport.height)) {
    return Math.max(0, Math.round(window.visualViewport.height));
  }
  if (Number.isFinite(window.innerHeight)) {
    return Math.max(0, Math.round(window.innerHeight));
  }
  if (
    document.documentElement &&
    Number.isFinite(document.documentElement.clientHeight)
  ) {
    return Math.max(0, Math.round(document.documentElement.clientHeight));
  }
  return 0;
}

function syncViewportAndKeyboardState() {
  setWolfCssVariable(WOLF_APP_HEIGHT_VAR, `${getViewportHeightPx()}px`);

  let keyboardInset = 0;
  if (window.visualViewport) {
    const viewportBottom =
      window.visualViewport.height + window.visualViewport.offsetTop;
    keyboardInset = Math.max(
      0,
      Math.round(window.innerHeight - viewportBottom),
    );
  }

  const keyboardOpen =
    keyboardInset > WOLF_KEYBOARD_OPEN_THRESHOLD_PX &&
    isTextEntryElement(document.activeElement);

  setWolfCssVariable(
    WOLF_KEYBOARD_OFFSET_VAR,
    `${keyboardOpen ? keyboardInset : 0}px`,
  );
  if (document.body) {
    document.body.classList.toggle(WOLF_KEYBOARD_OPEN_CLASS, keyboardOpen);
  }
}

function startKeyboardAwareLayoutWatch() {
  if (wolfKeyboardLayoutWatchBound) return;
  wolfKeyboardLayoutWatchBound = true;

  const scheduleSync = () => {
    window.requestAnimationFrame(syncViewportAndKeyboardState);
  };

  scheduleSync();
  window.addEventListener('resize', scheduleSync);
  window.addEventListener('focusin', scheduleSync);
  window.addEventListener('focusout', () => setTimeout(scheduleSync, 80));
  window.addEventListener('orientationchange', () =>
    setTimeout(scheduleSync, 180),
  );
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleSync();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleSync);
    window.visualViewport.addEventListener('scroll', scheduleSync);
  }
}

function resolveThemeColor() {
  if (!document.body) return WOLF_THEME_COLOR_DARK;
  return document.body.classList.contains('light-theme')
    ? WOLF_THEME_COLOR_LIGHT
    : WOLF_THEME_COLOR_DARK;
}

function ensureThemeColorMetaTag() {
  let meta = document.querySelector(WOLF_THEME_META_SELECTOR);
  if (meta) return meta;

  meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = resolveThemeColor();
  document.head.appendChild(meta);
  return meta;
}

function syncThemeColorMeta() {
  const meta = ensureThemeColorMetaTag();
  if (!meta) return;
  meta.content = resolveThemeColor();
}

function startThemeColorWatch() {
  if (wolfThemeColorWatchBound) return;
  wolfThemeColorWatchBound = true;

  syncThemeColorMeta();
  window.addEventListener('focus', syncThemeColorMeta);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncThemeColorMeta();
  });

  const observer = new MutationObserver(() => {
    syncThemeColorMeta();
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

function isStandaloneAppMode() {
  return Boolean(
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true,
  );
}

function isIosSafariBrowser() {
  const ua = String(window.navigator.userAgent || '');
  const isIos = /iPad|iPhone|iPod/i.test(ua);
  const isWebkit = /WebKit/i.test(ua);
  const excluded = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(ua);
  return isIos && isWebkit && !excluded;
}

function ensurePwaInstallStyle() {
  if (document.getElementById(WOLF_PWA_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = WOLF_PWA_STYLE_ID;
  style.textContent = `
#${WOLF_PWA_BUTTON_ID} {
  position: fixed;
  right: calc(14px + env(safe-area-inset-right, 0px));
  bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  z-index: 10050;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  padding: 10px 14px 10px 12px;
  min-height: 48px;
  max-width: 214px;
  overflow: visible;
  background: linear-gradient(130deg, rgba(17, 22, 29, 0.95), rgba(28, 36, 48, 0.96));
  color: #f5f8ff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.34);
  cursor: pointer;
  opacity: 1;
  transform: translateY(0);
  touch-action: manipulation;
  -webkit-touch-callout: none;
  user-select: none;
  transition:
    max-width 260ms ease,
    gap 220ms ease,
    padding 220ms ease,
    transform 220ms ease,
    box-shadow 220ms ease,
    opacity 200ms ease,
    border-color 220ms ease;
}
#${WOLF_PWA_BUTTON_ID}.is-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(16px);
}
#${WOLF_PWA_BUTTON_ID}.is-compact {
  max-width: 52px;
  gap: 0;
  padding-right: 12px;
}
#${WOLF_PWA_BUTTON_ID}.is-expanded {
  max-width: 214px;
  gap: 10px;
  padding-right: 14px;
}
#${WOLF_PWA_BUTTON_ID}:hover {
  transform: translateY(-2px);
  border-color: rgba(245, 178, 42, 0.75);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.4);
}
#${WOLF_PWA_BUTTON_ID}:active {
  transform: translateY(-1px) scale(0.99);
}
#${WOLF_PWA_BUTTON_ID}.is-compact:hover,
#${WOLF_PWA_BUTTON_ID}.is-compact:focus-visible,
#${WOLF_PWA_BUTTON_ID}.is-expanded {
  max-width: 214px;
  gap: 10px;
  padding-right: 14px;
}
#${WOLF_PWA_BUTTON_ID} .wolf-pwa-icon {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 178, 42, 0.18);
  box-shadow: inset 0 0 0 1px rgba(245, 178, 42, 0.28);
  flex-shrink: 0;
}
#${WOLF_PWA_BUTTON_ID} .wolf-pwa-icon svg {
  width: 14px;
  height: 14px;
}
#${WOLF_PWA_BUTTON_ID} .wolf-pwa-label {
  white-space: nowrap;
  opacity: 1;
  max-width: 140px;
  transform: translateX(0);
  transition: opacity 220ms ease, max-width 220ms ease, transform 220ms ease;
}
#${WOLF_PWA_BUTTON_ID} .wolf-pwa-help {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translate(-50%, 8px);
  background: linear-gradient(130deg, rgba(11, 14, 19, 0.96), rgba(22, 30, 40, 0.97));
  color: #f5f8ff;
  border: 1px solid rgba(245, 178, 42, 0.4);
  border-radius: 10px;
  padding: 7px 9px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.35px;
  text-transform: none;
  white-space: normal;
  line-height: 1.35;
  text-align: center;
  max-width: min(72vw, 240px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.36);
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease, transform 180ms ease;
}
#${WOLF_PWA_BUTTON_ID}.is-touch-help .wolf-pwa-help {
  opacity: 1;
  transform: translate(-50%, 0);
}
#${WOLF_PWA_BUTTON_ID}.is-touch-help {
  max-width: 52px !important;
  gap: 0 !important;
  padding-right: 12px !important;
}
#${WOLF_PWA_BUTTON_ID}.is-compact .wolf-pwa-label {
  opacity: 0;
  max-width: 0;
  transform: translateX(8px);
}
#${WOLF_PWA_BUTTON_ID}.is-compact:hover .wolf-pwa-label,
#${WOLF_PWA_BUTTON_ID}.is-compact:focus-visible .wolf-pwa-label,
#${WOLF_PWA_BUTTON_ID}.is-expanded .wolf-pwa-label {
  opacity: 1;
  max-width: 140px;
  transform: translateX(0);
}
body.wolf-keyboard-open #${WOLF_PWA_BUTTON_ID} {
  opacity: 0;
  pointer-events: none;
  transform: translateY(10px);
}
@media (max-width: 767px) {
  #${WOLF_PWA_BUTTON_ID} {
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    max-width: 52px;
    gap: 0;
    padding: 10px 12px;
  }
  body#wolf-terminal #${WOLF_PWA_BUTTON_ID} {
    left: calc(12px + env(safe-area-inset-left, 0px));
    right: auto;
    bottom: calc(86px + env(safe-area-inset-bottom, 0px));
  }
  #${WOLF_PWA_BUTTON_ID} .wolf-pwa-label {
    opacity: 0 !important;
    max-width: 0 !important;
    transform: translateX(8px) !important;
  }
  #${WOLF_PWA_BUTTON_ID} .wolf-pwa-help {
    bottom: calc(100% + 8px);
    font-size: 9px;
    padding: 6px 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  #${WOLF_PWA_BUTTON_ID},
  #${WOLF_PWA_BUTTON_ID}:hover,
  #${WOLF_PWA_BUTTON_ID}:active {
    transition: none;
    transform: none;
  }
}
  `;
  document.head.appendChild(style);
}

function ensurePwaInstallButton() {
  ensurePwaInstallStyle();
  let button = document.getElementById(WOLF_PWA_BUTTON_ID);
  if (button) return button;

  button = document.createElement('button');
  button.id = WOLF_PWA_BUTTON_ID;
  button.type = 'button';
  button.className = 'is-hidden is-compact';
  button.setAttribute('aria-label', WOLF_PWA_INSTALL_LABEL);
  button.title = WOLF_PWA_INSTALL_LABEL;
  button.innerHTML = `
    <span class="wolf-pwa-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3v11"></path>
        <path d="m7 10 5 5 5-5"></path>
        <path d="M5 19h14"></path>
      </svg>
    </span>
    <span class="wolf-pwa-label">${WOLF_PWA_INSTALL_LABEL}</span>
    <span class="wolf-pwa-help" aria-hidden="true">${WOLF_PWA_INSTALL_LABEL}</span>
  `;
  button.addEventListener('click', onPwaInstallButtonClick);
  button.addEventListener('pointerenter', () => {
    clearPwaInstallCompactTimer();
    setPwaInstallButtonExpanded(true);
  });
  button.addEventListener('pointerleave', () => {
    schedulePwaInstallAutoCompact();
  });
  button.addEventListener('focus', () => {
    clearPwaInstallCompactTimer();
    setPwaInstallButtonExpanded(true);
  });
  button.addEventListener('blur', () => {
    schedulePwaInstallAutoCompact();
  });
  button.addEventListener(
    'touchstart',
    () => {
      wolfPwaSuppressNextInstallClick = false;
      clearPwaTouchHelpTimer();
      clearPwaTouchHoldTimer();
      wolfPwaTouchHoldTimer = window.setTimeout(() => {
        wolfPwaSuppressNextInstallClick = true;
        setPwaTouchHelpVisible(true);
      }, WOLF_PWA_TOUCH_HELP_HOLD_MS);
    },
    { passive: true },
  );
  button.addEventListener(
    'touchend',
    () => {
      clearPwaTouchHoldTimer();
      if (button.classList.contains('is-touch-help')) {
        schedulePwaTouchHelpHide();
      }
    },
    { passive: true },
  );
  button.addEventListener(
    'touchcancel',
    () => {
      clearPwaTouchHoldTimer();
      schedulePwaTouchHelpHide();
    },
    { passive: true },
  );
  document.body.appendChild(button);
  return button;
}

function clearPwaInstallCompactTimer() {
  if (!wolfPwaCompactTimer) return;
  window.clearTimeout(wolfPwaCompactTimer);
  wolfPwaCompactTimer = null;
}

function clearPwaTouchHoldTimer() {
  if (!wolfPwaTouchHoldTimer) return;
  window.clearTimeout(wolfPwaTouchHoldTimer);
  wolfPwaTouchHoldTimer = null;
}

function clearPwaTouchHelpTimer() {
  if (!wolfPwaTouchHelpTimer) return;
  window.clearTimeout(wolfPwaTouchHelpTimer);
  wolfPwaTouchHelpTimer = null;
}

function setPwaTouchHelpVisible(visible) {
  const button = ensurePwaInstallButton();
  button.classList.toggle('is-touch-help', Boolean(visible));
}

function showInlinePwaHelp(
  message,
  durationMs = WOLF_PWA_INLINE_HELP_DURATION_MS,
) {
  const button = ensurePwaInstallButton();
  const helpElement = button.querySelector('.wolf-pwa-help');
  if (!helpElement) return;

  helpElement.textContent = message;
  setPwaTouchHelpVisible(true);
  clearPwaTouchHelpTimer();
  wolfPwaTouchHelpTimer = window.setTimeout(() => {
    setPwaTouchHelpVisible(false);
    helpElement.textContent =
      button.getAttribute('aria-label') || WOLF_PWA_INSTALL_LABEL;
  }, durationMs);
}

function schedulePwaTouchHelpHide() {
  clearPwaTouchHelpTimer();
  wolfPwaTouchHelpTimer = window.setTimeout(() => {
    setPwaTouchHelpVisible(false);
  }, WOLF_PWA_TOUCH_HELP_HIDE_MS);
}

function setPwaInstallButtonExpanded(expanded) {
  const button = ensurePwaInstallButton();
  button.classList.toggle('is-expanded', Boolean(expanded));
  button.classList.toggle('is-compact', !expanded);
}

function schedulePwaInstallAutoCompact() {
  clearPwaInstallCompactTimer();
  wolfPwaCompactTimer = window.setTimeout(() => {
    setPwaInstallButtonExpanded(false);
  }, WOLF_PWA_BUTTON_AUTO_COMPACT_MS);
}

function setPwaInstallButtonLabel(label) {
  const button = ensurePwaInstallButton();
  const labelElement = button.querySelector('.wolf-pwa-label');
  if (labelElement) labelElement.textContent = label;
  const helpElement = button.querySelector('.wolf-pwa-help');
  if (helpElement) helpElement.textContent = label;
  button.setAttribute('aria-label', label);
  button.title = label;
}

function setPwaInstallButtonVisible(visible) {
  const button = ensurePwaInstallButton();
  button.classList.toggle('is-hidden', !visible);

  if (!visible) {
    clearPwaInstallCompactTimer();
    clearPwaTouchHoldTimer();
    clearPwaTouchHelpTimer();
    setPwaTouchHelpVisible(false);
    setPwaInstallButtonExpanded(false);
    return;
  }

  setPwaInstallButtonExpanded(true);
  schedulePwaInstallAutoCompact();
}

function showPwaInstallTip(message) {
  const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
  if (isMobileViewport) {
    showInlinePwaHelp(message);
    return;
  }

  if (typeof window.Toastify === 'function') {
    window
      .Toastify({
        text: message,
        duration: 4500,
        gravity: 'bottom',
        position: 'center',
        close: true,
        style: {
          background:
            'linear-gradient(130deg, rgba(17,22,29,0.95), rgba(28,36,48,0.95))',
          color: '#f5f8ff',
          border: '1px solid rgba(245,178,42,0.35)',
        },
      })
      .showToast();
    return;
  }
  window.alert(message);
}

function hasBeforeInstallPromptSupport() {
  return (
    'BeforeInstallPromptEvent' in window || 'onbeforeinstallprompt' in window
  );
}

async function attemptNativePwaPrompt() {
  if (!wolfPwaPromptEvent) return false;

  const promptEvent = wolfPwaPromptEvent;
  wolfPwaPromptEvent = null;
  promptEvent.prompt();

  try {
    const choice = await promptEvent.userChoice;
    if (choice && choice.outcome === 'accepted') {
      setPwaInstallButtonVisible(false);
      return true;
    }
  } catch (_) {
    // keep button visible
  }

  setPwaInstallButtonVisible(true);
  return true;
}

async function onPwaInstallButtonClick() {
  if (wolfPwaSuppressNextInstallClick) {
    wolfPwaSuppressNextInstallClick = false;
    schedulePwaTouchHelpHide();
    return;
  }

  if (isStandaloneAppMode()) {
    setPwaInstallButtonVisible(false);
    return;
  }

  if (await attemptNativePwaPrompt()) {
    return;
  }

  if (isIosSafariBrowser()) {
    showPwaInstallTip(WOLF_PWA_IOS_HELP_TEXT);
    return;
  }

  // Give the browser one short chance to dispatch beforeinstallprompt if it is late.
  await new Promise((resolve) => {
    window.setTimeout(resolve, WOLF_PWA_PROMPT_RECHECK_MS);
  });

  if (await attemptNativePwaPrompt()) {
    return;
  }

  if (!hasBeforeInstallPromptSupport()) {
    showPwaInstallTip(
      'Install from browser menu: open \u22ee then choose "Install app".',
    );
    return;
  }

  if (!wolfPwaSwReady) {
    showPwaInstallTip(
      'Install setup is still initializing. Refresh once, then tap Install App again.',
    );
    return;
  }

  showPwaInstallTip(
    wolfPwaBeforeInstallSeen
      ? 'Install prompt was recently dismissed. Use browser menu (\u22ee > Install app) or try again in a moment.'
      : 'Install prompt is not ready yet. Use browser menu (\u22ee > Install app) if available.',
  );
}

function registerPwaServiceWorker() {
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && !isLocalhost) return;

  navigator.serviceWorker
    .register('/sw.js')
    .then(async (registration) => {
      registration.update().catch(() => {
        // ignore transient update checks
      });

      if (!wolfSwUpdateTimer) {
        wolfSwUpdateTimer = window.setInterval(() => {
          registration.update().catch(() => {
            // ignore transient update checks
          });
        }, WOLF_SW_UPDATE_CHECK_INTERVAL_MS);
      }

      try {
        await navigator.serviceWorker.ready;
        wolfPwaSwReady = true;
      } catch (_) {
        wolfPwaSwReady = true;
      }
    })
    .catch(() => {
      // service worker is optional; ignore registration failures
    });
}

function startPwaInstallWatch() {
  if (wolfPwaInstallWatchBound) return;
  wolfPwaInstallWatchBound = true;

  registerPwaServiceWorker();

  if (isStandaloneAppMode()) {
    setPwaInstallButtonVisible(false);
    return;
  }

  if (isIosSafariBrowser()) {
    setPwaInstallButtonLabel(WOLF_PWA_IOS_LABEL);
  } else {
    setPwaInstallButtonLabel(WOLF_PWA_INSTALL_LABEL);
  }
  setPwaInstallButtonVisible(true);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    wolfPwaPromptEvent = event;
    wolfPwaBeforeInstallSeen = true;
    setPwaInstallButtonLabel(WOLF_PWA_INSTALL_LABEL);
    setPwaInstallButtonVisible(true);
  });

  window.addEventListener('appinstalled', () => {
    wolfPwaPromptEvent = null;
    setPwaInstallButtonVisible(false);
  });
}

// Run once on initial load
document.addEventListener('DOMContentLoaded', () => {
  window.applyVersioning();
  startVersionWatch();
  startNetworkMonitor();
  startKeyboardAwareLayoutWatch();
  startThemeColorWatch();
  startPwaInstallWatch();
});
