import { seedDatabase, addTask, updateTask, deleteTask, restoreTask, permanentDeleteTask, getTask, addScript, updateScript, deleteScript, restoreScript, permanentDeleteScript, getScriptByTask, wipeAllData } from './db.js';
import { renderSidebar, refreshIcons, closeOnboarding, icon, escapeHtml, confirmDialog } from './components.js';
import { renderDashboard, renderTasks, renderTeleprompterList, renderScripts, renderScriptEditor, renderRecycleBin, renderCloud, renderBackup, renderSettings, renderAbout, renderGuideBasic, renderGuideRecommended, showOnboarding, updateSyncStatusUI } from './views.js';
import { setupBackup } from './backup.js';
import { initLang, setLang, t } from './i18n.js';
import { openPrompter } from './teleprompter.js';
import * as sync from './sync.js';
import { initBroadcasts, refreshBroadcasts, getDeviceId } from './broadcast.js';

let initPromise = null;
let activeView = 'dashboard';
window.__currentView = 'dashboard';

window.navigateTo = navigateTo;
window.refreshCurrentView = refreshCurrentView;

function hideSplash() {
  const splash = document.querySelector('#splash-screen');
  if (splash) splash.style.display = 'none';
}

function showLanding() {
  document.querySelector('#landing-page').classList.remove('hidden');
}

async function enterApp() {
  document.querySelector('#landing-page').classList.add('hidden');
  document.querySelector('#app-shell').classList.remove('hidden');
  await initApp();
}

function goLanding() {
  if (localStorage.getItem('newsMeva_onboarded')) { closeSidebar(); navigateTo('dashboard'); return; }
  closeSidebar();
  const taskModalEl = document.querySelector('#task-modal');
  if (taskModalEl && !taskModalEl.classList.contains('hidden')) {
    if (!taskFormHasContent()) clearTaskDraft();
    closeTaskModal();
  }
  document.querySelector('#app-shell').classList.add('hidden');
  document.querySelector('#landing-page').classList.remove('hidden');
}

async function initApp() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    initLang();
    await seedDatabase();
    wireGlobalEvents();
    updateUserChip();
    await refreshCurrentView();
    showOnboarding();
    initBroadcasts();
    listenSyncEvents();
    // auto-reconnect if previously connected
    const savedSync = sync.getSyncConfig();
    if (savedSync && savedSync.url && savedSync.key) {
      sync.connect(savedSync).catch(() => {});
    }
    setTimeout(hideSplash, 600);
  })();
  return initPromise;
}

function updateFabLabels() {
  document.querySelectorAll('[data-fab-label]').forEach((el) => {
    const key = el.dataset.fabLabel;
    el.textContent = key === 'task' ? t('new_task') : t('new_script');
  });
}

function toggleFabMenu() {
  const actions = document.querySelector('#fab-actions');
  if (!actions) return;
  const open = actions.classList.toggle('hidden') === false;
  const fab = document.querySelector('#fab');
  if (fab) { fab.classList.toggle('open', open); fab.innerHTML = icon(open ? 'x' : 'plus'); }
  refreshIcons();
}

function closeFabMenu() {
  const actions = document.querySelector('#fab-actions');
  if (!actions || actions.classList.contains('hidden')) return;
  actions.classList.add('hidden');
  const fab = document.querySelector('#fab');
  if (fab) { fab.classList.remove('open'); fab.innerHTML = icon('plus'); }
  refreshIcons();
}

