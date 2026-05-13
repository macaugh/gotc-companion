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
  Keep:    { 17: { wood: 14_540_000, food: 14_540_000, stone: 759_000, iron: 78_000,
                   brick: 698, pine: 263, keystone: 87, valyrian: 0, hours: 92.883 } },
  Wall:    { 16: { wood: 11_783_000, food: 0, stone: 168_000, iron: 21_000,
                   brick: 430, pine: 62, keystone: 43, valyrian: 0, hours: 47.633 } },
  Rookery: { 14: { wood: 1_430_000, food: 0, stone: 119_000, iron: 0,
                   brick: 147, pine: 60, keystone: 15, valyrian: 0, hours: 10.4 },
             15: { wood: 2_861_000, food: 0, stone: 239_000, iron: 0,
                   brick: 360, pine: 147, keystone: 36, valyrian: 0, hours: 23.917 },
             16: { wood: 1_974_000, food: 0, stone: 167_000, iron: 56_000,
                   brick: 308, pine: 126, keystone: 30, valyrian: 0, hours: 17.583 } },
  Range:   { 14: { wood: 1_781_000, food: 1_018_000, stone: 116_000, iron: 0,
                   brick: 147, pine: 60, keystone: 0, valyrian: 0, hours: 13.567 },
             15: { wood: 2_351_000, food: 1_344_000, stone: 147_000, iron: 0,
                   brick: 213, pine: 87, keystone: 0, valyrian: 0, hours: 17.633 },
             16: { wood: 3_244_000, food: 1_814_000, stone: 199_000, iron: 78_000,
                   brick: 308, pine: 126, keystone: 0, valyrian: 0, hours: 22.933 } },
  Sawmill: { 14: { wood: 0, food: 12_000, stone: 0, iron: 0,
                   brick: 10, pine: 0, keystone: 0, valyrian: 0, hours: 22.45 },
             15: { wood: 0, food: 15_000, stone: 0, iron: 0,
                   brick: 14, pine: 0, keystone: 0, valyrian: 0, hours: 2.95 },
             16: { wood: 0, food: 21_000, stone: 0, iron: 0,
                   brick: 20, pine: 0, keystone: 0, valyrian: 0, hours: 32.333 } },
  Shrine:  { 14: { wood: 1_133_000, food: 0, stone: 46_000, iron: 0,
                   brick: 147, pine: 60, keystone: 15, valyrian: 0, hours: 19.767 },
             15: { wood: 1_133_000, food: 0, stone: 46_000, iron: 0,
                   brick: 213, pine: 87, keystone: 21, valyrian: 0, hours: 25.7 },
             16: { wood: 1_563_000, food: 0, stone: 65_000, iron: 22_000,
                   brick: 308, pine: 126, keystone: 30, valyrian: 0, hours: 33.417 } },
  "Maester's Tower": {
             14: { wood: 776_000, food: 0, stone: 110_000, iron: 0,
                   brick: 20, pine: 15, keystone: 15, valyrian: 0, hours: 13.95 },
             15: { wood: 930_000, food: 0, stone: 132_000, iron: 0,
                   brick: 29, pine: 102, keystone: 21, valyrian: 0, hours: 15.15 },
             16: { wood: 1_256_000, food: 0, stone: 185_000, iron: 33_000,
                   brick: 42, pine: 147, keystone: 30, valyrian: 0, hours: 23.6 } },
  "Medic Tent": {
             13: { wood: 329_000, food: 0, stone: 17_000, iron: 0,
                   brick: 29, pine: 5, keystone: 0, valyrian: 0, hours: 4.0 },
             14: { wood: 493_000, food: 0, stone: 26_000, iron: 0,
                   brick: 42, pine: 7, keystone: 0, valyrian: 0, hours: 5.017 },
             15: { wood: 560_000, food: 0, stone: 29_000, iron: 0,
                   brick: 60, pine: 10, keystone: 0, valyrian: 0, hours: 6.517 },
             16: { wood: 773_000, food: 0, stone: 40_000, iron: 9_000,
                   brick: 87, pine: 14, keystone: 0, valyrian: 0, hours: 8.467 } },
};

// To upgrade KEEP to level k, each listed building must be at least the given level.
//
// Schema:
//   PREREQS[keepLevel] = { buildingName: requiredLevel, ... }
const PREREQS = {
  17: { Wall: 16, Rookery: 16, Range: 16, Sawmill: 16,
        Shrine: 16, "Maester's Tower": 16, "Medic Tent": 16 },
};

(function (root, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
}(typeof globalThis !== 'undefined' ? globalThis : this, { COSTS, PREREQS }));
