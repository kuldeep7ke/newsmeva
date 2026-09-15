import { db, localDateTimeStr, makeUuid, getByUuid } from './db.js';

const CONFIG_KEY = 'newsMeva_sync';
const RECONNECT_INTERVAL = 30000;
const PUSH_DEBOUNCE = 800;
const URL_SUFFIX = '.supabase.co';

export const SCHEMA_SQL = `create table if not exists public.sync_docs (
  id text primary key,
  entity text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists sync_docs_entity_idx on public.sync_docs (entity);
create index if not exists sync_docs_updated_at_idx on public.sync_docs (updated_at);
alter table public.sync_docs enable row level security;
create policy "sync_docs_anon_all" on public.sync_docs
  for all to anon using (true) with check (true);`;

const state = {
  client: null,
  channel: null,
  pollTimer: null,
  status: 'disconnected',
  lastSync: null,
  error: null,
  applyingRemote: false,
  pushTimer: null
};

export function getSyncStatus() {
  return { status: state.status, lastSync: state.lastSync, error: state.error };
}

export function getSyncConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch { return null; }
}

function emit() {
  document.dispatchEvent(new CustomEvent('newsmeva:sync', { detail: getSyncStatus() }));
}

function entityTable(entity) {
  return { category: 'categories', activity: 'activities', template: 'templates' }[entity] || `${entity}s`;
}

function isConnected() { return Boolean(state.client && state.status !== 'error'); }

function toIso(record) {
  const source = record.updatedAt || record.timestamp || record.createdAt;
  if (source && typeof source === 'string') {
    const time = new Date(source).getTime();
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return new Date().toISOString();
}

function toLocalTimestamp(record) {
  const source = record.updatedAt || record.timestamp || record.createdAt;
  if (!source) return 0;
  const time = new Date(source).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalizeTimestamps(entity, data) {
  const fields = entity === 'activity' ? ['timestamp'] : ['updatedAt', 'createdAt', 'completedAt', 'deletedAt'];
  for (const field of fields) {
    const value = data[field];
    if (value && /\dT\d{2}:\d{2}/.test(value)) data[field] = localDateTimeStr(value);
  }
}

function pushDeletion(entity, uuid) {
  if (!state.client || !entity || !uuid) return;
  const now = new Date().toISOString();
  state.client.from('sync_docs').upsert({
    id: `${entity}:${uuid}`,
    entity,
    data: { uuid, deleted: true, updatedAt: now },
    updated_at: now
  }, { onConflict: 'id' }).then(({ error }) => {
    if (!error) { state.lastSync = new Date().toISOString(); state.status = 'connected'; state.error = null; }
  }).catch((error) => { state.status = 'error'; state.error = error.message; }).finally(emit);
}

function docRows(entity, records) {
  return records.map((record) => ({
    id: `${entity}:${record.uuid}`,
    entity,
    data: record,
    updated_at: toIso(record)
  }));
}

export async function pushAll() {
  if (!state.client) return;
  state.status = 'syncing';
  emit();
  try {
    const rows = [
      ...docRows('category', await db.categories.toArray()),
      ...docRows('template', await db.templates.toArray()),
      ...docRows('task', await db.tasks.toArray()),
      ...docRows('script', await db.scripts.toArray()),
      ...docRows('activity', await db.activities.toArray())
    ];
    if (rows.length) {
      const { error } = await state.client.from('sync_docs').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    state.lastSync = new Date().toISOString();
    state.status = 'connected';
    state.error = null;
  } catch (error) {
    state.status = 'error';
    state.error = error.message || String(error);
  }
  emit();
}

export async function pullAll() {
  if (!state.client || state.applyingRemote) return;
  state.status = 'syncing';
  emit();
  try {
    state.applyingRemote = true;
    const { data, error } = await state.client.from('sync_docs').select('*').gte('updated_at', new Date(Date.now() - 7 * 86400000).toISOString());
    if (error) throw error;
    await applyRemote(data || []);
    state.lastSync = new Date().toISOString();
    state.status = 'connected';
    state.error = null;
  } catch (error) {
    state.status = 'error';
    state.error = error.message || String(error);
  } finally {
    state.applyingRemote = false;
  }
  emit();
}

async function applyRemote(rows) {
  for (const row of rows) {
    const entity = row.entity;
    if (!entity) continue;
    const table = entityTable(entity);
    const data = row.data || {};
    if (!data.uuid) continue;
    if (data.deleted) {
      const existing = await getByUuid(table, data.uuid);
      if (existing) { try { if (table === 'tasks') await db.tasks.update(existing.id, { deletedAt: localDateTimeStr() }); else await db.table(table).delete(existing.id); } catch { /* ignore */ } }
      continue;
    }
    normalizeTimestamps(entity, data);
    const existing = await getByUuid(table, data.uuid);
    if (!existing) {
      try { await db.table(table).add(data); } catch { /* ignore duplicate */ }
    } else if (toLocalTimestamp(data) > toLocalTimestamp(existing)) {
      const { id: _id, ...rest } = data;
      try { await db.table(table).update(existing.id, rest); } catch { /* ignore */ }
    }
  }
}

function handleRealtime(payload) {
  if (!payload || !payload.new) return;
  const row = payload.new;
  if (!row.entity || !row.data || !row.data.uuid) return;
  if (state.applyingRemote) return;
  applyRemote([row]).catch(() => {});
}

function schedulePush() {
  clearTimeout(state.pushTimer);
  state.pushTimer = setTimeout(() => pushAll().catch(() => {}), PUSH_DEBOUNCE);
}

let dbSubscriptions = [];

export async function connect(config) {
  if (!config || !config.url || !config.key) return;
  await disconnect();
  if (!String(config.url).includes(URL_SUFFIX)) {
    state.status = 'error';
    state.error = 'Invalid Supabase URL';
    emit();
    return;
  }
  try {
    state.client = window.supabase.createClient(config.url, config.key, { auth: { persistSession: false } });
    const { error } = await state.client.from('sync_docs').select('id').limit(1);
    if (error && error.code !== 'PGRST116') throw error;
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: config.url, key: config.key }));
    state.status = 'syncing';

    state.channel = state.client
      .channel('sync-docs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sync_docs' }, handleRealtime)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sync_docs' }, handleRealtime)
      .subscribe();

    await pushAll();
    await pullAll();
    state.status = 'connected';
  } catch (error) {
    state.status = 'error';
    state.error = error.message || String(error);
    state.client = null;
  }
  emit();
}

export async function disconnect() {
  if (state.channel) { try { await state.client.removeChannel(state.channel); } catch { /* ignore */ } }
  state.channel = null;
  if (dbSubscriptions.length) {
    dbSubscriptions.forEach((unsub) => { try { unsub(); } catch { /* ignore */ } });
    dbSubscriptions = [];
  }
  state.client = null;
  clearTimeout(state.pollTimer);
  clearTimeout(state.pushTimer);
  state.status = 'disconnected';
  state.error = null;
  localStorage.removeItem(CONFIG_KEY);
  emit();
}

export function manualSync() {
  return Promise.all([pushAll(), pullAll()]);
}