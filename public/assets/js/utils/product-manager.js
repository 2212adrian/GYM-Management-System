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

function stripSkuPrefix(value) {
  return String(value || '')
    .trim()
    .replace(/^PR[-\s]*/i, '');
}

function ensureSkuPrefix(value) {
  const code = stripSkuPrefix(value).toUpperCase();
  return code ? `PR-${code}` : '';
}

function setProductModalMode(mode = 'product') {
  const normalizedMode = mode === 'sale' ? 'sale' : 'product';
  const form = document.getElementById('master-product-form');
  const submitBtn = form?.querySelector('.btn-terminal-commit');
  const titleSpan = document.querySelector('.terminal-title span');
  const protocolText = document.querySelector('.terminal-protocol');

  if (form) {
    form.dataset.submitMode = normalizedMode;
  }

  if (submitBtn) {
    submitBtn.textContent =
      normalizedMode === 'sale' ? 'ADD TO SALES' : 'ADD PRODUCT';
  }

  if (titleSpan) {
    titleSpan.textContent = normalizedMode === 'sale' ? 'SALES' : 'PRODUCT';
  }

  if (protocolText) {
    protocolText.textContent =
      normalizedMode === 'sale'
        ? 'QUICK SALES ENTRY - RECORDS TRANSACTION ONLY'
        : 'MANUAL PRODUCT ENTRY - ADDS TO INVENTORY ONLY';
  }
}

