const test = require('node:test');
const assert = require('node:assert/strict');
const { computeUpgradePlan, computeMinimumLevels, formatNumber, formatHours, formatResource } = require('../keep-calc.js');

// Build a sparse requirement slot: an array with a prereq only at `targetIdx`,
// nulls elsewhere. targetIdx is the index of the step `have → have+1` where
// the prereq applies (so to gate upgrading X to L, use targetIdx = L-1).
function reqSlot(targetIdx, building, level) {
  const arr = new Array(targetIdx + 1).fill(null);
  arr[targetIdx] = { building, level };
  return arr;
}

test('returns empty plan with zero totals when targetKeep <= currentKeep', () => {
  const plan = computeUpgradePlan({
    currentKeep: 17,
    targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 0,
    costs: {},
    requirements: {},
  });
  assert.deepEqual(plan.rows, []);
  assert.equal(plan.totals.wood, 0);
  assert.equal(plan.totals.hours, 0);
  assert.equal(plan.totalsBeforeBonus.wood, 0);
});

test('produces a single row for one-level keep upgrade with no requirements', () => {
  const costs = {
    Keep: {
      17: { wood: 1000, food: 500, stone: 200, iron: 0,
            brick: 10, pine: 5, keystone: 2, valyrian: 0, hours: 24 },
    },
  };

  const plan = computeUpgradePlan({
    currentKeep: 16,
    targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 0,
    costs,
    requirements: {},
  });

  assert.equal(plan.rows.length, 1);
  assert.deepEqual(plan.rows[0], {
    building: 'Keep',
    fromLevel: 16,
    toLevel: 17,
    costs: costs.Keep[17],
    missing: false,
  });
  assert.equal(plan.totalsBeforeBonus.wood, 1000);
  assert.equal(plan.totalsBeforeBonus.hours, 24);
  assert.equal(plan.totals.wood, 1000);
});

