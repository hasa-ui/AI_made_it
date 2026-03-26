// engine.reset.js — prestige / ascend / abyss reset
(function(){
  const runtime = window.EngineRuntime;
  if (!runtime) throw new Error('engine.runtime.js must be loaded before engine.reset.js');

  const C = runtime.C;

  runtime.doPrestigeInternal = function(){
    const gain = runtime.previewPrestigeGain();
    if (gain <= 0) return { ok:false };
    runtime.state.prestigeEarnedTotal = (runtime.state.prestigeEarnedTotal || 0) + gain;
    runtime.state.legacy = (runtime.state.legacy || 0) + gain;
    runtime.state.units = (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.state.upgrades = (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.invalidateAggCache();
    runtime.state.gold = runtime.computeStartingGoldOnPrestige();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, gain };
  };

  runtime.doAscendInternal = function(){
    const gain = runtime.previewAscGain();
    if (gain <= 0) return { ok:false };
    const keepTotalGold = runtime.hasSpecialAscUpgrade(runtime.state, 'keepTotalGold');
    const keepLegacyTree = runtime.hasSpecialAscUpgrade(runtime.state, 'keepLegacyTree');
    const challengeRewards = runtime.getChallengeRewardSummary(runtime.state);
    const keepLegacyInChallenge = !!(runtime.state.challenge && runtime.state.challenge.activeId && challengeRewards.keepLegacyOnChallenge);
    runtime.state.ascPoints = (runtime.state.ascPoints || 0) + gain;
    runtime.state.ascEarnedTotal = (runtime.state.ascEarnedTotal || 0) + gain;
    const celestialGain = runtime.calcCelestialGain(gain);
    runtime.state.celestialPoints = (runtime.state.celestialPoints || 0) + celestialGain;
    runtime.state.celestialEarnedTotal = (runtime.state.celestialEarnedTotal || 0) + celestialGain;
    runtime.state.units = (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.state.upgrades = (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.state.prestigeEarnedTotal = 0;
    if (!keepLegacyInChallenge) runtime.state.legacy = 0;
    if (!keepTotalGold) runtime.state.totalGoldEarned = 0;
    if (!keepLegacyTree && !keepLegacyInChallenge) runtime.state.legacyNodes = (C.LEGACY_DEFS || []).reduce((a,d)=>(a[d.id]=0,a),{});

    runtime.state.runStats = runtime.state.runStats || {};
    runtime.state.runStats.history = Array.isArray(runtime.state.runStats.history) ? runtime.state.runStats.history : [];
    const now = runtime.nowSec();
    const startedAt = runtime.state.runStats.currentRunStartedAt || now;
    const durationSec = Math.max(0, Math.floor(now - startedAt));
    const peakGold = Math.max(runtime.state.runStats.currentRunPeakGold || 0, runtime.state.gold || 0);
    const unitTypesUsed = Object.keys(runtime.state.runStats.currentRunUnitTypes || {}).filter(k => (runtime.state.runStats.currentRunUnitTypes[k] || 0) > 0).length;
    const runSummary = {
      run: (runtime.state.runStats.runCount || 1),
      reachedGold: peakGold,
      durationSec,
      gainedAP: gain,
      noUpgrade: (runtime.state.runStats.currentRunUpgradeBuys || 0) === 0,
      unitTypesUsed,
      challengeId: (runtime.state.challenge && runtime.state.challenge.activeId) || null,
      endedAt: now
    };
    runtime.state.lastAscensionRun = runSummary;
    runtime.state.challenge = runtime.state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedSnapshot:null, savedGold:null, savedTotalGold:null };
    if (runtime.state.challenge.activeId) runtime.state.challenge.ascendedInChallenge = (runtime.state.challenge.ascendedInChallenge || 0) + 1;
    runtime.state.runStats.history.push(runSummary);
    if (runtime.state.runStats.history.length > 30) runtime.state.runStats.history = runtime.state.runStats.history.slice(-30);
    runtime.state.runStats.runCount = (runtime.state.runStats.runCount || 1) + 1;
    runtime.state.runStats.currentRunStartedAt = now;
    runtime.state.runStats.currentRunPeakGold = 0;
    runtime.state.runStats.currentRunUnitTypes = {};
    runtime.state.runStats.currentRunUpgradeBuys = 0;

    runtime.invalidateAggCache();
    runtime.state.gold = runtime.computeStartingGoldOnPrestige();
    runtime.state.runStats.currentRunPeakGold = runtime.state.gold;
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, gain, celestialGain };
  };

  runtime.doAbyssResetInternal = function(){
    const gain = runtime.previewAbyssGain();
    if (gain <= 0) return { ok:false, reason:'goal' };
    runtime.recordAbyssMilestoneProgress(runtime.state);
    runtime.state.abyss = runtime.state.abyss || { shards:0, resetCount:0, bestChallengeCompletions:0, bestCelestialLayerCount:0, features:{}, upgrades:{} };
    runtime.state.abyss.features = runtime.state.abyss.features || {};
    runtime.state.abyss.upgrades = runtime.state.abyss.upgrades || (C.ABYSS_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.state.abyss.shards = (runtime.state.abyss.shards || 0) + gain;
    runtime.state.abyss.resetCount = (runtime.state.abyss.resetCount || 0) + 1;
    runtime.state.gold = C.STARTING_GOLD || 50;
    runtime.state.units = (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.state.upgrades = (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.state.legacy = 0;
    runtime.state.legacyNodes = (C.LEGACY_DEFS || []).reduce((a,d)=>(a[d.id]=0,a),{});
    runtime.state.totalGoldEarned = 0;
    runtime.state.prestigeEarnedTotal = 0;
    runtime.state.ascPoints = 0;
    runtime.state.ascEarnedTotal = 0;
    runtime.state.ascOwned = (C.ASC_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.state.celestialPoints = 0;
    runtime.state.celestialEarnedTotal = 0;
    runtime.state.celestialOwned = (C.CELESTIAL_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{});
    runtime.state.celestial = { activeBranchId:null };
    runtime.state.challenge = runtime.buildChallengeStateAfterAbyssReset(runtime.state);
    runtime.state.runStats = runtime.state.runStats || {};
    const now = runtime.nowSec();
    runtime.state.runStats.currentRunStartedAt = now;
    runtime.state.runStats.currentRunPeakGold = runtime.state.gold;
    runtime.state.runStats.currentRunUnitTypes = {};
    runtime.state.runStats.currentRunUpgradeBuys = 0;
    runtime.invalidateAggCache();
    runtime.recalcAndCacheGPS(runtime.state);
    return { ok:true, gain };
  };
})();
