import { getTasks, getCategories, getScripts, getDeletedScripts, localDateStr, addTask } from './db.js';
import { PRIORITY_CONFIG, TASK_TYPES } from './seed.js';
import { t } from './i18n.js';
import { escapeHtml, refreshIcons, statusLabel, renderTaskCard, renderTaskModal, renderOnboarding, closeOnboarding, icon, titleCase } from './components.js';
import { setupBackup } from './backup.js';
import { SCHEMA_SQL, getIdentity } from './sync.js';
import { getDeviceId, getBroadcastStatus } from './broadcast.js';

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
          ${['urgent','high','medium','low'].map((p) => `<option value="${p}"${p==='medium'?' selected':''}>${titleCase(p)}</option>`).join('')}
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

function scriptRow(s, pending = false, finished = false) {
  const updated = (s.updatedAt || '').slice(0, 10);
  return `
    <div class="script-row${pending ? ' pending' : ''}${finished ? ' finished' : ''}" data-script-id="${s.id}">
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
  const recent = [
    ...open.map((tk) => ({ kind: 'task', key: tk.updatedAt || tk.createdAt || '', task: tk })),
    ...pendingScripts.map((s) => ({ kind: 'script', key: s.updatedAt || s.createdAt || '', script: s })),
  ].sort((a, b) => String(b.key).localeCompare(String(a.key)));
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <div class="card">
      <div class="list-header">
        <h3>${t('recent_activity')} <span class="muted">(${recent.length})</span></h3>
      </div>
      <div class="task-list">
        ${recent.length
          ? recent.map((it) => it.kind === 'task' ? renderTaskCard(it.task, categoryMap.get(it.task.categoryId)?.name, true) : scriptRow(it.script, true)).join('')
          : `<p class="empty-state">${t('recent_empty')}</p>`}
      </div>
    </div>
    ${completed.length ? `
      <div class="card">
        <div class="list-header">
          <h3>${t('tasks')} <span class="muted">(${completed.length})</span></h3>
        </div>
        <div class="task-list">
          ${completed.map((tk) => renderTaskCard(tk, categoryMap.get(tk.categoryId)?.name)).join('')}
        </div>
      </div>
    ` : ''}
    ${finishedScripts.length ? `
      <div class="card">
        <div class="list-header">
          <h3>${t('scripts')} <span class="muted">(${finishedScripts.length})</span></h3>
        </div>
        <div class="task-list">
          ${finishedScripts.map((s) => scriptRow(s, false, true)).join('')}
        </div>
      </div>
    ` : ''}
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
        ${scripts.length ? scripts.map((s) => scriptRow(s, !s.finishedAt, !!s.finishedAt)).join('') : `<p class="empty-state">${t('scripts_empty')}</p>`}
      </div>
    </div>
  `;
  refreshIcons();
}

