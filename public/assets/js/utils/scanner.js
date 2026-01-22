let html5QrCode = null;

window.wolfScanner = {
  currentCameraId: null,
  activeCallback: null, // Stores the function to run after a successful scan
  onCloseCallback: null,
  isProcessingResult: false,
  lastScanTime: 0,
  isFrontFacing: false,
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

    this.activeCallback = callback;
    this.onCloseCallback = onClose;
    document.getElementById('wolf-scanner-overlay').style.display = 'flex';

    try {
      const cameras = await Html5Qrcode.getCameras();
      this.availableCameras = cameras;

      // Setup PC Dropdown (Keep ID-based for PC)
      if (cameras.length > 0) {
        const selector = document.getElementById('cameraSelect');
        selector.innerHTML = cameras
          .map(
            (cam, idx) =>
              `<option value="${cam.id}">${cam.label || 'Camera ' + (idx + 1)}</option>`,
          )
          .join('');

        selector.onchange = (e) => this.launchCamera(e.target.value);
      }

      // Start with BACK camera by default
      this.isFrontFacing = false;
      this.launchCamera({ facingMode: 'environment' });
    } catch (err) {
      this.showInactiveUI('PERMISSION DENIED');
    }
  },
  // salesManager.js or scanner.js
  async cycleCamera() {
    if (window.wolfAudio) window.wolfAudio.play('notif');

    // Toggle the state
    this.isFrontFacing = !this.isFrontFacing;
    const mode = this.isFrontFacing ? 'user' : 'environment';

    // Show status feedback
    const statusText = document.querySelector('.scanner-footer-status span');
    if (statusText)
      statusText.textContent = `RE-LINKING OPTICS (${mode.toUpperCase()})...`;

    // RESTART
    await this.launchCamera({ facingMode: mode });
  },

  async launchCamera(cameraConfig) {
    const readerDiv = document.getElementById('reader');

    // 1. STEP 1: Aggressively kill the previous instance
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
        html5QrCode = null;
      } catch (e) {
        console.warn('Clean stop failed, Proceeding to DOM wipe.');
      }
    }

    // 2. STEP 2: THE BRUTE FORCE FIX
    // Completely empty the div to destroy any "stuck" video elements
    readerDiv.innerHTML = '';

    // 3. STEP 3: Hardware Cooldown
    // We give the phone's OS 300ms to physically close the lens shutter
    await new Promise((r) => setTimeout(r, 300));

    // 4. STEP 4: Fresh Start
    html5QrCode = new Html5Qrcode('reader');

    try {
      await html5QrCode.start(
        cameraConfig,
        {
          fps: 20,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (text) => this.processResult(text, 'SCAN'),
      );

      const statusText = document.querySelector('.scanner-footer-status span');
      if (statusText) statusText.textContent = 'CAMERA ACTIVE | OPTICS LINKED';
    } catch (err) {
      console.error('Camera Start Error:', err);
      // If environment fails, try a generic start as a last resort
      if (!this.isFrontFacing) {
        console.log('Environment failed, trying fallback...');
        this.showInactiveUI('RE-TRYING LINK...');
        setTimeout(
          () => this.launchCamera({ facingMode: 'environment' }),
          1000,
        );
      } else {
        this.showInactiveUI('HARDWARE_FAULT');
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
