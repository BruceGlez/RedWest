# Lane: Audio

**Mission:** Sound, voices, music and the mix.

## Backlog (from `PLAN.md`)
- Real-phone listening check (clipping, hot loop switch, voice lines)
- Crossfade for the hot music loop
- More gunshot variants and ambience beds, made with `tools/elevenlabs.mjs` (paid plan only, stock voices only)

## Rules
Each new file is listed in `src/audioManifest.js` and recorded in `ASSETS.md`.

## You own
- `src/audio*.js`
- `src/ambience.js`
- `src/soundscape.js`
- `tools/elevenlabs.mjs`
- `public/audio/**`
- `tests/audio*.test.js`
- `tests/soundscape.test.js`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
