- [x] Record review plan for commit af95d1fd86cd572d52d1696370e111eeb2b2abdd
- [x] Inspect diff and surrounding context
- [x] Validate findings and summarize verification

## Progress log
- Started review of commit af95d1fd86cd572d52d1696370e111eeb2b2abdd ("Further optimization of operation").
- Reviewed `game/ui.app.js` dirty-flag dispatcher changes, build-once/update-in-place paths for Celestial/Abyss UI, and the new `getUiPreviewSnapshot()` engine helper.
- Traced `syncUIAfterChange(...)` call sites and compared current-view dirty flags against the visible panels they need to refresh.
- Checked showTab/showSubTab/mainLoop interactions and the updated Celestial/Abyss render paths for obvious stale-DOM regressions.

## Verification log
- `node --check game/config.js && node --check game/engine.app.js && node --check game/ui.app.js` : 成功
- `python3 - <<'PY' ... PY` で主要 `syncUIAfterChange(createUiDirty(...))` 呼び出しを確認し、Celestial / Abyss / Challenge / Ascension の主要操作に dirty flag 指定が入っていることを確認 : 成功
- 結論: 対象コミットで作者に確実に修正を勧めるべき離散的な不具合は確認できず。

## Plan (2026-03-25 UI初期化停止修正)
- [x] `ui.app.js` の未定義 `ensureMiniGameState` 参照を修正
- [x] 起動不能修正に伴うバージョン表記 / 更新情報 / モーダルを更新
- [x] 構文確認と起動経路の再現ハーネスで検証

## Progress Log (2026-03-25 UI初期化停止修正)
- 調査結果どおり、`game/ui.app.js` の `checkAchievementsAfterAction()` が `ui.minigame.js` 内部ローカル関数 `ensureMiniGameState()` を直接参照していたため、起動時の実績判定で初期化が停止していた。
- `game/ui.app.js` に同等の `ensureMiniGameState(st)` helper を追加し、起動直後の achievement 判定でも安全に `miniGame` state shape を補完できるよう修正した。
- ゲーム変更に伴い `APP_VERSION` を `Ver.1.29.3` へ更新し、アップデート情報タブと更新モーダルも今回の起動不能修正内容へ更新した。

## Verify Log (2026-03-25 UI初期化停止修正)
- `node --check game/config.js && node --check game/ui.app.js && node --check game/ui.minigame.js && node --check game/engine.app.js` : 成功
- 簡易 DOM ハーネスで `DOMContentLoaded` を再現し、`inspectorDisplay: \"none\"` `playDisplay: \"block\"` `activeTabs: [\"play\"]` `tabHandlers: true` を確認。起動後にプレイタブ表示とタブイベント登録まで進むことを確認 : 成功
- `git diff --check` : 成功

## Plan (2026-03-25 UI更新頻度設定)
- [x] 更新頻度設定を state / settings UI / mainLoop へ追加
- [x] 50ms 下限の clamp を入れ、通常UIと重いパネルを個別設定化
- [x] バージョン表記 / 更新情報 / 仕様書を更新
- [x] 構文確認と設定値反映の検証を実施

## Progress Log (2026-03-25 UI更新頻度設定)
- `game/state.js` の `settings` に `uiUpdateIntervalMs` と `uiSlowUpdateIntervalMs` を追加し、旧セーブでも migrate の既定値補完で設定が入るようにした。
- `game/ui.app.js` に更新間隔 clamp helper と取得 helper を追加し、設定画面から通常UI更新間隔と重いパネル更新間隔を個別に変更できるようにした。どちらも `50ms` を下限に固定。
- `mainLoop` は定数直参照をやめ、保存済み設定値を参照して通常更新 / slow 更新の頻度を決めるよう変更した。
- ゲーム変更に伴い `Ver.1.29.4` へ更新し、アップデート情報タブ・更新モーダル・仕様書へ新設定を反映した。

## Verify Log (2026-03-25 UI更新頻度設定)
- `node --check game/config.js && node --check game/state.js && node --check game/ui.app.js` : 成功
- vm で `StateManager.defaultState.settings` を確認し、`uiUpdateIntervalMs: 120` / `uiSlowUpdateIntervalMs: 400` が入ることを確認 : 成功
- `rg -n "uiUpdateInterval|uiSlowUpdateInterval|getConfiguredUiUpdateInterval|getConfiguredSlowUiUpdateInterval|min=\"50\""` で、設定 UI の `min=\"50\"`、保存値参照、mainLoop 側の helper 使用を確認 : 成功
- `git diff --check` : 成功
