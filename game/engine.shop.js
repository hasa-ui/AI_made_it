// engine.shop.js — 購入処理
(function(){
  const runtime = window.EngineRuntime;
  if (!runtime) throw new Error('engine.runtime.js must be loaded before engine.shop.js');

  const C = runtime.C;

  function getLegacyExclusiveConflict(def, st){
    if (!def || !def.exclusiveGroup) return null;
    const src = st || runtime.state;
    return (C.LEGACY_DEFS || []).find(other=>{
      if (other.id === def.id) return false;
      if (other.exclusiveGroup !== def.exclusiveGroup) return false;
      return ((src.legacyNodes && src.legacyNodes[other.id]) || 0) > 0;
    }) || null;
  }

  runtime.buyUnitInternal = function(unitId, qty){
    const def = (C.UNIT_DEFS || []).find(d=>d.id === unitId);
    if (!def) return { ok:false, reason:'no_def' };
    if (!Number.isInteger(qty) || qty <= 0) return { ok:false, reason:'invalid_qty' };
    const activeChallenge = runtime.getActiveChallengeDef(runtime.state);
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.singleUnitOnly){
      for (const u of (C.UNIT_DEFS || [])){
        if (u.id === unitId) continue;
        if ((runtime.state.units[u.id] || 0) > 0) return { ok:false, reason:'challenge_unit_lock' };
      }
    }
    const owned = runtime.state.units[unitId] || 0;
    let totalCost = 0;
    for (let i=0; i<qty; i++) totalCost += runtime.unitCost(def, owned + i, runtime.state);
    if (runtime.state.gold < totalCost) return { ok:false, reason:'cost' };
    runtime.state.gold -= totalCost;
    runtime.state.units[unitId] = owned + qty;
    runtime.state.runStats = runtime.state.runStats || { currentRunUnitTypes:{}, currentRunUpgradeBuys:0 };
    runtime.state.runStats.currentRunUnitTypes = runtime.state.runStats.currentRunUnitTypes || {};
    runtime.state.runStats.currentRunUnitTypes[unitId] = (runtime.state.runStats.currentRunUnitTypes[unitId] || 0) + qty;
    runtime.invalidateAggCache();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, bought:qty, cost:totalCost };
  };

  runtime.buyMaxUnitsInternal = function(unitId){
    const def = (C.UNIT_DEFS || []).find(d=>d.id === unitId);
    if (!def) return { ok:false };
    const activeChallenge = runtime.getActiveChallengeDef(runtime.state);
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.singleUnitOnly){
      for (const u of (C.UNIT_DEFS || [])){
        if (u.id === unitId) continue;
        if ((runtime.state.units[u.id] || 0) > 0) return { ok:false, reason:'challenge_unit_lock' };
      }
    }
    const owned = runtime.state.units[unitId] || 0;
    const agg = runtime.getAggregates(runtime.state);
    const a1 = def.baseCost * Math.pow(def.costMult, owned) * (agg.costMult || 1);
    let n = 0;
    if (def.costMult > 1){
      const numerator = 1 + (runtime.state.gold * (def.costMult - 1) / a1);
      if (numerator > 1) n = Math.floor(Math.log(numerator) / Math.log(def.costMult));
    } else {
      n = Math.floor(runtime.state.gold / a1);
    }
    if (n < 0) n = 0;
    let exactCost = 0;
    let actualN = 0;
    const maxIterations = Number.isFinite(n) ? (n + 2) : 4096;
    for (let i=0; i<=maxIterations; i++){
      const c = runtime.unitCost(def, owned + i, runtime.state);
      if (!Number.isFinite(c) || !Number.isFinite(exactCost + c)) break;
      if (runtime.state.gold >= exactCost + c){
        exactCost += c;
        actualN++;
      } else {
        break;
      }
    }
    if (actualN > 0){
      runtime.state.gold -= exactCost;
      runtime.state.units[unitId] = owned + actualN;
      runtime.state.runStats = runtime.state.runStats || { currentRunUnitTypes:{}, currentRunUpgradeBuys:0 };
      runtime.state.runStats.currentRunUnitTypes = runtime.state.runStats.currentRunUnitTypes || {};
      runtime.state.runStats.currentRunUnitTypes[unitId] = (runtime.state.runStats.currentRunUnitTypes[unitId] || 0) + actualN;
      runtime.invalidateAggCache();
      runtime.recalcAndCacheGPS(runtime.state);
      return { ok:true, bought:actualN, cost:exactCost };
    }
    return { ok:false };
  };

  runtime.buyUpgradeInternal = function(upId){
    const activeChallenge = runtime.getActiveChallengeDef(runtime.state);
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.disableUpgrades) return { ok:false, reason:'challenge_lock' };
    const def = (C.UPGRADE_DEFS || []).find(u=>u.id === upId);
    if (!def) return { ok:false };
    const lvl = runtime.state.upgrades[upId] || 0;
    const cost = runtime.upgradeCostNextLevel(def, lvl);
    if (runtime.state.gold < cost) return { ok:false };
    runtime.state.gold -= cost;
    runtime.state.upgrades[upId] = lvl + 1;
    runtime.state.runStats = runtime.state.runStats || { currentRunUnitTypes:{}, currentRunUpgradeBuys:0 };
    runtime.state.runStats.currentRunUpgradeBuys = (runtime.state.runStats.currentRunUpgradeBuys || 0) + 1;
    runtime.invalidateAggCache();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, lvl:lvl + 1, cost };
  };

  runtime.buyMaxUpgradeInternal = function(upId){
    const activeChallenge = runtime.getActiveChallengeDef(runtime.state);
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.disableUpgrades) return { ok:false, reason:'challenge_lock' };
    const def = (C.UPGRADE_DEFS || []).find(u=>u.id === upId);
    if (!def) return { ok:false };
    const lvl = runtime.state.upgrades[upId] || 0;
    const a1 = def.baseCost * Math.pow(def.costMult, lvl);
    let n = 0;
    if (def.costMult > 1){
      const numerator = 1 + (runtime.state.gold * (def.costMult - 1) / a1);
      if (numerator > 1) n = Math.floor(Math.log(numerator) / Math.log(def.costMult));
    } else {
      n = Math.floor(runtime.state.gold / a1);
    }
    if (n < 0) n = 0;
    let exactCost = 0;
    let actualN = 0;
    const maxIterations = Number.isFinite(n) ? (n + 2) : 4096;
    for (let i=0; i<=maxIterations; i++){
      const c = runtime.upgradeCostNextLevel(def, lvl + i);
      if (!Number.isFinite(c) || !Number.isFinite(exactCost + c)) break;
      if (runtime.state.gold >= exactCost + c){
        exactCost += c;
        actualN++;
      } else {
        break;
      }
    }
    if (actualN > 0){
      runtime.state.gold -= exactCost;
      runtime.state.upgrades[upId] = lvl + actualN;
      runtime.state.runStats = runtime.state.runStats || { currentRunUnitTypes:{}, currentRunUpgradeBuys:0 };
      runtime.state.runStats.currentRunUpgradeBuys = (runtime.state.runStats.currentRunUpgradeBuys || 0) + actualN;
      runtime.invalidateAggCache();
      runtime.recalcAndCacheGPS(runtime.state);
      return { ok:true, bought:actualN, cost:exactCost };
    }
    return { ok:false };
  };

  runtime.canBuyLegacyInternal = function(legacyId, st){
    const src = st || runtime.state;
    const def = (C.LEGACY_DEFS || []).find(d=>d.id === legacyId);
    if (!def) return false;
    const lvl = src.legacyNodes[legacyId] || 0;
    if (lvl >= runtime.legacyMaxLevel(def, src)) return false;
    if (getLegacyExclusiveConflict(def, src)) return false;
    if (def.prereq && def.prereq.length){
      for (const p of def.prereq){
        const have = src.legacyNodes[p.id] || 0;
        if (have < (p.minLevel || 1)) return false;
      }
    }
    return src.legacy >= runtime.legacyCostForNextLevel(def, lvl, src);
  };

  runtime.attemptBuyLegacyInternal = function(legacyId, maxCount){
    const def = (C.LEGACY_DEFS || []).find(d=>d.id === legacyId);
    if (!def) return { ok:false, reason:'no_def' };
    let lvl = runtime.state.legacyNodes[legacyId] || 0;
    if (lvl >= runtime.legacyMaxLevel(def, runtime.state)) return { ok:false, reason:'max' };
    const exclusiveConflict = getLegacyExclusiveConflict(def, runtime.state);
    if (exclusiveConflict) return { ok:false, reason:'exclusive', conflictId:exclusiveConflict.id };
    if (def.prereq && def.prereq.length){
      for (const p of def.prereq){
        const have = runtime.state.legacyNodes[p.id] || 0;
        if (have < (p.minLevel || 1)) return { ok:false, reason:'prereq' };
      }
    }
    if (maxCount === 1){
      const cost = runtime.legacyCostForNextLevel(def, lvl, runtime.state);
      if (runtime.state.legacy < cost) return { ok:false, reason:'cost' };
      runtime.state.legacy -= cost;
      runtime.state.legacyNodes[legacyId] = lvl + 1;
      runtime.invalidateAggCache();
      runtime.recalcAndCacheGPS(runtime.state);
      return { ok:true, bought:1, cost };
    }
    const maxLevel = runtime.legacyMaxLevel(def, runtime.state);
    const remainingByCap = Number.isFinite(maxLevel) ? Math.max(0, maxLevel - lvl) : Infinity;
    const baseCost = runtime.legacyCostForNextLevel(def, lvl, runtime.state);
    if (!Number.isFinite(baseCost) || baseCost <= 0) return { ok:false, reason:'cost' };
    let possible = 0;
    let totalCost = 0;
    if (def.costMult === 1){
      possible = Math.floor(runtime.state.legacy / baseCost);
      if (Number.isFinite(remainingByCap)) possible = Math.min(possible, remainingByCap);
      totalCost = possible * baseCost;
    } else {
      const maxBuyChecks = Number.isFinite(remainingByCap) ? remainingByCap : 4096;
      let tmp = lvl;
      for (let i=0; i<maxBuyChecks; i++){
        const c = runtime.legacyCostForNextLevel(def, tmp, runtime.state);
        if (!Number.isFinite(c) || c <= 0) break;
        if (runtime.state.legacy >= totalCost + c){
          totalCost += c;
          tmp++;
          possible++;
        } else {
          break;
        }
      }
    }
    if (possible <= 0) return { ok:false, reason:'cost' };
    runtime.state.legacy -= totalCost;
    runtime.state.legacyNodes[legacyId] = lvl + possible;
    runtime.invalidateAggCache();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, bought:possible, cost:totalCost };
  };

  runtime.buyAscensionUpgradeInternal = function(id){
    const def = (C.ASC_UPGRADES || []).find(a=>a.id === id);
    if (!def) return { ok:false };
    let lvl = runtime.state.ascOwned[id] || 0;
    if (lvl <= 0 && def.type === 'special' && def.payload && def.payload.kind){
      for (const abyssDef of (C.ABYSS_UPGRADES || [])){
        if (abyssDef.type !== 'persistentUnlock') continue;
        if (!abyssDef.payload || abyssDef.payload.kind !== def.payload.kind) continue;
        if ((((runtime.state.abyss && runtime.state.abyss.upgrades) || {})[abyssDef.id]) || 0){
          lvl = 1;
          break;
        }
      }
    }
    if (lvl >= runtime.ascUpgradeMaxLevel(def, runtime.state)) return { ok:false, reason:'max' };
    if (runtime.state.ascPoints < def.cost) return { ok:false, reason:'cost' };
    runtime.state.ascPoints -= def.cost;
    runtime.state.ascOwned[id] = lvl + 1;
    runtime.invalidateAggCache();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, lvl:lvl + 1 };
  };

  runtime.buyCelestialUpgradeInternal = function(id){
    const def = (C.CELESTIAL_UPGRADES || []).find(x=>x.id === id);
    if (!def) return { ok:false, reason:'not_found' };
    const branchId = def.branch || 'shared';
    const activeBranchId = runtime.state.celestial && runtime.state.celestial.activeBranchId;
    if (branchId !== 'shared'){
      const branchStatus = runtime.getCelestialBranchStatus(runtime.state).find(x=>x.id === branchId);
      if (!branchStatus || !branchStatus.unlocked) return { ok:false, reason:'branch_locked' };
      if (activeBranchId !== branchId) return { ok:false, reason:'branch_mismatch' };
    }
    runtime.state.celestialOwned = runtime.state.celestialOwned || {};
    const lvl = runtime.state.celestialOwned[def.id] || 0;
    const maxLevel = (typeof def.maxLevel === 'number') ? def.maxLevel : Infinity;
    if (lvl >= maxLevel) return { ok:false, reason:'max' };
    const cost = def.cost || 0;
    if ((runtime.state.celestialPoints || 0) < cost) return { ok:false, reason:'cp' };
    runtime.state.celestialPoints -= cost;
    runtime.state.celestialOwned[def.id] = lvl + 1;
    runtime.invalidateAggCache();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, id:def.id, lvl:runtime.state.celestialOwned[def.id] };
  };

  runtime.selectCelestialBranchInternal = function(id){
    const branch = (C.CELESTIAL_BRANCHES || []).find(x=>x.id === id);
    if (!branch) return { ok:false, reason:'not_found' };
    const status = runtime.getCelestialBranchStatus(runtime.state).find(x=>x.id === id);
    if (!status || !status.unlocked) return { ok:false, reason:'locked' };
    runtime.state.celestial = runtime.state.celestial || { activeBranchId:null };
    runtime.state.celestial.activeBranchId = id;
    runtime.invalidateAggCache();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, id };
  };

  runtime.getAbyssUpgradeStatus = function(st){
    const src = st || runtime.state;
    src.abyss = src.abyss || { shards:0, resetCount:0, features:{}, upgrades:{} };
    src.abyss.features = src.abyss.features || {};
    src.abyss.upgrades = src.abyss.upgrades || {};
    return (C.ABYSS_UPGRADES || []).map(def=>{
      const unlocked = runtime.isAbyssUpgradeUnlocked(src, def);
      const lvl = src.abyss.upgrades[def.id] || 0;
      const maxLevel = runtime.abyssUpgradeMaxLevel(def);
      const cost = runtime.abyssUpgradeCost(def, lvl);
      const featureDef = def.unlockFeature ? (C.ABYSS_FEATURES && C.ABYSS_FEATURES[def.unlockFeature]) : null;
      return {
        id:def.id,
        name:def.name,
        role:def.role || 'その他',
        desc:def.desc,
        lvl,
        maxLevel,
        maxed: lvl >= maxLevel,
        cost,
        unlocked,
        unlockFeature:def.unlockFeature || null,
        unlockFeatureName: featureDef ? featureDef.name : null,
        unlockChallengeId: featureDef ? featureDef.unlockChallengeId : null,
        affordable: unlocked && lvl < maxLevel && (src.abyss.shards || 0) >= cost
      };
    });
  };

  runtime.buyAbyssUpgradeInternal = function(id){
    const def = (C.ABYSS_UPGRADES || []).find(x=>x.id === id);
    if (!def) return { ok:false, reason:'not_found' };
    if (!runtime.isAbyssUpgradeUnlocked(runtime.state, def)) return { ok:false, reason:'feature_locked' };
    runtime.state.abyss = runtime.state.abyss || { shards:0, resetCount:0, features:{}, upgrades:{} };
    runtime.state.abyss.features = runtime.state.abyss.features || {};
    runtime.state.abyss.upgrades = runtime.state.abyss.upgrades || {};
    const lvl = runtime.state.abyss.upgrades[def.id] || 0;
    const maxLevel = runtime.abyssUpgradeMaxLevel(def);
    if (lvl >= maxLevel) return { ok:false, reason:'max' };
    const cost = runtime.abyssUpgradeCost(def, lvl);
    if ((runtime.state.abyss.shards || 0) < cost) return { ok:false, reason:'shard' };
    runtime.state.abyss.shards -= cost;
    runtime.state.abyss.upgrades[def.id] = lvl + 1;
    runtime.invalidateAggCache();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, id:def.id, lvl:runtime.state.abyss.upgrades[def.id], cost };
  };
})();
