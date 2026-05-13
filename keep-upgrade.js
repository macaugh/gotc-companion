(function () {
  const RESOURCE_KEYS = globalThis.RESOURCE_KEYS;
  if (!RESOURCE_KEYS || typeof globalThis.computeUpgradePlan !== 'function') {
    const grid = document.getElementById('buildings-grid');
    if (grid) {
      grid.innerHTML = '<p class="error-text" style="grid-column:1/-1">Engine failed to load. Reload the page.</p>';
    }
    return;
  }
  const RESOURCE_LABELS = {
    wood: 'Wood', food: 'Food', stone: 'Stone', iron: 'Iron',
    brick: 'Brick', pine: 'Pine', keystone: 'Keystone', valyrian: 'Valyrian Stone',
  };
  const KEEP_MIN = 10;
  const KEEP_MAX = 40;

  const state = {
    currentKeep: 15,
    targetKeep: 17,
    buildingLevels: {},
    bonusPctByResource: {},
    timeReductionPct: 0,
    defaultBuildingLevel: null,
  };

  function buildingsFromPrereqs() {
    const set = new Set();
    const PREREQS = globalThis.PREREQS || {};
    for (const k of Object.keys(PREREQS)) {
      for (const b of Object.keys(PREREQS[k])) set.add(b);
    }
    return Array.from(set).sort();
  }

  function parseIntSafe(raw) {
    if (raw == null) return null;
    const cleaned = String(raw).replace(/[,\s%]/g, '');
    if (cleaned === '' || cleaned === '-') return null;
    const n = parseInt(cleaned, 10);
    return Number.isNaN(n) ? null : n;
  }

  function clampKeep(n) {
    return Math.max(KEEP_MIN, Math.min(KEEP_MAX, n));
  }

  function clampPct(n) {
    return Math.max(0, Math.min(100, n));
  }

  function renderBuildingsGrid() {
    const buildings = buildingsFromPrereqs();
    const grid = document.getElementById('buildings-grid');
    grid.innerHTML = '';
    if (buildings.length === 0) {
      grid.innerHTML = '<p class="inv-hint" style="grid-column: 1 / -1;">No building data loaded yet.</p>';
      return;
    }
    if (state.defaultBuildingLevel == null) {
      state.defaultBuildingLevel = Math.max(KEEP_MIN - 1, state.currentKeep - 1);
    }
    const defaultLevel = state.defaultBuildingLevel;
    for (const name of buildings) {
      if (state.buildingLevels[name] == null) state.buildingLevels[name] = defaultLevel;
      const card = document.createElement('div');
      card.className = 'inv-card';
      const safeId = 'b-' + name.replace(/[^a-zA-Z0-9]/g, '-');
      card.innerHTML = `
        <label>${name}</label>
        <input type="text" inputmode="numeric" id="${safeId}" data-building="${name}" value="${state.buildingLevels[name]}" />
      `;
      grid.appendChild(card);
    }
    grid.querySelectorAll('input[data-building]').forEach(input => {
      input.addEventListener('input', () => {
        const n = parseIntSafe(input.value);
        if (n == null || n < 0) { input.style.borderColor = 'var(--blood)'; return; }
        input.style.borderColor = '';
        state.buildingLevels[input.dataset.building] = n;
        recompute();
      });
    });
  }

  function renderBonusGrid() {
    const grid = document.getElementById('bonus-grid');
    grid.innerHTML = '';
    for (const r of RESOURCE_KEYS) {
      if (state.bonusPctByResource[r] == null) state.bonusPctByResource[r] = 0;
      const card = document.createElement('div');
      card.className = 'inv-card';
      card.innerHTML = `
        <label>${RESOURCE_LABELS[r]} (%)</label>
        <input type="text" inputmode="numeric" data-bonus="${r}" value="${Math.round(state.bonusPctByResource[r] * 100)}" />
      `;
      grid.appendChild(card);
    }
    grid.querySelectorAll('input[data-bonus]').forEach(input => {
      input.addEventListener('input', () => {
        const n = parseIntSafe(input.value);
        if (n == null) { input.style.borderColor = 'var(--blood)'; return; }
        input.style.borderColor = '';
        state.bonusPctByResource[input.dataset.bonus] = clampPct(n) / 100;
        recompute();
      });
    });
  }

  function renderTotals(plan) {
    const grid = document.getElementById('totals-grid');
    grid.innerHTML = '';
    for (const r of RESOURCE_KEYS) {
      const card = document.createElement('div');
      card.className = 'stat-card';
      const reduced = plan.totals[r];
      const original = plan.totalsBeforeBonus[r];
      const savedLine = original > reduced
        ? `<div class="stat-sub">was ${globalThis.formatResource(original)}</div>` : '';
      card.innerHTML = `
        <div class="stat-label">${RESOURCE_LABELS[r]}</div>
        <div class="stat-val">${globalThis.formatResource(reduced)}</div>
        ${savedLine}
      `;
      grid.appendChild(card);
    }
    const timeCard = document.createElement('div');
    timeCard.className = 'stat-card savings';
    const tSub = plan.totalsBeforeBonus.hours > plan.totals.hours
      ? `<div class="stat-sub">was ${globalThis.formatHours(plan.totalsBeforeBonus.hours)}</div>` : '';
    timeCard.innerHTML = `
      <div class="stat-label">Total time</div>
      <div class="stat-val">${globalThis.formatHours(plan.totals.hours)}</div>
      ${tSub}
    `;
    grid.appendChild(timeCard);
  }

  function renderBreakdown(plan) {
    const body = document.getElementById('breakdown-body');
    if (plan.rows.length === 0) {
      body.innerHTML = '<p class="inv-hint">No upgrades required.</p>';
      return;
    }
    const head = `
      <thead><tr>
        <th>Building</th><th>From → To</th>
        ${RESOURCE_KEYS.map(r => `<th>${RESOURCE_LABELS[r]}</th>`).join('')}
        <th>Time</th>
      </tr></thead>`;
    const rows = plan.rows.map(r => {
      const cls = r.missing ? ' class="missing"' : '';
      const cells = RESOURCE_KEYS.map(k => `<td>${r.missing ? '—' : globalThis.formatResource(r.costs[k] || 0)}</td>`).join('');
      const time = r.missing ? '—' : globalThis.formatHours(r.costs.hours || 0);
      return `<tr${cls}><td>${r.building}</td><td>${r.fromLevel} → ${r.toLevel}</td>${cells}<td>${time}</td></tr>`;
    }).join('');
    body.innerHTML = `<table>${head}<tbody>${rows}</tbody></table>`;
  }

  function validateGoal() {
    const err = document.getElementById('goal-error');
    if (state.targetKeep < state.currentKeep) {
      err.hidden = false;
      return false;
    }
    err.hidden = true;
    return true;
  }

  function buildUrl() {
    const params = new URLSearchParams();
    params.set('ck', state.currentKeep);
    params.set('tk', state.targetKeep);
    for (const b of Object.keys(state.buildingLevels)) {
      const def = state.defaultBuildingLevel != null
        ? state.defaultBuildingLevel
        : Math.max(KEEP_MIN - 1, state.currentKeep - 1);
      if (state.buildingLevels[b] !== def) params.set('b.' + b, state.buildingLevels[b]);
    }
    for (const r of RESOURCE_KEYS) {
      const pct = Math.round((state.bonusPctByResource[r] || 0) * 100);
      if (pct !== 0) params.set('r.' + r, pct);
    }
    const tPct = Math.round((state.timeReductionPct || 0) * 100);
    if (tPct !== 0) params.set('tr', tPct);
    return window.location.origin + window.location.pathname + '?' + params.toString();
  }

  function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('ck')) state.currentKeep = clampKeep(parseIntSafe(params.get('ck')) ?? state.currentKeep);
    if (params.has('tk')) state.targetKeep = clampKeep(parseIntSafe(params.get('tk')) ?? state.targetKeep);
    for (const [key, val] of params.entries()) {
      if (key.startsWith('b.')) {
        const n = parseIntSafe(val);
        if (n != null && n >= 0) state.buildingLevels[key.slice(2)] = n;
      } else if (key.startsWith('r.')) {
        const n = parseIntSafe(val);
        if (n != null) state.bonusPctByResource[key.slice(2)] = clampPct(n) / 100;
      } else if (key === 'tr') {
        const n = parseIntSafe(val);
        if (n != null) state.timeReductionPct = clampPct(n) / 100;
      }
    }
  }

  function recompute() {
    if (!validateGoal()) {
      document.getElementById('totals-grid').innerHTML = '';
      document.getElementById('breakdown-body').innerHTML = '';
      document.getElementById('share-url').value = buildUrl();
      return;
    }
    const plan = globalThis.computeUpgradePlan({
      currentKeep: state.currentKeep,
      targetKeep: state.targetKeep,
      currentBuildingLevels: state.buildingLevels,
      bonusPctByResource: state.bonusPctByResource,
      timeReductionPct: state.timeReductionPct,
      costs: globalThis.COSTS || {},
      prereqs: globalThis.PREREQS || {},
    });
    renderTotals(plan);
    renderBreakdown(plan);
    document.getElementById('share-url').value = buildUrl();
  }

  function wireGoalInputs() {
    document.querySelectorAll('.val-input').forEach(input => {
      const field = input.dataset.field;
      input.addEventListener('input', () => {
        const n = parseIntSafe(input.value);
        if (n == null) { input.classList.add('invalid'); return; }
        input.classList.remove('invalid');
        if (field === 'currentKeep' || field === 'targetKeep') {
          state[field] = clampKeep(n);
        } else if (field === 'timeReductionPct') {
          state.timeReductionPct = clampPct(n) / 100;
        }
        recompute();
      });
    });
  }

  function wireApplyAll() {
    document.getElementById('bonus-apply-all').addEventListener('input', (e) => {
      const n = parseIntSafe(e.target.value);
      if (n == null) return;
      const pct = clampPct(n);
      for (const r of RESOURCE_KEYS) state.bonusPctByResource[r] = pct / 100;
      renderBonusGrid();
      recompute();
    });
  }

  function wireCopy() {
    document.getElementById('copy-btn').addEventListener('click', async () => {
      const btn = document.getElementById('copy-btn');
      const url = document.getElementById('share-url').value;
      try { await navigator.clipboard.writeText(url); }
      catch { const i = document.getElementById('share-url'); i.select(); document.execCommand('copy'); }
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
    });
  }

  // Init
  loadFromUrl();
  document.getElementById('ck-out').value = state.currentKeep;
  document.getElementById('tk-out').value = state.targetKeep;
  document.getElementById('tr-out').value = Math.round(state.timeReductionPct * 100);
  renderBuildingsGrid();
  renderBonusGrid();
  wireGoalInputs();
  wireApplyAll();
  wireCopy();
  recompute();
})();
