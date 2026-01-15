// --- 1. INITIALIZE SUPABASE ---
const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. CONFIGURATION ---
const MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 5; // Set to 1 for your testing
const OTP_COOLDOWN_SECONDS = 60; 

document.addEventListener('DOMContentLoaded', async () => {
    // --- UI ELEMENTS ---
    const inner = document.getElementById('flipCardInner');
    const recoveryContainer = document.getElementById('recoveryContainer');
    const loginForm = document.getElementById('loginForm');
    const otpForm = document.getElementById('otpForm');
    const verifyResetForm = document.getElementById('verifyResetForm');
    
    const loginOutput = document.getElementById('loginOutput');
    const resetOutput = document.getElementById('resetOutput');
    const successModal = document.getElementById('successModal');
    const otpFields = document.querySelectorAll('.otp-field');

    // Buttons
    const loginBtn = document.getElementById('loginBtn');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const resetBtn = document.getElementById('resetBtn');

    // --- UTILS: GET IP ---
    async function getClientIP() {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return data.ip;
        } catch { return "unknown_device"; }
    }

    // --- UTILS: SYSTEM ERROR PROTOCOL ---
    function formatError(rawError) {
        let msg = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
        if (msg.includes("User not found") || msg.includes("Invalid login")) return "[ERR_101] Credentials unauthorized.";
        if (msg.includes("rate limit")) return "[ERR_429] Security protocol active. Please wait.";
        if (msg.includes("OTP") || msg.includes("expired")) return "[ERR_602] Security key invalid or expired.";
        return "[ERR_500] System error. Contact administrator.";
    }

    // --- UTILS: VISUAL TIMER ---
    function startVisualTimer(button, seconds, defaultText, isLink = false) {
        if (!button) return;
        button.disabled = true;
        button.style.pointerEvents = "none";
        button.style.opacity = "0.5";

        const timer = setInterval(() => {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
            
            button.textContent = isLink ? `RESEND IN ${timeStr}` : `LOCKED: ${timeStr}`;

            seconds--;
            if (seconds < 0) {
                clearInterval(timer);
                button.disabled = false;
                button.style.pointerEvents = "auto";
                button.style.opacity = "1";
                button.textContent = defaultText;
            }
        }, 1000);
    }

    // --- TRANSITION: STEP 1 -> STEP 2 ---
    function transitionToStep2() {
        recoveryContainer.classList.add('step1-exit');
        setTimeout(() => {
            recoveryContainer.classList.add('step2-enter');
            if (otpFields[0]) otpFields[0].focus();
        }, 50);
    }

    // --- INITIAL CHECKS (IP LOCKOUTS) ---
    async function checkSecurityStatus() {
        const userIP = await getClientIP();

        // Check Login Lockout
        const { data: log } = await supabaseClient.from('login_attempts').select('*').eq('ip_address', userIP).single();
        if (log && log.attempts >= MAX_ATTEMPTS) {
            const diff = (Date.now() - new Date(log.last_attempt_at).getTime()) / 60000;
            if (diff < LOGIN_LOCKOUT_MINUTES) {
                // Fixed: Use 60 seconds multiplier
                startVisualTimer(loginBtn, Math.ceil((LOGIN_LOCKOUT_MINUTES - diff) * 60), "LOGIN");
            } else {
                // Lockout expired, clean up DB
                await supabaseClient.from('login_attempts').delete().eq('ip_address', userIP);
            }
        }

        // Check OTP Cooldown
        const { data: otpLog } = await supabaseClient.from('otp_cooldowns').select('*').eq('ip_address', userIP).single();
        if (otpLog) {
            const diff = (Date.now() - new Date(otpLog.last_sent_at).getTime()) / 1000;
            if (diff < OTP_COOLDOWN_SECONDS) {
                const remaining = Math.ceil(OTP_COOLDOWN_SECONDS - diff);
                startVisualTimer(sendOtpBtn, remaining, "SEND SECURITY OTP");
                startVisualTimer(resendOtpBtn, remaining, "RESEND SECURITY CODE", true);
            }
        }
    }
    checkSecurityStatus();

    // --- AJAX: REQUEST OTP ---
    async function handleOtpRequest() {
        const email = document.getElementById('forgotEmail').value;
        if (!email) {
            resetOutput.textContent = "[ERR_001] Email required.";
            return;
        }
        resetOutput.style.color = "#888";
        resetOutput.textContent = "Verifying your email request...";
        const userIP = await getClientIP();

        const { data: cooldown } = await supabaseClient.from('otp_cooldowns').select('*').eq('ip_address', userIP).single();
        if (cooldown) {
            const diff = (Date.now() - new Date(cooldown.last_sent_at).getTime()) / 1000;
            if (diff < OTP_COOLDOWN_SECONDS) {
                resetOutput.style.color = "var(--wolf-red)";
                resetOutput.textContent = `[ERR_429] Cooldown active. Wait ${Math.ceil(OTP_COOLDOWN_SECONDS - diff)}s.`;
                return;
            }
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = "VERIFYING...";

        try {
            const res = await fetch('/.netlify/functions/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                await supabaseClient.from('otp_cooldowns').upsert({ ip_address: userIP, last_sent_at: new Date().toISOString() });
                resetOutput.style.color = "#4CAF50";
                resetOutput.textContent = "Security key transmitted successfully.";
                startVisualTimer(sendOtpBtn, OTP_COOLDOWN_SECONDS, "SEND SECURITY OTP");
                startVisualTimer(resendOtpBtn, OTP_COOLDOWN_SECONDS, "RESEND SECURITY CODE", true);
                if (!recoveryContainer.classList.contains('step2-enter')) transitionToStep2();
            } else {
                const err = await res.text();
                resetOutput.style.color = "var(--wolf-red)";
                resetOutput.textContent = formatError(err);
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = "SEND SECURITY OTP";
            }
        } catch (err) {
            resetOutput.textContent = "[ERR_503] Gateway timeout.";
            sendOtpBtn.disabled = false;
        }
    }

    // --- RECOVERY EVENTS ---
    if (otpForm) otpForm.addEventListener('submit', (e) => { e.preventDefault(); handleOtpRequest(); });
    if (resendOtpBtn) resendOtpBtn.addEventListener('click', (e) => { e.preventDefault(); handleOtpRequest(); });

    // --- EVENT: VERIFY & RESET ---
    if (verifyResetForm) {
        verifyResetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            resetBtn.disabled = true;
            resetBtn.textContent = "RECONFIGURING...";
            const userIP = await getClientIP();
            const email = document.getElementById('forgotEmail').value;
            const newPassword = document.getElementById('newPassword').value;
            const otp = Array.from(otpFields).map(f => f.value).join('');

            try {
                const res = await fetch('/.netlify/functions/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp, newPassword })
                });

                if (res.ok) {
                    await supabaseClient.from('otp_cooldowns').delete().eq('ip_address', userIP);
                    await supabaseClient.from('login_attempts').delete().eq('ip_address', userIP);
                    successModal.style.display = 'flex';
                } else {
                    const data = await res.json();
                    resetOutput.style.color = "var(--wolf-red)";
                    resetOutput.textContent = formatError(data.error);
                    resetBtn.disabled = false;
                    resetBtn.textContent = "RESET SYSTEM PASSWORD";
                }
            } catch (err) {
                resetOutput.textContent = "[ERR_500] Database update failed.";
                resetBtn.disabled = false;
            }
        });
    }

    // --- LOGIN HANDLER ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const agreement = document.getElementById('loginAgreement');
            if (!agreement.checked) {
                loginOutput.style.color = "var(--wolf-red)";
                loginOutput.textContent = "[ERR_003] You must agree to security protocols.";
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = "VERIFYING...";
            const userIP = await getClientIP();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                // Fetch existing attempts
                const { data: check } = await supabaseClient.from('login_attempts').select('*').eq('ip_address', userIP).single();
                
                let newCount = (check?.attempts || 0) + 1;

                // Check if the previous lockout has already expired
                if (check) {
                    const diff = (Date.now() - new Date(check.last_attempt_at).getTime()) / 60000;
                    if (diff >= LOGIN_LOCKOUT_MINUTES) {
                        newCount = 1; // Reset count because the wait period is over
                    }
                }

                await supabaseClient.from('login_attempts').upsert({ 
                    ip_address: userIP, 
                    attempts: newCount, 
                    last_attempt_at: new Date().toISOString() 
                });
                
                if (newCount >= MAX_ATTEMPTS) {
                    startVisualTimer(loginBtn, LOGIN_LOCKOUT_MINUTES * 60, "LOGIN");
                    loginOutput.textContent = "[ERR_403] Maximum attempts reached. System locked.";
                } else {
                    loginBtn.disabled = false;
                    loginBtn.textContent = "LOGIN";
                    loginOutput.style.color = "var(--wolf-red)";
                    loginOutput.textContent = `[ERR_101] Access denied. ${MAX_ATTEMPTS - newCount} attempts left.`;
                    document.getElementById('password').value = '';
                }
            } else if (data.user.user_metadata.role === 'admin') {
                await supabaseClient.from('login_attempts').delete().eq('ip_address', userIP);
                window.location.replace("dashboard.html");
            } else {
                loginOutput.textContent = "[ERR_102] Unauthorized administrative role.";
                await supabaseClient.auth.signOut();
                loginBtn.disabled = false;
            }
        });
    }

    // --- OTP INPUT UX & UI TOGGLES (Paste/BackToLogin etc) ---
    otpFields.forEach((field, index) => {
        field.addEventListener('input', () => {
            field.value = field.value.replace(/[^0-9]/g, '');
            if (field.value.length === 1 && index < 5) otpFields[index + 1].focus();
        });
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !field.value && index > 0) otpFields[index - 1].focus();
        });
        field.addEventListener('paste', (e) => {
            e.preventDefault();
            const data = e.clipboardData.getData('text').replace(/[^0-9]/g, '').split('');
            data.forEach((char, i) => { if (otpFields[index + i]) otpFields[index + i].value = char; });
            const nextIdx = Math.min(index + data.length, 5);
            if (otpFields[nextIdx]) otpFields[nextIdx].focus();
        });
    });

    document.getElementById('forgotLink').onclick = (e) => { e.preventDefault(); inner.classList.add('flipped'); };
    document.getElementById('backToLogin').onclick = (e) => {
        e.preventDefault();
        if (recoveryContainer.classList.contains('step2-enter')) {
            if (!confirm("Verification in progress. Return to login?")) return;
        }
        inner.classList.remove('flipped');
        setTimeout(() => {
            recoveryContainer.classList.remove('step1-exit', 'step2-enter');
            resetOutput.textContent = "";
            otpForm.reset();
            verifyResetForm.reset();
            otpFields.forEach(f => f.value = '');
        }, 800);
    };

    document.getElementById('closeModalBtn').onclick = () => location.reload();
});