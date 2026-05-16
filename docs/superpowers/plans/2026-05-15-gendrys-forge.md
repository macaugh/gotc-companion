# Gendry's Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of "Gendry's Forge" — a vanilla-JS calculator page on the Laughing Cr0w's Companion site that plans Lords-gear crafting cost + craft time at a chosen quality, with material-inventory awareness.

**Architecture:** Mirror the existing two calculators. Plain HTML/CSS/JS, no build step. Pure engine in `gear-calc.js` (UMD-style, works in Node and browser). DOM wiring in `gendrys-forge.js`. Data extracted from `gear-calc/*.csv` to `gear-data.generated.js` via a Node script. Node `--test` suite for the engine. State encoded into URL params for shareable presets.

**Tech Stack:** Vanilla HTML/CSS/JS · Node 18+ built-ins (`node:test`, `node:fs`) · No npm dependencies.

**Spec:** `docs/superpowers/specs/2026-05-15-gendrys-forge-design.md`

---

## File Structure

```
gendrys-forge.html              — page markup (new)
gendrys-forge.js                — DOM wiring + URL params (new)
gear-calc.js                    — pure engine (new, UMD pattern matching keep-calc.js)
gear-data.generated.js          — generated data (new, do not hand-edit)
scripts/build-gear-data.mjs     — Node ESM build script (new)
tests/gear-calc.test.js         — Node --test engine suite (new)
index.html                      — modify nav strip
keep-upgrade.html               — modify nav strip
styles.css                      — minor additions for new page elements
README.md                       — add Gendry's Forge section
```

---

## Task 1: Data build script — extract Lords gear into `gear-data.generated.js`

**Files:**
- Create: `scripts/build-gear-data.mjs`
- Create (generated output): `gear-data.generated.js`

The script reads the CSVs in `gear-calc/`, joins them, and emits a JS module
with `TIERS`, `QUALITIES`, `SLOTS`, `MATERIALS`, and `GEAR` (Lords-only).

- [ ] **Step 1: Create the script file**

Create `scripts/build-gear-data.mjs`:

```js
#!/usr/bin/env node
// Reads gear-calc/*.csv and emits gear-data.generated.js.
// Filtered to kind == "standard" (Lords gear) for v1.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC  = resolve(ROOT, 'gear-calc');
const OUT  = resolve(ROOT, 'gear-data.generated.js');

const TIERS     = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45];
const QUALITIES = ['poor','common','fine','exquisite','epic','legendary'];

// Minimal CSV parser supporting RFC-4180-style quoted fields.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; i++; continue;
    }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter(r => r.length === header.length)
    .map(r => Object.fromEntries(header.map((h, j) => [h, r[j]])));
}

function readCSV(name) {
  return parseCSV(readFileSync(resolve(SRC, name), 'utf8'));
}

function main() {
  const gear     = readCSV('gear.csv').filter(g => g.kind === 'standard');
  const recipes  = readCSV('recipes_summary.csv');
  const bonuses  = readCSV('gear_bonuses.csv');
  const slotsCsv = readCSV('equipment_slots.csv');
  const itemsCsv = readCSV('items.csv');

  const recipeByHash = new Map();
  for (const r of recipes) recipeByHash.set(r.gear_hash, r);

  const bonusesByHash = new Map();
  for (const b of bonuses) {
    if (!bonusesByHash.has(b.gear_hash)) bonusesByHash.set(b.gear_hash, []);
    let curve;
    try { curve = JSON.parse(b.curve_json); } catch { continue; }
    if (!Array.isArray(curve) || curve.length !== 6) continue;
    bonusesByHash.get(b.gear_hash).push({ prop: b.property_name, curve });
  }

  const SLOTS = {};
  const usedSlotIds = new Set(gear.map(g => g.slot));
  for (const s of slotsCsv) {
    if (usedSlotIds.has(s.id_name)) SLOTS[s.id_name] = s.name_key || s.id_name;
  }

  const MATERIALS = {};
  const GEAR = {};
  for (const g of gear) {
    const r = recipeByHash.get(g.hash);
    if (!r) continue;
    if (!r.tier || !r.time_sec) continue;
    let ingredients;
    try { ingredients = JSON.parse(r.ingredients_json); } catch { continue; }
    if (!Array.isArray(ingredients) || ingredients.length === 0) continue;

    const tier = Number(r.tier);
    if (!TIERS.includes(tier)) continue;

    GEAR[g.id_name] = {
      slot: g.slot,
      tier,
      recipe: {
        value: Number(r.value) || 0,
        time_sec: Number(r.time_sec),
        ingredients: ingredients.map(it => ({ mat: it.name, amount: Number(it.amount) })),
      },
      bonuses: bonusesByHash.get(g.hash) || [],
    };
    for (const it of ingredients) {
      if (!MATERIALS[it.name]) MATERIALS[it.name] = it.name; // label = id for v1
    }
  }

  // Backfill prettier material labels from items.csv when available.
  for (const it of itemsCsv) {
    if (MATERIALS[it.id_name] && it.name_key && !/^\s*$/.test(it.name_key)) {
      MATERIALS[it.id_name] = it.name_key;
    }
  }

  const banner = `// AUTO-GENERATED by scripts/build-gear-data.mjs
// Source: gear-calc/*.csv (game static data dumps).
// Filtered to Lords gear (kind = "standard"). Do not hand-edit — regenerate.\n`;

  const body =
    banner +
    `const TIERS = ${JSON.stringify(TIERS)};\n` +
    `const QUALITIES = ${JSON.stringify(QUALITIES)};\n` +
    `const SLOTS = ${JSON.stringify(SLOTS, null, 2)};\n` +
    `const MATERIALS = ${JSON.stringify(MATERIALS, null, 2)};\n` +
    `const GEAR = ${JSON.stringify(GEAR, null, 2)};\n` +
    `(function (root, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
}(typeof globalThis !== 'undefined' ? globalThis : this,
  { TIERS, QUALITIES, SLOTS, MATERIALS, GEAR }));\n`;

  writeFileSync(OUT, body);
  console.error(`wrote ${OUT} — ${Object.keys(GEAR).length} pieces, ${Object.keys(MATERIALS).length} materials`);
}

