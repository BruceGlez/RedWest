# Lane: Story and content

**Mission:** Story, barks and content (`STORY_BIBLE.md`).

## Backlog (from `PLAN.md`)
- Chapter-two hook, story props in town, the Drifter legend
- Barks for the stable and undertaker
- Story is short, skippable and never blocks play. Serious tone, nothing from other games

## Rules
No real people, no stereotypes. Pictures via `tools/story-picture.mjs`, recorded in `ASSETS.md`.

## You own
- `src/story.js`
- `src/barks.js`
- `styles/story.css`
- `STORY_BIBLE.md`
- `tools/story-*.mjs`
- `public/story/**`
- `tests/story*`
- `tests/barks.test.js`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:story`
