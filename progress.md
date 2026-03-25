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

## 2026-03-24 persistent autobuy ownership review fix
- 調査: `ab_auto_archive` は `hasAscSpecial('unlockAutobuy')` だけを true にしており、Ascension Shop の owned 判定・購入処理・full purchase 判定は `ascOwned.asc_unlock_autobuy` を直接見ているため不整合があることを確認。
- 実装: `game/ui.helpers.js` に Ascension upgrade の実効 ownership helper を追加し、永続 unlock を special Ascension upgrade の所持として扱うよう統一。
- 実装: `game/ui.app.js` の Ascension Shop 表示とボタン状態を実効 ownership ベースへ変更し、`自律運用OS` が冗長購入候補として残らないよう修正。
- 実装: `game/engine.app.js` の購入処理でも同じ実効 ownership を反映し、`ab_auto_archive` 所持後は `asc_unlock_autobuy` を購入できず AP も消費しないよう修正。
- 検証: `node --check` と vm テストで、永続 autobuy 解放が full-shop 判定を満たし、`buyAscensionUpgradeInternal('asc_unlock_autobuy')` が `reason:'max'` で拒否されることを確認。

## 2026-03-24 challenge immediate-clear reflection fix
- 調査: Challenge クリア自体は engine 側で即時記録されるが、自動クリア経路と `達成判定` ボタン経路で後処理の順序が揃っておらず、開始直後の短時間クリアで UI 反映が後続処理に依存していることを確認。
- 実装: `game/ui.app.js` に `finalizeChallengeCompletion()` を追加し、Challenge クリア後の `saveState`・`syncUIAfterChange`・achievement 判定・解放 toast を共通化。
- 実装: main loop の自動クリアと手動 `達成判定` の両方を同 helper 経由へ変更し、クリア状態の UI 反映を最優先で確定させるよう修正。
- 検証: `node --check game/ui.app.js` と小さな Node harness で、共通 helper の呼び出し順と両経路からの接続を確認。

## 2026-03-24 ロードマップ Phase 2 完了
- 実装: `Ver.1.29.0` として Celestial Phase 2 を実装。Nova / Vault / Mirror / Epoch それぞれへ専用アップグレードを2種ずつ追加し、4ルートの中後半ビルド差を拡張。
- 実装: Celestial ルート定義に推奨スタイル / ガイド / 到達目標を追加し、Celestial 画面で現在有効な専用効果と、購入済みだが待機中の専用強化を見える化。
- 実装: ルート別 Celestial 投資実績を4件追加し、分岐ごとの攻略目標を実績報酬としても提示。
- 文書: `ロードマップ.md` の Phase 2 を完了済みに更新し、`仕様書.md` の Celestial / 実績 / 現行課題を現仕様へ反映。ヘルプ・アップデート情報・更新モーダルも `Ver.1.29.0` 内容へ更新。
- 検証: `node --check`、旧セーブ import の Celestial upgrade 補完確認、`activeBranchId` 切替で Nova 専用倍率と Mirror 専用開始ゴールドの有効状態が入れ替わる vm テストを実行して成功。

## 2026-03-24 Phase 2 review fixes
- 修正: `game/ui.app.js` の Celestial 効果状態判定を「branch 一致」ではなく「実際にその効果が有効か」で見るよう変更。未購入 shared upgrade は `未購入`、`星界チューニング規格` は Mirror 外でも `購入済み・常時有効` と表示するよう補正。
- 修正: Celestial ルートカードの保存済み専用強化表示も同じ判定へ揃え、`現在も有効` と `切替で有効` を分離。
- 修正: 起動直後とテキスト/ファイル import 直後に `checkAchievementsAfterAction()` を実行し、ルート別 Celestial 実績が既存セーブでも即時バックフィルされるよう変更。
- 検証: `node --check game/ui.app.js` と helper 抽出 harness で、状態ラベルの具体例 (`cel_prism` / `cel_asc_expand`) と startup/import 後の achievement 再評価フックを確認。

## 2026-03-24 Celestial unpurchased active-branch label fix
- 修正: `game/ui.app.js` の `getCelestialUpgradeState()` で、選択中ルートに属する未購入 Celestial upgrade は `選択中` / `inactive:false` を返すよう補正。
- 修正: route-switch ヒント (`〜を選択で有効`) は、実際に別ルートを選んでいる場合だけ出すよう限定。
- 検証: `node --check game/ui.app.js` と helper 抽出 harness で、Mirror 選択中の未購入 `cel_harmonic_seed` が `選択中` になり、Mirror 非選択時だけ switch hint が出ることを確認。