main();
```

- [ ] **Step 2: Run the script**

Run: `node scripts/build-gear-data.mjs`
Expected: Prints `wrote .../gear-data.generated.js — N pieces, M materials` where N is in the low hundreds and M is roughly a dozen (Lords gear uses ~12 standard materials: silk, hide, leatherstrap, kingswoodoak, ironwood, weirwood, blackiron, copperbar, dragonglass, milkofthepoppy, goldenheartwood, wildfire).

- [ ] **Step 3: Sanity-check the output**

Run:
```bash
node -e 'const g = require("./gear-data.generated.js"); 
  console.log("pieces:", Object.keys(g.GEAR).length);
  console.log("sample:", JSON.stringify(g.GEAR["eq_standard_helmet_silkchapeau"], null, 2));
  console.log("materials:", Object.keys(g.MATERIALS).length);'
```
Expected: prints the piece with `slot=slot_Helmet`, `tier=30`, recipe with 3 ingredients, and a `bonuses` array of objects with `prop` + `curve` (6 numbers).

- [ ] **Step 4: Commit**

```bash
git add scripts/build-gear-data.mjs gear-data.generated.js
git commit -m "Add Gendry's Forge data build script + generated Lords gear data"
```

---

## Task 2: Engine scaffolding + `floorToTier`

**Files:**
- Create: `gear-calc.js`
- Create: `tests/gear-calc.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/gear-calc.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/gear-calc.test.js`
Expected: FAIL — `Cannot find module '../gear-calc.js'`.

- [ ] **Step 3: Create the engine module**

Create `gear-calc.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/gear-calc.test.js`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add gear-calc.js tests/gear-calc.test.js
git commit -m "Add gear-calc engine scaffold with floorToTier"
```

---

## Task 3: Engine — `computeTotals`

`computeTotals` takes a selection (list of `{piece, quality}` items, where
`piece` is a `GEAR[id_name]` value) and efficiency settings, and returns a
per-piece breakdown plus totals.

**Files:**
- Modify: `gear-calc.js`
- Modify: `tests/gear-calc.test.js`

- [ ] **Step 1: Add failing tests**

Append to `tests/gear-calc.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/gear-calc.test.js`
Expected: 4 new tests fail with `computeTotals is not a function`.

- [ ] **Step 3: Implement `computeTotals`**

In `gear-calc.js`, add inside the factory before the `return`:

```js
function computeTotals({ selection, steelCraftEff = 0, forgeTimeEff = 0 }) {
  const costDiv = 1 + steelCraftEff;
  const timeDiv = 1 + forgeTimeEff;
  const rows = [];
  const totals = { time_sec: 0, materials: {} };

  for (const sel of selection) {
    const { id, piece, quality } = sel;
    const time_sec = piece.recipe.time_sec / timeDiv;
    const materials = {};
    for (const ing of piece.recipe.ingredients) {
      materials[ing.mat] = Math.ceil(ing.amount / costDiv);
    }
    rows.push({ id, slot: piece.slot, tier: piece.tier, quality, time_sec, materials });

    totals.time_sec += time_sec;
    for (const [mat, amt] of Object.entries(materials)) {
      totals.materials[mat] = (totals.materials[mat] || 0) + amt;
    }
  }

  return { rows, totals };
}
```

And add `computeTotals` to the returned object: `return { TIERS, QUALITIES, floorToTier, computeTotals };`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/gear-calc.test.js`
Expected: all tests passing.

- [ ] **Step 5: Commit**

```bash
git add gear-calc.js tests/gear-calc.test.js
git commit -m "Add computeTotals: per-row cost/time math with efficiency divisors"
```

---

## Task 4: Engine — `bonusesForPiece`

Resolve `curve_json` values at the chosen quality index.

**Files:**
- Modify: `gear-calc.js`
- Modify: `tests/gear-calc.test.js`

- [ ] **Step 1: Add failing test**

Append:

```js
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
```

- [ ] **Step 2: Run tests, expect failure**

Run: `node --test tests/gear-calc.test.js`
Expected: 2 new failures.

- [ ] **Step 3: Implement**

Add to engine:

```js
function bonusesForPiece(piece, qualityIndex) {
  if (!piece || !Array.isArray(piece.bonuses)) return [];
  return piece.bonuses.map(b => ({ prop: b.prop, value: b.curve[qualityIndex] }));
}
```

Add to the exports: `return { TIERS, QUALITIES, floorToTier, computeTotals, bonusesForPiece };`.

- [ ] **Step 4: Run tests, expect pass**

Run: `node --test tests/gear-calc.test.js` — all green.

- [ ] **Step 5: Commit**

```bash
git add gear-calc.js tests/gear-calc.test.js
git commit -m "Add bonusesForPiece: read curve value at quality index"
```

---

## Task 5: Engine — `effectiveInventoryAt` and `canCraft`

The inventory satisfaction math: convert lower-quality stock upward via 4→1.

**Files:**
- Modify: `gear-calc.js`
- Modify: `tests/gear-calc.test.js`

- [ ] **Step 1: Add failing tests**

Append:

```js
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
```

- [ ] **Step 2: Run tests, expect failure**

Run: `node --test tests/gear-calc.test.js`
Expected: new tests fail with undefined functions.

- [ ] **Step 3: Implement both**

Add to engine:

```js
function effectiveInventoryAt(inventory, mat, qualityIndex) {
  const row = inventory && inventory[mat];
  if (!row) return 0;
  let total = 0;
  for (let q = 0; q <= qualityIndex; q++) {
    const amt = row[q] || 0;
    const factor = Math.pow(4, qualityIndex - q);
    total += Math.floor(amt / factor);
  }
  return total;
}

