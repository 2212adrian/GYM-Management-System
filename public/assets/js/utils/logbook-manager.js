/**
 * WOLF OS - LOGBOOK MANAGER (V2.1)
 * Handles Atomic Time Sync, Member Detection, and Check-ins.
 */
window.logbookManager = {
  selectedProfileId: null,
  selectedMember: null,
  selectedEntryType: 'regular',
  selectedEntryFee: 80,
  selectedPaid: false,
  entryTypeLocked: false,
  memberSearchTimer: null,
  clockInterval: null,
  serverOffset: 0,
  membershipSnapshotCache: new Map(),
  membershipSnapshotTtlMs: 30000,
  pricing: {
    regular: 80,
    student: 50,
    memberDefault: 0,
    yearlyDiscountedEntry: 60,
  },

  getEntryFeeByType(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'member') return this.pricing.memberDefault;
    if (t === 'student') return this.pricing.student;
    return this.pricing.regular;
  },

  getEntryLabelByType(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'member') return 'MEMBER';
    if (t === 'student') return 'STUDENT';
    return 'REGULAR (NON-MEMBER)';
  },

  getEntryDisplayName(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'member') return 'MEMBER';
    if (t === 'student') return 'STUDENT';
    return 'REGULAR';
  },

  isMissingRelationError(error) {
    const code = String(error?.code || '').toUpperCase();
    const msg = String(error?.message || '').toLowerCase();
    return (
      code === '42P01' ||
      /relation .* does not exist/.test(msg) ||
      /table .* does not exist/.test(msg)
    );
  },

  isMissingColumnError(error) {
    const msg = String(error?.message || '').toLowerCase();
    return (
      String(error?.code || '').toUpperCase() === 'PGRST204' ||
      /column .* does not exist/.test(msg) ||
      /schema cache/.test(msg)
    );
  },

  getPlanKind(plan) {
    const name = String(plan?.name || '').toLowerCase();
    const unit = String(plan?.billing_period_unit || '').toLowerCase();
    const interval = Number(plan?.billing_period_interval || 0);

    if (
      /month/.test(name) ||
      /month/.test(unit) ||
      (!unit && interval === 1 && /monthly/.test(name))
    ) {
      return 'monthly';
    }

    if (
      /year|annual/.test(name) ||
      /year/.test(unit) ||
      (!unit && /year|annual/.test(name))
    ) {
      return 'yearly';
    }

    return 'custom';
  },

  isMembershipActive(row, nowMs) {
    if (!row) return false;
    const status = String(row.status || '').toLowerCase();
    if (status && status !== 'active') return false;

    const startsAt = row.started_at ? new Date(row.started_at).getTime() : null;
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;

    if (Number.isFinite(startsAt) && startsAt > nowMs) return false;
    if (Number.isFinite(expiresAt) && expiresAt < nowMs) return false;
    return true;
  },

  async fetchMembershipSnapshot(profileId) {
    if (!profileId || !window.supabaseClient) {
      return { supported: false, activeMembership: null, plan: null, planKind: null };
    }

    const cacheKey = String(profileId);
    const cached = this.membershipSnapshotCache.get(cacheKey);
    const nowMs = Date.now() + Number(this.serverOffset || 0);
    if (cached && cached.expiresAt > nowMs) return cached.value;

    let response = await window.supabaseClient
      .from('memberships')
      .select('id, profile_id, plan_id, status, started_at, expires_at, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(12);

    if (response.error && this.isMissingColumnError(response.error)) {
      response = await window.supabaseClient
        .from('memberships')
        .select('id, profile_id, plan_id, status, started_at, expires_at')
        .eq('profile_id', profileId)
        .order('started_at', { ascending: false })
        .limit(12);
    }

    if (response.error) {
      const unsupported = this.isMissingRelationError(response.error);
      const value = {
        supported: !unsupported ? true : false,
        activeMembership: null,
        plan: null,
        planKind: null,
      };
      this.membershipSnapshotCache.set(cacheKey, {
        value,
        expiresAt: nowMs + this.membershipSnapshotTtlMs,
      });
      return value;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    const activeMembership = rows.find((row) => this.isMembershipActive(row, nowMs)) || null;

    if (!activeMembership || !activeMembership.plan_id) {
      const value = {
        supported: true,
        activeMembership: null,
        plan: null,
        planKind: null,
      };
      this.membershipSnapshotCache.set(cacheKey, {
        value,
        expiresAt: nowMs + this.membershipSnapshotTtlMs,
      });
      return value;
    }

    const planResponse = await window.supabaseClient
      .from('membership_plans')
      .select('id, name, price, billing_period_interval, billing_period_unit')
      .eq('id', activeMembership.plan_id)
      .maybeSingle();

    if (planResponse.error) {
      const value = {
        supported: !this.isMissingRelationError(planResponse.error),
        activeMembership,
        plan: null,
        planKind: null,
      };
      this.membershipSnapshotCache.set(cacheKey, {
        value,
        expiresAt: nowMs + this.membershipSnapshotTtlMs,
      });
      return value;
    }

    const plan = planResponse.data || null;
    const value = {
      supported: true,
      activeMembership,
      plan,
      planKind: this.getPlanKind(plan),
    };
    this.membershipSnapshotCache.set(cacheKey, {
      value,
      expiresAt: nowMs + this.membershipSnapshotTtlMs,
    });
    return value;
  },

  async resolveCheckInPricing(resolvedMember, requestedType) {
    const normalized = String(requestedType || '').toLowerCase();
    const entryType = ['member', 'student', 'regular'].includes(normalized)
      ? normalized
      : 'regular';

    if (!resolvedMember || !resolvedMember.profile_id) {
      return {
        entryType,
        entryFee: this.getEntryFeeByType(entryType),
        membershipLabel: this.getEntryLabelByType(entryType),
      };
    }

    const snapshot = await this.fetchMembershipSnapshot(resolvedMember.profile_id);
    const planName = String(snapshot?.plan?.name || '').trim().toUpperCase();

    if (!snapshot.supported) {
      return {
        entryType: 'member',
        entryFee: this.getEntryFeeByType('member'),
        membershipLabel: this.getEntryLabelByType('member'),
      };
    }

    if (!snapshot.activeMembership) {
      return {
        entryType: 'member',
        entryFee: this.pricing.regular,
        membershipLabel: 'MEMBER (NO ACTIVE SUBSCRIPTION)',
      };
    }

    if (snapshot.planKind === 'monthly') {
      return {
        entryType: 'member',
        entryFee: 0,
        membershipLabel: planName || 'MONTHLY SUBSCRIPTION (FREE ENTRY)',
      };
    }

    if (snapshot.planKind === 'yearly') {
      return {
        entryType: 'member',
        entryFee: this.pricing.yearlyDiscountedEntry,
        membershipLabel:
          planName || 'YEARLY SUBSCRIPTION (REGULAR ENTRY DISCOUNT)',
      };
    }

    return {
      entryType: 'member',
      entryFee: this.getEntryFeeByType('member'),
      membershipLabel: planName || 'ACTIVE MEMBERSHIP',
    };
  },

  hideMemberSearchResults(modal) {
    const dropdown = modal?.querySelector('#log-member-search-results');
    if (!dropdown) return;
    dropdown.classList.remove('active');
    dropdown.innerHTML = '';
  },

  renderMemberSearchResults(modal, members = []) {
    const dropdown = modal?.querySelector('#log-member-search-results');
    if (!dropdown) return;

    dropdown.innerHTML = '';
    if (!members || members.length === 0) {
      dropdown.classList.remove('active');
      return;
    }

    members.forEach((member) => {
      const memberCode = String(member.member_code || member.sku || '')
        .trim()
        .toUpperCase();
      const memberName = String(member.full_name || 'UNKNOWN MEMBER')
        .trim()
        .toUpperCase();

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'member-search-item';
      item.dataset.memberId = String(member.member_id || '');
      item.dataset.profileId = String(member.profile_id || '');
      item.dataset.memberCode = memberCode;
      item.dataset.memberName = memberName;

      const left = document.createElement('span');
      left.className = 'member-search-main';

      const icon = document.createElement('i');
      icon.className = 'bx bx-badge-check';

      const name = document.createElement('span');
      name.className = 'member-search-name';
      name.textContent = memberName;

      left.appendChild(icon);
      left.appendChild(name);

      const code = document.createElement('span');
      code.className = 'member-search-code';
      code.textContent = memberCode || 'MEMBER';

      item.appendChild(left);
      item.appendChild(code);
      dropdown.appendChild(item);
    });

    dropdown.classList.add('active');
  },

  async searchMembers(rawQuery) {
    const query = String(rawQuery || '').trim();
    if (!query || !window.supabaseClient) return [];

    const safeQuery = query.replace(/[%(),]/g, ' ');

    const { data, error } = await window.supabaseClient
      .from('members')
      .select('member_id, profile_id, member_code, sku, full_name')
      .or(
        `full_name.ilike.%${safeQuery}%,member_code.ilike.%${safeQuery}%,sku.ilike.%${safeQuery}%`,
      )
      .order('full_name', { ascending: true })
      .limit(6);

    if (error) return [];

    return (data || []).filter(
      (row) =>
        String(row.full_name || row.member_code || row.sku || '')
          .trim()
          .length > 0,
    );
  },

  clearSelectedMember(modal) {
    this.selectedProfileId = null;
    this.selectedMember = null;

    const input = modal?.querySelector('#log-guest-search');
    if (!input) return;

    delete input.dataset.selectedMemberId;
    delete input.dataset.selectedMemberCode;
    delete input.dataset.selectedMemberLabel;
  },

  isInputPinnedToSelectedMember(modal, rawValue) {
    const input = modal?.querySelector('#log-guest-search');
    if (!input || !this.selectedMember) return false;

    const currentValue = String(rawValue || input.value || '')
      .trim()
      .toUpperCase();
    const selectedLabel = String(input.dataset.selectedMemberLabel || '')
      .trim()
      .toUpperCase();
    const selectedCode = String(input.dataset.selectedMemberCode || '')
      .trim()
      .toUpperCase();

    if (!currentValue) return false;
    return currentValue === selectedLabel || currentValue === selectedCode;
  },

  applySelectedMember(modal, member, options = {}) {
    if (!member) return;
    const { useCode = false } = options;

    const memberCode = String(member.member_code || member.sku || '')
      .trim()
      .toUpperCase();
    const memberName = String(member.full_name || memberCode || 'MEMBER')
      .trim()
      .toUpperCase();
    const displayValue = useCode && memberCode ? memberCode : memberName;
    const input = modal?.querySelector('#log-guest-search');

    this.selectedProfileId = member.profile_id || null;
    this.selectedMember = {
      member_id: member.member_id || null,
      profile_id: member.profile_id || null,
      member_code: memberCode,
      sku: memberCode,
      full_name: memberName,
    };

    if (input) {
      input.value = displayValue;
      input.dataset.selectedMemberId = String(member.member_id || '');
      input.dataset.selectedMemberCode = memberCode;
      input.dataset.selectedMemberLabel = displayValue;
    }

    const lockLabel = memberCode
      ? `MEMBER_LOCKED [${memberCode}]`
      : 'MEMBER_LOCKED';
    this.updateProtocolState(modal, lockLabel, 'status-member');
    this.setEntryType(modal, 'member', { lock: true });
    this.hideMemberSearchResults(modal);
  },

  updateEntrySummary(modal) {
    const summaryNode = modal?.querySelector('.summary-val');
    if (!summaryNode) return;

    const symbol = window.wolfData?.currencySymbol || 'PHP ';
    const fee = Number(this.selectedEntryFee || 0);
    const paidText = this.selectedPaid ? 'PAID' : 'UNPAID';

    summaryNode.innerText = `CHECK-IN | ${this.getEntryDisplayName(this.selectedEntryType)} | ${symbol}${fee} | ${paidText}`;
  },

  setEntryType(modal, type, options = {}) {
    const { lock = false } = options;
    const normalized = String(type || 'regular').toLowerCase();
    const nextType = ['member', 'student', 'regular'].includes(normalized)
      ? normalized
      : 'regular';

    this.entryTypeLocked = Boolean(lock);
    this.selectedEntryType = this.entryTypeLocked ? 'member' : nextType;
    this.selectedEntryFee = this.getEntryFeeByType(this.selectedEntryType);

    const buttons = modal?.querySelectorAll('[data-entry-tier]') || [];
    buttons.forEach((btn) => {
      const tier = String(btn.dataset.entryTier || '').toLowerCase();
      btn.classList.toggle('is-active', tier === this.selectedEntryType);
      btn.disabled = this.entryTypeLocked && tier !== 'member';
    });

    this.updateEntrySummary(modal);
  },

  async openLogbookTerminal(initialQuery = '') {
    console.log('Wolf OS: Initializing Logbook Entry Protocol...');
    if (window.wolfAudio) window.wolfAudio.play('notif');

    if (window.wolfData && window.wolfData.syncServerTime) {
      await window.wolfData.syncServerTime();
    }

    const oldModal = document.getElementById('logbook-modal-overlay');
    if (oldModal) oldModal.remove();

    try {
      const res = await fetch('/assets/components/record-logbook-modal.html');
      const html = await res.text();
      document.body.insertAdjacentHTML('beforeend', html);

      const modal = document.getElementById('logbook-modal-overlay');

      await this.syncClockOffset();

      if (modal) {
        this.selectedEntryType = 'regular';
        this.selectedEntryFee = this.getEntryFeeByType('regular');
        this.selectedPaid = false;
        this.entryTypeLocked = false;
        this.memberSearchTimer = null;

        modal.style.display = 'flex';
        this.attachLogbookListeners(modal);
        this.startTerminalClock(modal);
        this.setEntryType(modal, 'regular');
        this.updateEntrySummary(modal);

        if (initialQuery) {
          const input = modal.querySelector('#log-guest-search');
          if (input) {
            input.value = String(initialQuery).trim().toUpperCase();
            await this.syncIdentityFromInput(modal, input.value, {
              forceResolve: true,
            });
          }
        }
      }
    } catch (err) {
      console.error('Wolf OS: Modal Load Fault:', err);
    }
  },

  updateProtocolState(modal, text, className = 'status-ready') {
    const statusNode = modal.querySelector(
      '.node-value.status-ready, .node-value.status-warn, .node-value.status-member',
    );
    if (!statusNode) return;
    statusNode.className = `node-value ${className}`;
    statusNode.innerText = text;
  },

  async resolveMemberIdentity(rawInput, options = {}) {
    const query = String(rawInput || '').trim();
    const mode = String(options.mode || 'strict').toLowerCase();
    if (!query || !window.supabaseClient) return null;

    const selectColumns = 'member_id, profile_id, member_code, sku, full_name';

    if (/^ME-[A-Z0-9]{2,}$/i.test(query)) {
      const code = query.toUpperCase();
      const { data, error } = await window.supabaseClient
        .from('members')
        .select(selectColumns)
        .or(`member_code.eq.${code},sku.eq.${code}`)
        .limit(1);
      if (error) return null;
      return data?.[0] || null;
    }

    if (mode === 'fuzzy') {
      const safeQuery = query.replace(/[%(),]/g, ' ');
      const { data, error } = await window.supabaseClient
        .from('members')
        .select(selectColumns)
        .or(
          `full_name.ilike.%${safeQuery}%,member_code.ilike.%${safeQuery}%,sku.ilike.%${safeQuery}%`,
        )
        .order('full_name', { ascending: true })
        .limit(1);
      if (error) return null;
      return data?.[0] || null;
    }

    const { data, error } = await window.supabaseClient
      .from('members')
      .select(selectColumns)
      .ilike('full_name', query)
      .limit(1);
    if (error) return null;
    return data?.[0] || null;
  },

  async syncIdentityFromInput(modal, rawInput, options = {}) {
    const value = String(rawInput || '').trim();

    if (!value) {
      this.clearSelectedMember(modal);
      this.hideMemberSearchResults(modal);
      this.updateProtocolState(modal, 'AWAITING_AUTH', 'status-ready');
      this.setEntryType(modal, 'regular', { lock: false });
      return;
    }

    if (this.isInputPinnedToSelectedMember(modal, value)) {
      const memberCode = String(
        this.selectedMember?.member_code || this.selectedMember?.sku || '',
      )
        .trim()
        .toUpperCase();
      const lockLabel = memberCode
        ? `MEMBER_LOCKED [${memberCode}]`
        : 'MEMBER_LOCKED';
      this.updateProtocolState(modal, lockLabel, 'status-member');
      this.setEntryType(modal, 'member', { lock: true });
      return;
    }

    let member = null;
    const shouldForceResolve = Boolean(options.forceResolve);
    if (/^ME-[A-Z0-9]{2,}$/i.test(value) || shouldForceResolve) {
      member = await this.resolveMemberIdentity(value, { mode: 'strict' });
    }

    if (member) {
      this.applySelectedMember(modal, member, {
        useCode: /^ME-[A-Z0-9]{2,}$/i.test(value),
      });
      return;
    }

    this.clearSelectedMember(modal);
    this.updateProtocolState(modal, 'WALK-IN_PENDING', 'status-warn');
    const fallbackType =
      this.selectedEntryType === 'member' ? 'regular' : this.selectedEntryType;
    this.setEntryType(modal, fallbackType, { lock: false });
  },

  async syncClockOffset() {
    try {
      const { data, error } = await supabaseClient.rpc('get_server_time');
      if (error) throw error;

      const serverTS = Array.isArray(data)
        ? data[0].server_iso_timestamp || data[0]
        : data;

      if (!serverTS) throw new Error('Null Timestamp Received');

      const serverMillis = new Date(serverTS).getTime();
      const localMillis = Date.now();
      this.serverOffset = serverMillis - localMillis;

      console.log(`Wolf OS: Time Delta Calibrated [${this.serverOffset}ms]`);
    } catch (err) {
      console.warn('Wolf OS: RPC Sync Failed, defaulting to Local Time.');
      this.serverOffset = 0;
    }
  },

  startTerminalClock(modal) {
    const timeDisplay = modal.querySelector('#log-current-time');
    if (!timeDisplay) return;

    if (this.clockInterval) clearInterval(this.clockInterval);

    this.clockInterval = setInterval(() => {
      const atomicDate = new Date(Date.now() + this.serverOffset);

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
    const closeBtn = modal.querySelector('#closeLogModal');
    const input = modal.querySelector('#log-guest-search');
    const memberResults = modal.querySelector('#log-member-search-results');
    const entryButtons = modal.querySelectorAll('[data-entry-tier]');
    const paidToggle = modal.querySelector('#log-paid-toggle');

    if (entryButtons && entryButtons.length > 0) {
      entryButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const tier = btn.dataset.entryTier || 'regular';
          this.setEntryType(modal, tier, { lock: false });
        });
      });
    }

    if (paidToggle) {
      paidToggle.checked = false;
      paidToggle.addEventListener('change', () => {
        this.selectedPaid = Boolean(paidToggle.checked);
        this.updateEntrySummary(modal);
      });
    }

    if (memberResults) {
      memberResults.addEventListener('click', (event) => {
        const item = event.target.closest('.member-search-item');
        if (!item) return;

        const member = {
          member_id: item.dataset.memberId || null,
          profile_id: item.dataset.profileId || null,
          member_code: item.dataset.memberCode || '',
          sku: item.dataset.memberCode || '',
          full_name: item.dataset.memberName || '',
        };

        this.applySelectedMember(modal, member, { useCode: false });
        if (input) input.focus();
      });
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const guestName = input.value.trim();
      const submitBtn = modal.querySelector('#log-submit-btn');

      if (!guestName) return;

      submitBtn.disabled = true;
      submitBtn.querySelector('span').innerText = 'AUTHORIZING...';

      await this.processCheckIn(guestName, {
        entryType: this.selectedEntryType,
        isPaid: this.selectedPaid,
      });
      this.closeLogbookTerminal();
    };

    if (input) {
      input.addEventListener('input', () => {
        input.value = input.value.toUpperCase();
        const value = String(input.value || '').trim();

        if (!this.isInputPinnedToSelectedMember(modal, value)) {
          this.clearSelectedMember(modal);
        }

        if (this.memberSearchTimer) clearTimeout(this.memberSearchTimer);
        this.memberSearchTimer = setTimeout(async () => {
          if (!value) {
            this.hideMemberSearchResults(modal);
            await this.syncIdentityFromInput(modal, value);
            return;
          }

          if (/^ME-[A-Z0-9]{2,}$/i.test(value)) {
            this.hideMemberSearchResults(modal);
            await this.syncIdentityFromInput(modal, value, {
              forceResolve: true,
            });
            return;
          }

          const members = await this.searchMembers(value);
          this.renderMemberSearchResults(modal, members);
          await this.syncIdentityFromInput(modal, value);
        }, 170);
      });

      input.addEventListener('focus', async () => {
        const value = String(input.value || '').trim();
        if (!value || /^ME-[A-Z0-9]{2,}$/i.test(value)) return;
        if (this.isInputPinnedToSelectedMember(modal, value)) return;

        const members = await this.searchMembers(value);
        this.renderMemberSearchResults(modal, members);
      });

      input.addEventListener('blur', () => {
        setTimeout(() => this.hideMemberSearchResults(modal), 120);
      });
    }

    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        this.closeLogbookTerminal();
      };
    }

    modal.onclick = (e) => {
      if (e.target.id === 'logbook-modal-overlay') {
        this.closeLogbookTerminal();
      }
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeLogbookTerminal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

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
      setTimeout(() => modal.remove(), 260);
    }

    if (this.memberSearchTimer) {
      clearTimeout(this.memberSearchTimer);
      this.memberSearchTimer = null;
    }
  },

  async processCheckIn(name, options = {}) {
    try {
      const cleanInput = String(name || '').trim();
      const resolvedMember =
        this.selectedMember || (await this.resolveMemberIdentity(cleanInput));
      const requestedType = String(
        options.entryType || this.selectedEntryType || 'regular',
      ).toLowerCase();
      const fallbackEntryType = resolvedMember
        ? 'member'
        : ['member', 'student', 'regular'].includes(requestedType)
          ? requestedType
          : 'regular';
      const pricing = await this.resolveCheckInPricing(
        resolvedMember,
        fallbackEntryType,
      );
      const entryType = pricing.entryType;
      const entryFee = Number(pricing.entryFee || 0);
      const isPaid = Boolean(options.isPaid);
      const paidAmount = isPaid ? entryFee : 0;

      const resolvedName = resolvedMember?.full_name || cleanInput;
      const memberCode = String(
        resolvedMember?.member_code || resolvedMember?.sku || '',
      )
        .trim()
        .toUpperCase();
      const membershipLabel =
        pricing.membershipLabel || this.getEntryLabelByType(entryType);

      const memberIdentity = [memberCode, resolvedName.toUpperCase()]
        .filter(Boolean)
        .join(' ')
        .trim();
      const noteBase = resolvedMember
        ? `MEMBER_ENTRY: ${memberIdentity}`
        : `WALK-IN: ${resolvedName.toUpperCase()}`;

      const notes =
        typeof window.wolfData?.buildLogNotes === 'function'
          ? window.wolfData.buildLogNotes(
              noteBase,
              membershipLabel,
              isPaid,
              paidAmount,
            )
          : noteBase;

      const payload = {
        profile_id: resolvedMember?.profile_id || this.selectedProfileId || null,
        source: resolvedMember ? 'MEMBER' : 'TERMINAL',
        notes,
        membership_label: membershipLabel,
        entry_fee: entryFee,
        is_paid: isPaid,
        paid_amount: paidAmount,
        paid_at: isPaid ? new Date().toISOString() : null,
      };

      let { error } = await supabaseClient.from('check_in_logs').insert([payload]);

      if (
        error &&
        /column .* does not exist|schema cache/i.test(String(error.message || ''))
      ) {
        const { error: retryError } = await supabaseClient
          .from('check_in_logs')
          .insert([
            {
              profile_id: payload.profile_id,
              source: payload.source,
              notes: payload.notes,
            },
          ]);
        error = retryError;
      }

      if (error) throw error;

      if (window.salesManager) {
        window.salesManager.showSystemAlert(
          `ACCESS GRANTED: ${resolvedName}`,
          'success',
        );
      }

      if (window.wolfAudio) window.wolfAudio.play('success');

      if (window.wolfData && window.wolfData.loadLogbook) {
        window.wolfData.loadLogbook();
      }
    } catch (err) {
      console.error('Logbook Protocol Fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
      if (window.salesManager) {
        window.salesManager.showSystemAlert('DATABASE_REJECTED_ENTRY', 'error');
      }
    }
  },
};
