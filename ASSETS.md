# Red West asset record

Where every non-code asset came from and the terms that allow the game to use it commercially. Keep this
up to date whenever an asset is added or regenerated. Keep the matching invoices and plan pages (for example
a screenshot of the account's billing page on the day of generation) outside the repository, so you can
show what licence applied if anyone asks.

| Asset | Files | Made with | Plan / licence | Made | Notes |
|---|---|---|---|---|---|
| Sound effects, music, voice lines | `public/audio/` | ElevenLabs API (`tools/elevenlabs.mjs`, list in `src/audioManifest.js`) | **Paid plan** (confirmed by the owner, 2026-09-29): commercial use allowed | 2026-09-28 | Voices are ElevenLabs stock voices only. Cloned voices are skipped by the script; never clone a real person's voice. Regenerating needs a paid plan too. |
| Character pictures (front views) | `art/characters/` | OpenAI Images API (`tools/character-picture.mjs`, prompts in `tools/character-prompts.mjs`) | OpenAI terms: outputs belong to the user | 2026-09-28 | Prompts describe original characters; keep them free of real people, brands and other games' characters. |
| Animated 3D characters | `public/models/` | Meshy API (`tools/meshy.mjs`) from the pictures above | **Paid plan** (confirmed by the owner, 2026-09-29): private models, commercial use allowed | 2026-09-28 | |
| Fonts: Rye, Roboto Mono | `fonts/` | Google Fonts | SIL Open Font License 1.1 (`fonts/OFL-*.txt`) | | Keep the licence files next to the fonts. |
| App icons | `public/icons/` | Made for the project | Owned | | |
| Three.js | npm `three` | | MIT licence | | |
| Other code-built art (props, box characters, the Drifter) | `src/` | Written in code | Owned | | |

## Rules for new assets

- Use only services and plans that allow commercial use, and add a row here the same day.
- No real people, celebrities, brands, logos, or characters, art or names from other games (for example
  Red Dead, Kingshot, Whiteout Survival), in prompts, assets, store listings or ads.
- AI voices: stock or properly licensed voices only; no voice clones of real people.
- Music and effects from other sources need a licence that covers games and their ads (a "sync" licence
  for trailers and ads).