function canCraft(row, inventory) {
  const shortfalls = [];
  for (const [mat, need] of Object.entries(row.materials)) {
    const have = effectiveInventoryAt(inventory, mat, row.quality);
    if (have < need) shortfalls.push({ mat, quality: row.quality, need, have });
  }
  return { ok: shortfalls.length === 0, shortfalls };
}
```

Export them in the returned object.

- [ ] **Step 4: Run tests, expect pass**

Run: `node --test tests/gear-calc.test.js` — all green.

- [ ] **Step 5: Commit**

```bash
git add gear-calc.js tests/gear-calc.test.js
git commit -m "Add inventory-quality math: effectiveInventoryAt + canCraft"
```

---

## Task 6: Engine — `buildSequence` (ordered plan with running inventory)

Walk the selection in order, deducting from a running inventory copy. The first
row that can't be satisfied is flagged; remaining rows show their would-be
state but `ok=false`.

**Files:**
- Modify: `gear-calc.js`
- Modify: `tests/gear-calc.test.js`

- [ ] **Step 1: Add failing tests**

Append:

```js
const { buildSequence } = require('../gear-calc.js');

test('buildSequence: deducts inventory step by step', () => {
  const rows = [
    { id: 'a', quality: 1, time_sec: 0, materials: { mat_silk: 5 }, slot: 's', tier: 1 },
    { id: 'b', quality: 1, time_sec: 0, materials: { mat_silk: 5 }, slot: 's', tier: 1 },
  ];
  const inv = { mat_silk: [0, 10, 0, 0, 0, 0] };
  const seq = buildSequence(rows, inv);
  assert.equal(seq.length, 2);
  assert.equal(seq[0].ok, true);
  assert.deepEqual(seq[0].remaining, { mat_silk: [0, 5, 0, 0, 0, 0] });
  assert.equal(seq[1].ok, true);
  assert.deepEqual(seq[1].remaining, { mat_silk: [0, 0, 0, 0, 0, 0] });
});

