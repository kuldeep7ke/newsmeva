import { t } from './i18n.js';
import { refreshIcons } from './components.js';

// Broadcast pills + promo banner, delivered from a single jsonbin.io bin via
// the Cloudflare edge-cached proxy. Any authorized site can edit the bin on
// jsonbin.io and the pill/banner shows here within the TTL window — no app
// update needed. See docs/ANNOUNCEMENTS.md for the full
// architecture. Proxy URL is its own constant, NOT derived from
// location.origin — one canonical URL serves CF Pages, GitHub Pages, and APK.

// Bin shape (one bin holds BOTH):
//   { broadcasts: [ { id, title?, message, type?('info'|'warning'|'success'|'error'),
//                     pinned?, expires?, link?, targetId? } ],
//     banner:     { id, title?, content, image?, href?, width?(px), startDate?,
//                   expires?, targetId? } }
// Optional targeting: set "targetId" on a record to this device's ID (shown in
// Settings) to show it only on that device. No targetId = everyone.
// Manage the bin with miniapp/bin.html.

const _K = 'newsmeva';
function _d(e) {
  try {
    const bin = atob(e);
    let out = '';
    for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ _K.charCodeAt(i % _K.length));
    return out;
  } catch { return ''; }
}
// TODO: replace with obfuscated real bin ID once the user provides it
const BAKED_BIN_ID = _d('WAQWSlhURQAIAxNGCVRAUVtWRxJfXE5X');

const POLL_SECONDS = 60;
const BANNER_COUNTDOWN_SECONDS = 7;

const BIN_ID           = () => localStorage.getItem('newsMeva_broadcastBin') || BAKED_BIN_ID;
const JSONBIN_BASE     = () => localStorage.getItem('newsMeva_jsonbinBase')  || 'https://api.jsonbin.io/v3/b';
const JSONBIN_LATEST   = (id) => `${JSONBIN_BASE()}/${id}/latest`;
const ANNOUNCEMENTS_API = () => localStorage.getItem('newsMeva_announcementsApi') || 'https://newsmeva.pages.dev/api/announcements';
const ANNOUNCEMENTS_URL = () => `${ANNOUNCEMENTS_API().replace(/\/+$/, '')}`;

const DEVICE_ID_KEY  = 'newsMeva_deviceId';
const DISMISSED_KEY  = 'newsMeva_dismissedBroadcasts';
const HOLDER_ID      = 'broadcast-holder';

let bannerShownThisLoad = false;
let pollTimer = null;

let lastState = 'listen'; // 'listen' | 'unconfigured' | 'offline' | 'updated'
let lastUpdatedStamp = 0;

