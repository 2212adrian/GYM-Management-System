/**
 * WOLF OS - PRODUCT MANAGER
 */

let isProductModalOpen = false;

/* ========= TOAST VALIDATION ========= */
function showValidationError(message) {
  Toastify({
    text: message.toUpperCase(),
    duration: 2800,
    gravity: 'top',
    position: 'right',
    style: {
      border: '1px solid #ff3b3b',
      background: '#0a0a0a',
      borderRadius: '12px',
      fontWeight: '900',
      fontFamily: 'JetBrains Mono, monospace',
      color: '#fff',
      boxShadow: '0 0 16px rgba(255, 59, 59, 0.4)',
    },
  }).showToast();
}

/* ========= BARCODE GENERATION (READONLY FIELD) ========= */
function generateBarcodeId() {
  const input = document.getElementById('master-asset-id');
  if (!input) return;
  const num = Math.floor(1000 + Math.random() * 9000); // 1000–9999
  input.value = String(num);
}

/* ========= MODAL OPEN/CLOSE WITH ANIMATION ========= */
function openProductModal() {
  const overlay = document.getElementById('product-modal-overlay');
  const container = overlay?.querySelector('.master-terminal-container');
  if (!overlay || !container) return;

  // 1) Dynamically add CSS if not present
  let modalCSS = document.getElementById('add-product-modal-css');
  if (!modalCSS) {
    modalCSS = document.createElement('link');
    modalCSS.id = 'add-product-modal-css';
    modalCSS.rel = 'stylesheet';
    modalCSS.href = '/assets/components/add-product-modal.css';
    modalCSS.dataset.dynamic = 'true'; // mark it as dynamic
    document.head.appendChild(modalCSS);
  }

  // 2) Mount HTML (optional)
  loadComponent(
    'product-modal-container',
    '/assets/components/add-product-modal.html',
  );

  // 3) Open overlay
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
  overlay.classList.remove('is-closing');
  overlay.classList.add('is-open');

  container.classList.remove('modal-closing');
  container.classList.add('modal-open');

  window.isProductModalOpen = true;
  generateBarcodeId();
}

function closeProductModal() {
  const overlay = document.getElementById('product-modal-overlay');
  const container = overlay?.querySelector('.master-terminal-container');
  if (!overlay || !container || !window.isProductModalOpen) return;

  window.isProductModalOpen = false;

  // Clear form fields
  const formElements = [
    'master-asset-id',
    'master-name',
    'master-price',
    'master-qty',
    'master-brand',
    'master-desc',
  ];
  formElements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const imgBox = document.getElementById('imageContainer');
  const statusEl = document.getElementById('status');
  if (imgBox) imgBox.innerHTML = '';
  if (statusEl) statusEl.textContent = '';
  // Reset dataset so next open re-prefills
  const form = document.getElementById('master-product-form');
  if (form) form.dataset.productId = '';

  // Outro animation
  container.classList.remove('modal-open');
  container.classList.add('modal-closing');
  overlay.classList.add('is-closing');

  setTimeout(() => {
    container.classList.remove('modal-closing');
    overlay.classList.remove('is-closing', 'is-open');
    overlay.style.display = 'none';
    overlay.style.opacity = '0';

    // Remove dynamically added CSS
    const modalCSS = document.querySelector(
      '#add-product-modal-css[data-dynamic="true"]',
    );
    if (modalCSS) modalCSS.remove();
  }, 220);
}

/* ========= FORM VALIDATION (HIGHLIGHT + SHAKE) ========= */
function validateProductForm() {
  const nameInput = document.getElementById('master-name');
  const priceInput = document.getElementById('master-price');
  const qtyInput = document.getElementById('master-qty');
  const barcodeInput = document.getElementById('master-asset-id');

  const required = [nameInput, priceInput, qtyInput, barcodeInput];
  let firstInvalid = null;

  required.forEach((el) => {
    if (!el) return;
    el.classList.remove('field-error');
    if (!el.value || el.value.trim() === '') {
      el.classList.add('field-error');
      if (!firstInvalid) firstInvalid = el;
    }
  });

  if (firstInvalid) {
    showValidationError('Please fill all required product details.');
    firstInvalid.focus();
    // allow shake to re-trigger next submit
    setTimeout(() => firstInvalid.classList.remove('field-error'), 350);
    return false;
  }

  return true;
}

