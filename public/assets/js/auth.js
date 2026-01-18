// --- 1. INITIALIZE SUPABASE ---
const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. CONFIGURATION ---
const MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60; 
const LOGIN_LOCKOUT_MINUTES = 5; 

document.addEventListener('DOMContentLoaded', () => {
    const inner = document.getElementById('flipCardInner');
    const recoveryContainer = document.getElementById('recoveryContainer');
    const exitModal = document.getElementById('confirmExitModal');
    const resetOutput = document.getElementById('resetOutput');
    let otpTimerInterval = null;
    // --- restored: DYNAMIC STAR GENERATOR ---
    // Add this inside your DOMContentLoaded listener
    const createStars = () => {
        const container = document.getElementById('starContainer');
        if (!container) return;

        // Clear existing stars to prevent duplicates on refresh
        container.querySelectorAll('.star').forEach(s => s.remove());

        const starCount = 40; // Number of stars

        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';

            // Random Position
            const x = Math.random() * 100;
            const y = Math.random() * 100;

            // Random Size (1px to 3px)
            const size = Math.random() * 2 + 1;

            // Random Animation Duration (3s to 7s)
            const duration = Math.random() * 4 + 3;

            // Random Delay (0s to 5s)
            const delay = Math.random() * 5;

            star.style.left = `${x}%`;
            star.style.top = `${y}%`;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.animationDuration = `${duration}s`;
            star.style.animationDelay = `${delay}s`;

            container.appendChild(star);
        }
    };

    // Call it immediately
    createStars();

    // --- restored: TYPEWRITER ENGINE ---
    const words = ["Beyond Strength", "Beyond Limit", "Wolf Palomar", "Secure. Reliable. Fast."];
    let wordIdx = 0, charIdx = 0, isDeleting = false;
    function type() {
        const typewriterEl = document.getElementById('typewriterText');
        if (!typewriterEl) return;
        
        const current = words[wordIdx];
        const display = isDeleting ? current.substring(0, charIdx--) : current.substring(0, charIdx++);
        
        typewriterEl.innerHTML = display.replace(" ", "<br> <span>") + "</span>";
        
        let speed = isDeleting ? 50 : 150;
        if (!isDeleting && charIdx === current.length + 1) { 
            speed = 3000; 
            isDeleting = true; 
        } else if (isDeleting && charIdx === 0) { 
            speed = 500; 
            isDeleting = false; 
            wordIdx = (wordIdx + 1) % words.length; 
        }
        setTimeout(type, speed);
    }
    type();

    // --- UTILS: GET IP ---
    async function getClientIP() {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return data.ip;
        } catch { return "unknown_device"; }
    }

    // --- UTILS: START COOLDOWN TIMER ---
    function startOtpCountdown(seconds) {
        if (otpTimerInterval) clearInterval(otpTimerInterval);
        
        const updateUI = (secs) => {
            const sendBtn = document.getElementById('sendOtpBtn');
            const resendBtn = document.getElementById('resendOtpBtn');
            const text = secs > 0 ? `WAIT ${secs}s` : null;

            if (sendBtn) {
                sendBtn.disabled = secs > 0;
                sendBtn.textContent = text || "SEND SECURITY OTP";
            }
            if (resendBtn) {
                resendBtn.style.pointerEvents = secs > 0 ? "none" : "auto";
                resendBtn.style.opacity = secs > 0 ? "0.5" : "1";
                resendBtn.textContent = text || "RESEND SECURITY CODE";
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
            .single();

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
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const step2Content = doc.getElementById('recoveryStep2');
            
            if (step2Content) {
                recoveryContainer.appendChild(step2Content);
                recoveryContainer.classList.add('step1-exit');
                
                setTimeout(async () => {
                    recoveryContainer.classList.add('step2-enter');
                    initOtpFields(); 
                    initVerifyForm();
                    
                    // Check if timer should be active on the new RESEND button
                    const remaining = await checkExistingCooldown();
                    if (remaining > 0) startOtpCountdown(remaining);
                }, 50); 
            }
        } catch (err) {
            resetOutput.textContent = "[ERR_500] Failed to load verification module.";
        }
    }

    // --- LOGIN HANDLER WITH OUTRO ANIMATION ---
    async function handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        const loginOutput = document.getElementById('loginOutput');

        loginBtn.disabled = true;
        loginBtn.textContent = "AUTHORIZING...";

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                loginOutput.style.color = "var(--wolf-red)";
                loginOutput.textContent = "[ERR_401] Access denied.";
                loginBtn.disabled = false;
                loginBtn.textContent = "AUTHORIZE ACCESS";
            } else if (data.user.user_metadata.role === 'admin') {
                // restored: TRIGGER CINEMATIC OUTRO
                const container = document.querySelector('.auth-split-container');
                const card = document.querySelector('.flip-card');
                
                if (container) container.classList.add('outro');
                if (card) card.classList.add('outro');

                loginOutput.style.color = "#4ade80";
                loginOutput.textContent = "Identity Verified. Accessing Terminal...";

                // Wait for the CSS outro animation to finish (2 seconds)
                setTimeout(() => {
                    window.location.replace("/pages/main.html");
                }, 2000);
            } else {
                loginOutput.textContent = "[ERR_102] Unauthorized role.";
                await supabaseClient.auth.signOut();
                loginBtn.disabled = false;
                loginBtn.textContent = "AUTHORIZE ACCESS";
            }
        } catch (err) {
            loginOutput.textContent = "[ERR_500] System Fault.";
            loginBtn.disabled = false;
        }
    }

    // --- OTP COOLDOWN MANAGEMENT ---
    let countdownInterval = null;
    let cooldownEndTime = null; // Store when cooldown should end
    
    async function checkOtpCooldown() {
        try {
            const response = await fetch('/.netlify/functions/check-otp-cooldown');
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('Cooldown check failed:', err);
            // For local development, implement client-side cooldown
            if (cooldownEndTime && Date.now() < cooldownEndTime) {
                const remainingTime = Math.ceil((cooldownEndTime - Date.now()) / 1000);
                return { canSend: false, remainingTime };
            }
            return { canSend: true, remainingTime: 0 };
        }
    }
    
    async function updateOtpCooldown() {
        try {
            await fetch('/.netlify/functions/update-otp-cooldown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error('Cooldown update failed:', err);
            // For local development, set client-side cooldown
            cooldownEndTime = Date.now() + (60 * 1000); // 60 seconds from now
        }
    }
    
    function startCountdown(seconds, button) {
        // Clear any existing countdown
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        // Store original button text
        const originalText = button.getAttribute('data-original-text') || button.textContent;
        if (!button.getAttribute('data-original-text')) {
            button.setAttribute('data-original-text', originalText);
        }
        
        let timeLeft = seconds;
        button.disabled = true;
        button.textContent = `WAIT ${timeLeft}s`;
        
        countdownInterval = setInterval(() => {
            timeLeft--;
            button.textContent = `WAIT ${timeLeft}s`;
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                button.disabled = false;
                button.textContent = originalText;
                button.removeAttribute('data-original-text');
            }
        }, 1000);
    }

    // --- OTP REQUEST HANDLER ---
    // 1. Add this variable at the top of your script (outside handleOtpRequest)
    let isProcessingOtp = false;

    // 2. Update your handleOtpRequest function
    async function handleOtpRequest() {
        if (isProcessingOtp) return; // Prevent spamming

            const resetOutput = document.getElementById('resetOutput');
            const sendBtn = document.getElementById('sendOtpBtn');
            const resendBtn = document.getElementById('resendOtpBtn'); // Injected via AJAX
        // INSTANT UI LOCK
        isProcessingOtp = true;
        if (sendBtn) sendBtn.disabled = true;
        if (resendBtn) {
            resendBtn.style.pointerEvents = "none";
            resendBtn.style.opacity = "0.5";
        }

        const email = document.getElementById('forgotEmail')?.value || '';

        try {
            // 1. Check DB Cooldown
            const remaining = await checkExistingCooldown();
            if (remaining > 0) {
                startOtpCountdown(remaining); // Resume visual timer
                isProcessingOtp = false; // Unlock guard
                return;
            }

            // 2. Request OTP from Netlify Function
            const res = await fetch('/.netlify/functions/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                // 3. Log success to Supabase
                await supabaseClient.from('otp_cooldowns').upsert({ 
                    ip_address: await getClientIP(), 
                    last_sent_at: new Date().toISOString() 
                });

                startOtpCountdown(60); // Start 1-minute timer

                // 4. Load fragment only if it's the first time
                if (!document.getElementById('recoveryStep2')) {
                    await loadVerifyFragment();
                } else {
                    resetOutput.style.color = "#4ade80";
                    resetOutput.textContent = "Your security code has been resent to your email.";
                }
            } else {
                resetOutput.textContent = "[ERR_401] Authorization failed.";
                isProcessingOtp = false; // Unlock guard on error
            }
        } catch (err) {
            isProcessingOtp = false; // Unlock guard on network error
        } finally {
            // Ensure buttons return to a clickable state if no timer is running
            setTimeout(() => { isProcessingOtp = false; }, 1000);
        }
    }

    // --- RESET PASSWORD HANDLER (FOR AJAX INJECTED FORM) ---
    function initVerifyForm() {
        const verifyForm = document.getElementById('verifyResetForm');
        if (!verifyForm) return;

        verifyForm.onsubmit = async (e) => {
            e.preventDefault();
            const resetBtn = verifyForm.querySelector('button[type="submit"]');
            resetBtn.disabled = true;
            resetBtn.textContent = "RESTORING...";

            const email = document.getElementById('forgotEmail').value;
            const newPassword = document.getElementById('newPassword').value;
            const otp = Array.from(document.querySelectorAll('.otp-field')).map(f => f.value).join('');

            try {
                const res = await fetch('/.netlify/functions/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp, newPassword })
                });

                if (res.ok) {
                    document.getElementById('successModal').style.display = 'flex';
                } else {
                    resetOutput.style.color = "var(--wolf-red)";
                    resetOutput.textContent = "[ERR_602] Invalid or expired key.";
                    resetBtn.disabled = false;
                    resetBtn.textContent = "RESTORE SYSTEM ACCESS";
                }
            } catch (err) {
                resetBtn.disabled = false;
                resetOutput.textContent = "[ERR_500] Database fault.";
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

    document.getElementById('forgotLink').onclick = (e) => { e.preventDefault(); inner.classList.add('flipped'); };

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
            console.log("Wolf OS: Resend requested...");
            handleOtpRequest();
        }
        // 3. Handle "Back to Login" triggers
        if (e.target.id === 'backToLoginTrigger' || e.target.id === 'backToLoginTriggerSecondary') {
            e.preventDefault();
            if (document.getElementById('recoveryStep2')) {
                exitModal.style.display = 'flex';
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

    document.getElementById('cancelExitBtn').onclick = () => exitModal.style.display = 'none';
    document.getElementById('closeModalBtn').onclick = () => location.reload();
    document.getElementById('descContainer').onclick = function() { this.classList.toggle('expanded'); };

    function initOtpFields() {
        const fields = document.querySelectorAll('.otp-field');
        fields.forEach((f, idx) => {
            f.oninput = () => { if (f.value && idx < 5) fields[idx+1].focus(); };
            f.onkeydown = (e) => { if (e.key === 'Backspace' && !f.value && idx > 0) fields[idx-1].focus(); };
            f.onpaste = (e) => {
                e.preventDefault();
                const pasteNumbers = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                for (let i = 0; i < pasteNumbers.length && idx + i < fields.length; i++) {
                    fields[idx + i].value = pasteNumbers[i];
                    if (idx + i < 5) fields[idx + i + 1].focus();
                }
            };
        });
    }
});