// --- IMPORT DOMPURIFY FOR SANITIZATION ---
DOMPurify.setConfig({
  FORBID_TAGS: ['img', 'svg', 'script', 'style'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload'],
});

function safeHTML(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['br', 'span', 'i'],
    ALLOWED_ATTR: ['class'],
  });
}

// --- 1. INITIALIZE SUPABASE ---
let supabaseClient = window.supabaseClient || null;

async function ensureSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (window.supabaseReady) {
    await window.supabaseReady;
  }
  supabaseClient = window.supabaseClient || null;
  if (!supabaseClient) {
    throw new Error('Supabase client is not available');
  }
  return supabaseClient;
}

// --- 2. CONFIGURATION ---
const MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60;
const LOGIN_LOCKOUT_MINUTES = 5;
const typewriterWords = [
  'Beyond Strength',
  'Beyond Limit',
  'Wolf Palomar',
  'Secure. Reliable. Fast.',
];

let wordIdx = 0;
let charIdx = 0;
let isDeleting = false;

function typeCarousel() {
  const typewriterEl = document.getElementById('typewriterText');
  if (!typewriterEl) return;

  const currentFullText = typewriterWords[wordIdx];

  // Determine the text to display
  let displayText = currentFullText.substring(0, charIdx);

  // Apply your specific design: Split by space and wrap second word in <span>
  if (displayText.includes(' ')) {
    const parts = displayText.split(' ');
    typewriterEl.innerHTML = safeHTML(
      `${parts[0]} <br> <span>${parts[1]}</span>`,
    );
  } else {
    typewriterEl.innerHTML = displayText;
  }

  // Logic for typing speed
  let typeSpeed = isDeleting ? 50 : 150;

  if (!isDeleting && charIdx === currentFullText.length) {
    // Pause at the end of the word for 3 seconds as requested
    typeSpeed = 3000;
    isDeleting = true;
  } else if (isDeleting && charIdx === 0) {
    isDeleting = false;
    // Move to next word
    wordIdx = (wordIdx + 1) % typewriterWords.length;
    typeSpeed = 500;
  }

  // Adjust char index for next frame
  if (isDeleting) {
    charIdx--;
  } else {
    charIdx++;
  }

  setTimeout(typeCarousel, typeSpeed);
}

// --- UTILS: LOGIN LOCKOUT TIMER ---
let loginTimerInterval = null;

// --- UTILS: GET IP ---
async function getClientIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch {
    return 'unknown_device';
  }
}

function shakeField(el) {
  if (!el) return;
  el.classList.remove('shake-error');
  void el.offsetWidth;
  el.classList.add('shake-error');

  setTimeout(() => {
    el.classList.remove('shake-error');
  }, 420);
}

function startLoginCountdown(seconds) {
  if (loginTimerInterval) clearInterval(loginTimerInterval);
  const loginBtn = document.getElementById('loginBtn');
  const loginOutput = document.getElementById('loginOutput');

  const updateUI = (secs) => {
    if (secs <= 0) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'AUTHORIZE ACCESS';
      loginOutput.textContent = '';
      clearInterval(loginTimerInterval);
      return;
    }
    loginBtn.disabled = true;
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    loginBtn.textContent = `LOCKED: ${mins}m ${remainingSecs}s`;
    loginOutput.style.color = 'var(--wolf-red)';
    loginOutput.textContent = `[ERR_403] Security protocol active. Terminal locked.`;
  };

  let timeLeft = seconds;
  updateUI(timeLeft);
  loginTimerInterval = setInterval(() => {
    timeLeft--;
    updateUI(timeLeft);
  }, 1000);
}

