# TODO

## Plan
- [x] 既存のバランス・Ascension・ショップ・購入処理の構造確認
- [x] 種銭系 / +GPS系 / ジュニア採掘機・採掘機強化 / 序盤エクスカベーター弱体化
- [x] Ascend時の累計ゴールド・レガシーツリーのリセット導入
- [x] Ascensionショップ拡充（維持解放・開始資金強化・追加GPS強化）
- [x] Ascensionの新機能拡充（自動購入の解放トリガーを追加）
- [x] 自動購入機能（UI設定 + 実行ループ）
- [x] 検証ログ記録

## Plan (2026-03-07 バージョン管理機能追加)
- [x] セーブ/ロード/インポートの現状確認
- [x] セーブデータのバージョン情報定数化とマイグレーション導入
- [x] 設定UIにバージョン情報表示を追加
- [x] インポート時のバージョン検証を追加
- [x] 検証ログ記録

## Progress Log
- config.js: ユニット序盤バランスを調整（ジュニア/採掘機強化、エクスカベーター序盤弱体化）。
- config.js: 種銭系・GPS系の恒久強化を拡張し、Ascensionショップへ特殊解放を追加。
- engine.js: Ascend時に累計ゴールド/レガシーツリーをリセット、Ascensionショップ購入で維持可能に実装。
- ui.js / index.html: 自動購入機能を追加し、Ascensionショップ購入で解放される設計に実装。
- state.js: 自動購入設定の保存項目を追加。

## Progress Log (2026-03-07 バージョン管理機能追加)
- 着手: state.js / ui.js / index.html / config.js のセーブデータ取り扱い箇所を確認。
- config.js: SAVE_VERSION / APP_VERSION を追加し、バージョン定義を一元化。
- state.js: migrateState/importState/saveVersion を追加し、future version のインポート拒否と保存時 version 強制更新を実装。
- ui.js: 設定画面に App/Save Schema/Current Save version を表示し、インポート処理を StateManager.importState 経由へ統一。

## Verify Log
- `node --check game/config.js && node --check game/state.js && node --check game/engine.js && node --check game/ui.js` : 成功
- スクリーンショット取得を browser tool + Playwright で試行したが、`run_playwright_script` がタイムアウトし取得不可
- `node --check game/config.js && node --check game/state.js && node --check game/ui.js && node --check game/engine.js` : 成功
- `python -m http.server 4173 --directory /workspace/AI_made_it` + Playwright(設定タブ遷移) : 成功（スクリーンショット取得）

## Plan (2026-03-07 確認ダイアログ/トースト修正)
- [x] 設定UIとセーブマイグレーションのデフォルト値の不整合を調査
- [x] 確認ダイアログのデフォルトチェックがONになるよう状態初期化を修正
- [x] トースト通知設定の不足キーで表示抑止される問題を修正
- [x] 検証ログ記録

## Progress Log (2026-03-07 確認ダイアログ/トースト修正)
- state.js: defaultState.settings に confirmLegacyBuy / confirmLegacyBuyMax / toast 全キー / notationThreshold を追加。
- state.js: migrateState で settings と settings.toast をデフォルトとマージし、古いセーブでも不足キーを補完するよう修正。
- ui.js: buildSettingsUI で st.settings と st.settings.toast を毎回デフォルトマージし、既存セーブでもチェック状態と通知設定の整合性を確保。

## Verify Log (2026-03-07 確認ダイアログ/トースト修正)
- `node --check game/state.js && node --check game/ui.js && node --check game/engine.js && node --check game/config.js` : 成功
- `python -m http.server 4173 --directory /workspace/AI_made_it` + Playwright: 設定タブの確認チェック2項目がデフォルトONであること、および購入時トースト表示を確認（スクリーンショット取得）

## Plan (2026-03-07 レガシーツリー拡大縮小 / Ascensionコスト調整)
- [x] レガシーツリー描画周辺の構造確認と拡大縮小UIの設計
- [x] レガシーツリーのズーム操作（拡大・縮小・リセット）を実装
- [x] Ascensionショップ価格を全体的に大幅増額し、下位項目ほど高コスト化
- [x] 検証ログ記録

## Progress Log (2026-03-07 レガシーツリー拡大縮小 / Ascensionコスト調整)
- 着手: index.html / game/styles.css / game/ui.js / game/config.js を確認。
- index.html / game/styles.css: レガシーツリーにズーム操作ボタン（+ / - / 100%）とヘッダー用レイアウトを追加。
- game/ui.js: legacy zoom 倍率状態を追加し、拡大・縮小・リセットで `legacySvg` 幅率を変更する処理を実装。
- game/config.js: Ascensionショップコストを全体的に大幅引き上げ、配列下部の強化ほど高コストになるよう再配分。APP_VERSION を Ver.1.9.0 に更新。

