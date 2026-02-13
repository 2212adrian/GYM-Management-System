const MemberManager={allMembers:[],trashData:[],currentPage:1,pageSize:9,currentFilterList:[],getAccessContext(){const e=window.WOLF_ACCESS_CONTEXT||{},t=String(e.role||window.WOLF_USER_ROLE||"").trim().toLowerCase(),i=String(e.email||window.WOLF_USER_EMAIL||"").trim().toLowerCase();return{role:t,email:i}},canHardDelete(){const{role:e,email:t}=this.getAccessContext();return e==="admin"||t==="adrianangeles2212@gmail.com"||t==="ktorrazo123@gmail.com"},getAccentColor(){return getComputedStyle(document.body).getPropertyValue("--wolf-red").trim()||"#a63429"},getMemberCode(e){const t=String((e==null?void 0:e.sku)||(e==null?void 0:e.member_code)||"").trim().toUpperCase();return t?t.startsWith("ME-")?t:`ME-${t}`:`ME-${String((e==null?void 0:e.member_id)||(e==null?void 0:e.id)||"").replace(/[^A-Z0-9]/gi,"").toUpperCase().slice(0,4).padEnd(4,"0")}`},isMissingLifecycleColumnError(e){const t=String((e==null?void 0:e.message)||"").toLowerCase();return(e==null?void 0:e.code)==="PGRST204"||/column .* does not exist/.test(t)||/schema cache/.test(t)||/could not find the .* column/.test(t)},async fetchMemberById(e){const{data:t,error:i}=await window.supabaseClient.from("members").select("*").eq("member_id",e).maybeSingle();if(i)throw i;return t||null},async updateLifecycleFields(e,t={}){let i=await window.supabaseClient.from("members").update(t).eq("member_id",e).select("*").maybeSingle();return i.error&&this.isMissingLifecycleColumnError(i.error)?{data:null,error:i.error,missingColumns:!0}:{data:i.data||null,error:i.error||null,missingColumns:!1}},async viewProfile(e){try{const t=await this.fetchMemberById(e);if(!t||!window.Swal)return;const i=this.getMemberCode(t),n=String(t.membership_status||"ACTIVE").toUpperCase(),a=t.membership_plan||"STANDARD MEMBERSHIP",r=t.membership_expires_at?new Date(t.membership_expires_at).toLocaleDateString():"NOT SET";await window.Swal.fire({title:"MEMBER PROFILE",background:"#0d0d0d",color:"#fff",confirmButtonText:"CLOSE",html:`
          <div style="text-align:left; font-size:12px; line-height:1.6; text-transform:uppercase;">
            <div><strong>Name:</strong> ${WOLF_PURIFIER(t.full_name||"N/A")}</div>
            <div><strong>Member ID:</strong> ${WOLF_PURIFIER(i)}</div>
            <div><strong>Contact:</strong> ${WOLF_PURIFIER(t.contact_number||"N/A")}</div>
            <div><strong>Email:</strong> ${WOLF_PURIFIER(t.email_address||"N/A")}</div>
            <div><strong>Status:</strong> ${WOLF_PURIFIER(n)}</div>
            <div><strong>Plan:</strong> ${WOLF_PURIFIER(a)}</div>
            <div><strong>Expiry:</strong> ${WOLF_PURIFIER(r)}</div>
          </div>
        `})}catch(t){console.error("Member Profile Load Failed:",t),window.salesManager&&window.salesManager.showSystemAlert("DATABASE_REJECTED_ENTRY","error")}},async attendance(e){try{const t=await this.fetchMemberById(e);if(!t||!window.Swal)return;let i=[];if(t.profile_id){const{data:a,error:r}=await window.supabaseClient.from("check_in_logs").select("time_in,time_out,notes,is_paid,paid_amount").eq("profile_id",t.profile_id).order("time_in",{ascending:!1}).limit(8);r||(i=a||[])}const n=i.length?i.map(a=>{const r=a.time_in?new Date(a.time_in).toLocaleString():"N/A",s=a.time_out?new Date(a.time_out).toLocaleString():"ACTIVE SESSION";return`<div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
                <div><strong>IN:</strong> ${WOLF_PURIFIER(r)}</div>
                <div><strong>OUT:</strong> ${WOLF_PURIFIER(s)}</div>
              </div>`}).join(""):'<div style="padding:10px 0;">NO ATTENDANCE LOGS FOUND.</div>';await window.Swal.fire({title:"ATTENDANCE SNAPSHOT",background:"#0d0d0d",color:"#fff",confirmButtonText:"CLOSE",html:`<div style="text-align:left; font-size:12px; max-height:320px; overflow:auto;">${n}</div>`})}catch(t){console.error("Attendance Lookup Failed:",t),window.salesManager&&window.salesManager.showSystemAlert("DATABASE_REJECTED_ENTRY","error")}},async changePlan(e){if(!window.Swal)return;const t=this.getAccentColor(),i=await window.Swal.fire({title:"CHANGE PLAN",background:"#0d0d0d",color:"#fff",showCancelButton:!0,confirmButtonColor:t,confirmButtonText:"APPLY",html:`
        <input id="member-plan-input" class="swal2-input" placeholder="Plan Name (e.g. Monthly Premium)" />
        <input id="member-expiry-input" class="swal2-input" type="date" />
      `,preConfirm:()=>{var c,o,d;const s=(o=(c=document.getElementById("member-plan-input"))==null?void 0:c.value)==null?void 0:o.trim();if(!s)return window.Swal.showValidationMessage("Plan is required."),null;const l=((d=document.getElementById("member-expiry-input"))==null?void 0:d.value)||null;return{plan:s,expiry:l}}});if(!i.isConfirmed||!i.value)return;const n={membership_plan:i.value.plan,membership_status:"ACTIVE",membership_expires_at:i.value.expiry||null,is_active:!0},{error:a,missingColumns:r}=await this.updateLifecycleFields(e,n);if(a){r?window.Swal.fire("MISSING COLUMNS","Run docs/sql/members_membership_fields.sql in Supabase then retry.","warning"):window.Swal.fire("ERROR",a.message||"Failed to update plan.","error");return}window.salesManager&&window.salesManager.showSystemAlert("PLAN UPDATED","success"),await this.fetchMembers()},async deactivate(e){if(!window.Swal)return;const t=this.getAccentColor();if(!(await window.Swal.fire({title:"DEACTIVATE MEMBER?",text:"They will lose access until renewed.",icon:"warning",showCancelButton:!0,confirmButtonColor:t,background:"#0d0d0d",color:"#fff"})).isConfirmed)return;const{error:n,missingColumns:a}=await this.updateLifecycleFields(e,{membership_status:"INACTIVE",is_active:!1});if(n){a?window.Swal.fire("MISSING COLUMNS","Run docs/sql/members_membership_fields.sql in Supabase then retry.","warning"):window.Swal.fire("ERROR",n.message||"Failed to deactivate member.","error");return}window.salesManager&&window.salesManager.showSystemAlert("MEMBER DEACTIVATED","warning"),await this.fetchMembers()},getMainSkeleton(){return Array(6).fill(0).map(()=>`
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
    `).join("")},async init(){console.log("Wolf OS: Member Manager Initializing..."),this.setupUIListeners(),await this.fetchMembers()},async fetchMembers(){const e=document.getElementById("members-list");e&&(e.innerHTML=this.getMainSkeleton());try{let{data:t,error:i}=await window.supabaseClient.from("members").select("*").order("full_name",{ascending:!0});if(i)throw i;this.allMembers=(t||[]).map(a=>({...a,id:a.member_id,phone:a.contact_number,email:a.email_address,member_code:this.getMemberCode(a),sku:a.sku,membership_status:String(a.membership_status||"ACTIVE").toUpperCase(),membership_plan:a.membership_plan||"STANDARD MEMBERSHIP",membership_expires_at:a.membership_expires_at||null})),this.currentFilterList=[...this.allMembers],this.currentPage=1,this.render(this.allMembers);const n=document.getElementById("total-members-count")||document.getElementById("active-members-count");n&&(n.innerText=this.allMembers.length),setTimeout(()=>this.render(this.allMembers),400)}catch(t){console.error("Member Database Error:",t),window.Swal&&window.Swal.fire({title:"MEMBER ACCESS BLOCKED",text:"RLS may be blocking reads. Run docs/sql/members_rls_policy.sql in Supabase.",icon:"warning",background:"#0d0d0d",color:"#fff"})}},async fetchTrashData(){const e=document.getElementById("trash-list");e&&(e.innerHTML=this.getTrashSkeleton());try{const{data:t,error:i}=await window.supabaseClient.from("trash_bin").select("*").in("table_name",["members","profiles"]).order("deleted_at",{ascending:!1});if(i)throw i;this.trashData=t||[];const n=document.getElementById("trash-count")||document.getElementById("archived-members-count");n&&(n.innerText=this.trashData.length),setTimeout(()=>this.renderTrash(),400),this.renderTrash()}catch(t){console.error("Trash Sync Error:",t)}},render(e){const t=document.getElementById("members-list");if(!t)return;if(this.currentFilterList=Array.isArray(e)?[...e]:[],t.innerHTML="",t.style.opacity="1",t.className="row g-4 wolf-page-intro",!e||e.length===0){t.innerHTML='<div class="text-center py-5 text-secondary w-100">NO RECORDS FOUND</div>';return}const i=e.length,n=Math.max(1,Math.ceil(i/this.pageSize));this.currentPage>n&&(this.currentPage=n);const a=(this.currentPage-1)*this.pageSize,r=e.slice(a,a+this.pageSize);t.innerHTML=r.map((s,l)=>{const c=this.getMemberCode(s),o=WOLF_PURIFIER(c),d=l*.05,m=WOLF_PURIFIER(s.full_name||"UNKNOWN_USER").toUpperCase(),u=s.created_at?new Date(s.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"N/A",w=WOLF_PURIFIER(c),p=encodeURIComponent(c);return`
        <div class="col-12 col-md-6 col-xl-4 animate__animated animate__fadeInUp" style="animation-delay: ${d}s">
          <div class="membership-card-scene">
            <div class="membership-card" id="card-${s.id}" onclick="MemberManager.toggleFlip('${s.id}')">
              
              <!-- FRONT FACE -->
              <div class="card-face card-front">
                <!-- FEATURE: Top Right Action Buttons -->
                <div class="card-actions-top">
                  <button onclick="event.stopPropagation(); MemberManager.edit('${s.id}')" title="Edit Profile">
                    <i class="bx bx-edit-alt"></i>
                  </button>
                  <button onclick="event.stopPropagation(); MemberManager.delete('${s.id}')" title="Delete Member">
                    <i class="bx bx-trash"></i>
                  </button>
                </div>

                <div class="card-overlay-logo"></div>
                <div class="card-header-text">WOLF PALOMAR GYM</div>
                
                <div class="card-body-content">
                  <div class="qr-section">
                    <div class="qr-box">
                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${p}" alt="QR">
                    </div>
                    <div class="uid-text">MEMBER: ${o}</div>
                  </div>

                  <div class="info-section">
                    <div class="info-group"><label>FULL NAME</label><div class="value">${m}</div></div>
                    <div class="info-group"><label>SKU IDENTIFIER</label><div class="value">${w}</div></div>
                    <div class="info-group"><label>ISSUE DATE</label><div class="value">${u}</div></div>
                    <div class="info-group"><label>CONTACT</label><div class="value">${WOLF_PURIFIER(s.phone||"N/A")}</div></div>
                    <div class="info-group"><label>STATUS</label><div class="value">${WOLF_PURIFIER(s.membership_status||"ACTIVE")}</div></div>
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
                <div class="back-header">${m}</div>

                <div class="action-grid">
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.viewProfile('${s.id}')">
                    <i class="bx bx-user-circle"></i>
                    <span class="btn-label">View Profile</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.attendance('${s.id}')">
                    <i class="bx bx-calendar-check"></i>
                    <span class="btn-label">Attendance</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.changePlan('${s.id}')">
                    <i class="bx bx-refresh"></i>
                    <span class="btn-label">Change Plan</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.deactivate('${s.id}')">
                    <i class="bx bx-user-x"></i>
                    <span class="btn-label">Deactivate</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.checkIn('${s.id}')">
                    <i class="bx bx-log-in-circle"></i>
                    <span class="btn-label">Check-In</span>
                  </button>
                  <button class="action-item" onclick="event.stopPropagation(); MemberManager.renew('${s.id}')">
                    <i class="bx bx-reset"></i>
                    <span class="btn-label">Renew</span>
                  </button>
                </div>
                
                <div class="back-footer"> < < < CLICK ME TO FLIP BACK > > > </div>
              </div>

            </div>
          </div>
        </div>`}).join(""),i>this.pageSize&&(t.innerHTML+=`
        <div class="col-12" style="display:flex; justify-content:center; align-items:center; gap:10px; margin-top:8px;">
          <button onclick="MemberManager.setPage(${this.currentPage-1})" ${this.currentPage<=1?"disabled":""} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class='bx bx-chevron-left'></i></button>
          <span style="font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#97a4ba;">Page ${this.currentPage} of ${n}</span>
          <button onclick="MemberManager.setPage(${this.currentPage+1})" ${this.currentPage>=n?"disabled":""} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class='bx bx-chevron-right'></i></button>
        </div>
      `)},setPage(e){const t=Number(e);!Number.isFinite(t)||t<1||(this.currentPage=t,this.render(this.currentFilterList.length?this.currentFilterList:this.allMembers))},renderTrash(){const e=document.getElementById("trash-list");if(e){if(e.innerHTML="",e.style.display="block",e.style.opacity="1",e.style.visibility="visible",this.trashData.length===0){e.innerHTML='<div class="text-center py-5 opacity-50">RECOVERY_BIN_EMPTY</div>';return}requestAnimationFrame(()=>{requestAnimationFrame(()=>{const t=this.canHardDelete();e.innerHTML=this.trashData.map((i,n)=>{const a=i.deleted_data||{},r=this.getMemberCode({member_code:a.member_code,member_id:a.member_id||i.original_id});return`
            <div class="trash-pill-card animate__animated animate__fadeInRight" 
                 style="animation-delay: ${n*.05}s; 
                        opacity: 1 !important; 
                        visibility: visible !important; 
                        display: flex !important;">
              <div class="trash-avatar-node"><i class="bx bx-user-x"></i></div>
              <div class="trash-details">
                <h6 style="color:white !important; opacity:1 !important;">${WOLF_PURIFIER(a.full_name||"UNKNOWN")}</h6>
                <p>UID: ${r}</p>
              </div>
              <div class="trash-action-group">
                <button class="btn-trash-action restore" onclick="MemberManager.restore('${i.id}')"><i class="bx bx-undo"></i></button>
                ${t?`<button class="btn-trash-action purge" onclick="MemberManager.wipePermanent('${i.id}')"><i class="bx bx-shield-x"></i></button>`:""}
              </div>
            </div>`}).join("")})})}},setupUIListeners(){const e=document.getElementById("member-main-view")||document,t=e.querySelector("#toggle-search-btn"),i=e.querySelector("#ledger-search-container"),n=e.querySelector("#member-main-search"),a=e.querySelector("#search-clear-btn"),r=e.querySelector("#btn-view-trash");r&&(r.onclick=()=>this.switchToTrash()),t&&i&&n&&(t.onclick=s=>{s.preventDefault(),s.stopPropagation(),t.classList.toggle("active"),i.classList.toggle("active"),i.classList.contains("active")&&n.focus()}),n&&(n.oninput=s=>{const l=s.target.value.toLowerCase();a&&(a.style.display=l.length>0?"block":"none");const c=this.allMembers.filter(o=>o.full_name&&o.full_name.toLowerCase().includes(l)||o.member_code&&o.member_code.toLowerCase().includes(l)||o.sku&&String(o.sku).toLowerCase().includes(l)||o.phone&&String(o.phone).toLowerCase().includes(l)||o.email&&String(o.email).toLowerCase().includes(l)||o.id&&String(o.id).toLowerCase().includes(l));this.currentPage=1,this.render(c)}),a&&n&&(a.onclick=()=>{n.value="",a.style.display="none",this.currentPage=1,this.render(this.allMembers)})},async switchToTrash(){const e=document.getElementById("member-main-view"),t=document.getElementById("main-content");if(!e)return;window.wolfAudio&&window.wolfAudio.play("woosh"),e.classList.remove("stage-center"),e.classList.add("stage-left");const n=await(await fetch("/pages/management/member-trash-container.html")).text();setTimeout(()=>{t.innerHTML=n;const a=document.getElementById("member-trash-view");a.classList.add("stage-right"),a.offsetWidth,a.classList.remove("stage-right"),a.classList.add("stage-center"),this.initTrashView()},500)},async initTrashView(){const e=document.getElementById("btn-trash-back");e&&(e.onclick=async()=>{const t=document.getElementById("member-trash-view"),i=document.getElementById("main-content");window.wolfAudio&&window.wolfAudio.play("woosh"),t.classList.remove("stage-center"),t.classList.add("stage-right"),setTimeout(async()=>{const a=await(await fetch("/pages/management/members.html")).text();i.innerHTML=a;const r=document.getElementById("member-main-view");r.classList.add("stage-left"),r.offsetWidth,r.classList.remove("stage-left"),r.classList.add("stage-center"),this.init()},500)},await this.fetchTrashData())},async restore(e){const t=this.trashData.find(a=>a.id===e);if(!(t!=null&&t.deleted_data))return;const i=t.table_name==="profiles"?"profiles":"members",{error:n}=await window.supabaseClient.from(i).insert([t.deleted_data]);n||(await window.supabaseClient.from("trash_bin").delete().eq("id",e),window.wolfAudio&&window.wolfAudio.play("success"),this.fetchTrashData())},async wipePermanent(e){if(!this.canHardDelete()){window.wolfAudio&&window.wolfAudio.play("denied"),await Swal.fire("ACCESS DENIED","Only admin can hard delete records.","warning");return}const{isConfirmed:t}=await Swal.fire({title:"TERMINATE RECORD?",text:"This action cannot be undone. Data will be purged.",icon:"error",showCancelButton:!0,confirmButtonColor:"#d33",background:"#0a0a0a",color:"#fff"});t&&(await window.supabaseClient.from("trash_bin").delete().eq("id",e),this.fetchTrashData())},toggleFlip(e){const t=document.getElementById(`card-${e}`);t&&(t.classList.toggle("is-flipped"),window.wolfAudio&&window.wolfAudio.play("swipe"))},async delete(e){var n;const t=this.getAccentColor();if((await Swal.fire({title:"MOVE TO TRASH?",text:"Member will be archived and can be restored later.",icon:"warning",showCancelButton:!0,confirmButtonText:"ARCHIVE",confirmButtonColor:t,background:"#0d0d0d",color:"#fff"})).isConfirmed)try{const{data:a,error:r}=await window.supabaseClient.from("members").select("*").eq("member_id",e).single();if(r)throw r;const{error:s}=await window.supabaseClient.from("trash_bin").insert([{original_id:e,table_name:"members",deleted_data:a,deleted_by:(n=(await window.supabaseClient.auth.getUser()).data.user)==null?void 0:n.id}]);if(s)throw s;const{error:l}=await window.supabaseClient.from("members").delete().eq("member_id",e);if(l)throw l;window.wolfAudio&&window.wolfAudio.play("success"),Swal.fire({title:"ARCHIVED",text:"Member moved to Trash Bin.",icon:"success",timer:1500,showConfirmButton:!1,background:"#0d0d0d",color:"#fff"}),await this.fetchMembers()}catch(a){console.error("Archive Protocol Failed:",a),Swal.fire("ERROR","Could not archive: "+a.message,"error"),window.wolfAudio&&window.wolfAudio.play("error")}},async checkIn(e){try{const t=await this.fetchMemberById(e);if(!t)return;const i=String(t.full_name||"").trim();if(!i)return;window.logbookManager&&typeof window.logbookManager.processCheckIn=="function"?await window.logbookManager.processCheckIn(i,{entryType:"member",isPaid:!1}):typeof navigateTo=="function"&&(window.WOLF_PENDING_MEMBER_ID=e,navigateTo("logbook")),window.salesManager&&window.salesManager.showSystemAlert(`ACCESS GRANTED: ${i}`,"success")}catch(t){console.error("Member Check-In Failed:",t),window.salesManager&&window.salesManager.showSystemAlert("DATABASE_REJECTED_ENTRY","error")}},edit(e){if(window.wolfAudio&&window.wolfAudio.play("notif"),window.WOLF_PENDING_MEMBER_ID=e,typeof navigateTo=="function"){navigateTo("id-maker");return}if(window.wolfRouter&&typeof window.wolfRouter.goToMain=="function"){window.wolfRouter.goToMain("id-maker");return}window.location.href="/pages/main.html?p=id-maker"},async renew(e){if(!window.Swal)return;const t=new Date,i=new Date(t);i.setDate(i.getDate()+30);const n=await window.Swal.fire({title:"RENEW MEMBERSHIP",background:"#0d0d0d",color:"#fff",showCancelButton:!0,confirmButtonText:"RENEW",html:`
        <input id="renew-plan" class="swal2-input" placeholder="Membership Plan" value="MONTHLY MEMBERSHIP" />
        <input id="renew-expiry" class="swal2-input" type="date" value="${i.toISOString().slice(0,10)}" />
      `,preConfirm:()=>{var c,o,d;const s=(o=(c=document.getElementById("renew-plan"))==null?void 0:c.value)==null?void 0:o.trim(),l=((d=document.getElementById("renew-expiry"))==null?void 0:d.value)||null;return s?{plan:s,expiry:l}:(window.Swal.showValidationMessage("Plan is required."),null)}});if(!n.isConfirmed||!n.value)return;const{error:a,missingColumns:r}=await this.updateLifecycleFields(e,{membership_plan:n.value.plan,membership_status:"ACTIVE",membership_expires_at:n.value.expiry,is_active:!0});if(a){r?window.Swal.fire("MISSING COLUMNS","Run docs/sql/members_membership_fields.sql in Supabase then retry.","warning"):window.Swal.fire("ERROR",a.message||"Renewal failed.","error");return}window.salesManager&&window.salesManager.showSystemAlert("MEMBERSHIP RENEWED","success"),await this.fetchMembers()},renderSkeleton(){const e=document.getElementById("members-list");e&&(e.innerHTML=`
        <div class="col-12 text-center py-5 opacity-25">
          <div class="spinner-border text-light"></div>
        </div>`)}};
