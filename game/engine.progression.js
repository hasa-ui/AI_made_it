// engine.progression.js — previews / offline / abyss roadmap
(function(){
  const runtime = window.EngineRuntime;
  if (!runtime) throw new Error('engine.runtime.js must be loaded before engine.progression.js');

  const C = runtime.C;

  runtime.getAbyssGainBreakdownInternal = function(st){
    const src = st || runtime.state;
    const goal = C.ABYSS_RESET_GOAL || Number.MAX_VALUE;
    const total = src.totalGoldEarned || 0;
    const ready = total >= goal;
    const isOverflow = total === Infinity;
    const milestoneProgress = runtime.getAbyssMilestoneProgress(src);
    const completedChallenges = milestoneProgress.completedChallenges;
    const unlockedCelestialLayers = milestoneProgress.unlockedCelestialLayers;
    const resetCount = (src.abyss && src.abyss.resetCount) || 0;
    let upgradeFlat = 0;
    let overflowUpgrade = 0;
    for (const def of (C.ABYSS_UPGRADES || [])){
      if (!runtime.isAbyssUpgradeUnlocked(src, def)) continue;
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
  };

  runtime.getAbyssObjectivesInternal = function(st){
    const src = st || runtime.state;
    const breakdown = runtime.getAbyssGainBreakdownInternal(src);
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
    const nextFeature = Object.entries(C.ABYSS_FEATURES || {}).find(([featureId])=>!runtime.hasAbyssFeature(src, featureId));
    if (nextFeature){
      const [featureId, def] = nextFeature;
      const ch = (C.CHALLENGES || []).find(x=>x.id === def.unlockChallengeId);
      objectives.push({
        id:`feature-${featureId}`,
        title:def.name || '機能解放',
        current: runtime.hasAbyssFeature(src, featureId) ? 1 : 0,
        target: 1,
        reward:def.desc || '機能解放',
        done:false,
        desc: ch ? `${ch.name} をクリアして解放` : '対応Challengeクリアで解放'
      });
    }
    return objectives;
  };

  runtime.previewPrestigeGain = function(){
    return Math.max(0, runtime.calcPrestigeGainFromTotal(runtime.state.totalGoldEarned || 0) - (runtime.state.prestigeEarnedTotal || 0));
  };

  runtime.computeStartingGoldOnPrestige = function(){
    const activeChallenge = runtime.getActiveChallengeDef(runtime.state);
    if (activeChallenge && activeChallenge.effects && typeof activeChallenge.effects.forceStartGold === 'number'){
      return Math.max(0, activeChallenge.effects.forceStartGold);
    }
    return (C.STARTING_GOLD || 50) + (runtime.getAggregates(runtime.state).startingGoldBonus || 0);
  };

  runtime.previewAscGain = function(){
    return Math.max(0, runtime.calcAscGainFromPrestige(runtime.state.prestigeEarnedTotal || 0));
  };

  runtime.previewAbyssGain = function(){
    return runtime.getAbyssGainBreakdownInternal(runtime.state).current;
  };

  runtime.getUiPreviewSnapshot = function(){
    return {
      prestigeGain: runtime.previewPrestigeGain(),
      startingGold: runtime.computeStartingGoldOnPrestige(),
      ascGain: runtime.previewAscGain(),
      abyssGain: runtime.previewAbyssGain()
    };
  };

  runtime.applyOfflineProgressWithToast = function(){
    const now = runtime.nowSec();
    const elapsed = Math.min(now - (runtime.state.lastSavedAt || now), (C.MAX_OFFLINE_SECONDS || 60*60*24));
    if (elapsed > 1){
      runtime.recalcAndCacheGPS(runtime.state);
      const gain = runtime.state.gpsCache * elapsed;
      runtime.state.gold += gain;
      runtime.state.totalGoldEarned += gain;
      runtime.state.lastSavedAt = now;
      return { gain, elapsed };
    }
    return null;
  };
})();
