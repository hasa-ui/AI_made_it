## Review e298cba240e84e4395b0c98e0e0315cdae992232
- [x] Inspect commit diff and impacted files
- [x] Validate suspected issues against surrounding code/tests
- [x] Produce prioritized review findings

## Progress log
- Reviewed the Phase 3 diff across challenge, economy, progression, shop, UI, roadmap, and spec updates.
- Traced new Challenge reward types (`challengeKeepLegacy`, `challengeAutoBuySpeed`, `challengeGoalMult`, `challengeStartGold`) through engine/runtime/UI call paths.
- Checked challenge start/abandon/complete flows and Ascend-in-challenge behavior against the newly added Legacy/Challenge mechanics.

## Verification log
- `node --check game/config.js game/engine.helpers.js game/engine.runtime.js game/engine.economy.js game/engine.progression.js game/engine.shop.js game/engine.challenge.js game/engine.reset.js game/engine.app.js game/ui.app.js game/ui.helpers.js` : 成功
- `node <<'NODE' ... NODE` harness reproduced that after completing `ch_quantum_lock`, starting then immediately abandoning any challenge leaves the extra `25050` gold on the normal run (`gold: 100 -> 25050`, `totalGoldEarned` restored), confirming a repeatable gold-mint exploit.
- `node <<'NODE' ... NODE` harness reproduced that after earning `ch_no_upgrades`, `startChallengeInternal()` preserves `legacy`, but `doAscendInternal()` inside the still-active challenge resets `legacy` back to `0`, so the new reward stops applying after the first Ascend.

## Fix Phase 3 challenge regression bugs
- [x] Inspect challenge start/abandon/complete and ascend reset paths
- [x] Patch challenge-only start-gold restore so normal runs cannot mint gold
- [x] Reapply Challenge 2 legacy retention across Ascend restarts in active challenges
- [x] Verify syntax and reproduce both fixes with harnesses

## Progress log
- Added `challenge.savedGold` to the canonical challenge state so challenge-only starting gold can be snapshotted separately from normal-run gold.
- Updated challenge start/abandon/complete flows to save and restore both `gold` and `totalGoldEarned`, preventing challenge start bonuses from leaking back into normal runs.
- Updated `doAscendInternal()` to preserve `legacy` when an active challenge is running and the `challengeKeepLegacy` reward is unlocked, so the reward survives challenge restarts caused by Ascend.
- Aligned challenge-state defaults across migration, Abyss-reset retention, UI fallback state, and Ascend fallback initialization.

