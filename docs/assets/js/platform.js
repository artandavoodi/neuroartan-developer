export const PLATFORM_ORIGIN = (() => {
  const hostname = String(window.location.hostname || '').toLowerCase();
  if (hostname === 'developer.neuroartan.com') return 'https://neuroartan.com';
  return 'http://127.0.0.1:8891';
})();

export const SUPABASE_CONFIG = Object.freeze({
  url: 'https://dwlgvujubkpycrvhngku.supabase.co',
  anonKey: 'sb_publishable_DXA7PoeQgaYGx6Y7ovnwTg_5razlmG8',
});

export function platformAsset(path = '') {
  return `${PLATFORM_ORIGIN}${String(path || '').startsWith('/') ? path : `/${path}`}`;
}

export function createSharedAuthStorage() {
  const hostname = String(window.location.hostname || '').toLowerCase();
  const shareAcrossOrigins = hostname === 'neuroartan.com'
    || hostname.endsWith('.neuroartan.com')
    || hostname === '127.0.0.1'
    || hostname === 'localhost';
  if (!shareAcrossOrigins) return window.localStorage;

  const productionDomain = hostname === 'neuroartan.com' || hostname.endsWith('.neuroartan.com');

  const readCookie = (key) => {
    const prefix = `${encodeURIComponent(key)}=`;
    const value = String(document.cookie || '').split('; ').find((entry) => entry.startsWith(prefix));
    if (!value) return null;
    try { return decodeURIComponent(value.slice(prefix.length)); } catch (_) { return null; }
  };

  const writeCookie = (key, value, maxAge) => {
    document.cookie = [
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      'Path=/',
      'SameSite=Lax',
      ...(productionDomain ? ['Domain=.neuroartan.com', 'Secure'] : []),
      `Max-Age=${maxAge}`,
    ].join('; ');
  };

  return {
    getItem(key) {
      const shared = readCookie(key);
      if (shared !== null) return shared;
      const legacy = window.localStorage.getItem(key);
      if (legacy !== null) writeCookie(key, legacy, 31536000);
      return legacy;
    },
    setItem(key, value) {
      writeCookie(key, value, 31536000);
      window.localStorage.removeItem(key);
    },
    removeItem(key) {
      writeCookie(key, '', 0);
      window.localStorage.removeItem(key);
    },
  };
}
