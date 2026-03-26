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
