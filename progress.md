Original prompt: ロードマップのPhase 1を完了させてください

## 2026-03-24 ロードマップ Phase 1 完了
- 調査: `ロードマップ.md` と `仕様書.md` を基準に、Phase 1 の未実装を Abyss gain / Abyss専用拡張 / 終盤導線 UI / 機能解放型 Challenge 報酬へ分解。
- 調査: `game/config.js` `game/state.js` `game/engine.helpers.js` `game/engine.app.js` `game/engine.challenge.js` `game/ui.app.js` `index.html` を確認。
- 方針: セーブ互換を保ちつつ、Abyss 到達後の「次に何を狙うか」を状態と UI で見える化し、Challenge 報酬の一部を解放型へ差し替える。

## 2026-03-24 Abyss review fixes
- 調査: reviewer 指摘どおり、Abyss gain が `challenge.completed` と `ascEarnedTotal` の揮発値を直接参照しており、Abyss reset 後の周回で shard gain が後退することを確認。
- 実装: `abyss.bestChallengeCompletions` と `abyss.bestCelestialLayerCount` を追加し、Abyss reset 前に milestone を snapshot して gain 計算へ反映するよう修正。
- 実装: 旧セーブ移行時も現行の Challenge/Celestial 進行から新フィールドを補完するよう `state.js` を更新。
- 実装: Abyss roadmap に Celestial 節目 objective を追加し、gain source と UI を一致させた。
- 検証: Node の vm テストで `5 -> 5` の shard gain 維持と `celestial` objective の出現を確認。Playwright クライアントはこの環境で `browser.newPage: Target page, context or browser has been closed` により実行不可。

## 2026-03-24 ロードマップ更新 / Abyss Challenge保持
- 文書: `ロードマップ.md` の Phase 1 を完了済みとして更新し、実施項目と完了条件に達成注記を追加。
- 文書: `仕様書.md` の Abyss reset 範囲を現仕様へ更新し、Abyss Challenge のクリア判定 / 最速秒が Abyss reset 後も保持されることを明記。
- 実装: `doAbyssResetInternal()` で Challenge 状態を丸ごと消すのをやめ、Abyss Challenge（category:`abyss`）の `completed` / `bestSec` のみ保持する helper を追加。
- 実装: Challenge クリア数の集計を `C.CHALLENGES` ベースへ統一し、未知キー混入セーブで実績や Abyss gain のカウントが膨らまないよう修正。
- 検証: Node の vm テストで「Abyss reset 後に abyss Challenge だけ残ること」と「未知キーが Challenge 数へ加算されないこと」を確認。Playwright は今回も `page.addInitScript: Target page, context or browser has been closed` で実行不可。

## 2026-03-24 設定網羅化 / Celestial上限修正 / Abyss自動化保持
- 実装: 設定タブの確認ダイアログ項目を全 confirm 対象へ拡張し、トースト設定に一般メッセージを追加。設定UIは import/reset 後も現在の state を読むよう同期処理を追加。
- 実装: `星界チューニング規格` の Ascension Shop 上限拡張が `maxLevel = 1` の一回きり項目へ効かないよう修正し、旧セーブの過剰購入分は `SAVE_VERSION = 16` で AP 返金付き補正を追加。
- 実装: Abyssアップグレード `自律継承アーカイブ` を追加し、Abyss reset 後も自動購入解放を保持できるよう `persistentUnlock` 判定と maxLevel 1 の Abyss upgrade 対応を実装。
- 文書: `Ver.1.28.0` としてアップデート情報タブ・初回モーダル・仕様書を更新。
- 検証: Node の vm テストで overcap refund・新設定キー補完・Abyss自動化保持を確認。Playwright は今回も `browser.newPage: Target page, context or browser has been closed` により実行不可。
