/**
 * WOLF OS - SCANNER MODULE
 * Handles Hardware Optics & Manual System ID Entry
 */

let html5QrCode = null;

window.wolfScanner = {
  availableCameras: [],
  currentCamIndex: 0,
  activeCallback: null,
  onCloseCallback: null,
  isProcessingResult: false,
  isSwitchingCamera: false,
  lastScanTime: 0,

  /**
   * Initialize the Scanner Component
   */
  async init() {
    if (document.getElementById('wolf-scanner-overlay')) return true;
    try {
      const res = await fetch('/assets/components/scanner-modal.html');
      if (!res.ok) throw new Error('Scanner component missing');
      const html = await res.text();
      document.body.insertAdjacentHTML('beforeend', html);
      this.attachListeners();
      return true;
    } catch (err) {
      console.error('Wolf OS: Scanner Init Fault:', err);
      return false;
    }
  },

  /**
   * Start Scanner Sequence
   */
  async start(callback = null, hideGuest = false, onClose = null) {
    const ready = await this.init();
    if (!ready) return;

    this.activeCallback = callback;
    this.onCloseCallback = onClose;

    const overlay = document.getElementById('wolf-scanner-overlay');
    overlay.style.display = 'flex';

    // --- 1. UX: AUTO-FOCUS MANUAL INPUT ---
    const manualInput = document.getElementById('manualCodeInput');
    if (manualInput) {
      manualInput.value = ''; // Clear old data
      // Delay focus slightly to ensure the keyboard pops up on mobile after CSS transitions
      setTimeout(() => manualInput.focus(), 300);
    }

    // --- 2. HARDWARE: INITIALIZE CAMERAS ---
    try {
      const cameras = await Html5Qrcode.getCameras();
      this.availableCameras = cameras;

      if (cameras && cameras.length > 0) {
        const selector = document.getElementById('cameraSelect');

        // Populate PC Dropdown
        selector.innerHTML = cameras
          .map(
            (cam, i) =>
              `<option value="${cam.id}">${cam.label || 'Optic ' + (i + 1)}</option>`,
          )
          .join('');

        selector.onchange = (e) => this.launchCamera(e.target.value);

        // Mobile Flip Logic
        document.getElementById('flipCameraBtn').onclick = () =>
          this.cycleCamera();

        // Auto-select REAR camera by default
        let backCamIndex = cameras.findIndex((cam) =>
          /back|rear|environment|main/i.test(cam.label),
        );

        this.currentCamIndex = backCamIndex !== -1 ? backCamIndex : 0;
        selector.value = cameras[this.currentCamIndex].id;

        await this.launchCamera(cameras[this.currentCamIndex].id);
      }
    } catch (err) {
      this.showInactiveUI('PERMISSION_DENIED');
    }
  },

  /**
   * Launch Specific Camera Instance
   */
  async launchCamera(cameraId) {
    if (this.isSwitchingCamera) return;
    this.isSwitchingCamera = true;

    // Clean up existing instance
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
      } catch (e) {}
      html5QrCode = null;
    }

    const reader = document.getElementById('reader');
    reader.innerHTML = ''; // Clear viewfinder UI
    html5QrCode = new Html5Qrcode('reader');

    try {
      await html5QrCode.start(
        cameraId,
        { fps: 20, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (text) => this.processResult(text, 'SCAN'),
      );
    } catch (err) {
      this.showInactiveUI('HARDWARE_FAULT');
    } finally {
      this.isSwitchingCamera = false;
    }
  },

  /**
   * Cycle through available cameras (Mobile Flip)
   */
  async cycleCamera() {
    if (this.availableCameras.length < 2) return;
    if (window.wolfAudio) window.wolfAudio.play('notif');

    this.currentCamIndex =
      (this.currentCamIndex + 1) % this.availableCameras.length;
    const nextCamId = this.availableCameras[this.currentCamIndex].id;

    // Sync PC selector UI
    const selector = document.getElementById('cameraSelect');
    if (selector) selector.value = nextCamId;

    await this.launchCamera(nextCamId);
  },

  isQuickLoginPayload(rawText) {
    return typeof rawText === 'string' && rawText.startsWith('WOLFQL1.');
  },

  decodeQuickLoginPayload(rawText) {
    if (!this.isQuickLoginPayload(rawText)) return null;

    try {
      const encoded = rawText.slice('WOLFQL1.'.length).trim();
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const decoded = atob(base64 + padding);
      const data = JSON.parse(decoded);

      const requestId = data?.requestId || data?.r;
      const requestSecret = data?.requestSecret || data?.s;
      if (!requestId || !requestSecret) return null;

      const compactPreview = Array.isArray(data?.p) ? data.p : null;
      const previewContextRaw =
        data?.previewContext && typeof data.previewContext === 'object'
          ? data.previewContext
          : compactPreview && compactPreview.length >= 4
            ? {
                ip: compactPreview[0],
                city: compactPreview[1],
                region: compactPreview[2],
                country: compactPreview[3],
              }
            : null;

      return {
        requestId: String(requestId),
        requestSecret: String(requestSecret),
        previewContext:
          previewContextRaw && typeof previewContextRaw === 'object'
            ? {
                ip: String(previewContextRaw.ip || ''),
                city: String(previewContextRaw.city || ''),
                region: String(previewContextRaw.region || ''),
                country: String(previewContextRaw.country || ''),
                countryCode: String(previewContextRaw.countryCode || ''),
              }
            : null,
        previewSig: String(data.previewSig || data.g || ''),
      };
    } catch (_) {
      return null;
    }
  },

  async handleQuickLoginApproval(rawText) {
    const payload = this.decodeQuickLoginPayload(rawText);
    if (!payload) throw new Error('Malformed quick-login code');

    const previewRes = await fetch('/.netlify/functions/quick-login-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: payload.requestId,
        requestSecret: payload.requestSecret,
        previewContext: payload.previewContext,
        previewSig: payload.previewSig,
        consume: false,
      }),
    });

    let previewData = {};
    try {
      previewData = await previewRes.json();
    } catch (_) {
      previewData = {};
    }

    if (!previewRes.ok) {
      throw new Error(previewData.error || 'Unable to preview quick-login request');
    }

    if (previewData.status !== 'pending') {
      throw new Error('Quick-login session is no longer pending');
    }

    const location = previewData.location || {};
    const locationLine = [
      location.city,
      location.region,
      location.country,
    ]
      .filter(Boolean)
      .join(', ') || 'Unknown location';

    const ipLine = location.ip || 'Unknown IP';
    const sanitizePlain = (value) => {
      const raw = String(value ?? '');
      if (window.DOMPurify) {
        return window.DOMPurify.sanitize(raw, {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
        });
      }
      return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const safeIpLine = sanitizePlain(ipLine);
    const safeLocationLine = sanitizePlain(locationLine);
    const safeSessionRef = sanitizePlain(
      String(payload.requestId).slice(0, 10).toUpperCase(),
    );

    let isConfirmed = false;
    if (window.Swal) {
      const result = await window.Swal.fire({
        title: 'APPROVE QUICK LOGIN?',
        html: `
          <div style="text-align:left; font-size:13px; color:#aab3c2; line-height:1.6;">
            <div style="margin-bottom:8px;">
              <strong style="color:#e7eefc;">Request IP:</strong><br>${safeIpLine}
            </div>
            <div style="margin-bottom:8px;">
              <strong style="color:#e7eefc;">Location:</strong><br>${safeLocationLine}
            </div>
            <div>
              <strong style="color:#e7eefc;">Session Ref:</strong><br>${safeSessionRef}
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'CONFIRM LOGIN',
        cancelButtonText: 'CANCEL',
        reverseButtons: true,
        background: '#111',
        buttonsStyling: false,
        customClass: {
          popup: 'wolf-swal-popup wolf-border-orange',
          title: 'wolf-swal-title',
          confirmButton: 'btn-wolf-red',
          cancelButton: 'btn-wolf-secondary',
        },
      });
      isConfirmed = Boolean(result.isConfirmed);
    } else {
      isConfirmed = window.confirm(
        `Approve quick login?\nIP: ${ipLine}\nLocation: ${locationLine}`,
      );
    }

    if (!isConfirmed) return;

    const sessionResult = await window.supabaseClient?.auth?.getSession?.();
    const currentSession = sessionResult?.data?.session || null;

    if (!currentSession?.access_token || !currentSession?.refresh_token) {
      throw new Error('No active authenticated session found for approval');
    }

    const approveRes = await fetch('/.netlify/functions/quick-login-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: payload.requestId,
        requestSecret: payload.requestSecret,
        accessToken: currentSession.access_token,
        refreshToken: currentSession.refresh_token,
      }),
    });

    let approveData = {};
    try {
      approveData = await approveRes.json();
    } catch (_) {
      approveData = {};
    }

    if (!approveRes.ok) {
      throw new Error(approveData.error || 'Failed to approve quick-login request');
    }

    if (window.wolfAudio) window.wolfAudio.play('success');
    if (window.Toastify) {
      window.Toastify({
        text: 'Quick login approved successfully.',
        duration: 2800,
        gravity: 'bottom',
        position: 'right',
        style: {
          background: 'linear-gradient(90deg, #1e734a, #2ea35f)',
          color: '#f6fff9',
        },
      }).showToast();
    }
  },

  /**
   * Handle Scanned or Manually Entered Data
   */
  async processResult(text, type) {
    const currentTime = Date.now();
    // Prevent double-processing
    if (currentTime - this.lastScanTime < 2000) return;
    this.lastScanTime = currentTime;

    if (this.isProcessingResult) return;
    this.isProcessingResult = true;

    try {
      // Haptic/Audio Feedback
      if (navigator.vibrate) navigator.vibrate(80);
      if (window.wolfAudio) window.wolfAudio.play('success');

      const quickAuth = document.getElementById('quickAuthToggle')?.checked;
      const rawText = String(text || '').trim();

      // Dedicated secure flow for quick-login QR payloads
      if (this.isQuickLoginPayload(rawText)) {
        await this.stop();
        await this.handleQuickLoginApproval(rawText);
        return;
      }

      // Normalize: uppercase + remove spaces
      const normalized = rawText.toUpperCase().replace(/\s+/g, '');

      // Stop camera and hide scanner
      await this.stop();

      // ROUTING LOGIC
      if (this.activeCallback) {
        // Use case: Scanner opened by a specific function to get a string
        this.activeCallback(normalized);
      } else if (window.salesManager) {
        // Use case: Global POS usage
        if (quickAuth) {
          // Instant process (SKIPS MODAL)
          await window.salesManager.processQuickSale(normalized);
        } else {
          // Open Modal with Pre-filled SKU
          await window.salesManager.openSaleTerminal(normalized);
        }
      }
    } catch (err) {
      if (window.wolfAudio) window.wolfAudio.play('error');
      if (window.Swal) {
        window.Swal.fire({
          title: 'QUICK LOGIN REJECTED',
          text: err.message || 'Failed to process QR payload.',
          background: '#111',
          buttonsStyling: false,
          customClass: {
            popup: 'wolf-swal-popup wolf-border-red',
            title: 'wolf-swal-title',
            confirmButton: 'btn-wolf-red',
          },
          confirmButtonText: 'OK',
        });
      } else {
        alert(err.message || 'Failed to process QR payload.');
      }
    } finally {
      this.isProcessingResult = false;
    }
  },

  /**
   * Shutdown Scanner & Reset UI
   */
  async stop() {
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
        html5QrCode.clear();
      } catch (e) {}
      html5QrCode = null;
    }

    document.getElementById('wolf-scanner-overlay').style.display = 'none';

    // Reset Manual Input UI
    const input = document.getElementById('manualCodeInput');
    const group = document.getElementById('manualInputGroup');
    if (input) input.value = '';
    if (group) group.classList.remove('has-content');

    if (this.onCloseCallback) {
      this.onCloseCallback();
      this.onCloseCallback = null;
    }
  },

  /**
   * Event Listener Delegation
   */
  attachListeners() {
    const input = document.getElementById('manualCodeInput');
    const group = document.getElementById('manualInputGroup');
    const confirmBtn = document.getElementById('manualConfirmBtn');
    const results = document.getElementById('custom-search-results');
    let searchTimer = null;

    if (input) {
      // 1. Force Uppercase & UI Animation
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
        group.classList.toggle('has-content', e.target.value.trim().length > 0);
      });

      // 1.1 Product name search -> use SKU
      input.addEventListener('input', () => {
        const query = input.value.trim();
        if (!results) return;

        if (searchTimer) clearTimeout(searchTimer);
        if (query.length < 1) {
          results.classList.remove('active');
          results.innerHTML = '';
          return;
        }

        searchTimer = setTimeout(async () => {
          let data = [];

          if (window.supabaseClient) {
            const res = await window.supabaseClient
              .from('products')
              .select('name, sku')
              .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
              .order('name', { ascending: true })
              .limit(6);

            if (!res.error) data = res.data || [];
          }

          // Fallback to in-memory products if available
          if ((!data || data.length === 0) && window.ProductManager?.allProducts) {
            const q = query.toLowerCase();
            data = window.ProductManager.allProducts
              .filter(
                (p) =>
                  (p.name && p.name.toLowerCase().includes(q)) ||
                  (p.sku && p.sku.toLowerCase().includes(q)),
              )
              .slice(0, 6)
              .map((p) => ({ name: p.name, sku: p.sku }));
          }

          if (!results) return;

          if (!data || data.length === 0) {
            results.classList.remove('active');
            results.innerHTML = '';
            return;
          }

          results.innerHTML = data
            .map(
              (p) => `
              <div class="dropdown-item" data-sku="${p.sku || ''}">
                <span>${(p.name || '').toUpperCase()}</span>
                <span class="sku">PR-${(p.sku || '').toUpperCase()}</span>
              </div>
            `,
            )
            .join('');
          results.classList.add('active');
        }, 250);
      });

      // 2. ENTER KEY LOGIC (Submits the form)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = input.value.trim();
          if (val) this.processResult(val, 'MANUAL_ENTRY');
        }
      });
    }

    // 3. Manual Button Click
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        const val = input.value.trim();
        if (val) this.processResult(val, 'MANUAL_ENTRY');
      };
    }

    // 3.5 Dropdown selection -> use SKU as code
    if (results) {
      results.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const sku = item.getAttribute('data-sku') || '';
        if (!sku) return;

        if (input) input.value = sku.toUpperCase();
        results.classList.remove('active');
        results.innerHTML = '';
        if (group) group.classList.add('has-content');
        this.processResult(sku, 'MANUAL_PICK');
      });
    }

    // 4. Close UI
    const exitBtn = document.getElementById('exitScannerBtn');
    if (exitBtn) exitBtn.onclick = () => this.stop();
  },

  showInactiveUI(message) {
    const reader = document.getElementById('reader');
    if (window.wolfAudio) window.wolfAudio.play('error');
    reader.innerHTML = `
      <div class="camera-inactive-state">
        <i class='bx bx-camera-off' style="color:var(--wolf-red); opacity: 1;"></i>
        <span style="color:var(--wolf-red)">${message}</span>
      </div>`;
  },
};

// Global Listener for QR Trigger
document.addEventListener('click', (e) => {
  if (e.target.closest('#qrScannerBtn')) {
    window.wolfScanner.start();
  }
});
