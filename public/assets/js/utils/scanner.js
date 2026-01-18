// --- SCANNER ENGINE ---
let html5QrCode = null;

const wolfScanner = {
    async start() {
        const overlay = document.getElementById('wolf-scanner-overlay');
        overlay.style.display = 'flex';
        
        // Reset manual input
        document.getElementById('manualCodeInput').value = '';
        document.getElementById('manualConfirmBtn').style.opacity = '0';

        html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 20, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

        try {
            await html5QrCode.start({ facingMode: "environment" }, config, this.onScanSuccess);
        } catch (err) {
            console.error(err);
            document.getElementById('reader').innerHTML = `<div style="padding:20px; color:#666; font-size:10px;">CAMERA ERROR: ACCESS DENIED</div>`;
        }
    },

    async stop() {
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop();
            await html5QrCode.clear();
        }
        document.getElementById('wolf-scanner-overlay').style.display = 'none';
    },

    onScanSuccess(decodedText) {
        wolfScanner.processResult(decodedText, "DIGITAL_CODE");
    },

    processResult(text, type) {
        if (navigator.vibrate) navigator.vibrate(100);
        this.stop(); // Stop camera

        const modal = document.getElementById('scanResultModal');
        const body = document.getElementById('scan-data-body');
        
        // Show the centered modal
        modal.style.display = 'flex';

        // Inject the industrial design
        body.innerHTML = `
            <div class="scan-info-box">
                <label>IDENTIFIED PAYLOAD</label>
                <div class="data-text">${text}</div>
                
                <hr style="border-color: #111; margin: 15px 0;">
                
                <label>MODULE TYPE</label>
                <div style="color: var(--wolf-red); font-weight: 900; font-size: 12px;">
                    ${type}
                </div>
            </div>
            <p style="font-size: 11px; color: #555; margin-bottom: 20px;">
                Confirm authorization to proceed with system logging.
            </p>
        `;
    }
};

// --- INTERFACE LISTENERS ---
document.addEventListener('input', (e) => {
    // Show/Hide manual confirm button based on input length
    if (e.target.id === 'manualCodeInput') {
        const btn = document.getElementById('manualConfirmBtn');
        if (e.target.value.trim().length > 0) {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        } else {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
        }
    }
});

document.addEventListener('click', (e) => {
    // Open Scanner
    if (e.target.closest('#qrScannerBtn')) wolfScanner.start();

    // Close Scanner
    if (e.target.closest('#exitScannerBtn')) wolfScanner.stop();

    // Manual Input Confirm
    if (e.target.closest('#manualConfirmBtn')) {
        const val = document.getElementById('manualCodeInput').value;
        wolfScanner.processResult(val, "MANUAL_ENTRY");
    }

    // Guest Button (Placeholder)
    if (e.target.closest('.btn-guest-entry')) {
        alert("WOLF OS: Directing to Guest Registration Module...");
        wolfScanner.stop();
    }

    // Modal Actions
    if (e.target.id === 'confirmScanBtn' || e.target.closest('#confirmScanBtn')) {
        document.getElementById('scanResultModal').style.display = 'none';
        console.log("Authorization Successful.");
    }

    // Cancel / Rescan
    if (e.target.id === 'cancelScanBtn' || e.target.closest('#cancelScanBtn')) {
        document.getElementById('scanResultModal').style.display = 'none';
        wolfScanner.start(); // Re-open the camera
    }
});