import { SEED_CATEGORIES, buildSeedTemplates } from './seed.js';

const DexieCtor = window.Dexie;
if (!DexieCtor) throw new Error('Dexie failed to load.');

export const db = new DexieCtor('NewsMevaMiniDB');

db.version(2).stores({
  categories: '++id, uuid, name, order',
  templates: '++id, uuid, categoryId, order',
  tasks: '++id, uuid, status, priority, taskType, categoryId, dueDate, createdAt, completedAt, deletedAt',
  scripts: '++id, uuid, title, createdAt, updatedAt',
  activities: '++id, uuid, type, taskId, timestamp'
});

export function makeUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function categorySeedUuid(name) { return `seed-cat-${slugify(name)}`; }
export function templateSeedUuid(catName, order) { return `seed-tpl-${slugify(catName)}-${order}`; }

export function localDateStr(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function localDateTimeStr(date = new Date()) {
  const d = new Date(date);
  return `${localDateStr(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function ensureUuids(tx = db) {
  const catMap = new Map((await tx.table('categories').toArray()).map((c) => [c.id, c]));
  await tx.table('categories').toCollection().modify((row) => {
    const seed = SEED_CATEGORIES.some((s) => s.name === row.name);
    row.uuid = seed ? categorySeedUuid(row.name) : (row.uuid || makeUuid());
  });
  const templates = await tx.table('templates').toArray();
  await tx.table('templates').toCollection().modify((row) => {
    const name = catMap.get(row.categoryId)?.name || '';
    const isSeed = SEED_CATEGORIES.some((s) => s.name === name);
    row.uuid = isSeed ? templateSeedUuid(name, row.order) : (row.uuid || makeUuid());
  });
  await tx.table('tasks').toCollection().modify((row) => { if (!row.uuid) row.uuid = makeUuid(); });
  await tx.table('scripts').toCollection().modify((row) => { if (!row.uuid) row.uuid = makeUuid(); });
  await tx.table('activities').toCollection().modify((row) => { if (!row.uuid) row.uuid = makeUuid(); });
}

export async function seedDatabase() {
  if (await db.categories.count()) return;
  await db.transaction('rw', db.categories, db.templates, async () => {
    const categories = SEED_CATEGORIES.map((c) => ({ ...c, uuid: categorySeedUuid(c.name) }));
    await db.categories.bulkAdd(categories);
    const inserted = await db.categories.orderBy('order').toArray();
    const templates = buildSeedTemplates(inserted).map((t) => ({
      ...t,
      uuid: templateSeedUuid(inserted.find((c) => c.id === t.categoryId)?.name || '', t.order)
    }));
    await db.templates.bulkAdd(templates);
  });
}

export async function getCategories() { return db.categories.orderBy('order').toArray(); }
export async function getTemplatesByCategory(categoryId) { return db.templates.where('categoryId').equals(Number(categoryId)).sortBy('order'); }
export async function getTasks() { return db.tasks.orderBy('createdAt').reverse().toArray(); }
export async function getTask(id) { return db.tasks.get(Number(id)); }
export async function getScripts() { return db.scripts.orderBy('updatedAt').reverse().toArray(); }
export async function getScript(id) { return db.scripts.get(Number(id)); }

export async function addTask(task) {
  const now = localDateTimeStr();
  const id = await db.tasks.add({
    uuid: makeUuid(),
    title: task.title.trim(),
    description: task.description?.trim() || '',
    taskType: task.taskType || 'feature',
    status: task.status || 'draft',
    priority: task.priority || 'medium',
    categoryId: task.categoryId ? Number(task.categoryId) : null,
    dueDate: task.dueDate || '',
    footageType: task.footageType || '',
    assignedTo: task.assignedTo || '',
    createdAt: now,
    updatedAt: now,
    completedAt: '',
    deletedAt: ''
  });
  await addActivity({ type: 'task_created', taskId: id, description: `Created "${task.title.trim()}"` });
  return id;
}

export async function updateTask(id, changes) {
  const task = await db.tasks.get(Number(id));
  if (!task) return;
  const now = localDateTimeStr();
  const updated = { ...changes, updatedAt: now };
  if (changes.status === 'completed' && !task.completedAt) updated.completedAt = now;
  await db.tasks.update(Number(id), updated);
  if (changes.status) await addActivity({ type: 'status_changed', taskId: id, description: `Moved to "${changes.status}"` });
}

export async function deleteTask(id) {
  await db.tasks.update(Number(id), { deletedAt: localDateTimeStr(), updatedAt: localDateTimeStr() });
  await addActivity({ type: 'task_deleted', taskId: id, description: 'Moved to recycle bin' });
}

export async function restoreTask(id) {
  await db.tasks.update(Number(id), { deletedAt: '', updatedAt: localDateTimeStr() });
}

export async function permanentDeleteTask(id) { await db.tasks.delete(Number(id)); }

export async function addScript(script) {
  const now = localDateTimeStr();
  return db.scripts.add({
    uuid: makeUuid(),
    title: script.title.trim(),
    content: script.content || '',
    wordCount: script.content ? script.content.trim().split(/\s+/).length : 0,
    charCount: script.content?.length || 0,
    createdAt: now,
    updatedAt: now
  });
}

export async function updateScript(id, changes) {
  const now = localDateTimeStr();
  const script = await db.scripts.get(Number(id));
  if (!script) return;
  const content = changes.content !== undefined ? changes.content : script.content;
  await db.scripts.update(Number(id), {
    ...changes,
    wordCount: content ? content.trim().split(/\s+/).length : 0,
    charCount: content?.length || 0,
    updatedAt: now
  });
}

export async function deleteScript(id) { await db.scripts.delete(Number(id)); }

export async function addActivity(entry) {
  return db.activities.add({
    uuid: makeUuid(),
    type: entry.type,
    taskId: entry.taskId || null,
    description: entry.description || '',
    timestamp: localDateTimeStr()
  });
}

export async function getActivities() { return db.activities.orderBy('timestamp').reverse().toArray(); }

export async function exportData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'News Meva Mini',
    categories: await db.categories.toArray(),
    templates: await db.templates.toArray(),
    tasks: await db.tasks.toArray(),
    scripts: await db.scripts.toArray(),
    activities: await db.activities.toArray()
  };
}

export async function importData(data) {
  if (!data || !data.app) throw new Error('Invalid backup file');
  await db.transaction('rw', db.categories, db.templates, db.tasks, db.scripts, db.activities, async () => {
    await db.activities.clear();
    await db.scripts.clear();
    await db.tasks.clear();
    await db.templates.clear();
    await db.categories.clear();
    if (data.categories?.length) await db.categories.bulkAdd(data.categories.map((c) => { const { id, ...rest } = c; return rest; }));
    if (data.templates?.length) await db.templates.bulkAdd(data.templates.map((t) => { const { id, ...rest } = t; return rest; }));
    if (data.tasks?.length) await db.tasks.bulkAdd(data.tasks.map((t) => { const { id, ...rest } = t; return rest; }));
    if (data.scripts?.length) await db.scripts.bulkAdd(data.scripts.map((s) => { const { id, ...rest } = s; return rest; }));
    if (data.activities?.length) await db.activities.bulkAdd(data.activities.map((a) => { const { id, ...rest } = a; return rest; }));
  });
}
