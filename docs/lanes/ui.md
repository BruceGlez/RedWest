# Lane: UI, UX and accessibility

**Mission:** Screens, controls and accessibility.

## Backlog (from `PLAN.md`)
- Count-up numbers, reward reveals, safe areas on notched phones
- Accessibility: text size, reduced motion, colour-blind aim line
- Keep one visual language across `styles/*.css`

## Rules
`uiManager.js` and `index.html` are shared. Prefer a new module plus a small hook. Test on phone width.

## You own
- `src/touchControls.js`
- `src/input.js`
- `src/feedback.js`
- `src/loadingScreen.js`
- `src/recordsPanel.js`
- `src/privacyPanel.js`
- `style.css`
- `styles/base.css`
- `styles/mobile.css`
- `styles/home.css`
- `styles/panels.css`
- `styles/bounty-book.css`
- `styles/store.css`
- `styles/platform.css`
- `styles/entry.css`
- `tests/touchControls.test.js`
- `tests/mobile-smoke.mjs`

Anything else is another lane's file or a shared file (see `AGENTS.md`). Run `node tools/lanes.mjs diff` before opening a PR.

## Before you open a PR
- `npm test`
- `npm run test:mobile`
