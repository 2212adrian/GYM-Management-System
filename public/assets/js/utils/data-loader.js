const wolfData = {
    // State management for filtering
    currentLogDay: new Date().getDay(),
    currentSalesDay: new Date().getDay(),
    salesDataCache: [], // Cache used for instant searching without re-fetching from DB

    // ==========================================
    // 1. LOGBOOK ENGINE
    // ==========================================
    async loadLogbook(selectedDay = this.currentLogDay) {
        const container = document.getElementById('logbook-list-container');
        const revenueEl = document.getElementById('logbook-total-revenue');
        const labelEl = document.getElementById('logbook-summary-label');
        if (!container) return;

        this.currentLogDay = selectedDay;
        this.updateDayUI('logbook', selectedDay);

        container.innerHTML = `<div class="text-center p-5"><i class='bx bx-loader-alt bx-spin' style="color:var(--wolf-red); font-size:2rem;"></i></div>`;

        const { data, error } = await supabaseClient
            .from('check_in_logs')
            .select('*, profiles(full_name)')
            .order('time_in', { ascending: false });

        if (error) return console.error("Logbook Error:", error);

        // Filter by day
        const filteredData = data.filter(log => new Date(log.time_in).getDay() == selectedDay);

        let totalRevenue = 0;
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        if (labelEl) labelEl.innerText = `${dayNames[selectedDay]} Floor Revenue`;

        if (filteredData.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:#444; margin-top:40px;">No records found.</p>`;
            if (revenueEl) revenueEl.innerText = `₱0`;
            return;
        }

        container.innerHTML = filteredData.map(log => {
            const isClosed = log.time_out !== null;
            const timeIn = new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const timeOut = isClosed ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
            
            const isMember = log.notes?.toLowerCase().includes('monthly');
            const fee = isMember ? 0 : 80;
            totalRevenue += fee;

            return `
            <div class="list-item-card">
                <div class="card-header">
                    <div class="status-icon ${!isClosed ? 'active' : ''}">
                        <i class='bx ${isClosed ? 'bx-check' : 'bx-time-five'}'></i>
                    </div>
                    <div class="item-info">
                        <h4>${log.profiles?.full_name || 'Walk-in Guest'}</h4>
                        <div class="sub">${log.notes || 'General Entry'}</div>
                        <div class="time">IN: ${timeIn}</div>
                    </div>
                    <div class="card-actions">
                        <span class="badge-paid">PAID</span>
                        <i class='bx bx-refresh action-small' title="Refresh"></i>
                        <i class='bx bx-trash action-small' title="Delete" onclick="wolfData.deleteLog('${log.id}')"></i>
                    </div>
                </div>
                <div class="card-details">
                    <div class="detail-group"><label>Entry Fee</label><div class="val">₱${fee}</div></div>
                    ${isClosed ? `<div class="detail-group text-end"><label>Session End</label><div class="val" style="font-size:0.9rem;">${timeOut}</div></div>` : ''}
                </div>
                ${isClosed ? `<button class="re-open-btn" onclick="wolfData.reopenLog('${log.id}')"><i class='bx bx-undo'></i> Re-open Session</button>` : ''}
            </div>`;
        }).join('');

        if (revenueEl) revenueEl.innerText = `₱${totalRevenue}`;
    },

    // ==========================================
    // 2. SALES ENGINE
    // ==========================================
    async loadSales(selectedDay = this.currentSalesDay) {
        const container = document.getElementById('sales-list-container');
        const revenueEl = document.getElementById('sales-total-amount');
        const labelEl = document.getElementById('sales-summary-label');
        if (!container) return;

        this.currentSalesDay = selectedDay;
        this.updateDayUI('sales', selectedDay);

        container.innerHTML = `<div class="text-center p-5"><i class='bx bx-loader-alt bx-spin' style="color:var(--wolf-red); font-size:2rem;"></i></div>`;

        const { data, error } = await supabaseClient
            .from('sales')
            .select('*, products(name)')
            .order('created_at', { ascending: false });

        if (error) return console.error("Sales Error:", error);

        this.salesDataCache = data; // Store in cache for instant search filtering
        this.renderSales(selectedDay);
    },

    renderSales(day, searchTerm = "") {
        const container = document.getElementById('sales-list-container');
        const revenueEl = document.getElementById('sales-total-amount');
        const labelEl = document.getElementById('sales-summary-label');
        
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        if (labelEl) labelEl.innerText = `${dayNames[day]} Total Income`;

        const filtered = this.salesDataCache.filter(sale => {
            const dateMatch = new Date(sale.created_at).getDay() == day;
            const searchLower = searchTerm.toLowerCase();
            const nameMatch = sale.products?.name.toLowerCase().includes(searchLower);
            const refMatch = sale.sale_reference?.toLowerCase().includes(searchLower);
            return dateMatch && (nameMatch || refMatch);
        });

        let total = 0;
        if (filtered.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:#444; margin-top:40px;">No sales found.</p>`;
            if (revenueEl) revenueEl.innerText = `₱0`;
            return;
        }

        container.innerHTML = filtered.map(sale => {
            total += sale.total_amount;
            const time = new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        }).join('');

        if (revenueEl) revenueEl.innerText = `₱${total.toLocaleString()}`;
    },

    // ==========================================
    // 3. UTILS & SHARED LOGIC
    // ==========================================
    updateDayUI(type, day) {
        const selector = type === 'logbook' ? '#logbook-day-picker' : '#sales-day-picker';
        document.querySelectorAll(`${selector} .day-btn`).forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-day') == day);
        });
    },

    async deleteLog(id) {
        if (confirm("Delete this check-in?")) {
            await supabaseClient.from('check_in_logs').delete().eq('id', id);
            this.loadLogbook(this.currentLogDay);
        }
    },

    async deleteSale(id) {
        if (confirm("Delete this transaction?")) {
            await supabaseClient.from('sales').delete().eq('id', id);
            this.loadSales(this.currentSalesDay);
        }
    },

    async reopenLog(id) {
        await supabaseClient.from('check_in_logs').update({ time_out: null }).eq('id', id);
        this.loadLogbook(this.currentLogDay);
    }
};

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