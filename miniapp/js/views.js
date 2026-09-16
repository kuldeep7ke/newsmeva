import { getTasks, getCategories, getScripts, getDeletedScripts, localDateStr, addTask } from './db.js';
import { PRIORITY_CONFIG, TASK_TYPES } from './seed.js';
import { t } from './i18n.js';
import { escapeHtml, refreshIcons, statusLabel, renderTaskCard, renderTaskModal, renderOnboarding, closeOnboarding, icon } from './components.js';
import { setupBackup } from './backup.js';

let syncModule = null;

function loadSync() { return syncModule || import('./sync.js').then((m) => { syncModule = m; return m; }); }

export async function showOnboarding() {
  if (localStorage.getItem('newsMeva_onboarded')) return;
  renderOnboarding();
}

async function loadViewData() {
  const [tasks, categories] = await Promise.all([getTasks(), getCategories()]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  return { tasks, categories, categoryMap };
}

function stat(label, value, cls = '') { return `<div class="stat-card ${cls}"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`; }

function taskSection(title, tasks, categoryMap) {
  if (!tasks.length) return '';
  return `<div class="card"><h3>${title} <span class="muted" style="font-weight:500">(${tasks.length})</span></h3><div class="task-list">${tasks.map((task) => renderTaskCard(task, categoryMap.get(task.categoryId)?.name)).join('')}</div></div>`;
}

export async function renderDashboard() {
  const { tasks, categories, categoryMap } = await loadViewData();
  const today = localDateStr();
  const open = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && !t.deletedAt);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = open.filter((t) => t.dueDate === today);
  const completed = tasks.filter((t) => t.status === 'completed' && !t.deletedAt);
  const scripts = await getScripts();
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <section class="grid stats-grid">
      ${stat(t('stat_open'), open.length)}
      ${stat(t('stat_due_today'), dueToday.length, dueToday.length ? 'accent' : '')}
      ${stat(t('stat_overdue'), overdue.length, overdue.length ? 'danger' : '')}
      ${stat(t('stat_completed'), completed.length)}
    </section>
    <section class="card">
      <h3>${t('quick_create')}</h3>
      <form id="dashboard-create" class="quick-create">
        <input class="field" name="title" placeholder="${t('placeholder_add_task')}" aria-label="${t('placeholder_add_task')}" required />
        <select class="field" name="taskType" aria-label="${t('task_type')}" style="max-width:170px">
          ${TASK_TYPES.map((tt) => `<option value="${tt.value}">${tt.label}</option>`).join('')}
        </select>
        <select class="field" name="priority" aria-label="${t('priority')}" style="max-width:120px">
          ${['urgent','high','medium','low'].map((p) => `<option value="${p}"${p==='medium'?' selected':''}>${p}</option>`).join('')}
        </select>
        <button class="btn btn-primary">${t('add')}</button>
      </form>
    </section>
    ${taskSection(t('section_overdue'), overdue.slice(0, 5), categoryMap)}
    ${taskSection(t('section_today'), dueToday.slice(0, 5), categoryMap)}
    ${taskSection(t('section_all_open'), open.filter((tk) => tk.dueDate !== today && !(tk.dueDate && tk.dueDate < today)).slice(0, 5), categoryMap)}
  `;
  document.querySelector('#dashboard-create').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await addTask({ title: fd.get('title'), taskType: fd.get('taskType'), priority: fd.get('priority') });
    window.navigateTo('dashboard');
  });
  refreshIcons();
}

export async function renderTasks() {
  const { tasks, categories, categoryMap } = await loadViewData();
  const open = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && !t.deletedAt);
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <div class="list-toolbar">
      <select class="field list-toolbar-narrow" id="tasks-priority-filter" aria-label="${t('priority')}">
        <option value="all">All Priority</option>
        ${Object.keys(PRIORITY_CONFIG).map((p) => `<option value="${p}">${PRIORITY_CONFIG[p].label}</option>`).join('')}
      </select>
      <input class="field list-toolbar-search" id="tasks-search" placeholder="Search tasks..." aria-label="Search tasks" />
      <button class="btn btn-primary btn-sm" data-create-task>${icon('plus')} ${t('new_task')}</button>
    </div>
    <div class="card"><div class="task-list" id="tasks-list">
      ${open.length ? open.map((tk) => renderTaskCard(tk, categoryMap.get(tk.categoryId)?.name)).join('') : `<p class="empty-state">${t('no_tasks')}</p>`}
    </div></div>
  `;
  const filterTasks = () => {
    const priority = document.querySelector('#tasks-priority-filter').value;
    const search = document.querySelector('#tasks-search').value.toLowerCase();
    let filtered = open;
    if (priority !== 'all') filtered = filtered.filter((tk) => tk.priority === priority);
    if (search) filtered = filtered.filter((tk) => tk.title.toLowerCase().includes(search) || (tk.description || '').toLowerCase().includes(search));
    document.querySelector('#tasks-list').innerHTML = filtered.length ? filtered.map((tk) => renderTaskCard(tk, categoryMap.get(tk.categoryId)?.name)).join('') : `<p class="empty-state">${t('no_tasks')}</p>`;
    refreshIcons();
  };
  document.querySelector('#tasks-priority-filter').addEventListener('change', filterTasks);
  document.querySelector('#tasks-search').addEventListener('input', filterTasks);
  refreshIcons();
}

