/**
 * WOLF OS - MEMBER MANAGER (FINAL CONSOLIDATED)
 * Controls Membership Card 3D Rendering, Search Engine, and Summary HUD.
 */

const MemberManager = {
  allMembers: [],
  trashData: [],
  currentPage: 1,
  pageSize: 9,
  currentFilterList: [],
  getAccessContext() {
    const context = window.WOLF_ACCESS_CONTEXT || {};
    const role = String(context.role || window.WOLF_USER_ROLE || '')
      .trim()
      .toLowerCase();
    const email = String(context.email || window.WOLF_USER_EMAIL || '')
      .trim()
      .toLowerCase();
    return { role, email };
  },

  canHardDelete() {
    const { role, email } = this.getAccessContext();
    return (
      role === 'admin' ||
      email === 'adrianangeles2212@gmail.com' ||
      email === 'ktorrazo123@gmail.com'
    );
  },

  getAccentColor() {
    return (
      getComputedStyle(document.body).getPropertyValue('--wolf-red').trim() ||
      '#a63429'
    );
  },

  getMemberCode(member) {
    const existing = String(member?.sku || member?.member_code || '')
      .trim()
      .toUpperCase();
    if (existing) return existing.startsWith('ME-') ? existing : `ME-${existing}`;

    const fallback = String(member?.member_id || member?.id || '')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 4);
    return `ME-${fallback.padEnd(4, '0')}`;
  },

  isMissingLifecycleColumnError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      error?.code === 'PGRST204' ||
      /column .* does not exist/.test(message) ||
      /schema cache/.test(message) ||
      /could not find the .* column/.test(message)
    );
  },

  async fetchMemberById(id) {
    const { data, error } = await window.supabaseClient
      .from('members')
      .select('*')
      .eq('member_id', id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async updateLifecycleFields(id, updates = {}) {
    let response = await window.supabaseClient
      .from('members')
      .update(updates)
      .eq('member_id', id)
      .select('*')
      .maybeSingle();

    if (response.error && this.isMissingLifecycleColumnError(response.error)) {
      return { data: null, error: response.error, missingColumns: true };
    }

    return {
      data: response.data || null,
      error: response.error || null,
      missingColumns: false,
    };
  },

  async viewProfile(id) {
    try {
      const member = await this.fetchMemberById(id);
      if (!member || !window.Swal) return;

      const memberCode = this.getMemberCode(member);
      const status = String(member.membership_status || 'ACTIVE').toUpperCase();
      const plan = member.membership_plan || 'STANDARD MEMBERSHIP';
      const expiry = member.membership_expires_at
        ? new Date(member.membership_expires_at).toLocaleDateString()
        : 'NOT SET';

      await window.Swal.fire({
        title: 'MEMBER PROFILE',
        background: '#0d0d0d',
        color: '#fff',
        confirmButtonText: 'CLOSE',
        html: `
          <div style="text-align:left; font-size:12px; line-height:1.6; text-transform:uppercase;">
            <div><strong>Name:</strong> ${WOLF_PURIFIER(member.full_name || 'N/A')}</div>
            <div><strong>Member ID:</strong> ${WOLF_PURIFIER(memberCode)}</div>
            <div><strong>Contact:</strong> ${WOLF_PURIFIER(member.contact_number || 'N/A')}</div>
            <div><strong>Email:</strong> ${WOLF_PURIFIER(member.email_address || 'N/A')}</div>
            <div><strong>Status:</strong> ${WOLF_PURIFIER(status)}</div>
            <div><strong>Plan:</strong> ${WOLF_PURIFIER(plan)}</div>
            <div><strong>Expiry:</strong> ${WOLF_PURIFIER(expiry)}</div>
          </div>
        `,
      });
    } catch (err) {
      console.error('Member Profile Load Failed:', err);
      if (window.salesManager) {
        window.salesManager.showSystemAlert('DATABASE_REJECTED_ENTRY', 'error');
      }
    }
  },

  async attendance(id) {
    try {
      const member = await this.fetchMemberById(id);
      if (!member || !window.Swal) return;

      let logs = [];
      if (member.profile_id) {
        const { data, error } = await window.supabaseClient
          .from('check_in_logs')
          .select('time_in,time_out,notes,is_paid,paid_amount')
          .eq('profile_id', member.profile_id)
          .order('time_in', { ascending: false })
          .limit(8);
        if (!error) logs = data || [];
      }

      const rows = logs.length
        ? logs
            .map((log) => {
              const timeIn = log.time_in
                ? new Date(log.time_in).toLocaleString()
                : 'N/A';
              const timeOut = log.time_out
                ? new Date(log.time_out).toLocaleString()
                : 'ACTIVE SESSION';
              return `<div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
                <div><strong>IN:</strong> ${WOLF_PURIFIER(timeIn)}</div>
                <div><strong>OUT:</strong> ${WOLF_PURIFIER(timeOut)}</div>
              </div>`;
            })
            .join('')
        : '<div style="padding:10px 0;">NO ATTENDANCE LOGS FOUND.</div>';

      await window.Swal.fire({
        title: 'ATTENDANCE SNAPSHOT',
        background: '#0d0d0d',
        color: '#fff',
        confirmButtonText: 'CLOSE',
        html: `<div style="text-align:left; font-size:12px; max-height:320px; overflow:auto;">${rows}</div>`,
      });
    } catch (err) {
      console.error('Attendance Lookup Failed:', err);
      if (window.salesManager) {
        window.salesManager.showSystemAlert('DATABASE_REJECTED_ENTRY', 'error');
      }
    }
  },

  async changePlan(id) {
    if (!window.Swal) return;
    const accent = this.getAccentColor();

    const result = await window.Swal.fire({
      title: 'CHANGE PLAN',
      background: '#0d0d0d',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: accent,
      confirmButtonText: 'APPLY',
      html: `
        <input id="member-plan-input" class="swal2-input" placeholder="Plan Name (e.g. Monthly Premium)" />
        <input id="member-expiry-input" class="swal2-input" type="date" />
      `,
      preConfirm: () => {
        const plan = document.getElementById('member-plan-input')?.value?.trim();
        if (!plan) {
          window.Swal.showValidationMessage('Plan is required.');
          return null;
        }
        const expiry = document.getElementById('member-expiry-input')?.value || null;
        return { plan, expiry };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    const updates = {
      membership_plan: result.value.plan,
      membership_status: 'ACTIVE',
      membership_expires_at: result.value.expiry || null,
      is_active: true,
    };

    const { error, missingColumns } = await this.updateLifecycleFields(id, updates);
    if (error) {
      if (missingColumns) {
        window.Swal.fire(
          'MISSING COLUMNS',
          'Run docs/sql/members_membership_fields.sql in Supabase then retry.',
          'warning',
        );
      } else {
        window.Swal.fire('ERROR', error.message || 'Failed to update plan.', 'error');
      }
      return;
    }

    if (window.salesManager) window.salesManager.showSystemAlert('PLAN UPDATED', 'success');
    await this.fetchMembers();
  },

  async deactivate(id) {
    if (!window.Swal) return;
    const accent = this.getAccentColor();
    const result = await window.Swal.fire({
      title: 'DEACTIVATE MEMBER?',
      text: 'They will lose access until renewed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: accent,
      background: '#0d0d0d',
      color: '#fff',
    });

    if (!result.isConfirmed) return;

    const { error, missingColumns } = await this.updateLifecycleFields(id, {
      membership_status: 'INACTIVE',
      is_active: false,
    });

    if (error) {
      if (missingColumns) {
        window.Swal.fire(
          'MISSING COLUMNS',
          'Run docs/sql/members_membership_fields.sql in Supabase then retry.',
          'warning',
        );
      } else {
        window.Swal.fire('ERROR', error.message || 'Failed to deactivate member.', 'error');
      }
      return;
    }

    if (window.salesManager) {
      window.salesManager.showSystemAlert('MEMBER DEACTIVATED', 'warning');
    }
    await this.fetchMembers();
  },

  getMainSkeleton() {
    return Array(6)
      .fill(0)
      .map(
        () => `
      <div class="col-12 col-md-6 col-xl-4 opacity-50">
        <div style="height: 220px; background: var(--skeleton-base); border-radius: 20px; border: 1px solid var(--border-color); position: relative; overflow: hidden;">
          <div class="skel-shimmer" style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(90deg, transparent, var(--skeleton-mid), transparent); animation: skel-loading 1.5s infinite;"></div>
        </div>
      </div>
    `,
      )
      .join('');
  },

  getTrashSkeleton() {
    return Array(5)
      .fill(0)
      .map(
        () => `
      <div class="wolf-skel-pill" style="display:flex; align-items:center; gap:15px; padding:12px; margin-bottom:10px; background:var(--surface-elevated); border-radius:12px; border:1px dashed var(--border-color);">
        <div style="width:40px; height:40px; background:var(--skeleton-base); border-radius:10px;"></div>
        <div style="width:120px; height:12px; background:var(--skeleton-mid); border-radius:4px;"></div>
      </div>
    `,
      )
      .join('');
  },

  async init() {
    console.log('Wolf OS: Member Manager Initializing...');
    this.setupUIListeners();
    await this.fetchMembers();
  },

  /**
   * 1. DATA ACQUISITION
   */
  async fetchMembers() {
    const container = document.getElementById('members-list');
    if (container) container.innerHTML = this.getMainSkeleton(); // Show Skeleton

    try {
      let { data, error } = await window.supabaseClient
        .from('members')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      this.allMembers = (data || []).map((row) => ({
        ...row,
        id: row.member_id,
        phone: row.contact_number,
        email: row.email_address,
        member_code: this.getMemberCode(row),
        sku: row.sku,
        membership_status: String(row.membership_status || 'ACTIVE').toUpperCase(),
        membership_plan: row.membership_plan || 'STANDARD MEMBERSHIP',
        membership_expires_at: row.membership_expires_at || null,
      }));
      this.currentFilterList = [...this.allMembers];
      this.currentPage = 1;
      this.render(this.allMembers);

      const countEl =
        document.getElementById('total-members-count') ||
        document.getElementById('active-members-count');
      if (countEl) countEl.innerText = this.allMembers.length;
      // Artificial delay to let skeleton be noticed (optional, 400ms is good)
      setTimeout(() => this.render(this.allMembers), 400);
    } catch (err) {
      console.error('Member Database Error:', err);
      if (window.Swal) {
        window.Swal.fire({
          title: 'MEMBER ACCESS BLOCKED',
          text: 'RLS may be blocking reads. Run docs/sql/members_rls_policy.sql in Supabase.',
          icon: 'warning',
          background: '#0d0d0d',
          color: '#fff',
        });
      }
    }
  },

  async fetchTrashData() {
    const container = document.getElementById('trash-list');
    if (container) container.innerHTML = this.getTrashSkeleton(); // Show Skeleton

    try {
      const { data, error } = await window.supabaseClient
        .from('trash_bin')
        .select('*')
        .in('table_name', ['members', 'profiles'])
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      this.trashData = data || [];

      const trashCountEl =
        document.getElementById('trash-count') ||
        document.getElementById('archived-members-count');
      if (trashCountEl) trashCountEl.innerText = this.trashData.length;
      setTimeout(() => this.renderTrash(), 400);
      this.renderTrash();
    } catch (err) {
      console.error('Trash Sync Error:', err);
    }
  },

  /**
   * 2. UI RENDERING (3D CARD ENGINE)
   */
  render(list) {
    const container = document.getElementById('members-list');
    if (!container) return;

    this.currentFilterList = Array.isArray(list) ? [...list] : [];
    container.innerHTML = '';
    container.style.opacity = '1';
    container.className = 'row g-4 wolf-page-intro';

    if (!list || list.length === 0) {
      container.innerHTML =
        '<div class="text-center py-5 text-secondary w-100">NO RECORDS FOUND</div>';
      return;
    }

    const totalItems = list.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const start = (this.currentPage - 1) * this.pageSize;
    const visible = list.slice(start, start + this.pageSize);

    container.innerHTML = visible
      .map((m, index) => {
        const rawMemberCode = this.getMemberCode(m);
        const shortId = WOLF_PURIFIER(rawMemberCode);
        const delay = index * 0.05;
        const cleanName = WOLF_PURIFIER(
          m.full_name || 'UNKNOWN_USER',
        ).toUpperCase();
        const issueDate = m.created_at
          ? new Date(m.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'N/A';
        const memberCode = WOLF_PURIFIER(rawMemberCode);
        const qrPayload = encodeURIComponent(rawMemberCode);

        return `
        <div class="col-12 col-md-6 col-xl-4 animate__animated animate__fadeInUp" style="animation-delay: ${delay}s">
          <div class="membership-card-scene">
            <div class="membership-card" id="card-${m.id}" onclick="MemberManager.toggleFlip('${m.id}')">
              
              <!-- FRONT FACE -->
              <div class="card-face card-front">
                <!-- FEATURE: Top Right Action Buttons -->
                <div class="card-actions-top">
                  <button onclick="event.stopPropagation(); MemberManager.edit('${m.id}')" title="Edit Profile">
                    <i class="bx bx-edit-alt"></i>
                  </button>
                  <button onclick="event.stopPropagation(); MemberManager.delete('${m.id}')" title="Delete Member">
                    <i class="bx bx-trash"></i>
                  </button>
                </div>

                <div class="card-overlay-logo"></div>
                <div class="card-header-text">WOLF PALOMAR GYM</div>
                
                <div class="card-body-content">
                  <div class="qr-section">
                    <div class="qr-box">
                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrPayload}" alt="QR">
                    </div>
                    <div class="uid-text">MEMBER: ${shortId}</div>
                  </div>

                  <div class="info-section">
                    <div class="info-group"><label>FULL NAME</label><div class="value">${cleanName}</div></div>
                    <div class="info-group"><label>SKU IDENTIFIER</label><div class="value">${memberCode}</div></div>
                    <div class="info-group"><label>ISSUE DATE</label><div class="value">${issueDate}</div></div>
                    <div class="info-group"><label>CONTACT</label><div class="value">${WOLF_PURIFIER(m.phone || 'N/A')}</div></div>
                    <div class="info-group"><label>STATUS</label><div class="value">${WOLF_PURIFIER(m.membership_status || 'ACTIVE')}</div></div>
                  </div>
                </div>
                <div class="card-footer">
                  <div class="signature-box"><div class="sig-line"></div><label>SIGNATURE</label></div>
                  <div class="hint-text">CLICK TO MANAGE</div>
                </div>
              </div>

              <!-- BACK FACE -->
              <div class="card-face card-back">
                <!-- FEATURE: Dynamic Management Title with Name -->
                <div class="back-header">${cleanName}</div>

                <div class="action-grid">
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.viewProfile('${m.id}')">
                    <i class="bx bx-user-circle"></i>
                    <span class="btn-label">View Profile</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.attendance('${m.id}')">
                    <i class="bx bx-calendar-check"></i>
                    <span class="btn-label">Attendance</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.changePlan('${m.id}')">
                    <i class="bx bx-refresh"></i>
                    <span class="btn-label">Change Plan</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.deactivate('${m.id}')">
                    <i class="bx bx-user-x"></i>
                    <span class="btn-label">Deactivate</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.checkIn('${m.id}')">
                    <i class="bx bx-log-in-circle"></i>
                    <span class="btn-label">Check-In</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.renew('${m.id}')">
                    <i class="bx bx-reset"></i>
                    <span class="btn-label">Renew</span>
                  </button>
                </div>
                
                <div class="back-footer"> < < < CLICK ME TO FLIP BACK > > > </div>
              </div>

            </div>
          </div>
        </div>`;
      })
      .join('');

    if (totalItems > this.pageSize) {
      container.innerHTML += `
        <div class="col-12" style="display:flex; justify-content:center; align-items:center; gap:10px; margin-top:8px;">
          <button onclick="MemberManager.setPage(${this.currentPage - 1})" ${this.currentPage <= 1 ? 'disabled' : ''} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class='bx bx-chevron-left'></i></button>
          <span style="font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#97a4ba;">Page ${this.currentPage} of ${totalPages}</span>
          <button onclick="MemberManager.setPage(${this.currentPage + 1})" ${this.currentPage >= totalPages ? 'disabled' : ''} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class='bx bx-chevron-right'></i></button>
        </div>
      `;
    }
  },

  setPage(page) {
    const nextPage = Number(page);
    if (!Number.isFinite(nextPage) || nextPage < 1) return;
    this.currentPage = nextPage;
    this.render(this.currentFilterList.length ? this.currentFilterList : this.allMembers);
  },

  renderTrash() {
    const container = document.getElementById('trash-list');
    if (!container) return;

    // 1. CLEAR EVERYTHING (Hard Reset)
    container.innerHTML = '';

    // 2. FORCE CONTAINER VISIBILITY
    container.style.display = 'block';
    container.style.opacity = '1';
    container.style.visibility = 'visible';

    if (this.trashData.length === 0) {
      container.innerHTML = `<div class="text-center py-5 opacity-50">RECOVERY_BIN_EMPTY</div>`;
      return;
    }

    // 3. THE "DOUBLE TICK" RENDER
    // We wait for the browser to acknowledge the empty container before filling it
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const canHardDelete = this.canHardDelete();
        container.innerHTML = this.trashData
          .map((item, index) => {
            const p = item.deleted_data || {};
            const shortId = this.getMemberCode({
              member_code: p.member_code,
              member_id: p.member_id || item.original_id,
            });

            return `
            <div class="trash-pill-card animate__animated animate__fadeInRight" 
                 style="animation-delay: ${index * 0.05}s; 
                        opacity: 1 !important; 
                        visibility: visible !important; 
                        display: flex !important;">
              <div class="trash-avatar-node"><i class="bx bx-user-x"></i></div>
              <div class="trash-details">
                <h6 style="color:white !important; opacity:1 !important;">${WOLF_PURIFIER(p.full_name || 'UNKNOWN')}</h6>
                <p>UID: ${shortId}</p>
              </div>
              <div class="trash-action-group">
                <button class="btn-trash-action restore" onclick="MemberManager.restore('${item.id}')"><i class="bx bx-undo"></i></button>
                ${
                  canHardDelete
                    ? `<button class="btn-trash-action purge" onclick="MemberManager.wipePermanent('${item.id}')"><i class="bx bx-shield-x"></i></button>`
                    : ''
                }
              </div>
            </div>`;
          })
          .join('');
      });
    });
  },

  /**
   * 3. UI INTERACTION & LISTENERS
   */
  setupUIListeners() {
    const root = document.getElementById('member-main-view') || document;

    // Search Bar Logic (scoped to Members tab to avoid ID collisions)
    const searchBtn = root.querySelector('#toggle-search-btn');
    const searchContainer = root.querySelector('#ledger-search-container');
    const searchInput = root.querySelector('#member-main-search');
    const clearBtn = root.querySelector('#search-clear-btn');

    const trashBtn = root.querySelector('#btn-view-trash');
    if (trashBtn) {
      trashBtn.onclick = () => this.switchToTrash();
    }

    if (searchBtn && searchContainer && searchInput) {
      searchBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        searchBtn.classList.toggle('active');
        searchContainer.classList.toggle('active');
        if (searchContainer.classList.contains('active')) searchInput.focus();
      };
    }

    if (searchInput) {
      searchInput.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        if (clearBtn)
          clearBtn.style.display = term.length > 0 ? 'block' : 'none';

        const filtered = this.allMembers.filter(
          (m) =>
            (m.full_name && m.full_name.toLowerCase().includes(term)) ||
            (m.member_code && m.member_code.toLowerCase().includes(term)) ||
            (m.sku && String(m.sku).toLowerCase().includes(term)) ||
            (m.phone && String(m.phone).toLowerCase().includes(term)) ||
            (m.email && String(m.email).toLowerCase().includes(term)) ||
            (m.id && String(m.id).toLowerCase().includes(term)),
        );
        this.currentPage = 1;
        this.render(filtered);
      };
    }

    if (clearBtn && searchInput) {
      clearBtn.onclick = () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        this.currentPage = 1;
        this.render(this.allMembers);
      };
    }
  },

  /**
   * TRANSITION: MAIN -> TRASH
   */
  async switchToTrash() {
    const mainWrapper = document.getElementById('member-main-view');
    const mainContent = document.getElementById('main-content');
    if (!mainWrapper) return;

    if (window.wolfAudio) window.wolfAudio.play('woosh');

    // Slide out animation
    mainWrapper.classList.remove('stage-center');
    mainWrapper.classList.add('stage-left');

    const response = await fetch(
      '/pages/management/member-trash-container.html',
    );
    const html = await response.text();

    setTimeout(() => {
      mainContent.innerHTML = html;
      const trashWrapper = document.getElementById('member-trash-view');

      // Add Intro classes
      trashWrapper.classList.add('stage-right');
      void trashWrapper.offsetWidth; // Reflow
      trashWrapper.classList.remove('stage-right');
      trashWrapper.classList.add('stage-center');

      this.initTrashView(); // This calls fetchTrashData which shows the skeleton
    }, 500);
  },

  /**
   * TRANSITION: TRASH -> MAIN (Back Button)
   */
  async initTrashView() {
    const backBtn = document.getElementById('btn-trash-back');
    if (!backBtn) return;

    backBtn.onclick = async () => {
      const trashWrapper = document.getElementById('member-trash-view');
      const mainContent = document.getElementById('main-content');

      if (window.wolfAudio) window.wolfAudio.play('woosh');

      // 1. Outro: Slide Trash back to the RIGHT
      trashWrapper.classList.remove('stage-center');
      trashWrapper.classList.add('stage-right');

      setTimeout(async () => {
        // 2. Load Main Member List
        const response = await fetch('/pages/management/members.html');
        const mainHtml = await response.text();
        mainContent.innerHTML = mainHtml;

        const mainWrapper = document.getElementById('member-main-view');

        // 3. Set Starting Position (Off-screen Left)
        mainWrapper.classList.add('stage-left');
        void mainWrapper.offsetWidth;

        // 4. Intro: Slide back to Center
        mainWrapper.classList.remove('stage-left');
        mainWrapper.classList.add('stage-center');

        this.init(); // Re-initialize member data
      }, 500);
    };

    await this.fetchTrashData();
  },

  async restore(trashId) {
    const item = this.trashData.find((t) => t.id === trashId);
    if (!item?.deleted_data) return;
    const restoreTable = item.table_name === 'profiles' ? 'profiles' : 'members';

    // 1. Insert back to original table (legacy profiles rows are preserved)
    const { error: insErr } = await window.supabaseClient
      .from(restoreTable)
      .insert([item.deleted_data]);

    if (!insErr) {
      // 2. Remove from trash
      await window.supabaseClient.from('trash_bin').delete().eq('id', trashId);
      if (window.wolfAudio) window.wolfAudio.play('success');
      this.fetchTrashData();
    }
  },

  async wipePermanent(trashId) {
    if (!this.canHardDelete()) {
      if (window.wolfAudio) window.wolfAudio.play('denied');
      await Swal.fire('ACCESS DENIED', 'Only admin can hard delete records.', 'warning');
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: 'TERMINATE RECORD?',
      text: 'This action cannot be undone. Data will be purged.',
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      background: '#0a0a0a',
      color: '#fff',
    });

    if (isConfirmed) {
      await window.supabaseClient.from('trash_bin').delete().eq('id', trashId);
      this.fetchTrashData();
    }
  },

  toggleFlip(id) {
    const card = document.getElementById(`card-${id}`);
    if (card) {
      card.classList.toggle('is-flipped');
      if (window.wolfAudio) window.wolfAudio.play('swipe');
    }
  },

  /**
   * 4. ACTION HANDLERS
   */
  async delete(id) {
    const accent = this.getAccentColor();
    const result = await Swal.fire({
      title: 'MOVE TO TRASH?',
      text: 'Member will be archived and can be restored later.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ARCHIVE',
      confirmButtonColor: accent,
      background: '#0d0d0d',
      color: '#fff',
    });

    if (result.isConfirmed) {
      try {
        // A. Get current member data
        const { data: memberRow, error: fetchErr } = await window.supabaseClient
          .from('members')
          .select('*')
          .eq('member_id', id)
          .single();

        if (fetchErr) throw fetchErr;

        // B. Move to trash_bin table
        const { error: trashErr } = await window.supabaseClient
          .from('trash_bin')
          .insert([
            {
              original_id: id,
              table_name: 'members',
              deleted_data: memberRow,
              deleted_by: (await window.supabaseClient.auth.getUser()).data.user
                ?.id,
            },
          ]);

        if (trashErr) throw trashErr;

        // C. Remove from original table
        const { error: deleteErr } = await window.supabaseClient
          .from('members')
          .delete()
          .eq('member_id', id);

        if (deleteErr) throw deleteErr;

        // SUCCESS
        if (window.wolfAudio) window.wolfAudio.play('success');
        Swal.fire({
          title: 'ARCHIVED',
          text: 'Member moved to Trash Bin.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: '#0d0d0d',
          color: '#fff',
        });

        await this.fetchMembers();
      } catch (err) {
        console.error('Archive Protocol Failed:', err);
        Swal.fire('ERROR', 'Could not archive: ' + err.message, 'error');
        if (window.wolfAudio) window.wolfAudio.play('error');
      }
    }
  },

  async checkIn(id) {
    try {
      const member = await this.fetchMemberById(id);
      if (!member) return;

      const fullName = String(member.full_name || '').trim();
      if (!fullName) return;

      if (
        window.logbookManager &&
        typeof window.logbookManager.processCheckIn === 'function'
      ) {
        await window.logbookManager.processCheckIn(fullName, {
          entryType: 'member',
          isPaid: false,
        });
      } else if (typeof navigateTo === 'function') {
        window.WOLF_PENDING_MEMBER_ID = id;
        navigateTo('logbook');
      }

      if (window.salesManager) {
        window.salesManager.showSystemAlert(`ACCESS GRANTED: ${fullName}`, 'success');
      }
    } catch (err) {
      console.error('Member Check-In Failed:', err);
      if (window.salesManager) {
        window.salesManager.showSystemAlert('DATABASE_REJECTED_ENTRY', 'error');
      }
    }
  },
  edit(id) {
    if (window.wolfAudio) window.wolfAudio.play('notif');
    window.WOLF_PENDING_MEMBER_ID = id;

    if (typeof navigateTo === 'function') {
      navigateTo('id-maker');
      return;
    }

    if (window.wolfRouter && typeof window.wolfRouter.goToMain === 'function') {
      window.wolfRouter.goToMain('id-maker');
      return;
    }

    window.location.href = '/pages/main.html?p=id-maker';
  },
  async renew(id) {
    if (!window.Swal) return;

    const now = new Date();
    const defaultExpiry = new Date(now);
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);

    const result = await window.Swal.fire({
      title: 'RENEW MEMBERSHIP',
      background: '#0d0d0d',
      color: '#fff',
      showCancelButton: true,
      confirmButtonText: 'RENEW',
      html: `
        <input id="renew-plan" class="swal2-input" placeholder="Membership Plan" value="MONTHLY MEMBERSHIP" />
        <input id="renew-expiry" class="swal2-input" type="date" value="${defaultExpiry.toISOString().slice(0, 10)}" />
      `,
      preConfirm: () => {
        const plan = document.getElementById('renew-plan')?.value?.trim();
        const expiry = document.getElementById('renew-expiry')?.value || null;
        if (!plan) {
          window.Swal.showValidationMessage('Plan is required.');
          return null;
        }
        return { plan, expiry };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    const { error, missingColumns } = await this.updateLifecycleFields(id, {
      membership_plan: result.value.plan,
      membership_status: 'ACTIVE',
      membership_expires_at: result.value.expiry,
      is_active: true,
    });

    if (error) {
      if (missingColumns) {
        window.Swal.fire(
          'MISSING COLUMNS',
          'Run docs/sql/members_membership_fields.sql in Supabase then retry.',
          'warning',
        );
      } else {
        window.Swal.fire('ERROR', error.message || 'Renewal failed.', 'error');
      }
      return;
    }

    if (window.salesManager) {
      window.salesManager.showSystemAlert('MEMBERSHIP RENEWED', 'success');
    }
    await this.fetchMembers();
  },

  renderSkeleton() {
    const container = document.getElementById('members-list');
    if (container) {
      container.innerHTML = `
        <div class="col-12 text-center py-5 opacity-25">
          <div class="spinner-border text-light"></div>
        </div>`;
    }
  },
};
