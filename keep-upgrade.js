(function () {
  const RESOURCE_KEYS = globalThis.RESOURCE_KEYS;
  const RESOURCE_TO_CATEGORY = globalThis.RESOURCE_TO_CATEGORY;
  if (!RESOURCE_KEYS || !RESOURCE_TO_CATEGORY || typeof globalThis.computeUpgradePlan !== 'function') {
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
  const CATEGORY_LABELS = {
    resource: 'Building Resource Cost Efficiency',
    pine: 'Building Soldier Pine Cost Efficiency',
    keystone: 'Building Keystone Cost Efficiency',
    valyrian: 'Building Valyrian Stone Cost Efficiency',
  };
  const CATEGORY_KEYS = ['resource', 'pine', 'keystone', 'valyrian'];
  const KEEP_MIN = 10;
  const KEEP_MAX = 40;

  const state = {
    currentKeep: 15,
    targetKeep: 17,
    buildingLevels: {},
    efficiencyByCategory: { resource: 0, pine: 0, keystone: 0, valyrian: 0 },
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,         // decimal — combined h + m/60
    flatWoodReduction: 0,
  };
  // UI-only split storage for the h + m inputs.
  const fbtUi = { hours: 0, minutes: 0 };

  function buildingsForGrid() {
    // Upgradeable buildings from BUILDINGS metadata, excluding Keep itself,
    // filtered to those already unlocked at the player's current Keep level
    // (BUILDINGS[name].unlockLevel is the Keep level at which the building
    // becomes available).
    const BUILDINGS = globalThis.BUILDINGS || {};
    const names = [];
    for (const name of Object.keys(BUILDINGS)) {
      const meta = BUILDINGS[name];
      if (!meta || !meta.upgradeable || name === 'Keep') continue;
      if ((meta.unlockLevel || 0) > state.currentKeep) continue;
      names.push(name);
    }
    return names.sort();
  }

  function parseIntSafe(raw) {
    if (raw == null) return null;
    const cleaned = String(raw).replace(/[,\s%]/g, '');
    if (cleaned === '' || cleaned === '-') return null;
    const n = parseInt(cleaned, 10);
    return Number.isNaN(n) ? null : n;
  }

  function parseFloatSafe(raw) {
    if (raw == null) return null;
    const cleaned = String(raw).replace(/[,\s%]/g, '');
    if (cleaned === '' || cleaned === '-') return null;
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? null : n;
  }

  function clampKeep(n) {
    return Math.max(KEEP_MIN, Math.min(KEEP_MAX, n));
  }

  function populateKeepDropdowns() {
    for (const id of ['ck-out', 'tk-out']) {
      const sel = document.getElementById(id);
      sel.innerHTML = '';
      for (let i = KEEP_MIN; i <= KEEP_MAX; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = String(i);
        sel.appendChild(opt);
      }
    }
    document.getElementById('ck-out').value = String(state.currentKeep);
    document.getElementById('tk-out').value = String(state.targetKeep);
  }

  function minimumLevelsForCurrentKeep() {
    if (typeof globalThis.computeMinimumLevels !== 'function') return {};
    return globalThis.computeMinimumLevels(state.currentKeep, globalThis.REQUIREMENTS || {});
  }

  function renderBuildingsGrid() {
    const buildings = buildingsForGrid();
    const grid = document.getElementById('buildings-grid');
    grid.innerHTML = '';
    if (buildings.length === 0) {
      grid.innerHTML = '<p class="inv-hint" style="grid-column: 1 / -1;">No building data loaded yet.</p>';
      return;
    }
    const minLevels = minimumLevelsForCurrentKeep();
    for (const name of buildings) {
      if (state.buildingLevels[name] == null) {
        state.buildingLevels[name] = minLevels[name] || 0;
      }
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

  function renderEfficiencyGrid() {
    const grid = document.getElementById('efficiency-grid');
    grid.innerHTML = '';
    for (const cat of CATEGORY_KEYS) {
      const card = document.createElement('div');
      card.className = 'inv-card';
      const pctDisplay = (state.efficiencyByCategory[cat] * 100).toFixed(3).replace(/\.?0+$/, '');
      card.innerHTML = `
        <label>${CATEGORY_LABELS[cat]} (%)</label>
        <input type="text" inputmode="decimal" data-efficiency="${cat}" value="${pctDisplay}" />
      `;
      grid.appendChild(card);
    }
    grid.querySelectorAll('input[data-efficiency]').forEach(input => {
      input.addEventListener('input', () => {
        const n = parseFloatSafe(input.value);
        if (n == null) { input.style.borderColor = 'var(--blood)'; return; }
        input.style.borderColor = '';
        state.efficiencyByCategory[input.dataset.efficiency] = Math.max(0, n) / 100;
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
      const savedLine = original > reduced + 0.5
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
    const tSub = plan.totalsBeforeBonus.hours > plan.totals.hours + 0.01
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
    // Only render resource columns that have at least one non-zero value
    // across all rows. Resources like Valyrian (currently zero everywhere) or
    // Iron (zero for some keep ranges) get dropped, keeping the table narrow.
    const visibleResources = RESOURCE_KEYS.filter(r =>
      plan.rows.some(row => !row.missing && (row.costs[r] || 0) > 0)
    );
    const head = `
      <thead><tr>
        <th>Building</th><th>From → To</th>
        ${visibleResources.map(r => `<th>${RESOURCE_LABELS[r]}</th>`).join('')}
        <th>Time</th>
      </tr></thead>`;
    const rows = plan.rows.map(r => {
      const cls = r.missing ? ' class="missing"' : '';
      const cells = visibleResources.map(k => `<td>${r.missing ? '—' : globalThis.formatResource(r.costs[k] || 0)}</td>`).join('');
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
    const minLevels = minimumLevelsForCurrentKeep();
    for (const b of Object.keys(state.buildingLevels)) {
      const min = minLevels[b] || 0;
      if (state.buildingLevels[b] !== min) params.set('b.' + b, state.buildingLevels[b]);
    }
    for (const cat of CATEGORY_KEYS) {
      const pct = (state.efficiencyByCategory[cat] || 0) * 100;
      if (pct !== 0) params.set('e.' + cat, pct);
    }
    const csPct = (state.constructionSpeedPct || 0) * 100;
    if (csPct !== 0) params.set('cs', csPct);
    if (state.freeBuildTimeHours !== 0) params.set('fbt', state.freeBuildTimeHours);
    if (state.flatWoodReduction !== 0) params.set('fw', state.flatWoodReduction);
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
      } else if (key.startsWith('e.')) {
        const n = parseFloatSafe(val);
        if (n != null) state.efficiencyByCategory[key.slice(2)] = Math.max(0, n) / 100;
      } else if (key === 'cs') {
        const n = parseFloatSafe(val);
        if (n != null) state.constructionSpeedPct = Math.max(0, n) / 100;
      } else if (key === 'fbt') {
        const n = parseFloatSafe(val);
        if (n != null) {
          state.freeBuildTimeHours = Math.max(0, n);
          fbtUi.hours = Math.floor(state.freeBuildTimeHours);
          fbtUi.minutes = Math.round((state.freeBuildTimeHours - fbtUi.hours) * 60);
        }
      } else if (key === 'fw') {
        const n = parseIntSafe(val);
        if (n != null) state.flatWoodReduction = Math.max(0, n);
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
      efficiencyByCategory: state.efficiencyByCategory,
      constructionSpeedPct: state.constructionSpeedPct,
      freeBuildTimeHours: state.freeBuildTimeHours,
      flatWoodReduction: state.flatWoodReduction,
      costs: globalThis.COSTS || {},
      requirements: globalThis.REQUIREMENTS || {},
    });
    renderTotals(plan);
    renderBreakdown(plan);
    document.getElementById('share-url').value = buildUrl();
  }

  function wireKeepDropdowns() {
    document.getElementById('ck-out').addEventListener('change', (e) => {
      state.currentKeep = clampKeep(parseIntSafe(e.target.value) ?? state.currentKeep);
      updateResetButtonLabel();
      renderBuildingsGrid();  // visible set + defaults depend on currentKeep
      recompute();
    });
    document.getElementById('tk-out').addEventListener('change', (e) => {
      state.targetKeep = clampKeep(parseIntSafe(e.target.value) ?? state.targetKeep);
      recompute();
    });
  }

  function wireScalarInputs() {
    document.getElementById('cs-out').addEventListener('input', (e) => {
      const n = parseFloatSafe(e.target.value);
      if (n == null) { e.target.classList.add('invalid'); return; }
      e.target.classList.remove('invalid');
      state.constructionSpeedPct = Math.max(0, n) / 100;
      recompute();
    });
    document.getElementById('fw-out').addEventListener('input', (e) => {
      const n = parseIntSafe(e.target.value);
      if (n == null) { e.target.classList.add('invalid'); return; }
      e.target.classList.remove('invalid');
      state.flatWoodReduction = Math.max(0, n);
      recompute();
    });
    function updateFbt() {
      state.freeBuildTimeHours = Math.max(0, fbtUi.hours + fbtUi.minutes / 60);
      recompute();
    }
    document.getElementById('fbt-h').addEventListener('input', (e) => {
      const n = parseIntSafe(e.target.value);
      if (n == null) { e.target.classList.add('invalid'); return; }
      e.target.classList.remove('invalid');
      fbtUi.hours = Math.max(0, n);
      updateFbt();
    });
    document.getElementById('fbt-m').addEventListener('input', (e) => {
      const n = parseIntSafe(e.target.value);
      if (n == null) { e.target.classList.add('invalid'); return; }
      e.target.classList.remove('invalid');
      fbtUi.minutes = Math.max(0, n);
      updateFbt();
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

  function updateResetButtonLabel() {
    const span = document.getElementById('reset-min-keep');
    if (span) span.textContent = String(state.currentKeep);
  }

  function wireResetMin() {
    document.getElementById('reset-min-btn').addEventListener('click', () => {
      const mins = minimumLevelsForCurrentKeep();
      // Reset every building shown in the grid; non-required buildings default to 0.
      for (const name of buildingsForGrid()) {
        state.buildingLevels[name] = mins[name] || 0;
      }
      renderBuildingsGrid();
      recompute();
    });
  }

  // Init
  loadFromUrl();
  populateKeepDropdowns();
  document.getElementById('cs-out').value = (state.constructionSpeedPct * 100).toFixed(3).replace(/\.?0+$/, '') || '0';
  document.getElementById('fw-out').value = String(state.flatWoodReduction);
  document.getElementById('fbt-h').value = String(fbtUi.hours);
  document.getElementById('fbt-m').value = String(fbtUi.minutes);
  renderBuildingsGrid();
  renderEfficiencyGrid();
  updateResetButtonLabel();
  wireKeepDropdowns();
  wireScalarInputs();
  wireCopy();
  wireResetMin();
  recompute();
})();
