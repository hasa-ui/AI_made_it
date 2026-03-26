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
