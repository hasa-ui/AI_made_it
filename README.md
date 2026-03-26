# AI_made_it
ブラウザで遊ぶ多層インクリメンタルゲームです。

ゴールドを稼ぎ、ユニットとアップグレードを購入して生産量を伸ばし、Prestige / Ascension / Celestial / Abyss の各リセット層を進めながら恒久強化を積み上げていきます。Challenge、実績、統計、セーブ管理も搭載しています。

現行版では Celestial ルート選択や Abyss 強化によって、中盤以降にビルド分岐と高難度向けの伸ばし方を選べる構成になっています。

## 実装マップ

- `game/config.js`
  - 定数・ゲームデータ定義
- `game/state.defaults.js`
  - 既定 state と JSON 変換 helper
- `game/state.migration.js`
  - save version 互換と既定 shape 補完
- `game/state.storage.js`
  - `localStorage` IO
- `game/state.js`
  - `window.StateManager` facade
- `game/engine.runtime.js`
  - engine 共通 runtime / helper wrapper / internal state
- `game/engine.economy.js`
  - aggregate、GPS、価格、UI 用 economy snapshot
- `game/engine.progression.js`
  - gain preview、offline gain、Abyss roadmap / breakdown
- `game/engine.shop.js`
  - 購入処理
- `game/engine.reset.js`
  - Prestige / Ascend / Abyss reset
- `game/engine.app.js`
  - `window.ENGINE` facade と Challenge action 接続
- `game/ui.app.js`
  - 描画ロジック本体
- `game/ui.bootstrap.js`
  - DOMContentLoaded と UI 起動窓口

## 読み込み順

`config -> state.defaults -> state.migration -> state.storage -> state facade -> engine helpers/challenge -> engine runtime/modules -> engine facade -> ui helpers/minigame -> ui app -> ui bootstrap`

この順序を前提に、外部へ公開しているグローバル名は `window.CONFIG` / `window.StateManager` / `window.ENGINE` を維持しています。
