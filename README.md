# Laughing Cr0w's Companion

<img src="favicon.svg" alt="Laughing Cr0w" width="80" height="80" align="right" />

A growing toolkit of live calculators and planners for **Game of Thrones: Conquest**, named for the in-game tag `LaughingCr0w`. Built as plain HTML + vanilla JavaScript — no build step, no dependencies, no tracking. Each calculator is its own page, sharing a common dark/gold theme.

![Built with vanilla JS](https://img.shields.io/badge/built_with-vanilla_JS-c9a961?style=flat-square) ![License: MIT](https://img.shields.io/badge/license-MIT-c9a961?style=flat-square)

## What's inside

| Page | What it does |
|---|---|
| [**Prestige Ledger**](#prestige-ledger) (`index.html`) | Plan a prestige push: marches, stamina cost in gold, dragon revives, and total spend to reach a prestige goal. |
| [**Night's Watch: The Builders**](#nights-watch-the-builders) (`keep-upgrade.html`) | Plan a Keep upgrade: total resources and build time to take your Keep from one level to another, with cost-efficiency and time bonuses applied. |
| [**Gendry's Forge**](#gendrys-forge) (`gendrys-forge.html`) | Plan Lords-gear crafting: cost, time, and bonus values at a chosen quality, with material-inventory awareness. |

Both pages share a nav strip at the top, the same dark gold-on-black styling, and the favicon. State is encoded into the URL for sharing.

---

## Prestige Ledger

Given a prestige goal, the calculator works out:

- How many marches and full kills you need
- Total stamina required and the gold cost of buying it
- Number of dragon revives along the way and their gold cost
- Total gold to reach the goal
- Efficiency metric: gold spent per 1,000 prestige earned

All inputs are live sliders — adjust any input and every number updates immediately.

### Configurable inputs

**Goal & target**
- Prestige goal (100k – 10M)
- Prestige per march
- Marches per kill (1 – 5)
- Stamina per march (5, 10, 15, 20, 25)

**Stamina pack** (radio)
- 700 gold for 100 stamina (standard)
- 400 gold for 50 stamina (small)

**Your stamina pack inventory** (number inputs)
- 100/50/25/10-stamina packs owned

Inventory is spent largest-first against the total stamina needed; any remainder is bought from the selected gold pack.

**Dragon** (radio)
- Use dragon or no dragon
- Marches per revive
- Revive cost in gold

### Shareable preset links

The calculator encodes all inputs into URL parameters, so you can share a link that opens the calculator pre-filled with a specific scenario. The "Copy" button in the share row grabs the current URL.

| Param    | Meaning              | Example       |
|----------|----------------------|---------------|
| `goal`   | Prestige goal        | `goal=3000000` |
| `pres`   | Prestige per march   | `pres=5200`   |
| `mk`     | Marches per kill     | `mk=5`        |
| `sm`     | Stamina per march    | `sm=25`       |
| `pack`   | Stamina pack         | `pack=standard` / `pack=small` |
| `dragon` | Use dragon           | `dragon=1` / `dragon=0` |
| `dm`     | Marches per revive   | `dm=6`        |
| `rev`    | Revive cost in gold  | `rev=742`     |
| `i100` / `i50` / `i25` / `i10` | Owned stamina packs | `i100=50` |

Example: 3M prestige, level-35 monsters, full dragon use:
```
?goal=3000000&pres=5200&mk=5&sm=25&pack=standard&dragon=1&dm=6&rev=742
```

### Prestige math

Each march scores `prestige` toward the goal. Total marches needed is `ceil(goal / prestige)`, rounded up to the next whole kill since partial kills don't drop the creature. Stamina is `marches × staminaPerMarch`. Stamina gold is `(stamina / packStam) × packGold`. Dragon revives are `floor(marches / dragonMarchesPerRevive)`.

---

## Night's Watch: The Builders

Given a current Keep level and a target Keep level, the calculator works out the **complete** transitive set of building upgrades required and sums their costs across all eight resource types (Wood / Food / Stone / Iron / Brick / Soldier Pine / Keystone / Valyrian Stone) plus total build time.

### Configurable inputs

**Goal & target** — dropdowns for *Current keep level* and *Target keep level* (Keep 10–40).

**Current building levels** — a grid of every upgradeable building unlocked at your current Keep, defaulted to the minimum level required to be at that Keep. Bump any building higher if you've over-upgraded. The **Reset to minimum for Keep N** button snaps every input back to the computed minimum.

**Cost efficiency** — four percentage inputs matching the in-game `Building … Cost Efficiency` stats:
- Building Resource (wood/food/stone/iron/brick)
- Building Soldier Pine
- Building Keystone
- Building Valyrian Stone

Plus a **Flat wood reduction** input for gear that provides a flat (non-percentage) wood discount.

**Construction time** — Construction Speed (%) plus Free Build Time (hours + minutes) for hero/gear bonuses that subtract a flat amount.

### Cost math

Efficiency follows the in-game "+X% efficiency added" model, i.e. a divisor, not a subtractor:

```
total_cost_per_resource = base_cost / (1 + efficiency_added)
total_wood            = max(0, total_wood - flat_wood_reduction)
total_time            = max(0, base_time / (1 + construction_speed) - free_build_time)
```

So `+652% Construction Speed` shortens a 100-hour build to `100 / 7.523 ≈ 13.3` hours, not zero.

### Where the data comes from

`keep-data.generated.js` is extracted directly from the game's `BuildingTable.pb` + `BuildingProgressions.pb` static-data tables. Every (building, level) cost is the exact integer the game uses. **Do not hand-edit it** — regenerate.

The file exports three constants:
- `COSTS[building][level]` — raw integer costs + decimal hours
- `REQUIREMENTS[building]` — per-building prerequisite graph; `REQUIREMENTS[B] = [slot0, slot1?]` where each slot is indexed so `slot[X]` is the prereq for upgrading `B` from level X to X+1
- `BUILDINGS[name]` — metadata: `unlockLevel`, `upgradeable`, `maxLevel`

### URL parameters (selected)

| Param | Meaning |
|---|---|
| `ck` / `tk` | Current and target Keep level |
| `b.<Name>` | A building's current level (only emitted when above the computed minimum) |
| `e.resource` / `e.pine` / `e.keystone` / `e.valyrian` | Per-category efficiency % |
| `cs` | Construction Speed % |
| `fbt` | Free Build Time, decimal hours |
| `fw` | Flat wood reduction (raw units) |

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

---

## Running locally

Open any of the HTML files directly, or serve the directory:

```bash
python3 -m http.server 8765
# then visit http://localhost:8765/
```

## Tests

The Keep Upgrade engine and Gear Calc engine have unit-test suites using Node's built-in test runner (zero npm deps):

```bash
node --test tests/keep-calc.test.js
node --test tests/gear-calc.test.js
```

## Hosting on GitHub Pages

1. **Settings → Pages**.
2. Under "Build and deployment", set **Source** = "Deploy from a branch" and **Branch** = `main` / `/ (root)`.
3. Save. Your site is live at `https://<your-username>.github.io/<repo>/`.

No build pipeline, no Actions, no config.

## Project layout

```
index.html                 — Prestige Ledger calculator
keep-upgrade.html          — Night's Watch: The Builders calculator
gendrys-forge.html         — Gendry's Forge calculator page
styles.css                 — shared theme (palette, panels, nav, tables)
favicon.svg                — site icon (Laughing Cr0w sigil)
keep-calc.js               — keep-upgrade engine + formatters (pure JS, works in browser and Node)
keep-data.generated.js     — COSTS / REQUIREMENTS / BUILDINGS, extracted from the game's static data
keep-upgrade.js            — keep-upgrade page wiring (DOM ↔ engine)
gendrys-forge.js           — Gendry's Forge page wiring
gear-calc.js               — gear engine (pure JS, works in browser and Node)
gear-data.generated.js     — GEAR / MATERIALS / SLOTS / TIERS / QUALITIES
scripts/build-gear-data.mjs — emits gear-data.generated.js from gear-calc/*.csv
tests/keep-calc.test.js    — Node test suite for the keep upgrade engine
tests/gear-calc.test.js    — Node test suite for the gear engine
```

## License

MIT. See `LICENSE` for details. Game of Thrones: Conquest is © Warner Bros. Entertainment Inc. and Zynga Inc. This is an unofficial fan-made tool with no affiliation.
