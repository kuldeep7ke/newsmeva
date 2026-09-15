import { t } from './i18n.js';

export function icon(name) { return `<i data-lucide="${name}"></i>`; }
export function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
export function escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const STATUS_LABEL_MAP = {};
import('./seed.js').then(({ STATUS_CONFIG }) => {
  Object.keys(STATUS_CONFIG).forEach((k) => { STATUS_LABEL_MAP[k] = STATUS_CONFIG[k].label; });
});

export function statusLabel(status) { return STATUS_LABEL_MAP[status] || status?.replace(/_/g, ' ') || ''; }

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

export function renderTaskCard(task, categoryName) {
  const isOpen = task.status !== 'completed' && task.status !== 'cancelled' && !task.deletedAt;
  const statusClass = task.status === 'completed' ? 'completed' : task.status === 'cancelled' ? 'completed' : '';
  return `
    <article class="task-card ${statusClass}" data-task-id="${task.id}">
      ${task.status !== 'completed' && task.status !== 'cancelled' ? `<button class="status-btn" data-task-next="${task.id}" title="${t('next_stage')}">${icon('arrow-right')}</button>` : `<button class="status-btn completed" disabled>${icon('check')}</button>`}
      <div>
        <p class="task-title">${escapeHtml(task.title)}</p>
        ${task.description ? `<p class="muted" style="font-size:0.85rem;margin:0 0 4px">${escapeHtml(task.description).slice(0, 80)}</p>` : ''}
        <div class="task-meta">
          <span class="badge badge-${task.status}">${statusLabel(task.status)}</span>
          ${categoryName ? `<span>${escapeHtml(categoryName)}</span>` : ''}
          ${task.dueDate ? `<span>${escapeHtml(task.dueDate)}</span>` : ''}
        </div>
        ${isOpen ? `<div class="task-actions">
          <button class="chip-btn" data-task-next="${task.id}" title="${t('next_stage')}">${icon('arrow-right')}<span>${t('next_stage')}</span></button>
          <button class="chip-btn" data-task-view="${task.id}" title="${t('view_task')}">${icon('eye')}<span>${t('view_task')}</span></button>
        </div>` : ''}
      </div>
      <span class="badge badge-${task.priority}">${t('priority_' + task.priority)}</span>
    </article>
  `;
}

export function renderTaskModal(task, categories) {
  const isEdit = !!task;
  const title = isEdit ? t('edit_task') : t('create_task');
  const allTaskTypes = ['news','breaking','special_report','story','press','ground_report','live','event'];

  document.querySelector('#task-modal-body').innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="icon-btn" data-close-modal>${icon('x')}</button>
    </div>
    <form id="task-form" ${isEdit ? `data-edit-id="${task.id}"` : ''}>
      <div class="field-group">
        <label class="field-label">${t('title')}</label>
        <input class="field" name="title" required value="${isEdit ? escapeHtml(task.title) : ''}" placeholder="${t('placeholder_add_task')}" />
      </div>
      <div class="field-group">
        <label class="field-label">${t('description')}</label>
        <textarea class="field" name="description" placeholder="Optional description...">${isEdit ? escapeHtml(task.description || '') : ''}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="field-group">
          <label class="field-label">${t('task_type')}</label>
          <select class="field" name="taskType">
            ${allTaskTypes.map((tt) => `<option value="${tt}" ${isEdit && task.taskType === tt ? 'selected' : ''}>${tt.replace(/_/g, ' ')}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">${t('priority')}</label>
          <select class="field" name="priority">
            ${['urgent','high','medium','low'].map((p) => `<option value="${p}" ${isEdit && task.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-close-modal>${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${isEdit ? t('save') : t('add')}</button>
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
  localStorage.setItem('newsMeva_onboard_step', '0');
  document.querySelector('#onboarding-overlay').classList.add('hidden');
}
