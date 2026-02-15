(function initWolfSystemToolsManagers() {
  if (window.__wolfSystemToolsManagersBooted) return;
  window.__wolfSystemToolsManagersBooted = true;

  const LOCAL_EQUIPMENT_KEY = 'wolf_local_equipments';
  const LOCAL_FEEDBACK_KEY = 'wolf_local_feedback_entries';
  const LOCAL_GOAL_KEY = 'wolf_local_goal_targets';
  const LOCAL_GOAL_CUSTOM_KEY = 'wolf_local_goal_custom_config';
  const LOCAL_DASH_BUSY_HOUR_KEY = 'wolf_dashboard_busiest_hour_tracker';
  const LOGBOOK_REVENUE_COLUMN_CANDIDATES = [
    'id,entry_fee,paid_amount,is_paid,notes,time_in,time_out,profile_id,created_at',
    'id,entry_fee,paid_amount,is_paid,paid_at,notes,time_in,time_out,profile_id,created_at',
    'id,entry_fee,paid_amount,is_paid,time_in,created_at',
    'id,entry_fee,time_in,created_at',
  ];
  let resolvedLogbookRevenueColumns = LOGBOOK_REVENUE_COLUMN_CANDIDATES[0];
  const LOGBOOK_DASHBOARD_COLUMN_CANDIDATES = [
    'id,entry_fee,paid_amount,is_paid,notes,time_in,time_out,profile_id,created_at',
    'id,entry_fee,paid_amount,is_paid,time_in,time_out,profile_id,created_at',
    'id,entry_fee,paid_amount,is_paid,time_in,created_at',
    'id,entry_fee,time_in,created_at',
  ];
  let resolvedDashboardLogbookColumns = LOGBOOK_DASHBOARD_COLUMN_CANDIDATES[0];
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

  function toManilaDateKey(dateLike) {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value || '1970';
    const month = parts.find((p) => p.type === 'month')?.value || '01';
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
  }

  function getManilaRangeStart(dateLike) {
    const key = toManilaDateKey(dateLike);
    return new Date(`${key}T00:00:00+08:00`);
  }

  function getManilaRangeEnd(dateLike) {
    const start = getManilaRangeStart(dateLike);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000);
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
    const parseAmountFromNotes = (notesValue) => {
      const notes = String(notesValue || '');
      if (!notes) return 0;
      const explicit =
        notes.match(/\bPAID:([0-9]+(?:\.[0-9]+)?)/i) ||
        notes.match(/\bPAID_AMOUNT:([0-9]+(?:\.[0-9]+)?)/i) ||
        notes.match(/\bAMOUNT:([0-9]+(?:\.[0-9]+)?)/i) ||
        notes.match(/\bENTRY_FEE:([0-9]+(?:\.[0-9]+)?)/i);
      if (explicit && explicit[1]) return toNumber(explicit[1]);
      return 0;
    };

    return (rows || []).reduce((sum, row) => {
      const paid = toNumber(row.paid_amount);
      if (paid > 0) return sum + paid;

      const fee = toNumber(row.entry_fee);
      const notesAmount = parseAmountFromNotes(row?.notes);
      const baseAmount = fee > 0 ? fee : notesAmount;
      if (baseAmount <= 0) return sum;

      const notes = String(row?.notes || '');
      const paidByNotes =
        /\bPAID:(YES|TRUE|1)\b/i.test(notes) ||
        /\bPAID:[0-9]+(?:\.[0-9]+)?\b/i.test(notes);
      const paidByTimestamp = Boolean(row?.paid_at);

      if (row.is_paid === true || paidByNotes || paidByTimestamp) {
        return sum + baseAmount;
      }

      // Respect explicit unpaid rows.
      if (row.is_paid === false) {
        return sum;
      }

      // Legacy fallback: only when paid flag column is missing/null.
      if (row.is_paid == null) {
        return sum + baseAmount;
      }

      return sum;
    }, 0);
  }

  async function fetchRevenueSnapshot(
    client,
    startDate,
    endDate,
    options = {},
  ) {
    const includeRows = Boolean(options?.includeRows);
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const salesResult = await fetchRowsByDateRange(
      client,
      'sales',
      'id,product_id,total_amount,qty,unit_price,created_at',
      startIso,
      endIso,
      ['created_at'],
    );
    const logbookColumnCandidates = [
      resolvedLogbookRevenueColumns,
      ...LOGBOOK_REVENUE_COLUMN_CANDIDATES.filter(
        (columns) => columns !== resolvedLogbookRevenueColumns,
      ),
    ];
    let logbookResult = { data: [], error: null };
    for (const columns of logbookColumnCandidates) {
      const attempt = await fetchRowsByDateRange(
        client,
        'check_in_logs',
        columns,
        startIso,
        endIso,
        ['time_in', 'created_at'],
      );
      if (!attempt.error) {
        logbookResult = attempt;
        resolvedLogbookRevenueColumns = columns;
        break;
      }
      if (!isMissingColumnError(attempt.error)) {
        logbookResult = attempt;
        break;
      }
    }

    const salesRows = salesResult.data || [];
    const logbookRows = logbookResult.data || [];
    const response = {
      salesAmount: computeSalesAmount(salesResult.data),
      logbookAmount: computeLogbookRevenue(logbookResult.data),
      salesCount: salesRows.length,
      trafficCount: logbookRows.length,
      salesError: salesResult.error,
      logbookError: logbookResult.error,
    };
    if (includeRows) {
      response.salesRows = salesRows;
      response.logbookRows = logbookRows;
    }
    return response;
  }

  function filterRowsByDateRange(rows, startDate, endDate, dateColumns) {
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();
    if (
      !Number.isFinite(startTs) ||
      !Number.isFinite(endTs) ||
      endTs <= startTs
    ) {
      return [];
    }
    return (rows || []).filter((row) => {
      const parsed = parseRowDate(row, dateColumns);
      if (!parsed) return false;
      const ts = parsed.getTime();
      return ts >= startTs && ts < endTs;
    });
  }

  function buildRevenueSnapshotFromRows(
    salesRows,
    logbookRows,
    startDate,
    endDate,
    options = {},
  ) {
    const includeRows = Boolean(options?.includeRows);
    const scopedSalesRows = filterRowsByDateRange(
      salesRows,
      startDate,
      endDate,
      ['created_at'],
    );
    const scopedLogbookRows = filterRowsByDateRange(
      logbookRows,
      startDate,
      endDate,
      ['time_in', 'created_at'],
    );
    const response = {
      salesAmount: computeSalesAmount(scopedSalesRows),
      logbookAmount: computeLogbookRevenue(scopedLogbookRows),
      salesCount: scopedSalesRows.length,
      trafficCount: scopedLogbookRows.length,
      salesError: null,
      logbookError: null,
    };
    if (includeRows) {
      response.salesRows = scopedSalesRows;
      response.logbookRows = scopedLogbookRows;
    }
    return response;
  }

  async function fetchDashboardLogbookRows(client, startIso, endIso) {
    const candidates = [
      resolvedDashboardLogbookColumns,
      ...LOGBOOK_DASHBOARD_COLUMN_CANDIDATES.filter(
        (columns) => columns !== resolvedDashboardLogbookColumns,
      ),
    ];
    let fallback = { data: [], error: null };
    for (const columns of candidates) {
      const attempt = await fetchRowsByDateRange(
        client,
        'check_in_logs',
        columns,
        startIso,
        endIso,
        ['time_in', 'created_at'],
      );
      if (!attempt.error) {
        resolvedDashboardLogbookColumns = columns;
        return attempt;
      }
      fallback = attempt;
      if (!isMissingColumnError(attempt.error)) break;
    }
    return fallback;
  }

  window.DashboardManager = {
    _timer: null,
    _lastPayload: null,
    _hybridModes: ['daily', 'weekly', 'monthly', 'yearly'],
    _dashboardMode: 'weekly',
    _layoutStorageKey: 'wolf_dashboard_layout_v4_unified',
    _activeDashboardLayoutMode: '',
    _sessionLayoutsByMode: {},
    _defaultWidgetOrderByZone: null,
    _sortableReady: false,
    _dashboardGrid: null,
    _mobileSortable: null,
    _mobileDragActive: false,
    _mobileDragTouchY: null,
    _mobileEdgeAutoScrollRaf: null,
    _mobileEdgeAutoScrollDir: 0,
    _mobileEdgeAutoScrollSpeed: 0,
    _mobileEdgeTouchMoveHandler: null,
    _mobileEdgeTouchEndHandler: null,
    _mobileEdgePointerMoveHandler: null,
    _mobileAutoSizeTimer: null,
    _mobileAutoSizing: false,
    _suspendDashboardLayoutCapture: false,
    _layoutEditing: false,
    _lastSavedLayoutSignature: '',
    _tippyReady: false,
    _mobileSaveDockBtn: null,
    _dashboardNavigateGuardPatched: false,
    updateDashboardSaveDockOffset() {
      if (!this.isDashboardMobileViewport()) return;
      const topbarHost = document.getElementById('topbar-container');
      let dockTop = 10;
      if (topbarHost) {
        const topbarEl = topbarHost.querySelector('.topbar') || topbarHost;
        const rect = topbarEl.getBoundingClientRect();
        if (Number.isFinite(rect.bottom)) {
          dockTop = Math.max(10, Math.round(rect.bottom + 8));
        }
      }
      document.documentElement.style.setProperty(
        '--dashboard-save-dock-top',
        `${dockTop}px`,
      );
    },
    ensureMobileSaveDockButton() {
      if (this._mobileSaveDockBtn && this._mobileSaveDockBtn.isConnected)
        return this._mobileSaveDockBtn;
      const topbarHost = document.getElementById('topbar-container');
      if (!topbarHost) return null;
      const topbar = topbarHost.querySelector('.topbar') || topbarHost;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'dashboard-mobile-save-dock-btn';
      btn.className = 'dashboard-pill dashboard-mobile-save-dock';
      btn.innerHTML = "<i class='bx bx-save'></i> Save Changes";
      btn.addEventListener('click', () => {
        if (!this.isDashboardMobileViewport() || !this._layoutEditing) return;
        btn.classList.remove('is-saving-flash');
        void btn.offsetWidth;
        btn.classList.add('is-saving-flash');
        this.persistDashboardLayout({ animate: true });
        notify('Dashboard layout saved.', 'success');
        this.setLayoutEditing(false);
        window.setTimeout(() => btn.classList.remove('is-saving-flash'), 520);
      });
      topbar.appendChild(btn);
      this._mobileSaveDockBtn = btn;
      return btn;
    },
    syncMobileSaveDockButton() {
      const toolbarToggleBtn = document.getElementById(
        'dashboard-toolbar-toggle-btn',
      );
      const shouldDock = this.isDashboardMobileViewport() && this._layoutEditing;
      const btn = this.ensureMobileSaveDockButton();
      if (toolbarToggleBtn) {
        toolbarToggleBtn.classList.toggle('is-hidden-by-dock', shouldDock);
      }
      if (!btn) return;
      btn.style.display = shouldDock ? 'inline-flex' : 'none';
    },
    updateDashboardToolbarToggleState() {
      const toolbarActions = document.getElementById('dashboard-toolbar-actions');
      const toolbarToggleBtn = document.getElementById(
        'dashboard-toolbar-toggle-btn',
      );
      if (!toolbarActions || !toolbarToggleBtn) return;
      this.updateDashboardSaveDockOffset();
      const doneMode = this.isDashboardMobileViewport() && this._layoutEditing;
      if (doneMode) {
        toolbarActions.classList.remove('is-open');
        toolbarToggleBtn.innerHTML =
          "<i class='bx bx-check-double'></i> Save Changes";
        toolbarToggleBtn.setAttribute('aria-expanded', 'false');
        toolbarToggleBtn.classList.add('is-save-state');
      } else {
        toolbarToggleBtn.innerHTML =
          "<i class='bx bx-menu-alt-right'></i> Tools";
        toolbarToggleBtn.classList.remove('is-save-state');
      }
      this.syncMobileSaveDockButton();
    },
    bindActions() {
      if (
        !this._dashboardNavigateGuardPatched &&
        typeof window.navigateTo === 'function'
      ) {
        this._dashboardNavigateGuardPatched = true;
        const originalNavigateTo = window.navigateTo.bind(window);
        window.navigateTo = async (...args) => {
          const shell = this.getDashboardShell();
          const dashboardVisible =
            !!shell &&
            document.body.contains(shell) &&
            window.getComputedStyle(shell).display !== 'none';
          if (dashboardVisible && this._layoutEditing) {
            const confirmed = await this.confirmDashboardLayoutAction({
              title: 'Leave dashboard arrange mode?',
              text: 'Save Changes is active. Switching tabs will cancel this request and discard unsaved layout changes.',
              confirmLabel: 'Leave Tab',
            });
            if (!confirmed) return;
            this.setLayoutEditing(false);
            notify('Arrange mode canceled.', 'warning');
          }
          return originalNavigateTo(...args);
        };
      }

      const toolbarActions = document.getElementById('dashboard-toolbar-actions');
      const toolbarToggleBtn = document.getElementById(
        'dashboard-toolbar-toggle-btn',
      );
      if (toolbarActions && toolbarToggleBtn && !toolbarToggleBtn.dataset.bound) {
        toolbarToggleBtn.dataset.bound = '1';
        const closeToolbarMenu = () => {
          toolbarActions.classList.remove('is-open');
          toolbarToggleBtn.setAttribute('aria-expanded', 'false');
        };
        const toggleToolbarMenu = () => {
          const willOpen = !toolbarActions.classList.contains('is-open');
          toolbarActions.classList.toggle('is-open', willOpen);
          toolbarToggleBtn.setAttribute(
            'aria-expanded',
            willOpen ? 'true' : 'false',
          );
        };
        toolbarToggleBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (this.isDashboardMobileViewport() && this._layoutEditing) {
            toolbarToggleBtn.classList.remove('is-saving-flash');
            // replay animation on repeated saves
            void toolbarToggleBtn.offsetWidth;
            toolbarToggleBtn.classList.add('is-saving-flash');
            this.persistDashboardLayout({ animate: true });
            notify('Dashboard layout saved.', 'success');
            this.setLayoutEditing(false);
            this.updateDashboardToolbarToggleState();
            window.setTimeout(
              () => toolbarToggleBtn.classList.remove('is-saving-flash'),
              520,
            );
            return;
          }
          toggleToolbarMenu();
        });
        document.addEventListener('click', (event) => {
          if (!toolbarActions.contains(event.target)) closeToolbarMenu();
        });
        toolbarActions.addEventListener('click', (event) => {
          const actionBtn = event.target.closest(
            '.dashboard-toolbar-menu .dashboard-pill',
          );
          if (!actionBtn) return;
          if (this.isDashboardMobileViewport()) closeToolbarMenu();
        });
        window.addEventListener(
          'resize',
          () => {
            if (!this.isDashboardMobileViewport()) closeToolbarMenu();
            this.updateDashboardToolbarToggleState();
          },
          { passive: true },
        );
        window.addEventListener(
          'scroll',
          () => this.updateDashboardSaveDockOffset(),
          { passive: true },
        );
        this.updateDashboardToolbarToggleState();
      }

      const printBtn = document.getElementById('dashboard-print-btn');
      if (printBtn && !printBtn.dataset.bound) {
        printBtn.dataset.bound = '1';
        printBtn.addEventListener('click', () => {
          this.preparePrintReport();
          window.print();
        });
      }

      const downloadBtn = document.getElementById('dashboard-download-btn');
      if (downloadBtn && !downloadBtn.dataset.bound) {
        downloadBtn.dataset.bound = '1';
        downloadBtn.addEventListener('click', () => this.downloadSnapshot());
      }

      const resetLayoutBtnToolbar = document.getElementById(
        'dashboard-layout-reset-btn-toolbar',
      );
      if (resetLayoutBtnToolbar && !resetLayoutBtnToolbar.dataset.bound) {
        resetLayoutBtnToolbar.dataset.bound = '1';
        resetLayoutBtnToolbar.addEventListener('click', async () => {
          const confirmed = await this.confirmDashboardLayoutAction({
            title: 'Reset dashboard layout to default?',
            text: 'This will replace your current saved layout for this device mode.',
            confirmLabel: 'Reset',
          });
          if (!confirmed) return;
          this.resetDashboardLayout({ persist: true });
        });
      }

      const layoutToggleBtn = document.getElementById(
        'dashboard-layout-toggle-btn',
      );
      if (layoutToggleBtn && !layoutToggleBtn.dataset.bound) {
        layoutToggleBtn.dataset.bound = '1';
        layoutToggleBtn.addEventListener('click', async () => {
          const nextEditing = !this._layoutEditing;
          if (!nextEditing) {
            const hasUnsaved =
              this.getDashboardLayoutSignature() !==
              String(this._lastSavedLayoutSignature || '');
            if (hasUnsaved) {
              const confirmed = await this.confirmDashboardLayoutAction({
                title: 'Done arranging?',
                text: 'You have unsaved layout changes. Exit Arrange Mode anyway?',
                confirmLabel: 'Done',
              });
              if (!confirmed) return;
              this.persistDashboardLayout({ animate: true });
            }
          }
          this.setLayoutEditing(nextEditing);
        });
      }

      if (!this._printHookBound) {
        this._printHookBound = true;
        window.addEventListener('beforeprint', () => this.preparePrintReport());
      }

      const busiestCard = document.getElementById('dashboard-busiest-kpi-card');
      if (busiestCard && !busiestCard.dataset.bound) {
        busiestCard.dataset.bound = '1';
        busiestCard.addEventListener('click', () => {
          busiestCard.classList.toggle('is-flipped');
          if (window.wolfAudio) window.wolfAudio.play('swipe');
        });
      }

      const modeButtons = Array.from(
        document.querySelectorAll('[data-dashboard-mode]'),
      );
      modeButtons.forEach((button) => {
        if (button.dataset.bound === '1') return;
        button.dataset.bound = '1';
        button.addEventListener('click', () => {
          const nextMode = String(
            button.getAttribute('data-dashboard-mode') || '',
          ).toLowerCase();
          this.setDashboardMode(nextMode, { withAudio: true, withPulse: true });
        });
      });

      const quickRefreshBtn = document.getElementById(
        'dashboard-quick-refresh-btn',
      );
      if (quickRefreshBtn && !quickRefreshBtn.dataset.bound) {
        quickRefreshBtn.dataset.bound = '1';
        quickRefreshBtn.addEventListener('click', () => {
          if (window.wolfAudio) window.wolfAudio.play('notif');
          this.load();
        });
      }

      const quickPrintBtn = document.getElementById(
        'dashboard-quick-print-btn',
      );
      if (quickPrintBtn && !quickPrintBtn.dataset.bound) {
        quickPrintBtn.dataset.bound = '1';
        quickPrintBtn.addEventListener('click', () => {
          this.preparePrintReport();
          if (window.wolfAudio) window.wolfAudio.play('notif');
          window.print();
        });
      }

      const quickDownloadBtn = document.getElementById(
        'dashboard-quick-download-btn',
      );
      if (quickDownloadBtn && !quickDownloadBtn.dataset.bound) {
        quickDownloadBtn.dataset.bound = '1';
        quickDownloadBtn.addEventListener('click', () =>
          this.downloadSnapshot(),
        );
      }

      const quickProductsBtn = document.getElementById(
        'dashboard-open-products-btn',
      );
      if (quickProductsBtn && !quickProductsBtn.dataset.bound) {
        quickProductsBtn.dataset.bound = '1';
        quickProductsBtn.addEventListener('click', () => {
          if (window.wolfAudio) window.wolfAudio.play('swipe');
          if (typeof window.navigateTo === 'function')
            window.navigateTo('products');
        });
      }

      const quickSalesBtn = document.getElementById('dashboard-open-sales-btn');
      if (quickSalesBtn && !quickSalesBtn.dataset.bound) {
        quickSalesBtn.dataset.bound = '1';
        quickSalesBtn.addEventListener('click', () => {
          if (window.wolfAudio) window.wolfAudio.play('swipe');
          if (typeof window.navigateTo === 'function')
            window.navigateTo('sales');
        });
      }

      const quickLogbookBtn = document.getElementById(
        'dashboard-open-logbook-btn',
      );
      if (quickLogbookBtn && !quickLogbookBtn.dataset.bound) {
        quickLogbookBtn.dataset.bound = '1';
        quickLogbookBtn.addEventListener('click', () => {
          if (window.wolfAudio) window.wolfAudio.play('swipe');
          if (typeof window.navigateTo === 'function')
            window.navigateTo('logbook');
        });
      }
    },

    preparePrintReport() {
      const stampEl = document.getElementById('dashboard-report-generated-at');
      if (!stampEl) return;

      const now = new Date();
      stampEl.textContent = `Generated: ${now.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    },

    async confirmDashboardLayoutAction({ title, text, confirmLabel }) {
      if (window.Swal && typeof window.Swal.fire === 'function') {
        try {
          const result = await window.Swal.fire({
            title: String(title || 'Confirm action'),
            text: String(text || ''),
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: String(confirmLabel || 'Confirm'),
            cancelButtonText: 'Cancel',
            reverseButtons: true,
          });
          return Boolean(result?.isConfirmed);
        } catch (_) {
          // fall through to native confirm
        }
      }
      return window.confirm(
        `${String(title || 'Confirm action')}\n\n${String(text || '')}`,
      );
    },

    async ensureExternalScript(src, globalName) {
      if (globalName && window[globalName]) return true;
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        await new Promise((resolve) => {
          if (globalName && window[globalName]) return resolve();
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', resolve, { once: true });
        });
        return Boolean(!globalName || window[globalName]);
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
      await new Promise((resolve) => {
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', resolve, { once: true });
      });
      return Boolean(!globalName || window[globalName]);
    },

    ensureExternalStyle(href, id) {
      if (id && document.getElementById(id)) return;
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      if (id) link.id = id;
      document.head.appendChild(link);
    },

    async ensureDashboardEnhancers() {
      // Libraries are self-hosted and loaded in pages/main.html to satisfy CSP.
      return {
        gridstack: Boolean(
          window.GridStack && typeof window.GridStack.init === 'function',
        ),
        tippy: typeof window.tippy === 'function',
      };
    },

    getDashboardShell() {
      return document.querySelector('#page-wrapper .dashboard-shell');
    },

    getDashboardWorkspace() {
      return document.getElementById('dashboard-workspace-grid');
    },

    getDefaultDashboardGridLayout() {
      return {
        hero: { x: 0, y: 0, w: 8, h: 7 },
        'hybrid-trend': { x: 8, y: 0, w: 4, h: 7 },
        'kpi-active-members': { x: 0, y: 7, w: 4, h: 4 },
        'kpi-busiest-hour': { x: 4, y: 7, w: 4, h: 4 },
        'kpi-products-sold': { x: 8, y: 7, w: 4, h: 4 },
        'analytics-peak-hours': { x: 0, y: 11, w: 4, h: 5 },
        'analytics-income-stats': { x: 4, y: 11, w: 4, h: 5 },
        'analytics-ops-console': { x: 8, y: 11, w: 4, h: 10 },
        'analytics-products-share': { x: 0, y: 16, w: 4, h: 6 },
        'analytics-members-share': { x: 4, y: 16, w: 4, h: 6 },
        'relevant-products': { x: 0, y: 22, w: 12, h: 5 },
      };
    },

    getDefaultWidgetOrder() {
      return [
        'hero',
        'hybrid-trend',
        'kpi-active-members',
        'kpi-busiest-hour',
        'kpi-products-sold',
        'analytics-peak-hours',
        'analytics-income-stats',
        'analytics-ops-console',
        'analytics-products-share',
        'analytics-members-share',
        'relevant-products',
      ];
    },

    getDashboardColumnCount() {
      return 12;
    },

    getDashboardCellHeight() {
      return this.isDashboardMobileViewport() ? 32 : 34;
    },

    getDashboardMaxRowsForPixelCap() {
      const cellH = Math.max(1, Number(this.getDashboardCellHeight()) || 1);
      return Math.max(1, Math.floor(2000 / cellH));
    },

    getDashboardMaxYForHeight(height = 1) {
      const maxRows = this.getDashboardMaxRowsForPixelCap();
      const h = Math.max(1, Number(height) || 1);
      return Math.max(0, maxRows - h);
    },

    updateDashboardHeightLimitFx() {
      const workspace = this.getDashboardWorkspace();
      if (!workspace || !this._dashboardGrid)
        return;
      const layer = workspace.querySelector('.dashboard-edge-glow-layer');
      if (!this._layoutEditing) {
        workspace.classList.remove('is-boundary-near');
        if (layer) layer.innerHTML = '';
        return;
      }
      const workspaceRect = workspace.getBoundingClientRect();
      const touchTolerancePx = 1;
      const cards = Array.from(
        workspace.querySelectorAll('.grid-stack-item[gs-id]'),
      );
      const topSegments = [];
      const rightSegments = [];
      const bottomSegments = [];
      const leftSegments = [];

      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      const mergeRanges = (ranges) => {
        const sorted = ranges
          .map(([start, end]) => [Math.min(start, end), Math.max(start, end)])
          .filter(([start, end]) => end - start > 1)
          .sort((a, b) => a[0] - b[0]);
        if (!sorted.length) return [];
        const merged = [sorted[0]];
        for (let i = 1; i < sorted.length; i += 1) {
          const [start, end] = sorted[i];
          const last = merged[merged.length - 1];
          if (start <= last[1] + 1) last[1] = Math.max(last[1], end);
          else merged.push([start, end]);
        }
        return merged;
      };

      let activeLayer = layer;
      if (!activeLayer) {
        activeLayer = document.createElement('div');
        activeLayer.className = 'dashboard-edge-glow-layer';
        workspace.appendChild(activeLayer);
      }

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const topDist = Math.max(0, rect.top - workspaceRect.top);
        const leftDist = Math.max(0, rect.left - workspaceRect.left);
        const rightDist = Math.max(0, workspaceRect.right - rect.right);
        const bottomDist = Math.max(0, workspaceRect.bottom - rect.bottom);

        if (topDist <= touchTolerancePx) {
          topSegments.push([
            clamp(rect.left - workspaceRect.left, 0, workspaceRect.width),
            clamp(rect.right - workspaceRect.left, 0, workspaceRect.width),
          ]);
        }
        if (bottomDist <= touchTolerancePx) {
          bottomSegments.push([
            clamp(rect.left - workspaceRect.left, 0, workspaceRect.width),
            clamp(rect.right - workspaceRect.left, 0, workspaceRect.width),
          ]);
        }
        if (leftDist <= touchTolerancePx) {
          leftSegments.push([
            clamp(rect.top - workspaceRect.top, 0, workspaceRect.height),
            clamp(rect.bottom - workspaceRect.top, 0, workspaceRect.height),
          ]);
        }
        if (rightDist <= touchTolerancePx) {
          rightSegments.push([
            clamp(rect.top - workspaceRect.top, 0, workspaceRect.height),
            clamp(rect.bottom - workspaceRect.top, 0, workspaceRect.height),
          ]);
        }
      });
      const appendSegments = (edge, mergedRanges) => {
        mergedRanges.forEach(([start, end]) => {
          const segment = document.createElement('span');
          segment.className = `dashboard-edge-segment edge-${edge}`;
          if (edge === 'top' || edge === 'bottom') {
            segment.style.left = `${start}px`;
            segment.style.width = `${Math.max(2, end - start)}px`;
          } else {
            segment.style.top = `${start}px`;
            segment.style.height = `${Math.max(2, end - start)}px`;
          }
          activeLayer.appendChild(segment);
        });
      };

      activeLayer.innerHTML = '';
      appendSegments('top', mergeRanges(topSegments));
      appendSegments('right', mergeRanges(rightSegments));
      appendSegments('bottom', mergeRanges(bottomSegments));
      appendSegments('left', mergeRanges(leftSegments));

      const hasAny = activeLayer.childElementCount > 0;
      workspace.classList.toggle('is-boundary-near', hasAny);
    },

    syncDashboardGridVisualColumns(cols = null) {
      const workspace = this.getDashboardWorkspace();
      if (!workspace) return;
      const resolved =
        Number.isFinite(Number(cols)) && Number(cols) > 0
          ? Math.round(Number(cols))
          : this.getDashboardActiveColumnCount();
      workspace.style.setProperty('--dashboard-grid-columns', String(resolved));
    },

    getDashboardActiveColumnCount() {
      if (
        this._dashboardGrid &&
        typeof this._dashboardGrid.getColumn === 'function'
      ) {
        const live = Number(this._dashboardGrid.getColumn());
        if (Number.isFinite(live) && live > 0) return live;
      }
      return this.isDashboardMobileViewport()
        ? 1
        : this.getDashboardColumnCount();
    },

    getDashboardRuntimeLayoutMode() {
      return this.getDashboardActiveColumnCount() === 1 ? 'mobile' : 'desktop';
    },

    shouldCaptureDashboardLayoutForMode(mode) {
      if (this._suspendDashboardLayoutCapture) return false;
      const currentMode = this.getDashboardRuntimeLayoutMode();
      if (mode && currentMode !== mode) return false;
      const activeCols = this.getDashboardActiveColumnCount();
      if (currentMode === 'desktop')
        return activeCols === this.getDashboardColumnCount();
      if (currentMode === 'mobile') return activeCols === 1;
      return false;
    },

    isDashboardMobileViewport() {
      return window.matchMedia('(max-width: 767px)').matches;
    },

    getDashboardLayoutMode() {
      return this.isDashboardMobileViewport() ? 'mobile' : 'desktop';
    },

    getDashboardLayoutStorageKey(mode = null) {
      const resolved =
        String(
          mode ||
            this._activeDashboardLayoutMode ||
            this.getDashboardRuntimeLayoutMode() ||
            this.getDashboardLayoutMode(),
        ).toLowerCase() === 'mobile'
          ? 'mobile'
          : 'desktop';
      return `${this._layoutStorageKey}_${resolved}`;
    },

    getDashboardDragPauseMs() {
      return this.isDashboardMobileViewport() ? 120 : 0;
    },

    destroyMobileDashboardSortable() {
      this.stopMobileEdgeAutoScroll();
      if (
        this._mobileSortable &&
        typeof this._mobileSortable.destroy === 'function'
      ) {
        this._mobileSortable.destroy();
      }
      this._mobileSortable = null;
    },

    getDashboardScrollContainer() {
      const workspace = this.getDashboardWorkspace();
      const isScrollable = (node) => {
        if (
          !node ||
          node === document.body ||
          node === document.documentElement
        )
          return false;
        const style = window.getComputedStyle(node);
        const overflowY = String(style?.overflowY || '').toLowerCase();
        if (!(overflowY === 'auto' || overflowY === 'scroll')) return false;
        return node.scrollHeight > node.clientHeight;
      };
      let current = workspace?.parentElement || null;
      while (current) {
        if (isScrollable(current)) return current;
        current = current.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    },

    stopMobileEdgeAutoScroll() {
      this._mobileDragActive = false;
      this._mobileDragTouchY = null;
      this._mobileEdgeAutoScrollDir = 0;
      this._mobileEdgeAutoScrollSpeed = 0;
      if (this._mobileEdgeAutoScrollRaf) {
        window.cancelAnimationFrame(this._mobileEdgeAutoScrollRaf);
      }
      this._mobileEdgeAutoScrollRaf = null;
      if (this._mobileEdgeTouchMoveHandler) {
        document.removeEventListener(
          'touchmove',
          this._mobileEdgeTouchMoveHandler,
        );
      }
      if (this._mobileEdgeTouchEndHandler) {
        document.removeEventListener(
          'touchend',
          this._mobileEdgeTouchEndHandler,
        );
        document.removeEventListener(
          'touchcancel',
          this._mobileEdgeTouchEndHandler,
        );
      }
      if (this._mobileEdgePointerMoveHandler) {
        document.removeEventListener(
          'pointermove',
          this._mobileEdgePointerMoveHandler,
          true,
        );
      }
      this._mobileEdgeTouchMoveHandler = null;
      this._mobileEdgeTouchEndHandler = null;
      this._mobileEdgePointerMoveHandler = null;
    },

    evaluateMobileEdgeAutoScroll() {
      if (!this._mobileDragActive || !Number.isFinite(this._mobileDragTouchY)) {
        this._mobileEdgeAutoScrollDir = 0;
        this._mobileEdgeAutoScrollSpeed = 0;
        return;
      }
      const y = Number(this._mobileDragTouchY);
      const scroller = this.getDashboardScrollContainer();
      const rect =
        scroller && typeof scroller.getBoundingClientRect === 'function'
          ? scroller.getBoundingClientRect()
          : {
              top: 0,
              bottom: Math.max(1, window.innerHeight || 1),
              height: Math.max(1, window.innerHeight || 1),
            };
      const edgeSize = Math.max(54, Math.round((rect.height || 1) * 0.14));
      let dir = 0;
      let speed = 0;
      const topEdge = (rect.top || 0) + edgeSize;
      const bottomEdge =
        (rect.bottom || Math.max(1, window.innerHeight || 1)) - edgeSize;
      if (y <= topEdge) {
        const ratio = Math.max(0, Math.min(1, (topEdge - y) / edgeSize));
        dir = -1;
        speed = 12 + ratio * 34;
      } else if (y >= bottomEdge) {
        const ratio = Math.max(0, Math.min(1, (y - bottomEdge) / edgeSize));
        dir = 1;
        speed = 12 + ratio * 34;
      }
      this._mobileEdgeAutoScrollDir = dir;
      this._mobileEdgeAutoScrollSpeed = speed;
    },

    runMobileEdgeAutoScroll() {
      if (!this._mobileDragActive) {
        this._mobileEdgeAutoScrollRaf = null;
        return;
      }
      if (
        this._mobileEdgeAutoScrollDir !== 0 &&
        this._mobileEdgeAutoScrollSpeed > 0
      ) {
        const scroller = this.getDashboardScrollContainer();
        const delta =
          this._mobileEdgeAutoScrollDir * this._mobileEdgeAutoScrollSpeed;
        if (
          scroller &&
          scroller !== document.documentElement &&
          scroller !== document.body &&
          Number.isFinite(Number(scroller.scrollTop))
        ) {
          scroller.scrollTop = Number(scroller.scrollTop) + delta;
        } else if (scroller && typeof scroller.scrollBy === 'function') {
          scroller.scrollBy(0, delta);
        } else {
          window.scrollBy(0, delta);
        }
      }
      this._mobileEdgeAutoScrollRaf = window.requestAnimationFrame(() =>
        this.runMobileEdgeAutoScroll(),
      );
    },

    applyMobileDashboardStackFromDom() {
      if (!this._dashboardGrid) return;
      const workspace = this.getDashboardWorkspace();
      if (!workspace) return;
      const items = Array.from(
        workspace.querySelectorAll('.grid-stack-item[gs-id]'),
      );
      let nextY = 0;
      items.forEach((item) => {
        const node = item.gridstackNode;
        const h = Math.max(1, Number(node?.h) || 1);
        const clampedY = Math.min(nextY, this.getDashboardMaxYForHeight(h));
        this._dashboardGrid.update(item, {
          x: 0,
          y: clampedY,
          w: 1,
        });
        nextY += h;
      });
      this.updateDashboardHeightLimitFx();
    },

    reflowDesktopDashboardYAxis() {
      if (!this._dashboardGrid || this.isDashboardMobileViewport()) return;
      const workspace = this.getDashboardWorkspace();
      if (!workspace) return;
      const cols = Math.max(1, this.getDashboardColumnCount());
      const items = Array.from(
        workspace.querySelectorAll('.grid-stack-item[gs-id]'),
      );
      if (!items.length) return;

      const nodes = items
        .map((item) => ({ item, node: item.gridstackNode || null }))
        .filter((entry) => entry.node)
        .sort((a, b) => {
          const ay = Number(a.node.y) || 0;
          const by = Number(b.node.y) || 0;
          if (ay !== by) return ay - by;
          const ax = Number(a.node.x) || 0;
          const bx = Number(b.node.x) || 0;
          return ax - bx;
        });

      const colHeights = new Array(cols).fill(0);
      let changed = false;
      this._dashboardGrid.batchUpdate();
      nodes.forEach(({ item, node }) => {
        const w = Math.max(1, Math.min(cols, Number(node.w) || 1));
        const x = Math.max(0, Math.min(cols - w, Number(node.x) || 0));
        let nextY = 0;
        for (let c = x; c < x + w; c += 1) {
          nextY = Math.max(nextY, Number(colHeights[c]) || 0);
        }
        const h = Math.max(1, Number(node.h) || 1);
        const prevY = Number(node.y) || 0;
        if (nextY !== prevY || x !== (Number(node.x) || 0)) {
          changed = true;
          this._dashboardGrid.update(item, { x, y: nextY, w, h });
        }
        const committedY = nextY;
        for (let c = x; c < x + w; c += 1) {
          colHeights[c] = committedY + h;
        }
      });
      this._dashboardGrid.commit();
      if (changed) this.applyWidgetAdaptiveScale();
      this.updateDashboardHeightLimitFx();
    },

    ensureMobileDashboardSortable() {
      const workspace = this.getDashboardWorkspace();
      if (
        !workspace ||
        this._mobileSortable ||
        typeof window.Sortable !== 'function'
      )
        return;
      this._mobileSortable = window.Sortable.create(workspace, {
        animation: 0,
        draggable: '.grid-stack-item[gs-id]',
        handle: '.dashboard-drag-surface',
        delay: 300,
        delayOnTouchOnly: true,
        touchStartThreshold: 4,
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 3,
        ghostClass: 'dashboard-mobile-sort-ghost',
        chosenClass: 'dashboard-mobile-sort-chosen',
        dragClass: 'dashboard-mobile-sort-drag',
        swapThreshold: 0.65,
        scroll: true,
        bubbleScroll: true,
        scrollSensitivity: 110,
        scrollSpeed: 100,
        filter:
          'button, input, select, textarea, a, [role="button"], .dashboard-mode-controls, .dashboard-mode-btn, .dashboard-ops-btn, .dashboard-pill',
        preventOnFilter: false,
        onStart: (event) => {
          const touch = event?.originalEvent?.touches?.[0];
          this._mobileDragActive = true;
          this._mobileDragTouchY = Number.isFinite(Number(touch?.clientY))
            ? Number(touch.clientY)
            : null;
          this.evaluateMobileEdgeAutoScroll();
          if (!this._mobileEdgeAutoScrollRaf) {
            this._mobileEdgeAutoScrollRaf = window.requestAnimationFrame(() =>
              this.runMobileEdgeAutoScroll(),
            );
          }
          if (!this._mobileEdgeTouchMoveHandler) {
            this._mobileEdgeTouchMoveHandler = (touchEvent) => {
              const point =
                touchEvent?.touches?.[0] || touchEvent?.changedTouches?.[0];
              if (!point) return;
              this._mobileDragTouchY = Number(point.clientY);
              this.evaluateMobileEdgeAutoScroll();
            };
            document.addEventListener(
              'touchmove',
              this._mobileEdgeTouchMoveHandler,
              { passive: true },
            );
          }
          if (!this._mobileEdgePointerMoveHandler) {
            this._mobileEdgePointerMoveHandler = (pointerEvent) => {
              if (!this._mobileDragActive) return;
              const y = Number(pointerEvent?.clientY);
              if (!Number.isFinite(y)) return;
              this._mobileDragTouchY = y;
              this.evaluateMobileEdgeAutoScroll();
            };
            document.addEventListener(
              'pointermove',
              this._mobileEdgePointerMoveHandler,
              { passive: true, capture: true },
            );
          }
          if (!this._mobileEdgeTouchEndHandler) {
            this._mobileEdgeTouchEndHandler = () =>
              this.stopMobileEdgeAutoScroll();
            document.addEventListener(
              'touchend',
              this._mobileEdgeTouchEndHandler,
              { passive: true },
            );
            document.addEventListener(
              'touchcancel',
              this._mobileEdgeTouchEndHandler,
              { passive: true },
            );
          }
        },
        onMove: (event) => {
          const touch =
            event?.originalEvent?.touches?.[0] ||
            event?.originalEvent?.changedTouches?.[0];
          if (!touch) return;
          this._mobileDragTouchY = Number(touch.clientY);
          this.evaluateMobileEdgeAutoScroll();
        },
        onEnd: () => {
          this.stopMobileEdgeAutoScroll();
          this.applyMobileDashboardStackFromDom();
          this.applyWidgetAdaptiveScale();
        },
      });
    },

    scheduleMobileDashboardAutoSize() {
      if (!this.isDashboardMobileViewport()) return;
      if (this._layoutEditing) return;
      if (this._mobileAutoSizeTimer)
        window.clearTimeout(this._mobileAutoSizeTimer);
      this._mobileAutoSizeTimer = window.setTimeout(() => {
        this.autoSizeDashboardCardsForMobile();
      }, 90);
    },

    autoSizeDashboardCardsForMobile() {
      if (!this._dashboardGrid || !this.isDashboardMobileViewport()) return;
      if (this._mobileAutoSizing) return;
      const workspace = this.getDashboardWorkspace();
      if (!workspace) return;
      const items = Array.from(
        workspace.querySelectorAll('.grid-stack-item[gs-id]'),
      );
      if (!items.length) return;
      items.sort((a, b) => {
        const an = a.gridstackNode || {};
        const bn = b.gridstackNode || {};
        const ay = Number(an.y) || 0;
        const by = Number(bn.y) || 0;
        if (ay !== by) return ay - by;
        const ax = Number(an.x) || 0;
        const bx = Number(bn.x) || 0;
        return ax - bx;
      });
      this._mobileAutoSizing = true;
      const cellH = Math.max(
        1,
        Math.round(
          this._dashboardGrid.getCellHeight
            ? this._dashboardGrid.getCellHeight(true)
            : this._dashboardGrid.opts?.cellHeight || 1,
        ),
      );
      let nextY = 0;
      this._dashboardGrid.batchUpdate();
      items.forEach((item) => {
        const node = item.gridstackNode;
        if (!node) return;
        const id = String(item.getAttribute('gs-id') || '').trim();
        const constraints = this.getDashboardWidgetConstraints(id);
        const widget = item.querySelector('.dashboard-widget[data-widget-id]');
        const contentHeight = widget
          ? Math.max(widget.scrollHeight, widget.clientHeight)
          : cellH;
        const paddingAllowance = 24;
        const neededH = Math.min(
          constraints.maxH,
          Math.max(
            constraints.minH,
            Math.ceil((contentHeight + paddingAllowance) / cellH),
          ),
        );
        this._dashboardGrid.update(item, {
          x: 0,
          y: nextY,
          w: 1,
          h: neededH,
        });
        nextY += neededH;
      });
      this._dashboardGrid.commit();
      this.applyWidgetAdaptiveScale(items);
      this._mobileAutoSizing = false;
      this.updateDashboardHeightLimitFx();
    },

    applyDashboardDragPauseToItems() {
      const workspace = this.getDashboardWorkspace();
      if (
        !workspace ||
        !(window.GridStack && typeof window.GridStack.getDD === 'function')
      )
        return;
      const pauseMs = this.getDashboardDragPauseMs();
      const dd = window.GridStack.getDD();
      if (!dd || typeof dd.draggable !== 'function') return;
      const items = Array.from(workspace.querySelectorAll('.grid-stack-item'));
      items.forEach((item) => {
        try {
          dd.draggable(item, 'option', 'pause', pauseMs);
        } catch (_) {
          // ignore unsupported driver option changes
        }
      });
    },

    getDashboardWidgetConstraints(id) {
      const widgetId = String(id || '').trim();
      const isMobile = this.getDashboardActiveColumnCount() === 1;
      const minHByWidget = {
        'hybrid-trend': isMobile ? 9 : 7,
        'analytics-products-share': isMobile ? 8 : 6,
        'analytics-members-share': isMobile ? 8 : 6,
      };
      return {
        minW: 1,
        minH: minHByWidget[widgetId] || 1,
        maxW: this.getDashboardColumnCount(),
        maxH: this.getDashboardMaxRowsForPixelCap(),
      };
    },

    enforceDashboardWidgetConstraints() {
      if (!this._dashboardGrid) return;
      const workspace = this.getDashboardWorkspace();
      if (!workspace) return;
      const cols = this.getDashboardActiveColumnCount();
      const items = Array.from(
        workspace.querySelectorAll('.grid-stack-item[gs-id]'),
      );
      if (!items.length) return;
      let changed = false;
      this._dashboardGrid.batchUpdate();
      items.forEach((item) => {
        const id = String(item.getAttribute('gs-id') || '').trim();
        if (!id) return;
        const node = item.gridstackNode || {};
        const constraints = this.getDashboardWidgetConstraints(id);
        const nextW = Math.min(
          constraints.maxW,
          Math.max(constraints.minW, Number(node.w) || constraints.minW),
        );
        const nextH = Math.min(
          constraints.maxH,
          Math.max(constraints.minH, Number(node.h) || constraints.minH),
        );
        const nextX = Math.min(
          Math.max(0, Number(node.x) || 0),
          Math.max(0, cols - nextW),
        );
        const nextY = Math.min(
          Math.max(0, Number(node.y) || 0),
          this.getDashboardMaxYForHeight(nextH),
        );
        if (
          nextW !== Number(node.w) ||
          nextH !== Number(node.h) ||
          nextX !== Number(node.x) ||
          nextY !== Number(node.y)
        ) {
          changed = true;
          this._dashboardGrid.update(item, {
            x: nextX,
            y: nextY,
            w: nextW,
            h: nextH,
          });
        }
      });
      this._dashboardGrid.commit();
      if (changed) this.applyWidgetAdaptiveScale();
      this.updateDashboardHeightLimitFx();
    },

    serializeDashboardLayout() {
      if (!this._dashboardGrid || !this._dashboardGrid.engine) return [];
      return (this._dashboardGrid.engine.nodes || [])
        .map((node) => {
          const rawId =
            node?.id ||
            node?.el?.getAttribute('gs-id') ||
            node?.el?.getAttribute('data-widget-id') ||
            node?.el
              ?.querySelector('.dashboard-widget[data-widget-id]')
              ?.getAttribute('data-widget-id') ||
            '';
          const id = String(rawId || '').trim();
          if (!id) return null;
          return {
            id,
            x: Number(node.x) || 0,
            y: Number(node.y) || 0,
            w: Math.max(1, Number(node.w) || 1),
            h: Math.max(1, Number(node.h) || 1),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.id.localeCompare(b.id));
    },

    getDashboardLayoutSignature(layout = null) {
      const payload = Array.isArray(layout)
        ? layout
        : this.serializeDashboardLayout();
      return JSON.stringify(payload);
    },

    getStoredDashboardLayoutSignatureForMode(mode) {
      const safeMode =
        String(mode || '').toLowerCase() === 'mobile' ? 'mobile' : 'desktop';
      const key = this.getDashboardLayoutStorageKey(safeMode);
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.layout)) return '';
        const normalized = parsed.layout
          .map((entry) => ({
            id: String(entry?.id || '').trim(),
            x: Number(entry?.x) || 0,
            y: Number(entry?.y) || 0,
            w: Math.max(1, Number(entry?.w) || 1),
            h: Math.max(1, Number(entry?.h) || 1),
          }))
          .filter((entry) => entry.id)
          .sort((a, b) => a.id.localeCompare(b.id));
        return JSON.stringify(normalized);
      } catch (_) {
        return '';
      }
    },

    readSavedDashboardLayoutForMode(mode) {
      const safeMode =
        String(mode || '').toLowerCase() === 'mobile' ? 'mobile' : 'desktop';
      const key = this.getDashboardLayoutStorageKey(safeMode);
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.layout)) return [];
        const layout = parsed.layout
          .map((entry) => ({
            id: String(entry?.id || '').trim(),
            x: Number(entry?.x) || 0,
            y: Number(entry?.y) || 0,
            w: Math.max(1, Number(entry?.w) || 1),
            h: Math.max(1, Number(entry?.h) || 1),
          }))
          .filter((entry) => entry.id);
        if (!layout.length) return [];
        const maxCols = layout.reduce(
          (max, entry) => Math.max(max, Number(entry.x) + Number(entry.w)),
          0,
        );
        if (safeMode === 'desktop' && maxCols > this.getDashboardColumnCount())
          return [];
        if (safeMode === 'mobile' && maxCols > 1) {
          const ordered = [...layout].sort((a, b) => {
            if (a.y === b.y) return a.x - b.x;
            return a.y - b.y;
          });
          let nextY = 0;
          return ordered.map((entry) => {
            const h = Math.max(1, Number(entry.h) || 1);
            const mapped = { id: entry.id, x: 0, y: nextY, w: 1, h };
            nextY += h;
            return mapped;
          });
        }
        return layout;
      } catch (_) {
        return [];
      }
    },

    readSavedDashboardLayout() {
      return this.readSavedDashboardLayoutForMode(
        this.getDashboardLayoutMode(),
      );
    },

    setLayoutEditing(enabled) {
      const shell = this.getDashboardShell();
      if (!shell) return;
      const isEditing = Boolean(enabled);
      const isMobile = this.isDashboardMobileViewport();
      this._layoutEditing = isEditing;
      shell.classList.toggle('layout-editing', isEditing);
      const layoutToggleBtn = document.getElementById(
        'dashboard-layout-toggle-btn',
      );
      if (layoutToggleBtn) {
        layoutToggleBtn.classList.toggle('is-layout-active', isEditing);
        layoutToggleBtn.innerHTML = isEditing
          ? "<i class='bx bx-check'></i> Done"
          : "<i class='bx bx-move'></i> Arrange Mode";
      }
      if (this._dashboardGrid) {
        if (isMobile) {
          // Mobile drag is controlled by Sortable long-press; resize stays vertical-only via CSS handles.
          this._dashboardGrid.enableMove(false);
          this._dashboardGrid.enableResize(isEditing);
        } else {
          this._dashboardGrid.enableMove(isEditing);
          this._dashboardGrid.enableResize(isEditing);
        }
      }
      if (isMobile) {
        if (isEditing) this.ensureMobileDashboardSortable();
        else this.destroyMobileDashboardSortable();
      }
      this.updateDashboardToolbarToggleState();
      this.updateDashboardHeightLimitFx();
    },

    applyDashboardResponsiveGridMode(options = {}) {
      if (!this._dashboardGrid) return;
      const isMobile = this.isDashboardMobileViewport();
      const mode = this.getDashboardLayoutMode();
      const previousMode = this._activeDashboardLayoutMode || '';
      const modeChanged = previousMode !== mode;

      if (modeChanged || options.forceLoad === true) {
        this._suspendDashboardLayoutCapture = true;
        if (modeChanged && previousMode) {
          const currentColsBeforeSwitch = this.getDashboardActiveColumnCount();
          const prevIsStableDesktop =
            previousMode === 'desktop' &&
            currentColsBeforeSwitch === this.getDashboardColumnCount();
          const prevIsStableMobile =
            previousMode === 'mobile' && currentColsBeforeSwitch === 1;
          if (prevIsStableDesktop || prevIsStableMobile) {
            this._sessionLayoutsByMode[previousMode] =
              this.serializeDashboardLayout();
          }
        }
        const targetCols = isMobile ? 1 : this.getDashboardColumnCount();
        if (typeof this._dashboardGrid.cellHeight === 'function') {
          this._dashboardGrid.cellHeight(this.getDashboardCellHeight());
        } else if (this._dashboardGrid.opts) {
          this._dashboardGrid.opts.cellHeight = this.getDashboardCellHeight();
        }
        if (this._dashboardGrid.opts) {
          this._dashboardGrid.opts.maxRow = this.getDashboardMaxRowsForPixelCap();
        }
        this._dashboardGrid.column(targetCols, 'none');
        this.syncDashboardGridVisualColumns(targetCols);
        const sessionLayout = Array.isArray(this._sessionLayoutsByMode[mode])
          ? this._sessionLayoutsByMode[mode]
          : [];
        const savedLayout = this.readSavedDashboardLayoutForMode(mode);
        let layoutToApply = [];
        if (options.forceLoad === true) {
          layoutToApply = savedLayout.length ? savedLayout : sessionLayout;
        } else {
          layoutToApply = sessionLayout.length ? sessionLayout : savedLayout;
        }
        if (!layoutToApply.length && mode === 'mobile') {
          const desktopLayout = this._sessionLayoutsByMode.desktop?.length
            ? this._sessionLayoutsByMode.desktop
            : this.readSavedDashboardLayoutForMode('desktop');
          if (desktopLayout.length) {
            const orderedDesktop = [...desktopLayout].sort((a, b) => {
              if (a.y === b.y) return a.x - b.x;
              return a.y - b.y;
            });
            let nextY = 0;
            layoutToApply = orderedDesktop.map((entry) => {
              const h = Math.max(1, Number(entry.h) || 1);
              const mapped = { id: entry.id, x: 0, y: nextY, w: 1, h };
              nextY += h;
              return mapped;
            });
          }
        }
        this.applyDashboardLayout(layoutToApply, {
          compact: false,
          targetCols,
        });
        this._sessionLayoutsByMode[mode] = this.serializeDashboardLayout();
        this._lastSavedLayoutSignature =
          this.getStoredDashboardLayoutSignatureForMode(mode);
        this._activeDashboardLayoutMode = mode;
        this._suspendDashboardLayoutCapture = false;
      }

      if (isMobile) {
        this._dashboardGrid.enableResize(Boolean(this._layoutEditing));
        this._dashboardGrid.enableMove(false);
        if (this._layoutEditing) this.ensureMobileDashboardSortable();
        else this.destroyMobileDashboardSortable();
      } else {
        this.destroyMobileDashboardSortable();
        this._dashboardGrid.enableResize(Boolean(this._layoutEditing));
        this._dashboardGrid.enableMove(Boolean(this._layoutEditing));
      }

      this.applyWidgetAdaptiveScale();
      if (isMobile && !this._layoutEditing)
        this.scheduleMobileDashboardAutoSize();

      this.enforceDashboardWidgetConstraints();
    },

    applyDashboardLayout(layout = [], options = {}) {
      if (!this._dashboardGrid) return;
      const useLayout =
        Array.isArray(layout) && layout.length > 0 ? layout : [];
      const map = new Map(
        useLayout.map((entry) => [String(entry?.id || '').trim(), entry]),
      );
      const defaults = this.getDefaultDashboardGridLayout();
      const forcedCols = Number(options?.targetCols);
      const cols =
        Number.isFinite(forcedCols) && forcedCols > 0
          ? forcedCols
          : this.getDashboardActiveColumnCount();
      const workspace = this.getDashboardWorkspace();
      if (!workspace) return;
      const items = Array.from(
        workspace.querySelectorAll('.grid-stack-item[gs-id]'),
      );
      const normalizedForHealthCheck = [];
      items.forEach((item) => {
        const id = String(item.getAttribute('gs-id') || '').trim();
        if (!id) return;
        const saved = map.get(id);
        const fallback = defaults[id];
        const next = saved || fallback || { w: 4, h: 4 };
        const constraints = this.getDashboardWidgetConstraints(id);
        const nextX = Number(next.x);
        const nextY = Number(next.y);
        const clampedW = Math.min(
          constraints.maxW,
          Math.max(constraints.minW, Number(next.w) || constraints.minW),
        );
        const clampedH = Math.min(
          constraints.maxH,
          Math.max(constraints.minH, Number(next.h) || constraints.minH),
        );
        const clampedX = Number.isFinite(nextX)
          ? Math.min(Math.max(0, nextX), Math.max(0, cols - clampedW))
          : undefined;
        const clampedY = Number.isFinite(nextY)
          ? Math.min(
              Math.max(0, nextY),
              this.getDashboardMaxYForHeight(clampedH),
            )
          : undefined;
        normalizedForHealthCheck.push({
          id,
          x: Number.isFinite(clampedX) ? clampedX : 0,
          y: Number.isFinite(clampedY) ? clampedY : 0,
          w: clampedW,
          h: clampedH,
        });
        this._dashboardGrid.update(item, {
          x: clampedX,
          y: clampedY,
          w: clampedW,
          h: clampedH,
        });
      });

      if (useLayout.length > 0 && cols > 1) {
        const tinyCards = normalizedForHealthCheck.filter(
          (entry) => entry.w <= 2,
        ).length;
        const leftStack = normalizedForHealthCheck.filter(
          (entry) => entry.x === 0,
        ).length;
        const tooCompressed =
          tinyCards >= Math.ceil(normalizedForHealthCheck.length * 0.4) ||
          leftStack >= Math.ceil(normalizedForHealthCheck.length * 0.8);
        if (tooCompressed) {
          try {
            window.localStorage.removeItem(this.getDashboardLayoutStorageKey());
          } catch (_) {
            // ignore storage failures
          }
          this.applyDashboardLayout([], options);
          return;
        }
      }

      if (options.compact) {
        this._dashboardGrid.compact();
      }
      this.applyWidgetAdaptiveScale(items);
      this.updateDashboardHeightLimitFx();
    },

    enforceWidgetNoScroll(item) {
      if (!this._dashboardGrid || !item) return false;
      const node = item.gridstackNode;
      if (!node) return false;
      const widget = item.querySelector('.dashboard-widget[data-widget-id]');
      if (!widget) return false;

      const cellW = Math.max(
        1,
        Math.round(this._dashboardGrid.cellWidth() || 1),
      );
      const cellH = Math.max(
        1,
        Math.round(
          this._dashboardGrid.getCellHeight
            ? this._dashboardGrid.getCellHeight(true)
            : this._dashboardGrid.opts?.cellHeight || 1,
        ),
      );

      let w = Math.max(1, Number(node.w) || 1);
      let h = Math.max(1, Number(node.h) || 1);
      const minW = Math.max(1, Number(node.minW) || 1);
      const minH = Math.max(1, Number(node.minH) || 1);
      const maxW = Math.max(
        minW,
        Number(node.maxW) || this.getDashboardColumnCount(),
      );
      const maxH = Math.max(minH, Number(node.maxH) || 24);
      let changed = false;

      for (let i = 0; i < 8; i += 1) {
        const hasYOverflow = widget.scrollHeight > widget.clientHeight + 1;
        const hasXOverflow = widget.scrollWidth > widget.clientWidth + 1;
        if (!hasYOverflow && !hasXOverflow) break;

        let nextW = w;
        let nextH = h;
        if (hasXOverflow && nextW < maxW) {
          const needW = Math.ceil((widget.scrollWidth + 2) / cellW);
          nextW = Math.min(maxW, Math.max(nextW + 1, needW));
        }
        if (hasYOverflow && nextH < maxH) {
          const needH = Math.ceil((widget.scrollHeight + 2) / cellH);
          nextH = Math.min(maxH, Math.max(nextH + 1, needH));
        }
        if (nextW === w && nextH === h) break;
        this._dashboardGrid.update(item, { w: nextW, h: nextH });
        w = nextW;
        h = nextH;
        changed = true;
      }
      return changed;
    },

    applyWidgetAdaptiveScale(itemsOrItem = null) {
      const workspace = this.getDashboardWorkspace();
      if (!workspace) return;
      const lockMobileScale = this.isDashboardMobileViewport();
      const defaults = this.getDefaultDashboardGridLayout();
      let items = [];
      if (!itemsOrItem) {
        items = Array.from(
          workspace.querySelectorAll('.grid-stack-item[gs-id]'),
        );
      } else if (Array.isArray(itemsOrItem)) {
        items = itemsOrItem.filter(Boolean);
      } else {
        items = [itemsOrItem];
      }
      items.forEach((item) => {
        const node = item?.gridstackNode;
        if (!node) return;
        const id = String(item.getAttribute('gs-id') || '').trim();
        const widget = item.querySelector('.dashboard-widget[data-widget-id]');
        if (!id || !widget) return;
        if (lockMobileScale) {
          widget.style.setProperty('--widget-ui-scale', '1');
          return;
        }
        const base = defaults[id] || {
          w: Math.max(1, Number(node.w) || 1),
          h: Math.max(1, Number(node.h) || 1),
        };
        const wr =
          Math.max(1, Number(node.w) || 1) / Math.max(1, Number(base.w) || 1);
        const hr =
          Math.max(1, Number(node.h) || 1) / Math.max(1, Number(base.h) || 1);
        const areaRatio = Math.sqrt(Math.max(0.2, wr * hr));
        const scale = Math.max(0.5, Math.min(1.6, areaRatio));
        widget.style.setProperty('--widget-ui-scale', scale.toFixed(3));
      });
    },

    enforceAllWidgetsNoScroll() {
      const workspace = this.getDashboardWorkspace();
      if (!workspace || !this._dashboardGrid) return;
      const items = Array.from(
        workspace.querySelectorAll('.grid-stack-item[gs-id]'),
      );
      let changed = false;
      items.forEach((item) => {
        changed = this.enforceWidgetNoScroll(item) || changed;
      });
      if (changed) this._dashboardGrid.compact('compact', false);
      this.applyWidgetAdaptiveScale(items);
      this.updateDashboardHeightLimitFx();
    },

    persistDashboardLayout(options = {}) {
      const mode = this.getDashboardRuntimeLayoutMode();
      this._activeDashboardLayoutMode = mode;
      const layout = this.serializeDashboardLayout();
      const signature = this.getDashboardLayoutSignature(layout);
      const previous = String(
        this._lastSavedLayoutSignature ||
          this.getStoredDashboardLayoutSignatureForMode(mode) ||
          '',
      );
      const hasChanges = signature !== previous;
      try {
        window.localStorage.setItem(
          this.getDashboardLayoutStorageKey(mode),
          JSON.stringify({
            version: 3,
            savedAt: new Date().toISOString(),
            layout,
          }),
        );
      } catch (_) {
        return false;
      }
      this._sessionLayoutsByMode[mode] = layout;
      this._lastSavedLayoutSignature = signature;
      if (options.animate) this.playDashboardSaveAnimation();
      return true;
    },

    playDashboardSaveAnimation() {
      const shell = this.getDashboardShell();
      if (!shell) return;
      const widgets = Array.from(
        shell.querySelectorAll('.dashboard-widget[data-widget-id]'),
      );
      if (!widgets.length) return;
      widgets.forEach((widget) => {
        widget.classList.remove('dashboard-widget-saved');
        // force reflow so repeat saves replay animation
        void widget.offsetWidth;
        widget.classList.add('dashboard-widget-saved');
      });
      window.setTimeout(() => {
        widgets.forEach((widget) =>
          widget.classList.remove('dashboard-widget-saved'),
        );
      }, 820);
    },

    decorateDashboardWidgets() {
      const shell = this.getDashboardShell();
      if (!shell) return [];
      const widgets = Array.from(
        shell.querySelectorAll('.dashboard-widget[data-widget-id]'),
      );
      if (!widgets.length) return [];

      if (
        !this._defaultWidgetOrderByZone ||
        typeof this._defaultWidgetOrderByZone !== 'object'
      ) {
        this._defaultWidgetOrderByZone = { grid: this.getDefaultWidgetOrder() };
      }

      widgets.forEach((widget) => {
        if (!widget.querySelector('.dashboard-drag-surface')) {
          const dragSurface = document.createElement('div');
          dragSurface.className = 'dashboard-drag-surface';
          dragSurface.setAttribute('aria-hidden', 'true');
          widget.prepend(dragSurface);
        }
        if (!widget.querySelector('.dashboard-widget-controls')) {
          const controls = document.createElement('div');
          controls.className = 'dashboard-widget-controls';
          controls.setAttribute('data-no-sort', 'true');
          controls.innerHTML = `
            <button type="button" class="dashboard-widget-tool-btn dashboard-widget-handle" data-dashboard-widget-action="drag" title="Drag widget">
              <i class='bx bx-move'></i>
            </button>
            <button type="button" class="dashboard-widget-tool-btn" data-dashboard-widget-action="resize" title="Reset widget size">
              <i class='bx bx-reset'></i>
            </button>
          `;
          widget.prepend(controls);
        }
      });

      if (!shell.dataset.widgetEventsBound) {
        shell.dataset.widgetEventsBound = '1';
        shell.addEventListener('contextmenu', (event) => {
          const dragSurface = event.target.closest('.dashboard-drag-surface');
          if (!dragSurface) return;
          event.preventDefault();
        });
        shell.addEventListener('click', (event) => {
          const dragBtn = event.target.closest(
            '[data-dashboard-widget-action="drag"]',
          );
          if (dragBtn) {
            event.preventDefault();
            event.stopPropagation();
            this.setLayoutEditing(!this._layoutEditing);
            return;
          }

          const resizeBtn = event.target.closest(
            '[data-dashboard-widget-action="resize"]',
          );
          if (!resizeBtn) return;
          event.preventDefault();
          event.stopPropagation();
          const widget = resizeBtn.closest('.dashboard-widget[data-widget-id]');
          const id = String(
            widget?.getAttribute('data-widget-id') || '',
          ).trim();
          if (!id || !this._dashboardGrid) return;
          const defaults = this.getDefaultDashboardGridLayout();
          const item = widget.closest('.grid-stack-item');
          if (!item) return;
          const next = defaults[id] || { w: 4, h: 4 };
          this._dashboardGrid.update(item, {
            w: Math.max(1, Number(next.w) || 1),
            h: Math.max(1, Number(next.h) || 1),
          });
        });
      }

      return widgets;
    },

    ensureDashboardWorkspaceGrid() {
      const shell = this.getDashboardShell();
      if (!shell) return null;
      const toolbar = shell.querySelector('.dashboard-layout-toolbar');
      if (!toolbar) return null;
      let workspace = this.getDashboardWorkspace();
      if (!workspace) {
        workspace = document.createElement('div');
        workspace.id = 'dashboard-workspace-grid';
        workspace.className = 'grid-stack dashboard-workspace-grid';
        toolbar.insertAdjacentElement('afterend', workspace);
      }

      const widgets = Array.from(
        shell.querySelectorAll('.dashboard-widget[data-widget-id]'),
      );
      const defaultOrder = this.getDefaultWidgetOrder();
      widgets.sort((a, b) => {
        const aId = String(a.getAttribute('data-widget-id') || '').trim();
        const bId = String(b.getAttribute('data-widget-id') || '').trim();
        const aIndex = defaultOrder.indexOf(aId);
        const bIndex = defaultOrder.indexOf(bId);
        const safeA = aIndex >= 0 ? aIndex : 999;
        const safeB = bIndex >= 0 ? bIndex : 999;
        return safeA - safeB;
      });

      widgets.forEach((widget) => {
        const id = String(widget.getAttribute('data-widget-id') || '').trim();
        if (!id) return;
        let item = workspace.querySelector(`.grid-stack-item[gs-id="${id}"]`);
        if (!item) {
          item = document.createElement('div');
          item.className = 'grid-stack-item';
          item.setAttribute('gs-id', id);
          const constraints = this.getDashboardWidgetConstraints(id);
          item.setAttribute('gs-min-w', String(constraints.minW));
          item.setAttribute('gs-min-h', String(constraints.minH));
          item.setAttribute('gs-max-w', String(constraints.maxW));
          item.setAttribute('gs-max-h', String(constraints.maxH));
          const content = document.createElement('div');
          content.className =
            'grid-stack-item-content dashboard-grid-item-content';
          item.appendChild(content);
          workspace.appendChild(item);
        }
        const content = item.querySelector('.dashboard-grid-item-content');
        if (content && widget.parentElement !== content)
          content.appendChild(widget);
      });

      const cleanupSelectors = [
        '#dashboard-kpi-zone',
        '#dashboard-analytics-left-zone',
        '.dashboard-metrics-composite',
      ];
      cleanupSelectors.forEach((selector) => {
        const node = shell.querySelector(selector);
        if (!node || node === workspace || node === toolbar) return;
        if (node.contains(workspace)) return;
        if (!node.querySelector('.dashboard-widget[data-widget-id]')) {
          node.remove();
        }
      });
      return workspace;
    },

    resetDashboardLayout(options = {}) {
      if (!this._dashboardGrid) return;
      const mode = this.getDashboardRuntimeLayoutMode();
      this._activeDashboardLayoutMode = mode;
      this.applyDashboardLayout([], { compact: false });
      this._dashboardGrid.compact();
      this._sessionLayoutsByMode[mode] = this.serializeDashboardLayout();
      this._lastSavedLayoutSignature = this.getDashboardLayoutSignature();
      if (options.persist) {
        this.persistDashboardLayout({ animate: true });
      } else {
        try {
          window.localStorage.removeItem(
            this.getDashboardLayoutStorageKey(mode),
          );
        } catch (_) {
          // ignore storage failures
        }
      }
      notify('Dashboard layout reset to default.', 'success');
    },

    initSortableLayout() {
      if (!(window.GridStack && typeof window.GridStack.init === 'function')) {
        this._sortableReady = false;
        return;
      }
      const workspace = this.ensureDashboardWorkspaceGrid();
      if (!workspace) {
        this._sortableReady = false;
        return;
      }

      if (
        this._dashboardGrid &&
        typeof this._dashboardGrid.destroy === 'function'
      ) {
        this._dashboardGrid.destroy(false);
      }

      this._dashboardGrid = window.GridStack.init(
        {
          column: this.getDashboardColumnCount(),
          float: true,
          margin: 6,
          cellHeight: this.getDashboardCellHeight(),
          animate: false,
          disableOneColumnMode: true,
          minRow: 1,
          maxRow: this.getDashboardMaxRowsForPixelCap(),
          draggable: {
            handle: '.dashboard-drag-surface',
            cancel:
              'button, input, select, textarea, a, [role="button"], .dashboard-mode-controls, .dashboard-mode-btn, .dashboard-ops-btn, .dashboard-pill',
            pause: this.getDashboardDragPauseMs(),
            scroll: true,
          },
          resizable: {
            handles: 'n,e,s,w,se,sw,ne,nw',
          },
        },
        workspace,
      );
      this.syncDashboardGridVisualColumns(this.getDashboardColumnCount());

      this._dashboardGrid.on('dragstop', () => {
        this.enforceDashboardWidgetConstraints();
        if (this.shouldCaptureDashboardLayoutForMode()) {
          this._sessionLayoutsByMode[this.getDashboardLayoutMode()] =
            this.serializeDashboardLayout();
        }
        this.applyWidgetAdaptiveScale();
        this.updateDashboardHeightLimitFx();
      });
      this._dashboardGrid.on('resizestop', (_event, element) => {
        this.enforceDashboardWidgetConstraints();
        if (this.isDashboardMobileViewport()) {
          this.applyMobileDashboardStackFromDom();
        } else {
          this.reflowDesktopDashboardYAxis();
        }
        if (this.shouldCaptureDashboardLayoutForMode()) {
          this._sessionLayoutsByMode[this.getDashboardLayoutMode()] =
            this.serializeDashboardLayout();
        }
        this.applyWidgetAdaptiveScale(element || null);
        this.updateDashboardHeightLimitFx();
      });
      this._dashboardGrid.on('change', (_event, changedItems) => {
        if (this.shouldCaptureDashboardLayoutForMode()) {
          this._sessionLayoutsByMode[this.getDashboardLayoutMode()] =
            this.serializeDashboardLayout();
        }
        this.applyWidgetAdaptiveScale(
          Array.isArray(changedItems)
            ? changedItems.map((node) => node?.el).filter(Boolean)
            : null,
        );
        this.updateDashboardHeightLimitFx();
      });

      window.setTimeout(() => {
        this.applyWidgetAdaptiveScale();
        this.updateDashboardHeightLimitFx();
      }, 60);
      if (!this._dashboardResponsiveResizeBound) {
        this._dashboardResponsiveResizeBound = true;
        window.addEventListener(
          'resize',
          () => {
            if (!this._dashboardGrid) return;
            this._dashboardGrid.opts.draggable.pause =
              this.getDashboardDragPauseMs();
            this.applyDashboardDragPauseToItems();
            this.applyDashboardResponsiveGridMode();
          },
          { passive: true },
        );
      }
      this._dashboardGrid.opts.draggable.pause = this.getDashboardDragPauseMs();
      this.applyDashboardDragPauseToItems();
      this.applyDashboardResponsiveGridMode({ forceLoad: true });
      this.setLayoutEditing(false);
      this._sortableReady = true;
    },

    applyTooltips() {
      if (typeof window.tippy !== 'function') return;
      const tips = [
        [
          '#dashboard-total-net',
          'Total combined income (sales + logbook) for selected day.',
        ],
        [
          '#dashboard-active-members',
          'Checked-in members today divided by total members.',
        ],
        [
          '#dashboard-busiest-hour',
          'Time above threshold (>5 active check-ins).',
        ],
        [
          '#dashboard-products-qty-sold',
          'Total quantity sold from sales records today.',
        ],
        ['#dashboard-sales-income', 'Sales-only income for selected range.'],
        [
          '#dashboard-logbook-income',
          'Logbook-only paid income for selected range.',
        ],
        [
          '#dashboard-mode-controls',
          'Select dashboard range mode: daily, weekly, monthly, yearly.',
        ],
        [
          '#dashboard-products-income-mode',
          'Current range applied to products income share.',
        ],
        [
          '#dashboard-members-attendance-mode',
          'Current range applied to member attendance share.',
        ],
      ];
      tips.forEach(([selector, content]) => {
        const node = document.querySelector(selector);
        if (!node) return;
        node.setAttribute('data-tippy-content', content);
      });

      const nodes = Array.from(
        document.querySelectorAll('[data-tippy-content]'),
      );
      nodes.forEach((node) => {
        if (node.dataset.tippyBound === '1') return;
        window.tippy(node, {
          theme: 'light-border',
          animation: 'shift-away-subtle',
          delay: [90, 40],
          maxWidth: 280,
          appendTo: () => document.body,
        });
        node.dataset.tippyBound = '1';
      });
      this._tippyReady = true;
    },

    async initDashboardWorkspace() {
      this.decorateDashboardWidgets();
      await this.ensureDashboardEnhancers();
      this.initSortableLayout();
      this.applyTooltips();
      if (!this._sortableReady) {
        notify('Dashboard grid engine unavailable in this session.', 'warning');
      }
    },

    toDateKey(dateLike) {
      const date = new Date(dateLike);
      if (Number.isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    formatHourLabel(hour) {
      const safeHour = Number.isFinite(Number(hour)) ? Number(hour) : 0;
      const display = safeHour % 12 || 12;
      const meridian = safeHour >= 12 ? 'PM' : 'AM';
      return `${display}:00 ${meridian}`;
    },

    getHybridMode() {
      const mode = String(this._dashboardMode || '').toLowerCase();
      return this._hybridModes.includes(mode) ? mode : 'weekly';
    },

    getProductsPieMode() {
      return this.getHybridMode();
    },

    setDashboardMode(mode, options = {}) {
      const normalized = String(mode || '').toLowerCase();
      if (!this._hybridModes.includes(normalized)) return;
      const previous = this.getHybridMode();
      if (previous === normalized) return;
      this._dashboardMode = normalized;

      document.querySelectorAll('[data-dashboard-mode]').forEach((button) => {
        const btnMode = String(
          button.getAttribute('data-dashboard-mode') || '',
        ).toLowerCase();
        button.classList.toggle('is-active', btnMode === normalized);
      });

      if (options.withPulse) {
        const hybridPanel = document.getElementById('dashboard-hybrid-panel');
        const productsPanel = document.getElementById(
          'dashboard-products-income-panel',
        );
        [hybridPanel, productsPanel].forEach((panel) => {
          if (!panel) return;
          panel.classList.add('is-switching');
          window.setTimeout(() => panel.classList.remove('is-switching'), 320);
        });
      }

      if (options.withAudio && previous !== normalized && window.wolfAudio) {
        window.wolfAudio.play('notif');
      }
      this.load();
    },

    loadBusyHourTracker() {
      try {
        const raw = window.localStorage.getItem(LOCAL_DASH_BUSY_HOUR_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return {
          currentSessionStart: parsed?.currentSessionStart || null,
          currentSessionMaxActive: toNumber(
            parsed?.currentSessionMaxActive || 0,
          ),
          records: Array.isArray(parsed?.records) ? parsed.records : [],
        };
      } catch (_) {
        return {
          currentSessionStart: null,
          currentSessionMaxActive: 0,
          records: [],
        };
      }
    },

    saveBusyHourTracker(state) {
      try {
        window.localStorage.setItem(
          LOCAL_DASH_BUSY_HOUR_KEY,
          JSON.stringify({
            currentSessionStart: state?.currentSessionStart || null,
            currentSessionMaxActive: toNumber(
              state?.currentSessionMaxActive || 0,
            ),
            records: Array.isArray(state?.records)
              ? state.records.slice(-180)
              : [],
          }),
        );
      } catch (_) {
        // ignore storage write failure
      }
    },

    updateBusyHourTracker(activeCount, now = new Date()) {
      const threshold = 5;
      const state = this.loadBusyHourTracker();
      const isAboveThreshold = toNumber(activeCount) > threshold;

      if (isAboveThreshold && !state.currentSessionStart) {
        state.currentSessionStart = now.toISOString();
        state.currentSessionMaxActive = toNumber(activeCount);
      } else if (isAboveThreshold && state.currentSessionStart) {
        state.currentSessionMaxActive = Math.max(
          toNumber(state.currentSessionMaxActive || 0),
          toNumber(activeCount),
        );
      } else if (!isAboveThreshold && state.currentSessionStart) {
        const startedAt = new Date(state.currentSessionStart);
        const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
        const durationHours = elapsedMs / 3600000;
        if (durationHours > 0) {
          const record = {
            date: startedAt.toISOString().slice(0, 10),
            start_iso: startedAt.toISOString(),
            end_iso: now.toISOString(),
            duration_hours: Number(durationHours.toFixed(3)),
            peak_active: Math.max(
              0,
              Math.round(state.currentSessionMaxActive || 0),
            ),
          };
          state.records.push(record);
        }
        state.currentSessionStart = null;
        state.currentSessionMaxActive = 0;
      }

      state.records = (state.records || []).slice(-180);
      this.saveBusyHourTracker(state);
      return state;
    },

    renderBusyHourArea(records = []) {
      const svgEl = document.getElementById('dashboard-busiest-area-chart');
      const axisEl = document.getElementById('dashboard-busiest-axis');
      const metaEl = document.getElementById('dashboard-busiest-back-meta');
      if (!svgEl || !axisEl || !metaEl) return;

      const byDate = new Map();
      (records || []).forEach((entry) => {
        const key = String(entry?.date || '').trim();
        if (!key) return;
        const prev = byDate.get(key) || { date: key, duration: 0, peak: 0 };
        prev.duration = Math.max(
          prev.duration,
          toNumber(entry?.duration_hours),
        );
        prev.peak = Math.max(prev.peak, toNumber(entry?.peak_active));
        byDate.set(key, prev);
      });

      const series = Array.from(byDate.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);

      if (!series.length) {
        svgEl.innerHTML = `
          <polygon points="0,100 100,100 100,100 0,100" fill="rgba(42,178,247,0.16)"></polygon>
          <polyline points="0,100 100,100" fill="none" stroke="rgba(148,163,184,0.55)" stroke-width="1.2"></polyline>
        `;
        axisEl.innerHTML = Array.from({ length: 7 })
          .map(() => '<span>--</span>')
          .join('');
        metaEl.textContent = 'No recorded peak day yet';
        return;
      }

      const maxVal = Math.max(...series.map((s) => s.duration), 0.1);
      const points = series.map((item, idx) => {
        const x = series.length > 1 ? (idx / (series.length - 1)) * 100 : 50;
        const y = 100 - (item.duration / maxVal) * 100;
        return { x, y };
      });
      const polyline = points
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(' ');
      const polygon = `0,100 ${polyline} 100,100`;

      svgEl.innerHTML = `
        <defs>
          <linearGradient id="busyAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(42,178,247,0.48)"></stop>
            <stop offset="100%" stop-color="rgba(42,178,247,0.08)"></stop>
          </linearGradient>
        </defs>
        <polygon points="${polygon}" fill="url(#busyAreaGradient)"></polygon>
        <polyline points="${polyline}" fill="none" stroke="#8dd9ff" stroke-width="1.45"></polyline>
      `;

      axisEl.innerHTML = series
        .map((item) => {
          const dt = new Date(item.date);
          const label = Number.isNaN(dt.getTime())
            ? item.date.slice(5)
            : dt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });
          return `<span>${escapeHtml(label)}</span>`;
        })
        .join('');

      const best = series.reduce(
        (top, row) => (row.duration > top.duration ? row : top),
        series[0],
      );
      metaEl.textContent = `${best.date} | ${best.duration.toFixed(1)}h above threshold | peak ${Math.round(best.peak)} active`;
    },

    setBusiestActiveHourFromTracker(logRows = []) {
      const valueEl = document.getElementById('dashboard-busiest-hour');
      const metaEl = document.getElementById('dashboard-busiest-hour-meta');
      if (!valueEl || !metaEl) return;

      const activeNow = (logRows || []).filter((row) => !row?.time_out).length;
      const now = new Date();
      const state = this.updateBusyHourTracker(activeNow, now);

      if (state.currentSessionStart) {
        const startedAt = new Date(state.currentSessionStart);
        const elapsedHours = Math.max(
          0,
          (now.getTime() - startedAt.getTime()) / 3600000,
        );
        valueEl.textContent = `${elapsedHours.toFixed(1)}h`;
        metaEl.textContent = `${activeNow} active check-ins | threshold >5`;
      } else {
        const bestRecord = (state.records || []).slice().sort((a, b) => {
          if (toNumber(b.duration_hours) !== toNumber(a.duration_hours)) {
            return toNumber(b.duration_hours) - toNumber(a.duration_hours);
          }
          return toNumber(b.peak_active) - toNumber(a.peak_active);
        })[0];

        if (bestRecord) {
          valueEl.textContent = `${toNumber(bestRecord.duration_hours).toFixed(1)}h`;
          metaEl.textContent = `${bestRecord.date} | peak ${Math.round(toNumber(bestRecord.peak_active))} active`;
        } else {
          valueEl.textContent = '0.0h';
          metaEl.textContent = 'Waiting for >5 active check-ins';
        }
      }

      this.renderBusyHourArea(state.records || []);
    },

    getHybridRange(now, mode) {
      const today = getManilaRangeStart(now);
      const tomorrow = getManilaRangeEnd(now);
      if (mode === 'daily') {
        return {
          start: today,
          end: tomorrow,
          mode,
          label: 'Today (24 hours)',
        };
      }
      if (mode === 'monthly') {
        return {
          start: getMonthStart(now),
          end: tomorrow,
          mode,
          label: `${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        };
      }
      if (mode === 'yearly') {
        const start = new Date(today.getFullYear(), 0, 1);
        return {
          start,
          end: tomorrow,
          mode,
          label: `${today.getFullYear()}`,
        };
      }
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return {
        start,
        end: tomorrow,
        mode: 'weekly',
        label: 'Last 7 days',
      };
    },

    getRowIncomeValue(row) {
      const total = toNumber(row?.total_amount);
      if (total > 0) return total;
      const qty = toNumber(row?.qty);
      const unitPrice = toNumber(row?.unit_price);
      const paidAmount = toNumber(row?.paid_amount);
      if (paidAmount > 0) return paidAmount;
      if (row?.is_paid) return toNumber(row?.entry_fee);
      return qty * unitPrice;
    },

    buildHybridSeries(rows = [], mode, anchorDate = new Date()) {
      const today = getRangeStart(anchorDate);
      const labels = [];
      const series = [];
      const buckets = [];

      if (mode === 'daily') {
        for (let hour = 0; hour < 24; hour += 1) {
          labels.push(`${String(hour).padStart(2, '0')}:00`);
          buckets.push({ hour });
          series.push(0);
        }
      } else if (mode === 'monthly') {
        const monthStart = getMonthStart(anchorDate);
        const cursor = new Date(monthStart);
        while (cursor <= today) {
          labels.push(String(cursor.getDate()).padStart(2, '0'));
          buckets.push({ key: this.toDateKey(cursor) });
          series.push(0);
          cursor.setDate(cursor.getDate() + 1);
        }
      } else if (mode === 'yearly') {
        for (let m = 0; m < 12; m += 1) {
          const dt = new Date(today.getFullYear(), m, 1);
          labels.push(
            dt.toLocaleDateString('en-US', {
              month: 'short',
            }),
          );
          buckets.push({ month: m, year: dt.getFullYear() });
          series.push(0);
        }
      } else {
        for (let offset = 6; offset >= 0; offset -= 1) {
          const dt = new Date(today);
          dt.setDate(today.getDate() - offset);
          labels.push(
            dt.toLocaleDateString('en-US', {
              weekday: 'short',
            }),
          );
          buckets.push({ key: this.toDateKey(dt) });
          series.push(0);
        }
      }

      (rows || []).forEach((row) => {
        const parsed = parseRowDate(row, ['created_at', 'time_in']);
        if (!parsed) return;
        const income = this.getRowIncomeValue(row);
        if (income <= 0) return;

        if (mode === 'daily') {
          const hour = parsed.getHours();
          if (hour >= 0 && hour < series.length) series[hour] += income;
          return;
        }
        if (mode === 'monthly' || mode === 'weekly') {
          const key = this.toDateKey(parsed);
          const idx = buckets.findIndex((b) => b.key === key);
          if (idx >= 0) series[idx] += income;
          return;
        }
        if (mode === 'yearly') {
          const idx = buckets.findIndex(
            (b) =>
              b.year === parsed.getFullYear() && b.month === parsed.getMonth(),
          );
          if (idx >= 0) series[idx] += income;
        }
      });

      return {
        labels,
        values: series,
      };
    },

    renderHybridChart(rows = [], mode = 'weekly', rangeMeta = null) {
      const barsEl = document.getElementById('dashboard-hybrid-bars');
      const xAxisEl = document.getElementById('dashboard-hybrid-x-axis');
      const yAxisEl = document.getElementById('dashboard-hybrid-y-axis');
      const svgEl = document.getElementById('dashboard-hybrid-svg');
      const gridEl = document.getElementById('dashboard-hybrid-grid');
      const captionEl = document.getElementById('dashboard-week-caption');
      const modeEl = document.getElementById('dashboard-hybrid-mode');
      const plotEl = document.querySelector('.dashboard-hybrid-plot');
      if (!barsEl || !xAxisEl || !yAxisEl || !svgEl || !gridEl) return;

      const chart = this.buildHybridSeries(rows, mode, new Date());
      const values = chart.values || [];
      const labels = chart.labels || [];
      const maxRaw = Math.max(...values, 0);
      const maxVal = maxRaw > 0 ? Math.ceil(maxRaw / 100) * 100 : 100;

      const modeLabelMap = {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly',
      };
      if (modeEl) modeEl.textContent = modeLabelMap[mode] || 'Weekly';
      const opsChartModeEl = document.getElementById(
        'dashboard-ops-chart-mode',
      );
      if (opsChartModeEl)
        opsChartModeEl.textContent = modeLabelMap[mode] || 'Weekly';

      const yTicks = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0];
      yAxisEl.innerHTML = yTicks
        .map((value) => `<span>${escapeHtml(formatCurrency(value))}</span>`)
        .join('');
      gridEl.innerHTML =
        '<span></span><span></span><span></span><span></span><span></span>';

      const columns = Math.max(1, labels.length);
      barsEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
      xAxisEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

      barsEl.innerHTML = values
        .map((value, idx) => {
          const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
          const height = `${Math.max(6, Math.round(pct))}%`;
          return `<div class="dashboard-hybrid-bar" style="--h:${height}; --i:${idx}" title="${escapeHtml(formatCurrency(value))}"></div>`;
        })
        .join('');

      xAxisEl.innerHTML = labels
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join('');

      const points = values.map((value, idx) => {
        const x = values.length > 1 ? (idx / (values.length - 1)) * 100 : 50;
        const y = maxVal > 0 ? 100 - (value / maxVal) * 100 : 100;
        return { x, y, value };
      });

      const plotBox = svgEl.getBoundingClientRect();
      const ratioFix =
        plotBox.width > 0 && plotBox.height > 0
          ? plotBox.height / plotBox.width
          : 0.2;
      const dotRy = 1.05;
      const dotRx = Math.max(0.28, dotRy * ratioFix);

      const pointsText = points
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(' ');
      const areaPoints = `0,100 ${pointsText} 100,100`;
      const dots = points
        .map(
          (p) =>
            `<ellipse class="dashboard-hybrid-dot" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" rx="${dotRx.toFixed(3)}" ry="${dotRy.toFixed(3)}"></ellipse>`,
        )
        .join('');

      svgEl.innerHTML = `
        <defs>
          <linearGradient id="dashboardHybridAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(42,178,247,0.42)"></stop>
            <stop offset="100%" stop-color="rgba(239,68,68,0.08)"></stop>
          </linearGradient>
        </defs>
        <polygon class="dashboard-hybrid-area" points="${areaPoints}"></polygon>
        <polyline class="dashboard-hybrid-line-glow" points="${pointsText}"></polyline>
        <polyline class="dashboard-hybrid-line" points="${pointsText}"></polyline>
        ${dots}
      `;

      const total = values.reduce((sum, value) => sum + value, 0);
      if (captionEl) {
        const scope = rangeMeta?.label || '';
        captionEl.textContent = `${scope} | Total ${formatCurrency(total)}`;
      }

      if (plotEl) {
        plotEl.classList.remove('is-animating');
        void plotEl.offsetWidth;
        plotEl.classList.add('is-animating');
        window.setTimeout(() => plotEl.classList.remove('is-animating'), 760);
      }
    },

    renderPieChart({
      donutEl,
      legendEl,
      captionEl,
      items = [],
      valueFormatter = (v) => String(v),
      totalFormatter = (v) => String(v),
      totalLabel = 'Total',
      emptyText = 'No data yet',
    }) {
      if (!donutEl || !legendEl) return;
      const palette = [
        '#2ab2f7',
        '#ef4444',
        '#22c55e',
        '#f59e0b',
        '#8b5cf6',
        '#14b8a6',
        '#f97316',
        '#6366f1',
      ];

      const normalized = (items || [])
        .map((item) => ({
          name: String(item?.name || 'Unknown'),
          value: toNumber(item?.value),
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);

      if (!normalized.length) {
        donutEl.style.background =
          'conic-gradient(rgba(100,116,139,0.42) 0 100%)';
        donutEl.innerHTML = `<div class="dashboard-pie-center"><strong>0</strong><span>${escapeHtml(totalLabel)}</span></div>`;
        legendEl.innerHTML = `
          <div class="dashboard-pie-row">
            <span class="dashboard-pie-dot" style="background:#64748b"></span>
            <span class="dashboard-pie-name">${escapeHtml(emptyText)}</span>
            <span class="dashboard-pie-value">${escapeHtml(valueFormatter(0))}</span>
          </div>
        `;
        if (captionEl) captionEl.textContent = emptyText;
        return;
      }

      const collapsed = normalized.slice(0, 6);
      const overflow = normalized.slice(6);
      if (overflow.length) {
        collapsed.push({
          name: `Other (${overflow.length})`,
          value: overflow.reduce((sum, item) => sum + item.value, 0),
        });
      }

      const total = collapsed.reduce((sum, item) => sum + item.value, 0);
      let cursor = 0;
      const gradientParts = collapsed.map((item, index) => {
        const share = total > 0 ? (item.value / total) * 100 : 0;
        const start = cursor;
        const end = Math.min(100, cursor + share);
        cursor = end;
        item.share = share;
        item.color = palette[index % palette.length];
        return `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
      });

      donutEl.style.background = `conic-gradient(${gradientParts.join(',')})`;
      donutEl.innerHTML = `
        <div class="dashboard-pie-center">
          <strong>${escapeHtml(totalFormatter(total))}</strong>
          <span>${escapeHtml(totalLabel)}</span>
        </div>
      `;

      legendEl.innerHTML = collapsed
        .map(
          (item) => `
            <div class="dashboard-pie-row">
              <span class="dashboard-pie-dot" style="background:${item.color}"></span>
              <span class="dashboard-pie-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
              <span class="dashboard-pie-value">${escapeHtml(valueFormatter(item.value))}</span>
            </div>
          `,
        )
        .join('');

      if (captionEl) {
        captionEl.textContent = `${collapsed.length} segment${collapsed.length === 1 ? '' : 's'} | ${totalFormatter(total)}`;
      }
    },

    renderProductsIncomePie(
      monthSalesRows = [],
      products = [],
      mode = 'monthly',
      rangeMeta = null,
    ) {
      const donutEl = document.getElementById('dashboard-products-income-pie');
      const legendEl = document.getElementById(
        'dashboard-products-income-legend',
      );
      const captionEl = document.getElementById(
        'dashboard-products-income-caption',
      );
      const modeEl = document.getElementById('dashboard-products-income-mode');
      if (!donutEl || !legendEl) return;

      const modeLabelMap = {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly',
      };
      if (modeEl) modeEl.textContent = modeLabelMap[mode] || 'Monthly';
      const opsProductsModeEl = document.getElementById(
        'dashboard-ops-products-mode',
      );
      if (opsProductsModeEl) {
        opsProductsModeEl.textContent = modeLabelMap[mode] || 'Monthly';
      }

      const productNameMap = new Map(
        (products || []).map((row) => [
          String(row?.productid || '').trim(),
          String(row?.name || row?.sku || 'UNKNOWN PRODUCT'),
        ]),
      );

      const grouped = new Map();
      (monthSalesRows || []).forEach((row) => {
        const productId = String(row?.product_id || '').trim();
        if (!productId) return;
        const qty = Math.max(1, toNumber(row?.qty));
        const amount =
          toNumber(row?.total_amount) > 0
            ? toNumber(row?.total_amount)
            : qty * toNumber(row?.unit_price);
        grouped.set(productId, (grouped.get(productId) || 0) + amount);
      });

      const items = Array.from(grouped.entries()).map(([productId, value]) => ({
        name:
          productNameMap.get(productId) ||
          `PRODUCT ${productId.slice(0, 8).toUpperCase()}`,
        value,
      }));

      this.renderPieChart({
        donutEl,
        legendEl,
        captionEl,
        items,
        valueFormatter: (v) => formatCurrency(v),
        totalFormatter: (v) => formatCurrency(v),
        totalLabel: 'Income',
        emptyText: `No product sales in ${String(modeLabelMap[mode] || 'selected period').toLowerCase()}`,
      });

      const pieLayout = donutEl.closest('.dashboard-pie-layout');
      if (pieLayout) pieLayout.classList.toggle('is-empty', items.length === 0);
      if (captionEl && rangeMeta?.label) {
        const raw = captionEl.textContent || '';
        captionEl.textContent = `${rangeMeta.label} | ${raw}`;
      }
    },

    renderMembersAttendancePie(
      logRows = [],
      membersRows = [],
      mode = 'weekly',
      rangeMeta = null,
    ) {
      const donutEl = document.getElementById(
        'dashboard-members-attendance-pie',
      );
      const legendEl = document.getElementById(
        'dashboard-members-attendance-legend',
      );
      const captionEl = document.getElementById(
        'dashboard-members-attendance-caption',
      );
      const modeEl = document.getElementById(
        'dashboard-members-attendance-mode',
      );
      const titleEl = document.getElementById(
        'dashboard-members-attendance-title',
      );
      if (!donutEl || !legendEl) return;

      const modeLabelMap = {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly',
      };
      if (modeEl) modeEl.textContent = modeLabelMap[mode] || 'Weekly';
      if (titleEl)
        titleEl.textContent = `Member Attendance Share (${modeLabelMap[mode] || 'Weekly'})`;

      const activeMembers = (membersRows || []).filter(
        (row) => row?.is_active !== false,
      );
      const memberMap = new Map();
      activeMembers.forEach((row) => {
        const profileKey = String(row?.profile_id || '').trim();
        const memberKey = String(row?.member_id || '').trim();
        const label = String(
          row?.full_name || row?.member_code || row?.sku || 'UNKNOWN MEMBER',
        );
        if (profileKey) memberMap.set(profileKey, label);
        if (memberKey) memberMap.set(memberKey, label);
      });

      const attendance = new Map();
      (logRows || []).forEach((row) => {
        const key = String(
          row?.profile_id || row?.member_id || row?.member_code || '',
        ).trim();
        if (!key) return;
        if (memberMap.size > 0 && !memberMap.has(key)) return;
        attendance.set(key, (attendance.get(key) || 0) + 1);
      });

      const items = Array.from(attendance.entries()).map(([key, value]) => ({
        name: memberMap.get(key) || `MEMBER ${key.slice(0, 8).toUpperCase()}`,
        value,
      }));

      this.renderPieChart({
        donutEl,
        legendEl,
        captionEl,
        items,
        valueFormatter: (v) =>
          `${Math.round(v)} check-in${Math.round(v) === 1 ? '' : 's'}`,
        totalFormatter: (v) => `${Math.round(v)}`,
        totalLabel: 'Check-ins',
        emptyText: `No member attendance in ${String(modeLabelMap[mode] || 'selected period').toLowerCase()}`,
      });

      const pieLayout = donutEl.closest('.dashboard-pie-layout');
      if (pieLayout) pieLayout.classList.toggle('is-empty', items.length === 0);
      if (captionEl && rangeMeta?.label) {
        const raw = captionEl.textContent || '';
        captionEl.textContent = `${rangeMeta.label} | ${raw}`;
      }
    },

    renderWeekChart(rows = []) {
      const barsEl = document.getElementById('dashboard-week-bars');
      const labelsEl = document.getElementById('dashboard-week-labels');
      const captionEl = document.getElementById('dashboard-week-caption');
      if (!barsEl || !labelsEl) return;

      const today = getManilaRangeStart(new Date());
      const days = [];
      for (let offset = 6; offset >= 0; offset -= 1) {
        const day = new Date(today);
        day.setDate(today.getDate() - offset);
        const key = this.toDateKey(day);
        const dayTotal = (rows || []).reduce((sum, row) => {
          const parsed = parseRowDate(row, ['created_at', 'time_in']);
          if (!parsed || this.toDateKey(parsed) !== key) return sum;
          const total = toNumber(row.total_amount);
          if (total > 0) return sum + total;
          const qty = toNumber(row.qty);
          const unitPrice = toNumber(row.unit_price);
          const paidAmount = toNumber(row.paid_amount);
          if (paidAmount > 0) return sum + paidAmount;
          if (row.is_paid) return sum + toNumber(row.entry_fee);
          return sum + qty * unitPrice;
        }, 0);
        days.push({
          key,
          label: day.toLocaleDateString('en-US', { weekday: 'short' }),
          total: dayTotal,
        });
      }

      const maxTotal = Math.max(...days.map((day) => day.total), 0);
      barsEl.innerHTML = days
        .map((day, index) => {
          const ratio = maxTotal > 0 ? day.total / maxTotal : 0;
          const height = `${Math.max(10, Math.round(ratio * 100))}%`;
          return `<div class="dashboard-week-bar" style="--bar-height:${height}; --bar-delay:${index * 0.06}s" title="${day.label}: ${formatCurrency(day.total)}"></div>`;
        })
        .join('');
      labelsEl.innerHTML = days
        .map((day) => `<span>${escapeHtml(day.label)}</span>`)
        .join('');

      const weekTotal = days.reduce((sum, day) => sum + day.total, 0);
      if (captionEl) {
        captionEl.textContent =
          weekTotal > 0
            ? `Total ${formatCurrency(weekTotal)}`
            : 'No revenue this week';
      }
    },

    renderTopProducts(salesRows = [], products = []) {
      const listEl = document.getElementById('dashboard-top-products');
      if (!listEl) return;

      const productNameMap = new Map(
        (products || []).map((row) => [
          String(row?.productid || '').trim(),
          String(row?.name || row?.sku || 'UNKNOWN PRODUCT'),
        ]),
      );

      const grouped = new Map();
      (salesRows || []).forEach((row) => {
        const productId = String(row?.product_id || '').trim() || 'unknown';
        const entry = grouped.get(productId) || { qty: 0, amount: 0 };
        const qty = Math.max(1, toNumber(row.qty));
        const amount =
          toNumber(row.total_amount) > 0
            ? toNumber(row.total_amount)
            : qty * toNumber(row.unit_price);
        entry.qty += qty;
        entry.amount += amount;
        grouped.set(productId, entry);
      });

      const ranked = Array.from(grouped.entries())
        .map(([productId, stat]) => ({
          productId,
          qty: stat.qty,
          amount: stat.amount,
          name:
            productNameMap.get(productId) ||
            String(
              productId === 'unknown'
                ? 'UNLINKED PRODUCT'
                : `PRODUCT ${productId.slice(0, 8).toUpperCase()}`,
            ),
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      if (!ranked.length) {
        listEl.innerHTML = `
          <div class="dashboard-product-row">
            <strong>No product activity yet</strong>
            <span>${formatCurrency(0)}</span>
          </div>
        `;
        return;
      }

      listEl.innerHTML = ranked
        .map(
          (item) => `
            <div class="dashboard-product-row">
              <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
              <span>${formatCurrency(item.amount)} | x${Math.round(item.qty)}</span>
            </div>
          `,
        )
        .join('');
    },

    setPeakHour(logRows = []) {
      const hourEl = document.getElementById('dashboard-peak-hour');
      const countEl = document.getElementById('dashboard-peak-count');
      if (!hourEl || !countEl) return;

      const buckets = new Array(24).fill(0);
      const activeRows = (logRows || []).filter((row) => !row?.time_out);
      activeRows.forEach((row) => {
        const parsed = parseRowDate(row, ['time_in', 'created_at']);
        if (!parsed) return;
        buckets[parsed.getHours()] += 1;
      });

      let bestHour = -1;
      let bestCount = 0;
      buckets.forEach((count, hour) => {
        if (count > bestCount) {
          bestCount = count;
          bestHour = hour;
        }
      });

      if (bestHour < 0 || bestCount < 1) {
        hourEl.textContent = 'N/A';
        countEl.textContent = '0';
        return;
      }

      hourEl.textContent = this.formatHourLabel(bestHour);
      countEl.textContent = String(bestCount);
    },

    setBusiestActiveHour(logRows = []) {
      const valueEl = document.getElementById('dashboard-busiest-hour');
      const metaEl = document.getElementById('dashboard-busiest-hour-meta');
      if (!valueEl || !metaEl) return;

      const buckets = new Array(24).fill(0);
      const activeRows = (logRows || []).filter((row) => !row?.time_out);

      activeRows.forEach((row) => {
        const parsed = parseRowDate(row, ['time_in', 'created_at']);
        if (!parsed) return;
        buckets[parsed.getHours()] += 1;
      });

      let bestHour = -1;
      let bestCount = 0;
      buckets.forEach((count, hour) => {
        if (count > bestCount) {
          bestCount = count;
          bestHour = hour;
        }
      });

      if (bestHour < 0 || bestCount < 1) {
        valueEl.textContent = 'N/A';
        metaEl.textContent = '0 active check-ins';
        return;
      }

      valueEl.textContent = this.formatHourLabel(bestHour);
      metaEl.textContent = `${bestCount} active check-in${bestCount === 1 ? '' : 's'}`;
    },

    downloadSnapshot() {
      const payload = this._lastPayload;
      if (!payload) {
        notify('Dashboard report is not ready yet.', 'warning');
        return;
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const dateStamp = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `dashboard-report-${dateStamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      notify('Dashboard report downloaded.', 'success');
    },

    async init() {
      const root = document.getElementById('page-wrapper');
      if (!root) return;
      this.bindActions();
      await this.load();
      await this.initDashboardWorkspace();
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
      const todayStart = getManilaRangeStart(now);
      const tomorrowStart = getManilaRangeEnd(now);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 6);
      const weekEnd = new Date(tomorrowStart);
      const hybridMode = this.getHybridMode();
      const hybridRange = this.getHybridRange(now, hybridMode);
      const dashboardMode = this.getProductsPieMode();
      const dashboardRange = this.getHybridRange(now, dashboardMode);

      const earliestStart = new Date(
        Math.min(
          yesterdayStart.getTime(),
          weekStart.getTime(),
          hybridRange.start.getTime(),
          dashboardRange.start.getTime(),
        ),
      );
      const earliestStartIso = earliestStart.toISOString();
      const tomorrowStartIso = tomorrowStart.toISOString();

      const [
        salesRangeResult,
        logbookRangeResult,
        membersRowsResult,
        productsResult,
      ] = await Promise.all([
        fetchRowsByDateRange(
          client,
          'sales',
          'id,product_id,total_amount,qty,unit_price,created_at',
          earliestStartIso,
          tomorrowStartIso,
          ['created_at'],
        ),
        fetchDashboardLogbookRows(client, earliestStartIso, tomorrowStartIso),
        client.from('members').select('*'),
        client.from('products').select('productid,name,sku'),
      ]);

      const allSalesRows = salesRangeResult.data || [];
      const allLogbookRows = logbookRangeResult.data || [];

      const todaySnapshot = buildRevenueSnapshotFromRows(
        allSalesRows,
        allLogbookRows,
        todayStart,
        tomorrowStart,
        { includeRows: true },
      );
      const yesterdaySnapshot = buildRevenueSnapshotFromRows(
        allSalesRows,
        allLogbookRows,
        yesterdayStart,
        todayStart,
      );
      const weekSalesRows = filterRowsByDateRange(
        allSalesRows,
        weekStart,
        weekEnd,
        ['created_at'],
      );
      const weekLogRows = filterRowsByDateRange(
        allLogbookRows,
        weekStart,
        weekEnd,
        ['time_in', 'created_at'],
      );
      const hybridSalesRows = filterRowsByDateRange(
        allSalesRows,
        hybridRange.start,
        hybridRange.end,
        ['created_at'],
      );
      const hybridLogRows = filterRowsByDateRange(
        allLogbookRows,
        hybridRange.start,
        hybridRange.end,
        ['time_in', 'created_at'],
      );
      const dashboardSalesRows = filterRowsByDateRange(
        allSalesRows,
        dashboardRange.start,
        dashboardRange.end,
        ['created_at'],
      );
      const dashboardLogRows = filterRowsByDateRange(
        allLogbookRows,
        dashboardRange.start,
        dashboardRange.end,
        ['time_in', 'created_at'],
      );

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
      const busiestHourEl = document.getElementById('dashboard-busiest-hour');
      const salesIncomeEl = document.getElementById('dashboard-sales-income');
      const logbookIncomeEl = document.getElementById(
        'dashboard-logbook-income',
      );
      const salesCountEl = document.getElementById('dashboard-sales-count');
      const logbookCountEl = document.getElementById('dashboard-logbook-count');
      const peakWindowEl = document.getElementById('dashboard-peak-window');
      const productsQtyEl = document.getElementById(
        'dashboard-products-qty-sold',
      );

      const totalMembers = (membersRowsResult.data || []).length;
      const activeMemberSet = new Set(
        (todaySnapshot.logbookRows || [])
          .map((row) => String(row?.profile_id || row?.member_id || '').trim())
          .filter(Boolean),
      );
      const soldQtyToday = (todaySnapshot.salesRows || []).reduce(
        (sum, row) => sum + Math.max(1, toNumber(row?.qty)),
        0,
      );

      totalEl.textContent = formatCurrency(todayTotal);
      if (productsEl)
        productsEl.textContent = formatCurrency(todaySnapshot.salesAmount);
      if (logsEl)
        logsEl.textContent = formatCurrency(todaySnapshot.logbookAmount);
      if (salesIncomeEl)
        salesIncomeEl.textContent = formatCurrency(todaySnapshot.salesAmount);
      if (logbookIncomeEl)
        logbookIncomeEl.textContent = formatCurrency(
          todaySnapshot.logbookAmount,
        );
      if (salesCountEl)
        salesCountEl.textContent = String(todaySnapshot.salesCount || 0);
      if (logbookCountEl)
        logbookCountEl.textContent = String(todaySnapshot.trafficCount || 0);
      if (membersEl)
        membersEl.textContent = `${activeMemberSet.size}/${totalMembers}`;
      if (busiestHourEl)
        this.setBusiestActiveHourFromTracker(todaySnapshot.logbookRows || []);
      if (productsQtyEl)
        productsQtyEl.textContent = String(Math.round(soldQtyToday));
      if (peakWindowEl) peakWindowEl.textContent = 'Today (check-ins)';

      if (trendEl) {
        const absPct = Math.abs(deltaPct).toFixed(1);
        const isUp = deltaPct >= 0;
        const iconClass = isUp ? 'bx-trending-up' : 'bx-trending-down';
        const iconColor = isUp ? '#22c55e' : 'var(--accent-red)';
        let trendLabel = `${absPct}% VS YESTERDAY`;
        if (yesterdayTotal <= 0 && todayTotal > 0) {
          trendLabel = 'NEW REVENUE ACTIVITY TODAY';
        } else {
          trendLabel = `${absPct}% VS YESTERDAY`;
        }
        trendEl.innerHTML = `<i id="dashboard-trend-icon" class="bx ${iconClass}" style="color:${iconColor}"></i> ${escapeHtml(trendLabel)}`;
      }

      const weekRows = [...weekSalesRows, ...weekLogRows];
      const hybridRows = [...hybridSalesRows, ...hybridLogRows];
      this.renderHybridChart(hybridRows, hybridMode, hybridRange);
      this.setPeakHour(todaySnapshot.logbookRows || []);
      this.renderTopProducts(
        todaySnapshot.salesRows || [],
        productsResult.data || [],
      );
      this.renderProductsIncomePie(
        dashboardSalesRows,
        productsResult.data || [],
        dashboardMode,
        dashboardRange,
      );
      this.renderMembersAttendancePie(
        dashboardLogRows,
        membersRowsResult.data || [],
        dashboardMode,
        dashboardRange,
      );

      this._lastPayload = {
        generated_at: new Date().toISOString(),
        summary: {
          total_income_today: todayTotal,
          sales_income_today: todaySnapshot.salesAmount,
          logbook_income_today: todaySnapshot.logbookAmount,
          sales_transactions_today: todaySnapshot.salesCount,
          logbook_entries_today: todaySnapshot.trafficCount,
          members_total: totalMembers,
          active_members_today: activeMemberSet.size,
          products_qty_sold_today: Math.round(soldQtyToday),
          delta_vs_yesterday_percent: Number(deltaPct.toFixed(2)),
        },
        week_income_rows: weekRows,
        month_sales_rows: dashboardSalesRows,
        month_logbook_rows: dashboardLogRows,
        today_sales_rows: todaySnapshot.salesRows || [],
        today_logbook_rows: todaySnapshot.logbookRows || [],
      };

      const opsLastUpdateEl = document.getElementById(
        'dashboard-ops-last-update',
      );
      if (opsLastUpdateEl) {
        opsLastUpdateEl.textContent = new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
      if (this.isDashboardMobileViewport() && !this._layoutEditing) {
        this.scheduleMobileDashboardAutoSize();
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

      if (
        this.customRangePicker &&
        typeof this.customRangePicker.destroy === 'function'
      ) {
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
          const endIso = this.toIsoDate(selectedDates[1] || selectedDates[0]);
          if (!startIso || !endIso) return;
          startInput.value = startIso;
          endInput.value = endIso;
          this.syncCustomRangeDisplay(startIso, endIso);
        },
      });

      this.customRangePicker = Array.isArray(instances)
        ? instances[0]
        : instances;

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
        window.localStorage.setItem(
          LOCAL_GOAL_CUSTOM_KEY,
          JSON.stringify(payload),
        );
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
          (Number.isFinite(bStart) ? bStart : 0) -
            (Number.isFinite(aStart) ? aStart : 0) ||
          (Number.isFinite(bCreated) ? bCreated : 0) -
            (Number.isFinite(aCreated) ? aCreated : 0) ||
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
      const quarterStart = new Date(
        now.getFullYear(),
        Math.floor(now.getMonth() / 3) * 3,
        1,
      );
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
        QUARTERLY:
          quarterlySnapshot.salesAmount + quarterlySnapshot.logbookAmount,
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
        const pct =
          target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
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
              Math.round(
                (customEnd.getTime() - customStart.getTime()) / 86400000,
              ) + 1,
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
      const customStartInput = document.getElementById(
        'goal-custom-start-input',
      );
      const customEndInput = document.getElementById('goal-custom-end-input');
      if (customInput && !customInput.value) {
        customInput.value = String(customConfig.target_amount);
      }
      if (customStartInput)
        customStartInput.value = String(customConfig.start_date || '');
      if (customEndInput)
        customEndInput.value = String(customConfig.end_date || '');
      this.syncCustomRangeDisplay(
        customConfig.start_date,
        customConfig.end_date,
      );
      if (
        this.customRangePicker &&
        typeof this.customRangePicker.setDate === 'function'
      ) {
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
            const id = String(
              toggleBtn.getAttribute('data-feedback-toggle-id') || '',
            );
            if (!id) return;
            if (this.expandedEntryIds.has(id)) this.expandedEntryIds.delete(id);
            else this.expandedEntryIds.add(id);
            this.render();
            return;
          }

          const removeTagBtn = event.target.closest(
            '[data-feedback-tag-remove]',
          );
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
          const summary = event.target.closest(
            '.feedback-row-summary[data-feedback-toggle-id]',
          );
          if (!summary) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          const id = String(
            summary.getAttribute('data-feedback-toggle-id') || '',
          );
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
            const unreadEntries = visibleEntries.filter(
              (entry) => !entry.is_read,
            );
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
      const value = String(message || '')
        .trim()
        .replace(/\s+/g, ' ');
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
      const optionsEl = document.querySelector(
        '#feedback-page .feedback-compose-options',
      );
      if (optionsEl) optionsEl.innerHTML = this.getComposeOptionsHtml();

      const chipsEl = document.querySelector(
        '#feedback-page .feedback-compose-chip-row',
      );
      if (chipsEl) chipsEl.innerHTML = this.getComposeChipsHtml();

      const countEl = document.querySelector(
        '#feedback-page .feedback-compose-count',
      );
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
          const code = String(row.sku || '')
            .trim()
            .toUpperCase();
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
          const code = String(row.sku || '')
            .trim()
            .toUpperCase();
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
          const title = String(
            row.full_name || code || 'UNKNOWN MEMBER',
          ).trim();
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
          const title = String(
            row.full_name || code || 'UNKNOWN MEMBER',
          ).trim();
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
      if (
        equipmentsResult.error &&
        isMissingColumnError(equipmentsResult.error)
      ) {
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
        notify(
          'Read entries are locked and cannot be deleted manually.',
          'warning',
        );
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

      let response = await client
        .from('feedback_entries')
        .delete()
        .eq('id', entry.id);
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
            if (typeof window.handleLogout === 'function')
              window.handleLogout();
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

          const editUserBtn = event.target.closest(
            '[data-settings-user-edit-id]',
          );
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

          const deleteUserBtn = event.target.closest(
            '[data-settings-user-delete-id]',
          );
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
      let displayName =
        window.localStorage.getItem(SETTINGS_DISPLAY_NAME_KEY) || '';

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

      if (profileNameEl)
        profileNameEl.textContent = String(displayName).toUpperCase();
      if (profileRoleEl) profileRoleEl.textContent = roleText;
      if (profileEmailEl) profileEmailEl.textContent = email || 'N/A';
      if (displayInput) displayInput.value = displayName;
      if (email)
        window.localStorage.setItem(SETTINGS_DISPLAY_NAME_KEY, displayName);

      const sidebarName = document.querySelector('#wolfSidebar .user-name');
      const sidebarEmail = document.querySelector('#wolfSidebar .user-email');
      if (sidebarName)
        sidebarName.textContent = String(displayName).toUpperCase();
      if (sidebarEmail && email) sidebarEmail.textContent = email;
    },

    applyAccessPolicy() {
      this.access = getAccessFlags();
      const root = document.querySelector('.settings-wrapper');
      const tabs = document.getElementById('settings-tabs');
      const usersTabBtn = document.querySelector('[data-settings-tab="users"]');
      const usersPanel = document.querySelector(
        '[data-settings-tab-panel="users"]',
      );
      const maintenanceCard = document.getElementById(
        'settings-maintenance-card',
      );
      const superadminNote = document.getElementById(
        'settings-superadmin-note',
      );
      const usersPermission = document.getElementById(
        'settings-users-permission',
      );
      const adminLimitNote = document.getElementById(
        'settings-admin-limit-note',
      );

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
        adminLimitNote.textContent = `ADMIN LIMIT: UP TO ${this.maxAdmins} ADMIN ACCOUNTS ONLY (INCLUDING SUPERADMIN).`;
      }
    },

    setActiveTab(tabName = 'personalize') {
      const normalized = String(tabName || 'personalize').toLowerCase();
      document.querySelectorAll('[data-settings-tab-btn]').forEach((button) => {
        const isActive =
          String(button.getAttribute('data-settings-tab') || '') === normalized;
        button.classList.toggle('is-active', isActive);
      });

      document
        .querySelectorAll('[data-settings-tab-panel]')
        .forEach((panel) => {
          const isActive =
            String(panel.getAttribute('data-settings-tab-panel') || '') ===
            normalized;
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
      document.documentElement.style.setProperty(
        '--wolf-ui-scale-factor',
        String(scale),
      );
      const valueLabel = document.getElementById('settings-ui-scale-value');
      if (valueLabel) valueLabel.textContent = `${normalized}%`;
      return normalized;
    },

    async resetToDefaults() {
      const proceed = await confirmAction({
        title: 'Reset settings to defaults?',
        text: 'This will reset action sounds, victory visuals, and interface scale to default values.',
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
        this.canCreateAccounts = Boolean(
          payload?.permissions?.canCreateAccounts,
        );
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

        const usedDefaultPassword = Boolean(
          payload?.defaults?.usedDefaultPassword,
        );
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
              document.getElementById('settings-edit-display-name')?.value ||
                '',
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
        nextRole = String(result.value.role || '')
          .trim()
          .toLowerCase();
        nextPassword = String(result.value.password || '').trim();
      } else {
        const rolePrompt = window.prompt(
          `Role for ${entry.email} (admin/staff):`,
          nextRole,
        );
        if (rolePrompt === null) return;
        nextRole = String(rolePrompt || '')
          .trim()
          .toLowerCase();
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