export function getBroadcastStatus() {
  if (lastState === 'unconfigured') return t('bc_not_configured');
  if (lastState === 'offline') return t('bc_offline');
  if (lastState === 'updated') {
    const d = new Date(lastUpdatedStamp);
    return `${t('bc_updated')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return t('bc_listening');
}

function setStateLabel(text) {
  const el = document.getElementById('bc-state');
  if (el) el.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch { return 'unknown'; }
}

function getDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveDismissed(id) {
  const s = getDismissed(); s.add(id);
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s])); } catch {}
}

function isWithinPeriod(startDate, expires) {
  const now = new Date();
  if (startDate) { const d = new Date(startDate); if (!isNaN(d) && now < d) return false; }
  if (expires)    { const d = new Date(expires);    if (!isNaN(d) && now > d) return false; }
  return true;
}

function matchesDevice(record) { return !record.targetId || record.targetId === getDeviceId(); }

async function fetchJson(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch { return null; }
}

function safeUrl(value) { try { return new URL(value, location.href).href; } catch { return null; } }

// ── Broadcast pills ──

function pillHtml(b) {
  const type = ['info', 'warning', 'success', 'error'].includes(b.type) ? b.type : 'info';
  const icons = { info: 'info', warning: 'alert-triangle', success: 'check-circle-2', error: 'alert-circle' };
  const iconEl = `<i data-lucide="${icons[type]}" class="bc-icon"></i>`;
  const title  = b.title ? `<span class="bc-title">${escapeHtml(b.title)} </span>` : '';
  const text   = `<span class="bc-text">${title}${escapeHtml(b.message)}${b.link ? '<i data-lucide="external-link" class="bc-extlink"></i>' : ''}</span>`;
  const close  = b.pinned ? '' : `<button class="bc-close" type="button" aria-label="${escapeHtml(t('bc_close'))}"><i data-lucide="x"></i></button>`;
  const cls    = `bc-pill bc-${type}`;
  const link   = b.link ? safeUrl(b.link) : null;
  const inner  = `${iconEl}${text}${close}`;
  const attrs  = `data-bc-id="${escapeHtml(b.id)}"`;
  if (link) return `<a class="${cls}" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" ${attrs}>${inner}</a>`;
  return `<div class="${cls}" ${attrs}>${inner}</div>`;
}

function renderPills(list) {
  let holder = document.getElementById(HOLDER_ID);
  if (!holder) {
    holder = document.createElement('div');
    holder.id = HOLDER_ID;
    holder.className = 'broadcast-holder';
    holder.setAttribute('aria-live', 'polite');
    holder.addEventListener('click', (e) => {
      const btn = e.target.closest('.bc-close');
      if (btn) { e.preventDefault(); e.stopPropagation(); dismissPill(btn.closest('.bc-pill')); }
    });
    document.body.appendChild(holder);
  }
  holder.innerHTML = list.map(pillHtml).join('');
  refreshIcons();
}

function dismissPill(el) {
  if (!el) return;
  const id = el.dataset.bcId;
  if (id) saveDismissed(id);
  el.classList.add('bc-leaving');
  setTimeout(() => el.remove(), 260);
}

async function loadAnnouncement() {
  const id = BIN_ID();
  if (!id) return null;
  const viaProxy = await fetchJson(ANNOUNCEMENTS_URL());
  if (viaProxy !== null) return viaProxy;
  return fetchJson(JSONBIN_LATEST(id));
}

async function loadBroadcasts() {
  const res = await loadAnnouncement();
  if (!res) return null;
  const raw = res.record ?? res;
  const list = (Array.isArray(raw?.broadcasts) ? raw.broadcasts : []).filter((b) => b && b.id && b.message);
  return list.map((b) => ({ ...b, id: String(b.id) }));
}

export async function refreshBroadcasts() {
  if (!BIN_ID()) {
    lastState = 'unconfigured';
    setStateLabel(t('bc_not_configured'));
    return null;
  }
  const list = await loadBroadcasts();
  if (list === null) {
    lastState = 'offline';
    setStateLabel(t('bc_offline'));
    return null;
  }
  const dismissed = getDismissed();
  const visible = list.filter(
    (b) => isWithinPeriod(undefined, b.expires) && matchesDevice(b) && (b.pinned || !dismissed.has(b.id))
  );
  renderPills(visible);
  lastState = 'updated';
  lastUpdatedStamp = Date.now();
  setStateLabel(getBroadcastStatus());
  return visible;
}

// ── Banner overlay ──

function bannerHtml(b) {
  const w = b.width ? `max-width:${b.width}px` : '';
  const body = `${b.image ? `<img class="banner-img" src="${escapeHtml(b.image)}" alt="${escapeHtml(b.title || '')}" />` : ''}
    <div class="banner-body">${b.title ? `<h2>${escapeHtml(b.title)}</h2>` : ''}<p>${escapeHtml(b.content)}</p></div>`;
  const inner = b.href ? `<a href="${escapeHtml(b.href)}" target="_blank" rel="noopener noreferrer">${body}</a>` : body;
  return `
    <div class="banner-overlay" data-banner-overlay>
      <div class="banner-modal" style="${w}" role="dialog" aria-modal="true" aria-label="${escapeHtml(b.title || t('bc_banner'))}">
        <div class="banner-topbtn" data-banner-count></div>
        <button class="banner-close hidden" data-banner-close type="button" aria-label="${escapeHtml(t('bc_close'))}"><i data-lucide="x"></i></button>
        ${inner}
      </div>
    </div>`;
}

function showBanner(b) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = bannerHtml(b);
  document.body.appendChild(wrapper);
  refreshIcons();

  const overlayEl = wrapper.querySelector('[data-banner-overlay]');
  const countEl   = wrapper.querySelector('[data-banner-count]');
  const closeBtn  = wrapper.querySelector('[data-banner-close]');
  let countdown   = BANNER_COUNTDOWN_SECONDS;
  countEl.textContent = String(countdown);

  const finish = () => {
    countEl.classList.add('hidden');
    closeBtn.classList.remove('hidden');
    closeBtn.classList.add('closeable');
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) wrapper.remove(); });
  };
  const timer = setInterval(() => {
    countdown -= 1;
    if (countdown <= 0) { clearInterval(timer); finish(); } else { countEl.textContent = String(countdown); }
  }, 1000);
  closeBtn.addEventListener('click', () => { clearInterval(timer); wrapper.remove(); });
}

async function maybeShowBanner() {
  if (bannerShownThisLoad || !BIN_ID()) return;
  bannerShownThisLoad = true;
  const res = await loadAnnouncement();
  const record = res?.record ?? res;
  const b = record?.banner;
  if (!b) return;
  const banner = { ...b, id: String(b.id) };
  if (!banner.id || !banner.content) return;
  if (!isWithinPeriod(banner.startDate, banner.expires) || !matchesDevice(banner)) return;
  // Show each banner at most once per browser session, so refresh/reload
  // doesn't re-open it — only a fresh session (new tab/session) shows it.
  try {
    if (sessionStorage.getItem(`newsMeva_bannerShown_${banner.id}`)) return;
    sessionStorage.setItem(`newsMeva_bannerShown_${banner.id}`, '1');
  } catch {}
  showBanner(banner);
}

// ── Init / public API ──

export function initBroadcasts() {
  maybeShowBanner();
  refreshBroadcasts();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshBroadcasts, POLL_SECONDS * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshBroadcasts();
  });
}
