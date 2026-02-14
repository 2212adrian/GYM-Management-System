// assets/js/utils/supabase-init.js
(function () {
  const REMEMBER_DEVICE_KEY = 'wolf_remember_device';

  function shouldRememberDevice() {
    try {
      return window.localStorage.getItem(REMEMBER_DEVICE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function setRememberDevice(value) {
    try {
      if (value) {
        window.localStorage.setItem(REMEMBER_DEVICE_KEY, '1');
      } else {
        window.localStorage.removeItem(REMEMBER_DEVICE_KEY);
      }
    } catch (_) {
      // ignore storage failures
    }
  }

  const hybridStorage = {
    getItem(key) {
      try {
        if (shouldRememberDevice()) {
          const localValue = window.localStorage.getItem(key);
          if (localValue != null) return localValue;
          return window.sessionStorage.getItem(key);
        }
        return window.sessionStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    setItem(key, value) {
      try {
        if (shouldRememberDevice()) {
          window.localStorage.setItem(key, value);
          window.sessionStorage.removeItem(key);
          return;
        }
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      } catch (_) {
        // ignore storage failures
      }
    },
    removeItem(key) {
      try {
        window.sessionStorage.removeItem(key);
        window.localStorage.removeItem(key);
      } catch (_) {
        // ignore storage failures
      }
    },
  };

  window.wolfAuthStorage = {
    shouldRememberDevice,
    setRememberDevice,
  };

  function isNonEmptyRuntimeValue(value) {
    const raw = String(value || '').trim();
    return raw.length > 0 && !raw.startsWith('__WOLF_SUPABASE_');
  }

  function getPublicSupabaseConfig() {
    const cfg = window.WOLF_SUPABASE_PUBLIC_CONFIG || {};
    const supabaseUrl = String(cfg.supabaseUrl || '').trim();
    const supabaseAnonKey = String(cfg.supabaseAnonKey || '').trim();
    if (!isNonEmptyRuntimeValue(supabaseUrl)) return null;
    if (!isNonEmptyRuntimeValue(supabaseAnonKey)) return null;
    return { supabaseUrl, supabaseAnonKey };
  }

  async function fetchSupabaseConfigFromFunction() {
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
    return { supabaseUrl, supabaseAnonKey };
  }

  async function bootSupabase() {
    const directConfig = getPublicSupabaseConfig();
    const { supabaseUrl, supabaseAnonKey } =
      directConfig || (await fetchSupabaseConfigFromFunction());

    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: hybridStorage,
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
