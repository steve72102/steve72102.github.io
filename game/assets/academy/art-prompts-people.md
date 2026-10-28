# 學院人物：重新設計的原創角色

製作日期：2026-10-29。使用內建 `image_gen` 工具，各角色生成一次；沒有使用 CLI。

依 user-provided visual reference 的一般髮型、眼鏡及神情作為靈感，搭配本專案既有原創角色的材質風格重新設計。成品是虛構故事書人物，不是照片人物的精確肖像，不對相似度或法律效果作任何宣稱。原始參考照片未複製進網站資產。

全部 1024 × 1536；PNG 原始輸出保留，網站使用 lossless WebP。保留原始真實 alpha 透明度（範圍 0–254，四角 0），轉換後檢查 RGBA bytes 完全一致。沒有裁切、改色或人工去背。各角色僅為外觀，不代表能力或等級。

## 無損 WebP 驗證紀錄

| 檔案 | Bytes | SHA-256 |
|---|---:|---|
| doctor-inspired.webp | 1,242,610 | `80d01937bf1883762cb38cec1ab178f20f6f345eef24ccc3d8033a5ea6f129e4` |
| professor-inspired.webp | 1,144,928 | `6a0243e0a17e84ca03f439c4adab03975a912eaddd59e950f48441ad129528f7` |
| graduate-inspired.webp | 1,062,398 | `95c1a97d09c19dff558d9734041e5942854cd041d8dd687783f93c9e7f2d7f18` |
| researcher-inspired.webp | 1,147,892 | `513b1ad3ad491eed078d975473b39f2a7df4eb5255ef8068bd2af718e45d5c92` |

## doctor-inspired

檔案：`doctor-inspired.png`、`doctor-inspired.webp`。

黑色短髮、方框眼鏡、青綠學者披肩與奶油白袍，雙手拿研究筆記。

### 最終提示詞

```text
Use case: stylized-concept. Create one new original adult male scholar game character for a bright, welcoming pharmacy academy.
Input image 1 is a user-provided visual reference only: take only the generic short black hair, dark rectangular glasses, and approachable scholarly demeanor of the foreground man. Do not reproduce the real person's identity, exact likeness, face shape, facial-feature proportions, clothing badges, or background. Redesign the face with rounded friendly cheeks, original stylized eye/nose/mouth proportions and a thoughtful smile.
Input image 2 is an existing project character and the art-style reference: use its refined hand-painted 3D storybook miniature craftsmanship, soft dimensional light, warm materials, ornate but restrained academic styling.
New design: short neat black hair with a gentle side fringe, dark square-frame glasses, teal and mint academic shoulder cape over a cream white laboratory coat, small botanical gold embroidery, holding a plain closed research notebook with both hands. Charcoal trousers and brown ankle shoes. About 3.5 heads tall, visibly adult, full body, complete head and both shoes, slight three-quarter angle facing right. Keep silhouette compact with generous clear margin; polished detailed fabric and clearly separated hands.
Genuinely transparent alpha background. No ground, no scenery, no backdrop gradient, no glow halo or shadow plate outside the silhouette. No text, lettering, logos, name tags or watermark. One character only. A new fictional original character, not a portrait.
```

## professor-inspired

檔案：`professor-inspired.png`、`professor-inspired.webp`。

深色長髮、細框眼鏡、淺紫學者外套與白袍，拿植物筆記。

### 最終提示詞

```text
Use case: stylized-concept. Create one new original adult female professor game character for a bright welcoming pharmacy academy.
Input image 1 is a user-provided visual reference only: borrow only the generic long dark hair, thin glasses and friendly smiling demeanor of the woman at the far right. Do not reproduce her exact identity, face shape or facial-feature proportions; invent a fictional stylized face with different cheeks, eyes, nose and mouth. Do not reproduce her clothes or any scene.
Input image 2 is the existing project professor and art-style reference only: match its refined hand-painted 3D storybook miniature craftsmanship, gentle dimensional light and warm detailed fabrics. The new professor is a younger adult with long dark hair, not silver hair, no bun.
New design: smooth long black hair swept over one shoulder, delicate thin dark-bronze rectangular spectacles, warm thoughtful smile; an elegant pale lavender academic jacket over a clean ivory white laboratory coat, restrained gold leaf edging, mint accent at collar. Holding a closed green botanical notebook with a small original leaf ornament. Cream trousers, plum-brown low ankle shoes. About 3.5 heads tall, clearly adult, one compact full-body silhouette, complete head and both shoes, three-quarter forward pose facing slightly right, generous clear margins.
Genuine transparent alpha background; no floor or scenery, no shadow plate, no background gradient or halo. No text, letters, logos, name badges or watermark. A new fictional original character, not a portrait.
```

