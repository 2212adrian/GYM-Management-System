let isProductModalOpen=!1;function showValidationError(a){Toastify({text:a.toUpperCase(),duration:2800,gravity:"top",position:"right",style:{border:"1px solid #ff3b3b",background:"#0a0a0a",borderRadius:"12px",fontWeight:"900",fontFamily:"JetBrains Mono, monospace",color:"#fff",boxShadow:"0 0 16px rgba(255, 59, 59, 0.4)"}}).showToast()}function generateBarcodeId(){const a=document.getElementById("master-asset-id");if(!a)return;const t=Math.floor(1e3+Math.random()*9e3);a.value=String(t)}function stripSkuPrefix(a){return String(a||"").trim().replace(/^PR[-\s]*/i,"")}function ensureSkuPrefix(a){const t=stripSkuPrefix(a).toUpperCase();return t?`PR-${t}`:""}function setProductModalMode(a="product"){const t=a==="sale"?"sale":"product",e=document.getElementById("master-product-form"),i=e==null?void 0:e.querySelector(".btn-terminal-commit"),o=document.querySelector(".terminal-title span"),s=document.querySelector(".terminal-protocol");e&&(e.dataset.submitMode=t),i&&(i.textContent=t==="sale"?"ADD TO SALES":"ADD PRODUCT"),o&&(o.textContent=t==="sale"?"SALES":"PRODUCT"),s&&(s.textContent=t==="sale"?"QUICK SALES ENTRY - RECORDS TRANSACTION ONLY":"MANUAL PRODUCT ENTRY - ADDS TO INVENTORY ONLY")}function setProductModalEditState(a=!1){const t=document.getElementById("master-product-form"),e=t==null?void 0:t.querySelector(".btn-terminal-commit"),i=document.querySelector(".terminal-protocol"),o=document.querySelector(".terminal-title span");if(t&&(t.dataset.editMode=a?"true":"false"),a)e&&(e.textContent="SAVE CHANGES"),o&&(o.textContent="PRODUCT"),i&&(i.textContent="EDIT PRODUCT ENTRY - UPDATES INVENTORY RECORD");else{const s=(t==null?void 0:t.dataset.submitMode)==="sale"?"sale":"product";setProductModalMode(s)}}function openProductModal(){const a=document.getElementById("product-modal-overlay"),t=a==null?void 0:a.querySelector(".master-terminal-container");if(!a||!t)return;let e=document.getElementById("add-product-modal-css");e||(e=document.createElement("link"),e.id="add-product-modal-css",e.rel="stylesheet",e.href="/assets/components/add-product-modal.css",e.dataset.dynamic="true",document.head.appendChild(e)),a.style.display="flex",a.style.opacity="1",a.classList.remove("is-closing"),a.classList.add("is-open"),t.classList.remove("modal-closing"),t.classList.add("modal-open"),window.isProductModalOpen=!0,setProductModalMode("product"),setProductModalEditState(!1);const i=document.getElementById("master-product-form");i&&(i.dataset.selectedImageUrl="",i.dataset.modalAction="create"),generateBarcodeId()}function closeProductModal(){const a=document.getElementById("product-modal-overlay"),t=a==null?void 0:a.querySelector(".master-terminal-container");if(!a||!t||!window.isProductModalOpen)return;window.isProductModalOpen=!1,["master-asset-id","master-name","master-price","master-qty","master-brand","master-desc"].forEach(E=>{const T=document.getElementById(E);T&&(T.value="")});const i=document.getElementById("master-unlimited"),o=document.getElementById("master-qty");i&&(i.checked=!1),o&&(o.disabled=!1,o.required=!0,o.placeholder="0");const s=document.getElementById("imageContainer"),d=document.getElementById("uploadImageContainer"),r=document.getElementById("upload-image-name"),l=document.getElementById("upload-image-input"),c=document.getElementById("image-tab-web"),p=document.getElementById("image-tab-upload"),y=document.getElementById("image-web-panel"),w=document.getElementById("image-upload-panel"),g=document.getElementById("status");s&&(s.innerHTML=""),d&&(d.innerHTML=""),r&&(r.textContent="No file selected"),l&&(l.value=""),c&&c.classList.add("is-active"),p&&p.classList.remove("is-active"),y&&y.classList.add("is-active"),w&&w.classList.remove("is-active"),g&&(g.textContent="");const h=document.getElementById("master-product-form");h&&(h.dataset.productId="",h.dataset.submitMode="product",h.dataset.editMode="false",h.dataset.selectedImageUrl="",h.dataset.modalAction="create"),setProductModalMode("product"),setProductModalEditState(!1),t.classList.remove("modal-open"),t.classList.add("modal-closing"),a.classList.add("is-closing"),setTimeout(()=>{t.classList.remove("modal-closing"),a.classList.remove("is-closing","is-open"),a.style.display="none",a.style.opacity="0";const E=document.querySelector('#add-product-modal-css[data-dynamic="true"]');E&&E.remove()},220)}function validateProductForm(){const a=document.getElementById("master-name"),t=document.getElementById("master-price"),e=document.getElementById("master-qty"),i=document.getElementById("master-asset-id"),o=document.getElementById("master-unlimited"),s=[a,t,i];o!=null&&o.checked||s.push(e);let d=null;return s.forEach(r=>{r&&(r.classList.remove("field-error"),(!r.value||r.value.trim()==="")&&(r.classList.add("field-error"),d||(d=r)))}),d?(showValidationError("Please fill all required product details."),d.focus(),setTimeout(()=>d.classList.remove("field-error"),350),!1):!0}document.addEventListener("click",a=>{const t=document.getElementById("product-modal-overlay");if(a.target.closest("#roll-barcode-btn")){a.preventDefault(),generateBarcodeId();return}if(a.target.closest("#btn-add-product")){a.preventDefault(),a.stopPropagation(),openProductModal();return}if(a.target.closest("#closeProductModal")){a.preventDefault(),a.stopPropagation(),closeProductModal();return}if(t&&a.target===t){closeProductModal();return}const o=a.target.closest(".optional-toggle-bar");if(o){const s=o.closest(".optional-protocol-box");if(!s)return;const d=s.classList.contains("is-expanded");s.classList.toggle("is-expanded",!d),s.classList.toggle("is-collapsed",d);return}});const ProductManager={allProducts:[],trashData:[],async init(){var a;console.log("Wolf OS: Product Manager Initializing..."),(a=this.injectStyles)==null||a.call(this),await this.loadAddProductModal(),this.setupAddProductModalLogic(),this.setupUIListeners(),await this.fetchProducts()},async loadAddProductModal(){const a=document.getElementById("wolf-layout")||document.body;let t=document.getElementById("add-product-modal-host");t||(t=document.createElement("div"),t.id="add-product-modal-host",a.appendChild(t));try{const e=await fetch("/assets/components/add-product-modal.html");if(!e.ok)throw new Error("Failed to load add-product-modal.html");t.innerHTML=WOLF_PURIFIER(await e.text())}catch(e){console.error("Add Product Modal Load Error:",e)}},setupAddProductModalLogic(){const a=document.getElementById("product-modal-overlay"),t=document.getElementById("master-product-form");if(!a||!t||t.dataset.modalLogicBound==="true")return;t.dataset.modalLogicBound="true";const e=document.getElementById("imageContainer"),i=document.getElementById("uploadImageContainer"),o=document.getElementById("status"),s=document.getElementById("closeProductModal"),d=document.getElementById("master-qty"),r=document.getElementById("master-unlimited"),l=document.getElementById("master-price"),c=document.getElementById("master-name"),p=document.getElementById("master-asset-id"),y=document.getElementById("lookup-input"),w=document.getElementById("lookupBtn"),g=document.getElementById("image-tab-web"),h=document.getElementById("image-tab-upload"),E=document.getElementById("image-web-panel"),T=document.getElementById("image-upload-panel"),v=document.getElementById("upload-image-input"),k=document.getElementById("upload-image-trigger"),R=document.getElementById("upload-image-action"),O=document.getElementById("upload-image-name"),L=t.querySelector(".btn-terminal-commit"),x="54360015-81e98130630ae3ed1faf5a9b9",X=5e5;let S=null;t.dataset.submitMode||(t.dataset.submitMode="product"),t.dataset.editMode||(t.dataset.editMode="false"),t.dataset.modalAction||(t.dataset.modalAction="create"),setProductModalMode(t.dataset.submitMode),setProductModalEditState(t.dataset.editMode==="true"),L&&(L.disabled=!1),v&&(v.setAttribute("accept","image/*"),v.setAttribute("hidden",""));function b(n){o&&(o.textContent=n||"")}function P(n){n&&(n.innerHTML="")}function tt(){[e,i].forEach(n=>{n&&n.querySelectorAll("img").forEach(u=>{u.classList.remove("selected"),u.dataset.selected="false"})})}function H(n){n&&(tt(),n.classList.add("selected"),n.dataset.selected="true",S=n.src,t.dataset.selectedImageUrl=S||"")}function M(n){const u=n==="web";g&&g.classList.toggle("is-active",u),h&&h.classList.toggle("is-active",!u),E&&E.classList.toggle("is-active",u),T&&T.classList.toggle("is-active",!u)}function z(n,u,m,I={}){if(!n||!u)return null;const f=document.createElement("img");return f.src=u,f.alt=m||"Product image",f.loading="lazy",f.decoding="async",n.appendChild(f),f.addEventListener("click",()=>{H(f),b("Image selected.")}),I.autoSelect&&H(f),f}function N(){k&&k.classList.remove("is-selected"),R&&(R.textContent="Attach Image File"),O&&(O.textContent="No file selected"),v&&(v.value="")}function et(n){k&&k.classList.add("is-selected"),R&&(R.textContent="Change Image File"),O&&(O.textContent=n||"Selected file")}function W(){S=null,t.dataset.selectedImageUrl="",P(e),P(i),N(),M("web"),b("")}function at(n){return/^https?:\/\/\S+/i.test(n||"")}async function ot(n){const u=await new Promise((F,$)=>{const B=new FileReader;B.onload=()=>F(B.result),B.onerror=()=>$(new Error("Unable to read selected file.")),B.readAsDataURL(n)}),m=await new Promise((F,$)=>{const B=new Image;B.onload=()=>F(B),B.onerror=()=>$(new Error("Invalid image file.")),B.src=u}),f=Math.min(1,900/Math.max(m.width,m.height)),q=Math.max(1,Math.round(m.width*f)),j=Math.max(1,Math.round(m.height*f)),C=document.createElement("canvas");C.width=q,C.height=j;const D=C.getContext("2d");if(!D)throw new Error("Image processing is not supported on this device.");D.drawImage(m,0,0,q,j);let _=.86,A=C.toDataURL("image/jpeg",_);for(;A.length>X&&_>.55;)_-=.08,A=C.toDataURL("image/jpeg",_);if(A.length>X)throw new Error("Image is too large. Please use a smaller file.");return A}async function rt(n){var u;P(e),P(i),N(),S=null,M("web"),b("Searching images on Pixabay...");try{const m=await fetch(`https://pixabay.com/api/?key=${x}&q=${encodeURIComponent(n)}&image_type=photo&per_page=4`);if(!m.ok){b(m.status===429?"Pixabay API limit reached.":"Unable to fetch images.");return}const I=await m.json();if(!((u=I==null?void 0:I.hits)!=null&&u.length)){b("No images found for this query.");return}I.hits.forEach(f=>{z(e,f.webformatURL,n)}),b("Click one image to select it.")}catch(m){console.error("Pixabay lookup error:",m),b("Image search failed.")}}async function it(n){P(e),P(i),N(),S=null,M("web"),b("Fetching product info from barcode...");try{const m=await(await fetch(`https://world.openfoodfacts.org/api/v0/product/${n}.json`)).json(),I=document.getElementById("master-brand");if(m.status!==1){b("Product not found with this barcode.");return}const f=m.product||{};c&&(c.value=f.product_name||""),I&&(I.value=f.brands||""),f.image_url?(z(e,f.image_url,f.product_name,{autoSelect:!0}),b("Barcode image attached and selected.")):b("Product found. No image available.")}catch(u){console.error("Barcode lookup error:",u),b("Barcode lookup failed.")}}function nt(n){P(e),P(i),N(),S=null,M("web");const u=z(e,n,"Linked image",{autoSelect:!0});if(!u){b("Unable to attach image link.");return}u.addEventListener("error",()=>{S===n&&(S=null),b("Image link could not be loaded.")}),b("Image link detected. Attached and selected.")}function G(){if(!y)return;const n=y.value.trim();if(n){if(at(n)){c&&(c.value=""),nt(n);return}if(/^\d/.test(n.charAt(0))){p&&(p.value=stripSkuPrefix(n).slice(0,32)),it(n);return}c&&(c.value=n),rt(n)}}function V(){!d||!r||(r.checked?(d.value="",d.disabled=!0,d.required=!1,d.placeholder="UNLIMITED"):(d.disabled=!1,d.required=!0,d.placeholder="0"))}d&&r&&(r.addEventListener("change",V),V()),[e,i].forEach(n=>{n&&n.addEventListener("click",u=>{const m=u.target.closest("img");m&&(H(m),b("Image selected."))})}),w&&y&&(w.addEventListener("click",G),y.addEventListener("keydown",n=>{n.key==="Enter"&&(n.preventDefault(),G())})),g&&g.addEventListener("click",()=>{M("web")}),h&&h.addEventListener("click",()=>{M("upload")}),k&&v&&(k.addEventListener("click",()=>v.click()),k.addEventListener("keydown",n=>{(n.key==="Enter"||n.key===" ")&&(n.preventDefault(),v.click())})),v&&v.addEventListener("change",async()=>{var u;const n=(u=v.files)==null?void 0:u[0];if(n){if(!String(n.type||"").startsWith("image/")){showValidationError("Please select a valid image file."),N();return}M("upload"),b("Processing image file...");try{const m=await ot(n);P(i),P(e),z(i,m,n.name,{autoSelect:!0}),et(n.name),b("Attached image file selected.")}catch(m){console.error("Upload image processing error:",m),S=null,P(i),N(),b(m.message||"Unable to process image file."),showValidationError(m.message||"Unable to process image file.")}}}),s&&s.addEventListener("click",n=>{n.preventDefault(),n.stopPropagation(),W(),closeProductModal()}),a.addEventListener("click",n=>{n.target===a&&(W(),closeProductModal())}),t.addEventListener("submit",async n=>{var B,J,Q,Z;if(n.preventDefault(),L!=null&&L.disabled||!validateProductForm())return;const u=stripSkuPrefix((p==null?void 0:p.value)||""),m=ensureSkuPrefix(u),I=t.dataset.submitMode==="sale"?"sale":"product",f=I==="sale",q=t.dataset.productId||null,j=t.dataset.selectedImageUrl||"",C=I==="product"&&t.dataset.editMode==="true"&&!!q,D=((c==null?void 0:c.value)||"").trim(),_=Number.parseFloat((l==null?void 0:l.value)||"0"),A=r!=null&&r.checked?999999:Number.parseInt((d==null?void 0:d.value)||"",10),F=((J=(B=document.getElementById("master-desc"))==null?void 0:B.value)==null?void 0:J.trim())||null,$=((Z=(Q=document.getElementById("master-brand"))==null?void 0:Q.value)==null?void 0:Z.trim())||null;if(p&&(p.value=u),!m){showValidationError("Please generate a SKU code before adding."),p==null||p.focus();return}if(!(r!=null&&r.checked)&&(!Number.isInteger(A)||A<0)){showValidationError("Please enter a valid stock quantity."),d==null||d.focus();return}try{L&&(L.disabled=!0,L.textContent=f?"ADDING TO SALES...":C?"SAVING CHANGES...":"ADDING PRODUCT...");const Y=await fetch("/.netlify/functions/add-product",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:q||null,sku:m,name:D,description:F,brand:$,price:_,qty:A,imageUrl:S||j||null,createSale:f})});let U={};try{U=await Y.json()}catch(K){}if(!Y.ok)throw new Error((U==null?void 0:U.error)||(f?"Failed to add sale from selected product.":"Failed to add product."));if(f){const K=U==null?void 0:U.sale;if(!K)throw new Error("Missing sale response from server.");window.wolfData&&typeof window.wolfData.addSaleRow=="function"&&window.wolfData.addSaleRow(K)}typeof ProductManager.fetchProducts=="function"&&await ProductManager.fetchProducts();const st=r!=null&&r.checked?"UNLIMITED":A;Toastify({text:f?`ADDED TO SALES: ${D.toUpperCase()} x${st}`:C?`PRODUCT UPDATED: ${D.toUpperCase()}`:`PRODUCT ADDED: ${D.toUpperCase()}`,duration:2500,gravity:"top",position:"right",style:{border:"1px solid #77ff00",background:"#0a0a0a",borderRadius:"12px",fontWeight:"900",fontFamily:"JetBrains Mono, monospace",color:"#fff"}}).showToast(),W(),closeProductModal()}catch(Y){console.error("Product modal submit error:",Y),Toastify({text:`${Y.message||"Submission failed."}`,duration:4e3,gravity:"top",position:"right",style:{border:"1px solid #ff3b3b",background:"#0a0a0a",borderRadius:"12px",fontWeight:"900",fontFamily:"JetBrains Mono, monospace",color:"#fff"}}).showToast(),b(f?"Error adding to sales.":C?"Error saving product changes.":"Error adding product.")}finally{setProductModalMode(t.dataset.submitMode||"product"),setProductModalEditState(t.dataset.editMode==="true"),L&&(L.disabled=!1)}})},setupUIListeners(){const a=document.getElementById("products-list");a&&a.addEventListener("click",t=>{var r,l,c,p;const e=t.target.closest(".product-card");if(!e)return;const i=e.getAttribute("data-product-id");if(t.target.closest(".btn-edit-product")){t.stopPropagation(),(r=this.edit)==null||r.call(this,i);return}if(t.target.closest(".btn-delete-product")){t.stopPropagation(),(l=this.delete)==null||l.call(this,i);return}if(t.target.closest(".btn-add-sale")){t.stopPropagation(),(c=this.openAddToSalesModal)==null||c.call(this,i);return}(p=this.toggleFlip)==null||p.call(this,i)})},injectStyles(){const a="wolf-product-styles";let t=document.getElementById(a);t||(t=document.createElement("style"),t.id=a,document.head.appendChild(t)),t.innerHTML=`
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
    `).join("")},async fetchTrashData(){const a=document.getElementById("trash-list");a&&(a.innerHTML=this.getTrashSkeleton());try{const{data:t,error:e}=await window.supabaseClient.from("trash_bin").select("*").eq("table_name","products").order("deleted_at",{ascending:!1});if(e)throw e;this.trashData=t||[];const i=document.getElementById("trash-count")||document.getElementById("archived-products-count");i&&(i.innerText=this.trashData.length),setTimeout(()=>this.renderTrash(),220),this.renderTrash()}catch(t){console.error("Product Trash Sync Error:",t)}},async fetchProducts(){const a=document.getElementById("products-list");a&&(a.innerHTML=this.getSkeleton());try{const{data:t,error:e}=await window.supabaseClient.from("products").select("*").eq("is_active",!0).order("name",{ascending:!0});if(e)throw e;this.allProducts=t;const i=document.getElementById("total-products-count"),o=document.getElementById("low-stock-count"),s=document.getElementById("total-inventory-value");i&&(i.innerText=t.length),o&&(o.innerText=t.filter(r=>r.qty<=5).length);const d=t.reduce((r,l)=>{const c=Number(l.price)||0,p=Number(l.qty)||0;return p>=999999?r:r+c*p},0);s&&(s.innerText=`₱${d.toLocaleString()}`),this.render(t)}catch(t){console.error("Inventory Error:",t)}},render(a){const t=document.getElementById("products-list");t&&(t.innerHTML=a.map((e,i)=>{const o=e.qty<=5?"status-critical":"status-good",s=e.qty<=5?"LOW_STOCK":"IN_STOCK",d=Number(e.price||0).toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:2});return`
            <div class="col-12 col-md-6 col-xl-4 animate__animated animate__fadeInUp"
                 style="animation-delay: ${i*.05}s">
             <div class="product-card-scene">
                <div class="product-card" id="prod-${e.productid}" data-product-id="${e.productid}">
                  <div class="product-card-rotor">
                <div class="card-face card-front">
                  <div class="stock-badge ${o}">${s}</div>

                  <div class="card-actions-top">
                    <button class="btn-edit-product" data-product-id="${e.productid}" title="Edit">
                      <i class="bx bx-edit-alt"></i>
                    </button>
                    <button class="btn-delete-product" data-product-id="${e.productid}" title="Archive">
                      <i class="bx bx-trash"></i>
                    </button>
                  </div>

                  <div class="product-visual">
                    <img src="${e.image_url||"/assets/images/placeholder.png"}" 
                         alt="Product Preview" 
                         data-product-name="${e.name||""}"
                         data-product-id="${e.productid}">
                  </div>

                  <div class="info-section">
                    <div class="info-group">
                      <label>PRODUCT NAME</label>
                      <div class="value text-truncate">${(e.name||"").toUpperCase()}</div>
                    </div>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                      <div class="info-group">
                        <label>SKU IDENTIFIER</label>
                        <div class="value small" style="font-family:monospace; color:#666;">${e.sku||""}</div>
                      </div>
                      <div class="price-tag">₱${d}</div>
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
                      <span>STOCK_LEVEL: ${e.qty} UNITS</span>
                      <span>CLICK_TO_MANAGE</span>
                    </div>
                  </div>
                </div>

                <div class="card-face card-back">
                  <div class="back-header">MANAGEMENT - ${e.sku||""}</div>
                  <div class="product-back-actions">
                    <button class="back-action-btn btn-add-sale" data-product-id="${e.productid}" title="Add to Sales">
                      <i class="bx bx-cart-add"></i> Add to Sales
                    </button>
                    <button class="back-action-btn btn-edit-product" data-product-id="${e.productid}" title="Edit Product">
                      <i class="bx bx-edit-alt"></i> Edit Product
                    </button>
                    <button class="back-action-btn danger btn-delete-product" data-product-id="${e.productid}" title="Archive Product">
                      <i class="bx bx-trash"></i> Archive
                    </button>
                    <button class="back-action-btn btn-flip-back" data-product-id="${e.productid}" title="Flip Back">
                      <i class="bx bx-undo"></i> Flip Back
                    </button>
                  </div>
                  <div class="back-footer">&lt; &lt; &lt; CLICK ME TO FLIP BACK &gt; &gt; &gt;</div>
                </div>
                  </div>
              </div>
            </div>
          </div>
        `}).join(""),window.PIXABAY_KEY="54360015-81e98130630ae3ed1faf5a9b9",a.forEach(e=>{const i=document.getElementById(`prod-${e.productid}`);if(!i)return;const o=i.querySelector("img");o&&(o.onerror=async()=>{o.onerror=null;try{const s=o.dataset.productName||e.name||"product",d=encodeURIComponent(s.replace(/[^\w\s]/g,"").trim()),l=await(await fetch(`https://pixabay.com/api/?key=${window.PIXABAY_KEY}&q=${d}&image_type=photo&orientation=horizontal&per_page=3&safesearch=true`)).json();if(l.hits&&l.hits.length>0){const c=l.hits[0].webformatURL;o.src=c,o.alt=`${s} - Stock Photo`;const{error:p}=await supabaseClient.from("products").update({image_url:c}).eq("productid",e.productid);p?console.warn("Failed to update image_url in database:",p):(console.log(`✅ Updated image for ${s}:`,c),Toastify({text:`📸 New image for ${s}`,duration:2e3,gravity:"top",position:"right",style:{border:"1px solid #4CAF50",background:"#0a0a0a",borderRadius:"8px",fontWeight:"700",fontFamily:"JetBrains Mono, monospace",color:"#fff"}}).showToast())}else o.src="/assets/images/placeholder.png",console.log(`No Pixabay images found for "${s}"`)}catch(s){console.error("Pixabay API error:",s),o.src="/assets/images/placeholder.png",Toastify({text:`Image fetch failed for ${e.name||"product"}`,duration:2500,gravity:"top",position:"right",style:{border:"1px solid #ff9800",background:"#0a0a0a",borderRadius:"8px",fontWeight:"700",fontFamily:"JetBrains Mono, monospace",color:"#fff"}}).showToast()}})}))},renderTrash(){const a=document.getElementById("trash-list");if(!a)return;if(a.innerHTML="",a.style.display="block",a.style.opacity="1",a.style.visibility="visible",!this.trashData||this.trashData.length===0){a.innerHTML='<div class="text-center py-5 opacity-50">PRODUCT_RECOVERY_BIN_EMPTY</div>';return}const t=e=>{const i=String(e!=null?e:"");return typeof WOLF_PURIFIER=="function"?WOLF_PURIFIER(i):i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")};try{a.innerHTML=this.trashData.map((e,i)=>{const o=e&&typeof e.deleted_data=="object"&&e.deleted_data?e.deleted_data:{},s=t(o.name||"UNKNOWN_PRODUCT"),d=t(o.sku||"N/A"),r=Number(o.qty),l=Number.isFinite(r)&&r>=999999?"UNLIMITED":Number.isFinite(r)?`${r}`:"0",c=Number(o.price||0),p=Number.isFinite(c)?c.toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:2}):"0.00";return`
          <div class="trash-pill-card animate__animated animate__fadeInRight" style="animation-delay: ${i*.05}s;">
            <div class="trash-avatar-node"><i class="bx bx-package"></i></div>
            <div class="trash-details">
              <h6 style="color:white !important; opacity:1 !important;">${s}</h6>
              <p>SKU: ${d} | STOCK: ${l} | PRICE: P${p}</p>
            </div>
            <div class="trash-action-group">
              <button class="btn-trash-action restore" onclick="ProductManager.restoreFromTrash('${e.id}')" title="Restore product">
                <i class="bx bx-undo"></i>
              </button>
              <button class="btn-trash-action purge" onclick="ProductManager.wipePermanent('${e.id}')" title="Delete permanently">
                <i class="bx bx-shield-x"></i>
              </button>
            </div>
          </div>`}).join("")}catch(e){console.error("Product trash render error:",e),a.innerHTML='<div class="text-center py-4 text-danger">FAILED_TO_RENDER_TRASH_ITEMS</div>'}},async switchToTrash(){const a=document.getElementById("product-main-view"),t=document.getElementById("main-content");if(!(!a||!t)){window.wolfAudio&&window.wolfAudio.play("woosh"),a.classList.remove("stage-center"),a.classList.add("stage-left");try{const i=await(await fetch("/pages/management/product-trash-container.html")).text();setTimeout(()=>{t.innerHTML=i;const o=document.getElementById("product-trash-view");o&&(o.classList.add("stage-right"),o.offsetWidth,o.classList.remove("stage-right"),o.classList.add("stage-center"),this.initTrashView())},500)}catch(e){console.error("Product trash view load error:",e),a.classList.remove("stage-left"),a.classList.add("stage-center")}}},async initTrashView(){const a=document.getElementById("btn-trash-back");a&&(a.onclick=async()=>{const t=document.getElementById("product-trash-view"),e=document.getElementById("main-content");!t||!e||(window.wolfAudio&&window.wolfAudio.play("woosh"),t.classList.remove("stage-center"),t.classList.add("stage-right"),setTimeout(async()=>{const o=await(await fetch("/pages/management/products.html")).text();e.innerHTML=o;const s=document.getElementById("product-main-view");s&&(s.classList.add("stage-left"),s.offsetWidth,s.classList.remove("stage-left"),s.classList.add("stage-center"),this.init())},500))},await this.fetchTrashData())},async restoreFromTrash(a){var i;const t=this.trashData.find(o=>o.id===a);if(!t)return;const e=String(t.original_id||((i=t.deleted_data)==null?void 0:i.productid)||"");if(!e){Toastify({text:"Invalid archive payload",duration:3e3,backgroundColor:"#e74c3c"}).showToast();return}try{const o={...t.deleted_data||{},productid:e,is_active:!0,updated_at:new Date().toISOString()},{data:s,error:d}=await window.supabaseClient.from("products").select("productid").eq("productid",e).maybeSingle();if(d)throw d;if(s!=null&&s.productid){const{error:l}=await window.supabaseClient.from("products").update(o).eq("productid",e);if(l)throw l}else{const{error:l}=await window.supabaseClient.from("products").insert(o);if(l)throw l}const{error:r}=await window.supabaseClient.from("trash_bin").delete().eq("id",a);if(r)throw r;window.wolfAudio&&window.wolfAudio.play("success"),Toastify({text:"Product restored",duration:2500,backgroundColor:"#2ecc71"}).showToast(),await this.fetchTrashData()}catch(o){console.error("Product restore error:",o),Toastify({text:`Restore failed: ${o.message||"Unknown error"}`,duration:3500,backgroundColor:"#e74c3c"}).showToast()}},async wipePermanent(a){var i;const t=this.trashData.find(o=>o.id===a);if(!t)return;const{isConfirmed:e}=await Swal.fire({title:"PURGE PRODUCT PERMANENTLY?",text:"This will remove the archived copy and delete the product record.",icon:"warning",showCancelButton:!0,confirmButtonColor:"#d33",background:"#0a0a0a",color:"#fff",confirmButtonText:"PURGE"});if(e)try{const o=String(t.original_id||((i=t.deleted_data)==null?void 0:i.productid)||"");if(o){const{error:d}=await window.supabaseClient.from("products").delete().eq("productid",o);if(d)throw d}const{error:s}=await window.supabaseClient.from("trash_bin").delete().eq("id",a);if(s)throw s;Toastify({text:"Product purged permanently",duration:2600,backgroundColor:"#e74c3c"}).showToast(),await this.fetchTrashData()}catch(o){console.error("Product purge error:",o),Swal.fire("ERROR",o.message||"Purge failed.","error")}},edit(a){this.openAddToSalesModal(a,"edit")},delete(a){const t=this.allProducts.find(e=>e.productid===a);if(t){if(t.is_active===!1){Toastify({text:"Product is already archived",duration:2500,backgroundColor:"#f39c12"}).showToast(),this.allProducts=this.allProducts.filter(e=>e.productid!==a),this.render(this.allProducts);return}confirm(`Archive product "${t.name||""}"?`)&&(async()=>{try{const{data:e,error:i}=await window.supabaseClient.from("trash_bin").select("id").eq("table_name","products").eq("original_id",String(t.productid)).limit(1).maybeSingle();if(i)throw i;if(!e){const{error:d}=await window.supabaseClient.from("trash_bin").insert({original_id:String(t.productid),table_name:"products",deleted_data:t});if(d)throw d}const{data:o,error:s}=await window.supabaseClient.from("products").update({is_active:!1}).eq("productid",t.productid).eq("is_active",!0).select("productid");if(s)throw s;if(!(o!=null&&o.length)){Toastify({text:"Product already archived",duration:2500,backgroundColor:"#f39c12"}).showToast(),this.allProducts=this.allProducts.filter(d=>d.productid!==t.productid),this.render(this.allProducts);return}this.allProducts=this.allProducts.filter(d=>d.productid!==t.productid),this.render(this.allProducts),Toastify({text:"Product archived",duration:3e3,backgroundColor:"#f39c12"}).showToast()}catch(e){console.error("Archive product error:",e),Toastify({text:`Error archiving product: ${e.message||"Unknown error"}`,duration:4e3,backgroundColor:"#e74c3c"}).showToast()}})()}},openAddToSalesModal(a,t="sale"){const e=this.allProducts.find(x=>x.productid===a);if(!e)return;const i=t==="edit"?"edit":"sale",o=i==="sale"?"sale":"product",s=i==="edit";if(window.isProductModalOpen){const x=document.getElementById("master-product-form");x&&x.dataset.productId!==e.productid&&(x.dataset.productId="")}let d=document.getElementById("add-product-modal-css");d||(d=document.createElement("link"),d.id="add-product-modal-css",d.rel="stylesheet",d.href="/assets/components/add-product-modal.css",d.dataset.dynamic="true",document.head.appendChild(d)),document.getElementById("product-modal-overlay")||loadComponent("product-modal-container","/assets/components/add-product-modal.html");const r=document.getElementById("product-modal-overlay"),l=r==null?void 0:r.querySelector(".master-terminal-container"),c=document.getElementById("master-product-form");if(!r||!c||!l)return;const p=document.getElementById("master-asset-id"),y=document.getElementById("master-name"),w=document.getElementById("master-price"),g=document.getElementById("master-qty"),h=document.getElementById("master-unlimited"),E=document.getElementById("master-brand"),T=document.getElementById("master-desc"),v=document.getElementById("imageContainer"),k=document.getElementById("status");if(!p||!y||!w||!g)return;const R=c.dataset.productId,O=c.dataset.modalAction||"";if(R!==e.productid||O!==i||!y.value||!p.value||!w.value){if(p.value=stripSkuPrefix(e.sku||""),y.value=e.name||"",w.value=e.price||0,o==="sale")h&&(h.checked=!1),g.value=1,g.disabled=!1,g.required=!0,g.placeholder="0";else{const x=Number(e.qty)>=999999;h&&(h.checked=x),x?(g.value="",g.disabled=!0,g.required=!1,g.placeholder="UNLIMITED"):(g.value=Number(e.qty||0),g.disabled=!1,g.required=!0,g.placeholder="0")}if(E&&(E.value=e.brand||""),T&&(T.value=e.description||""),v)if(v.innerHTML="",e.image_url){const x=document.createElement("img");x.src=e.image_url,x.alt=e.name||"Product",x.classList.add("selected"),x.dataset.selected="true",v.appendChild(x),c.dataset.selectedImageUrl=e.image_url,k&&(k.textContent="Using saved product image.")}else k&&(c.dataset.selectedImageUrl="",k.textContent="")}c.dataset.productId=e.productid,c.dataset.submitMode=o,c.dataset.editMode=s?"true":"false",c.dataset.modalAction=i,setProductModalMode(o),setProductModalEditState(s),p&&(p.readOnly=!0,p.disabled=!1),!window.isProductModalOpen&&(window.isProductModalOpen=!0,r.style.display="flex",r.style.opacity="1",r.classList.remove("is-closing"),r.classList.add("is-open"),l.classList.remove("modal-closing"),l.classList.add("modal-open"))},toggleFlip(a){const t=document.getElementById(`prod-${a}`);t&&t.classList.toggle("is-flipped")},setupUIListeners(){const a=document.getElementById("product-main-view")||document,t=a.querySelector("#products-list");t&&t.addEventListener("click",r=>{var g,h,E,T;const l=r.target.closest(".product-card");if(!l)return;const c=l.getAttribute("data-product-id");if(r.target.closest(".btn-edit-product")){r.stopPropagation(),(g=this.edit)==null||g.call(this,c);return}if(r.target.closest(".btn-delete-product")){r.stopPropagation(),(h=this.delete)==null||h.call(this,c);return}if(r.target.closest(".btn-add-sale")){r.stopPropagation(),(E=this.openAddToSalesModal)==null||E.call(this,c);return}(T=this.toggleFlip)==null||T.call(this,c)});const e=a.querySelector("#toggle-search-btn"),i=a.querySelector("#ledger-search-container"),o=a.querySelector("#product-main-search"),s=a.querySelector("#search-clear-btn"),d=a.querySelector("#btn-view-trash");d&&(d.onclick=()=>{var r;return(r=this.switchToTrash)==null?void 0:r.call(this)}),e&&i&&o&&(e.onclick=r=>{var l;r.preventDefault(),r.stopPropagation(),e.classList.toggle("active"),i.classList.toggle("active"),i.classList.contains("active")?o.focus():(o.value="",s&&(s.style.display="none"),(l=this.render)==null||l.call(this,this.allProducts||[]))}),o&&(o.oninput=r=>{var y;const l=(r.target.value||"").toLowerCase();s&&(s.style.display=l.length>0?"block":"none");const p=(this.allProducts||[]).filter(w=>w.name&&w.name.toLowerCase().includes(l)||w.sku&&w.sku.toLowerCase().includes(l));(y=this.render)==null||y.call(this,p)}),s&&o&&(s.onclick=()=>{var r;o.value="",s.style.display="none",(r=this.render)==null||r.call(this,this.allProducts||[])})}};
