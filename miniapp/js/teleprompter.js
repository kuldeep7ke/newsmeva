let activeCleanup = null;

function refreshTpIcons(root) {
  if (window.lucide) window.lucide.createIcons();
}

function tpIcon(name) { return `<i data-lucide="${name}"></i>`; }

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function localDayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const GUIDE_HTML = `
  <section>
    <h4>1. Getting Started</h4>
    <p>Open <b>Teleprompter</b> from the main menu and pick a script to prompt. Use <b>New Script</b> to paste your own text and prompt it right away — scripts are saved on this device.</p>
  </section>
  <section>
    <h4>2. Start Prompting</h4>
    <p>Press the green <b>Start</b> button (or <b>Spacebar</b>). The screen goes <b>fullscreen</b>, the options bar slides away, and the script auto-scrolls at your saved speed. Press <b>Spacebar</b>, the floating <b>Pause</b> pill, or <b>Escape</b> to pause — the options bar comes back. All speed controls (wheel, arrows, W/S) work <b>even while paused</b> — adjusting speed while paused resumes scrolling immediately, no fullscreen needed. The <b>close button</b> (top-left) is always visible whenever the script is not actively prompting.</p>
  </section>
  <section>
    <h4>3. Adjusting the Display</h4>
    <p>The bottom bar has <b>Speed</b> (scroll pace — drag it below zero to reverse upward), <b>Font</b> (text size), and <b>Spacing</b> (line spacing) sliders, <b>Alignment</b> (left / center / right) options, plus a <b>Mirror</b> toggle for a mirror-image display (prompter glass). All settings are <b>saved automatically</b> on this device and restored for your next prompting session.</p>
  </section>
  <section>
    <h4>4. Keyboard Shortcuts</h4>
    <div class="tp-guide-keys">
      <div><b>Space</b> — play / pause</div>
      <div><b>↑ / W / wheel up</b> — speed up forward</div>
      <div><b>↓ / S / wheel down</b> — slow down, then reverse upward (values go negative)</div>
      <div><b>Reaching the bottom</b> — parks at <b>-3.0 ◀</b>, ready to reverse instantly</div>
      <div><b>Reaching the top</b> — parks at <b>3.0 ▶</b>, ready to run forward again</div>
      <div><b>Middle click</b> — reset speed to default</div>
      <div><b>Shift + wheel</b> — move script up / down freely</div>
      <div><b>PageUp / PageDown</b> — jump back / forward</div>
      <div><b>← / →</b> — font smaller / larger</div>
      <div><b>R</b> — reset scroll to top</div>
      <div><b>M</b> — mirror display toggle</div>
      <div><b>Escape</b> — pause / close popups</div>
    </div>
  </section>
  <section>
    <h4>5. When the Script Ends</h4>
    <p>Reaching the bottom <b>parks the script at -3.0 ◀</b> — one wheel roll down or Space instantly reverses back upward at full reverse speed. If you do nothing, after a short reading delay a popup appears:</p>
    <ul>
      <li><b>Finished</b> — ends the session. For a task prompt it also marks the task done.</li>
      <li><b>Restart</b> — returns to the top (speed resets to 3.0 ▶) and resumes prompting.</li>
      <li><b>Close</b> — dismiss the popup without marking anything.</li>
    </ul>
    <p>Reversing away from the bottom before the popup appears cancels it. Reaching the <b>top</b> in reverse parks at <b>3.0 ▶</b>, ready to run forward again.</p>
  </section>
  <section>
    <h4>6. Scripts Drawer</h4>
    <p>Press <b>Scripts</b> to open the list of scripts saved on this device — the <b>Today</b> tab shows scripts updated today, the <b>Archived</b> tab has older ones. Click one to load it into the prompter.</p>
  </section>
  <section>
    <h4>7. Saving Settings</h4>
    <p>Speed, font size, spacing, alignment and mirror are saved on the device automatically. No action needed — your last-used display is restored whenever you open the teleprompter.</p>
  </section>
`;

const clampSpeed = (v) => Math.max(-10, Math.min(10, Math.round(Number(v) * 10) / 10));
const clampFont = (v) => Math.max(18, Math.min(96, Number(v)));
const clampSpacing = (v) => Math.max(1.2, Math.min(2.5, Math.round(Number(v) * 10) / 10));

