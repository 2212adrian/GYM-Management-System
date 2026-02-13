(function initWolfSystemToolsManagers() {
  if (window.__wolfSystemToolsManagersBooted) return;
  window.__wolfSystemToolsManagersBooted = true;

  const LOCAL_EQUIPMENT_KEY = 'wolf_local_equipments';
  const LOCAL_FEEDBACK_KEY = 'wolf_local_feedback_entries';
  const LOCAL_GOAL_KEY = 'wolf_local_goal_targets';
  const LOCAL_GOAL_CUSTOM_KEY = 'wolf_local_goal_custom_config';
  const SETTINGS_ACTION_SOUNDS_KEY = 'wolf_action_sounds_muted';
  const SETTINGS_VICTORY_VISUALS_KEY = 'wolf_victory_visuals_enabled';
  const SETTINGS_UI_SCALE_KEY = 'wolf_ui_scale_percent';
  const SETTINGS_DISPLAY_NAME_KEY = 'wolf_display_name';
  const SUPERADMIN_EMAIL = 'adrianangeles2212@gmail.com';
  const FIXED_ADMIN_EMAILS = new Set([
    SUPERADMIN_EMAIL,
    'ktorrazo123@gmail.com',
  ]);
  const FIXED_STAFF_EMAILS = new Set(['adrianangeles2213@gmail.com']);

  function normalizeRoleEmail(email) {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  // Used for RBAC roles
  function resolveRoleFromAccessContext() {
    const context = window.WOLF_ACCESS_CONTEXT || {};
    const email = normalizeRoleEmail(context.email || window.WOLF_USER_EMAIL);
    if (email && FIXED_ADMIN_EMAILS.has(email)) return 'admin';
    if (email && FIXED_STAFF_EMAILS.has(email)) return 'staff';

    const role = String(context.role || window.WOLF_USER_ROLE || '')
      .trim()
      .toLowerCase();
    return role === 'admin' || role === 'staff' ? role : null;
  }

  function getAccessFlags() {
    const role = resolveRoleFromAccessContext();
    const email = normalizeRoleEmail(
      window.WOLF_ACCESS_CONTEXT?.email || window.WOLF_USER_EMAIL,
    );
    const isAdmin = role === 'admin';
    const isStaff = role === 'staff';
    return {
      role,
      email,
      isAdmin,
      isStaff,
      isSuperAdmin: email === SUPERADMIN_EMAIL,
      canHardDelete: isAdmin,
    };
  }

  function escapeHtml(value) {
    const text = String(value ?? '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function formatCurrency(value = 0) {
    return `PHP ${toNumber(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDateTime(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateOnly(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  function notify(message, type = 'info') {
    const text = String(message || '').trim();
    if (!text) return;

    if (
      window.salesManager &&
      typeof window.salesManager.showSystemAlert === 'function'
    ) {
      const mappedType =
        type === 'error' || type === 'warning' ? 'error' : 'success';
      window.salesManager.showSystemAlert(text, mappedType);
    }

    if (typeof window.Toastify === 'function') {
      window
        .Toastify({
          text,
          duration: 3200,
          gravity: 'top',
          position: 'right',
          style: {
            background:
              type === 'error'
                ? '#3a1111'
                : type === 'warning'
                  ? '#3a2b11'
                  : '#102119',
            color: '#f4f6f9',
            border: `1px solid ${
              type === 'error'
                ? '#ef4444'
                : type === 'warning'
                  ? '#f59e0b'
                  : '#22c55e'
            }`,
            borderRadius: '10px',
            fontWeight: '700',
          },
        })
        .showToast();
    }
  }

  function readLocalArray(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalArray(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value || []));
    } catch (_) {
      // ignore local storage failures
    }
  }

  function isMissingColumnError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      error?.code === 'PGRST204' ||
      /column .* does not exist/.test(message) ||
      /could not find the .* column/.test(message) ||
      /schema cache/.test(message)
    );
  }

  function isMissingTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      error?.code === 'PGRST205' ||
      error?.code === '42P01' ||
      /relation .* does not exist/.test(message) ||
      /could not find the table/.test(message) ||
      /table .* does not exist/.test(message)
    );
  }

  function isPermissionDeniedError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      error?.code === '42501' ||
      /row-level security policy/.test(message) ||
      /permission denied/.test(message) ||
      /insufficient privileges/.test(message)
    );
  }

  async function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (
      window.supabaseReady &&
      typeof window.supabaseReady.then === 'function'
    ) {
      try {
        await window.supabaseReady;
      } catch (_) {
        // ignore and return null
      }
    }
    return window.supabaseClient || null;
  }

  function getRangeStart(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  function getRangeEnd(date) {
    const value = getRangeStart(date);
    value.setDate(value.getDate() + 1);
    return value;
  }

  function getWeekStart(date) {
    const value = getRangeStart(date);
    value.setDate(value.getDate() - value.getDay());
    return value;
  }

  function getMonthStart(date) {
    const value = getRangeStart(date);
    value.setDate(1);
    return value;
  }

  function parseRowDate(row, columns) {
    for (const column of columns) {
      const value = row?.[column];
      if (!value) continue;
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  async function fetchRowsByDateRange(
    client,
    table,
    columns,
    startIso,
    endIso,
    dateColumns,
  ) {
    if (!client) return { data: [], error: null };

    for (const dateColumn of dateColumns) {
      const { data, error } = await client
        .from(table)
        .select(columns)
        .gte(dateColumn, startIso)
        .lt(dateColumn, endIso);

      if (!error) return { data: data || [], error: null };
      if (!isMissingColumnError(error)) return { data: [], error };
    }

    const { data, error } = await client.from(table).select(columns);
    if (error) return { data: [], error };

    const start = new Date(startIso);
    const end = new Date(endIso);
    const filtered = (data || []).filter((row) => {
      const parsed = parseRowDate(row, dateColumns);
      if (!parsed) return false;
      return parsed >= start && parsed < end;
    });
    return { data: filtered, error: null };
  }

  function computeSalesAmount(rows) {
    return (rows || []).reduce((sum, row) => {
      const total = toNumber(row.total_amount);
      if (total > 0) return sum + total;
      const qty = toNumber(row.qty);
      const unitPrice = toNumber(row.unit_price);
      return sum + qty * unitPrice;
    }, 0);
  }

  function computeLogbookRevenue(rows) {
    return (rows || []).reduce((sum, row) => {
      const paid = toNumber(row.paid_amount);
      if (paid > 0) return sum + paid;
      if (row.is_paid) return sum + toNumber(row.entry_fee);
      return sum;
    }, 0);
  }

  async function fetchRevenueSnapshot(client, startDate, endDate) {
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const salesResult = await fetchRowsByDateRange(
      client,
      'sales',
      'id,total_amount,qty,unit_price,created_at',
      startIso,
      endIso,
      ['created_at'],
    );
    const logbookResult = await fetchRowsByDateRange(
      client,
      'check_in_logs',
      'id,entry_fee,paid_amount,is_paid,time_in,created_at',
      startIso,
      endIso,
      ['time_in', 'created_at'],
    );

    return {
      salesAmount: computeSalesAmount(salesResult.data),
      logbookAmount: computeLogbookRevenue(logbookResult.data),
      salesCount: (salesResult.data || []).length,
      trafficCount: (logbookResult.data || []).length,
      salesError: salesResult.error,
      logbookError: logbookResult.error,
    };
  }

  window.DashboardManager = {
    _timer: null,
    async init() {
      const root = document.getElementById('page-wrapper');
      if (!root) return;
      await this.load();
      if (this._timer) window.clearInterval(this._timer);
      this._timer = window.setInterval(() => this.load(), 45000);
    },

    async load() {
      const totalEl = document.getElementById('dashboard-total-net');
      if (!totalEl) return;

      const client = await getSupabaseClient();
      if (!client) {
        totalEl.textContent = formatCurrency(0);
        return;
      }

      const now = new Date();
      const todayStart = getRangeStart(now);
      const tomorrowStart = getRangeEnd(now);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const [todaySnapshot, yesterdaySnapshot, membersCountResult] =
        await Promise.all([
          fetchRevenueSnapshot(client, todayStart, tomorrowStart),
          fetchRevenueSnapshot(client, yesterdayStart, todayStart),
          client
            .from('members')
            .select('member_id', { count: 'exact', head: true }),
        ]);

      const todayTotal =
        todaySnapshot.salesAmount + todaySnapshot.logbookAmount;
      const yesterdayTotal =
        yesterdaySnapshot.salesAmount + yesterdaySnapshot.logbookAmount;
      const deltaPct =
        yesterdayTotal > 0
          ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
          : 0;

      const trendEl = document.getElementById('dashboard-vs-yesterday');
      const productsEl = document.getElementById('dashboard-products-total');
      const logsEl = document.getElementById('dashboard-log-fees-total');
      const membersEl = document.getElementById('dashboard-active-members');
      const trafficEl = document.getElementById('dashboard-floor-traffic');
      const trendIcon = document.getElementById('dashboard-trend-icon');

      totalEl.textContent = formatCurrency(todayTotal);
      if (productsEl)
        productsEl.textContent = formatCurrency(todaySnapshot.salesAmount);
      if (logsEl)
        logsEl.textContent = formatCurrency(todaySnapshot.logbookAmount);
      if (membersEl)
        membersEl.textContent = String(toNumber(membersCountResult.count || 0));
      if (trafficEl) trafficEl.textContent = `${todaySnapshot.trafficCount}/30`;

      if (trendEl) {
        const absPct = Math.abs(deltaPct).toFixed(1);
        if (yesterdayTotal <= 0 && todayTotal > 0) {
          trendEl.textContent = 'NEW REVENUE ACTIVITY TODAY';
        } else {
          trendEl.textContent = `${absPct}% VS YESTERDAY`;
        }
      }

      if (trendIcon) {
        if (deltaPct >= 0) {
          trendIcon.className = 'bx bx-trending-up';
          trendIcon.style.color = '#22c55e';
        } else {
          trendIcon.className = 'bx bx-trending-down';
          trendIcon.style.color = 'var(--accent-red)';
        }
      }
    },
  };

  window.GoalCenterManager = {
    useLocalCache: false,
    customRangePicker: null,
    toIsoDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    formatShortDate(dateLike) {
      const date = new Date(dateLike);
      if (Number.isNaN(date.getTime())) return '-- ---';
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
      });
    },

    syncCustomRangeDisplay(startDate, endDate) {
      const display = document.getElementById('goal-custom-range-display');
      if (!display) return;
      display.textContent = `${this.formatShortDate(startDate)} -> ${this.formatShortDate(endDate)}`;
    },

    initCustomRangePicker() {
      const startInput = document.getElementById('goal-custom-start-input');
      const endInput = document.getElementById('goal-custom-end-input');
      const rangeInput = document.getElementById('goal-custom-range-input');
      const trigger = document.getElementById('goal-custom-range-trigger');
      if (!startInput || !endInput || !rangeInput || !trigger) return;
      if (typeof flatpickr !== 'function') return;

      if (this.customRangePicker && typeof this.customRangePicker.destroy === 'function') {
        try {
          this.customRangePicker.destroy();
        } catch (_) {
          // ignore
        }
      }

      const cfg = this.getCustomConfig();
      startInput.value = cfg.start_date;
      endInput.value = cfg.end_date;

      const instances = flatpickr(rangeInput, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        disableMobile: true,
        clickOpens: false,
        defaultDate: [cfg.start_date, cfg.end_date],
        positionElement: trigger,
        position: 'below',
        onReady: (selectedDates, dateStr, instance) => {
          const cal = instance.calendarContainer;
          cal.classList.remove('wolf-calendar-v2', 'wolf-calendar-v3');
          cal.classList.add('wolf-calendar');
          cal.classList.remove('open');
        },
        onOpen: (_, __, instance) => {
          requestAnimationFrame(() => {
            instance.calendarContainer.classList.add('open');
          });
        },
        onClose: (_, __, instance) => {
          instance.calendarContainer.classList.remove('open');
        },
        onChange: (selectedDates) => {
          if (!Array.isArray(selectedDates) || selectedDates.length < 1) return;
          const startIso = this.toIsoDate(selectedDates[0]);
          const endIso = this.toIsoDate(
            selectedDates[1] || selectedDates[0],
          );
          if (!startIso || !endIso) return;
          startInput.value = startIso;
          endInput.value = endIso;
          this.syncCustomRangeDisplay(startIso, endIso);
        },
      });

      this.customRangePicker = Array.isArray(instances) ? instances[0] : instances;

      trigger.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.customRangePicker) return;
        if (this.customRangePicker.isOpen) this.customRangePicker.close();
        else this.customRangePicker.open();
      };
    },

    getCustomConfig() {
      const now = new Date();
      const end = getRangeStart(now);
      const start = new Date(end);
      start.setDate(start.getDate() - 14);
      try {
        const raw = window.localStorage.getItem(LOCAL_GOAL_CUSTOM_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        const target = toNumber(parsed?.target_amount);
        const startDate = String(
          parsed?.start_date || start.toISOString().slice(0, 10),
        );
        const endDate = String(
          parsed?.end_date || end.toISOString().slice(0, 10),
        );
        return {
          target_amount: target > 0 ? target : 50000,
          start_date: startDate,
          end_date: endDate,
        };
      } catch (_) {
        return {
          target_amount: 50000,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
        };
      }
    },

    setCustomConfig(config = {}) {
      const nowIso = new Date().toISOString().slice(0, 10);
      const startDate = String(config.start_date || nowIso);
      const endDate = String(config.end_date || nowIso);
      const payload = {
        target_amount: Math.max(1, toNumber(config.target_amount)),
        start_date: startDate,
        end_date: endDate,
      };
      try {
        window.localStorage.setItem(LOCAL_GOAL_CUSTOM_KEY, JSON.stringify(payload));
      } catch (_) {
        // ignore local storage failures
      }
      return payload;
    },

    pickLatestGoalRow(rows) {
      const list = Array.isArray(rows) ? rows.slice() : [];
      if (!list.length) return null;
      list.sort((a, b) => {
        const aStart = new Date(a?.start_date || 0).getTime();
        const bStart = new Date(b?.start_date || 0).getTime();
        const aCreated = new Date(a?.created_at || 0).getTime();
        const bCreated = new Date(b?.created_at || 0).getTime();
        const aId = toNumber(a?.id);
        const bId = toNumber(b?.id);
        return (
          (Number.isFinite(bStart) ? bStart : 0) - (Number.isFinite(aStart) ? aStart : 0) ||
          (Number.isFinite(bCreated) ? bCreated : 0) - (Number.isFinite(aCreated) ? aCreated : 0) ||
          bId - aId
        );
      });
      return list[0] || null;
    },

    getLocalTargets() {
      const source = readLocalArray(LOCAL_GOAL_KEY);
      const map = new Map();
      source.forEach((item) => {
        if (!item?.period_type) return;
        map.set(
          String(item.period_type).toUpperCase(),
          toNumber(item.target_amount),
        );
      });
      return map;
    },

    setLocalTarget(period, amount) {
      const rows = readLocalArray(LOCAL_GOAL_KEY).filter(
        (item) => String(item.period_type || '').toUpperCase() !== period,
      );
      rows.push({
        id: `local-${period}-${Date.now()}`,
        period_type: period,
        target_amount: toNumber(amount),
        start_date: new Date().toISOString().slice(0, 10),
      });
      writeLocalArray(LOCAL_GOAL_KEY, rows);
    },

    async init() {
      const root = document.getElementById('goal-center-page');
      if (!root || root.dataset.boundGoalCenter === '1') {
        await this.load();
        return;
      }

      root.dataset.boundGoalCenter = '1';
      root.addEventListener('click', async (event) => {
        if (event.target.closest('#goal-custom-range-trigger')) {
          if (this.customRangePicker) {
            if (this.customRangePicker.isOpen) this.customRangePicker.close();
            else this.customRangePicker.open();
          }
          return;
        }

        const saveBtn = event.target.closest(
          '#goal-daily-save, #goal-weekly-save, #goal-monthly-save, #goal-quarterly-save, #goal-yearly-save, #goal-custom-save',
        );
        if (!saveBtn) return;

        const period = saveBtn.id.includes('daily')
          ? 'DAILY'
          : saveBtn.id.includes('weekly')
            ? 'WEEKLY'
            : saveBtn.id.includes('monthly')
              ? 'MONTHLY'
              : saveBtn.id.includes('quarterly')
                ? 'QUARTERLY'
                : saveBtn.id.includes('yearly')
                  ? 'YEARLY'
              : 'CUSTOM';

        await this.save(period);
      });

      await this.load();
      this.initCustomRangePicker();
    },

    getInput(period) {
      const id = `goal-${period.toLowerCase()}-input`;
      return document.getElementById(id);
    },

    async save(period) {
      if (period === 'CUSTOM') {
        const targetInput = document.getElementById('goal-custom-input');
        const startInput = document.getElementById('goal-custom-start-input');
        const endInput = document.getElementById('goal-custom-end-input');
        const targetAmount = toNumber(targetInput?.value);
        const startDate = String(startInput?.value || '').trim();
        const endDate = String(endInput?.value || '').trim();
        if (targetAmount <= 0) {
          notify('Custom target must be greater than zero.', 'error');
          return;
        }
        if (!startDate || !endDate) {
          notify('Custom start and end dates are required.', 'error');
          return;
        }
        if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
          notify('Custom start date cannot be after end date.', 'error');
          return;
        }
        this.setCustomConfig({
          target_amount: targetAmount,
          start_date: startDate,
          end_date: endDate,
        });
        await this.load();
        notify('Custom target saved.', 'success');
        return;
      }

      if (period === 'QUARTERLY' || period === 'YEARLY') {
        const input = this.getInput(period);
        if (!input) return;
        const value = toNumber(input.value);
        if (value <= 0) {
          notify('Target must be greater than zero.', 'error');
          return;
        }
        this.setLocalTarget(period, value);
        await this.load();
        notify(`${period} target saved.`, 'success');
        return;
      }

      const input = this.getInput(period);
      if (!input) return;
      const value = toNumber(input.value);
      if (value <= 0) {
        notify('Target must be greater than zero.', 'error');
        return;
      }

      const client = await getSupabaseClient();
      if (!client || this.useLocalCache) {
        this.setLocalTarget(period, value);
        await this.load();
        notify('Target saved locally.', 'success');
        return;
      }

      const payload = {
        period_type: period,
        target_amount: value,
        start_date: new Date().toISOString().slice(0, 10),
      };

      let { error } = await client
        .from('goal_target')
        .upsert(payload, { onConflict: 'period_type' });

      // Fallback for schemas missing start_date or unique(on period_type).
      if (error && isMissingColumnError(error)) {
        ({ error } = await client
          .from('goal_target')
          .upsert(
            { period_type: period, target_amount: value },
            { onConflict: 'period_type' },
          ));
      }
      if (error) {
        const latestResult = await client
          .from('goal_target')
          .select('id,period_type,target_amount,start_date,created_at')
          .eq('period_type', period)
          .limit(200);
        const latest = this.pickLatestGoalRow(latestResult.data || []);
        if (!latestResult.error && latest?.id) {
          ({ error } = await client
            .from('goal_target')
            .update(payload)
            .eq('id', latest.id));
        }
      }

      if (error) {
        if (isMissingTableError(error)) {
          this.useLocalCache = true;
          this.setLocalTarget(period, value);
          await this.load();
          notify('Goal table missing. Saved locally for now.', 'warning');
          return;
        }
        if (isPermissionDeniedError(error)) {
          this.useLocalCache = true;
          this.setLocalTarget(period, value);
          await this.load();
          notify(
            'Goal target blocked by RLS. Saved locally. Run docs/sql/goal_target_rls_policy.sql.',
            'warning',
          );
          return;
        }
        notify(`Failed to save target: ${error.message}`, 'error');
        return;
      }

      if (
        window.wolfData &&
        typeof window.wolfData.loadGoalTargets === 'function'
      ) {
        await window.wolfData.loadGoalTargets();
      }

      await this.load();
      notify(`${period} target saved.`, 'success');
    },

    async loadTargetsFromDatabase(client) {
      const periods = ['DAILY', 'WEEKLY', 'MONTHLY'];
      const map = new Map();

      for (const period of periods) {
        const { data, error } = await client
          .from('goal_target')
          .select('*')
          .eq('period_type', period)
          .limit(200);

        if (error) {
          return { error, map };
        }
        const latest = this.pickLatestGoalRow(data || []);
        map.set(period, toNumber(latest?.target_amount));
      }

      return { error: null, map };
    },

    async load() {
      const root = document.getElementById('goal-center-page');
      if (!root) return;

      const client = await getSupabaseClient();
      let targetMap = this.getLocalTargets();

      if (client && !this.useLocalCache) {
        const { error, map } = await this.loadTargetsFromDatabase(client);
        if (error) {
          if (isMissingTableError(error)) {
            this.useLocalCache = true;
          } else if (isPermissionDeniedError(error)) {
            this.useLocalCache = true;
            notify(
              'Goal target read blocked by RLS. Using local cache. Run docs/sql/goal_target_rls_policy.sql.',
              'warning',
            );
          } else {
            notify(`Unable to load goal targets: ${error.message}`, 'error');
          }
        } else {
          map.forEach((value, key) => {
            targetMap.set(String(key || '').toUpperCase(), toNumber(value));
          });
        }
      }

      const now = new Date();
      const todayStart = getRangeStart(now);
      const tomorrowStart = getRangeEnd(now);
      const weekStart = getWeekStart(now);
      const monthStart = getMonthStart(now);
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const customConfig = this.getCustomConfig();
      const customStart = getRangeStart(new Date(customConfig.start_date));
      const customEnd = getRangeStart(new Date(customConfig.end_date));
      const customEndExclusive = getRangeEnd(customEnd);

      const [
        dailySnapshot,
        weeklySnapshot,
        monthlySnapshot,
        quarterlySnapshot,
        yearlySnapshot,
        customSnapshot,
      ] = client
        ? await Promise.all([
            fetchRevenueSnapshot(client, todayStart, tomorrowStart),
            fetchRevenueSnapshot(client, weekStart, tomorrowStart),
            fetchRevenueSnapshot(client, monthStart, tomorrowStart),
            fetchRevenueSnapshot(client, quarterStart, tomorrowStart),
            fetchRevenueSnapshot(client, yearStart, tomorrowStart),
            fetchRevenueSnapshot(client, customStart, customEndExclusive),
          ])
        : [
            { salesAmount: 0, logbookAmount: 0 },
            { salesAmount: 0, logbookAmount: 0 },
            { salesAmount: 0, logbookAmount: 0 },
            { salesAmount: 0, logbookAmount: 0 },
            { salesAmount: 0, logbookAmount: 0 },
            { salesAmount: 0, logbookAmount: 0 },
          ];

      const metrics = {
        DAILY: dailySnapshot.salesAmount + dailySnapshot.logbookAmount,
        WEEKLY: weeklySnapshot.salesAmount + weeklySnapshot.logbookAmount,
        MONTHLY: monthlySnapshot.salesAmount + monthlySnapshot.logbookAmount,
      };
      const extraMetrics = {
        QUARTERLY: quarterlySnapshot.salesAmount + quarterlySnapshot.logbookAmount,
        YEARLY: yearlySnapshot.salesAmount + yearlySnapshot.logbookAmount,
        CUSTOM: customSnapshot.salesAmount + customSnapshot.logbookAmount,
      };

      ['DAILY', 'WEEKLY', 'MONTHLY'].forEach((period) => {
        const target = toNumber(targetMap.get(period));
        const actual = toNumber(metrics[period]);
        const pct =
          target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;

        const amountEl = document.getElementById(
          `goal-${period.toLowerCase()}-amount`,
        );
        const barEl = document.getElementById(
          `goal-${period.toLowerCase()}-progress`,
        );
        const windowEl = document.getElementById(
          `goal-${period.toLowerCase()}-window`,
        );
        const inputEl = this.getInput(period);

        if (amountEl) amountEl.textContent = formatCurrency(target);
        if (barEl) barEl.style.width = `${pct}%`;
        if (inputEl && !inputEl.value)
          inputEl.value = target > 0 ? String(target) : '';
        if (windowEl)
          windowEl.textContent = `ACTUAL ${formatCurrency(actual)} | ${pct}% OF TARGET`;
      });

      const monthlyTarget = toNumber(targetMap.get('MONTHLY'));
      const weeklyTarget = toNumber(targetMap.get('WEEKLY'));
      const quarterlyTarget =
        toNumber(targetMap.get('QUARTERLY')) ||
        (monthlyTarget > 0 ? monthlyTarget * 3 : weeklyTarget * 13);
      const yearlyTarget =
        toNumber(targetMap.get('YEARLY')) ||
        (monthlyTarget > 0 ? monthlyTarget * 12 : weeklyTarget * 52);
      const customTarget = toNumber(customConfig.target_amount);

      const extraTargetMap = {
        QUARTERLY: toNumber(quarterlyTarget),
        YEARLY: toNumber(yearlyTarget),
        CUSTOM: toNumber(customTarget),
      };

      ['QUARTERLY', 'YEARLY', 'CUSTOM'].forEach((period) => {
        const target = toNumber(extraTargetMap[period]);
        const actual = toNumber(extraMetrics[period]);
        const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
        const lower = period.toLowerCase();
        const amountEl = document.getElementById(`goal-${lower}-amount`);
        const barEl = document.getElementById(`goal-${lower}-progress`);
        const windowEl = document.getElementById(`goal-${lower}-window`);

        if (amountEl) amountEl.textContent = formatCurrency(target);
        if (barEl) barEl.style.width = `${pct}%`;
        if (windowEl) {
          if (period === 'QUARTERLY') {
            const qNum = Math.floor(now.getMonth() / 3) + 1;
            windowEl.textContent = `Q${qNum} / ${now.getFullYear()} | ${pct}% OF TARGET`;
          } else if (period === 'YEARLY') {
            windowEl.textContent = `${now.getFullYear()} | ${pct}% OF TARGET`;
          } else {
            const dateOpt = { day: '2-digit', month: 'short' };
            const startText = customStart.toLocaleDateString('en-US', dateOpt);
            const endText = customEnd.toLocaleDateString('en-US', dateOpt);
            const diffDays = Math.max(
              1,
              Math.round((customEnd.getTime() - customStart.getTime()) / 86400000) + 1,
            );
            windowEl.textContent = `${diffDays} DAYS | ${startText} -> ${endText} | ${pct}% OF TARGET`;
          }
        }
        const inputEl = this.getInput(period);
        if (inputEl && !inputEl.value) {
          inputEl.value = target > 0 ? String(target) : '';
        }
      });

      const customInput = document.getElementById('goal-custom-input');
      const customStartInput = document.getElementById('goal-custom-start-input');
      const customEndInput = document.getElementById('goal-custom-end-input');
      if (customInput && !customInput.value) {
        customInput.value = String(customConfig.target_amount);
      }
      if (customStartInput) customStartInput.value = String(customConfig.start_date || '');
      if (customEndInput) customEndInput.value = String(customConfig.end_date || '');
      this.syncCustomRangeDisplay(customConfig.start_date, customConfig.end_date);
      if (this.customRangePicker && typeof this.customRangePicker.setDate === 'function') {
        this.customRangePicker.setDate(
          [customConfig.start_date, customConfig.end_date],
          false,
        );
      }
    },
  };

  window.EquipmentManager = {
    useLocalCache: false,
    items: [],
    currentPage: 1,
    pageSize: 8,

    getListContainer() {
      return document.getElementById('equip-list');
    },

    mapRowToItem(row) {
      return {
        id: row.id || row.equipment_id || row.eq_id || `tmp-${Date.now()}`,
        equipment_code: row.equipment_code || row.code || '',
        name: row.name || 'UNKNOWN EQUIPMENT',
        condition: row.condition || 'GOOD',
        status: row.status || (row.is_active === false ? 'INACTIVE' : 'ACTIVE'),
        image_url: row.image_url || '',
        notes: row.notes || '',
        created_at: row.created_at || null,
      };
    },

    async init() {
      const root = document.querySelector('.equip-wrapper');
      if (!root) return;

      if (root.dataset.boundEquipManager !== '1') {
        root.dataset.boundEquipManager = '1';
        root.addEventListener('click', async (event) => {
          const addBtn = event.target.closest('#equip-add-btn');
          if (addBtn) {
            await this.openEditor();
            return;
          }

          const actionBtn = event.target.closest('[data-equip-action]');
          const pageBtn = event.target.closest('[data-equip-page]');
          if (pageBtn) {
            const nextPage = Number(pageBtn.getAttribute('data-equip-page'));
            if (Number.isFinite(nextPage) && nextPage > 0) {
              this.currentPage = nextPage;
              this.render();
            }
            return;
          }

          if (!actionBtn) return;
          const id = actionBtn.getAttribute('data-equip-id');
          const action = actionBtn.getAttribute('data-equip-action');
          const item = this.items.find(
            (entry) => String(entry.id) === String(id),
          );
          if (!item) return;

          if (action === 'edit') await this.openEditor(item);
          if (action === 'delete') await this.remove(item);
        });
      }

      await this.load();
    },

    loadLocalItems() {
      this.items = readLocalArray(LOCAL_EQUIPMENT_KEY).map((row) =>
        this.mapRowToItem(row),
      );
    },

    saveLocalItems() {
      writeLocalArray(LOCAL_EQUIPMENT_KEY, this.items);
    },

    async load() {
      const container = this.getListContainer();
      if (!container) return;

      const client = await getSupabaseClient();
      if (!client || this.useLocalCache) {
        this.loadLocalItems();
        this.render();
        return;
      }

      const { data, error } = await client
        .from('equipments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          this.useLocalCache = true;
          this.loadLocalItems();
          this.render();
          notify(
            'Equipments table not found. Using local cache mode.',
            'warning',
          );
          return;
        }
        notify(`Failed to load equipments: ${error.message}`, 'error');
        return;
      }

      this.items = (data || []).map((row) => this.mapRowToItem(row));
      this.render();
    },

    render() {
      const container = this.getListContainer();
      if (!container) return;

      if (!this.items.length) {
        container.innerHTML = `
          <div class="equip-card" style="justify-content:center;">
            <div class="equip-sub">NO EQUIPMENT RECORDS YET. TAP + TO ADD.</div>
          </div>
        `;
        return;
      }

      const totalItems = this.items.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize));
      if (this.currentPage > totalPages) this.currentPage = totalPages;
      const start = (this.currentPage - 1) * this.pageSize;
      const pageItems = this.items.slice(start, start + this.pageSize);

      const listHtml = pageItems
        .map((item) => {
          const statusColor =
            String(item.status).toUpperCase() === 'ACTIVE'
              ? '#22c55e'
              : '#f97316';
          return `
            <div class="equip-card">
              <div class="equip-info">
                <div class="equip-thumb">
                  <img src="${escapeHtml(item.image_url || '/assets/images/placeholder.png')}" alt="${escapeHtml(item.name)}" />
                </div>
                <div>
                  <div class="equip-name">${escapeHtml(item.name)}</div>
                  <div class="equip-sub">${escapeHtml(item.equipment_code || 'UNASSIGNED')} - ${escapeHtml(item.condition || 'GOOD')}</div>
                  <div class="equip-status" style="color:${statusColor};">${escapeHtml(item.status || 'ACTIVE')}</div>
                </div>
              </div>
              <div class="equip-actions">
                <i class="bx bx-edit" data-equip-action="edit" data-equip-id="${escapeHtml(item.id)}"></i>
                <i class="bx bx-trash" data-equip-action="delete" data-equip-id="${escapeHtml(item.id)}"></i>
              </div>
            </div>
          `;
        })
        .join('');
    },

    async openEditor(item = null) {
      if (!window.Swal) return;
      const editing = Boolean(item);
      const result = await window.Swal.fire({
        title: editing ? 'EDIT EQUIPMENT' : 'ADD EQUIPMENT',
        background: '#0d0f12',
        color: '#e6ebf5',
        showCancelButton: true,
        confirmButtonText: editing ? 'SAVE CHANGES' : 'ADD EQUIPMENT',
        html: `
          <input id="equip-name" class="swal2-input" placeholder="Equipment Name" value="${escapeHtml(item?.name || '')}">
          <input id="equip-code" class="swal2-input" placeholder="Code (e.g. EQ-101)" value="${escapeHtml(item?.equipment_code || '')}">
          <input id="equip-condition" class="swal2-input" placeholder="Condition (GOOD/NEEDS_SERVICE)" value="${escapeHtml(item?.condition || '')}">
          <input id="equip-status" class="swal2-input" placeholder="Status (ACTIVE/INACTIVE)" value="${escapeHtml(item?.status || 'ACTIVE')}">
          <input id="equip-image" class="swal2-input" placeholder="Image URL (optional)" value="${escapeHtml(item?.image_url || '')}">
          <textarea id="equip-notes" class="swal2-textarea" placeholder="Notes">${escapeHtml(item?.notes || '')}</textarea>
        `,
        preConfirm: () => {
          const name = document.getElementById('equip-name')?.value?.trim();
          if (!name) {
            window.Swal.showValidationMessage('Equipment name is required.');
            return null;
          }
          return {
            name,
            equipment_code:
              document
                .getElementById('equip-code')
                ?.value?.trim()
                .toUpperCase() || null,
            condition:
              document
                .getElementById('equip-condition')
                ?.value?.trim()
                .toUpperCase() || 'GOOD',
            status:
              document
                .getElementById('equip-status')
                ?.value?.trim()
                .toUpperCase() || 'ACTIVE',
            image_url:
              document.getElementById('equip-image')?.value?.trim() || null,
            notes:
              document.getElementById('equip-notes')?.value?.trim() || null,
          };
        },
      });

      if (!result.isConfirmed || !result.value) return;
      if (editing) {
        await this.update(item, result.value);
      } else {
        await this.create(result.value);
      }
    },

    async create(payload) {
      const client = await getSupabaseClient();
      if (!client || this.useLocalCache) {
        this.items.unshift({
          id: `local-eq-${Date.now()}`,
          ...payload,
          created_at: new Date().toISOString(),
        });
        this.saveLocalItems();
        this.render();
        notify('Equipment added (local cache).', 'success');
        return;
      }

      const { data, error } = await client
        .from('equipments')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (isMissingTableError(error)) {
          this.useLocalCache = true;
          await this.create(payload);
          notify('Equipments table missing. Stored locally.', 'warning');
          return;
        }
        notify(`Add equipment failed: ${error.message}`, 'error');
        return;
      }

      this.items.unshift(this.mapRowToItem(data || payload));
      this.render();
      notify('Equipment added.', 'success');
    },

    async update(item, payload) {
      const client = await getSupabaseClient();
      if (!client || this.useLocalCache) {
        this.items = this.items.map((entry) =>
          String(entry.id) === String(item.id)
            ? { ...entry, ...payload }
            : entry,
        );
        this.saveLocalItems();
        this.render();
        notify('Equipment updated (local cache).', 'success');
        return;
      }

      let response = await client
        .from('equipments')
        .update(payload)
        .eq('id', item.id)
        .select('*')
        .maybeSingle();

      if (response.error && isMissingColumnError(response.error)) {
        response = await client
          .from('equipments')
          .update(payload)
          .eq('equipment_id', item.id)
          .select('*')
          .maybeSingle();
      }

      if (response.error) {
        notify(`Update failed: ${response.error.message}`, 'error');
        return;
      }

      this.items = this.items.map((entry) =>
        String(entry.id) === String(item.id)
          ? this.mapRowToItem(response.data || { ...entry, ...payload })
          : entry,
      );
      this.render();
      notify('Equipment updated.', 'success');
    },

    async remove(item) {
      const access = getAccessFlags();
      if (!access.canHardDelete) {
        notify('Only admin can hard delete records.', 'warning');
        return;
      }

      if (!window.Swal) return;
      const { isConfirmed } = await window.Swal.fire({
        title: 'DELETE EQUIPMENT?',
        text: `${item.name} will be removed from the equipment list.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'DELETE',
        background: '#0d0f12',
        color: '#e6ebf5',
      });
      if (!isConfirmed) return;

      const client = await getSupabaseClient();
      if (!client || this.useLocalCache) {
        this.items = this.items.filter(
          (entry) => String(entry.id) !== String(item.id),
        );
        this.saveLocalItems();
        this.render();
        notify('Equipment deleted (local cache).', 'success');
        return;
      }

      let response = await client.from('equipments').delete().eq('id', item.id);
      if (response.error && isMissingColumnError(response.error)) {
        response = await client
          .from('equipments')
          .delete()
          .eq('equipment_id', item.id);
      }
      if (response.error) {
        notify(`Delete failed: ${response.error.message}`, 'error');
        return;
      }

      this.items = this.items.filter(
        (entry) => String(entry.id) !== String(item.id),
      );
      this.render();
      notify('Equipment removed.', 'success');
    },
  };

  window.FeedbackManager = {
    entries: [],
    useLocalCache: false,
    access: getAccessFlags(),
    tagOptionsCache: [],
    tagMetaLookup: new Map(),
    composeOpen: false,
    composeTags: [],
    composeSearchTerm: '',
    composeMessage: '',
    composeLoadingTags: false,
    currentPage: 1,
    pageSize: 6,
    autoDeleteWarned: false,
    expandedEntryIds: new Set(),

    getListContainer() {
      return document.getElementById('feedback-list');
    },

    mapRowToEntry(row) {
      return {
        id: row.id || row.feedback_id || `local-feedback-${Date.now()}`,
        author_name: row.author_name || 'SYSTEM USER',
        author_role: row.author_role || 'STAFF',
        message: row.message || '',
        tagged_assets: Array.isArray(row.tagged_assets)
          ? row.tagged_assets
          : typeof row.tagged_assets === 'string'
            ? row.tagged_assets
                .split(',')
                .map((asset) => asset.trim())
                .filter(Boolean)
            : [],
        is_read: Boolean(row.is_read),
        created_at: row.created_at || new Date().toISOString(),
      };
    },

    async init() {
      const root = document.getElementById('feedback-page');
      if (!root) return;
      this.access = getAccessFlags();

      if (root.dataset.boundFeedbackManager !== '1') {
        root.dataset.boundFeedbackManager = '1';
        root.addEventListener('click', async (event) => {
          if (event.target.closest('#feedback-add-btn')) {
            await this.openComposeInline();
            return;
          }

          if (event.target.closest('[data-feedback-compose-cancel]')) {
            this.closeComposeInline();
            return;
          }

          if (event.target.closest('[data-feedback-compose-submit]')) {
            await this.submitComposeInline();
            return;
          }

          const addTagBtn = event.target.closest('[data-feedback-tag-add]');
          if (addTagBtn) {
            this.addComposeTag(addTagBtn.getAttribute('data-feedback-tag-add'));
            return;
          }

          const toggleBtn = event.target.closest('[data-feedback-toggle-id]');
          if (toggleBtn) {
            const id = String(toggleBtn.getAttribute('data-feedback-toggle-id') || '');
            if (!id) return;
            if (this.expandedEntryIds.has(id)) this.expandedEntryIds.delete(id);
            else this.expandedEntryIds.add(id);
            this.render();
            return;
          }

          const removeTagBtn = event.target.closest('[data-feedback-tag-remove]');
          if (removeTagBtn) {
            this.removeComposeTag(
              removeTagBtn.getAttribute('data-feedback-tag-remove'),
            );
            return;
          }

          const deleteBtn = event.target.closest('[data-feedback-delete-id]');
          if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-feedback-delete-id');
            const entry = this.entries.find(
              (row) => String(row.id) === String(id),
            );
            if (!entry) return;
            await this.remove(entry);
            return;
          }

          const editBtn = event.target.closest('[data-feedback-edit-id]');
          if (editBtn) {
            const id = editBtn.getAttribute('data-feedback-edit-id');
            const entry = this.entries.find(
              (row) => String(row.id) === String(id),
            );
            if (!entry) return;
            await this.editEntry(entry);
            return;
          }

          const pageBtn = event.target.closest('[data-feedback-page]');
          if (pageBtn) {
            const nextPage = Number(pageBtn.getAttribute('data-feedback-page'));
            if (Number.isFinite(nextPage) && nextPage > 0) {
              this.currentPage = nextPage;
              this.render();
            }
            return;
          }

          const markBtn = event.target.closest('[data-feedback-read-id]');
          if (!markBtn) return;
          const id = markBtn.getAttribute('data-feedback-read-id');
          const entry = this.entries.find(
            (row) => String(row.id) === String(id),
          );
          if (!entry) return;
          await this.toggleRead(entry);
        });

        root.addEventListener('input', (event) => {
          if (event.target.id === 'feedback-compose-search') {
            this.composeSearchTerm = event.target.value || '';
            this.refreshComposeUi();
            return;
          }
          if (event.target.id === 'feedback-compose-message') {
            this.composeMessage = event.target.value || '';
          }
        });

        root.addEventListener('keydown', (event) => {
          const summary = event.target.closest('.feedback-row-summary[data-feedback-toggle-id]');
          if (!summary) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          const id = String(summary.getAttribute('data-feedback-toggle-id') || '');
          if (!id) return;
          if (this.expandedEntryIds.has(id)) this.expandedEntryIds.delete(id);
          else this.expandedEntryIds.add(id);
          this.render();
        });
      }

      await this.load();
    },

    loadLocalEntries() {
      this.entries = readLocalArray(LOCAL_FEEDBACK_KEY).map((row) =>
        this.mapRowToEntry(row),
      );
    },

    saveLocalEntries() {
      writeLocalArray(LOCAL_FEEDBACK_KEY, this.entries);
    },

    async load() {
      const container = this.getListContainer();
      if (!container) return;
      this.expandedEntryIds = new Set();

      const client = await getSupabaseClient();
      if (!client || this.useLocalCache) {
        this.loadLocalEntries();
        await this.autoDeleteExpiredReadEntries();
        this.currentPage = 1;
        this.render();
        await this.hydrateTagMetadata();
        this.render();
        return;
      }

      const { data, error } = await client
        .from('feedback_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          this.useLocalCache = true;
          this.loadLocalEntries();
          this.render();
          notify('Feedback table missing. Using local cache mode.', 'warning');
          return;
        }
        notify(`Unable to load feedback: ${error.message}`, 'error');
        return;
      }

      this.entries = (data || []).map((row) => this.mapRowToEntry(row));
      await this.autoDeleteExpiredReadEntries();
      this.currentPage = 1;
      this.render();
      await this.hydrateTagMetadata();
      this.render();
    },

    render() {
      const container = this.getListContainer();
      if (!container) return;
      this.access = getAccessFlags();

      const addBtn = document.getElementById('feedback-add-btn');
      if (addBtn) addBtn.style.display = this.access.isStaff ? '' : 'none';

      const composeCard = this.renderComposeCard();
      const adminNote = this.renderAdminNote();
      const staffNote = this.renderStaffCaution();
      const totalItems = this.entries.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize));
      if (this.currentPage > totalPages) this.currentPage = totalPages;
      const start = (this.currentPage - 1) * this.pageSize;
      const visibleEntries = this.entries.slice(start, start + this.pageSize);

      const listHtml = visibleEntries.length
        ? (() => {
          const unreadEntries = visibleEntries.filter((entry) => !entry.is_read);
          const readEntries = visibleEntries.filter((entry) => entry.is_read);
          return `
            ${this.renderFeedbackSection('Unread', unreadEntries, 'is-unread')}
            ${this.renderFeedbackSection('Read', readEntries, 'is-read')}
          `;
        })()
        : `
          <div class="feedback-empty-state">
            <div class="feedback-empty-hero" aria-hidden="true">
              <i class="bx bxs-badge-check"></i>
            </div>
            <div class="feedback-empty-title">You're all good, no caused troubles so far.</div>
            <div class="feedback-empty-note">
              Guide: Staff can file operational issues by tagging members, products, or equipment.
              Reports are tracked here for admin review and follow-up.
            </div>
          </div>
        `;

      const pagination = this.renderPagination(totalItems, totalPages);
      container.innerHTML = `${composeCard}${adminNote}${staffNote}${listHtml}${pagination}`;
    },

    renderFeedbackSection(title, entries, sectionClass = '') {
      const safeClass = sectionClass ? ` ${sectionClass}` : '';
      const bodyHtml = entries.length
        ? entries.map((entry) => this.renderFeedbackCard(entry)).join('')
        : `<div class="feedback-section-empty">No ${escapeHtml(title.toLowerCase())} feedback on this page.</div>`;
      return `
        <section class="feedback-section${safeClass}">
          <div class="feedback-section-head">
            <h3 class="feedback-section-title">${escapeHtml(title)}</h3>
            <span class="feedback-section-count">${entries.length}</span>
          </div>
          <div class="feedback-section-list">
            ${bodyHtml}
          </div>
        </section>
      `;
    },

    renderFeedbackCard(entry) {
      const entryId = String(entry.id || '');
      const isExpanded = this.expandedEntryIds.has(entryId);
      const tagItems = this.renderTaggedAssets(entry.tagged_assets);
      const readLabel = entry.is_read ? 'MARK UNREAD' : 'MARK READ';
      const readStateLabel = entry.is_read ? 'READ' : 'UNREAD';
      const actionButtons = this.access.isAdmin
        ? `
            <button class="btn-mark-read btn-mark-read-toggle" data-feedback-read-id="${escapeHtml(entry.id)}">${readLabel}</button>
          `
        : this.access.isStaff && !entry.is_read
          ? `
            <button class="btn-mark-read btn-mark-read-edit" data-feedback-edit-id="${escapeHtml(entry.id)}">EDIT</button>
            <button class="btn-mark-read btn-mark-read-delete" data-feedback-delete-id="${escapeHtml(entry.id)}">DELETE</button>
          `
          : '';
      const actionsClass = this.access.isAdmin
        ? 'is-single'
        : this.access.isStaff && !entry.is_read
          ? 'is-double'
          : 'is-none';
      return `
        <div class="feedback-card ${entry.is_read ? 'is-read' : ''} ${isExpanded ? 'is-expanded' : 'is-collapsed'}" data-feedback-id="${escapeHtml(entry.id)}">
          <div class="feedback-row-summary" role="button" tabindex="0" data-feedback-toggle-id="${escapeHtml(entry.id)}" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="${isExpanded ? 'Collapse feedback details' : 'Expand feedback details'}">
            <div class="feedback-row-summary-copy">
              <div class="feedback-row-summary-author">${escapeHtml(entry.author_name)}</div>
              <div class="feedback-row-summary-preview">${escapeHtml(this.getFeedbackPreview(entry.message))}</div>
            </div>
            <div class="feedback-row-summary-tools">
              <span class="feedback-row-status ${entry.is_read ? 'is-read' : 'is-unread'}">${readStateLabel}</span>
              <button type="button" class="feedback-row-toggle" data-feedback-toggle-id="${escapeHtml(entry.id)}" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="${isExpanded ? 'Collapse feedback details' : 'Expand feedback details'}">
                <i class="bx ${isExpanded ? 'bx-chevron-up' : 'bx-chevron-down'}"></i>
              </button>
            </div>
          </div>
          <div class="feedback-card-body">
          <div class="feedback-card-header">
            <div>
              <div class="feedback-author">
                <span class="feedback-author-name">${escapeHtml(entry.author_name)}</span>
                <span class="feedback-author-sep">-</span>
                <span class="feedback-author-role">${escapeHtml(entry.author_role)}</span>
              </div>
              <div class="feedback-meta">${formatDateTime(entry.created_at)}</div>
            </div>
            <div class="feedback-card-actions ${actionsClass}">${actionButtons}</div>
          </div>
          <div class="tagged-label">TAGGED ASSETS</div>
          ${tagItems}
          <div class="feedback-text">"${escapeHtml(entry.message)}"</div>
          </div>
        </div>
      `;
    },

    getFeedbackPreview(message) {
      const value = String(message || '').trim().replace(/\s+/g, ' ');
      if (!value) return 'No feedback details';
      if (value.length <= 54) return value;
      return `${value.slice(0, 51)}...`;
    },

    renderAdminNote() {
      if (!this.access.isAdmin) return '';
      return `
        <div class="feedback-admin-note">
          <div class="feedback-admin-note-title">Admin Note</div>
          <div class="feedback-admin-note-copy">
            Feedback submission is staff-only to preserve operational accountability.
            Admin can only review and mark read/unread. Staff can edit/delete while unread.
          </div>
        </div>
      `;
    },

    renderStaffCaution() {
      if (!this.access.isStaff) return '';
      return `
        <div class="feedback-staff-note">
          <div class="feedback-staff-note-title">Staff Caution</div>
          <div class="feedback-staff-note-copy">
            Write only factual incidents.
            Tag related assets so admins can verify quickly.
            You can edit or delete only while status is UNREAD.
          </div>
        </div>
      `;
    },

    getAutoDeleteCutoffIso() {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return cutoff.toISOString();
    },

    async autoDeleteExpiredReadEntries() {
      const cutoffIso = this.getAutoDeleteCutoffIso();
      const staleCount = this.entries.filter((entry) => {
        if (!entry.is_read || !entry.created_at) return false;
        const time = new Date(entry.created_at).getTime();
        if (!Number.isFinite(time)) return false;
        return time <= new Date(cutoffIso).getTime();
      }).length;

      if (!staleCount) return;

      const client = await getSupabaseClient();
      if (!client || this.useLocalCache) {
        this.entries = this.entries.filter((entry) => {
          if (!entry.is_read || !entry.created_at) return true;
          const time = new Date(entry.created_at).getTime();
          if (!Number.isFinite(time)) return true;
          return time > new Date(cutoffIso).getTime();
        });
        this.saveLocalEntries();
        return;
      }

      const response = await client
        .from('feedback_entries')
        .delete()
        .eq('is_read', true)
        .lt('created_at', cutoffIso);

      if (response.error) {
        if (isPermissionDeniedError(response.error)) {
          if (!this.autoDeleteWarned) {
            notify(
              '30-day auto-delete blocked by RLS. Run docs/sql/feedback_entries_rls_policy.sql.',
              'warning',
            );
            this.autoDeleteWarned = true;
          }
          return;
        }
        return;
      }

      this.entries = this.entries.filter((entry) => {
        if (!entry.is_read || !entry.created_at) return true;
        const time = new Date(entry.created_at).getTime();
        if (!Number.isFinite(time)) return true;
        return time > new Date(cutoffIso).getTime();
      });
    },

    renderPagination(totalItems, totalPages) {
      if (totalItems <= this.pageSize) return '';
      const prevDisabled = this.currentPage <= 1;
      const nextDisabled = this.currentPage >= totalPages;
      return `
        <div class="feedback-pagination">
          <button class="feedback-page-btn" data-feedback-page="${this.currentPage - 1}" ${prevDisabled ? 'disabled' : ''}>
            <i class="bx bx-chevron-left"></i>
          </button>
          <span class="feedback-page-info">Page ${this.currentPage} of ${totalPages}</span>
          <button class="feedback-page-btn" data-feedback-page="${this.currentPage + 1}" ${nextDisabled ? 'disabled' : ''}>
            <i class="bx bx-chevron-right"></i>
          </button>
        </div>
      `;
    },

    async hydrateTagMetadata() {
      const options = await this.loadTagOptions();
      const lookup = new Map();
      (options || []).forEach((option) => {
        const key = this.normalizeTagValue(option.value);
        if (!key) return;
        lookup.set(key, option);
      });
      this.tagMetaLookup = lookup;
    },

    getFallbackTagType(value) {
      const normalized = this.normalizeTagValue(value);
      if (/^PR-/.test(normalized)) return 'PRODUCT';
      if (/^ME-/.test(normalized)) return 'MEMBER';
      if (/^EQ-/.test(normalized)) return 'EQUIPMENT';
      return 'ASSET';
    },

    getTagTypeIcon(type) {
      if (type === 'PRODUCT') return 'bx-package';
      if (type === 'MEMBER') return 'bx-user';
      if (type === 'EQUIPMENT') return 'bx-dumbbell';
      return 'bx-tag';
    },

    resolveTagMetadata(tagValue) {
      const normalized = this.normalizeTagValue(tagValue);
      const found = this.tagMetaLookup.get(normalized);
      if (found) {
        return {
          value: normalized,
          title: found.title || normalized,
          subtitle: found.subtitle || normalized,
          detail: found.detail || '',
          type: found.type || this.getFallbackTagType(normalized),
          image_url: found.image_url || '',
        };
      }

      const fallbackType = this.getFallbackTagType(normalized);
      return {
        value: normalized,
        title: normalized,
        subtitle: `${normalized} - ${fallbackType}`,
        detail: '',
        type: fallbackType,
        image_url: '',
      };
    },

    renderTaggedAssets(taggedAssets = []) {
      const list = Array.isArray(taggedAssets) ? taggedAssets : [];
      if (!list.length) {
        return `<div class="feedback-tag-empty">No tagged assets</div>`;
      }

      return `
        <div class="feedback-tag-list">
          ${list
            .map((tagValue) => {
              const meta = this.resolveTagMetadata(tagValue);
              const media = meta.image_url
                ? `<div class="feedback-tag-media"><img src="${escapeHtml(meta.image_url)}" alt="${escapeHtml(meta.title)}"></div>`
                : `<div class="feedback-tag-media is-icon"><i class="bx ${escapeHtml(this.getTagTypeIcon(meta.type))}" aria-hidden="true"></i></div>`;
              const detail = meta.detail
                ? `<div class="feedback-tag-detail">${escapeHtml(meta.detail)}</div>`
                : '';
              return `
                <div class="feedback-tag-item">
                  ${media}
                  <div class="feedback-tag-copy">
                    <div class="feedback-tag-title">${escapeHtml(meta.title)}</div>
                    <div class="feedback-tag-sub">${escapeHtml(meta.subtitle)}</div>
                    ${detail}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    },

    renderComposeCard() {
      if (!this.access.isStaff) return '';
      if (!this.composeOpen) return '';

      const selectedTags = this.getComposeChipsHtml();
      const optionRows = this.getComposeOptionsHtml();
      const tagLabel = this.getComposeCountLabel();

      return `
        <div class="feedback-compose-card">
          <div class="feedback-compose-head">
            <div>
              <div class="feedback-compose-title">Staff Audit Report</div>
              <div class="feedback-compose-subtitle">Tag assets and submit an official feedback report.</div>
            </div>
            <button type="button" class="feedback-compose-close" data-feedback-compose-cancel aria-label="Close report form">
              <i class="bx bx-x"></i>
            </button>
          </div>

          <div class="feedback-compose-grid">
            <div class="feedback-compose-field">
              <label class="feedback-compose-label" for="feedback-compose-search">Tag Involved Assets</label>
              <div class="feedback-compose-search-wrap">
                <input id="feedback-compose-search" class="feedback-compose-search" placeholder="Search product/member/equipment..." value="${escapeHtml(this.composeSearchTerm)}" />
                <i class="bx bx-search feedback-compose-search-icon" aria-hidden="true"></i>
              </div>
              <div class="feedback-compose-options">${optionRows}</div>
              <div class="feedback-compose-chip-row">${selectedTags}</div>
              <div class="feedback-compose-count">${escapeHtml(tagLabel)}</div>
            </div>

            <div class="feedback-compose-field">
              <label class="feedback-compose-label" for="feedback-compose-message">Report Details</label>
              <textarea id="feedback-compose-message" class="feedback-compose-message" placeholder="Describe the issue or observation...">${escapeHtml(this.composeMessage)}</textarea>
            </div>
          </div>

          <div class="feedback-compose-actions">
            <button type="button" class="feedback-compose-btn feedback-compose-btn-secondary" data-feedback-compose-cancel>Cancel</button>
            <button type="button" class="feedback-compose-btn feedback-compose-btn-primary" data-feedback-compose-submit>
              <i class="bx bxs-send" aria-hidden="true"></i>
              <span>Submit Official Report</span>
            </button>
          </div>
        </div>
      `;
    },

    getComposeCountLabel() {
      if (this.composeLoadingTags) return 'Loading asset suggestions...';
      return `Selected tags: ${this.composeTags.length}/20`;
    },

    getComposeFilteredOptions() {
      const term = this.normalizeTagValue(this.composeSearchTerm);
      return (this.tagOptionsCache || [])
        .filter((option) => {
          if (!term) return true;
          return (
            this.normalizeTagValue(option.value).includes(term) ||
            this.normalizeTagValue(option.title).includes(term) ||
            this.normalizeTagValue(option.subtitle).includes(term) ||
            this.normalizeTagValue(option.detail).includes(term)
          );
        })
        .slice(0, 30);
    },

    getComposeChipsHtml() {
      return this.composeTags
        .map(
          (tag) => `
            <button type="button" class="feedback-compose-chip is-selected" data-feedback-tag-remove="${escapeHtml(tag)}">
              <span>${escapeHtml(this.getComposeChipLabel(tag))}</span>
              <i class="bx bx-x" aria-hidden="true"></i>
            </button>
          `,
        )
        .join('');
    },

    getComposeChipLabel(tagValue) {
      const normalized = this.normalizeTagValue(tagValue);
      const matched = (this.tagOptionsCache || []).find(
        (option) => this.normalizeTagValue(option.value) === normalized,
      );
      return matched?.title || matched?.value || normalized;
    },

    getComposeOptionsHtml() {
      const options = this.getComposeFilteredOptions();
      if (!options.length) {
        return `<div class="feedback-compose-empty">No matching assets found.</div>`;
      }
      return options
        .map((option) => {
          const normalized = this.normalizeTagValue(option.value);
          const isSelected = this.composeTags.includes(normalized);
          const isDisabled = isSelected || this.composeTags.length >= 20;
          const media = option.image_url
            ? `<div class="feedback-compose-option-media"><img src="${escapeHtml(option.image_url)}" alt="${escapeHtml(option.title || option.value)}"></div>`
            : `<div class="feedback-compose-option-media is-icon"><i class="bx ${escapeHtml(option.icon || 'bx-tag')}" aria-hidden="true"></i></div>`;
          const detail = option.detail
            ? `<div class="feedback-compose-option-detail">${escapeHtml(option.detail)}</div>`
            : '';
          return `
            <button type="button" class="feedback-compose-option ${isSelected ? 'is-selected' : ''}" data-feedback-tag-add="${escapeHtml(normalized)}" ${isDisabled ? 'disabled' : ''}>
              ${media}
              <div class="feedback-compose-option-copy">
                <div class="feedback-compose-option-title">${escapeHtml(option.title || option.value)}</div>
                <div class="feedback-compose-option-sub">${escapeHtml(option.subtitle || '')}</div>
                ${detail}
              </div>
              <i class="bx bx-plus feedback-compose-option-icon" aria-hidden="true"></i>
            </button>
          `;
        })
        .join('');

      const pagination =
        totalItems > this.pageSize
          ? `
          <div style="display:flex; justify-content:center; align-items:center; gap:10px; margin-top:10px;">
            <button data-equip-page="${this.currentPage - 1}" ${this.currentPage <= 1 ? 'disabled' : ''} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class="bx bx-chevron-left"></i></button>
            <span style="font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#97a4ba;">Page ${this.currentPage} of ${totalPages}</span>
            <button data-equip-page="${this.currentPage + 1}" ${this.currentPage >= totalPages ? 'disabled' : ''} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class="bx bx-chevron-right"></i></button>
          </div>
        `
          : '';

      container.innerHTML = `${listHtml}${pagination}`;
    },

    refreshComposeUi() {
      if (!this.composeOpen) return;
      const optionsEl = document.querySelector('#feedback-page .feedback-compose-options');
      if (optionsEl) optionsEl.innerHTML = this.getComposeOptionsHtml();

      const chipsEl = document.querySelector('#feedback-page .feedback-compose-chip-row');
      if (chipsEl) chipsEl.innerHTML = this.getComposeChipsHtml();

      const countEl = document.querySelector('#feedback-page .feedback-compose-count');
      if (countEl) countEl.textContent = this.getComposeCountLabel();
    },


    normalizeTagValue(value) {
      return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
    },

    dedupeTagOptions(options = []) {
      const seen = new Set();
      return options.filter((option) => {
        const key = this.normalizeTagValue(option.value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    async loadTagOptions() {
      const client = await getSupabaseClient();
      if (!client) {
        this.tagOptionsCache = [];
        return [];
      }

      const options = [];

      const appendOptions = (rows, mapFn) => {
        (rows || []).forEach((row) => {
          const mapped = mapFn(row);
          if (!mapped || !mapped.value) return;
          options.push(mapped);
        });
      };

      const productsResult = await client
        .from('products')
        .select('productid,sku,name,brand,image_url,is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(500);
      if (productsResult.error && isMissingColumnError(productsResult.error)) {
        const fallback = await client
          .from('products')
          .select('productid,sku,name')
          .order('name', { ascending: true })
          .limit(500);
        appendOptions(fallback.data, (row) => {
          const code = String(row.sku || '').trim().toUpperCase();
          const title = String(row.name || code || 'UNKNOWN PRODUCT').trim();
          return {
            value: code || title,
            title,
            subtitle: `${code || 'N/A'} - PRODUCT`,
            detail: '',
            icon: 'bx-package',
            type: 'PRODUCT',
          };
        });
      } else {
        appendOptions(productsResult.data, (row) => {
          const code = String(row.sku || '').trim().toUpperCase();
          const title = String(row.name || code || 'UNKNOWN PRODUCT').trim();
          const brand = String(row.brand || '').trim();
          return {
            value: code || title,
            title,
            subtitle: `${code || 'N/A'} - PRODUCT`,
            detail: brand ? `Brand: ${brand}` : '',
            image_url: String(row.image_url || '').trim() || null,
            icon: 'bx-package',
            type: 'PRODUCT',
          };
        });
      }

      const membersResult = await client
        .from('members')
        .select('member_id,member_code,sku,full_name,membership_plan,is_active')
        .eq('is_active', true)
        .order('full_name', { ascending: true })
        .limit(500);
      if (membersResult.error && isMissingColumnError(membersResult.error)) {
        const fallback = await client
          .from('members')
          .select('member_id,member_code,sku,full_name')
          .order('full_name', { ascending: true })
          .limit(500);
        appendOptions(fallback.data, (row) => {
          const code = String(row.member_code || row.sku || '').trim();
          const title = String(row.full_name || code || 'UNKNOWN MEMBER').trim();
          return {
            value: code || title,
            title,
            subtitle: `${code || 'N/A'} - MEMBER`,
            detail: '',
            icon: 'bx-user',
            type: 'MEMBER',
          };
        });
      } else {
        appendOptions(membersResult.data, (row) => {
          const code = String(row.member_code || row.sku || '').trim();
          const title = String(row.full_name || code || 'UNKNOWN MEMBER').trim();
          const membershipPlan = String(row.membership_plan || '').trim();
          return {
            value: code || title,
            title,
            subtitle: `${code || 'N/A'} - MEMBER`,
            detail: membershipPlan ? `Subscription: ${membershipPlan}` : '',
            icon: 'bx-user',
            type: 'MEMBER',
          };
        });
      }

      const equipmentsResult = await client
        .from('equipments')
        .select('id,equipment_code,name,image_url,is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(500);
      if (equipmentsResult.error && isMissingColumnError(equipmentsResult.error)) {
        const fallback = await client
          .from('equipments')
          .select('id,equipment_code,name')
          .order('name', { ascending: true })
          .limit(500);
        appendOptions(fallback.data, (row) => {
          const code = String(row.equipment_code || '').trim();
          const title = String(row.name || code || 'UNKNOWN EQUIPMENT').trim();
          return {
            value: code || title,
            title,
            subtitle: `${code || 'N/A'} - EQUIPMENT`,
            detail: '',
            icon: 'bx-dumbbell',
            type: 'EQUIPMENT',
          };
        });
      } else {
        appendOptions(equipmentsResult.data, (row) => {
          const code = String(row.equipment_code || '').trim();
          const title = String(row.name || code || 'UNKNOWN EQUIPMENT').trim();
          return {
            value: code || title,
            title,
            subtitle: `${code || 'N/A'} - EQUIPMENT`,
            detail: '',
            image_url: String(row.image_url || '').trim() || null,
            icon: 'bx-dumbbell',
            type: 'EQUIPMENT',
          };
        });
      }

      this.tagOptionsCache = this.dedupeTagOptions(options);
      return this.tagOptionsCache;
    },

    async resolveAuthorMeta() {
      const client = await getSupabaseClient();
      const roleText = this.access.isAdmin ? 'ADMIN' : 'STAFF';
      if (!client) return { name: 'SYSTEM USER', role: roleText };

      try {
        const { data } = await client.auth.getUser();
        const user = data?.user || null;
        const fallback = String(user?.email || 'SYSTEM USER')
          .trim()
          .toUpperCase();
        const display = String(
          user?.user_metadata?.display_name ||
            user?.user_metadata?.full_name ||
            fallback,
        )
          .trim()
          .toUpperCase();
        return { name: display || fallback, role: roleText };
      } catch (_) {
        return { name: 'SYSTEM USER', role: roleText };
      }
    },
    async openComposeInline() {
      this.access = getAccessFlags();
      if (!this.access.isStaff) {
        notify('Only staff accounts can write feedback.', 'warning');
        return;
      }
      this.composeOpen = true;
      this.composeLoadingTags = true;
      this.render();
      setTimeout(() => {
        const input = document.getElementById('feedback-compose-search');
        if (input) input.focus();
      }, 0);
      this.tagOptionsCache = await this.loadTagOptions();
      this.composeLoadingTags = false;
      this.refreshComposeUi();
    },

    closeComposeInline() {
      this.composeOpen = false;
      this.composeTags = [];
      this.composeSearchTerm = '';
      this.composeMessage = '';
      this.composeLoadingTags = false;
      this.render();
    },

    addComposeTag(tagValue) {
      const normalized = this.normalizeTagValue(tagValue);
      if (!normalized) return;
      if (this.composeTags.includes(normalized)) return;
      if (this.composeTags.length >= 20) {
        notify('Maximum of 20 tags only.', 'warning');
        return;
      }
      this.composeTags.push(normalized);
      this.refreshComposeUi();
    },

    removeComposeTag(tagValue) {
      const normalized = this.normalizeTagValue(tagValue);
      const index = this.composeTags.findIndex((entry) => entry === normalized);
      if (index < 0) return;
      this.composeTags.splice(index, 1);
      this.refreshComposeUi();
    },

    async submitComposeInline() {
      const message = String(this.composeMessage || '').trim();
      if (!message) {
        notify('Report details are required.', 'warning');
        return;
      }
      if (!this.composeTags.length) {
        notify('Add at least one tagged asset.', 'warning');
        return;
      }

      const authorMeta = await this.resolveAuthorMeta();
      await this.create({
        tagged_assets: [...this.composeTags],
        message,
        author_name: authorMeta.name,
        author_role: authorMeta.role,
      });
      this.closeComposeInline();
    },

    async create(payload) {
      this.access = getAccessFlags();
      if (!this.access.isStaff) {
        notify('Only staff accounts can write feedback.', 'warning');
        return;
      }

      const sanitizedTags = Array.from(
        new Set(
          (Array.isArray(payload?.tagged_assets) ? payload.tagged_assets : [])
            .map((entry) => this.normalizeTagValue(entry))
            .filter(Boolean),
        ),
      ).slice(0, 20);

      const client = await getSupabaseClient();
      const row = {
        ...payload,
        tagged_assets: sanitizedTags,
        is_read: false,
      };

      if (!client || this.useLocalCache) {
        this.entries.unshift({
          id: `local-feedback-${Date.now()}`,
          ...row,
          created_at: new Date().toISOString(),
        });
        this.saveLocalEntries();
        this.render();
        notify('Feedback saved locally.', 'success');
        return;
      }

      const { data, error } = await client
        .from('feedback_entries')
        .insert(row)
        .select('*')
        .single();

      if (error) {
        if (isMissingTableError(error)) {
          this.useLocalCache = true;
          await this.create(payload);
          notify('Feedback table missing. Saved locally instead.', 'warning');
          return;
        }
        if (isPermissionDeniedError(error)) {
          notify(
            'Feedback blocked by RLS. Run docs/sql/feedback_entries_rls_policy.sql.',
            'warning',
          );
          return;
        }
        notify(`Failed to save feedback: ${error.message}`, 'error');
        return;
      }

      this.entries.unshift(this.mapRowToEntry(data || row));
      this.render();
      notify('Feedback saved.', 'success');
    },

    async toggleRead(entry) {
      this.access = getAccessFlags();
      if (!this.access.isAdmin) {
        notify('Only admin accounts can mark feedback status.', 'warning');
        return;
      }

      const nextState = !entry.is_read;
      const client = await getSupabaseClient();

      if (!client || this.useLocalCache) {
        this.entries = this.entries.map((row) =>
          String(row.id) === String(entry.id)
            ? { ...row, is_read: nextState }
            : row,
        );
        this.saveLocalEntries();
        this.render();
        return;
      }

      let response = await client
        .from('feedback_entries')
        .update({ is_read: nextState })
        .eq('id', entry.id)
        .select('*')
        .maybeSingle();

      if (response.error && isMissingColumnError(response.error)) {
        response = await client
          .from('feedback_entries')
          .update({ is_read: nextState })
          .eq('feedback_id', entry.id)
          .select('*')
          .maybeSingle();
      }

      if (response.error) {
        notify(
          `Failed to update feedback status: ${response.error.message}`,
          'error',
        );
        return;
      }

      this.entries = this.entries.map((row) =>
        String(row.id) === String(entry.id)
          ? this.mapRowToEntry(response.data || { ...row, is_read: nextState })
          : row,
      );
      this.render();
    },

    async remove(entry) {
      this.access = getAccessFlags();
      if (!this.access.isStaff) {
        notify('Only staff accounts can delete feedback.', 'warning');
        return;
      }
      if (entry.is_read) {
        notify('Read entries are locked and cannot be deleted manually.', 'warning');
        return;
      }
      if (!window.Swal) return;
      const deleteDecision = await window.Swal.fire({
        title: 'DELETE FEEDBACK ENTRY?',
        text: 'Use delete only for miswritten staff reports. This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'DELETE ENTRY',
        background: '#0d0f12',
        color: '#e6ebf5',
      });
      if (!deleteDecision.isConfirmed) return;

      const client = await getSupabaseClient();
      if (!client || this.useLocalCache) {
        this.entries = this.entries.filter(
          (row) => String(row.id) !== String(entry.id),
        );
        this.saveLocalEntries();
        this.render();
        notify('Feedback deleted (local cache).', 'success');
        return;
      }

      let response = await client.from('feedback_entries').delete().eq('id', entry.id);
      if (response.error && isMissingColumnError(response.error)) {
        response = await client
          .from('feedback_entries')
          .delete()
          .eq('feedback_id', entry.id);
      }

      if (response.error) {
        notify(`Failed to delete feedback: ${response.error.message}`, 'error');
        return;
      }

      this.entries = this.entries.filter(
        (row) => String(row.id) !== String(entry.id),
      );
      this.render();
      notify('Feedback deleted.', 'success');
    },

    async editEntry(entry) {
      this.access = getAccessFlags();
      if (!this.access.isStaff) {
        notify('Only staff accounts can edit feedback.', 'warning');
        return;
      }
      if (entry.is_read) {
        notify('Read entries are locked and cannot be edited.', 'warning');
        return;
      }
      if (!window.Swal) return;

      const decision = await window.Swal.fire({
        title: 'EDIT FEEDBACK ENTRY',
        text: 'Use edit only when staff report is miswritten. Keep the original context intact.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'CONTINUE',
        background: '#0d0f12',
        color: '#e6ebf5',
      });
      if (!decision.isConfirmed) return;

      const result = await window.Swal.fire({
        title: 'UPDATE FEEDBACK',
        background: '#0d0f12',
        color: '#e6ebf5',
        showCancelButton: true,
        confirmButtonText: 'SAVE CHANGES',
        html: `
          <textarea id="feedback-edit-message" class="swal2-textarea" style="margin:0; min-height:140px;" placeholder="Update report details...">${escapeHtml(entry.message || '')}</textarea>
        `,
        preConfirm: () => {
          const message = document
            .getElementById('feedback-edit-message')
            ?.value?.trim();
          if (!message) {
            window.Swal.showValidationMessage('Report details are required.');
            return null;
          }
          return { message };
        },
      });
      if (!result.isConfirmed || !result.value) return;

      const client = await getSupabaseClient();
      const payload = { message: result.value.message };

      if (!client || this.useLocalCache) {
        this.entries = this.entries.map((row) =>
          String(row.id) === String(entry.id) ? { ...row, ...payload } : row,
        );
        this.saveLocalEntries();
        this.render();
        notify('Feedback updated (local cache).', 'success');
        return;
      }

      let response = await client
        .from('feedback_entries')
        .update(payload)
        .eq('id', entry.id)
        .select('*')
        .maybeSingle();

      if (response.error && isMissingColumnError(response.error)) {
        response = await client
          .from('feedback_entries')
          .update(payload)
          .eq('feedback_id', entry.id)
          .select('*')
          .maybeSingle();
      }

      if (response.error) {
        notify(`Failed to edit feedback: ${response.error.message}`, 'error');
        return;
      }

      this.entries = this.entries.map((row) =>
        String(row.id) === String(entry.id)
          ? this.mapRowToEntry(response.data || { ...row, ...payload })
          : row,
      );
      this.render();
      notify('Feedback updated.', 'success');
    },
  };

  window.IdMakerManager = {
    members: [],
    selected: null,

    async init() {
      const root = document.querySelector('.id-maker-wrapper');
      if (!root) return;

      if (root.dataset.boundIdMaker !== '1') {
        root.dataset.boundIdMaker = '1';
        root.addEventListener('input', (event) => {
          if (event.target.id === 'id-member-search') {
            this.handleMemberSearch(event.target.value);
            return;
          }
          if (event.target.id === 'id-contact') {
            this.updatePreview({ contact_number: event.target.value.trim() });
            return;
          }
          if (event.target.id === 'id-status') {
            this.updatePreview({
              membership_status: event.target.value.trim().toUpperCase(),
            });
            return;
          }
          if (event.target.id === 'id-tier') {
            this.updatePreview({ membership_plan: event.target.value.trim() });
          }
        });

        root.addEventListener('click', (event) => {
          if (event.target.closest('#id-save-asset-btn')) {
            this.downloadCardPayload();
          }
          if (event.target.closest('#id-print-card-btn')) {
            this.printCard();
          }
        });
      }

      await this.loadMembers();
      this.autoSelectPendingMember();
    },

    async loadMembers() {
      const client = await getSupabaseClient();
      if (!client) return;

      let query = await client
        .from('members')
        .select('*')
        .order('full_name', { ascending: true });

      if (query.error) {
        notify(
          `Unable to load members for ID maker: ${query.error.message}`,
          'error',
        );
        return;
      }

      this.members = (query.data || []).map((row) => ({
        ...row,
        member_code: String(row.member_code || row.sku || row.member_id || '')
          .trim()
          .toUpperCase(),
      }));

      const options = document.getElementById('id-member-options');
      if (options) {
        options.innerHTML = this.members
          .map(
            (member) =>
              `<option value="${escapeHtml(member.full_name)}">${escapeHtml(member.member_code)}</option>`,
          )
          .join('');
      }
    },

    autoSelectPendingMember() {
      const pendingId = window.WOLF_PENDING_MEMBER_ID;
      if (!pendingId) return;
      window.WOLF_PENDING_MEMBER_ID = null;

      const member = this.members.find(
        (row) => String(row.member_id) === String(pendingId),
      );
      if (member) {
        const searchInput = document.getElementById('id-member-search');
        if (searchInput) searchInput.value = member.full_name || '';
        this.selectMember(member);
      }
    },

    handleMemberSearch(value) {
      const term = String(value || '')
        .trim()
        .toLowerCase();
      if (!term) return;

      const selected = this.members.find((member) => {
        return (
          String(member.full_name || '').toLowerCase() === term ||
          String(member.member_code || '').toLowerCase() === term ||
          String(member.email_address || '').toLowerCase() === term
        );
      });

      if (selected) this.selectMember(selected);
    },

    selectMember(member) {
      this.selected = {
        ...member,
        membership_status:
          String(member.membership_status || 'ACTIVE').toUpperCase() ||
          'ACTIVE',
        membership_plan: member.membership_plan || 'STANDARD MEMBERSHIP',
      };

      const contactInput = document.getElementById('id-contact');
      const statusInput = document.getElementById('id-status');
      const tierInput = document.getElementById('id-tier');

      if (contactInput) contactInput.value = member.contact_number || '';
      if (statusInput) statusInput.value = this.selected.membership_status;
      if (tierInput) tierInput.value = this.selected.membership_plan;

      this.updatePreview();
    },

    updatePreview(patch = null) {
      if (!this.selected) return;
      if (patch && typeof patch === 'object') {
        this.selected = { ...this.selected, ...patch };
      }

      const previewName = document.getElementById('id-preview-name');
      const previewCode = document.getElementById('id-preview-code');
      const previewDate = document.getElementById('id-preview-date');
      const previewTier = document.getElementById('id-preview-tier');
      const previewStatus = document.getElementById('id-preview-status');
      const previewBadge = document.getElementById('id-preview-badge');
      const qrImage = document.getElementById('id-preview-qr');

      if (previewName)
        previewName.textContent = this.selected.full_name || 'N/A';
      if (previewCode) {
        previewCode.textContent =
          this.selected.member_code || this.selected.member_id || 'N/A';
      }
      if (previewDate) previewDate.textContent = formatDateOnly(new Date());
      if (previewTier)
        previewTier.textContent = this.selected.membership_plan || 'N/A';
      if (previewStatus) {
        previewStatus.textContent = this.selected.membership_status || 'ACTIVE';
      }
      if (previewBadge) {
        previewBadge.textContent = `${this.selected.membership_status || 'ACTIVE'} STATUS`;
      }
      if (qrImage) {
        const payload = encodeURIComponent(
          `${this.selected.member_code || this.selected.member_id}|${this.selected.full_name || ''}`,
        );
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${payload}`;
      }
    },

    buildCardPayload() {
      if (!this.selected) return null;
      return {
        exported_at: new Date().toISOString(),
        member_id: this.selected.member_id || null,
        member_code: this.selected.member_code || null,
        full_name: this.selected.full_name || '',
        contact_number: this.selected.contact_number || '',
        membership_status: this.selected.membership_status || 'ACTIVE',
        membership_plan: this.selected.membership_plan || '',
      };
    },

    downloadCardPayload() {
      const payload = this.buildCardPayload();
      if (!payload) {
        notify('Select a member first before saving.', 'warning');
        return;
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${payload.member_code || 'member'}-id-card.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      notify('ID payload exported.', 'success');
    },

    printCard() {
      const payload = this.buildCardPayload();
      if (!payload) {
        notify('Select a member first before printing.', 'warning');
        return;
      }

      const qrSrc = document.getElementById('id-preview-qr')?.src || '';
      const printWindow = window.open('', '_blank', 'width=620,height=860');
      if (!printWindow) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>Print ID Card</title>
            <style>
              body { font-family: Arial, sans-serif; background:#0e1014; color:#f4f6f9; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
              .card { width:340px; border-radius:18px; border:1px solid #2c3546; padding:20px; background:linear-gradient(160deg,#0f1218,#141b25); }
              .brand { font-size:20px; font-weight:900; letter-spacing:1px; margin-bottom:14px; }
              .row { margin:8px 0; font-size:13px; }
              .label { color:#8fa2c8; font-size:11px; text-transform:uppercase; letter-spacing:1px; }
              .value { font-weight:700; }
              img { width:160px; height:160px; background:#fff; border-radius:12px; display:block; margin:14px auto; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="brand">WOLF PALOMAR ID</div>
              <div class="row"><span class="label">Name</span><div class="value">${escapeHtml(payload.full_name)}</div></div>
              <div class="row"><span class="label">Member Code</span><div class="value">${escapeHtml(payload.member_code || 'N/A')}</div></div>
              <div class="row"><span class="label">Plan</span><div class="value">${escapeHtml(payload.membership_plan || 'N/A')}</div></div>
              <div class="row"><span class="label">Status</span><div class="value">${escapeHtml(payload.membership_status)}</div></div>
              <img src="${escapeHtml(qrSrc)}" alt="QR code" />
              <div class="row"><span class="label">Generated</span><div class="value">${formatDateOnly(new Date())}</div></div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    },
  };

  window.AuditManager = {
    rows: [],

    async init() {
      const root = document.querySelector('.audit-wrapper');
      if (!root) return;

      const fromInput = document.getElementById('audit-from-date');
      const toInput = document.getElementById('audit-to-date');
      if (fromInput && toInput && !fromInput.value && !toInput.value) {
        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        fromInput.value = sevenDaysAgo.toISOString().slice(0, 10);
        toInput.value = now.toISOString().slice(0, 10);
      }

      if (root.dataset.boundAuditManager !== '1') {
        root.dataset.boundAuditManager = '1';
        root.addEventListener('click', async (event) => {
          if (event.target.closest('#audit-apply-btn')) {
            await this.load();
          }
          if (event.target.closest('#audit-refresh-btn')) {
            await this.load(true);
          }
          if (event.target.closest('#audit-export-btn')) {
            this.exportCsv();
          }
        });
      }

      await this.load();
    },

    async load(forceReload = false) {
      const list = document.getElementById('audit-log-list');
      if (!list) return;
      if (forceReload) this.rows = [];

      const fromInput = document.getElementById('audit-from-date');
      const toInput = document.getElementById('audit-to-date');
      const fromDate = fromInput?.value ? new Date(fromInput.value) : null;
      const toDate = toInput?.value ? new Date(toInput.value) : null;
      if (toDate) toDate.setHours(23, 59, 59, 999);

      const client = await getSupabaseClient();
      if (!client) {
        list.innerHTML = `<div class="audit-row"><div class="audit-row-meta">SUPABASE CLIENT IS NOT READY</div></div>`;
        return;
      }

      const { data, error } = await client
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        list.innerHTML = `<div class="audit-row"><div class="audit-row-meta">FAILED TO LOAD AUDIT LOGS: ${escapeHtml(error.message)}</div></div>`;
        return;
      }

      this.rows = (data || []).filter((row) => {
        const rowDate = parseRowDate(row, [
          'created_at',
          'updated_at',
          'time_in',
        ]);
        if (!rowDate) return false;
        if (fromDate && rowDate < fromDate) return false;
        if (toDate && rowDate > toDate) return false;
        return true;
      });

      this.render();
    },

    render() {
      const list = document.getElementById('audit-log-list');
      const empty = document.getElementById('audit-empty-state');
      if (!list) return;

      if (!this.rows.length) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
      }

      if (empty) empty.style.display = 'none';
      list.innerHTML = this.rows
        .map((row) => {
          const payload = row.change_payload
            ? JSON.stringify(row.change_payload)
            : '{}';
          const payloadShort =
            payload.length > 180 ? `${payload.slice(0, 177)}...` : payload;
          return `
            <div class="audit-row">
              <div class="audit-row-top">
                <span class="audit-op">${escapeHtml(row.operation || 'UNKNOWN')}</span>
                <span class="audit-time">${formatDateTime(row.created_at)}</span>
              </div>
              <div class="audit-row-meta">
                TABLE: ${escapeHtml(row.table_name || 'N/A')} - RECORD: ${escapeHtml(
                  String(row.record_id || 'N/A'),
                )}
              </div>
              <div class="audit-row-meta">
                ACTOR: ${escapeHtml(String(row.changed_by || row.approved_by_email || 'SYSTEM'))}
              </div>
              <div class="audit-row-payload">${escapeHtml(payloadShort)}</div>
            </div>
          `;
        })
        .join('');
    },

    exportCsv() {
      if (!this.rows.length) {
        notify('No audit logs to export.', 'warning');
        return;
      }

      const header = [
        'created_at',
        'table_name',
        'operation',
        'record_id',
        'changed_by',
      ];
      const lines = [header.join(',')];
      this.rows.forEach((row) => {
        lines.push(
          [
            row.created_at || '',
            row.table_name || '',
            row.operation || '',
            row.record_id || '',
            row.changed_by || '',
          ]
            .map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`)
            .join(','),
        );
      });

      const blob = new Blob([lines.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    },
  };

  window.SettingsManager = {
    access: getAccessFlags(),
    managedAccounts: [],
    maxAdmins: 3,
    currentAdmins: 0,
    canCreateAccounts: false,
    canManageAccounts: false,

    async init() {
      const root = document.querySelector('.settings-wrapper');
      if (!root) return;
      this.access = getAccessFlags();
      this.applySavedState();
      await this.hydrateProfile();
      this.applyAccessPolicy();

      if (root.dataset.boundSettingsManager !== '1') {
        root.dataset.boundSettingsManager = '1';

        root.addEventListener('click', async (event) => {
          const tabBtn = event.target.closest('[data-settings-tab-btn]');
          if (tabBtn) {
            this.setActiveTab(tabBtn.getAttribute('data-settings-tab'));
            return;
          }

          const toggle = event.target.closest('[data-setting-toggle]');
          if (toggle) {
            this.toggleSetting(toggle.getAttribute('data-setting-toggle'));
            return;
          }

          if (event.target.closest('#settings-update-btn')) {
            await this.updateAccount();
            return;
          }

          if (event.target.closest('#settings-reset-btn')) {
            await this.resetToDefaults();
            return;
          }

          if (event.target.closest('#settings-logout-btn')) {
            if (typeof window.handleLogout === 'function') window.handleLogout();
            return;
          }

          if (event.target.closest('#settings-export-btn')) {
            await this.exportBackup();
            return;
          }

          if (event.target.closest('#settings-restore-btn')) {
            await this.restoreBackup();
            return;
          }

          if (event.target.closest('#settings-create-user-btn')) {
            await this.createManagedUser();
            return;
          }

          if (event.target.closest('#settings-refresh-users-btn')) {
            await this.loadManagedUsers();
            return;
          }

          const editUserBtn = event.target.closest('[data-settings-user-edit-id]');
          if (editUserBtn) {
            const userId = String(
              editUserBtn.getAttribute('data-settings-user-edit-id') || '',
            );
            const entry = this.managedAccounts.find(
              (row) => String(row.id || '') === userId,
            );
            if (!entry) return;
            await this.editManagedUser(entry);
            return;
          }

          const deleteUserBtn = event.target.closest('[data-settings-user-delete-id]');
          if (deleteUserBtn) {
            const userId = String(
              deleteUserBtn.getAttribute('data-settings-user-delete-id') || '',
            );
            const entry = this.managedAccounts.find(
              (row) => String(row.id || '') === userId,
            );
            if (!entry) return;
            await this.deleteManagedUser(entry);
          }
        });

        root.addEventListener('submit', async (event) => {
          if (event.target.id !== 'settings-create-user-form') return;
          event.preventDefault();
          await this.createManagedUser();
        });

        root.addEventListener('input', (event) => {
          if (event.target.id === 'settings-ui-scale') {
            const value = toNumber(event.target.value);
            this.applyUiScale(value);
            try {
              window.localStorage.setItem(SETTINGS_UI_SCALE_KEY, String(value));
            } catch (_) {
              // ignore local storage failures
            }
          }
        });
      }

      if (this.access.isAdmin) {
        await this.loadManagedUsers();
      }

      try {
        const requestedTab = String(
          window.localStorage.getItem('wolf_settings_open_tab') || '',
        )
          .trim()
          .toLowerCase();
        if (requestedTab) {
          this.setActiveTab(requestedTab);
          window.localStorage.removeItem('wolf_settings_open_tab');
        }
      } catch (_) {
        // ignore local storage failures
      }
    },

    applySavedState() {
      const actionMuted =
        String(
          window.localStorage.getItem(SETTINGS_ACTION_SOUNDS_KEY) || 'false',
        ) === 'true';
      const victoryVisuals =
        String(
          window.localStorage.getItem(SETTINGS_VICTORY_VISUALS_KEY) || 'true',
        ) !== 'false';
      const uiScale = toNumber(
        window.localStorage.getItem(SETTINGS_UI_SCALE_KEY) || 100,
      );

      this.setToggleState('action-sounds', !actionMuted);
      this.setToggleState('victory-visuals', victoryVisuals);
      const normalizedScale = this.applyUiScale(uiScale || 100);

      const scaleInput = document.getElementById('settings-ui-scale');
      if (scaleInput) scaleInput.value = String(normalizedScale);
    },

    async hydrateProfile() {
      const client = await getSupabaseClient();
      const profileNameEl = document.getElementById('settings-profile-name');
      const profileRoleEl = document.getElementById('settings-profile-role');
      const profileEmailEl = document.getElementById('settings-profile-email');
      const displayInput = document.getElementById('settings-display-name');

      let email = this.access.email || '';
      let displayName = window.localStorage.getItem(SETTINGS_DISPLAY_NAME_KEY) || '';

      if (client) {
        const { data } = await client.auth.getUser();
        const user = data?.user || null;
        if (user?.email) email = normalizeRoleEmail(user.email);

        if (!displayName) {
          displayName = String(
            user?.user_metadata?.display_name ||
              user?.user_metadata?.full_name ||
              '',
          ).trim();
        }
      }

      if (!displayName) {
        displayName = email ? email.split('@')[0] : 'Wolf User';
      }

      this.access = getAccessFlags();
      const roleText = this.access.isSuperAdmin
        ? 'SUPERADMIN'
        : this.access.isAdmin
          ? 'ADMIN'
          : this.access.isStaff
            ? 'STAFF'
            : 'UNAUTHORIZED';

      if (profileNameEl) profileNameEl.textContent = String(displayName).toUpperCase();
      if (profileRoleEl) profileRoleEl.textContent = roleText;
      if (profileEmailEl) profileEmailEl.textContent = email || 'N/A';
      if (displayInput) displayInput.value = displayName;
      if (email) window.localStorage.setItem(SETTINGS_DISPLAY_NAME_KEY, displayName);

      const sidebarName = document.querySelector('#wolfSidebar .user-name');
      const sidebarEmail = document.querySelector('#wolfSidebar .user-email');
      if (sidebarName) sidebarName.textContent = String(displayName).toUpperCase();
      if (sidebarEmail && email) sidebarEmail.textContent = email;
    },

    applyAccessPolicy() {
      this.access = getAccessFlags();
      const root = document.querySelector('.settings-wrapper');
      const tabs = document.getElementById('settings-tabs');
      const usersTabBtn = document.querySelector('[data-settings-tab="users"]');
      const usersPanel = document.querySelector('[data-settings-tab-panel="users"]');
      const maintenanceCard = document.getElementById('settings-maintenance-card');
      const superadminNote = document.getElementById('settings-superadmin-note');
      const usersPermission = document.getElementById('settings-users-permission');
      const adminLimitNote = document.getElementById('settings-admin-limit-note');

      if (!this.access.isAdmin) {
        if (root) root.classList.add('settings-single-column');
        if (tabs) tabs.style.display = 'none';
        if (usersTabBtn) usersTabBtn.style.display = 'none';
        if (usersPanel) usersPanel.classList.remove('is-active');
        this.setActiveTab('personalize');
      } else {
        if (root) root.classList.remove('settings-single-column');
        if (tabs) tabs.style.display = '';
        if (usersTabBtn) usersTabBtn.style.display = '';
      }

      if (maintenanceCard) {
        maintenanceCard.style.display = this.access.isStaff ? 'none' : '';
      }

      this.canCreateAccounts = Boolean(this.access.isSuperAdmin);
      this.canManageAccounts = Boolean(this.access.isSuperAdmin);
      this.setCreateControlsEnabled(this.canCreateAccounts);

      if (superadminNote) superadminNote.hidden = this.canCreateAccounts;
      if (usersPermission) {
        usersPermission.textContent = this.canCreateAccounts
          ? `You are superadmin (${SUPERADMIN_EMAIL}). You can create, edit, and delete admin/staff accounts.`
          : `Only superadmin (${SUPERADMIN_EMAIL}) can create, edit, or delete accounts.`;
      }
      if (adminLimitNote) {
        adminLimitNote.textContent =
          `ADMIN LIMIT: UP TO ${this.maxAdmins} ADMIN ACCOUNTS ONLY (INCLUDING SUPERADMIN).`;
      }
    },

    setActiveTab(tabName = 'personalize') {
      const normalized = String(tabName || 'personalize').toLowerCase();
      document.querySelectorAll('[data-settings-tab-btn]').forEach((button) => {
        const isActive =
          String(button.getAttribute('data-settings-tab') || '') === normalized;
        button.classList.toggle('is-active', isActive);
      });

      document.querySelectorAll('[data-settings-tab-panel]').forEach((panel) => {
        const isActive =
          String(panel.getAttribute('data-settings-tab-panel') || '') === normalized;
        panel.classList.toggle('is-active', isActive);
      });
    },

    setCreateControlsEnabled(enabled) {
      const createBtn = document.getElementById('settings-create-user-btn');
      if (createBtn) createBtn.disabled = !enabled;

      document
        .querySelectorAll(
          '#settings-create-user-form input, #settings-create-user-form select',
        )
        .forEach((input) => {
          input.disabled = !enabled;
        });
    },

    setToggleState(key, enabled) {
      const toggle = document.querySelector(`[data-setting-toggle="${key}"]`);
      if (!toggle) return;
      toggle.classList.toggle('active', Boolean(enabled));
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    },

    toggleSetting(key) {
      if (!key) return;
      const toggle = document.querySelector(`[data-setting-toggle="${key}"]`);
      if (!toggle) return;
      const nextEnabled = !toggle.classList.contains('active');

      if (key === 'action-sounds') {
        window.localStorage.setItem(
          SETTINGS_ACTION_SOUNDS_KEY,
          nextEnabled ? 'false' : 'true',
        );
        notify(
          nextEnabled ? 'Action sounds enabled.' : 'Action sounds muted.',
          'success',
        );
      } else if (key === 'victory-visuals') {
        window.localStorage.setItem(
          SETTINGS_VICTORY_VISUALS_KEY,
          nextEnabled ? 'true' : 'false',
        );
        notify(
          nextEnabled
            ? 'Victory visuals enabled.'
            : 'Victory visuals disabled.',
          'success',
        );
      }

      this.setToggleState(key, nextEnabled);
    },

    applyUiScale(percent) {
      const normalized = Math.min(150, Math.max(50, toNumber(percent) || 100));
      const scale = normalized / 100;
      document.documentElement.style.fontSize = `${(16 * scale).toFixed(2)}px`;
      document.documentElement.style.setProperty('--wolf-ui-scale-factor', String(scale));
      const valueLabel = document.getElementById('settings-ui-scale-value');
      if (valueLabel) valueLabel.textContent = `${normalized}%`;
      return normalized;
    },

    async resetToDefaults() {
      const proceed = await confirmAction({
        title: 'Reset settings to defaults?',
        text:
          'This will reset action sounds, victory visuals, and interface scale to default values.',
        confirmButtonText: 'Reset',
        cancelButtonText: 'Cancel',
        icon: 'warning',
      });
      if (!proceed) return;

      try {
        window.localStorage.setItem(SETTINGS_ACTION_SOUNDS_KEY, 'false');
        window.localStorage.setItem(SETTINGS_VICTORY_VISUALS_KEY, 'true');
        window.localStorage.setItem(SETTINGS_UI_SCALE_KEY, '100');
      } catch (_) {
        // ignore local storage failures
      }

      this.setToggleState('action-sounds', true);
      this.setToggleState('victory-visuals', true);
      const normalizedScale = this.applyUiScale(100);
      const scaleInput = document.getElementById('settings-ui-scale');
      if (scaleInput) scaleInput.value = String(normalizedScale);

      notify('Settings restored to defaults.', 'success');
    },

    async updateAccount() {
      const displayName =
        document.getElementById('settings-display-name')?.value?.trim() ||
        'Wolf User';
      const newPassword =
        document.getElementById('settings-new-password')?.value?.trim() || '';

      window.localStorage.setItem(SETTINGS_DISPLAY_NAME_KEY, displayName);
      const profileName = document.getElementById('settings-profile-name');
      if (profileName) profileName.textContent = displayName.toUpperCase();

      const sidebarName = document.querySelector('#wolfSidebar .user-name');
      if (sidebarName) sidebarName.textContent = displayName.toUpperCase();

      const client = await getSupabaseClient();
      if (!client) {
        notify('Display name saved locally.', 'success');
        return;
      }

      const updatePayload = {
        data: { display_name: displayName, full_name: displayName },
      };
      if (newPassword) updatePayload.password = newPassword;

      const { error } = await client.auth.updateUser(updatePayload);
      if (error) {
        notify(`Account update partially failed: ${error.message}`, 'warning');
      } else {
        notify('Account settings updated.', 'success');
        const passwordInput = document.getElementById('settings-new-password');
        if (passwordInput) passwordInput.value = '';
      }
    },

    async getAccessToken() {
      const client = await getSupabaseClient();
      if (!client) return '';
      const {
        data: { session },
      } = await client.auth.getSession();
      return String(session?.access_token || '');
    },

    async callUserAccountsApi(action, payload = {}) {
      const accessToken = await this.getAccessToken();
      if (!accessToken) throw new Error('No active session token found.');

      const res = await fetch('/.netlify/functions/manage-user-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action, ...payload }),
      });

      let json = {};
      try {
        json = await res.json();
      } catch (_) {
        json = {};
      }

      if (!res.ok) {
        throw new Error(String(json.error || 'User account request failed.'));
      }

      return json;
    },

    updateAdminCountChip() {
      const chip = document.getElementById('settings-admin-count-chip');
      if (!chip) return;
      chip.textContent = `Admins: ${this.currentAdmins}/${this.maxAdmins}`;
    },

    renderManagedUsers() {
      const list = document.getElementById('settings-users-list');
      const empty = document.getElementById('settings-users-empty');
      if (!list) return;

      if (!this.managedAccounts.length) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }

      if (empty) empty.style.display = 'none';
      list.innerHTML = this.managedAccounts
        .map((entry) => {
          const roleClass = entry.role === 'admin' ? 'admin' : 'staff';
          const roleLabel = entry.isSuperAdmin
            ? 'SUPERADMIN'
            : String(entry.role || '').toUpperCase();
          const email = normalizeRoleEmail(entry.email || '');
          const isFixed =
            entry.isSuperAdmin ||
            FIXED_ADMIN_EMAILS.has(email) ||
            FIXED_STAFF_EMAILS.has(email);
          const createdAt = formatDateTime(entry.createdAt);
          const lastSignIn = entry.lastSignInAt
            ? formatDateTime(entry.lastSignInAt)
            : 'Never';
          const canManageRow = this.canManageAccounts && !isFixed;
          const actionHtml = canManageRow
            ? `
                <div class="settings-user-actions">
                  <button type="button" class="settings-user-action-btn" data-settings-user-edit-id="${escapeHtml(entry.id || '')}">Edit</button>
                  <button type="button" class="settings-user-action-btn danger" data-settings-user-delete-id="${escapeHtml(entry.id || '')}">Delete</button>
                </div>
              `
            : this.canManageAccounts
              ? `<div class="settings-user-lock-note">Fixed system account</div>`
              : '';

          return `
            <div class="settings-user-row">
              <div class="settings-user-top">
                <div class="settings-user-email">${escapeHtml(entry.email || 'N/A')}</div>
                <div class="settings-role-badge ${roleClass}">${escapeHtml(roleLabel)}</div>
              </div>
              <div class="settings-user-meta">Created: ${escapeHtml(createdAt)}</div>
              <div class="settings-user-meta">Last sign-in: ${escapeHtml(lastSignIn)}</div>
              ${actionHtml}
            </div>
          `;
        })
        .join('');
    },

    async loadManagedUsers() {
      this.access = getAccessFlags();
      this.applyAccessPolicy();
      if (!this.access.isAdmin) return;

      try {
        const payload = await this.callUserAccountsApi('list');
        this.managedAccounts = Array.isArray(payload.accounts)
          ? payload.accounts
          : [];
        this.currentAdmins = toNumber(payload?.limits?.currentAdmins);
        this.maxAdmins = Math.max(1, toNumber(payload?.limits?.maxAdmins) || 3);
        this.canCreateAccounts = Boolean(payload?.permissions?.canCreateAccounts);
        this.canManageAccounts = Boolean(
          payload?.permissions?.canManageAccounts ??
            payload?.permissions?.canCreateAccounts,
        );
        this.updateAdminCountChip();
        this.setCreateControlsEnabled(this.canCreateAccounts);
        this.applyAccessPolicy();
        this.renderManagedUsers();
      } catch (err) {
        this.managedAccounts = [];
        this.renderManagedUsers();
        notify(`Unable to load managed users: ${err.message}`, 'error');
      }
    },

    async createManagedUser() {
      this.access = getAccessFlags();
      if (!this.access.isSuperAdmin) {
        notify('Only superadmin can create new accounts.', 'warning');
        return;
      }

      const createBtn = document.getElementById('settings-create-user-btn');
      const email = normalizeRoleEmail(
        document.getElementById('settings-create-email')?.value,
      );
      const role = String(
        document.getElementById('settings-create-role')?.value || 'staff',
      )
        .trim()
        .toLowerCase();
      const displayName = String(
        document.getElementById('settings-create-display-name')?.value || '',
      ).trim();
      const password = String(
        document.getElementById('settings-create-password')?.value || '',
      ).trim();

      if (!email) {
        notify('Email is required.', 'warning');
        return;
      }

      if (createBtn) createBtn.disabled = true;
      try {
        const payload = await this.callUserAccountsApi('create', {
          email,
          role,
          displayName,
          password,
        });

        const usedDefaultPassword = Boolean(payload?.defaults?.usedDefaultPassword);
        notify(
          usedDefaultPassword
            ? 'Account created with default password 12345.'
            : 'Account created successfully.',
          'success',
        );

        const form = document.getElementById('settings-create-user-form');
        if (form) form.reset();
        const roleSelect = document.getElementById('settings-create-role');
        if (roleSelect) roleSelect.value = 'staff';
        await this.loadManagedUsers();
      } catch (err) {
        notify(`Create account failed: ${err.message}`, 'error');
      } finally {
        if (createBtn) createBtn.disabled = false;
      }
    },

    async editManagedUser(entry) {
      this.access = getAccessFlags();
      if (!this.access.isSuperAdmin) {
        notify('Only superadmin can edit accounts.', 'warning');
        return;
      }
      if (!entry?.id) {
        notify('Invalid account selected.', 'error');
        return;
      }

      const currentRole = String(entry.role || 'staff').toLowerCase();
      const currentDisplayName = String(entry.displayName || '').trim();

      let nextDisplayName = currentDisplayName;
      let nextRole = currentRole === 'admin' ? 'admin' : 'staff';
      let nextPassword = '';

      if (window.Swal) {
        const result = await window.Swal.fire({
          title: 'Edit Account',
          html: `
            <div style="display:grid; gap:10px; text-align:left;">
              <label style="font-size:11px; font-weight:800; letter-spacing:0.7px; text-transform:uppercase; color:#b9c5db;">Display Name</label>
              <input id="settings-edit-display-name" class="swal2-input" value="${escapeHtml(currentDisplayName)}" placeholder="Optional display name" style="margin:0;" />
              <label style="font-size:11px; font-weight:800; letter-spacing:0.7px; text-transform:uppercase; color:#b9c5db;">Role</label>
              <select id="settings-edit-role" class="swal2-select" style="margin:0;">
                <option value="staff" ${nextRole === 'staff' ? 'selected' : ''}>Staff</option>
                <option value="admin" ${nextRole === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
              <label style="font-size:11px; font-weight:800; letter-spacing:0.7px; text-transform:uppercase; color:#b9c5db;">Reset Password (Optional)</label>
              <input id="settings-edit-password" type="password" class="swal2-input" placeholder="Leave blank to keep current password" style="margin:0;" />
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Save',
          cancelButtonText: 'Cancel',
          preConfirm: () => {
            const displayNameValue = String(
              document.getElementById('settings-edit-display-name')?.value || '',
            ).trim();
            const roleValue = String(
              document.getElementById('settings-edit-role')?.value || '',
            )
              .trim()
              .toLowerCase();
            const passwordValue = String(
              document.getElementById('settings-edit-password')?.value || '',
            ).trim();
            if (roleValue !== 'admin' && roleValue !== 'staff') {
              window.Swal.showValidationMessage('Role must be admin or staff');
              return null;
            }
            return {
              displayName: displayNameValue,
              role: roleValue,
              password: passwordValue,
            };
          },
        });

        if (!result.isConfirmed || !result.value) return;
        nextDisplayName = String(result.value.displayName || '').trim();
        nextRole = String(result.value.role || '').trim().toLowerCase();
        nextPassword = String(result.value.password || '').trim();
      } else {
        const rolePrompt = window.prompt(
          `Role for ${entry.email} (admin/staff):`,
          nextRole,
        );
        if (rolePrompt === null) return;
        nextRole = String(rolePrompt || '').trim().toLowerCase();
        if (nextRole !== 'admin' && nextRole !== 'staff') {
          notify('Role must be admin or staff.', 'warning');
          return;
        }
        const displayPrompt = window.prompt(
          `Display name for ${entry.email}:`,
          currentDisplayName,
        );
        if (displayPrompt === null) return;
        nextDisplayName = String(displayPrompt || '').trim();
      }

      try {
        await this.callUserAccountsApi('update', {
          userId: entry.id,
          role: nextRole,
          displayName: nextDisplayName,
          password: nextPassword,
        });
        notify('Account updated successfully.', 'success');
        await this.loadManagedUsers();
      } catch (err) {
        notify(`Update account failed: ${err.message}`, 'error');
      }
    },

    async deleteManagedUser(entry) {
      this.access = getAccessFlags();
      if (!this.access.isSuperAdmin) {
        notify('Only superadmin can delete accounts.', 'warning');
        return;
      }
      if (!entry?.id) {
        notify('Invalid account selected.', 'error');
        return;
      }

      let confirmed = false;
      if (window.Swal) {
        const result = await window.Swal.fire({
          title: 'Delete Account?',
          html: `<div style="font-size:13px; color:#dbe4f4;">This will permanently delete <b>${escapeHtml(entry.email || 'account')}</b>.</div>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#b91c1c',
        });
        confirmed = Boolean(result.isConfirmed);
      } else {
        confirmed = window.confirm(
          `Delete account ${entry.email}? This action cannot be undone.`,
        );
      }
      if (!confirmed) return;

      try {
        await this.callUserAccountsApi('delete', {
          userId: entry.id,
        });
        notify('Account deleted successfully.', 'success');
        await this.loadManagedUsers();
      } catch (err) {
        notify(`Delete account failed: ${err.message}`, 'error');
      }
    },

    async exportBackup() {
      this.access = getAccessFlags();
      if (!this.access.isAdmin) {
        notify('Only admin accounts can export backups.', 'warning');
        return;
      }

      const client = await getSupabaseClient();
      if (!client) {
        notify('Supabase is not ready for export.', 'error');
        return;
      }

      const tables = [
        'members',
        'products',
        'sales',
        'check_in_logs',
        'goal_target',
        'equipments',
        'feedback_entries',
        'audit_log',
      ];

      const backup = {
        created_at: new Date().toISOString(),
        version: 'wolf-backup-1',
        tables: {},
        errors: {},
      };

      for (const table of tables) {
        const { data, error } = await client
          .from(table)
          .select('*')
          .limit(2000);
        if (error) {
          backup.errors[table] = error.message;
          continue;
        }
        backup.tables[table] = data || [];
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `wolf-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      notify('Backup exported.', 'success');
    },

    async restoreBackup() {
      this.access = getAccessFlags();
      if (!this.access.isAdmin) {
        notify('Only admin accounts can restore backups.', 'warning');
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        const text = await file.text();
        let payload;
        try {
          payload = JSON.parse(text);
        } catch (_) {
          notify('Invalid backup file format.', 'error');
          return;
        }

        const tables =
          payload?.tables && typeof payload.tables === 'object'
            ? payload.tables
            : payload;

        if (!tables || typeof tables !== 'object') {
          notify('Backup file has no table payload.', 'error');
          return;
        }

        const client = await getSupabaseClient();
        if (!client) {
          notify('Supabase is not ready for restore.', 'error');
          return;
        }

        const primaryKeys = {
          members: 'member_id',
          products: 'productid',
          sales: 'id',
          check_in_logs: 'id',
          goal_target: 'id',
          equipments: 'id',
          feedback_entries: 'id',
          audit_log: 'id',
        };

        let restoredRows = 0;
        let failedTables = 0;

        for (const [tableName, rows] of Object.entries(tables)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;

          const primaryKey = primaryKeys[tableName] || 'id';
          const { error } = await client
            .from(tableName)
            .upsert(rows, { onConflict: primaryKey });

          if (error) {
            failedTables += 1;
            continue;
          }
          restoredRows += rows.length;
        }

        notify(
          `Restore complete. Rows merged: ${restoredRows}. Failed tables: ${failedTables}.`,
          failedTables > 0 ? 'warning' : 'success',
        );
      };

      input.click();
    },
  };
})();



