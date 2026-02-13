const WOLF_CONFIG = {
  noLoadingScreen: false,
  VERSION: 'v0.6.4',
  FULL_VERSION: 'GYM V0.6.4',
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
let wolfUpdateCheckTimer = null;
let wolfKnownPageSignature = null;
let wolfPendingUpdateSignature = null;
let wolfNetworkMonitorTimer = null;
let wolfNetworkCheckInFlight = false;
let wolfNetworkIsOnline = true;

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
      dismissUpdateBanner();
      return;
    }

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
        'A newer version is available. Click to refresh.',
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
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(1200px 560px at 85% 10%, rgba(166, 52, 41, 0.16), transparent 62%),
    radial-gradient(880px 480px at 15% 90%, rgba(40, 90, 166, 0.14), transparent 66%),
    linear-gradient(150deg, rgba(6, 7, 10, 0.92), rgba(10, 12, 16, 0.98));
  backdrop-filter: blur(3px);
  opacity: 0;
  pointer-events: none;
  transform: scale(1.02);
  transition: opacity 220ms ease, transform 260ms ease;
}
#${WOLF_NETWORK_OVERLAY_ID}.is-active {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
}
#${WOLF_NETWORK_OVERLAY_ID}::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 34px 34px;
  opacity: 0.45;
  pointer-events: none;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-card {
  width: min(92vw, 560px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-left: 4px solid rgba(255, 98, 83, 0.96);
  background: linear-gradient(150deg, rgba(14, 16, 20, 0.9), rgba(11, 13, 18, 0.96));
  box-shadow: 0 22px 46px rgba(0, 0, 0, 0.44);
  padding: 18px 18px 16px;
  color: #f1f4fb;
  position: relative;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #ff6253;
  box-shadow: 0 0 0 0 rgba(255, 98, 83, 0.62);
  animation: wolfNetPulse 1.55s infinite;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-title {
  margin: 0;
  font-size: 15px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  font-weight: 800;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-code {
  margin: 0 0 10px;
  color: #b8c0ce;
  font-size: 12px;
  letter-spacing: 0.25px;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-desc {
  margin: 0;
  color: #cfd7e4;
  font-size: 13px;
  line-height: 1.55;
}
#${WOLF_NETWORK_OVERLAY_ID} .wolf-net-foot {
  margin-top: 12px;
  font-size: 11px;
  color: #8f98a8;
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
        <h3 class="wolf-net-title">Connection Lost</h3>
      </div>
      <p class="wolf-net-code">[OFFLINE_UPLINK_SEVERED]</p>
      <p class="wolf-net-desc">
        Live connection to Wolf Palomar servers is unavailable.
        The interface will automatically resume once internet access is restored.
      </p>
      <p class="wolf-net-foot">Realtime auto-reconnect is active.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function setNetworkOverlayVisible(visible) {
  const overlay = ensureNetworkOverlay();
  if (!overlay) return;
  overlay.classList.toggle('is-active', Boolean(visible));
}

async function pingInternet() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WOLF_NETWORK_CHECK_TIMEOUT_MS);
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

// Run once on initial load
document.addEventListener('DOMContentLoaded', () => {
  window.applyVersioning();
  startVersionWatch();
  startNetworkMonitor();
});
