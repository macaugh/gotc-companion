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

    // Implementation grows in later tasks.
    return { rows, totalsBeforeBonus, totals };
  }

  return { computeUpgradePlan, RESOURCE_KEYS };
}));
