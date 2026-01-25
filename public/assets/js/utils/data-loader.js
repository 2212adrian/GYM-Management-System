// Add this to your wolfData or a global utility
async function moveToTrash(tableName, id, data) {
  console.log(`Wolf OS: Moving ${id} from ${tableName} to Trash...`);

  const { error } = await supabaseClient.from('trash_bin').insert([
    {
      original_table: tableName,
      original_id: id,
      payload: data,
    },
  ]);

  if (error) throw error;
}

const wolfData = {
  // Enables Realtime from supabase
  selectedDate: new Date(),
  serverToday: new Date(),
  activeMode: 'sales',
  isFetching: false,
  allSales: [],

  async syncServerTime() {
    console.log('Wolf OS: Synchronizing with Atomic Clock...');
    try {
      const { data, error } = await supabaseClient.rpc('get_server_time');
      if (error) throw error;

      // Supabase often returns RPC data as a string or an array of one object
      // We ensure we get the raw string value
      const timestamp = Array.isArray(data) ? data[0] : data;

      if (timestamp) {
        this.selectedDate = new Date(timestamp);
        this.serverToday = new Date(timestamp); // The reference for "Today"
      } else {
        throw new Error('No timestamp returned');
      }
    } catch (err) {
      console.error('Wolf OS: Sync Fault. Falling back to system clock.', err);
      this.selectedDate = new Date();
      this.serverToday = new Date();
    }

    // Safety check: if parsing failed, don't leave it as Invalid Date
    if (isNaN(this.selectedDate.getTime())) {
      this.selectedDate = new Date();
      this.serverToday = new Date();
    }
  },

  async syncTime() {
    console.log('Wolf OS: Syncing with Atomic Server Clock...');
    try {
      const { data, error } = await supabaseClient.rpc('get_server_time');

      if (data && data[0]) {
        const parts = data[0].server_date.split('-');
        // Set both the reference and the selected date
        this.serverToday = new Date(parts[0], parts[1] - 1, parts[2]);
        this.selectedDate = new Date(this.serverToday);
      }
    } catch (err) {
      console.warn('Wolf OS: Time Sync Failed, using local clock.');
    }
    // Return the date so the caller can await it
    return this.selectedDate;
  },

  // Refresh today's index (0-6)
  get realTodayIndex() {
    return new Date().getDay();
  },
  // Get today's ISO date (YYYY-MM-DD)
  get realTodayISO() {
    return new Date().toISOString().split('T')[0];
  },

  // Inside your wolfData object in data-loader.js
  async initLedger(mode) {
    this.activeMode = mode;

    // AWAIT the sync so we don't proceed with null dates
    await this.syncTime();

    const title = document.getElementById('ledger-title');
    const label = document.getElementById('ledger-summary-label');
    const searchContainer = document.getElementById('ledger-search-container');

    if (title) {
      if (mode === 'sales') {
        title.innerText = 'SALES';
        label.innerText = 'Daily Income Summary';
      } else {
        title.innerText = 'LOGBOOK';
        label.innerText = 'Total Floor Traffic';
      }
    }

    // Ensure search bar starts in the correct state
    if (searchContainer) {
      searchContainer.style.display = 'block';
      searchContainer.classList.remove('active');
    }

    this.initChrono(mode);
  },

  // ==========================================
  // 0. CHRONO CORE (WEEK NAVIGATOR)
  // ==========================================
  initChrono(type) {
    if (this.fp) {
      this.fp.destroy();
      this.fp = null;
    }
    const trigger = document.getElementById('chrono-picker-trigger');
    const serverMax = this.serverToday || new Date();
    this.fp = flatpickr('#hidden-chrono-input', {
      disableMobile: true,
      maxDate: serverMax,
      animate: true,
      positionElement: trigger,
      position: 'below',

      onReady: (selectedDates, dateStr, instance) => {
        const cal = instance.calendarContainer;

        // Apply Wolf OS v3 skin
        cal.classList.remove('wolf-calendar-v2', 'wolf-calendar-v3');
        cal.classList.add('wolf-calendar');

        // Ensure correct base state
        cal.classList.remove('open');
      },

      onOpen: (_, __, instance) => {
        // Trigger CSS intro animation
        requestAnimationFrame(() => {
          instance.calendarContainer.classList.add('open');
        });
      },

      onClose: (_, __, instance) => {
        // Smooth exit (no snap close)
        instance.calendarContainer.classList.remove('open');
      },

      onChange: (selectedDates) => {
        if (selectedDates.length > 0) {
          this.selectedDate = selectedDates[0];
          this.calculateWeek(type);
        }
      },
    });

    // Manual trigger (safe)
    if (trigger) {
      trigger.onclick = null;
      trigger.onclick = () => {
        if (this.fp.isOpen) {
          this.fp.close();
        } else {
          this.fp.open();
        }
      };
    }

    this.calculateWeek(type);
  },

  calculateWeek(type) {
    const d = new Date(this.selectedDate);
    const dayIndex = d.getDay();
    const sun = new Date(d);
    sun.setDate(d.getDate() - dayIndex);
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    this.updateChronoUI(sun, sat, dayIndex, type);
  },

  shiftWeek(days, type) {
    this.selectedDate.setDate(this.selectedDate.getDate() + days);
    this.calculateWeek(type);
  },

  async updateChronoUI(sun, sat, activeIndex) {
    // 2. DEFENSIVE CHECK: Ensure sun and sat are valid dates
    if (!sun || isNaN(sun.getTime()) || !sat || isNaN(sat.getTime())) return;

    if (this.fp) this.fp.setDate(this.selectedDate, false);

    const fmt = (date) =>
      date
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        .toUpperCase();

    const display = document.getElementById('week-range-display');
    if (display) display.innerText = `${fmt(sun)} - ${fmt(sat)}`;

    const realToday = this.serverToday || new Date();
    const realTodayISO = realToday.toLocaleDateString('en-CA');

    const realSun = new Date(realToday);
    realSun.setDate(realToday.getDate() - realToday.getDay());
    const realSunISO = realSun.toLocaleDateString('en-CA');
    const viewSunISO = sun.toLocaleDateString('en-CA');

    const snapBtn = document.getElementById('snap-today-btn');
    if (snapBtn) {
      if (viewSunISO < realSunISO) snapBtn.classList.add('visible');
      else snapBtn.classList.remove('visible');
    }

    const buttons = document.querySelectorAll(`#ledger-day-picker .day-btn`);
    buttons.forEach((btn, idx) => {
      const btnDate = new Date(sun);
      btnDate.setDate(sun.getDate() + idx);
      const btnISO = btnDate.toLocaleDateString('en-CA');

      btn.setAttribute('data-date', btnISO);
      btn.classList.toggle('active', idx === activeIndex);
      btn.disabled = btnISO > realTodayISO;
    });

    const selectedISO = this.selectedDate.toLocaleDateString('en-CA');
    this.isReadOnly = selectedISO !== realTodayISO;
    this.applyLockdownUI();

    // 3. REFRESH DATA
    if (this.activeMode === 'sales') await this.loadSales();
    else await this.loadLogbook();
  },

  // State management for filtering
  currentLogDay: new Date().getDay(),
  currentSalesDay: new Date().getDay(),
  realToday: new Date().getDay(),
  salesDataCache: [], // Cache used for instant searching without re-fetching from DB

  // ==========================================
  // 1. LOGBOOK ENGINE (FIXED)
  // ==========================================
  async loadLogbook() {
    // 1. SET TRASH MODE
    if (window.salesManager) window.salesManager.currentTrashMode = 'logbook';

    const container = document.getElementById('ledger-list-container');
    const summaryVal = document.getElementById('ledger-summary-amount');
    const searchInp = document.getElementById('ledger-main-search');
    const searchTerm = searchInp ? searchInp.value.toLowerCase().trim() : '';

    if (!container) return;

    // --- SEAMLESS FIX: Only show loader if the list is currently empty ---
    if (container.children.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:50px; opacity:0.3;"><i class='bx bx-loader-alt bx-spin' style='font-size:2rem;'></i></div>`;
    }

    const localDay = this.selectedDate.toLocaleDateString('en-CA');

    try {
      // 2. BACKGROUND FETCH (Philippines Offset +08:00)
      const { data, error } = await supabaseClient
        .from('check_in_logs')
        .select('*, profiles(full_name)')
        .gte('time_in', `${localDay}T00:00:00+08:00`)
        .lte('time_in', `${localDay}T23:59:59+08:00`)
        .order('time_in', { ascending: false });

      if (error) throw error;

      // 3. DATA PROCESSING
      let filtered = (data || []).map((log) => {
        const rawName =
          log.profiles?.full_name ||
          log.notes?.replace('WALK-IN: ', '') ||
          'Walk-in Guest';
        return { ...log, resolvedName: rawName.toUpperCase() };
      });

      if (searchTerm) {
        filtered = filtered.filter((log) =>
          log.resolvedName.toLowerCase().includes(searchTerm),
        );
      }

      // Update Summary HUD
      if (summaryVal) summaryVal.innerText = filtered.length;

      // 4. SEAMLESS RENDER
      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:80px; opacity:0.2;"><i class='bx bx-user-x' style='font-size:3rem;'></i><p style="font-size:10px; font-weight:900; margin-top:10px;">NO DATA LOGGED</p></div>`;
        return;
      }

      // Build HTML string for all rows
      const htmlOutput = filtered
        .map((log, index) => {
          const isClosed = log.time_out !== null;
          const safeName = DOMPurify.sanitize(log.resolvedName);
          const safeTimeIn = DOMPurify.sanitize(
            new Date(log.time_in).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          );

          // EPIC INTRO: Added 'row-${log.id}' and dynamic 'animation-delay'
          return `
            <div class="list-item-card" id="row-${log.id}" style="padding: 15px 20px; margin-bottom:10px; animation-delay: ${index * 0.04}s;"> 
              <div class="card-header" style="margin-bottom:0;">
                <div class="status-icon ${!isClosed ? 'active' : ''}" style="background:var(--bg-dark); color:var(--wolf-red);">
                  <i class='bx ${isClosed ? 'bx-check' : 'bx-time-five'}'></i>
                </div>
                <div class="item-info">
                  <h4 style="font-size:13px; font-weight:800;">${safeName}</h4>
                  <div class="time" style="font-size:10px; color:#555;">IN: ${safeTimeIn}</div>
                </div>
                <div class="card-actions" style="text-align:right;">
                  ${!this.isReadOnly ? `<i class='bx bx-trash' style="cursor:pointer; color:#333; font-size:14px;" onclick="wolfData.deleteLog('${log.id}')"></i>` : ''}
                </div>
              </div>
            </div>`;
        })
        .join('');

      // Replace innerHTML once (The CSS animations will handle the visual transition)
      container.innerHTML = htmlOutput;
    } catch (err) {
      console.error('Wolf OS Logbook Error:', err);
      // Only wipe container if it was previously empty
      if (container.children.length <= 1) {
        container.innerHTML = `<p style="color:red; text-align:center; opacity:0.5; font-size:10px; font-weight:900;">PROTOCOL_SYNC_ERROR</p>`;
      }
    }
  },
  // ==========================================
  // 2. SALES ENGINE
  // ==========================================
  async loadSales() {
    // 1. Set context for Trash Bin
    if (window.salesManager) window.salesManager.currentTrashMode = 'sales';

    // 2. Critical: Ensure date is ready
    if (!this.selectedDate) await this.syncServerTime();

    if (this.isFetching) return;
    this.isFetching = true;

    const container = document.getElementById('ledger-list-container');
    this.allSales = [];

    if (container && container.children.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:50px; opacity:0.3;"><i class='bx bx-loader-alt bx-spin' style='font-size:2rem;'></i></div>`;
    }

    const localDay = this.selectedDate.toLocaleDateString('en-CA');

    try {
      const { data, error } = await supabaseClient
        .from('sales')
        .select('*, products(name, sku)')
        .gte('created_at', `${localDay}T00:00:00+08:00`)
        .lte('created_at', `${localDay}T23:59:59+08:00`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.allSales = data || [];

      const searchInp = document.getElementById('ledger-main-search');
      const currentTerm = searchInp ? searchInp.value : '';

      this.renderSales(this.selectedDate.getDay(), currentTerm);
    } catch (err) {
      console.error('Wolf OS Sales Error:', err);
    } finally {
      this.isFetching = false;
    }
  },

  renderSales(dayIndex, searchTerm = '') {
    const container = document.getElementById('ledger-list-container');
    const revenueEl = document.getElementById('ledger-summary-amount');
    const labelEl = document.getElementById('ledger-summary-label');
    if (!container) return;

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    if (labelEl) labelEl.innerText = `${dayNames[dayIndex]} Total Income`;

    let filtered = [...this.allSales];
    if (searchTerm !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((sale) => {
        const name = String(sale.products?.name || '').toLowerCase();
        const sku = String(sale.products?.sku || '').toLowerCase();
        const ref = String(sale.sale_reference || '').toLowerCase();
        return name.includes(term) || sku.includes(term) || ref.includes(term);
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:80px; opacity:0.2;"><i class='bx bx-shopping-bag' style='font-size:3rem;'></i><p style="font-size:10px; font-weight:900; margin-top:10px;">NO DATA LOGGED</p></div>`;
      if (revenueEl) revenueEl.innerText = '₱0.00';
      return;
    }

    let totalIncome = 0;
    // FIX: Added 'index' here
    container.innerHTML = filtered
      .map((sale, index) => {
        const amount = Number(sale.total_amount || 0);
        totalIncome += amount;

        const safeName = DOMPurify.sanitize(sale.products?.name || 'Item');
        const safeSKU = DOMPurify.sanitize(sale.products?.sku || 'N/A');
        const safeTime = DOMPurify.sanitize(
          new Date(sale.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );

        return `
        <div class="list-item-card" id="row-${sale.id}" style="padding: 15px 20px; margin-bottom:10px; animation-delay: ${index * 0.04}s;">
          <div class="card-header" style="margin-bottom: 0;">
            <div class="status-icon" style="background: var(--bg-dark); color: var(--wolf-red);"><i class='bx bx-shopping-bag'></i></div>
            <div class="item-info">
              <h4 style="font-size:13px; font-weight:800;">${safeName}</h4>
              <div class="time" style="font-size:10px; color:#555;">${safeTime} • x${sale.qty} • ${safeSKU}</div>
            </div>
            <div class="card-actions" style="text-align:right;">
              <div style="color: var(--wolf-red); font-weight: 900; font-family: 'JetBrains Mono'; font-size:14px;">
                ₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              ${!this.isReadOnly ? `<i class='bx bx-trash' style="cursor:pointer; color:#333; font-size:14px; margin-top:5px;" onclick="wolfData.deleteSale('${sale.id}')"></i>` : ''}
            </div>
          </div>
        </div>`;
      })
      .join('');

    if (revenueEl)
      revenueEl.innerText = `₱${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  },

  // ==========================================
  // 3. UTILS & SHARED LOGIC
  // ==========================================
  updateDayUI(type, selectedDay) {
    selectedDay = parseInt(selectedDay);
    this.realToday = new Date().getDay(); // Refresh today's date

    const selector =
      type === 'logbook' ? '#logbook-day-picker' : '#sales-day-picker';
    const buttons = document.querySelectorAll(`${selector} .day-btn`);

    buttons.forEach((btn) => {
      const btnDay = parseInt(btn.getAttribute('data-day'));
      btn.classList.toggle('active', btnDay === selectedDay);

      // 1. DISABLE FUTURE DAYS
      // Logic: If btnDay is greater than today, it's the future.
      // Special case: Sunday (0) is always "Past" unless today is Sunday.
      if (btnDay > this.realToday) {
        btn.disabled = true;
      } else {
        btn.disabled = false;
      }
    });

    // 2. SET READ-ONLY STATE
    // CRUD is only allowed if the selected day is EXACTLY today.
    this.isReadOnly = selectedDay !== this.realToday;
    this.applyLockdownUI();
  },

  applyLockdownUI() {
    // Find Add (+) and Clear (Trash) header buttons
    const addBtn = document.querySelector('.icon-btn.red');
    const clearBtn = document.querySelector(
      '.icon-btn:not(.red) i.bx-trash',
    )?.parentElement;
    const brandArea = document.querySelector('.brand');

    if (this.isReadOnly) {
      if (addBtn) addBtn.classList.add('crud-hidden');
      if (clearBtn) clearBtn.classList.add('crud-hidden');

      // Add "ARCHIVE" indicator to header if not present
      if (brandArea && !document.querySelector('.archive-mode-indicator')) {
        brandArea.insertAdjacentHTML(
          'beforebegin',
          `<span class="archive-mode-indicator">[ ARCHIVE_LOCKED ]</span>`,
        );
      }
    } else {
      if (addBtn) addBtn.classList.remove('crud-hidden');
      if (clearBtn) clearBtn.classList.remove('crud-hidden');
      document.querySelector('.archive-mode-indicator')?.remove();
    }
  },

  toggleReadOnlyMode(isReadOnly) {
    // 1. Find the Add (+) button in the header
    const addBtn = document.querySelector('.icon-btn.red');
    // 2. Find the Clear (Trash) button in the header
    const clearBtn = document.querySelector(
      '.icon-btn:not(.red) i.bx-trash',
    )?.parentElement;

    if (addBtn) addBtn.classList.toggle('crud-hidden', isReadOnly);
    if (clearBtn) clearBtn.classList.toggle('crud-hidden', isReadOnly);

    // This class will be checked during item card generation
    this.isReadOnly = isReadOnly;
  },

  // Inside wolfData object in data-loader.js

  async deleteLog(id) {
    if (!window.Swal) return;

    const result = await window.Swal.fire({
      title: 'REMOVE ENTRY?',
      html: `
        <div style="color: #b47023; font-size: 4.5rem; margin-bottom: 10px;">
          <i class='bx bx-error-alt'></i>
        </div>
        <p class="wolf-swal-text" style="text-transform: uppercase;">
          WARNING: THIS RECORD WILL BE MOVED TO TRASH bin. PROCEED?
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'REMOVE',
      cancelButtonText: 'CANCEL',
      reverseButtons: true,
      background: '#111',
      buttonsStyling: false,
      customClass: {
        popup: 'wolf-swal-popup-orange',
        title: 'wolf-swal-title',
        confirmButton: 'wolf-swal-confirm-orange',
        cancelButton: 'wolf-swal-cancel',
      },
    });

    if (!result.isConfirmed) return;

    try {
      // 1. Fetch data
      const { data: logData } = await supabaseClient
        .from('check_in_logs')
        .select('*')
        .eq('id', id)
        .single();

      // 2. Move to Trash
      await supabaseClient.from('trash_bin').insert([
        {
          original_id: id,
          table_name: 'check_in_logs',
          deleted_data: logData,
        },
      ]);

      // 3. Delete original
      await supabaseClient.from('check_in_logs').delete().eq('id', id);

      if (window.wolfAudio) window.wolfAudio.play('notif');

      // FIX: Ensure only logbook refreshes
      await this.loadLogbook();
    } catch (err) {
      console.error('Archival Fault:', err);
    }
  },

  async deleteSale(id) {
    if (!window.Swal) return;

    const result = await window.Swal.fire({
      title: 'REMOVE PRODUCT?',
      html: `
        <div style="color: #b47023; font-size: 4.5rem; margin-bottom: 10px;">
          <i class='bx bx-error-alt'></i>
        </div>
        <p class="wolf-swal-text" style="text-transform: uppercase;">
          WARNING: THIS RECORD WILL BE MOVED TO TRASH BIN. PROCEED?
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'REMOVE',
      cancelButtonText: 'CANCEL',
      reverseButtons: true,
      background: '#111',
      buttonsStyling: false,
      customClass: {
        popup: 'wolf-swal-popup-orange',
        title: 'wolf-swal-title',
        confirmButton: 'wolf-swal-confirm-orange',
        cancelButton: 'wolf-swal-cancel',
      },
    });

    if (!result.isConfirmed) return;

    try {
      // --- 1. SEAMLESS EPIC OUTRO ---
      const rowElement = document.getElementById(`row-${id}`);
      if (rowElement) {
        rowElement.classList.add('removing');
        // Wait 400ms for the "Void" CSS animation to complete
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Remove from DOM immediately after animation so the UI feels responsive
        // even before the Database finishes its work.
        rowElement.remove();
      }

      // --- 2. BACKGROUND DATABASE PROTOCOL ---
      // We fetch the data to move to trash
      const { data: saleData } = await supabaseClient
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();

      if (!saleData) return;

      // Restore Product Stock logic
      const { data: product } = await supabaseClient
        .from('products')
        .select('qty, name')
        .eq('productid', saleData.product_id)
        .single();

      if (product && product.qty < 999999) {
        await supabaseClient
          .from('products')
          .update({ qty: product.qty + saleData.qty })
          .eq('productid', saleData.product_id);
      }

      // Record in Trash Bin
      await supabaseClient.from('trash_bin').insert([
        {
          original_id: id,
          table_name: 'sales',
          deleted_data: saleData,
        },
      ]);

      // Execute Deletion
      await supabaseClient.from('sales').delete().eq('id', id);

      // --- 3. SILENT SYNC ---
      if (window.wolfAudio) window.wolfAudio.play('success');

      // Refresh data silently in the background to update "Total Income" HUD
      // Since container is not empty, this won't show a loading spinner.
      await this.loadSales();
    } catch (err) {
      console.error('Void Protocol Fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
      // If it fails, reload the whole view to restore the row
      this.loadSales();
    }
  },

  async reopenLog(id) {
    await supabaseClient
      .from('check_in_logs')
      .update({ time_out: null })
      .eq('id', id);
    this.loadLogbook(this.currentLogDay);
  },
};

wolfData.initRealtime = async function () {
  if (this.realtimeChannel) return; // Prevent duplicate connections

  // Ensure atomic time is synced first
  if (!this.selectedDate) await this.syncServerTime();

  console.log('Wolf OS: Activating Neural Realtime Link...');

  const channel = supabaseClient
    .channel('wolf-ledger-sync-stable')
    // 1. Listen for SALES changes
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales' },
      (payload) => {
        console.log(`Wolf OS: Sales [${payload.eventType}] Syncing...`);
        if (this.activeMode === 'sales') this.loadSales();
      },
    )
    // 2. Listen for LOGBOOK changes (THE MISSING LINK)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'check_in_logs' },
      (payload) => {
        console.log(`Wolf OS: Logbook [${payload.eventType}] Syncing...`);
        if (this.activeMode === 'logbook') this.loadLogbook();
      },
    )
    // 3. Listen for PRODUCT changes (Price/Stock updates)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload) => {
        if (this.activeMode === 'sales') this.loadSales();
      },
    );

  // Subscribe properly
  const { error } = await channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Wolf OS: Realtime Sync Active ✅');
      this.showRealtimeToast();
    }
  });

  if (error) {
    console.error('Realtime subscription failed:', error);
    return;
  }

  this.realtimeChannel = channel;
};

// UI Feedback Helper
wolfData.showRealtimeToast = function () {
  const toastContent = document.createElement('span');
  toastContent.innerHTML = DOMPurify.sanitize(`
    <i class="bx bx-rfid" style="margin-right: 8px; font-size:18px; color:var(--wolf-red);"></i>
    LIVE_SYNC_ESTABLISHED
  `);

  Toastify({
    node: toastContent,
    duration: 3000,
    gravity: 'top',
    position: 'right',
    style: {
      background: '#0a0a0a',
      border: '1px solid #222',
      borderRadius: '12px',
      fontWeight: '900',
      fontFamily: 'JetBrains Mono, monospace',
      color: '#fff',
    },
  }).showToast();
};

document.addEventListener('input', (e) => {
  // Sales or Logbook Live Search
  if (e.target.id === 'ledger-main-search') {
    const val = e.target.value.trim();
    const clearBtn = document.getElementById('search-clear-btn');

    if (clearBtn) clearBtn.style.display = val.length > 0 ? 'block' : 'none';
    // Call the respective load function based on mode
    if (wolfData.activeMode === 'sales') {
      // For sales, we can just call renderSales to avoid a DB hit while typing
      wolfData.renderSales(wolfData.selectedDate.getDay(), val);
    } else {
      // For logbook, we refresh via loadLogbook
      wolfData.loadLogbook();
    }
  }
});

document.addEventListener('click', async (e) => {
  const activeType = wolfData.activeMode;
  // Use 'en-CA' for a reliable YYYY-MM-DD local string
  const realTodayISO = (wolfData.serverToday || new Date()).toLocaleDateString(
    'en-CA',
  );

  const searchToggle = e.target.closest('#toggle-search-btn');
  if (searchToggle) {
    e.preventDefault();
    e.stopPropagation();

    try {
      const input = document.getElementById('ledger-main-search');
      document.getElementById('search-collapse-btn').classList.toggle('active');

      console.log('Wolf OS: Search Container Active State:', isActive); // DEBUG LINE

      if (isActive) {
        setTimeout(() => {
          if (input) input.focus();
        }, 300);
        if (window.wolfAudio) window.wolfAudio.play('notif');
      } else {
        if (input) input.value = '';
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';
        wolfRefreshView();
      }
      return; // Stop processing other clicks
    } catch (err) {
      console.error('Wolf OS: Search Toggle Fault:', err);
    }
  }

  // 1. Week Navigation (Shift Week)
  const navBtn = e.target.closest('#prev-week-btn, #next-week-btn');
  if (navBtn) {
    const direction = navBtn.id === 'prev-week-btn' ? -7 : 7;
    const realToday = new Date();
    const realTodayISO = realToday.toLocaleDateString('en-CA');

    const targetDate = new Date(wolfData.selectedDate);
    targetDate.setDate(targetDate.getDate() + direction);
    const targetISO = targetDate.toLocaleDateString('en-CA');

    if (direction > 0) {
      // Moving Forward
      // If the 7-day jump puts us in the future...
      if (targetISO > realTodayISO) {
        // CHECK: Are we already looking at "Today"?
        const currentISO = wolfData.selectedDate.toLocaleDateString('en-CA');

        if (currentISO === realTodayISO) {
          // We are already at the latest possible date, so BLOCK.
          if (window.salesManager)
            window.salesManager.showSystemAlert(
              'CHRONOLOCK_ACTIVE: FUTURE PROJECTION BLOCKED',
              'error',
            );
          return;
        } else {
          // We are in the past, but the +7 jump goes too far.
          // FIX: Instead of blocking, just "Snap" to today's date.
          console.log(
            'WolfChrono: Jump exceeds today. Snapping to current date.',
          );
          wolfData.selectedDate = realToday;
        }
      } else {
        // Target is not in the future, move normally
        wolfData.selectedDate = targetDate;
      }
    } else {
      // Moving Backward (-7) is always allowed
      wolfData.selectedDate = targetDate;
    }

    // Refresh the UI with the new selected date
    wolfData.calculateWeek(activeType);
    return;
  }

  // 2. HUD Node Click (The Fix)
  if (e.target.closest('#chrono-picker-trigger')) {
    if (wolfData.fp) {
      wolfData.fp.open();
    }
    return;
  }

  // 3. Day Selector (Validation Added)
  const dayBtn = e.target.closest('.day-btn');
  if (dayBtn) {
    const dateStr = dayBtn.getAttribute('data-date'); // This is already YYYY-MM-DD
    if (dateStr) {
      // Comparison: If dateStr is "2026-01-26" and today is "2026-01-25", block.
      if (dateStr > realTodayISO) {
        if (window.salesManager)
          window.salesManager.showSystemAlert(
            'INVALID_PROTOCOL: FUTURE_DATE_LOCKED',
            'error',
          );
        return;
      }

      const parts = dateStr.split('-');
      wolfData.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
      wolfData.calculateWeek(activeType);
    }
  }

  // 4. Header Action (Plus)
  if (e.target.closest('#add-ledger-btn')) {
    const activeType = wolfData.activeMode;

    if (window.wolfAudio) window.wolfAudio.play('notif');

    if (wolfData.activeMode === 'sales') {
      window.salesManager.openSaleTerminal();
    } else {
      // TRIGGER THE NEW LOGBOOK TERMINAL
      window.logbookManager.openLogbookTerminal();
    }
  }

  // 5. Contextual Archive Action (Trash Icon in Header)
  if (e.target.closest('#clear-ledger-btn')) {
    const currentMode = wolfData.activeMode;
    Toastify({
      text: `Opening ${currentMode.toUpperCase()} Trash Bin...`,
      duration: 2000,
      gravity: 'top',
      position: 'right',
      style: {
        background: '#343434',
        borderRadius: '10px',
        fontWeight: 'bold',
        color: '#fff',
      },
    }).showToast();

    if (window.salesManager) {
      window.salesManager.openTrashBin(currentMode);
    }
  }

  const snapBtn = e.target.closest('#snap-today-btn');
  if (snapBtn) {
    console.log('WolfChrono: Snap-to-Today triggered.');
    await wolfData.syncServerTime();
    if (wolfData.fp) {
      wolfData.fp.setDate(wolfData.selectedDate, false);
    }
    wolfData.calculateWeek(wolfData.activeMode);
    if (window.salesManager) {
      window.salesManager.showSystemAlert(
        "RETURNED TO TODAY'S WEEK!",
        'success',
      );
    }
    return;
  }
});

document.addEventListener('click', () => {
  setTimeout(() => {
    const rangeDisplay = document.getElementById('week-range-display');

    if (
      rangeDisplay &&
      (rangeDisplay.innerText === '--- - ---' || rangeDisplay.innerText === '')
    ) {
      const type = document.getElementById('sales-day-picker')
        ? 'sales'
        : 'logbook';
      console.log(`WolfChrono: Auto-initializing ${type} view...`);
      wolfData.initChrono(type);
    }
  }, 100);
});

async function setupRealtime() {
  if (wolfData.realtimeChannel) return; // avoid duplicate

  // Ensure date is synced first
  if (!wolfData.selectedDate) await wolfData.syncServerTime();

  const channel = supabaseClient
    .channel('wolf-realtime-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales' },
      (payload) => {
        console.log('Realtime [sales] triggered:', payload);
        wolfData.loadSales();
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload) => {
        console.log('Realtime [products] triggered:', payload);
        wolfData.loadSales();
      },
    )
    .subscribe();

  const toastContent = document.createElement('span');

  // Put the Boxicon + text inside it
  toastContent.innerHTML = DOMPurify.sanitize(`
  <i class="bx bx-check-circle" style="margin-right: 8px; font-size:18px;"></i>
  Realtime Sync Activated
`);

  wolfData.realtimeChannel = channel;
  Toastify({
    node: toastContent, // <-- DOM node goes here
    duration: 3000,
    gravity: 'top',
    position: 'right',
    style: {
      background: '#343434',
      borderRadius: '10px',
      fontWeight: 'bold',
      color: '#fff',
    },
  }).showToast();
}

// Also run on first load
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const p = urlParams.get('p');

  if (p === 'sales' || p === 'logbook') {
    setTimeout(async () => {
      if (document.getElementById('ledger-page')) {
        // 1. Atomic Sync
        if (wolfData.syncServerTime) await wolfData.syncServerTime();

        // 2. Load UI
        await wolfData.initLedger(p);

        // 3. Start Unified Realtime (For both Sales and Logbook)
        wolfData.initRealtime();
      }
    }, 500);
  }
});
