// config.js — 定数・データ定義 (実績を含む)
(function(){
  window.CONFIG = {};

  const C = {
    SAVE_KEY: 'inc.split.full.v4',
    SAVE_VERSION: 13,
    APP_VERSION: 'Ver.1.21.1',
    UI_UPDATE_INTERVAL_MS: 50,
    AUTO_SAVE_INTERVAL: 5000,
    MAX_OFFLINE_SECONDS: 60*60*24,
    PRESTIGE_BASE_DIV: 2000,
    BASE_PRESTIGE_EFFECT_PER_POINT: 0.05,
    STARTING_GOLD: 50,
    ASC_BASE_DIV: 25,
    ASC_SOFTCAP_START: 20,
    ASC_SOFTCAP_EXPONENT: 0.72,
    ABYSS_RESET_GOAL: Number.MAX_VALUE
  };


  C.ABYSS_UPGRADES = [
    { id:'ab_cost', name:'深淵圧縮', desc:'全コストをLvごとに×0.94', baseCost:1, costMult:2.2, type:'costMult', payload:{multPerLevel:0.94} },
    { id:'ab_flux', name:'虚無フラックス', desc:'全体倍率をLvごとに×1.35', baseCost:1, costMult:2.6, type:'globalMult', payload:{multPerLevel:1.35} },
    { id:'ab_seed', name:'空虚の種火', desc:'開始ゴールド +2.5e8 /Lv', baseCost:2, costMult:2.8, type:'startGold', payload:{amountPerLevel:2.5e8} }
  ];

  C.UNIT_DEFS = [
    { id:'junior', name:'ジュニア採掘機', baseCost:4,   costMult:1.11, baseGPS:0.35, desc:'生産:0.35×所持数' },
    { id:'miner',  name:'採掘機',       baseCost:18,  costMult:1.14, baseGPS:1.6,  desc:'生産:1.6×所持数' },
    { id:'excav',  name:'エクスカベーター', baseCost:900, costMult:1.2, baseGPS:32,   desc:'生産:32×所持数' },
    { id:'drillcore', name:'ドリルコア反応炉', baseCost:120000, costMult:1.23, baseGPS:950, desc:'生産:950×所持数' },
    { id:'voidrig', name:'ヴォイド掘削艦', baseCost:85000000, costMult:1.27, baseGPS:120000, desc:'生産:120000×所持数' }
  ];

  C.UPGRADE_DEFS = [
    { id:'u_miner_eff', name:'採掘効率向上', desc:'採掘機: Lvごとに×1.15', baseCost:30,  costMult:1.9,  type:'unitMult',  payload:{unitId:'miner', multPerLevel:0.15}, maxLevel:null },
    { id:'u_global_boost', name:'運営改善', desc:'全体: Lvごとに×1.08', baseCost:120, costMult:2.5,  type:'globalMult', payload:{multPerLevel:0.08},  maxLevel:null },
    { id:'u_drillcore_overclock', name:'反応炉オーバークロック', desc:'ドリルコア反応炉: Lvごとに×1.85', baseCost:90000000, costMult:3.2, type:'unitMult', payload:{unitId:'drillcore', multPerLevel:0.85}, maxLevel:null },
    { id:'u_voidrig_supercharger', name:'ヴォイド超過給', desc:'ヴォイド掘削艦: Lvごとに×2.20', baseCost:4500000000, costMult:3.6, type:'unitMult', payload:{unitId:'voidrig', multPerLevel:1.2}, maxLevel:null }
  ];

  C.LEGACY_DEFS = [
    { id:'lg_global10', name:'永続研究所', desc:'全体 ×1.10 /Lv', baseCost:1,  costMult:2.0, maxLevel:5, x:140,  y:110, type:'globalMult', payload:{multPerLevel:0.10}, prereq:[] },
    { id:'lg_miner25', name:'鉱夫育成',    desc:'採掘機 ×1.25 /Lv', baseCost:2,  costMult:2.2, maxLevel:4, x:360,  y:90,  type:'unitMult', payload:{unitId:'miner', multPerLevel:0.25}, prereq:[{id:'lg_global10',minLevel:1}] },
    { id:'lg_miner_x2', name:'機械化支援', desc:'採掘機 ×1.5 /Lv',  baseCost:4,  costMult:2.4, maxLevel:3, x:580,  y:90,  type:'unitMult', payload:{unitId:'miner', multPerLevel:0.5}, prereq:[{id:'lg_miner25',minLevel:2}] },
    { id:'lg_cost5', name:'経済学習',       desc:'コスト ×0.95 /Lv', baseCost:2,  costMult:1.9, maxLevel:4, x:360,  y:250, type:'costMult', payload:{multPerLevel:0.95}, prereq:[{id:'lg_global10',minLevel:1}]},
    { id:'lg_seed50', name:'種銭支給',     desc:'開始ゴールド +150 /Lv', baseCost:2, costMult:1.7, maxLevel:5, x:140, y:270, type:'startGold', payload:{amountPerLevel:150}, prereq:[]},
    { id:'lg_passive', name:'永続配当',    desc:'恒久 +5 GPS /Lv', baseCost:8, costMult:2.3, maxLevel:4, x:860,  y:110, type:'flatGPS', payload:{gpsPerLevel:5}, prereq:[{id:'lg_global10',minLevel:2}]},
    { id:'lg_mega', name:'遺産の賢王',     desc:'全体 ×1.5 (Lv1)', baseCost:20, costMult:1.0, maxLevel:1, x:860,  y:320, type:'globalMult', payload:{multPerLevel:0.5}, prereq:[{id:'lg_passive',minLevel:1}]},

    { id:'lg_titan_forge', name:'タイタン鍛造所', desc:'全体 ×2.5 /Lv', baseCost:60,  costMult:3.2, maxLevel:2, x:1120, y:80,  type:'globalMult', payload:{multPerLevel:1.5}, prereq:[{id:'lg_mega',minLevel:1}] },
    { id:'lg_quantum_matrix', name:'量子マトリクス', desc:'採掘機 ×5.00 /Lv', baseCost:200, costMult:4.0, maxLevel:2, x:1340, y:160, type:'unitMult', payload:{unitId:'miner', multPerLevel:4.0}, prereq:[{id:'lg_titan_forge',minLevel:1}] },
    { id:'lg_excav_boost', name:'メガ掘削支援', desc:'エクスカベーター ×10.0 /Lv', baseCost:500, costMult:3.8, maxLevel:2, x:1340, y:300, type:'unitMult', payload:{unitId:'excav', multPerLevel:9.0}, prereq:[{id:'lg_quantum_matrix',minLevel:1}] },
    { id:'lg_econ_mastery', name:'経済の覇者', desc:'コスト ×0.5 /Lv', baseCost:400, costMult:3.5, maxLevel:2, x:1560, y:90, type:'costMult', payload:{multPerLevel:0.5}, prereq:[{id:'lg_titan_forge',minLevel:1}] },
    { id:'lg_ark_dividend', name:'方舟の配当', desc:'恒久 +50 GPS /Lv', baseCost:800, costMult:2.8, maxLevel:2, x:1560, y:320, type:'flatGPS', payload:{gpsPerLevel:50}, prereq:[{id:'lg_passive',minLevel:1}] },
    { id:'lg_singularity', name:'特異点生成器', desc:'全体 ×10.0 (Lv1)', baseCost:2500, costMult:6.0, maxLevel:1, x:1810, y:180, type:'globalMult', payload:{multPerLevel:9.0}, prereq:[{id:'lg_ark_dividend',minLevel:1}] },
    { id:'lg_seed_mega', name:'種銭の源泉', desc:'開始ゴールド +1000 /Lv', baseCost:5000, costMult:8.0, maxLevel:1, x:2030, y:280, type:'startGold', payload:{amountPerLevel:1000}, prereq:[{id:'lg_singularity',minLevel:1}] },
    { id:'lg_universal_amplifier', name:'万能増幅器', desc:'全ユニット ×3.0 /Lv', baseCost:8000, costMult:10.0, maxLevel:1, x:2030, y:80, type:'globalMult', payload:{multPerLevel:2.0}, prereq:[{id:'lg_singularity',minLevel:1}] },

    { id:'lg_void_research', name:'虚空研究群', desc:'全体 ×6.0 /Lv', baseCost:25000, costMult:12.0, maxLevel:1, x:2280, y:170, type:'globalMult', payload:{multPerLevel:5.0}, prereq:[{id:'lg_universal_amplifier',minLevel:1}] },
    { id:'lg_drillcore_forge', name:'反応炉鍛造', desc:'ドリルコア反応炉 ×9.0 /Lv', baseCost:30000, costMult:12.0, maxLevel:1, x:2520, y:80, type:'unitMult', payload:{unitId:'drillcore', multPerLevel:8.0}, prereq:[{id:'lg_void_research',minLevel:1}] },
    { id:'lg_voidrig_drive', name:'ヴォイド航法', desc:'ヴォイド掘削艦 ×14.0 /Lv', baseCost:50000, costMult:14.0, maxLevel:1, x:2520, y:280, type:'unitMult', payload:{unitId:'voidrig', multPerLevel:13.0}, prereq:[{id:'lg_void_research',minLevel:1}] },
    { id:'lg_genesis_seed', name:'創世種子圧縮', desc:'開始ゴールド +5.0e9', baseCost:120000, costMult:18.0, maxLevel:1, x:2760, y:180, type:'startGold', payload:{amountPerLevel:5.0e9}, prereq:[{id:'lg_voidrig_drive',minLevel:1}] }
  ];

  C.ASC_UPGRADES = [
    { id:'asc_global20', name:'永遠の研究', desc:'恒久: 全体 ×1.30', cost:8, type:'globalMult', payload:{mult:1.30}, maxLevel:4 },
    { id:'asc_flat50',   name:'黄金の配当', desc:'恒久: +100 GPS', cost:20, type:'flatGPS', payload:{gps:100}, maxLevel:2 },
    { id:'asc_prestige_boost', name:'超越の加護', desc:'恒久: +0.02 prestige effect /Lv', cost:36, type:'prestigeEffectAdd', payload:{add:0.02}, maxLevel:2 },
    { id:'asc_galactic_mult', name:'銀河の恩寵', desc:'恒久: 全体 ×3.0', cost:56, type:'globalMult', payload:{mult:3.0}, maxLevel:1 },
    { id:'asc_colossus_gps',  name:'巨像の配当', desc:'恒久: +500 GPS', cost:80, type:'flatGPS', payload:{gps:500}, maxLevel:1 },
    { id:'asc_prestige_super', name:'超越の祝福', desc:'恒久: +0.10 prestige effect', cost:110, type:'prestigeEffectAdd', payload:{add:0.10}, maxLevel:1 },
    { id:'asc_seed_core', name:'創世資金コア', desc:'恒久: 開始ゴールド +1200', cost:220, type:'startGoldFlat', payload:{gold:1200}, maxLevel:1 },
    { id:'asc_passive_reactor', name:'反応炉配当', desc:'恒久: +1200 GPS', cost:340, type:'flatGPS', payload:{gps:1200}, maxLevel:1 },
    { id:'asc_keep_total_gold', name:'記録保全プロトコル', desc:'Ascend時に累計ゴールドを維持', cost:520, type:'special', payload:{kind:'keepTotalGold'}, maxLevel:1 },
    { id:'asc_keep_legacy_tree', name:'レガシー写像保存', desc:'Ascend時にレガシーツリーを維持', cost:760, type:'special', payload:{kind:'keepLegacyTree'}, maxLevel:1 },
    { id:'asc_unlock_legacy_cap', name:'遺産限界突破理論', desc:'レガシーツリーのレベル上限 +1 /Lv', cost:15000, type:'legacyCapBoost', payload:{addMaxLevel:1}, maxLevel:10 },
    { id:'asc_unlock_autobuy', name:'自律運用OS', desc:'自動購入機能を解放', cost:1100, type:'special', payload:{kind:'unlockAutobuy'}, maxLevel:1 },
    { id:'asc_cosmic_multiplier', name:'天の倍加', desc:'恒久: 全体 ×10.0', cost:1800, type:'globalMult', payload:{mult:10.0}, maxLevel:1 },
    { id:'asc_mythic_gps', name:'神話の配当', desc:'恒久: +2500 GPS', cost:2800, type:'flatGPS', payload:{gps:2500}, maxLevel:1 },
    { id:'asc_void_multiplier', name:'虚空倍率機関', desc:'恒久: 全体 ×22.0', cost:4200, type:'globalMult', payload:{mult:22.0}, maxLevel:1 },
    { id:'asc_void_seed', name:'虚空シード供給', desc:'恒久: 開始ゴールド +8.0e8', cost:5600, type:'startGoldFlat', payload:{gold:8.0e8}, maxLevel:1 },
    { id:'asc_void_income', name:'虚空配当回廊', desc:'恒久: +1.2e6 GPS', cost:7200, type:'flatGPS', payload:{gps:1.2e6}, maxLevel:1 }
  ];

  C.PRESTIGE_LAYERS = [
    { id:'pl_echo', name:'残響層', need:25, desc:'プレステージ共鳴で全体がわずかに活性化', bonus:{ type:'globalMult', mult:1.12 } },
    { id:'pl_weave', name:'織界層', need:80, desc:'織り込まれた知見で開始資金と初速を強化', bonus:{ type:'startGold', amount:500 } },
    { id:'pl_fractal', name:'フラクタル層', need:180, desc:'自己相似最適化で Prestige 効果を加速', bonus:{ type:'prestigeEffectAdd', add:0.025 } },
    { id:'pl_orbit', name:'軌道層', need:320, desc:'周回経済を安定化しコストを圧縮', bonus:{ type:'costMult', mult:0.9 } },
    { id:'pl_aurora', name:'極光層', need:520, desc:'極光演算が全生産ラインを常時補助', bonus:{ type:'flatGPS', gps:1500 } }
  ];

  C.CELESTIAL_LAYERS = [
    { id:'cl_nova', name:'ノヴァ層', need:8, desc:'Ascension残光が生産を自己増幅する', bonus:{ type:'globalMult', mult:1.2 } },
    { id:'cl_vault', name:'ヴォルト層', need:20, desc:'周回資産を圧縮し、全ユニットコストを恒久軽減', bonus:{ type:'costMult', mult:0.88 } },
    { id:'cl_mirror', name:'ミラー層', need:45, desc:'鏡像経済により開始資金と基礎配当が増幅', bonus:{ type:'startGold', amount:8000 } },
    { id:'cl_epoch', name:'エポック層', need:80, desc:'時代跳躍で Prestige 効果を恒久底上げ', bonus:{ type:'prestigeEffectAdd', add:0.06 } }
  ];

  C.CELESTIAL_UPGRADES = [
    { id:'cel_prism', name:'プリズム鋳造', desc:'恒久: 全体 ×1.45', cost:3, type:'globalMult', payload:{ mult:1.45 }, maxLevel:4 },
    { id:'cel_harmonic_seed', name:'ハーモニック種銭', desc:'恒久: 開始ゴールド +25000', cost:5, type:'startGold', payload:{ amount:25000 }, maxLevel:3 },
    { id:'cel_aether_drift', name:'エーテル漂流炉', desc:'恒久: +4500 GPS', cost:6, type:'flatGPS', payload:{ gps:4500 }, maxLevel:4 },
    { id:'cel_time_fold', name:'時空折り畳み', desc:'恒久: コスト ×0.82', cost:9, type:'costMult', payload:{ mult:0.82 }, maxLevel:2 },
    { id:'cel_resonance_core', name:'共鳴核の再編', desc:'恒久: Prestige効果 +0.08', cost:8, type:'prestigeEffectAdd', payload:{ add:0.08 }, maxLevel:3 },
    { id:'cel_excav_pulse', name:'深層パルス', desc:'恒久: エクスカベーター ×2.5', cost:7, type:'unitMult', payload:{ unitId:'excav', mult:2.5 }, maxLevel:3 },
    { id:'cel_voidrig_flux', name:'虚空フラックス', desc:'恒久: ヴォイド掘削艦 ×4.0', cost:12, type:'unitMult', payload:{ unitId:'voidrig', mult:4.0 }, maxLevel:3 },
    { id:'cel_event_horizon', name:'事象地平演算', desc:'恒久: 全体 ×2.5', cost:14, type:'globalMult', payload:{ mult:2.5 }, maxLevel:2 },
    { id:'cel_asc_expand', name:'星界チューニング規格', desc:'Ascension Shopのレベル上限 +1 /Lv', cost:16, type:'ascShopCapBoost', payload:{ addMaxLevel:1 }, maxLevel:5 }
  ];

  C.CHALLENGES = [
    {
      id:'ch_taxed_growth',
      name:'Challenge 1: Taxed Growth',
      desc:'全体生産が35%に低下、代わりにコスト上昇は通常のまま。',
      goalTotalGold: 120000,
      effects:{ globalMult:0.35 },
      reward:{ type:'globalMult', mult:1.08, text:'恒久: 全体 ×1.08' }
    },
    {
      id:'ch_no_upgrades',
      name:'Challenge 2: Pure Machinery',
      desc:'アップグレード購入不可で累計ゴールドを到達させる。',
      goalTotalGold: 160000,
      effects:{ disableUpgrades:true },
      reward:{ type:'flatGPS', gps:350, text:'恒久: +350 GPS' }
    },
    {
      id:'ch_cost_spike',
      name:'Challenge 3: Cost Spike',
      desc:'ユニット価格が1.7倍で進行。成長設計が試される。',
      goalTotalGold: 220000,
      effects:{ costMult:1.7 },
      reward:{ type:'prestigeEffectAdd', add:0.02, text:'恒久: Prestige効果 +0.02' }
    },
    {
      id:'ch_monoline',
      name:'Challenge 4: Mono Line',
      desc:'最初に購入した1種類のユニットだけで走り切る。切替不可。',
      goalTotalGold: 280000,
      effects:{ singleUnitOnly:true },
      reward:{ type:'costMult', mult:0.9, text:'恒久: コスト ×0.90' }
    },
    {
      id:'ch_fragile_rush',
      name:'Challenge 5: Fragile Rush',
      desc:'開始資金が1に固定され、さらに全体生産が25%になる。序盤設計力が試される。',
      goalTotalGold: 360000,
      effects:{ globalMult:0.25, forceStartGold:1 },
      reward:{ type:'globalMult', mult:1.16, text:'恒久: 全体 ×1.16' }
    },
    {
      id:'ch_ascetic_engine',
      name:'Challenge 6: Ascetic Engine',
      desc:'アップグレード購入不可 + コスト1.45倍。基礎運用だけで突破を目指す。',
      goalTotalGold: 460000,
      effects:{ disableUpgrades:true, costMult:1.45 },
      reward:{ type:'flatGPS', gps:2600, text:'恒久: +2600 GPS' }
    },
    {
      id:'ch_quantum_lock',
      name:'Challenge 7: Quantum Lock',
      desc:'単一路線かつコスト1.8倍、さらに全体生産45%。高難度の最終試練。',
      goalTotalGold: 620000,
      effects:{ singleUnitOnly:true, costMult:1.8, globalMult:0.45 },
      reward:{ type:'prestigeEffectAdd', add:0.08, text:'恒久: Prestige効果 +0.08' }
    },
    {
      id:'ch_event_horizon',
      name:'Challenge 8: Event Horizon',
      desc:'全体生産18%・コスト2.6倍・開始資金1固定の極限周回。',
      goalTotalGold: 2200000,
      effects:{ globalMult:0.18, costMult:2.6, forceStartGold:1 },
      reward:{ type:'globalMult', mult:1.45, text:'恒久: 全体 ×1.45' }
    }
  ];

  // --- ACHIEVEMENTS ---
  // 実績はここに定義する（追加はここに書くだけでOK）
  // bonus.type: globalMult/flatGPS/startGold/unitMult/prestigeEffectAdd/costMult
  C.ACHIEVEMENTS = [
    { id:'ach_first_buy', name:'初めての購入', desc:'ユニットを1台購入する', type:'unitBought', target:1, bonus:{type:'startGold', amount:10} },
    { id:'ach_own_10_units', name:'コレクター I', desc:'合計ユニット所持数が10', type:'unitBought', target:10, bonus:{type:'unitMult', unitId:'junior', mult:1.2} },
    { id:'ach_own_100_units', name:'コレクター II', desc:'合計ユニット所持数が100', type:'unitBought', target:100, bonus:{type:'globalMult', mult:1.15} },
    { id:'ach_total_1k', name:'小さな金持ち', desc:'累計ゴールド獲得 1,000', type:'totalGold', target:1000, bonus:{type:'flatGPS', gps:5} },
    { id:'ach_total_10k', name:'金貨の友', desc:'累計ゴールド獲得 10,000', type:'totalGold', target:10000, bonus:{type:'globalMult', mult:1.10} },
    { id:'ach_gps_10', name:'小さな配当', desc:'生産量(GPS)が10以上', type:'gps', target:10, bonus:{type:'flatGPS', gps:10} },
    { id:'ach_prestige_once', name:'一度の栄光', desc:'一度プレステージを実行', type:'prestige', target:1, bonus:{type:'prestigeEffectAdd', add:0.01} },
    { id:'ach_ascend_once', name:'超越の一歩', desc:'一度 Ascend を実行', type:'ascend', target:1, bonus:{type:'globalMult', mult:1.25} },
    { id:'ach_buy_legacy_1', name:'初レガシー', desc:'任意のレガシーを1レベル購入', type:'legacyBought', target:1, bonus:{type:'startGold', amount:50} },
    // 特殊：難しい条件、強力なボーナス
    { id:'ach_legendary_collector', name:'伝説の収集家', desc:'全てのユニットを合計500以上所持', type:'unitBought', target:500, bonus:{type:'globalMult', mult:1.5} },
    { id:'ach_asc_shop_master', name:'超越の商人王', desc:'Ascension Shop を全て最大まで購入する', type:'ascShopAllBought', target:1, bonus:{type:'globalMult', mult:1.3} },
    { id:'ach_minigame_debut', name:'星脈への挑戦', desc:'Ascensionミニゲームに1回挑戦する', type:'miniGamePlay', target:1, bonus:{type:'flatGPS', gps:300} },
    { id:'ach_minigame_highscore', name:'同調の達人', desc:'ミニゲームでスコア200以上を達成する', type:'miniGameScore', target:200, bonus:{type:'globalMult', mult:1.2} },
    { id:'ach_minigame_perfect', name:'完全同期', desc:'ミニゲームでミス0かつ高得点の完全勝利を達成する', type:'miniGamePerfect', target:1, bonus:{type:'startGold', amount:5000} },
    { id:'ach_speed_ascender', name:'時空を裂く者', desc:'5分以内の周回で Ascend を実行する', type:'ascRunDurationMax', target:300, bonus:{type:'globalMult', mult:1.35} },
    { id:'ach_pure_reset', name:'純粋理論', desc:'アップグレード未購入で Ascend を実行する', type:'ascNoUpgrade', target:1, bonus:{type:'costMult', mult:0.92} },
    { id:'ach_monounit_path', name:'単一路線', desc:'1種類のユニットのみで Ascend を実行する', type:'ascSingleUnitType', target:1, bonus:{type:'flatGPS', gps:900} },
    { id:'ach_challenge_clear', name:'試練の突破者', desc:'Challengeを1つクリアする', type:'challengeClearCount', target:1, bonus:{type:'globalMult', mult:1.12} },
    { id:'ach_challenge_trinity', name:'三重試練の覇者', desc:'全Challenge(3種)をクリアする', type:'challengeClearCount', target:3, bonus:{type:'prestigeEffectAdd', add:0.03} },
    { id:'ach_layer_hunter', name:'層位探査者', desc:'Prestige層を3段階以上解放する', type:'prestigeLayerCount', target:3, bonus:{type:'startGold', amount:3000} },
    { id:'ach_risk_runner', name:'リスクランナー', desc:'Challenge中に Ascend を実行する', type:'ascendInChallenge', target:1, bonus:{type:'flatGPS', gps:1200} },
    { id:'ach_celestial_step', name:'星階の踏破者', desc:'Celestial層を2段階以上解放する', type:'celestialLayerCount', target:2, bonus:{type:'globalMult', mult:1.22} },
    { id:'ach_challenge_quadra', name:'四重試練の覇者', desc:'全Challenge(4種)をクリアする', type:'challengeClearCount', target:4, bonus:{type:'prestigeEffectAdd', add:0.04} },
    { id:'ach_celestial_apprentice', name:'星工学の見習い', desc:'Celestialアップグレードを2回購入する', type:'celestialUpgradeCount', target:2, bonus:{type:'globalMult', mult:1.18} },
    { id:'ach_celestial_architect', name:'星界設計者', desc:'Celestialアップグレードを8回購入する', type:'celestialUpgradeCount', target:8, bonus:{type:'costMult', mult:0.88} },
    { id:'ach_challenge_hepta', name:'七重試練の制覇者', desc:'全Challenge(7種)をクリアする', type:'challengeClearCount', target:7, bonus:{type:'prestigeEffectAdd', add:0.1} },
    { id:'ach_ascension_galaxy', name:'銀河渡り', desc:'累計Ascension AP 180到達', type:'ascend', target:180, bonus:{type:'flatGPS', gps:6000} },
    { id:'ach_layer_master', name:'層の監督者', desc:'Prestige層5段階 + Celestial層4段階を解放', type:'dualLayerCount', target:{ prestige:5, celestial:4 }, bonus:{type:'globalMult', mult:1.35} },
    { id:'ach_event_horizon', name:'地平線踏破', desc:'Challenge 8 をクリアする', type:'challengeClearCount', target:8, bonus:{type:'globalMult', mult:1.5} },
    { id:'ach_abyss_ready', name:'深淵の入口', desc:'累計ゴールド 1.0e300 到達', type:'totalGold', target:1.0e300, bonus:{type:'flatGPS', gps:8.0e7} },
    { id:'ach_abyss_reset', name:'深淵の観測者', desc:'Abyssリセットを1回実行', type:'abyssReset', target:1, bonus:{type:'globalMult', mult:1.8} }
  ];

  window.CONFIG = C;
})();
