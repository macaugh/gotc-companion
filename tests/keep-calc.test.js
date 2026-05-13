const test = require('node:test');
const assert = require('node:assert/strict');
const { computeUpgradePlan } = require('../keep-calc.js');

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
