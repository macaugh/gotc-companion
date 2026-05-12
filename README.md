# Prestige Ledger

A live calculator for tracking house prestige gained from monster attacks in **Game of Thrones: Conquest**. Built as a single static HTML file with vanilla JavaScript — no build step, no dependencies, no tracking.

![Prestige Ledger preview](https://img.shields.io/badge/built_with-vanilla_JS-c9a961?style=flat-square) ![License: MIT](https://img.shields.io/badge/license-MIT-c9a961?style=flat-square)

## What it does

Given a prestige goal, the calculator works out:

- How many marches and full kills you need
- Total stamina required and the gold cost of buying it
- Number of dragon revives along the way and their gold cost
- Total gold to reach the goal
- Efficiency metric: gold spent per 1,000 prestige earned

All inputs are live sliders — adjust any input and every number updates immediately.

## Configurable inputs

**Goal & target**
- Prestige goal (100k – 10M)
- Prestige per march
- Marches per kill (1 – 5)
- Stamina per march (5, 10, 15, 20, 25)

**Stamina pack** (radio)
- 700 gold for 100 stamina (standard)
- 400 gold for 50 stamina (small)

**Your stamina pack inventory** (number inputs)
- 100-stamina packs owned
- 50-stamina packs owned
- 25-stamina packs owned
- 10-stamina packs owned

Inventory is spent largest-first against the total stamina needed; any remainder is bought from the selected gold pack.

**Dragon** (radio)
- Use dragon or no dragon
- Marches per revive
- Revive cost in gold

## Hosting on GitHub Pages

1. Create a new GitHub repository (e.g. `gotc-prestige-calc`).
2. Upload these files to the repo root.
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch" and **Branch** to `main` / `/ (root)`.
5. Save. After a minute or so, your calculator is live at:

   ```
   https://<your-username>.github.io/gotc-prestige-calc/
   ```

That's it. No build pipeline, no Actions, no config.

## Running it locally

Open `index.html` in any browser. That's the entire setup.

For development with auto-reload, any static file server works:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Shareable preset links

The calculator encodes all inputs into URL parameters, so you can share a link that opens the calculator pre-filled with a specific scenario. The "Copy" button in the share row grabs the current URL.

### URL parameters

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
| `i100`   | 100-stam packs owned | `i100=50`     |
| `i50`    | 50-stam packs owned  | `i50=20`      |
| `i25`    | 25-stam packs owned  | `i25=10`      |
| `i10`    | 10-stam packs owned  | `i10=5`       |

### Example shareable links

3 million prestige, level-35 monsters, full dragon use:
```
?goal=3000000&pres=5200&mk=5&sm=25&pack=standard&dragon=1&dm=6&rev=742
```

Same goal with 50× 100-stam and 20× 50-stam packs in your inventory:
```
?goal=3000000&pres=5200&mk=5&sm=25&pack=standard&dragon=1&dm=6&rev=742&i100=50&i50=20
```

5 million prestige, no dragon, small pack:
```
?goal=5000000&pres=5200&mk=5&sm=25&pack=small&dragon=0
```

## How the math works

Each march scores `prestige` toward the goal. Total marches needed is `ceil(goal / prestige)`, rounded up to the next whole kill (`ceil(rawMarches / marchesPerKill) * marchesPerKill`) since partial kills don't drop the creature.

Stamina is `marches × staminaPerMarch`. Stamina gold is `(stamina / packStam) × packGold`.

Dragon revives are `floor(marches / dragonMarchesPerRevive)` — the dragon completes a full march cycle before the revive is charged. Total gold sums stamina gold and revive gold.

## Customizing for other events

The defaults are tuned for the current level-35 monster event, but every input is a slider, so the calculator works for any monster level and pack pricing. If pack prices change, edit the `PACKS` object near the top of the `<script>` block in `index.html`:

```javascript
const PACKS = {
  standard: { gold: 700, stam: 100 },
  small:    { gold: 400, stam: 50 }
};
```

You can also add a new pack option by adding a new key to `PACKS` and a matching `.radio-opt` element in the HTML.

## License

MIT. See `LICENSE` for details. Game of Thrones: Conquest is © Warner Bros. Entertainment Inc. and Zynga Inc. This is an unofficial fan-made tool with no affiliation.
