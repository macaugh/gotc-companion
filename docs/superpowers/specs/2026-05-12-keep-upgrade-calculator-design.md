# Night's Watch: The Builders — Keep Upgrade Calculator

**Status:** Design approved 2026-05-12
**Scope:** v1 of a second calculator on the gotc-companion site, alongside the existing Prestige Ledger.

## Goal

Given a player's current Keep level, the current level of each supporting building, a target Keep level, and any construction-cost / construction-time bonuses they have active, show the total resources and total time required to reach the target — plus an optional per-building breakdown.

## Non-goals (v1)

- Modeling individual gear pieces, rarities (poor → epic), small-council hero choices, research nodes, or building enhancements that produce bonuses. v1 takes a single combined % per resource and a single combined % for time as direct inputs.
- Tracking the player's current resource stockpiles or deriving "time until you can afford it."
- Covering Keep levels 1–9. Early-game upgrades are trivial and many buildings aren't unlocked yet, which complicates the prereq model without adding user value.

## User input model

- **Current Keep level** — integer in 10–40.
- **Target Keep level** — integer in 10–40, must be ≥ current.
- **Current building levels** — one number per building defined in the dataset. Each defaults to `currentKeep − 1` (the typical fully-built state), so a maxed player only adjusts the buildings they've fallen behind on.
- **Per-resource construction-cost reduction %** — eight inputs, one per resource (Wood, Food, Stone, Iron, Brick, Pine, Keystone, Valyrian Stone). 0–100. Defaults 0. An "Apply to all" shortcut sets every box at once.
- **Construction-time reduction %** — single input, 0–100. Default 0.

## Output

- **Headline:** eight stat cards (one per resource) plus a "Total time" card (`Xd Yh Zm`).
- For any resource with a non-zero bonus, a "saved" sub-line shows pre-bonus → post-bonus.
- **Per-building breakdown** in a `<details>` element collapsed by default. Each row: `Building | From → To | Wood | Food | Stone | Iron | Brick | Pine | Keystone | Valyrian | Time`. Buildings with no required upgrades are omitted.
- **Shareable link** with state encoded in the query string, same pattern as Prestige Ledger.

## Data model

Two hardcoded tables in `keep-data.js`:

```js
// Cost to upgrade a building TO this level. Resource values stored as raw units
// (no "in millions" scaling); the formatter handles display.
const COSTS = {
  Keep:    { 17: { wood, food, stone, iron, brick, pine, keystone, valyrian, hours }, 16: {...}, ... },
  Wall:    { ... },
  Rookery: { ... },
  // ...one entry per building, populated as charts are transcribed
};

// To upgrade KEEP to level k, each listed building must be at least this level.
const PREREQS = {
  17: { Wall: 16, Rookery: 16, Range: 16, Sawmill: 16,
        Shrine: 16, "Maester's Tower": 16, "Medic Tent": 16 },
  16: { ... },
  // ...
};
```

`PREREQS` is stored explicitly even though current observed data is uniformly `keepLevel − 1` for every prereq building — cheap insurance against game updates and per-building variance.

The full building roster is not finalized in this spec; it will be discovered during data transcription. The schema accepts any building name as a string key.

Data range covered in v1: Keep levels 10–40. Transcription is incremental: the user pastes raw chart text/screenshots one chart at a time, and the implementer transcribes each row into `COSTS` (deduplicated across charts) and the per-keep prereqs into `PREREQS`.

## Calculation engine

A pure function in `keep-calc.js` with no DOM dependencies:

```js
computeUpgradePlan({
  currentKeep,
  targetKeep,
  currentBuildingLevels,    // { Wall: 14, Rookery: 13, ... }
  bonusPctByResource,       // { wood: 0.42, food: 0, stone: 0.42, ... } — 0..1
  timeReductionPct          // 0..1
}) → {
  rows:    [ { building, fromLevel, toLevel, costs: { wood, ..., hours }, missing? }, ... ],
  totalsBeforeBonus: { wood, food, stone, iron, brick, pine, keystone, valyrian, hours },
  totals:  { wood, food, stone, iron, brick, pine, keystone, valyrian, hours }
}
```

**Algorithm:**

