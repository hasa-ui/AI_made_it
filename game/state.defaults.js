// state.defaults.js — 状態既定値と JSON 変換 helper
(function(){
  const C = window.CONFIG;
  if (!C) throw new Error('CONFIG must be loaded before state.defaults.js');

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
      uiUpdateIntervalMs: C.UI_UPDATE_INTERVAL_MS || 120,
      uiSlowUpdateIntervalMs: C.UI_SLOW_UPDATE_INTERVAL_MS || 400,
      activeTab:'play',
      activeSubTabs:{ prestige:'core', ascension:'core' },
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
      savedGold: null,
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

  window.StateRuntime = {
    C,
    SAVE_KEY,
    SAVE_VERSION,
    nowSec,
    deepCopy,
    stringifyState,
    parseStateText,
    defaultState
  };
})();
