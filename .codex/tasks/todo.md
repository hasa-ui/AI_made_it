- [x] Record review plan and checklist in .codex/tasks/todo.md
- [x] Inspect commit 7e1ef87 diff and surrounding code
- [x] Validate suspected issues against code paths/tests
- [x] Produce prioritized review findings

## Progress log
- Diff inspected for engine/UI/helper changes in target commit.
- Ran syntax checks on modified JS files and a small vm harness for persistent-unlock ownership behavior.
- Validation summary: `node --check` passed for modified JS; vm harness confirmed persistent unlock is treated consistently across UI helper paths.
- Review conclusion: no actionable bugs identified in commit 7e1ef87 after diff/context inspection and targeted validation.

## Plan (2026-03-24 challenge immediate-clear reflection fix)
- [x] Challenge 開始直後クリアの反映経路を確認し、UI 反映が遅れる条件を特定する
- [x] 自動クリアと手動達成判定の後処理を統一し、クリア状態が即座に UI / セーブへ反映されるよう修正する
- [x] Node で構文確認と再現ケース検証を実行し、ログへ記録する

## Progress Log (2026-03-24 challenge immediate-clear reflection fix)
- 着手: `game/engine.challenge.js` `game/engine.app.js` `game/ui.app.js` を確認し、Challenge クリア自体は engine 側で即時記録される一方、自動クリア経路と手動達成判定経路で UI/achievement/toast の後処理順序が揃っていないことを確認。
- 方針: Challenge クリア後の保存・UI同期・achievement 判定・解放 toast を `game/ui.app.js` の共通 helper に集約し、少なくともクリア状態の UI 反映は最優先で完了するよう統一する。
- `game/ui.app.js`: `finalizeChallengeCompletion()` を追加し、`SM.saveState()` → `syncUIAfterChange()` → `checkAchievementsAfterAction()` → toast の順で後処理を固定。
- `game/ui.app.js`: main loop の自動 Challenge クリア経路と `達成判定` ボタン経路の両方を `finalizeChallengeCompletion()` 経由へ寄せ、開始直後の短時間クリアでも同じ反映手順を踏むよう修正。

## Verify Log (2026-03-24 challenge immediate-clear reflection fix)
- `node --check game/ui.app.js` : 成功
- `node - <<'NODE' ... NODE`（`ui.app.js` から `finalizeChallengeCompletion()` を抽出して stub 環境で実行し、`saveState` → `syncUIAfterChange` → `checkAchievementsAfterAction` → `achievement/purchase toast` の順で走ること、および main loop / 手動達成判定の両経路が同 helper を使うことを確認） : 成功

## Plan (2026-03-24 ロードマップ Phase 2 完了)
- [x] `ロードマップ.md` Phase 2 と Celestial 周辺の現仕様を確認し、未実装差分を整理する
- [x] Celestial 4ルートの専用強化・UI導線・ルート別目標/実績を追加し、攻略方針の差が見える状態まで実装する
- [x] バージョン表記 / アップデート情報 / 仕様書 / ロードマップを現実装へ更新する
- [x] Node ベースで構文確認と Celestial 分岐まわりの検証を実行し、ログへ記録する

## Progress Log (2026-03-24 ロードマップ Phase 2 完了)
- 着手: `ロードマップ.md` `仕様書.md` `game/config.js` `game/engine.helpers.js` `game/ui.app.js` `index.html` を確認し、Phase 2 の未達項目が「ルート専用強化不足」「有効/待機状態の可視化不足」「画面内ガイド不足」「ルート別目標/実績不足」に集約されることを確認。
- 方針: Celestial 4ルートへ専用アップグレードを追加し、ルート定義へプレイスタイル/ガイド/到達目標を持たせ、UI では「今効いているもの」と「買ってあるが待機中のもの」を明示する。
- `game/config.js`: `Ver.1.29.0` へ更新。Nova / Vault / Mirror / Epoch それぞれにプレイスタイル/到達目標 metadata を追加し、専用 Celestial アップグレードを各2種ずつ増設。あわせてルート別投資実績を4件追加。
- `game/engine.helpers.js`: `getCelestialBranchStatus()` から playstyle / guide / goal を UI へ渡すよう拡張。
- `game/ui.app.js`: Celestial 分岐用 helper を追加し、ルートカードに推奨スタイル・到達目標・保存済み専用強化を表示。Celestial アップグレード一覧には「常時有効 / 現在有効 / 購入済み・待機中」を表示し、ルート別実績判定も追加。
- `index.html`: ヘルプへ Celestial 4ルートの攻略指針を追加し、Celestial タブ説明とアップデート情報タブを `Ver.1.29.0` 内容へ更新。
- `仕様書.md` `ロードマップ.md`: Phase 2 完了に合わせて Celestial 分岐仕様・実績数・現行課題・今後方針を現実装へ更新。

