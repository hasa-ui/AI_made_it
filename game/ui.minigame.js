// ui.minigame.js
// Ascensionミニゲーム関連機能を ui.app.js から分離

(function(){
  function create(deps){
    const E = deps.E;
    const SM = deps.SM;
    const fmtNumber = deps.fmtNumber || (n=>String(n));
    const showTypedToast = deps.showTypedToast || (()=>{});
    const isAscShopFullyPurchased = deps.isAscShopFullyPurchased || (()=>false);
    const syncUIAfterChange = deps.syncUIAfterChange || (()=>{});
    const checkAchievementsAfterAction = deps.checkAchievementsAfterAction || (()=>{});

    let runtime = { active:false, round:0, totalRounds:10, score:0, misses:0, streak:0, bestStreak:0, targetLane:0, timerId:null, rule:'normal', roundTimeoutMs:1100 };

    function ensureMiniGameState(st){
      st.miniGame = Object.assign({ plays:0, bestScore:0, lastScore:0, lastMisses:0, perfectRuns:0, bestStreak:0 }, st.miniGame || {});
    }

    function render(){
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

      summary.textContent = `ベスト: ${fmtNumber(st.miniGame.bestScore)} / 挑戦回数: ${fmtNumber(st.miniGame.plays)} / 最高連鎖: ${fmtNumber(st.miniGame.bestStreak || 0)}`;
      if (!runtime.active){
        status.textContent = `待機中\n前回スコア: ${fmtNumber(st.miniGame.lastScore)}\n前回ミス: ${fmtNumber(st.miniGame.lastMisses)}\n完全勝利: ${fmtNumber(st.miniGame.perfectRuns)} 回`;
      }
      startBtn.disabled = runtime.active || (st.ascPoints || 0) < 1;
      laneButtons.forEach((btn, idx)=>{
        btn.disabled = !runtime.active;
        const isHint = runtime.active && runtime.rule === 'normal' && idx === runtime.targetLane;
        btn.classList.toggle('accent', isHint);
        btn.classList.toggle('warn', runtime.active && runtime.rule === 'inverse' && idx === runtime.targetLane);
        btn.classList.toggle('alt', !isHint && !(runtime.active && runtime.rule === 'inverse' && idx === runtime.targetLane));
      });
    }

    function finish(){
      const st = E.getState();
      ensureMiniGameState(st);
      runtime.active = false;
      if (runtime.timerId) clearTimeout(runtime.timerId);
      runtime.timerId = null;

      const reward = Math.min(6, Math.floor(runtime.score / 110));
      st.ascPoints += reward;
      st.miniGame.plays += 1;
      st.miniGame.lastScore = runtime.score;
      st.miniGame.lastMisses = runtime.misses;
      st.miniGame.bestScore = Math.max(st.miniGame.bestScore, runtime.score);
      st.miniGame.bestStreak = Math.max(st.miniGame.bestStreak || 0, runtime.bestStreak || 0);
      if (runtime.misses === 0 && runtime.score >= 140) st.miniGame.perfectRuns += 1;
      SM.saveState(st);
      syncUIAfterChange();
      checkAchievementsAfterAction();
      showTypedToast('general', `ミニゲーム終了: スコア ${fmtNumber(runtime.score)} / AP +${fmtNumber(reward)}`);
      render();
    }

    function runRound(){
      if (!runtime.active) return;
      if (runtime.round >= runtime.totalRounds){ finish(); return; }
      runtime.targetLane = Math.floor(Math.random() * 4);
      runtime.round += 1;
      runtime.rule = (runtime.round % 5 === 0) ? 'inverse' : 'normal';
      runtime.roundTimeoutMs = Math.max(620, 1200 - (runtime.round * 45));
      const status = document.getElementById('miniGameStatus');
      if (status) status.textContent = `ラウンド ${runtime.round}/${runtime.totalRounds} (${runtime.rule === 'inverse' ? '反転' : '通常'})\nスコア: ${fmtNumber(runtime.score)}\n連続正解: ${fmtNumber(runtime.streak)}\nミス: ${fmtNumber(runtime.misses)}\n制限時間: ${fmtNumber(runtime.roundTimeoutMs)}ms`;
      render();
      runtime.timerId = setTimeout(()=>{
        if (!runtime.active) return;
        runtime.misses += 1;
        runtime.streak = 0;
        runRound();
      }, runtime.roundTimeoutMs);
    }

    function start(){
      const st = E.getState();
      ensureMiniGameState(st);
      if (!isAscShopFullyPurchased(st)){ showTypedToast('general', 'Ascension Shop 全購入後に解放されます'); return; }
      if ((st.ascPoints || 0) < 1){ showTypedToast('general', '開始には AP が1必要です'); return; }
      st.ascPoints -= 1;
      runtime = { active:true, round:0, totalRounds:10, score:0, misses:0, streak:0, bestStreak:0, targetLane:0, timerId:null, rule:'normal', roundTimeoutMs:1100 };
      SM.saveState(st);
      syncUIAfterChange();
      runRound();
    }

    function handleLaneClick(lane){
      if (!runtime.active) return;
      if (runtime.timerId) clearTimeout(runtime.timerId);
      const expectedLane = runtime.rule === 'inverse' ? ((runtime.targetLane + 2) % 4) : runtime.targetLane;
      if (lane === expectedLane){
        runtime.streak += 1;
        runtime.bestStreak = Math.max(runtime.bestStreak, runtime.streak);
        runtime.score += 16 + (runtime.streak * 4);
      } else {
        runtime.streak = 0;
        runtime.misses += 1;
      }
      runRound();
    }

    return { render, start, handleLaneClick };
  }

  window.UIMiniGame = { create };
})();
