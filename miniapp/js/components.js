import { t } from './i18n.js';

export function icon(name) { return `<i data-lucide="${name}"></i>`; }
export function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
export function escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
export function titleCase(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

const STATUS_LABEL_MAP = {};
import('./seed.js').then(({ STATUS_CONFIG }) => {
  Object.keys(STATUS_CONFIG).forEach((k) => { STATUS_LABEL_MAP[k] = STATUS_CONFIG[k].label; });
});

export function statusLabel(status) { return STATUS_LABEL_MAP[status] || titleCase(status) || ''; }

export function renderSidebar(activeView) {
  const sidebar = document.querySelector('#sidebar');
  sidebar.innerHTML = `
    <div class="sidebar-main">
      <a href="#" class="brand" data-nav="dashboard"><img src="assets/logo.svg" alt="${t('app_name')}" class="brand-logo" width="38" height="38"/><span>${t('app_name')}</span></a>
      <div class="sidebar-section">
        <p class="sidebar-title">${t('dashboard')}</p>
        ${[
          ['dashboard', 'layout-dashboard', t('dashboard')],
          ['tasks', 'list-todo', t('tasks')],
          ['scripts', 'file-text', t('scripts')],
          ['teleprompter-list', 'monitor', t('teleprompter')],
        ].map(([view, iconName, label]) => `<button class="nav-item ${activeView === view ? 'active' : ''}" data-nav="${view}">${icon(iconName)}<span>${label}</span></button>`).join('')}
      </div>
      <div class="sidebar-section">
        <p class="sidebar-title">Sync</p>
        ${[
          ['cloud', 'cloud', t('cloud_sync')],
          ['backup', 'download', t('backup')],
        ].map(([view, iconName, label]) => `<button class="nav-item ${activeView === view ? 'active' : ''}" data-nav="${view}">${icon(iconName)}<span>${label}</span></button>`).join('')}
      </div>
      <div class="sidebar-section">
        <p class="sidebar-title">More</p>
        ${[
          ['recycle', 'trash-2', t('recycle_bin')],
        ].map(([view, iconName, label]) => `<button class="nav-item ${activeView === view ? 'active' : ''}" data-nav="${view}">${icon(iconName)}<span>${label}</span></button>`).join('')}
      </div>
    </div>
    <div class="sidebar-settings">
      ${[
        ['settings', 'settings', t('settings')],
        ['about', 'info', t('about')],
      ].map(([view, iconName, label]) => `<button class="settings-item ${activeView === view ? 'active' : ''}" data-nav="${view}">${icon(iconName)}<span>${label}</span></button>`).join('')}
    </div>
  `;
  refreshIcons();
}

export function renderTaskCard(task, categoryName, pending = false) {
  const isDone = task.status === 'completed' || task.status === 'cancelled' || !!task.deletedAt;
  const statusClass = isDone ? 'completed' : '';
  const doneLabel = isDone ? t('reopen_task') : t('mark_done');
  const typeLabel = titleCase(task.taskType || 'news');
  return `
    <article class="task-card ${statusClass}${pending ? ' pending' : ''}" data-task-id="${task.id}">
      <div class="task-card-main">
        <div class="task-card-top">
          <p class="task-title">${escapeHtml(task.title)}</p>
          ${pending ? `<span class="badge badge-new">${t('new_badge')}</span>` : ''}
          <span class="badge badge-${task.priority} task-priority">${t('priority_' + task.priority)}</span>
        </div>
        ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
          <span class="badge badge-${task.status}">${statusLabel(task.status)}</span>
          <span class="task-meta-type">${escapeHtml(typeLabel)}</span>
          ${categoryName ? `<span>${escapeHtml(categoryName)}</span>` : ''}
          ${task.dueDate ? `<span>${escapeHtml(task.dueDate)}</span>` : ''}
        </div>
        <div class="task-actions">
          <button class="chip-btn chip-btn-primary" data-task-done="${task.id}" title="${doneLabel}">${icon(isDone ? 'rotate-ccw' : 'check')}<span>${doneLabel}</span></button>
          <span class="task-actions-icons">
            <button class="icon-action" data-task-prompt="${task.id}" title="${t('prompt_now')}" aria-label="${t('prompt_now')}">${icon('play')}</button>
            <button class="icon-action" data-task-view="${task.id}" title="${t('view_task')}" aria-label="${t('view_task')}">${icon('eye')}</button>
            <button class="icon-action danger" data-task-delete="${task.id}" title="${t('delete')}" aria-label="${t('delete')}">${icon('trash-2')}</button>
          </span>
        </div>
      </div>
    </article>
  `;
}

export function renderTaskModal(task, categories) {
  const isEdit = !!task;
  const title = isEdit ? t('edit_task') : t('create_task');
  const allTaskTypes = ['news','breaking','special_report','story','press','ground_report','live','event'];
  let draft = null;
  if (!isEdit) {
    try { draft = JSON.parse(localStorage.getItem('newsMeva_draft_task') || 'null'); } catch { draft = null; }
  }
  const draftTitle = draft && draft.title != null ? draft.title : '';
  const draftDesc = draft && draft.description != null ? draft.description : '';
  const draftType = draft && allTaskTypes.includes(draft.taskType) ? draft.taskType : '';
  const draftPriority = draft && ['urgent','high','medium','low'].includes(draft.priority) ? draft.priority : '';

  document.querySelector('#task-modal-body').innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="icon-btn" data-close-modal>${icon('x')}</button>
    </div>
    <form id="task-form" ${isEdit ? `data-edit-id="${task.id}"` : ''}>
      <div class="field-group">
        <label class="field-label">${t('title')}</label>
        <input class="field" name="title" required value="${isEdit ? escapeHtml(task.title) : escapeHtml(draftTitle)}" placeholder="${t('placeholder_add_task')}" />
      </div>
      <div class="field-group">
        <label class="field-label">${t('description')}</label>
        <textarea class="field" name="description" placeholder="Optional description...">${isEdit ? escapeHtml(task.description || '') : escapeHtml(draftDesc)}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="field-group">
          <label class="field-label">${t('task_type')}</label>
          <select class="field" name="taskType">
            ${allTaskTypes.map((tt) => `<option value="${tt}" ${isEdit && task.taskType === tt ? 'selected' : !isEdit && draftType === tt ? 'selected' : ''}>${titleCase(tt)}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">${t('priority')}</label>
          <select class="field" name="priority">
            ${['urgent','high','medium','low'].map((p) => `<option value="${p}" ${isEdit && task.priority === p ? 'selected' : !isEdit && draftPriority === p ? 'selected' : ''}>${titleCase(p)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer${isEdit ? ' modal-footer-split' : ''}">
        ${isEdit ? `<button type="button" class="btn btn-ghost btn-text-danger" data-task-delete="${task.id}">${icon('trash-2')} ${t('delete')}</button>` : ''}
        <div class="modal-footer-group">
          <button type="button" class="btn btn-ghost" data-close-modal>${t('cancel')}</button>
          <button type="submit" class="btn btn-primary">${isEdit ? t('save') : t('add')}</button>
        </div>
      </div>
    </form>
  `;
  document.querySelector('#task-modal').classList.remove('hidden');
  refreshIcons();
}

export function renderOnboarding() {
  const steps = [
    { icon: 'layout-dashboard', title: 'Dashboard', text: 'See your open tasks, due today, and overdue at a glance.' },
    { icon: 'list-todo', title: 'Tasks', text: 'Create tasks with 8 news types — Breaking, Special Report, Story, and more.' },
    { icon: 'monitor', title: 'Teleprompter', text: 'Write scripts and prompt them live. Adjustable speed, font size, and mirror mode.' },
    { icon: 'cloud', title: 'Cloud Sync', text: 'Optional sync across your devices using your own Supabase project.' }
  ];
  const current = Number(localStorage.getItem('newsMeva_onboard_step') || '0');
  const step = steps[current] || steps[0];

  document.querySelector('#onboarding-card').innerHTML = `
    <div class="onboarding-step">
      <div class="info-icon" style="background:var(--accent-soft);width:56px;height:56px;border-radius:18px;margin:0 auto 0.5rem;display:grid;place-items:center">
        <i data-lucide="${step.icon}" style="width:28px;height:28px;color:var(--accent-strong)"></i>
      </div>
      <h3>${step.title}</h3>
      <p>${step.text}</p>
    </div>
    <div class="onboarding-dots">
      ${steps.map((_, i) => `<span class="onboarding-dot${i === current ? ' active' : ''}"></span>`).join('')}
    </div>
    <div class="onboarding-actions">
      ${current > 0 ? `<button class="btn btn-ghost btn-sm" data-onboard-prev>Back</button>` : ''}
      <button class="btn btn-primary btn-sm" data-onboard-next>${current < steps.length - 1 ? 'Next' : t('launch_app')}</button>
    </div>
  `;
  document.querySelector('#onboarding-overlay').classList.remove('hidden');
  refreshIcons();
}

export function closeOnboarding() {
  localStorage.setItem('newsMeva_onboarded', '1');
  localStorage.setItem('newsMeva_onboard_step', '0');
  document.querySelector('#onboarding-overlay').classList.add('hidden');
}

export function confirmDialog({ title, message, confirmText, cancelText, danger = false }) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'dialog-backdrop';
    root.innerHTML = `
      <div class="dialog-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title || t('confirm'))}">
        <h3>${escapeHtml(title || t('confirm'))}</h3>
        <p class="muted" style="margin:0.75rem 0 0">${escapeHtml(message || '')}</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog="cancel">${escapeHtml(cancelText || t('cancel'))}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-dialog="ok">${escapeHtml(confirmText || t('confirm'))}</button>
        </div>
      </div>
    `;
    const okBtn = root.querySelector('[data-dialog="ok"]');
    const cleanup = (value) => {
      document.removeEventListener('keydown', onKey);
      root.remove();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };
    root.addEventListener('click', (e) => {
      if (e.target === root) return cleanup(false);
      const action = e.target.closest('[data-dialog]');
      if (action) cleanup(action.dataset.dialog === 'ok');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(root);
    okBtn.focus();
    refreshIcons();
  });
}

export function alertDialog({ title, message, okText }) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'dialog-backdrop';
    root.innerHTML = `
      <div class="dialog-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title || '')}">
        <h3>${escapeHtml(title || '')}</h3>
        <p class="muted" style="margin:0.75rem 0 0">${escapeHtml(message || '')}</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-primary" data-dialog="ok">${escapeHtml(okText || t('confirm'))}</button>
        </div>
      </div>
    `;
    const cleanup = () => {
      document.removeEventListener('keydown', onKey);
      root.remove();
      resolve();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup();
    };
    root.addEventListener('click', (e) => {
      if (e.target === root) return cleanup();
      const action = e.target.closest('[data-dialog]');
      if (action) cleanup();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(root);
    root.querySelector('[data-dialog="ok"]').focus();
    refreshIcons();
  });
}
