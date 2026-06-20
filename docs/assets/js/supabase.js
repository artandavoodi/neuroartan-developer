import { SUPABASE_CONFIG, createSharedAuthStorage, platformAsset } from './platform.js';

let clientPromise = null;

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-developer-supabase="${source}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = source;
    script.async = true;
    script.dataset.developerSupabase = source;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('SUPABASE_LIBRARY_UNAVAILABLE')), { once: true });
    document.head.append(script);
  });
}

export async function getSupabaseClient() {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    await loadScript(platformAsset('/assets/vendor/supabase/supabase-js.umd.js'));
    const createClient = window.supabase?.createClient;
    if (typeof createClient !== 'function') throw new Error('SUPABASE_CLIENT_UNAVAILABLE');

    return createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: createSharedAuthStorage(),
      },
    });
  })();

  return clientPromise;
}