export async function renderScriptEditor(scriptId) {
  const script = scriptId ? await import('./db.js').then((m) => m.getScript(scriptId)) : null;
  const isEdit = !!script;
  let draft = null;
  if (!isEdit) {
    try { draft = JSON.parse(localStorage.getItem('newsMeva_draft_script') || 'null'); } catch { draft = null; }
  }
  const draftTitle = draft && draft.title != null ? draft.title : '';
  const draftContent = draft && draft.content != null ? draft.content : '';
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
          <input class="field" name="title" required value="${isEdit ? escapeHtml(script.title) : escapeHtml(draftTitle)}" />
        </div>
        <div class="field-group">
          <label class="field-label">${t('script_content')}</label>
          <textarea class="field" name="content" style="min-height:280px;font-size:1rem;line-height:1.7" placeholder="Write your script here...">${isEdit ? escapeHtml(script.content) : escapeHtml(draftContent)}</textarea>
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
      <div class="sync-url-chip hidden" id="sync-url-chip">
        <span class="sync-url-chip-label" id="sync-url-chip-label">${t('cloud_saved_link')}</span>
        <span class="sync-url-chip-value" id="sync-url-chip-value"></span>
        <span class="sync-url-chip-actions">
          <button type="button" class="chip-btn" id="sync-url-copy" title="${t('cloud_copy_url')}" aria-label="${t('cloud_copy_url')}">${icon('copy')}</button>
          <button type="button" class="chip-btn" id="sync-url-clear" title="${t('cloud_clear_saved')}" aria-label="${t('cloud_clear_saved')}">${icon('x')}</button>
        </span>
      </div>
      <form id="sync-config-form">
        <div class="field-group">
          <label class="field-label" for="sync-url">${t('cloud_supabase_url')}</label>
          <input class="field" id="sync-url" name="url" type="url" placeholder="https://your-project.supabase.co" autocomplete="off" />
        </div>
        <div class="field-group">
          <label class="field-label" for="sync-key">${t('cloud_supabase_key')}</label>
          <input class="field" id="sync-key" name="key" placeholder="your-anon-key" autocomplete="off" />
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary">${t('cloud_connect')}</button>
          <button type="button" class="btn btn-ghost" id="sync-save-btn">${icon('save')} ${t('cloud_save_link')}</button>
          <button type="button" class="btn btn-primary hidden" id="sync-btn">${icon('refresh-cw')} ${t('cloud_sync_btn')}</button>
          <button type="button" class="btn btn-ghost hidden" id="sync-disconnect-btn">${t('cloud_disconnect')}</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h3>Supabase Setup</h3>
      <p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem">${t('cloud_schema_info')}</p>
      <textarea class="field" id="sync-schema" name="syncSchema" readonly aria-label="Supabase schema" style="font-family:monospace;font-size:0.78rem;min-height:120px;background:var(--surface-soft)">${SCHEMA_SQL}</textarea>
    </div>
  `;
  if (sync) {
    const cfg = sync.getSyncConfig();
    const saved = sync.getSavedSync ? sync.getSavedSync() : null;
    const url = (cfg && cfg.url) || (saved && saved.url) || '';
    const key = (cfg && cfg.key) || (saved && saved.key) || '';
    const form = document.querySelector('#sync-config-form');
    if (form) { form.url.value = url || ''; form.key.value = key || ''; }
    if (url) {
      const chip = document.querySelector('#sync-url-chip');
      const label = document.querySelector('#sync-url-chip-label');
      const value = document.querySelector('#sync-url-chip-value');
      const clearBtn = document.querySelector('#sync-url-clear');
      if (chip) chip.classList.remove('hidden');
      if (label) label.textContent = cfg ? t('cloud_connected_to') : t('cloud_saved_link');
      if (value) value.textContent = url;
      if (clearBtn) clearBtn.classList.toggle('hidden', Boolean(cfg));
    }
    const saveBtn = document.querySelector('#sync-save-btn');
    const syncBtn = document.querySelector('#sync-btn');
    const disconnectBtn = document.querySelector('#sync-disconnect-btn');
    if (saveBtn) saveBtn.classList.toggle('hidden', Boolean(cfg));
    if (syncBtn) syncBtn.classList.toggle('hidden', !cfg);
    if (disconnectBtn) disconnectBtn.classList.toggle('hidden', !cfg);
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
  const broadcastStatusText = getBroadcastStatus();
  content.innerHTML = `
    <div class="card">
      <h3>${t('identity')}</h3>
      <p class="muted" style="font-size:0.88rem;margin:0 0 1rem">${t('identity_info')}</p>
      <form id="identity-form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
          <div class="field-group">
            <label class="field-label" for="settings-identity-user">${t('cloud_user')}</label>
            <input class="field" id="settings-identity-user" name="user" type="text" maxlength="40" placeholder="${t('cloud_user_ph')}" value="${escapeHtml(getIdentity().user || '')}" />
          </div>
          <div class="field-group">
            <label class="field-label" for="settings-identity-channel">${t('cloud_channel')}</label>
            <input class="field" id="settings-identity-channel" name="channel" type="text" maxlength="40" placeholder="${t('cloud_channel_ph')}" value="${escapeHtml(getIdentity().channel || '')}" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </form>
    </div>
    <div class="card">
      <h3>${t('s_navigation')}</h3>
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('s_goto_dashboard')}</div>
          <div class="setting-sub">${t('s_goto_dashboard_desc')}</div>
        </div>
        <button class="btn btn-ghost" id="goto-dashboard-btn">${t('s_go')}</button>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('s_goto_landing')}</div>
          <div class="setting-sub">${t('s_goto_landing_desc')}</div>
        </div>
        <button class="btn btn-ghost" id="landing-go-btn">${t('s_go')}</button>
      </div>
    </div>
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
       <h3>${t('s_broadcasts')}</h3>
       <p class="muted" style="font-size:0.88rem;margin:0 0 0.75rem">${t('s_broadcasts_desc')}</p>
       <div class="setting-row">
         <div>
           <div class="setting-label">${t('bc_device_id')}</div>
           <div class="setting-sub bc-device-id">${escapeHtml(getDeviceId())}</div>
           <div class="setting-sub" style="margin-top:0.25rem">${t('bc_device_id_desc')}</div>
         </div>
         <button class="btn btn-ghost" id="bc-copy-id-btn">${t('bc_copy_id')}</button>
       </div>
       <div class="setting-row">
         <div>
           <div class="setting-label">${t('bc_state')}</div>
           <div class="setting-sub" id="bc-state">${broadcastStatusText}</div>
         </div>
         <button class="btn btn-ghost" id="bc-refresh-btn">${icon('refresh-cw')} ${t('bc_refresh')}</button>
       </div>
     </div>
     <div class="card">
       <h3>${t('settings_data')}</h3>
       <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
         <button class="btn btn-ghost" id="settings-cloud-btn">${icon('cloud')} ${t('settings_cloud_link')}</button>
         <button class="btn btn-ghost" id="settings-backup-btn">${icon('download')} ${t('settings_backup_link')}</button>
       </div>
     </div>
    <div class="card">
      <h3>${t('s_danger')}</h3>
      <div id="danger-main">
        <div class="setting-row">
          <div>
            <div class="setting-label">${t('s_clear_all')}</div>
            <div class="setting-sub">${t('s_clear_all_desc')}</div>
          </div>
          <button class="btn btn-danger" id="danger-show-btn">${t('s_clear_all')}</button>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">${t('s_prefs_reset')}</div>
            <div class="setting-sub">${t('s_prefs_reset_desc')}</div>
          </div>
          <button class="btn btn-ghost" id="prefs-reset-btn">${t('s_prefs_reset_btn')}</button>
        </div>
      </div>
      <div id="danger-confirm" class="hidden">
        <p class="muted" style="margin:0 0 0.5rem">${t('s_confirm_delete')}</p>
        <input class="field" id="danger-confirm-input" placeholder="${t('s_confirm_placeholder')}" autocomplete="off" aria-label="${t('s_confirm_delete')}" />
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
          <button class="btn btn-danger" id="danger-confirm-btn" disabled>${t('s_clear_all')}</button>
          <button class="btn btn-ghost" id="danger-cancel-btn">${t('cancel')}</button>
        </div>
      </div>
    </div>
    <div class="card">
      <h3>${t('s_guides')}</h3>
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('s_basic_guide')}</div>
          <div class="setting-sub">${t('s_basic_guide_desc')}</div>
        </div>
        <button class="btn btn-ghost" id="basic-guide-btn">${t('s_open')}</button>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('s_recommended_guide')}</div>
          <div class="setting-sub">${t('s_recommended_guide_desc')}</div>
        </div>
        <button class="btn btn-ghost" id="recommended-guide-btn">${t('s_open')}</button>
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

function renderGuidePage({ titleKey, introKey, itemsKey }) {
  const content = document.querySelector('#view-content');
  const items = t(itemsKey);
  const cards = Array.isArray(items)
    ? items.map((s) => `
      <div class="card">
        <h3>${escapeHtml(s.h)}</h3>
        <p style="color:var(--muted);line-height:1.65;margin:0">${escapeHtml(s.b)}</p>
      </div>`).join('')
    : '';
  content.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:flex-start">
        <div>
          <h3 style="margin:0">${t(titleKey)}</h3>
          <p class="muted" style="font-size:0.88rem;margin:0.4rem 0 0">${t(introKey)}</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="guide-back-btn">${icon('arrow-left')} ${t('guide_back')}</button>
      </div>
    </div>
    ${cards}
  `;
  refreshIcons();
}

export async function renderGuideBasic() {
  renderGuidePage({ titleKey: 'guide_basic_title', introKey: 'guide_basic_intro', itemsKey: 'guide_basic' });
}

export async function renderGuideRecommended() {
  renderGuidePage({ titleKey: 'guide_rec_title', introKey: 'guide_rec_intro', itemsKey: 'guide_rec' });
}