## Verification log
- `node --check game/state.defaults.js game/state.migration.js game/engine.challenge.js game/engine.reset.js game/engine.state-normalizers.js game/ui.app.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、`ch_quantum_lock` クリア済み状態から Challenge 開始時に `gold` が `25050` へ増えても、`abandonChallengeInternal()` 後は `gold: 100` / `totalGoldEarned: 100` に正しく復元されることを確認。
- `node <<'NODE' ... NODE` harness で、`ch_no_upgrades` クリア済みかつ active challenge 中に `doAscendInternal()` を呼んでも `legacy: 77` が維持され、`activeId` 継続・`ascendedInChallenge: 1` になることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix follow-up challenge snapshot bugs
- [x] Inspect restore paths for asset leakage and partial legacy retention
- [x] Expand challenge resume snapshot to restore pre-challenge run state
- [x] Preserve legacy nodes on Ascend during keep-Legacy challenges
- [x] Verify exploit closure and node retention with harnesses

## Progress log
- Replaced the partial gold-only restore with a fuller challenge resume snapshot so exiting a challenge restores pre-challenge `units`, `upgrades`, `legacy`, `legacyNodes`, `prestigeEarnedTotal`, and run-local stats instead of only refunding gold.
- Kept `savedGold` / `savedTotalGold` as compatibility fallback, but made `savedSnapshot` the canonical restore source for new challenge runs.
- Updated Ascend reset logic so `challengeKeepLegacy` preserves both `legacy` and `legacyNodes` while an active challenge is being restarted.

## Verification log
- `node --check game/state.defaults.js game/state.migration.js game/engine.challenge.js game/engine.reset.js game/engine.state-normalizers.js game/ui.app.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、`ch_quantum_lock` クリア済み状態から Challenge 中に unit を購入しても、`abandonChallengeInternal()` 後は `gold: 100` / `totalGoldEarned: 100` / `units.junior: 2` に戻り、Challenge 資産が通常 run へ漏れないことを確認。
- `node <<'NODE' ... NODE` harness で、Challenge 中に unit を購入した後に `tryCompleteChallengeInternal()` しても、クリアフラグだけ保持しつつ `gold: 240` / `totalGoldEarned: 240` / `units.junior: 3` の開始前 state に戻ることを確認。
- `node <<'NODE' ... NODE` harness で、`ch_no_upgrades` クリア済みの active challenge 中に `doAscendInternal()` を呼ぶと `legacy: 77` と `legacyNodes.lg_global10: 2` / `lg_seed50: 1` が維持されることを確認。
- Playwright client: `page.goto: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix challenge meta-progression restore bug
- [x] Inspect challenge snapshot gaps around AP/CP and higher-layer purchases
- [x] Extend challenge snapshot restore to AP/CP, shop ownership, and related meta state
- [x] Verify abandon/complete both rewind challenge-earned meta progression

## Progress log
- Expanded `savedSnapshot` to also capture `ascPoints`, `ascEarnedTotal`, `ascOwned`, `celestialPoints`, `celestialEarnedTotal`, `celestialOwned`, `celestial`, `achievementsOwned`, `runStats`, and `lastAscensionRun`.
- Restored those higher-layer fields on challenge exit so Ascend/CP gains and any Ascension/Celestial purchases made during a discarded challenge no longer leak onto the main save.

## Verification log
- `node --check game/engine.challenge.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、Challenge 中に `Ascend -> Ascension Shop購入 -> Celestial Shop購入 -> branch切替` しても、`abandonChallengeInternal()` 後は `ascPoints: 20` / `ascEarnedTotal: 100` / `ascOwned.asc_global20: 0` / `celestialPoints: 10` / `celestialEarnedTotal: 20` / `celestialOwned.cel_prism: 0` / `branch: vault` に戻ることを確認。
- `node <<'NODE' ... NODE` harness で、同じ操作後に `tryCompleteChallengeInternal()` しても、クリアフラグだけ保持しつつ AP/CP と shop 所持状態が開始前 state に戻ることを確認。
- Playwright client: `page.goto: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix challenge snapshot compatibility and mini-game rollback
- [x] Guard restore against legacy in-progress challenge snapshots
- [x] Include mini-game progress in current challenge snapshots
- [x] Verify backward compatibility and mini-game rollback with harnesses

## Progress log
- Switched snapshot restore to field-presence guards so pre-existing in-progress challenge saves only restore fields they actually captured, instead of nulling/wiping newer meta structures.
- Added `miniGame` to the current challenge snapshot so discarded challenge runs no longer leak minigame score/play/perfect progress into the main save.

## Verification log
- `node --check game/engine.challenge.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、旧形式の active challenge snapshot から `abandonChallengeInternal()` しても `ascPoints` / `ascOwned` / `celestialOwned` / `achievementsOwned` が壊れず、その後 `buyAscensionUpgradeInternal()` も正常に呼べることを確認。
- `node <<'NODE' ... NODE` harness で、現行 snapshot では Challenge 中に増えた `miniGame.plays` / `bestScore` / `perfectRuns` が `abandonChallengeInternal()` 後に開始前 state へ戻ることを確認。
- `node <<'NODE' ... NODE` harness で、同じ mini-game progress が `tryCompleteChallengeInternal()` 後も challenge clear だけ保持しつつ開始前 state へ戻ることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy snapshot backfill gaps
- [x] Backfill missing rollback fields for legacy active-challenge saves during migration
- [x] Cover mini-game and ascension summary in the backfill
- [x] Verify load->abandon/complete rollback for legacy snapshots

