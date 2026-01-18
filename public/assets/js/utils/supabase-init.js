// assets/js/utils/supabase-init.js

const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
const supabaseKey = 'sb_publishable_mQ_GJf4mu4nC0uGpR7QkVQ_PXKlR6HT';

// We name it supabaseClient to avoid clashing with the global 'supabase' library object
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("Wolf OS: Supabase Client Initialized.");