function setProductModalEditState(isEditing = false) {
  const form = document.getElementById('master-product-form');
  const submitBtn = form?.querySelector('.btn-terminal-commit');
  const protocolText = document.querySelector('.terminal-protocol');
  const titleSpan = document.querySelector('.terminal-title span');

  if (form) {
    form.dataset.editMode = isEditing ? 'true' : 'false';
  }

  if (isEditing) {
    if (submitBtn) submitBtn.textContent = 'SAVE CHANGES';
    if (titleSpan) titleSpan.textContent = 'PRODUCT';
    if (protocolText) {
      protocolText.textContent =
        'EDIT PRODUCT ENTRY - UPDATES INVENTORY RECORD';
    }
  } else {
    const currentMode =
      form?.dataset.submitMode === 'sale' ? 'sale' : 'product';
    setProductModalMode(currentMode);
  }
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

  // 2) Open overlay
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
  overlay.classList.remove('is-closing');
  overlay.classList.add('is-open');

  container.classList.remove('modal-closing');
  container.classList.add('modal-open');

  window.isProductModalOpen = true;
  setProductModalMode('product');
  setProductModalEditState(false);
  const form = document.getElementById('master-product-form');
  if (form) {
    form.dataset.selectedImageUrl = '';
    form.dataset.modalAction = 'create';
  }
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
  const unlimitedCheckbox = document.getElementById('master-unlimited');
  const qtyInput = document.getElementById('master-qty');
  if (unlimitedCheckbox) unlimitedCheckbox.checked = false;
  if (qtyInput) {
    qtyInput.disabled = false;
    qtyInput.required = true;
    qtyInput.placeholder = '0';
  }

  const imgBox = document.getElementById('imageContainer');
  const uploadImgBox = document.getElementById('uploadImageContainer');
  const uploadImageName = document.getElementById('upload-image-name');
  const uploadInput = document.getElementById('upload-image-input');
  const tabWeb = document.getElementById('image-tab-web');
  const tabUpload = document.getElementById('image-tab-upload');
  const panelWeb = document.getElementById('image-web-panel');
  const panelUpload = document.getElementById('image-upload-panel');
  const statusEl = document.getElementById('status');
  if (imgBox) imgBox.innerHTML = '';
  if (uploadImgBox) uploadImgBox.innerHTML = '';
  if (uploadImageName) uploadImageName.textContent = 'No file selected';
  if (uploadInput) uploadInput.value = '';
  if (tabWeb) tabWeb.classList.add('is-active');
  if (tabUpload) tabUpload.classList.remove('is-active');
  if (panelWeb) panelWeb.classList.add('is-active');
  if (panelUpload) panelUpload.classList.remove('is-active');
  if (statusEl) statusEl.textContent = '';
  // Reset dataset so next open re-prefills
  const form = document.getElementById('master-product-form');
  if (form) {
    form.dataset.productId = '';
    form.dataset.submitMode = 'product';
    form.dataset.editMode = 'false';
    form.dataset.selectedImageUrl = '';
    form.dataset.modalAction = 'create';
  }
  setProductModalMode('product');
  setProductModalEditState(false);

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
  const unlimitedCheckbox = document.getElementById('master-unlimited');

  const required = [nameInput, priceInput, barcodeInput];
  if (!unlimitedCheckbox?.checked) {
    required.push(qtyInput);
  }
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
  trashData: [],

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

    if (form.dataset.modalLogicBound === 'true') return;
    form.dataset.modalLogicBound = 'true';

    const imgBox = document.getElementById('imageContainer');
    const uploadImgBox = document.getElementById('uploadImageContainer');
    const statusEl = document.getElementById('status');
    const closeBtn = document.getElementById('closeProductModal');
    const qtyInput = document.getElementById('master-qty');
    const unlimitedCheckbox = document.getElementById('master-unlimited');
    const priceInput = document.getElementById('master-price');
    const nameInput = document.getElementById('master-name');
    const skuInput = document.getElementById('master-asset-id');
    const lookupInput = document.getElementById('lookup-input');
    const lookupBtn = document.getElementById('lookupBtn');
    const tabWeb = document.getElementById('image-tab-web');
    const tabUpload = document.getElementById('image-tab-upload');
    const panelWeb = document.getElementById('image-web-panel');
    const panelUpload = document.getElementById('image-upload-panel');
    const uploadInput = document.getElementById('upload-image-input');
    const uploadTrigger = document.getElementById('upload-image-trigger');
    const uploadImageAction = document.getElementById('upload-image-action');
    const uploadImageName = document.getElementById('upload-image-name');
    const submitBtn = form.querySelector('.btn-terminal-commit');
    const PIXABAY_KEY = '54360015-81e98130630ae3ed1faf5a9b9';
    const MAX_IMAGE_DATA_URL_LENGTH = 500000;
    let selectedImageUrl = null;

    if (!form.dataset.submitMode) {
      form.dataset.submitMode = 'product';
    }
    if (!form.dataset.editMode) {
      form.dataset.editMode = 'false';
    }
    if (!form.dataset.modalAction) {
      form.dataset.modalAction = 'create';
    }
    setProductModalMode(form.dataset.submitMode);
    setProductModalEditState(form.dataset.editMode === 'true');
    if (submitBtn) {
      submitBtn.disabled = false;
    }

    if (uploadInput) {
      uploadInput.setAttribute('accept', 'image/*');
      uploadInput.setAttribute('hidden', '');
    }

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text || '';
    }

    function clearContainer(container) {
      if (container) container.innerHTML = '';
    }

    function clearImageSelectionClasses() {
      [imgBox, uploadImgBox].forEach((container) => {
        if (!container) return;
        container.querySelectorAll('img').forEach((img) => {
          img.classList.remove('selected');
          img.dataset.selected = 'false';
        });
      });
    }

    function selectImage(img) {
      if (!img) return;
      clearImageSelectionClasses();
      img.classList.add('selected');
      img.dataset.selected = 'true';
      selectedImageUrl = img.src;
      form.dataset.selectedImageUrl = selectedImageUrl || '';
    }

    function activateImageTab(tabName) {
      const isWeb = tabName === 'web';
      if (tabWeb) tabWeb.classList.toggle('is-active', isWeb);
      if (tabUpload) tabUpload.classList.toggle('is-active', !isWeb);
      if (panelWeb) panelWeb.classList.toggle('is-active', isWeb);
      if (panelUpload) panelUpload.classList.toggle('is-active', !isWeb);
    }

    function appendImage(container, src, alt, options = {}) {
      if (!container || !src) return null;
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt || 'Product image';
      img.loading = 'lazy';
      img.decoding = 'async';
      container.appendChild(img);

      img.addEventListener('click', () => {
        selectImage(img);
        setStatus('Image selected.');
      });

      if (options.autoSelect) {
        selectImage(img);
      }

      return img;
    }

    function setUploadStateIdle() {
      if (uploadTrigger) uploadTrigger.classList.remove('is-selected');
      if (uploadImageAction)
        uploadImageAction.textContent = 'Attach Image File';
      if (uploadImageName) uploadImageName.textContent = 'No file selected';
      if (uploadInput) uploadInput.value = '';
    }

    function setUploadStateSelected(fileName) {
      if (uploadTrigger) uploadTrigger.classList.add('is-selected');
      if (uploadImageAction)
        uploadImageAction.textContent = 'Change Image File';
      if (uploadImageName)
        uploadImageName.textContent = fileName || 'Selected file';
    }

    function resetImageState() {
      selectedImageUrl = null;
      form.dataset.selectedImageUrl = '';
      clearContainer(imgBox);
      clearContainer(uploadImgBox);
      setUploadStateIdle();
      activateImageTab('web');
      setStatus('');
    }

    function isHttpUrl(value) {
      return /^https?:\/\/\S+/i.test(value || '');
    }

    async function optimizeImageFile(file) {
      const rawDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(new Error('Unable to read selected file.'));
        reader.readAsDataURL(file);
      });

      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Invalid image file.'));
        image.src = rawDataUrl;
      });

      const maxDimension = 900;
      const ratio = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * ratio));
      const height = Math.max(1, Math.round(img.height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Image processing is not supported on this device.');
      }

      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.86;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);

      while (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH && quality > 0.55) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        throw new Error('Image is too large. Please use a smaller file.');
      }

      return dataUrl;
    }

    async function fetchPixabayImages(query) {
      clearContainer(imgBox);
      clearContainer(uploadImgBox);
      setUploadStateIdle();
      selectedImageUrl = null;
      activateImageTab('web');
      setStatus('Searching images on Pixabay...');

      try {
        const res = await fetch(
          `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(
            query,
          )}&image_type=photo&per_page=4`,
        );

        if (!res.ok) {
          setStatus(
            res.status === 429
              ? 'Pixabay API limit reached.'
              : 'Unable to fetch images.',
          );
          return;
        }

        const data = await res.json();
        if (!data?.hits?.length) {
          setStatus('No images found for this query.');
          return;
        }

        data.hits.forEach((photo) => {
          appendImage(imgBox, photo.webformatURL, query);
        });

        setStatus('Click one image to select it.');
      } catch (err) {
        console.error('Pixabay lookup error:', err);
        setStatus('Image search failed.');
      }
    }

    async function searchBarcode(barcode) {
      clearContainer(imgBox);
      clearContainer(uploadImgBox);
      setUploadStateIdle();
      selectedImageUrl = null;
      activateImageTab('web');
      setStatus('Fetching product info from barcode...');

      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        );
        const data = await res.json();
        const brandInput = document.getElementById('master-brand');

        if (data.status !== 1) {
          setStatus('Product not found with this barcode.');
          return;
        }

        const product = data.product || {};
        if (nameInput) nameInput.value = product.product_name || '';
        if (brandInput) brandInput.value = product.brands || '';

        if (product.image_url) {
          appendImage(imgBox, product.image_url, product.product_name, {
            autoSelect: true,
          });
          setStatus('Barcode image attached and selected.');
        } else {
          setStatus('Product found. No image available.');
        }
      } catch (err) {
        console.error('Barcode lookup error:', err);
        setStatus('Barcode lookup failed.');
      }
    }

    function attachDirectImageUrl(url) {
      clearContainer(imgBox);
      clearContainer(uploadImgBox);
      setUploadStateIdle();
      selectedImageUrl = null;
      activateImageTab('web');

      const img = appendImage(imgBox, url, 'Linked image', {
        autoSelect: true,
      });
      if (!img) {
        setStatus('Unable to attach image link.');
        return;
      }

      img.addEventListener('error', () => {
        if (selectedImageUrl === url) selectedImageUrl = null;
        setStatus('Image link could not be loaded.');
      });

      setStatus('Image link detected. Attached and selected.');
    }

    function handleLookup() {
      if (!lookupInput) return;
      const value = lookupInput.value.trim();
      if (!value) return;

      if (isHttpUrl(value)) {
        if (nameInput) nameInput.value = '';
        attachDirectImageUrl(value);
        return;
      }

      if (/^\d/.test(value.charAt(0))) {
        if (skuInput) {
          skuInput.value = stripSkuPrefix(value).slice(0, 32);
        }
        searchBarcode(value);
        return;
      }

      if (nameInput) nameInput.value = value;
      fetchPixabayImages(value);
    }

    function applyUnlimitedState() {
      if (!qtyInput || !unlimitedCheckbox) return;
      if (unlimitedCheckbox.checked) {
        qtyInput.value = '';
        qtyInput.disabled = true;
        qtyInput.required = false;
        qtyInput.placeholder = 'UNLIMITED';
      } else {
        qtyInput.disabled = false;
        qtyInput.required = true;
        qtyInput.placeholder = '0';
      }
    }

    if (qtyInput && unlimitedCheckbox) {
      unlimitedCheckbox.addEventListener('change', applyUnlimitedState);
      applyUnlimitedState();
    }

    [imgBox, uploadImgBox].forEach((container) => {
      if (!container) return;
      container.addEventListener('click', (e) => {
        const img = e.target.closest('img');
        if (!img) return;
        selectImage(img);
        setStatus('Image selected.');
      });
    });

    if (lookupBtn && lookupInput) {
      lookupBtn.addEventListener('click', handleLookup);
      lookupInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLookup();
        }
      });
    }

    if (tabWeb) {
      tabWeb.addEventListener('click', () => {
        activateImageTab('web');
      });
    }

    if (tabUpload) {
      tabUpload.addEventListener('click', () => {
        activateImageTab('upload');
      });
    }

    if (uploadTrigger && uploadInput) {
      uploadTrigger.addEventListener('click', () => uploadInput.click());
      uploadTrigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          uploadInput.click();
        }
      });
    }

    if (uploadInput) {
      uploadInput.addEventListener('change', async () => {
        const file = uploadInput.files?.[0];
        if (!file) return;

        if (!String(file.type || '').startsWith('image/')) {
          showValidationError('Please select a valid image file.');
          setUploadStateIdle();
          return;
        }

        activateImageTab('upload');
        setStatus('Processing image file...');

        try {
          const dataUrl = await optimizeImageFile(file);
          clearContainer(uploadImgBox);
          clearContainer(imgBox);
          appendImage(uploadImgBox, dataUrl, file.name, { autoSelect: true });
          setUploadStateSelected(file.name);
          setStatus('Attached image file selected.');
        } catch (err) {
          console.error('Upload image processing error:', err);
          selectedImageUrl = null;
          clearContainer(uploadImgBox);
          setUploadStateIdle();
          setStatus(err.message || 'Unable to process image file.');
          showValidationError(err.message || 'Unable to process image file.');
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetImageState();
        closeProductModal();
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        resetImageState();
        closeProductModal();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (submitBtn?.disabled) return;

      if (!validateProductForm()) return;

      const skuCode = stripSkuPrefix(skuInput?.value || '');
      const sku = ensureSkuPrefix(skuCode);
      const submitMode =
        form.dataset.submitMode === 'sale' ? 'sale' : 'product';
      const shouldCreateSale = submitMode === 'sale';
      const productIdFromForm = form.dataset.productId || null;
      const selectedImageFromForm = form.dataset.selectedImageUrl || '';
      const isEditMode =
        submitMode === 'product' &&
        form.dataset.editMode === 'true' &&
        Boolean(productIdFromForm);
      const name = (nameInput?.value || '').trim();
      const price = Number.parseFloat(priceInput?.value || '0');
      const qty = unlimitedCheckbox?.checked
        ? 999999
        : Number.parseInt(qtyInput?.value || '', 10);
      const desc =
        document.getElementById('master-desc')?.value?.trim() || null;
      const brand =
        document.getElementById('master-brand')?.value?.trim() || null;

      if (skuInput) skuInput.value = skuCode;

      if (!sku) {
        showValidationError('Please generate a SKU code before adding.');
        skuInput?.focus();
        return;
      }

      if (!unlimitedCheckbox?.checked && (!Number.isInteger(qty) || qty < 0)) {
        showValidationError('Please enter a valid stock quantity.');
        qtyInput?.focus();
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = shouldCreateSale
            ? 'ADDING TO SALES...'
            : isEditMode
              ? 'SAVING CHANGES...'
              : 'ADDING PRODUCT...';
        }

        const res = await fetch('/.netlify/functions/add-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: productIdFromForm || null,
            sku,
            name,
            description: desc,
            brand,
            price,
            qty,
            imageUrl: selectedImageUrl || selectedImageFromForm || null,
            createSale: shouldCreateSale,
          }),
        });

        let result = {};
        try {
          result = await res.json();
        } catch (_) {
          // keep default object
        }

        if (!res.ok) {
          throw new Error(
            result?.error ||
              (shouldCreateSale
                ? 'Failed to add sale from selected product.'
                : 'Failed to add product.'),
          );
        }

        if (shouldCreateSale) {
          const sale = result?.sale;
          if (!sale) throw new Error('Missing sale response from server.');
          if (
            window.wolfData &&
            typeof window.wolfData.addSaleRow === 'function'
          ) {
            window.wolfData.addSaleRow(sale);
          }
        }

        if (typeof ProductManager.fetchProducts === 'function') {
          await ProductManager.fetchProducts();
        }

        const qtyLabel = unlimitedCheckbox?.checked ? 'UNLIMITED' : qty;
        Toastify({
          text: shouldCreateSale
            ? `ADDED TO SALES: ${name.toUpperCase()} x${qtyLabel}`
            : isEditMode
              ? `PRODUCT UPDATED: ${name.toUpperCase()}`
              : `PRODUCT ADDED: ${name.toUpperCase()}`,
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

        resetImageState();
        closeProductModal();
      } catch (err) {
        console.error('Product modal submit error:', err);
        Toastify({
          text: `${err.message || 'Submission failed.'}`,
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
        setStatus(
          shouldCreateSale
            ? 'Error adding to sales.'
            : isEditMode
              ? 'Error saving product changes.'
              : 'Error adding product.',
        );
      } finally {
        setProductModalMode(form.dataset.submitMode || 'product');
        setProductModalEditState(form.dataset.editMode === 'true');
        if (submitBtn) submitBtn.disabled = false;
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
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
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
`;
  },

  getSkeleton() {
    return Array(6)
      .fill(0)
      .map(
        () => `
      <div class="col-12 col-md-6 col-xl-4 opacity-50">
        <div class="hud-item" style="height: 350px;">
          <div class="skel-shimmer" style="height: 150px; background: var(--skeleton-base); border-radius: 12px; margin-bottom: 20px;"></div>
          <div class="skel-shimmer" style="width: 70%; height: 20px; background: var(--skeleton-mid); margin-bottom: 10px;"></div>
          <div class="skel-shimmer" style="width: 40%; height: 15px; background: var(--skeleton-mid);"></div>
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
        <div style="width:150px; height:12px; background:var(--skeleton-mid); border-radius:4px;"></div>
      </div>
    `,
      )
      .join('');
  },

  async fetchTrashData() {
    const container = document.getElementById('trash-list');
    if (container) container.innerHTML = this.getTrashSkeleton();

    try {
      const { data, error } = await window.supabaseClient
        .from('trash_bin')
        .select('*')
        .eq('table_name', 'products')
        .order('deleted_at', { ascending: false });

      if (error) throw error;

      this.trashData = data || [];

      const trashCountEl =
        document.getElementById('trash-count') ||
        document.getElementById('archived-products-count');
      if (trashCountEl) trashCountEl.innerText = this.trashData.length;

      setTimeout(() => this.renderTrash(), 220);
      this.renderTrash();
    } catch (err) {
      console.error('Product Trash Sync Error:', err);
    }
  },

  async fetchProducts() {
    const list = document.getElementById('products-list');
    if (list) list.innerHTML = this.getSkeleton();

    try {
      const { data, error } = await window.supabaseClient
        .from('products')
        .select('*')
        .eq('is_active', true)
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
                  <div class="product-card-rotor">
                <div class="card-face card-front">
                  <div class="stock-badge ${stockStatus}">${stockLabel}</div>

                  <div class="card-actions-top">
                    <button class="btn-edit-product" data-product-id="${p.productid}" title="Edit">
                      <i class="bx bx-edit-alt"></i>
                    </button>
                    <button class="btn-delete-product" data-product-id="${p.productid}" title="Archive">
                      <i class="bx bx-trash"></i>
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
                  <div class="product-back-actions">
                    <button class="back-action-btn btn-add-sale" data-product-id="${p.productid}" title="Add to Sales">
                      <i class="bx bx-cart-add"></i> Add to Sales
                    </button>
                    <button class="back-action-btn btn-edit-product" data-product-id="${p.productid}" title="Edit Product">
                      <i class="bx bx-edit-alt"></i> Edit Product
                    </button>
                    <button class="back-action-btn danger btn-delete-product" data-product-id="${p.productid}" title="Archive Product">
                      <i class="bx bx-trash"></i> Archive
                    </button>
                    <button class="back-action-btn btn-flip-back" data-product-id="${p.productid}" title="Flip Back">
                      <i class="bx bx-undo"></i> Flip Back
                    </button>
                  </div>
                  <div class="back-footer">&lt; &lt; &lt; CLICK ME TO FLIP BACK &gt; &gt; &gt;</div>
                </div>
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

  renderTrash() {
    const container = document.getElementById('trash-list');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'block';
    container.style.opacity = '1';
    container.style.visibility = 'visible';

    if (!this.trashData || this.trashData.length === 0) {
      container.innerHTML =
        '<div class="text-center py-5 opacity-50">PRODUCT_RECOVERY_BIN_EMPTY</div>';
      return;
    }

    const sanitizeText = (value) => {
      const raw = String(value ?? '');
      if (typeof WOLF_PURIFIER === 'function') return WOLF_PURIFIER(raw);
      return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    try {
      container.innerHTML = this.trashData
        .map((item, index) => {
          const p =
            item && typeof item.deleted_data === 'object' && item.deleted_data
              ? item.deleted_data
              : {};
          const productName = sanitizeText(p.name || 'UNKNOWN_PRODUCT');
          const sku = sanitizeText(p.sku || 'N/A');
          const qty = Number(p.qty);
          const stockText =
            Number.isFinite(qty) && qty >= 999999
              ? 'UNLIMITED'
              : Number.isFinite(qty)
                ? `${qty}`
                : '0';
          const price = Number(p.price || 0);
          const priceText = Number.isFinite(price)
            ? price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : '0.00';

          return `
          <div class="trash-pill-card animate__animated animate__fadeInRight" style="animation-delay: ${index * 0.05}s;">
            <div class="trash-avatar-node"><i class="bx bx-package"></i></div>
            <div class="trash-details">
              <h6 style="color:white !important; opacity:1 !important;">${productName}</h6>
              <p>SKU: ${sku} | STOCK: ${stockText} | PRICE: P${priceText}</p>
            </div>
            <div class="trash-action-group">
              <button class="btn-trash-action restore" onclick="ProductManager.restoreFromTrash('${item.id}')" title="Restore product">
                <i class="bx bx-undo"></i>
              </button>
              <button class="btn-trash-action purge" onclick="ProductManager.wipePermanent('${item.id}')" title="Delete permanently">
                <i class="bx bx-shield-x"></i>
              </button>
            </div>
          </div>`;
        })
        .join('');
    } catch (err) {
      console.error('Product trash render error:', err);
      container.innerHTML =
        '<div class="text-center py-4 text-danger">FAILED_TO_RENDER_TRASH_ITEMS</div>';
    }
  },

  async switchToTrash() {
    const mainWrapper = document.getElementById('product-main-view');
    const mainContent = document.getElementById('main-content');
    if (!mainWrapper || !mainContent) return;

    if (window.wolfAudio) window.wolfAudio.play('woosh');

    mainWrapper.classList.remove('stage-center');
    mainWrapper.classList.add('stage-left');

    try {
      const response = await fetch(
        '/pages/management/product-trash-container.html',
      );
      const html = await response.text();

      setTimeout(() => {
        mainContent.innerHTML = html;
        const trashWrapper = document.getElementById('product-trash-view');
        if (!trashWrapper) return;

        trashWrapper.classList.add('stage-right');
        void trashWrapper.offsetWidth;
        trashWrapper.classList.remove('stage-right');
        trashWrapper.classList.add('stage-center');

        this.initTrashView();
      }, 500);
    } catch (err) {
      console.error('Product trash view load error:', err);
      mainWrapper.classList.remove('stage-left');
      mainWrapper.classList.add('stage-center');
    }
  },

  async initTrashView() {
    const backBtn = document.getElementById('btn-trash-back');
    if (!backBtn) return;

    backBtn.onclick = async () => {
      const trashWrapper = document.getElementById('product-trash-view');
      const mainContent = document.getElementById('main-content');
      if (!trashWrapper || !mainContent) return;

      if (window.wolfAudio) window.wolfAudio.play('woosh');

      trashWrapper.classList.remove('stage-center');
      trashWrapper.classList.add('stage-right');

      setTimeout(async () => {
        const response = await fetch('/pages/management/products.html');
        const mainHtml = await response.text();
        mainContent.innerHTML = mainHtml;

        const mainWrapper = document.getElementById('product-main-view');
        if (!mainWrapper) return;
        mainWrapper.classList.add('stage-left');
        void mainWrapper.offsetWidth;
        mainWrapper.classList.remove('stage-left');
        mainWrapper.classList.add('stage-center');

        this.init();
      }, 500);
    };

    await this.fetchTrashData();
  },

  async restoreFromTrash(trashId) {
    const item = this.trashData.find((t) => t.id === trashId);
    if (!item) return;

    const originalId = String(
      item.original_id || item.deleted_data?.productid || '',
    );
    if (!originalId) {
      Toastify({
        text: 'Invalid archive payload',
        duration: 3000,
        backgroundColor: '#e74c3c',
      }).showToast();
      return;
    }

    try {
      const payload = {
        ...(item.deleted_data || {}),
        productid: originalId,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { data: existing, error: existingErr } = await window.supabaseClient
        .from('products')
        .select('productid')
        .eq('productid', originalId)
        .maybeSingle();
      if (existingErr) throw existingErr;

      if (existing?.productid) {
        const { error: updateErr } = await window.supabaseClient
          .from('products')
          .update(payload)
          .eq('productid', originalId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await window.supabaseClient
          .from('products')
          .insert(payload);
        if (insertErr) throw insertErr;
      }

      const { error: trashErr } = await window.supabaseClient
        .from('trash_bin')
        .delete()
        .eq('id', trashId);
      if (trashErr) throw trashErr;

      if (window.wolfAudio) window.wolfAudio.play('success');
      Toastify({
        text: 'Product restored',
        duration: 2500,
        backgroundColor: '#2ecc71',
      }).showToast();
      await this.fetchTrashData();
    } catch (err) {
      console.error('Product restore error:', err);
      Toastify({
        text: `Restore failed: ${err.message || 'Unknown error'}`,
        duration: 3500,
        backgroundColor: '#e74c3c',
      }).showToast();
    }
  },

  async wipePermanent(trashId) {
    const item = this.trashData.find((t) => t.id === trashId);
    if (!item) return;

    const { isConfirmed } = await Swal.fire({
      title: 'PURGE PRODUCT PERMANENTLY?',
      text: 'This will remove the archived copy and delete the product record.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      background: '#0a0a0a',
      color: '#fff',
      confirmButtonText: 'PURGE',
    });

    if (!isConfirmed) return;

    try {
      const originalId = String(
        item.original_id || item.deleted_data?.productid || '',
      );
      if (originalId) {
        const { error: productErr } = await window.supabaseClient
          .from('products')
          .delete()
          .eq('productid', originalId);
        if (productErr) throw productErr;
      }

      const { error: trashErr } = await window.supabaseClient
        .from('trash_bin')
        .delete()
        .eq('id', trashId);
      if (trashErr) throw trashErr;

      Toastify({
        text: 'Product purged permanently',
        duration: 2600,
        backgroundColor: '#e74c3c',
      }).showToast();
      await this.fetchTrashData();
    } catch (err) {
      console.error('Product purge error:', err);
      Swal.fire('ERROR', err.message || 'Purge failed.', 'error');
    }
  },

  edit(productId) {
    this.openAddToSalesModal(productId, 'edit');
  },

  delete(productId) {
    const product = this.allProducts.find((p) => p.productid === productId);
    if (!product) return;

    if (product.is_active === false) {
      Toastify({
        text: 'Product is already archived',
        duration: 2500,
        backgroundColor: '#f39c12',
      }).showToast();
      this.allProducts = this.allProducts.filter(
        (p) => p.productid !== productId,
      );
      this.render(this.allProducts);
      return;
    }

    if (!confirm(`Archive product "${product.name || ''}"?`)) return;

    (async () => {
      try {
        // 1) prevent duplicate trash rows for the same product
        const { data: existingTrash, error: existingTrashErr } =
          await window.supabaseClient
            .from('trash_bin')
            .select('id')
            .eq('table_name', 'products')
            .eq('original_id', String(product.productid))
            .limit(1)
            .maybeSingle();
        if (existingTrashErr) throw existingTrashErr;

        // 2) insert into trash_bin only when no prior archived copy exists
        if (!existingTrash) {
          const { error: trashErr } = await window.supabaseClient
            .from('trash_bin')
            .insert({
              original_id: String(product.productid),
              table_name: 'products',
              deleted_data: product,
            });
          if (trashErr) throw trashErr;
        }

        // 3) mark product inactive once (idempotent)
        const { data: archivedRows, error: delErr } =
          await window.supabaseClient
            .from('products')
            .update({ is_active: false })
            .eq('productid', product.productid)
            .eq('is_active', true)
            .select('productid');
        if (delErr) throw delErr;

        if (!archivedRows?.length) {
          Toastify({
            text: 'Product already archived',
            duration: 2500,
            backgroundColor: '#f39c12',
          }).showToast();
          this.allProducts = this.allProducts.filter(
            (p) => p.productid !== product.productid,
          );
          this.render(this.allProducts);
          return;
        }

        // 4) update local cache and re-render
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

  openAddToSalesModal(productId, action = 'sale') {
    const product = this.allProducts.find((p) => p.productid === productId);
    if (!product) return;
    const targetAction = action === 'edit' ? 'edit' : 'sale';
    const targetMode = targetAction === 'sale' ? 'sale' : 'product';
    const isEditAction = targetAction === 'edit';

    // If modal is already open, do not re-inject HTML (prevents input wipe)
    if (window.isProductModalOpen) {
      const form = document.getElementById('master-product-form');
      if (form && form.dataset.productId !== product.productid) {
        form.dataset.productId = ''; // force refresh for different product
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
    const unlimitedCheckbox = document.getElementById('master-unlimited');
    const brandInput = document.getElementById('master-brand');
    const descInput = document.getElementById('master-desc');
    const imgBox = document.getElementById('imageContainer');
    const statusEl = document.getElementById('status');

    if (!skuInput || !nameInput || !priceInput || !qtyInput) return;

    const lastId = form.dataset.productId;
    const lastAction = form.dataset.modalAction || '';
    const needsPrefill =
      lastId !== product.productid ||
      lastAction !== targetAction ||
      !nameInput.value ||
      !skuInput.value ||
      !priceInput.value;

    // Prefill if product changed or fields are empty
    if (needsPrefill) {
      skuInput.value = stripSkuPrefix(product.sku || '');
      nameInput.value = product.name || '';
      priceInput.value = product.price || 0;
      if (targetMode === 'sale') {
        if (unlimitedCheckbox) unlimitedCheckbox.checked = false;
        qtyInput.value = 1;
        qtyInput.disabled = false;
        qtyInput.required = true;
        qtyInput.placeholder = '0';
      } else {
        const isUnlimited = Number(product.qty) >= 999999;
        if (unlimitedCheckbox) unlimitedCheckbox.checked = isUnlimited;
        if (isUnlimited) {
          qtyInput.value = '';
          qtyInput.disabled = true;
          qtyInput.required = false;
          qtyInput.placeholder = 'UNLIMITED';
        } else {
          qtyInput.value = Number(product.qty || 0);
          qtyInput.disabled = false;
          qtyInput.required = true;
          qtyInput.placeholder = '0';
        }
      }
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
          form.dataset.selectedImageUrl = product.image_url;
          if (statusEl) statusEl.textContent = 'Using saved product image.';
        } else if (statusEl) {
          form.dataset.selectedImageUrl = '';
          statusEl.textContent = '';
        }
      }
    }

    // Track current product id
    form.dataset.productId = product.productid;
    form.dataset.submitMode = targetMode;
    form.dataset.editMode = isEditAction ? 'true' : 'false';
    form.dataset.modalAction = targetAction;
    setProductModalMode(targetMode);
    setProductModalEditState(isEditAction);

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
    const root = document.getElementById('product-main-view') || document;

    // 1) Card actions inside products grid
    const container = root.querySelector('#products-list');
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
    const searchBtn = root.querySelector('#toggle-search-btn');
    const searchContainer = root.querySelector('#ledger-search-container');
    const searchInput = root.querySelector('#product-main-search');
    const clearBtn = root.querySelector('#search-clear-btn');
    const trashBtn = root.querySelector('#btn-view-trash');

    if (trashBtn) {
      trashBtn.onclick = () => this.switchToTrash?.();
    }

    if (searchBtn && searchContainer && searchInput) {
      searchBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
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