## Progress log
- Added migration-time backfill for active challenge snapshots so older saves pick up rollback baselines for AP/CP-related fields, `miniGame`, `runStats`, `achievementsOwned`, and `lastAscensionRun` from the loaded save state.
- This lets legacy in-progress challenges keep using the guarded restore path without leaking newly-added rollback targets after the update.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、旧形式の active challenge save を `SM.importState()` に通すと `savedSnapshot.miniGame` と `savedSnapshot.lastAscensionRun` がロード時 state から補完されることを確認。
- `node <<'NODE' ... NODE` harness で、その migrated save から `abandonChallengeInternal()` しても `miniGame` と `lastAscensionRun` が開始前 state に戻ることを確認。
- `node <<'NODE' ... NODE` harness で、同じ migrated save から `tryCompleteChallengeInternal()` しても challenge clear だけ保持しつつ `miniGame` と `lastAscensionRun` が開始前 state に戻ることを確認。
- Playwright client: `page.addInitScript: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy snapshot live-state seeding bug
- [x] Stop using live in-challenge meta state as the backfill source for legacy snapshots
- [x] Switch missing rollback fields to safe non-leaking defaults
- [x] Verify load->abandon/complete on legacy active-challenge saves

## Progress log
- Changed legacy active-challenge snapshot backfill to use neutral defaults instead of the current in-challenge state, so rollback does not preserve challenge-earned AP/CP, mini-game progress, or ascension summaries from before the update.
- This keeps the rollback conservative for old snapshots: missing meta fields are discarded rather than reconstructed from potentially tainted challenge state.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、旧形式の active challenge save を `SM.importState()` に通すと、欠けている `ascPoints` / `miniGame` / `lastAscensionRun` などが live state ではなく安全な既定値へ補完されることを確認。
- `node <<'NODE' ... NODE` harness で、その migrated save から `abandonChallengeInternal()` しても `ascPoints` / `miniGame` / `lastAscensionRun` が challenge 進行前の安全側 state (`0` / 既定値 / `null`) に戻ることを確認。
- `node <<'NODE' ... NODE` harness で、同じ migrated save から `tryCompleteChallengeInternal()` しても challenge clear だけ保持しつつ同じ安全側 state に戻ることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy snapshot baseline loss bug
- [x] Preserve loaded meta state for legacy active challenges that never ascended inside the challenge
- [x] Keep safe fallback only for legacy snapshots with recorded in-challenge ascends
- [x] Verify both compatibility paths with harnesses

## Progress log
- Adjusted legacy active-challenge backfill to branch on `ascendedInChallenge`: no-ascend saves now seed missing meta fields from the loaded save, while saves that already ascended still fall back to safe reset values for ascend-derived fields.
- This restores legitimate pre-challenge progression for the common compatibility case without reopening the known leak from legacy challenge ascends.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、`ascendedInChallenge = 0` の legacy active challenge save は `SM.importState()` 後に `ascPoints` / `ascOwned` / `celestialOwned` / `miniGame` / `lastAscensionRun` を loaded save から backfill し、`abandonChallengeInternal()` 後もそれらが維持されることを確認。
- `node <<'NODE' ... NODE` harness で、`ascendedInChallenge = 1` の legacy active challenge save は ascend-derived fields だけ安全側 fallback (`0` / default / `null`) へ補完されることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy live-state baseline bug
- [x] Stop reconstructing incomplete legacy challenge snapshots from loaded meta state
- [x] Resolve incompatible legacy active challenges during migration using only stored run-local snapshot data
- [x] Verify legacy auto-resolve and complete-snapshot preservation with harnesses

## Progress log
- Replaced the migration-time meta backfill for incomplete legacy active-challenge snapshots with an auto-resolve path: if required rollback fields are missing, migration restores only the run-local snapshot data already present (`gold`, `totalGoldEarned`, `units`, `upgrades`, `legacy`, etc.) and clears `challenge.activeId`.
- Complete snapshots are left untouched, so only incompatible legacy saves are auto-abandoned on load.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、不完全な legacy active challenge save は `SM.importState()` 後に `challenge.activeId === null` となり、`gold` / `totalGoldEarned` / `units` などの run-local state だけ snapshot 値へ戻り、meta state は loaded save のまま残ることを確認。
- `node <<'NODE' ... NODE` harness で、必要 field を持つ complete snapshot save は `SM.importState()` 後も `challenge.activeId` を維持し、snapshot 内容も保持されることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy auto-resolve meta leak
- [x] Discard ambiguous meta progression when auto-resolving incomplete legacy active challenges
- [x] Keep complete snapshots untouched
- [x] Verify legacy auto-resolve and complete-snapshot preservation with harnesses

## Progress log
- Tightened the auto-resolve path for incomplete legacy active-challenge snapshots so it now restores only the stored run-local snapshot data and explicitly resets ambiguous meta progression (`ascPoints`, owned meta upgrades, branch, achievements, miniGame, runStats, lastAscensionRun`) to safe defaults before clearing the challenge flag.
- Complete snapshots are still preserved as active challenges; only incompatible legacy saves are auto-resolved this way.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、不完全な legacy active challenge save は `SM.importState()` 後に `challenge.activeId === null` になり、`gold` / `totalGoldEarned` / `units` などの run-local state だけ snapshot 値へ戻り、`ascPoints` / `ascOwned` / `celestialOwned` / `miniGame` / `lastAscensionRun` などは安全な既定値へ落ちることを確認。
- `node <<'NODE' ... NODE` harness で、complete snapshot save は `SM.importState()` 後も `challenge.activeId` を維持し、snapshot 内容も保持されることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy auto-resolve meta loss bug
- [x] Revisit incomplete legacy challenge auto-resolve behavior in migration
- [x] Preserve loaded persistent meta state while still restoring stored run-local snapshot data
- [x] Verify legacy auto-resolve and complete-snapshot preservation with harnesses

