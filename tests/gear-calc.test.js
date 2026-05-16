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

const { bonusesForPiece } = require('../gear-calc.js');

test('bonusesForPiece: picks the value at the chosen quality index', () => {
  const piece = { bonuses: [
    { prop: 'property_infantryattack_gear', curve: [0.014, 0.015, 0.016, 0.017, 0.018, 0.020] },
    { prop: 'property_forgingspeed_gear',   curve: [0.10,  0.12,  0.14,  0.16,  0.18,  0.20]  },
  ]};
  assert.deepEqual(bonusesForPiece(piece, 0), [
    { prop: 'property_infantryattack_gear', value: 0.014 },
    { prop: 'property_forgingspeed_gear',   value: 0.10 },
  ]);
  assert.deepEqual(bonusesForPiece(piece, 5), [
    { prop: 'property_infantryattack_gear', value: 0.020 },
    { prop: 'property_forgingspeed_gear',   value: 0.20 },
  ]);
});

test('bonusesForPiece: empty bonuses returns empty array', () => {
  assert.deepEqual(bonusesForPiece({ bonuses: [] }, 3), []);
});

const { effectiveInventoryAt, canCraft } = require('../gear-calc.js');

test('effectiveInventoryAt: exact quality stock passes through', () => {
  // inv[mat_silk] = { poor: 0, common: 0, fine: 0, exquisite: 0, epic: 100, legendary: 0 }
  const inv = { mat_silk: [0, 0, 0, 0, 100, 0] };
  assert.equal(effectiveInventoryAt(inv, 'mat_silk', 4), 100);
});

test('effectiveInventoryAt: lower quality is upgraded 4->1', () => {
  // 16 poor + 4 common -> at common: floor(16/4) + 4 = 8 common available
  const inv = { mat_silk: [16, 4, 0, 0, 0, 0] };
  assert.equal(effectiveInventoryAt(inv, 'mat_silk', 1), 8);
});

test('effectiveInventoryAt: higher quality is NOT downgraded', () => {
  // 100 legendary, asking for poor -> 0
  const inv = { mat_silk: [0, 0, 0, 0, 0, 100] };
  assert.equal(effectiveInventoryAt(inv, 'mat_silk', 0), 0);
});

test('effectiveInventoryAt: missing material returns 0', () => {
  assert.equal(effectiveInventoryAt({}, 'mat_silk', 2), 0);
});

test('effectiveInventoryAt: chained upgrades — poor through to epic', () => {
  // 4^4 = 256 poor -> 1 epic
  const inv = { mat_silk: [256, 0, 0, 0, 0, 0] };
  assert.equal(effectiveInventoryAt(inv, 'mat_silk', 4), 1);
  // 255 poor -> 0 epic
  const inv2 = { mat_silk: [255, 0, 0, 0, 0, 0] };
  assert.equal(effectiveInventoryAt(inv2, 'mat_silk', 4), 0);
});

test('canCraft: returns ok=true when all materials satisfied', () => {
  const piece = { recipe: { ingredients: [{ mat: 'mat_silk', amount: 10 }] }, slot: 's', tier: 1 };
  const row = { id: 'r', slot: 's', tier: 1, quality: 1, time_sec: 0,
                materials: { mat_silk: 10 } };
  const inv = { mat_silk: [0, 10, 0, 0, 0, 0] };
  const out = canCraft(row, inv);
  assert.equal(out.ok, true);
  assert.deepEqual(out.shortfalls, []);
});

test('canCraft: reports specific shortfalls', () => {
  const row = { id: 'r', slot: 's', tier: 1, quality: 1, time_sec: 0,
                materials: { mat_silk: 10, mat_hide: 5 } };
  const inv = { mat_silk: [0, 3, 0, 0, 0, 0], mat_hide: [0, 5, 0, 0, 0, 0] };
  const out = canCraft(row, inv);
  assert.equal(out.ok, false);
  assert.deepEqual(out.shortfalls, [{ mat: 'mat_silk', quality: 1, need: 10, have: 3 }]);
});