function scriptRow(s, pending = false) {
  const updated = (s.updatedAt || '').slice(0, 10);
  return `
    <div class="script-row${pending ? ' pending' : ''}" data-script-id="${s.id}">
      <div class="script-row-main">
        <div class="script-row-title">${escapeHtml(s.title)}</div>
        <div class="script-row-meta">
          ${pending ? `<span class="badge badge-new">${t('new_badge')}</span>` : ''}
          <span>${s.wordCount} ${t('word_count')}</span>
          <span>·</span>
          <span>${s.charCount} ${t('char_count')}</span>
          ${updated ? `<span>·</span><span>${escapeHtml(updated)}</span>` : ''}
        </div>
      </div>
      <div class="script-row-actions">
        <button class="btn btn-sm btn-primary btn-icon" data-script-prompt="${s.id}" title="${t('prompt_now')}" aria-label="${t('prompt_now')}">${icon('play')}</button>
        <button class="btn btn-sm btn-icon" data-script-edit="${s.id}" title="${t('edit')}" aria-label="${t('edit')}">${icon('pencil')}</button>
        <button class="btn btn-sm btn-icon btn-danger" data-script-delete="${s.id}" title="${t('delete')}" aria-label="${t('delete')}">${icon('trash-2')}</button>
      </div>
    </div>
  `;
}

export async function renderTeleprompterList() {
  const [{ tasks, categoryMap }, scripts] = await Promise.all([loadViewData(), getScripts()]);
  const open = tasks.filter((tk) => tk.status !== 'completed' && tk.status !== 'cancelled' && !tk.deletedAt);
  const completed = tasks.filter((tk) => tk.status === 'completed' && !tk.deletedAt);
  const pendingScripts = scripts.filter((s) => !s.finishedAt);
  const finishedScripts = scripts.filter((s) => !!s.finishedAt);
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <div class="card">
      <div class="list-header">
        <h3>${t('tasks')} <span class="muted">(${open.length})</span></h3>
      </div>
      <div class="task-list">
        ${open.map((tk) => renderTaskCard(tk, categoryMap.get(tk.categoryId)?.name, true)).join('')}
      </div>
      ${completed.length ? `
        <h3 style="margin:1.5rem 0 0">${t('finished')} <span class="muted">(${completed.length})</span></h3>
        <div class="task-list">
          ${completed.map((tk) => renderTaskCard(tk, categoryMap.get(tk.categoryId)?.name)).join('')}
        </div>
      ` : ''}
    </div>
    <div class="card">
      <div class="list-header">
        <h3>${t('scripts')} <span class="muted">(${pendingScripts.length})</span></h3>
      </div>
      <div class="task-list">
        ${pendingScripts.length ? pendingScripts.map((s) => scriptRow(s, true)).join('') : (scripts.length === 0 ? `<p class="empty-state">${t('scripts_empty')}</p>` : '')}
      </div>
      ${finishedScripts.length ? `
        <h3 style="margin:1.5rem 0 0">${t('finished')} <span class="muted">(${finishedScripts.length})</span></h3>
        <div class="task-list">
          ${finishedScripts.map((s) => scriptRow(s)).join('')}
        </div>
      ` : ''}
    </div>
  `;
  refreshIcons();
}

export async function renderScripts() {
  const scripts = await getScripts();
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <div class="card">
      <div class="list-header">
        <h3>${t('scripts')}</h3>
        <button class="btn btn-primary btn-sm" data-create-script>${icon('plus')} ${t('new_script')}</button>
      </div>
      <div class="task-list" id="scripts-list">
        ${scripts.length ? scripts.map(scriptRow).join('') : `<p class="empty-state">${t('scripts_empty')}</p>`}
      </div>
    </div>
  `;
  refreshIcons();
}

