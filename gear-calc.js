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

  return { TIERS, QUALITIES, floorToTier };
}));
