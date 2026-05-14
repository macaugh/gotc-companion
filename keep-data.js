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
                   brick: 698, pine: 263, keystone: 87, valyrian: 0, hours: 92.883 },
             19: { wood: 26_499_000, food: 26_499_000, stone: 1_487_000, iron: 199_000,
                   brick: 1_467, pine: 552, keystone: 182, valyrian: 0, hours: 156.983 } },
  Wall:    { 16: { wood: 11_783_000, food: 0, stone: 168_000, iron: 21_000,
                   brick: 430, pine: 62, keystone: 43, valyrian: 0, hours: 47.633 },
             18: { wood: 21_475_000, food: 0, stone: 306_000, iron: 47_000,
                   brick: 903, pine: 129, keystone: 89, valyrian: 0, hours: 80.5 } },
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
  Shrine:  { 13: { wood: 754_000, food: 0, stone: 31_000, iron: 0,
                   brick: 102, pine: 42, keystone: 11, valyrian: 0, hours: 15.817 },
             14: { wood: 1_133_000, food: 0, stone: 46_000, iron: 0,
                   brick: 147, pine: 60, keystone: 15, valyrian: 0, hours: 19.767 },
             15: { wood: 1_133_000, food: 0, stone: 46_000, iron: 0,
                   brick: 213, pine: 87, keystone: 21, valyrian: 0, hours: 25.7 },
             16: { wood: 1_563_000, food: 0, stone: 65_000, iron: 22_000,
                   brick: 308, pine: 126, keystone: 30, valyrian: 0, hours: 33.417 } },
  "Maester's Tower": {
             13: { wood: 516_000, food: 0, stone: 73_000, iron: 0,
                   brick: 14, pine: 11, keystone: 11, valyrian: 0, hours: 11.167 },
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
  Smithy:  { 15: { wood: 2_077_000, food: 0, stone: 149_000, iron: 0,
                   brick: 182, pine: 43, keystone: 14, valyrian: 0, hours: 23.367 },
             16: { wood: 2_866_000, food: 0, stone: 208_000, iron: 69_000,
                   brick: 449, pine: 62, keystone: 20, valyrian: 0, hours: 30.55 },
             17: { wood: 3_956_000, food: 0, stone: 291_000, iron: 104_000,
                   brick: 381, pine: 89, keystone: 29, valyrian: 0, hours: 39.483 },
             18: { wood: 5_459_000, food: 0, stone: 407_000, iron: 156_000,
                   brick: 552, pine: 129, keystone: 42, valyrian: 0, hours: 51.333 } },
  Barracks: { 15: { wood: 2_351_000, food: 1_344_000, stone: 63_000, iron: 0,
                    brick: 213, pine: 87, keystone: 0, valyrian: 0, hours: 17.633 },
              16: { wood: 3_244_000, food: 1_814_000, stone: 86_000, iron: 78_000,
                    brick: 308, pine: 126, keystone: 0, valyrian: 0, hours: 22.933 },
              17: { wood: 4_476_000, food: 2_449_000, stone: 116_000, iron: 117_000,
                    brick: 446, pine: 182, keystone: 0, valyrian: 0, hours: 29.8 },
              18: { wood: 6_177_000, food: 3_306_000, stone: 156_000, iron: 175_000,
                    brick: 646, pine: 263, keystone: 0, valyrian: 0, hours: 38.75 } },
  "War Camp": { 15: { wood: 705_000, food: 0, stone: 37_000, iron: 0,
                      brick: 42, pine: 10, keystone: 0, valyrian: 0, hours: 8.983 },
                16: { wood: 973_000, food: 0, stone: 50_000, iron: 11_000,
                      brick: 60, pine: 14, keystone: 0, valyrian: 0, hours: 11.683 },
                17: { wood: 1_343_000, food: 0, stone: 67_000, iron: 17_000,
                      brick: 87, pine: 20, keystone: 0, valyrian: 0, hours: 15.2 },
                18: { wood: 1_853_000, food: 0, stone: 91_000, iron: 25_000,
                      brick: 126, pine: 29, keystone: 0, valyrian: 0, hours: 19.767 } },
  Mine:    { 16: { wood: 42_000, food: 0, stone: 0, iron: 0,
                   brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 64.683 },
             17: { wood: 582_000, food: 0, stone: 0, iron: 0,
                   brick: 87, pine: 0, keystone: 0, valyrian: 0, hours: 77.633 },
             18: { wood: 80_000, food: 0, stone: 0, iron: 0,
                   brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 85.383 } },
  "Stone Quarry": { 16: { wood: 34_000, food: 0, stone: 0, iron: 0,
                          brick: 60, pine: 0, keystone: 0, valyrian: 0, hours: 48.517 },
                    17: { wood: 47_000, food: 0, stone: 0, iron: 0,
                          brick: 87, pine: 0, keystone: 0, valyrian: 0, hours: 58.217 },
                    18: { wood: 64_000, food: 0, stone: 0, iron: 0,
                          brick: 126, pine: 0, keystone: 0, valyrian: 0, hours: 64.033 } },
  Storehouse: { 16: { wood: 1_635_000, food: 0, stone: 39_000, iron: 39_000,
                      brick: 308, pine: 126, keystone: 30, valyrian: 0, hours: 8.45 },
                17: { wood: 2_257_000, food: 0, stone: 53_000, iron: 59_000,
                      brick: 446, pine: 182, keystone: 43, valyrian: 0, hours: 11.0 },
                18: { wood: 3_114_000, food: 0, stone: 72_000, iron: 88_000,
                      brick: 646, pine: 263, keystone: 62, valyrian: 0, hours: 14.3 } },
};

// To upgrade KEEP to level k, each listed building must be at least the given level.
//
// Schema:
//   PREREQS[keepLevel] = { buildingName: requiredLevel, ... }
const PREREQS = {
  17: { Wall: 16, Rookery: 16, Range: 16, Sawmill: 16,
        Shrine: 16, "Maester's Tower": 16, "Medic Tent": 16 },
  19: { Wall: 18, Smithy: 18, Barracks: 18, "War Camp": 18,
        Mine: 18, "Stone Quarry": 18, Storehouse: 18 },
};

(function (root, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
}(typeof globalThis !== 'undefined' ? globalThis : this, { COSTS, PREREQS }));
