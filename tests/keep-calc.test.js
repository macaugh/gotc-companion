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
    bonusPctByResource: {},
    timeReductionPct: 0,
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
    bonusPctByResource: {},
    timeReductionPct: 0,
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
    bonusPctByResource: {},
    timeReductionPct: 0,
    costs,
    prereqs,
  });

  // Expect: Keep 17, Wall 15, Wall 16 (Rookery skipped — already at 16)
  assert.equal(plan.rows.length, 3);
  assert.deepEqual(plan.rows.map(r => r.building + ' ' + r.toLevel),
    ['Keep 17', 'Wall 15', 'Wall 16']);
  assert.equal(plan.totalsBeforeBonus.wood, 1000 + 100 + 200);
});

test('applies per-resource bonus and time reduction', () => {
  const costs = {
    Keep: { 17: { wood: 1000, food: 800, stone: 0, iron: 0,
                  brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 100 } },
  };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    bonusPctByResource: { wood: 0.5, food: 0.25 },
    timeReductionPct: 0.10,
    costs,
    prereqs: { 17: {} },
  });
  assert.equal(plan.totalsBeforeBonus.wood, 1000);
  assert.equal(plan.totals.wood, 500);
  assert.equal(plan.totals.food, 600);
  assert.equal(plan.totals.hours, 90);
});

test('flags rows with missing cost data and contributes zero', () => {
  const costs = { Keep: {} }; // no level data
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {}, bonusPctByResource: {}, timeReductionPct: 0,
    costs, prereqs: { 17: {} },
  });
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].missing, true);
  assert.equal(plan.totalsBeforeBonus.wood, 0);
});

test('clamps bonus inputs outside 0..1', () => {
  const costs = { Keep: { 17: { wood: 1000, food: 0, stone: 0, iron: 0,
                                brick: 0, pine: 0, keystone: 0, valyrian: 0, hours: 0 } } };
  const plan = computeUpgradePlan({
    currentKeep: 16, targetKeep: 17,
    currentBuildingLevels: {},
    bonusPctByResource: { wood: 1.5 }, // 150% clamps to 100% → totals.wood = 0
    timeReductionPct: -0.2,            // negative clamps to 0
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
