// engine.runtime.js — engine 内部共有 runtime
(function(){
  const C = window.CONFIG || {};
  const SM = window.StateManager || null;
  const H = window.EngineHelpers || {};

  const runtime = window.EngineRuntime = window.EngineRuntime || {};
  runtime.C = C;
  runtime.SM = SM;
  runtime.H = H;
  runtime.nowSec = H.nowSec || (()=>Date.now()/1000);
  runtime.deepCopy = H.deepCopy || (o=>{ try { return JSON.parse(JSON.stringify(o)); } catch(_e){ return Object.assign({}, o); } });

  runtime.createFallbackState = function(){
    return {
      version: 1,
      gold: (C.STARTING_GOLD || 50),
      units: (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{}),
      upgrades: (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{}),
      legacy: 0,
      legacyNodes: (C.LEGACY_DEFS || []).reduce((a,d)=>(a[d.id]=0,a),{}),
      totalGoldEarned: 0,
      lastSavedAt: runtime.nowSec(),
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
      settings: {
        notation:'compact',
        notationThreshold:1000,
        confirmLegacyBuy:true,
        confirmLegacyBuyMax:true,
        confirmAscShopBuy:true,
        confirmPrestige:true,
        confirmAscend:true,
        confirmAbyssReset:true,
        confirmChallengeStart:true,
        confirmChallengeAbandon:true,
        confirmImportOverwrite:true,
        confirmHardReset:true,
        toast:{ achievement:true, offline:true, purchase:true, general:true },
        autoBuy:{ enabled:false, units:true, upgrades:true, legacy:false, intervalMs:500, purchaseMode:'single' },
        activeSubTabs:{ prestige:'core', ascension:'core' }
      },
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
  };

  runtime.loadInitialState = function(){
    let state = null;
    if (SM && typeof SM.loadState === 'function'){
      try{
        state = SM.loadState();
      } catch (e){
        console.warn('StateManager.loadState() failed, fallback to default', e);
      }
    }
    if (!state){
      state = (SM && SM.defaultState) ? runtime.deepCopy(SM.defaultState) : runtime.createFallbackState();
    }
    runtime.state = state;
    return state;
  };

  runtime.aggCache = null;
  runtime.aggCacheDirty = true;
  runtime.invalidateAggCache = function(){
    runtime.aggCacheDirty = true;
    runtime.aggCache = null;
  };

  runtime.getState = function(){ return runtime.state; };
  runtime.setState = function(newState){
    runtime.state = newState;
    runtime.invalidateAggCache();
    if (typeof runtime.recalcAndCacheGPS === 'function') runtime.recalcAndCacheGPS(runtime.state);
  };

  runtime.getCompletedChallengeCount = function(st){ return (H.getCompletedChallengeCount || ((cfg,src)=>0))(C, st || runtime.state); };
  runtime.hasAbyssFeature = function(st, featureId){ return (H.hasAbyssFeature || ((cfg,src,id)=>false))(C, st || runtime.state, featureId); };
  runtime.isAbyssUpgradeUnlocked = function(st, def){
    if (!def || !def.unlockFeature) return true;
    return runtime.hasAbyssFeature(st, def.unlockFeature);
  };
  runtime.getActiveChallengeDef = function(st){ return (H.getActiveChallengeDef || ((cfg,src)=>null))(C, st || runtime.state); };
  runtime.getUnlockedPrestigeLayerCount = function(st){ return (H.getUnlockedPrestigeLayerCount || ((cfg,src)=>0))(C, st || runtime.state); };
  runtime.getUnlockedCelestialLayerCount = function(st){ return (H.getUnlockedCelestialLayerCount || ((cfg,src)=>0))(C, st || runtime.state); };
  runtime.getPrestigeLayerStatus = function(st){ return (H.getPrestigeLayerStatus || ((cfg,src)=>[]))(C, st || runtime.state); };
  runtime.getCelestialLayerStatus = function(st){ return (H.getCelestialLayerStatus || ((cfg,src)=>[]))(C, st || runtime.state); };
  runtime.getCelestialBranchStatus = function(st){ return (H.getCelestialBranchStatus || ((cfg,src)=>[]))(C, st || runtime.state); };
  runtime.hasSpecialAscUpgrade = function(st, kind){ return (H.hasSpecialAscUpgrade || ((cfg,src,k)=>false))(C, st || runtime.state, kind); };
  runtime.ascUpgradeMaxLevel = function(def, st){
    return (H.ascUpgradeMaxLevel || ((cfg,src,d)=> (typeof d?.maxLevel === 'number' ? d.maxLevel : Infinity)))(C, st || runtime.state, def);
  };
  runtime.legacyMaxLevel = function(def, st){
    return (H.legacyMaxLevel || ((cfg,src,d)=> (typeof d?.maxLevel === 'number' ? d.maxLevel : Infinity)))(C, st || runtime.state, def);
  };
  runtime.legacyCostForNextLevel = function(def, currentLevel, st){
    return (H.legacyCostForNextLevel || ((cfg,src,d,lvl)=>Math.floor(d.baseCost * Math.pow(d.costMult, lvl))))(C, st || runtime.state, def, currentLevel);
  };
  runtime.calcPrestigeGainFromTotal = function(totalGoldEarned){
    return (H.calcPrestigeGainFromTotal || ((cfg,total)=>0))(C, totalGoldEarned);
  };
  runtime.calcAscGainFromPrestige = function(prestigeEarned){
    return (H.calcAscGainFromPrestige || ((cfg,p)=>0))(C, prestigeEarned);
  };
  runtime.calcCelestialGain = function(ascGain){
    return (H.calcCelestialGain || ((unlocked,a)=>0))(runtime.getUnlockedCelestialLayerCount(runtime.state), ascGain);
  };
  runtime.abyssUpgradeCost = function(def, lvl){ return (H.abyssUpgradeCost || ((d,l)=>1))(def, lvl); };
  runtime.abyssUpgradeMaxLevel = function(def){ return (def && typeof def.maxLevel === 'number') ? def.maxLevel : Infinity; };
})();
