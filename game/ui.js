// ui.js — 完全動作・タブ制御版
(function(){
  const C = window.CONFIG;
  const SM = window.StateManager;
  const E = window.ENGINE;
  if (!C || !SM || !E) { console.error('ui.js: CONFIG / StateManager / ENGINE が必要です'); return; }

  // ---------- ユーティリティ ----------
  function fmtNumber(n){
    try{
      const st = E.getState();
      const settings = (st && st.settings) ? st.settings : {};
      const notation = settings.notation || 'compact';
      const threshold = (typeof settings.notationThreshold === 'number') ? settings.notationThreshold : 1000;
      if (!isFinite(n)) return '—';
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

  function showTypedToast(type, msg, timeout=3000){
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

  // ---------- DOM キャッシュ ----------
  const refs = {};
  function cacheRefs(){
    refs.goldEl = document.getElementById('gold');
    refs.gpsEl = document.getElementById('gps');
    refs.totalEl = document.getElementById('totalEarned');
    refs.legacyEl = document.getElementById('legacyAvail');
    refs.ascEl = document.getElementById('ascAvail');
    refs.prestigePreview = document.getElementById('prestigeGainPreview');
    refs.startingGoldPreview = document.getElementById('startingGoldPreview');
    refs.ascGainPreview = document.getElementById('ascGainPreview');
    refs.lastSave = document.getElementById('lastSave');
  }
  function cacheRefsIfNeeded(){ if (!refs.goldEl) cacheRefs(); }

  // ---------- ビルド状態 / UIキャッシュ ----------
  const built = { units:false, upgrades:false, asc:false, achievements:false, settings:false };
  const unitButtons = {};   
  const upgradeButtons = {};
  let svgNodeEls = {};
  let svgDirty = true;
  let selectedLegacyId = null;
  let autoBuyAccumulator = 0;
  let miniGameRuntime = { active:false, round:0, totalRounds:12, score:0, misses:0, streak:0, targetLane:0, timerId:null };
  const LEGACY_ZOOM_MIN = 0.6;
  const LEGACY_ZOOM_MAX = 2.2;
  const LEGACY_ZOOM_STEP = 0.2;
  let legacyZoom = 1;

  function hasAscSpecial(kind){
    const st = E.getState();
    for (const def of C.ASC_UPGRADES){
      if (def.type !== 'special') continue;
      if (!def.payload || def.payload.kind !== kind) continue;
      if ((st.ascOwned[def.id] || 0) > 0) return true;
    }
    return false;
  }

  function isAscShopFullyPurchased(st){
    st = st || E.getState();
    for (const def of C.ASC_UPGRADES){
      const current = st.ascOwned[def.id] || 0;
      const required = def.maxLevel || 1;
      if (current < required) return false;
    }
    return true;
  }

  function ensureMiniGameState(st){
    st.miniGame = Object.assign({ plays:0, bestScore:0, lastScore:0, lastMisses:0, perfectRuns:0 }, st.miniGame || {});
  }

  function renderMiniGameState(){
    const st = E.getState();
    ensureMiniGameState(st);
    const card = document.getElementById('ascMiniGameCard');
    const summary = document.getElementById('miniGameSummary');
    const status = document.getElementById('miniGameStatus');
    const startBtn = document.getElementById('miniGameStart');
    const laneButtons = document.querySelectorAll('.miniLaneBtn');
    if (!card || !summary || !status || !startBtn) return;

    const unlocked = isAscShopFullyPurchased(st);
    card.style.display = unlocked ? 'block' : 'none';
    if (!unlocked) return;

    summary.textContent = `ベスト: ${fmtNumber(st.miniGame.bestScore)} / 挑戦回数: ${fmtNumber(st.miniGame.plays)}`;
    if (!miniGameRuntime.active){
      status.textContent = `待機中\n前回スコア: ${fmtNumber(st.miniGame.lastScore)}\n前回ミス: ${fmtNumber(st.miniGame.lastMisses)}\n完全勝利: ${fmtNumber(st.miniGame.perfectRuns)} 回`;
    }
    startBtn.disabled = miniGameRuntime.active || (st.ascPoints || 0) < 1;
    laneButtons.forEach((btn, idx)=>{
      btn.disabled = !miniGameRuntime.active;
      btn.classList.toggle('accent', miniGameRuntime.active && idx === miniGameRuntime.targetLane);
      btn.classList.toggle('alt', !(miniGameRuntime.active && idx === miniGameRuntime.targetLane));
    });
  }

  function finishMiniGame(){
    const st = E.getState();
    ensureMiniGameState(st);
    miniGameRuntime.active = false;
    if (miniGameRuntime.timerId) clearTimeout(miniGameRuntime.timerId);
    miniGameRuntime.timerId = null;

    const reward = Math.min(3, Math.floor(miniGameRuntime.score / 120));
    st.ascPoints += reward;
    st.miniGame.plays += 1;
    st.miniGame.lastScore = miniGameRuntime.score;
    st.miniGame.lastMisses = miniGameRuntime.misses;
    st.miniGame.bestScore = Math.max(st.miniGame.bestScore, miniGameRuntime.score);
    if (miniGameRuntime.misses === 0 && miniGameRuntime.score >= 180) st.miniGame.perfectRuns += 1;
    SM.saveState(st);
    syncUIAfterChange();
    checkAchievementsAfterAction();
    showTypedToast('general', `ミニゲーム終了: スコア ${fmtNumber(miniGameRuntime.score)} / AP +${fmtNumber(reward)}`);
    renderMiniGameState();
  }

  function runMiniGameRound(){
    if (!miniGameRuntime.active) return;
    if (miniGameRuntime.round >= miniGameRuntime.totalRounds){ finishMiniGame(); return; }
    miniGameRuntime.targetLane = Math.floor(Math.random() * 3);
    miniGameRuntime.round += 1;
    const status = document.getElementById('miniGameStatus');
    if (status) status.textContent = `ラウンド ${miniGameRuntime.round}/${miniGameRuntime.totalRounds}\nスコア: ${fmtNumber(miniGameRuntime.score)}\n連続正解: ${fmtNumber(miniGameRuntime.streak)}\nミス: ${fmtNumber(miniGameRuntime.misses)}`;
    renderMiniGameState();
    miniGameRuntime.timerId = setTimeout(()=>{
      if (!miniGameRuntime.active) return;
      miniGameRuntime.misses += 1;
      miniGameRuntime.streak = 0;
      runMiniGameRound();
    }, 800);
  }

  function startMiniGame(){
    const st = E.getState();
    ensureMiniGameState(st);
    if (!isAscShopFullyPurchased(st)){ showTypedToast('general', 'Ascension Shop 全購入後に解放されます'); return; }
    if ((st.ascPoints || 0) < 1){ showTypedToast('general', '開始には AP が1必要です'); return; }
    st.ascPoints -= 1;
    miniGameRuntime = { active:true, round:0, totalRounds:12, score:0, misses:0, streak:0, targetLane:0, timerId:null };
    SM.saveState(st);
    syncUIAfterChange();
    runMiniGameRound();
  }

  // ---------- UI 生成関数 ----------
  function buildUnitsUI(){
    if (built.units) return;
    const container = document.getElementById('unitsCard'); if (!container) return;
    container.innerHTML = '';
    for (const def of C.UNIT_DEFS){
      const div = document.createElement('div'); div.className='unit';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
        <div><strong>${def.name}</strong><div class="muted small">${def.desc || ''}</div></div>
        <div style="text-align:right">
          <div class="muted small">所持: <span id="owned-${def.id}">0</span> (<span id="contrib-${def.id}">0%</span>)</div>
          <div class="row" style="margin-top:6px">
            <button id="buy1-${def.id}">+1</button>
            <button id="buy10-${def.id}" class="small">+10</button>
            <button id="buyMax-${def.id}" class="small">Buy Max</button>
          </div>
          <div class="muted small" style="margin-top:6px">次価格: <span id="cost-${def.id}">0</span></div>
        </div></div>`;
      container.appendChild(div);

      unitButtons[def.id] = {
        buy1: document.getElementById(`buy1-${def.id}`), buy10: document.getElementById(`buy10-${def.id}`), buyMax: document.getElementById(`buyMax-${def.id}`),
        ownedEl: document.getElementById(`owned-${def.id}`), costEl: document.getElementById(`cost-${def.id}`), contribEl: document.getElementById(`contrib-${def.id}`),
        nextCost: Infinity, buy10Cost: Infinity
      };

      unitButtons[def.id].buy1.addEventListener('click', ()=>{ const res = E.buyUnitInternal(def.id,1); if (!res || !res.ok) showTypedToast('general','ゴールド不足'); else { SM.saveState(E.getState()); syncUIAfterChange(); checkAchievementsAfterAction(); showTypedToast('purchase', `${def.name} を購入しました`); }});
      unitButtons[def.id].buy10.addEventListener('click', ()=>{ const res = E.buyUnitInternal(def.id,10); if (!res || !res.ok) showTypedToast('general','ゴールド不足'); else { SM.saveState(E.getState()); syncUIAfterChange(); checkAchievementsAfterAction(); showTypedToast('purchase', `${def.name} x10 を購入しました`); }});
      unitButtons[def.id].buyMax.addEventListener('click', ()=>{ const res = E.buyMaxUnitsInternal(def.id); if (!res || !res.ok) showTypedToast('general','購入できる量はありません'); else { SM.saveState(E.getState()); syncUIAfterChange(); checkAchievementsAfterAction(); showTypedToast('purchase', `${def.name} を ${res.bought} 台購入しました`); }});
    }
    built.units = true; cacheRefs();
  }

  function buildUpgradesUI(){
    if (built.upgrades) return;
    const container = document.getElementById('upgradesCard'); if (!container) return;
    container.innerHTML = '';
    for (const def of C.UPGRADE_DEFS){
      const div = document.createElement('div'); div.className='upg';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
        <div><strong>${def.name}</strong><div class="muted small">${def.desc||''}</div></div>
        <div style="text-align:right">
          <div class="muted small">Lv: <span id="uplvl-${def.id}">0</span></div>
          <div style="margin-top:6px"><button id="buyUp-${def.id}">Buy Lv+</button><button id="buyMaxUp-${def.id}" class="small">Buy Max</button></div>
          <div class="muted small" style="margin-top:6px">次価格: <span id="upCost-${def.id}">0</span></div>
        </div></div>`;
      container.appendChild(div);

      upgradeButtons[def.id] = { buy: document.getElementById(`buyUp-${def.id}`), buyMax: document.getElementById(`buyMaxUp-${def.id}`), lvlEl: document.getElementById(`uplvl-${def.id}`), costEl: document.getElementById(`upCost-${def.id}`), nextCost: Infinity };

      upgradeButtons[def.id].buy.addEventListener('click', ()=>{ const res = E.buyUpgradeInternal(def.id); if (!res || !res.ok) showTypedToast('general','ゴールド不足'); else { SM.saveState(E.getState()); syncUIAfterChange(); checkAchievementsAfterAction(); showTypedToast('purchase', `${def.name} を Lv ${res.lvl} にしました`); }});
      upgradeButtons[def.id].buyMax.addEventListener('click', ()=>{ const res = E.buyMaxUpgradeInternal(def.id); if (!res || !res.ok) showTypedToast('general','購入できるレベルはありません'); else { SM.saveState(E.getState()); syncUIAfterChange(); checkAchievementsAfterAction(); showTypedToast('purchase', `${def.name} を ${res.bought} レベル上げました`); }});
    }
    built.upgrades = true; cacheRefs();
  }

  function buildAscShop(){
    if (built.asc) return;
    const el = document.getElementById('ascShop'); if (!el) return;
    el.innerHTML = '';
    for (const a of C.ASC_UPGRADES){
      const lvl = E.getState().ascOwned[a.id] || 0;
      const div = document.createElement('div'); div.className='upg';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
        <div><strong>${a.name}</strong><div class="muted small">${a.desc||''}</div></div>
        <div style="text-align:right">
          <div class="muted small">Lv:<span id="ascLvl-${a.id}">${fmtNumber(lvl)}</span>${a.maxLevel?'/'+a.maxLevel:''}</div>
          <div style="margin-top:6px"><button id="ascBuy-${a.id}">Buy (${fmtNumber(a.cost)})</button></div>
        </div></div>`;
      el.appendChild(div);
      document.getElementById(`ascBuy-${a.id}`).addEventListener('click', ()=>{
        if (!confirm(`Ascensionポイント ${a.cost} を消費して "${a.name}" を購入しますか？`)) return;
        const res = E.buyAscensionUpgradeInternal(a.id);
        if (!res || !res.ok) showTypedToast('general','ポイント不足、または最大レベルです');
        else { SM.saveState(E.getState()); syncUIAfterChange(); checkAchievementsAfterAction(); showTypedToast('purchase', `${a.name} を購入しました`); }
      });
    }
    built.asc = true; cacheRefs();
    renderMiniGameState();
  }

  // ---------- Legacy SVG / Inspector ----------
  function computeSvgViewbox(){
    if (!C.LEGACY_DEFS || C.LEGACY_DEFS.length===0) return '0 0 1200 700';
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (const d of C.LEGACY_DEFS){ if (d.x < minX) minX = d.x; if (d.y < minY) minY = d.y; if (d.x > maxX) maxX = d.x; if (d.y > maxY) maxY = d.y; }
    return `${Math.floor(minX - 140)} ${Math.floor(minY - 120)} ${Math.ceil(maxX - minX + 280)} ${Math.ceil(maxY - minY + 240)}`;
  }

  function drawLegacySVG(){
    try{
      const svg = document.getElementById('legacySvg'); if (!svg) return;
      svg.setAttribute('viewBox', computeSvgViewbox());
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svgNodeEls = {};
      for (const def of C.LEGACY_DEFS){
        if (def.prereq && def.prereq.length){
          for (const p of def.prereq){
            const ps = C.LEGACY_DEFS.find(x=>x.id===p.id); if (!ps) continue;
            const line = document.createElementNS('http://www.w3.org/2000/svg','line');
            line.setAttribute('x1', ps.x); line.setAttribute('y1', ps.y); line.setAttribute('x2', def.x); line.setAttribute('y2', def.y);
            line.setAttribute('class','edgeLine'); svg.appendChild(line);
          }
        }
      }
      for (const def of C.LEGACY_DEFS){
        const lvl = E.getState().legacyNodes[def.id] || 0;
        const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
        rect.setAttribute('x', def.x - 90); rect.setAttribute('y', def.y - 28); rect.setAttribute('width', 180); rect.setAttribute('height',56);
        const canBuy = E.canBuyLegacyInternal(def.id, E.getState());
        rect.setAttribute('fill', lvl>0 ? '#2b7f5a' : (canBuy ? '#134e66' : '#0a2a36'));
        rect.setAttribute('class','nodeRect'); svg.appendChild(rect); svgNodeEls[def.id] = rect;

        const title = document.createElementNS('http://www.w3.org/2000/svg','text');
        title.setAttribute('x', def.x - 80); title.setAttribute('y', def.y - 6); title.setAttribute('fill','#fff'); title.textContent = def.name; svg.appendChild(title);

        const sub = document.createElementNS('http://www.w3.org/2000/svg','text');
        sub.setAttribute('x', def.x - 80); sub.setAttribute('y', def.y + 12); sub.setAttribute('fill','#9fb0c9'); sub.setAttribute('font-size','12px');
        const nextCost = E.legacyCostForNextLevel(def, E.getState().legacyNodes[def.id] || 0);
        sub.textContent = `Lv:${fmtNumber(lvl)}/${def.maxLevel}  次:${isFinite(nextCost)?fmtNumber(nextCost):'—'}`; svg.appendChild(sub);

        const handler = ()=>{ rect.classList.remove('pulse'); void rect.offsetWidth; rect.classList.add('pulse'); selectLegacyNode(def.id); };
        rect.addEventListener('click', handler); title.addEventListener('click', handler); sub.addEventListener('click', handler);
      }
      applyLegacyZoom();
    }catch(e){}
  }

  function setLegacyZoom(nextZoom){
    const clamped = Math.min(LEGACY_ZOOM_MAX, Math.max(LEGACY_ZOOM_MIN, nextZoom));
    legacyZoom = Math.round(clamped * 100) / 100;
    applyLegacyZoom();
  }

  function applyLegacyZoom(){
    const svg = document.getElementById('legacySvg');
    const resetBtn = document.getElementById('legacyZoomReset');
    if (!svg) return;
    const percent = Math.round(legacyZoom * 100);
    svg.style.width = `${percent}%`;
    if (resetBtn) resetBtn.textContent = `${percent}%`;
  }

  function computeLegacyEffectForLevel(def, level){
    level = Math.max(0, Math.floor(level||0));
    if (def.type === 'globalMult'){ const total = Math.pow(1 + (def.payload.multPerLevel||0), level); return { text:`全体 ×${total.toFixed(3)}`, value: total }; }
    if (def.type === 'unitMult'){ const total = Math.pow(1 + (def.payload.multPerLevel||0), level); const unitName = (C.UNIT_DEFS.find(u=>u.id===def.payload.unitId) || {}).name || def.payload.unitId; return { text:`${unitName} ×${total.toFixed(3)}`, value: total }; }
    if (def.type === 'costMult'){ const total = Math.pow(def.payload.multPerLevel||1, level); return { text:`コスト ×${total.toFixed(3)}`, value: total }; }
    if (def.type === 'startGold'){ const amount = (def.payload.amountPerLevel || 0) * level; return { text:`開始G +${amount}`, value: amount }; }
    if (def.type === 'flatGPS'){ const gps = (def.payload.gpsPerLevel || 0) * level; return { text:`恒久 +${gps} GPS`, value: gps }; }
    return { text:`${def.desc||''}`, value: null };
  }

  function selectLegacyNode(id){
    selectedLegacyId = id;
    const def = C.LEGACY_DEFS.find(d=>d.id===id); if (!def) return;
    const lvl = E.getState().legacyNodes[id] || 0;

    document.getElementById('ins_none').style.display='none';
    document.getElementById('ins_box').style.display='block';

    document.getElementById('ins_name').textContent = def.name;
    document.getElementById('ins_desc').textContent = def.desc || '';
    document.getElementById('ins_lvl').textContent = fmtNumber(lvl);
    document.getElementById('ins_max').textContent = def.maxLevel || '—';

    if (def.prereq && def.prereq.length){
      const names = def.prereq.map(p=>{ const nm = (C.LEGACY_DEFS.find(x=>x.id===p.id)||{}).name || p.id; return `${nm} (Lv${p.minLevel||1})`; });
      document.getElementById('ins_prereq').textContent = names.join('、');
    } else document.getElementById('ins_prereq').textContent = 'なし';

    const nextCost = E.legacyCostForNextLevel(def, E.getState().legacyNodes[id] || 0);
    document.getElementById('ins_next_cost').textContent = isFinite(nextCost) ? fmtNumber(nextCost) : '—';

    const currEff = computeLegacyEffectForLevel(def, lvl);
    const nextEff = computeLegacyEffectForLevel(def, Math.min(def.maxLevel, lvl+1));
    document.getElementById('ins_next_effect').textContent = `${currEff.text} → ${nextEff.text}`;

    for (const k in svgNodeEls) if (svgNodeEls[k]) svgNodeEls[k].classList.remove('selected');
    if (svgNodeEls[id]) svgNodeEls[id].classList.add('selected');
  }

  // ---------- Achievements ----------
  function buildAchievementsUI(){
    const el = document.getElementById('achList'); if (!el) return;
    el.innerHTML = '';
    const list = C.ACHIEVEMENTS || [];
    const st = E.getState();
    for (const a of list){
      const unlocked = !!(st.achievementsOwned && st.achievementsOwned[a.id]);
      const div = document.createElement('div'); div.className = 'achItem ' + (unlocked ? 'achUnlocked' : 'achLocked');
      const bonusText = a.bonus ? (()=>{ const b=a.bonus; if (b.type==='globalMult') return `恒久: 全体 ×${b.mult}`; if (b.type==='flatGPS') return `恒久: +${b.gps} GPS`; if (b.type==='startGold') return `恒久: 開始G +${b.amount}`; if (b.type==='unitMult') return `恒久: ${b.unitId} ×${b.mult}`; return '恒久ボーナス'; })() : '';
      div.innerHTML = `<div><strong>${a.name}</strong><div class="muted small">${a.desc||''}</div><div class="muted tiny">${bonusText}</div></div><div class="muted small">${unlocked ? '解除' : '未'}</div>`;
      el.appendChild(div);
    }
    built.achievements = true;
  }

  function checkAchievementsAfterAction(){
    const st = E.getState();
    ensureMiniGameState(st);
    for (const a of (C.ACHIEVEMENTS||[])){
      if (st.achievementsOwned && st.achievementsOwned[a.id]) continue;
      let achieved = false;
      if (a.type === 'totalGold'){ if ((st.totalGoldEarned||0) >= a.target) achieved = true; }
      else if (a.type === 'unitBought'){ let ownedTotal=0; for (const u of C.UNIT_DEFS) ownedTotal += (st.units[u.id]||0); if (ownedTotal >= a.target) achieved = true; }
      else if (a.type === 'gps'){ E.recalcAndCacheGPS(st); if ((st.gpsCache||0) >= a.target) achieved = true; }
      else if (a.type === 'prestige'){ if ((st.prestigeEarnedTotal||0) >= a.target) achieved = true; }
      else if (a.type === 'ascend'){ if ((st.ascEarnedTotal||0) >= a.target) achieved = true; }
      else if (a.type === 'legacyBought'){ for (const d of C.LEGACY_DEFS) if ((st.legacyNodes[d.id]||0) >= a.target) { achieved = true; break; } }
      else if (a.type === 'ascShopAllBought'){ if (isAscShopFullyPurchased(st)) achieved = true; }
      else if (a.type === 'miniGamePlay'){ if ((st.miniGame.plays||0) >= a.target) achieved = true; }
      else if (a.type === 'miniGameScore'){ if ((st.miniGame.bestScore||0) >= a.target) achieved = true; }
      else if (a.type === 'miniGamePerfect'){ if ((st.miniGame.perfectRuns||0) >= a.target) achieved = true; }
      if (achieved){
        st.achievementsOwned = st.achievementsOwned || {};
        st.achievementsOwned[a.id] = true;
        SM.saveState(st); E.invalidateCache(); E.recalcAndCacheGPS(st);
        buildAchievementsUI(); showTypedToast('achievement', `実績解除: ${a.name}`); syncUIAfterChange();
      }
    }
  }

  // ---------- Settings UI ----------
  function buildSettingsUI(){
    if (built.settings) return;
    const el = document.getElementById('settingsCard'); if (!el) return;
    const st = E.getState();
    st.settings = Object.assign({ notation:'compact', notationThreshold:1000, confirmLegacyBuy:true, confirmLegacyBuyMax:true, toast:{achievement:true,offline:true,purchase:true,general:true} }, st.settings || {});
    st.settings.toast = Object.assign({achievement:true,offline:true,purchase:true,general:true}, st.settings.toast || {});
    el.innerHTML = `
      <h3>表示設定</h3>
      <div class="row"><label class="muted small">表示形式: <select id="notationSelect" style="padding:6px; border-radius:6px; background:#071421; color:#fff; border:1px solid #173142;"><option value="compact">コンパクト (1.2K)</option><option value="scientific">指数 (1.23e+3)</option></select></label></div>
      <div class="row" style="margin-top:12px"><strong>確認ダイアログ設定</strong></div>
      <div class="row"><label class="muted small"><input type="checkbox" id="confirmLegacyBuyChk"> レガシー購入 (Lv+1) 時に確認する</label></div>
      <div class="row"><label class="muted small"><input type="checkbox" id="confirmLegacyBuyMaxChk"> レガシーまとめ買い (Buy Max) 時に確認する</label></div>
      <div class="row" style="margin-top:12px"><strong>通知(トースト)表示</strong></div>
      <div class="row"><label class="muted small"><input type="checkbox" id="toastAchievementChk"> 実績解除</label></div>
      <div class="row"><label class="muted small"><input type="checkbox" id="toastOfflineChk"> オフライン報酬</label></div>
      <div class="row"><label class="muted small"><input type="checkbox" id="toastPurchaseChk"> 購入メッセージ</label></div>
      <div class="row" style="margin-top:12px"><strong>バージョン情報</strong></div>
      <div class="muted small">App: <span id="appVersionText"></span></div>
      <div class="muted small">Save Schema: <span id="saveSchemaVersionText"></span></div>
      <div class="muted small">Current Save: <span id="currentSaveVersionText"></span></div>
    `;

    document.getElementById('notationSelect').value = st.settings.notation || 'compact';
    document.getElementById('confirmLegacyBuyChk').checked = !!st.settings.confirmLegacyBuy;
    document.getElementById('confirmLegacyBuyMaxChk').checked = !!st.settings.confirmLegacyBuyMax;
    document.getElementById('toastAchievementChk').checked = !!(st.settings.toast && st.settings.toast.achievement);
    document.getElementById('toastOfflineChk').checked = !!(st.settings.toast && st.settings.toast.offline);
    document.getElementById('toastPurchaseChk').checked = !!(st.settings.toast && st.settings.toast.purchase);
    document.getElementById('appVersionText').textContent = C.APP_VERSION || 'unknown';
    document.getElementById('saveSchemaVersionText').textContent = String(SM.saveVersion || C.SAVE_VERSION || '-');
    document.getElementById('currentSaveVersionText').textContent = String(st.version || '-');

    document.getElementById('notationSelect').addEventListener('change', (ev)=>{ st.settings.notation = ev.target.value; SM.saveState(st); syncUIAfterChange(); });
    document.getElementById('confirmLegacyBuyChk').addEventListener('change', (ev)=>{ st.settings.confirmLegacyBuy = !!ev.target.checked; SM.saveState(st); });
    document.getElementById('confirmLegacyBuyMaxChk').addEventListener('change', (ev)=>{ st.settings.confirmLegacyBuyMax = !!ev.target.checked; SM.saveState(st); });
    document.getElementById('toastAchievementChk').addEventListener('change', (ev)=>{ st.settings.toast.achievement = !!ev.target.checked; SM.saveState(st); });
    document.getElementById('toastOfflineChk').addEventListener('change', (ev)=>{ st.settings.toast.offline = !!ev.target.checked; SM.saveState(st); });
    document.getElementById('toastPurchaseChk').addEventListener('change', (ev)=>{ st.settings.toast.purchase = !!ev.target.checked; SM.saveState(st); });

    built.settings = true;
  }

  function syncAutoBuyControls(){
    const st = E.getState();
    st.settings = st.settings || {};
    st.settings.autoBuy = Object.assign({ enabled:false, units:true, upgrades:true, intervalSec:0.5 }, st.settings.autoBuy || {});
    const unlocked = hasAscSpecial('unlockAutobuy');
    const enableEl = document.getElementById('autoBuyEnable');
    const unitsEl = document.getElementById('autoBuyUnits');
    const upgradesEl = document.getElementById('autoBuyUpgrades');
    const intervalEl = document.getElementById('autoBuyInterval');
    const statusEl = document.getElementById('autoBuyStatus');
    if (!enableEl || !unitsEl || !upgradesEl || !intervalEl || !statusEl) return;

    enableEl.disabled = !unlocked;
    unitsEl.disabled = !unlocked;
    upgradesEl.disabled = !unlocked;
    intervalEl.disabled = !unlocked;

    enableEl.checked = unlocked ? !!st.settings.autoBuy.enabled : false;
    unitsEl.checked = !!st.settings.autoBuy.units;
    upgradesEl.checked = !!st.settings.autoBuy.upgrades;
    intervalEl.value = String(Math.max(0.1, Number(st.settings.autoBuy.intervalSec || 0.5)));
    statusEl.textContent = unlocked ? '解放済み' : '未解放';
  }

  function bindAutoBuyControls(){
    const enableEl = document.getElementById('autoBuyEnable');
    const unitsEl = document.getElementById('autoBuyUnits');
    const upgradesEl = document.getElementById('autoBuyUpgrades');
    const intervalEl = document.getElementById('autoBuyInterval');
    if (!enableEl || !unitsEl || !upgradesEl || !intervalEl) return;
    const update = ()=>{
      const st = E.getState();
      st.settings = st.settings || {};
      st.settings.autoBuy = st.settings.autoBuy || {};
      st.settings.autoBuy.enabled = !!enableEl.checked;
      st.settings.autoBuy.units = !!unitsEl.checked;
      st.settings.autoBuy.upgrades = !!upgradesEl.checked;
      st.settings.autoBuy.intervalSec = Math.max(0.1, Number(intervalEl.value || 0.5));
      SM.saveState(st);
    };
    enableEl.addEventListener('change', update);
    unitsEl.addEventListener('change', update);
    upgradesEl.addEventListener('change', update);
    intervalEl.addEventListener('change', update);
  }

  function runAutoBuy(dt){
    const st = E.getState();
    if (!hasAscSpecial('unlockAutobuy')) return;
    const cfg = (st.settings && st.settings.autoBuy) ? st.settings.autoBuy : {};
    if (!cfg.enabled) return;
    const interval = Math.max(0.1, Number(cfg.intervalSec || 0.5));
    autoBuyAccumulator += dt;
    if (autoBuyAccumulator < interval) return;
    autoBuyAccumulator = 0;

    let changed = false;
    if (cfg.upgrades){
      for (const def of C.UPGRADE_DEFS){
        const res = E.buyUpgradeInternal(def.id);
        if (res && res.ok) changed = true;
      }
    }
    if (cfg.units){
      for (const def of C.UNIT_DEFS){
        const res = E.buyUnitInternal(def.id, 1);
        if (res && res.ok) changed = true;
      }
    }
    if (changed){
      syncUIAfterChange();
      SM.saveState(st);
    }
  }

  // ---------- syncUIAfterChange ----------
  function syncUIAfterChange(){
    const st = E.getState();
    E.recalcAndCacheGPS(st);

    const totalGps = st.gpsCache || 0;
    for (const d of C.UNIT_DEFS){
      const owned = st.units[d.id] || 0;
      if (unitButtons[d.id] && unitButtons[d.id].ownedEl) unitButtons[d.id].ownedEl.textContent = fmtNumber(owned);
      const nextCost = E.unitCost(d, owned, st);
      if (unitButtons[d.id] && unitButtons[d.id].costEl) unitButtons[d.id].costEl.textContent = fmtNumber(nextCost);

      let c10 = 0; for (let i=0;i<10;i++) c10 += E.unitCost(d, owned + i, st);

      let unitGps = d.baseGPS * owned;
      const agg = E.getAggregates(st);
      if (agg.unitMults && agg.unitMults[d.id]) unitGps *= agg.unitMults[d.id];
      for (const up of C.UPGRADE_DEFS){ const ul = st.upgrades[up.id]||0; if (ul<=0) continue; if (up.type==='unitMult' && up.payload.unitId===d.id) unitGps *= Math.pow(1+(up.payload.multPerLevel||0), ul); }
      let globalMul = 1;
      for (const up of C.UPGRADE_DEFS){ const ul = st.upgrades[up.id]||0; if (ul<=0) continue; if (up.type==='globalMult') globalMul *= Math.pow(1+(up.payload.multPerLevel||0), ul); }
      unitGps *= (agg.globalMult || 1) * globalMul;
      const perc = totalGps > 0 ? (unitGps / totalGps * 100) : 0;
      if (unitButtons[d.id] && unitButtons[d.id].contribEl) unitButtons[d.id].contribEl.textContent = (perc >= 0.01 ? (Math.round(perc*100)/100) : 0) + '%';

      if (unitButtons[d.id]) { unitButtons[d.id].nextCost = nextCost; unitButtons[d.id].buy10Cost = c10; }
    }

    for (const d of C.UPGRADE_DEFS){
      if (upgradeButtons[d.id] && upgradeButtons[d.id].lvlEl) upgradeButtons[d.id].lvlEl.textContent = fmtNumber(st.upgrades[d.id]||0);
      const nxt = E.upgradeCostNextLevel(d, st.upgrades[d.id]||0);
      if (upgradeButtons[d.id] && upgradeButtons[d.id].costEl) upgradeButtons[d.id].costEl.textContent = fmtNumber(nxt);
      if (upgradeButtons[d.id]) upgradeButtons[d.id].nextCost = nxt;
    }

    for (const a of C.ASC_UPGRADES){ const l = document.getElementById(`ascLvl-${a.id}`); if (l) l.textContent = fmtNumber(st.ascOwned[a.id] || 0); }

    if (selectedLegacyId){
      const def = C.LEGACY_DEFS.find(x=>x.id===selectedLegacyId);
      if (def){
        document.getElementById('ins_lvl').textContent = fmtNumber(st.legacyNodes[selectedLegacyId]||0);
        const nxt = E.legacyCostForNextLevel(def, st.legacyNodes[selectedLegacyId]||0);
        document.getElementById('ins_next_cost').textContent = isFinite(nxt) ? fmtNumber(nxt) : '—';
      }
    }

    if (refs.goldEl) refs.goldEl.textContent = fmtNumber(st.gold);
    if (refs.gpsEl) refs.gpsEl.textContent = fmtNumber(st.gpsCache || 0);
    if (refs.totalEl) refs.totalEl.textContent = fmtNumber(st.totalGoldEarned || 0);
    if (refs.legacyEl) refs.legacyEl.textContent = fmtNumber(st.legacy || 0);
    if (refs.ascEl) refs.ascEl.textContent = fmtNumber(st.ascPoints || 0);
    if (refs.prestigePreview) refs.prestigePreview.textContent = fmtNumber(E.previewPrestigeGain());
    if (refs.startingGoldPreview) refs.startingGoldPreview.textContent = fmtNumber(E.computeStartingGoldOnPrestige());
    if (refs.ascGainPreview) refs.ascGainPreview.textContent = fmtNumber(E.previewAscGain());
    if (refs.lastSave) refs.lastSave.textContent = new Date(st.lastSavedAt*1000).toLocaleString();
    const currentSaveVersionEl = document.getElementById('currentSaveVersionText');
    if (currentSaveVersionEl) currentSaveVersionEl.textContent = String(st.version || '-');
    syncAutoBuyControls();
    renderMiniGameState();
  }

  // ---------- mainLoop ----------
  let lastFrame = performance.now(), lastUiUpdate = performance.now(), rafId = null;
  function mainLoop(ts){
    cacheRefsIfNeeded();
    let dt = (ts - lastFrame) / 1000; lastFrame = ts;
    if (!isFinite(dt) || dt <= 0) dt = 0;
    if (dt > 1.0) dt = 1.0;

    const st = E.getState();
    st.gold += (st.gpsCache || 0) * dt;
    st.totalGoldEarned += (st.gpsCache || 0) * dt;
    runAutoBuy(dt);

    if (ts - lastUiUpdate >= (C.UI_UPDATE_INTERVAL_MS || 150)){
      lastUiUpdate = ts;
      if (refs.goldEl) refs.goldEl.textContent = fmtNumber(st.gold);
      if (refs.gpsEl) refs.gpsEl.textContent = fmtNumber(st.gpsCache || 0);
      if (refs.totalEl) refs.totalEl.textContent = fmtNumber(st.totalGoldEarned || 0);
      if (refs.legacyEl) refs.legacyEl.textContent = fmtNumber(st.legacy || 0);
      if (refs.ascEl) refs.ascEl.textContent = fmtNumber(st.ascPoints || 0);
      if (refs.prestigePreview) refs.prestigePreview.textContent = fmtNumber(E.previewPrestigeGain());
      if (refs.startingGoldPreview) refs.startingGoldPreview.textContent = fmtNumber(E.computeStartingGoldOnPrestige());
      if (refs.ascGainPreview) refs.ascGainPreview.textContent = fmtNumber(E.previewAscGain());

      for (const def of C.UNIT_DEFS){
        const btns = unitButtons[def.id]; if (!btns) continue;
        const c1 = btns.nextCost || Infinity;
        btns.buy1.disabled = st.gold < c1;
        btns.buy10.disabled = st.gold < (btns.buy10Cost || Infinity);
        btns.buyMax.disabled = st.gold < c1;
      }
      for (const def of C.UPGRADE_DEFS){
        const b = upgradeButtons[def.id]; if (!b) continue;
        const cost = b.nextCost || Infinity;
        b.buy.disabled = !isFinite(cost) || st.gold < cost;
        b.buyMax.disabled = st.gold < cost || !isFinite(cost);
      }
      if (svgDirty){ drawLegacySVG(); svgDirty = false; }
    }
    rafId = requestAnimationFrame(mainLoop);
  }

  // ---------- タブ表示制御 (修正: display='block') ----------
  function showTab(name){
    if (typeof name !== 'string' || name.trim() === '') name = (E.getState().settings && E.getState().settings.activeTab) || 'play';
    name = name.toString();

    let matched = false;
    document.querySelectorAll('.tabPane').forEach(pane=>{
      const paneName = pane.dataset && pane.dataset.tab ? pane.dataset.tab : (pane.id && pane.id.startsWith('tab-') ? pane.id.slice(4) : null);
      if (paneName === name){ pane.style.display = 'block'; matched = true; } else { pane.style.display = 'none'; }
    });

    if (!matched){ const alt = document.getElementById('tab-' + name); if (alt){ document.querySelectorAll('.tabPane').forEach(p=>p.style.display='none'); alt.style.display='block'; matched = true; } }
    if (!matched){ const fallback = document.getElementById('tab-play') || document.querySelector('.tabPane'); if (fallback){ document.querySelectorAll('.tabPane').forEach(p=>p.style.display='none'); fallback.style.display='block'; name = fallback.id.replace('tab-',''); } }

    const insWrap = document.getElementById('tab-inspector');
    if (insWrap){ if (name === 'legacy'){ insWrap.style.display = 'block'; svgDirty = true; } else { insWrap.style.display = 'none'; } }

    document.querySelectorAll('.tabBtn').forEach(btn=>{
      const bt = (btn.dataset && btn.dataset.tab) ? btn.dataset.tab : (btn.getAttribute('data-tab') || (btn.id && btn.id.replace(/^tabBtn-/, '')));
      if (bt === name) btn.classList.add('active'); else btn.classList.remove('active');
    });

    if (name === 'upgrades') buildUpgradesUI();
    if (name === 'play') buildUnitsUI();
    if (name === 'legacy'){ svgDirty = true; drawLegacySVG(); }
    if (name === 'ascension') buildAscShop(); // 追加

    try { const st = E.getState(); st.settings = st.settings || {}; st.settings.activeTab = name; SM.saveState(st); } catch(e){}
  }

  // ---------- グローバルイベントバインド ----------
  function bindGlobalEvents(){
    document.querySelectorAll('.tabBtn').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{ ev.preventDefault(); const t = (btn.dataset && btn.dataset.tab) ? btn.dataset.tab : btn.getAttribute('data-tab'); showTab(t || 'play'); });
    });

    document.getElementById('doPrestige')?.addEventListener('click', ()=>{
      const p = E.previewPrestigeGain();
      if (p <= 0){ showTypedToast('general','獲得できるレガシーはありません'); return; }
      if (!confirm(`プレステージを実行しますか？ 獲得レガシー: ${fmtNumber(p)} 開始ゴールド: ${fmtNumber(E.computeStartingGoldOnPrestige())}`)) return;
      const res = E.doPrestigeInternal();
      if (res.ok){ svgDirty=true; syncUIAfterChange(); buildAscShop(); checkAchievementsAfterAction(); showTypedToast('purchase', `プレステージ: レガシー +${fmtNumber(res.gain)}`); }
    });

    document.getElementById('doAscend')?.addEventListener('click', ()=>{
      const p = E.previewAscGain();
      if (p <= 0){ showTypedToast('general','Ascensionで得られるポイントはありません'); return; }
      if (!confirm(`Ascend 実行で AscensionPoints +${fmtNumber(p)} を得ます。実行しますか？`)) return;
      const res = E.doAscendInternal();
      if (res.ok){ svgDirty=true; syncUIAfterChange(); buildAscShop(); checkAchievementsAfterAction(); showTypedToast('purchase', `Ascend: AP +${fmtNumber(res.gain)}`); }
    });

    document.getElementById('miniGameStart')?.addEventListener('click', ()=> startMiniGame());
    document.querySelectorAll('.miniLaneBtn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if (!miniGameRuntime.active) return;
        const lane = Number(btn.dataset.lane || -1);
        if (miniGameRuntime.timerId) clearTimeout(miniGameRuntime.timerId);
        if (lane === miniGameRuntime.targetLane){
          miniGameRuntime.streak += 1;
          miniGameRuntime.score += 10 + (miniGameRuntime.streak * 2);
        } else {
          miniGameRuntime.streak = 0;
          miniGameRuntime.misses += 1;
        }
        runMiniGameRound();
      });
    });
    
    document.getElementById('ins_buy1')?.addEventListener('click', ()=>{
      if (!selectedLegacyId) return;
      const st = E.getState(); const want = st.settings.confirmLegacyBuy !== false;
      if (want && !confirm('レガシーを1レベル取得しますか？')) return;
      const res = E.attemptBuyLegacyInternal(selectedLegacyId, 1);
      if (res.ok){ svgDirty=true; syncUIAfterChange(); selectLegacyNode(selectedLegacyId); checkAchievementsAfterAction(); showTypedToast('purchase','レガシーを購入しました'); }
      else showTypedToast('general','購入失敗（コスト不足または前提不足）');
    });

    document.getElementById('ins_buyMax')?.addEventListener('click', ()=>{
      if (!selectedLegacyId) return;
      const st = E.getState(); const want = st.settings.confirmLegacyBuyMax !== false;
      if (want && !confirm('選択中のレガシーノードを限界まで購入しますか？')) return;
      const res = E.attemptBuyLegacyInternal(selectedLegacyId, Infinity);
      if (res.ok){ svgDirty=true; syncUIAfterChange(); selectLegacyNode(selectedLegacyId); checkAchievementsAfterAction(); showTypedToast('purchase','レガシーをまとめて購入しました'); }
      else showTypedToast('general','購入できるレベルはありません');
    });

    document.getElementById('ins_close')?.addEventListener('click', ()=>{
      document.getElementById('ins_box').style.display='none'; document.getElementById('ins_none').style.display='block';
      selectedLegacyId = null; for (const id in svgNodeEls) if (svgNodeEls[id]) svgNodeEls[id].classList.remove('selected');
    });

    document.getElementById('legacyZoomIn')?.addEventListener('click', ()=> setLegacyZoom(legacyZoom + LEGACY_ZOOM_STEP));
    document.getElementById('legacyZoomOut')?.addEventListener('click', ()=> setLegacyZoom(legacyZoom - LEGACY_ZOOM_STEP));
    document.getElementById('legacyZoomReset')?.addEventListener('click', ()=> setLegacyZoom(1));

    // Save/Load
    document.getElementById('downloadSave')?.addEventListener('click', ()=>{
      try{ const json = JSON.stringify(E.getState(), null, 2); const blob = new Blob([json], { type:'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `inc_save_${new Date().toISOString().replace(/[:.]/g,'-')}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); showTypedToast('general','ダウンロードしました'); } catch(e){}
    });
    document.getElementById('copySave')?.addEventListener('click', ()=>{
      try{ const json = JSON.stringify(E.getState(), null, 2); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(()=>showTypedToast('general','コピーしました')); else document.getElementById('pasteJson').value = json; } catch(e){}
    });
    document.getElementById('importPasteBtn')?.addEventListener('click', ()=>{
      try{ const obj = JSON.parse(document.getElementById('pasteJson').value.trim()); if (!confirm('上書きしますか？')) return; const migrated = SM.importState(obj); E.setState(migrated); svgDirty=true; syncUIAfterChange(); buildAchievementsUI(); buildSettingsUI(); showTypedToast('general','インポート完了'); } catch(e){ alert('インポートエラー: '+e.message); } 
    });
    document.getElementById('reset')?.addEventListener('click', ()=>{
      if (!confirm('本当に全てのデータをリセットしますか？')) return;
      E.setState(SM.deepCopy(SM.defaultState)); svgDirty=true; syncUIAfterChange(); buildAchievementsUI(); showTypedToast('general','リセットしました');
    });
    document.getElementById('triggerFileInput')?.addEventListener('click', ()=> document.getElementById('fileInput').click());
    document.getElementById('fileInput')?.addEventListener('change', (ev)=>{
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = ()=>{ try{ const obj = JSON.parse(r.result); if (!confirm('上書きしますか？')) { ev.target.value=''; return; } const migrated = SM.importState(obj); E.setState(migrated); svgDirty=true; syncUIAfterChange(); buildAchievementsUI(); buildSettingsUI(); showTypedToast('general','ファイル読み込み完了'); } catch(e){ alert('インポートエラー: '+e.message); } }; r.readAsText(f); ev.target.value = ''; 
    });
  }

  // ---------- 初期化 ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    buildUnitsUI(); buildUpgradesUI(); buildAscShop(); buildAchievementsUI(); buildSettingsUI();
    bindAutoBuyControls();
    cacheRefs();

    const off = E.applyOfflineProgressWithToast();
    if (off && off.gain) showTypedToast('offline', `オフライン: ${fmtNumber(off.gain)} ゴールド (${Math.round(off.elapsed)}秒)`);

    E.recalcAndCacheGPS(E.getState());
    syncUIAfterChange();
    bindGlobalEvents();
    applyLegacyZoom();

    showTab(E.getState().settings.activeTab || 'play');

    setInterval(()=>SM.saveState(E.getState()), C.AUTO_SAVE_INTERVAL || 5000);
    lastFrame = performance.now(); lastUiUpdate = performance.now(); requestAnimationFrame(mainLoop);
  });

})();
