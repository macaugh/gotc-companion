// Cost to upgrade each building TO a given level.
// Resource values are RAW units (not millions). The formatter handles display.
// hours is decimal hours (e.g. 1d 8h 20m = 32.333...).
//
// Schema:
//   COSTS[buildingName][level] = {
//     wood, food, stone, iron, brick, pine, keystone, valyrian, hours
//   }
//
// Missing entries are tolerated — computeUpgradePlan flags them with missing:true.
const COSTS = {
  // Populated incrementally from in-game chart screenshots.
};

// To upgrade KEEP to level k, each listed building must be at least the given level.
//
// Schema:
//   PREREQS[keepLevel] = { buildingName: requiredLevel, ... }
const PREREQS = {
  // Populated incrementally from in-game chart screenshots.
};

(function (root, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
}(typeof globalThis !== 'undefined' ? globalThis : this, { COSTS, PREREQS }));
