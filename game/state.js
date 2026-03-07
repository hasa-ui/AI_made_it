// state.js — セーブ/ロード・状態管理
(function(){
  const C = window.CONFIG;
  if (!C) throw new Error('CONFIG must be loaded before state.js');

  const SAVE_KEY = C.SAVE_KEY;

  function nowSec(){ return Date.now()/1000; }
  function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }

  const defaultState = {
    version: 6,
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
    settings: { notation:'compact', activeTab:'play' },
    achievementsOwned: {},
    achievementsProgress: {}
  };

  function loadRaw(){ try{ const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch(e){ return null; } }
  function loadState(){
    const raw = loadRaw(); if (!raw) return deepCopy(defaultState);
    const merged = Object.assign(deepCopy(defaultState), raw);
    merged.legacyNodes = merged.legacyNodes || {};
    for (const d of C.LEGACY_DEFS) if (!(d.id in merged.legacyNodes)) merged.legacyNodes[d.id]=0;
    merged.upgrades = merged.upgrades || {};
    for (const u of C.UPGRADE_DEFS) if (!(u.id in merged.upgrades)) merged.upgrades[u.id]=0;
    merged.units = merged.units || {};
    for (const u of C.UNIT_DEFS) if (!(u.id in merged.units)) merged.units[u.id]=0;
    merged.ascOwned = merged.ascOwned || {};
    for (const a of C.ASC_UPGRADES) if (!(a.id in merged.ascOwned)) merged.ascOwned[a.id]=0;
    merged.settings = merged.settings || deepCopy(defaultState.settings);
    merged.achievementsOwned = merged.achievementsOwned || {};
    merged.achievementsProgress = merged.achievementsProgress || {};
    return merged;
  }

  function saveState(s){ try{ s.lastSavedAt = nowSec(); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); const el = document.getElementById('lastSave'); if (el) el.textContent = new Date(s.lastSavedAt*1000).toLocaleString(); } catch(e){ console.error(e); } }

  // Expose API
  window.StateManager = {
    defaultState: defaultState,
    loadState: loadState,
    saveState: saveState,
    deepCopy: deepCopy
  };
})();
