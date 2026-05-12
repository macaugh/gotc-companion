# Night's Watch: The Builders — Keep Upgrade Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a second calculator on the gotc-companion static site that, given a player's current Keep level, current per-building levels, target Keep level, and bonus percentages, displays total resource costs, total build time, and an optional per-building breakdown.

**Architecture:** Static HTML + vanilla JS, no build step. Two HTML pages (`index.html`, `keep-upgrade.html`) share an extracted `styles.css` and a shared nav strip. The new calculator's data lives in `keep-data.js` (`COSTS` and `PREREQS` tables) and its calculation engine lives in `keep-calc.js` as a pure function `computeUpgradePlan()` that works in both Node and the browser. Engine has unit tests via Node's built-in `node:test`.

**Tech Stack:** HTML5, vanilla JavaScript (no framework, no bundler), CSS custom properties, Node 18+ for tests (no npm deps).

---

## Scope Check

Single calculator on a single page, with one supporting refactor (CSS extraction). No decomposition needed.

## File Structure

| File | Responsibility |
|---|---|
| `styles.css` | **Create.** All shared visual styles (palette, panels, sliders, inputs, stat cards, share component, nav). Extracted from current `index.html` `<style>` block plus new nav + builder-specific rules. |
| `index.html` | **Modify.** Remove inline `<style>` block, add `<link rel="stylesheet" href="styles.css">`, add shared nav strip at top of `.page`. Behavior unchanged. |
| `keep-upgrade.html` | **Create.** New calculator page. Same chrome as `index.html` (crest, title, panel). Goal/target inputs, building-levels grid, bonus inputs, headline totals, breakdown `<details>`, share link. Page-specific JS wires DOM to engine. |
| `keep-data.js` | **Create.** Two const objects: `COSTS[building][level] = {wood, food, stone, iron, brick, pine, keystone, valyrian, hours}` and `PREREQS[keepLevel] = {building: requiredLevel}`. Exports for both Node (`module.exports`) and browser (`globalThis`). Populated incrementally from user-provided screenshots. |
| `keep-calc.js` | **Create.** Pure function `computeUpgradePlan(input)` plus formatters (`formatNumber`, `formatHours`). Same dual export pattern. No DOM access. |
| `tests/keep-calc.test.js` | **Create.** `node:test`-based unit tests for the engine. Runs with `node --test tests/`. |
| `docs/superpowers/specs/2026-05-12-keep-upgrade-calculator-design.md` | Already created. The spec. |

---

## Task 1: Extract shared CSS to styles.css

**Files:**
- Create: `styles.css`
- Modify: `index.html` (replace inline `<style>...</style>` block with `<link>`)

- [ ] **Step 1: Copy current `<style>` block contents from `index.html` into a new `styles.css`**

Open `index.html`, find the `<style>` ... `</style>` block (lines ~11–480). Copy everything between (NOT including) the tags into a new file `styles.css` at the project root. Do not change any rule.

- [ ] **Step 2: Remove the inline `<style>` block from `index.html` and add a `<link>` to `styles.css`**

In `index.html`, delete the entire `<style>`...`</style>` block. In its place, immediately after the existing `<link href="https://fonts.googleapis.com/...">` line, add:

```html
<link rel="stylesheet" href="styles.css">
```

- [ ] **Step 3: Manually verify `index.html` still renders identically**

Open `index.html` in a browser (double-click, or `open index.html`). Compare visually to the live site or a screenshot. The Prestige Ledger must look pixel-identical to before. If anything looks different, the CSS extraction is wrong — fix before committing.

- [ ] **Step 4: Commit**

