// engine.js — 修正版（state を内部に保持、SM.getState 呼び出しを排除）
// 依存: window.CONFIG (C), optional window.StateManager (SM)
// エクスポート: window.ENGINE (E)

(function(){
  const C = window.CONFIG || {};
  const SM = window.StateManager || null;

  // --- utilities ---
  function nowSec(){ return Date.now()/1000; }
  function deepCopy(o){ try { return JSON.parse(JSON.stringify(o)); } catch(e){ return Object.assign({}, o); } }

  // --- load initial state ---
  // StateManager があるなら loadState() または defaultState を使う。
  let state = null;
  if (SM && typeof SM.loadState === 'function'){
    try { state = SM.loadState(); } catch(e){ console.warn('StateManager.loadState() failed, fallback to default', e); }
  }
  if (!state){
    // Try to use SM.defaultState if available, else make a minimal default (shouldn't happen in normal split setup)
    if (SM && SM.defaultState) state = deepCopy(SM.defaultState);
    else {
      state = {
        version: 1,
        gold: (C.STARTING_GOLD || 50),
        units: (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{}),
        upgrades: (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{}),
        legacy: 0,
        legacyNodes: (C.LEGACY_DEFS || []).reduce((a,d)=>(a[d.id]=0,a),{}),
        totalGoldEarned: 0,
        lastSavedAt: nowSec(),
        gpsCache: 0,
        prestigeEarnedTotal: 0,
        ascPoints: 0,
        ascEarnedTotal: 0,
        ascOwned: (C.ASC_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{}),
        achievementsOwned: {},
        settings: { notation: 'compact', notationThreshold: 1000, confirmLegacyBuy:true, confirmLegacyBuyMax:true, toast:{achievement:true,offline:true,purchase:true,general:true} }
      };
    }
  }

  // --- cache for aggregates ---
  let aggCache = null;
  let aggCacheDirty = true;
  function invalidateAggCache(){ aggCacheDirty = true; aggCache = null; }

  // --- core aggregate computation (heavy) ---
  function computeLegacyAggregatesInternal(st){
    let globalMult=1, unitMults={}, costMult=1, startingGoldBonus=0, startingUnits={}, prestigeEffectAdd=0, flatGPS=0;
    const L = C.LEGACY_DEFS || [];
    for (const def of L){
      const lvl = (st.legacyNodes && st.legacyNodes[def.id]) ? st.legacyNodes[def.id] : 0;
      if (lvl <= 0) continue;
      const p = def.payload || {};
      if (def.type === 'globalMult') globalMult *= Math.pow(1 + (p.multPerLevel||0), lvl);
      if (def.type === 'unitMult') unitMults[p.unitId] = (unitMults[p.unitId]||1) * Math.pow(1 + (p.multPerLevel||0), lvl);
      if (def.type === 'costMult') costMult *= Math.pow(p.multPerLevel||1, lvl);
      if (def.type === 'startGold') startingGoldBonus += (p.amountPerLevel||0) * lvl;
      if (def.type === 'startUnit') startingUnits[p.unitId] = (startingUnits[p.unitId]||0) + (p.amountPerLevel||0) * lvl;
      if (def.type === 'prestigeEffectAdd') prestigeEffectAdd += (p.addPerLevel||0)*lvl;
      if (def.type === 'flatGPS') flatGPS += (p.gpsPerLevel||0) * lvl;
    }

    const A = C.ASC_UPGRADES || [];
    for (const a of A){
      const lvl = (st.ascOwned && st.ascOwned[a.id]) ? st.ascOwned[a.id] : 0;
      if (lvl <= 0) continue;
      if (a.type === 'globalMult') globalMult *= Math.pow(a.payload.mult||1, lvl);
      if (a.type === 'flatGPS') flatGPS += (a.payload.gps||0) * lvl;
      if (a.type === 'prestigeEffectAdd') prestigeEffectAdd += (a.payload.add||0) * lvl;
      if (a.type === 'startGoldFlat') startingGoldBonus += (a.payload.gold||0) * lvl;
    }

    // --- 実績の恒久ボーナスを適用 ---
    if (C.ACHIEVEMENTS && Array.isArray(C.ACHIEVEMENTS)) {
      for (const ach of C.ACHIEVEMENTS) {
        if (!st.achievementsOwned || !st.achievementsOwned[ach.id]) continue;
        const b = ach.bonus || {};
        if (!b.type) continue;
        if (b.type === 'globalMult' && typeof b.mult === 'number') globalMult *= b.mult;
        if (b.type === 'flatGPS' && typeof b.gps === 'number') flatGPS += b.gps;
        if (b.type === 'startGold' && typeof b.amount === 'number') startingGoldBonus += b.amount;
        if (b.type === 'unitMult' && b.unitId && typeof b.mult === 'number') unitMults[b.unitId] = (unitMults[b.unitId]||1) * b.mult;
        if (b.type === 'prestigeEffectAdd' && typeof b.add === 'number') prestigeEffectAdd += b.add;
        if (b.type === 'costMult' && typeof b.mult === 'number') costMult *= b.mult;
      }
    }
    // --------------------------------
    return { globalMult, unitMults, costMult, startingGoldBonus, startingUnits, prestigeEffectAdd, flatGPS };

  }

  function hasSpecialAscUpgrade(st, kind){
    const upgrades = C.ASC_UPGRADES || [];
    for (const def of upgrades){
      if (def.type !== 'special') continue;
      if (!def.payload || def.payload.kind !== kind) continue;
      if ((st.ascOwned && st.ascOwned[def.id] || 0) > 0) return true;
    }
    return false;
  }

  function getAggregates(st){
    // cache is keyed globally; callers must call invalidateAggCache() on state changes
    if (!aggCache || aggCacheDirty){
      aggCache = computeLegacyAggregatesInternal(st);
      aggCacheDirty = false;
    }
    return aggCache;
  }

  // --- cost / gps helpers ---
  function unitBaseCost(def, owned){ return Math.floor(def.baseCost * Math.pow(def.costMult, owned)); }
  function unitCost(def, owned, st){ const agg = getAggregates(st); return Math.floor(unitBaseCost(def, owned) * (agg.costMult || 1)); }
  function upgradeCostNextLevel(def, currentLevel){ return Math.floor(def.baseCost * Math.pow(def.costMult, currentLevel)); }
  function legacyCostForNextLevel(def, currentLevel){ if (currentLevel >= def.maxLevel) return Infinity; return Math.floor(def.baseCost * Math.pow(def.costMult, currentLevel)); }

  function computeBaseGPS(st){
    const agg = getAggregates(st);
    let total = agg.flatGPS || 0;
    const U = C.UNIT_DEFS || [];
    for (const def of U){
      const owned = st.units[def.id] || 0;
      let unitGps = def.baseGPS * owned;
      if (agg.unitMults && agg.unitMults[def.id]) unitGps *= agg.unitMults[def.id];
      for (const up of (C.UPGRADE_DEFS||[])){
        const ul = st.upgrades[up.id]||0; if (ul<=0) continue;
        if (up.type === 'unitMult' && up.payload.unitId === def.id) unitGps *= Math.pow(1 + (up.payload.multPerLevel||0), ul);
      }
      total += unitGps;
    }
    let globalMult = 1;
    for (const up of (C.UPGRADE_DEFS||[])){
      const ul = st.upgrades[up.id]||0; if (ul<=0) continue;
      if (up.type === 'globalMult') globalMult *= Math.pow(1 + (up.payload.multPerLevel||0), ul);
    }
    return total * globalMult * (agg.globalMult || 1);
  }

  function computePrestigeEffectPerPoint(st){
    return (C.BASE_PRESTIGE_EFFECT_PER_POINT || 0.05) + (getAggregates(st).prestigeEffectAdd || 0);
  }
  function computePrestigeMult(st){
    return 1 + (st.prestigeEarnedTotal || 0) * computePrestigeEffectPerPoint(st);
  }
  function computeGPSFull(st){ return computeBaseGPS(st) * computePrestigeMult(st); }
  function recalcAndCacheGPS(st){ st.gpsCache = computeGPSFull(st); }

  // --- offline progress ---
  function applyOfflineProgressWithToast(){
    const now = nowSec();
    const elapsed = Math.min(now - (state.lastSavedAt || now), (C.MAX_OFFLINE_SECONDS || 60*60*24));
    if (elapsed > 1){
      recalcAndCacheGPS(state);
      const gain = state.gpsCache * elapsed;
      state.gold += gain;
      state.totalGoldEarned += gain;
      state.lastSavedAt = now;
      // don't auto-save here; caller (UI) may call SM.saveState if desired.
      return { gain, elapsed };
    }
    return null;
  }

  // --- purchase internals (operate on internal `state`) ---
  function buyUnitInternal(unitId, qty){
    const def = (C.UNIT_DEFS||[]).find(d=>d.id===unitId);
    if (!def) return { ok:false, reason:'no_def' };
    const owned = state.units[unitId] || 0;
    
    let totalCost = 0;
    for (let i=0; i<qty; i++) totalCost += unitCost(def, owned + i, state);
    
    if (state.gold < totalCost) return { ok:false, reason:'cost' };
    state.gold -= totalCost;
    state.units[unitId] = owned + qty;
    state.runStats = state.runStats || { currentRunUnitTypes:{}, currentRunUpgradeBuys:0 };
    state.runStats.currentRunUnitTypes = state.runStats.currentRunUnitTypes || {};
    state.runStats.currentRunUnitTypes[unitId] = (state.runStats.currentRunUnitTypes[unitId] || 0) + qty;
    
    invalidateAggCache();
    recalcAndCacheGPS(state);
    return { ok:true, bought:qty, cost: totalCost };
  }

  function buyMaxUnitsInternal(stateOrUnitId, maybeUnitId){
    // unify signatures: buyMaxUnitsInternal(unitId) expected
    const unitId = (typeof stateOrUnitId === 'string') ? stateOrUnitId : maybeUnitId;
    const def = (C.UNIT_DEFS||[]).find(d=>d.id===unitId);
    if (!def) return { ok:false };
    const owned = state.units[unitId] || 0;
    const agg = getAggregates(state);
    const a1 = def.baseCost * Math.pow(def.costMult, owned) * (agg.costMult || 1);

    let n = 0;
    if (def.costMult > 1){
      const numerator = 1 + (state.gold * (def.costMult - 1) / a1);
      if (numerator > 1) n = Math.floor(Math.log(numerator) / Math.log(def.costMult));
    } else {
      n = Math.floor(state.gold / a1);
    }
    if (n < 0) n = 0;

    let exactCost = 0, actualN = 0;
    for (let i = 0; i <= n + 2; i++){
      const c = unitCost(def, owned + i, state);
      if (state.gold >= exactCost + c){ exactCost += c; actualN++; } else break;
    }
    if (actualN > 0){
      state.gold -= exactCost;
      state.units[unitId] = owned + actualN;
      state.runStats = state.runStats || { currentRunUnitTypes:{}, currentRunUpgradeBuys:0 };
      state.runStats.currentRunUnitTypes = state.runStats.currentRunUnitTypes || {};
      state.runStats.currentRunUnitTypes[unitId] = (state.runStats.currentRunUnitTypes[unitId] || 0) + actualN;
      invalidateAggCache(); recalcAndCacheGPS(state);
      return { ok:true, bought:actualN, cost: exactCost };
    }
    return { ok:false };
  }

  function buyUpgradeInternal(upId){
    const def = (C.UPGRADE_DEFS||[]).find(u=>u.id===upId);
    if (!def) return { ok:false };
    const lvl = state.upgrades[upId] || 0;
    const cost = upgradeCostNextLevel(def, lvl);
    if (state.gold < cost) return { ok:false };
    state.gold -= cost;
    state.upgrades[upId] = lvl + 1;
    state.runStats = state.runStats || { currentRunUnitTypes:{}, currentRunUpgradeBuys:0 };
    state.runStats.currentRunUpgradeBuys = (state.runStats.currentRunUpgradeBuys || 0) + 1;
    invalidateAggCache(); recalcAndCacheGPS(state);
    return { ok:true, lvl: lvl + 1, cost };
  }

  function buyMaxUpgradeInternal(upId){
    const def = (C.UPGRADE_DEFS||[]).find(u=>u.id===upId);
    if (!def) return { ok:false };
    const lvl = state.upgrades[upId] || 0;
    const a1 = def.baseCost * Math.pow(def.costMult, lvl);
    let n = 0;
    if (def.costMult > 1){
      const numerator = 1 + (state.gold * (def.costMult - 1) / a1);
      if (numerator > 1) n = Math.floor(Math.log(numerator) / Math.log(def.costMult));
    } else {
      n = Math.floor(state.gold / a1);
    }
    if (n < 0) n = 0;
    let exactCost = 0, actualN = 0;
    for (let i=0;i<=n+2;i++){
      const c = upgradeCostNextLevel(def, lvl + i);
      if (state.gold >= exactCost + c){ exactCost += c; actualN++; } else break;
    }
    if (actualN > 0){
      state.gold -= exactCost;
      state.upgrades[upId] = lvl + actualN;
      state.runStats = state.runStats || { currentRunUnitTypes:{}, currentRunUpgradeBuys:0 };
      state.runStats.currentRunUpgradeBuys = (state.runStats.currentRunUpgradeBuys || 0) + actualN;
      invalidateAggCache(); recalcAndCacheGPS(state);
      return { ok:true, bought:actualN, cost: exactCost };
    }
    return { ok:false };
  }

  function canBuyLegacyInternal(legacyId, st){
    st = st || state;
    const def = (C.LEGACY_DEFS||[]).find(d=>d.id===legacyId);
    if (!def) return false;
    const lvl = st.legacyNodes[legacyId] || 0;
    if (lvl >= def.maxLevel) return false;
    if (def.prereq && def.prereq.length){
      for (const p of def.prereq){
        const have = st.legacyNodes[p.id] || 0;
        if (have < (p.minLevel || 1)) return false;
      }
    }
    return st.legacy >= legacyCostForNextLevel(def, lvl);
  }

  function attemptBuyLegacyInternal(legacyId, maxCount = 1){
    const def = (C.LEGACY_DEFS||[]).find(d=>d.id===legacyId);
    if (!def) return { ok:false, reason:'no_def' };
    let lvl = state.legacyNodes[legacyId] || 0;
    if (lvl >= def.maxLevel) return { ok:false, reason:'max' };

    if (maxCount === 1){
      const cost = legacyCostForNextLevel(def, lvl);
      if (def.prereq && def.prereq.length){
        for (const p of def.prereq){ const have = state.legacyNodes[p.id] || 0; if (have < (p.minLevel||1)) return { ok:false, reason:'prereq' }; }
      }
      if (state.legacy < cost) return { ok:false, reason:'cost' };
      state.legacy -= cost;
      state.legacyNodes[legacyId] = lvl + 1;
      invalidateAggCache(); recalcAndCacheGPS(state);
      return { ok:true, bought:1, cost };
    }

    // buy max
    let possible = 0, totalCost = 0, tmp = lvl;
    while (tmp < def.maxLevel){
      const c = legacyCostForNextLevel(def, tmp);
      if (state.legacy >= totalCost + c){ totalCost += c; tmp++; possible++; } else break;
    }
    if (possible <= 0) return { ok:false, reason:'cost' };
    for (let i=0;i<possible;i++){
      const c = legacyCostForNextLevel(def, state.legacyNodes[legacyId] || 0);
      state.legacy -= c; state.legacyNodes[legacyId] = (state.legacyNodes[legacyId] || 0) + 1;
    }
    invalidateAggCache(); recalcAndCacheGPS(state);
    return { ok:true, bought:possible, cost: totalCost };
  }

  function buyAscensionUpgradeInternal(id){
    const def = (C.ASC_UPGRADES||[]).find(a=>a.id===id);
    if (!def) return { ok:false };
    const lvl = state.ascOwned[id] || 0;
    if (def.maxLevel && lvl >= def.maxLevel) return { ok:false, reason:'max' };
    if (state.ascPoints < def.cost) return { ok:false, reason:'cost' };
    state.ascPoints -= def.cost;
    state.ascOwned[id] = lvl + 1;
    invalidateAggCache(); recalcAndCacheGPS(state);
    return { ok:true, lvl: lvl + 1 };
  }

  // --- prestige / ascend ---
  function calcPrestigeGainFromTotal(totalGoldEarned){
    if (totalGoldEarned <= 0) return 0;
    return Math.floor(Math.sqrt(totalGoldEarned / (C.PRESTIGE_BASE_DIV || 1000)));
  }
  function previewPrestigeGain(){
    return Math.max(0, calcPrestigeGainFromTotal(state.totalGoldEarned || 0) - (state.prestigeEarnedTotal || 0));
  }
  function computeStartingGoldOnPrestige(){
    return (C.STARTING_GOLD || 50) + (getAggregates(state).startingGoldBonus || 0);
  }
  function doPrestigeInternal(){
    const gain = previewPrestigeGain();
    if (gain <= 0) return { ok:false };
    state.prestigeEarnedTotal = (state.prestigeEarnedTotal || 0) + gain;
    state.legacy = (state.legacy || 0) + gain;
    state.gold = computeStartingGoldOnPrestige();
    state.units = (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.upgrades = (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    invalidateAggCache(); recalcAndCacheGPS(state);
    return { ok:true, gain };
  }

  function calcAscGainFromPrestige(prestigeEarned){
    const raw = Math.sqrt(Math.max(0, prestigeEarned || 0) / (C.ASC_BASE_DIV || 25));
    const softcap = C.ASC_SOFTCAP_START || 20;
    if (raw <= softcap) return Math.floor(raw);
    const exp = C.ASC_SOFTCAP_EXPONENT || 0.72;
    return Math.floor(softcap + Math.pow(raw - softcap, exp));
  }

  function previewAscGain(){
    return Math.max(0, calcAscGainFromPrestige(state.prestigeEarnedTotal || 0));
  }
  function doAscendInternal(){
    const gain = previewAscGain();
    if (gain <= 0) return { ok:false };
    const keepTotalGold = hasSpecialAscUpgrade(state, 'keepTotalGold');
    const keepLegacyTree = hasSpecialAscUpgrade(state, 'keepLegacyTree');
    state.ascPoints = (state.ascPoints || 0) + gain;
    state.ascEarnedTotal = (state.ascEarnedTotal || 0) + gain;
    state.units = (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.upgrades = (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.prestigeEarnedTotal = 0;
    state.legacy = 0;
    if (!keepTotalGold) state.totalGoldEarned = 0;
    if (!keepLegacyTree) state.legacyNodes = (C.LEGACY_DEFS || []).reduce((a,d)=>(a[d.id]=0,a),{});

    state.runStats = state.runStats || {};
    state.runStats.history = Array.isArray(state.runStats.history) ? state.runStats.history : [];
    const now = nowSec();
    const startedAt = state.runStats.currentRunStartedAt || now;
    const durationSec = Math.max(0, Math.floor(now - startedAt));
    const peakGold = Math.max(state.runStats.currentRunPeakGold || 0, state.gold || 0);
    const unitTypesUsed = Object.keys(state.runStats.currentRunUnitTypes || {}).filter(k => (state.runStats.currentRunUnitTypes[k] || 0) > 0).length;
    const runSummary = {
      run: (state.runStats.runCount || 1),
      reachedGold: peakGold,
      durationSec,
      gainedAP: gain,
      noUpgrade: (state.runStats.currentRunUpgradeBuys || 0) === 0,
      unitTypesUsed,
      endedAt: now
    };
    state.lastAscensionRun = runSummary;
    state.runStats.history.push(runSummary);
    if (state.runStats.history.length > 30) state.runStats.history = state.runStats.history.slice(-30);
    state.runStats.runCount = (state.runStats.runCount || 1) + 1;
    state.runStats.currentRunStartedAt = now;
    state.runStats.currentRunPeakGold = 0;
    state.runStats.currentRunUnitTypes = {};
    state.runStats.currentRunUpgradeBuys = 0;

    // legacy tree を保持しない場合、開始ゴールドはリセット後の恒久効果で再計算する。
    invalidateAggCache();
    state.gold = computeStartingGoldOnPrestige();
    state.runStats.currentRunPeakGold = state.gold;
    recalcAndCacheGPS(state);
    return { ok:true, gain };
  }

  // --- export API ---
  const E = {
    // aggregates / cache
    getAggregates: (st) => getAggregates(st || state),
    invalidateAggCache,
    // costs / gps
    unitCost: (def, owned, st) => unitCost(def, owned, st || state),
    upgradeCostNextLevel,
    legacyCostForNextLevel,
    computeBaseGPS: (st) => computeBaseGPS(st || state),
    computeGPSFull: (st) => computeGPSFull(st || state),
    recalcAndCacheGPS: (st) => recalcAndCacheGPS(st || state),

    // buy / actions — these operate on internal state
    buyUnitInternal: (unitId, qty) => buyUnitInternal(unitId, qty),
    buyMaxUnitsInternal: (unitId) => buyMaxUnitsInternal(unitId),
    buyUpgradeInternal: (upId) => buyUpgradeInternal(upId),
    buyMaxUpgradeInternal: (upId) => buyMaxUpgradeInternal(upId),
    attemptBuyLegacyInternal: (legacyId, maxCount) => attemptBuyLegacyInternal(legacyId, maxCount),
    canBuyLegacyInternal: (legacyId, st) => canBuyLegacyInternal(legacyId, st || state),
    buyAscensionUpgradeInternal: (id) => buyAscensionUpgradeInternal(id),

    // prestige / ascend
    previewPrestigeGain,
    computeStartingGoldOnPrestige,
    previewAscGain,
    doPrestigeInternal,
    doAscendInternal,

    // offline
    applyOfflineProgressWithToast,

    // state accessors / mutators
    getState: () => state,
    setState: (newState) => { state = newState; invalidateAggCache(); recalcAndCacheGPS(state); },

    // compatibility
    invalidateCache: () => { invalidateAggCache(); }
  };

  // expose
  window.ENGINE = E;

})();
