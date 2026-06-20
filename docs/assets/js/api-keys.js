import { getSupabaseClient } from './supabase.js';

const KEY_FIELDS = 'id, key_prefix, label, environment, scopes, rate_limit_per_minute, monthly_usage_limit, status, last_used_at, expires_at, revoked_at, created_at';

export async function readDeveloperApiKeys() {
  const supabase = await getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData?.session?.user?.id || '';
  if (!userId) return [];

  const { data, error } = await supabase
    .from('developer_api_keys')
    .select(KEY_FIELDS)
    .eq('owner_auth_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function issueDeveloperApiKey(values = {}) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('create_developer_api_key', {
    p_label: values.label || 'Default key',
    p_environment: values.environment || 'live',
    p_scopes: [values.scope || 'models.read'],
    p_rate_limit_per_minute: Number(values.rateLimitPerMinute || 60),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.secret) throw new Error('API_KEY_ISSUANCE_FAILED');
  return row;
}

export async function revokeDeveloperApiKey(id) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('revoke_developer_api_key', { p_key_id: id });
  if (error) throw error;
  return data === true;
}