```bash
git add styles.css index.html
git commit -m "Extract shared styles to styles.css

No visual change. Preparing to share styling with the upcoming keep
upgrade calculator page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add shared nav strip to both calculator pages

**Files:**
- Modify: `styles.css` (append nav rules)
- Modify: `index.html` (add nav HTML at top of `.page`)

- [ ] **Step 1: Append nav styles to `styles.css`**

Append at the end of `styles.css`:

```css
/* Shared nav */
.nav {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.nav a {
  color: var(--gold-faint);
  text-decoration: none;
  border-bottom: 1px dashed transparent;
  padding-bottom: 2px;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.nav a:hover {
  color: var(--gold);
  border-bottom-color: var(--gold-dark);
}
.nav a.current {
  color: var(--gold-bright);
  border-bottom-color: var(--gold-deep);
}
```

- [ ] **Step 2: Insert nav HTML at the top of `.page` in `index.html`**

In `index.html`, find `<div class="page">` and insert immediately after it (before the existing `<div class="crest">` line):

```html
  <nav class="nav">
    <a href="index.html" class="current">Prestige Ledger</a>
    <a href="keep-upgrade.html">Night's Watch: The Builders</a>
  </nav>
```

- [ ] **Step 3: Verify in browser**

Reload `index.html`. A two-link nav row appears at the top. "Prestige Ledger" is gold-bright; "Night's Watch: The Builders" is dim. Clicking the second link 404s — that's expected; we build it next.

- [ ] **Step 4: Commit**

```bash
git add styles.css index.html
git commit -m "Add shared nav strip linking the two calculators

Second link is dead until keep-upgrade.html lands.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create `keep-calc.js` engine — empty plan when target ≤ current (TDD)

**Files:**
- Create: `keep-calc.js`
- Create: `tests/keep-calc.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/keep-calc.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/keep-calc.test.js`
Expected: FAIL with "Cannot find module '../keep-calc.js'" or similar.

- [ ] **Step 3: Write the minimal implementation**

Create `keep-calc.js`:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RESOURCE_KEYS = ['wood', 'food', 'stone', 'iron', 'brick', 'pine', 'keystone', 'valyrian'];

  function zeroTotals() {
    const t = { hours: 0 };
    for (const k of RESOURCE_KEYS) t[k] = 0;
    return t;
  }

  function computeUpgradePlan(input) {
    const {
      currentKeep,
      targetKeep,
      currentBuildingLevels = {},
      bonusPctByResource = {},
      timeReductionPct = 0,
      costs = {},
      prereqs = {},
    } = input;

    const rows = [];
    const totalsBeforeBonus = zeroTotals();
    const totals = zeroTotals();

    if (targetKeep <= currentKeep) {
      return { rows, totalsBeforeBonus, totals };
    }

    // Implementation grows in later tasks.
    return { rows, totalsBeforeBonus, totals };
  }

  return { computeUpgradePlan, RESOURCE_KEYS };
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/keep-calc.test.js`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add keep-calc.js tests/keep-calc.test.js
git commit -m "Add keep-calc engine skeleton with empty-plan test

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Engine — single-level keep upgrade with no supporting buildings (TDD)

**Files:**
- Modify: `tests/keep-calc.test.js`
- Modify: `keep-calc.js`

- [ ] **Step 1: Add the failing test**

Append to `tests/keep-calc.test.js`:

```js
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
```

- [ ] **Step 2: Run, verify it fails**

Run: `node --test tests/keep-calc.test.js`
Expected: 1 PASS, 1 FAIL (assertion on `rows.length`).

- [ ] **Step 3: Implement keep row generation + totals summation**

In `keep-calc.js`, replace the body of `computeUpgradePlan` after the `if (targetKeep <= currentKeep)` early-return with:

```js
    const levels = Object.assign({}, currentBuildingLevels);

    function emitRow(building, fromLevel, toLevel) {
      const costsForLevel =
        costs[building] && costs[building][toLevel] ? costs[building][toLevel] : null;
      const row = {
        building,
        fromLevel,
        toLevel,
        costs: costsForLevel || zeroTotals(),
        missing: !costsForLevel,
      };
      rows.push(row);
      for (const k of RESOURCE_KEYS) totalsBeforeBonus[k] += row.costs[k] || 0;
      totalsBeforeBonus.hours += row.costs.hours || 0;
    }

    for (let k = currentKeep + 1; k <= targetKeep; k++) {
      emitRow('Keep', k - 1, k);
    }

    for (const r of RESOURCE_KEYS) {
      const pct = Math.min(1, Math.max(0, bonusPctByResource[r] || 0));
      totals[r] = totalsBeforeBonus[r] * (1 - pct);
    }
    const tPct = Math.min(1, Math.max(0, timeReductionPct || 0));
    totals.hours = totalsBeforeBonus.hours * (1 - tPct);

    return { rows, totalsBeforeBonus, totals };
```

- [ ] **Step 4: Run, verify PASS**

Run: `node --test tests/keep-calc.test.js`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add keep-calc.js tests/keep-calc.test.js
git commit -m "Engine: emit keep rows and sum totals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Engine — supporting-building prereqs (TDD)

**Files:**
- Modify: `tests/keep-calc.test.js`
- Modify: `keep-calc.js`

- [ ] **Step 1: Add the failing test**

Append to `tests/keep-calc.test.js`:

```js
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
```

- [ ] **Step 2: Run, verify it fails**

Run: `node --test tests/keep-calc.test.js`
Expected: previous tests PASS, new test FAILS.

- [ ] **Step 3: Implement prereq walking**

In `keep-calc.js`, inside the `for (let k = currentKeep + 1; k <= targetKeep; k++)` loop, after the `emitRow('Keep', k - 1, k)` line, add:

```js
      const req = prereqs[k] || {};
      for (const building of Object.keys(req)) {
        const required = req[building];
        const have = levels[building] != null ? levels[building] : 0;
        for (let lvl = have + 1; lvl <= required; lvl++) {
          emitRow(building, lvl - 1, lvl);
        }
        if (required > have) levels[building] = required;
      }
```

- [ ] **Step 4: Run, verify PASS**

Run: `node --test tests/keep-calc.test.js`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add keep-calc.js tests/keep-calc.test.js
git commit -m "Engine: walk prereqs for supporting buildings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Engine — bonus application and missing-data flag (TDD)

**Files:**
- Modify: `tests/keep-calc.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `tests/keep-calc.test.js`:

```js
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
```

- [ ] **Step 2: Run, verify all PASS**

Run: `node --test tests/keep-calc.test.js`
Expected: 6 PASS. (Behavior is already implemented in Tasks 3–5; these tests pin it down.)

- [ ] **Step 3: Commit**

```bash
git add tests/keep-calc.test.js
git commit -m "Engine tests: bonus application, missing-data, clamping

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Add formatters to `keep-calc.js`

**Files:**
- Modify: `keep-calc.js`
- Modify: `tests/keep-calc.test.js`

- [ ] **Step 1: Add failing tests for formatters**

Append to `tests/keep-calc.test.js`:

```js
const { formatNumber, formatHours, formatResource } = require('../keep-calc.js');

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
```

- [ ] **Step 2: Run, verify failure**

Run: `node --test tests/keep-calc.test.js`
Expected: 6 PASS, 3 FAIL (functions not exported).

- [ ] **Step 3: Add formatters and export them**

In `keep-calc.js`, before `return { computeUpgradePlan, RESOURCE_KEYS };` add:

```js
  function formatNumber(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  function formatResource(n) {
    if (n < 1_000_000) return formatNumber(n);
    return (n / 1_000_000).toFixed(3) + 'M';
  }

  function formatHours(hoursFloat) {
    const totalMinutes = Math.round(hoursFloat * 60);
    if (totalMinutes <= 0) return '0m';
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
```

And change the return line to:

```js
  return { computeUpgradePlan, RESOURCE_KEYS, formatNumber, formatResource, formatHours };
```

- [ ] **Step 4: Run, verify PASS**

Run: `node --test tests/keep-calc.test.js`
Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add keep-calc.js tests/keep-calc.test.js
git commit -m "Engine: add number / resource / hours formatters

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Create `keep-data.js` skeleton

**Files:**
- Create: `keep-data.js`

- [ ] **Step 1: Write the file**

Create `keep-data.js`:

```js
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
```

- [ ] **Step 2: Quick sanity check**

Run: `node -e "const d = require('./keep-data.js'); console.log(Object.keys(d));"`
Expected output: `[ 'COSTS', 'PREREQS' ]`

- [ ] **Step 3: Commit**

```bash
git add keep-data.js
git commit -m "Add empty keep-data.js with COSTS/PREREQS schema

Tables to be populated from in-game chart screenshots.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Scaffold `keep-upgrade.html`

**Files:**
- Create: `keep-upgrade.html`
- Modify: `styles.css` (append builder-specific rules)

- [ ] **Step 1: Append builder-specific styles to `styles.css`**

Append:

```css
/* Builder-specific */
.bonus-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.breakdown {
  margin-top: 1.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 0.85rem 1rem;
}
.breakdown summary {
  cursor: pointer;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--gold);
  list-style: none;
}
.breakdown summary::-webkit-details-marker { display: none; }
.breakdown summary::before { content: "▸  "; color: var(--gold-dark); }
.breakdown[open] summary::before { content: "▾  "; }
.breakdown table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.75rem;
  font-family: 'Cormorant Garamond', serif;
  font-size: 14px;
}
.breakdown th, .breakdown td {
  padding: 6px 8px;
  text-align: right;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
.breakdown th {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--gold-dim);
  text-align: right;
}
.breakdown th:first-child, .breakdown td:first-child,
.breakdown th:nth-child(2), .breakdown td:nth-child(2) { text-align: left; }
.breakdown tr.missing td { color: var(--blood); font-style: italic; }
.error-text { color: #c25656; font-style: italic; font-size: 13px; margin: 6px 0 0; }
.bonus-apply-all {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
}
.bonus-apply-all label {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gold-dim);
  flex: 0 0 auto;
}
.bonus-apply-all input {
  background: var(--bg-deep);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  color: var(--gold-bright);
  padding: 6px 10px;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 14px;
  text-align: right;
  width: 100px;
}
```

- [ ] **Step 2: Create `keep-upgrade.html`**

Create `keep-upgrade.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Night's Watch: The Builders — GoT Conquest Calculator</title>
<meta name="description" content="A calculator for the resource and time cost of upgrading your Keep in Game of Thrones: Conquest.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body>

<div class="page">

  <nav class="nav">
    <a href="index.html">Prestige Ledger</a>
    <a href="keep-upgrade.html" class="current">Night's Watch: The Builders</a>
  </nav>

  <div class="crest">⚔ ✦ ⚔</div>
  <h1 class="title">Night's Watch: The Builders</h1>
  <p class="subtitle">Brothers of the Wall reckon the stones of a Keep</p>

  <div class="panel" id="wrap">

    <h2>Goal &amp; Target</h2>
    <div class="row">
      <label>Current keep level</label>
      <input type="text" inputmode="numeric" class="val-input" id="ck-out" data-field="currentKeep" value="15" style="flex: 1 1 auto;" />
    </div>
    <div class="row">
      <label>Target keep level</label>
      <input type="text" inputmode="numeric" class="val-input" id="tk-out" data-field="targetKeep" value="17" style="flex: 1 1 auto;" />
    </div>
    <p class="error-text" id="goal-error" hidden>Target must be ≥ current.</p>

    <div class="divider"></div>

    <h2>Current Building Levels</h2>
    <p class="inv-hint">Each defaults to current keep level − 1 (i.e. fully built for your current keep). Adjust only the buildings you've fallen behind on.</p>
    <div class="inventory-grid" id="buildings-grid"></div>

    <div class="divider"></div>

    <h2>Construction Cost Reduction</h2>
    <div class="bonus-apply-all">
      <label>Apply to all (%)</label>
      <input type="text" inputmode="numeric" id="bonus-apply-all" placeholder="0" />
    </div>
    <div class="bonus-grid" id="bonus-grid"></div>

    <div class="divider"></div>

    <h2>Construction Time Reduction</h2>
    <div class="row">
      <label>Time reduction (%)</label>
      <input type="text" inputmode="numeric" class="val-input" id="tr-out" data-field="timeReductionPct" value="0" style="flex: 1 1 auto;" />
    </div>

    <div class="divider"></div>

    <h2>Totals</h2>
    <div class="stats-grid" id="totals-grid"></div>

    <details class="breakdown" id="breakdown">
      <summary>Per-building breakdown</summary>
      <div id="breakdown-body"></div>
    </details>

    <div class="share">
      <span class="share-label">Shareable link</span>
      <input type="text" id="share-url" readonly />
      <button id="copy-btn" type="button">Copy</button>
    </div>

    <div class="footnote">
      Resource bonuses apply per resource; time bonus is separate. Rows shown in red indicate cost data not yet transcribed.
    </div>

  </div>

  <footer>
    <p>Forged in fire &amp; vanilla JavaScript · <a href="https://github.com/macaugh/gotc-companion" target="_blank" rel="noopener">view source</a></p>
  </footer>

</div>

<script src="keep-calc.js"></script>
<script src="keep-data.js"></script>
<script src="keep-upgrade.js"></script>
</body>
</html>
```

- [ ] **Step 3: Manually verify in browser**

Open `keep-upgrade.html`. The page renders with nav (Night's Watch link gold-bright), title, the four input sections, two empty grids (buildings + bonuses), an empty totals grid, a collapsed breakdown, and the share box. Nothing is wired yet — text inputs accept text but nothing updates. That's expected.

- [ ] **Step 4: Commit**

```bash
git add keep-upgrade.html styles.css
git commit -m "Scaffold keep-upgrade.html with empty panels

Wiring follows in subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Create `keep-upgrade.js` wiring — state, URL, dynamic building grid

**Files:**
- Create: `keep-upgrade.js`

- [ ] **Step 1: Write the initial wiring file**

Create `keep-upgrade.js`:

```js
(function () {
  const RESOURCE_KEYS = ['wood', 'food', 'stone', 'iron', 'brick', 'pine', 'keystone', 'valyrian'];
  const RESOURCE_LABELS = {
    wood: 'Wood', food: 'Food', stone: 'Stone', iron: 'Iron',
    brick: 'Brick', pine: 'Pine', keystone: 'Keystone', valyrian: 'Valyrian Stone',
  };
  const KEEP_MIN = 10;
  const KEEP_MAX = 40;

  const state = {
    currentKeep: 15,
    targetKeep: 17,
    buildingLevels: {},        // { Wall: 14, ... }
    bonusPctByResource: {},    // { wood: 0.42, ... }, values 0..1
    timeReductionPct: 0,       // 0..1
  };

  function buildingsFromPrereqs() {
    const set = new Set();
    const PREREQS = globalThis.PREREQS || {};
    for (const k of Object.keys(PREREQS)) {
      for (const b of Object.keys(PREREQS[k])) set.add(b);
    }
    return Array.from(set).sort();
  }

  function parseIntSafe(raw) {
    if (raw == null) return null;
    const cleaned = String(raw).replace(/[,\s%]/g, '');
    if (cleaned === '' || cleaned === '-') return null;
    const n = parseInt(cleaned, 10);
    return Number.isNaN(n) ? null : n;
  }

  function clampKeep(n) {
    return Math.max(KEEP_MIN, Math.min(KEEP_MAX, n));
  }

  function clampPct(n) {
    return Math.max(0, Math.min(100, n));
  }

  function renderBuildingsGrid() {
    const buildings = buildingsFromPrereqs();
    const grid = document.getElementById('buildings-grid');
    grid.innerHTML = '';
    if (buildings.length === 0) {
      grid.innerHTML = '<p class="inv-hint" style="grid-column: 1 / -1;">No building data loaded yet.</p>';
      return;
    }
    const defaultLevel = Math.max(KEEP_MIN - 1, state.currentKeep - 1);
    for (const name of buildings) {
      if (state.buildingLevels[name] == null) state.buildingLevels[name] = defaultLevel;
      const card = document.createElement('div');
      card.className = 'inv-card';
      const safeId = 'b-' + name.replace(/[^a-zA-Z0-9]/g, '-');
      card.innerHTML = `
        <label>${name}</label>
        <input type="text" inputmode="numeric" id="${safeId}" data-building="${name}" value="${state.buildingLevels[name]}" />
      `;
      grid.appendChild(card);
    }
    grid.querySelectorAll('input[data-building]').forEach(input => {
      input.addEventListener('input', () => {
        const n = parseIntSafe(input.value);
        if (n == null || n < 0) { input.style.borderColor = 'var(--blood)'; return; }
        input.style.borderColor = '';
        state.buildingLevels[input.dataset.building] = n;
        recompute();
      });
    });
  }

  function renderBonusGrid() {
    const grid = document.getElementById('bonus-grid');
    grid.innerHTML = '';
    for (const r of RESOURCE_KEYS) {
      if (state.bonusPctByResource[r] == null) state.bonusPctByResource[r] = 0;
      const card = document.createElement('div');
      card.className = 'inv-card';
      card.innerHTML = `
        <label>${RESOURCE_LABELS[r]} (%)</label>
        <input type="text" inputmode="numeric" data-bonus="${r}" value="${Math.round(state.bonusPctByResource[r] * 100)}" />
      `;
      grid.appendChild(card);
    }
    grid.querySelectorAll('input[data-bonus]').forEach(input => {
      input.addEventListener('input', () => {
        const n = parseIntSafe(input.value);
        if (n == null) { input.style.borderColor = 'var(--blood)'; return; }
        input.style.borderColor = '';
        state.bonusPctByResource[input.dataset.bonus] = clampPct(n) / 100;
        recompute();
      });
    });
  }

  function renderTotals(plan) {
    const grid = document.getElementById('totals-grid');
    grid.innerHTML = '';
    for (const r of RESOURCE_KEYS) {
      const card = document.createElement('div');
      card.className = 'stat-card';
      const reduced = plan.totals[r];
      const original = plan.totalsBeforeBonus[r];
      const savedLine = original > reduced
        ? `<div class="stat-sub">was ${globalThis.formatResource(original)}</div>` : '';
      card.innerHTML = `
        <div class="stat-label">${RESOURCE_LABELS[r]}</div>
        <div class="stat-val">${globalThis.formatResource(reduced)}</div>
        ${savedLine}
      `;
      grid.appendChild(card);
    }
    const timeCard = document.createElement('div');
    timeCard.className = 'stat-card savings';
    const tSub = plan.totalsBeforeBonus.hours > plan.totals.hours
      ? `<div class="stat-sub">was ${globalThis.formatHours(plan.totalsBeforeBonus.hours)}</div>` : '';
    timeCard.innerHTML = `
      <div class="stat-label">Total time</div>
      <div class="stat-val">${globalThis.formatHours(plan.totals.hours)}</div>
      ${tSub}
    `;
    grid.appendChild(timeCard);
  }

  function renderBreakdown(plan) {
    const body = document.getElementById('breakdown-body');
    if (plan.rows.length === 0) {
      body.innerHTML = '<p class="inv-hint">No upgrades required.</p>';
      return;
    }
    const head = `
      <thead><tr>
        <th>Building</th><th>From → To</th>
        ${RESOURCE_KEYS.map(r => `<th>${RESOURCE_LABELS[r]}</th>`).join('')}
        <th>Time</th>
      </tr></thead>`;
    const rows = plan.rows.map(r => {
      const cls = r.missing ? ' class="missing"' : '';
      const cells = RESOURCE_KEYS.map(k => `<td>${r.missing ? '—' : globalThis.formatResource(r.costs[k] || 0)}</td>`).join('');
      const time = r.missing ? '—' : globalThis.formatHours(r.costs.hours || 0);
      return `<tr${cls}><td>${r.building}</td><td>${r.fromLevel} → ${r.toLevel}</td>${cells}<td>${time}</td></tr>`;
    }).join('');
    body.innerHTML = `<table>${head}<tbody>${rows}</tbody></table>`;
  }

  function validateGoal() {
    const err = document.getElementById('goal-error');
    if (state.targetKeep < state.currentKeep) {
      err.hidden = false;
      return false;
    }
    err.hidden = true;
    return true;
  }

  function buildUrl() {
    const params = new URLSearchParams();
    params.set('ck', state.currentKeep);
    params.set('tk', state.targetKeep);
    for (const b of Object.keys(state.buildingLevels)) {
      const def = Math.max(KEEP_MIN - 1, state.currentKeep - 1);
      if (state.buildingLevels[b] !== def) params.set('b.' + b, state.buildingLevels[b]);
    }
    for (const r of RESOURCE_KEYS) {
      const pct = Math.round((state.bonusPctByResource[r] || 0) * 100);
      if (pct !== 0) params.set('r.' + r, pct);
    }
    const tPct = Math.round((state.timeReductionPct || 0) * 100);
    if (tPct !== 0) params.set('tr', tPct);
    return window.location.origin + window.location.pathname + '?' + params.toString();
  }

  function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('ck')) state.currentKeep = clampKeep(parseIntSafe(params.get('ck')) ?? state.currentKeep);
    if (params.has('tk')) state.targetKeep = clampKeep(parseIntSafe(params.get('tk')) ?? state.targetKeep);
    for (const [key, val] of params.entries()) {
      if (key.startsWith('b.')) {
        const n = parseIntSafe(val);
        if (n != null && n >= 0) state.buildingLevels[key.slice(2)] = n;
      } else if (key.startsWith('r.')) {
        const n = parseIntSafe(val);
        if (n != null) state.bonusPctByResource[key.slice(2)] = clampPct(n) / 100;
      } else if (key === 'tr') {
        const n = parseIntSafe(val);
        if (n != null) state.timeReductionPct = clampPct(n) / 100;
      }
    }
  }

  function recompute() {
    if (!validateGoal()) {
      document.getElementById('totals-grid').innerHTML = '';
      document.getElementById('breakdown-body').innerHTML = '';
      document.getElementById('share-url').value = buildUrl();
      return;
    }
    const plan = globalThis.computeUpgradePlan({
      currentKeep: state.currentKeep,
      targetKeep: state.targetKeep,
      currentBuildingLevels: state.buildingLevels,
      bonusPctByResource: state.bonusPctByResource,
      timeReductionPct: state.timeReductionPct,
      costs: globalThis.COSTS || {},
      prereqs: globalThis.PREREQS || {},
    });
    renderTotals(plan);
    renderBreakdown(plan);
    document.getElementById('share-url').value = buildUrl();
  }

  function wireGoalInputs() {
    document.querySelectorAll('.val-input').forEach(input => {
      const field = input.dataset.field;
      input.addEventListener('input', () => {
        const n = parseIntSafe(input.value);
        if (n == null) { input.classList.add('invalid'); return; }
        input.classList.remove('invalid');
        if (field === 'currentKeep' || field === 'targetKeep') {
          state[field] = clampKeep(n);
        } else if (field === 'timeReductionPct') {
          state.timeReductionPct = clampPct(n) / 100;
        }
        recompute();
      });
    });
  }

  function wireApplyAll() {
    document.getElementById('bonus-apply-all').addEventListener('input', (e) => {
      const n = parseIntSafe(e.target.value);
      if (n == null) return;
      const pct = clampPct(n);
      for (const r of RESOURCE_KEYS) state.bonusPctByResource[r] = pct / 100;
      renderBonusGrid();
      recompute();
    });
  }

  function wireCopy() {
    document.getElementById('copy-btn').addEventListener('click', async () => {
      const btn = document.getElementById('copy-btn');
      const url = document.getElementById('share-url').value;
      try { await navigator.clipboard.writeText(url); }
      catch { const i = document.getElementById('share-url'); i.select(); document.execCommand('copy'); }
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
    });
  }

  // Init
  loadFromUrl();
  document.getElementById('ck-out').value = state.currentKeep;
  document.getElementById('tk-out').value = state.targetKeep;
  document.getElementById('tr-out').value = Math.round(state.timeReductionPct * 100);
  renderBuildingsGrid();
  renderBonusGrid();
  wireGoalInputs();
  wireApplyAll();
  wireCopy();
  recompute();
})();
```

- [ ] **Step 2: Manually verify in browser**

Open `keep-upgrade.html`. With empty `COSTS`/`PREREQS`:
- Buildings grid shows "No building data loaded yet."
- Bonus grid shows 8 inputs, all at 0.
- Totals grid renders 8 resource cards (all "0") + Total time card (0m).
- Changing the target keep updates the share URL.
- Setting target < current shows the red error message and clears totals.
- "Apply to all" sets every bonus input.

If anything throws in the console, fix it.

- [ ] **Step 3: Commit**

```bash
git add keep-upgrade.js
git commit -m "Wire keep-upgrade page to engine with empty data

Renders with placeholders until COSTS/PREREQS are populated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Seed `keep-data.js` with one verifiable chart for end-to-end smoke test

**Files:**
- Modify: `keep-data.js`

Goal: prove the full pipeline works with real numbers. The user has supplied a Keep-17 chart (see spec). We transcribe just that one chart so the page produces a verifiable result.

- [ ] **Step 1: Transcribe Keep-17 chart into `keep-data.js`**

Replace the contents of `COSTS` and `PREREQS` in `keep-data.js` with the following. (Resource columns that show "-" in the chart are stored as 0. Values displayed "in Mill." in the chart are multiplied to raw units; "in units" are stored as-is. Times converted to decimal hours.)

```js
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

const PREREQS = {
  17: { Wall: 16, Rookery: 16, Range: 16, Sawmill: 16,
        Shrine: 16, "Maester's Tower": 16, "Medic Tent": 16 },
};
```

(The Keep-17 chart in the spec also shows Shrine 13 and Maester's Tower 13. Those rows are tiny and not part of the Keep-17 chart's prereq chain — they belong to Keep-16's chart. Leave them out until Keep-16's chart is transcribed.)

- [ ] **Step 2: Open `keep-upgrade.html` with the smoke-test URL**

Open the page. Set Current keep = 16 and Target keep = 17. Every building defaults to level 15 (= currentKeep − 1). The buildings grid now shows seven inputs (Wall, Rookery, Range, Sawmill, Shrine, Maester's Tower, Medic Tent).

The Keep-17 prereq is `level 16` for every building, so the engine emits rows for each building going 15 → 16, plus Keep 16 → 17.

- [ ] **Step 3: Sanity check totals against the source chart**

Per the screenshot's Totals row: Wood 50.180M, Food 18.764M, Stone 2.713M, Iron 0.295M, Brick 3,748, Pine 1,557, Keystone 354, Valyrian 0, Time 20d 23h 37m.

Note that the screenshot's totals include Rookery 14, 15; Range 14, 15; Sawmill 14, 15; Shrine 14, 15; Maester's Tower 14, 15; Medic Tent 13, 14, 15 — i.e. it assumes the user starts those buildings well below 15. To match exactly, set the building levels in the UI to: Rookery 13, Range 13, Sawmill 13, Shrine 13, Maester's Tower 13, Medic Tent 12, then Current keep 16 → Target 17.

Verify: the headline numbers approximately match the chart's totals. (Small rounding differences are acceptable; gross mismatch means a transcription error to investigate.)

- [ ] **Step 4: Run engine tests one more time**

Run: `node --test tests/keep-calc.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add keep-data.js
git commit -m "Seed keep-data with Keep-17 chart for smoke test

One chart transcribed end-to-end to verify the full pipeline.
Remaining charts (Keep 10-16, 18-40) to be added incrementally.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final QA pass on the existing Prestige Ledger

**Files:** none modified (verification only)

- [ ] **Step 1: Open `index.html` in a browser and walk through the Prestige Ledger**

Verify:
- Nav strip renders at top, "Prestige Ledger" is gold-bright.
- All sliders, text inputs, and radio buttons behave as before.
- Calculations still produce the same numbers for a known input (e.g. defaults).
- Share URL still builds and copies.

This is a regression check on Task 1's CSS extraction. If anything is broken, fix in this task and commit.

- [ ] **Step 2: Cross-link sanity check**

From `index.html`, click "Night's Watch: The Builders" in the nav — it loads `keep-upgrade.html`. From there, click "Prestige Ledger" — it returns. Both nav links highlight correctly per page.

- [ ] **Step 3: Mobile viewport sanity check**

Resize the browser to ~375px wide. Both pages remain usable (panels stack, inputs reflow). The mobile rules in `styles.css` already cover this; just confirm.

- [ ] **Step 4: Commit if any fix was needed; otherwise no-op**

If you made any fixes:

```bash
git add -A
git commit -m "QA fixes for shared styles regression

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Out of scope for this plan

The following are explicitly **not** part of this implementation. Track separately if needed.

- Transcribing the remaining charts (Keep 10–16, 18–40). The data file grows incrementally as the user supplies screenshots. Each additional chart is a separate, mechanical commit following the pattern in Task 11.
- Categorized bonus inputs (gear / hero / research / building enhancement).
- Full gear modeling (slots, rarity tiers, levels).
- Cost of acquiring bonuses (forging gear, research nodes).
- Time-bonus categorization beyond a single combined %.
- Current resource stockpile inputs and "time-to-afford" projections.
- Keep levels 1–9.
