import { exportData, importData } from './db.js';
import { t } from './i18n.js';

export function setupBackup() {
  const exportBtn = document.querySelector('#backup-export-btn');
  const importBtn = document.querySelector('#backup-import-btn');
  const fileInput = document.querySelector('#import-file');

  if (exportBtn) exportBtn.addEventListener('click', doExport);
  if (importBtn) importBtn.addEventListener('click', () => fileInput?.click());
  if (fileInput && !fileInput.dataset.backupWired) {
    fileInput.dataset.backupWired = '1';
    fileInput.addEventListener('change', handleImport);
  }
}

async function doExport() {
  try {
    const data = await exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsmeva-mini-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export failed:', err);
  }
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!confirm(t('backup_import_confirm'))) { event.target.value = ''; return; }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await importData(data);
    window.navigateTo(window.__currentView || 'dashboard');
  } catch (err) {
    console.error('Import failed:', err);
    alert('Import failed: ' + err.message);
  }
  event.target.value = '';
}