// --- UTILS: CHECK DATABASE LOCKOUT ---
async function checkLoginLockoutStatus() {
  await ensureSupabaseClient();
  const userIP = await getClientIP();
  const { data: log } = await supabaseClient
    .from('login_attempts')
    .select('*')
    .eq('ip_address', userIP)
    .maybeSingle();

  if (log) {
    const diff = (Date.now() - new Date(log.last_attempt_at).getTime()) / 60000;

    // If they hit max attempts and are still within the 5-minute window
    if (log.attempts >= MAX_ATTEMPTS && diff < LOGIN_LOCKOUT_MINUTES) {
      const remainingSeconds = Math.ceil((LOGIN_LOCKOUT_MINUTES - diff) * 60);
      startLoginCountdown(remainingSeconds);
      return true;
    }
    // If 5 minutes passed, reset their record
    else if (diff >= LOGIN_LOCKOUT_MINUTES) {
      await supabaseClient
        .from('login_attempts')
        .delete()
        .eq('ip_address', userIP);
    }
  }
  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await ensureSupabaseClient();
  } catch (err) {
    const loginOutput = document.getElementById('loginOutput');
    if (loginOutput) {
      loginOutput.style.color = 'var(--wolf-red)';
      loginOutput.textContent =
        '[ERR_503] Secure database handshake failed. Try again later.';
    }
    return;
  }

  const inner = document.getElementById('flipCardInner');
  const recoveryContainer = document.getElementById('recoveryContainer');
  const exitModal = document.getElementById('confirmExitModal');
  const resetOutput = document.getElementById('resetOutput');
  const container = document.querySelector('.auth-split-container');
  let otpTimerInterval = null;

  // --- DYNAMIC STAR GENERATOR ---

  setTimeout(() => {
    container.classList.add('is-ready');

    // Play a "System Boot" sound if you have one
    if (window.wolfAudio) window.wolfAudio.play('notif');
  }, 100);
  //createStars();
  typeCarousel();

  // --- LOGIN HANDLER WITH OUTRO ANIMATION ---
  async function handleLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const loginOutput = document.getElementById('loginOutput');
    const loginAgreement = document.getElementById('loginAgreement');

    if (loginBtn.disabled) return;
    loginBtn.disabled = true;
    loginBtn.textContent = 'AUTHORIZING...';
    loginOutput.textContent = '';

    try {
      if (loginAgreement && !loginAgreement.checked) {
        loginOutput.style.color = 'var(--wolf-red)';
        loginOutput.textContent =
          '[ERR_105] Please agree to the data security policy to continue.';
        if (window.wolfAudio) window.wolfAudio.play('denied');
        loginBtn.disabled = false;
        loginBtn.textContent = 'AUTHORIZE ACCESS';
        return;
      }

      const userIP = await getClientIP();
      const isLocked = await checkLoginLockoutStatus();

      if (isLocked) return;

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        shakeField(document.getElementById('password'));
        wolfAudio.play('denied');
        const { data: check } = await supabaseClient
          .from('login_attempts')
          .select('*')
          .eq('ip_address', userIP)
          .maybeSingle();

        let newCount = 1;
        if (check) {
          const diff =
            (Date.now() - new Date(check.last_attempt_at).getTime()) / 60000;
          newCount = diff < LOGIN_LOCKOUT_MINUTES ? check.attempts + 1 : 1;
        }

        await supabaseClient.from('login_attempts').upsert({
          ip_address: userIP,
          attempts: newCount,
          last_attempt_at: new Date().toISOString(),
        });

        if (newCount >= MAX_ATTEMPTS) {
          startLoginCountdown(LOGIN_LOCKOUT_MINUTES * 60);
        } else {
          loginOutput.style.color = 'var(--wolf-red)';
          loginOutput.textContent = `[ERR_101] Access denied. ${MAX_ATTEMPTS - newCount} attempts left.`;
          document.getElementById('password').value = '';
          loginBtn.disabled = false;
          loginBtn.textContent = 'AUTHORIZE ACCESS';
        }
      } else if (data.user.user_metadata.role === 'admin') {
        const container = document.querySelector('.auth-split-container');
        const card = document.querySelector('.flip-card');

        // ------------------------------------------
        // PHASE 1: IDENTITY HANDSHAKE (Intro Anim)
        // ------------------------------------------
        container.classList.add('auth-verifying');
        loginOutput.style.color = 'var(--wolf-blue)';
        loginOutput.innerHTML = safeHTML(
          "<i class='bx bx-loader-alt bx-spin'></i> LOGIN SUCCESSFUL. INITIATING SYSTEM...",
        );

        if (window.wolfAudio) window.wolfAudio.play('notif');

        setTimeout(async () => {
          // ------------------------------------------
          // PHASE 2: TERMINAL EXIT (Outro Anim + Canvas Warp)
          // ------------------------------------------
          window.WOLF_IS_ANIMATING_OUT = true;

          // Clear lockout record
          const userIP = await getClientIP();
          await supabaseClient
            .from('login_attempts')
            .delete()
            .eq('ip_address', userIP);

          if (window.wolfAudio) {
            wolfAudio.play('woosh');
            wolfAudio.play('success');
          }

          // Add outro classes for flip-card and container
          if (container) container.classList.add('outro');
          if (card) card.classList.add('outro');

          loginOutput.style.color = '#4ade80';
          loginOutput.innerHTML = safeHTML(
            "<i class='bx bx-check-shield'></i> ACCESS GRANTED. BOOTING SYSTEM...",
          );

          // --- TRIGGER CANVAS STAR WARP ---
          if (window.triggerStarWarp) {
            window.triggerStarWarp(); // this should be your canvas warp function
          }

          // Final Redirect
          setTimeout(() => {
            window.location.replace('/pages/main.html');
          }, 5000);
        }, 1200);
      } else {
        wolfAudio.play('error');
        loginOutput.textContent = '[ERR_102] Unauthorized role.';
        await supabaseClient.auth.signOut();
        loginBtn.disabled = false;
        loginBtn.textContent = 'AUTHORIZE ACCESS';
      }
    } catch (err) {
      loginOutput.textContent = '[ERR_500] System Fault.';

      if (window.wolfAudio) window.wolfAudio.play('error');
      window.Swal.fire({
        title: '[ERR_500] TERMINAL_FAULT',
        html: `<div style="color:#a63429; font-size:4rem; margin-bottom:15px;"><i class='bx bx-error-alt'></i></div>
               <p style="color:#888; font-size:14px;">CRITICAL_ERROR: ${err.message}</p>`,
        background: '#111',
        buttonsStyling: false,
        customClass: {
          popup: 'wolf-swal-popup wolf-border-red', // RED BORDER
          title: 'wolf-swal-title',
          confirmButton: 'btn-wolf-red',
        },
        confirmButtonText: 'RE-INITIALIZE',
      });

      loginBtn.disabled = false;
    }
  }

  checkLoginLockoutStatus();

  const loginAgreement = document.getElementById('loginAgreement');
  if (loginAgreement) {
    loginAgreement.addEventListener('change', () => {
      if (loginAgreement.checked) {
        const loginOutput = document.getElementById('loginOutput');
        if (
          loginOutput &&
          loginOutput.textContent.includes(
            'Please agree to the data security policy',
          )
        ) {
          loginOutput.textContent = '';
        }
      }
    });
  }

  // --- UTILS: START COOLDOWN TIMER ---
  function startOtpCountdown(seconds) {
    if (otpTimerInterval) clearInterval(otpTimerInterval);

    const updateUI = (secs) => {
      const sendBtn = document.getElementById('sendOtpBtn');
      const resendBtn = document.getElementById('resendOtpBtn');
      const text =
        secs > 0 ? `OTP SENT! WAIT ANOTHER ${secs}s TO SEND AGAIN` : null;

      if (sendBtn) {
        sendBtn.disabled = secs > 0;
        sendBtn.textContent = text || 'SEND SECURITY OTP';
      }
      if (resendBtn) {
        resendBtn.style.pointerEvents = secs > 0 ? 'none' : 'auto';
        resendBtn.style.opacity = secs > 0 ? '0.5' : '1';
        resendBtn.textContent = text || 'RESEND SECURITY CODE';
      }
    };

    let timeLeft = seconds;
    updateUI(timeLeft);

    otpTimerInterval = setInterval(() => {
      timeLeft--;
      updateUI(timeLeft);
      if (timeLeft <= 0) clearInterval(otpTimerInterval);
    }, 1000);
  }

  // --- UTILS: CHECK SUPABASE COOLDOWN ---
  async function checkExistingCooldown() {
    const userIP = await getClientIP();
    const { data } = await supabaseClient
      .from('otp_cooldowns')
      .select('last_sent_at')
      .eq('ip_address', userIP)
      .maybeSingle();

    if (data) {
      const diff = (Date.now() - new Date(data.last_sent_at).getTime()) / 1000;
      if (diff < OTP_COOLDOWN_SECONDS) {
        return Math.ceil(OTP_COOLDOWN_SECONDS - diff);
      }
    }
    return 0;
  }

  // --- UTILS: AJAX LOAD & TRANSITION ---
  async function loadVerifyFragment() {
    try {
      const res = await fetch('pages/verifyotp.html');

      // 1. Get raw HTML
      const rawHTML = await res.text();

      // 2. Sanitize HTML BEFORE parsing
      const cleanHTML = DOMPurify.sanitize(rawHTML, {
        ALLOWED_TAGS: ['div', 'p', 'form', 'input', 'button', 'a', 'span', 'i'],
        ALLOWED_ATTR: [
          'id',
          'class',
          'type',
          'placeholder',
          'required',
          'maxlength',
          'inputmode',
          'pattern',
          'title',
          'href',
          'style',
        ],
      });

      // 3. Parse sanitized HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanHTML, 'text/html');

      // 4. Extract only what you need
      const step2Content = doc.getElementById('recoveryStep2');

      if (step2Content) {
        recoveryContainer.appendChild(step2Content);
        recoveryContainer.classList.add('step1-exit');

        setTimeout(async () => {
          recoveryContainer.classList.add('step2-enter');
          initOtpFields();
          initVerifyForm();

          const remaining = await checkExistingCooldown();
          if (remaining > 0) startOtpCountdown(remaining);
        }, 50);
      }
    } catch (err) {
      resetOutput.textContent = '[ERR_500] Failed to load verification module.';
    }
  }

  // --- OTP REQUEST HANDLER ---
  // 1. Add this variable at the top of your script (outside handleOtpRequest)
  let isProcessingOtp = false;

  // 2. Update your handleOtpRequest function
  async function handleOtpRequest() {
    if (isProcessingOtp) return; // Prevent spamming

    const resetOutput = document.getElementById('resetOutput');
    const sendBtn = document.getElementById('sendOtpBtn');
    const resendBtn = document.getElementById('resendOtpBtn');

    // --- 1. INSTANT FEEDBACK ---
    isProcessingOtp = true;
    resetOutput.style.color = '#888';
    resetOutput.textContent = 'Establishing connection to server...'; // Status message

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'TRANSMITTING...'; // Button loading state
    }
    if (resendBtn) {
      resendBtn.style.pointerEvents = 'none';
      resendBtn.style.opacity = '0.5';
      resendBtn.textContent = 'RESENDING OTP CODES TO EMAIL...';
    }

    const email = document.getElementById('forgotEmail')?.value || '';

    try {
      // Check cooldown in DB first
      const remaining = await checkExistingCooldown();
      if (remaining > 0) {
        startOtpCountdown(remaining);
        resetOutput.style.color = 'var(--wolf-red)';
        resetOutput.textContent = `[ERR_429] Security protocol active. Cooldown in progress.`;
        isProcessingOtp = false;
        return;
      }

      // --- 2. TRANSMISSION STATUS ---
      resetOutput.textContent = 'Checking existing email...';

      const res = await fetch('/.netlify/functions/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        await supabaseClient.from('otp_cooldowns').upsert({
          ip_address: await getClientIP(),
          last_sent_at: new Date().toISOString(),
        });

        startOtpCountdown(60);

        // --- 3. SUCCESS STATUS ---
        wolfAudio.play('notif');
        resetOutput.style.color = '#4ade80';
        resetOutput.textContent = 'Your OTP key has been sent to your email.';

        if (!document.getElementById('recoveryStep2')) {
          await loadVerifyFragment();
        }
      } else {
        // --- 4. ERROR STATUS ---
        wolfAudio.play('error');
        resetOutput.style.color = 'var(--wolf-red)';
        resetOutput.textContent =
          '[ERR_401] Identification failed. Email unauthorized.';
        isProcessingOtp = false;
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = 'SEND SECURITY OTP';
        }
      }
    } catch (err) {
      resetOutput.style.color = 'var(--wolf-red)';
      resetOutput.textContent = '[ERR_503] Gateway timeout. Terminal offline.';
      isProcessingOtp = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'SEND SECURITY OTP';
      }
    } finally {
      setTimeout(() => {
        isProcessingOtp = false;
      }, 1000);
    }
  }

  // --- RESET PASSWORD HANDLER (FOR AJAX INJECTED FORM) ---
  function initVerifyForm() {
    const verifyForm = document.getElementById('verifyResetForm');
    const step2 = document.getElementById('recoveryStep2');
    if (!verifyForm || !step2) return;

    // Target the specific output inside Step 2
    const localOutput = step2.querySelector('#resetOutput');

    verifyForm.onsubmit = async (e) => {
      e.preventDefault();
      const resetBtn = verifyForm.querySelector('button[type="submit"]');

      // 1. INSTANT FEEDBACK
      resetBtn.disabled = true;
      resetBtn.textContent = 'RECONFIGURING...';
      localOutput.style.color = '#888';
      localOutput.textContent = 'Verifying OTP Code Credential...';

      const email = document.getElementById('forgotEmail').value;
      const newPassword = document.getElementById('newPassword').value;
      const otp = Array.from(document.querySelectorAll('.otp-field'))
        .map((f) => f.value)
        .join('');

      try {
        const res = await fetch('/.netlify/functions/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp, newPassword }),
        });

        if (res.ok) {
          wolfAudio.play('success');
          localOutput.style.color = '#4ade80';
          localOutput.textContent = 'Protocol success. Password updated.';
          if (window.wolfAudio) window.wolfAudio.play('success');
          window.Swal.fire({
            title: 'SUCCESS',
            html: `<div style="color:#08ea1b; font-size:4rem; margin-bottom:15px;"><i class='bx bx-check-shield'></i></div>
               <p style="color:#888; font-size:14px;">Credentials re-mapped successfully. Terminal access granted.</p>`,
            background: '#111',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            customClass: {
              popup: 'wolf-swal-popup wolf-border-green', // GREEN BORDER
              title: 'wolf-swal-title',
            },
            didClose: () => {
              location.reload();
            },
          });
        } else {
          const data = await res.json();
          wolfAudio.play('denied');
          localOutput.style.color = 'var(--wolf-red)';
          localOutput.textContent =
            '[ERR_602] Security key invalid or expired.';
          resetBtn.disabled = false;
          resetBtn.textContent = 'RESTORE SYSTEM ACCESS';
        }
      } catch (err) {
        wolfAudio.play('error');
        resetBtn.disabled = false;
        localOutput.style.color = 'var(--wolf-red)';
        localOutput.textContent = '[ERR_500] Database synchronization fault.';
      }
    };
  }

  (async () => {
    const remaining = await checkExistingCooldown();
    if (remaining > 0) startOtpCountdown(remaining);
  })();

  // --- EVENT LISTENERS ---
  document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    handleLogin();
  };

  document.getElementById('otpForm').onsubmit = (e) => {
    e.preventDefault();
    handleOtpRequest('sendOtpBtn');
  };

  // Handle resend OTP button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'resendOtpBtn') {
      e.preventDefault();
      handleOtpRequest('resendOtpBtn');
    }
  });

  document.getElementById('forgotLink').onclick = (e) => {
    e.preventDefault();
    inner.classList.add('flipped');
  };

  // EXIT LOGIC (Event Delegation for AJAX buttons)
  document.addEventListener('click', (e) => {
    // 1. Handle "Forgot Password" flip
    if (e.target.id === 'forgotLink') {
      e.preventDefault();
      document.getElementById('flipCardInner').classList.add('flipped');
    }

    // 2. Handle the "RESEND" link (Works for AJAX injected content)
    if (e.target.id === 'resendOtpBtn' || e.target.closest('#resendOtpBtn')) {
      e.preventDefault();
      console.log('Wolf OS: Resend requested...');
      handleOtpRequest();
    }
    // 3. Handle "Back to Login" triggers
    if (
      e.target.id === 'backToLoginTrigger' ||
      e.target.id === 'backToLoginTriggerSecondary'
    ) {
      e.preventDefault();

      // If we are in the middle of OTP (Step 2 loaded)
      if (document.getElementById('recoveryStep2')) {
        if (window.wolfAudio) window.wolfAudio.play('notif');
        window.Swal.fire({
          title: 'ABANDON RECOVERY?',
          html: `<div style="color:#b47023; font-size:4rem; margin-bottom:15px;"><i class='bx bx-shield-quarter'></i></div>
               <p style="color:#888; font-size:14px;">Terminating handshake will void the current security key. Proceed?</p>`,
          showCancelButton: true,
          confirmButtonText: 'YES, EXIT',
          cancelButtonText: 'STAY',
          reverseButtons: true,
          background: '#111',
          buttonsStyling: false,
          customClass: {
            popup: 'wolf-swal-popup wolf-border-orange', // ORANGE BORDER
            title: 'wolf-swal-title',
            confirmButton: 'btn-wolf-orange',
            cancelButton: 'btn-wolf-secondary',
          },
        }).then((res) => {
          if (res.isConfirmed) location.reload();
        });
      } else {
        inner.classList.remove('flipped');
      }
    }
  });

  document.getElementById('confirmExitBtn').onclick = () => {
    exitModal.style.display = 'none';
    inner.classList.remove('flipped');
    location.reload();
  };

  document.getElementById('cancelExitBtn').onclick = () =>
    (exitModal.style.display = 'none');
  document.getElementById('closeModalBtn').onclick = () => location.reload();
  document.getElementById('descContainer').onclick = function () {
    this.classList.toggle('expanded');
  };

  function initOtpFields() {
    const fields = document.querySelectorAll('.otp-field');

    fields.forEach((f, idx) => {
      // 1. Handle Typing & Numeric Filter
      f.oninput = (e) => {
        // REGEX: Replace any character that is NOT 0-9 with an empty string
        f.value = f.value.replace(/[^0-9]/g, '');

        // Auto-focus next field
        if (f.value && idx < 5) {
          fields[idx + 1].focus();
        }
      };

      // 2. Handle Backspace Navigation
      f.onkeydown = (e) => {
        if (e.key === 'Backspace' && !f.value && idx > 0) {
          fields[idx - 1].focus();
        }
      };

      // 3. Handle Numeric-Only Paste
      f.onpaste = (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData(
          'text',
        );

        // Strip everything except numbers from the pasted text
        const numbersOnly = pasteData.replace(/[^0-9]/g, '');

        // Distribute the digits across the fields starting from current index
        for (
          let i = 0;
          i < numbersOnly.length && idx + i < fields.length;
          i++
        ) {
          fields[idx + i].value = numbersOnly[i];
        }

        // Move focus to the last filled box or the next empty one
        const nextFocus = Math.min(idx + numbersOnly.length, 5);
        fields[nextFocus].focus();
      };
    });
  }
});
