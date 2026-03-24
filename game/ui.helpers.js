// ui.helpers.js — UI用共通ヘルパー
(function(){
  function fmtNumber(E, n){
    try{
      const st = E.getState();
      const settings = (st && st.settings) ? st.settings : {};
      const notation = settings.notation || 'compact';
      const threshold = (typeof settings.notationThreshold === 'number') ? settings.notationThreshold : 1000;
      if (n === Infinity) return '1.8e308';
      if (n === -Infinity) return '-1.8e308';
      if (!isFinite(n)) return '1.8e308';
      if (notation === 'scientific' && Math.abs(n) >= threshold){
        return Number(n).toExponential(3).replace(/e\+?(-?)(0+)?/,'e$1');
      }
      if (Math.abs(n) < 1000) return (Math.round(n*100)/100).toString();
      const units = ['','K','M','B','T','P','E'];
      let idx=0; let a=Math.abs(n);
      while(a>=1000 && idx < units.length-1){ a/=1000; idx++; }
      return (n<0?'-':'') + (Math.round(a*100)/100) + units[idx];
    } catch(e){ return String(n); }
  }

  function showTypedToast(E, type, msg, timeout=3000){
    try{
      const st = E.getState();
      const settings = st && st.settings ? st.settings : { toast: { achievement:true, offline:true, purchase:true, general:true } };
      const prefs = settings.toast || { achievement:true, offline:true, purchase:true, general:true };
      if (type === 'achievement' && !prefs.achievement) return;
      if (type === 'offline' && !prefs.offline) return;
      if (type === 'purchase' && !prefs.purchase) return;
      if ((type === 'general' || !type) && !prefs.general) return;

      let wrap = document.getElementById('toast');
      if (!wrap){ wrap = document.createElement('div'); wrap.id='toast'; wrap.className='toast'; document.body.appendChild(wrap); }

      const MAX = 5;
      while (wrap.children.length >= MAX) wrap.removeChild(wrap.firstChild);

      const it = document.createElement('div'); it.className='toastItem'; it.textContent = msg;
      wrap.appendChild(it);
      setTimeout(()=>{ it.style.transition='opacity 300ms'; it.style.opacity='0'; setTimeout(()=>{ try{ wrap.removeChild(it); }catch(e){} }, 350); }, timeout);
    }catch(e){}
  }

  function hasAscSpecial(C, E, kind){
    for (const def of C.ASC_UPGRADES){
      if (def.type !== 'special') continue;
      if (!def.payload || def.payload.kind !== kind) continue;
      if (getAscUpgradeOwnedLevel(C, E, def) > 0) return true;
    }
    return false;
  }

  function getAscUpgradeOwnedLevel(C, E, def, st){
    const src = st || E.getState();
    if (!def) return 0;
    const owned = (src.ascOwned && src.ascOwned[def.id]) || 0;
    if (owned > 0) return owned;
    if (def.type !== 'special' || !def.payload || !def.payload.kind) return owned;
    for (const abyssDef of (C.ABYSS_UPGRADES || [])){
      if (abyssDef.type !== 'persistentUnlock') continue;
      if (!abyssDef.payload || abyssDef.payload.kind !== def.payload.kind) continue;
      if ((((src.abyss && src.abyss.upgrades) || {})[abyssDef.id]) || 0) return 1;
    }
    return owned;
  }

  function isAscShopFullyPurchased(C, E, st){
    const src = st || E.getState();
    for (const def of C.ASC_UPGRADES){
      const current = getAscUpgradeOwnedLevel(C, E, def, src);
      const required = E.getAscUpgradeMaxLevel ? E.getAscUpgradeMaxLevel(def, src) : (def.maxLevel || 1);
      if (current < required) return false;
    }
    return true;
  }

  function formatBonusText(b){
    if (!b) return '恒久ボーナス';
    if (b.type==='globalMult') return `全体 ×${b.mult}`;
    if (b.type==='flatGPS') return `+${b.gps} GPS`;
    if (b.type==='startGold') return `開始G +${b.amount}`;
    if (b.type==='unitMult') return `${b.unitId} ×${b.mult}`;
    if (b.type==='prestigeEffectAdd') return `Prestige効果 +${b.add}`;
    if (b.type==='costMult') return `コスト ×${b.mult}`;
    if (b.type==='unlockFeature') return b.text || '機能解放';
    return '恒久ボーナス';
  }

  window.UIHelpers = { fmtNumber, showTypedToast, hasAscSpecial, getAscUpgradeOwnedLevel, isAscShopFullyPurchased, formatBonusText };
})();
