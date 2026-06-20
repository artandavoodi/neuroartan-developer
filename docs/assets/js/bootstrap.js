import { PLATFORM_ORIGIN, SUPABASE_CONFIG, platformAsset } from './platform.js';
import { getSupabaseClient } from './supabase.js';
import { issueDeveloperApiKey, readDeveloperApiKeys, revokeDeveloperApiKey } from './api-keys.js';

const state = {
  activePanel: 'overview',
  keys: [],
  user: null,
  profile: null,
  entitlement: null,
};

function appendPlatformStyles() {
  [
    '/assets/css/core/01-tokens/00-tokens-all.css',
    '/assets/css/core/02-foundation/00-foundation-all.css',
    '/assets/css/core/03-primitives/00-primitives-all.css',
    '/assets/css/core/04-systems/00-systems-all.css',
  ].forEach((path) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = platformAsset(path);
    document.head.append(link);
  });
}

async function mountFragment() {
  const response = await fetch('/assets/fragments/console-shell.html', { cache: 'no-store' });
  if (!response.ok) throw new Error('CONSOLE_SHELL_UNAVAILABLE');
  document.getElementById('developer-console-root').innerHTML = await response.text();
}

function icon(path) {
  return `<img class="developer-console__nav-icon ui-icon-theme-aware" src="${platformAsset(`/registry/icons/public/assets/${path}`)}" alt="">`;
}

async function renderNav() {
  const response = await fetch('/assets/data/console-nav.json', { cache: 'no-store' });
  const registry = await response.json();
  const nav = document.querySelector('[data-developer-nav]');
  nav.innerHTML = (registry.items || []).map((item) => `
    <button class="developer-console__nav-item" type="button" data-developer-route="${item.id}" aria-current="${item.id === state.activePanel ? 'page' : 'false'}">
      ${icon(item.icon)}<span>${item.label}</span>
    </button>
  `).join('');
}

function renderAccount() {
  const target = document.querySelector('[data-developer-account]');
  if (!state.user) {
    target.innerHTML = `<a class="developer-console__text-action" href="${platformAsset('/')}" data-developer-sign-in>Sign in</a>`;
    return;
  }
  const profileName = state.profile?.username ? `@${state.profile.username}` : state.user.email || 'Authenticated';
  target.innerHTML = `<span class="developer-console__signed-in">${icon('core/identity/profile/profile.svg')}<span>Signed in as ${profileName}</span></span><button class="developer-console__text-action" type="button" data-developer-sign-out>Sign out</button>`;
}