function wireGlobalEvents() {
  updateFabLabels();
  document.querySelector('#fab').addEventListener('click', toggleFabMenu);
  document.querySelector('#fab-actions').addEventListener('click', (e) => {
    const action = e.target.closest('[data-fab]');
    if (!action) return;
    closeFabMenu();
    if (action.dataset.fab === 'task') openTaskModal();
    else navigateTo('script-editor', '');
  });
  document.querySelector('#mobile-menu-btn').addEventListener('click', openSidebar);
  document.querySelector('#sidebar-backdrop').addEventListener('click', closeSidebar);
  document.querySelector('#theme-toggle').addEventListener('click', toggleTheme);
  document.querySelector('#task-modal').addEventListener('click', handleModalBackdropClick);
  document.querySelector('#onboarding-overlay').addEventListener('click', handleOnboardingBackdropClick);

  document.querySelector('#sidebar').addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) { navigateTo(navBtn.dataset.nav); closeSidebar(); }
  });

  document.querySelector('#view-content').addEventListener('click', handleViewContentClick);
  document.querySelector('#view-content').addEventListener('submit', handleViewContentSubmit);
  document.querySelector('#view-content').addEventListener('change', handleViewContentChange);
  document.querySelector('#view-content').addEventListener('input', handleViewContentInput);

  document.querySelector('#task-modal').addEventListener('submit', (e) => {
    const form = e.target;
    if (form.id === 'task-form') {
      e.preventDefault();
      e.stopPropagation();
      handleTaskFormSubmit(form);
    }
  });
  document.querySelector('#task-modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) { clearTaskDraft(); closeTaskModal(); }
    const delBtn = e.target.closest('[data-task-delete]');
    if (delBtn) handleTaskDelete(delBtn.dataset.taskDelete);
  });
  document.querySelector('#task-modal').addEventListener('input', handleTaskModalInput);
  document.querySelector('#onboarding-overlay').addEventListener('click', (e) => {
    if (e.target.closest('[data-onboard-next]')) return handleOnboardNext();
    if (e.target.closest('[data-onboard-prev]')) return handleOnboardPrev();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (document.querySelector('.tp-root')) return;
      e.preventDefault();
      openTaskModal();
    }
    if (e.key === 'Escape') {
      closeSidebar();
      closeFabMenu();
      const taskModalEl = document.querySelector('#task-modal');
      if (taskModalEl && !taskModalEl.classList.contains('hidden')) {
        if (taskFormHasContent()) return;
        clearTaskDraft();
      }
      closeTaskModal();
    }
  });

  setupBackup();
}

function listenSyncEvents() {
  document.addEventListener('newsmeva:sync', (e) => {
    updateSyncStatusUI(e.detail);
    const indicator = document.querySelector('#sync-indicator');
    if (indicator) {
      indicator.classList.remove('hidden');
      indicator.classList.toggle('connected', e.detail.status === 'connected');
    }
  });
}

function openSidebar() {
  document.querySelector('#sidebar').classList.add('open');
  document.querySelector('#sidebar-backdrop').classList.add('open');
}

function closeSidebar() {
  document.querySelector('#sidebar').classList.remove('open');
  document.querySelector('#sidebar-backdrop').classList.remove('open');
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('newsMeva_theme', next);
  const btn = document.querySelector('#theme-toggle');
  if (btn) btn.innerHTML = next === 'dark' ? icon('sun') : icon('moon');
  refreshIcons();
}

function handleModalBackdropClick(e) {
  if (e.target.id !== 'task-modal') return;
  if (taskFormHasContent()) return;
  clearTaskDraft();
  closeTaskModal();
}

function handleOnboardingBackdropClick(e) {
  if (e.target.id === 'onboarding-overlay') closeOnboarding();
}

function closeTaskModal() {
  document.querySelector('#task-modal').classList.add('hidden');
}

const TASK_DRAFT_KEY = 'newsMeva_draft_task';
const SCRIPT_DRAFT_KEY = 'newsMeva_draft_script';

function taskFormHasContent() {
  const form = document.querySelector('#task-form');
  if (!form) return false;
  const fd = new FormData(form);
  return !!(fd.get('title') || '').trim() || !!(fd.get('description') || '').trim();
}

function clearTaskDraft() { localStorage.removeItem(TASK_DRAFT_KEY); }
function clearScriptDraft() { localStorage.removeItem(SCRIPT_DRAFT_KEY); }

function handleTaskModalInput() {
  const form = document.querySelector('#task-form');
  if (!form || form.dataset.editId) return;
  const fd = new FormData(form);
  localStorage.setItem(TASK_DRAFT_KEY, JSON.stringify({
    title: fd.get('title') || '',
    description: fd.get('description') || '',
    taskType: fd.get('taskType') || 'news',
    priority: fd.get('priority') || 'medium'
  }));
}

