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

    // Haptic/Audio Feedback
    if (navigator.vibrate) navigator.vibrate(80);
    if (window.wolfAudio) window.wolfAudio.play('success');

    const quickAuth = document.getElementById('quickAuthToggle')?.checked;

    // Normalize: uppercase + remove spaces
    const normalized = String(text || '')
      .toUpperCase()
      .replace(/\s+/g, '');

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

    this.isProcessingResult = false;
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
