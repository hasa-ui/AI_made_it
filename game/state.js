// state.js — セーブ/ロード・状態管理
(function(){
  const C = window.CONFIG;
  if (!C) throw new Error('CONFIG must be loaded before state.js');

  const SAVE_KEY = C.SAVE_KEY;
  const SAVE_VERSION = C.SAVE_VERSION || 1;
  const SPECIAL_NUM_PREFIX = '__NUM__:';

  function nowSec(){ return Date.now()/1000; }
  function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }
  function jsonNumberReplacer(_k, v){
    if (typeof v !== 'number') return v;
    if (Number.isFinite(v)) return v;
    if (Number.isNaN(v)) return `${SPECIAL_NUM_PREFIX}NaN`;
    return v > 0 ? `${SPECIAL_NUM_PREFIX}Infinity` : `${SPECIAL_NUM_PREFIX}-Infinity`;
  }
  function jsonNumberReviver(_k, v){
    if (typeof v !== 'string' || !v.startsWith(SPECIAL_NUM_PREFIX)) return v;
    const tag = v.slice(SPECIAL_NUM_PREFIX.length);
    if (tag === 'Infinity') return Infinity;
    if (tag === '-Infinity') return -Infinity;
    if (tag === 'NaN') return NaN;
    return v;
  }
  function stringifyState(s, space){ return JSON.stringify(s, jsonNumberReplacer, space); }
  function parseStateText(text){ return JSON.parse(text, jsonNumberReviver); }

  const defaultState = {
    version: SAVE_VERSION,
    gold: C.STARTING_GOLD,
    units: C.UNIT_DEFS.reduce((a,u)=>(a[u.id]=0,a),{}),
    upgrades: C.UPGRADE_DEFS.reduce((a,u)=>(a[u.id]=0,a),{}),
    legacy: 0,
    legacyNodes: C.LEGACY_DEFS.reduce((a,d)=>(a[d.id]=0,a),{}),
    totalGoldEarned: 0,
    lastSavedAt: nowSec(),
    gpsCache: 0,
    prestigeEarnedTotal: 0,
    ascPoints: 0,
    ascEarnedTotal: 0,
    ascOwned: C.ASC_UPGRADES.reduce((a,u)=>(a[u.id]=0,a),{}),
    celestialPoints: 0,
    celestialEarnedTotal: 0,
    celestialOwned: (C.CELESTIAL_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{}),
    celestial: {
      activeBranchId: null
    },
    settings: {
      notation:'compact',
      notationThreshold:1000,
      activeTab:'play',
      activeSubTabs:{ prestige:'core', ascension:'core' },
      confirmLegacyBuy:true,
      confirmLegacyBuyMax:true,
      toast:{ achievement:true, offline:true, purchase:true, general:true },
      autoBuy:{ enabled:false, units:true, upgrades:true, legacy:false, intervalMs:500, purchaseMode:'single' }
    },
    achievementsOwned: {},
    achievementsProgress: {},
    miniGame: {
      plays: 0,
      bestScore: 0,
      lastScore: 0,
      lastMisses: 0,
      perfectRuns: 0,
      bestStreak: 0
    },
    runStats: {
      runCount: 1,
      currentRunStartedAt: nowSec(),
      currentRunPeakGold: C.STARTING_GOLD,
      currentRunUnitTypes: {},
      currentRunUpgradeBuys: 0,
      history: []
    },
    lastAscensionRun: null,
    challenge: {
      activeId: null,
      completed: {},
      bestSec: {},
      ascendedInChallenge: 0,
      savedTotalGold: null
    },
    abyss: {
      shards: 0,
      resetCount: 0,
      bestChallengeCompletions: 0,
      bestCelestialLayerCount: 0,
      features: {},
      upgrades: (C.ABYSS_UPGRADES || []).reduce((a,u)=>(a[u.id]=0,a),{})
    },
    seenUpdateVersion: null
  };

  function migrateState(raw){
    if (!raw || typeof raw !== 'object') throw new Error('Invalid save data: object required');
    const sourceVersion = Number(raw.version || 0);
    if (sourceVersion > SAVE_VERSION) throw new Error(`このセーブデータは新しいバージョンです (save=${sourceVersion}, app=${SAVE_VERSION})`);

    const merged = Object.assign(deepCopy(defaultState), raw);
    merged.version = SAVE_VERSION;

    merged.legacyNodes = merged.legacyNodes || {};
    for (const d of C.LEGACY_DEFS) if (!(d.id in merged.legacyNodes)) merged.legacyNodes[d.id]=0;

    merged.upgrades = merged.upgrades || {};
    for (const u of C.UPGRADE_DEFS) if (!(u.id in merged.upgrades)) merged.upgrades[u.id]=0;

    merged.units = merged.units || {};
    for (const u of C.UNIT_DEFS) if (!(u.id in merged.units)) merged.units[u.id]=0;

    merged.ascOwned = merged.ascOwned || {};
    for (const a of C.ASC_UPGRADES) if (!(a.id in merged.ascOwned)) merged.ascOwned[a.id]=0;

    merged.celestialOwned = merged.celestialOwned || {};
    for (const a of (C.CELESTIAL_UPGRADES || [])) if (!(a.id in merged.celestialOwned)) merged.celestialOwned[a.id]=0;
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
    if (typeof merged.challenge.savedTotalGold !== 'number' && merged.challenge.savedTotalGold !== null) merged.challenge.savedTotalGold = null;
    merged.abyss = Object.assign({}, deepCopy(defaultState.abyss), merged.abyss || {});
    merged.abyss.features = Object.assign({}, deepCopy(defaultState.abyss.features), merged.abyss.features || {});
    merged.abyss.upgrades = Object.assign({}, deepCopy(defaultState.abyss.upgrades), merged.abyss.upgrades || {});
    if (!Number.isFinite(merged.abyss.bestChallengeCompletions)) merged.abyss.bestChallengeCompletions = 0;
    if (!Number.isFinite(merged.abyss.bestCelestialLayerCount)) merged.abyss.bestCelestialLayerCount = 0;
    for (const u of (C.ABYSS_UPGRADES || [])) if (!(u.id in merged.abyss.upgrades)) merged.abyss.upgrades[u.id]=0;
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

  function loadRaw(){ try{ const s = localStorage.getItem(SAVE_KEY); return s ? parseStateText(s) : null; } catch(e){ return null; } }
  function loadState(){
    const raw = loadRaw();
    if (!raw) return deepCopy(defaultState);
    try {
      return migrateState(raw);
    } catch (e){
      console.warn('Save migration failed, fallback to default state', e);
      return deepCopy(defaultState);
    }
  }

  function importState(raw){ return migrateState(raw); }

  function saveState(s){
    try{
      s.version = SAVE_VERSION;
      s.lastSavedAt = nowSec();
      localStorage.setItem(SAVE_KEY, stringifyState(s));
      const el = document.getElementById('lastSave');
      if (el) el.textContent = new Date(s.lastSavedAt*1000).toLocaleString();
    } catch(e){ console.error(e); }
  }

  // Expose API
  window.StateManager = {
    defaultState: defaultState,
    saveVersion: SAVE_VERSION,
    stringifyState: stringifyState,
    parseStateText: parseStateText,
    loadState: loadState,
    saveState: saveState,
    importState: importState,
    deepCopy: deepCopy
  };
})();
