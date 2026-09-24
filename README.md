# Red West

Red West is a browser-based Western arena shooter. This branch contains the Stage 1 Heat prototype described in [REFACTOR_PLAN.md](REFACTOR_PLAN.md). The original build remains on `main` at commit `a0a68e5` for comparison.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. Use WASD to move, mouse to aim and shoot, Shift to dash, Q to change weapons, and P or Escape to pause. Chain kills to raise Heat: points and enemy pressure both rise. Defeat the outlaw in pursuit 3 to finish the prototype run.

## Verify

```powershell
npm test
npm run build
npm run test:smoke
```

The browser smoke test uses an installed Chrome executable. Set `CHROME_PATH` to another Chromium executable when needed. Player feel, balance, and frame pacing still require hands-on playtesting.
