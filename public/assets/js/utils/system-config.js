const WOLF_CONFIG = {
  noLoadingScreen: false,
  VERSION: 'v0.3.6',
  FULL_VERSION: 'GYM V0.3.6',
  BRAND_WHITE: 'WOLF',
  BRAND_RED: 'PALOMAR',
  COMPANY: 'WOLF PALOMAR',
  YEAR: '2026',
};

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

// Run once on initial load
document.addEventListener('DOMContentLoaded', window.applyVersioning);
