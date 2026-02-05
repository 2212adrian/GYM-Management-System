/**
 * WOLF OS - LOGBOOK MANAGER (V2.0)
 * Handles Atomic Time Sync and Guest Check-ins
 */
window.logbookManager = {
  selectedProfileId: null,
  clockInterval: null,
  serverOffset: 0, // Delta between PC and Supabase

  async openLogbookTerminal() {
    console.log('Wolf OS: Initializing Logbook Entry Protocol...');
    if (window.wolfAudio) window.wolfAudio.play('notif');
    // 1. Ensure Atomic Time is synced first to prevent "Invalid Date"
    if (window.wolfData && window.wolfData.syncServerTime) {
      await window.wolfData.syncServerTime();
    }

    // 2. Fetch and Inject Modal Component
    const oldModal = document.getElementById('logbook-modal-overlay');
    if (oldModal) oldModal.remove();

    try {
      const res = await fetch('/assets/components/record-logbook-modal.html');
      const html = await res.text();
      document.body.insertAdjacentHTML('beforeend', html);

      const modal = document.getElementById('logbook-modal-overlay');

      // 3. Calculate Clock Offset (PC vs Server)
      await this.syncClockOffset();

      // 4. Initialize UI Components
      if (modal) {
        modal.style.display = 'flex';
        this.attachLogbookListeners(modal);
        this.startTerminalClock(modal);
      }
    } catch (err) {
      console.error('Wolf OS: Modal Load Fault:', err);
    }
  },

  /**
   * Calculates the exact difference in time between the User's PC
   * and the Supabase Server to ensure ENTRY_TIMESTAMP is accurate.
   */
  async syncClockOffset() {
    try {
      const { data, error } = await supabaseClient.rpc('get_server_time');
      if (error) throw error;

      // Handle both table return or direct timestamp return
      const serverTS = Array.isArray(data)
        ? data[0].server_iso_timestamp || data[0]
        : data;

      if (!serverTS) throw new Error('Null Timestamp Received');

      const serverMillis = new Date(serverTS).getTime();
      const localMillis = Date.now();

      // Difference to add to every local tick
      this.serverOffset = serverMillis - localMillis;

      console.log(`Wolf OS: Time Delta Calibrated [${this.serverOffset}ms]`);
    } catch (err) {
      console.warn('Wolf OS: RPC Sync Failed, defaulting to Local Time.');
      this.serverOffset = 0;
    }
  },

  /**
   * Runs the UI clock using the calculated Server Offset
   */
  startTerminalClock(modal) {
    const timeDisplay = modal.querySelector('#log-current-time');
    if (!timeDisplay) return;

    if (this.clockInterval) clearInterval(this.clockInterval);

    this.clockInterval = setInterval(() => {
      // Calculate Atomic Time: Local PC Time + Calculated Offset
      const atomicDate = new Date(Date.now() + this.serverOffset);

      // Final Safety Check for "Invalid Date"
      if (isNaN(atomicDate.getTime())) {
        timeDisplay.innerText = 'SYNCING...';
        return;
      }

      timeDisplay.innerText = atomicDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    }, 1000);
  },

  attachLogbookListeners(modal) {
    const form = modal.querySelector('#record-logbook-form');
    // Button is now inside the container as per request
    const closeBtn = modal.querySelector('#closeLogModal');
    const input = modal.querySelector('#log-guest-search');

    // 1. AUTHORIZE CHECK-IN
    form.onsubmit = async (e) => {
      e.preventDefault();
      const guestName = input.value.trim();
      const submitBtn = modal.querySelector('#log-submit-btn');

      if (!guestName) return;

      submitBtn.disabled = true;
      submitBtn.querySelector('span').innerText = 'AUTHORIZING...';

      await this.processCheckIn(guestName);
      this.closeLogbookTerminal();
    };

    // 2. CLOSE VIA OBVIOUS BUTTON
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        this.closeLogbookTerminal();
      };
    }

    // 3. CLOSE VIA OVERLAY (BACKGROUND)
    modal.onclick = (e) => {
      if (e.target.id === 'logbook-modal-overlay') {
        this.closeLogbookTerminal();
      }
    };

    // 4. ESCAPE KEY PROTOCOL
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeLogbookTerminal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // 5. AUTO-FOCUS
    setTimeout(() => {
      if (input) input.focus();
    }, 200);
  },

  closeLogbookTerminal() {
    const modal = document.getElementById('logbook-modal-overlay');
    if (modal) {
      const card = modal.querySelector('.wolf-modal-card');
      modal.classList.add('closing');
      if (card) card.classList.add('closing');
      clearInterval(this.clockInterval);
      // Clean up DOM to prevent ID conflicts
      setTimeout(() => modal.remove(), 260);
    }
  },

  /**
   * Logic to insert into check_in_logs table
   */
  async processCheckIn(name) {
    try {
      const payload = {
        profile_id: this.selectedProfileId || null,
        source: 'TERMINAL',
        // If not a member, store name in notes
        notes: this.selectedProfileId
          ? 'MEMBER_ENTRY'
          : `WALK-IN: ${name.toUpperCase()}`,
        // time_in is handled by Supabase DEFAULT now() for maximum security
      };

      const { error } = await supabaseClient
        .from('check_in_logs')
        .insert([payload]);

      if (error) throw error;

      // UI FEEDBACK
      if (window.salesManager)
        window.salesManager.showSystemAlert(
          `ACCESS GRANTED: ${name}`,
          'success',
        );

      if (window.wolfAudio) window.wolfAudio.play('success');

      // REFRESH LOGBOOK ROWS
      if (window.wolfData && window.wolfData.loadLogbook) {
        window.wolfData.loadLogbook();
      }
    } catch (err) {
      console.error('Logbook Protocol Fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
      if (window.salesManager)
        window.salesManager.showSystemAlert('DATABASE_REJECTED_ENTRY', 'error');
    }
  },
};
