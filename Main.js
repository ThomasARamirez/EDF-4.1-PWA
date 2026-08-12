// Main.js — index page (main menu) logic
// - Fills each class button's progress tag from real saved data
// - Marks a class button complete at 100%
// - FX / SND preference toggles (persisted)
// - Radar blips + UI blip sound for the HUD background
// - Exports / imports all progress (localStorage)

// ------- Constants -------
const STORAGE_MAP = Object.freeze([
  { key: 'rangerSave',    href: 'Ranger.html'    },
  { key: 'wingdiverSave', href: 'Wingdiver.html' },
  { key: 'airraiderSave', href: 'AirRaider.html' },
  { key: 'fencerSave',    href: 'Fencer.html'    },
]);

const PREF_FX  = 'edfFxOn';
const PREF_SND = 'edfSndOn';

// ------- Helpers -------
const $ = (sel, root = document) => root.querySelector(sel);
const getInt = (k, d = 0) => parseInt(localStorage.getItem(k) ?? String(d), 10);
const safeParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

// A stored preference always wins; with none saved, reduced-motion users start
// with both the animation and the sound off.
function readPref(key) {
  const raw = localStorage.getItem(key);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return !prefersReducedMotion;
}
const writePref = (key, on) => localStorage.setItem(key, on ? '1' : '0');

// ------- Progress UI (tags + complete state) -------
function refreshProgress() {
  STORAGE_MAP.forEach(({ key, href }) => {
    const total = getInt(`${key}_total`, 0);
    const count = getInt(`${key}_count`, 0);
    const link  = $(`.menu a[href="${href}"]`);
    if (!link) return;

    const tag = $('[data-progress]', link);
    // Totals are only known once a class page has been visited at least once,
    // so fall back to a neutral tag rather than printing "000/0".
    if (tag) tag.textContent = total > 0 ? String(count).padStart(3, '0') + '/' + total : '—';

    link.classList.toggle('complete', total > 0 && count >= total);
  });
}

// Small rAF debounce so multiple triggers coalesce into one paint.
let rafId = null;
function scheduleRefresh() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => { rafId = null; refreshProgress(); });
}

// ------- Export / Import (global) -------
function buildExportPayload() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), data: {} };
  STORAGE_MAP.forEach(({ key }) => {
    payload.data[key]             = safeParse(localStorage.getItem(key)) || {};
    payload.data[`${key}_count`]  = localStorage.getItem(`${key}_count`) ?? '0';
    payload.data[`${key}_total`]  = localStorage.getItem(`${key}_total`) ?? '0';
  });
  return payload;
}

async function exportAllProgress() {
  const payload = JSON.stringify(buildExportPayload(), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const fileName = 'edf-progress.json';
  const file = new File([blob], fileName, { type: 'application/json' });

  // Mobile-first: Web Share with file
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'EDF 4.1 Progress Backup',
        text: 'Your EDF 4.1 progress backup file.',
      });
      return;
    } catch { /* user canceled or share not available — fall through */ }
  }

  // Desktop Chromium: File System Access API
  if (window.showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch { /* user canceled — fall through */ }
  }

  // Classic download
  let url = '';
  try {
    url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    requestAnimationFrame(() => { try { URL.revokeObjectURL(url); } catch {} });
    return;
  } catch { /* fall through */ }

  // Last resort: open JSON in new tab to save manually
  try {
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(payload);
    window.open(dataUrl, '_blank', 'noopener');
  } catch {
    alert('Could not trigger a download. As a last resort, copy the JSON printed to the console.');
    try { console.log(payload); } catch {}
  }
}

function importAllProgressFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || obj.version !== 1 || typeof obj.data !== 'object') {
        throw new Error('Invalid backup file format.');
      }
      STORAGE_MAP.forEach(({ key }) => {
        if (obj.data[key] != null)            localStorage.setItem(key, JSON.stringify(obj.data[key]));
        if (obj.data[`${key}_count`] != null) localStorage.setItem(`${key}_count`, String(obj.data[`${key}_count`]));
        if (obj.data[`${key}_total`] != null) localStorage.setItem(`${key}_total`, String(obj.data[`${key}_total`]));
      });
      refreshProgress();
      alert('Progress imported! If a class page is open, refresh it to see changes.');
    } catch (e) {
      alert('Import failed: ' + (e?.message || e));
    }
  };
  reader.readAsText(file);
}