test('resolves prereqs via REQUIREMENTS graph; deps emit before their dependent', () => {
  const costs = {
    Keep:    { 17: { wood: 1000, food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
    Wall:    { 15: { wood: 100,  food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 },
               16: { wood: 200,  food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
    Rookery: { 16: { wood: 50,   food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
  };
  // To upgrade Keep 16 → 17 (step at index 16), need Wall:16 (slot0) and Rookery:16 (slot1).
  const requirements = {
    Keep: [
      reqSlot(16, 'Wall', 16),
      reqSlot(16, 'Rookery', 16),
    ],
  };

  const plan = computeUpgradePlan({
    currentKeep: 16,
    targetKeep: 17,
    currentBuildingLevels: { Wall: 14, Rookery: 16 }, // Rookery already maxed
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 0,
    costs,
    requirements,
  });

  // DFS order: deps emit before the building that depends on them.
  // Wall 15, Wall 16, Keep 17. Rookery is skipped (already at 16).
  assert.equal(plan.rows.length, 3);
  assert.deepEqual(plan.rows.map(r => r.building + ' ' + r.toLevel),
    ['Wall 15', 'Wall 16', 'Keep 17']);
  assert.equal(plan.totalsBeforeBonus.wood, 1000 + 100 + 200);
});

test('resolves transitive prereqs recursively', () => {
  // Keep 17 needs Shrine 16, which needs Maester's Tower 16.
  // Player has nothing built (all levels default to 0).
  const costs = {
    Keep:              { 17: { wood: 100, food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
    Shrine:            { 16: { wood: 20,  food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
    "Maester's Tower": { 16: { wood: 10,  food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
  };
  const requirements = {
    Keep:              [ reqSlot(16, 'Shrine', 16) ],
    Shrine:            [ reqSlot(15, "Maester's Tower", 16) ],
    "Maester's Tower": [],
  };

  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    // Shrine starts at 15 so only the 15→16 step runs.
    // Maester's Tower starts at 15 so only the 15→16 step runs.
    currentBuildingLevels: { Shrine: 15, "Maester's Tower": 15 },
    efficiencyByCategory: {}, constructionSpeedPct: 0,
    freeBuildTimeHours: 0, flatWoodReduction: 0,
    costs, requirements,
  });

  // DFS: Maester's Tower 16 → Shrine 16 → Keep 17
  assert.equal(plan.rows.length, 3);
  assert.deepEqual(plan.rows.map(r => r.building + ' ' + r.toLevel),
    ["Maester's Tower 16", 'Shrine 16', 'Keep 17']);
  assert.equal(plan.totalsBeforeBonus.wood, 100 + 20 + 10);
});

test('applies per-category efficiency divisor and construction-speed time divisor', () => {
  const costs = {
    Keep: { 17: { wood: 1000, food: 800, stone: 0, iron: 0,
                  brick: 0, pine: 200, keystone: 100, valyrian: 50, hours: 100 } },
  };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: { resource: 0.029, pine: 0.5, keystone: 1.0, valyrian: 0 },
    constructionSpeedPct: 6.52271,
    costs,
    requirements: {},
  });
  assert.ok(Math.abs(plan.totals.wood - (1000 / 1.029)) < 0.001);
  assert.ok(Math.abs(plan.totals.food - (800 / 1.029)) < 0.001);
  assert.ok(Math.abs(plan.totals.pine - (200 / 1.5)) < 0.001);
  assert.ok(Math.abs(plan.totals.keystone - 50) < 0.001);
  assert.equal(plan.totals.valyrian, 50);
  assert.ok(Math.abs(plan.totals.hours - (100 / 7.52271)) < 0.001);
});

test('flags rows with missing cost data and contributes zero', () => {
  const costs = { Keep: {} };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 0, freeBuildTimeHours: 0, flatWoodReduction: 0,
    costs, requirements: {},
  });
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].missing, true);
  assert.equal(plan.totalsBeforeBonus.wood, 0);
});

test('applies flat wood reduction after percentage and floors at zero', () => {
  const costs = { Keep: { 17: { wood: 1_000_000, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17, currentBuildingLevels: {},
    efficiencyByCategory: { resource: 1.0 },
    flatWoodReduction: 100_000,
    costs, requirements: {},
  });
  assert.equal(plan.totals.wood, 400_000);
});

test('flat wood reduction larger than wood floors at zero', () => {
  const costs = { Keep: { 17: { wood: 500, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17, currentBuildingLevels: {},
    flatWoodReduction: 10_000,
    costs, requirements: {},
  });
  assert.equal(plan.totals.wood, 0);
});

test('free build time subtracts and floors at zero', () => {
  const costs = { Keep: { 17: { wood: 0, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 5 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17, currentBuildingLevels: {},
    constructionSpeedPct: 1.0,
    freeBuildTimeHours: 1.0,
    costs, requirements: {},
  });
  assert.ok(Math.abs(plan.totals.hours - 1.5) < 0.001);

  const plan2 = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17, currentBuildingLevels: {},
    freeBuildTimeHours: 100,
    costs, requirements: {},
  });
  assert.equal(plan2.totals.hours, 0);
});

test('negative efficiency / speed / free build time inputs are clamped at zero', () => {
  const costs = { Keep: { 17: { wood: 1000, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 10 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17, currentBuildingLevels: {},
    efficiencyByCategory: { resource: -0.5 },
    constructionSpeedPct: -1,
    freeBuildTimeHours: -5,
    flatWoodReduction: -100,
    costs, requirements: {},
  });
  assert.equal(plan.totals.wood, 1000);
  assert.equal(plan.totals.hours, 10);
});

test('applies flat wood reduction after wood efficiency', () => {
  const costs = { Keep: { 17: { wood: 1000, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } } };

  const plan1 = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: { resource: 0 },
    constructionSpeedPct: 0, freeBuildTimeHours: 0,
    flatWoodReduction: 250,
    costs, requirements: {},
  });
  assert.equal(plan1.totals.wood, 750);

  const plan2 = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: { resource: 1.0 },
    constructionSpeedPct: 0, freeBuildTimeHours: 0,
    flatWoodReduction: 250,
    costs, requirements: {},
  });
  assert.equal(plan2.totals.wood, 250);
});

test('applies free build time after speed divisor', () => {
  const costs = { Keep: { 17: { wood: 0, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 100 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 1.0,
    freeBuildTimeHours: 10,
    flatWoodReduction: 0,
    costs, requirements: {},
  });
  assert.equal(plan.totals.hours, 40);
});

test('flat reductions floor at zero', () => {
  const costs = { Keep: { 17: { wood: 100, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 100 } } };

  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 999,
    flatWoodReduction: 999,
    costs, requirements: {},
  });
  assert.equal(plan.totals.wood, 0);
  assert.equal(plan.totals.hours, 0);
});

test('computeMinimumLevels: returns transitive prereqs at their highest required level', () => {
  // Keep step 16→17 needs Wall:16 + Shrine:16 (via slot1). Shrine 16 needs MT:16
  // (Shrine's slot1[15]). MT 16 needs Medic Tent:16 (MT's slot1[15]).
  const requirements = {
    Keep: [
      reqSlot(16, 'Wall', 16),
      reqSlot(16, 'Shrine', 16),
    ],
    Shrine: [ [], reqSlot(15, "Maester's Tower", 16) ],
    "Maester's Tower": [ [], reqSlot(15, 'Medic Tent', 16) ],
  };
  const mins = computeMinimumLevels(17, requirements);
  assert.equal(mins.Wall, 16);
  assert.equal(mins.Shrine, 16);
  assert.equal(mins["Maester's Tower"], 16);
  assert.equal(mins['Medic Tent'], 16);
  assert.equal(mins.Keep, undefined); // Keep excluded from result
});

test('computeMinimumLevels: takes the highest level required across the walk', () => {
  // Keep 1→2 needs Wall:1; Keep 2→3 needs Wall:3. Final min Wall = 3.
  const requirements = {
    Keep: [
      [{ building: 'Wall', level: 1 }, { building: 'Wall', level: 3 }],
    ],
  };
  const mins = computeMinimumLevels(3, requirements);
  assert.equal(mins.Wall, 3);
});

test('formatNumber: thousands separator', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(1234567), '1,234,567');
});