function handleViewContentClick(e) {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    if (activeView === 'script-editor' && navBtn.dataset.nav === 'scripts') clearScriptDraft();
    return navigateTo(navBtn.dataset.nav);
  }
  const themeBtn = e.target.closest('#theme-toggle-btn');
  if (themeBtn) {
    toggleTheme();
    const isDark = document.documentElement.dataset.theme === 'dark';
    const btn = document.querySelector('#theme-toggle-btn');
    if (btn) btn.innerHTML = isDark ? icon('sun') : icon('moon');
    const sub = document.querySelector('#theme-desc');
    if (sub) sub.textContent = isDark ? t('theme_dark') : t('theme_light');
    refreshIcons();
    return;
  }
  const brandSwatch = e.target.closest('.brand-swatch');
  if (brandSwatch) {
    const brand = brandSwatch.dataset.brand;
    if (brand) {
      document.documentElement.dataset.brand = brand;
      localStorage.setItem('newsMeva_brand', brand);
      document.querySelectorAll('.brand-swatch').forEach((s) => s.classList.toggle('active', s.dataset.brand === brand));
    }
    return;
  }
  const settingsCloudBtn = e.target.closest('#settings-cloud-btn');
  if (settingsCloudBtn) return navigateTo('cloud');
  const settingsBackupBtn = e.target.closest('#settings-backup-btn');
  if (settingsBackupBtn) return navigateTo('backup');
  const gotoDashboardBtn = e.target.closest('#goto-dashboard-btn');
  if (gotoDashboardBtn) return navigateTo('dashboard');
  const landingGoBtn = e.target.closest('#landing-go-btn');
  if (landingGoBtn) return goLanding();
  const bcCopyIdBtn = e.target.closest('#bc-copy-id-btn');
  if (bcCopyIdBtn) return handleBroadcastCopyId(bcCopyIdBtn);
  const bcRefreshBtn = e.target.closest('#bc-refresh-btn');
  if (bcRefreshBtn) return handleBroadcastRefresh(bcRefreshBtn);
  const basicGuideBtn = e.target.closest('#basic-guide-btn');
  if (basicGuideBtn) return navigateTo('guide-basic');
  const recommendedGuideBtn = e.target.closest('#recommended-guide-btn');
  if (recommendedGuideBtn) return navigateTo('guide-recommended');
  const guideBackBtn = e.target.closest('#guide-back-btn');
  if (guideBackBtn) return navigateTo('settings');
  const dangerShow = e.target.closest('#danger-show-btn');
  if (dangerShow) return showDangerPanel();
  const dangerCancel = e.target.closest('#danger-cancel-btn');
  if (dangerCancel) return resetDangerPanel();
  const dangerDo = e.target.closest('#danger-confirm-btn');
  if (dangerDo) return handleWipeAll();
  const prefsReset = e.target.closest('#prefs-reset-btn');
  if (prefsReset) return handlePrefsReset();
  const syncPush = e.target.closest('#sync-btn');
  if (syncPush) return sync.manualSync().then(() => refreshCurrentView());
  const syncDisconnect = e.target.closest('#sync-disconnect-btn');
  if (syncDisconnect) return sync.disconnect().then(() => refreshCurrentView());
  const syncSave = e.target.closest('#sync-save-btn');
  if (syncSave) return handleSyncSave();
  const syncUrlCopy = e.target.closest('#sync-url-copy');
  if (syncUrlCopy) return handleSyncUrlCopy(syncUrlCopy);
  const syncUrlClear = e.target.closest('#sync-url-clear');
  if (syncUrlClear) { sync.clearSavedLink(); return refreshCurrentView(); }
  const doneBtn = e.target.closest('[data-task-done]');
  if (doneBtn) return handleTaskDone(doneBtn.dataset.taskDone);
  const donePopupBg = e.target.closest('[data-done-popup]');
  if (donePopupBg && e.target === donePopupBg) return closeDonePopup();
  const donePopupAction = e.target.closest('[data-done-action]');
  if (donePopupAction) return handleDoneAction(donePopupAction.dataset.doneAction);
  const donePopupCancel = e.target.closest('[data-done-cancel]');
  if (donePopupCancel) return closeDonePopup();
  const viewBtn = e.target.closest('[data-task-view]');
  if (viewBtn) return handleTaskView(viewBtn.dataset.taskView);
  const promptBtn = e.target.closest('[data-task-prompt]');
  if (promptBtn) return handleTaskPrompt(promptBtn.dataset.taskPrompt);
  const delBtn = e.target.closest('[data-task-delete]');
  if (delBtn) return handleTaskDelete(delBtn.dataset.taskDelete);
  const createTaskBtn = e.target.closest('[data-create-task]');
  if (createTaskBtn) return openTaskModal();
  const onDelBtn = e.target.closest('[data-recycle-purge]');
  if (onDelBtn) return handlePermanentDelete(onDelBtn.dataset.recyclePurge, onDelBtn.dataset.recycleType);
  const onRestoreBtn = e.target.closest('[data-recycle-restore]');
  if (onRestoreBtn) return handleRestore(onRestoreBtn.dataset.recycleRestore, onRestoreBtn.dataset.recycleType);
  const scriptPromptBtn = e.target.closest('[data-script-prompt]');
  if (scriptPromptBtn) return handleScriptPrompt(scriptPromptBtn.dataset.scriptPrompt);
  const scriptEditBtn = e.target.closest('[data-script-edit]');
  if (scriptEditBtn) return navigateTo('script-editor', scriptEditBtn.dataset.scriptEdit);
  const scriptDelBtn = e.target.closest('[data-script-delete]');
  if (scriptDelBtn) return handleScriptDelete(scriptDelBtn.dataset.scriptDelete);
  const createScriptBtn = e.target.closest('[data-create-script]');
  if (createScriptBtn) return navigateTo('script-editor', '');
  const onboardNext = e.target.closest('[data-onboard-next]');
  if (onboardNext) return handleOnboardNext();
  const onboardPrev = e.target.closest('[data-onboard-prev]');
  if (onboardPrev) return handleOnboardPrev();
}

function handleViewContentSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (form.id === 'task-form') return handleTaskFormSubmit(form);
  if (form.id === 'script-form') return handleScriptFormSubmit(form);
  if (form.id === 'sync-config-form') return handleSyncConfig(form);
  if (form.id === 'identity-form') return handleIdentityForm(form);
}

function handleViewContentChange(e) {
  if (e.target.id === 'lang-select') {
    setLang(e.target.value);
    updateFabLabels();
    refreshCurrentView();
  }
}

function handleViewContentInput(e) {
  if (e.target.id === 'danger-confirm-input') {
    const btn = document.querySelector('#danger-confirm-btn');
    if (btn) btn.disabled = e.target.value !== 'DELETE';
    return;
  }
  const form = e.target.closest('#script-form');
  if (form && !form.dataset.editId) {
    localStorage.setItem(SCRIPT_DRAFT_KEY, JSON.stringify({
      title: form.elements.title ? form.elements.title.value : '',
      content: form.elements.content ? form.elements.content.value : ''
    }));
  }
}

function showDangerPanel() {
  const main = document.querySelector('#danger-main');
  const panel = document.querySelector('#danger-confirm');
  if (main) main.classList.add('hidden');
  if (panel) panel.classList.remove('hidden');
  const input = document.querySelector('#danger-confirm-input');
  if (input) input.focus();
}

function resetDangerPanel() {
  const main = document.querySelector('#danger-main');
  const panel = document.querySelector('#danger-confirm');
  const input = document.querySelector('#danger-confirm-input');
  const btn = document.querySelector('#danger-confirm-btn');
  if (main) main.classList.remove('hidden');
  if (panel) panel.classList.add('hidden');
  if (input) input.value = '';
  if (btn) btn.disabled = true;
}

async function handleWipeAll() {
  await wipeAllData();
  resetDangerPanel();
  refreshCurrentView();
}

function resetPrefs() {
  localStorage.setItem('newsMeva_theme', 'light');
  localStorage.removeItem('newsMeva_brand');
  setLang('en');
  document.documentElement.dataset.theme = 'light';
  document.documentElement.dataset.brand = 'orange';
}

function handlePrefsReset() {
  resetPrefs();
  refreshCurrentView();
}

let pendingDoneTaskId = null;

function showDonePopup(task) {
  const content = document.querySelector('#view-content');
  if (!content) return;
  pendingDoneTaskId = task.id;
  content.insertAdjacentHTML('beforeend', `
    <div class="action-overlay" data-done-popup>
      <div class="action-popup" role="dialog" aria-modal="true" aria-label="${t('mark_done')}">
        <h3>${t('done_popup_title')}</h3>
        <p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem">${escapeHtml(task.title)}</p>
        <button class="btn btn-primary" data-done-action="done">${icon('check')} ${t('done_only')}</button>
        <button class="btn" data-done-action="prompt">${icon('play')} ${t('done_prompt')}</button>
        <button class="btn" data-done-cancel>${t('cancel')}</button>
      </div>
    </div>
  `);
  refreshIcons();
}

