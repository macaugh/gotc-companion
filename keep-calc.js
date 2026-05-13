(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RESOURCE_KEYS = ['wood', 'food', 'stone', 'iron', 'brick', 'pine', 'keystone', 'valyrian'];

  function zeroTotals() {
    const t = { hours: 0 };
    for (const k of RESOURCE_KEYS) t[k] = 0;
    return t;
  }

  function computeUpgradePlan(input) {
    const {
      currentKeep,
      targetKeep,
      currentBuildingLevels = {},
      bonusPctByResource = {},
      timeReductionPct = 0,
      costs = {},
      prereqs = {},
    } = input;

    const rows = [];
    const totalsBeforeBonus = zeroTotals();
    const totals = zeroTotals();

    if (targetKeep <= currentKeep) {
      return { rows, totalsBeforeBonus, totals };
    }

    const levels = Object.assign({}, currentBuildingLevels);

    function emitRow(building, fromLevel, toLevel) {
      const costsForLevel =
        costs[building] && costs[building][toLevel] ? costs[building][toLevel] : null;
      const row = {
        building,
        fromLevel,
        toLevel,
        costs: costsForLevel || zeroTotals(),
        missing: !costsForLevel,
      };
      rows.push(row);
      for (const k of RESOURCE_KEYS) totalsBeforeBonus[k] += row.costs[k] || 0;
      totalsBeforeBonus.hours += row.costs.hours || 0;
    }

    for (let k = currentKeep + 1; k <= targetKeep; k++) {
      emitRow('Keep', k - 1, k);
      const req = prereqs[k] || {};
      for (const building of Object.keys(req)) {
        const required = req[building];
        const have = levels[building] != null ? levels[building] : 0;
        for (let lvl = have + 1; lvl <= required; lvl++) {
          emitRow(building, lvl - 1, lvl);
        }
        if (required > have) levels[building] = required;
      }
    }

    for (const r of RESOURCE_KEYS) {
      const pct = Math.min(1, Math.max(0, bonusPctByResource[r] || 0));
      totals[r] = totalsBeforeBonus[r] * (1 - pct);
    }
    const tPct = Math.min(1, Math.max(0, timeReductionPct || 0));
    totals.hours = totalsBeforeBonus.hours * (1 - tPct);

    return { rows, totalsBeforeBonus, totals };
  }

  return { computeUpgradePlan, RESOURCE_KEYS };
}));
