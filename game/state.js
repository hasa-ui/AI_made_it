// state.js — セーブ/ロード・状態管理
(function(){
  const C = window.CONFIG;
  if (!C) throw new Error('CONFIG must be loaded before state.js');

  const SAVE_KEY = C.SAVE_KEY;
  const SAVE_VERSION = C.SAVE_VERSION || 1;

  function nowSec(){ return Date.now()/1000; }
  function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }

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
    settings: {
      notation:'compact',
      notationThreshold:1000,
      activeTab:'play',
      confirmLegacyBuy:true,
      confirmLegacyBuyMax:true,
      toast:{ achievement:true, offline:true, purchase:true, general:true },
      autoBuy:{ enabled:false, units:true, upgrades:true, intervalMs:500, purchaseMode:'single' }
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
      ascendedInChallenge: 0
    }
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

    merged.settings = Object.assign({}, deepCopy(defaultState.settings), merged.settings || {});
    merged.settings.toast = Object.assign({}, defaultState.settings.toast, merged.settings.toast || {});
    merged.settings.autoBuy = Object.assign({}, defaultState.settings.autoBuy, merged.settings.autoBuy || {});
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
    return merged;
  }

  function loadRaw(){ try{ const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch(e){ return null; } }
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
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      const el = document.getElementById('lastSave');
      if (el) el.textContent = new Date(s.lastSavedAt*1000).toLocaleString();
    } catch(e){ console.error(e); }
  }

  // Expose API
  window.StateManager = {
    defaultState: defaultState,
    saveVersion: SAVE_VERSION,
    loadState: loadState,
    saveState: saveState,
    importState: importState,
    deepCopy: deepCopy
  };
})();