export async function renderScriptEditor(scriptId) {
  const script = scriptId ? await import('./db.js').then((m) => m.getScript(scriptId)) : null;
  const isEdit = !!script;
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <div class="card">
      <div class="modal-header">
        <h3>${isEdit ? t('edit_task') + ': ' + escapeHtml(script.title) : t('new_script')}</h3>
        <button type="button" class="icon-btn" data-nav="scripts">${icon('arrow-left')}</button>
      </div>
      <form id="script-form" data-edit-id="${isEdit ? script.id : ''}">
        <div class="field-group">
          <label class="field-label">${t('script_title')}</label>
          <input class="field" name="title" required value="${isEdit ? escapeHtml(script.title) : ''}" />
        </div>
        <div class="field-group">
          <label class="field-label">${t('script_content')}</label>
          <textarea class="field" name="content" style="min-height:280px;font-size:1rem;line-height:1.7" placeholder="Write your script here...">${isEdit ? escapeHtml(script.content) : ''}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-nav="scripts">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('save_script')}</button>
        </div>
      </form>
    </div>
  `;
  refreshIcons();
}

export async function renderRecycleBin() {
  const { tasks } = await loadViewData();
  const [deletedTasks, deletedScripts] = await Promise.all([
    Promise.resolve(tasks.filter((t) => t.deletedAt).sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''))),
    getDeletedScripts()
  ]);
  const total = deletedTasks.length + deletedScripts.length;
  const content = document.querySelector('#view-content');
  const binRow = (title, deletedAt, id, type) => `
    <div class="script-row">
      <div class="script-row-main">
        <div class="script-row-title">${escapeHtml(title)}</div>
        <div class="script-row-meta"><span>${t('archived_at')} ${escapeHtml(deletedAt)}</span></div>
      </div>
      <div class="script-row-actions">
        <button class="btn btn-sm btn-icon" data-recycle-restore="${id}" data-recycle-type="${type}" title="${t('restore')}" aria-label="${t('restore')}">${icon('undo-2')}</button>
        <button class="btn btn-sm btn-icon btn-danger" data-recycle-purge="${id}" data-recycle-type="${type}" title="${t('purge')}" aria-label="${t('purge')}">${icon('trash-2')}</button>
      </div>
    </div>
  `;
  content.innerHTML = total ? `
    <div class="card">
      <h3>${t('recycle_bin')} <span class="muted">(${total})</span></h3>
      <div class="task-list">
        ${deletedTasks.map((tk) => binRow(tk.title, tk.deletedAt, tk.id, 'task')).join('')}
        ${deletedScripts.map((s) => binRow(s.title, s.deletedAt, s.id, 'script')).join('')}
      </div>
    </div>
  ` : `<p class="empty-state">${t('archive_empty')}</p>`;
  refreshIcons();
}

export async function renderCloud() {
  let sync;
  try { sync = await loadSync(); } catch { sync = null; }
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <div class="card">
      <h3>${t('cloud_sync')}</h3>
      <p class="muted" style="font-size:0.88rem;margin:0 0 1rem">Sync your data across devices using your own Supabase project. All data stays under your control.</p>
      <div class="sync-status-card" id="sync-status-card">
        <span class="sync-status-dot disconnected" id="sync-dot"></span>
        <span id="sync-status-text">${t('cloud_disconnected')}</span>
        <span class="muted" id="sync-last" style="margin-left:auto;font-size:0.78rem"></span>
      </div>
      <p class="muted" id="sync-connected-url" style="font-size:0.82rem;margin:0.5rem 0 0;display:none"></p>
      <form id="sync-config-form">
        <div class="field-group">
          <label class="field-label" for="sync-url">${t('cloud_supabase_url')}</label>
          <input class="field" id="sync-url" name="url" type="url" placeholder="https://your-project.supabase.co" />
        </div>
        <div class="field-group">
          <label class="field-label" for="sync-key">${t('cloud_supabase_key')}</label>
          <input class="field" id="sync-key" name="key" placeholder="your-anon-key" />
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary">${t('cloud_connect')}</button>
          <button type="button" class="btn btn-primary" id="sync-btn">${icon('refresh-cw')} ${t('cloud_sync_btn')}</button>
          <button type="button" class="btn btn-ghost" id="sync-disconnect-btn">${t('cloud_disconnect')}</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h3>Supabase Setup</h3>
      <p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem">${t('cloud_schema_info')}</p>
      <textarea class="field" id="sync-schema" name="syncSchema" readonly aria-label="Supabase schema" style="font-family:monospace;font-size:0.78rem;min-height:120px;background:var(--surface-soft)">create table if not exists public.sync_docs (
  id text primary key,
  entity text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists sync_docs_entity_idx on public.sync_docs (entity);
create index if not exists sync_docs_updated_at_idx on public.sync_docs (updated_at);
alter table public.sync_docs enable row level security;
create policy "sync_docs_anon_all" on public.sync_docs for all to anon using (true) with check (true);</textarea>
    </div>
  `;
  if (sync) {
    const cfg = sync.getSyncConfig();
    if (cfg) {
      const form = document.querySelector('#sync-config-form');
      if (form) { form.url.value = cfg.url || ''; form.key.value = cfg.key || ''; }
      const urlLine = document.querySelector('#sync-connected-url');
      if (urlLine) { urlLine.style.display = 'block'; urlLine.textContent = cfg.url ? `${t('cloud_connected_to')}: ${cfg.url}` : ''; }
    }
    updateSyncStatusUI(sync.getSyncStatus());
  }
  refreshIcons();
}

