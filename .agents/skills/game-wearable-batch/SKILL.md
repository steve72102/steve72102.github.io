---
name: game-wearable-batch
description: Batch-produce and integrate original wearable equipment for the pharmacy academy game across its existing ten characters, eight slots, four directions, idle and RUN8. Use when converting approved equipment designs into actual moving in-game art; do not use for product-card illustrations alone.
---

# 批次穿戴原畫

Use the latest isolated game checkout and preserve the playable cast, their faces and hair, item IDs, saves, economy and Firebase rules. This skill extends `.agents/skills/pharmacy-rpg-art-pipeline/SKILL.md`; read its character and atlas specification before adding a new series. The existing `professor-crossline-common-v1` manifest is a format example, not reusable clothing art for another product.

## Input and inventory

Read `MindAdventure.GEAR`, `MindAcademy.CHARACTERS`, the selected item artwork and any existing outfit recipe. Run `node tools/outfit-recipe/wearable-coverage.cjs --catalog-root <latest checkout> --art-root <source checkout> --output <report.json>` to list every character/item pair and which pairs have a complete declared raster atlas. Source art may be in a separate read-only checkout. Group jobs by item and slot; retain the same item ID in the runtime manifest, shop, bag and scene.

## Author the wearable

Produce garment art from the approved product design using the character's own source portrait and anatomy. Keep head, hair, face, hands and base body from that character's accepted art. The product-card image is a design reference and cannot be pasted onto a sprite or registered as a garment pass.

For each character/item pair, create a transparent garment layer fitted to that character. Author FRONT/DOWN, BACK/UP, LEFT and RIGHT independently. Fit the layer to the existing 4×2 run and actions atlases (256×384 cells, 1024×768 atlas, foot anchor 128×372). Existing RUN8 timing, collisions and movement remain unchanged. Use non-destructive masks and layers; keep originals and source prompts. A color filter, mirrored direction, renamed base garment or skeleton-warped full character does not count as new garment artwork.

Where one piece crosses another, use manifest passes and `requires` to keep the actual loadout and occlusion correct. Do not add an unowned cape, hat, book or accessory. Use `registerOutfitManifest` and the current local manifest schema; complete coverage means all four directions, `run` and `actions`, eight frames each. The generated manifest must identify each new item ID and distinct source images. Missing cells stay pending rather than pretending to be complete.

Before declaring any slot complete, inspect its isolated transparent pass in all authored cells. A shirt pass must contain no jacket lapel or sleeve; a pants pass must contain no jacket tail or cape; every pass needs its own retained source image and non-destructive mask. Reject gray/cream cutout fringes, detached opaque islands, misplaced neck/shoulder/cuff joins, foot-anchor shifts, and any pass whose item ID differs from the real loadout. The renderer must never substitute the first compatible item for an unsupported equipped ID. Record that combination as pending art.

Batch acceptance must cover eight slots worn separately, a complete outfit, and representative mixed loadouts in four directions, idle and all RUN8 frames. For each cell, verify successful source decode, dimensions, alpha, pass ownership, selected item ID, and anchor. Generate a contact sheet for rejected cells and a small representative sample for human review. Automated source/manifest checks alone are not visual acceptance.

## Batch and release

After the first item of a series passes structural and rendered checks in the real game, repeat the same art and packaging steps for remaining items. Run manifest validation and check that every referenced file exists, is a decodable image, has expected dimensions/alpha and uses a unique ID. Do not publish a combination marked pending or lacking real-game verification. A deployment must use the latest main as a fast-forward base and preserve existing assets. Do not change gold, inventory or old saves.

Report separately: product-card art, character wearable art, atlas cells, runtime integration, automated checks, and user visual acceptance. Do not mark a character/item pair complete merely because a product card or an inherited base costume exists.
