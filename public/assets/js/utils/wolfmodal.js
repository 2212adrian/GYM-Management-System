window.wolfModal = {
  async init() {
    if (document.getElementById('wolf-modal-confirm')) return true;
    const res = await fetch('/assets/components/wolf-modal.html');
    const html = await res.text();
    document.body.insertAdjacentHTML('beforeend', html);
    return true;
  },

  /**
   * @param {Object} options { title, message, icon, confirmText, cancelText, type }
   * @returns Promise<boolean>
   */
  async confirm({
    title,
    message,
    icon = 'bx-shield-quarter',
    confirmText = 'PROCEED',
    cancelText = 'CANCEL',
    type = 'warning',
  }) {
    await this.init();

    const overlay = document.getElementById('wolf-modal-confirm');
    const box = document.getElementById('wolf-modal-box');
    const titleEl = document.getElementById('wolf-modal-title');
    const msgEl = document.getElementById('wolf-modal-msg');
    const iconEl = document.getElementById('wolf-modal-icon');
    const confirmBtn = document.getElementById('wolf-modal-confirm-btn');
    const cancelBtn = document.getElementById('wolf-modal-cancel-btn');

    // Setup Content
    titleEl.innerText = title;
    msgEl.innerText = message;
    iconEl.className = `bx wolf-confirm-icon ${icon}`;
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;
    box.className = `wolf-confirm-container ${type}`;

    overlay.style.display = 'flex';
    if (window.wolfAudio) window.wolfAudio.play('notif');

    return new Promise((resolve) => {
      confirmBtn.onclick = () => {
        overlay.style.display = 'none';
        resolve(true);
      };
      cancelBtn.onclick = () => {
        overlay.style.display = 'none';
        resolve(false);
      };
    });
  },
};

// Use this for reference
//const confirmed = await window.wolfModal.confirm({
//      title: 'RESTORE ASSET',
//      message:
//        'PROCEED WITH RESTORATION: This will re-deduct quantity from stock. Continue?',
//      icon: 'bx-undo',
//      confirmText: 'AUTHORIZE RESTORE',
//      cancelText: 'ABORT',
//      type: 'warning',
//    });
//
//    if (!confirmed) return;
