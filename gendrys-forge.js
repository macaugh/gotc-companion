(function () {
  const { GEAR, MATERIALS, SLOTS, TIERS, QUALITIES } = window;
  const { floorToTier, computeTotals, bonusesForPiece, canCraft, buildSequence } = window;

  // Index pieces by slot for fast picker rendering.
  const piecesBySlot = {};
  for (const [id, p] of Object.entries(GEAR)) {
    if (!piecesBySlot[p.slot]) piecesBySlot[p.slot] = [];
    piecesBySlot[p.slot].push({ id, ...p });
  }
  for (const s of Object.keys(piecesBySlot)) {
    piecesBySlot[s].sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  }

  // State
  const state = {
    houseLevel: 34,
    mode: 'loadout',
    targetTier: 30,
    targetQuality: 4, // epic
    loadout: {},      // slot -> piece id
    queue: [],        // queue mode handled in Task 9
    steelCraftEff: 0, // stored as fraction (0.5 = 50%)
    forgeTimeEff: 0,
    inventory: {},    // mat -> [poor..legendary]
  };

  const $ = (sel) => document.querySelector(sel);
  const els = {
    houseLevel: $('#house-level'),
    maxTier:    $('#max-tier'),
    modeRadios: document.querySelectorAll('input[name=mode]'),
    targetTier: $('#target-tier'),
    targetQuality: $('#target-quality'),
    slotPickers: $('#slot-pickers'),
    loadoutPanel: $('#loadout-panel'),
    loadoutHeading: $('#loadout-heading'),
    queuePanel:   $('#queue-panel'),
    queueHeading: $('#queue-heading'),
    steelEff: $('#steel-eff'),
    forgeEff: $('#forge-eff'),
    totalsMount: $('#totals-mount'),
    sequenceMount: $('#sequence-mount'),
    inventoryGrid: $('#inventory-grid'),
  };

  function populateTierAndQuality() {
    els.targetTier.innerHTML = TIERS.map(t => `<option value="${t}">${t}</option>`).join('');
    els.targetTier.value = state.targetTier;
    els.targetQuality.innerHTML = QUALITIES
      .map((q, i) => `<option value="${i}">${q}</option>`).join('');
    els.targetQuality.value = state.targetQuality;
  }

  function renderSlotPickers() {
    const maxTier = floorToTier(state.houseLevel) || 1;
    const tier = Math.min(state.targetTier, maxTier);
    state.targetTier = tier;
    els.targetTier.value = tier;

    const html = Object.entries(SLOTS).map(([slotId, label]) => {
      const opts = (piecesBySlot[slotId] || [])
        .filter(p => p.tier === tier)
        .map(p => `<option value="${p.id}">${p.id}</option>`)
        .join('');
      return `<div class="row"><label>${label}</label>
        <select class="val-select" data-slot="${slotId}">
          <option value="">— none —</option>${opts}
        </select></div>`;
    }).join('');
    els.slotPickers.innerHTML = html;

    // Re-apply existing selections.
    for (const [slotId, pieceId] of Object.entries(state.loadout)) {
      const sel = els.slotPickers.querySelector(`select[data-slot="${slotId}"]`);
      if (sel) sel.value = pieceId;
    }
    els.slotPickers.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', () => {
        state.loadout[sel.dataset.slot] = sel.value || undefined;
        if (!sel.value) delete state.loadout[sel.dataset.slot];
        render();
      });
    });
  }

  function currentSelection() {
    if (state.mode === 'queue') {
      return state.queue
        .filter(q => q.pieceId && GEAR[q.pieceId])
        .map(q => ({ id: q.pieceId + ':' + q.quality, piece: GEAR[q.pieceId], quality: q.quality }));
    }
    return Object.entries(state.loadout)
      .filter(([, id]) => id && GEAR[id])
      .map(([slot, id]) => ({ id: slot, piece: GEAR[id], quality: state.targetQuality }));
  }

  function render() {
    els.maxTier.textContent = floorToTier(state.houseLevel) || '—';
    renderTotals();
    renderSequence();
    renderInventoryGrid();
  }

  function renderTotals() {
    const selection = currentSelection();
    if (!selection.length) {
      els.totalsMount.innerHTML = '<p class="hint">Select gear to see totals.</p>';
      return;
    }
    const { rows, totals } = computeTotals({
      selection,
      steelCraftEff: state.steelCraftEff,
      forgeTimeEff: state.forgeTimeEff,
    });

    const mats = Object.keys(totals.materials).sort();
    let html = '<table class="totals"><thead><tr><th>Piece</th><th>Tier</th><th>Quality</th><th>Time (h)</th>';
    for (const m of mats) html += `<th>${MATERIALS[m] || m}</th>`;
    html += '<th>Bonuses</th></tr></thead><tbody>';
    for (const r of rows) {
      const piece = selection.find(s => s.id === r.id).piece;
      const bonusList = bonusesForPiece(piece, r.quality)
        .map(b => `<li>${b.prop}: ${(b.value * 100).toFixed(2)}%</li>`).join('');
      html += `<tr><td>${r.id}</td><td>${r.tier}</td><td>${QUALITIES[r.quality]}</td>` +
              `<td>${(r.time_sec / 3600).toFixed(2)}</td>`;
      for (const m of mats) html += `<td>${(r.materials[m] || 0).toLocaleString()}</td>`;
      html += `<td><details><summary>${piece.bonuses.length} props</summary><ul>${bonusList}</ul></details></td></tr>`;
    }
    html += `<tr class="totals-row"><th colspan="3">Totals</th><th>${(totals.time_sec/3600).toFixed(2)}</th>`;
    for (const m of mats) html += `<th>${totals.materials[m].toLocaleString()}</th>`;
    html += '<th></th></tr></tbody></table>';

    const seq = buildSequence(rows, state.inventory);
    const allOk = seq.every(s => s.ok);
    if (allOk) html += '<p class="ok">Craftable now ✓</p>';
    else {
      const firstFail = seq.find(s => !s.ok);
      const sf = firstFail.shortfalls[0];
      html += `<p class="bad">Not craftable: need ${sf.need - sf.have} more ${MATERIALS[sf.mat] || sf.mat} @ ${QUALITIES[sf.quality]} for "${firstFail.id}"</p>`;
    }

    els.totalsMount.innerHTML = html;
  }

  function renderSequence() {
    const selection = currentSelection();
    if (!selection.length) { els.sequenceMount.innerHTML = ''; return; }
    const { rows } = computeTotals({
      selection,
      steelCraftEff: state.steelCraftEff,
      forgeTimeEff: state.forgeTimeEff,
    });
    const seq = buildSequence(rows, state.inventory);
    let html = '<ol class="sequence">';
    for (const s of seq) {
      const status = s.ok ? '✓' : '✗';
      const detail = s.ok ? '' :
        ` (need ${s.shortfalls[0].need - s.shortfalls[0].have} more ${MATERIALS[s.shortfalls[0].mat] || s.shortfalls[0].mat} @ ${QUALITIES[s.shortfalls[0].quality]})`;
      html += `<li>${status} ${s.id} — ${QUALITIES[s.quality]}${detail}</li>`;
    }
    html += '</ol>';
    els.sequenceMount.innerHTML = html;
  }

  function renderInventoryGrid() {
    const selection = currentSelection();
    const mats = new Set();
    for (const sel of selection) for (const ing of sel.piece.recipe.ingredients) mats.add(ing.mat);
    if (mats.size === 0) {
      els.inventoryGrid.innerHTML = '<p class="hint">No materials yet.</p>';
      return;
    }

    const header = '<tr><th>Material</th>' + QUALITIES.map(q => `<th>${q}</th>`).join('') + '</tr>';
    const body = [...mats].sort().map(m => {
      const row = state.inventory[m] || [0,0,0,0,0,0];
      return `<tr><td>${MATERIALS[m] || m}</td>` +
        row.map((v, q) =>
          `<td><input type="number" min="0" class="val-input" data-mat="${m}" data-q="${q}" value="${v}" /></td>`
        ).join('') + '</tr>';
    }).join('');
    els.inventoryGrid.innerHTML = `<table class="inventory">${header}${body}</table>`;

    els.inventoryGrid.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const m = inp.dataset.mat, q = Number(inp.dataset.q);
        if (!state.inventory[m]) state.inventory[m] = [0,0,0,0,0,0];
        state.inventory[m][q] = Math.max(0, Number(inp.value) || 0);
        renderTotals();
        renderSequence();
      });
    });
  }

  function renderQueueTable() {
    const tbody = document.querySelector('#queue-table tbody');
    const maxTier = floorToTier(state.houseLevel) || 1;
    const availableTiers = TIERS.filter(t => t <= maxTier);
    tbody.innerHTML = state.queue.map((q, idx) => {
      const slotOpts = Object.entries(SLOTS)
        .map(([id, label]) => `<option value="${id}" ${q.slot === id ? 'selected' : ''}>${label}</option>`).join('');
      const tierOpts = availableTiers
        .map(t => `<option value="${t}" ${q.tier === t ? 'selected' : ''}>${t}</option>`).join('');
      const pieceOpts = (piecesBySlot[q.slot] || [])
        .filter(p => p.tier === q.tier)
        .map(p => `<option value="${p.id}" ${q.pieceId === p.id ? 'selected' : ''}>${p.id}</option>`).join('');
      const qualOpts = QUALITIES
        .map((qn, i) => `<option value="${i}" ${q.quality === i ? 'selected' : ''}>${qn}</option>`).join('');
      return `<tr data-idx="${idx}">
        <td><select class="val-select" data-field="slot">${slotOpts}</select></td>
        <td><select class="val-select" data-field="tier">${tierOpts}</select></td>
        <td><select class="val-select" data-field="pieceId"><option value="">—</option>${pieceOpts}</select></td>
        <td><select class="val-select" data-field="quality">${qualOpts}</select></td>
        <td><button type="button" data-field="remove">×</button></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('select, button').forEach(el => {
      el.addEventListener('change', onQueueRowEvent);
      el.addEventListener('click', onQueueRowEvent);
    });
  }

  function onQueueRowEvent(e) {
    const tr = e.target.closest('tr');
    const idx = Number(tr.dataset.idx);
    const field = e.target.dataset.field;
    const row = state.queue[idx];
    if (field === 'remove') {
      state.queue.splice(idx, 1);
    } else if (field === 'tier' || field === 'slot') {
      row[field] = field === 'tier' ? Number(e.target.value) : e.target.value;
      row.pieceId = ''; // reset piece when slot/tier changes
    } else if (field === 'quality') {
      row.quality = Number(e.target.value);
    } else if (field === 'pieceId') {
      row.pieceId = e.target.value;
    }
    renderQueueTable();
    render();
  }

  function setModeUI() {
    const isLoadout = state.mode === 'loadout';
    els.loadoutPanel.classList.toggle('hidden', !isLoadout);
    els.loadoutHeading.classList.toggle('hidden', !isLoadout);
    els.queuePanel.classList.toggle('hidden', isLoadout);
    els.queueHeading.classList.toggle('hidden', isLoadout);
  }

  function wireEvents() {
    els.houseLevel.addEventListener('input', () => {
      state.houseLevel = Number(els.houseLevel.value) || 1;
      renderSlotPickers();
      renderQueueTable();
      render();
    });
    els.modeRadios.forEach(r => r.addEventListener('change', () => {
      state.mode = document.querySelector('input[name=mode]:checked').value;
      setModeUI();
      render();
    }));
    els.targetTier.addEventListener('change', () => {
      state.targetTier = Number(els.targetTier.value);
      state.loadout = {};
      renderSlotPickers();
      render();
    });
    els.targetQuality.addEventListener('change', () => {
      state.targetQuality = Number(els.targetQuality.value);
      render();
    });
    els.steelEff.addEventListener('input', () => {
      state.steelCraftEff = (Number(els.steelEff.value) || 0) / 100;
      render();
    });
    els.forgeEff.addEventListener('input', () => {
      state.forgeTimeEff = (Number(els.forgeEff.value) || 0) / 100;
      render();
    });
    document.querySelector('#queue-add').addEventListener('click', () => {
      const maxTier = floorToTier(state.houseLevel) || 1;
      const firstSlot = Object.keys(SLOTS)[0];
      state.queue.push({ slot: firstSlot, tier: maxTier, pieceId: '', quality: 4 });
      renderQueueTable();
      render();
    });
  }

  function init() {
    populateTierAndQuality();
    setModeUI();
    renderSlotPickers();
    wireEvents();
    renderQueueTable();
    render();
  }
  init();
})();
