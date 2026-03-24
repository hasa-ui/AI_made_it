// ui.js — 完全動作・タブ制御版
(function(){
  const C = window.CONFIG;
  const SM = window.StateManager;
  const E = window.ENGINE;
  const U = window.UIHelpers || {};
  if (!C || !SM || !E) { console.error('ui.js: CONFIG / StateManager / ENGINE が必要です'); return; }

  // ---------- ユーティリティ ----------
  function fmtNumber(n){ return (U.fmtNumber || ((E,n)=>String(n)))(E, n); }
  function showTypedToast(type, msg, timeout=3000){ return (U.showTypedToast || ((E,type,msg)=>{}))(E, type, msg, timeout); }

  function fmtLegacyValue(n){
    if (!Number.isFinite(n)) return '―';
    return fmtNumber(n);
  }

  // ---------- DOM キャッシュ ----------
  const refs = {};
  function cacheRefs(){
    refs.goldEl = document.getElementById('gold');
    refs.gpsEl = document.getElementById('gps');
    refs.totalEl = document.getElementById('totalEarned');
    refs.legacyEl = document.getElementById('legacyAvail');
    refs.ascEl = document.getElementById('ascAvail');
    refs.celestialEl = document.getElementById('celestialAvail');
    refs.celestialTotalEl = document.getElementById('celestialTotal');
    refs.prestigePreview = document.getElementById('prestigeGainPreview');
    refs.startingGoldPreview = document.getElementById('startingGoldPreview');
    refs.ascGainPreview = document.getElementById('ascGainPreview');
    refs.lastSave = document.getElementById('lastSave');
    refs.abyssShardEl = document.getElementById('abyssShard');
    refs.abyssHeaderShardEl = document.getElementById('abyssHeaderShard');
    refs.abyssGainEl = document.getElementById('abyssGainPreview');
    refs.abyssTabShardEl = document.getElementById('abyssTabShard');
    refs.abyssTabGainEl = document.getElementById('abyssTabGain');
    refs.abyssResetCountEl = document.getElementById('abyssResetCount');
  }
  function cacheRefsIfNeeded(){ if (!refs.goldEl) cacheRefs(); }

  // ---------- ビルド状態 / UIキャッシュ ----------
  const built = { units:false, upgrades:false, asc:false, achievements:false, settings:false, challenges:false, celestial:false };
  const unitButtons = {};   
  const upgradeButtons = {};
  let svgNodeEls = {};
  let svgDirty = true;
  let selectedLegacyId = null;
  let autoBuyAccumulator = 0;
  let miniGameRuntime = { active:false, round:0, totalRounds:10, score:0, misses:0, streak:0, bestStreak:0, targetLane:0, timerId:null, rule:'normal', roundTimeoutMs:1100 };
  const isMobileViewport = ()=> window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  const LEGACY_ZOOM_MIN = 0.6;
  const LEGACY_ZOOM_MAX = 2.6;
  const getLegacyZoomStep = ()=> (isMobileViewport() ? 0.06 : 0.18);
  let legacyZoom = 1;
  let pinchStartDistance = null;
  let pinchStartZoom = 1;
  const SETTINGS_DEFAULTS = {
    notation:'compact',
    notationThreshold:1000,
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
  };
  const CONFIRM_OPTIONS = [
    { key:'confirmLegacyBuy', id:'confirmLegacyBuyChk', label:'レガシー購入 (Lv+1) 時に確認する' },
    { key:'confirmLegacyBuyMax', id:'confirmLegacyBuyMaxChk', label:'レガシーまとめ買い (Buy Max) 時に確認する' },
    { key:'confirmAscShopBuy', id:'confirmAscShopBuyChk', label:'Ascension Shop 購入時に確認する' },
    { key:'confirmPrestige', id:'confirmPrestigeChk', label:'Prestige 実行時に確認する' },
    { key:'confirmAscend', id:'confirmAscendChk', label:'Ascend 実行時に確認する' },
    { key:'confirmAbyssReset', id:'confirmAbyssChk', label:'Abyss リセット時に確認する' },
    { key:'confirmChallengeStart', id:'confirmChallengeStartChk', label:'Challenge 開始時に確認する' },
    { key:'confirmChallengeAbandon', id:'confirmChallengeAbandonChk', label:'Challenge 中断時に確認する' },
    { key:'confirmImportOverwrite', id:'confirmImportOverwriteChk', label:'インポート上書き時に確認する' },
    { key:'confirmHardReset', id:'confirmHardResetChk', label:'全データリセット時に確認する' }
  ];
  const TOAST_OPTIONS = [
    { key:'general', id:'toastGeneralChk', label:'一般メッセージ' },
    { key:'purchase', id:'toastPurchaseChk', label:'購入メッセージ' },
    { key:'achievement', id:'toastAchievementChk', label:'実績解除' },
    { key:'offline', id:'toastOfflineChk', label:'オフライン報酬' }
  ];

  function hasAscSpecial(kind){ return (U.hasAscSpecial || ((C,E,k)=>false))(C, E, kind); }
  function getAscUpgradeOwnedLevel(def, st){ return (U.getAscUpgradeOwnedLevel || ((C,E,d,src)=>((src || E.getState()).ascOwned || {})[d.id] || 0))(C, E, def, st); }
  function isAscShopFullyPurchased(st){ return (U.isAscShopFullyPurchased || ((C,E,st)=>false))(C, E, st); }
  function formatBonusText(b){ return (U.formatBonusText || (x=>'恒久ボーナス'))(b); }
  function ensureSettingsDefaults(st){
    st.settings = Object.assign({}, SETTINGS_DEFAULTS, st.settings || {});
    st.settings.toast = Object.assign({}, SETTINGS_DEFAULTS.toast, st.settings.toast || {});
    st.settings.autoBuy = Object.assign({}, SETTINGS_DEFAULTS.autoBuy, st.settings.autoBuy || {});
    return st.settings;
  }
  function shouldConfirm(settingKey){
    const st = E.getState();
    const settings = ensureSettingsDefaults(st);
    return settings[settingKey] !== false;
  }
  const miniGameController = (window.UIMiniGame && window.UIMiniGame.create)
    ? window.UIMiniGame.create({
        E,
        SM,
        fmtNumber,
        showTypedToast,
        isAscShopFullyPurchased,
        syncUIAfterChange: ()=>syncUIAfterChange(),
        checkAchievementsAfterAction: ()=>checkAchievementsAfterAction()
      })
    : null;

  function renderMiniGameState(){
    if (!miniGameController) return;
    miniGameController.render();
  }

  function startMiniGame(){
    if (!miniGameController) return;
    miniGameController.start();
  }

  // ---------- UI 生成関数 ----------
  function buildUnitsUI(){
    if (built.units) return;
    const container = document.getElementById('unitsCard'); if (!container) return;
    container.innerHTML = '';
    for (const def of C.UNIT_DEFS){
      const div = document.createElement('div'); div.className='unit';
      div.innerHTML = `<div class="unitRow">
        <div>
          <strong>${def.name}</strong>
          <div class="muted small">${def.desc || ''}</div>
        </div>
        <div class="unitStats">
          <div class="metricLine"><span class="metricLabel">所持</span><span id="owned-${def.id}" class="metricValue">0</span></div>
          <div class="metricLine"><span class="metricLabel">生産寄与</span><span id="contrib-${def.id}" class="metricValue">0%</span></div>
          <div class="metricLine"><span class="metricLabel">次価格</span><span id="cost-${def.id}" class="metricValue">0</span></div>
          <div class="row" style="margin-top:4px">
            <button id="buy1-${def.id}">+1</button>
            <button id="buy10-${def.id}" class="small">+10</button>
            <button id="buyMax-${def.id}" class="small">Buy Max</button>
          </div>
        </div>
      </div>`;
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
      div.innerHTML = `<div class="upgRow">
        <div><strong>${def.name}</strong><div class="muted small">${def.desc||''}</div></div>
        <div class="upgStats">
          <div class="metricLine"><span class="metricLabel">Lv</span><span id="uplvl-${def.id}" class="metricValue">0</span></div>
          <div class="metricLine"><span class="metricLabel">次価格</span><span id="upCost-${def.id}" class="metricValue">0</span></div>
          <div class="row" style="margin-top:4px"><button id="buyUp-${def.id}">Buy Lv+</button><button id="buyMaxUp-${def.id}" class="small">Buy Max</button></div>
        </div>
      </div>`;
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
      const lvl = getAscUpgradeOwnedLevel(a, E.getState());
      const div = document.createElement('div'); div.className='upg';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
        <div><strong>${a.name}</strong><div class="muted small">${a.desc||''}</div></div>
        <div style="text-align:right">
          <div class="muted small">Lv:<span id="ascLvl-${a.id}">${fmtNumber(lvl)}</span>/<span id="ascMax-${a.id}">${fmtNumber(E.getAscUpgradeMaxLevel ? E.getAscUpgradeMaxLevel(a, E.getState()) : (a.maxLevel || 1))}</span></div>
          <div style="margin-top:6px"><button id="ascBuy-${a.id}">Buy (${fmtNumber(a.cost)})</button></div>
        </div></div>`;
      el.appendChild(div);
      document.getElementById(`ascBuy-${a.id}`).addEventListener('click', ()=>{
        if (shouldConfirm('confirmAscShopBuy') && !confirm(`Ascensionポイント ${a.cost} を消費して "${a.name}" を購入しますか？`)) return;
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
      const mobile = isMobileViewport();
      const nodeWidth = mobile ? 220 : 180;
      const nodeHeight = mobile ? 68 : 56;
      const labelFont = mobile ? '15px' : '12px';
      for (const def of C.LEGACY_DEFS){
        const lvl = E.getState().legacyNodes[def.id] || 0;
        const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
        rect.setAttribute('x', def.x - (nodeWidth/2)); rect.setAttribute('y', def.y - (nodeHeight/2)); rect.setAttribute('width', nodeWidth); rect.setAttribute('height', nodeHeight);
        const canBuy = E.canBuyLegacyInternal(def.id, E.getState());
        rect.setAttribute('fill', lvl>0 ? '#2b7f5a' : (canBuy ? '#134e66' : '#0a2a36'));
        rect.setAttribute('class','nodeRect'); svg.appendChild(rect); svgNodeEls[def.id] = rect;

        const title = document.createElementNS('http://www.w3.org/2000/svg','text');
        title.setAttribute('x', def.x - (nodeWidth/2 - 10)); title.setAttribute('y', def.y - 8); title.setAttribute('fill','#fff'); if (mobile) title.setAttribute('font-size','14px'); title.textContent = def.name; svg.appendChild(title);

        const sub = document.createElementNS('http://www.w3.org/2000/svg','text');
        sub.setAttribute('x', def.x - (nodeWidth/2 - 10)); sub.setAttribute('y', def.y + 14); sub.setAttribute('fill','#9fb0c9'); sub.setAttribute('font-size',labelFont);
        const nextCost = E.legacyCostForNextLevel(def, E.getState().legacyNodes[def.id] || 0, E.getState());
        const maxLabel = E.legacyMaxLevel(def, E.getState());
        sub.textContent = `Lv:${fmtLegacyValue(lvl)}/${fmtLegacyValue(maxLabel)}  次:${fmtLegacyValue(nextCost)}`; svg.appendChild(sub);

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
    const wrap = document.getElementById('svgWrap');
    const resetBtn = document.getElementById('legacyZoomReset');
    if (!svg) return;
    const percent = Math.round(legacyZoom * 100);
    if (isMobileViewport()){
      svg.style.width = '100%';
      svg.style.transformOrigin = 'top left';
      svg.style.transform = `scale(${legacyZoom})`;
      if (wrap) wrap.style.paddingBottom = `${Math.max(0, (legacyZoom - 1) * 120)}px`;
    } else {
      svg.style.transform = 'none';
      svg.style.width = `${percent}%`;
      if (wrap) wrap.style.paddingBottom = '8px';
    }
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
    document.getElementById('ins_lvl').textContent = fmtLegacyValue(lvl);
    document.getElementById('ins_max').textContent = fmtLegacyValue(E.legacyMaxLevel(def, E.getState()));

    if (def.prereq && def.prereq.length){
      const names = def.prereq.map(p=>{ const nm = (C.LEGACY_DEFS.find(x=>x.id===p.id)||{}).name || p.id; return `${nm} (Lv${p.minLevel||1})`; });
      document.getElementById('ins_prereq').textContent = names.join('、');
    } else document.getElementById('ins_prereq').textContent = 'なし';

    const nextCost = E.legacyCostForNextLevel(def, E.getState().legacyNodes[id] || 0, E.getState());
    document.getElementById('ins_next_cost').textContent = fmtLegacyValue(nextCost);

    const currEff = computeLegacyEffectForLevel(def, lvl);
    const nextEff = computeLegacyEffectForLevel(def, lvl+1);
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
      const bonusText = `報酬: ${formatBonusText(a.bonus)}`;
      div.innerHTML = `<div><strong>${a.name}</strong><div class="muted small">${a.desc||''}</div></div><div class="muted small">${unlocked ? '解除' : '未解除'}<div class="muted tiny">${bonusText}</div></div>`;
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
      else if (a.type === 'ascRunDurationMax'){ if (st.lastAscensionRun && (st.lastAscensionRun.durationSec||Infinity) <= a.target) achieved = true; }
      else if (a.type === 'ascNoUpgrade'){ if (st.lastAscensionRun && st.lastAscensionRun.noUpgrade) achieved = true; }
      else if (a.type === 'ascSingleUnitType'){ if (st.lastAscensionRun && (st.lastAscensionRun.unitTypesUsed||0) === 1) achieved = true; }
      else if (a.type === 'challengeClearCount'){ const completed = (st.challenge && st.challenge.completed) || {}; const count = (C.CHALLENGES || []).reduce((acc, ch)=>acc + (completed[ch.id] ? 1 : 0), 0); if (count >= a.target) achieved = true; }
      else if (a.type === 'prestigeLayerCount'){ if ((E.getUnlockedPrestigeLayerCount ? E.getUnlockedPrestigeLayerCount(st) : 0) >= a.target) achieved = true; }
      else if (a.type === 'celestialLayerCount'){ if ((E.getUnlockedCelestialLayerCount ? E.getUnlockedCelestialLayerCount(st) : 0) >= a.target) achieved = true; }
      else if (a.type === 'ascendInChallenge'){ if ((st.challenge && st.challenge.ascendedInChallenge || 0) >= a.target) achieved = true; }
      else if (a.type === 'abyssReset'){ if ((st.abyss && st.abyss.resetCount || 0) >= a.target) achieved = true; }
      else if (a.type === 'celestialUpgradeCount'){
        const total = Object.values(st.celestialOwned || {}).reduce((acc, v)=>acc + (Number(v)||0), 0);
        if (total >= a.target) achieved = true;
      }
      else if (a.type === 'dualLayerCount'){
        const target = a.target || {};
        const pOk = (E.getUnlockedPrestigeLayerCount ? E.getUnlockedPrestigeLayerCount(st) : 0) >= (target.prestige || 0);
        const cOk = (E.getUnlockedCelestialLayerCount ? E.getUnlockedCelestialLayerCount(st) : 0) >= (target.celestial || 0);
        if (pOk && cOk) achieved = true;
      }
      if (achieved){
        st.achievementsOwned = st.achievementsOwned || {};
        st.achievementsOwned[a.id] = true;
        SM.saveState(st); E.invalidateCache(); E.recalcAndCacheGPS(st);
        buildAchievementsUI(); showTypedToast('achievement', `実績解除: ${a.name}`); syncUIAfterChange();
      }
    }
  }

  // ---------- Settings UI ----------
  function syncSettingsUI(){
    const st = E.getState();
    const settings = ensureSettingsDefaults(st);
    const notationSelect = document.getElementById('notationSelect');
    if (notationSelect) notationSelect.value = settings.notation || 'compact';
    for (const opt of CONFIRM_OPTIONS){
      const el = document.getElementById(opt.id);
      if (el) el.checked = settings[opt.key] !== false;
    }
    for (const opt of TOAST_OPTIONS){
      const el = document.getElementById(opt.id);
      if (el) el.checked = !!settings.toast[opt.key];
    }
    const appVersionEl = document.getElementById('appVersionText');
    if (appVersionEl) appVersionEl.textContent = C.APP_VERSION || 'unknown';
    const saveSchemaEl = document.getElementById('saveSchemaVersionText');
    if (saveSchemaEl) saveSchemaEl.textContent = String(SM.saveVersion || C.SAVE_VERSION || '-');
    const currentSaveEl = document.getElementById('currentSaveVersionText');
    if (currentSaveEl) currentSaveEl.textContent = String(st.version || '-');
  }

  function buildSettingsUI(){
    if (built.settings){ syncSettingsUI(); return; }
    const el = document.getElementById('settingsCard'); if (!el) return;
    ensureSettingsDefaults(E.getState());
    el.innerHTML = `
      <h3>表示設定</h3>
      <div class="row"><label class="muted small">表示形式: <select id="notationSelect" style="padding:6px; border-radius:6px; background:#071421; color:#fff; border:1px solid #173142;"><option value="compact">コンパクト (1.2K)</option><option value="scientific">指数 (1.23e+3)</option></select></label></div>
      <div class="row" style="margin-top:12px"><strong>確認ダイアログ設定</strong></div>
      ${CONFIRM_OPTIONS.map(opt=>`<div class="row"><label class="muted small"><input type="checkbox" id="${opt.id}"> ${opt.label}</label></div>`).join('')}
      <div class="row" style="margin-top:12px"><strong>通知(トースト)表示</strong></div>
      ${TOAST_OPTIONS.map(opt=>`<div class="row"><label class="muted small"><input type="checkbox" id="${opt.id}"> ${opt.label}</label></div>`).join('')}
      <div class="row" style="margin-top:12px"><strong>バージョン情報</strong></div>
      <div class="muted small">App: <span id="appVersionText"></span></div>
      <div class="muted small">Save Schema: <span id="saveSchemaVersionText"></span></div>
      <div class="muted small">Current Save: <span id="currentSaveVersionText"></span></div>
    `;

    document.getElementById('notationSelect').addEventListener('change', (ev)=>{
      const st = E.getState();
      ensureSettingsDefaults(st).notation = ev.target.value;
      SM.saveState(st);
      syncUIAfterChange();
    });
    for (const opt of CONFIRM_OPTIONS){
      document.getElementById(opt.id)?.addEventListener('change', (ev)=>{
        const st = E.getState();
        ensureSettingsDefaults(st)[opt.key] = !!ev.target.checked;
        SM.saveState(st);
      });
    }
    for (const opt of TOAST_OPTIONS){
      document.getElementById(opt.id)?.addEventListener('change', (ev)=>{
        const st = E.getState();
        ensureSettingsDefaults(st).toast[opt.key] = !!ev.target.checked;
        SM.saveState(st);
      });
    }

    built.settings = true;
    syncSettingsUI();
  }

  function syncAutoBuyControls(){
    const st = E.getState();
    ensureSettingsDefaults(st);
    const unlocked = hasAscSpecial('unlockAutobuy');
    const enableEl = document.getElementById('autoBuyEnable');
    const unitsEl = document.getElementById('autoBuyUnits');
    const upgradesEl = document.getElementById('autoBuyUpgrades');
    const legacyEl = document.getElementById('autoBuyLegacy');
    const modeEl = document.getElementById('autoBuyMode');
    const intervalEl = document.getElementById('autoBuyInterval');
    const statusEl = document.getElementById('autoBuyStatus');
    if (!enableEl || !unitsEl || !upgradesEl || !legacyEl || !modeEl || !intervalEl || !statusEl) return;

    enableEl.disabled = !unlocked;
    unitsEl.disabled = !unlocked;
    upgradesEl.disabled = !unlocked;
    legacyEl.disabled = !unlocked;
    modeEl.disabled = !unlocked;
    intervalEl.disabled = !unlocked;

    enableEl.checked = unlocked ? !!st.settings.autoBuy.enabled : false;
    unitsEl.checked = !!st.settings.autoBuy.units;
    upgradesEl.checked = !!st.settings.autoBuy.upgrades;
    legacyEl.checked = !!st.settings.autoBuy.legacy;
    modeEl.value = st.settings.autoBuy.purchaseMode === 'max' ? 'max' : 'single';
    intervalEl.value = String(Math.max(50, Number(st.settings.autoBuy.intervalMs || 500)));
    statusEl.textContent = unlocked ? '解放済み' : '未解放';
  }

  function bindAutoBuyControls(){
    const enableEl = document.getElementById('autoBuyEnable');
    const unitsEl = document.getElementById('autoBuyUnits');
    const upgradesEl = document.getElementById('autoBuyUpgrades');
    const legacyEl = document.getElementById('autoBuyLegacy');
    const modeEl = document.getElementById('autoBuyMode');
    const intervalEl = document.getElementById('autoBuyInterval');
    if (!enableEl || !unitsEl || !upgradesEl || !legacyEl || !modeEl || !intervalEl) return;
    const update = ()=>{
      const st = E.getState();
      ensureSettingsDefaults(st);
      st.settings.autoBuy.enabled = !!enableEl.checked;
      st.settings.autoBuy.units = !!unitsEl.checked;
      st.settings.autoBuy.upgrades = !!upgradesEl.checked;
      st.settings.autoBuy.legacy = !!legacyEl.checked;
      st.settings.autoBuy.purchaseMode = modeEl.value === 'max' ? 'max' : 'single';
      st.settings.autoBuy.intervalMs = Math.max(50, Number(intervalEl.value || 500));
      SM.saveState(st);
    };
    enableEl.addEventListener('change', update);
    unitsEl.addEventListener('change', update);
    upgradesEl.addEventListener('change', update);
    legacyEl.addEventListener('change', update);
    modeEl.addEventListener('change', update);
    intervalEl.addEventListener('change', update);
  }

  function runAutoBuy(dt){
    const st = E.getState();
    if (!hasAscSpecial('unlockAutobuy')) return;
    const cfg = (st.settings && st.settings.autoBuy) ? st.settings.autoBuy : {};
    if (!cfg.enabled) return;
    const interval = Math.max(50, Number(cfg.intervalMs || 500)) / 1000;
    autoBuyAccumulator += dt;
    if (autoBuyAccumulator < interval) return;

    let changed = false;
    const buyMaxMode = cfg.purchaseMode === 'max';
    let cycles = 0;
    while (autoBuyAccumulator >= interval && cycles < 20){
      autoBuyAccumulator -= interval;
      cycles++;

      if (cfg.upgrades){
        for (const def of C.UPGRADE_DEFS){
          const res = buyMaxMode ? E.buyMaxUpgradeInternal(def.id) : E.buyUpgradeInternal(def.id);
          if (res && res.ok) changed = true;
        }
      }
      if (cfg.units){
        for (const def of C.UNIT_DEFS){
          const res = buyMaxMode ? E.buyMaxUnitsInternal(def.id) : E.buyUnitInternal(def.id, 1);
          if (res && res.ok) changed = true;
        }
      }
      if (cfg.legacy){
        for (const def of C.LEGACY_DEFS){
          const res = E.attemptBuyLegacyInternal(def.id, buyMaxMode ? Infinity : 1);
          if (res && res.ok) changed = true;
        }
      }
    }
    if (changed){
      syncUIAfterChange();
      SM.saveState(st);
    }
  }

  function renderStatsTab(){
    const st = E.getState();
    const wrap = document.getElementById('statsSummary');
    const historyEl = document.getElementById('statsHistory');
    if (!wrap || !historyEl) return;
    st.runStats = st.runStats || { runCount:1, currentRunStartedAt:Date.now()/1000, currentRunPeakGold:0, history:[] };
    const now = Date.now()/1000;
    const elapsed = Math.max(0, Math.floor(now - (st.runStats.currentRunStartedAt || now)));
    const currentPeak = Math.max(st.runStats.currentRunPeakGold || 0, st.gold || 0);
    wrap.textContent = `周回回数: ${fmtNumber(st.runStats.runCount || 1)} / 現在周回の到達Gold: ${fmtNumber(currentPeak)} / 経過: ${fmtNumber(elapsed)}秒`;

    const list = Array.isArray(st.runStats.history) ? st.runStats.history.slice().reverse() : [];
    if (!list.length){ historyEl.innerHTML = '<div class="muted small">まだ周回ログがありません（Ascend後に記録されます）</div>'; return; }
    historyEl.innerHTML = list.map(item => (
      `<div class="statsRunItem">#${fmtNumber(item.run || 0)} | 到達Gold: <strong>${fmtNumber(item.reachedGold || 0)}</strong> | 所要: <strong>${fmtNumber(item.durationSec || 0)}秒</strong> | 獲得AP: <strong>${fmtNumber(item.gainedAP || 0)}</strong></div>`
    )).join('');
  }


  function renderPrestigeLayers(){
    const wrap = document.getElementById('prestigeLayerList');
    if (!wrap) return;
    const list = E.getPrestigeLayerStatus ? E.getPrestigeLayerStatus() : [];
    if (!list.length){ wrap.innerHTML = '<div class="muted small">Prestige層データがありません</div>'; return; }
    wrap.innerHTML = list.map(l=>`<div class="achItem ${l.unlocked ? 'achUnlocked':'achLocked'}"><div><strong>${l.name}</strong><div class="muted small">必要Prestige: ${fmtNumber(l.need)} / ${l.desc||''}</div><div class="muted tiny">効果: ${formatBonusText(l.bonus)}</div></div><div class="muted small">${l.unlocked ? '解放':'未解放'}</div></div>`).join('');
  }

  function renderCelestialLayers(){
    const wrap = document.getElementById('celestialLayerList');
    const tabWrap = document.getElementById('celestialLayerListTab');
    if (!wrap && !tabWrap) return;
    const list = E.getCelestialLayerStatus ? E.getCelestialLayerStatus() : [];
    if (!list.length){
      const emptyHtml = '<div class="muted small">Celestial層データがありません</div>';
      if (wrap) wrap.innerHTML = emptyHtml;
      if (tabWrap) tabWrap.innerHTML = emptyHtml;
      return;
    }
    const html = list.map(l=>`<div class="achItem ${l.unlocked ? 'achUnlocked':'achLocked'}"><div><strong>${l.name}</strong><div class="muted small">必要累計AP: ${fmtNumber(l.need)} / ${l.desc||''}</div><div class="muted tiny">効果: ${formatBonusText(l.bonus)}</div></div><div class="muted small">${l.unlocked ? '解放':'未解放'}</div></div>`).join('');
    if (wrap) wrap.innerHTML = html;
    if (tabWrap) tabWrap.innerHTML = html;
  }

  function renderCelestialBranches(){
    const wrap = document.getElementById('celestialBranchList');
    const activeEl = document.getElementById('celestialBranchActive');
    if (!wrap || !activeEl) return;
    const list = E.getCelestialBranchStatus ? E.getCelestialBranchStatus() : [];
    const active = list.find(x=>x.active);
    if (!list.length){
      wrap.innerHTML = '<div class="muted small">Celestialルート情報がありません</div>';
      activeEl.textContent = '未選択';
      return;
    }
    activeEl.textContent = active
      ? `現在のルート: ${active.jpName} / 効果: ${formatBonusText(active.bonus)}`
      : '現在のルート: 未選択';
    wrap.innerHTML = '';
    for (const branch of list){
      const row = document.createElement('div');
      row.className = `celestialBranchCard${branch.active ? ' active' : ''}${branch.unlocked ? '' : ' locked'}`;
      row.innerHTML = `<div><strong>${branch.jpName}</strong><div class="muted small">解放条件: 累計AP ${fmtNumber(branch.need)} / 効果: ${formatBonusText(branch.bonus)}</div><div class="muted tiny">${branch.desc}</div></div><div class="row"><button id="celBranch-${branch.id}" class="small">${branch.active ? '選択中' : '選択'}</button></div>`;
      wrap.appendChild(row);
      const btn = document.getElementById(`celBranch-${branch.id}`);
      if (btn){
        btn.disabled = !branch.unlocked || branch.active;
        btn.addEventListener('click', ()=>{
          const res = E.selectCelestialBranchInternal ? E.selectCelestialBranchInternal(branch.id) : { ok:false };
          if (!res.ok){ showTypedToast('general', 'そのルートはまだ選択できません'); return; }
          SM.saveState(E.getState());
          syncUIAfterChange();
          showTypedToast('purchase', `${branch.jpName} に切り替えました`);
        });
      }
    }
  }


  function buildCelestialShop(){
    if (built.celestial) return;
    const wrap = document.getElementById('celestialShop');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const def of (C.CELESTIAL_UPGRADES || [])){
      const row = document.createElement('div');
      row.className = 'upg';
      const lvl = (E.getState().celestialOwned && E.getState().celestialOwned[def.id]) || 0;
      const branchLabel = def.branch && def.branch !== 'shared' ? ` / ${def.branch}` : ' / shared';
      row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0"><div><strong>${def.name}</strong><div class="muted small">${def.desc}</div><div class="muted tiny">系統${branchLabel}</div></div><div style="text-align:right"><div class="muted small">Lv: <span id="celLvl-${def.id}">${fmtNumber(lvl)}</span>${def.maxLevel?'/'+def.maxLevel:''}</div><button id="celBuy-${def.id}" class="small" style="margin-top:6px;">購入 (${fmtNumber(def.cost)} CP)</button></div></div>`;
      wrap.appendChild(row);
      document.getElementById(`celBuy-${def.id}`)?.addEventListener('click', ()=>{
        const res = E.buyCelestialUpgradeInternal ? E.buyCelestialUpgradeInternal(def.id) : { ok:false };
        if (!res || !res.ok){
          const msg = res && res.reason === 'branch_mismatch'
            ? '対応するCelestialルートを選択してください'
            : 'CP不足、または最大レベルです';
          showTypedToast('general', msg);
        }
        else { SM.saveState(E.getState()); syncUIAfterChange(); checkAchievementsAfterAction(); showTypedToast('purchase', `${def.name} を購入しました`); }
      });
    }
    built.celestial = true;
  }

  function buildChallengesUI(){
    if (built.challenges) return;
    const coreWrap = document.getElementById('challengeList');
    const abyssWrap = document.getElementById('abyssChallengeList');
    if (!coreWrap && !abyssWrap) return;
    if (coreWrap) coreWrap.innerHTML = '';
    if (abyssWrap) abyssWrap.innerHTML = '';
    for (const ch of (C.CHALLENGES || [])){
      const row = document.createElement('div');
      row.className = 'upgradeRow';
      row.innerHTML = `<div><strong>${ch.name}</strong><div class="muted small">${ch.desc}</div><div class="muted tiny">目標: 累計Gold ${fmtNumber(ch.goalTotalGold || 0)} / 報酬: ${(ch.reward && ch.reward.text) || '恒久ボーナス'}</div></div><div class="row"><button id="chStart-${ch.id}" class="small accent">開始</button><button id="chClaim-${ch.id}" class="small">達成判定</button><button id="chAbandon-${ch.id}" class="small warn">中断</button><span id="chDone-${ch.id}" class="muted small">未クリア</span></div>`;
      const targetWrap = ch.category === 'abyss' ? abyssWrap : coreWrap;
      if (targetWrap) targetWrap.appendChild(row);
    }
    built.challenges = true;
  }


  function buildAbyssUI(){
    const wrap = document.getElementById('abyssUpgradeList');
    if (!wrap) return;
    const list = E.getAbyssUpgradeStatus ? E.getAbyssUpgradeStatus() : [];
    wrap.innerHTML = '';
    const roleOrder = Array.isArray(C.ABYSS_ROLE_ORDER) ? C.ABYSS_ROLE_ORDER : [];
    const visibleRoles = new Map();
    const lockedFeatures = new Map();
    for (const ab of list){
      if (!ab.unlocked){
        if (ab.unlockFeature && !lockedFeatures.has(ab.unlockFeature)) lockedFeatures.set(ab.unlockFeature, ab);
        continue;
      }
      const role = ab.role || 'その他';
      if (!visibleRoles.has(role)) visibleRoles.set(role, []);
      visibleRoles.get(role).push(ab);
    }
    const orderedRoles = [...roleOrder, ...Array.from(visibleRoles.keys()).filter(role=>!roleOrder.includes(role))];
    for (const role of orderedRoles){
      const entries = visibleRoles.get(role);
      if (!entries || !entries.length) continue;
      const group = document.createElement('div');
      group.className = 'upg';
      group.style.paddingBottom = '8px';
      group.innerHTML = `<div class="muted tiny" style="margin-bottom:8px;">${role}</div>`;
      for (const ab of entries){
        const row = document.createElement('div');
        const levelText = Number.isFinite(ab.maxLevel) ? `Lv ${fmtNumber(ab.lvl)} / ${fmtNumber(ab.maxLevel)}` : `Lv ${fmtNumber(ab.lvl)}`;
        const buttonText = ab.maxed ? '最大' : `購入 (${fmtNumber(ab.cost)})`;
        row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0"><div><strong>${ab.name}</strong><div class="muted small">${ab.desc}</div><div class="muted tiny">${levelText}</div></div><div style="text-align:right"><button id="abyssBuy-${ab.id}" class="small">${buttonText}</button></div></div>`;
        group.appendChild(row);
      }
      wrap.appendChild(group);
    }
    if (lockedFeatures.size){
      const lockCard = document.createElement('div');
      lockCard.className = 'upg';
      lockCard.innerHTML = `<div class="muted tiny" style="margin-bottom:8px;">未解放の深淵機能</div>`;
      for (const ab of lockedFeatures.values()){
        const row = document.createElement('div');
        row.innerHTML = `<div style="padding:6px 0"><strong>${ab.unlockFeatureName || '機能解放'}</strong><div class="muted small">${ab.name} などのアップグレードを解放</div><div class="muted tiny">条件: ${(C.ABYSS_FEATURES && C.ABYSS_FEATURES[ab.unlockFeature] && C.CHALLENGES.find(ch=>ch.id === C.ABYSS_FEATURES[ab.unlockFeature].unlockChallengeId)?.name) || '対応Challengeクリア'}</div></div>`;
        lockCard.appendChild(row);
      }
      wrap.appendChild(lockCard);
    }
    for (const ab of list.filter(x=>x.unlocked)){
      const btn = document.getElementById(`abyssBuy-${ab.id}`);
      if (!btn) continue;
      btn.disabled = !ab.affordable;
      btn.addEventListener('click', ()=>{
        const res = E.buyAbyssUpgradeInternal ? E.buyAbyssUpgradeInternal(ab.id) : { ok:false };
        if (!res.ok){
          const msg = res.reason === 'feature_locked'
            ? '対応するChallenge報酬を解放してください'
            : (res.reason === 'max' ? 'これ以上強化できません' : 'Abyss Shardが不足しています');
          showTypedToast('general', msg);
          return;
        }
        SM.saveState(E.getState());
        buildAbyssUI();
        syncUIAfterChange();
        showTypedToast('purchase', `${ab.name} を強化しました`);
      });
    }
    renderAbyssRoadmap();
  }

  function renderAbyssRoadmap(){
    const st = E.getState();
    const objectiveWrap = document.getElementById('abyssObjectiveList');
    const breakdownWrap = document.getElementById('abyssGainBreakdown');
    if (!objectiveWrap && !breakdownWrap) return;
    const arrived = ((st.abyss && (((st.abyss.resetCount || 0) > 0) || ((st.abyss.shards || 0) > 0))) || (E.previewAbyssGain && E.previewAbyssGain() > 0));
    if (objectiveWrap){
      if (!arrived){
        objectiveWrap.innerHTML = '<div class="muted small">Abyss到達後に、次の目標がここへ表示されます。</div>';
      } else {
        const objectives = E.getAbyssObjectives ? E.getAbyssObjectives(st) : [];
        objectiveWrap.innerHTML = objectives.map(obj=>`<div class="achItem ${obj.done ? 'achUnlocked' : 'achLocked'}"><div><strong>${obj.title}</strong><div class="muted small">${obj.desc}</div><div class="muted tiny">進捗: ${fmtNumber(obj.current)} / ${fmtNumber(obj.target)} / 報酬: ${obj.reward}</div></div><div class="muted small">${obj.done ? '達成' : '進行中'}</div></div>`).join('');
      }
    }
    if (breakdownWrap){
      if (!arrived){
        breakdownWrap.textContent = 'Abyss到達後に gain の内訳が表示されます。';
      } else if (!(E.hasAbyssFeature && E.hasAbyssFeature('abyss_gain_breakdown', st))){
        const feature = C.ABYSS_FEATURES && C.ABYSS_FEATURES.abyss_gain_breakdown;
        const challengeName = feature ? ((C.CHALLENGES || []).find(ch=>ch.id === feature.unlockChallengeId)?.name || feature.unlockChallengeId) : 'Challenge 8';
        breakdownWrap.textContent = `${challengeName} をクリアすると Abyss gain の内訳が表示されます。`;
      } else {
        const info = E.getAbyssGainBreakdown ? E.getAbyssGainBreakdown(st) : { current:0, parts:[] };
        const lines = [`現在のAbyss gain: ${fmtNumber(info.current)}`];
        for (const part of (info.parts || [])){
          lines.push(`${part.label}: +${fmtNumber(part.value)}`);
        }
        breakdownWrap.textContent = lines.join('\n');
      }
    }
  }

  function renderChallengeStatus(){
    const st = E.getState();
    st.challenge = st.challenge || { activeId:null, completed:{}, bestSec:{}, ascendedInChallenge:0 };
    const status = document.getElementById('challengeStatus');
    if (status){
      const active = E.getActiveChallenge ? E.getActiveChallenge(st) : null;
      if (active) status.textContent = `挑戦中: ${active.name}
進捗: ${fmtNumber(st.totalGoldEarned || 0)} / ${fmtNumber(active.goalTotalGold || 0)}
アップグレード制限: ${active.effects && active.effects.disableUpgrades ? 'あり' : 'なし'}
ユニット単一路線: ${active.effects && active.effects.singleUnitOnly ? 'あり' : 'なし'}
最高Tierのみ生産: ${active.effects && active.effects.onlyHighestUnitProduces ? 'あり' : 'なし'}
ユニット数デバフ: ${active.effects && active.effects.globalMultPerOwned ? `あり (×${active.effects.globalMultPerOwned}/台)` : 'なし'}
ユニット数コスト加速: ${active.effects && active.effects.costRampByOwnedDiv ? `あり (1 + 総数/${active.effects.costRampByOwnedDiv})` : 'なし'}
累計Gold復元待機: ${fmtNumber(st.challenge.savedTotalGold || 0)}`;
      else {
        const completed = st.challenge.completed || {};
        const clearCount = (C.CHALLENGES || []).reduce((acc, ch)=>acc + (completed[ch.id] ? 1 : 0), 0);
        status.textContent = `待機中
クリア数: ${fmtNumber(clearCount)} / ${fmtNumber((C.CHALLENGES || []).length)}`;
      }
    }
    for (const ch of (C.CHALLENGES || [])){
      const done = !!(st.challenge.completed && st.challenge.completed[ch.id]);
      const doneEl = document.getElementById(`chDone-${ch.id}`);
      const bestSec = st.challenge.bestSec ? st.challenge.bestSec[ch.id] : undefined;
      const hasBestSec = Number.isFinite(bestSec);
      if (doneEl) doneEl.textContent = done ? `クリア済み${hasBestSec ? ` (${fmtNumber(bestSec)}秒)` : ''}` : '未クリア';
      const startBtn = document.getElementById(`chStart-${ch.id}`);
      const claimBtn = document.getElementById(`chClaim-${ch.id}`);
      const abandonBtn = document.getElementById(`chAbandon-${ch.id}`);
      if (startBtn) startBtn.disabled = !!st.challenge.activeId;
      if (claimBtn) claimBtn.disabled = !(st.challenge.activeId === ch.id);
      if (abandonBtn) abandonBtn.disabled = !(st.challenge.activeId === ch.id);
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

    for (const a of C.ASC_UPGRADES){
      const l = document.getElementById(`ascLvl-${a.id}`);
      const m = document.getElementById(`ascMax-${a.id}`);
      const buyBtn = document.getElementById(`ascBuy-${a.id}`);
      const curLv = getAscUpgradeOwnedLevel(a, st);
      const maxLv = E.getAscUpgradeMaxLevel ? E.getAscUpgradeMaxLevel(a, st) : (a.maxLevel || 1);
      if (l) l.textContent = fmtNumber(curLv);
      if (m) m.textContent = fmtNumber(maxLv);
      if (buyBtn) buyBtn.disabled = curLv >= maxLv || (st.ascPoints || 0) < (a.cost || 0);
    }

    if (selectedLegacyId){
      const def = C.LEGACY_DEFS.find(x=>x.id===selectedLegacyId);
      if (def){
        document.getElementById('ins_lvl').textContent = fmtLegacyValue(st.legacyNodes[selectedLegacyId]||0);
        const nxt = E.legacyCostForNextLevel(def, st.legacyNodes[selectedLegacyId]||0);
        document.getElementById('ins_next_cost').textContent = fmtLegacyValue(nxt);
      }
    }

    if (refs.goldEl) refs.goldEl.textContent = fmtNumber(st.gold);
    if (refs.gpsEl) refs.gpsEl.textContent = fmtNumber(st.gpsCache || 0);
    if (refs.totalEl) refs.totalEl.textContent = fmtNumber(st.totalGoldEarned || 0);
    if (refs.legacyEl) refs.legacyEl.textContent = fmtNumber(st.legacy || 0);
    if (refs.ascEl) refs.ascEl.textContent = fmtNumber(st.ascPoints || 0);
    if (refs.celestialEl) refs.celestialEl.textContent = fmtNumber(st.celestialPoints || 0);
    if (refs.celestialTotalEl) refs.celestialTotalEl.textContent = fmtNumber(st.celestialEarnedTotal || 0);
    if (refs.prestigePreview) refs.prestigePreview.textContent = fmtNumber(E.previewPrestigeGain());
    if (refs.startingGoldPreview) refs.startingGoldPreview.textContent = fmtNumber(E.computeStartingGoldOnPrestige());
    if (refs.ascGainPreview) refs.ascGainPreview.textContent = fmtNumber(E.previewAscGain());
    if (refs.lastSave) refs.lastSave.textContent = new Date(st.lastSavedAt*1000).toLocaleString();
    if (refs.abyssShardEl) refs.abyssShardEl.textContent = fmtNumber((st.abyss && st.abyss.shards) || 0);
    if (refs.abyssHeaderShardEl) refs.abyssHeaderShardEl.textContent = fmtNumber((st.abyss && st.abyss.shards) || 0);
    if (refs.abyssGainEl) refs.abyssGainEl.textContent = fmtNumber(E.previewAbyssGain ? E.previewAbyssGain() : 0);
    if (refs.abyssTabShardEl) refs.abyssTabShardEl.textContent = fmtNumber((st.abyss && st.abyss.shards) || 0);
    if (refs.abyssTabGainEl) refs.abyssTabGainEl.textContent = fmtNumber(E.previewAbyssGain ? E.previewAbyssGain() : 0);
    if (refs.abyssResetCountEl) refs.abyssResetCountEl.textContent = fmtNumber((st.abyss && st.abyss.resetCount) || 0);
    const abyssGain = E.previewAbyssGain ? E.previewAbyssGain() : 0;
    const abyssBtns = [document.getElementById('doAbyss'), document.getElementById('doAbyssFromTab')];
    abyssBtns.forEach(btn=>{ if (btn) btn.disabled = abyssGain <= 0; });
    const currentSaveVersionEl = document.getElementById('currentSaveVersionText');
    if (currentSaveVersionEl) currentSaveVersionEl.textContent = String(st.version || '-');
    syncSettingsUI();
    syncAutoBuyControls();
    renderMiniGameState();
    renderPrestigeLayers();
    renderCelestialLayers();
    renderCelestialBranches();
    for (const def of (C.CELESTIAL_UPGRADES || [])){
      const lvlEl = document.getElementById(`celLvl-${def.id}`);
      if (lvlEl) lvlEl.textContent = fmtNumber((st.celestialOwned && st.celestialOwned[def.id]) || 0);
      const btn = document.getElementById(`celBuy-${def.id}`);
      if (btn){
        const lvl = (st.celestialOwned && st.celestialOwned[def.id]) || 0;
        const branchId = def.branch || 'shared';
        const activeBranchId = st.celestial && st.celestial.activeBranchId;
        const branchLocked = branchId !== 'shared' && activeBranchId !== branchId;
        btn.disabled = (def.maxLevel && lvl >= def.maxLevel) || ((st.celestialPoints || 0) < (def.cost || 0)) || branchLocked;
      }
    }
    renderChallengeStatus();
    renderStatsTab();
    renderAbyssRoadmap();
    if ((st.settings && st.settings.activeTab) === 'abyss') buildAbyssUI();
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
    st.runStats = st.runStats || { runCount:1, currentRunStartedAt:Date.now()/1000, currentRunPeakGold:0, currentRunUnitTypes:{}, currentRunUpgradeBuys:0, history:[] };
    st.runStats.currentRunPeakGold = Math.max(st.runStats.currentRunPeakGold || 0, st.gold || 0);
    runAutoBuy(dt);
    const chRes = E.tryCompleteChallengeInternal ? E.tryCompleteChallengeInternal() : { ok:false };
    if (chRes && chRes.ok){
      SM.saveState(st);
      showTypedToast('achievement', `Challenge達成: ${chRes.id}`);
      if (chRes.unlockedFeature){
        const feature = C.ABYSS_FEATURES && C.ABYSS_FEATURES[chRes.unlockedFeature];
        showTypedToast('purchase', `機能解放: ${(feature && feature.name) || chRes.unlockedFeature}`);
      }
      checkAchievementsAfterAction();
      syncUIAfterChange();
    }

    if (ts - lastUiUpdate >= (C.UI_UPDATE_INTERVAL_MS || 150)){
      lastUiUpdate = ts;
      if (refs.goldEl) refs.goldEl.textContent = fmtNumber(st.gold);
      if (refs.gpsEl) refs.gpsEl.textContent = fmtNumber(st.gpsCache || 0);
      if (refs.totalEl) refs.totalEl.textContent = fmtNumber(st.totalGoldEarned || 0);
      if (refs.legacyEl) refs.legacyEl.textContent = fmtNumber(st.legacy || 0);
      if (refs.ascEl) refs.ascEl.textContent = fmtNumber(st.ascPoints || 0);
      if (refs.celestialEl) refs.celestialEl.textContent = fmtNumber(st.celestialPoints || 0);
      if (refs.abyssHeaderShardEl) refs.abyssHeaderShardEl.textContent = fmtNumber((st.abyss && st.abyss.shards) || 0);
    if (refs.celestialTotalEl) refs.celestialTotalEl.textContent = fmtNumber(st.celestialEarnedTotal || 0);
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
      const activeChallenge = E.getActiveChallenge ? E.getActiveChallenge(st) : null;
      for (const def of C.UPGRADE_DEFS){
        const b = upgradeButtons[def.id]; if (!b) continue;
        const cost = b.nextCost || Infinity;
        const locked = !!(activeChallenge && activeChallenge.effects && activeChallenge.effects.disableUpgrades);
        b.buy.disabled = locked || !isFinite(cost) || st.gold < cost;
        b.buyMax.disabled = locked || st.gold < cost || !isFinite(cost);
      }
      if (svgDirty){ drawLegacySVG(); svgDirty = false; }
    }
    rafId = requestAnimationFrame(mainLoop);
  }

  
  function showSubTab(parent, sub){
    const st = E.getState();
    st.settings = st.settings || {};
    st.settings.activeSubTabs = Object.assign({ prestige:'core', ascension:'core', challenges:'core' }, st.settings.activeSubTabs || {});
    const active = sub || st.settings.activeSubTabs[parent] || 'core';
    document.querySelectorAll(`.subTabBtn[data-parent="${parent}"]`).forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.subtab === active);
    });
    document.querySelectorAll(`#tab-${parent} .subTabPane`).forEach(pane=> pane.style.display = 'none');
    const pane = document.getElementById(`subtab-${parent}-${active}`);
    if (pane) pane.style.display = 'block';
    st.settings.activeSubTabs[parent] = active;
    try { SM.saveState(st); } catch(e){}
    if (parent === 'prestige' && active === 'legacy'){ svgDirty = true; drawLegacySVG(); }
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
    if (insWrap){ if (name === 'prestige' && ((E.getState().settings && E.getState().settings.activeSubTabs || {}).prestige || 'core') === 'legacy'){ insWrap.style.display = 'block'; svgDirty = true; } else { insWrap.style.display = 'none'; } }

    document.querySelectorAll('.tabBtn').forEach(btn=>{
      const bt = (btn.dataset && btn.dataset.tab) ? btn.dataset.tab : (btn.getAttribute('data-tab') || (btn.id && btn.id.replace(/^tabBtn-/, '')));
      if (bt === name) btn.classList.add('active'); else btn.classList.remove('active');
    });

    if (name === 'play'){ buildUnitsUI(); buildUpgradesUI(); }
    if (name === 'prestige'){ showSubTab('prestige'); }
    if (name === 'ascension'){ buildAscShop(); buildCelestialShop(); showSubTab('ascension'); }
    if (name === 'challenges'){ buildChallengesUI(); showSubTab('challenges'); }
    if (name === 'abyss') buildAbyssUI();

    try { const st = E.getState(); st.settings = st.settings || {}; st.settings.activeTab = name; SM.saveState(st); } catch(e){}
  }

  // ---------- グローバルイベントバインド ----------
  function bindGlobalEvents(){
    document.querySelectorAll('.tabBtn').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{ ev.preventDefault(); const t = (btn.dataset && btn.dataset.tab) ? btn.dataset.tab : btn.getAttribute('data-tab'); showTab(t || 'play'); });
    });
    document.querySelectorAll('.subTabBtn').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{ ev.preventDefault(); showSubTab(btn.dataset.parent, btn.dataset.subtab); if (btn.dataset.parent==='prestige'){ showTab('prestige'); } });
    });

    const svgWrap = document.getElementById('svgWrap');
    if (svgWrap){
      const clearPinch = ()=>{ pinchStartDistance = null; };
      svgWrap.addEventListener('touchstart', (ev)=>{
        if (ev.touches.length !== 2) return;
        ev.preventDefault();
        const dx = ev.touches[0].clientX - ev.touches[1].clientX;
        const dy = ev.touches[0].clientY - ev.touches[1].clientY;
        pinchStartDistance = Math.hypot(dx, dy);
        pinchStartZoom = legacyZoom;
      }, { passive:false });
      svgWrap.addEventListener('touchmove', (ev)=>{
        if (ev.touches.length !== 2 || !pinchStartDistance) return;
        ev.preventDefault();
        const dx = ev.touches[0].clientX - ev.touches[1].clientX;
        const dy = ev.touches[0].clientY - ev.touches[1].clientY;
        const distance = Math.hypot(dx, dy);
        if (!distance) return;
        setLegacyZoom(pinchStartZoom * (distance / pinchStartDistance));
      }, { passive:false });
      svgWrap.addEventListener('touchend', clearPinch, { passive:true });
      svgWrap.addEventListener('touchcancel', clearPinch, { passive:true });
    }

    document.getElementById('doPrestige')?.addEventListener('click', ()=>{
      const p = E.previewPrestigeGain();
      if (p <= 0){ showTypedToast('general','獲得できるレガシーはありません'); return; }
      if (shouldConfirm('confirmPrestige') && !confirm(`プレステージを実行しますか？ 獲得レガシー: ${fmtNumber(p)} 開始ゴールド: ${fmtNumber(E.computeStartingGoldOnPrestige())}`)) return;
      const res = E.doPrestigeInternal();
      if (res.ok){ svgDirty=true; syncUIAfterChange(); buildAscShop(); checkAchievementsAfterAction(); showTypedToast('purchase', `プレステージ: レガシー +${fmtNumber(res.gain)}`); }
    });

    const runAbyssReset = ()=>{
      const g = E.previewAbyssGain ? E.previewAbyssGain() : 0;
      if (g <= 0){ showTypedToast('general', 'Abyss条件未達（累計 1.8e308 必要）'); return; }
      if (shouldConfirm('confirmAbyssReset') && !confirm(`Abyssリセットを実行しますか？ 実績以外の要素が全てリセットされます。獲得: Abyss Shard +${fmtNumber(g)}`)) return;
      const res = E.doAbyssResetInternal ? E.doAbyssResetInternal() : { ok:false };
      if (res.ok){ SM.saveState(E.getState()); buildAbyssUI(); syncUIAfterChange(); checkAchievementsAfterAction(); showTypedToast('achievement', `Abyss Shard +${fmtNumber(res.gain)}`); }
    };
    document.getElementById('doAbyss')?.addEventListener('click', runAbyssReset);
    document.getElementById('doAbyssFromTab')?.addEventListener('click', runAbyssReset);

    document.getElementById('doAscend')?.addEventListener('click', ()=>{
      const p = E.previewAscGain();
      if (p <= 0){ showTypedToast('general','Ascensionで得られるポイントはありません'); return; }
      if (shouldConfirm('confirmAscend') && !confirm(`Ascend 実行で AscensionPoints +${fmtNumber(p)} を得ます。実行しますか？`)) return;
      const res = E.doAscendInternal();
      if (res.ok){ svgDirty=true; syncUIAfterChange(); buildAscShop(); buildCelestialShop(); checkAchievementsAfterAction(); showTypedToast('purchase', `Ascend: AP +${fmtNumber(res.gain)} / CP +${fmtNumber(res.celestialGain || 0)}`); }
    });

    document.getElementById('miniGameStart')?.addEventListener('click', ()=> startMiniGame());
    document.querySelectorAll('.miniLaneBtn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if (!miniGameController) return;
        const lane = Number(btn.dataset.lane || -1);
        miniGameController.handleLaneClick(lane);
      });
    });

    for (const ch of (C.CHALLENGES || [])){
      document.getElementById(`chStart-${ch.id}`)?.addEventListener('click', ()=>{
        if (shouldConfirm('confirmChallengeStart') && !confirm(`${ch.name} を開始します。現在の周回進行はリセットされます。`)) return;
        const res = E.startChallengeInternal ? E.startChallengeInternal(ch.id) : { ok:false };
        if (res.ok){ SM.saveState(E.getState()); syncUIAfterChange(); showTypedToast('general', `${ch.name} 開始`); }
      });
      document.getElementById(`chClaim-${ch.id}`)?.addEventListener('click', ()=>{
        const res = E.tryCompleteChallengeInternal ? E.tryCompleteChallengeInternal() : { ok:false };
        if (res.ok){
          SM.saveState(E.getState());
          syncUIAfterChange();
          checkAchievementsAfterAction();
          showTypedToast('achievement', `${ch.name} クリア`);
          if (res.unlockedFeature){
            const feature = C.ABYSS_FEATURES && C.ABYSS_FEATURES[res.unlockedFeature];
            showTypedToast('purchase', `機能解放: ${(feature && feature.name) || res.unlockedFeature}`);
          }
        }
        else showTypedToast('general', '目標未達です');
      });
      document.getElementById(`chAbandon-${ch.id}`)?.addEventListener('click', ()=>{
        if (shouldConfirm('confirmChallengeAbandon') && !confirm(`${ch.name} を中断します。チャレンジ中の累計Goldは破棄され、開始前の累計Goldに戻ります。`)) return;
        const res = E.abandonChallengeInternal ? E.abandonChallengeInternal() : { ok:false };
        if (res.ok){ SM.saveState(E.getState()); syncUIAfterChange(); showTypedToast('general', `${ch.name} を中断`); }
      });
    }

    document.getElementById('ins_buy1')?.addEventListener('click', ()=>{
      if (!selectedLegacyId) return;
      const st = E.getState(); const want = ensureSettingsDefaults(st).confirmLegacyBuy !== false;
      if (want && !confirm('レガシーを1レベル取得しますか？')) return;
      const res = E.attemptBuyLegacyInternal(selectedLegacyId, 1);
      if (res.ok){ svgDirty=true; syncUIAfterChange(); selectLegacyNode(selectedLegacyId); checkAchievementsAfterAction(); showTypedToast('purchase','レガシーを購入しました'); }
      else showTypedToast('general','購入失敗（コスト不足または前提不足）');
    });

    document.getElementById('ins_buyMax')?.addEventListener('click', ()=>{
      if (!selectedLegacyId) return;
      const st = E.getState(); const want = ensureSettingsDefaults(st).confirmLegacyBuyMax !== false;
      if (want && !confirm('選択中のレガシーノードを限界まで購入しますか？')) return;
      const res = E.attemptBuyLegacyInternal(selectedLegacyId, Infinity);
      if (res.ok){ svgDirty=true; syncUIAfterChange(); selectLegacyNode(selectedLegacyId); checkAchievementsAfterAction(); showTypedToast('purchase','レガシーをまとめて購入しました'); }
      else showTypedToast('general','購入できるレベルはありません');
    });

    document.getElementById('ins_close')?.addEventListener('click', ()=>{
      document.getElementById('ins_box').style.display='none'; document.getElementById('ins_none').style.display='block';
      selectedLegacyId = null; for (const id in svgNodeEls) if (svgNodeEls[id]) svgNodeEls[id].classList.remove('selected');
    });

    document.getElementById('legacyZoomIn')?.addEventListener('click', ()=> setLegacyZoom(legacyZoom + getLegacyZoomStep()));
    document.getElementById('legacyZoomOut')?.addEventListener('click', ()=> setLegacyZoom(legacyZoom - getLegacyZoomStep()));
    document.getElementById('legacyZoomReset')?.addEventListener('click', ()=> setLegacyZoom(1));

    // Save/Load
    document.getElementById('downloadSave')?.addEventListener('click', ()=>{
      try{ const json = SM.stringifyState(E.getState(), 2); const blob = new Blob([json], { type:'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `inc_save_${new Date().toISOString().replace(/[:.]/g,'-')}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); showTypedToast('general','ダウンロードしました'); } catch(e){}
    });
    document.getElementById('copySave')?.addEventListener('click', ()=>{
      try{ const json = SM.stringifyState(E.getState(), 2); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(()=>showTypedToast('general','コピーしました')); else document.getElementById('pasteJson').value = json; } catch(e){}
    });
    document.getElementById('importPasteBtn')?.addEventListener('click', ()=>{
      try{ const obj = SM.parseStateText(document.getElementById('pasteJson').value.trim()); if (shouldConfirm('confirmImportOverwrite') && !confirm('上書きしますか？')) return; const migrated = SM.importState(obj); E.setState(migrated); SM.saveState(E.getState()); svgDirty=true; syncUIAfterChange(); buildAchievementsUI(); buildSettingsUI(); showTypedToast('general','インポート完了'); } catch(e){ alert('インポートエラー: '+e.message); } 
    });
    document.getElementById('reset')?.addEventListener('click', ()=>{
      if (shouldConfirm('confirmHardReset') && !confirm('本当に全てのデータをリセットしますか？')) return;
      E.setState(SM.deepCopy(SM.defaultState)); SM.saveState(E.getState()); svgDirty=true; syncUIAfterChange(); buildAchievementsUI(); showTypedToast('general','リセットしました');
    });
    document.getElementById('triggerFileInput')?.addEventListener('click', ()=> document.getElementById('fileInput').click());
    document.getElementById('fileInput')?.addEventListener('change', (ev)=>{
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = ()=>{ try{ const obj = SM.parseStateText(r.result); if (shouldConfirm('confirmImportOverwrite') && !confirm('上書きしますか？')) { ev.target.value=''; return; } const migrated = SM.importState(obj); E.setState(migrated); SM.saveState(E.getState()); svgDirty=true; syncUIAfterChange(); buildAchievementsUI(); buildSettingsUI(); showTypedToast('general','ファイル読み込み完了'); } catch(e){ alert('インポートエラー: '+e.message); } }; r.readAsText(f); ev.target.value = ''; 
    });
  }

  
  function showUpdateModalIfNeeded(){
    const st = E.getState();
    if ((st.seenUpdateVersion || null) === C.APP_VERSION) return;
    const modal = document.getElementById('updateModal');
    const body = document.getElementById('updateModalBody');
    if (!modal || !body) return;
    body.textContent = `${C.APP_VERSION} の主な更新
- 確認ダイアログ設定を全操作へ拡張し、トースト設定に一般メッセージ切替を追加
- 「星界チューニング規格」の上限拡張が一回きりの Ascension Shop 項目へ及ばないよう修正
- Abyssアップグレード「自律継承アーカイブ」を追加し、Abyss後も自動購入の解放状態を保持可能に変更`;
    modal.style.display = 'flex';
    document.getElementById('closeUpdateModal')?.addEventListener('click', ()=>{
      modal.style.display = 'none';
      st.seenUpdateVersion = C.APP_VERSION;
      SM.saveState(st);
    }, { once:true });
  }

  // ---------- 初期化 ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    buildUnitsUI(); buildUpgradesUI(); buildAscShop(); buildCelestialShop(); buildChallengesUI(); buildAchievementsUI(); buildSettingsUI();
    bindAutoBuyControls();
    cacheRefs();

    const off = E.applyOfflineProgressWithToast();
    if (off && off.gain) showTypedToast('offline', `オフライン: ${fmtNumber(off.gain)} ゴールド (${Math.round(off.elapsed)}秒)`);

    E.recalcAndCacheGPS(E.getState());
    syncUIAfterChange();
    bindGlobalEvents();
    applyLegacyZoom();

    showTab(E.getState().settings.activeTab || 'play');
    showUpdateModalIfNeeded();

    setInterval(()=>SM.saveState(E.getState()), C.AUTO_SAVE_INTERVAL || 5000);
    lastFrame = performance.now(); lastUiUpdate = performance.now(); requestAnimationFrame(mainLoop);
  });

})();
