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

window.wolfData = null;
const wolfData = {
  // Enables Realtime from supabase
  selectedDate: new Date(),
  serverToday: new Date(),
  activeMode: 'sales',
  isFetching: false,
  allSales: [],
  lastTotal: 0,
  activeAF: null, // store active auto-filter
  lastTraffic: 0,
  goalTargets: {
    DAILY: 0,
    WEEKLY: 0,
    MONTHLY: 0,
  },

  // --- NAVIGATION SYNC ENGINE ---
  syncNavigationUI(currentMode) {
    console.log(`Wolf OS: Navigation UI Lock engaged for [${currentMode}]`);

    // 1. Target both Floating Nav and Sidebar items
    const allNavLinks = document.querySelectorAll(
      '.nav-item[data-page], .sidebar-link[data-page]',
    );

    allNavLinks.forEach((item) => {
      const targetPage = item.getAttribute('data-page');

      if (targetPage === currentMode) {
        // THIS IS THE CURRENT PAGE -> LOCK IT
        item.classList.add('active');
      } else {
        // THIS IS A DIFFERENT PAGE -> ENABLE IT
        item.classList.remove('active');
      }
    });
  },

  // THE ROLLING ANIMATOR (Add this to wolfData)
  // --- 1. THE ELITE ANIMATOR ---
  animateValue(el, start, end, duration) {
    // KILL any existing animation before starting a new one
    if (this.activeAF) {
      cancelAnimationFrame(this.activeAF);
    }

    let startTimestamp = null;
    const isSales = this.activeMode === 'sales';

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = progress * (end - start) + start;

      // Update Text
      if (isSales) {
        el.textContent = `₱${val.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      } else {
        el.textContent = Math.floor(val);
      }

      if (progress < 1) {
        this.activeAF = window.requestAnimationFrame(step);
      } else {
        // Animation finished naturally
        this.activeAF = null;
        // Faster reset of colors
        setTimeout(() => {
          if (!this.activeAF) el.classList.remove('increasing', 'decreasing');
        }, 300);
      }
    };
    this.activeAF = window.requestAnimationFrame(step);
  },

  // --- 2. THE UNIFIED REVENUE UPDATER ---
  // Call this instead of updateLedgerRevenue
  refreshSummaryHUD(newValue = null) {
    const el = document.getElementById('ledger-summary-amount');
    if (!el) return;

    // A. Use provided value, or calculate from allSales
    let targetValue =
      newValue !== null
        ? newValue
        : (this.allSales || []).reduce(
            (sum, s) => sum + Number(s.total_amount || 0),
            0,
          );

    // B. First load check
    if (this.lastTotal === 0 && targetValue !== 0) {
      this.lastTotal = targetValue;
      el.textContent =
        this.activeMode === 'sales'
          ? `₱${targetValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          : targetValue;
      return;
    }

    if (targetValue === this.lastTotal) return;

    // C. Trigger Animation
    el.classList.remove('increasing', 'decreasing');
    void el.offsetWidth; // Force CSS Reflow

    if (targetValue > this.lastTotal) el.classList.add('increasing');
    else el.classList.add('decreasing');

    this.animateValue(el, this.lastTotal, targetValue, 800);
    this.lastTotal = targetValue;

    // Update sidebar target box using DAILY target (sales mode only)
    if (this.activeMode === 'sales') {
      this.updateTargetBox(targetValue);
    }
  },

  async loadGoalTargets() {
    if (!window.supabaseClient) return;

    const periods = ['DAILY', 'WEEKLY', 'MONTHLY'];
    for (const period of periods) {
      const { data, error } = await supabaseClient
        .from('goal_target')
        .select('*')
        .eq('period_type', period)
        .order('start_date', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        this.goalTargets[period] = Number(data[0].target_amount || 0);
      }
    }

    // Sync sidebar target box
    this.updateTargetBox(this.lastTotal);
  },

  updateTargetBox(currentValue = 0) {
    const target = Number(this.goalTargets?.DAILY || 0);
    const percentEl = document.getElementById('sidebar-target-percent');
    const barEl = document.getElementById('sidebar-target-bar');
    if (!percentEl || !barEl) return;

    if (target <= 0) {
      percentEl.textContent = '0%';
      barEl.style.width = '0%';
      return;
    }

    const pct = Math.min(100, Math.max(0, (currentValue / target) * 100));
    percentEl.textContent = `${Math.round(pct)}%`;
    barEl.style.width = `${pct}%`;
  },

  // --- UI methods ---
  async addSaleRow(sale) {
    // Add sale to table and internal array
    const container = document.getElementById('ledger-list-container');
    if (!container) return;

    // We only render the individual card here
    // The refreshSummaryHUD handles the math
    const newRowHTML = this.renderSingleSaleCard(sale, 0); // index 0 for instant pop
    container.insertAdjacentHTML('afterbegin', newRowHTML);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const sku = skuInput.value.trim();
      const name = nameInput.value.trim();
      const price = parseFloat(priceInput.value || '0');
      const qty = unlimitedCheckbox?.checked
        ? 999999
        : parseInt(qtyInput.value || '0', 10);
      const desc = document.getElementById('master-desc')?.value || null;
      const brand = document.getElementById('master-brand')?.value || null;

      // Require minimal fields
      if (!name || !qty || !price) {
        if (statusEl)
          statusEl.textContent = 'Name, quantity, and price are required.';
        return;
      }

      // If this entry came from a food name search (no barcode id) and no image selected
      if (!sku && !selectedImageUrl) {
        if (statusEl) {
          statusEl.textContent =
            'Please select one image before adding to sales.';
        }
        return;
      }

      try {
        // 1. Ensure product exists (use existing, or create if needed)
        const productIdFromForm = form.dataset.productId || null;
        let finalProductId = productIdFromForm;

        if (!finalProductId) {
          const { data: productRow, error: prodErr } = await supabaseClient
            .from('products')
            .insert({
              sku: sku || undefined, // let trigger generate SKU if empty
              name,
              description: desc,
              price,
              qty,
              image_url: selectedImageUrl || null,
              is_active: true,
            })
            .select()
            .single();
          if (prodErr) throw prodErr;
          finalProductId = productRow.productid;
        }

        // 2. Insert sale row
        const { data: sale, error: saleErr } = await supabaseClient
          .from('sales')
          .insert({
            productid: finalProductId,
            qty,
            price,
          })
          .select()
          .single();
        if (saleErr) throw saleErr;

        // 3. Let ledger UI handle rendering
        if (
          window.wolfData &&
          typeof window.wolfData.addSaleRow === 'function'
        ) {
          window.wolfData.addSaleRow(sale);
        }

        if (statusEl) statusEl.textContent = 'Sale added.';
        modal.style.display = 'none';
      } catch (err) {
        console.error(err);
        if (statusEl) statusEl.textContent = 'Error adding sale.';
      }
    });
  },

  updateSaleRow(sale) {
    // Update sale in array
    const index = this.salesData.findIndex((s) => s.id === sale.id);
    if (index > -1) this.salesData[index] = sale;
    this.updateLedgerRevenue();
    Toastify({
      text: `Sale updated: ${sale.id}`,
      duration: 2000,
      gravity: 'top',
      position: 'right',
    }).showToast();
  },

  removeSaleRow(id) {
    // 1. Trigger the Epic Outro Animation
    const rowEl = document.getElementById(`row-${id}`);
    if (rowEl) {
      rowEl.classList.add('removing');
      // Physically remove from UI after animation
      setTimeout(() => rowEl.remove(), 400);
    }

    // 2. Remove from Memory Array
    this.allSales = (this.allSales || []).filter((s) => s.id !== id);

    // 3. Trigger HUD Rolling Animation (Red Glow)
    this.refreshSummaryHUD();
    alert('test');
  },

  updateProductUI(product) {
    // Example: update product table or stock info
    Toastify({
      text: `Product updated: ${product.name}`,
      duration: 2000,
      gravity: 'top',
      position: 'right',
      backgroundColor: '#ff9800',
    }).showToast();
  },

  // Animate the ledger revenue number
  updateLedgerRevenue() {
    const revenueEl = document.getElementById('ledger-summary-amount');
    if (!revenueEl) return;

    // 1. Calculate the actual total from the data array
    const newTotal = (this.allSales || []).reduce(
      (sum, sale) => sum + Number(sale.total_amount || 0),
      0,
    );

    // 2. Identify if it's the first load (to avoid 0 to Total animation on refresh)
    if (this.currentTotal === 0 && newTotal !== 0) {
      this.currentTotal = newTotal;
      revenueEl.textContent = `₱${newTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      return;
    }

    // 3. Skip if no change
    if (newTotal === this.currentTotal) return;

    // 4. Trigger Color State
    if (newTotal > this.currentTotal) {
      revenueEl.className = 'summary-value increasing'; // Force clean class state
    } else {
      revenueEl.className = 'summary-value decreasing';
    }

    // 5. Run the "Rolling" Animation
    this.animateNumber(revenueEl, this.currentTotal, newTotal);

    // 6. Update the memory for the next change
    this.currentTotal = newTotal;
  },

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
    this.syncNavigationUI(mode);
    this.initChrono(mode);
    await this.syncServerTime();
    await this.loadGoalTargets();
  },

  // ==========================================
  // 0. CHRONO CORE (WEEK NAVIGATOR)
  // ==========================================
  initChrono(type) {
    // 1. CLEANUP PREVIOUS INSTANCE
    // Use defensive checks to see if this.fp exists and has a destroy method
    if (this.fp && typeof this.fp.destroy === 'function') {
      try {
        this.fp.destroy();
      } catch (e) {
        console.warn(
          'Wolf OS: Non-critical - could not destroy old flatpickr instance.',
        );
      }
    }
    this.fp = null;

    // 2. DOM ELEMENT CHECKS
    const trigger = document.getElementById('chrono-picker-trigger');
    const targetInput = document.getElementById('hidden-chrono-input');

    // If the AJAX swap hasn't finished or element is missing, stop to prevent crash
    if (!targetInput) {
      console.error('Wolf OS: Chrono Input not found in DOM.');
      return;
    }

    const serverMax = this.serverToday || new Date();

    // 3. INITIALIZE FLATPICKR
    // Flatpickr returns an ARRAY of instances. We must grab the first one [0].
    const instances = flatpickr(targetInput, {
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

    // 4. ASSIGN SINGLE INSTANCE TO THIS.FP
    this.fp = Array.isArray(instances) ? instances[0] : instances;

    // 5. MANUAL TRIGGER LOGIC (Toggle Open/Close)
    if (trigger && this.fp) {
      trigger.onclick = null; // Clear previous listeners
      trigger.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Now that this.fp is the instance (not an array), .isOpen works
        if (this.fp.isOpen) {
          this.fp.close();
        } else {
          this.fp.open();
        }
      };
    }

    // 6. UPDATE UI STATE
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

    if (this.fp && typeof this.fp.setDate === 'function') {
      this.fp.setDate(this.selectedDate, false);
    }

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
    if (window.salesManager) window.salesManager.currentTrashMode = 'logbook';
    const container = document.getElementById('ledger-list-container');
    if (!container) return;

    if (container.children.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:50px; opacity:0.3;"><i class='bx bx-loader-alt bx-spin' style='font-size:2rem;'></i></div>`;
    }

    const localDay = this.selectedDate.toLocaleDateString('en-CA');

    try {
      const { data, error } = await supabaseClient
        .from('check_in_logs')
        .select('*, profiles(full_name)')
        .gte('time_in', `${localDay}T00:00:00+08:00`)
        .lte('time_in', `${localDay}T23:59:59+08:00`)
        .order('time_in', { ascending: false });

      if (error) throw error;

      let filtered = (data || []).map((log) => {
        const rawName =
          log.profiles?.full_name ||
          log.notes?.replace('WALK-IN: ', '') ||
          'Walk-in Guest';
        return { ...log, resolvedName: rawName.toUpperCase() };
      });

      const searchInp = document.getElementById('ledger-main-search');
      if (searchInp && searchInp.value) {
        const term = searchInp.value.toLowerCase();
        filtered = filtered.filter((log) =>
          log.resolvedName.toLowerCase().includes(term),
        );
      }

      // UPDATE THE TOP HUD (ANIMATED)
      this.refreshSummaryHUD(filtered.length);

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:80px; opacity:0.2;"><i class='bx bx-user-x' style='font-size:3rem;'></i><p style="font-size:10px; font-weight:900; margin-top:10px;">NO DATA LOGGED</p></div>`;
        return;
      }

      container.innerHTML = filtered
        .map((log, index) => {
          const isClosed = log.time_out !== null;
          const time = new Date(log.time_in).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return `
          <div class="list-item-card" id="row-${log.id}" style="animation-delay: ${index * 0.04}s;">
            <div class="card-header" style="margin-bottom:0;">
              <div class="status-icon ${!isClosed ? 'active' : ''}" style="background:var(--bg-dark); color:var(--wolf-red);">
                <i class='bx ${isClosed ? 'bx-check' : 'bx-time-five'}'></i>
              </div>
              <div class="item-info">
                <h4 style="font-size:13px; font-weight:800;">${log.resolvedName}</h4>
                <div class="time" style="font-size:10px; color:#555;">IN: ${time}</div>
              </div>
              <div class="card-actions">
                ${!this.isReadOnly ? `<i class='bx bx-trash' style="cursor:pointer; color:#333; font-size:14px;" onclick="wolfData.deleteLog('${log.id}')"></i>` : ''}
              </div>
            </div>
          </div>`;
        })
        .join('');
    } catch (err) {
      console.error('Wolf OS Logbook Fault:', err);
    }
  },

  // ==========================================
  // 2. SALES ENGINE
  // ==========================================
  async loadSales() {
    if (window.salesManager) window.salesManager.currentTrashMode = 'sales';
    if (this.isFetching) return;
    this.isFetching = true;

    const container = document.getElementById('ledger-list-container');
    if (!container) return;

    // Show loader ONLY if the screen is currently empty
    if (container.children.length === 0) {
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

      // SAVE TO MEMORY
      this.allSales = data || [];

      // TRIGGER RENDER
      const searchInp = document.getElementById('ledger-main-search');
      const currentTerm = searchInp ? searchInp.value : '';
      this.renderSales(this.selectedDate.getDay(), currentTerm);
    } catch (err) {
      console.error('Wolf OS Sales Fault:', err);
    } finally {
      this.isFetching = false;
    }
  },

  renderSales(dayIndex, searchTerm = '') {
    const container = document.getElementById('ledger-list-container');
    if (!container) return;

    const labelEl = document.getElementById('ledger-summary-label');
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
        return name.includes(term) || sku.includes(term);
      });
    }

    // UPDATE THE TOP HUD (ANIMATED)
    const totalIncome = filtered.reduce(
      (sum, s) => sum + Number(s.total_amount || 0),
      0,
    );
    this.refreshSummaryHUD(totalIncome);

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:80px; opacity:0.2;"><i class='bx bx-shopping-bag' style='font-size:3rem;'></i><p style="font-size:10px; font-weight:900; margin-top:10px;">NO DATA LOGGED</p></div>`;
      return;
    }

    // RENDER ROWS WITH EPIC INTRO
    container.innerHTML = filtered
      .map((sale, index) => {
        const amount = Number(sale.total_amount || 0);
        const safeName = DOMPurify.sanitize(sale.products?.name || 'Item');
        const safeSKU = DOMPurify.sanitize(sale.products?.sku || 'N/A');
        const time = new Date(sale.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        return `
        <div class="list-item-card" id="row-${sale.id}" style="animation-delay: ${index * 0.06}s;">
          <div class="card-header" style="margin-bottom: 0;">
            <div class="status-icon" style="background: var(--bg-dark); color: var(--wolf-red);"><i class='bx bx-shopping-bag'></i></div>
            <div class="item-info">
              <h4 style="font-size:13px; font-weight:800;">${safeName.toUpperCase()}</h4>
              <div class="time" style="font-size:10px; color:#555;">${time} • x${sale.qty} • ${safeSKU}</div>
            </div>
            <div class="card-actions" style="text-align:right;">
              <div style="color: var(--wolf-red); font-weight: 900; font-family: 'JetBrains Mono'; font-size:14px;">
                ₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              ${!this.isReadOnly ? `<i class='bx bx-trash' style="cursor:pointer; color:#333; font-size:14px;" onclick="wolfData.deleteSale('${sale.id}')"></i>` : ''}
            </div>
          </div>
        </div>`;
      })
      .join('');
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
      html: `<p class="wolf-swal-text">WARNING: THIS RECORD WILL BE MOVED TO TRASH bin. PROCEED?</p>`,
      showCancelButton: true,
      confirmButtonText: 'REMOVE',
      cancelButtonText: 'CANCEL',
      background: '#111',
      buttonsStyling: false,
      customClass: {
        popup: 'wolf-swal-popup-orange',
        confirmButton: 'wolf-swal-confirm-orange',
        cancelButton: 'wolf-swal-cancel',
      },
    });

    if (!result.isConfirmed) return;

    try {
      // 1. EPIC OUTRO
      const rowElement = document.getElementById(`row-${id}`);
      if (rowElement) {
        rowElement.classList.add('removing');
        await new Promise((r) => setTimeout(r, 400));
        rowElement.remove();
      }

      // 2. DB LOGIC
      const { data: logData } = await supabaseClient
        .from('check_in_logs')
        .select('*')
        .eq('id', id)
        .single();
      await supabaseClient.from('trash_bin').insert([
        {
          original_id: id,
          table_name: 'check_in_logs',
          deleted_data: logData,
        },
      ]);
      await supabaseClient.from('check_in_logs').delete().eq('id', id);

      if (window.wolfAudio) window.wolfAudio.play('notif');

      // 3. SILENT REFRESH (Triggers the Green/Red Glow and Rolling Numbers)
      await this.loadLogbook();
    } catch (err) {
      console.error(err);
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
      <p class="wolf-swal-text" style="text-transform: uppercase; letter-spacing: 1px;">
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

    // --- 1. TARGET ELEMENT FOR EPIC OUTRO ---
    const rowElement = document.getElementById(`row-${id}`);

    try {
      // --- 2. START SLIDE & FADE ANIMATION ---
      if (rowElement) {
        rowElement.classList.add('removing');
        await new Promise((resolve) => setTimeout(resolve, 400));
        rowElement.remove();
      }

      // --- 3. DB PREPARATION (FETCH BEFORE DELETE) ---
      const { data: saleData, error: saleErr } = await supabaseClient
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();

      if (saleErr || !saleData) throw saleErr;

      // --- 4. RESTORE PRODUCT STOCK ---
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

      // --- 5. EXECUTE VOID PROTOCOL (TRASH + DELETE) ---
      await supabaseClient.from('trash_bin').insert([
        {
          original_id: id,
          table_name: 'sales',
          deleted_data: saleData,
        },
      ]);

      await supabaseClient.from('sales').delete().eq('id', id);

      // --- 6. SYNC INTERNAL MEMORY & TRIGGER HUD ANIMATION ---
      this.allSales = (this.allSales || []).filter((s) => s.id !== id);
      const newTotal = this.allSales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0,
      );
      this.refreshSummaryHUD(newTotal);

      // --- 7. SHOW NOTIFICATION ---
      const message = `${product?.name || 'Product'}, X${saleData.qty} WAS REMOVED`;

      window.salesManager.showSystemAlert(message, 'success');
      Toastify({
        text: message,
        duration: 5000,
        gravity: 'top',
        position: 'right',
        stopOnFocus: true,
        style: {
          border: '1px solid #ff9800', // correct way to set border color
          background: '#0a0a0a',
          borderRadius: '12px',
          fontWeight: '900',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#fff',
        },
      }).showToast();

      if (window.wolfAudio) window.wolfAudio.play('success');
    } catch (err) {
      console.error('Void Protocol Fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
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

window.wolfData = wolfData;

wolfData.addSaleRow = function (sale) {
  // Ensure salesData array exists
  if (!Array.isArray(this.salesData)) this.salesData = [];

  // Add the new sale to the array
  this.salesData.push(sale);

  // Render row in the table
  const tbody = document.querySelector('#sales-table-body');
  if (tbody) {
    const tr = document.createElement('tr');
    tr.id = `sale-row-${sale.id}`;
    tr.innerHTML = `
      <td>${sale.id}</td>
      <td>${sale.product_name}</td>
      <td>${sale.quantity}</td>
      <td>${sale.price}</td>
      <td>${(sale.quantity * sale.price).toFixed(2)}</td>
      <td><button onclick="wolfData.deleteSale('${sale.id}')">Delete</button></td>
    `;
    tbody.appendChild(tr);
  }

  // Recalculate totals safely
  this.updateLedgerRevenue();
};

wolfData.removeSaleRow = function (id) {
  // Update the array source
  this.allSales = (this.allSales || []).filter((row) => row.id !== id);

  // Remove from UI
  const rowEl = document.getElementById(`row-${id}`);
  if (rowEl) rowEl.remove();

  // Update Total
  this.updateLedgerRevenue();
};

wolfData.initRealtime = async function () {
  // Safety: update totals immediately
  this.updateLedgerRevenue();

  if (this.realtimeChannel) return; // Prevent duplicate connections

  // Ensure atomic time is synced first
  if (!this.selectedDate) await this.syncServerTime();

  const channel = supabaseClient
    .channel('wolf-ledger-sync-stable')

    /* =======================
       SALES (ROW-LEVEL + totals)
    ======================= */
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sales' },
      (payload) => {
        if (this.activeMode !== 'sales') return;

        const sale = payload.new;
        // Add to memory and render
        this.allSales.unshift(sale);
        this.renderSales(this.selectedDate.getDay());
      },
    )

    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sales' },
      (payload) => {
        if (this.activeMode !== 'sales') return;
        this.updateSaleRow(payload.new);
        this.updateLedgerRevenue();
        Toastify({
          text: `Sale updated: ${payload.new.id}`,
          duration: 5000,
          gravity: 'top',
          position: 'right',
        }).showToast();
      },
    )

    /* =======================
       LOGBOOK (ROW-LEVEL)
    ======================= */
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'check_in_logs' },
      (payload) => {
        if (this.activeMode !== 'logbook') return;
        this.addLogbookRow(payload.new);
        Toastify({
          text: `Log added: ${payload.new.id}`,
          duration: 5000,
          gravity: 'top',
          position: 'right',
          style: {
            border: '1px solid #4dff00', // correct way to set border color
            background: '#0a0a0a',
            borderRadius: '12px',
            fontWeight: '900',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#fff',
          },
        }).showToast();
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'check_in_logs' },
      (payload) => {
        if (this.activeMode !== 'logbook') return;
        this.updateLogbookRow(payload.new);
        Toastify({
          text: `Log updated: ${payload.new.id}`,
          duration: 5000,
          gravity: 'top',
          position: 'right',
          style: {
            border: '1px solid #6fff00', // correct way to set border color
            background: '#0a0a0a',
            borderRadius: '12px',
            fontWeight: '900',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#fff',
          },
        }).showToast();
      },
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'check_in_logs' },
      (payload) => {
        if (this.activeMode !== 'logbook') return;
        this.removeLogbookRow(payload.old.id);
        Toastify({
          text: `Log removed: ${payload.old.id}`,
          duration: 5000,
          gravity: 'top',
          position: 'right',
          style: {
            border: '1prgb(255, 0, 0) #ff9800', // correct way to set border color
            background: '#0a0a0a',
            borderRadius: '12px',
            fontWeight: '900',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#fff',
          },
        }).showToast();
      },
    );

  // Subscribe
  const { error } = await channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      this.showRealtimeToast?.();
    }
  });

  if (error) {
    Toastify({
      text: 'Realtime subscription failed ❌',
      duration: 5000,
      gravity: 'top',
      position: 'right',
      backgroundColor: '#f44336',
    }).showToast();
    console.error('Realtime subscription failed:', error);
    return;
  }

  this.realtimeChannel = channel;
};

wolfData.updateLedgerRevenue = function () {
  const revenueEl = document.getElementById('ledger-summary-amount');
  if (!revenueEl) return;

  // Uses allSales (the same array populated by loadSales)
  const total = (this.allSales || []).reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0,
  );

  revenueEl.textContent = `₱${total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
    duration: 5000,
    gravity: 'top',
    position: 'right',
    style: {
      background: '#0a0a0a',
      border: '1px solid #ffffff',
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
  const muteBtn = e.target.closest('#muteToggleBtn');
  if (muteBtn) {
    e.preventDefault();
    e.stopPropagation();

    // Trigger the audio engine
    const isMutedNow = window.wolfAudio.toggleMute();

    // Optional: Play a tiny "notif" sound if we just unmuted
    if (!isMutedNow) {
      window.wolfAudio.play('notif');
    }
    return;
  }

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
      duration: 5000,
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

// Also run on first load
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const p = urlParams.get('p') || 'home';

  wolfData.syncNavigationUI(p);
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
