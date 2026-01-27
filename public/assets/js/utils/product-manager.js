/**
 * WOLF OS - PRODUCT MANAGER (INJECTION FIXED)
 */
const ProductManager = {
  allProducts: [],

  async init() {
    console.log('Wolf OS: Product Manager Initializing...');
    this.injectStyles(); // <--- FORCE CSS INJECTION
    this.setupUIListeners();
    await this.fetchProducts();
  },

  injectStyles() {
    const styleId = 'wolf-product-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      #product-main-view { padding: 20px; max-width: 1200px; margin: 0 auto; }
      
      /* --- 1. SEARCH BAR REFINEMENT --- */
      .search-engine-wrapper.active .search-inner {
        background: rgba(20, 20, 20, 0.6) !important;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(166, 52, 41, 0.2) !important;
        border-radius: 14px;
        padding: 10px 15px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      }
      .search-inner input { color: #fff !important; font-weight: 600; }
      .search-inner i { color: rgba(166, 52, 41, 0.8) !important; }

      /* --- 2. CARD ACTION BUTTONS (TOP RIGHT) --- */
      .card-actions-top {
        position: absolute;
        top: 15px;
        right: 15px;
        display: flex;
        gap: 8px;
        z-index: 20;
      }
      .card-actions-top button {
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: 0.3s;
      }
      .card-actions-top button:hover {
        background: #a63429;
        border-color: #ff4d4d;
        transform: scale(1.1);
      }

      /* --- 3. STOCK BADGE (TOP LEFT) --- */
      .stock-badge {
        position: absolute;
        top: 15px;
        left: 15px;
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1px;
        text-transform: uppercase;
        z-index: 10;
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .status-critical { background: rgba(166, 52, 41, 0.3); color: #ff4d4d; border-color: #a63429; }
      .status-good { background: rgba(40, 167, 69, 0.3); color: #4ade80; border-color: #28a745; }

      /* --- 4. PRODUCT VISUALS --- */
      .product-visual {
        width: 100%;
        height: 160px;
        background: #151515;
        border-radius: 16px;
        margin-bottom: 20px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,0.05);
        box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
      }
      .product-visual img { width: 100%; height: 100%; object-fit: cover; opacity: 0.7; }
      
      /* --- 5. INFO SECTION --- */
      .info-group label { color: #a63429; font-size: 9px; font-weight: 900; letter-spacing: 1px; }
      .info-group .value { color: #fff; font-size: 15px; font-weight: 800; font-style: italic; }
      .price-tag { font-size: 1.8rem; font-weight: 900; color: #fff; font-style: italic; letter-spacing: -1px; text-shadow: 0 0 10px rgba(255,255,255,0.2); }
      
      /* --- 6. SHIMMER SKELETON --- */
      .skel-card { height: 380px; background: rgba(255,255,255,0.02); border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; }
      .skel-shimmer-bar { position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent); animation: skel-loading 1.5s infinite linear; }
      @keyframes skel-loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    `;
    document.head.appendChild(style);
  },

  getSkeleton() {
    return Array(6)
      .fill(0)
      .map(
        () => `
      <div class="col-12 col-md-6 col-xl-4 opacity-50">
        <div class="hud-item" style="height: 350px;">
          <div class="skel-shimmer" style="height: 150px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 20px;"></div>
          <div class="skel-shimmer" style="width: 70%; height: 20px; background: rgba(255,255,255,0.05); margin-bottom: 10px;"></div>
          <div class="skel-shimmer" style="width: 40%; height: 15px; background: rgba(255,255,255,0.05);"></div>
        </div>
      </div>
    `,
      )
      .join('');
  },

  async fetchProducts() {
    const list = document.getElementById('products-list');
    if (list) list.innerHTML = this.getSkeleton();

    try {
      const { data, error } = await window.supabaseClient
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      this.allProducts = data;

      // Update Counts
      document.getElementById('total-products-count').innerText = data.length;
      document.getElementById('low-stock-count').innerText = data.filter(
        (p) => p.qty <= 5,
      ).length;
      const totalVal = data.reduce((acc, p) => acc + p.price * p.qty, 0);
      document.getElementById('total-inventory-value').innerText =
        `₱${totalVal.toLocaleString()}`;

      this.render(data);
    } catch (err) {
      console.error('Inventory Error:', err);
    }
  },

  render(list) {
    const container = document.getElementById('products-list');
    if (!container) return;

    container.innerHTML = list
      .map((p, index) => {
        const stockStatus = p.qty <= 5 ? 'status-critical' : 'status-good';
        const stockLabel = p.qty <= 5 ? 'LOW_STOCK' : 'IN_STOCK';

        return `
        <div class="col-12 col-md-6 col-xl-4 animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.05}s">
          <div class="product-card-scene">
            <div class="product-card" id="prod-${p.productid}" onclick="ProductManager.toggleFlip('${p.productid}')">
              
              <!-- FRONT FACE -->
              <div class="card-face card-front">
                <!-- TOP LEFT: BADGE -->
                <div class="stock-badge ${stockStatus}">${stockLabel}</div>

                <!-- TOP RIGHT: ACTIONS -->
                <div class="card-actions-top">
                    <button onclick="event.stopPropagation(); ProductManager.edit('${p.productid}')" title="Edit">
                        <i class="bx bx-edit-alt"></i>
                    </button>
                    <button onclick="event.stopPropagation(); ProductManager.delete('${p.productid}')" title="Archive">
                        <i class="bx bx-trash"></i>
                    </button>
                </div>

                <!-- PRODUCT IMAGE -->
                <div class="product-visual">
                  <img src="${p.image_url || '/assets/images/placeholder.png'}" alt="Product Preview">
                </div>

                <!-- INFO GRID -->
                <div class="info-section">
                  <div class="info-group">
                    <label>PRODUCT NAME</label>
                    <div class="value text-truncate">${p.name.toUpperCase()}</div>
                  </div>
                  
                  <div class="d-flex justify-content-between align-items-end mt-2">
                    <div class="info-group">
                      <label>SKU IDENTIFIER</label>
                      <div class="value small" style="font-family:monospace; color: #666;">${p.sku}</div>
                    </div>
                    <div class="price-tag">₱${parseFloat(p.price).toLocaleString()}</div>
                  </div>
                </div>

                <!-- FOOTER -->
                <div class="card-footer mt-auto pt-3">
                   <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; font-weight: 900; color: #444;">
                      <span>STOCK_LEVEL: ${p.qty} UNITS</span>
                      <span>CLICK_TO_MANAGE</span>
                   </div>
                </div>
              </div>

              <!-- BACK FACE -->
              <div class="card-face card-back">
                <div class="back-header">MANAGEMENT - ${p.sku}</div>
                <!-- Controls for stock adjustment go here -->
                <div class="back-footer">REVERSE_INTERFACE_EXIT</div>
              </div>

            </div>
          </div>
        </div>`;
      })
      .join('');
  },

  toggleFlip(id) {
    const card = document.getElementById(`prod-${id}`);
    if (card) card.classList.toggle('is-flipped');
  },

  setupUIListeners() {
    const search = document.getElementById('product-main-search');
    if (search) {
      search.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = this.allProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term),
        );
        this.render(filtered);
      };
    }
  },
};