## Verify Log (2026-03-24 ロードマップ Phase 2 完了)
- `node --check game/config.js && node --check game/engine.helpers.js && node --check game/state.js && node --check game/ui.app.js` : 成功
- `node - <<'NODE' ... NODE`（`config/helpers/state` を vm で読み込み、旧セーブ import で新規 Celestial upgrade キーが補完されること、`getCelestialBranchStatus()` が playstyle/goal を返すこと、ルート別実績が4件追加されていること、Celestial upgrade 総数が17件であることを確認） : 成功
- `node - <<'NODE' ... NODE`（`config/helpers/challenge/engine` を vm で読み込み、同じ購入済み Celestial upgrade 群でも `activeBranchId` を `nova` → `mirror` に切り替えると Nova専用倍率が外れ、Mirror専用開始ゴールドが有効になることを確認） : 成功

## Plan (2026-03-24 review commit 87f7f73)
- [x] 対象コミットの差分と変更文脈を確認する
- [x] Celestial 分岐/UI/実績の変更点をコードパスで検証する
- [x] 指摘価値のある不具合だけを優先度付きで整理する

## Progress Log (2026-03-24 review commit 87f7f73)
- `git show 87f7f739d86a878e3e5355dce31996509be47632` で `game/config.js` `game/engine.helpers.js` `game/ui.app.js` `index.html` の差分を確認。
- Celestial UI の状態表示 helper、追加されたルート別実績、既存 save/import 初期化経路を追跡し、既存ロジックとの整合性を確認。

## Verify Log (2026-03-24 review commit 87f7f73)
- `node - <<'NODE' ... NODE`（`getCelestialUpgradeState` 相当ロジックで `cel_prism` Lv0 が `常時有効`、`cel_asc_expand` を Mirror 外で `購入済み・待機中` と誤表示することを確認）
- `rg -n "DOMContentLoaded|importState|checkAchievementsAfterAction\(" game/ui.app.js`（新規 Celestial 実績の追加に対し、起動/インポート直後には実績再評価が走らないことを確認）

## Plan (2026-03-24 Phase 2 review fixes)
- [x] Celestial 効果状態表示と起動/インポート時の実績再評価経路を確認する
- [x] 実効果ベースの Celestial 状態表示と、起動/インポート直後のルート実績バックフィルを実装する
- [x] Node で構文確認と再現ケース検証を実行し、ログへ記録する

## Progress Log (2026-03-24 Phase 2 review fixes)
- 着手: `game/ui.app.js` の `getCelestialUpgradeState()` と Celestial ルートカード描画、`DOMContentLoaded` / import 後の achievement 再評価経路を確認し、共有 upgrade 未購入時と `ascShopCapBoost` のような常時効果 upgrade で状態表示がズレることを確認。
- 方針: Celestial 状態は `branch` ではなく「今その効果が発動しているか」で判定し、ルートカードの保存済み表示も同じ判定を使って `現在も有効` と `切替で有効` を分ける。
- `game/ui.app.js`: `isCelestialUpgradeEffectActive()` と `getCelestialBranchEffectBuckets()` を追加し、`cel_prism` 未購入は `未購入`、`cel_asc_expand` は Mirror 外でも `購入済み・常時有効` と表示するよう修正。
- `game/ui.app.js`: 起動直後、およびテキスト/ファイル import 直後に `checkAchievementsAfterAction()` を明示実行するよう変更し、新しいルート別実績が既存セーブでも即時バックフィルされるよう修正。