test('formatResource: small values keep units, large values switch to millions with three decimals', () => {
  assert.equal(formatResource(950), '950');
  assert.equal(formatResource(1_234_567), '1.235M');
  assert.equal(formatResource(50_180_000), '50.180M');
});

test('formatHours: days/hours/minutes', () => {
  assert.equal(formatHours(0), '0m');
  assert.equal(formatHours(1.5), '1h 30m');
  assert.equal(formatHours(25), '1d 1h 0m');
  assert.equal(formatHours(503.6166), '20d 23h 37m');
});

test('end-to-end: realistic Keep 16 → 17 with APK-shaped data', () => {
  // Mirrors the APK structure: Keep:17 transitively needs Wall:16 + Shrine:16 + Maester's Tower:16 + Medic Tent:16
  const costs = {
    Keep:              { 17: { wood: 14_540_025, food: 14_540_025, stone: 758_511, iron: 77_760, brick: 698, pine: 263, keystone: 87, valyrian: 0, hours: 92.891 } },
    Wall:              { 16: { wood: 11_783_000, food: 0, stone: 168_000, iron: 21_000, brick: 430, pine: 62, keystone: 43, valyrian: 0, hours: 47.633 } },
    Shrine:            { 16: { wood:  1_563_000, food: 0, stone:  65_000, iron: 22_000, brick: 308, pine: 126, keystone: 30, valyrian: 0, hours: 33.417 } },
    "Maester's Tower": { 16: { wood:  1_256_000, food: 0, stone: 185_000, iron: 33_000, brick: 42, pine: 147, keystone: 30, valyrian: 0, hours: 23.6 } },
    "Medic Tent":      { 16: { wood:    773_000, food: 0, stone:  40_000, iron:  9_000, brick: 87, pine: 14, keystone: 0, valyrian: 0, hours: 8.467 } },
  };
  const requirements = {
    Keep:              [ reqSlot(16, 'Wall', 16), reqSlot(16, 'Shrine', 16) ],
    Wall:              [],
    Shrine:            [ reqSlot(15, "Maester's Tower", 16) ],
    "Maester's Tower": [ reqSlot(15, 'Medic Tent', 16) ],
    "Medic Tent":      [],
  };

  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {
      Wall: 15,
      Shrine: 15,
      "Maester's Tower": 15,
      "Medic Tent": 15,
    },
    efficiencyByCategory: {},
    constructionSpeedPct: 0, freeBuildTimeHours: 0, flatWoodReduction: 0,
    costs, requirements,
  });

  // 5 rows in DFS order following Keep's reqs (slot0 first, then slot1):
  // Wall 16 (slot0), then Shrine 16's transitive chain (slot1: Medic Tent → MT → Shrine), then Keep 17.
  assert.equal(plan.rows.length, 5);
  assert.deepEqual(plan.rows.map(r => r.building + ' ' + r.toLevel),
    ['Wall 16', 'Medic Tent 16', "Maester's Tower 16", 'Shrine 16', 'Keep 17']);
  // Wood total = 14_540_025 + 11_783_000 + 1_563_000 + 1_256_000 + 773_000
  assert.equal(plan.totalsBeforeBonus.wood, 14_540_025 + 11_783_000 + 1_563_000 + 1_256_000 + 773_000);
});
