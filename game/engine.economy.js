// engine.economy.js — aggregate / economy / GPS 計算
(function(){
  const runtime = window.EngineRuntime;
  if (!runtime) throw new Error('engine.runtime.js must be loaded before engine.economy.js');

  const C = runtime.C;

  runtime.computeLegacyAggregatesInternal = function(st){
    let globalMult = 1;
    let unitMults = {};
    let costMult = 1;
    let startingGoldBonus = 0;
    let startingUnits = {};
    let prestigeEffectAdd = 0;
    let flatGPS = 0;
    let challengeGoalMult = 1;
    let challengeStartGoldBonus = 0;
    let offlineGainMult = 1;

    for (const def of (C.LEGACY_DEFS || [])){
      const lvl = (st.legacyNodes && st.legacyNodes[def.id]) ? st.legacyNodes[def.id] : 0;
      if (lvl <= 0) continue;
      const p = def.payload || {};
      if (def.type === 'globalMult') globalMult *= Math.pow(1 + (p.multPerLevel || 0), lvl);
      if (def.type === 'unitMult') unitMults[p.unitId] = (unitMults[p.unitId] || 1) * Math.pow(1 + (p.multPerLevel || 0), lvl);
      if (def.type === 'costMult') costMult *= Math.pow(p.multPerLevel || 1, lvl);
      if (def.type === 'startGold') startingGoldBonus += (p.amountPerLevel || 0) * lvl;
      if (def.type === 'startUnit') startingUnits[p.unitId] = (startingUnits[p.unitId] || 0) + (p.amountPerLevel || 0) * lvl;
      if (def.type === 'prestigeEffectAdd') prestigeEffectAdd += (p.addPerLevel || 0) * lvl;
      if (def.type === 'flatGPS') flatGPS += (p.gpsPerLevel || 0) * lvl;
      if (def.type === 'challengeGoalMult') challengeGoalMult *= Math.pow(p.multPerLevel || 1, lvl);
      if (def.type === 'challengeStartGold') challengeStartGoldBonus += (p.amountPerLevel || 0) * lvl;
      if (def.type === 'offlineGainMult') offlineGainMult *= Math.pow(p.multPerLevel || 1, lvl);
    }

    for (const a of (C.ASC_UPGRADES || [])){
      const lvl = (st.ascOwned && st.ascOwned[a.id]) ? st.ascOwned[a.id] : 0;
      if (lvl <= 0) continue;
      if (a.type === 'globalMult') globalMult *= Math.pow(a.payload.mult || 1, lvl);
      if (a.type === 'flatGPS') flatGPS += (a.payload.gps || 0) * lvl;
      if (a.type === 'prestigeEffectAdd') prestigeEffectAdd += (a.payload.add || 0) * lvl;
      if (a.type === 'startGoldFlat') startingGoldBonus += (a.payload.gold || 0) * lvl;
    }

    for (const ach of (C.ACHIEVEMENTS || [])){
      if (!st.achievementsOwned || !st.achievementsOwned[ach.id]) continue;
      const b = ach.bonus || {};
      if (!b.type) continue;
      if (b.type === 'globalMult' && typeof b.mult === 'number') globalMult *= b.mult;
      if (b.type === 'flatGPS' && typeof b.gps === 'number') flatGPS += b.gps;
      if (b.type === 'startGold' && typeof b.amount === 'number') startingGoldBonus += b.amount;
      if (b.type === 'unitMult' && b.unitId && typeof b.mult === 'number') unitMults[b.unitId] = (unitMults[b.unitId] || 1) * b.mult;
      if (b.type === 'prestigeEffectAdd' && typeof b.add === 'number') prestigeEffectAdd += b.add;
      if (b.type === 'costMult' && typeof b.mult === 'number') costMult *= b.mult;
    }

    for (const layer of (C.PRESTIGE_LAYERS || [])){
      if ((st.prestigeEarnedTotal || 0) < (layer.need || 0)) continue;
      const b = layer.bonus || {};
      if (b.type === 'globalMult' && typeof b.mult === 'number') globalMult *= b.mult;
      if (b.type === 'flatGPS' && typeof b.gps === 'number') flatGPS += b.gps;
      if (b.type === 'startGold' && typeof b.amount === 'number') startingGoldBonus += b.amount;
      if (b.type === 'prestigeEffectAdd' && typeof b.add === 'number') prestigeEffectAdd += b.add;
      if (b.type === 'costMult' && typeof b.mult === 'number') costMult *= b.mult;
    }

    for (const layer of (C.CELESTIAL_LAYERS || [])){
      if ((st.ascEarnedTotal || 0) < (layer.need || 0)) continue;
      const b = layer.bonus || {};
      if (b.type === 'globalMult' && typeof b.mult === 'number') globalMult *= b.mult;
      if (b.type === 'flatGPS' && typeof b.gps === 'number') flatGPS += b.gps;
      if (b.type === 'startGold' && typeof b.amount === 'number') startingGoldBonus += b.amount;
      if (b.type === 'prestigeEffectAdd' && typeof b.add === 'number') prestigeEffectAdd += b.add;
      if (b.type === 'costMult' && typeof b.mult === 'number') costMult *= b.mult;
    }

    const activeBranchId = st && st.celestial ? st.celestial.activeBranchId : null;
    for (const cel of (C.CELESTIAL_UPGRADES || [])){
      const lvl = (st.celestialOwned && st.celestialOwned[cel.id]) ? st.celestialOwned[cel.id] : 0;
      if (lvl <= 0) continue;
      const branchId = cel.branch || 'shared';
      if (branchId !== 'shared' && branchId !== activeBranchId) continue;
      if (cel.type === 'globalMult') globalMult *= Math.pow(cel.payload.mult || 1, lvl);
      if (cel.type === 'flatGPS') flatGPS += (cel.payload.gps || 0) * lvl;
      if (cel.type === 'startGold') startingGoldBonus += (cel.payload.amount || 0) * lvl;
      if (cel.type === 'prestigeEffectAdd') prestigeEffectAdd += (cel.payload.add || 0) * lvl;
      if (cel.type === 'costMult') costMult *= Math.pow(cel.payload.mult || 1, lvl);
      if (cel.type === 'unitMult' && cel.payload.unitId) unitMults[cel.payload.unitId] = (unitMults[cel.payload.unitId] || 1) * Math.pow(cel.payload.mult || 1, lvl);
    }
    if (activeBranchId){
      const branch = (C.CELESTIAL_BRANCHES || []).find(x=>x.id === activeBranchId);
      const branchStatus = runtime.getCelestialBranchStatus(st).find(x=>x.id === activeBranchId);
      if (branch && branchStatus && branchStatus.unlocked){
        const b = branch.bonus || {};
        if (b.type === 'globalMult' && typeof b.mult === 'number') globalMult *= b.mult;
        if (b.type === 'flatGPS' && typeof b.gps === 'number') flatGPS += b.gps;
        if (b.type === 'startGold' && typeof b.amount === 'number') startingGoldBonus += b.amount;
        if (b.type === 'prestigeEffectAdd' && typeof b.add === 'number') prestigeEffectAdd += b.add;
        if (b.type === 'costMult' && typeof b.mult === 'number') costMult *= b.mult;
      }
    }

    const abyssShards = (st.abyss && st.abyss.shards) ? st.abyss.shards : 0;
    const abyssResetCount = (st.abyss && st.abyss.resetCount) ? st.abyss.resetCount : 0;
    if (abyssShards > 0){
      globalMult *= Math.pow(2.25, abyssShards);
      startingGoldBonus += abyssShards * 5.0e7;
      flatGPS += abyssShards * 2.0e6;
      costMult *= Math.pow(0.93, abyssShards);
    }

    for (const ab of (C.ABYSS_UPGRADES || [])){
      if (!runtime.isAbyssUpgradeUnlocked(st, ab)) continue;
      const lvl = (st.abyss && st.abyss.upgrades && st.abyss.upgrades[ab.id]) ? st.abyss.upgrades[ab.id] : 0;
      if (lvl <= 0) continue;
      if (ab.type === 'globalMult') globalMult *= Math.pow((ab.payload && ab.payload.multPerLevel) || 1, lvl);
      if (ab.type === 'costMult') costMult *= Math.pow((ab.payload && ab.payload.multPerLevel) || 1, lvl);
      if (ab.type === 'startGold') startingGoldBonus += ((ab.payload && ab.payload.amountPerLevel) || 0) * lvl;
      if (ab.type === 'startGoldPerAbyssReset') startingGoldBonus += ((ab.payload && ab.payload.amountPerReset) || 0) * lvl * abyssResetCount;
      if (ab.type === 'flatGPS') flatGPS += ((ab.payload && ab.payload.gpsPerLevel) || 0) * lvl;
      if (ab.type === 'flatGPSPerAbyssReset') flatGPS += ((ab.payload && ab.payload.gpsPerReset) || 0) * lvl * abyssResetCount;
      if (ab.type === 'prestigeEffectAdd') prestigeEffectAdd += ((ab.payload && ab.payload.addPerLevel) || 0) * lvl;
      if (ab.type === 'unitMult' && ab.payload && ab.payload.unitId){
        unitMults[ab.payload.unitId] = (unitMults[ab.payload.unitId] || 1) * Math.pow(ab.payload.multPerLevel || 1, lvl);
      }
    }

    const challengeRewards = runtime.getChallengeRewardSummary(st);
    globalMult *= challengeRewards.globalMult;
    flatGPS += challengeRewards.flatGPS;
    startingGoldBonus += challengeRewards.startGold;
    prestigeEffectAdd += challengeRewards.prestigeEffectAdd;
    costMult *= challengeRewards.costMult;

    return {
      globalMult,
      unitMults,
      costMult,
      startingGoldBonus,
      startingUnits,
      prestigeEffectAdd,
      flatGPS,
      challengeGoalMult,
      challengeStartGoldBonus,
      offlineGainMult
    };
  };

  runtime.getAggregates = function(st){
    const src = st || runtime.state;
    if (src !== runtime.state) return runtime.computeLegacyAggregatesInternal(src);
    if (!runtime.aggCache || runtime.aggCacheDirty){
      runtime.aggCache = runtime.computeLegacyAggregatesInternal(runtime.state);
      runtime.aggCacheDirty = false;
    }
    return runtime.aggCache;
  };

  runtime.unitBaseCost = function(def, owned){ return Math.floor(def.baseCost * Math.pow(def.costMult, owned)); };
  runtime.unitCost = function(def, owned, st){
    const src = st || runtime.state;
    const agg = runtime.getAggregates(src);
    let cost = runtime.unitBaseCost(def, owned) * (agg.costMult || 1);
    const activeChallenge = runtime.getActiveChallengeDef(src);
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.costMult === 'number') cost *= activeChallenge.effects.costMult;
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.costRampByOwnedDiv === 'number' && activeChallenge.effects.costRampByOwnedDiv > 0){
      const totalOwned = Object.values(src.units || {}).reduce((acc, v)=>acc + (Number(v) || 0), 0);
      cost *= 1 + (totalOwned / activeChallenge.effects.costRampByOwnedDiv);
    }
    return Math.max(1, Math.floor(cost));
  };
  runtime.upgradeCostNextLevel = function(def, currentLevel){ return Math.floor(def.baseCost * Math.pow(def.costMult, currentLevel)); };

  runtime.computeBaseGPS = function(st){
    const src = st || runtime.state;
    const agg = runtime.getAggregates(src);
    let total = agg.flatGPS || 0;
    const activeChallenge = runtime.getActiveChallengeDef(src);
    let highestOwnedUnitId = null;
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.onlyHighestUnitProduces){
      for (const def of (C.UNIT_DEFS || [])){
        if ((src.units[def.id] || 0) > 0) highestOwnedUnitId = def.id;
      }
    }
    for (const def of (C.UNIT_DEFS || [])){
      const owned = src.units[def.id] || 0;
      if (highestOwnedUnitId && def.id !== highestOwnedUnitId) continue;
      let unitGps = def.baseGPS * owned;
      if (agg.unitMults && agg.unitMults[def.id]) unitGps *= agg.unitMults[def.id];
      for (const up of (C.UPGRADE_DEFS || [])){
        const ul = src.upgrades[up.id] || 0;
        if (ul <= 0) continue;
        if (up.type === 'unitMult' && up.payload.unitId === def.id) unitGps *= Math.pow(1 + (up.payload.multPerLevel || 0), ul);
      }
      total += unitGps;
    }
    let globalMult = 1;
    for (const up of (C.UPGRADE_DEFS || [])){
      const ul = src.upgrades[up.id] || 0;
      if (ul <= 0) continue;
      if (up.type === 'globalMult') globalMult *= Math.pow(1 + (up.payload.multPerLevel || 0), ul);
    }
    let out = total * globalMult * (agg.globalMult || 1);
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.globalMult === 'number') out *= activeChallenge.effects.globalMult;
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.globalMultPerOwned === 'number'){
      const totalOwned = Object.values(src.units || {}).reduce((acc, v)=>acc + (Number(v) || 0), 0);
      out *= Math.pow(activeChallenge.effects.globalMultPerOwned, totalOwned);
    }
    return out;
  };

  runtime.computePrestigeEffectPerPoint = function(st){
    return (C.BASE_PRESTIGE_EFFECT_PER_POINT || 0.05) + (runtime.getAggregates(st).prestigeEffectAdd || 0);
  };
  runtime.computePrestigeMult = function(st){
    const src = st || runtime.state;
    return 1 + (src.prestigeEarnedTotal || 0) * runtime.computePrestigeEffectPerPoint(src);
  };
  runtime.computeGPSFull = function(st){
    const src = st || runtime.state;
    return runtime.computeBaseGPS(src) * runtime.computePrestigeMult(src);
  };
  runtime.recalcAndCacheGPS = function(st){
    const src = st || runtime.state;
    src.gpsCache = runtime.computeGPSFull(src);
  };

  runtime.getUiEconomySnapshot = function(st){
    const src = st || runtime.state;
    const agg = runtime.getAggregates(src);
    const activeChallenge = runtime.getActiveChallengeDef(src);
    const snapshot = {
      totalGps: src.gpsCache || 0,
      nextUnitCosts: {},
      buy10Costs: {},
      nextUpgradeCosts: {},
      unitGpsById: {}
    };
    const unitUpgradeMults = {};
    let globalUpgradeMult = 1;
    for (const up of (C.UPGRADE_DEFS || [])){
      const ul = src.upgrades[up.id] || 0;
      if (ul <= 0) continue;
      if (up.type === 'unitMult' && up.payload && up.payload.unitId){
        unitUpgradeMults[up.payload.unitId] = (unitUpgradeMults[up.payload.unitId] || 1) * Math.pow(1 + (up.payload.multPerLevel || 0), ul);
      }
      if (up.type === 'globalMult') globalUpgradeMult *= Math.pow(1 + (up.payload.multPerLevel || 0), ul);
    }

    let challengeGlobalMult = 1;
    if (activeChallenge && activeChallenge.effects){
      if (typeof activeChallenge.effects.globalMult === 'number') challengeGlobalMult *= activeChallenge.effects.globalMult;
      if (typeof activeChallenge.effects.globalMultPerOwned === 'number'){
        const totalOwned = Object.values(src.units || {}).reduce((acc, v)=>acc + (Number(v) || 0), 0);
        challengeGlobalMult *= Math.pow(activeChallenge.effects.globalMultPerOwned, totalOwned);
      }
    }

    let highestOwnedUnitId = null;
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.onlyHighestUnitProduces){
      for (const def of (C.UNIT_DEFS || [])){
        if ((src.units[def.id] || 0) > 0) highestOwnedUnitId = def.id;
      }
    }

    const sharedUnitMult = (agg.globalMult || 1) * globalUpgradeMult * challengeGlobalMult;
    for (const def of (C.UNIT_DEFS || [])){
      const owned = src.units[def.id] || 0;
      snapshot.nextUnitCosts[def.id] = runtime.unitCost(def, owned, src);
      let c10 = 0;
      for (let i=0; i<10; i++) c10 += runtime.unitCost(def, owned + i, src);
      snapshot.buy10Costs[def.id] = c10;

      if (highestOwnedUnitId && def.id !== highestOwnedUnitId){
        snapshot.unitGpsById[def.id] = 0;
        continue;
      }
      let unitGps = def.baseGPS * owned;
      if (agg.unitMults && agg.unitMults[def.id]) unitGps *= agg.unitMults[def.id];
      if (unitUpgradeMults[def.id]) unitGps *= unitUpgradeMults[def.id];
      snapshot.unitGpsById[def.id] = unitGps * sharedUnitMult;
    }

    for (const def of (C.UPGRADE_DEFS || [])){
      snapshot.nextUpgradeCosts[def.id] = runtime.upgradeCostNextLevel(def, src.upgrades[def.id] || 0);
    }

    return snapshot;
  };
})();
