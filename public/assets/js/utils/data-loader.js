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
  selectedDate: null, // Will be set by server
  serverDateStr: null,
  weekStart: null, // The Sunday of the current week range
  allSales: [],
  currentSalesDay: new Date().toISOString().split('T')[0],
  activeMode: 'sales',
  isFetching: false,

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
    const { data, error } = await supabaseClient.rpc('get_server_time');

    if (data && data[0]) {
      // data[0].server_date is "2026-01-25" (The true today)
      const parts = data[0].server_date.split('-');
      this.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
      this.serverDateStr = data[0].server_date;
      console.log(
        `Wolf OS: Server Sync Complete. Today is ${this.serverDateStr}`,
      );
    } else {
      console.error(
        'Time Sync Failed, falling back to local (not recommended)',
      );
      this.selectedDate = new Date();
    }
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
    await this.syncTime();
    this.selectedDate = this.serverToday
      ? new Date(this.serverToday)
      : new Date();

    const title = document.getElementById('ledger-title');
    const label = document.getElementById('ledger-summary-label');
    const searchWrap = document.getElementById('ledger-search-wrapper');
    const primBtn = document.getElementById('ledger-primary-btn');
    const primIcon = document.getElementById('ledger-primary-icon');

    if (!title) return; // Safety check: HTML not injected yet

    if (mode === 'sales') {
      title.innerText = 'SALES';
      label.innerText = 'Daily Income Summary';
      if (searchWrap) searchWrap.style.display = 'flex';
      if (primBtn) primBtn.className = 'icon-btn red';
      if (primIcon) primIcon.className = 'bx bx-plus';
    } else {
      title.innerText = 'LOGBOOK';
      label.innerText = 'Total Floor Traffic';
      if (searchWrap) searchWrap.style.display = 'none';
      if (primBtn) primBtn.className = 'icon-btn';
      if (primIcon) primIcon.className = 'bx bx-fullscreen';
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

  updateChronoUI(sun, sat, activeIndex) {
    if (this.fp) this.fp.setDate(this.selectedDate, false);
    const fmt = (date) =>
      date
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        .toUpperCase();

    const display = document.getElementById('week-range-display');
    if (display) display.innerText = `${fmt(sun)} - ${fmt(sat)}`;

    // 1. Get Today context from Server-Synced date
    const realToday = this.serverToday || new Date();
    const realTodayISO = realToday.toLocaleDateString('en-CA');

    // 2. Calculate Real Current Sunday (to decide if we show TODAY button)
    const realSun = new Date(realToday);
    realSun.setDate(realToday.getDate() - realToday.getDay());
    const realSunISO = realSun.toLocaleDateString('en-CA');

    // 3. Current View Sunday
    const viewSunISO = sun.toLocaleDateString('en-CA');

    // ANIMATION TRIGGER
    const snapBtn = document.getElementById('snap-today-btn');
    if (snapBtn) {
      // If viewing ANY week older than the current one, show button
      if (viewSunISO < realSunISO) {
        snapBtn.classList.add('visible');
      } else {
        snapBtn.classList.remove('visible');
      }
    }

    // 4. Update Day Buttons (Future Lock)
    const buttons = document.querySelectorAll(`#ledger-day-picker .day-btn`);
    buttons.forEach((btn, idx) => {
      const btnDate = new Date(sun);
      btnDate.setDate(sun.getDate() + idx);
      const btnISO = btnDate.toLocaleDateString('en-CA');

      btn.setAttribute('data-date', btnISO);
      btn.classList.toggle('active', idx === activeIndex);
      btn.disabled = btnISO > realTodayISO; // Server-time future lock
    });

    // 5. Lockdown UI
    const selectedISO = this.selectedDate.toLocaleDateString('en-CA');
    this.isReadOnly = selectedISO !== realTodayISO;
    if (this.applyLockdownUI) this.applyLockdownUI();

    // 6. Refresh Data
    if (this.activeMode === 'sales') this.loadSales();
    else if (this.activeMode === 'logbook') this.loadLogbook();
  },

  initRealtime() {
    supabaseClient
      .channel('wolf-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        (payload) => {
          console.log(
            `Wolf OS: Realtime [${payload.eventType}] detected on Sales`,
          );

          // 1. If it's a DELETE, refresh immediately to remove the row
          if (payload.eventType === 'DELETE') {
            this.loadSales();
            return;
          }

          // 2. Get the date of the record (New for Inserts, Old for Deletes)
          const record = payload.new || payload.old;
          if (!record || !record.created_at) return;

          const recordDate = new Date(record.created_at);
          const recordISO = recordDate.toLocaleDateString('en-CA');
          const viewedISO = this.selectedDate.toLocaleDateString('en-CA');

          // 3. ONLY refresh if the changed record belongs to the day we are currently looking at
          if (recordISO === viewedISO) {
            console.log(
              'Wolf OS: Incoming data matches viewed date. Refreshing...',
            );
            this.loadSales();
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          // If product stock/price changes, refresh the sales list to update names/availability
          this.loadSales();
        },
      )
      .subscribe();
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
    const container = document.getElementById('ledger-list-container');
    const summaryVal = document.getElementById('ledger-summary-amount');
    if (!container) return;

    // 1. Clear previous view immediately
    this.allSales = [];
    container.innerHTML = `
      <div style="text-align:center; padding:50px; opacity:0.3;">
        <i class='bx bx-loader-alt bx-spin' style='font-size:2rem;'></i>
        <p style="font-size:10px; margin-top:10px; letter-spacing:1px;">SYNCING LOGBOOK...</p>
      </div>`;

    const localDay = this.selectedDate.toLocaleDateString('en-CA');

    // 2. Fetch Data
    const { data, error } = await supabaseClient
      .from('check_in_logs')
      .select('*, profiles(full_name)')
      .gte('time_in', `${localDay}T00:00:00`)
      .lte('time_in', `${localDay}T23:59:59`)
      .order('time_in', { ascending: false });

    if (error) {
      console.error('Logbook Fetch Error:', error);
      return;
    }

    // 3. Update Summary Count
    if (summaryVal) summaryVal.innerText = data.length;

    if (data.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:80px; opacity:0.2;"><i class='bx bx-user-x' style='font-size:3rem;'></i><p style="font-size:10px; font-weight:900; margin-top:10px;">NO CUSTOMER LOGGED</p></div>`;
      return;
    }

    // 4. Render Logbook Cards
    container.innerHTML = data
      .map((log) => {
        const isClosed = log.time_out !== null;
        return `
            <div class="list-item-card" style="padding: 15px 20px; margin-bottom:10px;">
                <div class="card-header" style="margin-bottom:0;">
                    <div class="status-icon ${!isClosed ? 'active' : ''}" style="background:var(--bg-dark); color:var(--wolf-red);">
                        <i class='bx ${isClosed ? 'bx-check' : 'bx-time-five'}'></i>
                    </div>
                    <div class="item-info">
                        <h4 style="font-size:13px; font-weight:800;">${log.profiles?.full_name || 'Walk-in Guest'}</h4>
                        <div class="time" style="font-size:10px; color:#555;">IN: ${new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div class="card-actions">
                        ${!this.isReadOnly ? `<i class='bx bx-trash' style="cursor:pointer; color:#333;" onclick="wolfData.deleteLog('${log.id}')"></i>` : ''}
                    </div>
                </div>
            </div>`;
      })
      .join('');
  },

  // ==========================================
  // 2. SALES ENGINE
  // ==========================================
  async loadSales() {
    if (!this.selectedDate) await this.syncServerTime();

    if (this.isFetching) return;
    this.isFetching = true;

    const container = document.getElementById('ledger-list-container');
    this.allSales = [];

    if (container) {
      container.innerHTML = `<div style="text-align:center; padding:50px; opacity:0.3;"><i class='bx bx-loader-alt bx-spin' style='font-size:2rem;'></i></div>`;
    }

    const localDay = this.selectedDate.toLocaleDateString('en-CA');

    try {
      const { data, error } = await supabaseClient
        .from('sales')
        .select('*, products(name, sku)')
        /* 
           CRITICAL FIX: 
           We tell Supabase to look for the day starting from 00:00 
           in the Philippines (+08:00 offset).
        */
        .gte('created_at', `${localDay}T00:00:00+08:00`)
        .lte('created_at', `${localDay}T23:59:59+08:00`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.allSales = data || [];
      this.renderSales(this.selectedDate.getDay());
    } catch (err) {
      console.error(err);
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

    const term = searchTerm.toLowerCase().trim();
    let filtered = [...this.allSales];

    if (term !== '') {
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
    container.innerHTML = filtered
      .map((sale) => {
        const amount = Number(sale.total_amount || 0);
        totalIncome += amount;
        return `
        <div class="list-item-card" style="padding: 15px 20px; margin-bottom:10px;">
            <div class="card-header" style="margin-bottom: 0;">
                <div class="status-icon" style="background: var(--bg-dark); color: var(--wolf-red);"><i class='bx bx-shopping-bag'></i></div>
                <div class="item-info">
                    <h4 style="font-size:13px; font-weight:800;">${sale.products?.name || 'Item'}</h4>
                    <div class="time" style="font-size:10px; color:#555;">
                        ${new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • x${sale.qty} • ${sale.products?.sku || 'N/A'}
                    </div>
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
    if (!confirm('MOVE TO TRASH: Proceed with archival of check-in record?'))
      return;

    try {
      // 1. Fetch the data before deleting
      const { data: logData } = await supabaseClient
        .from('check_in_logs')
        .select('*')
        .eq('id', id)
        .single();

      // 2. Move to Trash Bin
      await supabaseClient.from('trash_bin').insert([
        {
          original_id: id,
          table_name: 'check_in_logs',
          deleted_data: logData,
        },
      ]);

      // 3. Delete from original table
      await supabaseClient.from('check_in_logs').delete().eq('id', id);

      if (window.wolfAudio) window.wolfAudio.play('notif');
      this.loadLogbook(this.currentLogDay);
    } catch (err) {
      console.error('Archival Fault:', err);
    }
  },

  async deleteSale(id) {
    const confirmed = await window.wolfModal.confirm({
      title: 'DELETE ITEM',
      message:
        'Do you want to delete this product? This will be moved to Trash Bin.',
      icon: 'bx-trash',
      confirmText: 'CONFIRM',
      cancelText: 'CANCEL',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      // 1. Fetch the sale details
      const { data: saleData } = await supabaseClient
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();

      if (!saleData) return;

      // 2. RESTORE QUANTITY on the Products table
      // We fetch the current qty first
      const { data: product } = await supabaseClient
        .from('products')
        .select('qty, name')
        .eq('productid', saleData.product_id)
        .single();

      if (product && product.qty < 999999) {
        const restoredQty = product.qty + saleData.qty;

        await supabaseClient
          .from('products')
          .update({ qty: restoredQty })
          .eq('productid', saleData.product_id);

        console.log(
          `Wolf OS: Restored ${saleData.qty} units to ${product.name}`,
        );
      }

      // 3. Move Sale Record to Trash Bin
      await supabaseClient.from('trash_bin').insert([
        {
          original_id: id,
          table_name: 'sales',
          deleted_data: saleData,
        },
      ]);

      // 4. Delete Sale from main table
      await supabaseClient.from('sales').delete().eq('id', id);

      if (window.wolfAudio) window.wolfAudio.play('success');
      this.loadSales(this.selectedDate);
    } catch (err) {
      console.error('Void Protocol Fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
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

wolfData.initRealtime();

document.addEventListener('input', (e) => {
  // Sales Live Search
  if (e.target.id === 'sales-search') {
    const searchTerm = e.target.value.trim().toLowerCase();
    // Use the current selected date's day index for rendering
    wolfData.renderSales(wolfData.selectedDate.getDay(), searchTerm);
  }
});

document.addEventListener('click', async (e) => {
  const activeType = wolfData.activeMode;
  // Use 'en-CA' for a reliable YYYY-MM-DD local string
  const realTodayISO = (wolfData.serverToday || new Date()).toLocaleDateString(
    'en-CA',
  );

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
    if (activeType === 'sales') window.salesManager.openSaleTerminal();
  }

  // 5. Archive Action (Trash)
  if (e.target.closest('#clear-ledger-btn')) {
    if (activeType === 'sales') window.salesManager.openTrashBin();
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
      window.salesManager.showSystemAlert('RETURNED TO LIVE LEDGER', 'success');
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

// Also run on first load
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const p = urlParams.get('p');
  if (p === 'sales' || p === 'logbook') {
    setTimeout(async () => {
      if (document.getElementById('ledger-page')) {
        // If you implemented the syncServerTime function, await it here
        if (wolfData.syncServerTime) await wolfData.syncServerTime();
        wolfData.initLedger(p);
      }
    }, 500);
  }
});
