// engine.state-normalizers.js — progression snapshot と reset 後 state 補完
(function(){
  const runtime = window.EngineRuntime;
  if (!runtime) throw new Error('engine.runtime.js must be loaded before engine.state-normalizers.js');

  const C = runtime.C;

  runtime.getAbyssMilestoneProgress = function(st){
    const src = st || runtime.state;
    const abyss = src.abyss || {};
    return {
      completedChallenges: Math.max(abyss.bestChallengeCompletions || 0, runtime.getCompletedChallengeCount(src)),
      unlockedCelestialLayers: Math.max(abyss.bestCelestialLayerCount || 0, runtime.getUnlockedCelestialLayerCount(src))
    };
  };

  runtime.recordAbyssMilestoneProgress = function(st){
    const src = st || runtime.state;
    src.abyss = src.abyss || { shards:0, resetCount:0, bestChallengeCompletions:0, bestCelestialLayerCount:0, features:{}, upgrades:{} };
    src.abyss.bestChallengeCompletions = Math.max(src.abyss.bestChallengeCompletions || 0, runtime.getCompletedChallengeCount(src));
    src.abyss.bestCelestialLayerCount = Math.max(src.abyss.bestCelestialLayerCount || 0, runtime.getUnlockedCelestialLayerCount(src));
  };

  runtime.buildChallengeStateAfterAbyssReset = function(st){
    const src = st || runtime.state;
    const prevChallenge = src.challenge || {};
    const retainedCompleted = {};
    const retainedBestSec = {};
    for (const ch of (C.CHALLENGES || [])){
      if (ch.category !== 'abyss') continue;
      if (prevChallenge.completed && prevChallenge.completed[ch.id]) retainedCompleted[ch.id] = true;
      const bestSec = prevChallenge.bestSec ? prevChallenge.bestSec[ch.id] : undefined;
      if (Number.isFinite(bestSec)) retainedBestSec[ch.id] = bestSec;
    }
    return {
      activeId:null,
      completed:retainedCompleted,
      bestSec:retainedBestSec,
      ascendedInChallenge: prevChallenge.ascendedInChallenge || 0,
      savedGold:null,
      savedTotalGold:null
    };
  };
})();
