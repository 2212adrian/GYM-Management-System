// Public client config for Supabase.
// Values are injected at build time by scripts/build.mjs using environment vars.
// This file must never contain service role keys.
(function () {
  window.WOLF_SUPABASE_PUBLIC_CONFIG = {
    supabaseUrl: '__WOLF_SUPABASE_URL__',
    supabaseAnonKey: '__WOLF_SUPABASE_ANON_KEY__',
  };
})();

