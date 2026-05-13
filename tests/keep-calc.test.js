const test = require('node:test');
const assert = require('node:assert/strict');
const { computeUpgradePlan, formatNumber, formatHours, formatResource } = require('../keep-calc.js');

// Minimal data fixtures used by these tests.
const COSTS = {};
const PREREQS = {};

test('returns empty plan with zero totals when targetKeep <= currentKeep', () => {
  const plan = computeUpgradePlan({
    currentKeep: 17,
    targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 0,
    costs: COSTS,
    prereqs: PREREQS,
  });
  assert.deepEqual(plan.rows, []);
  assert.equal(plan.totals.wood, 0);
  assert.equal(plan.totals.hours, 0);
  assert.equal(plan.totalsBeforeBonus.wood, 0);
});

test('produces a single row for one-level keep upgrade with empty prereqs', () => {
  const costs = {
    Keep: {
      17: { wood: 1000, food: 500, stone: 200, iron: 0,
            brick: 10, pine: 5, keystone: 2, valyrian: 0, hours: 24 },
    },
  };
  const prereqs = { 17: {} };

  const plan = computeUpgradePlan({
    currentKeep: 16,
    targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 0,
    costs,
    prereqs,
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
  assert.equal(plan.totals.wood, 1000);  // no bonus
});

test('emits prereq building upgrades, skipping buildings already at or above required level', () => {
  const costs = {
    Keep:    { 17: { wood: 1000, food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
    Wall:    { 15: { wood: 100,  food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 },
               16: { wood: 200,  food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
    Rookery: { 16: { wood: 50,   food: 0, stone: 0, iron: 0, brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } },
  };
  const prereqs = { 17: { Wall: 16, Rookery: 16 } };

  const plan = computeUpgradePlan({
    currentKeep: 16,
    targetKeep: 17,
    currentBuildingLevels: { Wall: 14, Rookery: 16 }, // Rookery already maxed
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 0,
    costs,
    prereqs,
  });

  // Expect: Keep 17, Wall 15, Wall 16 (Rookery skipped — already at 16)
  assert.equal(plan.rows.length, 3);
  assert.deepEqual(plan.rows.map(r => r.building + ' ' + r.toLevel),
    ['Keep 17', 'Wall 15', 'Wall 16']);
  assert.equal(plan.totalsBeforeBonus.wood, 1000 + 100 + 200);
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
    prereqs: { 17: {} },
  });
  // basic resources share 'resource' category at +2.9% → divide by 1.029
  assert.ok(Math.abs(plan.totals.wood - (1000 / 1.029)) < 0.001);
  assert.ok(Math.abs(plan.totals.food - (800 / 1.029)) < 0.001);
  // pine +50% → divide by 1.5
  assert.ok(Math.abs(plan.totals.pine - (200 / 1.5)) < 0.001);
  // keystone +100% → divide by 2.0
  assert.ok(Math.abs(plan.totals.keystone - 50) < 0.001);
  // valyrian unbonused
  assert.equal(plan.totals.valyrian, 50);
  // time: 100 / (1 + 6.52271) ≈ 13.293
  assert.ok(Math.abs(plan.totals.hours - (100 / 7.52271)) < 0.001);
});

test('flags rows with missing cost data and contributes zero', () => {
  const costs = { Keep: {} }; // no level data
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 0,
    costs, prereqs: { 17: {} },
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
    efficiencyByCategory: { resource: 1.0 },  // halves wood
    flatWoodReduction: 100_000,
    costs, prereqs: { 17: {} },
  });
  // 1,000,000 / 2 - 100,000 = 400,000
  assert.equal(plan.totals.wood, 400_000);
});

test('flat wood reduction larger than wood floors at zero', () => {
  const costs = { Keep: { 17: { wood: 500, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17, currentBuildingLevels: {},
    flatWoodReduction: 10_000,
    costs, prereqs: { 17: {} },
  });
  assert.equal(plan.totals.wood, 0);
});

test('free build time subtracts and floors at zero', () => {
  const costs = { Keep: { 17: { wood: 0, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 5 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17, currentBuildingLevels: {},
    constructionSpeedPct: 1.0,        // halves time → 2.5
    freeBuildTimeHours: 1.0,          // subtract 1 → 1.5
    costs, prereqs: { 17: {} },
  });
  assert.ok(Math.abs(plan.totals.hours - 1.5) < 0.001);

  // And once more with huge free build time → floor at zero
  const plan2 = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17, currentBuildingLevels: {},
    freeBuildTimeHours: 100,
    costs, prereqs: { 17: {} },
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
    costs, prereqs: { 17: {} },
  });
  assert.equal(plan.totals.wood, 1000);   // efficiency clamped to 0 → no change
  assert.equal(plan.totals.hours, 10);    // speed clamped to 0, free time clamped to 0
});

test('applies flat wood reduction after wood efficiency', () => {
  const costs = { Keep: { 17: { wood: 1000, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } } };

  // No efficiency, flat reduction of 250
  const plan1 = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: { resource: 0 },
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 250,
    costs, prereqs: { 17: {} },
  });
  assert.equal(plan1.totals.wood, 750);  // 1000 - 250

  // resource efficiency = 1.0 (divide by 2), then flat reduction 250
  const plan2 = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: { resource: 1.0 },
    constructionSpeedPct: 0,
    freeBuildTimeHours: 0,
    flatWoodReduction: 250,
    costs, prereqs: { 17: {} },
  });
  assert.equal(plan2.totals.wood, 250);  // 1000 / 2 - 250 = 250
});

test('applies free build time after speed divisor', () => {
  const costs = { Keep: { 17: { wood: 0, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 100 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 1.0,      // divide by 2 → 50 hours
    freeBuildTimeHours: 10,         // then subtract 10 → 40 hours
    flatWoodReduction: 0,
    costs, prereqs: { 17: {} },
  });
  assert.equal(plan.totals.hours, 40);  // 100 / 2 - 10 = 40
});

test('flat reductions floor at zero', () => {
  const costs = { Keep: { 17: { wood: 100, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 100 } } };

  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    efficiencyByCategory: {},
    constructionSpeedPct: 0,
    freeBuildTimeHours: 999,   // far exceeds hours — floors at 0
    flatWoodReduction: 999,    // far exceeds wood — floors at 0
    costs, prereqs: { 17: {} },
  });
  assert.equal(plan.totals.wood, 0);
  assert.equal(plan.totals.hours, 0);
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
