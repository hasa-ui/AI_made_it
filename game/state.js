// state.js — facade
(function(){
  const runtime = window.StateRuntime;
  if (!runtime || typeof runtime.loadState !== 'function'){
    throw new Error('state.defaults.js / state.migration.js / state.storage.js must be loaded before state.js');
  }

  window.StateManager = {
    defaultState: runtime.defaultState,
    saveVersion: runtime.SAVE_VERSION,
    stringifyState: runtime.stringifyState,
    parseStateText: runtime.parseStateText,
    loadState: runtime.loadState,
    saveState: runtime.saveState,
    importState: runtime.importState,
    deepCopy: runtime.deepCopy
  };
})();
