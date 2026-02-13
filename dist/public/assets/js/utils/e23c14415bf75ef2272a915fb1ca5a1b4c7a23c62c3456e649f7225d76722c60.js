const WOLF_CONFIG={noLoadingScreen:!1,VERSION:"v0.6.6",FULL_VERSION:"GYM V0.6.6",BRAND_WHITE:"WOLF",BRAND_RED:"PALOMAR",COMPANY:"WOLF PALOMAR",YEAR:"2026"},WOLF_UPDATE_CHECK_INTERVAL_MS=45e3,WOLF_UPDATE_BANNER_ID="wolf-update-banner",WOLF_UPDATE_BANNER_STYLE_ID="wolf-update-banner-style",WOLF_UPDATE_DISMISS_KEY="wolf_update_banner_dismissed_signature",WOLF_NETWORK_STYLE_ID="wolf-network-monitor-style",WOLF_NETWORK_OVERLAY_ID="wolf-network-overlay",WOLF_NETWORK_CHECK_INTERVAL_MS=12e3,WOLF_NETWORK_CHECK_TIMEOUT_MS=4500,WOLF_KEYBOARD_OPEN_CLASS="wolf-keyboard-open",WOLF_APP_HEIGHT_VAR="--wolf-app-height",WOLF_KEYBOARD_OFFSET_VAR="--wolf-keyboard-offset",WOLF_KEYBOARD_OPEN_THRESHOLD_PX=110,WOLF_THEME_META_SELECTOR='meta[name="theme-color"]',WOLF_THEME_COLOR_DARK="#0f1012",WOLF_THEME_COLOR_LIGHT="#ebe5dd",WOLF_PWA_BUTTON_ID="wolf-pwa-install-button",WOLF_PWA_STYLE_ID="wolf-pwa-install-style",WOLF_PWA_INSTALL_LABEL="Install App",WOLF_PWA_IOS_LABEL="Add to Home Screen",WOLF_PWA_IOS_HELP_TEXT='On iPhone/iPad: tap Share, then choose "Add to Home Screen".',WOLF_PWA_BUTTON_AUTO_COMPACT_MS=3200,WOLF_PWA_TOUCH_HELP_HOLD_MS=360,WOLF_PWA_TOUCH_HELP_HIDE_MS=2200,WOLF_PWA_INLINE_HELP_DURATION_MS=2800,WOLF_SW_UPDATE_CHECK_INTERVAL_MS=6e4,WOLF_PWA_PROMPT_RECHECK_MS=1200;let wolfUpdateCheckTimer=null,wolfKnownPageSignature=null,wolfPendingUpdateSignature=null,wolfNetworkMonitorTimer=null,wolfNetworkCheckInFlight=!1,wolfNetworkIsOnline=!0,wolfNetworkDetailsExpanded=!1,wolfKeyboardLayoutWatchBound=!1,wolfThemeColorWatchBound=!1,wolfPwaPromptEvent=null,wolfPwaInstallWatchBound=!1,wolfSwUpdateTimer=null,wolfPwaCompactTimer=null,wolfPwaTouchHoldTimer=null,wolfPwaTouchHelpTimer=null,wolfPwaSuppressNextInstallClick=!1,wolfPwaBeforeInstallSeen=!1,wolfPwaSwReady=!1;window.applyVersioning=function(){console.log("Wolf OS: Applying Versioning:",WOLF_CONFIG.FULL_VERSION),document.querySelectorAll(".sys-full-version").forEach(e=>e.textContent=WOLF_CONFIG.FULL_VERSION),document.querySelectorAll(".sys-version").forEach(e=>e.textContent=WOLF_CONFIG.VERSION),document.querySelectorAll(".sys-os-version").forEach(e=>e.textContent=`OS ${WOLF_CONFIG.VERSION}`),document.querySelectorAll(".brand-container").forEach(e=>{e.innerHTML=`${WOLF_CONFIG.BRAND_WHITE} <span>${WOLF_CONFIG.BRAND_RED}</span>`}),document.querySelectorAll(".sys-copyright").forEach(e=>{e.innerHTML=`&copy; ${WOLF_CONFIG.YEAR} ${WOLF_CONFIG.COMPANY}. All Rights Reserved.`})};function wolfHashText(e){const t=String(e||"");let n=5381;for(let o=0;o<t.length;o+=1)n=(n<<5)+n^t.charCodeAt(o);return(n>>>0).toString(16)}async function fetchNoStoreText(e,t=5e3){const n=new AbortController,o=setTimeout(()=>n.abort(),t);try{const a=e.includes("?")?"&":"?",i=`${e}${a}_vchk=${Date.now()}`,r=await fetch(i,{method:"GET",cache:"no-store",signal:n.signal,headers:{"Cache-Control":"no-cache",Pragma:"no-cache"}});if(!r.ok)throw new Error(`Probe failed (${r.status}) for ${e}`);return await r.text()}finally{clearTimeout(o)}}function normalizeVersionLabel(e){return String(e||"").trim()}function extractVersionFromSystemConfigSource(e){const t=String(e||"");if(!t)return null;const n=t.match(/VERSION\s*:\s*['"]([^'"]+)['"]/i);return n&&n[1]?normalizeVersionLabel(n[1]):null}async function fetchRemoteSystemConfigSource(){try{return await fetchNoStoreText("/assets/js/utils/system-config.js")}catch(e){}try{const e=await fetchNoStoreText("/asset-manifest.json"),t=JSON.parse(e),n=t&&typeof t=="object"&&t["/assets/js/utils/system-config.js"];return n?await fetchNoStoreText(String(n)):null}catch(e){return null}}async function fetchLatestVersionLabel(){const e=await fetchRemoteSystemConfigSource();return extractVersionFromSystemConfigSource(e)}function buildUpdateBannerMessage(e,t){const n=normalizeVersionLabel(e),o=normalizeVersionLabel(t);return n&&o&&n!==o?`A newer version is available (${n} -> ${o}). Click to refresh.`:o?`A newer version (${o}) is available. Click to refresh.`:"A newer version is available. Click to refresh."}async function fetchCurrentPageSignature(){const e=["/asset-manifest.json","/assets/js/utils/system-config.js",`${window.location.pathname}${window.location.search}`,"/index.html"];for(const t of e)try{const n=await fetchNoStoreText(t);if(n)return wolfHashText(n)}catch(n){}throw new Error("Update check failed for all probes")}function ensureUpdateBannerStyle(){if(document.getElementById(WOLF_UPDATE_BANNER_STYLE_ID))return;const e=document.createElement("style");e.id=WOLF_UPDATE_BANNER_STYLE_ID,e.textContent=`
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
  `,document.head.appendChild(e)}function dismissUpdateBanner(){const e=document.getElementById(WOLF_UPDATE_BANNER_ID);e&&e.remove()}function showUpdateBanner(e,t,n=null){ensureUpdateBannerStyle();const o=document.getElementById(WOLF_UPDATE_BANNER_ID);if(o){o.querySelector(".wolf-update-banner-text").textContent=e;return}const a=document.createElement("div");a.id=WOLF_UPDATE_BANNER_ID,a.innerHTML=`
    <span class="wolf-update-banner-text"></span>
    <button type="button" class="wolf-update-banner-refresh">Refresh Now</button>
    <button type="button" class="wolf-update-banner-dismiss">Dismiss</button>
  `,a.querySelector(".wolf-update-banner-text").textContent=e;const i=a.querySelector(".wolf-update-banner-refresh"),r=a.querySelector(".wolf-update-banner-dismiss");i.addEventListener("click",()=>{typeof t=="function"&&t()}),r.addEventListener("click",()=>{dismissUpdateBanner(),typeof n=="function"&&n()}),document.body.appendChild(a)}window.showUpdateBanner=showUpdateBanner,window.newVersionAvailable=!1,window.currentAppVersion=WOLF_CONFIG.VERSION,window.latestAvailableVersion=null,window.forceShowUpdateNotification=function(e=null){window.newVersionAvailable=!0;const t=normalizeVersionLabel(e);t&&(window.latestAvailableVersion=t),showUpdateBanner(buildUpdateBannerMessage(WOLF_CONFIG.VERSION,window.latestAvailableVersion),()=>{window.location.reload()},()=>{window.newVersionAvailable=!1})},window.hideUpdateNotification=function(){dismissUpdateBanner(),window.newVersionAvailable=!1};async function checkForNewVersion(){try{const e=await fetchCurrentPageSignature();if(!wolfKnownPageSignature){wolfKnownPageSignature=e,window.newVersionAvailable=!1;return}const t=e!==wolfKnownPageSignature;if(window.newVersionAvailable=t,!t){wolfPendingUpdateSignature=null,window.latestAvailableVersion=null,dismissUpdateBanner();return}const n=await fetchLatestVersionLabel();window.latestAvailableVersion=normalizeVersionLabel(n)||null,wolfPendingUpdateSignature=e;let o="";try{o=window.sessionStorage.getItem(WOLF_UPDATE_DISMISS_KEY)||""}catch(a){o=""}if(o===e){dismissUpdateBanner();return}window.newVersionAvailable&&showUpdateBanner(buildUpdateBannerMessage(WOLF_CONFIG.VERSION,window.latestAvailableVersion),()=>{window.location.reload()},()=>{try{wolfPendingUpdateSignature&&window.sessionStorage.setItem(WOLF_UPDATE_DISMISS_KEY,wolfPendingUpdateSignature)}catch(a){}})}catch(e){}}function startVersionWatch(){wolfUpdateCheckTimer||(checkForNewVersion(),wolfUpdateCheckTimer=setInterval(checkForNewVersion,WOLF_UPDATE_CHECK_INTERVAL_MS))}function ensureNetworkMonitorStyle(){if(document.getElementById(WOLF_NETWORK_STYLE_ID))return;const e=document.createElement("style");e.id=WOLF_NETWORK_STYLE_ID,e.textContent=`
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
  `,document.head.appendChild(e)}function setNetworkOverlayExpanded(e){const t=ensureNetworkOverlay();if(!t)return;const n=!!e;wolfNetworkDetailsExpanded=n,t.classList.toggle("is-expanded",n);const o=t.querySelector(".wolf-net-toggle");if(!o)return;o.setAttribute("aria-expanded",n?"true":"false"),o.setAttribute("aria-label",n?"Hide network details":"Show network details");const a=o.querySelector(".wolf-net-toggle-text");a&&(a.textContent=n?"Hide details":"Show details");const i=o.querySelector("i");i&&(i.className=`bx ${n?"bxs-chevron-up":"bxs-chevron-down"}`)}function ensureNetworkOverlay(){ensureNetworkMonitorStyle();let e=document.getElementById(WOLF_NETWORK_OVERLAY_ID);if(e)return e;e=document.createElement("div"),e.id=WOLF_NETWORK_OVERLAY_ID,e.setAttribute("role","status"),e.setAttribute("aria-live","assertive"),e.innerHTML=`
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
  `,document.body.appendChild(e);const t=e.querySelector(".wolf-net-toggle");return t&&t.addEventListener("click",n=>{n.preventDefault(),setNetworkOverlayExpanded(!wolfNetworkDetailsExpanded)}),setNetworkOverlayExpanded(!1),e}function setNetworkOverlayVisible(e){const t=ensureNetworkOverlay();if(!t)return;const n=!!e,o=t.classList.contains("is-active");if(t.classList.toggle("is-active",n),!n){setNetworkOverlayExpanded(!1);return}o||setNetworkOverlayExpanded(!1)}async function pingInternet(){const e=new AbortController,t=setTimeout(()=>e.abort(),WOLF_NETWORK_CHECK_TIMEOUT_MS);try{return await fetch(`/assets/images/favicon.ico?_netchk=${Date.now()}`,{method:"GET",cache:"no-store",signal:e.signal,headers:{"Cache-Control":"no-cache",Pragma:"no-cache"}}),!0}catch(n){return!1}finally{clearTimeout(t)}}async function evaluateNetworkState(){if(!wolfNetworkCheckInFlight){wolfNetworkCheckInFlight=!0;try{const e=await pingInternet();e!==wolfNetworkIsOnline?(wolfNetworkIsOnline=e,setNetworkOverlayVisible(!e)):e||setNetworkOverlayVisible(!0)}finally{wolfNetworkCheckInFlight=!1}}}function startNetworkMonitor(){wolfNetworkMonitorTimer||(ensureNetworkOverlay(),wolfNetworkIsOnline=navigator.onLine,setNetworkOverlayVisible(!wolfNetworkIsOnline),window.addEventListener("offline",()=>{wolfNetworkIsOnline=!1,setNetworkOverlayVisible(!0)}),window.addEventListener("online",()=>{evaluateNetworkState()}),document.addEventListener("visibilitychange",()=>{document.hidden||evaluateNetworkState()}),evaluateNetworkState(),wolfNetworkMonitorTimer=setInterval(evaluateNetworkState,WOLF_NETWORK_CHECK_INTERVAL_MS))}function setWolfCssVariable(e,t){document.documentElement&&document.documentElement.style.setProperty(e,t)}function isTextEntryElement(e){if(!e||!e.tagName)return!1;const t=String(e.tagName).toLowerCase();if(t==="textarea"||t==="select")return!0;if(t!=="input")return!!(e.isContentEditable||e.getAttribute("contenteditable")==="true");const n=String(e.type||"text").toLowerCase();return!new Set(["button","checkbox","color","file","hidden","image","radio","range","reset","submit"]).has(n)}function getViewportHeightPx(){return window.visualViewport&&Number.isFinite(window.visualViewport.height)?Math.max(0,Math.round(window.visualViewport.height)):Number.isFinite(window.innerHeight)?Math.max(0,Math.round(window.innerHeight)):document.documentElement&&Number.isFinite(document.documentElement.clientHeight)?Math.max(0,Math.round(document.documentElement.clientHeight)):0}function syncViewportAndKeyboardState(){setWolfCssVariable(WOLF_APP_HEIGHT_VAR,`${getViewportHeightPx()}px`);let e=0;if(window.visualViewport){const n=window.visualViewport.height+window.visualViewport.offsetTop;e=Math.max(0,Math.round(window.innerHeight-n))}const t=e>WOLF_KEYBOARD_OPEN_THRESHOLD_PX&&isTextEntryElement(document.activeElement);setWolfCssVariable(WOLF_KEYBOARD_OFFSET_VAR,`${t?e:0}px`),document.body&&document.body.classList.toggle(WOLF_KEYBOARD_OPEN_CLASS,t)}function startKeyboardAwareLayoutWatch(){if(wolfKeyboardLayoutWatchBound)return;wolfKeyboardLayoutWatchBound=!0;const e=()=>{window.requestAnimationFrame(syncViewportAndKeyboardState)};e(),window.addEventListener("resize",e),window.addEventListener("focusin",e),window.addEventListener("focusout",()=>setTimeout(e,80)),window.addEventListener("orientationchange",()=>setTimeout(e,180)),document.addEventListener("visibilitychange",()=>{document.hidden||e()}),window.visualViewport&&(window.visualViewport.addEventListener("resize",e),window.visualViewport.addEventListener("scroll",e))}function resolveThemeColor(){return document.body&&document.body.classList.contains("light-theme")?WOLF_THEME_COLOR_LIGHT:WOLF_THEME_COLOR_DARK}function ensureThemeColorMetaTag(){let e=document.querySelector(WOLF_THEME_META_SELECTOR);return e||(e=document.createElement("meta"),e.name="theme-color",e.content=resolveThemeColor(),document.head.appendChild(e),e)}function syncThemeColorMeta(){const e=ensureThemeColorMetaTag();e&&(e.content=resolveThemeColor())}function startThemeColorWatch(){if(wolfThemeColorWatchBound)return;wolfThemeColorWatchBound=!0,syncThemeColorMeta(),window.addEventListener("focus",syncThemeColorMeta),document.addEventListener("visibilitychange",()=>{document.hidden||syncThemeColorMeta()}),new MutationObserver(()=>{syncThemeColorMeta()}).observe(document.body,{attributes:!0,attributeFilter:["class"]})}function isStandaloneAppMode(){return!!(window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===!0)}function isIosSafariBrowser(){const e=String(window.navigator.userAgent||""),t=/iPad|iPhone|iPod/i.test(e),n=/WebKit/i.test(e),o=/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(e);return t&&n&&!o}function ensurePwaInstallStyle(){if(document.getElementById(WOLF_PWA_STYLE_ID))return;const e=document.createElement("style");e.id=WOLF_PWA_STYLE_ID,e.textContent=`
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
  `,document.head.appendChild(e)}function ensurePwaInstallButton(){ensurePwaInstallStyle();let e=document.getElementById(WOLF_PWA_BUTTON_ID);return e||(e=document.createElement("button"),e.id=WOLF_PWA_BUTTON_ID,e.type="button",e.className="is-hidden is-compact",e.setAttribute("aria-label",WOLF_PWA_INSTALL_LABEL),e.title=WOLF_PWA_INSTALL_LABEL,e.innerHTML=`
    <span class="wolf-pwa-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3v11"></path>
        <path d="m7 10 5 5 5-5"></path>
        <path d="M5 19h14"></path>
      </svg>
    </span>
    <span class="wolf-pwa-label">${WOLF_PWA_INSTALL_LABEL}</span>
    <span class="wolf-pwa-help" aria-hidden="true">${WOLF_PWA_INSTALL_LABEL}</span>
  `,e.addEventListener("click",onPwaInstallButtonClick),e.addEventListener("pointerenter",()=>{clearPwaInstallCompactTimer(),setPwaInstallButtonExpanded(!0)}),e.addEventListener("pointerleave",()=>{schedulePwaInstallAutoCompact()}),e.addEventListener("focus",()=>{clearPwaInstallCompactTimer(),setPwaInstallButtonExpanded(!0)}),e.addEventListener("blur",()=>{schedulePwaInstallAutoCompact()}),e.addEventListener("touchstart",()=>{wolfPwaSuppressNextInstallClick=!1,clearPwaTouchHelpTimer(),clearPwaTouchHoldTimer(),wolfPwaTouchHoldTimer=window.setTimeout(()=>{wolfPwaSuppressNextInstallClick=!0,setPwaTouchHelpVisible(!0)},WOLF_PWA_TOUCH_HELP_HOLD_MS)},{passive:!0}),e.addEventListener("touchend",()=>{clearPwaTouchHoldTimer(),e.classList.contains("is-touch-help")&&schedulePwaTouchHelpHide()},{passive:!0}),e.addEventListener("touchcancel",()=>{clearPwaTouchHoldTimer(),schedulePwaTouchHelpHide()},{passive:!0}),document.body.appendChild(e),e)}function clearPwaInstallCompactTimer(){wolfPwaCompactTimer&&(window.clearTimeout(wolfPwaCompactTimer),wolfPwaCompactTimer=null)}function clearPwaTouchHoldTimer(){wolfPwaTouchHoldTimer&&(window.clearTimeout(wolfPwaTouchHoldTimer),wolfPwaTouchHoldTimer=null)}function clearPwaTouchHelpTimer(){wolfPwaTouchHelpTimer&&(window.clearTimeout(wolfPwaTouchHelpTimer),wolfPwaTouchHelpTimer=null)}function setPwaTouchHelpVisible(e){ensurePwaInstallButton().classList.toggle("is-touch-help",!!e)}function showInlinePwaHelp(e,t=WOLF_PWA_INLINE_HELP_DURATION_MS){const n=ensurePwaInstallButton(),o=n.querySelector(".wolf-pwa-help");o&&(o.textContent=e,setPwaTouchHelpVisible(!0),clearPwaTouchHelpTimer(),wolfPwaTouchHelpTimer=window.setTimeout(()=>{setPwaTouchHelpVisible(!1),o.textContent=n.getAttribute("aria-label")||WOLF_PWA_INSTALL_LABEL},t))}function schedulePwaTouchHelpHide(){clearPwaTouchHelpTimer(),wolfPwaTouchHelpTimer=window.setTimeout(()=>{setPwaTouchHelpVisible(!1)},WOLF_PWA_TOUCH_HELP_HIDE_MS)}function setPwaInstallButtonExpanded(e){const t=ensurePwaInstallButton();t.classList.toggle("is-expanded",!!e),t.classList.toggle("is-compact",!e)}function schedulePwaInstallAutoCompact(){clearPwaInstallCompactTimer(),wolfPwaCompactTimer=window.setTimeout(()=>{setPwaInstallButtonExpanded(!1)},WOLF_PWA_BUTTON_AUTO_COMPACT_MS)}function setPwaInstallButtonLabel(e){const t=ensurePwaInstallButton(),n=t.querySelector(".wolf-pwa-label");n&&(n.textContent=e);const o=t.querySelector(".wolf-pwa-help");o&&(o.textContent=e),t.setAttribute("aria-label",e),t.title=e}function setPwaInstallButtonVisible(e){if(ensurePwaInstallButton().classList.toggle("is-hidden",!e),!e){clearPwaInstallCompactTimer(),clearPwaTouchHoldTimer(),clearPwaTouchHelpTimer(),setPwaTouchHelpVisible(!1),setPwaInstallButtonExpanded(!1);return}setPwaInstallButtonExpanded(!0),schedulePwaInstallAutoCompact()}function showPwaInstallTip(e){if(window.matchMedia("(max-width: 767px)").matches){showInlinePwaHelp(e);return}if(typeof window.Toastify=="function"){window.Toastify({text:e,duration:4500,gravity:"bottom",position:"center",close:!0,style:{background:"linear-gradient(130deg, rgba(17,22,29,0.95), rgba(28,36,48,0.95))",color:"#f5f8ff",border:"1px solid rgba(245,178,42,0.35)"}}).showToast();return}window.alert(e)}function hasBeforeInstallPromptSupport(){return"BeforeInstallPromptEvent"in window||"onbeforeinstallprompt"in window}async function attemptNativePwaPrompt(){if(!wolfPwaPromptEvent)return!1;const e=wolfPwaPromptEvent;wolfPwaPromptEvent=null,e.prompt();try{const t=await e.userChoice;if(t&&t.outcome==="accepted")return setPwaInstallButtonVisible(!1),!0}catch(t){}return setPwaInstallButtonVisible(!0),!0}async function onPwaInstallButtonClick(){if(wolfPwaSuppressNextInstallClick){wolfPwaSuppressNextInstallClick=!1,schedulePwaTouchHelpHide();return}if(isStandaloneAppMode()){setPwaInstallButtonVisible(!1);return}if(!await attemptNativePwaPrompt()){if(isIosSafariBrowser()){showPwaInstallTip(WOLF_PWA_IOS_HELP_TEXT);return}if(await new Promise(e=>{window.setTimeout(e,WOLF_PWA_PROMPT_RECHECK_MS)}),!await attemptNativePwaPrompt()){if(!hasBeforeInstallPromptSupport()){showPwaInstallTip('Install from browser menu: open ⋮ then choose "Install app".');return}if(!wolfPwaSwReady){showPwaInstallTip("Install setup is still initializing. Refresh once, then tap Install App again.");return}showPwaInstallTip(wolfPwaBeforeInstallSeen?"Install prompt was recently dismissed. Use browser menu (⋮ > Install app) or try again in a moment.":"Install prompt is not ready yet. Use browser menu (⋮ > Install app) if available.")}}}function registerPwaServiceWorker(){const e=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1";"serviceWorker"in navigator&&(window.location.protocol!=="https:"&&!e||navigator.serviceWorker.register("/sw.js").then(async t=>{t.update().catch(()=>{}),wolfSwUpdateTimer||(wolfSwUpdateTimer=window.setInterval(()=>{t.update().catch(()=>{})},WOLF_SW_UPDATE_CHECK_INTERVAL_MS));try{await navigator.serviceWorker.ready,wolfPwaSwReady=!0}catch(n){wolfPwaSwReady=!0}}).catch(()=>{}))}function startPwaInstallWatch(){if(!wolfPwaInstallWatchBound){if(wolfPwaInstallWatchBound=!0,registerPwaServiceWorker(),isStandaloneAppMode()){setPwaInstallButtonVisible(!1);return}isIosSafariBrowser()?setPwaInstallButtonLabel(WOLF_PWA_IOS_LABEL):setPwaInstallButtonLabel(WOLF_PWA_INSTALL_LABEL),setPwaInstallButtonVisible(!0),window.addEventListener("beforeinstallprompt",e=>{e.preventDefault(),wolfPwaPromptEvent=e,wolfPwaBeforeInstallSeen=!0,setPwaInstallButtonLabel(WOLF_PWA_INSTALL_LABEL),setPwaInstallButtonVisible(!0)}),window.addEventListener("appinstalled",()=>{wolfPwaPromptEvent=null,setPwaInstallButtonVisible(!1)})}}document.addEventListener("DOMContentLoaded",()=>{window.applyVersioning(),startVersionWatch(),startNetworkMonitor(),startKeyboardAwareLayoutWatch(),startThemeColorWatch(),startPwaInstallWatch()});
