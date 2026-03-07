// config.js — 定数・データ定義 (実績を含む)
(function(){
  window.CONFIG = {};

  const C = {
    SAVE_KEY: 'inc.split.full.v3',
    UI_UPDATE_INTERVAL_MS: 50,
    AUTO_SAVE_INTERVAL: 5000,
    MAX_OFFLINE_SECONDS: 60*60*24,
    PRESTIGE_BASE_DIV: 2000,
    BASE_PRESTIGE_EFFECT_PER_POINT: 0.05,
    STARTING_GOLD: 50,
    ASC_BASE_DIV: 25
  };

  C.UNIT_DEFS = [
    { id:'junior', name:'ジュニア採掘機', baseCost:5,   costMult:1.12, baseGPS:0.25, desc:'生産:0.25×所持数' },
    { id:'miner',  name:'採掘機',       baseCost:20,  costMult:1.15, baseGPS:1.2,  desc:'生産:1.2×所持数' },
    { id:'excav',  name:'エクスカベーター', baseCost:500, costMult:1.18, baseGPS:40,   desc:'生産:40×所持数' }
  ];

  C.UPGRADE_DEFS = [
    { id:'u_miner_eff', name:'採掘効率向上', desc:'採掘機: Lvごとに×1.15', baseCost:30,  costMult:1.9,  type:'unitMult',  payload:{unitId:'miner', multPerLevel:0.15}, maxLevel:null },
    { id:'u_global_boost', name:'運営改善', desc:'全体: Lvごとに×1.08', baseCost:120, costMult:2.5,  type:'globalMult', payload:{multPerLevel:0.08},  maxLevel:null }
  ];

  C.LEGACY_DEFS = [
    { id:'lg_global10', name:'永続研究所', desc:'全体 ×1.10 /Lv', baseCost:1,  costMult:2.0, maxLevel:5, x:150,  y:80,  type:'globalMult', payload:{multPerLevel:0.10}, prereq:[] },
    { id:'lg_miner25', name:'鉱夫育成',    desc:'採掘機 ×1.25 /Lv', baseCost:2,  costMult:2.2, maxLevel:4, x:320,  y:170, type:'unitMult', payload:{unitId:'miner', multPerLevel:0.25}, prereq:[{id:'lg_global10',minLevel:1}] },
    { id:'lg_miner_x2', name:'機械化支援', desc:'採掘機 ×1.5 /Lv',  baseCost:4,  costMult:2.4, maxLevel:3, x:480,  y:170, type:'unitMult', payload:{unitId:'miner', multPerLevel:0.5}, prereq:[{id:'lg_miner25',minLevel:2}] },
    { id:'lg_cost5', name:'経済学習',       desc:'コスト ×0.95 /Lv', baseCost:2,  costMult:1.9, maxLevel:4, x:320,  y:320, type:'costMult', payload:{multPerLevel:0.95}, prereq:[{id:'lg_global10',minLevel:1}]},
    { id:'lg_seed50', name:'種銭支給',     desc:'開始ゴールド +50 /Lv', baseCost:2, costMult:1.8, maxLevel:3, x:150, y:320, type:'startGold', payload:{amountPerLevel:50}, prereq:[]},
    { id:'lg_passive', name:'永続配当',    desc:'恒久 +1 GPS /Lv', baseCost:8, costMult:2.5, maxLevel:3, x:920,  y:120, type:'flatGPS', payload:{gpsPerLevel:1}, prereq:[{id:'lg_global10',minLevel:2}]},
    { id:'lg_mega', name:'遺産の賢王',     desc:'全体 ×1.5 (Lv1)', baseCost:20, costMult:1.0, maxLevel:1, x:920,  y:400, type:'globalMult', payload:{multPerLevel:0.5}, prereq:[{id:'lg_passive',minLevel:1}]},

    { id:'lg_titan_forge', name:'タイタン鍛造所', desc:'全体 ×2.5 /Lv', baseCost:60,  costMult:3.2, maxLevel:2, x:1140, y:60,  type:'globalMult', payload:{multPerLevel:1.5}, prereq:[{id:'lg_mega',minLevel:1}] },
    { id:'lg_quantum_matrix', name:'量子マトリクス', desc:'採掘機 ×5.00 /Lv', baseCost:200, costMult:4.0, maxLevel:2, x:1360, y:160, type:'unitMult', payload:{unitId:'miner', multPerLevel:4.0}, prereq:[{id:'lg_titan_forge',minLevel:1}] },
    { id:'lg_excav_boost', name:'メガ掘削支援', desc:'エクスカベーター ×10.0 /Lv', baseCost:500, costMult:3.8, maxLevel:2, x:1360, y:260, type:'unitMult', payload:{unitId:'excav', multPerLevel:9.0}, prereq:[{id:'lg_quantum_matrix',minLevel:1}] },
    { id:'lg_econ_mastery', name:'経済の覇者', desc:'コスト ×0.5 /Lv', baseCost:400, costMult:3.5, maxLevel:2, x:1580, y:80, type:'costMult', payload:{multPerLevel:0.5}, prereq:[{id:'lg_titan_forge',minLevel:1}] },
    { id:'lg_ark_dividend', name:'方舟の配当', desc:'恒久 +50 GPS /Lv', baseCost:800, costMult:2.8, maxLevel:2, x:1580, y:320, type:'flatGPS', payload:{gpsPerLevel:50}, prereq:[{id:'lg_passive',minLevel:1}] },
    { id:'lg_singularity', name:'特異点生成器', desc:'全体 ×10.0 (Lv1)', baseCost:2500, costMult:6.0, maxLevel:1, x:1820, y:160, type:'globalMult', payload:{multPerLevel:9.0}, prereq:[{id:'lg_ark_dividend',minLevel:1}] },
    { id:'lg_seed_mega', name:'種銭の源泉', desc:'開始ゴールド +1000 /Lv', baseCost:5000, costMult:8.0, maxLevel:1, x:2040, y:240, type:'startGold', payload:{amountPerLevel:1000}, prereq:[{id:'lg_singularity',minLevel:1}] },
    { id:'lg_universal_amplifier', name:'万能増幅器', desc:'全ユニット ×3.0 /Lv', baseCost:8000, costMult:10.0, maxLevel:1, x:2040, y:80, type:'globalMult', payload:{multPerLevel:2.0}, prereq:[{id:'lg_singularity',minLevel:1}] }
  ];

  C.ASC_UPGRADES = [
    { id:'asc_global20', name:'永遠の研究', desc:'恒久: 全体 ×1.20', cost:1, type:'globalMult', payload:{mult:1.20}, maxLevel:3 },
    { id:'asc_flat50',   name:'黄金の配当', desc:'恒久: +50 GPS', cost:2, type:'flatGPS', payload:{gps:50}, maxLevel:1 },
    { id:'asc_prestige_boost', name:'超越の加護', desc:'恒久: +0.02 prestige effect /Lv', cost:3, type:'prestigeEffectAdd', payload:{add:0.02}, maxLevel:2 },
    { id:'asc_galactic_mult', name:'銀河の恩寵', desc:'恒久: 全体 ×3.0', cost:4, type:'globalMult', payload:{mult:3.0}, maxLevel:1 },
    { id:'asc_colossus_gps',  name:'巨像の配当', desc:'恒久: +500 GPS', cost:6, type:'flatGPS', payload:{gps:500}, maxLevel:1 },
    { id:'asc_prestige_super', name:'超越の祝福', desc:'恒久: +0.10 prestige effect', cost:4, type:'prestigeEffectAdd', payload:{add:0.10}, maxLevel:1 },
    { id:'asc_cosmic_multiplier', name:'天の倍加', desc:'恒久: 全体 ×10.0', cost:12, type:'globalMult', payload:{mult:10.0}, maxLevel:1 },
    { id:'asc_mythic_gps', name:'神話の配当', desc:'恒久: +2500 GPS', cost:15, type:'flatGPS', payload:{gps:2500}, maxLevel:1 }
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
    { id:'ach_legendary_collector', name:'伝説の収集家', desc:'全てのユニットを合計500以上所持', type:'unitBought', target:500, bonus:{type:'globalMult', mult:1.5} }
  ];

  window.CONFIG = C;
})();