1. Maintain a running `levels` map seeded from `currentBuildingLevels`.
2. For each keep level `k` from `currentKeep + 1` to `targetKeep`:
   a. Append a row upgrading **Keep** from `k − 1` to `k`, cost = `COSTS.Keep[k]`.
   b. For each `(building, requiredLevel)` in `PREREQS[k]`: while `levels[building] < requiredLevel`, append a row for the next level up (cost = `COSTS[building][levels[building] + 1]`) and increment `levels[building]`.
3. Sum each resource and `hours` across all rows → `totalsBeforeBonus`.
4. Apply per-resource bonus: `totals[r] = totalsBeforeBonus[r] * (1 - bonusPctByResource[r])`.
5. Apply time bonus: `totals.hours = totalsBeforeBonus.hours * (1 - timeReductionPct)`.

**Edge cases:**

- `targetKeep ≤ currentKeep` → empty `rows`, all totals zero.
- A `currentBuildingLevels[b]` higher than any prereq → that building contributes no rows. Not an error.
- Missing `COSTS[building][level]` entry → the row is still emitted with `missing: true` and zeroed costs; the UI surfaces a warning rather than silently undercounting.
- Unknown building name in `currentBuildingLevels` → ignored.
- Bonus inputs outside 0–100 → clamped. UI accepts percent values (0–100); the page wiring divides by 100 before passing to the engine, which works in 0..1 fractions.

## UI / page layout

New file `keep-upgrade.html` at site root, sharing styles with `index.html` via an extracted `styles.css`. Top-to-bottom structure:

1. **Shared nav strip** at the top of both pages: small Cinzel row with `Prestige Ledger · Night's Watch: The Builders`. Current page is `--gold-bright`; the other is a dim dashed-underline link.
2. **Header** — crest + `h1.title` "Night's Watch: The Builders" + italic subtitle (suggestion: "Brothers of the Wall reckon the stones of a Keep").
3. **Goal & Target panel** — two numeric inputs styled like the existing `.val-input` rows: *Current Keep level* and *Target Keep level*. Inline validation: `target < current` shows error state, totals zero out.
4. **Current building levels panel** — an `inventory-grid` of `inv-card`s, one per building in the dataset. Each defaults to `currentKeep − 1`.
5. **Construction-cost reduction panel** — eight `val-input` rows, one per resource. An "Apply to all" input at the top of the section sets every row at once.
6. **Construction-time reduction panel** — single `val-input` row, 0–100.
7. **Headline totals** — `.stats-grid` of nine `.stat-card`s (eight resources + Total time). For any resource with a non-zero bonus, the `.stat-sub` line shows the pre-bonus value strike-through. Total time card always shows pre-bonus value as sub-line when `timeReductionPct > 0`.
8. **Per-building breakdown** — a `<details>` element (collapsed by default) containing a table that mirrors the input chart format. Rows for `missing: true` entries are highlighted with a `--blood`-colored warning glyph.
9. **Share link** — same component and pattern as Prestige Ledger.
10. **Footnote** — short prose explaining that resource bonuses are applied per resource, time bonus is separate, and warning that flagged rows indicate data not yet transcribed.

## File layout

```
index.html             — existing Prestige Ledger (refactored to load shared styles.css and nav)
keep-upgrade.html      — new calculator page
styles.css             — extracted shared styles (palette, panels, sliders, stat cards, etc.)
keep-data.js           — COSTS and PREREQS tables (populated incrementally)
keep-calc.js           — pure computeUpgradePlan() function and helpers (formatters, etc.)
```

Both pages remain plain HTML + vanilla JS, no build step, hostable as static files. Inline `<script>` for page wiring is fine; data and calc engine are external `<script src>` for reuse and to keep page-specific markup readable.

## URL state

Query-string keys (terse, like Prestige Ledger):

- `ck` — currentKeep
- `tk` — targetKeep
- `b.<Building>` — current level of a building (only emitted when non-default)
- `r.<resource>` — per-resource cost reduction % (only emitted when non-zero)
- `tr` — time reduction % (only emitted when non-zero)

## Out-of-scope follow-ups (post-v1)

- Categorized bonus inputs (gear / hero / research / building enhancement) that sum into the per-resource totals.
- Full gear modeling with slots, rarity tiers, and levels.
- Cost of *acquiring* the bonuses themselves (gear forging, research nodes).
- Time-bonus categorization beyond a single combined %.
- Current stockpile inputs and "time-to-afford" projections.
- Keep levels 1–9.
