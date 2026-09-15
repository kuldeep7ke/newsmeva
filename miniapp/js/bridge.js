import { db, makeUuid, localDateTimeStr } from './db.js';

const CONFIG_KEY = 'newsMeva_bridge';
const QUEUE_KEY = 'newsMeva_bridge_queue';
const PAIR_KEY = 'newsMeva_pair_code';

const state = {
  token: null,
  email: null,
  server: null,
  status: 'disconnected',
  profileId: null,
  pairCode: null,
  queue: [],
  syncTimer: null
};

export function getBridgeConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY));
    return cfg?.token ? { email: cfg.email, server: cfg.server } : null;
  } catch { return null; }
}

export function getBridgeStatus() {
  return { status: state.status, email: state.email, queueCount: loadQueue().length };
}

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function emit() {
  document.dispatchEvent(new CustomEvent('newsmeva:bridge', { detail: getBridgeStatus() }));
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };
}

async function api(path, options = {}) {
  const url = `${state.server.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, { ...options, headers: headers() });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function toApiTask(localTask) {
  return {
    title: localTask.title,
    description: localTask.description || '',
    priority: localTask.priority || 'medium',
    task_type: localTask.taskType || 'feature',
    deadline: localTask.dueDate || null,
    ...(localTask.footageType ? { footage_source: localTask.footageType } : {})
  };
}

function toLocalTask(apiTask) {
  return {
    uuid: makeUuid(),
    bridgeId: apiTask.id,
    title: apiTask.title,
    description: apiTask.description || '',
    priority: apiTask.priority || 'medium',
    taskType: apiTask.task_type || 'feature',
    status: apiTask.status || 'draft',
    dueDate: apiTask.deadline ? String(apiTask.deadline).slice(0, 10) : '',
    footageType: apiTask.footage_source || '',
    assignedTo: apiTask.assigned_to_name || '',
    createdAt: apiTask.created_at ? String(apiTask.created_at).slice(0, 16).replace(' ', 'T') : localDateTimeStr(),
    updatedAt: apiTask.updated_at ? String(apiTask.updated_at).slice(0, 16).replace(' ', 'T') : localDateTimeStr(),
    deletedAt: ''
  };
}

export async function login({ server, email, password }) {
  state.server = server;
  state.status = 'connecting';
  emit();
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ loginId: email, password })
    });
    if (!data?.token) throw new Error('No token returned');
    state.token = data.token;
    state.email = email;
    state.profileId = data.user?.id ?? null;
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ server, email, token: data.token, profileId: data.user?.id }));
    state.status = 'connected';
    await flushQueue();
    await syncNow();
  } catch (error) {
    state.status = 'error';
    state.token = null;
    localStorage.removeItem(CONFIG_KEY);
    throw error;
  } finally {
    emit();
  }
}

export function logout() {
  state.token = null;
  state.email = null;
  state.profileId = null;
  state.status = 'disconnected';
  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(PAIR_KEY);
  emit();
}

function enqueue(action, localTask) {
  const queue = loadQueue();
  queue.push({ action, taskId: localTask.id, task: { ...localTask }, ts: Date.now() });
  saveQueue(queue);
  state.queue = queue;
  emit();
  if (!state.token) {
    scheduleAutoSync();
  } else {
    flushQueue().catch(() => {});
  }
}

export function scheduleAutoSync() {
  clearInterval(state.syncTimer);
  state.syncTimer = setInterval(() => {
    const cfg = getBridgeConfig();
    if (cfg && state.token) flushQueue().then(() => syncNow()).catch(() => {});
  }, 30000);
}

async function flushQueue() {
  if (!state.token) return;
  const queue = loadQueue();
  const remaining = [];
  for (const item of queue) {
    try {
      if (item.action === 'create') {
        const data = await api('/api/tasks', { method: 'POST', body: JSON.stringify(toApiTask(item.task)) });
        if (data?.id) await db.tasks.update(item.taskId, { bridgeId: data.id });
      } else if (item.action === 'update') {
        if (item.bridgeId) await api(`/api/tasks/${item.bridgeId}`, { method: 'PUT', body: JSON.stringify(toApiTask(item.task)) });
      } else if (item.action === 'delete') {
        if (item.bridgeId) await api(`/api/tasks/${item.bridgeId}`, { method: 'DELETE' });
      }
    } catch (err) {
      remaining.push(item);
    }
  }
  saveQueue(remaining);
  state.queue = remaining;
  emit();
}

export async function syncNow() {
  if (!state.token) return;
  state.status = 'syncing';
  emit();
  try {
    const tasks = await api('/api/tasks?limit=200');
    const rows = Array.isArray(tasks) ? tasks : tasks?.tasks || [];
    const localTasks = await db.tasks.toArray();
    const bridgeIds = new Set(localTasks.filter((t) => t.bridgeId).map((t) => Number(t.bridgeId)));
    for (const apiTask of rows) {
      const bid = Number(apiTask.id);
      if (!bid || bridgeIds.has(bid)) continue;
      if (apiTask.status === 'trashed' || apiTask.status === 'cancelled') continue;
      const local = localTasks.find((t) => Number(t.bridgeId) === bid);
      if (local) continue;
      try {
        await db.tasks.add(toLocalTask(apiTask));
      } catch { /* ignore duplicate */ }
    }
    state.status = 'connected';
  } catch (error) {
    state.status = 'error';
  } finally {
    emit();
  }
}

export function initBridge() {
  try {
    const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY));
    if (cfg?.token && cfg?.server) {
      state.token = cfg.token;
      state.email = cfg.email;
      state.server = cfg.server;
      state.profileId = cfg.profileId;
      state.status = 'connected';
    }
  } catch { /* ignored */ }
  scheduleAutoSync();
  if (state.token) setTimeout(() => syncNow().catch(() => {}), 1000);
}

// Called by views when a task is created/updated/deleted locally while bridge is on.
export async function pushTaskChange(action, task) {
  if (!state.token) return;
  enqueue(action, task);
}