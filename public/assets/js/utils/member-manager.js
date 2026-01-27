/**
 * WOLF OS - MEMBER MANAGER (FINAL CONSOLIDATED)
 * Controls Membership Card 3D Rendering, Search Engine, and Summary HUD.
 */

const MemberManager = {
  allMembers: [],
  trashData: [],

  // Add these inside the MemberManager object
  viewProfile(id) {
    console.log('Protocol: Viewing Profile for', id);
  },
  attendance(id) {
    console.log('Protocol: Loading Attendance for', id);
  },
  changePlan(id) {
    console.log('Protocol: Opening Plan Manager for', id);
  },
  deactivate(id) {
    Swal.fire({
      title: 'DEACTIVATE MEMBER?',
      text: 'They will lose access to the gym immediately.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#a63429',
      background: '#0d0d0d',
      color: '#fff',
    }).then((result) => {
      if (result.isConfirmed) {
        console.log('Protocol: Deactivating', id);
      }
    });
  },

  getMainSkeleton() {
    return Array(6)
      .fill(0)
      .map(
        () => `
      <div class="col-12 col-md-6 col-xl-4 opacity-50">
        <div style="height: 220px; background: rgba(255,255,255,0.05); border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden;">
          <div class="skel-shimmer" style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent); animation: skel-loading 1.5s infinite;"></div>
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
      <div class="wolf-skel-pill" style="display:flex; align-items:center; gap:15px; padding:12px; margin-bottom:10px; background:rgba(255,255,255,0.02); border-radius:12px; border:1px dashed rgba(255,255,255,0.1);">
        <div style="width:40px; height:40px; background:rgba(255,255,255,0.05); border-radius:10px;"></div>
        <div style="width:120px; height:12px; background:rgba(255,255,255,0.05); border-radius:4px;"></div>
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
      const { data, error } = await window.supabaseClient
        .from('profiles')
        .select(
          'id, full_name, phone, email, created_at, memberships (status, membership_plans (name))',
        )
        .order('full_name', { ascending: true });

      if (error) throw error;
      this.allMembers = data;
      this.render(this.allMembers);

      const countEl =
        document.getElementById('total-members-count') ||
        document.getElementById('active-members-count');
      if (countEl) countEl.innerText = data.length;
      // Artificial delay to let skeleton be noticed (optional, 400ms is good)
      setTimeout(() => this.render(this.allMembers), 400);
    } catch (err) {
      console.error('Member Database Error:', err);
    }
  },

  async fetchTrashData() {
    const container = document.getElementById('trash-list');
    if (container) container.innerHTML = this.getTrashSkeleton(); // Show Skeleton

    try {
      const { data, error } = await window.supabaseClient
        .from('trash_bin')
        .select('*')
        .eq('table_name', 'profiles')
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

    container.innerHTML = '';
    container.style.opacity = '1';
    container.className = 'row g-4 wolf-page-intro';

    if (!list || list.length === 0) {
      container.innerHTML =
        '<div class="text-center py-5 text-secondary w-100">NO RECORDS FOUND</div>';
      return;
    }

    container.innerHTML = list
      .map((m, index) => {
        const shortId = m.id.split('-')[0].toUpperCase();
        const delay = index * 0.05;
        const cleanName = WOLF_PURIFIER(
          m.full_name || 'UNKNOWN_USER',
        ).toUpperCase();
        const issueDate = new Date(m.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

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
                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${m.id}" alt="QR">
                    </div>
                    <div class="uid-text">UID: ${shortId}</div>
                  </div>

                  <div class="info-section">
                    <div class="info-group"><label>FULL NAME</label><div class="value">${cleanName}</div></div>
                    <div class="info-group"><label>ISSUE DATE</label><div class="value">${issueDate}</div></div>
                    <div class="info-group"><label>CONTACT</label><div class="value">${WOLF_PURIFIER(m.phone || 'N/A')}</div></div>
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
                </div>
                
                <div class="back-footer"> < < < CLICK ME TO FLIP BACK > > > </div>
              </div>

            </div>
          </div>
        </div>`;
      })
      .join('');
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
        container.innerHTML = this.trashData
          .map((item, index) => {
            const p = item.deleted_data || {};
            const shortId = item.original_id
              ? item.original_id.split('-')[0].toUpperCase()
              : 'N/A';

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
                <button class="btn-trash-action purge" onclick="MemberManager.wipePermanent('${item.id}')"><i class="bx bx-shield-x"></i></button>
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
    // Search Bar Logic
    const searchBtn = document.getElementById('toggle-search-btn');
    const searchContainer = document.getElementById('ledger-search-container');
    const searchInput = document.getElementById('member-main-search');
    const clearBtn = document.getElementById('search-clear-btn');

    const trashBtn = document.getElementById('btn-view-trash');
    if (trashBtn) {
      trashBtn.onclick = () => this.switchToTrash();
    }

    if (searchBtn) {
      searchBtn.onclick = () => {
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
            m.id.includes(term),
        );
        this.render(filtered);
      };
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
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

    // 1. Insert back to profiles
    const { error: insErr } = await window.supabaseClient
      .from('profiles')
      .insert([item.deleted_data]);

    if (!insErr) {
      // 2. Remove from trash
      await window.supabaseClient.from('trash_bin').delete().eq('id', trashId);
      if (window.wolfAudio) window.wolfAudio.play('success');
      this.fetchTrashData();
    }
  },

  async wipePermanent(trashId) {
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
    const result = await Swal.fire({
      title: 'MOVE TO TRASH?',
      text: 'Member will be archived and can be restored later.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ARCHIVE',
      confirmButtonColor: '#a63429',
      background: '#0d0d0d',
      color: '#fff',
    });

    if (result.isConfirmed) {
      try {
        // A. Get current profile data
        const { data: profile, error: fetchErr } = await window.supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchErr) throw fetchErr;

        // B. Move to trash_bin table
        const { error: trashErr } = await window.supabaseClient
          .from('trash_bin')
          .insert([
            {
              original_id: id,
              table_name: 'profiles',
              deleted_data: profile,
              deleted_by: (await window.supabaseClient.auth.getUser()).data.user
                ?.id,
            },
          ]);

        if (trashErr) throw trashErr;

        // C. Remove from original table
        // Note: This might fail if memberships/sales exist without ON DELETE CASCADE
        const { error: deleteErr } = await window.supabaseClient
          .from('profiles')
          .delete()
          .eq('id', id);

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

  checkIn(id) {
    console.log('Protocol: Member Check-In', id);
  },
  edit(id) {
    console.log('Protocol: Open Edit Modal', id);
  },
  renew(id) {
    console.log('Protocol: Process Renewal', id);
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