/* ========= GLOBAL CLICK HANDLERS FOR MODAL & DICE ========= */
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('product-modal-overlay');

  // Dice: randomize barcode
  const diceBtn = e.target.closest('#roll-barcode-btn');
  if (diceBtn) {
    e.preventDefault();
    generateBarcodeId();
    return;
  }

  // Add Product button (header)
  const addProductBtn = e.target.closest('#btn-add-product');
  if (addProductBtn) {
    e.preventDefault();
    e.stopPropagation();
    openProductModal();
    return;
  }

  // Close button
  if (e.target.closest('#closeProductModal')) {
    e.preventDefault();
    e.stopPropagation();
    closeProductModal();
    return;
  }

  // Click outside modal
  if (overlay && e.target === overlay) {
    closeProductModal();
    return;
  }

  // Optional details toggle
  const toggleBar = e.target.closest('.optional-toggle-bar');
  if (toggleBar) {
    const box = toggleBar.closest('.optional-protocol-box');
    if (!box) return;
    const isExpanded = box.classList.contains('is-expanded');
    box.classList.toggle('is-expanded', !isExpanded);
    box.classList.toggle('is-collapsed', isExpanded);
    return;
  }
});

/* ========= PRODUCT MANAGER ========= */
const ProductManager = {
  allProducts: [],

  async init() {
    console.log('Wolf OS: Product Manager Initializing...');
    this.injectStyles?.();

    // 1) Inject modal HTML
    await this.loadAddProductModal();

    // 2) Wire modal internals (lookup, images, submit)
    this.setupAddProductModalLogic();

    // 3) Cards + search + trash toggle
    this.setupUIListeners();

    // 4) Fetch products
    await this.fetchProducts();
  },

  async loadAddProductModal() {
    const host = document.getElementById('wolf-layout') || document.body;
    let container = document.getElementById('add-product-modal-host');
    if (!container) {
      container = document.createElement('div');
      container.id = 'add-product-modal-host';
      host.appendChild(container);
    }

    try {
      const res = await fetch('/assets/components/add-product-modal.html');
      if (!res.ok) throw new Error('Failed to load add-product-modal.html');
      container.innerHTML = WOLF_PURIFIER(await res.text());
    } catch (err) {
      console.error('Add Product Modal Load Error:', err);
    }
  },

  setupAddProductModalLogic() {
    const modal = document.getElementById('product-modal-overlay');
    const form = document.getElementById('master-product-form');
    if (!modal || !form) return;

    const imgBox = document.getElementById('imageContainer');
    const statusEl = document.getElementById('status');
    const closeBtn = document.getElementById('closeProductModal');
    const qtyInput = document.getElementById('master-qty');
    const unlimitedCheckbox = document.getElementById('master-unlimited');
    const priceInput = document.getElementById('master-price');
    const nameInput = document.getElementById('master-name');
    const skuInput = document.getElementById('master-asset-id');
    const lookupInput = document.getElementById('lookup-input');
    const lookupBtn = document.getElementById('lookupBtn');
    const PIXABAY_KEY = '54360015-81e98130630ae3ed1faf5a9b9';
    let selectedImageUrl = null;

    /* --- internal helpers --- */
    function resetImageSelection() {
      selectedImageUrl = null;
      if (imgBox) imgBox.innerHTML = '';
      if (statusEl) statusEl.textContent = '';
    }

    async function fetchPixabayImages(query) {
      resetImageSelection();
      if (statusEl) statusEl.textContent = 'Searching images on Pixabay...';

      const res = await fetch(
        `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(
          query,
        )}&image_type=photo&per_page=4`,
      );
      const data = await res.json();

      if (!imgBox) return;
      imgBox.innerHTML = '';

      if (data.hits && data.hits.length > 0) {
        data.hits.forEach((photo) => {
          const img = document.createElement('img');
          img.src = photo.webformatURL;
          img.alt = query;
          imgBox.appendChild(img);
        });
        if (statusEl) statusEl.textContent = 'Click an image to select it.';
      } else {
        if (statusEl) statusEl.textContent = 'No images found for this query.';
      }
    }

    async function searchBarcode(barcode) {
      resetImageSelection();
      if (statusEl)
        statusEl.textContent = 'Fetching product info from barcode...';

      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      );
      const data = await res.json();

      const productNameEl = document.getElementById('master-name');
      const productBrandEl = document.getElementById('master-brand');

      if (data.status === 1) {
        const product = data.product;
        if (productNameEl) productNameEl.value = product.product_name || '';
        if (productBrandEl) productBrandEl.value = product.brands || '';
        if (statusEl) statusEl.textContent = 'Product info found!';

        if (product.image_url && imgBox) {
          const img = document.createElement('img');
          img.src = product.image_url;
          img.alt = product.product_name || 'Product Image';
          img.classList.add('selected');
          img.dataset.selected = 'true';
          imgBox.appendChild(img);
          selectedImageUrl = img.src;
        }
      } else {
        if (statusEl)
          statusEl.textContent = 'Product not found with this barcode.';
      }
    }

    function handleLookup() {
      if (!lookupInput) return;
      const value = lookupInput.value.trim();
      if (!value) return;

      const firstChar = value.charAt(0);
      if (/\d/.test(firstChar)) {
        // treat as barcode
        if (skuInput) skuInput.value = value;
        searchBarcode(value);
      } else {
        // treat as name
        if (nameInput) nameInput.value = value;
        fetchPixabayImages(value);
      }
    }

    /* --- qty unlimited toggle --- */
    if (qtyInput && unlimitedCheckbox) {
      unlimitedCheckbox.addEventListener('change', () => {
        if (unlimitedCheckbox.checked) {
          qtyInput.value = '';
          qtyInput.disabled = true;
          qtyInput.placeholder = 'UNLIMITED';
        } else {
          qtyInput.disabled = false;
          qtyInput.placeholder = '0';
        }
      });
    }

    /* --- image selection click --- */
    if (imgBox) {
      imgBox.addEventListener('click', (e) => {
        const img = e.target.closest('img');
        if (!img) return;

        imgBox.querySelectorAll('img').forEach((node) => {
          node.classList.remove('selected');
          node.dataset.selected = 'false';
        });

        img.classList.add('selected');
        img.dataset.selected = 'true';
        selectedImageUrl = img.src;
        if (statusEl) statusEl.textContent = 'Image selected.';
      });
    }

    /* --- lookup button + Enter --- */
    if (lookupBtn && lookupInput) {
      lookupBtn.addEventListener('click', handleLookup);
      lookupInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLookup();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeProductModal();
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeProductModal();
      }
    });

    /* --- FORM SUBMIT: validate + Supabase --- */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateProductForm()) return;

      const sku = (skuInput?.value || '').trim();
      const name = (nameInput?.value || '').trim();
      const price = parseFloat(priceInput?.value || '0');
      const qty = unlimitedCheckbox?.checked
        ? 999999
        : parseInt(qtyInput?.value || '0', 10);
      const desc =
        document.getElementById('master-desc')?.value?.trim() || null;
      const brand =
        document.getElementById('master-brand')?.value?.trim() || null;

      if (!sku && !selectedImageUrl) {
        showValidationError(
          'Please select one image or barcode before adding.',
        );
        return;
      }

      try {
        const productIdFromForm = form.dataset.productId || null;
        let finalProductId = productIdFromForm;
        let productRow = null;

        // 1) Ensure product exists (or create)
        if (!finalProductId) {
          const { data, error } = await supabaseClient
            .from('products')
            .insert({
              sku: sku || undefined,
              name,
              description: desc,
              brand,
              price,
              qty,
              image_url: selectedImageUrl || null,
              is_active: true,
            })
            .select()
            .single();
          if (error) throw error;
          productRow = data;
          finalProductId = data.productid;
        }

        // 2) Insert into sales
        const { data: sale, error: saleErr } = await supabaseClient
          .from('sales')
          .insert({
            product_id: finalProductId,
            qty,
            unit_price: price,
          })
          .select()
          .single();
        if (saleErr) throw saleErr;

        // 3) Update ledger UI
        if (
          window.wolfData &&
          typeof window.wolfData.addSaleRow === 'function'
        ) {
          window.wolfData.addSaleRow(sale);
        }

        // 4) Refresh products list
        if (typeof ProductManager.fetchProducts === 'function') {
          ProductManager.fetchProducts();
        }

        Toastify({
          text: `PRODUCT ADDED: ${name.toUpperCase()} x${qty}`,
          duration: 2500,
          gravity: 'top',
          position: 'right',
          style: {
            border: '1px solid #77ff00',
            background: '#0a0a0a',
            borderRadius: '12px',
            fontWeight: '900',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#fff',
          },
        }).showToast();

        closeProductModal();
      } catch (err) {
        console.error('Add to sale error:', err);
        Toastify({
          text: `Error adding sale: ${err.message || JSON.stringify(err)}`,
          duration: 4000,
          gravity: 'top',
          position: 'right',
          style: {
            border: '1px solid #ff3b3b',
            background: '#0a0a0a',
            borderRadius: '12px',
            fontWeight: '900',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#fff',
          },
        }).showToast();
        if (statusEl) statusEl.textContent = 'Error adding product/sale.';
      }
    });
  },

  setupUIListeners() {
    const container = document.getElementById('products-list');
    if (container) {
      container.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        const productId = card.getAttribute('data-product-id');

        const editBtn = e.target.closest('.btn-edit-product');
        if (editBtn) {
          e.stopPropagation();
          this.edit?.(productId);
          return;
        }

        const deleteBtn = e.target.closest('.btn-delete-product');
        if (deleteBtn) {
          e.stopPropagation();
          this.delete?.(productId);
          return;
        }

        const addSaleBtn = e.target.closest('.btn-add-sale');
        if (addSaleBtn) {
          e.stopPropagation();
          this.openAddToSalesModal?.(productId);
          return;
        }

        this.toggleFlip?.(productId);
      });
    }
  },

  injectStyles() {
    const styleId = 'wolf-product-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
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
    border: 1px solid rgba(166, 52, 41, 0.35) !important;
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
    color: rgba(166, 52, 41, 0.9) !important;
    transition: transform 0.25s ease, color 0.25s ease;
  }
  .search-inner:focus-within i {
    transform: scale(1.15);
    color: #ff6b5f !important;
  }

  /* ===== PRODUCT CARD SCENE / CARD ===== */
  .product-card-scene {
    perspective: 1200px;
  }

  .product-card {
    position: relative;
    transform-style: preserve-3d;
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

  .product-card.is-flipped {
    transform: rotateY(180deg);
  }

  .card-face {
    position: relative;
    backface-visibility: hidden;
    min-height: 320px;
    padding: 18px 18px 16px;
    display: flex;
    flex-direction: column;
  }

  .card-face.card-back {
    transform: rotateY(180deg);
    background: radial-gradient(circle at bottom right, #161616, #000);
  }

  /* ===== CARD ACTION BUTTONS ===== */
  .card-actions-top {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 6px;
    z-index: 20;
  }

  .card-actions-top button {
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

  .card-actions-top button:hover {
    background: radial-gradient(circle at top left, #a63429, #420f0a);
    border-color: #ff7b6a;
    color: #fff;
    transform: translateY(-2px) scale(1.08);
    box-shadow: 0 10px 20px rgba(0,0,0,0.85);
  }

  .card-actions-top button:active {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 3px 8px rgba(0,0,0,0.7);
  }

  /* ===== STOCK BADGE ===== */
  .stock-badge {
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

  .stock-badge::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 12px currentColor;
    animation: stockPulse 1.5s infinite;
  }

  .status-critical {
    color: #ff6b6b;
    background: linear-gradient(
      135deg,
      rgba(166, 52, 41, 0.7),
      rgba(30, 0, 0, 0.8)
    );
  }

  .status-good {
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
  .info-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .info-group label {
    color: #a63429;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .info-group .value {
    color: #fff;
    font-size: 15px;
    font-weight: 800;
    font-style: italic;
  }

  .price-tag {
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
  .card-footer {
    margin-top: auto;
  }

  .card-footer-inner {
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

  .card-footer-inner span:last-child {
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
    box-shadow: 0 0 12px rgba(166,52,41,0.9);
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
    box-shadow: 0 0 18px rgba(166, 52, 41, 0.35);
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
    box-shadow: 0 0 12px rgba(166,52,41,0.7);
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
    background: radial-gradient(circle at top left, rgba(166,52,41,0.2), #050505);
    border-color: var(--wolf-red);
    color: var(--wolf-red);
    box-shadow: 0 0 18px rgba(166, 52, 41, 0.4);
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
    box-shadow: 0 0 18px rgba(166, 52, 41, 0.7);
  }

  .terminal-close-btn:active {
    transform: rotate(90deg) scale(0.95);
    box-shadow: 0 0 8px rgba(166, 52, 41, 0.4);
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

  @media (min-width: 768px) {
    .master-terminal-container { max-width: 600px; }
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
      0 16px 36px rgba(166, 52, 41, 0.5),
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
      0 20px 40px rgba(166, 52, 41, 0.7),
      0 0 0 1px rgba(255,255,255,0.12);
  }

  .btn-terminal-commit:active {
    transform: translateY(1px) scale(0.98);
    box-shadow:
      0 10px 20px rgba(166, 52, 41, 0.5),
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
    box-shadow: 0 0 16px rgba(166, 52, 41, 0.7);
  }

  .status {
    font-size: 12px;
    opacity: 0.8;
    margin-top: 4px;
  }
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

      const totalCountEl = document.getElementById('total-products-count');
      const lowStockEl = document.getElementById('low-stock-count');
      const totalValEl = document.getElementById('total-inventory-value');

      if (totalCountEl) totalCountEl.innerText = data.length;
      if (lowStockEl) {
        lowStockEl.innerText = data.filter((p) => p.qty <= 5).length;
      }

      // Ignore "unlimited" qty (e.g. 999999) in total inventory value
      const totalVal = data.reduce((acc, p) => {
        const price = Number(p.price) || 0;
        const qty = Number(p.qty) || 0;

        // Treat sentinel (unlimited) as not counted
        if (qty >= 999999) return acc;

        return acc + price * qty;
      }, 0);

      if (totalValEl) {
        totalValEl.innerText = `₱${totalVal.toLocaleString()}`;
      }

      this.render(data);
    } catch (err) {
      console.error('Inventory Error:', err);
    }
  },

  /* --- RENDER LOGIC (with corrected call site) --- */
  render(list) {
    const container = document.getElementById('products-list');
    if (!container) return;

    container.innerHTML = list
      .map((p, index) => {
        const stockStatus = p.qty <= 5 ? 'status-critical' : 'status-good';
        const stockLabel = p.qty <= 5 ? 'LOW_STOCK' : 'IN_STOCK';
        const priceText = Number(p.price || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        return `
            <div class="col-12 col-md-6 col-xl-4 animate__animated animate__fadeInUp"
                 style="animation-delay: ${index * 0.05}s">
             <div class="product-card-scene">
                <div class="product-card" id="prod-${p.productid}" data-product-id="${p.productid}">
                 
                <div class="card-face card-front">
                  <div class="stock-badge ${stockStatus}">${stockLabel}</div>

                  <div class="card-actions-top">
                    <button class="btn-edit-product" data-product-id="${p.productid}" title="Edit">
                      <i class="bx bx-edit-alt"></i>
                    </button>
                    <button class="btn-delete-product" data-product-id="${p.productid}" title="Archive">
                      <i class="bx bx-trash"></i>
                    </button>
                    <button
                      class="btn-add-sale"
                      data-product-id="${p.productid}"
                      title="Add to Sales">
                      <i class="bx bx-cart-add"></i>
                    </button>
                  </div>

                  <div class="product-visual">
                    <img src="${p.image_url || '/assets/images/placeholder.png'}" 
                         alt="Product Preview" 
                         data-product-name="${p.name || ''}"
                         data-product-id="${p.productid}">
                  </div>

                  <div class="info-section">
                    <div class="info-group">
                      <label>PRODUCT NAME</label>
                      <div class="value text-truncate">${(p.name || '').toUpperCase()}</div>
                    </div>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                      <div class="info-group">
                        <label>SKU IDENTIFIER</label>
                        <div class="value small" style="font-family:monospace; color:#666;">${p.sku || ''}</div>
                      </div>
                      <div class="price-tag">₱${priceText}</div>
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
                      <span>STOCK_LEVEL: ${p.qty} UNITS</span>
                      <span>CLICK_TO_MANAGE</span>
                    </div>
                  </div>
                </div>

                <div class="card-face card-back">
                  <div class="back-header">MANAGEMENT - ${p.sku || ''}</div>
                  <div class="back-footer">REVERSE_INTERFACE_EXIT</div>
                </div>

              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Initialize Pixabay API key
    window.PIXABAY_KEY = '54360015-81e98130630ae3ed1faf5a9b9';

    list.forEach((product) => {
      const card = document.getElementById(`prod-${product.productid}`);
      if (!card) return;

      const img = card.querySelector('img');
      if (!img) return;

      img.onerror = async () => {
        img.onerror = null; // prevent infinite loop

        try {
          const productName =
            img.dataset.productName || product.name || 'product';
          const searchQuery = encodeURIComponent(
            productName.replace(/[^\w\s]/g, '').trim(),
          );

          // Pixabay API call for product image
          const pixabayResponse = await fetch(
            `https://pixabay.com/api/?key=${window.PIXABAY_KEY}&q=${searchQuery}&image_type=photo&orientation=horizontal&per_page=3&safesearch=true`,
          );

          const pixabayData = await pixabayResponse.json();

          if (pixabayData.hits && pixabayData.hits.length > 0) {
            const newImageUrl = pixabayData.hits[0].webformatURL;

            // Update the image source
            img.src = newImageUrl;
            img.alt = `${productName} - Stock Photo`;

            // Update the product in Supabase
            const { error } = await supabaseClient
              .from('products')
              .update({ image_url: newImageUrl })
              .eq('productid', product.productid);

            if (error) {
              console.warn('Failed to update image_url in database:', error);
            } else {
              console.log(`✅ Updated image for ${productName}:`, newImageUrl);
              Toastify({
                text: `📸 New image for ${productName}`,
                duration: 2000,
                gravity: 'top',
                position: 'right',
                style: {
                  border: '1px solid #4CAF50',
                  background: '#0a0a0a',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#fff',
                },
              }).showToast();
            }
          } else {
            // Fallback to placeholder if no Pixabay results
            img.src = '/assets/images/placeholder.png';
            console.log(`No Pixabay images found for "${productName}"`);
          }
        } catch (error) {
          console.error('Pixabay API error:', error);
          img.src = '/assets/images/placeholder.png';

          Toastify({
            text: `Image fetch failed for ${product.name || 'product'}`,
            duration: 2500,
            gravity: 'top',
            position: 'right',
            style: {
              border: '1px solid #ff9800',
              background: '#0a0a0a',
              borderRadius: '8px',
              fontWeight: '700',
              fontFamily: 'JetBrains Mono, monospace',
              color: '#fff',
            },
          }).showToast();
        }
      };
    });
  },

  edit(productId) {
    console.log('Edit product', productId);
    // TODO: open edit modal / reuse same modal in edit mode
  },

  delete(productId) {
    const product = this.allProducts.find((p) => p.productid === productId);
    if (!product) return;

    if (!confirm(`Archive product "${product.name || ''}"?`)) return;

    (async () => {
      try {
        // 1) insert into trash_bin
        const { error: trashErr } = await window.supabaseClient
          .from('trash_bin')
          .insert({
            original_id: String(product.productid),
            table_name: 'products',
            deleted_data: product,
          });
        if (trashErr) throw trashErr;

        // 2) mark product inactive (or delete)
        const { error: delErr } = await window.supabaseClient
          .from('products')
          .update({ is_active: false })
          .eq('productid', product.productid);
        if (delErr) throw delErr;

        // 3) update local cache and re-render
        this.allProducts = this.allProducts.filter(
          (p) => p.productid !== product.productid,
        );
        this.render(this.allProducts);

        Toastify({
          text: 'Product archived',
          duration: 3000,
          backgroundColor: '#f39c12',
        }).showToast();
      } catch (err) {
        console.error('Archive product error:', err);
        Toastify({
          text: `Error archiving product: ${err.message || 'Unknown error'}`,
          duration: 4000,
          backgroundColor: '#e74c3c',
        }).showToast();
      }
    })();
  },

  openAddToSalesModal(productId) {
    const product = this.allProducts.find((p) => p.productid === productId);
    if (!product) return;

    // If modal is already open, do not re-inject HTML (prevents input wipe)
    if (window.isProductModalOpen) {
      const form = document.getElementById('master-product-form');
      if (form && form.dataset.productId !== product.productid) {
        form.dataset.productId = ''; // force refresh for different product
      } else {
        return;
      }
    }

    // 1) Dynamically add CSS if not present
    let modalCSS = document.getElementById('add-product-modal-css');
    if (!modalCSS) {
      modalCSS = document.createElement('link');
      modalCSS.id = 'add-product-modal-css';
      modalCSS.rel = 'stylesheet';
      modalCSS.href = '/assets/components/add-product-modal.css';
      modalCSS.dataset.dynamic = 'true'; // mark it as dynamic
      document.head.appendChild(modalCSS);
    }

    // 2) Mount HTML only if missing (avoid re-render wiping inputs)
    if (!document.getElementById('product-modal-overlay')) {
      loadComponent(
        'product-modal-container',
        '/assets/components/add-product-modal.html',
      );
    }

    const modal = document.getElementById('product-modal-overlay');
    const container = modal?.querySelector('.master-terminal-container');
    const form = document.getElementById('master-product-form');
    if (!modal || !form || !container) return;

    const skuInput = document.getElementById('master-asset-id');
    const nameInput = document.getElementById('master-name');
    const priceInput = document.getElementById('master-price');
    const qtyInput = document.getElementById('master-qty');
    const brandInput = document.getElementById('master-brand');
    const descInput = document.getElementById('master-desc');
    const imgBox = document.getElementById('imageContainer');
    const statusEl = document.getElementById('status');

    if (!skuInput || !nameInput || !priceInput || !qtyInput) return;

    const lastId = form.dataset.productId;
    const needsPrefill =
      lastId !== product.productid ||
      !nameInput.value ||
      !skuInput.value ||
      !priceInput.value;

    // Prefill if product changed or fields are empty
    if (needsPrefill) {
      skuInput.value = product.sku || '';
      nameInput.value = product.name || '';
      priceInput.value = product.price || 0;
      qtyInput.value = 1;
      if (brandInput) brandInput.value = product.brand || '';
      if (descInput) descInput.value = product.description || '';

      if (imgBox) {
        imgBox.innerHTML = '';
        if (product.image_url) {
          const img = document.createElement('img');
          img.src = product.image_url;
          img.alt = product.name || 'Product';
          img.classList.add('selected');
          img.dataset.selected = 'true';
          imgBox.appendChild(img);
          if (statusEl) statusEl.textContent = 'Using saved product image.';
        } else if (statusEl) {
          statusEl.textContent = '';
        }
      }
    }

    // Track current product id
    form.dataset.productId = product.productid;

    // Match openProductModal behaviour
    if (skuInput) {
      skuInput.readOnly = true;
      skuInput.disabled = false;
    }

    if (window.isProductModalOpen) return;
    window.isProductModalOpen = true;

    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.classList.remove('is-closing');
    modal.classList.add('is-open');

    container.classList.remove('modal-closing');
    container.classList.add('modal-open');
  },

  toggleFlip(id) {
    const card = document.getElementById(`prod-${id}`);
    if (card) card.classList.toggle('is-flipped');
  },

  setupUIListeners() {
    // 1) Card actions inside products grid
    const container = document.getElementById('products-list');
    if (container) {
      container.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        const productId = card.getAttribute('data-product-id');

        const editBtn = e.target.closest('.btn-edit-product');
        if (editBtn) {
          e.stopPropagation();
          this.edit?.(productId);
          return;
        }

        const deleteBtn = e.target.closest('.btn-delete-product');
        if (deleteBtn) {
          e.stopPropagation();
          this.delete?.(productId);
          return;
        }

        const addSaleBtn = e.target.closest('.btn-add-sale');
        if (addSaleBtn) {
          e.stopPropagation();
          this.openAddToSalesModal?.(productId);
          return;
        }

        this.toggleFlip?.(productId);
      });
    }

    // 2) Search bar logic (Products page)
    const searchBtn = document.getElementById('toggle-search-btn');
    const searchContainer =
      document.getElementsByClassName('search-collapsible');
    const searchInput = document.getElementById('product-main-search');
    const clearBtn = document.getElementById('search-clear-btn');
    const trashBtn = document.getElementById('btn-view-trash');

    if (trashBtn) {
      trashBtn.onclick = () => this.switchToTrash?.();
    }

    if (searchBtn && searchContainer && searchInput) {
      searchBtn.onclick = () => {
        searchBtn.classList.toggle('active');
        searchContainer.classList.toggle('active');
        if (searchContainer.classList.contains('active')) {
          searchInput.focus();
        } else {
          // closing: reset search
          searchInput.value = '';
          if (clearBtn) clearBtn.style.display = 'none';
          this.render?.(this.allProducts || []);
        }
      };
    }

    if (searchInput) {
      searchInput.oninput = (e) => {
        const term = (e.target.value || '').toLowerCase();
        if (clearBtn) {
          clearBtn.style.display = term.length > 0 ? 'block' : 'none';
        }

        const source = this.allProducts || [];
        const filtered = source.filter(
          (p) =>
            (p.name && p.name.toLowerCase().includes(term)) ||
            (p.sku && p.sku.toLowerCase().includes(term)),
        );

        this.render?.(filtered);
      };
    }

    if (clearBtn && searchInput) {
      clearBtn.onclick = () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        this.render?.(this.allProducts || []);
      };
    }
  },
};
