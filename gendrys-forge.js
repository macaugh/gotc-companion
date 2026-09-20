(function () {
  const QUALITIES = ['poor', 'common', 'fine', 'exquisite', 'epic', 'legendary'];
  const QUALITY_MULTIPLIERS = [1, 2, 4, 8, 16, 32];

  const allSeasons = [
    season0, season1, season2, season3, season4, season5, season6,
    season7, season8, season9, season10, season11, season12, season13, season14, seasonctw
  ];

  function matDisplayName(key) {
    for (const s of Object.values(materials)) {
      if (s.mats && s.mats[key]) return s.mats[key]['Original-name'];
    }
    return key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function seasonLabel(s) {
    if (s.season === 0) return 'Standard';
    if (s.season === 'ctw') return 'CTW';
    return 'Season ' + s.season;
  }

  function setsForSeason(seasonObj) {
    if (!seasonObj.sets) return [];
    if (seasonObj.season === 0) return [{ setName: 'Standard', products: seasonObj.sets[0].products }];
    return seasonObj.sets;
  }

  function levelsForSet(set, seasonObj) {
    const lvls = [...new Set(set.products.map(p => p.level))].sort((a, b) => a - b);
    return lvls;
  }

  function piecesAtLevel(set, level) {
    const pieces = set.products.filter(p => p.level === level);
    const seen = new Set();
    return pieces.filter(p => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }

  const $ = sel => document.querySelector(sel);

  const state = {
    mode: 'loadout',
    seasonIdx: 0,
    setIdx: 0,
    level: 1,
    quality: 4,
    selectedPieces: new Set(),
    steelEff: 0,
    queue: [],
  };

  const els = {
    modeGroup: document.querySelectorAll('#mode-group .radio-opt'),
    loadoutPanel: $('#loadout-panel'),
    queuePanel: $('#queue-panel'),
    seasonSelect: $('#season-select'),
    setSelect: $('#set-select'),
    levelSelect: $('#level-select'),
    qualitySelect: $('#quality-select'),
    pieceChecklist: $('#piece-checklist'),
    steelEff: $('#steel-eff'),
    totalsMount: $('#totals-mount'),
    queueItems: $('#queue-items'),
  };

  function currentSeason() { return allSeasons[state.seasonIdx]; }
  function currentSets() { return setsForSeason(currentSeason()); }
  function currentSet() { return currentSets()[state.setIdx] || currentSets()[0]; }

  function populateSeasons() {
    els.seasonSelect.innerHTML = allSeasons.map((s, i) =>
      `<option value="${i}">${seasonLabel(s)}</option>`
    ).join('');
    els.seasonSelect.value = state.seasonIdx;
  }

  function populateSets() {
    const sets = currentSets();
    els.setSelect.innerHTML = sets.map((s, i) =>
      `<option value="${i}">${s.setName || 'Set ' + (i + 1)}</option>`
    ).join('');
    state.setIdx = Math.min(state.setIdx, sets.length - 1);
    els.setSelect.value = state.setIdx;
  }

  function populateLevels() {
    const set = currentSet();
    if (!set) return;
    const lvls = levelsForSet(set, currentSeason());
    els.levelSelect.innerHTML = lvls.map(l => `<option value="${l}">${l}</option>`).join('');
    if (!lvls.includes(state.level)) state.level = lvls[0] || 1;
    els.levelSelect.value = state.level;
  }

  function populateQualities() {
    els.qualitySelect.innerHTML = QUALITIES.map((q, i) =>
      `<option value="${i}">${q.charAt(0).toUpperCase() + q.slice(1)}</option>`
    ).join('');
    els.qualitySelect.value = state.quality;
  }

  function renderPieceChecklist() {
    const set = currentSet();
    if (!set) { els.pieceChecklist.innerHTML = '<p class="hint">No set selected.</p>'; return; }
    const pieces = piecesAtLevel(set, state.level);
    if (!pieces.length) { els.pieceChecklist.innerHTML = '<p class="hint">No pieces at this level.</p>'; return; }

    els.pieceChecklist.innerHTML = pieces.map((p, i) => {
      const checked = state.selectedPieces.has(p.name) ? 'checked' : '';
      return `<div class="row">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          <input type="checkbox" data-piece="${p.name}" ${checked} />
          ${p.name}
        </label>
      </div>`;
    }).join('');

    els.pieceChecklist.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedPieces.add(cb.dataset.piece);
        else state.selectedPieces.delete(cb.dataset.piece);
        renderTotals();
      });
    });
  }

  function selectAllPieces() {
    const set = currentSet();
    if (!set) return;
    const pieces = piecesAtLevel(set, state.level);
    state.selectedPieces = new Set(pieces.map(p => p.name));
  }

  function computeMaterials(pieces, qualityIdx, effPercent) {
    const mult = QUALITY_MULTIPLIERS[qualityIdx];
    const costDiv = 1 + (effPercent / 100);
    const totals = {};
    for (const p of pieces) {
      for (const [mat, base] of Object.entries(p.materials)) {
        const cost = Math.ceil((base * mult) / costDiv);
        totals[mat] = (totals[mat] || 0) + cost;
      }
    }
    return totals;
  }

  function renderTotals() {
    if (state.mode === 'loadout') renderLoadoutTotals();
    else renderQueueTotals();
  }

  function renderLoadoutTotals() {
    const set = currentSet();
    if (!set) { els.totalsMount.innerHTML = '<p class="hint">Select a set to see totals.</p>'; return; }
    const allPieces = piecesAtLevel(set, state.level);
    const selected = allPieces.filter(p => state.selectedPieces.has(p.name));
    if (!selected.length) {
      els.totalsMount.innerHTML = '<p class="hint">Select pieces to see totals.</p>';
      return;
    }

    const matTotals = computeMaterials(selected, state.quality, state.steelEff);
    const qualityLabel = QUALITIES[state.quality].charAt(0).toUpperCase() + QUALITIES[state.quality].slice(1);

    let html = `<div class="stats-grid">`;
    const sortedMats = Object.entries(matTotals).sort((a, b) => b[1] - a[1]);
    for (const [mat, amt] of sortedMats) {
      html += `<div class="stat-card">
        <div class="stat-label">${matDisplayName(mat)}</div>
        <div class="stat-value">${amt.toLocaleString()}</div>
      </div>`;
    }
    html += '</div>';

    html += '<table class="totals"><thead><tr><th>Piece</th><th>Quality</th>';
    const matKeys = sortedMats.map(([k]) => k);
    for (const k of matKeys) html += `<th>${matDisplayName(k)}</th>`;
    html += '</tr></thead><tbody>';

    for (const p of selected) {
      const mult = QUALITY_MULTIPLIERS[state.quality];
      const costDiv = 1 + (state.steelEff / 100);
      html += `<tr><td>${p.name}</td><td>${qualityLabel}</td>`;
      for (const k of matKeys) {
        const base = p.materials[k] || 0;
        const cost = base ? Math.ceil((base * mult) / costDiv) : 0;
        html += `<td>${cost ? cost.toLocaleString() : '—'}</td>`;
      }
      html += '</tr>';
    }

    html += `<tr class="totals-row"><th colspan="2">Total</th>`;
    for (const k of matKeys) html += `<th>${matTotals[k].toLocaleString()}</th>`;
    html += '</tr></tbody></table>';

    els.totalsMount.innerHTML = html;
  }

  function renderQueueTotals() {
    if (!state.queue.length) {
      els.totalsMount.innerHTML = '<p class="hint">Add pieces to the queue to see totals.</p>';
      return;
    }

    const grandTotals = {};
    const rows = [];

    for (const q of state.queue) {
      const season = allSeasons[q.seasonIdx];
      const sets = setsForSeason(season);
      const set = sets[q.setIdx];
      if (!set) continue;
      const pieces = piecesAtLevel(set, q.level);
      const piece = pieces.find(p => p.name === q.pieceName);
      if (!piece) continue;

      const mult = QUALITY_MULTIPLIERS[q.quality];
      const costDiv = 1 + (state.steelEff / 100);
      const mats = {};
      for (const [mat, base] of Object.entries(piece.materials)) {
        const cost = Math.ceil((base * mult) / costDiv);
        mats[mat] = cost;
        grandTotals[mat] = (grandTotals[mat] || 0) + cost;
      }
      rows.push({ name: piece.name, quality: q.quality, mats, season: seasonLabel(season), setName: set.setName });
    }

    if (!rows.length) {
      els.totalsMount.innerHTML = '<p class="hint">No valid pieces in queue.</p>';
      return;
    }

    const sortedMats = Object.entries(grandTotals).sort((a, b) => b[1] - a[1]);
    let html = `<div class="stats-grid">`;
    for (const [mat, amt] of sortedMats) {
      html += `<div class="stat-card">
        <div class="stat-label">${matDisplayName(mat)}</div>
        <div class="stat-value">${amt.toLocaleString()}</div>
      </div>`;
    }
    html += '</div>';

    const matKeys = sortedMats.map(([k]) => k);
    html += '<table class="totals"><thead><tr><th>Piece</th><th>Set</th><th>Quality</th>';
    for (const k of matKeys) html += `<th>${matDisplayName(k)}</th>`;
    html += '</tr></thead><tbody>';

    for (const r of rows) {
      const qualLabel = QUALITIES[r.quality].charAt(0).toUpperCase() + QUALITIES[r.quality].slice(1);
      html += `<tr><td>${r.name}</td><td>${r.setName}</td><td>${qualLabel}</td>`;
      for (const k of matKeys) html += `<td>${r.mats[k] ? r.mats[k].toLocaleString() : '—'}</td>`;
      html += '</tr>';
    }

    html += `<tr class="totals-row"><th colspan="3">Total</th>`;
    for (const k of matKeys) html += `<th>${grandTotals[k].toLocaleString()}</th>`;
    html += '</tr></tbody></table>';

    els.totalsMount.innerHTML = html;
  }

  function renderQueueItems() {
    if (!state.queue.length) {
      els.queueItems.innerHTML = '<p class="hint">No pieces in queue yet.</p>';
      return;
    }

    els.queueItems.innerHTML = state.queue.map((q, idx) => {
      const season = allSeasons[q.seasonIdx];
      const sets = setsForSeason(season);
      const set = sets[q.setIdx];
      const pieces = set ? piecesAtLevel(set, q.level) : [];
      const piece = pieces.find(p => p.name === q.pieceName);
      const qualLabel = QUALITIES[q.quality].charAt(0).toUpperCase() + QUALITIES[q.quality].slice(1);

      return `<div class="queue-card" style="border:1px solid var(--border);border-radius:6px;padding:0.75rem;margin-bottom:0.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <strong>${piece ? piece.name : '(select piece)'}</strong>
          <button type="button" class="queue-remove" data-idx="${idx}" style="background:none;border:none;color:var(--blood);cursor:pointer;font-size:1.2rem;">×</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
          <div>
            <label style="font-size:0.75rem;color:var(--text-muted);">Season</label>
            <select class="val-select queue-field" data-idx="${idx}" data-field="seasonIdx">
              ${allSeasons.map((s, i) => `<option value="${i}" ${i === q.seasonIdx ? 'selected' : ''}>${seasonLabel(s)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem;color:var(--text-muted);">Set</label>
            <select class="val-select queue-field" data-idx="${idx}" data-field="setIdx">
              ${sets.map((s, i) => `<option value="${i}" ${i === q.setIdx ? 'selected' : ''}>${s.setName || 'Set ' + (i + 1)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem;color:var(--text-muted);">Level</label>
            <select class="val-select queue-field" data-idx="${idx}" data-field="level">
              ${(set ? levelsForSet(set, season) : []).map(l => `<option value="${l}" ${l === q.level ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem;color:var(--text-muted);">Piece</label>
            <select class="val-select queue-field" data-idx="${idx}" data-field="pieceName">
              <option value="">— select —</option>
              ${pieces.map(p => `<option value="${p.name}" ${p.name === q.pieceName ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>
          <div style="grid-column:1/-1;">
            <label style="font-size:0.75rem;color:var(--text-muted);">Quality</label>
            <select class="val-select queue-field" data-idx="${idx}" data-field="quality">
              ${QUALITIES.map((qn, i) => `<option value="${i}" ${i === q.quality ? 'selected' : ''}>${qn.charAt(0).toUpperCase() + qn.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>`;
    }).join('');

    els.queueItems.querySelectorAll('.queue-field').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = Number(sel.dataset.idx);
        const field = sel.dataset.field;
        const row = state.queue[idx];
        if (field === 'seasonIdx') {
          row.seasonIdx = Number(sel.value);
          row.setIdx = 0;
          const sets = setsForSeason(allSeasons[row.seasonIdx]);
          const set = sets[0];
          const lvls = set ? levelsForSet(set, allSeasons[row.seasonIdx]) : [];
          row.level = lvls[0] || 1;
          row.pieceName = '';
        } else if (field === 'setIdx') {
          row.setIdx = Number(sel.value);
          const sets = setsForSeason(allSeasons[row.seasonIdx]);
          const set = sets[row.setIdx];
          const lvls = set ? levelsForSet(set, allSeasons[row.seasonIdx]) : [];
          row.level = lvls[0] || 1;
          row.pieceName = '';
        } else if (field === 'level') {
          row.level = Number(sel.value);
          row.pieceName = '';
        } else if (field === 'pieceName') {
          row.pieceName = sel.value;
        } else if (field === 'quality') {
          row.quality = Number(sel.value);
        }
        renderQueueItems();
        renderTotals();
      });
    });

    els.queueItems.querySelectorAll('.queue-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        state.queue.splice(Number(btn.dataset.idx), 1);
        renderQueueItems();
        renderTotals();
      });
    });
  }

  function setModeUI() {
    const isLoadout = state.mode === 'loadout';
    els.loadoutPanel.classList.toggle('hidden', !isLoadout);
    els.queuePanel.classList.toggle('hidden', isLoadout);
  }

  function onSeasonChange() {
    state.seasonIdx = Number(els.seasonSelect.value);
    state.setIdx = 0;
    populateSets();
    populateLevels();
    selectAllPieces();
    renderPieceChecklist();
    renderTotals();
  }

  function onSetChange() {
    state.setIdx = Number(els.setSelect.value);
    populateLevels();
    selectAllPieces();
    renderPieceChecklist();
    renderTotals();
  }

  function onLevelChange() {
    state.level = Number(els.levelSelect.value);
    selectAllPieces();
    renderPieceChecklist();
    renderTotals();
  }

  function wireEvents() {
    els.modeGroup.forEach(opt => opt.addEventListener('click', () => {
      state.mode = opt.dataset.mode;
      els.modeGroup.forEach(o => o.classList.toggle('active', o === opt));
      setModeUI();
      renderTotals();
    }));
    els.seasonSelect.addEventListener('change', onSeasonChange);
    els.setSelect.addEventListener('change', onSetChange);
    els.levelSelect.addEventListener('change', onLevelChange);
    els.qualitySelect.addEventListener('change', () => {
      state.quality = Number(els.qualitySelect.value);
      renderTotals();
    });
    els.steelEff.addEventListener('input', () => {
      state.steelEff = Number(els.steelEff.value) || 0;
      renderTotals();
    });
    $('#queue-add').addEventListener('click', () => {
      const sets = setsForSeason(allSeasons[0]);
      const set = sets[0];
      const lvls = set ? levelsForSet(set, allSeasons[0]) : [1];
      state.queue.push({
        seasonIdx: 0,
        setIdx: 0,
        level: lvls[0] || 1,
        pieceName: '',
        quality: 4,
      });
      renderQueueItems();
      renderTotals();
    });
  }

  function init() {
    populateSeasons();
    populateSets();
    populateLevels();
    populateQualities();
    selectAllPieces();
    setModeUI();
    wireEvents();
    renderPieceChecklist();
    renderQueueItems();
    renderTotals();
  }

  init();
})();