## graduate-inspired

檔案：`graduate-inspired.png`、`graduate-inspired.webp`。

無眼鏡的黑色側瀏海、暖黃連帽上衣、短白袍、斜背研究書包，拿綠色筆記。

### 最終提示詞

```text
Use case: stylized-concept. Create one new original young adult male graduate-student game character for a bright friendly pharmacy academy.
Input image 1 is a user-provided visual reference only: use only generic hairstyle and mood inspiration from the man in the olive green top on the left middle of the photo, without eyeglasses and with dark side-swept fringe. Do not reproduce his exact identity, exact face or facial proportions, outfit or the group scene. Design a new fictional smiling face with original stylized eyes, cheek shape, small nose and mouth.
Input image 2 is an existing project character for material and art-style reference only: use refined hand-painted 3D storybook miniature rendering, gentle dimensional light and intricate warm fabric, but the new character must be male with short straight black hair, not curly-haired.
New design: neat straight black side fringe, no eyeglasses, inquisitive kind smile; warm yellow hoodie underneath a short ivory white laboratory coat with rolled sleeves, charcoal slim trousers, cream sneakers, brown cross-body research satchel containing a small closed notebook. Hold a second simple closed green field notebook near the chest. About 3.5 heads tall, clearly young adult, compact full-body silhouette, entire head and both shoes visible with clear margins, standing at a slight three-quarter forward angle facing right.
Genuine transparent alpha background. No floor, no backdrop, no gradient, no glow outside silhouette and no shadow plate. No text, numbers, logos, lettering, name badge or watermark. One character only. A new fictional original character, not a real portrait.
```

## researcher-inspired

檔案：`researcher-inspired.png`、`researcher-inspired.webp`。

黑色及肩髮、親切笑容、額上護目鏡、薄荷白袍，拿奶油白與薄荷綠標本盒。

### 最終提示詞

```text
Use case: stylized-concept. Create one new original adult female research scientist game character for a bright welcoming pharmacy academy.
Input image 1 is a user-provided visual reference only: take only the generic straight shoulder-length black hair, side fringe, cheerful approachable expression of the foreground woman. Do not reproduce her identity, exact facial likeness, facial proportions, clothing or the photo scene. Invent a new fictional face with distinct rounded cheeks, expressive stylized eyes and original nose and smile.
Input image 2 is an existing project character and art-style reference: match refined hand-painted 3D storybook miniature craftsmanship, delicate fabric texture, softly luminous daylight and warm polished materials. The new character has straight black shoulder-length hair rather than auburn hair.
New design: shoulder-length black hair with light side bangs, kind open smile, clear laboratory safety goggles resting above the forehead. Fresh mint laboratory coat with cream cuffs and collar over white shirt, dark indigo trousers and practical warm brown boots. Holding a closed small ivory-and-mint specimen case with subtle brass clasps, no symbol or lettering. A mint ribbon detail on the case. About 3.5 heads tall, clearly adult; complete head and both shoes, compact full-body standing silhouette, three-quarter forward angle facing right, generous clear margin, carefully modeled hands.
Genuine transparent alpha background, no backdrop, no scenery, no gradient, no glow halo outside silhouette, no floor or shadow plate. No text, numbers, logos, name badges or watermark. One new fictional original character, not a portrait.
```



## Deployment encoding
The PNG generation masters remain unchanged locally. For mobile loading, the deployed WebP files were subsequently re-encoded at quality 90 at the same dimensions with lossless alpha. Initial lossless-conversion hashes above refer to the pre-optimization files; current runtime sizes and SHA-256 values are in `runtime-assets.json`.
