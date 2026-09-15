let scrollTimer = null;
let rafId = 0;
let lastTime = 0;
let dwellTime = 0;
let isScrolling = false;
let manualHoldUntil = 0;
let controlsTimer = 0;
let speedFlashTimer = 0;

export function openPrompter(container, scriptContent, settings = {}) {
  const state = {
    speed: settings.speed ?? 3,
    fontSize: settings.fontSize ?? 32,
    lineHeight: settings.lineHeight ?? 1.6,
    mirror: settings.mirror ?? false,
    textAlign: settings.textAlign ?? 'left',
    scrolling: false,
    paused: true
  };

  container.innerHTML = `
    <div class="tp-container">
      <div class="tp-controls" id="tp-controls">
        <button id="tp-close" title="Close">✕ Close</button>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <button id="tp-speed-down">A-</button>
          <span id="tp-speed-label" style="font-weight:800;min-width:40px;text-align:center">${state.speed}</span>
          <button id="tp-speed-up">A+</button>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <button id="tp-font-down">A↓</button>
          <button id="tp-font-up">A↑</button>
          <button id="tp-mirror" ${state.mirror ? 'class="active"' : ''}>Mirror</button>
          <button id="tp-align-left" ${state.textAlign==='left'?'class="active"':''}>L</button>
          <button id="tp-align-center" ${state.textAlign==='center'?'class="active"':''}>C</button>
          <button id="tp-align-right" ${state.textAlign==='right'?'class="active"':''}>R</button>
        </div>
        <button id="tp-play" style="min-width:80px">▶ Play</button>
      </div>
      <div class="tp-scroll-area" id="tp-scroll-area"></div>
      <div class="tp-speed-flash hidden" id="tp-speed-flash"></div>
    </div>
  `;

  const scrollArea = document.querySelector('#tp-scroll-area');
  scrollArea.textContent = scriptContent || 'No script content.';
  scrollArea.style.fontSize = state.fontSize + 'px';
  scrollArea.style.lineHeight = state.lineHeight;
  scrollArea.style.textAlign = state.textAlign;
  if (state.mirror) scrollArea.classList.add('mirror');

  function flashSpeed(value) {
    const flash = document.querySelector('#tp-speed-flash');
    flash.textContent = value;
    flash.classList.remove('hidden');
    clearTimeout(speedFlashTimer);
    speedFlashTimer = setTimeout(() => flash.classList.add('hidden'), 1000);
  }

  function tick() {
    if (!isScrolling || state.paused) { rafId = requestAnimationFrame(tick); return; }
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    if (now < manualHoldUntil) { rafId = requestAnimationFrame(tick); return; }
    dwellTime += delta;
    if (dwellTime < 0.3) { rafId = requestAnimationFrame(tick); return; }
    const pxPerSec = state.speed * 25;
    scrollArea.scrollTop += pxPerSec * (delta || 0.016);
    if (scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 10) {
      isScrolling = false;
      updatePlayButton();
    }
    rafId = requestAnimationFrame(tick);
  }

  function updatePlayButton() {
    const btn = document.querySelector('#tp-play');
    if (btn) btn.textContent = isScrolling && !state.paused ? '⏸ Pause' : '▶ Play';
  }

  function startScroll() {
    if (!isScrolling) {
      isScrolling = true;
      state.paused = false;
      lastTime = performance.now();
      dwellTime = 0;
      rafId = requestAnimationFrame(tick);
    } else {
      state.paused = !state.paused;
    }
    updatePlayButton();
  }

  document.querySelector('#tp-play').addEventListener('click', startScroll);

  document.querySelector('#tp-close').addEventListener('click', () => {
    cancelAnimationFrame(rafId);
    isScrolling = false;
    container.innerHTML = '';
    if (typeof container.onClose === 'function') container.onClose();
  });

  document.querySelector('#tp-speed-up').addEventListener('click', () => {
    state.speed = Math.min(10, state.speed + 1);
    document.querySelector('#tp-speed-label').textContent = state.speed;
    flashSpeed(state.speed);
  });

  document.querySelector('#tp-speed-down').addEventListener('click', () => {
    state.speed = Math.max(-10, state.speed - 1);
    document.querySelector('#tp-speed-label').textContent = state.speed;
    flashSpeed(state.speed);
  });

  document.querySelector('#tp-font-up').addEventListener('click', () => {
    state.fontSize = Math.min(72, state.fontSize + 4);
    scrollArea.style.fontSize = state.fontSize + 'px';
  });

  document.querySelector('#tp-font-down').addEventListener('click', () => {
    state.fontSize = Math.max(16, state.fontSize - 4);
    scrollArea.style.fontSize = state.fontSize + 'px';
  });

  document.querySelector('#tp-mirror').addEventListener('click', (e) => {
    state.mirror = !state.mirror;
    scrollArea.classList.toggle('mirror', state.mirror);
    e.currentTarget.classList.toggle('active', state.mirror);
  });

  ['left', 'center', 'right'].forEach((align) => {
    document.querySelector(`#tp-align-${align}`).addEventListener('click', (e) => {
      state.textAlign = align;
      scrollArea.style.textAlign = align;
      ['left', 'center', 'right'].forEach((a) => {
        document.querySelector(`#tp-align-${a}`).classList.toggle('active', a === align);
      });
    });
  });

  scrollArea.addEventListener('touchstart', () => { manualHoldUntil = performance.now() + 2000; }, { passive: true });
  scrollArea.addEventListener('mousedown', () => { manualHoldUntil = performance.now() + 2000; });

  rafId = requestAnimationFrame(tick);
}