function closeDonePopup() {
  document.querySelectorAll('[data-done-popup]').forEach((el) => el.remove());
  pendingDoneTaskId = null;
}

async function handleDoneAction(action) {
  const taskId = pendingDoneTaskId;
  closeDonePopup();
  if (!taskId) return;
  await updateTask(taskId, { status: 'completed' });
  if (action === 'prompt') await handleTaskPrompt(taskId);
  else refreshCurrentView();
}

async function handleTaskDone(taskId) {
  const task = await getTask(taskId);
  if (!task) return;
  if (task.status === 'completed' || task.status === 'cancelled') {
    await updateTask(taskId, { status: 'draft' });
    refreshCurrentView();
    return;
  }
  showDonePopup(task);
}

async function handleTaskView(taskId) {
  openTaskModal(taskId);
}

async function openTaskModal(taskId) {
  const task = taskId ? await getTask(taskId) : null;
  const { renderTaskModal } = await import('./components.js');
  renderTaskModal(task);
  refreshIcons();
}

async function handleTaskFormSubmit(form) {
  const fd = new FormData(form);
  const isEdit = form.dataset.editId;
  const data = {
    title: fd.get('title'),
    description: fd.get('description'),
    taskType: fd.get('taskType'),
    priority: fd.get('priority')
  };
  if (isEdit) {
    await updateTask(isEdit, data);
  } else {
    await addTask(data);
  }
  closeTaskModal();
  refreshCurrentView();
}

async function handlePermanentDelete(id, type) {
  const ok = await confirmDialog({ title: t('confirm_title'), message: t('del_forever_message'), confirmText: t('dialog_delete'), danger: true });
  if (!ok) return;
  if (type === 'script') await permanentDeleteScript(id);
  else await permanentDeleteTask(id);
  refreshCurrentView();
}

async function handleRestore(id, type) {
  if (type === 'script') await restoreScript(id);
  else await restoreTask(id);
  refreshCurrentView();
}

function tpSettings() {
  return {
    speed: Number(localStorage.getItem('tp_speed') || 3),
    fontSize: Number(localStorage.getItem('tp_fontSize') || 32),
    mirror: localStorage.getItem('tp_mirror') === '1',
    textAlign: localStorage.getItem('tp_align') || 'left',
    lineHeight: Number(localStorage.getItem('tp_spacing') || 1.6)
  };
}

function openScriptPrompter({ title, subtitle, body, scriptId, onFinish, doneMessage }) {
  const wrapper = document.createElement('div');
  document.body.appendChild(wrapper);
  openPrompter(wrapper, body, tpSettings(), {
    title, subtitle, scriptId, onFinish, doneMessage,
    onClose: () => { refreshCurrentView(); }
  });
}

async function handleScriptPrompt(scriptId) {
  const { getScript, updateScript } = await import('./db.js');
  const script = await getScript(scriptId);
  if (!script) return;
  if (script.finishedAt) await updateScript(scriptId, { finishedAt: '' });
  openScriptPrompter({
    title: script.title || '',
    subtitle: '',
    body: script.content || '',
    scriptId: script.id,
    doneMessage: 'Finished'
  });
}

async function handleTaskPrompt(taskId) {
  const { getCategories } = await import('./db.js');
  const task = await getTask(taskId);
  if (!task || task.deletedAt) return;
  const categories = await getCategories();
  const categoryName = categories.find((c) => c.id === task.categoryId)?.name || '';
  const typeLabel = String(task.taskType || 'news').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const priorityLabel = task.priority ? `${String(task.priority).replace(/\b\w/g, (c) => c.toUpperCase())} Priority` : '';
  const metaBits = [typeLabel, categoryName, priorityLabel, task.dueDate || ''].filter(Boolean);
  const description = (task.description || '').trim();
  const body = description || metaBits.join('\n');
  const existing = await getScriptByTask(task.id);
  let scriptId = null;
  if (existing) {
    await updateScript(existing.id, { title: task.title || '', content: body, taskId: task.id, finishedAt: '' });
    scriptId = existing.id;
  } else {
    scriptId = await addScript({ title: task.title || '', content: body, taskId: task.id, finishedAt: '' });
  }
  openScriptPrompter({
    title: task.title || '',
    subtitle: metaBits.join(' · '),
    body,
    scriptId,
    doneMessage: 'Recording finished — task marked done',
    onFinish: async () => {
      const fresh = await getTask(taskId);
      if (fresh && fresh.status !== 'completed') await updateTask(taskId, { status: 'completed' });
      refreshCurrentView();
    }
  });
}

