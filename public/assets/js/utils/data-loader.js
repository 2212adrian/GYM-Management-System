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
  initRealtime() {
    console.log('Wolf OS: Realtime Telemetry Sync Active.');

    // Listen for new Sales
    supabaseClient
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        (payload) => {
          console.log('Realtime Sale Detected:', payload);
          this.loadSales(this.currentSalesDay); // Auto-refresh list & total
        },
      )
      // Listen for Product changes (like qty updates)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          console.log('Realtime Stock Update:', payload);
          // If the sale terminal is open, we should fetch fresh product data
          if (window.salesManager) window.salesManager.fetchProducts();
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
  // 1. LOGBOOK ENGINE
  // ==========================================
  async loadLogbook(selectedDay = this.currentLogDay) {
    const container = document.getElementById('logbook-list-container');
    if (!container) return;

    this.currentLogDay = parseInt(selectedDay);
    this.updateDayUI('logbook', this.currentLogDay);

    const { data, error } = await supabaseClient
      .from('check_in_logs')
      .select('*, profiles(full_name)')
      .order('time_in', { ascending: false });

    if (error) return;

    const filteredData = data.filter(
      (log) => new Date(log.time_in).getDay() === this.currentLogDay,
    );

    container.innerHTML = filteredData
      .map((log) => {
        const isClosed = log.time_out !== null;
        return `
            <div class="list-item-card">
                <div class="card-header">
                    <div class="status-icon ${!isClosed ? 'active' : ''}"><i class='bx ${isClosed ? 'bx-check' : 'bx-time-five'}'></i></div>
                    <div class="item-info">
                        <h4>${log.profiles?.full_name || 'Walk-in Guest'}</h4>
                        <div class="time">IN: ${new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div class="card-actions">
                        <!-- TRASH ICON: Completely removed from HTML if ReadOnly -->
                        ${!this.isReadOnly ? `<i class='bx bx-trash action-small' onclick="wolfData.deleteLog('${log.id}')"></i>` : ''}
                    </div>
                </div>
                <!-- RE-OPEN BUTTON: Only show if training ended AND not read-only -->
                ${isClosed && !this.isReadOnly ? `<button class="re-open-btn" onclick="wolfData.reopenLog('${log.id}')"><i class='bx bx-undo'></i> Re-open Session</button>` : ''}
            </div>`;
      })
      .join('');
  },

  // ==========================================
  // 2. SALES ENGINE
  // ==========================================

  async loadSales(selectedDay = this.currentSalesDay) {
    const container = document.getElementById('sales-list-container');
    const revenueEl = document.getElementById('sales-total-amount'); // The total display element
    const labelEl = document.getElementById('sales-summary-label');

    if (!container) return;

    this.currentSalesDay = parseInt(selectedDay);
    this.updateDayUI('sales', this.currentSalesDay);

    const { data, error } = await supabaseClient
      .from('sales')
      .select('*, products(name)')
      .order('created_at', { ascending: false });

    if (error) return console.error(error);

    // 1. Filter by the selected day
    const filtered = data.filter(
      (sale) => new Date(sale.created_at).getDay() === this.currentSalesDay,
    );

    // --- THE CALCULATION LOGIC ---
    let totalIncome = 0;
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    if (labelEl)
      labelEl.innerText = `${dayNames[this.currentSalesDay]} Total Income`;

    if (filtered.length === 0) {
      container.innerHTML = `<p style="text-align:center; color:#444; margin-top:40px;">No transactions recorded.</p>`;
      if (revenueEl) revenueEl.innerText = `₱0.00`;
      return;
    }

    // 2. Map and Sum
    container.innerHTML = filtered
      .map((sale) => {
        // Accumulate the total (Force it to be a number to prevent bugs)
        totalIncome += Number(sale.total_amount || 0);

        return `
        <div class="list-item-card" style="padding: 15px 20px;">
            <div class="card-header" style="margin-bottom: 0;">
                <div class="status-icon" style="background: var(--bg-dark); color: var(--wolf-red);">
                    <i class='bx bx-shopping-bag'></i>
                </div>
                <div class="item-info">
                    <h4>${sale.products?.name || 'Item'}</h4>
                    <div class="time">${new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • x${sale.qty}</div>
                </div>
                <div class="card-actions">
                    <div style="color: var(--wolf-red); font-weight: 900; font-family: 'Courier New';">₱${Number(sale.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    ${!this.isReadOnly ? `<i class='bx bx-trash' style="cursor:pointer; color:#333;" onclick="wolfData.deleteSale('${sale.id}')"></i>` : ''}
                </div>
            </div>
        </div>`;
      })
      .join('');

    // 3. Update the Summary Card with formatting
    if (revenueEl) {
      revenueEl.innerText = `₱${totalIncome.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  },

  renderSales(day, searchTerm = '') {
    const container = document.getElementById('sales-list-container');
    const revenueEl = document.getElementById('sales-total-amount');
    const labelEl = document.getElementById('sales-summary-label');

    // --- THE FIX: Stop if elements are missing ---
    if (!container) {
      console.warn('Wolf OS: Sales container not found. Skipping render.');
      return;
    }

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    if (labelEl) labelEl.innerText = `${dayNames[day]} Total Income`;

    const filtered = this.salesDataCache.filter((sale) => {
      const dateMatch = new Date(sale.created_at).getDay() == day;
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = sale.products?.name
        ?.toLowerCase()
        .includes(searchLower);
      const refMatch = sale.sale_reference?.toLowerCase().includes(searchLower);
      return dateMatch && (nameMatch || refMatch);
    });

    let total = 0;
    if (filtered.length === 0) {
      container.innerHTML = `<p style="text-align:center; color:#444; margin-top:40px;">No sales found.</p>`;
      if (revenueEl) revenueEl.innerText = `₱0`;
      return;
    }

    container.innerHTML = filtered
      .map((sale) => {
        total += sale.total_amount;
        const time = new Date(sale.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `
        <div class="list-item-card" style="padding: 15px 20px; margin-bottom:10px;">
            <div class="card-header" style="margin-bottom: 0;">
                <div class="status-icon" style="background: var(--bg-dark); color: var(--wolf-red);"><i class='bx bx-shopping-bag'></i></div>
                <div class="item-info">
                    <h4 style="font-weight: 800;">${sale.products?.name || 'Item'}</h4>
                    <div class="time" style="font-size: 11px; color: #555;">${time} • x${sale.qty} Units</div>
                </div>
                <div class="card-actions">
                    <div style="color: var(--wolf-red); font-weight: 900; font-style: italic; font-size: 1.1rem;">₱${sale.total_amount.toLocaleString()}</div>
                    <i class='bx bx-trash' style="color: #333; cursor: pointer; font-size: 18px;" onclick="wolfData.deleteSale('${sale.id}')"></i>
                </div>
            </div>
        </div>`;
      })
      .join('');

    if (revenueEl) revenueEl.innerText = `₱${total.toLocaleString()}`;
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
    if (
      !confirm('VOID TRANSACTION: Archive sale and restore product quantity?')
    )
      return;

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
      this.loadSales(this.currentSalesDay);
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

// Global Event Listeners
document.addEventListener('click', (e) => {
  // Logbook Day Picker
  const logDayBtn = e.target.closest('#logbook-day-picker .day-btn');
  if (logDayBtn) wolfData.loadLogbook(logDayBtn.getAttribute('data-day'));

  // Sales Day Picker
  const salesDayBtn = e.target.closest('#sales-day-picker .day-btn');
  if (salesDayBtn) wolfData.loadSales(salesDayBtn.getAttribute('data-day'));
});

document.addEventListener('input', (e) => {
  // Sales Live Search
  if (e.target.id === 'sales-search') {
    wolfData.renderSales(wolfData.currentSalesDay, e.target.value);
  }
});