// ------- UI sound -------
// One shared, lazily-resumed AudioContext. Creating a fresh context per tap is
// what broke playback on iOS, so this is deliberately a singleton that is only
// resumed from inside a user gesture.
let audioCtx = null;
let soundOn = true;

function getAudioCtx() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function blip() {
  if (!soundOn) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(660, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.16);
}

// ------- Radar blips -------
let effectsOn = true;
let blipTimer = null;
const SWEEP_DURATION_MS = 6000;
const sweepStart = performance.now();

function spawnRadarBlip() {
  const radar = document.getElementById('radar');
  if (!radar) return;
  // Bias each blip to land near the sweep line, so dots appear to be revealed
  // by it rather than at random.
  const sweepAngle = ((performance.now() - sweepStart) % SWEEP_DURATION_MS) / SWEEP_DURATION_MS * 360;
  const angleRad = (sweepAngle + (Math.random() * 20 - 10)) * Math.PI / 180;
  const radius = 70 + Math.random() * 350;
  const dot = document.createElement('div');
  dot.className = 'blip';
  dot.style.left = (450 + radius * Math.cos(angleRad)) + 'px';
  dot.style.top  = (450 + radius * Math.sin(angleRad)) + 'px';
  radar.appendChild(dot);
  setTimeout(() => dot.remove(), 1500);
}

// Only run the timer when it can actually do something — the demo left a 400ms
// interval ticking forever even with effects off or the tab hidden.
function syncBlipTimer() {
  const shouldRun = effectsOn && !document.hidden && !!document.getElementById('radar');
  if (shouldRun && blipTimer === null) {
    blipTimer = setInterval(() => { if (Math.random() < 0.045) spawnRadarBlip(); }, 400);
  } else if (!shouldRun && blipTimer !== null) {
    clearInterval(blipTimer);
    blipTimer = null;
  }
}

// ------- FX / SND toggles -------
function initToggles() {
  const fxBtn  = $('#fx-toggle');
  const sndBtn = $('#snd-toggle');

  effectsOn = readPref(PREF_FX);
  soundOn   = readPref(PREF_SND);

  document.body.classList.toggle('fx-off', !effectsOn);
  if (fxBtn)  fxBtn.setAttribute('aria-pressed', String(effectsOn));
  if (sndBtn) sndBtn.setAttribute('aria-pressed', String(soundOn));

  fxBtn?.addEventListener('click', () => {
    effectsOn = !effectsOn;
    writePref(PREF_FX, effectsOn);
    fxBtn.setAttribute('aria-pressed', String(effectsOn));
    document.body.classList.toggle('fx-off', !effectsOn);
    syncBlipTimer();
    blip();
  });

  sndBtn?.addEventListener('click', () => {
    soundOn = !soundOn;
    writePref(PREF_SND, soundOn);
    sndBtn.setAttribute('aria-pressed', String(soundOn));
    blip(); // audible only when switching on, which is the useful confirmation
  });

  syncBlipTimer();
}

// ------- Init -------
document.addEventListener('DOMContentLoaded', () => {
  refreshProgress();
  initToggles();

  document.querySelectorAll('.menu .btn').forEach(el => el.addEventListener('click', blip));

  const exportBtn = $('#export-btn');
  const importBtn = $('#import-btn');
  const fileInput = $('#import-file');

  if (exportBtn) exportBtn.addEventListener('click', exportAllProgress);

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importAllProgressFromFile(file);
      e.target.value = ''; // allow re-selecting the same file later
    });
  }
});

// ------- Cross-tab & visibility updates -------
window.addEventListener('focus', scheduleRefresh);
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('bg-paused', document.hidden);
  syncBlipTimer();
  if (document.visibilityState === 'visible') scheduleRefresh();
});
window.addEventListener('storage', (e) => {
  if (!e.key) return;
  if (/_count$/.test(e.key) || /_total$/.test(e.key)) scheduleRefresh();
});

// Note: each page registers the service worker itself — Main.js only runs on
// index.html. Re-registering the same script/scope is idempotent, so this is safe.