async function handleTaskDelete(taskId) {
  const ok = await confirmDialog({ title: t('confirm_title'), message: t('del_task_message'), confirmText: t('dialog_delete'), danger: true });
  if (!ok) return;
  await deleteTask(taskId);
  closeTaskModal();
  refreshCurrentView();
}

async function handleScriptDelete(scriptId) {
  const ok = await confirmDialog({ title: t('confirm_title'), message: t('del_script_message'), confirmText: t('dialog_delete'), danger: true });
  if (!ok) return;
  await deleteScript(scriptId);
  refreshCurrentView();
}

async function handleScriptFormSubmit(form) {
  const fd = new FormData(form);
  const data = { title: fd.get('title'), content: fd.get('content') };
  const isEdit = form.dataset.editId;
  if (isEdit) {
    await updateScript(isEdit, data);
  } else {
    await addScript(data);
  }
  clearScriptDraft();
  navigateTo('scripts');
}

async function handleSyncConfig(form) {
  const fd = new FormData(form);
  const url = fd.get('url')?.trim();
  const key = fd.get('key')?.trim();
  const secret = fd.get('secret')?.trim();
  if (!url || !key) return;
  try { await sync.connect({ url, key, secret }); } catch (err) { console.error('Sync connect error:', err); }
  refreshCurrentView();
}

function handleSyncSave() {
  const form = document.querySelector('#sync-config-form');
  if (!form) return;
  const fd = new FormData(form);
  const url = fd.get('url')?.trim();
  const key = fd.get('key')?.trim();
  const secret = fd.get('secret')?.trim();
  if (!url || !key) return;
  const saved = sync.saveLink({ url, key, secret });
  if (saved) refreshCurrentView();
}

async function handleSyncUrlCopy(btn) {
  if (!btn || !btn.dataset) return;
  const value = document.querySelector('#sync-url-chip-value');
  const url = (value && value.textContent.trim()) || btn.dataset.url || '';
  if (!url) return;
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); copied = true; }
  } catch { copied = false; }
  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { copied = false; }
  }
  if (!copied) return;
  btn.innerHTML = icon('check');
  refreshIcons();
  setTimeout(() => { if (document.body.contains(btn)) { btn.innerHTML = icon('copy'); refreshIcons(); } }, 1400);
}

async function handleBroadcastCopyId(btn) {
  const id = getDeviceId();
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(id); copied = true; }
  } catch { copied = false; }
  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = id;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { copied = false; }
  }
  if (!copied) return;
  const orig = btn.textContent;
  btn.textContent = t('bc_copied');
  refreshIcons();
  setTimeout(() => { if (document.body.contains(btn)) { btn.textContent = orig; } }, 1400);
}

async function handleBroadcastRefresh(btn) {
  btn.disabled = true;
  await refreshBroadcasts();
  btn.disabled = false;
}

function handleIdentityForm(form) {
  const fd = new FormData(form);
  const user = fd.get('user')?.trim();
  const channel = fd.get('channel')?.trim().toLowerCase();
  if (user) localStorage.setItem('newsMeva_userName', user);
  if (channel) localStorage.setItem('newsMeva_channel', channel);
  updateUserChip();
  refreshCurrentView();
}

function updateUserChip() {
  const chip = document.querySelector('#user-chip');
  const label = document.querySelector('#user-chip-label');
  if (!chip || !label) return;
  const user = localStorage.getItem('newsMeva_userName') || '';
  const channel = localStorage.getItem('newsMeva_channel') || '';
  if (!user && !channel) { chip.classList.add('hidden'); chip.title = ''; label.textContent = ''; return; }
  chip.classList.remove('hidden');
  label.textContent = user || channel;
  const userBit = user ? `${t('cloud_user')}: ${user}` : '';
  const channelBit = channel ? `${t('cloud_channel')}: ${channel}` : '';
  chip.title = [userBit, channelBit].filter(Boolean).join('  ·  ');
}

