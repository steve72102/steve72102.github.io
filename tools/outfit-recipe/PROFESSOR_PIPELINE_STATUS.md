# Professor equipment pipeline checkpoint

Base: detached worktree at `ccfbf31215510bcfed59854e4014a37479e8db2d` (latest main at start of this run). This is an isolated, unpublished repair.

## Confirmed defects

- `game/painted-avatar.js` used `visualOutfitState` to replace an unsupported equipped item with the first item in a candidate manifest. This made painted art disagree with the saved loadout. The substitution has been removed; unsupported combinations now return no painted profile.
- The COMMON `crossline-shirt` pass still points to `professor-*-shirt-candidate-v*.png`, which contains the green jacket in a shirt layer. The COMMON `crossline-pants` pass still points to `professor-*-pants-candidate-v*.png`, which contains coat panels and light edge remnants. The river manifest borrows those same passes. These source images are preserved and **not repaired or approved** by the runtime fix.

## Verification done

`node tools/outfit-recipe/professor-loadout.test.cjs` passes: the actual `wish-river-coat` ID is selected, 512 single-slot direction/sheet/frame manifest plans retain exact slot IDs, and an unsupported shirt ID is rejected instead of replaced. This verifies selection logic only. It does not decode pixels, render contact sheets, test the browser, or validate collar/cuff/feet visually.

## Pending before any release

1. Make versioned, independent transparent shirt and pants masters and non-destructive masks for the professor; remove jacket from shirt and coat tails/light fringes from pants without overwriting source PNGs.
2. Build image-level batch QA: decode all pass sources; check alpha, disconnected fragments, edge halos, atlas alignment and foot anchors; render eight slots, full outfit and mixed loadouts across four directions, actions/idle and RUN8 to contact sheets.
3. Test the corrected professor in the actual game, including `wish-river-coat` running toward the screen, neck/shoulder/cuff, and one-character compositing. Reject failed cells as pending art.
4. Only after this sample passes, apply the verified procedure to other cast members. Do not change saves, currency, original character art, or Firebase rules.

Do not publish this checkpoint as completed apparel: art and real-game visual QA remain pending.
