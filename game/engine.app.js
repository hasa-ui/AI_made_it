// engine.app.js — facade
(function(){
  const runtime = window.EngineRuntime;
  if (!runtime) throw new Error('engine.runtime.js must be loaded before engine.app.js');

  runtime.loadInitialState();

  const challengeActions = (window.EngineChallengeActions && window.EngineChallengeActions.create)
    ? window.EngineChallengeActions.create({
        C: runtime.C,
        stateRef: { get: ()=>runtime.state },
        nowSec: runtime.nowSec,
        computeStartingGoldOnPrestige: ()=>runtime.computeStartingGoldOnPrestige(),
        invalidateAggCache: ()=>runtime.invalidateAggCache(),
        recalcAndCacheGPS: (st)=>runtime.recalcAndCacheGPS(st),
        getActiveChallengeDef: (st)=>runtime.getActiveChallengeDef(st),
        getChallengeRewardSummary: (st)=>runtime.getChallengeRewardSummary(st),
        getChallengeGoalTotal: (ch, st)=>runtime.getChallengeGoalTotal(ch, st)
      })
    : null;

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

  window.ENGINE = {
    getAggregates: (st) => runtime.getAggregates(st || runtime.state),
    invalidateAggCache: ()=>runtime.invalidateAggCache(),
    unitCost: (def, owned, st) => runtime.unitCost(def, owned, st || runtime.state),
    upgradeCostNextLevel: runtime.upgradeCostNextLevel,
    legacyCostForNextLevel: (def, currentLevel, st) => runtime.legacyCostForNextLevel(def, currentLevel, st || runtime.state),
    legacyMaxLevel: (def, st) => runtime.legacyMaxLevel(def, st || runtime.state),
    computeBaseGPS: (st) => runtime.computeBaseGPS(st || runtime.state),
    computeGPSFull: (st) => runtime.computeGPSFull(st || runtime.state),
    recalcAndCacheGPS: (st) => runtime.recalcAndCacheGPS(st || runtime.state),
    getUiEconomySnapshot: (st) => runtime.getUiEconomySnapshot(st || runtime.state),

    buyUnitInternal: (unitId, qty) => runtime.buyUnitInternal(unitId, qty),
    buyMaxUnitsInternal: (unitId) => runtime.buyMaxUnitsInternal(unitId),
    buyUpgradeInternal: (upId) => runtime.buyUpgradeInternal(upId),
    buyMaxUpgradeInternal: (upId) => runtime.buyMaxUpgradeInternal(upId),
    attemptBuyLegacyInternal: (legacyId, maxCount) => runtime.attemptBuyLegacyInternal(legacyId, maxCount),
    canBuyLegacyInternal: (legacyId, st) => runtime.canBuyLegacyInternal(legacyId, st || runtime.state),
    buyAscensionUpgradeInternal: (id) => runtime.buyAscensionUpgradeInternal(id),
    getAscUpgradeMaxLevel: (def, st) => runtime.ascUpgradeMaxLevel(def, st || runtime.state),
    buyCelestialUpgradeInternal: (id) => runtime.buyCelestialUpgradeInternal(id),
    selectCelestialBranchInternal: (id) => runtime.selectCelestialBranchInternal(id),
    startChallengeInternal,
    abandonChallengeInternal,
    tryCompleteChallengeInternal,
    getActiveChallenge: (st) => runtime.getActiveChallengeDef(st || runtime.state),
    getPrestigeLayerStatus: (st) => runtime.getPrestigeLayerStatus(st || runtime.state),
    getUnlockedPrestigeLayerCount: (st) => runtime.getUnlockedPrestigeLayerCount(st || runtime.state),
    getCelestialLayerStatus: (st) => runtime.getCelestialLayerStatus(st || runtime.state),
    getUnlockedCelestialLayerCount: (st) => runtime.getUnlockedCelestialLayerCount(st || runtime.state),
    getCelestialBranchStatus: (st) => runtime.getCelestialBranchStatus(st || runtime.state),

    previewPrestigeGain: ()=>runtime.previewPrestigeGain(),
    computeStartingGoldOnPrestige: ()=>runtime.computeStartingGoldOnPrestige(),
    previewAscGain: ()=>runtime.previewAscGain(),
    previewAbyssGain: ()=>runtime.previewAbyssGain(),
    getUiPreviewSnapshot: ()=>runtime.getUiPreviewSnapshot(),
    getAbyssUpgradeStatus: (st) => runtime.getAbyssUpgradeStatus(st || runtime.state),
    getAbyssGainBreakdown: (st) => runtime.getAbyssGainBreakdownInternal(st || runtime.state),
    getAbyssObjectives: (st) => runtime.getAbyssObjectivesInternal(st || runtime.state),
    hasAbyssFeature: (featureId, st) => runtime.hasAbyssFeature(st || runtime.state, featureId),
    getChallengeRewardSummary: (st) => runtime.getChallengeRewardSummary(st || runtime.state),
    getChallengeGoalTotal: (ch, st) => runtime.getChallengeGoalTotal(ch, st || runtime.state),
    buyAbyssUpgradeInternal: (id) => runtime.buyAbyssUpgradeInternal(id),
    doPrestigeInternal: ()=>runtime.doPrestigeInternal(),
    doAscendInternal: ()=>runtime.doAscendInternal(),
    doAbyssResetInternal: ()=>runtime.doAbyssResetInternal(),

    applyOfflineProgressWithToast: ()=>runtime.applyOfflineProgressWithToast(),

    getState: ()=>runtime.state,
    setState: (newState)=>runtime.setState(newState),

    invalidateCache: ()=>runtime.invalidateAggCache()
  };
})();
