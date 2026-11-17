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

## Batch and release

After the first item of a series is structurally sound, repeat the same art and packaging steps for the remaining items. Run manifest validation and check that every referenced file exists, is a decodable image, has expected dimensions/alpha and uses a unique ID. The user has authorized publishing before visual review in the current task, so record visual QA as **unreviewed** and ship only batches whose runtime contract is structurally complete. A deployment must use the latest main as a fast-forward base and preserve existing assets. Do not change gold, inventory or old saves.

Report separately: product-card art, character wearable art, atlas cells, runtime integration, automated checks, and user visual acceptance. Do not mark a character/item pair complete merely because a product card or an inherited base costume exists.
