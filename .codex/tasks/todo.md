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
