// engine.helpers.js — engine用の純粋ヘルパー群
(function(){
  function nowSec(){ return Date.now()/1000; }
  function deepCopy(o){ try { return JSON.parse(JSON.stringify(o)); } catch(e){ return Object.assign({}, o); } }

  function getActiveChallengeDef(C, st){
    const activeId = st && st.challenge && st.challenge.activeId;
    if (!activeId) return null;
    return (C.CHALLENGES || []).find(ch => ch.id === activeId) || null;
  }

  function getCompletedChallengeCount(C, st){
    const completed = st && st.challenge && st.challenge.completed ? st.challenge.completed : {};
    return (C.CHALLENGES || []).reduce((count, ch)=>count + (completed[ch.id] ? 1 : 0), 0);
  }

  function hasAbyssFeature(C, st, featureId){
    if (!featureId) return false;
    const features = st && st.abyss && st.abyss.features ? st.abyss.features : {};
    return !!features[featureId];
  }

  function getUnlockedPrestigeLayerCount(C, st){
    let count = 0;
    for (const layer of (C.PRESTIGE_LAYERS || [])){
      if (((st && st.prestigeEarnedTotal) || 0) >= (layer.need || 0)) count += 1;
    }
    return count;
  }

  function getUnlockedCelestialLayerCount(C, st){
    let count = 0;
    for (const layer of (C.CELESTIAL_LAYERS || [])){
      if (((st && st.ascEarnedTotal) || 0) >= (layer.need || 0)) count += 1;
    }
    return count;
  }

  function getPrestigeLayerStatus(C, st){
    return (C.PRESTIGE_LAYERS || []).map(layer=>({
      id: layer.id,
      name: layer.name,
      need: layer.need || 0,
      unlocked: ((st && st.prestigeEarnedTotal) || 0) >= (layer.need || 0),
      desc: layer.desc || '',
      bonus: layer.bonus || null
    }));
  }

  function getCelestialLayerStatus(C, st){
    return (C.CELESTIAL_LAYERS || []).map(layer=>({
      id: layer.id,
      name: layer.name,
      need: layer.need || 0,
      unlocked: ((st && st.ascEarnedTotal) || 0) >= (layer.need || 0),
      desc: layer.desc || '',
      bonus: layer.bonus || null
    }));
  }

  function getCelestialBranchStatus(C, st){
    const activeBranchId = st && st.celestial ? st.celestial.activeBranchId : null;
    return (C.CELESTIAL_BRANCHES || []).map(branch=>{
      const layer = (C.CELESTIAL_LAYERS || []).find(x=>x.id === branch.layerId);
      const need = layer ? (layer.need || 0) : 0;
      return {
        id: branch.id,
        name: branch.name,
        jpName: branch.jpName || branch.name,
        desc: branch.desc || '',
        playstyle: branch.playstyle || '',
        guide: branch.guide || '',
        goal: branch.goal || null,
        bonus: branch.bonus || null,
        need,
        unlocked: ((st && st.ascEarnedTotal) || 0) >= need,
        active: activeBranchId === branch.id
      };
    });
  }

  function hasSpecialAscUpgrade(C, st, kind){
    const upgrades = C.ASC_UPGRADES || [];
    for (const def of upgrades){
      if (def.type !== 'special') continue;
      if (!def.payload || def.payload.kind !== kind) continue;
      if ((((st && st.ascOwned) || {})[def.id] || 0) > 0) return true;
    }
    return false;
  }

  function getChallengeRewardSummary(C, st){
    const summary = {
      globalMult:1,
      flatGPS:0,
      startGold:0,
      prestigeEffectAdd:0,
      costMult:1,
      challengeGoalMult:1,
      challengeStartGold:0,
      challengeAutoBuySpeedMult:1,
      keepLegacyOnChallenge:false
    };
    const completed = st && st.challenge && st.challenge.completed ? st.challenge.completed : {};
    for (const ch of (C.CHALLENGES || [])){
      if (!completed[ch.id]) continue;
      const r = ch.reward || {};
      if (r.type === 'globalMult' && typeof r.mult === 'number') summary.globalMult *= r.mult;
      if (r.type === 'flatGPS' && typeof r.gps === 'number') summary.flatGPS += r.gps;
      if (r.type === 'startGold' && typeof r.amount === 'number') summary.startGold += r.amount;
      if (r.type === 'prestigeEffectAdd' && typeof r.add === 'number') summary.prestigeEffectAdd += r.add;
      if (r.type === 'costMult' && typeof r.mult === 'number') summary.costMult *= r.mult;
      if (r.type === 'challengeGoalMult' && typeof r.mult === 'number') summary.challengeGoalMult *= r.mult;
      if (r.type === 'challengeStartGold' && typeof r.amount === 'number') summary.challengeStartGold += r.amount;
      if (r.type === 'challengeAutoBuySpeed' && typeof r.mult === 'number') summary.challengeAutoBuySpeedMult *= r.mult;
      if (r.type === 'challengeKeepLegacy') summary.keepLegacyOnChallenge = true;
    }
    return summary;
  }

  function ascCapBonusFromCelestial(C, st){
    let bonus = 0;
    for (const def of (C.CELESTIAL_UPGRADES || [])){
      if (def.type !== 'ascShopCapBoost') continue;
      const lv = ((st && st.celestialOwned && st.celestialOwned[def.id]) ? st.celestialOwned[def.id] : 0);
      if (lv <= 0) continue;
      bonus += (def.payload && def.payload.addMaxLevel ? def.payload.addMaxLevel : 0) * lv;
    }
    return bonus;
  }

  function ascUpgradeMaxLevel(C, st, def){
    if (!def || typeof def.maxLevel !== 'number') return Infinity;
    if (def.maxLevel <= 1) return def.maxLevel;
    return def.maxLevel + ascCapBonusFromCelestial(C, st);
  }

  function legacyCapBonusFromAsc(C, st){
    let bonus = 0;
    for (const def of (C.ASC_UPGRADES||[])){
      if (def.type !== 'legacyCapBoost') continue;
      const lv = (st && st.ascOwned && st.ascOwned[def.id]) ? st.ascOwned[def.id] : 0;
      if (lv <= 0) continue;
      bonus += (def.payload && def.payload.addMaxLevel ? def.payload.addMaxLevel : 0) * lv;
    }
    return bonus;
  }

  function legacyMaxLevel(C, st, def){
    if (!def || typeof def.maxLevel !== 'number') return Infinity;
    return def.maxLevel + legacyCapBonusFromAsc(C, st);
  }

  function legacyCostForNextLevel(C, st, def, currentLevel){
    if (currentLevel >= legacyMaxLevel(C, st, def)) return Infinity;
    return Math.floor(def.baseCost * Math.pow(def.costMult, currentLevel));
  }

  function calcPrestigeGainFromTotal(C, totalGoldEarned){
    if (totalGoldEarned <= 0) return 0;
    return Math.floor(Math.sqrt(totalGoldEarned / (C.PRESTIGE_BASE_DIV || 1000)));
  }

  function calcAscGainFromPrestige(C, prestigeEarned){
    const raw = Math.sqrt(Math.max(0, prestigeEarned || 0) / (C.ASC_BASE_DIV || 25));
    const softcap = C.ASC_SOFTCAP_START || 20;
    if (raw <= softcap) return Math.floor(raw);
    const exp = C.ASC_SOFTCAP_EXPONENT || 0.72;
    return Math.floor(softcap + Math.pow(raw - softcap, exp));
  }

  function calcCelestialGain(unlockedLayers, ascGain){
    if (ascGain <= 0) return 0;
    return Math.max(1, Math.floor(ascGain / 3) + Math.floor(unlockedLayers / 2));
  }

  function abyssUpgradeCost(def, lvl){
    return Math.max(1, Math.floor((def.baseCost || 1) * Math.pow(def.costMult || 1, lvl || 0)));
  }

  window.EngineHelpers = {
    nowSec,
    deepCopy,
    getActiveChallengeDef,
    getCompletedChallengeCount,
    hasAbyssFeature,
    getUnlockedPrestigeLayerCount,
    getUnlockedCelestialLayerCount,
    getPrestigeLayerStatus,
    getCelestialLayerStatus,
    getCelestialBranchStatus,
    hasSpecialAscUpgrade,
    getChallengeRewardSummary,
    ascUpgradeMaxLevel,
    legacyMaxLevel,
    legacyCostForNextLevel,
    calcPrestigeGainFromTotal,
    calcAscGainFromPrestige,
    calcCelestialGain,
    abyssUpgradeCost
  };
})();
