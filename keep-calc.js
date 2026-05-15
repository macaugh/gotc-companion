(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RESOURCE_KEYS = ['wood', 'food', 'stone', 'iron', 'brick', 'pine', 'keystone', 'valyrian'];

  const RESOURCE_TO_CATEGORY = {
    wood: 'resource', food: 'resource', stone: 'resource',
    iron: 'resource', brick: 'resource',
    pine: 'pine', keystone: 'keystone', valyrian: 'valyrian',
  };

  function zeroTotals() {
    const t = { hours: 0 };
    for (const k of RESOURCE_KEYS) t[k] = 0;
    return t;
  }

  // Compute the upgrade plan to take a player's Keep from currentKeep to
  // targetKeep, given the per-building requirement graph from the APK.
  //
  // REQUIREMENTS[building] = [slot0Array, slot1Array?] where each slot is an
  // array indexed so that slot[X] is the prerequisite to upgrade `building`
  // from level X to level X+1. Each entry is { building, level } or a falsy
  // placeholder meaning "no prereq for this step".
  function computeUpgradePlan(input) {
    const {
      currentKeep,
      targetKeep,
      currentBuildingLevels = {},
      efficiencyByCategory = {},
      constructionSpeedPct = 0,
      freeBuildTimeHours = 0,
      flatWoodReduction = 0,
      costs = {},
      requirements = {},
    } = input;

    const rows = [];
    const totalsBeforeBonus = zeroTotals();
    const totals = zeroTotals();

    if (targetKeep <= currentKeep) {
      return { rows, totalsBeforeBonus, totals };
    }

    const levels = Object.assign({}, currentBuildingLevels);
    if (levels.Keep == null) levels.Keep = currentKeep;

    function emitRow(building, fromLevel, toLevel) {
      const c = costs[building] && costs[building][toLevel] ? costs[building][toLevel] : null;
      const row = {
        building,
        fromLevel,
        toLevel,
        costs: c || zeroTotals(),
        missing: !c,
      };
      rows.push(row);
      for (const k of RESOURCE_KEYS) totalsBeforeBonus[k] += row.costs[k] || 0;
      totalsBeforeBonus.hours += row.costs.hours || 0;
    }

    const inProgress = new Set();
    function ensureLevel(building, target) {
      let have = levels[building] != null ? levels[building] : 0;
      while (have < target) {
        const key = building + ':' + (have + 1);
        if (!inProgress.has(key)) {
          inProgress.add(key);
          const reqs = requirements[building] || [];
          for (const slot of reqs) {
            if (!Array.isArray(slot)) continue;
            const req = slot[have]; // index `have` is the prereq for step have→have+1
            if (req && req.building && req.level > 0) {
              ensureLevel(req.building, req.level);
            }
          }
          inProgress.delete(key);
        }
        const nextLevel = have + 1;
        emitRow(building, have, nextLevel);
        levels[building] = nextLevel;
        have = nextLevel;
      }
    }

    ensureLevel('Keep', targetKeep);

    // Per-resource efficiency divisor (in-game "+X% Cost Efficiency" model)
    // applied per-building so the breakdown table reflects reduced costs.
    const effByResource = {};
    for (const r of RESOURCE_KEYS) {
      const category = RESOURCE_TO_CATEGORY[r];
      effByResource[r] = Math.max(0, efficiencyByCategory[category] || 0);
    }
    for (const row of rows) {
      row.adjustedCosts = {};
      for (const r of RESOURCE_KEYS) {
        row.adjustedCosts[r] = (row.costs[r] || 0) / (1 + effByResource[r]);
      }
    }

    // Flat wood reduction is a single pool: drain it across rows in order
    // so each row's wood floors at zero before the next row is affected.
    let flatWoodRemaining = Math.max(0, flatWoodReduction || 0);
    for (const row of rows) {
      if (flatWoodRemaining <= 0) break;
      const take = Math.min(flatWoodRemaining, row.adjustedCosts.wood);
      row.adjustedCosts.wood -= take;
      flatWoodRemaining -= take;
    }

    for (const r of RESOURCE_KEYS) {
      let sum = 0;
      for (const row of rows) sum += row.adjustedCosts[r];
      totals[r] = sum;
    }

    // Construction-speed divisor and free build time apply per-building: each
    // row's hours are divided by speed and then reduced by the flat free build
    // time, floored at zero. A row whose adjusted time is ≤ free build time
    // contributes zero to the total.
    const speed = Math.max(0, constructionSpeedPct || 0);
    const freeHours = Math.max(0, freeBuildTimeHours || 0);
    // Round each row to the minute (the display granularity), then sum, so
    // the total equals the sum of the per-building times shown in the table.
    let totalMinutes = 0;
    for (const row of rows) {
      const raw = row.costs.hours || 0;
      const adjusted = Math.max(0, raw / (1 + speed) - freeHours);
      const rounded = Math.round(adjusted * 60) / 60;
      row.adjustedHours = rounded;
      totalMinutes += Math.round(adjusted * 60);
    }
    totals.hours = totalMinutes / 60;

    return { rows, totalsBeforeBonus, totals };
  }

  // Returns the minimum level each non-Keep building must be at for a player
  // to be at Keep:targetKeep. Derived by replaying the REQUIREMENTS graph from
  // scratch — whatever level a building reaches in the walk IS its minimum.
  //
  // Cycle protection: at the game's initial state Keep:1 and Wall:1 mutually
  // require each other (both seeded at game start). If we'd re-enter
  // ensure(building, level) while it's already in flight up the call stack,
  // treat the prereq as satisfied and continue.
  function computeMinimumLevels(targetKeep, requirements) {
    const levels = {};
    const inProgress = new Set();
    function ensure(b, target) {
      let have = levels[b] != null ? levels[b] : 0;
      while (have < target) {
        const key = b + ':' + (have + 1);
        if (!inProgress.has(key)) {
          inProgress.add(key);
          const reqs = requirements[b] || [];
          for (const slot of reqs) {
            if (!Array.isArray(slot)) continue;
            const req = slot[have];
            if (req && req.building && req.level > 0) {
              ensure(req.building, req.level);
            }
          }
          inProgress.delete(key);
        }
        have++;
        levels[b] = have;
      }
    }
    if (targetKeep > 0) ensure('Keep', targetKeep);
    delete levels.Keep;
    return levels;
  }

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

  return { computeUpgradePlan, computeMinimumLevels, RESOURCE_KEYS, RESOURCE_TO_CATEGORY, formatNumber, formatResource, formatHours };
}));