## Verify Log (2026-03-07 レガシーツリー拡大縮小 / Ascensionコスト調整)
- `node --check game/config.js && node --check game/ui.js && node --check game/state.js && node --check game/engine.js` : 成功
- `python -m http.server 4173 --directory /workspace/AI_made_it` + Playwright: レガシータブでズームボタン押下後の表示を確認し、スクリーンショット取得

## Plan (2026-03-07 Inspectorプレビュー削除 / Ascensionミニゲーム / 実績追加)
- [x] 既存のInspector・Ascensionショップ・実績判定の構造確認
- [x] InspectorプレビューUI/処理の削除
- [x] Ascensionショップ全購入後に解放されるミニゲーム追加
- [x] 特殊条件を含む実績追加と判定ロジック拡張
- [x] 検証ログ記録

## Progress Log (2026-03-07 Inspectorプレビュー削除 / Ascensionミニゲーム / 実績追加)
- 着手: index.html / game/ui.js / game/state.js / game/config.js / game/styles.css を確認。

## Verify Log (2026-03-07 Inspectorプレビュー削除 / Ascensionミニゲーム / 実績追加)
- 着手前
- index.html: Inspector の累積プレビュー入力/ボタン/結果表示を削除し、関連ヒント・ヘルプ文言を更新。
- index.html / game/ui.js: Ascension Shop 全購入後に表示されるミニゲーム UI（星脈同調）を追加。
- game/ui.js: ミニゲーム実行ロジック（AP消費開始、ラウンド進行、スコア/ミス集計、報酬AP付与）と状態表示更新を実装。
- game/state.js: ミニゲーム統計（plays/bestScore/lastScore/lastMisses/perfectRuns）を保存・マイグレーション対象に追加。
- game/config.js: SAVE_VERSION を 9、APP_VERSION を Ver.1.10.0 へ更新し、ミニゲーム/全購入連動の実績を追加。

- `node --check game/config.js && node --check game/state.js && node --check game/engine.js && node --check game/ui.js && node --check index.html` : 失敗（Nodeの仕様上HTMLは --check 対象外）
- `node --check game/config.js && node --check game/state.js && node --check game/engine.js && node --check game/ui.js` : 成功
- `python -m http.server 4173 --bind 0.0.0.0 --directory /workspace/AI_made_it` + Playwright: Ascensionタブでミニゲーム表示を確認しスクリーンショット取得（artifact: artifacts/ascension_minigame.png）

## Plan (2026-03-08 アップデート履歴追加 / レガシー見積更新修正)
- [x] 既存UIと見積表示更新フローを確認
- [x] 過去アップデート情報を確認できる表示を追加
- [x] レガシー見積が購入操作なしでも更新されるよう修正
- [x] バージョン表記を更新
- [x] 検証ログ記録

## Progress Log (2026-03-08 アップデート履歴追加 / レガシー見積更新修正)
- 着手: index.html / game/ui.js / game/config.js を確認。
- game/ui.js: mainLoopの定期UI更新に `prestigeGainPreview` / `startingGoldPreview` / `ascGainPreview` の再計算反映を追加し、購入操作なしでも見積が更新されるよう修正。
- index.html: ヘルプ内に「アップデート履歴」セクションを追加し、Ver.1.11.0 / 1.10.0 / 1.9.0 の履歴を記録。
- game/config.js: APP_VERSION を `Ver.1.11.0` に更新。
- Planチェック更新: 全項目完了。

## Verify Log (2026-03-08 アップデート履歴追加 / レガシー見積更新修正)
- `node --check game/config.js && node --check game/ui.js && node --check game/engine.js && node --check game/state.js` : 成功
- `python -m http.server 4173 --bind 0.0.0.0 --directory /workspace/AI_made_it` + Playwright: ヘルプタブのアップデート履歴表示を確認しスクリーンショット取得（artifact: artifacts/help_update_history.png）

## Plan (2026-03-08 アップデート情報タブ化 / アルファ版表記追記)
- [x] 既存のタブ構造とアップデート履歴表示位置を確認
- [x] ヘルプからアップデート履歴を分離し専用タブを追加
- [x] ゲームがアルファ版である旨をUIに追記
- [x] バージョン表記を更新
- [x] 検証ログ記録

## Progress Log (2026-03-08 アップデート情報タブ化 / アルファ版表記追記)
- 着手: index.html / game/config.js / game/ui.js を確認。
- index.html: ナビゲーションに「アップデート情報」タブを追加し、ヘルプから履歴を分離して専用ペイン `tab-updates` を追加。
- index.html: ヘッダー説明文とアップデート情報タブ内に「アルファ版」表記を追記。
- game/config.js: APP_VERSION を `Ver.1.11.1` に更新。

## Verify Log (2026-03-08 アップデート情報タブ化 / アルファ版表記追記)
- `node --check game/config.js && node --check game/ui.js && node --check game/engine.js && node --check game/state.js` : 成功
- `python -m http.server 4173 --bind 0.0.0.0` + Playwright: 「アップデート情報」タブの表示とアルファ版表記を確認し、スクリーンショット取得（artifact: artifacts/updates_tab_alpha.png）

