// --- 1. INITIALIZE SUPABASE ---
const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. CONFIGURATION ---
const MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60; 
const LOGIN_LOCKOUT_MINUTES = 5; 
const words = ["Beyond Strength", "Beyond Limit", "Wolf Palomar", "Secure. Reliable. Fast."];
// --- UTILS: LOGIN LOCKOUT TIMER ---
let loginTimerInterval = null;

// --- UTILS: GET IP ---
    async function getClientIP() {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return data.ip;
        } catch { return "unknown_device"; }
    }

function startLoginCountdown(seconds) {
    if (loginTimerInterval) clearInterval(loginTimerInterval);
    const loginBtn = document.getElementById('loginBtn');
    const loginOutput = document.getElementById('loginOutput');

    const updateUI = (secs) => {
        if (secs <= 0) {
            loginBtn.disabled = false;
            loginBtn.textContent = "AUTHORIZE ACCESS";
            loginOutput.textContent = "";
            clearInterval(loginTimerInterval);
            return;
        }
        loginBtn.disabled = true;
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        loginBtn.textContent = `LOCKED: ${mins}m ${remainingSecs}s`;
        loginOutput.style.color = "var(--wolf-red)";
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
    const userIP = await getClientIP();
    const { data: log } = await supabaseClient.from('login_attempts').select('*').eq('ip_address', userIP).single();

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
            await supabaseClient.from('login_attempts').delete().eq('ip_address', userIP);
        }
    }
    return false;
}

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

    // --- LOGIN HANDLER WITH OUTRO ANIMATION ---
    async function handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        const loginOutput = document.getElementById('loginOutput');
        const userIP = await getClientIP();

        // 1. Pre-check lockout
        const isLocked = await checkLoginLockoutStatus();
        if (isLocked) return;

        loginBtn.disabled = true;
        loginBtn.textContent = "AUTHORIZING...";

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                wolfAudio.play('denied');
                const { data: check } = await supabaseClient.from('login_attempts').select('*').eq('ip_address', userIP).single();
                let newCount = 1;

                if (check) {
                    const diff = (Date.now() - new Date(check.last_attempt_at).getTime()) / 60000;
                    // If they wait > 5 mins, start fresh at 1, otherwise increment
                    newCount = diff < LOGIN_LOCKOUT_MINUTES ? check.attempts + 1 : 1;
                }

                await supabaseClient.from('login_attempts').upsert({
                    ip_address: userIP,
                    attempts: newCount,
                    last_attempt_at: new Date().toISOString()
                });

                if (newCount >= MAX_ATTEMPTS) {
                    startLoginCountdown(LOGIN_LOCKOUT_MINUTES * 60);
                } else {
                    loginOutput.style.color = "var(--wolf-red)";
                    loginOutput.textContent = `[ERR_101] Access denied. ${MAX_ATTEMPTS - newCount} attempts left.`;
                    loginBtn.disabled = false;
                    loginBtn.textContent = "AUTHORIZE ACCESS";
                    document.getElementById('password').value = '';
                }
            } else if (data.user.user_metadata.role === 'admin') {
                // SUCCESS: Clear lockout record and animate out
                wolfAudio.play('success');
                await supabaseClient.from('login_attempts').delete().eq('ip_address', userIP);

                const container = document.querySelector('.auth-split-container');
                const card = document.querySelector('.flip-card');
                if (container) container.classList.add('outro');
                if (card) card.classList.add('outro');

                setTimeout(() => {
                    window.location.replace("/pages/main.html");
                }, 2000);
            } else {
                wolfAudio.play('error'); 
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

    checkLoginLockoutStatus();

    // --- UTILS: START COOLDOWN TIMER ---
    function startOtpCountdown(seconds) {
        if (otpTimerInterval) clearInterval(otpTimerInterval);
        
        const updateUI = (secs) => {
            const sendBtn = document.getElementById('sendOtpBtn');
            const resendBtn = document.getElementById('resendOtpBtn');
            const text = secs > 0 ? `OTP SENT! WAIT ANOTHER ${secs}s TO SEND AGAIN` : null;

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
    resetOutput.style.color = "#888";
    resetOutput.textContent = "Establishing connection to server..."; // Status message

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "TRANSMITTING..."; // Button loading state
    }
    if (resendBtn) {
        resendBtn.style.pointerEvents = "none";
        resendBtn.style.opacity = "0.5";
        resendBtn.textContent = "RESENDING OTP CODES TO EMAIL...";
    }

    const email = document.getElementById('forgotEmail')?.value || '';

    try {
        // Check cooldown in DB first
        const remaining = await checkExistingCooldown();
        if (remaining > 0) {
            startOtpCountdown(remaining);
            resetOutput.style.color = "var(--wolf-red)";
            resetOutput.textContent = `[ERR_429] Security protocol active. Cooldown in progress.`;
            isProcessingOtp = false;
            return;
        }

        // --- 2. TRANSMISSION STATUS ---
        resetOutput.textContent = "Checking existing email...";

        const res = await fetch('/.netlify/functions/request-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (res.ok) {
            await supabaseClient.from('otp_cooldowns').upsert({ 
                ip_address: await getClientIP(), 
                last_sent_at: new Date().toISOString() 
            });

            startOtpCountdown(60);

            // --- 3. SUCCESS STATUS ---
            wolfAudio.play('notif'); 
            resetOutput.style.color = "#4ade80";
            resetOutput.textContent = "Your OTP key has been sent to your email.";

            if (!document.getElementById('recoveryStep2')) {
                await loadVerifyFragment();
            }
        } else {
            // --- 4. ERROR STATUS ---
            wolfAudio.play('error'); 
            resetOutput.style.color = "var(--wolf-red)";
            resetOutput.textContent = "[ERR_401] Identification failed. Email unauthorized.";
            isProcessingOtp = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = "SEND SECURITY OTP";
            }
        }
    } catch (err) {
        resetOutput.style.color = "var(--wolf-red)";
        resetOutput.textContent = "[ERR_503] Gateway timeout. Terminal offline.";
        isProcessingOtp = false;
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = "SEND SECURITY OTP";
        }
    } finally {
        setTimeout(() => { isProcessingOtp = false; }, 1000);
    }
}

    // --- RESET PASSWORD HANDLER (FOR AJAX INJECTED FORM) ---
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
            resetBtn.textContent = "RECONFIGURING...";
            localOutput.style.color = "#888";
            localOutput.textContent = "Verifying OTP Code Credential...";

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
                    wolfAudio.play('success')
                    localOutput.style.color = "#4ade80";
                    localOutput.textContent = "Protocol success. Password updated.";
                    document.getElementById('successModal').style.display = 'flex';
                } else {
                    const data = await res.json();
                    wolfAudio.play('denied')
                    localOutput.style.color = "var(--wolf-red)";
                    localOutput.textContent = "[ERR_602] Security key invalid or expired.";
                    resetBtn.disabled = false;
                    resetBtn.textContent = "RESTORE SYSTEM ACCESS";
                }
            } catch (err) {
                wolfAudio.play('error');
                resetBtn.disabled = false;
                localOutput.style.color = "var(--wolf-red)";
                localOutput.textContent = "[ERR_500] Database synchronization fault.";
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
                wolfAudio.play('notif');
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
                const pasteData = (e.clipboardData || window.clipboardData).getData('text');
                
                // Strip everything except numbers from the pasted text
                const numbersOnly = pasteData.replace(/[^0-9]/g, ''); 

                // Distribute the digits across the fields starting from current index
                for (let i = 0; i < numbersOnly.length && (idx + i) < fields.length; i++) {
                    fields[idx + i].value = numbersOnly[i];
                }

                // Move focus to the last filled box or the next empty one
                const nextFocus = Math.min(idx + numbersOnly.length, 5);
                fields[nextFocus].focus();
            };
        });
    }
});