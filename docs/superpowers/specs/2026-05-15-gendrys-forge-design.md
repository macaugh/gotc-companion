# Gendry's Forge — Gear Crafting Calculator (Design)

A third calculator for the Laughing Cr0w's Companion site, alongside Prestige
Ledger and Night's Watch: The Builders. Plans gear crafting for **Lords gear**
(the data dump's `kind = standard`) given a player's House Level, desired
loadout, target quality, crafting-efficiency stats, and material inventory.

## Scope: phased delivery

| Phase | What it covers |
|---|---|
| **v1 (this spec)** | Cost + craft time + quality, for Lords gear only. No templates, no RNG quality prediction. |
| v2 (later) | Templates: required input per piece, gold price OR craft-from-lower-tier, and event-grant template inventory. |
| v3 (later) | RNG output quality prediction when input materials are mixed quality. |

Dragon gear and trinkets have meaningfully different systems (templates always
required for trinkets, dragon-specific properties, etc.) and are **expected to
become their own calculator pages** rather than feature in this one.

## Quality model

Six qualities, ascending: `poor`, `common`, `fine`, `exquisite`, `epic`,
`legendary` — colors white, green, blue, purple, orange, yellow respectively.

- **Material upgrade rule:** 4× quality `n` → 1× quality `n+1`. Therefore one
  legendary unit equals 4⁵ = 1024 poor units.
- **Crafted gear quality (v1):** equal to the uniform quality of input
  materials. If the user targets quality Q, the recipe demands its base
  `amount` of each ingredient *at quality Q*. The recipe amount itself does
  not scale with quality — only the type/quality of the materials changes.
- **Bonus values:** `gear_bonuses.csv` provides a `curve_json` array of six
  values per property on each piece. Index 0 = poor, …, 5 = legendary.

## House level → max craftable gear tier

Gear tiers are the set `[1, 5, 10, 15, 20, 25, 30, 35, 40, 45]`. A player's
max craftable tier is the largest tier ≤ their House Level:

```
max_tier(houseLvl) = max { t ∈ TIERS : t ≤ houseLvl }
```

Example: House 34 → max tier 30. House 35 → max tier 35.

## Page layout

`gendrys-forge.html`, themed with the existing `styles.css` (dark gold-on-black
panels) and added to the shared top-nav strip on all pages.

Sections, top to bottom:

1. **Goal & target**
   - House Level (number input or dropdown). Derived label: "Max craftable tier: N".
   - Mode toggle: **Loadout** vs **Queue**.
2. **Selection**
   - Loadout mode: a single Target Tier dropdown plus one piece-picker per
     equipment slot (6 slots). One global Target Quality dropdown.
   - Queue mode: a free list of rows; each row is `slot · tier · piece · quality`,
     plus add/remove buttons.
3. **Crafting efficiency**
   - Steel Crafting Efficiency % (divisor on material cost across all gear recipes).
   - Forge Time Efficiency % (divisor on craft time).
4. **Material inventory** — collapsible/expandable section (closed by default).
   Renders dynamically: one row per material used by the current selection,
   six numeric inputs per row (one per quality).
5. **Output**
   - **Totals table** (primary). Rows = pieces; columns = tier, quality, adjusted
     craft time, one column per material with adjusted cost. Each row has a
     "Bonuses" expand toggle that reveals a dropdown listing all properties on
     that piece with the value at the selected quality. Footer row = totals
     across all selected pieces.
   - "Craftable now?" indicator on the totals row: ✓ or ✗ with the specific
     shortfall (`need: 50 more mat_silk@epic`).
   - **Sequence view** (secondary, collapsible). Ordered craft plan with
     running inventory after each step. The first piece that can't be crafted
     from the running inventory is flagged.

## Math

```
// Cost: divisor model (matches Keep calc's resource efficiency)
adjusted_amount[m, p]  = ceil( recipe_amount[m, p]  / (1 + steelCraftEff) )

// Time: divisor model (matches Keep calc's construction speed)
adjusted_time[p]       = recipe_time[p] / (1 + forgeTimeEff)

// Totals: sum across pieces *after* per-row rounding (matches prior
// feedback applied to the Keep calc — rounding per row first, summing after,
// so totals match what the table shows).
totals_amount[m]       = Σ_p adjusted_amount[m, p]
totals_time            = Σ_p adjusted_time[p]

// Bonus values for a piece at the selected quality
bonus_value[p, prop]   = curve_json[p, prop][qualityIndex]

// Effective inventory at quality Q (upgrading lower-quality stock with 4→1)
effective_at(m, Q)     = floor( Σ_{q ≤ Q} inventory[m, q] / 4^(Q − q) )

// Craftable check (per piece, per material)
craftable(p)           = ∀ material m in recipe(p) :
                           effective_at(m, quality(p)) ≥ adjusted_amount[m, p]
```

**Notes:**

- Higher-quality inventory is **not** auto-downgraded. A legendary unit counts
  as one legendary unit, not 1024 poor units. (Players generally don't want
  to spend a legendary mat as a poor mat.)
- The `effective_at` upgrade formula consumes lower-quality stock to satisfy
  the target — it doesn't *actually* upgrade, but tells the player whether
  they could if they chose to.

## Data pipeline

A Node build script reads the CSV dumps in `gear-calc/` and emits
`gear-data.generated.js` (mirroring the existing `keep-data.generated.js`
pattern). v1 reads:

- `gear.csv` — id_name, slot, kind, tier (via join with `recipes_summary.csv`).
- `recipes_summary.csv` — per-piece recipe with `time_sec` and
  `ingredients_json` (the full ingredient list as JSON).
- `gear_bonuses.csv` — per-piece bonus properties with `curve_json` (6-element
  array indexed by quality).
- `equipment_slots.csv` — slot id → display name.
- `items.csv` — material id → display label.

The build script **filters to `kind = "standard"`** for v1, keeping the
generated file small. Dragon and trinket data are excluded until their own
calculators are built.

Output shape:

```js
export const TIERS     = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45];
export const QUALITIES = ['poor','common','fine','exquisite','epic','legendary'];
export const SLOTS     = { slot_Helmet: 'Helmet', /* … */ };
export const MATERIALS = { mat_silk: 'Silk', /* … */ };
export const GEAR      = {
  eq_standard_helmet_silkchapeau: {
    slot: 'slot_Helmet',
    tier: 30,
    recipe: {
      value: 18400000,
      time_sec: 64800,
      ingredients: [
        { mat: 'mat_silk', amount: 16000 },
        { mat: 'mat_leatherstrap', amount: 16000 },
        { mat: 'mat_milkofthepoppy', amount: 16000 },
      ],
    },
    bonuses: [
      { prop: 'property_infantryattack_gear', curve: [0.014,0.015,0.016,0.017,0.018,0.020] },
      // …
    ],
  },
  // …
};
```

`gear-data.generated.js` is generated output and must not be hand-edited;
regenerate via the script. The script is documented in the README alongside
the existing Keep-data build instructions.

## Code structure

```
gendrys-forge.html              — page markup
gendrys-forge.js                — DOM wiring + URL param encode/decode
gear-calc.js                    — pure engine: computeTotals, bonusesForPiece,
                                  effectiveInventoryAt, canCraft, floorToTier
gear-data.generated.js          — generated; do not hand-edit
scripts/build-gear-data.mjs     — Node script that emits gear-data.generated.js
tests/gear-calc.test.js         — Node --test suite for the engine
```

The engine module follows the same browser+Node pattern as `keep-calc.js`
(plain JS, no build step) so the test runner stays zero-dependency.

## URL parameters (shareable presets)

| Param | Meaning |
|---|---|
| `hl` | House level |
| `mode` | `loadout` or `queue` |
| `t` | Target tier (loadout mode) |
| `q` | Target quality, 0–5 (loadout mode) |
| `g.<slot>` | Selected `id_name` for that slot (loadout mode) |
| `qu` | Queue contents, comma-separated `slot:tier:piece:quality` quads |
| `se` | Steel Crafting Efficiency % |
| `fe` | Forge Time Efficiency % |
| `inv.<mat>.<q>` | Inventory amount for a given material at quality q |

Only params that diverge from defaults are emitted, mirroring the existing
calculators' approach.

## Testing

`tests/gear-calc.test.js` (Node `--test`, zero deps). Covers:

- `floorToTier` boundaries (house levels at, just below, and just above each tier).
- `computeTotals` rounding: per-row ceil, then sum.
- Forge-time divisor math.
- `effectiveInventoryAt`: upgrade conversions, including when some quality
  levels are absent.
- `canCraft`: positive case, single-material shortfall, multi-material shortfall.
- A spot-check fixture: one real piece from the data, verifying the engine
  output matches a hand-computed expected value.

## Out-of-scope items (explicit deferrals)

- **Templates.** Lords gear requires a template per piece. Templates have a
  quality, can be bought for gold, or crafted from a piece one tier down.
  v2 will add: template requirement per piece, gold cost option, lower-tier
  craft option, and an event-grant template inventory input.
- **RNG quality output.** If input materials are mixed quality, the output is
  RNG-weighted by quantity and value. v3 will model this probability.
- **Set bonuses.** `gear_set_bonuses.csv` exists but isn't surfaced in v1.
- **Auto-pick gear by bonus category** (e.g. "best steel-craft loadout").
  Deferred until at least v2 — needs a clear definition of "best" (max single
  property? balanced? per-slot greedy?).
- **Dragon and trinket gear.** Out of this calculator entirely; each likely
  warrants its own page.
