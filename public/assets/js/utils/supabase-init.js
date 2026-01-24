// assets/js/utils/supabase-init.js

const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';

/**
 * WOLF OS: SECURE CLIENT INITIALIZATION
 * We use sessionStorage instead of localStorage.
 * This prevents the session token from persisting after the tab is closed.
 */
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: window.sessionStorage, // <--- THE SECURITY FIX
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

console.log(
  'Wolf OS: Secure Supabase Client Initialized (Session Storage Mode).',
);
