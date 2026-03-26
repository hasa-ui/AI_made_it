// ui.bootstrap.js — DOMContentLoaded と初回起動の窓口
(function(){
  function boot(){
    if (!window.GameUIBootstrap || typeof window.GameUIBootstrap.boot !== 'function'){
      console.error('ui.bootstrap.js: GameUIBootstrap.boot が未定義です。script の読み込み順を確認してください。');
      return;
    }
    window.GameUIBootstrap.boot();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
