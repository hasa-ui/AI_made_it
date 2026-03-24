// engine.js — 修正版（state を内部に保持、SM.getState 呼び出しを排除）
// 依存: window.CONFIG (C), optional window.StateManager (SM)
// エクスポート: window.ENGINE (E)

(function(){
  const C = window.CONFIG || {};
  const SM = window.StateManager || null;
  const H = window.EngineHelpers || {};

  // --- utilities (split: engine.helpers.js) ---
  const nowSec = H.nowSec || (()=>Date.now()/1000);
  const deepCopy = H.deepCopy || (o=>{ try { return JSON.parse(JSON.stringify(o)); } catch(e){ return Object.assign({}, o); } });

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
        celestialPoints: 0,
        celestialEarnedTotal: 0,
        celestialOwned: (C.CELESTIAL_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{}),
        celestial: { activeBranchId:null },
        achievementsOwned: {},
        settings: { notation: 'compact', notationThreshold: 1000, confirmLegacyBuy:true, confirmLegacyBuyMax:true, toast:{achievement:true,offline:true,purchase:true,general:true}, activeSubTabs:{prestige:'core',ascension:'core'} },
        abyss: {
          shards:0,
          resetCount:0,
          bestChallengeCompletions:0,
          bestCelestialLayerCount:0,
          features:{},
          upgrades:(C.ABYSS_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{})
        },
        seenUpdateVersion: null
      };
    }
  }

  // --- cache for aggregates ---
  let aggCache = null;
  let aggCacheDirty = true;
  function invalidateAggCache(){ aggCacheDirty = true; aggCache = null; }

  function getCompletedChallengeCount(st){ return (H.getCompletedChallengeCount || ((C,src)=>0))(C, st || state); }
  function hasAbyssFeature(st, featureId){ return (H.hasAbyssFeature || ((C,src,id)=>false))(C, st || state, featureId); }
  function isAbyssUpgradeUnlocked(st, def){
    if (!def || !def.unlockFeature) return true;
    return hasAbyssFeature(st, def.unlockFeature);
  }
  function getAbyssMilestoneProgress(st){
    const src = st || state;
    const abyss = src.abyss || {};
    return {
      completedChallenges: Math.max(abyss.bestChallengeCompletions || 0, getCompletedChallengeCount(src)),
      unlockedCelestialLayers: Math.max(abyss.bestCelestialLayerCount || 0, getUnlockedCelestialLayerCount(src))
    };
  }
  function recordAbyssMilestoneProgress(st){
    const src = st || state;
    src.abyss = src.abyss || { shards:0, resetCount:0, bestChallengeCompletions:0, bestCelestialLayerCount:0, features:{}, upgrades:{} };
    src.abyss.bestChallengeCompletions = Math.max(src.abyss.bestChallengeCompletions || 0, getCompletedChallengeCount(src));
    src.abyss.bestCelestialLayerCount = Math.max(src.abyss.bestCelestialLayerCount || 0, getUnlockedCelestialLayerCount(src));
  }

  function getAbyssGainBreakdownInternal(st){
    const src = st || state;
    const goal = C.ABYSS_RESET_GOAL || Number.MAX_VALUE;
    const total = src.totalGoldEarned || 0;
    const ready = total >= goal;
    const isOverflow = total === Infinity;
    const milestoneProgress = getAbyssMilestoneProgress(src);
    const completedChallenges = milestoneProgress.completedChallenges;
    const unlockedCelestialLayers = milestoneProgress.unlockedCelestialLayers;
    const resetCount = (src.abyss && src.abyss.resetCount) || 0;
    let upgradeFlat = 0;
    let overflowUpgrade = 0;
    for (const def of (C.ABYSS_UPGRADES || [])){
      if (!isAbyssUpgradeUnlocked(src, def)) continue;
      const lvl = (src.abyss && src.abyss.upgrades && src.abyss.upgrades[def.id]) ? src.abyss.upgrades[def.id] : 0;
      if (lvl <= 0) continue;
      if (def.type === 'abyssGainFlat') upgradeFlat += ((def.payload && def.payload.amountPerLevel) || 0) * lvl;
      if (def.type === 'abyssGainIfInfinite' && isOverflow) overflowUpgrade += ((def.payload && def.payload.amountPerLevel) || 0) * lvl;
    }
    const base = ready ? 1 : 0;
    const challengeBonus = ready ? Math.floor(completedChallenges / 4) : 0;
    const celestialBonus = ready ? Math.floor(unlockedCelestialLayers / 3) : 0;
    const resetBonus = ready ? Math.floor(resetCount / 4) : 0;
    const overflowBonus = ready && isOverflow ? 1 : 0;
    const current = ready
      ? Math.max(1, base + challengeBonus + celestialBonus + resetBonus + overflowBonus + upgradeFlat + overflowUpgrade)
      : 0;
    return {
      ready,
      current,
      isOverflow,
      total,
      goal,
      completedChallenges,
      unlockedCelestialLayers,
      resetCount,
      parts: [
        { key:'base', label:'到達基礎値', value:base },
        { key:'challenge', label:'Challenge節目', value:challengeBonus },
        { key:'celestial', label:'Celestial層節目', value:celestialBonus },
        { key:'reset', label:'Abyss周回節目', value:resetBonus },
        { key:'overflow', label:'Infinity到達', value:overflowBonus },
        { key:'upgrade_flat', label:'変換アップグレード', value:upgradeFlat },
        { key:'upgrade_overflow', label:'Overflow専用アップグレード', value:overflowUpgrade }
      ]
    };
  }

  function getAbyssObjectivesInternal(st){
    const src = st || state;
    const breakdown = getAbyssGainBreakdownInternal(src);
    const objectives = [];
    const totalChallenges = (C.CHALLENGES || []).length;
    const maxChallengeTarget = Math.floor(totalChallenges / 4) * 4;
    const nextChallengeTarget = maxChallengeTarget > 0
      ? Math.min(maxChallengeTarget, (Math.floor(breakdown.completedChallenges / 4) + 1) * 4)
      : totalChallenges;
    objectives.push({
      id:'challenge',
      title:'Challenge節目',
      current: breakdown.completedChallenges,
      target: nextChallengeTarget,
      reward:'Abyss gain +1',
      done: maxChallengeTarget === 0 || breakdown.completedChallenges >= nextChallengeTarget,
      desc: maxChallengeTarget === 0 || breakdown.completedChallenges >= nextChallengeTarget
        ? 'Challenge由来の gain 節目は達成済み'
        : `次の gain 節目は ${nextChallengeTarget} 件クリア`
    });
    const totalCelestialLayers = (C.CELESTIAL_LAYERS || []).length;
    const maxCelestialTarget = Math.floor(totalCelestialLayers / 3) * 3;
    const nextCelestialTarget = maxCelestialTarget > 0
      ? Math.min(maxCelestialTarget, (Math.floor(breakdown.unlockedCelestialLayers / 3) + 1) * 3)
      : totalCelestialLayers;
    objectives.push({
      id:'celestial',
      title:'Celestial節目',
      current: breakdown.unlockedCelestialLayers,
      target: nextCelestialTarget,
      reward:'Abyss gain +1',
      done: maxCelestialTarget === 0 || breakdown.unlockedCelestialLayers >= nextCelestialTarget,
      desc: maxCelestialTarget === 0 || breakdown.unlockedCelestialLayers >= nextCelestialTarget
        ? 'Celestial由来の gain 節目は達成済み'
        : `次の gain 節目は Celestial ${nextCelestialTarget} 層解放`
    });
    objectives.push({
      id:'overflow',
      title:'オーバーフロー観測',
      current: breakdown.isOverflow ? 1 : 0,
      target: 1,
      reward:'Abyss gain +1',
      done: breakdown.isOverflow,
      desc: breakdown.isOverflow ? 'Infinity 到達済み' : '累計Goldを Infinity まで押し上げる'
    });
    const nextResetTarget = (Math.floor(breakdown.resetCount / 4) + 1) * 4;
    objectives.push({
      id:'reset',
      title:'周回蓄積',
      current: breakdown.resetCount,
      target: nextResetTarget,
      reward:'Abyss gain +1',
      done: breakdown.resetCount >= nextResetTarget,
      desc:`Abyss Reset ${nextResetTarget} 回で次の基礎 gain`
    });
    const nextFeature = Object.entries(C.ABYSS_FEATURES || {}).find(([featureId]) => !hasAbyssFeature(src, featureId));
    if (nextFeature){
      const [featureId, def] = nextFeature;
      const ch = (C.CHALLENGES || []).find(x=>x.id === def.unlockChallengeId);
      objectives.push({
        id:`feature-${featureId}`,
        title:def.name || '機能解放',
        current: hasAbyssFeature(src, featureId) ? 1 : 0,
        target: 1,
        reward:def.desc || '機能解放',
        done:false,
        desc: ch ? `${ch.name} をクリアして解放` : '対応Challengeクリアで解放'
      });
    }
    return objectives;
  }

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
    // --- Prestige層ボーナス ---
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
      const branchStatus = getCelestialBranchStatus(st).find(x=>x.id === activeBranchId);
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
      if (!isAbyssUpgradeUnlocked(st, ab)) continue;
      const lvl = (st.abyss && st.abyss.upgrades && st.abyss.upgrades[ab.id]) ? st.abyss.upgrades[ab.id] : 0;
      if (lvl <= 0) continue;
      if (ab.type === 'globalMult') globalMult *= Math.pow((ab.payload && ab.payload.multPerLevel) || 1, lvl);
      if (ab.type === 'costMult') costMult *= Math.pow((ab.payload && ab.payload.multPerLevel) || 1, lvl);
      if (ab.type === 'startGold') startingGoldBonus += ((ab.payload && ab.payload.amountPerLevel) || 0) * lvl;
      if (ab.type === 'startGoldPerAbyssReset') startingGoldBonus += ((ab.payload && ab.payload.amountPerReset) || 0) * lvl * abyssResetCount;
      if (ab.type === 'flatGPS') flatGPS += ((ab.payload && ab.payload.gpsPerLevel) || 0) * lvl;
      if (ab.type === 'flatGPSPerAbyssReset') flatGPS += ((ab.payload && ab.payload.gpsPerReset) || 0) * lvl * abyssResetCount;
      if (ab.type === 'prestigeEffectAdd') prestigeEffectAdd += ((ab.payload && ab.payload.addPerLevel) || 0) * lvl;
      if (ab.type === 'unitMult' && ab.payload && ab.payload.unitId) unitMults[ab.payload.unitId] = (unitMults[ab.payload.unitId] || 1) * Math.pow(ab.payload.multPerLevel || 1, lvl);
    }

    // --- Challengeクリア報酬 ---
    const completed = (st.challenge && st.challenge.completed) ? st.challenge.completed : {};
    for (const ch of (C.CHALLENGES || [])){
      if (!completed[ch.id]) continue;
      const r = ch.reward || {};
      if (r.type === 'globalMult' && typeof r.mult === 'number') globalMult *= r.mult;
      if (r.type === 'flatGPS' && typeof r.gps === 'number') flatGPS += r.gps;
      if (r.type === 'startGold' && typeof r.amount === 'number') startingGoldBonus += r.amount;
      if (r.type === 'prestigeEffectAdd' && typeof r.add === 'number') prestigeEffectAdd += r.add;
      if (r.type === 'costMult' && typeof r.mult === 'number') costMult *= r.mult;
    }

    // --------------------------------
    return { globalMult, unitMults, costMult, startingGoldBonus, startingUnits, prestigeEffectAdd, flatGPS };

  }


  function getActiveChallengeDef(st){ return (H.getActiveChallengeDef || ((C,src)=>null))(C, st || state); }
  function getUnlockedPrestigeLayerCount(st){ return (H.getUnlockedPrestigeLayerCount || ((C,src)=>0))(C, st || state); }
  function getUnlockedCelestialLayerCount(st){ return (H.getUnlockedCelestialLayerCount || ((C,src)=>0))(C, st || state); }
  function getPrestigeLayerStatus(st){ return (H.getPrestigeLayerStatus || ((C,src)=>[]))(C, st || state); }
  function getCelestialLayerStatus(st){ return (H.getCelestialLayerStatus || ((C,src)=>[]))(C, st || state); }
  function getCelestialBranchStatus(st){ return (H.getCelestialBranchStatus || ((C,src)=>[]))(C, st || state); }
  function hasSpecialAscUpgrade(st, kind){ return (H.hasSpecialAscUpgrade || ((C,src,k)=>false))(C, st || state, kind); }
  function ascUpgradeMaxLevel(def, st){ return (H.ascUpgradeMaxLevel || ((C,src,d)=> (typeof d?.maxLevel==='number'?d.maxLevel:Infinity)))(C, st || state, def); }

  function getAggregates(st){
    st = st || state;
    // キャッシュは内部state専用。外部から渡された任意stateは毎回正しく再計算する。
    if (st !== state) return computeLegacyAggregatesInternal(st);
    if (!aggCache || aggCacheDirty){
      aggCache = computeLegacyAggregatesInternal(state);
      aggCacheDirty = false;
    }
    return aggCache;
  }

  // --- cost / gps helpers ---
  function unitBaseCost(def, owned){ return Math.floor(def.baseCost * Math.pow(def.costMult, owned)); }
  function unitCost(def, owned, st){
    const agg = getAggregates(st);
    let cost = unitBaseCost(def, owned) * (agg.costMult || 1);
    const activeChallenge = getActiveChallengeDef(st);
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.costMult === 'number') cost *= activeChallenge.effects.costMult;
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.costRampByOwnedDiv === 'number' && activeChallenge.effects.costRampByOwnedDiv > 0){
      const totalOwned = Object.values(st.units || {}).reduce((acc, v)=>acc + (Number(v)||0), 0);
      cost *= 1 + (totalOwned / activeChallenge.effects.costRampByOwnedDiv);
    }
    return Math.max(1, Math.floor(cost));
  }
  function upgradeCostNextLevel(def, currentLevel){ return Math.floor(def.baseCost * Math.pow(def.costMult, currentLevel)); }

  function legacyMaxLevel(def, st){ return (H.legacyMaxLevel || ((C,src,d)=> (typeof d?.maxLevel==='number'?d.maxLevel:Infinity)))(C, st || state, def); }
  function legacyCostForNextLevel(def, currentLevel, st){ return (H.legacyCostForNextLevel || ((C,src,d,lvl)=>Math.floor(d.baseCost*Math.pow(d.costMult,lvl))))(C, st || state, def, currentLevel); }

  function computeBaseGPS(st){
    const agg = getAggregates(st);
    let total = agg.flatGPS || 0;
    const U = C.UNIT_DEFS || [];
    const activeChallenge = getActiveChallengeDef(st);
    let highestOwnedUnitId = null;
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.onlyHighestUnitProduces){
      for (const def of U){ if ((st.units[def.id] || 0) > 0) highestOwnedUnitId = def.id; }
    }
    for (const def of U){
      const owned = st.units[def.id] || 0;
      if (highestOwnedUnitId && def.id !== highestOwnedUnitId) continue;
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
    let out = total * globalMult * (agg.globalMult || 1);
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.globalMult === 'number'){
      out *= activeChallenge.effects.globalMult;
    }
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.globalMultPerOwned === 'number'){
      const totalOwned = Object.values(st.units || {}).reduce((acc, v)=>acc + (Number(v)||0), 0);
      out *= Math.pow(activeChallenge.effects.globalMultPerOwned, totalOwned);
    }
    return out;
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
    if (!Number.isInteger(qty) || qty <= 0) return { ok:false, reason:'invalid_qty' };
    const activeChallenge = getActiveChallengeDef(state);
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.singleUnitOnly){
      for (const u of (C.UNIT_DEFS || [])){
        if (u.id === unitId) continue;
        if ((state.units[u.id] || 0) > 0) return { ok:false, reason:'challenge_unit_lock' };
      }
    }
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
    const activeChallenge = getActiveChallengeDef(state);
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.singleUnitOnly){
      for (const u of (C.UNIT_DEFS || [])){
        if (u.id === unitId) continue;
        if ((state.units[u.id] || 0) > 0) return { ok:false, reason:'challenge_unit_lock' };
      }
    }
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
    const maxIterations = Number.isFinite(n) ? (n + 2) : 4096;
    for (let i = 0; i <= maxIterations; i++){
      const c = unitCost(def, owned + i, state);
      if (!Number.isFinite(c) || !Number.isFinite(exactCost + c)) break;
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
    const activeChallenge = getActiveChallengeDef(state);
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.disableUpgrades) return { ok:false, reason:'challenge_lock' };
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
    const activeChallenge = getActiveChallengeDef(state);
    if (activeChallenge && activeChallenge.effects && activeChallenge.effects.disableUpgrades) return { ok:false, reason:'challenge_lock' };
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
    const maxIterations = Number.isFinite(n) ? (n + 2) : 4096;
    for (let i=0;i<=maxIterations;i++){
      const c = upgradeCostNextLevel(def, lvl + i);
      if (!Number.isFinite(c) || !Number.isFinite(exactCost + c)) break;
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
    if (lvl >= legacyMaxLevel(def, st)) return false;
    if (def.prereq && def.prereq.length){
      for (const p of def.prereq){
        const have = st.legacyNodes[p.id] || 0;
        if (have < (p.minLevel || 1)) return false;
      }
    }
    return st.legacy >= legacyCostForNextLevel(def, lvl, st);
  }

  function attemptBuyLegacyInternal(legacyId, maxCount = 1){
    const def = (C.LEGACY_DEFS||[]).find(d=>d.id===legacyId);
    if (!def) return { ok:false, reason:'no_def' };
    let lvl = state.legacyNodes[legacyId] || 0;
    if (lvl >= legacyMaxLevel(def, state)) return { ok:false, reason:'max' };

    if (def.prereq && def.prereq.length){
      for (const p of def.prereq){
        const have = state.legacyNodes[p.id] || 0;
        if (have < (p.minLevel||1)) return { ok:false, reason:'prereq' };
      }
    }

    if (maxCount === 1){
      const cost = legacyCostForNextLevel(def, lvl, state);
      if (state.legacy < cost) return { ok:false, reason:'cost' };
      state.legacy -= cost;
      state.legacyNodes[legacyId] = lvl + 1;
      invalidateAggCache(); recalcAndCacheGPS(state);
      return { ok:true, bought:1, cost };
    }

    // buy max
    const maxLevel = legacyMaxLevel(def, state);
    const remainingByCap = Number.isFinite(maxLevel) ? Math.max(0, maxLevel - lvl) : Infinity;
    const baseCost = legacyCostForNextLevel(def, lvl, state);
    if (!Number.isFinite(baseCost) || baseCost <= 0) return { ok:false, reason:'cost' };

    let possible = 0;
    let totalCost = 0;
    if (def.costMult === 1){
      possible = Math.floor(state.legacy / baseCost);
      if (Number.isFinite(remainingByCap)) possible = Math.min(possible, remainingByCap);
      totalCost = possible * baseCost;
    } else {
      const maxBuyChecks = Number.isFinite(remainingByCap) ? remainingByCap : 4096;
      let tmp = lvl;
      for (let i = 0; i < maxBuyChecks; i++){
        const c = legacyCostForNextLevel(def, tmp, state);
        if (!Number.isFinite(c) || c <= 0) break;
        if (state.legacy >= totalCost + c){
          totalCost += c;
          tmp++;
          possible++;
        } else {
          break;
        }
      }
    }

    if (possible <= 0) return { ok:false, reason:'cost' };
    state.legacy -= totalCost;
    state.legacyNodes[legacyId] = lvl + possible;
    invalidateAggCache(); recalcAndCacheGPS(state);
    return { ok:true, bought:possible, cost: totalCost };
  }

  function buyAscensionUpgradeInternal(id){
    const def = (C.ASC_UPGRADES||[]).find(a=>a.id===id);
    if (!def) return { ok:false };
    const lvl = state.ascOwned[id] || 0;
    if (lvl >= ascUpgradeMaxLevel(def, state)) return { ok:false, reason:'max' };
    if (state.ascPoints < def.cost) return { ok:false, reason:'cost' };
    state.ascPoints -= def.cost;
    state.ascOwned[id] = lvl + 1;
    invalidateAggCache(); recalcAndCacheGPS(state);
    return { ok:true, lvl: lvl + 1 };
  }

  // --- prestige / ascend ---
  function calcPrestigeGainFromTotal(totalGoldEarned){ return (H.calcPrestigeGainFromTotal || ((C,total)=>0))(C, totalGoldEarned); }
  function calcAscGainFromPrestige(prestigeEarned){ return (H.calcAscGainFromPrestige || ((C,p)=>0))(C, prestigeEarned); }
  function calcCelestialGain(ascGain){ return (H.calcCelestialGain || ((u,a)=>0))(getUnlockedCelestialLayerCount(state), ascGain); }
  function abyssUpgradeCost(def, lvl){ return (H.abyssUpgradeCost || ((d,l)=>1))(def, lvl); }

  const challengeActions = (window.EngineChallengeActions && window.EngineChallengeActions.create)
    ? window.EngineChallengeActions.create({
        C,
        stateRef: { get: ()=>state },
        nowSec,
        computeStartingGoldOnPrestige,
        invalidateAggCache,
        recalcAndCacheGPS,
        getActiveChallengeDef
      })
    : null;

  function previewPrestigeGain(){
    return Math.max(0, (H.calcPrestigeGainFromTotal || ((C,total)=>0))(C, state.totalGoldEarned || 0) - (state.prestigeEarnedTotal || 0));
  }
  function computeStartingGoldOnPrestige(){
    const activeChallenge = getActiveChallengeDef(state);
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.forceStartGold === 'number') return Math.max(0, activeChallenge.effects.forceStartGold);
    return (C.STARTING_GOLD || 50) + (getAggregates(state).startingGoldBonus || 0);
  }
  function doPrestigeInternal(){
    const gain = previewPrestigeGain();
    if (gain <= 0) return { ok:false };
    state.prestigeEarnedTotal = (state.prestigeEarnedTotal || 0) + gain;
    state.legacy = (state.legacy || 0) + gain;
    state.units = (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.upgrades = (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    // prestige到達閾値で解放される開始ゴールド補正を同回で反映するため、先に集計キャッシュを無効化する。
    invalidateAggCache();
    state.gold = computeStartingGoldOnPrestige();
    recalcAndCacheGPS(state);
    return { ok:true, gain };
  }

  function previewAscGain(){
    return Math.max(0, (H.calcAscGainFromPrestige || ((C,p)=>0))(C, state.prestigeEarnedTotal || 0));
  }

  function buyCelestialUpgradeInternal(id){
    const def = (C.CELESTIAL_UPGRADES || []).find(x=>x.id===id);
    if (!def) return { ok:false, reason:'not_found' };
    const branchId = def.branch || 'shared';
    const activeBranchId = state.celestial && state.celestial.activeBranchId;
    if (branchId !== 'shared'){
      const branchStatus = getCelestialBranchStatus(state).find(x=>x.id === branchId);
      if (!branchStatus || !branchStatus.unlocked) return { ok:false, reason:'branch_locked' };
      if (activeBranchId !== branchId) return { ok:false, reason:'branch_mismatch' };
    }
    state.celestialOwned = state.celestialOwned || {};
    const lvl = state.celestialOwned[def.id] || 0;
    const maxLevel = (typeof def.maxLevel === 'number') ? def.maxLevel : Infinity;
    if (lvl >= maxLevel) return { ok:false, reason:'max' };
    const cost = def.cost || 0;
    if ((state.celestialPoints || 0) < cost) return { ok:false, reason:'cp' };
    state.celestialPoints -= cost;
    state.celestialOwned[def.id] = lvl + 1;
    invalidateAggCache();
    recalcAndCacheGPS(state);
    return { ok:true, id:def.id, lvl: state.celestialOwned[def.id] };
  }

  function selectCelestialBranchInternal(id){
    const branch = (C.CELESTIAL_BRANCHES || []).find(x=>x.id === id);
    if (!branch) return { ok:false, reason:'not_found' };
    const status = getCelestialBranchStatus(state).find(x=>x.id === id);
    if (!status || !status.unlocked) return { ok:false, reason:'locked' };
    state.celestial = state.celestial || { activeBranchId:null };
    state.celestial.activeBranchId = id;
    invalidateAggCache();
    recalcAndCacheGPS(state);
    return { ok:true, id };
  }

  function previewAbyssGain(){
    return getAbyssGainBreakdownInternal(state).current;
  }


  function getAbyssUpgradeStatus(st){
    const src = st || state;
    src.abyss = src.abyss || { shards:0, resetCount:0, features:{}, upgrades:{} };
    src.abyss.features = src.abyss.features || {};
    src.abyss.upgrades = src.abyss.upgrades || {};
    return (C.ABYSS_UPGRADES || []).map(def=>{
      const unlocked = isAbyssUpgradeUnlocked(src, def);
      const lvl = src.abyss.upgrades[def.id] || 0;
      const cost = (H.abyssUpgradeCost || ((d,l)=>1))(def, lvl);
      const featureDef = def.unlockFeature ? (C.ABYSS_FEATURES && C.ABYSS_FEATURES[def.unlockFeature]) : null;
      return {
        id:def.id,
        name:def.name,
        role:def.role || 'その他',
        desc:def.desc,
        lvl,
        cost,
        unlocked,
        unlockFeature:def.unlockFeature || null,
        unlockFeatureName: featureDef ? featureDef.name : null,
        unlockChallengeId: featureDef ? featureDef.unlockChallengeId : null,
        affordable: unlocked && (src.abyss.shards || 0) >= cost
      };
    });
  }

  function buyAbyssUpgradeInternal(id){
    const def = (C.ABYSS_UPGRADES || []).find(x=>x.id===id);
    if (!def) return { ok:false, reason:'not_found' };
    if (!isAbyssUpgradeUnlocked(state, def)) return { ok:false, reason:'feature_locked' };
    state.abyss = state.abyss || { shards:0, resetCount:0, features:{}, upgrades:{} };
    state.abyss.features = state.abyss.features || {};
    state.abyss.upgrades = state.abyss.upgrades || {};
    const lvl = state.abyss.upgrades[def.id] || 0;
    const cost = (H.abyssUpgradeCost || ((d,l)=>1))(def, lvl);
    if ((state.abyss.shards || 0) < cost) return { ok:false, reason:'shard' };
    state.abyss.shards -= cost;
    state.abyss.upgrades[def.id] = lvl + 1;
    invalidateAggCache();
    recalcAndCacheGPS(state);
    return { ok:true, id:def.id, lvl:state.abyss.upgrades[def.id], cost };
  }

  function doAbyssResetInternal(){
    const gain = previewAbyssGain();
    if (gain <= 0) return { ok:false, reason:'goal' };
    recordAbyssMilestoneProgress(state);
    state.abyss = state.abyss || { shards:0, resetCount:0, bestChallengeCompletions:0, bestCelestialLayerCount:0, features:{}, upgrades:{} };
    state.abyss.features = state.abyss.features || {};
    state.abyss.upgrades = state.abyss.upgrades || (C.ABYSS_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.abyss.shards = (state.abyss.shards || 0) + gain;
    state.abyss.resetCount = (state.abyss.resetCount || 0) + 1;
    state.gold = C.STARTING_GOLD || 50;
    state.units = (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.upgrades = (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.legacy = 0;
    state.legacyNodes = (C.LEGACY_DEFS || []).reduce((a,d)=>(a[d.id]=0,a),{});
    state.totalGoldEarned = 0;
    state.prestigeEarnedTotal = 0;
    state.ascPoints = 0;
    state.ascEarnedTotal = 0;
    state.ascOwned = (C.ASC_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.celestialPoints = 0;
    state.celestialEarnedTotal = 0;
    state.celestialOwned = (C.CELESTIAL_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{});
    state.celestial = { activeBranchId:null };
    state.challenge = { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedTotalGold:null };
    state.runStats = state.runStats || {};
    const now = nowSec();
    state.runStats.currentRunStartedAt = now;
    state.runStats.currentRunPeakGold = state.gold;
    state.runStats.currentRunUnitTypes = {};
    state.runStats.currentRunUpgradeBuys = 0;
    invalidateAggCache();
    recalcAndCacheGPS(state);
    return { ok:true, gain };
  }

  function doAscendInternal(){
    const gain = previewAscGain();
    if (gain <= 0) return { ok:false };
    const keepTotalGold = hasSpecialAscUpgrade(state, 'keepTotalGold');
    const keepLegacyTree = hasSpecialAscUpgrade(state, 'keepLegacyTree');
    state.ascPoints = (state.ascPoints || 0) + gain;
    state.ascEarnedTotal = (state.ascEarnedTotal || 0) + gain;
    const celestialGain = (H.calcCelestialGain || ((u,a)=>0))(getUnlockedCelestialLayerCount(state), gain);
    state.celestialPoints = (state.celestialPoints || 0) + celestialGain;
    state.celestialEarnedTotal = (state.celestialEarnedTotal || 0) + celestialGain;
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
      challengeId: (state.challenge && state.challenge.activeId) || null,
      endedAt: now
    };
    state.lastAscensionRun = runSummary;
    state.challenge = state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedTotalGold:null };
    if (state.challenge.activeId) state.challenge.ascendedInChallenge = (state.challenge.ascendedInChallenge || 0) + 1;
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
    return { ok:true, gain, celestialGain };
  }


  function startChallengeInternal(id){
    if (!challengeActions) return { ok:false, reason:'unavailable' };
    return challengeActions.startChallengeInternal(id);
  }

  function abandonChallengeInternal(){
    if (!challengeActions) return { ok:false, reason:'unavailable' };
    return challengeActions.abandonChallengeInternal();
  }

  function tryCompleteChallengeInternal(){
    if (!challengeActions) return { ok:false, reason:'unavailable' };
    return challengeActions.tryCompleteChallengeInternal();
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
    legacyMaxLevel: (def, st) => legacyMaxLevel(def, st || state),
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
    getAscUpgradeMaxLevel: (def, st) => ascUpgradeMaxLevel(def, st || state),
    buyCelestialUpgradeInternal: (id) => buyCelestialUpgradeInternal(id),
    selectCelestialBranchInternal: (id) => selectCelestialBranchInternal(id),
    startChallengeInternal: (id) => startChallengeInternal(id),
    abandonChallengeInternal: () => abandonChallengeInternal(),
    tryCompleteChallengeInternal: () => tryCompleteChallengeInternal(),
    getActiveChallenge: (st) => getActiveChallengeDef(st || state),
    getPrestigeLayerStatus: (st) => getPrestigeLayerStatus(st || state),
    getUnlockedPrestigeLayerCount: (st) => getUnlockedPrestigeLayerCount(st || state),
    getCelestialLayerStatus: (st) => getCelestialLayerStatus(st || state),
    getUnlockedCelestialLayerCount: (st) => getUnlockedCelestialLayerCount(st || state),
    getCelestialBranchStatus: (st) => getCelestialBranchStatus(st || state),

    // prestige / ascend
    previewPrestigeGain,
    computeStartingGoldOnPrestige,
    previewAscGain,
    previewAbyssGain,
    getAbyssUpgradeStatus: (st) => getAbyssUpgradeStatus(st || state),
    getAbyssGainBreakdown: (st) => getAbyssGainBreakdownInternal(st || state),
    getAbyssObjectives: (st) => getAbyssObjectivesInternal(st || state),
    hasAbyssFeature: (featureId, st) => hasAbyssFeature(st || state, featureId),
    buyAbyssUpgradeInternal: (id) => buyAbyssUpgradeInternal(id),
    doPrestigeInternal,
    doAscendInternal,
    doAbyssResetInternal,

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
