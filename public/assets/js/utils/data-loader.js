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
  currentLedgerPage: 1,
  ledgerPageSize: 12,
  currentLedgerRows: [],
  lastTotal: 0,
  activeAF: null, // store active auto-filter
  lastTraffic: 0,
  summaryHUDReady: false,
  currencySymbol: '₱',
  defaultWalkInFee: 80,
  goalTargets: {
    DAILY: 0,
    WEEKLY: 0,
    MONTHLY: 0,
    QUARTERLY: 0,
    YEARLY: 0,
    CUSTOM: 0,
  },
  goalActuals: {
    DAILY: 0,
    WEEKLY: 0,
    MONTHLY: 0,
    QUARTERLY: 0,
    YEARLY: 0,
    CUSTOM: 0,
  },
  targetCycle: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'],
  targetModeIndex: 0,
  targetBoxBound: false,
  targetDisplayPct: {
    DAILY: 0,
    WEEKLY: 0,
    MONTHLY: 0,
    QUARTERLY: 0,
    YEARLY: 0,
    CUSTOM: 0,
  },
  targetLastActual: {
    DAILY: null,
    WEEKLY: null,
    MONTHLY: null,
    QUARTERLY: null,
    YEARLY: null,
    CUSTOM: null,
  },
  targetSyncTimer: null,
  targetFxTimers: [],
  targetValueAF: null,
  targetDisplayedActual: {
    DAILY: 0,
    WEEKLY: 0,
    MONTHLY: 0,
    QUARTERLY: 0,
    YEARLY: 0,
    CUSTOM: 0,
  },
  goalReachedCelebrated: {
    DAILY: false,
    WEEKLY: false,
    MONTHLY: false,
    QUARTERLY: false,
    YEARLY: false,
    CUSTOM: false,
  },
  targetThemeWatchBound: false,
  targetThemeObserver: null,
  targetCinematicHideTimer: null,
  targetCinematicStartTimer: null,
  targetCinematicAF: null,
  formatCurrency(value = 0) {
    return `${this.currencySymbol}${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  },
  getLocalGoalTargetMap() {
    const map = {};
    try {
      const raw = localStorage.getItem('wolf_local_goal_targets');
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return map;
      list.forEach((row) => {
        const period = String(row?.period_type || '')
          .trim()
          .toUpperCase();
        if (!period) return;
        map[period] = Number(row?.target_amount || 0);
      });
    } catch (_) {
      return map;
    }
    return map;
  },
  getCustomGoalConfig() {
    const now = new Date();
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 14);
    try {
      const raw = localStorage.getItem('wolf_local_goal_custom_config');
      const parsed = raw ? JSON.parse(raw) : {};
      const targetAmount = Number(parsed?.target_amount || 0);
      const startDate = String(parsed?.start_date || start.toISOString().slice(0, 10));
      const endDate = String(parsed?.end_date || end.toISOString().slice(0, 10));
      return {
        target_amount: targetAmount > 0 ? targetAmount : 50000,
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
  isoDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  formatServerClock(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '--:--';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(date);
  },
  isMoneyMode() {
    return this.activeMode === 'sales' || this.activeMode === 'logbook';
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
    const isMoneyMode = this.isMoneyMode();

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = progress * (end - start) + start;

      // Update Text
      if (isMoneyMode) {
        el.textContent = this.formatCurrency(val);
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

    // B. First render for this page mode: set baseline without animation.
    if (!this.summaryHUDReady) {
      this.lastTotal = targetValue;
      el.textContent = this.isMoneyMode()
        ? this.formatCurrency(targetValue)
        : targetValue;
      this.summaryHUDReady = true;
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

    // Keep sidebar target widget in sync with the current rotation mode.
    this.updateTargetBox();
  },

  async loadGoalTargets() {
    if (!window.supabaseClient) return;

    const localTargetMap = this.getLocalGoalTargetMap();
    Object.keys(localTargetMap).forEach((period) => {
      this.goalTargets[period] = Number(localTargetMap[period] || 0);
    });

    const periods = ['DAILY', 'WEEKLY', 'MONTHLY'];
    for (const period of periods) {
      const { data, error } = await supabaseClient
        .from('goal_target')
        .select('*')
        .eq('period_type', period)
        .limit(200);

      if (!error && Array.isArray(data) && data.length > 0) {
        const latest = data
          .slice()
          .sort((a, b) => {
            const aStart = new Date(a?.start_date || 0).getTime();
            const bStart = new Date(b?.start_date || 0).getTime();
            const aUpdated = new Date(
              a?.updated_at || a?.created_at || 0,
            ).getTime();
            const bUpdated = new Date(
              b?.updated_at || b?.created_at || 0,
            ).getTime();
            return (
              (Number.isFinite(bStart) ? bStart : 0) -
                (Number.isFinite(aStart) ? aStart : 0) ||
              (Number.isFinite(bUpdated) ? bUpdated : 0) -
                (Number.isFinite(aUpdated) ? aUpdated : 0)
            );
          })[0];
        this.goalTargets[period] = Number(latest?.target_amount || 0);
      }
    }

    const monthly = Number(this.goalTargets.MONTHLY || 0);
    const weekly = Number(this.goalTargets.WEEKLY || 0);
    if (!Number(this.goalTargets.QUARTERLY || 0)) {
      this.goalTargets.QUARTERLY = monthly > 0 ? monthly * 3 : weekly * 13;
    }
    if (!Number(this.goalTargets.YEARLY || 0)) {
      this.goalTargets.YEARLY = monthly > 0 ? monthly * 12 : weekly * 52;
    }
    const customCfg = this.getCustomGoalConfig();
    this.goalTargets.CUSTOM = Number(customCfg.target_amount || 0);

    await this.loadGoalActuals();
    this.bindTargetBoxSelector();
    this.bindTargetThemeObserver();
    this.ensureTargetCinematicOverlay();
    this.updateTargetBox();
  },

  async loadGoalActuals() {
    if (!window.supabaseClient) return;
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(dayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1);
    const quarterStart = new Date(
      dayStart.getFullYear(),
      Math.floor(dayStart.getMonth() / 3) * 3,
      1,
    );
    const yearStart = new Date(dayStart.getFullYear(), 0, 1);
    const customCfg = this.getCustomGoalConfig();
    const customStart = new Date(customCfg.start_date);
    customStart.setHours(0, 0, 0, 0);
    const customEnd = new Date(customCfg.end_date);
    customEnd.setHours(0, 0, 0, 0);
    if (customEnd.getTime() < customStart.getTime()) {
      customEnd.setTime(customStart.getTime());
    }
    const customEndExclusive = new Date(customEnd);
    customEndExclusive.setDate(customEndExclusive.getDate() + 1);
    const ranges = {
      DAILY: [dayStart.toISOString(), tomorrow.toISOString()],
      WEEKLY: [weekStart.toISOString(), tomorrow.toISOString()],
      MONTHLY: [monthStart.toISOString(), tomorrow.toISOString()],
      QUARTERLY: [quarterStart.toISOString(), tomorrow.toISOString()],
      YEARLY: [yearStart.toISOString(), tomorrow.toISOString()],
      CUSTOM: [customStart.toISOString(), customEndExclusive.toISOString()],
    };

    const sumSales = async (startIso, endIso) => {
      const { data, error } = await supabaseClient
        .from('sales')
        .select('total_amount,qty,unit_price,created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso);
      if (error || !Array.isArray(data)) return 0;
      return data.reduce((sum, row) => {
        const total = Number(row.total_amount || 0);
        if (total > 0) return sum + total;
        return sum + Number(row.qty || 0) * Number(row.unit_price || 0);
      }, 0);
    };

    const sumLogbook = async (startIso, endIso) => {
      const { data, error } = await supabaseClient
        .from('check_in_logs')
        .select('entry_fee,paid_amount,is_paid,time_in')
        .gte('time_in', startIso)
        .lt('time_in', endIso);
      if (error || !Array.isArray(data)) return 0;
      return data.reduce((sum, row) => {
        const paidAmount = Number(row.paid_amount || 0);
        if (paidAmount > 0) return sum + paidAmount;
        if (row.is_paid) return sum + Number(row.entry_fee || 0);
        return sum;
      }, 0);
    };

    for (const period of this.targetCycle) {
      const [startIso, endIso] = ranges[period];
      const [salesTotal, logbookTotal] = await Promise.all([
        sumSales(startIso, endIso),
        sumLogbook(startIso, endIso),
      ]);
      this.goalActuals[period] = Number(salesTotal || 0) + Number(logbookTotal || 0);
    }
  },

  getCurrentTargetPeriod() {
    return this.targetCycle[this.targetModeIndex] || 'DAILY';
  },

  setTargetPeriod(period) {
    const normalized = String(period || '')
      .trim()
      .toUpperCase();
    const idx = this.targetCycle.indexOf(normalized);
    if (idx < 0) return;
    this.targetModeIndex = idx;
    this.updateTargetBox({ animate: false });
  },

  bindTargetBoxSelector() {
    if (this.targetBoxBound) return;
    const select = document.getElementById('sidebar-target-select');
    if (!select) return;
    this.targetBoxBound = true;
    select.addEventListener('change', (event) => {
      const next = String(event?.target?.value || '').toUpperCase();
      this.setTargetPeriod(next);
    });
  },

  clearTargetFxTimers() {
    if (!Array.isArray(this.targetFxTimers)) return;
    this.targetFxTimers.forEach((id) => clearTimeout(id));
    this.targetFxTimers = [];
  },

  getTargetThemePalette() {
    const isLight = document.body.classList.contains('light-theme');
    if (isLight) {
      return {
        active: '#2a8dff',
        glow: 'rgba(42, 141, 255, 0.62)',
      };
    }
    return {
      active: '#ff3b30',
      glow: 'rgba(255, 59, 48, 0.75)',
    };
  },

  bindTargetThemeObserver() {
    if (this.targetThemeWatchBound) return;
    this.targetThemeWatchBound = true;
    const body = document.body;
    if (!body || typeof MutationObserver === 'undefined') return;
    this.targetThemeObserver = new MutationObserver(() => {
      this.updateTargetBox({ animate: false });
    });
    this.targetThemeObserver.observe(body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  },

  ensureTargetCinematicOverlay() {
    let el = document.getElementById('wolf-target-cinematic');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'wolf-target-cinematic';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="wtc-head">
        <div class="wtc-label" id="wolf-target-cinematic-label">TARGET UPDATE</div>
        <div class="wtc-value" id="wolf-target-cinematic-value">0%</div>
      </div>
      <div class="wtc-track">
        <div class="wtc-ghost" id="wolf-target-cinematic-ghost"></div>
        <div class="wtc-fill" id="wolf-target-cinematic-fill"></div>
      </div>
      <div class="wtc-state" id="wolf-target-cinematic-state">SYNCHRONIZING</div>
    `;
    document.body.appendChild(el);
    return el;
  },

  renderTargetCinematic({
    period,
    pct,
    previousPct,
    actual,
    previousActual = actual,
    target,
    isGain,
    isDrop,
    animate = true,
  }) {
    const overlay = this.ensureTargetCinematicOverlay();
    if (!overlay) return;
    const labelEl = document.getElementById('wolf-target-cinematic-label');
    const valueEl = document.getElementById('wolf-target-cinematic-value');
    const stateEl = document.getElementById('wolf-target-cinematic-state');
    const fillEl = document.getElementById('wolf-target-cinematic-fill');
    const ghostEl = document.getElementById('wolf-target-cinematic-ghost');
    if (!valueEl || !fillEl || !ghostEl) return;

    const labelMap = {
      DAILY: 'TODAY TARGET',
      WEEKLY: 'THIS WEEK TARGET',
      MONTHLY: 'THIS MONTH TARGET',
      QUARTERLY: 'THIS QUARTER TARGET',
      YEARLY: 'THIS YEAR TARGET',
      CUSTOM: 'CUSTOM TARGET',
    };
    if (labelEl) labelEl.textContent = `${labelMap[period] || 'TARGET'} UPDATE`;
    valueEl.textContent = `${Math.round(previousPct)}% -> ${Math.round(pct)}%  |  ${this.formatCurrency(previousActual)} -> ${this.formatCurrency(actual)}`;
    if (stateEl) {
      stateEl.textContent = isGain
        ? 'INCOME RISING'
        : isDrop
          ? 'INCOME DROP DETECTED'
          : 'SYNCHRONIZED';
    }

    overlay.classList.toggle('is-light', document.body.classList.contains('light-theme'));
    overlay.classList.toggle('is-gain', Boolean(isGain));
    overlay.classList.toggle('is-drop', Boolean(isDrop));

    if (!animate) {
      fillEl.style.width = `${pct}%`;
      ghostEl.style.width = `${pct}%`;
      ghostEl.style.opacity = '0';
      return;
    }

    if (this.targetCinematicStartTimer) clearTimeout(this.targetCinematicStartTimer);
    if (this.targetCinematicHideTimer) clearTimeout(this.targetCinematicHideTimer);
    if (this.targetCinematicAF) {
      cancelAnimationFrame(this.targetCinematicAF);
      this.targetCinematicAF = null;
    }
    overlay.classList.add('is-active');

    const fromPct = Number.isFinite(Number(previousPct)) ? Number(previousPct) : pct;
    const toPct = Number.isFinite(Number(pct)) ? Number(pct) : fromPct;
    fillEl.style.transition = 'none';
    fillEl.style.width = `${fromPct}%`;
    ghostEl.style.transition = 'none';
    ghostEl.style.width = `${fromPct}%`;
    ghostEl.style.opacity = isDrop ? '0.92' : '0';
    void fillEl.offsetWidth;

    const duration = isDrop ? 1250 : 1100;
    const delay = 180;
    const startTs = performance.now() + delay;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    this.targetCinematicStartTimer = setTimeout(() => {
      const tick = (ts) => {
        const t = Math.min(1, (ts - startTs) / duration);
        const eased = easeOut(Math.max(0, t));
        const currentPct = fromPct + (toPct - fromPct) * eased;
        fillEl.style.width = `${currentPct}%`;
        if (isDrop) {
          ghostEl.style.width = `${fromPct + (toPct - fromPct) * eased}%`;
          ghostEl.style.opacity = `${0.92 * (1 - eased)}`;
        }
        const currentActual = previousActual + (actual - previousActual) * eased;
        valueEl.textContent = `${Math.round(fromPct + (toPct - fromPct) * eased)}% -> ${Math.round(toPct)}%  |  ${this.formatCurrency(currentActual)} -> ${this.formatCurrency(actual)}`;

        if (t < 1) {
          this.targetCinematicAF = requestAnimationFrame(tick);
        } else {
          this.targetCinematicAF = null;
          ghostEl.style.opacity = '0';
        }
      };
      this.targetCinematicAF = requestAnimationFrame(tick);
    }, delay);

    this.targetCinematicHideTimer = setTimeout(() => {
      overlay.classList.remove('is-active', 'is-gain', 'is-drop');
    }, duration + delay + 700);
  },

  scheduleGoalActualsSync(delayMs = 260) {
    if (this.targetSyncTimer) clearTimeout(this.targetSyncTimer);
    this.targetSyncTimer = setTimeout(async () => {
      try {
        await this.loadGoalActuals();
        this.updateTargetBox({ animate: true });
      } catch (err) {
        console.error('Wolf OS Target Sync Fault:', err);
      }
    }, delayMs);
  },

  clearTargetValueAnimation() {
    if (this.targetValueAF) {
      cancelAnimationFrame(this.targetValueAF);
      this.targetValueAF = null;
    }
  },

  animateTargetReadout({
    fromActual,
    toActual,
    fromPct,
    toPct,
    target,
    percentEl,
    amountEl,
    duration = 520,
  }) {
    this.clearTargetValueAnimation();
    const startTs = performance.now();
    const easeOut = (t) => 1 - (1 - t) * (1 - t);

    const frame = (ts) => {
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = easeOut(t);
      const shownActual = fromActual + (toActual - fromActual) * eased;
      const shownPct = fromPct + (toPct - fromPct) * eased;
      if (percentEl) percentEl.textContent = `${Math.round(shownPct)}%`;
      if (amountEl) {
        amountEl.textContent = `${this.formatCurrency(shownActual)} / ${this.formatCurrency(target)}`;
      }
      if (t < 1) {
        this.targetValueAF = requestAnimationFrame(frame);
      } else {
        this.targetValueAF = null;
      }
    };

    this.targetValueAF = requestAnimationFrame(frame);
  },

  updateTargetBox(options = {}) {
    const { animate = true } = options;
    const period = this.getCurrentTargetPeriod();
    const target = Number(this.goalTargets?.[period] || 0);
    const actual = Number(this.goalActuals?.[period] || 0);
    const percentEl = document.getElementById('sidebar-target-percent');
    const barEl = document.getElementById('sidebar-target-bar');
    const ghostEl = document.getElementById('sidebar-target-ghost');
    const boxEl = document.getElementById('sidebar-target-box');
    const labelEl = document.getElementById('sidebar-target-label');
    const stateEl = document.getElementById('sidebar-target-state');
    const amountEl = document.getElementById('sidebar-target-amount');
    if (!percentEl || !barEl || !boxEl) return;

    const labelMap = {
      DAILY: 'TODAY TARGET',
      WEEKLY: 'THIS WEEK TARGET',
      MONTHLY: 'THIS MONTH TARGET',
      QUARTERLY: 'THIS QUARTER TARGET',
      YEARLY: 'THIS YEAR TARGET',
      CUSTOM: 'CUSTOM TARGET',
    };
    if (labelEl) labelEl.textContent = labelMap[period] || 'TARGET';
    const selectEl = document.getElementById('sidebar-target-select');
    if (selectEl && selectEl.value !== period) selectEl.value = period;

    const palette = this.getTargetThemePalette();
    boxEl.style.setProperty('--target-active-color', palette.active);
    boxEl.style.setProperty('--target-glow-color', palette.glow);
    boxEl.style.setProperty('--target-warn-color', '#ff2d2d');
    boxEl.classList.remove(
      'target-gaining',
      'target-dropping',
      'target-drop-warning',
      'target-changing',
    );
    this.clearTargetFxTimers();

    if (target <= 0) {
      this.clearTargetValueAnimation();
      percentEl.textContent = '0%';
      barEl.style.width = '0%';
      if (ghostEl) {
        ghostEl.style.width = '0%';
        ghostEl.style.opacity = '0';
      }
      if (stateEl) stateEl.textContent = `ACTIVE: ${period}`;
      if (amountEl) {
        amountEl.textContent = `${this.formatCurrency(actual)} / ${this.formatCurrency(0)}`;
      }
      this.targetDisplayPct[period] = 0;
      this.targetLastActual[period] = actual;
      this.targetDisplayedActual[period] = actual;
      this.renderTargetCinematic({
        period,
        pct: 0,
        previousPct: 0,
        actual,
        previousActual: actual,
        target: 0,
        isGain: false,
        isDrop: false,
        animate: false,
      });
      return;
    }

    const pct = Math.min(100, Math.max(0, (actual / target) * 100));
    const previousActual =
      this.targetLastActual?.[period] === null ||
      this.targetLastActual?.[period] === undefined
        ? actual
        : Number(this.targetLastActual[period]);
    const previousPct =
      this.targetDisplayPct?.[period] === null ||
      this.targetDisplayPct?.[period] === undefined
        ? pct
        : Number(this.targetDisplayPct[period]);
    const crossedGoal = previousPct < 100 && pct >= 100;

    if (stateEl) {
      stateEl.textContent = `${pct >= 100 ? 'REACHED' : 'ACTIVE'}: ${period}`;
    }
    const previousShownActual =
      this.targetDisplayedActual?.[period] === null ||
      this.targetDisplayedActual?.[period] === undefined
        ? previousActual
        : Number(this.targetDisplayedActual[period]);

    if (!animate || actual === previousActual) {
      this.clearTargetValueAnimation();
      percentEl.textContent = `${Math.round(pct)}%`;
      if (amountEl) {
        amountEl.textContent = `${this.formatCurrency(actual)} / ${this.formatCurrency(target)}`;
      }
      barEl.style.width = `${pct}%`;
      if (ghostEl) {
        ghostEl.style.width = `${pct}%`;
        ghostEl.style.opacity = '0';
      }
      this.targetDisplayPct[period] = pct;
      this.targetLastActual[period] = actual;
      this.targetDisplayedActual[period] = actual;
      this.renderTargetCinematic({
        period,
        pct,
        previousPct: pct,
        actual,
        previousActual: actual,
        target,
        isGain: false,
        isDrop: false,
        animate: false,
      });
      return;
    }

    this.animateTargetReadout({
      fromActual: previousShownActual,
      toActual: actual,
      fromPct: previousPct,
      toPct: pct,
      target,
      percentEl,
      amountEl,
      duration: actual > previousActual ? 560 : 520,
    });
    boxEl.classList.add('target-changing');
    const changeTimer = setTimeout(() => {
      boxEl.classList.remove('target-changing');
    }, 720);
    this.targetFxTimers.push(changeTimer);

    if (actual > previousActual) {
      if (ghostEl) {
        ghostEl.style.width = `${pct}%`;
        ghostEl.style.opacity = '0';
      }
      barEl.style.width = `${pct}%`;
      boxEl.classList.add('target-gaining');
      const gainTimer = setTimeout(() => {
        boxEl.classList.remove('target-gaining');
      }, 520);
      this.targetFxTimers.push(gainTimer);
      this.renderTargetCinematic({
        period,
        pct,
        previousPct,
        actual,
        previousActual,
        target,
        isGain: true,
        isDrop: false,
        animate: true,
      });
    } else {
      boxEl.classList.add('target-dropping', 'target-drop-warning');
      if (ghostEl) {
        ghostEl.style.transition = 'none';
        ghostEl.style.width = `${previousPct}%`;
        ghostEl.style.opacity = '0.95';
        void ghostEl.offsetWidth;
      }

      barEl.style.width = `${pct}%`;

      const warnTimer = setTimeout(() => {
        boxEl.classList.remove('target-drop-warning');
      }, 220);
      this.targetFxTimers.push(warnTimer);

      if (ghostEl) {
        const driftTimer = setTimeout(() => {
          ghostEl.style.transition =
            'width 0.95s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.95s ease';
          ghostEl.style.width = `${pct}%`;
          ghostEl.style.opacity = '0';
        }, 26);
        this.targetFxTimers.push(driftTimer);
      }

      const dropTimer = setTimeout(() => {
        boxEl.classList.remove('target-dropping');
      }, 980);
      this.targetFxTimers.push(dropTimer);
      this.renderTargetCinematic({
        period,
        pct,
        previousPct,
        actual,
        previousActual,
        target,
        isGain: false,
        isDrop: true,
        animate: true,
      });
    }

    this.targetDisplayPct[period] = pct;
    this.targetLastActual[period] = actual;
    this.targetDisplayedActual[period] = actual;

    if (pct < 100) {
      this.goalReachedCelebrated[period] = false;
    } else if (crossedGoal && !this.goalReachedCelebrated[period]) {
      this.goalReachedCelebrated[period] = true;
      if (window.wolfAudio) window.wolfAudio.play('confetti');
    }
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
    this.scheduleGoalActualsSync();

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
    this.scheduleGoalActualsSync();
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
      revenueEl.textContent = this.formatCurrency(newTotal);
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
    this.lastTotal = 0;
    this.summaryHUDReady = false;

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
        label.innerText = 'Floor Income Summary';
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
      const shouldShowSnap = viewSunISO < realSunISO;
      snapBtn.classList.toggle('visible', shouldShowSnap);
      snapBtn.disabled = !shouldShowSnap;
      snapBtn.tabIndex = shouldShowSnap ? 0 : -1;
      snapBtn.setAttribute('aria-hidden', shouldShowSnap ? 'false' : 'true');
      snapBtn.style.pointerEvents = shouldShowSnap ? '' : 'none';
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
  sanitizePlain(value) {
    const raw = String(value ?? '');
    if (window.DOMPurify) {
      return window.DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
    }
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  parseLogNotes(notes = '') {
    const raw = String(notes || '');
    const membershipMatch = raw.match(/\|MEMBERSHIP:([^|]+)/i);
    const paidMatch = raw.match(/\|PAID:([0-9]+(?:\.[0-9]+)?)/i);
    const walkInMatch = raw.match(/^WALK-IN:\s*([^|]+)/i);
    const memberMatch = raw.match(/^MEMBER_ENTRY:\s*([^|]+)/i);

    const baseNote = raw
      .replace(/\|MEMBERSHIP:[^|]*/gi, '')
      .replace(/\|PAID:[^|]*/gi, '')
      .trim();

    return {
      raw,
      baseNote,
      membershipLabel: membershipMatch?.[1]?.trim() || '',
      isPaidFromNote: Boolean(paidMatch),
      paidAmountFromNote: paidMatch ? Number(paidMatch[1]) : null,
      walkInName: walkInMatch?.[1]?.trim() || '',
      memberToken: memberMatch?.[1]?.trim() || '',
    };
  },
  buildLogNotes(baseNote, membershipLabel, isPaid, paidAmount) {
    const noteHead = String(baseNote || '').trim() || 'WALK-IN: GUEST';
    const chunks = [noteHead];
    if (membershipLabel) {
      chunks.push(`MEMBERSHIP:${String(membershipLabel).trim().toUpperCase()}`);
    }
    if (isPaid) {
      chunks.push(`PAID:${Number(paidAmount || 0).toFixed(2)}`);
    }
    return chunks.join('|');
  },

  // ==========================================
  // 1. LOGBOOK ENGINE (FIXED)
  // ==========================================
  async loadLogbook(options = {}) {
    if (window.salesManager) window.salesManager.currentTrashMode = 'logbook';
    const container = document.getElementById('ledger-list-container');
    if (!container) return;

    if (container.children.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:50px; opacity:0.3;"><i class='bx bx-loader-alt bx-spin' style='font-size:2rem;'></i></div>`;
    }

    const localDay = this.selectedDate.toLocaleDateString('en-CA');

    try {
      if (!options?.preservePage) {
        this.currentLedgerPage = 1;
      }
      const { data, error } = await supabaseClient
        .from('check_in_logs')
        .select('*')
        .gte('time_in', `${localDay}T00:00:00+08:00`)
        .lte('time_in', `${localDay}T23:59:59+08:00`)
        .order('time_in', { ascending: false });

      if (error) throw error;

      const logs = data || [];
      const profileIds = [
        ...new Set(logs.map((log) => log.profile_id).filter(Boolean)),
      ];

      let memberMap = new Map();
      if (profileIds.length > 0) {
        const { data: members, error: memberErr } = await supabaseClient
          .from('members')
          .select('profile_id, full_name, member_code')
          .in('profile_id', profileIds);

        if (!memberErr && members) {
          memberMap = new Map(members.map((row) => [row.profile_id, row]));
        }
      }

      let filtered = logs.map((log) => {
        const parsedNotes = this.parseLogNotes(log.notes);
        const member = log.profile_id ? memberMap.get(log.profile_id) : null;
        const tokenCode =
          parsedNotes.memberToken.match(/ME-[A-Z0-9]{2,}/i)?.[0] || '';
        const tokenName = parsedNotes.memberToken
          .replace(/ME-[A-Z0-9]{2,}/gi, '')
          .trim();
        const isMemberLike = Boolean(member || tokenCode || log.profile_id);

        const rawName =
          member?.full_name ||
          parsedNotes.walkInName ||
          tokenName ||
          parsedNotes.memberToken ||
          'Walk-in Guest';
        const resolvedName = this.sanitizePlain(rawName).toUpperCase();

        const memberCode = this.sanitizePlain(
          String(member?.member_code || tokenCode || '').toUpperCase(),
        );
        const membershipLabel = this.sanitizePlain(
          String(
            log.membership_label ||
              parsedNotes.membershipLabel ||
              (isMemberLike ? 'MONTHLY MEMBERSHIP' : 'REGULAR (NON-MEMBER)'),
          ).toUpperCase(),
        );

        const entryFee = Number(
          log.entry_fee ??
            parsedNotes.paidAmountFromNote ??
            (isMemberLike ? 0 : this.defaultWalkInFee),
        );
        const isPaid = Boolean(
          typeof log.is_paid === 'boolean'
            ? log.is_paid
            : parsedNotes.isPaidFromNote,
        );
        const paidAmount = Number(
          log.paid_amount ??
            (isPaid
              ? (parsedNotes.paidAmountFromNote ?? entryFee)
              : 0),
        );

        return {
          ...log,
          resolvedName,
          memberCode,
          membershipLabel,
          entryFee,
          isPaid,
          paidAmount: isPaid ? paidAmount : 0,
          noteBase: parsedNotes.baseNote,
        };
      });

      const searchInp = document.getElementById('ledger-main-search');
      if (searchInp && searchInp.value) {
        const term = searchInp.value.toLowerCase();
        filtered = filtered.filter(
          (log) =>
            log.resolvedName.toLowerCase().includes(term) ||
            log.membershipLabel.toLowerCase().includes(term) ||
            log.memberCode.toLowerCase().includes(term),
        );
      }

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
      if (labelEl) {
        labelEl.innerText = `${dayNames[this.selectedDate.getDay()]} Floor Income`;
      }

      // UPDATE THE TOP HUD (ANIMATED: only paid logs count as income)
      const totalIncome = filtered.reduce(
        (sum, row) => sum + (row.isPaid ? Number(row.paidAmount || 0) : 0),
        0,
      );
      this.refreshSummaryHUD(totalIncome);

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:80px; opacity:0.2;"><i class='bx bx-user-x' style='font-size:3rem;'></i><p style="font-size:10px; font-weight:900; margin-top:10px;">NO DATA LOGGED</p></div>`;
        return;
      }

      this.currentLedgerRows = filtered;
      const totalItems = filtered.length;
      const totalPages = Math.max(
        1,
        Math.ceil(totalItems / this.ledgerPageSize),
      );
      if (this.currentLedgerPage > totalPages) this.currentLedgerPage = totalPages;
      const start = (this.currentLedgerPage - 1) * this.ledgerPageSize;
      const pageRows = filtered.slice(start, start + this.ledgerPageSize);

      container.innerHTML = pageRows
        .map((log, index) => {
          const isClosed = log.time_out !== null;
          const time = this.formatServerClock(log.time_in);
          const outTime = isClosed ? this.formatServerClock(log.time_out) : '--:--';
          const paidBadgeClass = log.isPaid ? 'badge-paid' : 'badge-unpaid';
          const paidBadgeText = log.isPaid ? 'PAID' : 'UNPAID';

          const checkoutLabel = isClosed ? 'UNDO CHECK OUT' : 'CHECK OUT';
          const checkoutMeta = isClosed ? `OUT ${outTime}` : 'ACTIVE';
          const checkoutClass = isClosed ? 'btn-logbook-neutral' : 'btn-logbook-danger';

          const paidLabel = log.isPaid
            ? 'UNDO PAID'
            : `COLLECT ${this.formatCurrency(log.entryFee)}`;
          const paidClass = log.isPaid ? 'btn-logbook-neutral' : 'btn-logbook-success';
          const actionDisabled = this.isReadOnly ? 'disabled' : '';

          return `
          <div class="list-item-card" id="row-${log.id}" style="animation-delay: ${index * 0.04}s;">
            <div class="card-header logbook-card-header" style="margin-bottom:0;">
              <div class="status-icon logbook-status-icon ${!isClosed ? 'active' : ''}" style="background:var(--bg-dark); color:var(--wolf-red);">
                <i class='bx ${isClosed ? 'bx-check' : 'bx-time-five'}'></i>
              </div>
              <div class="item-info logbook-item-info">
                <h4>${log.resolvedName}</h4>
                <div class="sub">${log.memberCode ? `MEMBER • ${log.memberCode}` : log.membershipLabel}</div>
                <div class="time">IN: ${time}</div>
              </div>
              <div class="logbook-inline-kpis">
                <div class="kpi-item">
                  <span class="kpi-label">CHECK-IN</span>
                  <span class="kpi-val">${time}</span>
                </div>
                <div class="kpi-item">
                  <span class="kpi-label">ENTRY FEE</span>
                  <span class="kpi-val">${this.formatCurrency(log.entryFee)}</span>
                </div>
              </div>
              <div class="card-actions logbook-card-actions" style="display:flex; align-items:center; gap:8px;">
                <span class="status-badge ${paidBadgeClass}">${paidBadgeText}</span>
                ${
                  !this.isReadOnly
                    ? `<i class='bx bx-trash' style="cursor:pointer; color:#333; font-size:14px;" onclick="wolfData.deleteLog('${log.id}')"></i>`
                    : ''
                }
              </div>
            </div>
            <div class="logbook-actions">
              <button class="logbook-action-btn ${checkoutClass}" ${actionDisabled} onclick="wolfData.toggleLogCheckout('${log.id}', ${isClosed})">
                <span class="btn-main">${checkoutLabel}</span>
                <span class="btn-sub">${checkoutMeta}</span>
              </button>
              <button class="logbook-action-btn ${paidClass}" ${actionDisabled} onclick="wolfData.toggleLogPaid('${log.id}', ${log.isPaid}, ${log.entryFee})">
                <span class="btn-main">${paidLabel}</span>
                <span class="btn-sub">${log.isPaid ? 'SET UNPAID' : 'MARK AS PAID'}</span>
              </button>
            </div>
          </div>`;
        })
        .join('');
      container.innerHTML += this.renderLedgerPagination(totalItems, totalPages);
    } catch (err) {
      console.error('Wolf OS Logbook Fault:', err);
    }
  },

  async loadSales() {
    if (window.salesManager) window.salesManager.currentTrashMode = 'sales';
    if (this.isFetching) return;
    this.isFetching = true;

    const container = document.getElementById('ledger-list-container');
    if (!container) return;

    if (container.children.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:50px; opacity:0.3;"><i class='bx bx-loader-alt bx-spin' style='font-size:2rem;'></i></div>`;
    }

    const localDay = this.selectedDate.toLocaleDateString('en-CA');

    try {
      this.currentLedgerPage = 1;
      const { data, error } = await supabaseClient
        .from('sales')
        .select('*, products(name, sku, image_url, brand)')
        .gte('created_at', `${localDay}T00:00:00+08:00`)
        .lte('created_at', `${localDay}T23:59:59+08:00`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.allSales = data || [];

      const searchInp = document.getElementById('ledger-main-search');
      const currentTerm = searchInp ? searchInp.value : '';
      this.renderSales(this.selectedDate.getDay(), currentTerm);
      this.scheduleGoalActualsSync();
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

    const totalIncome = filtered.reduce(
      (sum, s) => sum + Number(s.total_amount || 0),
      0,
    );
    this.refreshSummaryHUD(totalIncome);

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:80px; opacity:0.2;"><i class='bx bx-shopping-bag' style='font-size:3rem;'></i><p style="font-size:10px; font-weight:900; margin-top:10px;">NO DATA LOGGED</p></div>`;
      return;
    }

    this.currentLedgerRows = filtered;
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.ledgerPageSize));
    if (this.currentLedgerPage > totalPages) this.currentLedgerPage = totalPages;
    const start = (this.currentLedgerPage - 1) * this.ledgerPageSize;
    const pageRows = filtered.slice(start, start + this.ledgerPageSize);

    container.innerHTML = pageRows
      .map((sale, index) => {
        const amount = Number(sale.total_amount || 0);
        const safeName = DOMPurify.sanitize(sale.products?.name || 'Item');
        const safeSKU = DOMPurify.sanitize(sale.products?.sku || 'N/A');
        const safeBrand = DOMPurify.sanitize(sale.products?.brand || '');
        const thumbSrc = DOMPurify.sanitize(
          String(sale.products?.image_url || '/assets/images/placeholder.png'),
        );
        const time = new Date(sale.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        return `
        <div class="list-item-card sale-row-card" id="row-${sale.id}" style="animation-delay: ${index * 0.06}s;">
          <div class="card-header sale-card-header" style="margin-bottom: 0;">
            <div class="status-icon sale-thumb" style="background: var(--bg-dark); color: var(--wolf-red); overflow:hidden;">
              <img src="${thumbSrc}" alt="${safeName}" onerror="this.onerror=null;this.src='/assets/images/placeholder.png';" />
            </div>
            <div class="item-info sale-item-info">
              <h4>${safeName.toUpperCase()}</h4>
              <div class="sub">${safeSKU.toUpperCase()}${safeBrand ? ` • ${safeBrand.toUpperCase()}` : ''}</div>
              <div class="time">${time} • x${sale.qty}</div>
            </div>
            <div class="card-actions sale-card-actions">
              <div class="sale-price-chip">${this.formatCurrency(amount)}</div>
              ${
                !this.isReadOnly
                  ? `<button type="button" class="sale-delete-btn" onclick="wolfData.deleteSale('${sale.id}')" aria-label="Delete sale"><i class='bx bxs-trash'></i></button>`
                  : ''
              }
            </div>
          </div>
        </div>`;
      })
      .join('');
    container.innerHTML += this.renderLedgerPagination(totalItems, totalPages);
  },

  renderLedgerPagination(totalItems, totalPages) {
    if (totalItems <= this.ledgerPageSize) return '';
    return `
      <div style="display:flex; justify-content:center; align-items:center; gap:10px; margin-top:10px;">
        <button onclick="wolfData.setLedgerPage(${this.currentLedgerPage - 1})" ${this.currentLedgerPage <= 1 ? 'disabled' : ''} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class='bx bx-chevron-left'></i></button>
        <span style="font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#97a4ba;">Page ${this.currentLedgerPage} of ${totalPages}</span>
        <button onclick="wolfData.setLedgerPage(${this.currentLedgerPage + 1})" ${this.currentLedgerPage >= totalPages ? 'disabled' : ''} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class='bx bx-chevron-right'></i></button>
      </div>
    `;
  },

  setLedgerPage(page) {
    const nextPage = Number(page);
    if (!Number.isFinite(nextPage) || nextPage < 1) return;
    this.currentLedgerPage = nextPage;
    if (this.activeMode === 'sales') {
      const searchInp = document.getElementById('ledger-main-search');
      this.renderSales(
        this.selectedDate.getDay(),
        searchInp ? searchInp.value : '',
      );
      return;
    }
    this.loadLogbook({ preservePage: true });
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
  async toggleLogCheckout(id, currentlyClosed) {
    if (this.isReadOnly) return;

    try {
      let serverNowIso = new Date().toISOString();
      try {
        const { data: serverNow, error: serverErr } =
          await supabaseClient.rpc('get_server_time');
        if (!serverErr && serverNow) {
          const raw = Array.isArray(serverNow) ? serverNow[0] : serverNow;
          if (typeof raw === 'string') {
            serverNowIso = new Date(raw).toISOString();
          } else if (raw && typeof raw === 'object') {
            const candidate =
              raw.server_iso_timestamp ||
              raw.server_time ||
              raw.now ||
              raw.timestamp;
            if (candidate) serverNowIso = new Date(candidate).toISOString();
          }
        }
      } catch (_) {
        // Non-blocking fallback to local clock if RPC is temporarily unavailable.
      }

      const nextTimeOut = currentlyClosed ? null : serverNowIso;
      const { error } = await supabaseClient
        .from('check_in_logs')
        .update({ time_out: nextTimeOut })
        .eq('id', id);

      if (error) throw error;

      if (window.wolfAudio) window.wolfAudio.play('notif');
      await this.loadLogbook();
    } catch (err) {
      console.error('Wolf OS Checkout Toggle Fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
    }
  },

  async toggleLogPaid(id, currentlyPaid, fallbackFee = 0) {
    if (this.isReadOnly) return;

    try {
      const { data: logRow, error: fetchErr } = await supabaseClient
        .from('check_in_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !logRow) throw fetchErr || new Error('Log row not found');

      const parsed = this.parseLogNotes(logRow.notes);
      const membershipLabel = String(
        logRow.membership_label ||
          parsed.membershipLabel ||
          (logRow.profile_id ? 'MONTHLY MEMBERSHIP' : 'REGULAR (NON-MEMBER)'),
      )
        .trim()
        .toUpperCase();

      const entryFee = Number(
        logRow.entry_fee ??
          parsed.paidAmountFromNote ??
          fallbackFee ??
          (logRow.profile_id ? 0 : this.defaultWalkInFee),
      );

      const nextPaid = !currentlyPaid;
      const nextPaidAmount = nextPaid ? entryFee : 0;
      const nextPaidAt = nextPaid ? new Date().toISOString() : null;
      const nextNotes = this.buildLogNotes(
        parsed.baseNote,
        membershipLabel,
        nextPaid,
        nextPaidAmount,
      );

      const fullPayload = {
        notes: nextNotes,
        membership_label: membershipLabel,
        entry_fee: entryFee,
        is_paid: nextPaid,
        paid_amount: nextPaidAmount,
        paid_at: nextPaidAt,
      };

      let { error } = await supabaseClient
        .from('check_in_logs')
        .update(fullPayload)
        .eq('id', id);

      // Backward compatibility if the new columns are not yet migrated.
      if (
        error &&
        /column .* does not exist|schema cache|invalid input syntax/i.test(
          String(error.message || ''),
        )
      ) {
        const legacy = await supabaseClient
          .from('check_in_logs')
          .update({ notes: nextNotes })
          .eq('id', id);
        error = legacy.error;
      }

      if (error) throw error;

      if (window.wolfAudio) window.wolfAudio.play('success');
      await this.loadLogbook();
    } catch (err) {
      console.error('Wolf OS Payment Toggle Fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
    }
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

  async adjustSaleQty(id, delta = 0) {
    if (this.isReadOnly) return;
    const step = Number(delta);
    if (step !== 1 && step !== -1) return;

    try {
      const cached = (this.allSales || []).find((row) => row.id === id);
      const { data: saleData, error: saleErr } = await supabaseClient
        .from('sales')
        .select('id, product_id, qty, unit_price, total_amount')
        .eq('id', id)
        .single();
      if (saleErr || !saleData) throw saleErr || new Error('SALE_NOT_FOUND');

      const currentQty = Number(saleData.qty || 0);
      const nextQty = currentQty + step;
      if (nextQty < 1) {
        window.salesManager?.showSystemAlert(
          'MINIMUM QTY IS 1. USE DELETE TO REMOVE ITEM.',
          'warning',
        );
        return;
      }

      const { data: product, error: productErr } = await supabaseClient
        .from('products')
        .select('qty, name')
        .eq('productid', saleData.product_id)
        .single();
      if (productErr || !product) throw productErr || new Error('PRODUCT_NOT_FOUND');

      const stockNow = Number(product.qty || 0);
      const limitedStock = stockNow < 999999;

      if (step > 0 && limitedStock && stockNow < 1) {
        window.salesManager?.showSystemAlert(
          `OUT OF STOCK: ${String(product.name || cached?.products?.name || 'PRODUCT').toUpperCase()}`,
          'error',
        );
        return;
      }

      if (limitedStock) {
        const nextStock = step > 0 ? stockNow - 1 : stockNow + 1;
        const { error: stockUpdateErr } = await supabaseClient
          .from('products')
          .update({ qty: nextStock })
          .eq('productid', saleData.product_id);
        if (stockUpdateErr) throw stockUpdateErr;
      }

      const unitPrice = Number(
        saleData.unit_price ||
          (currentQty > 0 ? Number(saleData.total_amount || 0) / currentQty : 0),
      );
      const nextTotal = unitPrice * nextQty;

      const { error: saleUpdateErr } = await supabaseClient
        .from('sales')
        .update({ qty: nextQty, total_amount: nextTotal })
        .eq('id', id);
      if (saleUpdateErr) throw saleUpdateErr;

      if (window.wolfAudio) window.wolfAudio.play('click');
      await this.loadSales();
      this.scheduleGoalActualsSync();
    } catch (err) {
      console.error('Sale qty adjust fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
      window.salesManager?.showSystemAlert('FAILED TO UPDATE SALE QTY', 'error');
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
      this.scheduleGoalActualsSync();

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

  addLogbookRow() {
    this.loadLogbook();
  },

  updateLogbookRow() {
    this.loadLogbook();
  },

  removeLogbookRow() {
    this.loadLogbook();
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
  this.scheduleGoalActualsSync();
};

wolfData.removeSaleRow = function (id) {
  // Update the array source
  this.allSales = (this.allSales || []).filter((row) => row.id !== id);

  // Remove from UI
  const rowEl = document.getElementById(`row-${id}`);
  if (rowEl) rowEl.remove();

  // Update Total
  this.updateLedgerRevenue();
  this.scheduleGoalActualsSync();
};

wolfData.initRealtime = async function () {
  // Safety: update totals immediately
  this.updateLedgerRevenue();
  this.scheduleGoalActualsSync(50);

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
        this.scheduleGoalActualsSync(80);
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
        this.scheduleGoalActualsSync(80);
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
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'sales' },
      (payload) => {
        this.scheduleGoalActualsSync(80);
        if (this.activeMode !== 'sales') return;
        this.removeSaleRow(payload.old.id);
      },
    )

    /* =======================
       LOGBOOK (ROW-LEVEL)
    ======================= */
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'check_in_logs' },
      (payload) => {
        this.scheduleGoalActualsSync(80);
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
        this.scheduleGoalActualsSync(80);
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
        this.scheduleGoalActualsSync(80);
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
      text: 'Realtime subscription failed',
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

  revenueEl.textContent = this.formatCurrency(total);
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
    wolfData.currentLedgerPage = 1;
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
    const scope =
      searchToggle.closest(
        '#sales-main-view, #logbook-main-view, #main-content, .ledger-page-wrapper',
      ) || document;
    const searchContainer = scope.querySelector('#ledger-search-container');
    const input = scope.querySelector('#ledger-main-search');

    // Only this handler controls Sales/Logbook search.
    // Member/Product pages use their own scoped managers.
    if (searchContainer && input) {
      e.preventDefault();
      e.stopPropagation();

      const isActive = searchContainer.classList.toggle('active');
      searchToggle.classList.toggle('active', isActive);

      if (isActive) {
        setTimeout(() => {
          input.focus();
        }, 180);
        if (window.wolfAudio) window.wolfAudio.play('notif');
      } else {
        input.value = '';
        const clearBtn = scope.querySelector('#search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';
        wolfRefreshView();
      }

      return;
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
    if (!snapBtn.classList.contains('visible') || snapBtn.disabled) return;
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
  setTimeout(() => {
    wolfData.loadGoalTargets().catch(() => {});
  }, 300);
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



