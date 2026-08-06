/**
 * edf-page.js
 * -----------------------------------------------------------------------------
 * Shared page builder for each EDF class page (Ranger / Wingdiver / AirRaider / Fencer).
 *
 * Responsibilities:
 *  - Build the category UI (collapsible lists with counts)
 *  - Smooth-scroll when opening/closing lists
 *  - Track dirty state and enable/disable the Save button
 *  - Persist progress to localStorage (including totals for Main/index)
 *  - Provide "Select all" bulk toggle next to the global counter
 *  - Keep Main/index buttons in sync via _total and _count keys
 * -----------------------------------------------------------------------------
 */

function createEDFPage({ title, categories, storageKey }) {
  /* =========================================
   *  Initialization & DOM wiring
   *  - compute totals, cache main DOM nodes
   * ========================================= */
  const TOTAL_ALL = categories.reduce((sum, c) => sum + c.names.length, 0);
  localStorage.setItem(storageKey + '_total', String(TOTAL_ALL));

  const container = document.getElementById('categories-container');
  const saveBtn   = document.querySelector('.save-button');

  const CHECKED_SELECTOR = '#categories-container input[type="checkbox"]:checked';
  const prefersNoMotion  = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  /* =========================================
   *  Smooth scrolling helpers
   *  - bring header to top on open
   *  - scroll to top before closing to avoid jump
   * ========================================= */
  function scrollHeaderIntoView(headerEl, offset = 8) {
    if (!headerEl) return;
    const rect    = headerEl.getBoundingClientRect();
    const targetY = window.pageYOffset + rect.top - offset;
    if (prefersNoMotion) {
      window.scrollTo(0, targetY);
    } else {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  }

  function smoothScrollTo(topTarget) {
    if (prefersNoMotion) {
      window.scrollTo(0, topTarget);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const tolerance = 2;
      window.scrollTo({ top: topTarget, behavior: 'smooth' });
      const tick = () => {
        if (Math.abs(window.scrollY - topTarget) <= tolerance) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* =========================================
   *  Save button state
   *  - enable only when there are unsaved changes
   * ========================================= */
  function setSaveDisabled(disabled) {
    if (!saveBtn) return;
    saveBtn.classList.toggle('is-disabled', disabled);
    saveBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }
  function isSaveDisabled() {
    return !!saveBtn && saveBtn.classList.contains('is-disabled');
  }

  // Signature of current checkbox state (across all categories)
  let lastSavedSig = '';
  function computeSignature() {
    const parts = [];
    categories.forEach((cat, ci) => {
      const boxes = document.querySelectorAll(
        `.category:nth-child(${ci + 1}) input[type="checkbox"]`
      );
      let s = '';
      boxes.forEach(cb => { s += cb.checked ? '1' : '0'; });
      parts.push(s);
    });
    return parts.join('|');
  }
  function refreshDirty() {
    setSaveDisabled(computeSignature() === lastSavedSig);
  }

  /* =========================================
   *  Save (manual)
   *  - writes per-category selections
   *  - updates saved count for Main/index
   *  - shows toast and resets dirty state
   * ========================================= */
  function saveList(showToast = true) {
    if (isSaveDisabled()) return;

    const data = {};
    categories.forEach((cat, ci) => {
      data[cat.id] = [];
      const boxes = document.querySelectorAll(
        `.category:nth-child(${ci + 1}) input[type="checkbox"]`
      );
      boxes.forEach((cb, i) => { if (cb.checked) data[cat.id].push(i); });
    });
    localStorage.setItem(storageKey, JSON.stringify(data));

    const savedChecked = document.querySelectorAll(CHECKED_SELECTOR).length;
    localStorage.setItem(storageKey + '_count', String(savedChecked));

    if (showToast) showSaveToast();

    lastSavedSig = computeSignature();
    setSaveDisabled(true);
  }
  window.saveList = saveList;

  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      if (isSaveDisabled()) { e.preventDefault(); e.stopPropagation(); return; }
      saveList();
    });
  }

  /* =========================================
   *  UI Builder
   *  - build each category card, header, list
   *  - wire open/close with smooth scroll
   *  - wire checkbox change handlers
   * ========================================= */
  categories.forEach(cat => {
    // wrapper
    const wrap = document.createElement('div');
    wrap.className = 'category';

    // header (title + per-category count)
    const header = document.createElement('div');
    header.className = 'category-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'header-title';
    titleEl.textContent = cat.title;

    const countEl = document.createElement('span');
    countEl.className = 'header-count';
    countEl.textContent = `0/${cat.names.length}`;

    header.replaceChildren(titleEl, countEl);

    // open/close with smooth scrolling behavior
    header.addEventListener('click', async () => {
      const body     = wrap.querySelector('.category-items');
      const willOpen = body.style.display !== 'block';

      if (willOpen) {
        body.style.display = 'block';
        scrollHeaderIntoView(header);
      } else {
        await smoothScrollTo(0);       // avoid jump
        body.style.display = 'none';
      }
    });

    // list body
    const body = document.createElement('div');
    body.className = 'category-items';

    cat.names.forEach(name => {
      const label = document.createElement('label');
      const cb    = document.createElement('input');
      cb.type     = 'checkbox';

      cb.addEventListener('change', () => {
        updateCount(cat.id, cat.names.length);
        updateGlobalCount();
        refreshSelectAllToggle();
        refreshDirty();
      });

      label.appendChild(cb);
      label.append(` ${name}`);
      body.appendChild(label);
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    container.appendChild(wrap);
  });

  /* =========================================
   *  Counters
   *  - per-category count
   *  - global count (updates color state)
   * ========================================= */
  function updateCount(id, total) {
    const idx    = categories.findIndex(c => c.id === id);
    const catDiv = container.querySelector(`.category:nth-child(${idx + 1})`);
    const checked = catDiv.querySelectorAll('input[type="checkbox"]:checked').length;
    catDiv.querySelector('.header-count').textContent = `${checked}/${total}`;
  }
  window.updateCount = updateCount;

  function updateGlobalCount() {
    const el = document.getElementById('global-count');
    if (!el) return;
    const checked = document.querySelectorAll(CHECKED_SELECTOR).length;
    el.textContent = `${checked}/${TOTAL_ALL}`;
    el.classList.remove('low', 'medium', 'complete');
    if (checked >= TOTAL_ALL) el.classList.add('complete');
    else if (checked >= TOTAL_ALL / 2) el.classList.add('medium');
    else el.classList.add('low');
  }
  window.updateGlobalCount = updateGlobalCount;

  /* =========================================
   *  Toast
   *  - center overlay that auto-hides
   * ========================================= */
  function showSaveToast() {
    const t = document.getElementById('toast');
    if (!t) return;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1500);
  }
  window.showSaveToast = showSaveToast;

  /* =========================================
   *  Bulk select toggle
   *  - injects a "Select all" checkbox next to the counter
   *  - syncs indeterminate/checked state as you click
   * ========================================= */
  injectSelectAllToggle();

  function injectSelectAllToggle() {
    const bar = document.querySelector('.title-counter');
    if (!bar) return;

    let tools = bar.querySelector('.bulk-tools');
    if (!tools) {
      tools = document.createElement('span');
      tools.className = 'bulk-tools';
      tools.innerHTML = `
        <label class="bulk-toggle">
          <input id="select-all-toggle" type="checkbox" />
          <span>Select all</span>
        </label>
      `;
      bar.appendChild(tools);
    }

    const toggle = tools.querySelector('#select-all-toggle');
    toggle.addEventListener('change', (e) => {
      setAllCheckboxes(e.target.checked);
      updateGlobalCount();
      categories.forEach(c => updateCount(c.id, c.names.length));
      refreshSelectAllToggle();
      refreshDirty();
    });
  }

  function setAllCheckboxes(state) {
    const boxes = document.querySelectorAll('#categories-container input[type="checkbox"]');
    boxes.forEach(cb => { cb.checked = state; });
  }

  function refreshSelectAllToggle() {
    const toggle = document.getElementById('select-all-toggle');
    if (!toggle) return;
    const boxes   = document.querySelectorAll('#categories-container input[type="checkbox"]');
    const checked = document.querySelectorAll(CHECKED_SELECTOR);
    toggle.checked = (boxes.length > 0 && checked.length === boxes.length);
    toggle.indeterminate = (checked.length > 0 && checked.length < boxes.length);
  }

  /* =========================================
   *  Load (establish saved baseline)
   *  - restore saved selections
   *  - compute counts & sync Main/index totals
   *  - mark page as clean (save disabled)
   * ========================================= */
  function loadList() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}

    categories.forEach((cat, ci) => {
      const saved = data[cat.id] || [];
      const boxes = document.querySelectorAll(
        `.category:nth-child(${ci + 1}) input[type="checkbox"]`
      );
      saved.forEach(i => { if (boxes[i]) boxes[i].checked = true; });
      updateCount(cat.id, cat.names.length);
    });

    updateGlobalCount();
    refreshSelectAllToggle();

    // Keep Main/index in sync with authoritative totals & saved counts
    localStorage.setItem(storageKey + '_total', String(TOTAL_ALL));
    const savedChecked = document.querySelectorAll(CHECKED_SELECTOR).length;
    localStorage.setItem(storageKey + '_count', String(savedChecked));

    lastSavedSig = computeSignature();
    setSaveDisabled(true);
  }

  document.addEventListener('DOMContentLoaded', loadList);
}