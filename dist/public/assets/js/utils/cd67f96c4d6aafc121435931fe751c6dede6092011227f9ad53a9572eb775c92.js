let isProductModalOpen=!1;function showValidationError(e){Toastify({text:e.toUpperCase(),duration:2800,gravity:"top",position:"right",style:{border:"1px solid #ff3b3b",background:"#0a0a0a",borderRadius:"12px",fontWeight:"900",fontFamily:"JetBrains Mono, monospace",color:"#fff",boxShadow:"0 0 16px rgba(255, 59, 59, 0.4)"}}).showToast()}function generateBarcodeId(){const e=document.getElementById("master-asset-id");if(!e)return;const t=Math.floor(1e3+Math.random()*9e3);e.value=String(t)}function stripSkuPrefix(e){return String(e||"").trim().replace(/^PR[-\s]*/i,"")}function ensureSkuPrefix(e){const t=stripSkuPrefix(e).toUpperCase();return t?`PR-${t}`:""}function setProductModalMode(e="product"){const t=e==="sale"?"sale":"product",a=document.getElementById("master-product-form"),o=a==null?void 0:a.querySelector(".btn-terminal-commit"),i=document.querySelector(".terminal-title span"),d=document.querySelector(".terminal-protocol");a&&(a.dataset.submitMode=t),o&&(o.textContent=t==="sale"?"ADD TO SALES":"ADD PRODUCT"),i&&(i.textContent=t==="sale"?"SALES":"PRODUCT"),d&&(d.textContent=t==="sale"?"QUICK SALES ENTRY - RECORDS TRANSACTION ONLY":"MANUAL PRODUCT ENTRY - ADDS TO INVENTORY ONLY")}function setProductModalEditState(e=!1){const t=document.getElementById("master-product-form"),a=t==null?void 0:t.querySelector(".btn-terminal-commit"),o=document.querySelector(".terminal-protocol"),i=document.querySelector(".terminal-title span");if(t&&(t.dataset.editMode=e?"true":"false"),e)a&&(a.textContent="SAVE CHANGES"),i&&(i.textContent="PRODUCT"),o&&(o.textContent="EDIT PRODUCT ENTRY - UPDATES INVENTORY RECORD");else{const d=(t==null?void 0:t.dataset.submitMode)==="sale"?"sale":"product";setProductModalMode(d)}}function openProductModal(){const e=document.getElementById("product-modal-overlay"),t=e==null?void 0:e.querySelector(".master-terminal-container");if(!e||!t)return;let a=document.getElementById("add-product-modal-css");a||(a=document.createElement("link"),a.id="add-product-modal-css",a.rel="stylesheet",a.href="/assets/components/add-product-modal.css",a.dataset.dynamic="true",document.head.appendChild(a)),e.style.display="flex",e.style.opacity="1",e.classList.remove("is-closing"),e.classList.add("is-open"),t.classList.remove("modal-closing"),t.classList.add("modal-open"),window.isProductModalOpen=!0,setProductModalMode("product"),setProductModalEditState(!1);const o=document.getElementById("master-product-form");o&&(o.dataset.selectedImageUrl="",o.dataset.modalAction="create"),generateBarcodeId()}function closeProductModal(){const e=document.getElementById("product-modal-overlay"),t=e==null?void 0:e.querySelector(".master-terminal-container");if(!e||!t||!window.isProductModalOpen)return;window.isProductModalOpen=!1,["master-asset-id","master-name","master-price","master-qty","master-brand","master-desc"].forEach(E=>{const L=document.getElementById(E);L&&(L.value="")});const o=document.getElementById("master-unlimited"),i=document.getElementById("master-qty");o&&(o.checked=!1),i&&(i.disabled=!1,i.required=!0,i.placeholder="0");const d=document.getElementById("imageContainer"),r=document.getElementById("uploadImageContainer"),n=document.getElementById("upload-image-name"),c=document.getElementById("upload-image-input"),l=document.getElementById("image-tab-web"),p=document.getElementById("image-tab-upload"),y=document.getElementById("image-web-panel"),x=document.getElementById("image-upload-panel"),m=document.getElementById("status");d&&(d.innerHTML=""),r&&(r.innerHTML=""),n&&(n.textContent="No file selected"),c&&(c.value=""),l&&l.classList.add("is-active"),p&&p.classList.remove("is-active"),y&&y.classList.add("is-active"),x&&x.classList.remove("is-active"),m&&(m.textContent="");const b=document.getElementById("master-product-form");b&&(b.dataset.productId="",b.dataset.submitMode="product",b.dataset.editMode="false",b.dataset.selectedImageUrl="",b.dataset.modalAction="create"),setProductModalMode("product"),setProductModalEditState(!1),t.classList.remove("modal-open"),t.classList.add("modal-closing"),e.classList.add("is-closing"),setTimeout(()=>{t.classList.remove("modal-closing"),e.classList.remove("is-closing","is-open"),e.style.display="none",e.style.opacity="0";const E=document.querySelector('#add-product-modal-css[data-dynamic="true"]');E&&E.remove()},220)}function validateProductForm(){const e=document.getElementById("master-name"),t=document.getElementById("master-price"),a=document.getElementById("master-qty"),o=document.getElementById("master-asset-id"),i=document.getElementById("master-unlimited"),d=[e,t,o];i!=null&&i.checked||d.push(a);let r=null;return d.forEach(n=>{n&&(n.classList.remove("field-error"),(!n.value||n.value.trim()==="")&&(n.classList.add("field-error"),r||(r=n)))}),r?(showValidationError("Please fill all required product details."),r.focus(),setTimeout(()=>r.classList.remove("field-error"),350),!1):!0}document.addEventListener("click",e=>{const t=document.getElementById("product-modal-overlay");if(e.target.closest("#roll-barcode-btn")){e.preventDefault(),generateBarcodeId();return}if(e.target.closest("#btn-add-product")){e.preventDefault(),e.stopPropagation(),openProductModal();return}if(e.target.closest("#closeProductModal")){e.preventDefault(),e.stopPropagation(),closeProductModal();return}if(t&&e.target===t){closeProductModal();return}const i=e.target.closest(".optional-toggle-bar");if(i){const d=i.closest(".optional-protocol-box");if(!d)return;const r=d.classList.contains("is-expanded");d.classList.toggle("is-expanded",!r),d.classList.toggle("is-collapsed",r);return}});const ProductManager={allProducts:[],trashData:[],currentPage:1,pageSize:9,currentFilterList:[],getAccessContext(){const e=window.WOLF_ACCESS_CONTEXT||{},t=String(e.role||window.WOLF_USER_ROLE||"").trim().toLowerCase(),a=String(e.email||window.WOLF_USER_EMAIL||"").trim().toLowerCase();return{role:t,email:a}},canHardDelete(){const{role:e,email:t}=this.getAccessContext();return e==="admin"||t==="adrianangeles2212@gmail.com"||t==="ktorrazo123@gmail.com"},async init(){var e;console.log("Wolf OS: Product Manager Initializing..."),(e=this.injectStyles)==null||e.call(this),await this.loadAddProductModal(),this.setupAddProductModalLogic(),this.setupUIListeners(),await this.fetchProducts()},async loadAddProductModal(){const e=document.getElementById("wolf-layout")||document.body;let t=document.getElementById("add-product-modal-host");t||(t=document.createElement("div"),t.id="add-product-modal-host",e.appendChild(t));try{const a=await fetch("/assets/components/add-product-modal.html");if(!a.ok)throw new Error("Failed to load add-product-modal.html");t.innerHTML=WOLF_PURIFIER(await a.text())}catch(a){console.error("Add Product Modal Load Error:",a)}},setupAddProductModalLogic(){const e=document.getElementById("product-modal-overlay"),t=document.getElementById("master-product-form");if(!e||!t||t.dataset.modalLogicBound==="true")return;t.dataset.modalLogicBound="true";const a=document.getElementById("imageContainer"),o=document.getElementById("uploadImageContainer"),i=document.getElementById("status"),d=document.getElementById("closeProductModal"),r=document.getElementById("master-qty"),n=document.getElementById("master-unlimited"),c=document.getElementById("master-price"),l=document.getElementById("master-name"),p=document.getElementById("master-asset-id"),y=document.getElementById("lookup-input"),x=document.getElementById("lookupBtn"),m=document.getElementById("image-tab-web"),b=document.getElementById("image-tab-upload"),E=document.getElementById("image-web-panel"),L=document.getElementById("image-upload-panel"),v=document.getElementById("upload-image-input"),k=document.getElementById("upload-image-trigger"),O=document.getElementById("upload-image-action"),R=document.getElementById("upload-image-name"),T=t.querySelector(".btn-terminal-commit"),w="54360015-81e98130630ae3ed1faf5a9b9",X=5e5;let S=null;t.dataset.submitMode||(t.dataset.submitMode="product"),t.dataset.editMode||(t.dataset.editMode="false"),t.dataset.modalAction||(t.dataset.modalAction="create"),setProductModalMode(t.dataset.submitMode),setProductModalEditState(t.dataset.editMode==="true"),T&&(T.disabled=!1),v&&(v.setAttribute("accept","image/*"),v.setAttribute("hidden",""));function h(s){i&&(i.textContent=s||"")}function B(s){s&&(s.innerHTML="")}function tt(){[a,o].forEach(s=>{s&&s.querySelectorAll("img").forEach(u=>{u.classList.remove("selected"),u.dataset.selected="false"})})}function H(s){s&&(tt(),s.classList.add("selected"),s.dataset.selected="true",S=s.src,t.dataset.selectedImageUrl=S||"")}function M(s){const u=s==="web";m&&m.classList.toggle("is-active",u),b&&b.classList.toggle("is-active",!u),E&&E.classList.toggle("is-active",u),L&&L.classList.toggle("is-active",!u)}function Y(s,u,f,I={}){if(!s||!u)return null;const g=document.createElement("img");return g.src=u,g.alt=f||"Product image",g.loading="lazy",g.decoding="async",s.appendChild(g),g.addEventListener("click",()=>{H(g),h("Image selected.")}),I.autoSelect&&H(g),g}function N(){k&&k.classList.remove("is-selected"),O&&(O.textContent="Attach Image File"),R&&(R.textContent="No file selected"),v&&(v.value="")}function et(s){k&&k.classList.add("is-selected"),O&&(O.textContent="Change Image File"),R&&(R.textContent=s||"Selected file")}function W(){S=null,t.dataset.selectedImageUrl="",B(a),B(o),N(),M("web"),h("")}function at(s){return/^https?:\/\/\S+/i.test(s||"")}async function rt(s){const u=await new Promise((F,$)=>{const P=new FileReader;P.onload=()=>F(P.result),P.onerror=()=>$(new Error("Unable to read selected file.")),P.readAsDataURL(s)}),f=await new Promise((F,$)=>{const P=new Image;P.onload=()=>F(P),P.onerror=()=>$(new Error("Invalid image file.")),P.src=u}),g=Math.min(1,900/Math.max(f.width,f.height)),q=Math.max(1,Math.round(f.width*g)),j=Math.max(1,Math.round(f.height*g)),C=document.createElement("canvas");C.width=q,C.height=j;const D=C.getContext("2d");if(!D)throw new Error("Image processing is not supported on this device.");D.drawImage(f,0,0,q,j);let _=.86,A=C.toDataURL("image/jpeg",_);for(;A.length>X&&_>.55;)_-=.08,A=C.toDataURL("image/jpeg",_);if(A.length>X)throw new Error("Image is too large. Please use a smaller file.");return A}async function ot(s){var u;B(a),B(o),N(),S=null,M("web"),h("Searching images on Pixabay...");try{const f=await fetch(`https://pixabay.com/api/?key=${w}&q=${encodeURIComponent(s)}&image_type=photo&per_page=4`);if(!f.ok){h(f.status===429?"Pixabay API limit reached.":"Unable to fetch images.");return}const I=await f.json();if(!((u=I==null?void 0:I.hits)!=null&&u.length)){h("No images found for this query.");return}I.hits.forEach(g=>{Y(a,g.webformatURL,s)}),h("Click one image to select it.")}catch(f){console.error("Pixabay lookup error:",f),h("Image search failed.")}}async function it(s){B(a),B(o),N(),S=null,M("web"),h("Fetching product info from barcode...");try{const f=await(await fetch(`https://world.openfoodfacts.org/api/v0/product/${s}.json`)).json(),I=document.getElementById("master-brand");if(f.status!==1){h("Product not found with this barcode.");return}const g=f.product||{};l&&(l.value=g.product_name||""),I&&(I.value=g.brands||""),g.image_url?(Y(a,g.image_url,g.product_name,{autoSelect:!0}),h("Barcode image attached and selected.")):h("Product found. No image available.")}catch(u){console.error("Barcode lookup error:",u),h("Barcode lookup failed.")}}function nt(s){B(a),B(o),N(),S=null,M("web");const u=Y(a,s,"Linked image",{autoSelect:!0});if(!u){h("Unable to attach image link.");return}u.addEventListener("error",()=>{S===s&&(S=null),h("Image link could not be loaded.")}),h("Image link detected. Attached and selected.")}function G(){if(!y)return;const s=y.value.trim();if(s){if(at(s)){l&&(l.value=""),nt(s);return}if(/^\d/.test(s.charAt(0))){p&&(p.value=stripSkuPrefix(s).slice(0,32)),it(s);return}l&&(l.value=s),ot(s)}}function V(){!r||!n||(n.checked?(r.value="",r.disabled=!0,r.required=!1,r.placeholder="UNLIMITED"):(r.disabled=!1,r.required=!0,r.placeholder="0"))}r&&n&&(n.addEventListener("change",V),V()),[a,o].forEach(s=>{s&&s.addEventListener("click",u=>{const f=u.target.closest("img");f&&(H(f),h("Image selected."))})}),x&&y&&(x.addEventListener("click",G),y.addEventListener("keydown",s=>{s.key==="Enter"&&(s.preventDefault(),G())})),m&&m.addEventListener("click",()=>{M("web")}),b&&b.addEventListener("click",()=>{M("upload")}),k&&v&&(k.addEventListener("click",()=>v.click()),k.addEventListener("keydown",s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),v.click())})),v&&v.addEventListener("change",async()=>{var u;const s=(u=v.files)==null?void 0:u[0];if(s){if(!String(s.type||"").startsWith("image/")){showValidationError("Please select a valid image file."),N();return}M("upload"),h("Processing image file...");try{const f=await rt(s);B(o),B(a),Y(o,f,s.name,{autoSelect:!0}),et(s.name),h("Attached image file selected.")}catch(f){console.error("Upload image processing error:",f),S=null,B(o),N(),h(f.message||"Unable to process image file."),showValidationError(f.message||"Unable to process image file.")}}}),d&&d.addEventListener("click",s=>{s.preventDefault(),s.stopPropagation(),W(),closeProductModal()}),e.addEventListener("click",s=>{s.target===e&&(W(),closeProductModal())}),t.addEventListener("submit",async s=>{var P,J,Q,Z;if(s.preventDefault(),T!=null&&T.disabled||!validateProductForm())return;const u=stripSkuPrefix((p==null?void 0:p.value)||""),f=ensureSkuPrefix(u),I=t.dataset.submitMode==="sale"?"sale":"product",g=I==="sale",q=t.dataset.productId||null,j=t.dataset.selectedImageUrl||"",C=I==="product"&&t.dataset.editMode==="true"&&!!q,D=((l==null?void 0:l.value)||"").trim(),_=Number.parseFloat((c==null?void 0:c.value)||"0"),A=n!=null&&n.checked?999999:Number.parseInt((r==null?void 0:r.value)||"",10),F=((J=(P=document.getElementById("master-desc"))==null?void 0:P.value)==null?void 0:J.trim())||null,$=((Z=(Q=document.getElementById("master-brand"))==null?void 0:Q.value)==null?void 0:Z.trim())||null;if(p&&(p.value=u),!f){showValidationError("Please generate a SKU code before adding."),p==null||p.focus();return}if(!(n!=null&&n.checked)&&(!Number.isInteger(A)||A<0)){showValidationError("Please enter a valid stock quantity."),r==null||r.focus();return}try{T&&(T.disabled=!0,T.textContent=g?"ADDING TO SALES...":C?"SAVING CHANGES...":"ADDING PRODUCT...");const z=await fetch("/.netlify/functions/add-product",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:q||null,sku:f,name:D,description:F,brand:$,price:_,qty:A,imageUrl:S||j||null,createSale:g})});let U={};try{U=await z.json()}catch(K){}if(!z.ok)throw new Error((U==null?void 0:U.error)||(g?"Failed to add sale from selected product.":"Failed to add product."));if(g){const K=U==null?void 0:U.sale;if(!K)throw new Error("Missing sale response from server.");window.wolfData&&typeof window.wolfData.addSaleRow=="function"&&window.wolfData.addSaleRow(K)}typeof ProductManager.fetchProducts=="function"&&await ProductManager.fetchProducts();const st=n!=null&&n.checked?"UNLIMITED":A;Toastify({text:g?`ADDED TO SALES: ${D.toUpperCase()} x${st}`:C?`PRODUCT UPDATED: ${D.toUpperCase()}`:`PRODUCT ADDED: ${D.toUpperCase()}`,duration:2500,gravity:"top",position:"right",style:{border:"1px solid #77ff00",background:"#0a0a0a",borderRadius:"12px",fontWeight:"900",fontFamily:"JetBrains Mono, monospace",color:"#fff"}}).showToast(),W(),closeProductModal()}catch(z){console.error("Product modal submit error:",z),Toastify({text:`${z.message||"Submission failed."}`,duration:4e3,gravity:"top",position:"right",style:{border:"1px solid #ff3b3b",background:"#0a0a0a",borderRadius:"12px",fontWeight:"900",fontFamily:"JetBrains Mono, monospace",color:"#fff"}}).showToast(),h(g?"Error adding to sales.":C?"Error saving product changes.":"Error adding product.")}finally{setProductModalMode(t.dataset.submitMode||"product"),setProductModalEditState(t.dataset.editMode==="true"),T&&(T.disabled=!1)}})},setupUIListeners(){const e=document.getElementById("products-list");e&&e.addEventListener("click",t=>{var n,c,l,p;const a=t.target.closest(".product-card");if(!a)return;const o=a.getAttribute("data-product-id");if(t.target.closest(".btn-edit-product")){t.stopPropagation(),(n=this.edit)==null||n.call(this,o);return}if(t.target.closest(".btn-delete-product")){t.stopPropagation(),(c=this.delete)==null||c.call(this,o);return}if(t.target.closest(".btn-add-sale")){t.stopPropagation(),(l=this.openAddToSalesModal)==null||l.call(this,o);return}(p=this.toggleFlip)==null||p.call(this,o)})},injectStyles(){const e="wolf-product-styles";let t=document.getElementById(e);t||(t=document.createElement("style"),t.id=e,document.head.appendChild(t)),t.innerHTML=`
  /* ===== LAYOUT ===== */
  #product-main-view {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ===== SEARCH BAR ===== */
  .search-engine-wrapper {
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .search-engine-wrapper.active .search-inner {
    background: rgba(20, 20, 20, 0.7) !important;
    backdrop-filter: blur(14px);
    border: 1px solid rgba(var(--wolf-red-rgb), 0.35) !important;
    border-radius: 16px;
    padding: 10px 18px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.6);
    transform: translateY(-2px);
  }
  .search-inner {
    transition: background 0.25s ease, border-color 0.25s ease,
                box-shadow 0.25s ease, transform 0.25s ease;
  }
  .search-inner input {
    color: #fff !important;
    font-weight: 600;
  }
  .search-inner i {
    color: rgba(var(--wolf-red-rgb), 0.9) !important;
    transition: transform 0.25s ease, color 0.25s ease;
  }
  .search-inner:focus-within i {
    transform: scale(1.15);
    color: #ff6b5f !important;
  }

  /* ===== PRODUCT CARD SCENE / CARD ===== */
  .product-card-scene {
    width: 100%;
    height: 380px;
    perspective: 1500px;
  }

  .product-card {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    border-radius: 24px;
    overflow: hidden;
    background: radial-gradient(circle at top left, #262626, #050505);
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow:
      0 20px 40px rgba(0,0,0,0.7),
      0 0 0 1px rgba(255,255,255,0.02);
    transition:
      transform 0.25s ease,
      box-shadow 0.25s ease,
      border-color 0.25s ease,
      background 0.25s ease;
    cursor: pointer;
  }

  .product-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow:
      0 28px 60px rgba(0,0,0,0.85),
      0 0 0 1px rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.14);
  }

  .product-card-rotor {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .product-card.is-flipped .product-card-rotor {
    transform: rotateY(180deg);
  }

  .product-card .card-face {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    padding: 18px 18px 16px;
    display: flex;
    flex-direction: column;
  }

  .product-card .card-face.card-front {
    transform: rotateY(0deg);
  }

  .product-card .card-face.card-back {
    transform: rotateY(180deg);
    -webkit-transform: rotateY(180deg);
    background: radial-gradient(circle at bottom right, #161616, #000);
    justify-content: space-between;
    overflow: hidden;
  }

  .product-card .card-face.card-back > * {
    transform: translateZ(2px);
  }

  .product-card .back-header {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    color: #d4d4d4;
    opacity: 0.95;
  }

  .product-card .back-footer {
    margin-top: 10px;
    text-align: center;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    color: var(--wolf-red);
    text-transform: uppercase;
    opacity: 0.95;
  }

  .product-card .product-back-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 24px;
  }

  .product-card .back-action-btn {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(
      145deg,
      rgba(24, 24, 24, 0.95),
      rgba(7, 7, 7, 0.95)
    );
    color: #f4f4f4;
    border-radius: 12px;
    padding: 10px 12px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition:
      transform 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      color 0.2s ease;
    cursor: pointer;
  }

  .product-card .back-action-btn:hover {
    transform: translateY(-2px);
    border-color: rgba(var(--wolf-red-rgb), 0.9);
    color: #fff;
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.55);
  }

  .product-card .back-action-btn.danger:hover {
    border-color: rgba(255, 99, 99, 0.9);
    color: #ff8686;
  }

  /* ===== CARD ACTION BUTTONS ===== */
  .product-card .card-actions-top {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 6px;
    z-index: 20;
  }

  .product-card .card-actions-top button {
    background: radial-gradient(circle at top left, #222, #000);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #eee;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 6px 14px rgba(0,0,0,0.7);
    transition:
      transform 0.22s ease,
      box-shadow 0.22s ease,
      border-color 0.22s ease,
      background 0.22s ease,
      color 0.22s ease;
  }

  .product-card .card-actions-top button:hover {
    background: radial-gradient(circle at top left, var(--wolf-red), #420f0a);
    border-color: #ff7b6a;
    color: #fff;
    transform: translateY(-2px) scale(1.08);
    box-shadow: 0 10px 20px rgba(0,0,0,0.85);
  }

  .product-card .card-actions-top button:active {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 3px 8px rgba(0,0,0,0.7);
  }

  /* ===== STOCK BADGE ===== */
  .product-card .stock-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    z-index: 10;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.18);
    text-shadow: 0 0 6px rgba(0,0,0,0.7);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .product-card .stock-badge::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 12px currentColor;
    animation: stockPulse 1.5s infinite;
  }

  .product-card .status-critical {
    color: #ff6b6b;
    background: linear-gradient(
      135deg,
      rgba(var(--wolf-red-rgb), 0.7),
      rgba(30, 0, 0, 0.8)
    );
  }

  .product-card .status-good {
    color: #4ade80;
    background: linear-gradient(
      135deg,
      rgba(40, 167, 69, 0.7),
      rgba(0, 40, 10, 0.8)
    );
  }

  @keyframes stockPulse {
    0%, 100% { transform: scale(0.9); opacity: 0.5; }
    50% { transform: scale(1.1); opacity: 1; }
  }

  /* ===== PRODUCT VISUAL ===== */
  .product-visual {
    width: 100%;
    height: 170px;
    background: radial-gradient(circle at center, #1b1b1b, #050505);
    border-radius: 18px;
    margin-bottom: 18px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.05);
    box-shadow:
      0 12px 26px rgba(0,0,0,0.9),
      0 0 0 1px rgba(255,255,255,0.04);
    position: relative;
  }

  .product-visual::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at top left,
      rgba(255,255,255,0.08),
      transparent 55%
    );
    mix-blend-mode: screen;
    opacity: 0;
    transition: opacity 0.25s ease;
    pointer-events: none;
  }

  .product-card:hover .product-visual::after {
    opacity: 1;
  }

  .product-visual img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.78;
    transform: scale(1.02);
    transition:
      transform 0.35s ease,
      opacity 0.35s ease,
      filter 0.35s ease;
  }

  .product-card:hover .product-visual img {
    transform: scale(1.07);
    opacity: 0.96;
    filter: saturate(1.1);
  }

  /* ===== INFO SECTION ===== */
  .product-card .info-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .product-card .info-group label {
    color: var(--wolf-red);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .product-card .info-group .value {
    color: #fff;
    font-size: 15px;
    font-weight: 800;
    font-style: italic;
  }

  .product-card .price-tag {
    font-size: 1.9rem;
    font-weight: 900;
    color: #fff;
    font-style: italic;
    letter-spacing: -1px;
    text-shadow: 0 0 14px rgba(255,255,255,0.25);
    transform-origin: right center;
    transition: transform 0.2s ease, text-shadow 0.2s ease;
  }

  .product-card:hover .price-tag {
    transform: scale(1.04);
    text-shadow: 0 0 20px rgba(255,255,255,0.4);
  }

  /* ===== CARD FOOTER ===== */
  .product-card .card-footer {
    margin-top: auto;
  }

  .product-card .card-footer-inner {
    border-top: 1px solid rgba(255,255,255,0.06);
    padding-top: 10px;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    font-weight: 900;
    color: #555;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .product-card .card-footer-inner span:last-child {
    opacity: 0.7;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .product-card:hover .card-footer-inner span:last-child {
    opacity: 1;
    transform: translateX(2px);
  }

  /* ===== SKELETON LOADER ===== */
  .skel-card {
    height: 380px;
    background: radial-gradient(circle at top, #1a1a1a, #050505);
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.06);
    position: relative;
    overflow: hidden;
  }

  .skel-shimmer {
    position: relative;
    overflow: hidden;
  }

  .skel-shimmer::before {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,0.12),
      transparent
    );
    animation: shimmerMove 1.4s infinite;
  }

  @keyframes shimmerMove {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  /* ===== MODAL OVERLAY ===== */
  .master-modal-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at top, rgba(10,10,10,0.98), rgba(0,0,0,0.96));
    backdrop-filter: blur(18px);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 100000;
    padding: 20px;
    animation: modalFadeIn 0.3s ease-out forwards;
     transform: translateY(24px);
  transition:
    opacity 0.3s ease,
    visibility 0.3s ease,
    transform 0.22s ease;
  }

  .master-modal-overlay.is-open {
  display: flex;
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}



/* when closing */
.master-modal-overlay.is-closing {
  opacity: 0;
  visibility: hidden;
  transform: translateY(24px);
}

  @keyframes modalFadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to   { opacity: 1; transform: scale(1); }
  }

  .master-terminal-container {
    background: radial-gradient(circle at top left, #181818, #050505);
    width: 100%;
    max-width: 520px;
    border-radius: 32px;
    padding: 30px 26px;
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow:
      0 28px 65px rgba(0,0,0,0.9),
      0 0 0 1px rgba(255,255,255,0.04);
       transform: translateY(26px) scale(0.94) rotateX(6deg);
  transition:
    opacity 0.26s cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1);
    animation: terminalSlideIn 0.35s cubic-bezier(0.19, 1, 0.22, 1);
  }

  /* open/close animation states (controlled via JS) */
.master-terminal-container.modal-open {
  opacity: 1;
  transform: translateY(0) scale(1) rotateX(0deg);
}

.master-terminal-container.modal-closing {
  opacity: 0;
  transform: translateY(22px) scale(0.9) rotateX(10deg);
}


  @keyframes terminalSlideIn {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ===== TERMINAL HEADER ===== */
  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 22px;
  }

  .terminal-title {
    font-weight: 900;
    font-size: 1.45rem;
    font-style: italic;
    color: #fff;
    letter-spacing: 0.5px;
  }

  .terminal-title span {
    color: var(--wolf-red);
  }

  .terminal-protocol {
    font-size: 9px;
    color: #555;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }

  .terminal-protocol::before {
    content: '';
    width: 7px;
    height: 7px;
    background: var(--wolf-red);
    border-radius: 50%;
    box-shadow: 0 0 12px rgba(var(--wolf-red-rgb),0.9);
    animation: protocolPulse 2s infinite ease-in-out;
  }

  @keyframes protocolPulse {
    0%, 100% { opacity: 0.4; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  /* ===== FORM INPUTS ===== */
  #master-asset-id {
    font-weight: 700 !important;
    letter-spacing: 0.5px;
  }

  .field-label {
    font-size: 9px;
    font-weight: 900;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 6px;
  }

  .terminal-input,
  .id-wrapper-group {
    width: 100%;
    background: #050505 !important;
    border: 1px solid #252525 !important;
    border-radius: 14px;
    color: #fff !important;
    transition:
      border-color 0.22s ease,
      box-shadow 0.22s ease,
      background 0.22s ease,
      transform 0.15s ease;
  }

  .terminal-input {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    outline: none;
  }

  .terminal-input:hover,
  .id-wrapper-group:hover {
    border-color: #444 !important;
    transform: translateY(-1px);
  }

  .terminal-input:focus,
  .id-wrapper-group:focus-within {
    border-color: var(--wolf-red) !important;
    background: #000 !important;
    box-shadow: 0 0 18px rgba(var(--wolf-red-rgb), 0.35);
  }

  .id-wrapper-group {
    display: flex;
    align-items: center;
    overflow: hidden;
    padding-right: 6px;
  }

  .id-prefix {
    padding-left: 16px;
    color: var(--wolf-red);
    font-family: monospace;
    font-weight: 900;
    font-size: 13px;
  }

  .id-wrapper-group input {
    background: transparent !important;
    border: none !important;
    flex: 1;
    padding: 12px 10px !important;
    color: #fff !important;
    outline: none !important;
    font-size: 13px;
  }

  .static-area {
    resize: none;
    overflow-y: auto;
  }

  input[type='number'] {
    appearance: textfield;
    -moz-appearance: textfield;
  }
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* ===== CHECKBOXES ===== */
  .cyber-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }
  .cyber-checkbox input { display: none; }

  .check-mark {
    width: 18px;
    height: 18px;
    background: #060606;
    border: 1px solid #333;
    border-radius: 4px;
    position: relative;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.15s ease;
  }

  .cyber-checkbox input:checked + .check-mark {
    background: var(--wolf-red);
    border-color: var(--wolf-red);
    box-shadow: 0 0 12px rgba(var(--wolf-red-rgb),0.7);
    transform: translateY(-1px);
  }

  .cyber-checkbox input:checked + .check-mark::after {
    content: '\\eb7a';
    font-family: 'boxicons';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 14px;
  }

  .check-text {
    font-size: 9px;
    font-weight: 900;
    color: #555;
    letter-spacing: 1px;
  }

  .cyber-checkbox input:checked ~ .check-text {
    color: var(--wolf-red);
  }

  /* ===== SYMBOL CHECKBOX ===== */
  .cyber-checkbox-symbol { cursor: pointer; user-select: none; }
  .cyber-checkbox-symbol input { display: none; }

  .symbol-box {
    width: 45px;
    height: 45px;
    background: #101010;
    border: 1px solid #222;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #444;
    font-size: 22px;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.15s ease;
  }

  .cyber-checkbox-symbol input:checked + .symbol-box {
    background: radial-gradient(circle at top left, rgba(var(--wolf-red-rgb),0.2), #050505);
    border-color: var(--wolf-red);
    color: var(--wolf-red);
    box-shadow: 0 0 18px rgba(var(--wolf-red-rgb), 0.4);
    transform: translateY(-1px);
  }

  /* ===== CLOSE BUTTON ===== */
  .terminal-close-btn {
    background: #0d0d0d;
    border: 1px solid #262626;
    color: #666;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition:
      background 0.25s ease,
      border-color 0.25s ease,
      color 0.25s ease,
      transform 0.25s ease,
      box-shadow 0.25s ease;
  }

  .terminal-close-btn:hover {
    background: var(--wolf-red);
    color: #fff;
    transform: rotate(90deg) scale(1.05);
    border-color: var(--wolf-red);
    box-shadow: 0 0 18px rgba(var(--wolf-red-rgb), 0.7);
  }

  .terminal-close-btn:active {
    transform: rotate(90deg) scale(0.95);
    box-shadow: 0 0 8px rgba(var(--wolf-red-rgb), 0.4);
  }

  /* ===== GRID / RESPONSIVE ===== */
  .terminal-grid {
    display: grid;
    grid-template-columns: 1fr 1.8fr;
    gap: 16px;
  }

  .stock-input-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  }

  @media (max-width: 767px) {
    .master-terminal-container { max-width: 390px; }
    .stock-action-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
    }
    .symbol-box {
      position: static;
    }
  }

  /* ===== OPTIONAL BOX ===== */
  .optional-protocol-box {
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed #2b2b2b;
    border-radius: 20px;
    padding: 18px;
    margin: 22px 0;
  }

  .optional-tag {
    font-size: 8px;
    font-weight: 900;
    color: #555;
    text-align: center;
    margin-bottom: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  /* ===== COMMIT BUTTON ===== */
  .btn-terminal-commit {
    width: 100%;
    background: linear-gradient(135deg, var(--wolf-red), #ff7b6a);
    color: #fff;
    border: none;
    padding: 16px;
    border-radius: 16px;
    font-weight: 900;
    font-style: italic;
    cursor: pointer;
    box-shadow:
      0 16px 36px rgba(var(--wolf-red-rgb), 0.5),
      0 0 0 1px rgba(255,255,255,0.06);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      filter 0.2s ease;
  }

  .btn-terminal-commit:hover {
    filter: brightness(1.12);
    transform: translateY(-2px);
    box-shadow:
      0 20px 40px rgba(var(--wolf-red-rgb), 0.7),
      0 0 0 1px rgba(255,255,255,0.12);
  }

  .btn-terminal-commit:active {
    transform: translateY(1px) scale(0.98);
    box-shadow:
      0 10px 20px rgba(var(--wolf-red-rgb), 0.5),
      0 0 0 1px rgba(255,255,255,0.08);
  }

  /* ===== IMAGE BOX IN MODAL ===== */
  .image-box {
    width: 100%;
    min-height: 180px;
    background: #050505;
    margin-top: 10px;
    border-radius: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 6px;
    padding: 6px;
    box-sizing: border-box;
    justify-items: center;
    align-items: center;
    overflow: hidden;
    border: 1px solid #222;
  }

  .image-box img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 10px;
    opacity: 0.8;
    cursor: pointer;
    transform: scale(1);
    transition:
      transform 0.2s ease,
      opacity 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
    border: 1px solid transparent;
  }

  .image-box img:hover {
    opacity: 1;
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 10px 18px rgba(0,0,0,0.7);
  }

  .image-box img.selected {
    opacity: 1;
    transform: translateY(-2px) scale(1.05);
    border-color: var(--wolf-red);
    box-shadow: 0 0 16px rgba(var(--wolf-red-rgb), 0.7);
  }

  .status {
    font-size: 12px;
    opacity: 0.8;
    margin-top: 4px;
  }
`},getSkeleton(){return Array(6).fill(0).map(()=>`
      <div class="col-12 col-md-6 col-xl-4 opacity-50">
        <div class="hud-item" style="height: 350px;">
          <div class="skel-shimmer" style="height: 150px; background: var(--skeleton-base); border-radius: 12px; margin-bottom: 20px;"></div>
          <div class="skel-shimmer" style="width: 70%; height: 20px; background: var(--skeleton-mid); margin-bottom: 10px;"></div>
          <div class="skel-shimmer" style="width: 40%; height: 15px; background: var(--skeleton-mid);"></div>
        </div>
      </div>
    `).join("")},getTrashSkeleton(){return Array(5).fill(0).map(()=>`
      <div class="wolf-skel-pill" style="display:flex; align-items:center; gap:15px; padding:12px; margin-bottom:10px; background:var(--surface-elevated); border-radius:12px; border:1px dashed var(--border-color);">
        <div style="width:40px; height:40px; background:var(--skeleton-base); border-radius:10px;"></div>
        <div style="width:150px; height:12px; background:var(--skeleton-mid); border-radius:4px;"></div>
      </div>
    `).join("")},async fetchTrashData(){const e=document.getElementById("trash-list");e&&(e.innerHTML=this.getTrashSkeleton());try{const{data:t,error:a}=await window.supabaseClient.from("trash_bin").select("*").eq("table_name","products").order("deleted_at",{ascending:!1});if(a)throw a;this.trashData=t||[];const o=document.getElementById("trash-count")||document.getElementById("archived-products-count");o&&(o.innerText=this.trashData.length),setTimeout(()=>this.renderTrash(),220),this.renderTrash()}catch(t){console.error("Product Trash Sync Error:",t)}},async fetchProducts(){const e=document.getElementById("products-list");e&&(e.innerHTML=this.getSkeleton());try{const{data:t,error:a}=await window.supabaseClient.from("products").select("*").eq("is_active",!0).order("name",{ascending:!0});if(a)throw a;this.allProducts=t,this.currentFilterList=[...t||[]],this.currentPage=1;const o=document.getElementById("total-products-count"),i=document.getElementById("low-stock-count"),d=document.getElementById("total-inventory-value");o&&(o.innerText=t.length),i&&(i.innerText=t.filter(n=>n.qty<=5).length);const r=t.reduce((n,c)=>{const l=Number(c.price)||0,p=Number(c.qty)||0;return p>=999999?n:n+l*p},0);d&&(d.innerText=`₱${r.toLocaleString()}`),this.render(t)}catch(t){console.error("Inventory Error:",t)}},render(e){const t=document.getElementById("products-list");if(!t)return;this.currentFilterList=Array.isArray(e)?[...e]:[];const a=e.length,o=Math.max(1,Math.ceil(a/this.pageSize));this.currentPage>o&&(this.currentPage=o);const i=(this.currentPage-1)*this.pageSize,d=e.slice(i,i+this.pageSize);t.innerHTML=d.map((r,n)=>{const c=r.qty<=5?"status-critical":"status-good",l=r.qty<=5?"LOW_STOCK":"IN_STOCK",p=Number(r.price||0).toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:2});return`
            <div class="col-12 col-md-6 col-xl-4 animate__animated animate__fadeInUp"
                 style="animation-delay: ${n*.05}s">
             <div class="product-card-scene">
                <div class="product-card" id="prod-${r.productid}" data-product-id="${r.productid}">
                  <div class="product-card-rotor">
                <div class="card-face card-front">
                  <div class="stock-badge ${c}">${l}</div>

                  <div class="card-actions-top">
                    <button class="btn-edit-product" data-product-id="${r.productid}" title="Edit">
                      <i class="bx bx-edit-alt"></i>
                    </button>
                    <button class="btn-delete-product" data-product-id="${r.productid}" title="Archive">
                      <i class="bx bx-trash"></i>
                    </button>
                  </div>

                  <div class="product-visual">
                    <img src="${r.image_url||"/assets/images/placeholder.png"}" 
                         alt="Product Preview" 
                         data-product-name="${r.name||""}"
                         data-product-id="${r.productid}">
                  </div>

                  <div class="info-section">
                    <div class="info-group">
                      <label>PRODUCT NAME</label>
                      <div class="value text-truncate">${(r.name||"").toUpperCase()}</div>
                    </div>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                      <div class="info-group">
                        <label>SKU IDENTIFIER</label>
                        <div class="value small" style="font-family:monospace; color:#666;">${r.sku||""}</div>
                      </div>
                      <div class="price-tag">₱${p}</div>
                    </div>
                  </div>

                  <div class="card-footer mt-auto pt-3">
                    <div style="
                      border-top: 1px solid rgba(255,255,255,0.05);
                      padding-top: 10px;
                      display: flex;
                      justify-content: space-between;
                      font-size: 9px;
                      font-weight: 900;
                      color: #444;
                    ">
                      <span>STOCK_LEVEL: ${r.qty} UNITS</span>
                      <span>CLICK_TO_MANAGE</span>
                    </div>
                  </div>
                </div>

                <div class="card-face card-back">
                  <div class="back-header">MANAGEMENT - ${r.sku||""}</div>
                  <div class="product-back-actions">
                    <button class="back-action-btn btn-add-sale" data-product-id="${r.productid}" title="Add to Sales">
                      <i class="bx bx-cart-add"></i> Add to Sales
                    </button>
                    <button class="back-action-btn btn-edit-product" data-product-id="${r.productid}" title="Edit Product">
                      <i class="bx bx-edit-alt"></i> Edit Product
                    </button>
                    <button class="back-action-btn danger btn-delete-product" data-product-id="${r.productid}" title="Archive Product">
                      <i class="bx bx-trash"></i> Archive
                    </button>
                    <button class="back-action-btn btn-flip-back" data-product-id="${r.productid}" title="Flip Back">
                      <i class="bx bx-undo"></i> Flip Back
                    </button>
                  </div>
                  <div class="back-footer">&lt; &lt; &lt; CLICK ME TO FLIP BACK &gt; &gt; &gt;</div>
                </div>
                  </div>
              </div>
            </div>
          </div>
        `}).join(""),a>this.pageSize&&(t.innerHTML+=`
        <div class="col-12" style="display:flex; justify-content:center; align-items:center; gap:10px; margin-top:8px;">
          <button onclick="ProductManager.setPage(${this.currentPage-1})" ${this.currentPage<=1?"disabled":""} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class='bx bx-chevron-left'></i></button>
          <span style="font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#97a4ba;">Page ${this.currentPage} of ${o}</span>
          <button onclick="ProductManager.setPage(${this.currentPage+1})" ${this.currentPage>=o?"disabled":""} style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#e7edf8;"><i class='bx bx-chevron-right'></i></button>
        </div>
      `),window.PIXABAY_KEY="54360015-81e98130630ae3ed1faf5a9b9",e.forEach(r=>{const n=document.getElementById(`prod-${r.productid}`);if(!n)return;const c=n.querySelector("img");c&&(c.onerror=async()=>{c.onerror=null;try{const l=c.dataset.productName||r.name||"product",p=encodeURIComponent(l.replace(/[^\w\s]/g,"").trim()),x=await(await fetch(`https://pixabay.com/api/?key=${window.PIXABAY_KEY}&q=${p}&image_type=photo&orientation=horizontal&per_page=3&safesearch=true`)).json();if(x.hits&&x.hits.length>0){const m=x.hits[0].webformatURL;c.src=m,c.alt=`${l} - Stock Photo`;const{error:b}=await supabaseClient.from("products").update({image_url:m}).eq("productid",r.productid);b?console.warn("Failed to update image_url in database:",b):(console.log(`✅ Updated image for ${l}:`,m),Toastify({text:`📸 New image for ${l}`,duration:2e3,gravity:"top",position:"right",style:{border:"1px solid #4CAF50",background:"#0a0a0a",borderRadius:"8px",fontWeight:"700",fontFamily:"JetBrains Mono, monospace",color:"#fff"}}).showToast())}else c.src="/assets/images/placeholder.png",console.log(`No Pixabay images found for "${l}"`)}catch(l){console.error("Pixabay API error:",l),c.src="/assets/images/placeholder.png",Toastify({text:`Image fetch failed for ${r.name||"product"}`,duration:2500,gravity:"top",position:"right",style:{border:"1px solid #ff9800",background:"#0a0a0a",borderRadius:"8px",fontWeight:"700",fontFamily:"JetBrains Mono, monospace",color:"#fff"}}).showToast()}})})},setPage(e){const t=Number(e);!Number.isFinite(t)||t<1||(this.currentPage=t,this.render(this.currentFilterList.length?this.currentFilterList:this.allProducts))},renderTrash(){const e=document.getElementById("trash-list");if(!e)return;if(e.innerHTML="",e.style.display="block",e.style.opacity="1",e.style.visibility="visible",!this.trashData||this.trashData.length===0){e.innerHTML='<div class="text-center py-5 opacity-50">PRODUCT_RECOVERY_BIN_EMPTY</div>';return}const t=a=>{const o=String(a!=null?a:"");return typeof WOLF_PURIFIER=="function"?WOLF_PURIFIER(o):o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")};try{const a=this.canHardDelete();e.innerHTML=this.trashData.map((o,i)=>{const d=o&&typeof o.deleted_data=="object"&&o.deleted_data?o.deleted_data:{},r=t(d.name||"UNKNOWN_PRODUCT"),n=t(d.sku||"N/A"),c=Number(d.qty),l=Number.isFinite(c)&&c>=999999?"UNLIMITED":Number.isFinite(c)?`${c}`:"0",p=Number(d.price||0),y=Number.isFinite(p)?p.toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:2}):"0.00";return`
          <div class="trash-pill-card animate__animated animate__fadeInRight" style="animation-delay: ${i*.05}s;">
            <div class="trash-avatar-node"><i class="bx bx-package"></i></div>
            <div class="trash-details">
              <h6 style="color:white !important; opacity:1 !important;">${r}</h6>
              <p>SKU: ${n} | STOCK: ${l} | PRICE: P${y}</p>
            </div>
            <div class="trash-action-group">
              <button class="btn-trash-action restore" onclick="ProductManager.restoreFromTrash('${o.id}')" title="Restore product">
                <i class="bx bx-undo"></i>
              </button>
              ${a?`<button class="btn-trash-action purge" onclick="ProductManager.wipePermanent('${o.id}')" title="Delete permanently">
                <i class="bx bx-shield-x"></i>
              </button>`:""}
            </div>
          </div>`}).join("")}catch(a){console.error("Product trash render error:",a),e.innerHTML='<div class="text-center py-4 text-danger">FAILED_TO_RENDER_TRASH_ITEMS</div>'}},async switchToTrash(){const e=document.getElementById("product-main-view"),t=document.getElementById("main-content");if(!(!e||!t)){window.wolfAudio&&window.wolfAudio.play("woosh"),e.classList.remove("stage-center"),e.classList.add("stage-left");try{const o=await(await fetch("/pages/management/product-trash-container.html")).text();setTimeout(()=>{t.innerHTML=o;const i=document.getElementById("product-trash-view");i&&(i.classList.add("stage-right"),i.offsetWidth,i.classList.remove("stage-right"),i.classList.add("stage-center"),this.initTrashView())},500)}catch(a){console.error("Product trash view load error:",a),e.classList.remove("stage-left"),e.classList.add("stage-center")}}},async initTrashView(){const e=document.getElementById("btn-trash-back");e&&(e.onclick=async()=>{const t=document.getElementById("product-trash-view"),a=document.getElementById("main-content");!t||!a||(window.wolfAudio&&window.wolfAudio.play("woosh"),t.classList.remove("stage-center"),t.classList.add("stage-right"),setTimeout(async()=>{const i=await(await fetch("/pages/management/products.html")).text();a.innerHTML=i;const d=document.getElementById("product-main-view");d&&(d.classList.add("stage-left"),d.offsetWidth,d.classList.remove("stage-left"),d.classList.add("stage-center"),this.init())},500))},await this.fetchTrashData())},async restoreFromTrash(e){var o;const t=this.trashData.find(i=>i.id===e);if(!t)return;const a=String(t.original_id||((o=t.deleted_data)==null?void 0:o.productid)||"");if(!a){Toastify({text:"Invalid archive payload",duration:3e3,backgroundColor:"#e74c3c"}).showToast();return}try{const i={...t.deleted_data||{},productid:a,is_active:!0,updated_at:new Date().toISOString()},{data:d,error:r}=await window.supabaseClient.from("products").select("productid").eq("productid",a).maybeSingle();if(r)throw r;if(d!=null&&d.productid){const{error:c}=await window.supabaseClient.from("products").update(i).eq("productid",a);if(c)throw c}else{const{error:c}=await window.supabaseClient.from("products").insert(i);if(c)throw c}const{error:n}=await window.supabaseClient.from("trash_bin").delete().eq("id",e);if(n)throw n;window.wolfAudio&&window.wolfAudio.play("success"),Toastify({text:"Product restored",duration:2500,backgroundColor:"#2ecc71"}).showToast(),await this.fetchTrashData()}catch(i){console.error("Product restore error:",i),Toastify({text:`Restore failed: ${i.message||"Unknown error"}`,duration:3500,backgroundColor:"#e74c3c"}).showToast()}},async wipePermanent(e){var o;if(!this.canHardDelete()){await Swal.fire("ACCESS DENIED","Only admin can hard delete records.","warning");return}const t=this.trashData.find(i=>i.id===e);if(!t)return;const{isConfirmed:a}=await Swal.fire({title:"PURGE PRODUCT PERMANENTLY?",text:"This will remove the archived copy and delete the product record.",icon:"warning",showCancelButton:!0,confirmButtonColor:"#d33",background:"#0a0a0a",color:"#fff",confirmButtonText:"PURGE"});if(a)try{const i=String(t.original_id||((o=t.deleted_data)==null?void 0:o.productid)||"");if(i){const{error:r}=await window.supabaseClient.from("products").delete().eq("productid",i);if(r)throw r}const{error:d}=await window.supabaseClient.from("trash_bin").delete().eq("id",e);if(d)throw d;Toastify({text:"Product purged permanently",duration:2600,backgroundColor:"#e74c3c"}).showToast(),await this.fetchTrashData()}catch(i){console.error("Product purge error:",i),Swal.fire("ERROR",i.message||"Purge failed.","error")}},edit(e){this.openAddToSalesModal(e,"edit")},delete(e){const t=this.allProducts.find(a=>a.productid===e);if(t){if(t.is_active===!1){Toastify({text:"Product is already archived",duration:2500,backgroundColor:"#f39c12"}).showToast(),this.allProducts=this.allProducts.filter(a=>a.productid!==e),this.render(this.allProducts);return}confirm(`Archive product "${t.name||""}"?`)&&(async()=>{try{const{data:a,error:o}=await window.supabaseClient.from("trash_bin").select("id").eq("table_name","products").eq("original_id",String(t.productid)).limit(1).maybeSingle();if(o)throw o;if(!a){const{error:r}=await window.supabaseClient.from("trash_bin").insert({original_id:String(t.productid),table_name:"products",deleted_data:t});if(r)throw r}const{data:i,error:d}=await window.supabaseClient.from("products").update({is_active:!1}).eq("productid",t.productid).eq("is_active",!0).select("productid");if(d)throw d;if(!(i!=null&&i.length)){Toastify({text:"Product already archived",duration:2500,backgroundColor:"#f39c12"}).showToast(),this.allProducts=this.allProducts.filter(r=>r.productid!==t.productid),this.render(this.allProducts);return}this.allProducts=this.allProducts.filter(r=>r.productid!==t.productid),this.render(this.allProducts),Toastify({text:"Product archived",duration:3e3,backgroundColor:"#f39c12"}).showToast()}catch(a){console.error("Archive product error:",a),Toastify({text:`Error archiving product: ${a.message||"Unknown error"}`,duration:4e3,backgroundColor:"#e74c3c"}).showToast()}})()}},openAddToSalesModal(e,t="sale"){const a=this.allProducts.find(w=>w.productid===e);if(!a)return;const o=t==="edit"?"edit":"sale",i=o==="sale"?"sale":"product",d=o==="edit";if(window.isProductModalOpen){const w=document.getElementById("master-product-form");w&&w.dataset.productId!==a.productid&&(w.dataset.productId="")}let r=document.getElementById("add-product-modal-css");r||(r=document.createElement("link"),r.id="add-product-modal-css",r.rel="stylesheet",r.href="/assets/components/add-product-modal.css",r.dataset.dynamic="true",document.head.appendChild(r)),document.getElementById("product-modal-overlay")||loadComponent("product-modal-container","/assets/components/add-product-modal.html");const n=document.getElementById("product-modal-overlay"),c=n==null?void 0:n.querySelector(".master-terminal-container"),l=document.getElementById("master-product-form");if(!n||!l||!c)return;const p=document.getElementById("master-asset-id"),y=document.getElementById("master-name"),x=document.getElementById("master-price"),m=document.getElementById("master-qty"),b=document.getElementById("master-unlimited"),E=document.getElementById("master-brand"),L=document.getElementById("master-desc"),v=document.getElementById("imageContainer"),k=document.getElementById("status");if(!p||!y||!x||!m)return;const O=l.dataset.productId,R=l.dataset.modalAction||"";if(O!==a.productid||R!==o||!y.value||!p.value||!x.value){if(p.value=stripSkuPrefix(a.sku||""),y.value=a.name||"",x.value=a.price||0,i==="sale")b&&(b.checked=!1),m.value=1,m.disabled=!1,m.required=!0,m.placeholder="0";else{const w=Number(a.qty)>=999999;b&&(b.checked=w),w?(m.value="",m.disabled=!0,m.required=!1,m.placeholder="UNLIMITED"):(m.value=Number(a.qty||0),m.disabled=!1,m.required=!0,m.placeholder="0")}if(E&&(E.value=a.brand||""),L&&(L.value=a.description||""),v)if(v.innerHTML="",a.image_url){const w=document.createElement("img");w.src=a.image_url,w.alt=a.name||"Product",w.classList.add("selected"),w.dataset.selected="true",v.appendChild(w),l.dataset.selectedImageUrl=a.image_url,k&&(k.textContent="Using saved product image.")}else k&&(l.dataset.selectedImageUrl="",k.textContent="")}l.dataset.productId=a.productid,l.dataset.submitMode=i,l.dataset.editMode=d?"true":"false",l.dataset.modalAction=o,setProductModalMode(i),setProductModalEditState(d),p&&(p.readOnly=!0,p.disabled=!1),!window.isProductModalOpen&&(window.isProductModalOpen=!0,n.style.display="flex",n.style.opacity="1",n.classList.remove("is-closing"),n.classList.add("is-open"),c.classList.remove("modal-closing"),c.classList.add("modal-open"))},toggleFlip(e){const t=document.getElementById(`prod-${e}`);t&&t.classList.toggle("is-flipped")},setupUIListeners(){const e=document.getElementById("product-main-view")||document,t=e.querySelector("#products-list");t&&t.addEventListener("click",n=>{var m,b,E,L;const c=n.target.closest(".product-card");if(!c)return;const l=c.getAttribute("data-product-id");if(n.target.closest(".btn-edit-product")){n.stopPropagation(),(m=this.edit)==null||m.call(this,l);return}if(n.target.closest(".btn-delete-product")){n.stopPropagation(),(b=this.delete)==null||b.call(this,l);return}if(n.target.closest(".btn-add-sale")){n.stopPropagation(),(E=this.openAddToSalesModal)==null||E.call(this,l);return}(L=this.toggleFlip)==null||L.call(this,l)});const a=e.querySelector("#toggle-search-btn"),o=e.querySelector("#ledger-search-container"),i=e.querySelector("#product-main-search"),d=e.querySelector("#search-clear-btn"),r=e.querySelector("#btn-view-trash");r&&(r.onclick=()=>{var n;return(n=this.switchToTrash)==null?void 0:n.call(this)}),a&&o&&i&&(a.onclick=n=>{var c;n.preventDefault(),n.stopPropagation(),a.classList.toggle("active"),o.classList.toggle("active"),o.classList.contains("active")?i.focus():(i.value="",d&&(d.style.display="none"),this.currentPage=1,(c=this.render)==null||c.call(this,this.allProducts||[]))}),i&&(i.oninput=n=>{var y;const c=(n.target.value||"").toLowerCase();d&&(d.style.display=c.length>0?"block":"none");const p=(this.allProducts||[]).filter(x=>x.name&&x.name.toLowerCase().includes(c)||x.sku&&x.sku.toLowerCase().includes(c));this.currentPage=1,(y=this.render)==null||y.call(this,p)}),d&&i&&(d.onclick=()=>{var n;i.value="",d.style.display="none",this.currentPage=1,(n=this.render)==null||n.call(this,this.allProducts||[])})}};
