/**
 * edf-page.js
 * -----------------------------------------------------------------------------
 * Shared page builder for each EDF class page (Ranger / Wingdiver / AirRaider / Fencer).
 *
 * Responsibilities:
 *  - Build the category UI (accordion lists with counts)
 *  - Live search across weapon names
 *  - Debounced autosave with a non-blocking toast
 *  - Confirmation modal for bulk (multi-item) changes
 *  - Persist progress to localStorage (including totals for Main/index)
 *  - Keep Main/index buttons in sync via _total and _count keys
 *
 * Save format is unchanged from the pre-redesign app and must stay that way so
 * existing users' progress survives: localStorage[storageKey] is a JSON object
 * of { categoryId: [checkedIndex, ...] }, alongside storageKey + '_total' and
 * storageKey + '_count'. Indices are positions within a category's names array.
 * -----------------------------------------------------------------------------
 */

function createEDFPage({ title, categories, storageKey }) {
  /* =========================================
   *  Initialization & DOM wiring
   * ========================================= */
  const TOTAL_ALL = categories.reduce((sum, c) => sum + c.names.length, 0);
  localStorage.setItem(storageKey + '_total', String(TOTAL_ALL));

  const container   = document.getElementById('categories-container');
  const classNameEl = document.querySelector('.classname');
  const badgeEl     = document.getElementById('global-count');
  const searchEl    = document.getElementById('search-input');
  const noResultsEl = document.getElementById('no-results');
  const topbarEl    = document.querySelector('.topbar');

  if (classNameEl && title) classNameEl.textContent = title;

  const SAVE_DEBOUNCE_MS = 600;

  // Per-category runtime state. Element references are held directly rather than
  // re-queried via .category:nth-child(n) — that selector only worked while the
  // container's children were exclusively .category divs, which the search
  // empty-state and any future sibling would quietly break.
  const state = categories.map(cat => ({
    id: cat.id,
    title: cat.title,
    names: cat.names,
    boxes: [],      // the real <input type="checkbox"> per weapon
    rowEls: [],     // the <li> per weapon, for search filtering
    wrapEl: null,
    headerEl: null,
    bodyEl: null,
    countEl: null,
  }));

  const checkedCountFor = (cat) => cat.boxes.reduce((n, cb) => n + (cb.checked ? 1 : 0), 0);
  const totalChecked    = () => state.reduce((n, cat) => n + checkedCountFor(cat), 0);

  /* =========================================
   *  Sticky offset
   *  - category headers stick directly beneath the top bar, whose height varies
   *    with the iOS safe-area inset, so measure it instead of hard-coding.
   * ========================================= */
  function syncTopbarHeight() {
    if (!topbarEl) return;
    document.documentElement.style.setProperty('--topbar-h', topbarEl.offsetHeight + 'px');
  }
  syncTopbarHeight();
  window.addEventListener('resize', syncTopbarHeight);
  if (window.ResizeObserver && topbarEl) new ResizeObserver(syncTopbarHeight).observe(topbarEl);

  /* =========================================
   *  Persistence
   *  - autosave is debounced; a flush on pagehide/hide keeps the last change
   *    from being lost if the app is closed inside the debounce window.
   * ========================================= */
  let saveTimer = null;

  function saveNow(showToastOnSave = true) {
    const data = {};
    state.forEach(cat => {
      const picked = [];
      cat.boxes.forEach((cb, i) => { if (cb.checked) picked.push(i); });
      data[cat.id] = picked;
    });
    localStorage.setItem(storageKey, JSON.stringify(data));
    localStorage.setItem(storageKey + '_count', String(totalChecked()));
    localStorage.setItem(storageKey + '_total', String(TOTAL_ALL));
    if (showToastOnSave) showToast('Progress saved');
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, SAVE_DEBOUNCE_MS);
  }

  function flushSave() {
    if (saveTimer === null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    saveNow(false); // no toast — the page is going away
  }

  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });

  /* =========================================
   *  Counters
   * ========================================= */
  function updateCategoryCount(cat) {
    if (cat.countEl) cat.countEl.textContent = `${checkedCountFor(cat)}/${cat.names.length}`;
  }

  function updateGlobalCount() {
    const checked = totalChecked();
    if (badgeEl) badgeEl.textContent = String(checked).padStart(3, '0') + '/' + TOTAL_ALL;
    refreshSelectAllToggle(checked);
  }

  function updateAllCounts() {
    state.forEach(updateCategoryCount);
    updateGlobalCount();
  }

  /* =========================================
   *  Toast
   * ========================================= */
  let toastTimer = null;
  function showToast(msg) {
    const toastEl = document.getElementById('toast');
    const textEl  = document.getElementById('toast-text');
    if (!toastEl) return;
    if (textEl) textEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* =========================================
   *  Confirmation modal (bulk changes only)
   *  - traps Tab inside the dialog and restores focus to the invoking control
   * ========================================= */
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalMsg      = document.getElementById('modal-msg');
  const modalCancel   = document.getElementById('modal-cancel');
  const modalConfirm  = document.getElementById('modal-confirm');
  let pendingConfirm  = null;
  let lastFocused     = null;

  function confirmBulk(message, onConfirm) {
    if (!modalBackdrop) { onConfirm(); return; } // fail open rather than trap the action
    lastFocused = document.activeElement;
    modalMsg.textContent = message;
    pendingConfirm = onConfirm;
    modalBackdrop.classList.add('open');
    modalConfirm.focus();
  }

  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('open');
    pendingConfirm = null;
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  }

  if (modalBackdrop) {
    modalCancel.addEventListener('click', closeModal);
    modalConfirm.addEventListener('click', () => {
      const fn = pendingConfirm;
      closeModal();
      if (fn) fn();
    });
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (!modalBackdrop.classList.contains('open')) return;
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key !== 'Tab') return;
      const focusables = [modalCancel, modalConfirm];
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* =========================================
   *  Bulk helpers
   * ========================================= */
  function setBoxes(boxes, checked) {
    boxes.forEach(cb => { cb.checked = checked; });
    updateAllCounts();
    scheduleSave();
  }

  /* =========================================
   *  UI Builder
   * ========================================= */
  state.forEach(cat => {
    const wrap = document.createElement('div');
    wrap.className = 'category';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'cat-header';
    header.setAttribute('aria-expanded', 'false');

    const nameEl = document.createElement('span');
    nameEl.className = 'cat-name';
    nameEl.textContent = cat.title;

    const countEl = document.createElement('span');
    countEl.className = 'cat-count';
    countEl.textContent = `0/${cat.names.length}`;

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '›'; // ›
    chevron.setAttribute('aria-hidden', 'true');

    header.append(nameEl, countEl, chevron);

    const body = document.createElement('div');
    body.className = 'cat-body';
    body.hidden = true;

    const bulkBtn = document.createElement('button');
    bulkBtn.type = 'button';
    bulkBtn.className = 'cat-bulk-btn';
    bulkBtn.textContent = 'Toggle All In This Category';
    body.appendChild(bulkBtn);

    const list = document.createElement('ul');
    list.className = 'weapon-list';

    cat.names.forEach(name => {
      const li = document.createElement('li');
      li.className = 'weapon-row';

      // The <label> wraps the input, so a tap anywhere in the row toggles the
      // checkbox exactly once through native label behaviour. Adding a JS click
      // handler here as well would double-fire whenever the tap landed on the
      // input itself, cancelling the change out.
      const label = document.createElement('label');
      label.className = 'weapon-label';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'toggle-input';

      const toggle = document.createElement('span');
      toggle.className = 'toggle';
      toggle.setAttribute('aria-hidden', 'true');
      toggle.appendChild(Object.assign(document.createElement('span'), { className: 'knob' }));

      const nameSpan = document.createElement('span');
      nameSpan.className = 'weapon-name';
      nameSpan.textContent = name;

      cb.addEventListener('change', () => {
        updateAllCounts();
        scheduleSave();
      });

      label.append(cb, toggle, nameSpan);
      li.appendChild(label);
      list.appendChild(li);

      cat.boxes.push(cb);
      cat.rowEls.push(li);
    });

    body.appendChild(list);
    wrap.append(header, body);
    container.appendChild(wrap);

    cat.wrapEl = wrap;
    cat.headerEl = header;
    cat.bodyEl = body;
    cat.countEl = countEl;

    // Accordion: opening one category closes any other that is open.
    header.addEventListener('click', () => {
      const isOpen = header.getAttribute('aria-expanded') === 'true';
      if (!isOpen) state.forEach(other => { if (other !== cat) setCategoryOpen(other, false); });
      setCategoryOpen(cat, !isOpen);
    });

    bulkBtn.addEventListener('click', () => {
      const willSelect = checkedCountFor(cat) < cat.boxes.length;
      const verb = willSelect ? 'collected' : 'not collected';
      confirmBulk(
        // No trailing "weapons" here — the category name already supplies the
        // noun ("...all 34 Stationary Weapons as..."). The class-level message
        // below does need it, since a class name alone doesn't read as one.
        `Mark all ${cat.boxes.length} ${cat.title} as ${verb}?`,
        () => setBoxes(cat.boxes, willSelect)
      );
    });
  });

  function setCategoryOpen(cat, open) {
    cat.headerEl.setAttribute('aria-expanded', String(open));
    cat.bodyEl.hidden = !open;
    cat.wrapEl.classList.toggle('open', open);
  }

  /* =========================================
   *  Select all (global)
   * ========================================= */
  const selectAllBox = document.getElementById('select-all-toggle');

  function refreshSelectAllToggle(checked = totalChecked()) {
    if (!selectAllBox) return;
    selectAllBox.checked = (TOTAL_ALL > 0 && checked === TOTAL_ALL);
    selectAllBox.indeterminate = (checked > 0 && checked < TOTAL_ALL);
  }

  if (selectAllBox) {
    selectAllBox.addEventListener('click', (e) => {
      // Drive this through the modal instead of letting the checkbox flip
      // straight away — the change only lands once the user confirms.
      e.preventDefault();
      const willSelect = totalChecked() < TOTAL_ALL;
      const verb = willSelect ? 'collected' : 'not collected';
      confirmBulk(
        `Mark all ${TOTAL_ALL} ${title} weapons as ${verb}?`,
        () => setBoxes(state.flatMap(c => c.boxes), willSelect)
      );
    });
  }

  /* =========================================
   *  Search
   *  - filters rows in place; matching categories auto-expand while a query is
   *    active, and everything collapses again once it is cleared.
   *  - hidden rows stay in the DOM, so saved indices remain correct throughout.
   * ========================================= */
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.trim().toLowerCase();

      if (!q) {
        state.forEach(cat => {
          cat.rowEls.forEach(li => { li.hidden = false; });
          cat.wrapEl.hidden = false;
          setCategoryOpen(cat, false);
        });
        if (noResultsEl) noResultsEl.hidden = true;
        return;
      }

      let anyMatchAtAll = false;
      state.forEach(cat => {
        let anyMatch = false;
        cat.names.forEach((name, i) => {
          const match = name.toLowerCase().includes(q);
          cat.rowEls[i].hidden = !match;
          if (match) anyMatch = true;
        });
        cat.wrapEl.hidden = !anyMatch;
        setCategoryOpen(cat, anyMatch);
        if (anyMatch) anyMatchAtAll = true;
      });
      if (noResultsEl) noResultsEl.hidden = anyMatchAtAll;
    });
  }

  /* =========================================
   *  Load saved progress
   * ========================================= */
  function loadList() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { data = {}; }

    state.forEach(cat => {
      const saved = Array.isArray(data[cat.id]) ? data[cat.id] : [];
      saved.forEach(i => { if (cat.boxes[i]) cat.boxes[i].checked = true; });
    });

    updateAllCounts();

    // Keep Main/index in sync with authoritative totals & counts on every visit.
    localStorage.setItem(storageKey + '_total', String(TOTAL_ALL));
    localStorage.setItem(storageKey + '_count', String(totalChecked()));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadList);
  } else {
    loadList();
  }
}
