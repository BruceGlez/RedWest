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

## Backlog: the oxygen bar (the dark mine, `MINE_PLAN.md`)
- A HUD bar for the marshal's oxygen on floors 15 and deeper, built from `src/mineAir.js` (`air.level` 0 to 100, `airLow`, `airEmpty`, `airEffects(air)` = `{ speed, light, warning, empty }`). The full spec is in `MINE_PLAN.md`, "The oxygen bar: spec for the ui lane". Only on thin floors; warns below a quarter; no effect on combat numbers.

## Backlog: the Copper Bit shift screen (owner decision, 2026-10-07)
- The owner moved `src/saloonShiftView.js` and `styles/townSaloon.css` from the `town` lane to this lane. The `town` lane keeps the rules (`src/saloon.js`, `src/saloonShift.js`, the place card); this lane builds the shift screen, the HUD (floating tips, streak meter, star bar, richer result card) and the one-hand phone layout. Spec: `docs/design/copper-bit-shift.md` (P3 to P5, P9, P14). The view only reads what the rules module exposes; a rule change goes to `town` first.
