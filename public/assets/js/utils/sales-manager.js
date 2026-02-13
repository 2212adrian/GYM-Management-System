/**
 * WOLF OS - SALES MANAGER (UNIFIED)
 */

// --- PRE-LOADER: Injects HTML immediately when script runs ---
(function preLoadAlert() {
  const inject = () => {
    if (document.getElementById('wolf-system-alert')) return;
    if (!document.body) return;

    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="wolf-system-alert" role="status" aria-live="assertive">
         <span class="alert-icon-wrap"><i class='bx alert-icon'></i></span>
         <span class="alert-copy">
           <span class="alert-code"></span>
           <span class="alert-text"></span>
         </span>
       </div>`,
    );
  };

  if (document.body) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  }
})();

window.salesManager = {
  allProducts: [],
  selectedProductId: null,
  placeholderImg: '/assets/images/placeholder.png',
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
  // ==========================================
  // SECTION 1: SALE TRANSACTION (POS) LOGIC
  // ==========================================

  // --- UI HELPER: TOP SYSTEM ALERT ---
  _alertTimeout: null,

  hasErrPrefix(message) {
    return /^\[ERR_[A-Z0-9_]+\]/i.test(String(message || '').trim());
  },

  enrichAlertMessage(message, type = 'success') {
    const raw = String(message || '').trim();
    if (!raw) return '';
    if (this.hasErrPrefix(raw)) return raw;
    if (type !== 'error' && type !== 'warning') return raw;

    if (
      /CHRONOLOCK_ACTIVE|FUTURE PROJECTION BLOCKED/i.test(
        raw,
      )
    ) {
      const detail = raw.replace(/^CHRONOLOCK_ACTIVE:\s*/i, '').trim();
      return `[ERR_811] CHRONOLOCK_ACTIVE: ${detail || raw}`;
    }

    if (/FUTURE_DATE_LOCKED|INVALID_PROTOCOL/i.test(raw)) {
      const detail = raw
        .replace(/^INVALID_PROTOCOL:\s*/i, '')
        .replace(/^FUTURE_DATE_LOCKED:\s*/i, '')
        .trim();
      return `[ERR_812] FUTURE_DATE_LOCKED: ${detail || raw}`;
    }

    if (/REQUEST EXCEEDS STOCK|STOCK LIMIT|EXCEEDS AVAILABLE/i.test(raw)) {
      return `[ERR_802] STOCK_LIMIT: ${raw}`;
    }

    if (/OUT OF STOCK|NO STOCK AVAILABLE|INVENTORY DEPLETED/i.test(raw)) {
      return `[ERR_801] STOCK_EMPTY: ${raw}`;
    }

    if (/SKU\\s*\\[[^\\]]+\\]\\s*(NOT FOUND|NOT RECOGNIZED|UNKNOWN)/i.test(raw)) {
      return `[ERR_404] RESOURCE_MISSING: ${raw}`;
    }

    if (
      /DATABASE_REJECTED_ENTRY|TRANSACTION_FAILED|TRANSACTION_FAULT|PURGE_PROTOCOL_FAILED|ARCHIVE_RECORD_NOT_FOUND|ASSET VALIDATION FAILED|LOGBOOK_MODULE_NOT_READY/i.test(
        raw,
      )
    ) {
      return `[ERR_500] SYSTEM_FAULT: ${raw}`;
    }

    return `[ERR_500] SYSTEM_FAULT: ${raw}`;
  },

  splitAlertMessage(message) {
    const value = String(message || '').trim();
    const match = value.match(/^\[(ERR_[A-Z0-9_]+)\]\s*(.*)$/i);
    if (!match) return { code: '', detail: value };
    return {
      code: match[1].toUpperCase(),
      detail: String(match[2] || '').trim(),
    };
  },

  showSystemAlert(message, type = 'success') {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return; // Only show on mobile

    // 1. Get the pre-loaded element
    const alertEl = document.getElementById('wolf-system-alert');
    if (!alertEl) return; // Should exist

    // 2. Clear previous hide-timers
    if (this._alertTimeout) clearTimeout(this._alertTimeout);

    // 3. Reset Classes & Update Content
    const normalizedType =
      type === 'error' || type === 'warning' || type === 'success'
        ? type
        : 'success';
    const normalizedMessage = this.enrichAlertMessage(message, normalizedType);
    const parsed = this.splitAlertMessage(normalizedMessage);

    const iconMap = {
      success: 'bx-check-shield',
      error: 'bx-error-alt',
      warning: 'bx-shield-quarter',
    };
    const iconEl = alertEl.querySelector('.alert-icon');
    const codeEl = alertEl.querySelector('.alert-code');
    const textEl = alertEl.querySelector('.alert-text');

    if (iconEl) {
      iconEl.className = `bx alert-icon ${iconMap[normalizedType] || 'bx-notification'}`;
    }
    if (codeEl) {
      codeEl.textContent = parsed.code ? `[${parsed.code}]` : '';
      codeEl.hidden = !parsed.code;
    }
    if (textEl) {
      const detail = parsed.detail || normalizedMessage || '';
      textEl.textContent = detail.toUpperCase();
    }

    alertEl.classList.remove('show', 'success', 'error', 'warning');
    alertEl.classList.add(normalizedType);

    // Restart slide-down animation when called repeatedly.
    void alertEl.offsetWidth;
    requestAnimationFrame(() => {
      alertEl.classList.add('show');
    });

    // Play Audio
    if (window.wolfAudio)
      window.wolfAudio.play(normalizedType === 'success' ? 'success' : 'error');

    // 4. Schedule Hide after 4 seconds
    this._alertTimeout = setTimeout(() => {
      alertEl.classList.remove('show');
    }, 4000);
  },

  showTopInstruction(show = true) {
    let banner = document.getElementById('wolf-system-instruction');
    if (!show) {
      if (banner) banner.remove();
      return;
    }

    if (!banner) {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div id="wolf-system-instruction" class="system-instruction-banner"><div class="instruction-pulse"></div><span class="instruction-text">SCAN OR TYPE PRODUCT TO VALIDATE</span></div>`,
      );
      banner = document.getElementById('wolf-system-instruction');
    }
    banner.classList.toggle('active', show);
  },

  // Modified to accept a pre-scanned SKU
  async openSaleTerminal(preScannedSku = null) {
    if (this.allProducts.length === 0) {
      await this.fetchProducts();
    }

    // Check SKU if provided
    let prod;
    if (preScannedSku) {
      prod = this.allProducts.find((p) => p.sku === preScannedSku);
      if (!prod) {
        this.showSystemAlert(`SKU [${preScannedSku}] NOT FOUND`, 'error');
        return;
      }
    }

    // Ensure modal HTML exists
    let modal = document.getElementById('sale-terminal-overlay');
    let styleEl = document.getElementById('sale-terminal-style');

    if (!modal) {
      const res = await fetch('/assets/components/record-sale-modal.html');
      const html = await res.text();

      // Temporary container to extract HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Extract and inject style safely
      const styleTag = tempDiv.querySelector('style');
      if (styleTag && !styleEl) {
        styleTag.id = 'sale-terminal-style';
        document.head.appendChild(styleTag);
      }

      // Insert modal container
      const modalEl = tempDiv.querySelector('#sale-terminal-overlay');
      if (!modalEl) return;

      document.body.appendChild(modalEl);
      modal = modalEl;
    }

    const container = modal.querySelector('.master-terminal-container');
    if (!container) return;

    // Reset inline styles and closing state
    modal.style.display = '';
    modal.style.visibility = '';
    modal.style.opacity = '';
    modal.classList.remove('is-closing');
    container.classList.remove('modal-closing');

    // Trigger modal ENTER animation
    modal.classList.add('is-open');
    container.classList.add('modal-open');

    this.showTopInstruction(true);
    await this.fetchProducts();
    this.attachSaleListeners(modal);
    this.resetPreview();

    // Auto-fill pre-scanned SKU
    if (prod) {
      const searchInput = modal.querySelector('#sale-product-search');
      if (searchInput) searchInput.value = prod.name;

      this.lockProduct(prod);

      const qtyInp = modal.querySelector('#sale-qty');
      if (qtyInp) {
        qtyInp.value = 1;
        qtyInp.classList.add('auto-filled');
      }

      this.validateTransaction();
    }
  },

  closeSaleTerminal() {
    const modal = document.getElementById('sale-terminal-overlay');
    if (!modal) return;

    // Ensure the helper banner is fully removed before modal/style cleanup.
    this.showTopInstruction(false);

    const container = modal.querySelector('.master-terminal-container');
    modal.classList.remove('is-open');
    container.classList.remove('modal-open');

    // Add closing animation classes if you use them
    modal.classList.add('is-closing');
    container.classList.add('modal-closing');

    // Remove modal and style after animation
    setTimeout(() => {
      modal.remove();
      const style = document.getElementById('sale-terminal-style');
      if (style) style.remove();
    }, 300); // match your animation duration
  },

  async processQuickSale(sku) {
    if (this.isProcessingQuick) return;
    this.isProcessingQuick = true;
    try {
      // 1. Fetch Product Data
      const { data: prod, error: fErr } = await supabaseClient
        .from('products')
        .select('*')
        .eq('sku', sku)
        .eq('is_active', true)
        .single();

      if (fErr || !prod) {
        this.showSystemAlert(`SKU [${sku}] NOT RECOGNIZED`, 'error');
        return;
      }

      // 2. Stock Check
      const currentQty = Number(prod.qty);
      if (currentQty < 1 && currentQty < 999999) {
        this.showSystemAlert(`OUT OF STOCK: ${prod.name}`, 'error');
        return;
      }

      // 3. Insert Sale Record
      const saleRef = `AUTO-${Date.now().toString().slice(-4)}`;
      const { error: saleErr } = await supabaseClient.from('sales').insert([
        {
          sale_reference: saleRef,
          product_id: prod.productid,
          qty: 1,
          unit_price: prod.price,
          payment_status: 'paid',
        },
      ]);

      if (saleErr) throw saleErr;

      // 4. Update Inventory (Stock Decrement)
      if (currentQty < 999999) {
        await supabaseClient
          .from('products')
          .update({ qty: currentQty - 1 })
          .eq('productid', prod.productid);
      }

      // --- CRITICAL FEEDBACK & RELOAD ---

      // A. Show Success Alert
      this.showSystemAlert(`QUICK AUTH: ${prod.name} x1`, 'success');
      // write toastify here!
      // B. Play Sound
      if (window.wolfAudio) window.wolfAudio.play('success');

      // C. REAL-TIME REFRESH: This updates the sales table immediately
      if (window.wolfData && typeof window.wolfData.loadSales === 'function') {
        window.wolfData.loadSales();
      }
    } catch (err) {
      console.error('Quick Sale Error:', err);
      this.showSystemAlert('TRANSACTION_FAILED', 'error');
      if (window.wolfAudio) window.wolfAudio.play('error');
    } finally {
      // Prevent spam scans
      setTimeout(() => {
        this.isProcessingQuick = false;
      }, 1500);
    }
  },

  async fetchProducts() {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('is_active', true);
    if (!error) {
      this.allProducts = data;
      // Note: No longer using datalist, using custom wolf-dropdown instead
    }
  },

  attachSaleListeners(modal) {
    const form = modal.querySelector('#record-sale-form');
    const searchInput = modal.querySelector('#sale-product-search');
    const resultsDiv = modal.querySelector('#custom-search-results');
    const qtyInput = modal.querySelector('#sale-qty');
    const qtyDecBtn = modal.querySelector('#sale-qty-dec');
    const qtyIncBtn = modal.querySelector('#sale-qty-inc');
    const qrBtn = modal.querySelector('#qrScanTrigger');
    const clearBtn = modal.querySelector('#clearSearchBtn');
    const closeBtn = modal.querySelector('#closeSaleModal');

    if (!searchInput || !resultsDiv) return;

    // --- 1. CUSTOM DROPDOWN SEARCH LOGIC ---
    searchInput.addEventListener('input', () => {
      const val = searchInput.value.trim().toLowerCase();

      if (val.length < 1) {
        resultsDiv.classList.remove('active');
        return;
      }

      // Filter matches from local memory
      const matches = this.allProducts.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(val)) ||
          (p.sku && p.sku.toLowerCase().includes(val)),
      );

      if (matches.length > 0) {
        resultsDiv.innerHTML = matches
          .map((prod) => {
            const displayName = String(prod.name || 'UNKNOWN ASSET').toUpperCase();
            return `
            <div class="dropdown-item" data-id="${prod.productid}">
                <span class="item-name">${displayName}</span>
                <span class="item-sku">SKU: ${prod.sku}</span>
            </div>
        `;
          })
          .join('');
        resultsDiv.classList.add('active');
      } else {
        resultsDiv.classList.remove('active');
      }
    });

    // Handle selection from dropdown
    resultsDiv.onclick = (e) => {
      const item = e.target.closest('.dropdown-item');
      if (item) {
        const prodId = item.getAttribute('data-id');
        const prod = this.allProducts.find((p) => p.productid === prodId);
        if (prod) {
          searchInput.value = prod.name;
          resultsDiv.classList.remove('active');
          this.lockProduct(prod);
        }

        if (qtyInput) {
          qtyInput.value = 1;

          // 1. Add the animation class
          qtyInput.classList.add('auto-filled');

          // 2. Remove the class after 500ms so it can be triggered again
          setTimeout(() => {
            qtyInput.classList.remove('auto-filled');
          }, 500);

          // Re-run validation to calculate total and enable button
          this.validateTransaction();
        }
      }
    };

    // --- 2. QR SCANNER - MODAL SWAP ---
    if (qrBtn) {
      qrBtn.onclick = () => {
        if (window.wolfScanner) {
          modal.style.display = 'none';
          window.wolfScanner.start(
            (sku) => {
              modal.style.display = 'flex';
              const prod = this.allProducts.find((p) => p.sku === sku);
              if (prod) {
                searchInput.value = prod.name;
                this.lockProduct(prod);
              } else {
                this.showSystemAlert(`SKU [${sku}] UNKNOWN`, 'error');
              }
              this.openSaleTerminal(sku);
            },
            true,
            () => {
              modal.style.display = 'flex';
            },
          );
        }
      };
    }

    // --- 3. UNLOCK / CLEAR ---
    clearBtn.onclick = () => {
      this.unlockProductSelection();
      if (window.wolfAudio) window.wolfAudio.play('notif');
      searchInput.focus();
    };

    // --- 4. CLOSE MODAL ---
    closeBtn.onclick = () => {
      resultsDiv.classList.remove('active');
      this.closeSaleTerminal();
      this.showTopInstruction(false);
      this.selectedProductId = null;
    };
    // --- 5. VALIDATION ---
    const syncQtyStepperState = () => {
      const val = parseInt(qtyInput?.value, 10) || 0;
      const prod = this.allProducts.find(
        (p) => p.productid === this.selectedProductId,
      );
      const available = Number(prod?.qty || 0);
      const isLimited = available < 999999;
      if (qtyDecBtn) qtyDecBtn.disabled = !prod || val <= 1;
      if (qtyIncBtn)
        qtyIncBtn.disabled =
          !prod || qtyInput?.disabled || (isLimited && val >= available);
    };

    if (qtyDecBtn) {
      qtyDecBtn.onclick = () => {
        if (!qtyInput || qtyInput.disabled) return;
        const current = parseInt(qtyInput.value, 10) || 0;
        qtyInput.value = String(Math.max(1, current - 1));
        this.validateTransaction();
        syncQtyStepperState();
      };
    }

    if (qtyIncBtn) {
      qtyIncBtn.onclick = () => {
        if (!qtyInput || qtyInput.disabled) return;
        const prod = this.allProducts.find(
          (p) => p.productid === this.selectedProductId,
        );
        if (!prod) return;
        const current = parseInt(qtyInput.value, 10) || 0;
        const next = current + 1;
        const available = Number(prod.qty || 0);
        if (available < 999999 && next > available) return;
        qtyInput.value = String(Math.max(1, next));
        this.validateTransaction();
        syncQtyStepperState();
      };
    }

    qtyInput.oninput = () => {
      const val = parseInt(qtyInput.value) || 0;
      // Auto-filled class for the flash effect
      if (val === 1) {
        qtyInput.classList.add('auto-filled');
        setTimeout(() => qtyInput.classList.remove('auto-filled'), 500);
      }
      this.validateTransaction();
      syncQtyStepperState();
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      this.processTransaction();
    };

    syncQtyStepperState();

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchWrapper'))
        resultsDiv.classList.remove('active');
      if (e.target.closest('#closeSaleModal')) {
        e.preventDefault();
      }
    });
  },

  lockProduct(prod) {
    const searchInput = document.getElementById('sale-product-search');
    const searchWrapper = document.getElementById('searchWrapper');
    const qrBtn = document.getElementById('qrScanTrigger');
    const clearBtn = document.getElementById('clearSearchBtn');
    const qtyInput = document.getElementById('sale-qty');
    const qtyDecBtn = document.getElementById('sale-qty-dec');
    const qtyIncBtn = document.getElementById('sale-qty-inc');

    this.selectedProductId = prod.productid;

    searchInput.readOnly = true;
    searchWrapper.classList.add('is-locked');
    if (qrBtn) qrBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'flex';
    this.showTopInstruction(false);
    this.updatePreview(prod);

    const available = Number(prod.qty || 0);
    if (available > 0) {
      if (qtyInput) {
        qtyInput.value = 1;
        qtyInput.classList.add('auto-filled');
        setTimeout(() => qtyInput.classList.remove('auto-filled'), 500);
      }
      if (qtyDecBtn) qtyDecBtn.disabled = true;
      if (qtyIncBtn) qtyIncBtn.disabled = available <= 1;
    } else {
      if (qtyInput) qtyInput.value = 0;
      if (qtyDecBtn) qtyDecBtn.disabled = true;
      if (qtyIncBtn) qtyIncBtn.disabled = true;
      this.showSystemAlert(`OUT OF STOCK: ${prod.name}`, 'error');
    }

    this.validateTransaction();
    if (window.wolfAudio) window.wolfAudio.play('success');
  },

  unlockProductSelection() {
    const searchInput = document.getElementById('sale-product-search');
    const searchWrapper = document.getElementById('searchWrapper');
    const qrBtn = document.getElementById('qrScanTrigger');
    const clearBtn = document.getElementById('clearSearchBtn');
    const qtyInput = document.getElementById('sale-qty');
    const qtyDecBtn = document.getElementById('sale-qty-dec');
    const qtyIncBtn = document.getElementById('sale-qty-inc');

    this.selectedProductId = null;
    if (searchInput) {
      searchInput.readOnly = false;
      searchInput.value = '';
    }
    if (searchWrapper) searchWrapper.classList.remove('is-locked');
    if (qrBtn) qrBtn.style.display = 'flex';
    if (clearBtn) clearBtn.style.display = 'none';
    if (qtyInput) {
      qtyInput.value = '';
      qtyInput.disabled = true;
      qtyInput.style.opacity = '0.3';
    }
    if (qtyDecBtn) qtyDecBtn.disabled = true;
    if (qtyIncBtn) qtyIncBtn.disabled = true;
    this.resetPreview();
  },

  updatePreview(prod) {
    const qtyInput = document.getElementById('sale-qty');
    const qtyDecBtn = document.getElementById('sale-qty-dec');
    const qtyIncBtn = document.getElementById('sale-qty-inc');
    const priceMeta = document.getElementById('meta-price');
    const stockMeta = document.getElementById('meta-stock');
    const imgPreview = document.getElementById('asset-preview-img');
    const descPreview = document.getElementById('asset-preview-desc');

    if (priceMeta) priceMeta.innerText = `₱${Number(prod.price).toFixed(2)}`;

    const available = Number(prod.qty || 0);
    if (stockMeta) {
      stockMeta.innerText = available >= 999999 ? '∞' : available;
      stockMeta.style.color = available <= 0 ? 'var(--wolf-red)' : '#fff';
    }

    // --- RULE: Disable quantity if available stock is zero ---
    if (qtyInput) {
      if (available <= 0) {
        qtyInput.disabled = true;
        qtyInput.style.opacity = '0.3';
        if (qtyDecBtn) qtyDecBtn.disabled = true;
        if (qtyIncBtn) qtyIncBtn.disabled = true;
        this.showSystemAlert(`OUT OF STOCK: ${prod.name}`, 'error');
      } else {
        qtyInput.disabled = false;
        qtyInput.style.opacity = '1';
        const currentQty = parseInt(qtyInput.value || '1', 10) || 1;
        if (qtyDecBtn) qtyDecBtn.disabled = currentQty <= 1;
        if (qtyIncBtn) {
          const isLimited = available < 999999;
          qtyIncBtn.disabled = isLimited && currentQty >= available;
        }
      }
    }

    if (imgPreview) imgPreview.src = prod.image_url || this.placeholderImg;
    if (descPreview)
      descPreview.innerText = prod.description || 'NO TECHNICAL DATA FILED.';
  },

  // --- VALIDATION ENGINE ---
  validateTransaction() {
    const qtyInput = document.getElementById('sale-qty');
    const submitBtn = document.getElementById('sale-submit-btn');
    const totalDisplay = document.getElementById('sale-total-display');
    const val = parseInt(qtyInput.value) || 0;

    const prod = this.allProducts.find(
      (p) => p.productid === this.selectedProductId,
    );
    if (!prod) {
      if (submitBtn) submitBtn.disabled = true;
      return;
    }
    const available = Number(prod.qty || 0);
    if (available < 999999 && val > available) {
      // 1. Visual/Audio Feedback
      qtyInput.classList.add('input-error');
      if (window.wolfAudio) window.wolfAudio.play('denied');
      if (available <= 0) {
        this.showSystemAlert(`OUT OF STOCK: ${prod.name}`, 'error');
      } else {
        this.showSystemAlert(
          `REQUEST EXCEEDS STOCK: ${prod.name} (MAX ${available})`,
          'error',
        );
      }

      // 2. THE RESET: Force values back to zero
      qtyInput.value = '';
      if (totalDisplay) totalDisplay.innerText = '₱0.00';
      submitBtn.disabled = true;

      // 3. Remove shake effect after animation
      setTimeout(() => qtyInput.classList.remove('input-error'), 500);
    }
    // RULE: If qty is 0 or null
    else if (val <= 0) {
      submitBtn.disabled = true;
    }
    // RULE: Valid entry
    else {
      qtyInput.classList.remove('input-error');
      submitBtn.disabled = false;
    }
    this.calculateTotal();
  },

  resetPreview() {
    const imgPreview = document.getElementById('asset-preview-img');
    const descPreview = document.getElementById('asset-preview-desc');
    const priceMeta = document.getElementById('meta-price');
    const stockMeta = document.getElementById('meta-stock');
    const submitBtn = document.getElementById('sale-submit-btn');
    const qtyInput = document.getElementById('sale-qty');
    const qtyDecBtn = document.getElementById('sale-qty-dec');
    const qtyIncBtn = document.getElementById('sale-qty-inc');
    if (qtyInput) {
      qtyInput.value = '';
      qtyInput.disabled = true;
      qtyInput.style.opacity = '0.3';
    }
    if (qtyDecBtn) qtyDecBtn.disabled = true;
    if (qtyIncBtn) qtyIncBtn.disabled = true;
    if (imgPreview) imgPreview.src = this.placeholderImg;
    if (descPreview)
      descPreview.innerText =
        'SELECT AN ASSET TO LOAD TECHNICAL DATA PROTOCOL...';
    if (priceMeta) priceMeta.innerText = '₱0.00';
    if (stockMeta) stockMeta.innerText = '--';
    if (submitBtn) submitBtn.disabled = true;

    this.calculateTotal();
  },

  calculateTotal() {
    const qtyInput = document.getElementById('sale-qty');
    const totalDisplay = document.getElementById('sale-total-display');

    if (!this.selectedProductId) {
      if (totalDisplay) totalDisplay.innerText = '₱0.00';
      return;
    }

    const prod = this.allProducts.find(
      (p) => p.productid === this.selectedProductId,
    );
    const sellQty = parseInt(qtyInput.value) || 0;

    if (prod && totalDisplay) {
      const total = Number(prod.price) * sellQty;
      totalDisplay.innerText = `₱${total.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    } else if (totalDisplay) {
      totalDisplay.innerText = '₱0.00';
    }
  },

  async processTransaction() {
    const submitBtn = document.getElementById('sale-submit-btn');
    const form = document.getElementById('record-sale-form');
    const qtyInput = document.getElementById('sale-qty');
    const sellQty = parseInt(qtyInput.value);

    submitBtn.disabled = true;
    submitBtn.textContent = 'SYNCHRONIZING...';

    try {
      const { data: dbProd, error: fetchErr } = await supabaseClient
        .from('products')
        .select('*')
        .eq('productid', this.selectedProductId)
        .single();

      if (fetchErr || !dbProd) throw new Error('Asset validation failed.');
      const currentQty = Number(dbProd.qty);

      if (currentQty < 999999 && currentQty < sellQty)
        throw new Error('INSUFFICIENT_STOCK');

      const saleRef = `SALE-${Date.now().toString().slice(-4)}`;

      // FIX: Ensure created_at is NOT sent so Supabase uses Server Time (now())
      const { error: saleErr } = await supabaseClient.from('sales').insert([
        {
          sale_reference: saleRef,
          product_id: this.selectedProductId,
          qty: sellQty,
          unit_price: dbProd.price,
          payment_status: 'paid',
        },
      ]);

      if (saleErr) throw saleErr;

      if (currentQty < 999999) {
        await supabaseClient
          .from('products')
          .update({ qty: currentQty - sellQty })
          .eq('productid', this.selectedProductId);
      }

      this.showSystemAlert(
        `PRODUCT ADDED: ${dbProd.name.toUpperCase()} x${sellQty}`,
      );
      Toastify({
        text: `PRODUCT ADDED: ${dbProd.name.toUpperCase()} x${sellQty}`,
        duration: 2500,
        gravity: 'top', // top or bottom
        position: 'right', // left, center, right
        style: {
          border: '1px solid #77ff00', // correct way to set border color
          background: '#0a0a0a',
          borderRadius: '12px',
          fontWeight: '900',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#fff',
        },
      }).showToast();
      if (window.wolfData) window.wolfData.loadSales();
      const modal = document.getElementById('sale-terminal-overlay');
      this.unlockProductSelection();
      if (modal) modal.style.display = 'none';
      if (form) form.reset();

      if (window.wolfData && typeof window.wolfData.loadSales === 'function') {
        window.wolfData.loadSales();
      }
      if (window.wolfAudio) window.wolfAudio.play('success');
    } catch (err) {
      this.showSystemAlert(err.message, 'error');
      if (window.wolfAudio) window.wolfAudio.play('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'AUTHORIZE TRANSACTION';
    }
  },

  // --- QUICK SALE PROCESSING ---
  async processQuickSale(sku) {
    if (this.isProcessingQuick) return;
    this.isProcessingQuick = true;

    try {
      // 1. Fetch product directly from DB so we don't rely on the local list being loaded
      const { data: prod, error: fErr } = await supabaseClient
        .from('products')
        .select('*')
        .eq('sku', sku)
        .eq('is_active', true)
        .single();

      if (fErr || !prod) {
        this.showSystemAlert(`SKU [${sku}] NOT FOUND`, 'error');
        return;
      }

      const currentQty = Number(prod.qty);
      if (currentQty < 1 && currentQty < 999999) {
        this.showSystemAlert(`OUT OF STOCK: ${prod.name}`, 'error');
        return;
      }

      // 2. Log Sale
      const saleRef = `AUTO-${Date.now().toString().slice(-4)}`;
      const { error: saleErr } = await supabaseClient.from('sales').insert([
        {
          sale_reference: saleRef,
          product_id: prod.productid,
          qty: 1,
          unit_price: prod.price,
          payment_status: 'paid',
        },
      ]);

      if (saleErr) throw saleErr;

      // 3. Decrement Stock
      if (currentQty < 999999) {
        await supabaseClient
          .from('products')
          .update({ qty: currentQty - 1 })
          .eq('productid', prod.productid);
      }

      // Success Feedback
      this.showSystemAlert(`PRODUCT ADDED: ${prod.name} x1`, 'success');
      Toastify({
        text: `PRODUCT ADDED: ${prod.name.toUpperCase()} x1`,
        duration: 2500,
        gravity: 'top', // top or bottom
        position: 'right', // left, center, right
        style: {
          border: '1px solid #77ff00', // correct way to set border color
          background: '#0a0a0a',
          borderRadius: '12px',
          fontWeight: '900',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#fff',
        },
      }).showToast();
      if (window.wolfAudio) window.wolfAudio.play('success');
      if (window.wolfData && window.wolfData.loadSales)
        window.wolfData.loadSales();
    } catch (err) {
      console.error(err);
      this.showSystemAlert('TRANSACTION_FAULT', 'error');
    } finally {
      setTimeout(() => {
        this.isProcessingQuick = false;
      }, 1000);
    }
  },

  // ==========================================
  // SECTION 2: MASTER ADD (INVENTORY) LOGIC
  // ==========================================

  async initModal() {
    if (document.getElementById('product-modal-overlay')) return true;
    try {
      const res = await fetch('/assets/components/add-product-modal.html');
      const html = await res.text();
      document.body.insertAdjacentHTML('beforeend', html);
      this.attachEventListeners();
      return true;
    } catch (err) {
      return false;
    }
  },

  async openAddTerminal() {
    const ready = await this.initModal();
    if (!ready) return;
    const modal = document.getElementById('product-modal-overlay');
    const form = document.getElementById('master-product-form');
    const qtyInput = document.getElementById('master-qty');
    if (form) form.reset();
    if (qtyInput) {
      qtyInput.disabled = false;
      qtyInput.placeholder = '0';
      qtyInput.style.opacity = '1';
    }
    this.generateRandomID();
    modal.style.display = 'flex';
    if (window.wolfAudio) window.wolfAudio.play('notif');
  },

  generateRandomID() {
    const idInput = document.getElementById('master-asset-id');
    if (idInput) idInput.value = Math.floor(1000 + Math.random() * 9000);
  },

  attachEventListeners() {
    const modal = document.getElementById('product-modal-overlay');
    const form = document.getElementById('master-product-form');
    const closeBtn = document.getElementById('closeProductModal');
    const idInput = document.getElementById('master-asset-id');
    const genBtn = document.getElementById('generateRandomId');
    const unlimitedCheck = document.getElementById('master-unlimited');
    const qtyInput = document.getElementById('master-qty');

    if (genBtn)
      genBtn.onclick = () => {
        this.generateRandomID();
        window.wolfAudio.play('notif');
      };

    if (idInput) {
      idInput.oninput = (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      };
    }

    if (unlimitedCheck) {
      unlimitedCheck.onchange = (e) => {
        qtyInput.disabled = e.target.checked;
        qtyInput.value = '';
        qtyInput.placeholder = e.target.checked ? '∞' : '0';
        qtyInput.style.opacity = e.target.checked ? '0.3' : '1';
      };
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('.btn-commit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'COMMITTING...';

        const productData = {
          sku: 'PR-' + idInput.value,
          name: document.getElementById('master-name').value.toUpperCase(),
          description: document.getElementById('master-desc').value,
          price: parseFloat(document.getElementById('master-price').value),
          qty: unlimitedCheck.checked ? 999999 : parseInt(qtyInput.value || 0),
          is_active: true,
        };

        try {
          const { error: prodErr } = await supabaseClient
            .from('products')
            .insert([productData]);
          if (prodErr) throw prodErr;
          if (window.wolfAudio) window.wolfAudio.play('success');
          modal.style.display = 'none';
          form.reset();
        } catch (err) {
          if (window.wolfAudio) window.wolfAudio.play('error');
          alert('PROTOCOL_FAULT: Database rejected entry.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'COMMIT RECORD CHANGES';
        }
      };
    }
  },

  // ==========================================
  // SECTION: CONTEXTUAL TRASH BIN (FIXED FILTER)
  // ==========================================

  async openTrashBin() {
    // Uses the mode set by loadSales or loadLogbook
    const mode = this.currentTrashMode || 'sales';
    const COMPONENT_PATH = '/assets/components/trash-modal.html';

    if (!document.getElementById('sales-trash-overlay')) {
      const res = await fetch(COMPONENT_PATH);
      const html = await res.text();
      document.body.insertAdjacentHTML('beforeend', html);
    }

    // Ensure DOM is ready
    await new Promise((r) => setTimeout(r, 50));

    const overlay = document.getElementById('sales-trash-overlay');
    if (!overlay) return;

    // FIX: Define titleHeader properly to avoid ReferenceError
    const titleHeader = overlay.querySelector('.terminal-title');
    if (titleHeader) {
      const label = mode === 'sales' ? 'SALES' : 'LOGBOOK';
      titleHeader.innerHTML = `${label} <span>TRASH BIN</span>`;
    }

    // Attach Listeners
    document.getElementById('closeTrashModal').onclick = () =>
      this.closeTrash();
    document.getElementById('closeTrashBtn').onclick = () => this.closeTrash();

    overlay.style.display = 'flex';
    if (window.wolfAudio) window.wolfAudio.play('notif');

    this.loadTrashItems(mode);
  },

  closeTrash() {
    const overlay = document.getElementById('sales-trash-overlay');
    if (!overlay) return;

    // 1. Trigger Outro Animation
    overlay.classList.add('closing');

    // 2. Wait for animation (300ms) then physically hide
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('closing');
    }, 300);
  },

  async loadTrashItems(mode) {
    const container = document.getElementById('trash-list-container');
    if (!container) return;

    // 1. Force Registry Sync for Sales mode
    if (mode === 'sales' && this.allProducts.length === 0) {
      await this.fetchProducts();
    }

    const targetTable = mode === 'sales' ? 'sales' : 'check_in_logs';

    // 2. ATOMIC DATE BOUNDARIES (Using wolfData.serverToday)
    // We get the YYYY-MM-DD from the synced server date
    const baseDate =
      window.wolfData && window.wolfData.serverToday
        ? window.wolfData.serverToday
        : new Date();

    const localDay = baseDate.toLocaleDateString('en-CA'); // "YYYY-MM-DD"

    // Philippines Offset (+08:00) to match Ledger logic
    const startOfToday = `${localDay}T00:00:00+08:00`;
    const endOfToday = `${localDay}T23:59:59+08:00`;

    // 3. FETCH: Mode-Specific + Strictly Today Only
    const { data, error } = await supabaseClient
      .from('trash_bin')
      .select('*')
      .eq('table_name', targetTable)
      .gte('deleted_at', startOfToday)
      .lte('deleted_at', endOfToday)
      .order('deleted_at', { ascending: false });

    if (error || !data || data.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px; opacity:0.3;">
          <i class='bx bx-folder-open' style='font-size:4rem;'></i>
          <p style='font-size:12px; font-weight:900; margin-top:15px; text-transform: uppercase;'>
            ARCHIVE_EMPTY_FOR_TODAY
          </p>
        </div>`;
      return;
    }

    // 4. RENDER (FORCED UPPERCASE)
    const canHardDelete = this.canHardDelete();
    container.innerHTML = data
      .map((item) => {
        const d = item.deleted_data;
        let displayName = '';
        let subDetail = '';

        if (mode === 'sales') {
          // --- SALES RESOLUTION ---
          const productMatch = this.allProducts.find(
            (p) => p.productid === d.product_id,
          );
          displayName = productMatch ? productMatch.name : 'DELETED_PRODUCT';

          const amount = Number(d.total_amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          });
          const sku = productMatch
            ? productMatch.sku
            : d.product_id
              ? d.product_id.slice(0, 8)
              : 'N/A';

          subDetail = `₱${amount} | SKU: ${sku}`;
        } else {
          // --- LOGBOOK RESOLUTION ---
          displayName = d.notes?.replace('WALK-IN: ', '') || 'MEMBER_ENTRY';

          const timeIn = new Date(d.time_in).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const timeOut = d.time_out
            ? new Date(d.time_out).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'STILL_ACTIVE';

          subDetail = `IN: ${timeIn} | OUT: ${timeOut}`;
        }

        return `
        <div class="trash-item-card">
            <div class="trash-item-info">
                <span class="trash-prod-name">${displayName.toUpperCase()}</span>
                <div class="trash-tech-row" style="text-transform: uppercase;">
                    ${subDetail.toUpperCase()}
                </div>
            </div>
            <div class="trash-actions">
                <button class="btn-restore" title="RESTORE" onclick="salesManager.restoreSale('${item.id}', '${mode}')">
                    <i class='bx bx-undo'></i>
                </button>
                ${
                  canHardDelete
                    ? `<button class="btn-purge" title="DELETE_PERMANENT" onclick="salesManager.purgeSale('${item.id}', '${mode}')">
                    <i class='bx bx-trash'></i>
                </button>`
                    : ''
                }
            </div>
        </div>`;
      })
      .join('');
  },

  // --- NEW: PERMANENT PURGE FUNCTION ---
  async purgeSale(trashId, mode) {
    if (!this.canHardDelete()) {
      this.showSystemAlert('ACCESS_DENIED: ONLY ADMIN CAN HARD DELETE', 'error');
      return;
    }

    if (!window.Swal) return;

    // 1. CONFIRMATION (Industrial Orange Style)
    const result = await window.Swal.fire({
      title: 'DELETE PERMANENTLY?',
      html: `
        <div style="color: #b47023; font-size: 4.5rem; margin-bottom: 10px;">
          <i class='bx bx-trash-alt'></i>
        </div>
        <p class="wolf-swal-text" style="text-transform: uppercase;">
          CRITICAL: THIS ACTION CANNOT BE UNDONE. RECORD WILL BE REMOVED FOREVER. PROCEED?
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'DELETE',
      cancelButtonText: 'ABORT',
      reverseButtons: true,
      background: '#111',
      buttonsStyling: false,
      customClass: {
        popup: 'wolf-swal-popup-orange',
        confirmButton: 'wolf-swal-confirm-orange',
        cancelButton: 'wolf-swal-cancel',
      },
    });

    if (!result.isConfirmed) return;

    try {
      // 2. EXECUTE PERMANENT WIPE
      const { error } = await supabaseClient
        .from('trash_bin')
        .delete()
        .eq('id', trashId);

      if (error) throw error;

      // 3. SUCCESS FEEDBACK
      this.showSystemAlert('RECORD_PERMANENTLY_PURGED', 'success');
      if (window.wolfAudio) window.wolfAudio.play('success');

      // 4. REFRESH THE CORRECT LIST (Stay in Sales or Logbook context)
      this.loadTrashItems(mode);
    } catch (err) {
      console.error('Purge Fault:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
      this.showSystemAlert('PURGE_PROTOCOL_FAILED', 'error');
    }
  },

  async restoreSale(trashId, mode) {
    if (!window.Swal) return;

    try {
      const isSales = mode === 'sales';
      const msg = isSales
        ? 'PROCEED WITH RESTORATION: THIS WILL RE-DEDUCT QUANTITY FROM STOCK.'
        : 'PROCEED WITH RESTORATION: THIS RECORD WILL RETURN TO THE LOGBOOK.';

      const result = await Swal.fire({
        title: 'RESTORE PRODUCT?',
        html: `<p class="wolf-swal-text" style="text-transform: uppercase;">${msg}</p>`,
        showCancelButton: true,
        confirmButtonText: 'RESTORE',
        background: '#111',
        buttonsStyling: false,
        customClass: {
          popup: 'wolf-swal-popup-green',
          cancelButton: 'wolf-swal-cancel',
          confirmButton: 'wolf-swal-confirm-green',
        },
      });

      if (!result.isConfirmed) return;

      // 1. FETCH ARCHIVED DATA
      const { data: trashRecord, error: trashError } = await supabaseClient
        .from('trash_bin')
        .select('*')
        .eq('id', trashId)
        .single();

      if (trashError || !trashRecord)
        throw new Error('ARCHIVE_RECORD_NOT_FOUND');

      const rawData = { ...trashRecord.deleted_data };
      const targetTable = isSales ? 'sales' : 'check_in_logs';
      let productInfo = null;

      // 2. FETCH PRODUCT DETAILS (FOR UI CARD)
      if (isSales) {
        const { data: product } = await supabaseClient
          .from('products')
          .select('qty, name, sku')
          .eq('productid', rawData.product_id)
          .single();

        if (product) {
          if (product.qty < rawData.qty && product.qty < 999999)
            throw new Error('INSUFFICIENT_STOCK');

          if (product.qty < 999999) {
            await supabaseClient
              .from('products')
              .update({ qty: product.qty - rawData.qty })
              .eq('productid', rawData.product_id);
          }
          productInfo = { name: product.name, sku: product.sku };
        }
      }

      // 3. DATABASE INSERT (CLEAN PAYLOAD)
      const dbPayload = { ...rawData };
      delete dbPayload.id;
      delete dbPayload.total_amount;
      delete dbPayload.created_at;
      delete dbPayload.products; // Fix for earlier column error

      const { data: restoredRow, error: insertError } = await supabaseClient
        .from(targetTable)
        .insert([dbPayload])
        .select()
        .single();

      if (insertError) throw insertError;

      // 4. CLEANUP TRASH BIN
      await supabaseClient.from('trash_bin').delete().eq('id', trashId);

      // --- 5. THE GLOBAL SYNC (THE FIX) ---
      this.closeTrash(); // Close Archive Terminal
      if (window.wolfData) {
        if (isSales) {
          // A. Update local allSales array immediately
          const uiItem = { ...restoredRow, products: productInfo };
          window.wolfData.allSales = [uiItem, ...window.wolfData.allSales];

          // B. Force the HUD to recalculate from the new array
          const newTotal = window.wolfData.allSales.reduce(
            (sum, s) => sum + Number(s.total_amount || 0),
            0,
          );

          // C. Trigger Rolling Animation via Global Reference
          window.wolfData.refreshSummaryHUD(newTotal);

          // D. Force UI to redraw the cards (Epic Intro will play for the new row)
          window.wolfData.renderSales(window.wolfData.selectedDate.getDay());
        } else {
          // For Logbook, trigger the background refresh
          await window.wolfData.loadLogbook();
        }
        if (typeof window.wolfData.scheduleGoalActualsSync === 'function') {
          window.wolfData.scheduleGoalActualsSync(40);
        }
      }
      if (isSales && productInfo) {
        const restoredQty = rawData.qty || 1; // fallback to 1 if somehow missing
        this.showSystemAlert(
          `${productInfo.name}, X${restoredQty} WAS RESTORED`,
          'success',
        );
        Toastify({
          text: `${productInfo.name}, ${rawData.qty} WAS RESTORED`,
          duration: 4000,
          gravity: 'top',
          position: 'right',
          stopOnFocus: true,
          style: {
            border: '1px solid #77ff00', // correct way to set border color
            background: '#0a0a0a',
            borderRadius: '12px',
            fontWeight: '900',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#fff',
          },
        }).showToast();
      }
      if (window.wolfAudio) window.wolfAudio.play('success');
    } catch (err) {
      console.error('Restore Error:', err);
      if (window.wolfAudio) window.wolfAudio.play('error');
      this.showSystemAlert(err.message.toUpperCase(), 'error');
    }
  },
};

// --- GLOBAL TRIGGER ---
document.addEventListener('click', (e) => {
  if (e.target.closest('#clear-sales-btn')) {
    window.salesManager.openTrashBin();
  }
});
