// state.migration.js — セーブ移行と shape 補完
(function(){
  const runtime = window.StateRuntime;
  if (!runtime) throw new Error('state.defaults.js must be loaded before state.migration.js');

  const { C, SAVE_VERSION, deepCopy, defaultState } = runtime;

  function migrateState(raw){
    if (!raw || typeof raw !== 'object') throw new Error('Invalid save data: object required');
    const sourceVersion = Number(raw.version || 0);
    if (sourceVersion > SAVE_VERSION) throw new Error(`このセーブデータは新しいバージョンです (save=${sourceVersion}, app=${SAVE_VERSION})`);

    const merged = Object.assign(deepCopy(defaultState), raw);
    merged.version = SAVE_VERSION;

    merged.legacyNodes = merged.legacyNodes || {};
    for (const d of C.LEGACY_DEFS) if (!(d.id in merged.legacyNodes)) merged.legacyNodes[d.id] = 0;

    merged.upgrades = merged.upgrades || {};
    for (const u of C.UPGRADE_DEFS) if (!(u.id in merged.upgrades)) merged.upgrades[u.id] = 0;

    merged.units = merged.units || {};
    for (const u of C.UNIT_DEFS) if (!(u.id in merged.units)) merged.units[u.id] = 0;

    merged.ascOwned = merged.ascOwned || {};
    for (const a of C.ASC_UPGRADES) if (!(a.id in merged.ascOwned)) merged.ascOwned[a.id] = 0;
    if (sourceVersion > 0 && sourceVersion < 16){
      let refundedAp = 0;
      for (const def of C.ASC_UPGRADES){
        const baseMaxLevel = (typeof def.maxLevel === 'number') ? def.maxLevel : Infinity;
        if (!Number.isFinite(baseMaxLevel) || baseMaxLevel > 1) continue;
        const owned = merged.ascOwned[def.id] || 0;
        if (owned <= baseMaxLevel) continue;
        refundedAp += (owned - baseMaxLevel) * (def.cost || 0);
        merged.ascOwned[def.id] = baseMaxLevel;
      }
      if (refundedAp > 0) merged.ascPoints = (merged.ascPoints || 0) + refundedAp;
    }

    merged.celestialOwned = merged.celestialOwned || {};
    for (const a of (C.CELESTIAL_UPGRADES || [])) if (!(a.id in merged.celestialOwned)) merged.celestialOwned[a.id] = 0;
    if (typeof merged.celestialPoints !== 'number') merged.celestialPoints = 0;
    if (typeof merged.celestialEarnedTotal !== 'number') merged.celestialEarnedTotal = 0;
    merged.celestial = Object.assign({}, deepCopy(defaultState.celestial), merged.celestial || {});
    if (typeof merged.celestial.activeBranchId !== 'string') merged.celestial.activeBranchId = null;
    if (sourceVersion > 0 && sourceVersion < 14){
      let refundedCp = 0;
      for (const def of (C.CELESTIAL_UPGRADES || [])){
        if (!def.branch || def.branch === 'shared') continue;
        const lvl = merged.celestialOwned[def.id] || 0;
        if (lvl <= 0) continue;
        refundedCp += (def.cost || 0) * lvl;
        merged.celestialOwned[def.id] = 0;
      }
      if (refundedCp > 0) merged.celestialPoints = (merged.celestialPoints || 0) + refundedCp;
    }

    merged.settings = Object.assign({}, deepCopy(defaultState.settings), merged.settings || {});
    merged.settings.toast = Object.assign({}, defaultState.settings.toast, merged.settings.toast || {});
    merged.settings.autoBuy = Object.assign({}, defaultState.settings.autoBuy, merged.settings.autoBuy || {});
    merged.settings.activeSubTabs = Object.assign({}, defaultState.settings.activeSubTabs, merged.settings.activeSubTabs || {});
    if (typeof merged.settings.autoBuy.intervalMs !== 'number'){
      const oldSec = Number(merged.settings.autoBuy.intervalSec || 0.5);
      merged.settings.autoBuy.intervalMs = Math.max(50, Math.round(oldSec * 1000));
    }
    if (!merged.settings.autoBuy.purchaseMode) merged.settings.autoBuy.purchaseMode = 'single';
    delete merged.settings.autoBuy.intervalSec;

    merged.achievementsOwned = merged.achievementsOwned || {};
    merged.achievementsProgress = merged.achievementsProgress || {};
    merged.miniGame = Object.assign({}, deepCopy(defaultState.miniGame), merged.miniGame || {});
    merged.runStats = Object.assign({}, deepCopy(defaultState.runStats), merged.runStats || {});
    merged.runStats.currentRunUnitTypes = Object.assign({}, merged.runStats.currentRunUnitTypes || {});
    merged.runStats.history = Array.isArray(merged.runStats.history) ? merged.runStats.history.slice(-30) : [];
    if (!merged.lastAscensionRun || typeof merged.lastAscensionRun !== 'object') merged.lastAscensionRun = null;
    merged.challenge = Object.assign({}, deepCopy(defaultState.challenge), merged.challenge || {});
    merged.challenge.completed = Object.assign({}, merged.challenge.completed || {});
    merged.challenge.bestSec = Object.assign({}, merged.challenge.bestSec || {});
    if (typeof merged.challenge.ascendedInChallenge !== 'number') merged.challenge.ascendedInChallenge = 0;
    if (typeof merged.challenge.savedGold !== 'number' && merged.challenge.savedGold !== null) merged.challenge.savedGold = null;
    if (typeof merged.challenge.savedTotalGold !== 'number' && merged.challenge.savedTotalGold !== null) merged.challenge.savedTotalGold = null;
    merged.abyss = Object.assign({}, deepCopy(defaultState.abyss), merged.abyss || {});
    merged.abyss.features = Object.assign({}, deepCopy(defaultState.abyss.features), merged.abyss.features || {});
    merged.abyss.upgrades = Object.assign({}, deepCopy(defaultState.abyss.upgrades), merged.abyss.upgrades || {});
    if (!Number.isFinite(merged.abyss.bestChallengeCompletions)) merged.abyss.bestChallengeCompletions = 0;
    if (!Number.isFinite(merged.abyss.bestCelestialLayerCount)) merged.abyss.bestCelestialLayerCount = 0;
    for (const u of (C.ABYSS_UPGRADES || [])) if (!(u.id in merged.abyss.upgrades)) merged.abyss.upgrades[u.id] = 0;
    const currentChallengeCount = (C.CHALLENGES || []).reduce((count, ch)=>{
      return count + ((merged.challenge.completed && merged.challenge.completed[ch.id]) ? 1 : 0);
    }, 0);
    merged.abyss.bestChallengeCompletions = Math.max(merged.abyss.bestChallengeCompletions, currentChallengeCount);
    const currentCelestialLayerCount = (C.CELESTIAL_LAYERS || []).reduce((count, layer)=>{
      return count + (((merged.ascEarnedTotal || 0) >= (layer.need || 0)) ? 1 : 0);
    }, 0);
    merged.abyss.bestCelestialLayerCount = Math.max(merged.abyss.bestCelestialLayerCount, currentCelestialLayerCount);
    for (const ch of (C.CHALLENGES || [])){
      const reward = ch.reward || {};
      if (reward.type !== 'unlockFeature' || !reward.feature) continue;
      if (merged.challenge.completed && merged.challenge.completed[ch.id]) merged.abyss.features[reward.feature] = true;
    }
    if (typeof merged.seenUpdateVersion !== 'string') merged.seenUpdateVersion = merged.seenUpdateVersion || null;
    return merged;
  }

  runtime.migrateState = migrateState;
})();