## Verify Log (2026-03-24 Phase 2 review fixes)
- `node --check game/ui.app.js` : 成功
- `node - <<'NODE' ... NODE`（`ui.app.js` から Celestial 状態 helper 群を抽出して stub 環境で実行し、`cel_prism` 未購入が `未購入`、`cel_asc_expand` が Mirror 外でも `購入済み・常時有効` と判定されること、Mirror ルートの effect buckets で `星界チューニング規格` が active / `ハーモニック種銭` が dormant に分かれることを確認。あわせて起動直後と import 直後に `checkAchievementsAfterAction()` を呼ぶフックが追加されていることを確認） : 成功

## Plan (2026-03-24 Celestial unpurchased active-branch label fix)
- [x] `getCelestialUpgradeState()` の未購入 branch-specific 表示条件を確認する
- [x] 選択中ルートの未購入 Celestial upgrade が `inactive:false` かつ route-switch 文言にならないよう修正する
- [x] Node で構文確認と再現ケース検証を実行し、ログへ記録する

## Progress Log (2026-03-24 Celestial unpurchased active-branch label fix)
- 着手: `game/ui.app.js` の `getCelestialUpgradeState()` を確認し、未購入 branch-specific upgrade が現在選択中ルートでも常に `〜を選択で有効` と誤表示されることを確認。
- 方針: `lvl <= 0` 分岐の中で、shared / 選択中 branch / 別 branch を分け、選択中 branch の未購入項目だけ `選択中` かつ `inactive:false` を返す。
- `game/ui.app.js`: branch-specific かつ `activeBranchId === branchId` の未購入 upgrade に対して `選択中` を返す分岐を追加し、switch hint は別ルート時だけ出すよう修正。

## Verify Log (2026-03-24 Celestial unpurchased active-branch label fix)
- `node --check game/ui.app.js` : 成功
- `node - <<'NODE' ... NODE`（`ui.app.js` から `getCelestialUpgradeState()` を抽出して stub 環境で実行し、Mirror 選択中の未購入 `cel_harmonic_seed` が `{ label:'選択中', inactive:false }`、Mirror 非選択時は `{ label:'ミラー系 を選択で有効', inactive:true }` になることを確認） : 成功

## Plan (2026-03-25 Celestial unpurchased label wording fix)
- [x] 選択中 branch の未購入 Celestial upgrade 表示が ownership/effect 状態と矛盾していることを確認する
- [x] 未購入 branch-specific upgrade を active 表現にせず、branch switch hint だけ抑制する文言へ修正する
- [x] Node で構文確認と再現ケース検証を実行し、ログへ記録する

## Progress Log (2026-03-25 Celestial unpurchased label wording fix)
- 着手: `game/ui.app.js` の `getCelestialUpgradeState()` を確認し、選択中 branch の未購入 upgrade が `選択中` と表示され、未購入状態と active 状態が区別できなくなっていることを確認。
- 方針: 選択中 branch でも ownership/effect 表示は「未購入」に寄せ、route switch hint だけを消す。文言は `未購入（選択中ルート）` として neutral にする。
- `game/ui.app.js`: branch-specific かつ `activeBranchId === branchId` の未購入 upgrade に対し、`選択中` ではなく `未購入（選択中ルート）` を返すよう修正。

## Verify Log (2026-03-25 Celestial unpurchased label wording fix)
- `node --check game/ui.app.js` : 成功
- `node - <<'NODE' ... NODE`（`ui.app.js` から `getCelestialUpgradeState()` を抽出して stub 環境で実行し、Mirror 選択中の未購入 `cel_harmonic_seed` が `{ label:'未購入（選択中ルート）', inactive:true }`、Mirror 非選択時は `{ label:'ミラー系 を選択で有効', inactive:true }` になることを確認） : 成功