function handleOnboardNext() {
  const step = Number(localStorage.getItem('newsMeva_onboard_step') || '0');
  if (step >= 3) {
    localStorage.setItem('newsMeva_onboarded', '1');
    closeOnboarding();
    return;
  }
  localStorage.setItem('newsMeva_onboard_step', String(step + 1));
  showOnboarding();
  refreshIcons();
}

function handleOnboardPrev() {
  const step = Number(localStorage.getItem('newsMeva_onboard_step') || '0');
  if (step <= 0) return;
  localStorage.setItem('newsMeva_onboard_step', String(step - 1));
  showOnboarding();
  refreshIcons();
}

export async function navigateTo(view, param) {
  localStorage.setItem('newsMeva_activeView', view);
  activeView = view;
  window.__currentView = view;
  renderSidebar(view);
  const titleMap = {
    dashboard: t('dashboard'),
    tasks: t('tasks'),
    'teleprompter-list': t('teleprompter'),
    scripts: t('scripts'),
    cloud: t('cloud_sync'),
    backup: t('backup'),
    settings: t('settings'),
    about: t('about'),
    recycle: t('recycle_bin'),
    'script-editor': t('scripts'),
    'guide-basic': t('guide_basic_title'),
    'guide-recommended': t('guide_rec_title')
  };
  const viewTitle = document.querySelector('#view-title');
  if (viewTitle) viewTitle.textContent = titleMap[view] || view;
  closeSidebar();

  const fab = document.querySelector('#fab');
  if (fab) { fab.style.display = ['dashboard', 'tasks'].includes(view) ? '' : 'none'; closeFabMenu(); }

  switch (view) {
    case 'dashboard': await renderDashboard(); break;
    case 'tasks': await renderTasks(); break;
    case 'teleprompter-list': await renderTeleprompterList(); break;
    case 'scripts': await renderScripts(); break;
    case 'script-editor': await renderScriptEditor(param); break;
    case 'cloud': await renderCloud(); break;
    case 'backup': await renderBackup(); break;
    case 'settings': await renderSettings(); break;
    case 'about': await renderAbout(); break;
    case 'recycle': await renderRecycleBin(); break;
    case 'guide-basic': await renderGuideBasic(); break;
    case 'guide-recommended': await renderGuideRecommended(); break;
    default: await renderDashboard();
  }
  refreshIcons();
}

async function refreshCurrentView() {
  await navigateTo(activeView);
}

// ── splash sequence ──
(async () => {
  setTimeout(async () => {
    hideSplash();
    const onboarded = localStorage.getItem('newsMeva_onboarded');
    const savedUser = localStorage.getItem('newsMeva_userName');
    const savedChannel = localStorage.getItem('newsMeva_channel');
    
    if (onboarded) {
      // User is onboarded - enter app and restore last view
      document.querySelector('#app-shell').classList.remove('hidden');
      await initApp();
      // Restore active view from localStorage or default to dashboard
      const savedView = localStorage.getItem('newsMeva_activeView');
      if (savedView && ['dashboard', 'tasks', 'teleprompter-list', 'scripts', 'cloud', 'backup', 'settings', 'about', 'recycle'].includes(savedView)) {
        window.__currentView = savedView;
        activeView = savedView;
        await navigateTo(savedView);
      } else {
        await navigateTo('dashboard');
      }
      showOnboarding();
      initBroadcasts();
      // Auto-reconnect if previously connected
      const savedSync = sync.getSyncConfig();
      if (savedSync && savedSync.url && savedSync.key) {
        sync.connect(savedSync).catch(() => {});
      }
      // Update user chip if identity exists
      if (savedUser || savedChannel) updateUserChip();
      hideSplash();
      setTimeout(() => { document.querySelector('#splash-screen').style.display = 'none'; }, 600);
    } else {
      // Not onboarded - show landing page with onboarding
      showLanding();
      refreshIcons();
      document.querySelectorAll('[data-enter-app]').forEach((btn) => btn.addEventListener('click', enterApp));
    }
  }, 1800);
})();