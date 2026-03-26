// engine.challenge.js
// Challenge関連の進行アクションを engine.app.js から分離

(function(){
  function create(deps){
    const C = deps.C || {};
    const stateRef = deps.stateRef;
    const nowSec = deps.nowSec || (()=>Date.now()/1000);
    const computeStartingGoldOnPrestige = deps.computeStartingGoldOnPrestige || (()=>0);
    const invalidateAggCache = deps.invalidateAggCache || (()=>{});
    const recalcAndCacheGPS = deps.recalcAndCacheGPS || (()=>{});
    const getActiveChallengeDef = deps.getActiveChallengeDef || (()=>null);
    const getChallengeRewardSummary = deps.getChallengeRewardSummary || (()=>({ keepLegacyOnChallenge:false }));
    const getChallengeGoalTotal = deps.getChallengeGoalTotal || ((ch)=>ch.goalTotalGold || Infinity);

    function getState(){ return stateRef.get(); }
    function cloneMap(src){ return Object.assign({}, src || {}); }
    function captureChallengeSnapshot(state){
      const runStats = state.runStats || {};
      return {
        gold: state.gold || 0,
        totalGoldEarned: state.totalGoldEarned || 0,
        prestigeEarnedTotal: state.prestigeEarnedTotal || 0,
        legacy: state.legacy || 0,
        units: cloneMap(state.units),
        upgrades: cloneMap(state.upgrades),
        legacyNodes: cloneMap(state.legacyNodes),
        runStats: {
          currentRunStartedAt: runStats.currentRunStartedAt || null,
          currentRunPeakGold: runStats.currentRunPeakGold || 0,
          currentRunUnitTypes: cloneMap(runStats.currentRunUnitTypes),
          currentRunUpgradeBuys: runStats.currentRunUpgradeBuys || 0
        }
      };
    }
    function restoreChallengeSnapshot(state){
      state.challenge = state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedSnapshot:null, savedGold:null, savedTotalGold:null };
      const snap = state.challenge.savedSnapshot;
      if (snap && typeof snap === 'object'){
        state.gold = typeof snap.gold === 'number' ? snap.gold : (state.challenge.savedGold || 0);
        state.totalGoldEarned = typeof snap.totalGoldEarned === 'number' ? snap.totalGoldEarned : (state.challenge.savedTotalGold || 0);
        state.prestigeEarnedTotal = typeof snap.prestigeEarnedTotal === 'number' ? snap.prestigeEarnedTotal : (state.prestigeEarnedTotal || 0);
        state.legacy = typeof snap.legacy === 'number' ? snap.legacy : (state.legacy || 0);
        state.units = cloneMap(snap.units);
        state.upgrades = cloneMap(snap.upgrades);
        state.legacyNodes = cloneMap(snap.legacyNodes);
        state.runStats = state.runStats || {};
        const snapRunStats = snap.runStats || {};
        state.runStats.currentRunStartedAt = snapRunStats.currentRunStartedAt || null;
        state.runStats.currentRunPeakGold = snapRunStats.currentRunPeakGold || 0;
        state.runStats.currentRunUnitTypes = cloneMap(snapRunStats.currentRunUnitTypes);
        state.runStats.currentRunUpgradeBuys = snapRunStats.currentRunUpgradeBuys || 0;
      } else {
        if (typeof state.challenge.savedGold === 'number') state.gold = state.challenge.savedGold;
        if (typeof state.challenge.savedTotalGold === 'number') state.totalGoldEarned = state.challenge.savedTotalGold;
      }
      state.challenge.savedSnapshot = null;
      state.challenge.savedGold = null;
      state.challenge.savedTotalGold = null;
    }

    function startChallengeInternal(id){
      const state = getState();
      const ch = (C.CHALLENGES || []).find(x=>x.id===id);
      if (!ch) return { ok:false, reason:'not_found' };
      state.challenge = state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedSnapshot:null, savedGold:null, savedTotalGold:null };
      if (state.challenge.activeId) return { ok:false, reason:'already_active' };
      const rewardSummary = getChallengeRewardSummary(state);
      state.challenge.savedSnapshot = captureChallengeSnapshot(state);
      state.challenge.savedGold = state.gold || 0;
      state.challenge.savedTotalGold = state.totalGoldEarned || 0;
      state.challenge.activeId = id;
      state.units = (C.UNIT_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
      state.upgrades = (C.UPGRADE_DEFS || []).reduce((a,u)=>(a[u.id]=0,a),{});
      if (!rewardSummary.keepLegacyOnChallenge) state.legacy = 0;
      state.prestigeEarnedTotal = 0;
      state.totalGoldEarned = 0;
      invalidateAggCache();
      state.gold = computeStartingGoldOnPrestige();
      state.runStats = state.runStats || {};
      const now = nowSec();
      state.runStats.currentRunStartedAt = now;
      state.runStats.currentRunPeakGold = state.gold;
      state.runStats.currentRunUnitTypes = {};
      state.runStats.currentRunUpgradeBuys = 0;
      recalcAndCacheGPS(state);
      return { ok:true, id };
    }

    function abandonChallengeInternal(){
      const state = getState();
      state.challenge = state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedSnapshot:null, savedGold:null, savedTotalGold:null };
      state.challenge.activeId = null;
      restoreChallengeSnapshot(state);
      invalidateAggCache();
      recalcAndCacheGPS(state);
      return { ok:true };
    }

    function tryCompleteChallengeInternal(){
      const state = getState();
      const ch = getActiveChallengeDef(state);
      if (!ch) return { ok:false, reason:'no_active' };
      const goal = getChallengeGoalTotal(ch, state);
      if ((state.totalGoldEarned || 0) < goal) return { ok:false, reason:'goal' };
      state.challenge = state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedSnapshot:null, savedGold:null, savedTotalGold:null };
      state.challenge.completed = state.challenge.completed || {};
      state.challenge.bestSec = state.challenge.bestSec || {};
      const now = nowSec();
      const sec = Math.max(0, Math.floor(now - (state.runStats && state.runStats.currentRunStartedAt || now)));
      const prev = state.challenge.bestSec[ch.id] ?? Infinity;
      state.challenge.bestSec[ch.id] = Math.min(prev, sec);
      state.challenge.completed[ch.id] = true;
      state.abyss = state.abyss || { shards:0, resetCount:0, bestChallengeCompletions:0, bestCelestialLayerCount:0, features:{}, upgrades:{} };
      state.abyss.features = state.abyss.features || {};
      const reward = ch.reward || {};
      let unlockedFeature = null;
      if (reward.type === 'unlockFeature' && reward.feature){
        state.abyss.features[reward.feature] = true;
        unlockedFeature = reward.feature;
      }
      state.challenge.activeId = null;
      restoreChallengeSnapshot(state);
      invalidateAggCache();
      recalcAndCacheGPS(state);
      return { ok:true, id:ch.id, firstClear: !Number.isFinite(prev), sec, unlockedFeature };
    }

    return { startChallengeInternal, abandonChallengeInternal, tryCompleteChallengeInternal };
  }

  window.EngineChallengeActions = { create };
})();