export function openPrompter(container, scriptContent, settings = {}, meta = {}) {
  if (activeCleanup) activeCleanup();

  const state = {
    speed: clampSpeed(settings.speed ?? 3),
    fontSize: clampFont(settings.fontSize ?? 32),
    lineHeight: clampSpacing(settings.lineHeight ?? 1.6),
    mirror: settings.mirror ?? false,
    textAlign: settings.textAlign ?? 'left'
  };
  let title = meta.title || '';
  let subtitle = meta.subtitle || '';
  let body = scriptContent || '';
  let currentScriptId = meta.scriptId ?? null;
  const onFinish = typeof meta.onFinish === 'function' ? meta.onFinish : null;
  const doneMessage = meta.doneMessage || 'Finished';

  container.innerHTML = `
    <div class="tp-root">
      <button class="tp-close" data-tp="close" title="Close teleprompter">${tpIcon('x')}</button>
      <div class="tp-scroll tp-no-scrollbar" data-tp="scroll">
        <div class="tp-body" data-tp="body">
          ${title ? `<h1 class="tp-title" data-tp="title"></h1>` : ''}
          ${subtitle ? `<p class="tp-meta" data-tp="subtitle"></p>` : ''}
          <div class="tp-text" data-tp="text"></div>
        </div>
      </div>
      <div class="tp-done-banner" data-tp="done" hidden></div>
      <div class="tp-flash" data-tp="flash" hidden></div>
      <div class="tp-overlay" data-tp="end" data-tp-overlay hidden>
        <div class="tp-card">
          ${tpIcon('check-circle-2')}
          <h3>Script Ended</h3>
          <p>You have reached the end of the script.</p>
          <div class="tp-card-actions">
            <button class="tp-btn tp-btn-finish" data-tp="finish">${tpIcon('flag')} <span data-tp="finish-label">Finished</span></button>
            <button class="tp-btn tp-btn-restart" data-tp="restart">${tpIcon('rotate-ccw')} Restart</button>
            <button class="tp-btn tp-btn-quiet" data-tp="end-close">Close</button>
          </div>
        </div>
      </div>
      <div class="tp-overlay" data-tp="guide" data-tp-overlay hidden>
        <div class="tp-guide">
          <div class="tp-guide-head">
            <div class="tp-guide-title">${tpIcon('book-open')} Teleprompter Operating Guide</div>
            <button class="tp-guide-close" data-tp="guide-close">${tpIcon('x')}</button>
          </div>
          <div class="tp-guide-body">${GUIDE_HTML}</div>
        </div>
      </div>
      <div class="tp-drawer-scrim" data-tp="drawer-scrim" hidden></div>
      <div class="tp-drawer" data-tp="drawer" data-tp-overlay hidden>
        <div class="tp-drawer-head">
          <div class="tp-drawer-title">${tpIcon('history')} Scripts</div>
          <button class="tp-guide-close" data-tp="drawer-close">${tpIcon('x')}</button>
        </div>
        <div class="tp-tabs">
          <button class="tp-tab active" data-tp="tab-today">Today</button>
          <button class="tp-tab" data-tp="tab-archive">Archived</button>
        </div>
        <div class="tp-drawer-list" data-tp="drawer-list"></div>
      </div>
      <div class="tp-controls" data-tp="controls">
        <div class="tp-hint">Space play/pause · ↑/W faster ▶ · ↓/S slower ◀ reverse · wheel same · Shift+wheel move · PgUp·PgDn jump · middle-click reset · ends park ◀-3 / ▶3 · ←→ font · R top · M mirror</div>
        <button class="tp-start" data-tp="start"></button>
        <button class="tp-tool" data-tp="reset" title="Reset scroll to top">${tpIcon('rotate-ccw')} Reset</button>
        <button class="tp-tool" data-tp="mirror" title="Mirror display (M)">${tpIcon('flip-horizontal-2')} Mirror</button>
        <div class="tp-align-group">
          <button class="tp-align" data-tp="align-left" title="Align left">${tpIcon('align-left')}</button>
          <button class="tp-align" data-tp="align-center" title="Align center">${tpIcon('align-center')}</button>
          <button class="tp-align" data-tp="align-right" title="Align right">${tpIcon('align-right')}</button>
        </div>
        <div class="tp-slider"><span>Speed:</span><input type="range" min="-10" max="10" step="0.5" data-tp="speed-range" /><span class="tp-slider-val" data-tp="speed-val"></span></div>
        <div class="tp-slider"><span>Font:</span><input type="range" min="18" max="96" step="2" data-tp="font-range" /><span class="tp-slider-val" data-tp="font-val"></span></div>
        <div class="tp-slider"><span>Spacing:</span><input type="range" min="1.2" max="2.5" step="0.1" data-tp="spacing-range" /><span class="tp-slider-val" data-tp="spacing-val"></span></div>
        <div class="tp-bar-spacer">
          <button class="tp-tool" data-tp="drawer-open">${tpIcon('history')} Scripts</button>
          <button class="tp-tool" data-tp="guide-open">${tpIcon('book-open')} Guide</button>
        </div>
      </div>
      <div class="tp-mini" data-tp="mini" hidden>
        <button class="tp-pill" data-tp="mini-toggle"></button>
        <button class="tp-options-pill" data-tp="mini-options">${tpIcon('settings-2')} Options</button>
      </div>
    </div>
  `;

  const q = (sel) => container.querySelector(`[data-tp="${sel}"]`);
  const scrollEl = q('scroll');
  const bodyEl = q('body');
  const controlsEl = q('controls');
  const miniEl = q('mini');

  let scrolling = false;
  let vel = 0;
  let pos = 0;
  let lastT = 0;
  let raf = 0;
  let dwellTimer = 0;
  let hideTimer = 0;
  let flashTimer = 0;
  let wheelAccum = 0;
  let manualHoldUntil = 0;
  let ended = false;
  let finished = false;
  let destroyed = false;
  let drawerTab = 'today';

  function persist() {
    localStorage.setItem('tp_speed', String(state.speed));
    localStorage.setItem('tp_fontSize', String(state.fontSize));
    localStorage.setItem('tp_spacing', String(state.lineHeight));
    localStorage.setItem('tp_mirror', state.mirror ? '1' : '0');
    localStorage.setItem('tp_align', state.textAlign);
  }

  function renderText() {
    const titleEl = q('title');
    const subEl = q('subtitle');
    if (titleEl) {
      titleEl.textContent = title;
      titleEl.style.fontSize = `${state.fontSize * 1.2}px`;
      titleEl.style.display = title ? '' : 'none';
    }
    if (subEl) {
      subEl.textContent = subtitle;
      subEl.style.fontSize = `${state.fontSize * 0.6}px`;
      subEl.style.display = subtitle ? '' : 'none';
    }
    q('text').textContent = body || 'No script content.';
    bodyEl.style.fontSize = `${state.fontSize}px`;
    bodyEl.style.lineHeight = state.lineHeight;
    bodyEl.style.textAlign = state.textAlign;
    scrollEl.classList.toggle('tp-mirror', state.mirror);
  }

  function speedLabel(v) {
    return `${v.toFixed(1)}${v < 0 ? ' ◀' : v > 0 ? ' ▶' : ''}`;
  }

  function flashSpeed(v) {
    const flash = q('flash');
    flash.textContent = `Speed ${speedLabel(v)}`;
    flash.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => { flash.hidden = true; }, 1000);
  }

  function paintControls() {
    const startBtn = q('start');
    startBtn.classList.toggle('pausing', scrolling);
    startBtn.innerHTML = `${tpIcon(scrolling ? 'pause' : 'play')} ${scrolling ? 'Pause' : 'Start'}`;
    const miniToggle = q('mini-toggle');
    miniToggle.classList.toggle('pausing', scrolling);
    miniToggle.innerHTML = `${tpIcon(scrolling ? 'pause' : 'play')} ${scrolling ? 'Pause' : 'Start'}`;
    q('mirror').classList.toggle('on', state.mirror);
    ['left', 'center', 'right'].forEach((a) => q(`align-${a}`).classList.toggle('on', state.textAlign === a));
    q('speed-range').value = String(state.speed);
    q('speed-val').textContent = speedLabel(state.speed);
    q('font-range').value = String(state.fontSize);
    q('font-val').textContent = `${state.fontSize}px`;
    q('spacing-range').value = String(state.lineHeight);
    q('spacing-val').textContent = state.lineHeight.toFixed(1);
    q('close').hidden = scrolling;
    q('guide-open').hidden = scrolling;
    refreshTpIcons(container);
  }

  function showControls() {
    controlsEl.classList.remove('tp-hidden-bar');
    miniEl.hidden = true;
    clearTimeout(hideTimer);
  }

  function scheduleHide(ms) {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      controlsEl.classList.add('tp-hidden-bar');
      miniEl.hidden = false;
    }, ms);
  }

  function enterFullscreen() {
    try {
      const el = document.documentElement;
      if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } catch { /* fullscreen unsupported */ }
  }

  function exitFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    } catch { /* noop */ }
  }

  function atBottom() {
    return scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 10;
  }

  function animate(timestamp) {
    if (destroyed) return;
    if (!lastT) lastT = timestamp;
    const delta = timestamp - lastT;
    lastT = timestamp;
    let halted = false;
    const target = state.speed;
    const k = 1 - Math.exp(-delta / 150);
    vel = vel + (target - vel) * k;
    if (Math.abs(vel) < 0.01 && target === 0) vel = 0;
    if (Date.now() >= manualHoldUntil) {
      const nextPos = pos + (vel * delta) / 75;
      scrollEl.scrollTop = nextPos;
      const clamped = Math.abs(scrollEl.scrollTop - nextPos) > 1
        || scrollEl.scrollTop <= 0
        || scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 10;
      pos = clamped ? scrollEl.scrollTop : nextPos;
      if (scrollEl.scrollTop <= 0 && vel < 0) {
        vel = 0;
        setSpeed(3);
        stopScroll();
        cancelAnimationFrame(raf);
        return;
      }
    }
    if (atBottom() && vel > 0 && !ended && !finished) {
      if (!dwellTimer) {
        if (state.speed !== -3) setSpeed(-3);
        vel = 0;
        halted = true;
        stopScroll();
        const dwellMs = 2000 + (state.fontSize - 18) * 20;
        dwellTimer = window.setTimeout(async () => {
          dwellTimer = 0;
          if (!destroyed && atBottom() && !ended && !finished) {
            ended = true;
            q('end').hidden = false;
            if (currentScriptId) {
              try {
                const { updateScript, localDateTimeStr } = await import('./db.js');
                await updateScript(currentScriptId, { finishedAt: localDateTimeStr() });
              } catch (_) {}
            }
          }
        }, dwellMs);
      }
    } else if (!atBottom() && dwellTimer) {
      clearTimeout(dwellTimer);
      dwellTimer = 0;
    }
    if (!halted) raf = requestAnimationFrame(animate);
  }

  function beginScroll(enterFs) {
    if (scrolling || finished || destroyed) return;
    q('guide').hidden = true;
    if (state.speed === 0) setSpeed(3);
    lastT = 0;
    pos = scrollEl.scrollTop;
    scrolling = true;
    paintControls();
    raf = requestAnimationFrame(animate);
    if (enterFs) enterFullscreen();
    scheduleHide(1500);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function stopScroll() {
    scrolling = false;
    cancelAnimationFrame(raf);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    paintControls();
  }

  function setSpeed(v) {
    const next = clampSpeed(v);
    if (next !== state.speed) flashSpeed(next);
    state.speed = next;
    persist();
    paintControls();
  }

  function setFontSize(v) {
    state.fontSize = clampFont(v);
    persist();
    renderText();
    paintControls();
  }

  function setSpacing(v) {
    state.lineHeight = clampSpacing(v);
    persist();
    renderText();
    paintControls();
  }

  function adjustSpeed(delta) {
    if (ended || finished || destroyed) return;
    setSpeed(state.speed + delta);
    if (!scrolling) {
      vel = 0;
      beginScroll(false);
    }
  }

  function nudgeScroll(px) {
    const max = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    scrollEl.scrollTop = Math.min(max, Math.max(0, scrollEl.scrollTop + px));
    pos = scrollEl.scrollTop;
    manualHoldUntil = Date.now() + 1500;
  }

  function resetScroll() {
    stopScroll();
    hideEnd();
    vel = 0;
    pos = 0;
    setSpeed(3);
    scrollEl.scrollTop = 0;
  }

  function hideEnd() {
    ended = false;
    q('end').hidden = true;
  }

  function handleRestart() {
    hideEnd();
    finished = false;
    scrollEl.scrollTop = 0;
    vel = 0;
    pos = 0;
    setSpeed(3);
    lastT = 0;
    scrolling = true;
    paintControls();
    raf = requestAnimationFrame(animate);
    enterFullscreen();
    scheduleHide(1500);
  }

  async function handleFinish() {
    if (finished || destroyed) return;
    finished = true;
    stopScroll();
    hideEnd();
    const finishBtn = q('finish');
    finishBtn.disabled = true;
    try {
      if (onFinish) await onFinish();
      if (currentScriptId) {
        const { updateScript, localDateTimeStr } = await import('./db.js');
        await updateScript(currentScriptId, { finishedAt: localDateTimeStr() });
      }
    } catch (err) {
      console.error('Teleprompter finish error:', err);
      finished = false;
      finishBtn.disabled = false;
      return;
    }
    const done = q('done');
    done.innerHTML = `${tpIcon('check-circle-2')} ${esc(doneMessage)}`;
    done.hidden = false;
    refreshTpIcons(container);
    window.setTimeout(() => { if (!destroyed) destroy(); }, 1400);
  }

  async function loadDrawer() {
    const list = q('drawer-list');
    list.innerHTML = '<p class="tp-drawer-empty">Loading…</p>';
    let scripts = [];
    try {
      const { getScripts } = await import('./db.js');
      scripts = await getScripts();
    } catch {
      scripts = [];
    }
    const today = localDayStr();
    const mine = scripts.filter((s) => (drawerTab === 'today'
      ? (s.updatedAt || '').slice(0, 10) === today
      : (s.updatedAt || '').slice(0, 10) !== today));
    q('tab-today').classList.toggle('active', drawerTab === 'today');
    q('tab-archive').classList.toggle('active', drawerTab === 'archive');
    list.innerHTML = mine.length ? mine.map((s) => `
      <button class="tp-drawer-item${s.id === currentScriptId ? ' current' : ''}" data-tp-script="${s.id}">
        <div class="tp-drawer-item-title">${esc(s.title)}</div>
        <div class="tp-drawer-item-meta">${s.wordCount || 0} words · ${(s.updatedAt || '').slice(0, 10)}</div>
      </button>
    `).join('') : `<p class="tp-drawer-empty">${drawerTab === 'today' ? 'No scripts updated today yet' : 'No archived scripts'}</p>`;
    list.querySelectorAll('[data-tp-script]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.tpScript);
        try {
          const { getScript } = await import('./db.js');
          const s = await getScript(id);
          if (!s) return;
          title = s.title || '';
          subtitle = '';
          body = s.content || '';
          currentScriptId = s.id;
          resetScroll();
          renderText();
          closeDrawer();
        } catch (err) {
          console.error('Failed to load script:', err);
        }
      });
    });
  }

  function openDrawer() {
    q('drawer').hidden = false;
    q('drawer-scrim').hidden = false;
    loadDrawer();
  }

  function closeDrawer() {
    q('drawer').hidden = true;
    q('drawer-scrim').hidden = true;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(raf);
    [dwellTimer, hideTimer, flashTimer].forEach((tm) => clearTimeout(tm));
    window.removeEventListener('keydown', onKey);
    container.removeEventListener('wheel', onWheel);
    window.removeEventListener('mousedown', onMouseDown);
    exitFullscreen();
    if (document.body) document.body.style.overflow = '';
    container.innerHTML = '';
    if (container.parentNode) container.parentNode.removeChild(container);
    if (activeCleanup === cleanup) activeCleanup = null;
    if (typeof container.onClose === 'function') container.onClose();
    if (typeof meta.onClose === 'function') meta.onClose();
  }

  function cleanup() { destroy(); }

  function onKey(e) {
    if (destroyed) return;
    if (e.key === 'Escape') {
      if (!q('guide').hidden) { q('guide').hidden = true; return; }
      if (!q('drawer').hidden) { closeDrawer(); return; }
      if (ended) { hideEnd(); return; }
      showControls();
      return;
    }
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || t.tagName === 'BUTTON')) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (ended || finished) break;
        if (scrolling) stopScroll();
        else {
          if (state.speed <= 0) setSpeed(3);
          beginScroll(true);
        }
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        adjustSpeed(-0.5);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        adjustSpeed(0.5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setFontSize(Math.min(64, state.fontSize + 2));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setFontSize(Math.max(18, state.fontSize - 2));
        break;
      case 'PageUp':
        e.preventDefault();
        nudgeScroll(-Math.round(scrollEl.clientHeight * 0.8));
        break;
      case 'PageDown':
        e.preventDefault();
        nudgeScroll(Math.round(scrollEl.clientHeight * 0.8));
        break;
      case 'r':
      case 'R':
        resetScroll();
        break;
      case 'm':
      case 'M':
        state.mirror = !state.mirror;
        persist();
        renderText();
        paintControls();
        break;
      default:
        break;
    }
  }

  function onWheel(e) {
    if (destroyed) return;
    if (e.target && e.target.closest && e.target.closest('[data-tp-overlay]')) return;
    e.preventDefault();
    if (e.shiftKey) {
      nudgeScroll(e.deltaY < 0 ? -90 : 90);
      return;
    }
    wheelAccum += e.deltaY;
    const STEP = 100;
    while (Math.abs(wheelAccum) >= STEP) {
      adjustSpeed(wheelAccum > 0 ? -0.5 : 0.5);
      wheelAccum -= Math.sign(wheelAccum) * STEP;
    }
  }

  function onMouseDown(e) {
    if (destroyed || e.button !== 1) return;
    if (e.target && e.target.closest && e.target.closest('[data-tp-overlay]')) return;
    e.preventDefault();
    setSpeed(3);
  }

  q('close').addEventListener('click', destroy);
  q('start').addEventListener('click', () => {
    if (ended || finished) return;
    if (scrolling) stopScroll();
    else {
      if (state.speed <= 0) setSpeed(3);
      beginScroll(true);
    }
  });
  q('mini-toggle').addEventListener('click', () => {
    if (ended || finished) return;
    if (scrolling) stopScroll();
    else {
      if (state.speed <= 0) setSpeed(3);
      beginScroll(true);
    }
  });
  q('mini-options').addEventListener('click', showControls);
  q('reset').addEventListener('click', resetScroll);
  q('mirror').addEventListener('click', () => {
    state.mirror = !state.mirror;
    persist();
    renderText();
    paintControls();
  });
  ['left', 'center', 'right'].forEach((a) => {
    q(`align-${a}`).addEventListener('click', () => {
      state.textAlign = a;
      persist();
      renderText();
      paintControls();
    });
  });
  q('speed-range').addEventListener('input', (e) => setSpeed(Number(e.target.value)));
  q('font-range').addEventListener('input', (e) => setFontSize(Number(e.target.value)));
  q('spacing-range').addEventListener('input', (e) => setSpacing(Number(e.target.value)));
  q('finish').addEventListener('click', handleFinish);
  q('restart').addEventListener('click', handleRestart);
  q('end-close').addEventListener('click', hideEnd);
  q('end').addEventListener('click', (e) => { if (e.target === q('end')) hideEnd(); });
  q('guide-open').addEventListener('click', () => { if (!scrolling) q('guide').hidden = false; });
  q('guide-close').addEventListener('click', () => { q('guide').hidden = true; });
  q('guide').addEventListener('click', (e) => { if (e.target === q('guide')) q('guide').hidden = true; });
  q('drawer-open').addEventListener('click', openDrawer);
  q('drawer-close').addEventListener('click', closeDrawer);
  q('drawer-scrim').addEventListener('click', closeDrawer);
  q('tab-today').addEventListener('click', () => { drawerTab = 'today'; loadDrawer(); });
  q('tab-archive').addEventListener('click', () => { drawerTab = 'archive'; loadDrawer(); });
  scrollEl.addEventListener('touchstart', () => { manualHoldUntil = Date.now() + 1500; }, { passive: true });

  window.addEventListener('keydown', onKey);
  container.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('mousedown', onMouseDown);

  if (document.body) document.body.style.overflow = 'hidden';
  renderText();
  paintControls();
  refreshTpIcons(container);
  scheduleHide(3000);

  activeCleanup = cleanup;
}