## Plan (2026-03-08 Ascension開始ゴールド計算バグ修正)
- [x] 重要ロジック（Ascension/恒久効果計算）を調査して再現可能な不具合を特定
- [x] Ascension時の開始ゴールド計算順序を最小差分で修正
- [x] バージョン表記とアップデート情報を更新
- [x] 検証ログ記録

## Progress Log (2026-03-08 Ascension開始ゴールド計算バグ修正)
- 着手: game/engine.js の Ascension処理を確認し、`doAscendInternal` がレガシーツリーのリセット前に開始ゴールドを計算していることを確認。
- game/engine.js: Ascension処理でリセット反映後に `invalidateAggCache()` を行い、開始ゴールドを再計算する順序へ修正。
- game/config.js: APP_VERSION を `Ver.1.11.2` に更新。
- index.html: アップデート情報に Ver.1.11.2 の修正内容を追記。

## Verify Log (2026-03-08 Ascension開始ゴールド計算バグ修正)
- `node --check game/config.js && node --check game/state.js && node --check game/engine.js && node --check game/ui.js` : 成功
- `node --check game/config.js && node --check game/state.js && node --check game/engine.js && node --check game/ui.js` : 成功
- `python -m http.server 4173 --bind 0.0.0.0 --directory /workspace/AI_made_it` + Playwright: アップデート情報タブの Ver.1.11.2 表示を確認しスクリーンショット取得（artifact: artifacts/ver_1_11_2_updates.png）

## Plan (2026-03-08 Ascension後半調整 / 自動購入拡張 / 統計タブ)
- [x] Ascension増加式とAscension Shop後半価格の再調整
- [x] 自動購入の50ms対応と単体/全購入モード切替の実装
- [x] Ascensionミニゲームの複雑化（4レーン・反転ルール・時間短縮）
- [x] レガシーSVGズームのモバイル挙動を緩和
- [x] 周回統計タブ（周回回数・到達Gold・所要時間）追加
- [x] 特殊実績（速度/縛り系）の追加
- [x] バージョン表記とアップデート情報の更新
- [x] 検証ログ記録

## Progress Log (2026-03-08 Ascension後半調整 / 自動購入拡張 / 統計タブ)
- config.js: Ascension後半の獲得抑制用ソフトキャップ定数を追加し、後半ショップ価格を大幅増額。APP_VERSION を Ver.1.12.0 へ更新。
- state.js: autoBuy 設定を intervalMs/purchaseMode へ拡張し、旧 intervalSec からの移行を追加。runStats/lastAscensionRun の保存構造を追加。
- engine.js: Ascension gain を後半ソフトキャップ式へ変更。Ascend実行時に周回統計（到達Gold/所要時間/獲得AP）を履歴化する処理を実装。
- ui.js/index.html: 自動購入UIに購入方式セレクトを追加し、50ms間隔で動作するよう変更。統計タブ表示を追加。
- ui.js/index.html: ミニゲームを4レーン化し、反転ルール・ラウンド時間短縮・報酬調整を追加。
- ui.js/game/styles.css: モバイル時のレガシーSVGズームを transform ベースにして拡大時の体感を緩和。
- config.js/ui.js: Antimatter Dimensions風の縛り系実績（高速周回・無アップグレード・単一路線）を追加。

## Verify Log (2026-03-08 Ascension後半調整 / 自動購入拡張 / 統計タブ)
- `node --check game/config.js && node --check game/state.js && node --check game/engine.js && node --check game/ui.js` : 成功
- `python -m http.server 4173 --directory /workspace/AI_made_it` + Playwright: Ascensionタブ/統計タブを表示してスクリーンショット取得（成功）

## Plan (2026-03-08 自動購入間隔取りこぼし修正)
- [x] 重要ロジック（自動購入ループ）を確認し、不具合条件を特定
- [x] 最小差分で自動購入の蓄積時間処理を修正
- [x] バージョン表記とアップデート情報を更新
- [x] 検証ログ記録

## Progress Log (2026-03-08 自動購入間隔取りこぼし修正)
- 着手: game/ui.js の `runAutoBuy` を確認し、`dt` が大きいフレームで `autoBuyAccumulator` を 0 にリセットしていたため、複数回分の購入処理が失われることを確認。
- game/ui.js: `runAutoBuy` を `while (accumulator >= interval)` 方式へ変更し、未処理時間を消費しながら複数サイクル実行できるよう修正（安全のため1フレーム上限20サイクルを設定）。
- game/config.js: APP_VERSION を `Ver.1.12.1` に更新。
- index.html: アップデート情報に Ver.1.12.1 の修正内容を追記。

## Verify Log (2026-03-08 自動購入間隔取りこぼし修正)
- `node --check game/config.js && node --check game/state.js && node --check game/engine.js && node --check game/ui.js` : 成功
