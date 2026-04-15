/*  ==============================
    Supabase global config
    ============================== */

(function initSupabaseConfig() {
  if (window.__supabaseConfigInitialized) return;
  window.__supabaseConfigInitialized = true;

  const SUPABASE_URL = 'https://xcwdgwvtgbqcsslbgtpy.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_g5USxyN0qcqv9peaZE_irQ_B3QIPV_H';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase SDK 未加载：请检查 @supabase/supabase-js CDN 是否可用');
    window.supabaseClient = null;
    window.db = null;
    return;
  }

  if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // Keep legacy access path used by admin/comments modules.
  window.db = window.supabaseClient;
})();
