(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RESOURCE_KEYS = ['wood', 'food', 'stone', 'iron', 'brick', 'pine', 'keystone', 'valyrian'];

  const RESOURCE_TO_CATEGORY = {
    wood: 'resource', food: 'resource', stone: 'resource',
    iron: 'resource', brick: 'resource',
    pine: 'pine', keystone: 'keystone', valyrian: 'valyrian',
  };

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
      efficiencyByCategory = {},
      constructionSpeedPct = 0,
      freeBuildTimeHours = 0,
      flatWoodReduction = 0,
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

    // Apply efficiency divisors per resource category
    for (const r of RESOURCE_KEYS) {
      const category = RESOURCE_TO_CATEGORY[r];
      const eff = Math.max(0, efficiencyByCategory[category] || 0);
      totals[r] = totalsBeforeBonus[r] / (1 + eff);
    }

    // Apply flat wood reduction after wood efficiency divisor, floor at zero
    const flatWood = Math.max(0, flatWoodReduction || 0);
    totals.wood = Math.max(0, totals.wood - flatWood);

    // Apply construction speed divisor, then subtract free build time, floor at zero
    const speed = Math.max(0, constructionSpeedPct || 0);
    const freeHours = Math.max(0, freeBuildTimeHours || 0);
    totals.hours = Math.max(0, totalsBeforeBonus.hours / (1 + speed) - freeHours);

    return { rows, totalsBeforeBonus, totals };
  }

  function formatNumber(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  function formatResource(n) {
    if (n < 1_000_000) return formatNumber(n);
    return (n / 1_000_000).toFixed(3) + 'M';
  }

  function formatHours(hoursFloat) {
    const totalMinutes = Math.round(hoursFloat * 60);
    if (totalMinutes <= 0) return '0m';
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  return { computeUpgradePlan, RESOURCE_KEYS, RESOURCE_TO_CATEGORY, formatNumber, formatResource, formatHours };
}));