## Progress log
- Simplified the incomplete legacy active-challenge auto-resolve path in `state.migration.js` so it no longer resets top-level meta progression when clearing an incompatible challenge.
- The migration still restores the stored run-local snapshot fields (`gold`, `totalGoldEarned`, `units`, `upgrades`, `legacy`, etc.) and clears the challenge flag, but now leaves the loaded save's persistent AP/CP, owned meta upgrades, achievements, mini-game stats, and run history intact.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、不完全な legacy active challenge save は `SM.importState()` 後に `challenge.activeId === null` となり、`gold` / `totalGoldEarned` / `units` は snapshot 値へ戻りつつ、`ascPoints` / `ascOwned` / `celestialOwned` / `achievementsOwned` / `miniGame` / `runStats` / `lastAscensionRun` は loaded save の値が維持されることを確認。
- `node <<'NODE' ... NODE` harness で、complete snapshot save は `SM.importState()` 後も `challenge.activeId` を維持し、完全 snapshot がそのまま残ることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy auto-resolve leakage and run-stats bugs
- [x] Revisit incomplete legacy challenge auto-resolve behavior for ambiguous meta fields
- [x] Reinitialize current run stats when no snapshot baseline exists
- [x] Verify legacy auto-resolve behavior with and without in-challenge ascends

## Progress log
- Updated `state.migration.js` so incomplete legacy active-challenge snapshots now discard ambiguous meta progression (`ascPoints`, meta shop ownership, achievements, mini-game stats, branch selection) before auto-resolving the challenge.
- Added a small run-stats rebuild path for legacy auto-resolve: when no `snapshot.runStats` baseline exists, migration now starts a fresh current run at the restored gold amount and trims history/run-count increments caused by in-challenge ascends.
- Auto-resolved legacy challenges now also clear `challenge.ascendedInChallenge` so discarded challenge-only ascension counters do not leak forward.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、不完全な legacy active challenge save は `SM.importState()` 後に `challenge.activeId === null` となり、run-local snapshot を復元した上で `ascPoints` / `ascOwned` / `celestialOwned` / `achievementsOwned` / `miniGame` が default/null へ戻ることを確認。
- `node <<'NODE' ... NODE` harness で、`snapshot.runStats` が無い legacy save は `currentRunStartedAt` / `currentRunPeakGold` / `currentRunUnitTypes` / `currentRunUpgradeBuys` が通常 run 用に再初期化され、`ascendedInChallenge = 1` の場合は challenge 中に追加された `runStats.history` と `runCount` の 1 回分が巻き戻ることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy auto-resolve meta preservation bug
- [x] Preserve loaded persistent meta state for incomplete legacy challenge auto-resolve
- [x] Keep existing lastAscensionRun when no snapshot baseline exists
- [x] Verify meta preservation and run-stats rebuild with harnesses

