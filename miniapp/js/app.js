import { seedDatabase, addTask, updateTask, restoreTask, permanentDeleteTask, getTask, addScript, updateScript, deleteScript, getCategories } from './db.js';
import { renderSidebar, refreshIcons, closeOnboarding, icon } from './components.js';
import { renderDashboard, renderTasks, renderTeleprompterList, renderScripts, renderScriptEditor, renderRecycleBin, renderCloud, renderBackup, renderSettings, renderAbout, showOnboarding, updateSyncStatusUI } from './views.js';
import { setupBackup } from './backup.js';
import { initLang, setLang, t } from './i18n.js';
import { openPrompter } from './teleprompter.js';
import * as sync from './sync.js';
import { initBroadcasts } from './broadcast.js';

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

async function initApp() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    initLang();
    await seedDatabase();
    wireGlobalEvents();
    await refreshCurrentView();
    showOnboarding();
    initBroadcasts();
    listenSyncEvents();
    // hide splash after first render
    setTimeout(hideSplash, 600);
  })();
  return initPromise;
}

function wireGlobalEvents() {
  document.querySelector('#fab').addEventListener('click', () => openTaskModal());
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

  document.querySelector('#task-modal').addEventListener('submit', (e) => {
    const form = e.target;
    if (form.id === 'task-form') {
      e.preventDefault();
      e.stopPropagation();
      handleTaskFormSubmit(form);
    }
  });
  document.querySelector('#task-modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) closeTaskModal();
  });
  document.querySelector('#onboarding-overlay').addEventListener('click', (e) => {
    if (e.target.closest('[data-onboard-next]')) return handleOnboardNext();
    if (e.target.closest('[data-onboard-prev]')) return handleOnboardPrev();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openTaskModal();
    }
    if (e.key === 'Escape') {
      closeSidebar();
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
  if (e.target.id === 'task-modal') closeTaskModal();
}

function handleOnboardingBackdropClick(e) {
  if (e.target.id === 'onboarding-overlay') closeOnboarding();
}

function closeTaskModal() {
  document.querySelector('#task-modal').classList.add('hidden');
}

function handleViewContentClick(e) {
  const syncPush = e.target.closest('#sync-push-btn');
  if (syncPush) return sync.pushAll().then(() => refreshCurrentView());
  const syncPull = e.target.closest('#sync-pull-btn');
  if (syncPull) return sync.pullAll().then(() => refreshCurrentView());
  const syncDisconnect = e.target.closest('#sync-disconnect-btn');
  if (syncDisconnect) return sync.disconnect().then(() => refreshCurrentView());
  const nextBtn = e.target.closest('[data-task-next]');
  if (nextBtn) return handleTaskNext(nextBtn.dataset.taskNext);
  const viewBtn = e.target.closest('[data-task-view]');
  if (viewBtn) return handleTaskView(viewBtn.dataset.taskView);
  const onDelBtn = e.target.closest('[data-recycle-purge]');
  if (onDelBtn) return handlePermanentDelete(onDelBtn.dataset.recyclePurge);
  const onRestoreBtn = e.target.closest('[data-recycle-restore]');
  if (onRestoreBtn) return handleRestore(onRestoreBtn.dataset.recycleRestore);
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
  const form = e.currentTarget;
  if (form.id === 'task-form') return handleTaskFormSubmit(form);
  if (form.id === 'script-form') return handleScriptFormSubmit(form);
  if (form.id === 'sync-config-form') return handleSyncConfig(form);
}

function handleViewContentChange(e) {
  if (e.target.id === 'lang-select') {
    setLang(e.target.value);
    refreshCurrentView();
  }
  if (e.target.closest('.brand-swatch')) {
    const brand = e.target.closest('.brand-swatch').dataset.brand;
    if (brand) {
      document.documentElement.dataset.brand = brand;
      localStorage.setItem('newsMeva_brand', brand);
      document.querySelectorAll('.brand-swatch').forEach((s) => s.classList.toggle('active', s.dataset.brand === brand));
    }
  }
  if (e.target.closest('#theme-toggle-btn')) {
    toggleTheme();
  }
}

async function handleTaskNext(taskId) {
  const task = await getTask(taskId);
  if (!task) return;
  const { STATUS_STEPS } = await import('./seed.js');
  const steps = STATUS_STEPS[task.status];
  if (!steps || !steps.length) return;
  await updateTask(taskId, { status: steps[0] });
  refreshCurrentView();
}

async function handleTaskView(taskId) {
  openTaskModal(taskId);
}

async function openTaskModal(taskId) {
  const categories = await getCategories();
  const task = taskId ? await getTask(taskId) : null;
  const { renderTaskModal } = await import('./components.js');
  renderTaskModal(task, categories);
  refreshIcons();
}

async function handleTaskFormSubmit(form) {
  const fd = new FormData(form);
  const isEdit = form.dataset.editId;
  const data = {
    title: fd.get('title'),
    description: fd.get('description'),
    taskType: fd.get('taskType'),
    priority: fd.get('priority'),
    categoryId: fd.get('categoryId')
  };
  if (isEdit) {
    await updateTask(isEdit, data);
  } else {
    await addTask(data);
  }
  closeTaskModal();
  refreshCurrentView();
}

async function handlePermanentDelete(taskId) {
  if (!confirm('Delete forever?')) return;
  await permanentDeleteTask(taskId);
  refreshCurrentView();
}

async function handleRestore(taskId) {
  await restoreTask(taskId);
  refreshCurrentView();
}

async function handleScriptPrompt(scriptId) {
  const { getScript } = await import('./db.js');
  const script = await getScript(scriptId);
  if (!script) return;
  const wrapper = document.createElement('div');
  document.body.appendChild(wrapper);
  openPrompter(wrapper, script.content, {
    speed: Number(localStorage.getItem('tp_speed') || 3),
    fontSize: Number(localStorage.getItem('tp_fontSize') || 32),
    mirror: localStorage.getItem('tp_mirror') === '1',
    textAlign: localStorage.getItem('tp_align') || 'left',
    lineHeight: Number(localStorage.getItem('tp_spacing') || 1.6)
  });
}

async function handleScriptDelete(scriptId) {
  if (!confirm('Delete this script?')) return;
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
  navigateTo('scripts');
}

async function handleSyncConfig(form) {
  const fd = new FormData(form);
  const url = fd.get('url')?.trim();
  const key = fd.get('key')?.trim();
  if (!url || !key) return;
  try { await sync.connect({ url, key }); } catch (err) { console.error('Sync connect error:', err); }
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
    'script-editor': t('scripts')
  };
  const viewTitle = document.querySelector('#view-title');
  if (viewTitle) viewTitle.textContent = titleMap[view] || view;
  closeSidebar();

  const fab = document.querySelector('#fab');
  if (fab) fab.style.display = ['dashboard', 'tasks'].includes(view) ? '' : 'none';

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
    showLanding();
    refreshIcons();
    document.querySelectorAll('[data-enter-app]').forEach((btn) => btn.addEventListener('click', enterApp));
  }, 1800);
})();