const WOLF_CONFIG = {
  noLoadingScreen: false,
  VERSION: 'v0.6.3',
  FULL_VERSION: 'GYM V0.6.3',
  BRAND_WHITE: 'WOLF',
  BRAND_RED: 'PALOMAR',
  COMPANY: 'WOLF PALOMAR',
  YEAR: '2026',
};

const WOLF_UPDATE_CHECK_INTERVAL_MS = 45000;
const WOLF_UPDATE_BANNER_ID = 'wolf-update-banner';
const WOLF_UPDATE_BANNER_STYLE_ID = 'wolf-update-banner-style';
let wolfUpdateCheckTimer = null;
let wolfKnownPageSignature = null;

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

async function fetchCurrentPageSignature() {
  const basePath = `${window.location.pathname}${window.location.search}`;
  const joiner = basePath.includes('?') ? '&' : '?';
  const url = `${basePath}${joiner}_vchk=${Date.now()}`;
  const res = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`Update check failed (${res.status})`);
  }
  const html = await res.text();
  return wolfHashText(html);
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
  `;
  document.head.appendChild(style);
}

function showUpdateBanner(message, onRefresh) {
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
    <button type="button">Refresh Now</button>
  `;
  banner.querySelector('.wolf-update-banner-text').textContent = message;
  const button = banner.querySelector('button');
  button.addEventListener('click', () => {
    if (typeof onRefresh === 'function') onRefresh();
  });
  document.body.appendChild(banner);
}

window.showUpdateBanner = showUpdateBanner;
window.newVersionAvailable = false;

async function checkForNewVersion() {
  if (window.newVersionAvailable) return;
  try {
    const latestSignature = await fetchCurrentPageSignature();
    if (!wolfKnownPageSignature) {
      wolfKnownPageSignature = latestSignature;
      return;
    }
    if (latestSignature !== wolfKnownPageSignature) {
      window.newVersionAvailable = true;
      if (window.newVersionAvailable) {
        showUpdateBanner(
          'A newer version is available. Click to refresh.',
          () => {
            window.location.reload();
          },
        );
      }
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

// Run once on initial load
document.addEventListener('DOMContentLoaded', () => {
  window.applyVersioning();
  startVersionWatch();
});
