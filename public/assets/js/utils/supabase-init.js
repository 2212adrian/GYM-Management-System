// assets/js/utils/supabase-init.js
(function () {
  async function bootSupabase() {
    const res = await fetch('/.netlify/functions/supabase-config', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = errJson?.missing?.length
          ? ` Missing: ${errJson.missing.join(', ')}`
          : errJson?.error
            ? ` ${errJson.error}`
            : '';
      } catch (_) {
        // ignore parse errors
      }
      throw new Error(`Failed to load Supabase runtime config.${detail}`);
    }

    const { supabaseUrl, supabaseAnonKey } = await res.json();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase runtime config is incomplete');
    }

    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: window.sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          apikey: supabaseAnonKey,
        },
      },
    });
  }

  window.supabaseReady = bootSupabase()
    .then(() => {
      console.log('Wolf OS: Supabase client initialized from runtime config.');
      return window.supabaseClient;
    })
    .catch((err) => {
      console.error('Wolf OS: Failed to initialize Supabase client.', err);
      return null;
    });
})();
