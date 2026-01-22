let html5QrCode = null;

window.wolfScanner = {
  currentCameraId: null,
  activeCallback: null, // Stores the function to run after a successful scan
  onCloseCallback: null,
  isProcessingResult: false,
  lastScanTime: 0,
  isFrontFacing: false,
  currentCamIndex: 0,

  debug(msg) {
    const log = document.getElementById('scanner-debug-log');
    if (log) {
      log.style.display = 'block';
      log.innerHTML += `<div>> ${msg}</div>`;
      log.scrollTop = log.scrollHeight;
    }
    console.log(`Scanner: ${msg}`);
  },

  async init() {
    if (document.getElementById('wolf-scanner-overlay')) return true;
    try {
      const res = await fetch('/assets/components/scanner-modal.html');
      if (!res.ok) throw new Error('Component not found');
      const html = await res.text();
      document.body.insertAdjacentHTML('beforeend', html);
      this.attachListeners();
      return true;
    } catch (err) {
      console.error('Wolf OS: Scanner Load Fault:', err);
      return false;
    }
  },

  // ADDED: hideGuest parameter to control button visibility
  async start(callback = null, hideGuest = false, onClose = null) {
    const ready = await this.init();
    if (!ready) return;
    this.debug('INITIALIZING OPTICS...');

    this.activeCallback = callback;
    this.onCloseCallback = onClose;
    document.getElementById('wolf-scanner-overlay').style.display = 'flex';

    try {
      // 1. Get ALL hardware IDs
      const cameras = await Html5Qrcode.getCameras();
      this.availableCameras = cameras;
      this.debug(`FOUND ${cameras.length} LENSES`);

      if (cameras && cameras.length > 0) {
        // Find the index of the first back camera to start with
        let backIdx = cameras.findIndex(
          (c) =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('environment'),
        );
        this.currentCamIndex = backIdx !== -1 ? backIdx : 0;

        this.debug(`STARTING WITH: ${cameras[this.currentCamIndex].label}`);
        await this.launchCamera(cameras[this.currentCamIndex].id);
      }
    } catch (err) {
      this.debug(`INIT_ERROR: ${err.message}`);
    }
  },

  async cycleCamera() {
    if (window.wolfAudio) window.wolfAudio.play('notif');

    // Increment index to next hardware ID
    this.currentCamIndex =
      (this.currentCamIndex + 1) % this.availableCameras.length;
    const nextCam = this.availableCameras[this.currentCamIndex];

    this.debug(`SWITCHING TO: ${nextCam.label}`);

    // Force a fresh launch with the specific ID
    await this.launchCamera(nextCam.id);
  },

  async launchCamera(cameraId) {
    const readerDiv = document.getElementById('reader');

    // 1. KILL EXISTING
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
        html5QrCode = null;
        this.debug('PREVIOUS STREAM TERMINATED');
      } catch (e) {
        this.debug('CLEANUP_RETRY...');
      }
    }

    // 2. DOM RESET
    readerDiv.innerHTML = '';

    // 3. HARDWARE COOLDOWN (Essential for multi-lens)
    await new Promise((r) => setTimeout(r, 400));

    // 4. START FRESH WITH ID
    html5QrCode = new Html5Qrcode('reader');

    try {
      await html5QrCode.start(
        cameraId, // Using exact ID instead of facingMode
        {
          fps: 20,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (text) => this.processResult(text, 'SCAN'),
      );
      this.debug('LINK_ESTABLISHED');
    } catch (err) {
      this.debug(`LINK_FAULT: ${err.message}`);
      // If it crashes, it might be a locked lens. Try auto-cycling.
      if (this.availableCameras.length > 1) {
        this.debug('RE-ROUTING TO NEXT LENS...');
        setTimeout(() => this.cycleCamera(), 500);
      }
    }
  },

  setupCameraSelector(cameras) {
    const selectorWrap = document.getElementById('camera-selector-wrap');
    const selector = document.getElementById('cameraSelect');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // PC only selector (shown if more than 1 camera)
    if (cameras.length > 1 && !isMobile) {
      selectorWrap.style.display = 'flex';
      selector.innerHTML = cameras
        .map(
          (cam) =>
            `<option value="${cam.id}" ${cam.id === this.currentCameraId ? 'selected' : ''}>${cam.label || 'Camera ' + cam.id}</option>`,
        )
        .join('');

      selector.onchange = (e) => {
        this.currentCameraId = e.target.value;
        this.launchCamera(this.currentCameraId);
      };
    } else {
      selectorWrap.style.display = 'none';
    }
  },

  processResult(text, type) {
    const currentTime = Date.now();
    // BLOCK if last scan was less than 2.5 seconds ago
    if (currentTime - this.lastScanTime < 2500) return;
    this.lastScanTime = currentTime;
    if (this.isProcessingResult) return;
    this.isProcessingResult = true;
    if (navigator.vibrate) navigator.vibrate(100);
    const quickAuth = document.getElementById('quickAuthToggle')?.checked;
    this.stop();

    if (this.activeCallback) {
      this.activeCallback(text);
      this.activeCallback = null;
      this.isProcessingResult = false;
      return;
    }

    if (window.salesManager) {
      if (quickAuth) {
        // Path A: Instant Addition
        window.salesManager.processQuickSale(text);
      } else {
        // Path B: Open Modal with pre-filled data
        window.salesManager.openSaleTerminal(text);
      }
    }

    this.isProcessingResult = false;
  },

  async stop() {
    if (html5QrCode && html5QrCode.isScanning) {
      await html5QrCode.stop();
    }

    document.getElementById('wolf-scanner-overlay').style.display = 'none';
    document.querySelector('.btn-guest-entry')?.classList.remove('visible');

    // We check if salesManager exists first to prevent errors
    if (
      window.salesManager &&
      typeof window.salesManager.showTopInstruction === 'function'
    ) {
      window.salesManager.showTopInstruction(false);
    }

    this.isProcessingResult = false; // Always unlock on stop
    if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop();
    document.getElementById('wolf-scanner-overlay').style.display = 'none';

    if (this.onCloseCallback) {
      this.onCloseCallback();
      this.onCloseCallback = null;
    }
  },

  showInactiveUI(message) {
    const reader = document.getElementById('reader');
    if (window.wolfAudio) window.wolfAudio.play('error');

    reader.innerHTML = `<div class="camera-inactive-state"><i class='bx bx-camera-off' style="color:var(--wolf-red); opacity: 1;"></i><span style="color:var(--wolf-red)">${message}</span></div>`;
  },

  attachListeners() {
    const input = document.getElementById('manualCodeInput');
    const group = document.getElementById('manualInputGroup');
    if (input) {
      input.addEventListener('input', (e) => {
        // NEW LOGIC: Force input to ALL CAPS
        e.target.value = e.target.value.toUpperCase();

        if (e.target.value.trim().length > 0) {
          group.classList.add('has-content');
        } else {
          group.classList.remove('has-content');
        }
      });
    }
    document.getElementById('exitScannerBtn').onclick = () => {
      this.stop();
    };
    document.getElementById('manualConfirmBtn').onclick = () => {
      const val = document.getElementById('manualCodeInput').value;
      if (val.trim()) this.processResult(val, 'MANUAL_ENTRY');
    };
  },

  setupCameraSelector(cameras) {
    const selectorWrap = document.getElementById('camera-selector-wrap');
    const selector = document.getElementById('cameraSelect');

    // Simple check for PC vs Mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (cameras.length > 1 && !isMobile) {
      selectorWrap.style.display = 'flex';

      // Clear and fill dropdown
      selector.innerHTML = cameras
        .map(
          (cam) =>
            `<option value="${cam.id}" ${cam.id === this.currentCameraId ? 'selected' : ''}>${cam.label || 'Camera ' + cam.id}</option>`,
        )
        .join('');

      // ATTACH THE CHANGE EVENT
      selector.onchange = (e) => {
        console.log('Wolf OS: Switching camera source...');
        this.launchCamera(e.target.value);
      };
    } else {
      selectorWrap.style.display = 'none';
    }
  },
};

// Start logic
document.addEventListener('click', (e) => {
  if (e.target.closest('#qrScannerBtn')) wolfScanner.start();
});
