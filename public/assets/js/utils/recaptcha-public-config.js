// Public config for reCAPTCHA.
// Site key is safe to expose. Secret key must stay server-side.
(function () {
  window.WOLF_RECAPTCHA_PUBLIC_CONFIG = {
    siteKey: '__WOLF_RECAPTCHA_SITE_KEY__',
    requiredAt: 0, // 0 = require on every login attempt
  };
})();