test('buildSequence: flags the first row that runs short', () => {
  const rows = [
    { id: 'a', quality: 1, time_sec: 0, materials: { mat_silk: 6 }, slot: 's', tier: 1 },
    { id: 'b', quality: 1, time_sec: 0, materials: { mat_silk: 6 }, slot: 's', tier: 1 },
  ];
  const inv = { mat_silk: [0, 10, 0, 0, 0, 0] };
  const seq = buildSequence(rows, inv);
  assert.equal(seq[0].ok, true);
  assert.equal(seq[1].ok, false);
  assert.equal(seq[1].shortfalls[0].mat, 'mat_silk');
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `node --test tests/gear-calc.test.js`
Expected: 2 new failures.

- [ ] **Step 3: Implement**

Add to engine:

```js
// Deduct `need` units at exactly quality `q` from inventory, consuming
// lower-quality stock first (upgrading 4->1 as needed). Returns a NEW inv
// object. Caller must check feasibility via canCraft beforehand if it cares.
function deductOneMaterial(inv, mat, q, need) {
  const row = (inv[mat] || [0,0,0,0,0,0]).slice();
  let remainingAtQ = need;
  for (let qi = 0; qi <= q && remainingAtQ > 0; qi++) {
    const factor = Math.pow(4, q - qi);
    const stockAtQ = Math.floor(row[qi] / factor);
    const consumeAtQ = Math.min(stockAtQ, remainingAtQ);
    row[qi] -= consumeAtQ * factor;
    remainingAtQ -= consumeAtQ;
  }
  // Ensure non-negative (numerical safety).
  for (let i = 0; i < row.length; i++) if (row[i] < 0) row[i] = 0;
  return { ...inv, [mat]: row };
}

function buildSequence(rows, inventory) {
  let inv = { ...inventory };
  // Deep-copy each material row.
  for (const m of Object.keys(inv)) inv[m] = (inv[m] || [0,0,0,0,0,0]).slice();
  const out = [];
  for (const row of rows) {
    const check = canCraft(row, inv);
    if (!check.ok) {
      out.push({ ...row, ok: false, shortfalls: check.shortfalls, remaining: inv });
      continue;
    }
    for (const [mat, need] of Object.entries(row.materials)) {
      inv = deductOneMaterial(inv, mat, row.quality, need);
    }
    out.push({ ...row, ok: true, shortfalls: [], remaining: inv });
  }
  return out;
}
```

Export `buildSequence`.

- [ ] **Step 4: Run tests, expect pass**

Run: `node --test tests/gear-calc.test.js` — all green.

- [ ] **Step 5: Spot-check with real data**

Run:
```bash
node -e '
const { GEAR } = require("./gear-data.generated.js");
const { computeTotals, buildSequence } = require("./gear-calc.js");
const sel = [{ id: "h", piece: GEAR["eq_standard_helmet_silkchapeau"], quality: 4 }];
const { rows, totals } = computeTotals({ selection: sel, steelCraftEff: 0, forgeTimeEff: 0 });
console.log("row materials:", rows[0].materials);
console.log("totals:", totals);
const seq = buildSequence(rows, { mat_silk: [0,0,0,0,16000,0], mat_leatherstrap: [0,0,0,0,16000,0], mat_milkofthepoppy: [0,0,0,0,16000,0] });
console.log("seq[0].ok:", seq[0].ok);
'
```
Expected: prints non-empty materials, `totals.time_sec=64800`, and `seq[0].ok: true`.

- [ ] **Step 6: Commit**

```bash
git add gear-calc.js tests/gear-calc.test.js
git commit -m "Add buildSequence: ordered craft plan with running inventory"
```

---

## Task 7: HTML scaffold + nav update on all three pages

**Files:**
- Create: `gendrys-forge.html`
- Modify: `index.html` (nav strip)
- Modify: `keep-upgrade.html` (nav strip)

- [ ] **Step 1: Find the nav strip in existing pages**

Run: `grep -n "Prestige\|Builders\|nav" index.html keep-upgrade.html | head -40`

Identify the nav `<a>` tags. The two existing pages have a small nav block linking to each other.

- [ ] **Step 2: Add Gendry's Forge link to existing nav strips**

In **both** `index.html` and `keep-upgrade.html`, locate the nav block and add a third link. Example pattern (match the existing markup exactly):

```html
<a href="gendrys-forge.html">Gendry's Forge</a>
```

- [ ] **Step 3: Create the page scaffold**

Create `gendrys-forge.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gendry's Forge — Laughing Cr0w's Companion</title>
  <link rel="icon" href="favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <nav class="site-nav">
    <a href="index.html">Prestige Ledger</a>
    <a href="keep-upgrade.html">Night's Watch: The Builders</a>
    <a href="gendrys-forge.html" class="active">Gendry's Forge</a>
  </nav>

  <main class="page">
    <header class="page-header">
      <h1>Gendry's Forge</h1>
      <p class="subtitle">Plan Lords-gear crafting cost and time.</p>
    </header>

    <section class="panel" id="goal-panel">
      <h2>Goal &amp; target</h2>
      <label>House Level
        <input type="number" id="house-level" min="1" max="50" value="34" />
      </label>
      <span class="hint">Max craftable tier: <strong id="max-tier">30</strong></span>

      <fieldset>
        <legend>Mode</legend>
        <label><input type="radio" name="mode" value="loadout" checked /> Loadout</label>
        <label><input type="radio" name="mode" value="queue" /> Queue</label>
      </fieldset>
    </section>

    <section class="panel" id="loadout-panel">
      <h2>Loadout</h2>
      <label>Target tier <select id="target-tier"></select></label>
      <label>Target quality <select id="target-quality"></select></label>
      <div id="slot-pickers"></div>
    </section>

    <section class="panel hidden" id="queue-panel">
      <h2>Queue</h2>
      <button type="button" id="queue-add">+ Add piece</button>
      <table id="queue-table"><thead><tr>
        <th>Slot</th><th>Tier</th><th>Piece</th><th>Quality</th><th></th>
      </tr></thead><tbody></tbody></table>
    </section>

    <section class="panel" id="efficiency-panel">
      <h2>Crafting efficiency</h2>
      <label>Steel Crafting Efficiency (%) <input type="number" id="steel-eff" value="0" step="0.1" /></label>
      <label>Forge Time Efficiency (%) <input type="number" id="forge-eff" value="0" step="0.1" /></label>
    </section>

    <section class="panel" id="inventory-panel">
      <details>
        <summary><h2 style="display:inline">Material inventory</h2></summary>
        <div id="inventory-grid"></div>
      </details>
    </section>

    <section class="panel" id="output-panel">
      <h2>Totals</h2>
      <div id="totals-table-mount"></div>
      <details>
        <summary><h3 style="display:inline">Sequence view</h3></summary>
        <div id="sequence-mount"></div>
      </details>
    </section>
  </main>

  <script src="gear-data.generated.js"></script>
  <script src="gear-calc.js"></script>
  <script src="gendrys-forge.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify the page loads without errors**

Run: `python3 -m http.server 8765` in the project root (in another terminal).
Open `http://localhost:8765/gendrys-forge.html` in a browser.
Expected: page renders with all panels visible. No JS errors in the console (the script files exist but gendrys-forge.js is empty — that's fine).

- [ ] **Step 5: Commit**

```bash
git add gendrys-forge.html index.html keep-upgrade.html
git commit -m "Add Gendry's Forge page scaffold + nav links"
```

---

## Task 8: Page wiring — Loadout mode (selection + efficiency + state)

**Files:**
- Create: `gendrys-forge.js`

The page renders, but nothing computes yet. Wire up the state model, the
loadout-mode UI, and trigger the engine for a totals computation on every
input change.

- [ ] **Step 1: Create the wiring file with state + read/write helpers**

Create `gendrys-forge.js`:

```js
(function () {
  const { GEAR, MATERIALS, SLOTS, TIERS, QUALITIES } = window;
  const { floorToTier, computeTotals, bonusesForPiece, canCraft, buildSequence } = window;

  // Index pieces by slot for fast picker rendering.
  const piecesBySlot = {};
  for (const [id, p] of Object.entries(GEAR)) {
    if (!piecesBySlot[p.slot]) piecesBySlot[p.slot] = [];
    piecesBySlot[p.slot].push({ id, ...p });
  }
  for (const s of Object.keys(piecesBySlot)) {
    piecesBySlot[s].sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  }

  // State
  const state = {
    houseLevel: 34,
    mode: 'loadout',
    targetTier: 30,
    targetQuality: 4, // epic
    loadout: {},      // slot -> piece id
    queue: [],        // [{ slot, tier, pieceId, quality }]
    steelCraftEff: 0, // stored as fraction (0.5 = 50%)
    forgeTimeEff: 0,
    inventory: {},    // mat -> [poor..legendary]
  };

  // DOM references
  const $ = (sel) => document.querySelector(sel);
  const els = {
    houseLevel: $('#house-level'),
    maxTier:    $('#max-tier'),
    modeRadios: document.querySelectorAll('input[name=mode]'),
    targetTier: $('#target-tier'),
    targetQuality: $('#target-quality'),
    slotPickers: $('#slot-pickers'),
    loadoutPanel: $('#loadout-panel'),
    queuePanel:   $('#queue-panel'),
    steelEff: $('#steel-eff'),
    forgeEff: $('#forge-eff'),
    totalsMount: $('#totals-table-mount'),
    sequenceMount: $('#sequence-mount'),
    inventoryGrid: $('#inventory-grid'),
  };

  function populateTierAndQuality() {
    els.targetTier.innerHTML = TIERS.map(t => `<option value="${t}">${t}</option>`).join('');
    els.targetTier.value = state.targetTier;
    els.targetQuality.innerHTML = QUALITIES
      .map((q, i) => `<option value="${i}">${q}</option>`).join('');
    els.targetQuality.value = state.targetQuality;
  }

  function renderSlotPickers() {
    const maxTier = floorToTier(state.houseLevel) || 1;
    const tier = Math.min(state.targetTier, maxTier);
    state.targetTier = tier;
    els.targetTier.value = tier;

    const html = Object.entries(SLOTS).map(([slotId, label]) => {
      const opts = (piecesBySlot[slotId] || [])
        .filter(p => p.tier === tier)
        .map(p => `<option value="${p.id}">${p.id}</option>`)
        .join('');
      return `<label>${label}: <select data-slot="${slotId}">
        <option value="">— none —</option>${opts}
      </select></label>`;
    }).join('');
    els.slotPickers.innerHTML = html;

    // Re-apply existing selections.
    for (const [slotId, pieceId] of Object.entries(state.loadout)) {
      const sel = els.slotPickers.querySelector(`select[data-slot="${slotId}"]`);
      if (sel) sel.value = pieceId;
    }
    els.slotPickers.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', () => {
        state.loadout[sel.dataset.slot] = sel.value || undefined;
        if (!sel.value) delete state.loadout[sel.dataset.slot];
        render();
      });
    });
  }

  function currentSelection() {
    if (state.mode === 'queue') {
      return state.queue
        .filter(q => q.pieceId && GEAR[q.pieceId])
        .map(q => ({ id: q.pieceId + ':' + q.quality, piece: GEAR[q.pieceId], quality: q.quality }));
    }
    return Object.entries(state.loadout)
      .filter(([, id]) => id && GEAR[id])
      .map(([slot, id]) => ({ id: slot, piece: GEAR[id], quality: state.targetQuality }));
  }

  function render() {
    els.maxTier.textContent = floorToTier(state.houseLevel) || '—';
    renderTotals();
    renderSequence();
    renderInventoryGrid();
  }

  function renderTotals() {
    const selection = currentSelection();
    if (!selection.length) { els.totalsMount.innerHTML = '<p class="hint">Select gear to see totals.</p>'; return; }
    const { rows, totals } = computeTotals({
      selection,
      steelCraftEff: state.steelCraftEff,
      forgeTimeEff: state.forgeTimeEff,
    });

    const mats = Object.keys(totals.materials).sort();
    let html = '<table class="totals"><thead><tr><th>Piece</th><th>Tier</th><th>Quality</th><th>Time (h)</th>';
    for (const m of mats) html += `<th>${MATERIALS[m] || m}</th>`;
    html += '<th>Bonuses</th></tr></thead><tbody>';
    for (const r of rows) {
      const piece = selection.find(s => s.id === r.id).piece;
      const bonusList = bonusesForPiece(piece, r.quality)
        .map(b => `<li>${b.prop}: ${(b.value * 100).toFixed(2)}%</li>`).join('');
      html += `<tr><td>${r.id}</td><td>${r.tier}</td><td>${QUALITIES[r.quality]}</td>` +
              `<td>${(r.time_sec / 3600).toFixed(2)}</td>`;
      for (const m of mats) html += `<td>${(r.materials[m] || 0).toLocaleString()}</td>`;
      html += `<td><details><summary>${piece.bonuses.length} props</summary><ul>${bonusList}</ul></details></td></tr>`;
    }
    // Totals row.
    html += `<tr class="totals-row"><th colspan="3">Totals</th><th>${(totals.time_sec/3600).toFixed(2)}</th>`;
    for (const m of mats) html += `<th>${totals.materials[m].toLocaleString()}</th>`;
    html += '<th></th></tr></tbody></table>';

    // Craftable-now line.
    const seq = buildSequence(rows, state.inventory);
    const allOk = seq.every(s => s.ok);
    if (allOk) html += '<p class="ok">Craftable now ✓</p>';
    else {
      const firstFail = seq.find(s => !s.ok);
      const sf = firstFail.shortfalls[0];
      html += `<p class="bad">Not craftable: need ${sf.need - sf.have} more ${MATERIALS[sf.mat] || sf.mat} @ ${QUALITIES[sf.quality]} for "${firstFail.id}"</p>`;
    }

    els.totalsMount.innerHTML = html;
  }

  function renderSequence() {
    const selection = currentSelection();
    if (!selection.length) { els.sequenceMount.innerHTML = ''; return; }
    const { rows } = computeTotals({
      selection,
      steelCraftEff: state.steelCraftEff,
      forgeTimeEff: state.forgeTimeEff,
    });
    const seq = buildSequence(rows, state.inventory);
    let html = '<ol class="sequence">';
    for (const s of seq) {
      const status = s.ok ? '✓' : '✗';
      const detail = s.ok ? '' :
        ` (need ${s.shortfalls[0].need - s.shortfalls[0].have} more ${MATERIALS[s.shortfalls[0].mat] || s.shortfalls[0].mat} @ ${QUALITIES[s.shortfalls[0].quality]})`;
      html += `<li>${status} ${s.id} — ${QUALITIES[s.quality]}${detail}</li>`;
    }
    html += '</ol>';
    els.sequenceMount.innerHTML = html;
  }

  function renderInventoryGrid() {
    const selection = currentSelection();
    const mats = new Set();
    for (const sel of selection) for (const ing of sel.piece.recipe.ingredients) mats.add(ing.mat);
    if (mats.size === 0) { els.inventoryGrid.innerHTML = '<p class="hint">No materials yet.</p>'; return; }

    const header = '<tr><th>Material</th>' + QUALITIES.map(q => `<th>${q}</th>`).join('') + '</tr>';
    const body = [...mats].sort().map(m => {
      const row = state.inventory[m] || [0,0,0,0,0,0];
      return `<tr><td>${MATERIALS[m] || m}</td>` +
        row.map((v, q) =>
          `<td><input type="number" min="0" data-mat="${m}" data-q="${q}" value="${v}" /></td>`
        ).join('') + '</tr>';
    }).join('');
    els.inventoryGrid.innerHTML = `<table class="inventory">${header}${body}</table>`;

    els.inventoryGrid.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const m = inp.dataset.mat, q = Number(inp.dataset.q);
        if (!state.inventory[m]) state.inventory[m] = [0,0,0,0,0,0];
        state.inventory[m][q] = Math.max(0, Number(inp.value) || 0);
        renderTotals();
        renderSequence();
      });
    });
  }

  function wireEvents() {
    els.houseLevel.addEventListener('input', () => {
      state.houseLevel = Number(els.houseLevel.value) || 1;
      renderSlotPickers();
      render();
    });
    els.modeRadios.forEach(r => r.addEventListener('change', () => {
      state.mode = document.querySelector('input[name=mode]:checked').value;
      els.loadoutPanel.classList.toggle('hidden', state.mode !== 'loadout');
      els.queuePanel.classList.toggle('hidden', state.mode !== 'queue');
      render();
    }));
    els.targetTier.addEventListener('change', () => {
      state.targetTier = Number(els.targetTier.value);
      state.loadout = {};
      renderSlotPickers();
      render();
    });
    els.targetQuality.addEventListener('change', () => {
      state.targetQuality = Number(els.targetQuality.value);
      render();
    });
    els.steelEff.addEventListener('input', () => {
      state.steelCraftEff = (Number(els.steelEff.value) || 0) / 100;
      render();
    });
    els.forgeEff.addEventListener('input', () => {
      state.forgeTimeEff = (Number(els.forgeEff.value) || 0) / 100;
      render();
    });
  }

  function init() {
    populateTierAndQuality();
    renderSlotPickers();
    wireEvents();
    render();
  }
  init();
})();
```

- [ ] **Step 2: Load the page and verify the loadout mode works**

Run dev server: `python3 -m http.server 8765`.
Open `http://localhost:8765/gendrys-forge.html`.

Verify in the browser:
1. House Level = 34 shows "Max craftable tier: 30".
2. Target tier defaults to 30, target quality to "epic".
3. Slot dropdowns appear with tier-30 pieces.
4. Selecting a helmet renders a row in the totals table with non-zero materials and a time value.
5. Changing Steel Crafting Efficiency to 50 reduces all material values (per-row, divisor model).
6. Changing Forge Time Efficiency to 100 halves the craft time.
7. The "Bonuses" cell expands to show property → percentage value list.
8. Opening the Material inventory section shows numeric inputs per material × quality.
9. Entering enough materials flips the craftable-now indicator to ✓.

- [ ] **Step 3: Commit**

```bash
git add gendrys-forge.js
git commit -m "Wire Gendry's Forge: loadout mode + totals + inventory + sequence"
```

---

## Task 9: Page wiring — Queue mode

**Files:**
- Modify: `gendrys-forge.js`

Add queue mode handling. Each queue row picks a slot, tier (≤ max), piece, and
quality independently.

- [ ] **Step 1: Add queue-mode rendering and event wiring**

In `gendrys-forge.js`, add these functions inside the IIFE (before `init`):

```js
function renderQueueTable() {
  const tbody = document.querySelector('#queue-table tbody');
  const maxTier = floorToTier(state.houseLevel) || 1;
  const availableTiers = TIERS.filter(t => t <= maxTier);
  tbody.innerHTML = state.queue.map((q, idx) => {
    const slotOpts = Object.entries(SLOTS)
      .map(([id, label]) => `<option value="${id}" ${q.slot === id ? 'selected' : ''}>${label}</option>`).join('');
    const tierOpts = availableTiers
      .map(t => `<option value="${t}" ${q.tier === t ? 'selected' : ''}>${t}</option>`).join('');
    const pieceOpts = (piecesBySlot[q.slot] || [])
      .filter(p => p.tier === q.tier)
      .map(p => `<option value="${p.id}" ${q.pieceId === p.id ? 'selected' : ''}>${p.id}</option>`).join('');
    const qualOpts = QUALITIES
      .map((qn, i) => `<option value="${i}" ${q.quality === i ? 'selected' : ''}>${qn}</option>`).join('');
    return `<tr data-idx="${idx}">
      <td><select data-field="slot">${slotOpts}</select></td>
      <td><select data-field="tier">${tierOpts}</select></td>
      <td><select data-field="pieceId"><option value="">—</option>${pieceOpts}</select></td>
      <td><select data-field="quality">${qualOpts}</select></td>
      <td><button type="button" data-field="remove">×</button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('select, button').forEach(el => {
    el.addEventListener('change', onQueueRowEvent);
    el.addEventListener('click', onQueueRowEvent);
  });
}

function onQueueRowEvent(e) {
  const tr = e.target.closest('tr');
  const idx = Number(tr.dataset.idx);
  const field = e.target.dataset.field;
  const row = state.queue[idx];
  if (field === 'remove') {
    state.queue.splice(idx, 1);
  } else if (field === 'tier' || field === 'slot') {
    row[field] = field === 'tier' ? Number(e.target.value) : e.target.value;
    row.pieceId = ''; // reset piece when slot/tier changes
  } else if (field === 'quality') {
    row.quality = Number(e.target.value);
  } else if (field === 'pieceId') {
    row.pieceId = e.target.value;
  }
  renderQueueTable();
  render();
}
```

- [ ] **Step 2: Wire the "+ Add piece" button**

In `wireEvents()`, add:

```js
document.querySelector('#queue-add').addEventListener('click', () => {
  const maxTier = floorToTier(state.houseLevel) || 1;
  const firstSlot = Object.keys(SLOTS)[0];
  state.queue.push({ slot: firstSlot, tier: maxTier, pieceId: '', quality: 4 });
  renderQueueTable();
  render();
});
```

And call `renderQueueTable()` at the end of `init()`. Also call `renderQueueTable()` from the `houseLevel` change handler so available tiers stay in range.

- [ ] **Step 3: Test queue mode in the browser**

Reload the page, switch the radio to "Queue".
1. Click "+ Add piece" — a row appears with default slot/tier/piece dropdowns.
2. Selecting a piece, then changing quality, updates totals.
3. Adding a second row with a different slot/quality sums correctly in the totals row.
4. The × button removes the row and re-renders totals.

- [ ] **Step 4: Commit**

```bash
git add gendrys-forge.js
git commit -m "Add Queue mode to Gendry's Forge"
```

---

## Task 10: URL params — encode + decode shareable state

**Files:**
- Modify: `gendrys-forge.js`

- [ ] **Step 1: Add encode/decode helpers**

Add to the IIFE in `gendrys-forge.js`:

```js
function encodeStateToURL() {
  const params = new URLSearchParams();
  if (state.houseLevel !== 34) params.set('hl', state.houseLevel);
  if (state.mode !== 'loadout') params.set('mode', state.mode);
  if (state.targetTier !== 30) params.set('t', state.targetTier);
  if (state.targetQuality !== 4) params.set('q', state.targetQuality);
  for (const [slot, id] of Object.entries(state.loadout)) {
    if (id) params.set('g.' + slot, id);
  }
  if (state.queue.length) {
    params.set('qu', state.queue
      .map(q => `${q.slot}:${q.tier}:${q.pieceId}:${q.quality}`).join(','));
  }
  if (state.steelCraftEff) params.set('se', (state.steelCraftEff * 100).toString());
  if (state.forgeTimeEff) params.set('fe', (state.forgeTimeEff * 100).toString());
  for (const [m, row] of Object.entries(state.inventory)) {
    for (let q = 0; q < row.length; q++) {
      if (row[q]) params.set(`inv.${m}.${q}`, row[q]);
    }
  }
  const qs = params.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

function decodeURLToState() {
  const p = new URLSearchParams(location.search);
  if (p.has('hl')) state.houseLevel = Number(p.get('hl'));
  if (p.has('mode')) state.mode = p.get('mode');
  if (p.has('t')) state.targetTier = Number(p.get('t'));
  if (p.has('q')) state.targetQuality = Number(p.get('q'));
  if (p.has('se')) state.steelCraftEff = Number(p.get('se')) / 100;
  if (p.has('fe')) state.forgeTimeEff = Number(p.get('fe')) / 100;
  if (p.has('qu')) {
    state.queue = p.get('qu').split(',').filter(Boolean).map(s => {
      const [slot, tier, pieceId, quality] = s.split(':');
      return { slot, tier: Number(tier), pieceId, quality: Number(quality) };
    });
  }
  for (const [k, v] of p.entries()) {
    if (k.startsWith('g.')) state.loadout[k.slice(2)] = v;
    if (k.startsWith('inv.')) {
      const [, mat, qIdx] = k.split('.');
      if (!state.inventory[mat]) state.inventory[mat] = [0,0,0,0,0,0];
      state.inventory[mat][Number(qIdx)] = Number(v);
    }
  }
}
```

- [ ] **Step 2: Hook them into init and render**

- Call `decodeURLToState()` at the very start of `init()` (before `populateTierAndQuality`).
- Apply state to the DOM controls inside `init()` after creating elements: set `els.houseLevel.value`, the radios, `els.steelEff.value = state.steelCraftEff*100`, `els.forgeEff.value = state.forgeTimeEff*100`, and toggle panel visibility from `state.mode`.
- Call `encodeStateToURL()` at the end of `render()`.

- [ ] **Step 3: Test URL persistence in browser**

1. Set House=34, tier=30, quality=epic, pick a helmet, set steel-eff=50, enter inventory.
2. Confirm the URL updates (check the address bar).
3. Copy the URL, paste into a fresh tab — same state restores.

- [ ] **Step 4: Commit**

```bash
git add gendrys-forge.js
git commit -m "Add URL state encode/decode for Gendry's Forge"
```

---

## Task 11: Style polish in `styles.css`

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add the few new classes used by the page**

Append to `styles.css`:

```css
.hidden { display: none; }

.totals { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
.totals th, .totals td { padding: 0.35rem 0.6rem; border-bottom: 1px solid #2a2a2a; text-align: right; }
.totals th:first-child, .totals td:first-child { text-align: left; }
.totals .totals-row th { border-top: 1px solid #c9a961; }

.inventory { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
.inventory th, .inventory td { padding: 0.25rem 0.4rem; }
.inventory input { width: 6rem; }

.sequence li { padding: 0.15rem 0; }

.ok  { color: #8fd17a; }
.bad { color: #e07a5f; }

.hint { color: #8a8a8a; font-style: italic; }
```

- [ ] **Step 2: Reload the page and verify legibility**

The totals table should align numerics right, the totals row should have a gold top border, and the inventory grid should fit a reasonable width.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "Style Gendry's Forge tables and indicators"
```

---

## Task 12: README — document Gendry's Forge

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a Gendry's Forge section**

In `README.md`:

1. Add a row to the "What's inside" table:

```markdown
| [**Gendry's Forge**](#gendrys-forge) (`gendrys-forge.html`) | Plan Lords-gear crafting: cost, time, and bonus values at a chosen quality, with material-inventory awareness. |
```

2. Add a section below the Night's Watch section:

```markdown
---

## Gendry's Forge

Plans Lords-gear crafting (the game's `kind = standard` gear). Given a House
level, a desired loadout (or a free-form craft queue), a target quality, and
optional efficiency/inventory inputs, the calculator shows total material
cost, craft time, and the bonus values you'll receive at the chosen quality.

### Configurable inputs

**Goal & target**
- House Level (derives max craftable tier from `[1,5,10,…,45]`)
- Mode: Loadout (one piece per slot at one tier) vs Queue (free list of pieces)
- Target quality: `poor`, `common`, `fine`, `exquisite`, `epic`, `legendary`

**Crafting efficiency**
- Steel Crafting Efficiency % (divisor on material cost across all gear recipes)
- Forge Time Efficiency % (divisor on craft time)

**Material inventory** — collapsible. One row per material in the current
selection, six numeric inputs per row (one per quality). Lower-quality stock
is upgraded 4→1 to satisfy the target quality; higher-quality stock is not
downgraded.

### Cost math

```
adjusted_amount = ceil(base_amount / (1 + steelCraftEff))
adjusted_time   = base_time / (1 + forgeTimeEff)
totals          = sum of per-row adjusted values (round per row first)
effective_inv_at(Q) = floor( Σ_{q ≤ Q} inv[q] / 4^(Q − q) )
```

### Where the data comes from

`gear-data.generated.js` is built from the CSV dumps in `gear-calc/` via
`scripts/build-gear-data.mjs`. It exports `TIERS`, `QUALITIES`, `SLOTS`,
`MATERIALS`, and `GEAR[id_name] = { slot, tier, recipe, bonuses }`. Lords gear
only — dragon and trinket gear are planned for separate calculators.

To regenerate after a fresh data dump:

```bash
node scripts/build-gear-data.mjs
```

### Out of scope (future phases)

- **Templates** (required by Lords/dragon gear; gold cost or craft-from-lower-tier path; event-grant inventory) — planned v2.
- **RNG output quality** when input materials are mixed quality — planned v3.

### URL parameters (selected)

| Param | Meaning |
|---|---|
| `hl` | House level |
| `mode` | `loadout` or `queue` |
| `t` / `q` | Target tier / quality (loadout mode) |
| `g.<slot>` | Selected piece per slot (loadout mode) |
| `qu` | Queue contents, comma-sep `slot:tier:piece:quality` quads |
| `se` / `fe` | Steel-craft / Forge-time efficiency % |
| `inv.<mat>.<q>` | Inventory amount per material per quality |
```

3. Update the "Project layout" tree to include the new files:

```
gendrys-forge.html         — Gendry's Forge calculator page
gendrys-forge.js           — Gendry's Forge page wiring
gear-calc.js               — gear engine (pure JS, works in browser and Node)
gear-data.generated.js     — GEAR / MATERIALS / SLOTS / TIERS / QUALITIES
scripts/build-gear-data.mjs — emits gear-data.generated.js from gear-calc/*.csv
tests/gear-calc.test.js    — Node test suite for the gear engine
```

4. In the "Tests" section, add the gear test command:

```bash
node --test tests/gear-calc.test.js
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document Gendry's Forge in README"
```

---

## Task 13: Final integration sweep

- [ ] **Step 1: Run the full test suite**

Run: `node --test tests/`
Expected: all tests in both `keep-calc.test.js` and `gear-calc.test.js` pass.

- [ ] **Step 2: Browser smoke test of all three pages**

Start the dev server (`python3 -m http.server 8765`) and click through:
1. `/` (Prestige Ledger) — nav strip shows three links, page works.
2. `/keep-upgrade.html` (Builders) — nav strip shows three links, page works.
3. `/gendrys-forge.html` — selects a full loadout at tier 30 / epic, totals update, inventory section works, share URL round-trips through copy/paste.

- [ ] **Step 3: Final commit (if anything was tweaked)**

```bash
git status
# If any final fixes were needed:
git add -A && git commit -m "Final tweaks for Gendry's Forge v1"
```

---

## Self-review notes

- **Spec coverage:** Each spec section is covered: data pipeline (Task 1), engine math (Tasks 2–6), page layout + loadout (Tasks 7–8), queue mode (Task 9), URL params (Task 10), styling (Task 11), docs (Task 12), final integration (Task 13). Out-of-scope items (templates, RNG, dragon, trinket) are explicitly deferred and not in the plan.
- **Placeholder scan:** Every step has concrete code or commands.
- **Type/name consistency:** Engine function names used in `gendrys-forge.js` (`floorToTier`, `computeTotals`, `bonusesForPiece`, `canCraft`, `buildSequence`) match those defined in Tasks 2–6. Row shape (`{id, slot, tier, quality, time_sec, materials}`) is consistent across `computeTotals`, `canCraft`, and `buildSequence`. Inventory shape (`{ mat: [6 numbers] }`) is consistent everywhere it appears.
