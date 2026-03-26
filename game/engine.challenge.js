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

    function startChallengeInternal(id){
      const state = getState();
      const ch = (C.CHALLENGES || []).find(x=>x.id===id);
      if (!ch) return { ok:false, reason:'not_found' };
      state.challenge = state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedTotalGold:null };
      if (state.challenge.activeId) return { ok:false, reason:'already_active' };
      const rewardSummary = getChallengeRewardSummary(state);
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
      state.challenge = state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedTotalGold:null };
      const restoredTotalGold = state.challenge.savedTotalGold;
      state.challenge.activeId = null;
      if (typeof restoredTotalGold === 'number') state.totalGoldEarned = restoredTotalGold;
      state.challenge.savedTotalGold = null;
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
      state.challenge = state.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0, savedTotalGold:null };
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
      const restoredTotalGold = state.challenge.savedTotalGold;
      state.challenge.activeId = null;
      if (typeof restoredTotalGold === 'number') state.totalGoldEarned = restoredTotalGold;
      state.challenge.savedTotalGold = null;
      invalidateAggCache();
      recalcAndCacheGPS(state);
      return { ok:true, id:ch.id, firstClear: !Number.isFinite(prev), sec, unlockedFeature };
    }

    return { startChallengeInternal, abandonChallengeInternal, tryCompleteChallengeInternal };
  }

  window.EngineChallengeActions = { create };
})();