## Progress log
- Removed the migration-time meta reset from incomplete legacy active-challenge auto-resolve, so imported saves now keep their loaded AP/CP, owned meta upgrades, achievements, mini-game progress, and other persistent top-level state when the incompatible challenge is cleared.
- Kept the run-local restore and current-run `runStats` rebuild path intact, so legacy challenge auto-resolve still fixes the broken timer/peak/unit-usage fields without touching persistent meta state.
- Changed `lastAscensionRun` handling to preserve the loaded summary unless the legacy snapshot actually captured a baseline for it.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、不完全な legacy active challenge save は `SM.importState()` 後に `challenge.activeId === null` となり、`gold` / `totalGoldEarned` / `units` は snapshot 値へ戻りつつ、`ascPoints` / `ascOwned` / `celestialOwned` / `achievementsOwned` / `miniGame` は loaded save の値が維持されることを確認。
- `node <<'NODE' ... NODE` harness で、`snapshot.lastAscensionRun` が無い legacy save でも、既存の `lastAscensionRun` が保持され、`snapshot.runStats` が無い場合の current-run `runStats` 再初期化と `ascendedInChallenge = 1` 時の `history` / `runCount` 巻き戻しが引き続き機能することを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix legacy auto-resolve meta leak and ascension-summary leak
- [x] Discard ambiguous meta progression again for incomplete legacy challenge auto-resolve
- [x] Only keep `lastAscensionRun` when the discarded legacy challenge never ascended
- [x] Verify no-ascend and with-ascend legacy saves separately

## Progress log
- Restored the explicit discard of ambiguous top-level meta state (`ascPoints`, meta shop ownership, achievements, mini-game, celestial branch) for incomplete legacy active-challenge snapshots, so auto-resolving those saves no longer preserves challenge-mutated AP/CP progression.
- Refined `lastAscensionRun` handling so legacy auto-resolve keeps the previous summary only when `ascendedInChallenge === 0`; if the discarded challenge recorded one or more ascends, the leaked summary is now cleared.
- Kept the current-run `runStats` rebuild and in-challenge `history` / `runCount` rollback logic unchanged.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、不完全な legacy active challenge save は `SM.importState()` 後に `challenge.activeId === null` となり、run-local snapshot を復元した上で `ascPoints` / `ascOwned` / `celestialOwned` / `achievementsOwned` / `achievementsProgress` / `miniGame` が default/null へ戻ることを確認。
- `node <<'NODE' ... NODE` harness で、`ascendedInChallenge = 0` の legacy save は既存 `lastAscensionRun` を維持し、`ascendedInChallenge = 1` の legacy save は `lastAscensionRun === null` へ落ちることを確認。あわせて `history` / `runCount` 巻き戻しと current-run `runStats` 再初期化も維持されることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Review e404964d1bda12fbe3708f803e4e29c24117b494
- [ ] Inspect commit diff and impacted files
- [ ] Validate suspected regressions against surrounding code/tests
- [ ] Produce prioritized review findings

## Progress log
- Started review of commit `e404964d1bda12fbe3708f803e4e29c24117b494` ("Bug fixes").

## Verification log
- Pending
- Inspected `game/state.migration.js` diff and traced how incomplete legacy challenge snapshots are auto-resolved during `migrateState()`.
- Reproduced with a Node/vm harness that an incomplete legacy active-challenge save with `ascendedInChallenge = 1` now imports with `challenge.activeId === null` but keeps live `ascPoints`, `ascOwned`, `celestialPoints`, `celestialOwned`, `achievementsOwned`, `miniGame`, `runStats`, and `lastAscensionRun` from inside the challenge.
- Reproduced with a second harness that even `ascendedInChallenge = 0` saves keep challenge-mutated `runStats.currentRunStartedAt/currentRunPeakGold/history` after auto-resolve, so the resumed normal run inherits challenge timers/history.

## Verification log
- `node <<'NODE' ... NODE` vm harness: imported an incomplete legacy active-challenge save whose live state had challenge-earned AP/CP/meta purchases; `migrateState()` restored `gold`/`totalGoldEarned` to snapshot values while leaving `ascPoints: 35`, `ascOwned.asc_global20: 1`, `celestialPoints: 8`, `celestialOwned.cel_prism: 1`, `achievementsOwned`, `miniGame`, `runStats`, and `lastAscensionRun` untouched.
- `node <<'NODE' ... NODE` vm harness: imported an incomplete legacy active-challenge save with `ascendedInChallenge = 0`; `migrateState()` still cleared `challenge.activeId` but preserved challenge `runStats.currentRunStartedAt: 12345`, `currentRunPeakGold: 999`, and challenge-tagged `history`, confirming current-run stats are not rewound.