function formatTier(tier) {
  return String(tier || 'free').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderAccountSummary() {
  const target = document.querySelector('[data-developer-account-summary]');
  if (!state.user) {
    target.innerHTML = `<a class="developer-console__account-sign-in" href="${platformAsset('/')}" data-developer-sign-in>${icon('core/identity/account/account.svg')}<span>Sign in to manage API access</span></a>`;
    return;
  }

  const profileName = state.profile?.display_name || state.profile?.username || state.user.email || 'Authenticated';
  const profileId = state.profile?.id || state.user.id;
  target.innerHTML = `
    <div class="developer-console__account-heading">${icon('core/identity/account/account.svg')}<span>Account</span></div>
    <strong>${profileName}</strong>
    ${state.profile?.username ? `<span class="developer-console__account-handle">@${state.profile.username}</span>` : ''}
    <span class="developer-console__account-id" title="${profileId}">Profile ${profileId.slice(0, 8)}</span>
    <div class="developer-console__account-tier">${icon('core/commerce/subscriptions/subscription.svg')}<span>${formatTier(state.entitlement?.subscription_tier)}</span></div>
  `;
}

function renderSummary() {
  const target = document.querySelector('[data-developer-summary]');
  if (!state.user) {
    target.innerHTML = '<div class="developer-console__empty">Sign in with your Neuroartan account to manage API access.</div>';
    return;
  }
  const active = state.keys.filter((key) => key.status === 'active');
  target.innerHTML = `
    <div class="developer-console__summary-row"><span>Active API keys</span><strong>${active.length}</strong></div>
    <div class="developer-console__summary-row"><span>Canonical profile</span><strong>${state.profile?.username ? `@${state.profile.username}` : 'Available'}</strong></div>
    <div class="developer-console__summary-row"><span>Subscription</span><strong>${formatTier(state.entitlement?.subscription_tier)}</strong></div>
    <div class="developer-console__summary-row"><span>Gateway</span><code>${SUPABASE_CONFIG.url}/functions/v1/developer-api-gateway/v1/models/current</code></div>
  `;
}

function renderKeys() {
  const target = document.querySelector('[data-developer-key-list]');
  if (!state.user) {
    target.innerHTML = '<div class="developer-console__empty">Sign in to view your API keys.</div>';
    return;
  }
  if (!state.keys.length) {
    target.innerHTML = '<div class="developer-console__empty">No API keys issued.</div>';
    return;
  }
  target.innerHTML = state.keys.map((key) => `
    <article class="developer-console__key-row">
      <div class="developer-console__key-meta">
        <strong>${key.label}</strong>
        <span>${key.key_prefix}... · ${key.environment} · ${key.rate_limit_per_minute}/min · ${key.status}</span>
      </div>
      ${key.status === 'active' ? `<button class="developer-console__text-action" type="button" data-developer-key-revoke="${key.id}">Revoke</button>` : ''}
    </article>
  `).join('');
}

function setActivePanel(panelId) {
  state.activePanel = panelId;
  document.querySelectorAll('[data-developer-panel]').forEach((panel) => { panel.hidden = panel.dataset.developerPanel !== panelId; });
  document.querySelectorAll('[data-developer-route]').forEach((route) => route.setAttribute('aria-current', route.dataset.developerRoute === panelId ? 'page' : 'false'));
}

function setDialogOpen(open) {
  const dialog = document.querySelector('[data-developer-key-dialog]');
  dialog.hidden = !open;
  dialog.setAttribute('aria-hidden', String(!open));
}

async function hydrateIdentity() {
  const supabase = await getSupabaseClient();
  const { data: sessionData, error } = await supabase.auth.getSession();
  if (error) throw error;
  state.user = sessionData?.session?.user || null;
  state.profile = null;
  state.entitlement = null;
  state.keys = [];
  if (!state.user) return;

  const [{ data: profile }, keys] = await Promise.all([
    supabase.from('profiles').select('id, username, username_lower, display_name').eq('auth_user_id', state.user.id).maybeSingle(),
    readDeveloperApiKeys(),
  ]);
  state.profile = profile || null;
  state.keys = keys;

  if (!profile?.id) return;

  const { data: model } = await supabase
    .from('models')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('owner_auth_user_id', state.user.id)
    .maybeSingle();
  if (!model?.id) return;

  const { data: entitlement } = await supabase
    .from('model_entitlement_state')
    .select('subscription_tier')
    .eq('model_id', model.id)
    .maybeSingle();
  state.entitlement = entitlement || null;
}

async function issueKey(form) {
  const result = document.querySelector('[data-developer-secret-result]');
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    const key = await issueDeveloperApiKey(values);
    result.hidden = false;
    result.innerHTML = `<strong>Copy this key now. It will not be shown again.</strong><code>${key.secret}</code><button class="developer-console__text-action" type="button" data-developer-secret-copy="${key.secret}">Copy</button>`;
    state.keys = await readDeveloperApiKeys();
    renderSummary();
    renderKeys();
  } finally {
    submit.disabled = false;
  }
}

function bindEvents() {
  document.addEventListener('click', async (event) => {
    const route = event.target.closest('[data-developer-route]');
    if (route) return setActivePanel(route.dataset.developerRoute);
    if (event.target.closest('[data-developer-issue-open]')) return setDialogOpen(true);
    if (event.target.closest('[data-developer-key-close]')) return setDialogOpen(false);
    if (event.target.closest('[data-developer-sign-out]')) {
      const supabase = await getSupabaseClient();
      await supabase.auth.signOut();
      await hydrateIdentity();
      renderAccount(); renderAccountSummary(); renderSummary(); renderKeys();
      return;
    }
    const revoke = event.target.closest('[data-developer-key-revoke]');
    if (revoke) {
      await revokeDeveloperApiKey(revoke.dataset.developerKeyRevoke);
      state.keys = await readDeveloperApiKeys();
      renderSummary(); renderKeys();
      return;
    }
    const copy = event.target.closest('[data-developer-secret-copy]');
    if (copy) await navigator.clipboard?.writeText(copy.dataset.developerSecretCopy || '');
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-developer-key-form]');
    if (!form) return;
    event.preventDefault();
    await issueKey(form);
  });
}

async function boot() {
  appendPlatformStyles();
  await mountFragment();
  await renderNav();
  await hydrateIdentity();
  renderAccount(); renderAccountSummary(); renderSummary(); renderKeys(); bindEvents();
}

boot().catch((error) => {
  console.error('[Neuroartan Developer] Bootstrap failed.', error);
  document.getElementById('developer-console-root').textContent = 'Developer console could not be initialized.';
});
