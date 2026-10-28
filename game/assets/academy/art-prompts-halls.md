# Original academy hall artwork

Created on 2026-10-29 with the built-in image_gen tool (not the CLI/API fallback). Three separate generations; no existing university building was used as a visual reference or copied. Architectural vocabulary was supplied in the task. The existing atrium.png was visually inspected for the overall bright game-art direction.

Each PNG is the original generated 1536 × 1024 image. Each WebP is a lossless format conversion, validated by exact RGBA pixel equality; no rescaling or retouching was applied. All scenes have opaque backgrounds. No text, people, logos or university crests were requested.

## Validation

| Asset | Dimensions | PNG bytes | WebP bytes | Exact RGBA equality |
| --- | --- | ---: | ---: | --- |
| hall-ntu | 1536 × 1024 | 2580000 | 1878302 | true |
| hall-nthu | 1536 × 1024 | 2537117 | 1769652 | true |
| hall-ncku | 1536 × 1024 | 3105863 | 2155958 | true |

WebP SHA-256 values:

- hall-ntu: `2d52f9160a981c1456dc74ae6b15099aa426c583cf5fd515dc0322eca87197f2`
- hall-nthu: `7e58e36b861125cbd028bc7b6d486d9aebe014093be07daa556bd8ea4e8fc17c`
- hall-ncku: `648a1be1c8fdc54eeb040edf493d974324ed2bb1b38740f9dd136c2fd0af17ec`

## Red-brick reading hall and palm courtyard

Files: hall-ntu.png and hall-ntu.webp

Final prompt:

```text
Use case: stylized-concept. Asset type: original background scene for a bright pharmacy-academy exploration game. Create one finished wide landscape image, 1536 by 1024 pixels, 3:2. A welcoming university reading hall viewed from inside toward a sunny courtyard. Architecture uses warm muted terracotta-red brick, generous rounded arch windows outlined with cream stone, calm gray tile roofs beyond the courtyard, and tall coconut palms against a clear pale blue sky. This is an original fictional composition inspired by the broad red-brick-and-palm campus vocabulary of Taiwanese universities, not a replica of any real building. Beautiful bright storybook 3D game environment, refined painted surfaces, believable architecture, detailed but peaceful. Pharmacy learning accents: a few wooden reading tables and bookcases along the left and far sides, clear glass beakers/flasks and potted herbs near the windows, no chemical labels. Large arch at center leads to the bright palm garden; open cream stone floor in the foreground and center left for game characters. Keep the lower right quarter quiet, uncluttered floor and softly lit wall for an interface overlay; no furniture there. Fresh daylight, cream whites, soft teal accents, soft shadows, gentle brick colors; immersive eye-level wide-angle viewpoint. No people, no animals, no characters, no lettering, no numbers, no signs, no university crests, no logos, no watermarks. The composition should feel spacious and safe, not Gothic, not a palace, not dark or nighttime.
```

## White research atrium and shaded garden

Files: hall-nthu.png and hall-nthu.webp

Final prompt:

```text
Use case: stylized-concept. Asset type: original background scene for a bright pharmacy-academy exploration game. Create one finished wide landscape image, 1536 by 1024 pixels, 3:2. A spacious modern Taiwanese university research atrium, with horizontal white architectural volumes, tall glass walls, deep window recesses and sun shades, delicate slim framing, a beautiful generous white staircase climbing toward an upper research gallery. Looking through the glass, a peaceful campus garden with broad shade trees and green lawn. An original fictional architecture inspired by the broad clean-white modern research-campus vocabulary, not a replica of any existing building. Beautiful bright storybook 3D game environment, sophisticated softly painted surfaces and believable materials, slightly whimsical clean detail, not photorealistic. Pharmacy science accents limited to elegant small display alcoves at the far left and background with clear laboratory glassware, unlabeled specimen jars, potted medicinal herbs, and a few books. Open uncluttered foreground and center-left floor for game character overlays; lower right quarter deliberately quiet pale stone floor and soft wall area for a game interface. Fresh morning sun, generous daylight, creamy white and soft mint, pale sky blue, tiny warm wood details, natural leafy shadows. Eye-level wide-angle immersive composition. No people, no animals, no characters, no text, no letters, no numbers, no signs, no logos, no university crests, no watermarks. Avoid palatial Gothic arches and red brick here; this hall has a clear, horizontal, contemporary academic character.
```

## Brick arcade and banyan courtyard

Files: hall-ncku.png and hall-ncku.webp

Final prompt:

```text
Use case: stylized-concept. Asset type: original interior background for a bright pharmacy-academy exploration game. Create one finished wide landscape image, 1536 by 1024 pixels, 3:2. A welcoming scholarly hall opening onto a long red-brick arcade with repeated rounded arches, calm gray tile roof edges and warm wooden window frames. Beyond the arcade is a peaceful Taiwanese university courtyard centered on a broad old banyan tree, fresh green lawn and sunlit stone paving. An original fictional composition using the broad red-brick-arcade-and-banyan vocabulary of historic southern Taiwanese campuses, not a replica of any real building. Beautiful bright storybook 3D game environment with softly painted textures and believable architectural depth. A few bookcases and laboratory glassware displays along the far left interior wall, small unlabeled clear flasks and mortar/pestle, modest medicinal herb plants. Center foreground and center left must be open floor for a walking game character. Leave lower right quarter visually quiet with pale stone floor and gentle shadows for a game interface overlay. Warm clear daytime, cream stone, restrained terracotta brick, mint green foliage, blue sky, soft natural leaf shadows. Immersive eye-level wide-angle viewpoint, airy, clean, welcoming and dignified. The repeated arches should establish perspective rather than one giant central arch. No humans, no animals, no game characters, no text, no lettering, no numbers, no signs, no logos, no university crests, no watermarks. No nighttime, no heavy darkness, no futuristic glass tower.
```




## Deployment encoding
The PNG generation masters remain unchanged locally. For mobile loading, the deployed WebP files were subsequently re-encoded at quality 90 at the same dimensions with lossless alpha. Initial lossless-conversion hashes above refer to the pre-optimization files; current runtime sizes and SHA-256 values are in `runtime-assets.json`.
