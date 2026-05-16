const test = require('node:test');
const assert = require('node:assert/strict');
const { floorToTier } = require('../gear-calc.js');

test('floorToTier: exact tier values pass through', () => {
  assert.equal(floorToTier(1), 1);
  assert.equal(floorToTier(5), 5);
  assert.equal(floorToTier(30), 30);
  assert.equal(floorToTier(45), 45);
});

test('floorToTier: values between tiers floor down', () => {
  assert.equal(floorToTier(34), 30);
  assert.equal(floorToTier(4), 1);
  assert.equal(floorToTier(44), 40);
});

test('floorToTier: values above 45 return 45', () => {
  assert.equal(floorToTier(50), 45);
});

test('floorToTier: values below 1 return null', () => {
  assert.equal(floorToTier(0), null);
});

const { computeTotals } = require('../gear-calc.js');

const samplePiece = {
  slot: 'slot_Helmet',
  tier: 30,
  recipe: {
    value: 18400000,
    time_sec: 64800,
    ingredients: [
      { mat: 'mat_silk', amount: 16000 },
      { mat: 'mat_leatherstrap', amount: 16000 },
    ],
  },
  bonuses: [],
};

test('computeTotals: no efficiency, single piece', () => {
  const out = computeTotals({
    selection: [{ id: 'h1', piece: samplePiece, quality: 4 }],
    steelCraftEff: 0,
    forgeTimeEff: 0,
  });
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].time_sec, 64800);
  assert.deepEqual(out.rows[0].materials, {
    mat_silk: 16000,
    mat_leatherstrap: 16000,
  });
  assert.equal(out.totals.time_sec, 64800);
  assert.deepEqual(out.totals.materials, {
    mat_silk: 16000,
    mat_leatherstrap: 16000,
  });
});

test('computeTotals: steel-craft efficiency uses divisor model with per-row ceil', () => {
  // 16000 / (1 + 0.5) = 10666.66... -> ceil -> 10667
  const out = computeTotals({
    selection: [{ id: 'h1', piece: samplePiece, quality: 4 }],
    steelCraftEff: 0.5,
    forgeTimeEff: 0,
  });
  assert.equal(out.rows[0].materials.mat_silk, 10667);
  assert.equal(out.totals.materials.mat_silk, 10667);
});

test('computeTotals: forge-time efficiency uses divisor model', () => {
  const out = computeTotals({
    selection: [{ id: 'h1', piece: samplePiece, quality: 4 }],
    steelCraftEff: 0,
    forgeTimeEff: 1.0,
  });
  assert.equal(out.rows[0].time_sec, 32400);
  assert.equal(out.totals.time_sec, 32400);
});

test('computeTotals: totals sum per-row rounded values, not pre-rounded base', () => {
  // Two identical rows at +50% steel-craft eff: each row ceils to 10667.
  // Totals must be 10667 + 10667 = 21334 (NOT 21333 from rounding 16000*2/1.5).
  const out = computeTotals({
    selection: [
      { id: 'a', piece: samplePiece, quality: 4 },
      { id: 'b', piece: samplePiece, quality: 4 },
    ],
    steelCraftEff: 0.5,
    forgeTimeEff: 0,
  });
  assert.equal(out.totals.materials.mat_silk, 21334);
});