## Fix restored snapshot migration bypass
- [x] Reapply versioned asc/celestial migration rules after restoring snapshot meta
- [x] Verify restored legacy snapshot ownership is clamped/refunded correctly
- [x] Keep the fix local to `state.migration.js`

## Progress log
- Extracted the existing versioned Ascension/Celestial migration rules into local helpers in `state.migration.js`.
- The same clamp/refund logic now runs both on the top-level imported state and again after partial legacy snapshot meta is restored, so snapshot-provided `ascOwned` / `celestialOwned` can no longer bypass old refund migrations.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、`sourceVersion = 13` の incomplete legacy active challenge save が `savedSnapshot.ascOwned.asc_void_multiplier = 3` と `savedSnapshot.celestialOwned.cel_harmonic_seed = 2` を持つケースを import し、auto-resolve 後に `asc_void_multiplier === 1` + `ascPoints === 8400`、`cel_harmonic_seed === 0` + `celestialPoints === 10` へ補正されることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Implement mobile readability UI pass
- [x] Compress header and tab navigation for mobile
- [x] Add collapsible mobile summaries and play-list accordions
- [x] Move legacy inspector to a mobile bottom sheet presentation
- [x] Update version/update info and verify changed files

## Progress log
- Updated the mobile presentation in `index.html`, `game/styles.css`, and `game/ui.app.js` to reduce initial vertical usage: header KPI chips and tab bars now favor horizontal scrolling, long explanation blocks are wrapped in mobile-collapsible `details`, and play-tab rows gained a summary-first accordion layout.
- Added mobile-only UI state helpers in `game/ui.app.js` so unit/upgrade rows expand one at a time, responsive `details` only auto-collapse when viewport mode changes, and the legacy inspector becomes a bottom sheet on mobile instead of a permanently visible side panel.
- Bumped the app version to `Ver.1.31.1` and updated the updates tab plus update modal text for the new mobile readability pass.

## Verification log
- `node --check game/config.js && node --check game/ui.app.js` : 成功
- `git diff --check` : 成功
- `rg -n "Ver\\.1\\.31\\.1|mobileDetails|shopAccordionToggle|mobile-open|syncMobileResponsiveUi|toggleUnit-|toggleUp-" index.html game/styles.css game/ui.app.js game/config.js` で、更新情報・折りたたみ詳細・一覧 accordion・mobile inspector sheet のフックが追加されていることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。

## Fix partial legacy snapshot baseline loss
- [x] Restore available meta rollback fields from partially populated legacy snapshots
- [x] Preserve earned-total counters when no in-challenge ascends occurred
- [x] Verify partial-snapshot and no-ascend legacy imports with harnesses

## Progress log
- Replaced the blanket legacy meta reset with field-by-field restore logic in `state.migration.js`, so incomplete legacy snapshots now reuse any rollback baselines they already contain instead of wiping the whole meta layer whenever one later-added field is missing.
- `ascEarnedTotal` and `celestialEarnedTotal` now preserve the loaded save values when `ascendedInChallenge === 0`, because those lifetime totals only change on Ascend; they still fall back to `0` when the discarded legacy challenge actually recorded one or more ascends and the snapshot lacks a baseline.
- Kept the existing behavior for fields that still have no safe baseline (`achievementsOwned`, `achievementsProgress`, `miniGame`, etc.): if the partial legacy snapshot does not carry them, they are still reset during auto-resolve.

## Verification log
- `node --check game/state.migration.js` : 成功
- `git diff --check` : 成功
- `node <<'NODE' ... NODE` harness で、partial legacy snapshot が `ascPoints` / `ascOwned` / `celestialOwned` を持っているケースでは、それらの baseline が field 単位で復元され、snapshot に無い `achievementsOwned` / `miniGame` だけが reset されることを確認。
- `node <<'NODE' ... NODE` harness で、`ascendedInChallenge = 0` の legacy save は `ascEarnedTotal` / `celestialEarnedTotal` を loaded save から保持し、`ascendedInChallenge = 1` の legacy save は snapshot baseline 不在時に両 total が `0` へ落ちることを確認。`lastAscensionRun === null` の条件と `runStats` 再初期化も維持されることを確認。
- Playwright client: `browser.newPage: Target page, context or browser has been closed` により今回もブラウザ確認は実行不可。