export function updateSyncStatusUI(status) {
  const dot = document.querySelector('#sync-dot');
  const text = document.querySelector('#sync-status-text');
  const last = document.querySelector('#sync-last');
  if (!dot || !text) return;
  dot.className = 'sync-status-dot ' + (status.status === 'connected' ? 'connected' : status.status === 'syncing' ? 'syncing' : status.status === 'error' ? 'error' : 'disconnected');
  text.textContent = status.status === 'connected' ? t('cloud_connected') : status.status === 'syncing' ? t('cloud_syncing') : status.status === 'error' ? `${t('cloud_error')}: ${status.error || ''}` : t('cloud_disconnected');
  if (last) last.textContent = status.lastSync ? `${t('cloud_last_sync')}: ${new Date(status.lastSync).toLocaleTimeString()}` : '';
}

export async function renderBackup() {
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <div class="card">
      <h3>${t('backup')}</h3>
      <p class="muted" style="font-size:0.88rem;margin:0 0 1rem">${t('backup_info')}</p>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <button class="btn btn-primary" id="backup-export-btn">${icon('download')} ${t('backup_export')}</button>
        <button class="btn btn-ghost" id="backup-import-btn">${icon('upload')} ${t('backup_import')}</button>
      </div>
    </div>
  `;
  refreshIcons();
  setupBackup();
}

export async function renderSettings() {
  const content = document.querySelector('#view-content');
  const isDark = document.documentElement.dataset.theme === 'dark';
  const brand = document.documentElement.dataset.brand || 'orange';
  const lang = localStorage.getItem('newsMeva_lang') || 'en';
  content.innerHTML = `
    <div class="card">
      <h3>${t('settings_theme')}</h3>
      <div class="setting-row">
        <div><div class="setting-label">${t('settings_dark_mode')}</div><div class="setting-sub" id="theme-desc">${isDark ? t('theme_dark') : t('theme_light')}</div></div>
        <button class="icon-btn" id="theme-toggle-btn">${isDark ? icon('sun') : icon('moon')}</button>
      </div>
      <div class="setting-row">
        <div class="setting-label">${t('settings_brand')}</div>
        <div class="brand-swatches">
          <button class="brand-swatch${brand === 'orange' ? ' active' : ''}" data-brand="orange" style="background:#f97316"></button>
          <button class="brand-swatch${brand === 'blue' ? ' active' : ''}" data-brand="blue" style="background:#2563eb"></button>
          <button class="brand-swatch${brand === 'green' ? ' active' : ''}" data-brand="green" style="background:#16a34a"></button>
        </div>
      </div>
    </div>
    <div class="card">
      <h3>${t('settings_language')}</h3>
      <div class="setting-row">
        <div class="setting-label">Language</div>
        <select class="field" id="lang-select" aria-label="${t('settings_language')}" style="max-width:160px">
          <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
          <option value="mr" ${lang === 'mr' ? 'selected' : ''}>मराठी</option>
          <option value="hi" ${lang === 'hi' ? 'selected' : ''}>हिंदी</option>
        </select>
      </div>
    </div>
    <div class="card">
      <h3>${t('settings_data')}</h3>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <button class="btn btn-ghost" id="settings-cloud-btn">${icon('cloud')} ${t('settings_cloud_link')}</button>
        <button class="btn btn-ghost" id="settings-backup-btn">${icon('download')} ${t('settings_backup_link')}</button>
      </div>
    </div>
  `;
  refreshIcons();
}

export async function renderAbout() {
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <div class="card">
      <h3>${t('about_title')}</h3>
      <p style="margin:0.5rem 0;color:var(--muted)">${t('about_desc')}</p>
      <p style="margin:0.5rem 0"><strong>${t('about_version')}:</strong> v3.2.0 Beta</p>
      <a href="https://github.com/kuldeep7ke/newsmeva" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-top:0.5rem">${icon('external-link')} ${t('about_github')}</a>
    </div>
    <div class="card">
      <h3>${t('about_how_it_works')}</h3>
      <p style="color:var(--muted);line-height:1.65;margin:0">${t('about_how_text')}</p>
    </div>
    <div class="card">
      <h3>${t('about_full_app')}</h3>
      <p style="color:var(--muted);line-height:1.65;margin:0">${t('about_full_text')}</p>
    </div>
    <div class="card">
      <h3>${t('about_offline')}</h3>
      <p style="color:var(--muted);line-height:1.65;margin:0">${t('about_offline_text')}</p>
    </div>
  `;
  refreshIcons();
}
