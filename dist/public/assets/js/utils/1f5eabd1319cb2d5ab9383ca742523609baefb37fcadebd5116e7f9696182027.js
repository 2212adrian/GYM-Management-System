const MemberManager={allMembers:[],trashData:[],getAccentColor(){return getComputedStyle(document.body).getPropertyValue("--wolf-red").trim()||"#a63429"},getMemberCode(e){const t=String((e==null?void 0:e.sku)||(e==null?void 0:e.member_code)||"").trim().toUpperCase();return t?t.startsWith("ME-")?t:`ME-${t}`:`ME-${String((e==null?void 0:e.member_id)||(e==null?void 0:e.id)||"").replace(/[^A-Z0-9]/gi,"").toUpperCase().slice(0,4).padEnd(4,"0")}`},viewProfile(e){console.log("Protocol: Viewing Profile for",e)},attendance(e){console.log("Protocol: Loading Attendance for",e)},changePlan(e){console.log("Protocol: Opening Plan Manager for",e)},deactivate(e){const t=this.getAccentColor();Swal.fire({title:"DEACTIVATE MEMBER?",text:"They will lose access to the gym immediately.",icon:"warning",showCancelButton:!0,confirmButtonColor:t,background:"#0d0d0d",color:"#fff"}).then(a=>{a.isConfirmed&&console.log("Protocol: Deactivating",e)})},getMainSkeleton(){return Array(6).fill(0).map(()=>`
      <div class="col-12 col-md-6 col-xl-4 opacity-50">
        <div style="height: 220px; background: var(--skeleton-base); border-radius: 20px; border: 1px solid var(--border-color); position: relative; overflow: hidden;">
          <div class="skel-shimmer" style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(90deg, transparent, var(--skeleton-mid), transparent); animation: skel-loading 1.5s infinite;"></div>
        </div>
      </div>
    `).join("")},getTrashSkeleton(){return Array(5).fill(0).map(()=>`
      <div class="wolf-skel-pill" style="display:flex; align-items:center; gap:15px; padding:12px; margin-bottom:10px; background:var(--surface-elevated); border-radius:12px; border:1px dashed var(--border-color);">
        <div style="width:40px; height:40px; background:var(--skeleton-base); border-radius:10px;"></div>
        <div style="width:120px; height:12px; background:var(--skeleton-mid); border-radius:4px;"></div>
      </div>
    `).join("")},async init(){console.log("Wolf OS: Member Manager Initializing..."),this.setupUIListeners(),await this.fetchMembers()},async fetchMembers(){const e=document.getElementById("members-list");e&&(e.innerHTML=this.getMainSkeleton());try{const{data:t,error:a}=await window.supabaseClient.from("members").select("member_id, profile_id, member_code, sku, full_name, contact_number, email_address, created_at").order("full_name",{ascending:!0});if(a)throw a;this.allMembers=(t||[]).map(i=>({...i,id:i.member_id,phone:i.contact_number,email:i.email_address,member_code:this.getMemberCode(i),sku:i.sku})),this.render(this.allMembers);const n=document.getElementById("total-members-count")||document.getElementById("active-members-count");n&&(n.innerText=this.allMembers.length),setTimeout(()=>this.render(this.allMembers),400)}catch(t){console.error("Member Database Error:",t),window.Swal&&window.Swal.fire({title:"MEMBER ACCESS BLOCKED",text:"RLS may be blocking reads. Run docs/sql/members_rls_policy.sql in Supabase.",icon:"warning",background:"#0d0d0d",color:"#fff"})}},async fetchTrashData(){const e=document.getElementById("trash-list");e&&(e.innerHTML=this.getTrashSkeleton());try{const{data:t,error:a}=await window.supabaseClient.from("trash_bin").select("*").in("table_name",["members","profiles"]).order("deleted_at",{ascending:!1});if(a)throw a;this.trashData=t||[];const n=document.getElementById("trash-count")||document.getElementById("archived-members-count");n&&(n.innerText=this.trashData.length),setTimeout(()=>this.renderTrash(),400),this.renderTrash()}catch(t){console.error("Trash Sync Error:",t)}},render(e){const t=document.getElementById("members-list");if(t){if(t.innerHTML="",t.style.opacity="1",t.className="row g-4 wolf-page-intro",!e||e.length===0){t.innerHTML='<div class="text-center py-5 text-secondary w-100">NO RECORDS FOUND</div>';return}t.innerHTML=e.map((a,n)=>{const i=this.getMemberCode(a),r=WOLF_PURIFIER(i),l=n*.05,s=WOLF_PURIFIER(a.full_name||"UNKNOWN_USER").toUpperCase(),c=a.created_at?new Date(a.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"N/A",o=WOLF_PURIFIER(i),d=encodeURIComponent(i);return`
        <div class="col-12 col-md-6 col-xl-4 animate__animated animate__fadeInUp" style="animation-delay: ${l}s">
          <div class="membership-card-scene">
            <div class="membership-card" id="card-${a.id}" onclick="MemberManager.toggleFlip('${a.id}')">
              
              <!-- FRONT FACE -->
              <div class="card-face card-front">
                <!-- FEATURE: Top Right Action Buttons -->
                <div class="card-actions-top">
                  <button onclick="event.stopPropagation(); MemberManager.edit('${a.id}')" title="Edit Profile">
                    <i class="bx bx-edit-alt"></i>
                  </button>
                  <button onclick="event.stopPropagation(); MemberManager.delete('${a.id}')" title="Delete Member">
                    <i class="bx bx-trash"></i>
                  </button>
                </div>

                <div class="card-overlay-logo"></div>
                <div class="card-header-text">WOLF PALOMAR GYM</div>
                
                <div class="card-body-content">
                  <div class="qr-section">
                    <div class="qr-box">
                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${d}" alt="QR">
                    </div>
                    <div class="uid-text">MEMBER: ${r}</div>
                  </div>

                  <div class="info-section">
                    <div class="info-group"><label>FULL NAME</label><div class="value">${s}</div></div>
                    <div class="info-group"><label>SKU IDENTIFIER</label><div class="value">${o}</div></div>
                    <div class="info-group"><label>ISSUE DATE</label><div class="value">${c}</div></div>
                    <div class="info-group"><label>CONTACT</label><div class="value">${WOLF_PURIFIER(a.phone||"N/A")}</div></div>
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
                <div class="back-header">${s}</div>

                <div class="action-grid">
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.viewProfile('${a.id}')">
                    <i class="bx bx-user-circle"></i>
                    <span class="btn-label">View Profile</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.attendance('${a.id}')">
                    <i class="bx bx-calendar-check"></i>
                    <span class="btn-label">Attendance</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.changePlan('${a.id}')">
                    <i class="bx bx-refresh"></i>
                    <span class="btn-label">Change Plan</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.deactivate('${a.id}')">
                    <i class="bx bx-user-x"></i>
                    <span class="btn-label">Deactivate</span>
                  </button>
                </div>
                
                <div class="back-footer"> < < < CLICK ME TO FLIP BACK > > > </div>
              </div>

            </div>
          </div>
        </div>`}).join("")}},renderTrash(){const e=document.getElementById("trash-list");if(e){if(e.innerHTML="",e.style.display="block",e.style.opacity="1",e.style.visibility="visible",this.trashData.length===0){e.innerHTML='<div class="text-center py-5 opacity-50">RECOVERY_BIN_EMPTY</div>';return}requestAnimationFrame(()=>{requestAnimationFrame(()=>{e.innerHTML=this.trashData.map((t,a)=>{const n=t.deleted_data||{},i=this.getMemberCode({member_code:n.member_code,member_id:n.member_id||t.original_id});return`
            <div class="trash-pill-card animate__animated animate__fadeInRight" 
                 style="animation-delay: ${a*.05}s; 
                        opacity: 1 !important; 
                        visibility: visible !important; 
                        display: flex !important;">
              <div class="trash-avatar-node"><i class="bx bx-user-x"></i></div>
              <div class="trash-details">
                <h6 style="color:white !important; opacity:1 !important;">${WOLF_PURIFIER(n.full_name||"UNKNOWN")}</h6>
                <p>UID: ${i}</p>
              </div>
              <div class="trash-action-group">
                <button class="btn-trash-action restore" onclick="MemberManager.restore('${t.id}')"><i class="bx bx-undo"></i></button>
                <button class="btn-trash-action purge" onclick="MemberManager.wipePermanent('${t.id}')"><i class="bx bx-shield-x"></i></button>
              </div>
            </div>`}).join("")})})}},setupUIListeners(){const e=document.getElementById("member-main-view")||document,t=e.querySelector("#toggle-search-btn"),a=e.querySelector("#ledger-search-container"),n=e.querySelector("#member-main-search"),i=e.querySelector("#search-clear-btn"),r=e.querySelector("#btn-view-trash");r&&(r.onclick=()=>this.switchToTrash()),t&&a&&n&&(t.onclick=l=>{l.preventDefault(),l.stopPropagation(),t.classList.toggle("active"),a.classList.toggle("active"),a.classList.contains("active")&&n.focus()}),n&&(n.oninput=l=>{const s=l.target.value.toLowerCase();i&&(i.style.display=s.length>0?"block":"none");const c=this.allMembers.filter(o=>o.full_name&&o.full_name.toLowerCase().includes(s)||o.member_code&&o.member_code.toLowerCase().includes(s)||o.sku&&String(o.sku).toLowerCase().includes(s)||o.phone&&String(o.phone).toLowerCase().includes(s)||o.email&&String(o.email).toLowerCase().includes(s)||o.id&&String(o.id).toLowerCase().includes(s));this.render(c)}),i&&n&&(i.onclick=()=>{n.value="",i.style.display="none",this.render(this.allMembers)})},async switchToTrash(){const e=document.getElementById("member-main-view"),t=document.getElementById("main-content");if(!e)return;window.wolfAudio&&window.wolfAudio.play("woosh"),e.classList.remove("stage-center"),e.classList.add("stage-left");const n=await(await fetch("/pages/management/member-trash-container.html")).text();setTimeout(()=>{t.innerHTML=n;const i=document.getElementById("member-trash-view");i.classList.add("stage-right"),i.offsetWidth,i.classList.remove("stage-right"),i.classList.add("stage-center"),this.initTrashView()},500)},async initTrashView(){const e=document.getElementById("btn-trash-back");e&&(e.onclick=async()=>{const t=document.getElementById("member-trash-view"),a=document.getElementById("main-content");window.wolfAudio&&window.wolfAudio.play("woosh"),t.classList.remove("stage-center"),t.classList.add("stage-right"),setTimeout(async()=>{const i=await(await fetch("/pages/management/members.html")).text();a.innerHTML=i;const r=document.getElementById("member-main-view");r.classList.add("stage-left"),r.offsetWidth,r.classList.remove("stage-left"),r.classList.add("stage-center"),this.init()},500)},await this.fetchTrashData())},async restore(e){const t=this.trashData.find(i=>i.id===e);if(!(t!=null&&t.deleted_data))return;const a=t.table_name==="profiles"?"profiles":"members",{error:n}=await window.supabaseClient.from(a).insert([t.deleted_data]);n||(await window.supabaseClient.from("trash_bin").delete().eq("id",e),window.wolfAudio&&window.wolfAudio.play("success"),this.fetchTrashData())},async wipePermanent(e){const{isConfirmed:t}=await Swal.fire({title:"TERMINATE RECORD?",text:"This action cannot be undone. Data will be purged.",icon:"error",showCancelButton:!0,confirmButtonColor:"#d33",background:"#0a0a0a",color:"#fff"});t&&(await window.supabaseClient.from("trash_bin").delete().eq("id",e),this.fetchTrashData())},toggleFlip(e){const t=document.getElementById(`card-${e}`);t&&(t.classList.toggle("is-flipped"),window.wolfAudio&&window.wolfAudio.play("swipe"))},async delete(e){var n;const t=this.getAccentColor();if((await Swal.fire({title:"MOVE TO TRASH?",text:"Member will be archived and can be restored later.",icon:"warning",showCancelButton:!0,confirmButtonText:"ARCHIVE",confirmButtonColor:t,background:"#0d0d0d",color:"#fff"})).isConfirmed)try{const{data:i,error:r}=await window.supabaseClient.from("members").select("*").eq("member_id",e).single();if(r)throw r;const{error:l}=await window.supabaseClient.from("trash_bin").insert([{original_id:e,table_name:"members",deleted_data:i,deleted_by:(n=(await window.supabaseClient.auth.getUser()).data.user)==null?void 0:n.id}]);if(l)throw l;const{error:s}=await window.supabaseClient.from("members").delete().eq("member_id",e);if(s)throw s;window.wolfAudio&&window.wolfAudio.play("success"),Swal.fire({title:"ARCHIVED",text:"Member moved to Trash Bin.",icon:"success",timer:1500,showConfirmButton:!1,background:"#0d0d0d",color:"#fff"}),await this.fetchMembers()}catch(i){console.error("Archive Protocol Failed:",i),Swal.fire("ERROR","Could not archive: "+i.message,"error"),window.wolfAudio&&window.wolfAudio.play("error")}},checkIn(e){console.log("Protocol: Member Check-In",e)},edit(e){if(window.wolfAudio&&window.wolfAudio.play("notif"),window.WOLF_PENDING_MEMBER_ID=e,typeof navigateTo=="function"){navigateTo("id-maker");return}if(window.wolfRouter&&typeof window.wolfRouter.goToMain=="function"){window.wolfRouter.goToMain("id-maker");return}window.location.href="/pages/main.html?p=id-maker"},renew(e){console.log("Protocol: Process Renewal",e)},renderSkeleton(){const e=document.getElementById("members-list");e&&(e.innerHTML=`
        <div class="col-12 text-center py-5 opacity-25">
          <div class="spinner-border text-light"></div>
        </div>`)}};
