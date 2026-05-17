(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TIERS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45];
  const QUALITIES = ['poor','common','fine','exquisite','epic','legendary'];

  function floorToTier(houseLvl) {
    if (typeof houseLvl !== 'number' || houseLvl < 1) return null;
    let max = null;
    for (const t of TIERS) if (t <= houseLvl) max = t;
    return max;
  }

  function computeTotals({ selection, steelCraftEff = 0, forgeTimeEff = 0 }) {
    const costDiv = 1 + steelCraftEff;
    const timeDiv = 1 + forgeTimeEff;
    const rows = [];
    const totals = { time_sec: 0, materials: {} };

    for (const sel of selection) {
      const { id, piece, quality } = sel;
      const time_sec = piece.recipe.time_sec / timeDiv;
      const materials = {};
      for (const ing of piece.recipe.ingredients) {
        materials[ing.mat] = Math.ceil(ing.amount / costDiv);
      }
      rows.push({ id, slot: piece.slot, tier: piece.tier, quality, time_sec, materials });

      totals.time_sec += time_sec;
      for (const [mat, amt] of Object.entries(materials)) {
        totals.materials[mat] = (totals.materials[mat] || 0) + amt;
      }
    }

    return { rows, totals };
  }

  function bonusesForPiece(piece, qualityIndex) {
    if (!piece || !Array.isArray(piece.bonuses)) return [];
    return piece.bonuses.map(b => ({ prop: b.prop, value: b.curve ? b.curve[qualityIndex] : undefined }));
  }

  function effectiveInventoryAt(inventory, mat, qualityIndex) {
    const row = inventory && inventory[mat];
    if (!row) return 0;
    let total = 0;
    for (let q = 0; q <= qualityIndex; q++) {
      const amt = row[q] || 0;
      const factor = Math.pow(4, qualityIndex - q);
      total += Math.floor(amt / factor);
    }
    return total;
  }

  function canCraft(row, inventory) {
    const shortfalls = [];
    for (const [mat, need] of Object.entries(row.materials)) {
      const have = effectiveInventoryAt(inventory, mat, row.quality);
      if (have < need) shortfalls.push({ mat, quality: row.quality, need, have });
    }
    return { ok: shortfalls.length === 0, shortfalls };
  }

  // Deduct `need` units at exactly quality `q` from inventory, consuming
  // lower-quality stock first (upgrading 4->1 as needed). Returns a NEW inv
  // object. Caller must check feasibility via canCraft beforehand if it cares.
  function deductOneMaterial(inv, mat, q, need) {
    const row = (inv[mat] || [0,0,0,0,0,0]).slice();
    let remainingAtQ = need;
    for (let qi = 0; qi <= q && remainingAtQ > 0; qi++) {
      const factor = Math.pow(4, q - qi);
      const stockAtQ = Math.floor(row[qi] / factor);
      const consumeAtQ = Math.min(stockAtQ, remainingAtQ);
      row[qi] -= consumeAtQ * factor;
      remainingAtQ -= consumeAtQ;
    }
    // Invariant: row[qi] stays >= 0 (consumeAtQ * factor <= row[qi] by construction).
    return { ...inv, [mat]: row };
  }

  function buildSequence(rows, inventory) {
    let inv = { ...inventory };
    // Deep-copy each material row.
    for (const m of Object.keys(inv)) inv[m] = (inv[m] || [0,0,0,0,0,0]).slice();
    const out = [];
    for (const row of rows) {
      const check = canCraft(row, inv);
      if (!check.ok) {
        out.push({ ...row, ok: false, shortfalls: check.shortfalls, remaining: inv });
        continue;
      }
      for (const [mat, need] of Object.entries(row.materials)) {
        inv = deductOneMaterial(inv, mat, row.quality, need);
      }
      out.push({ ...row, ok: true, shortfalls: [], remaining: inv });
    }
    return out;
  }

  return { TIERS, QUALITIES, floorToTier, computeTotals, bonusesForPiece, effectiveInventoryAt, canCraft, buildSequence };
}));
