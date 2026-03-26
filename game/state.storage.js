// state.storage.js — localStorage IO
(function(){
  const runtime = window.StateRuntime;
  if (!runtime || typeof runtime.migrateState !== 'function'){
    throw new Error('state.defaults.js and state.migration.js must be loaded before state.storage.js');
  }

  const { SAVE_KEY, SAVE_VERSION, defaultState, deepCopy, nowSec, stringifyState, parseStateText, migrateState } = runtime;

  function loadRaw(){
    try{
      const s = localStorage.getItem(SAVE_KEY);
      return s ? parseStateText(s) : null;
    } catch(_e){
      return null;
    }
  }

  function loadState(){
    const raw = loadRaw();
    if (!raw) return deepCopy(defaultState);
    try{
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
      if (el) el.textContent = new Date(s.lastSavedAt * 1000).toLocaleString();
    } catch(e){
      console.error(e);
    }
  }

  runtime.loadRaw = loadRaw;
  runtime.loadState = loadState;
  runtime.importState = importState;
  runtime.saveState = saveState;
})();
