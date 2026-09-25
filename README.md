# Red West

Red West is a browser-based Western arena shooter. `main` contains the Stage 1 Heat prototype described in [REFACTOR_PLAN.md](REFACTOR_PLAN.md). The original endless-survival build is commit `a0a68e5` in the history (`git checkout a0a68e5`) if you need it for comparison.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. Use WASD to move, mouse to aim and shoot, Shift to dash, Q to change weapons, and P or Escape to pause. Chain accurate kills to raise Heat: points and enemy pressure both rise, while missed shots and hits taken cool it. Defeat the outlaw in pursuit 3, then bank the Heat-scaled bounty (B) or ride on (C) into a 30-second bonus pursuit: escape to collect the bounty and bonus earnings, or die and lose both.

The source page also works from a plain local HTTP server such as VS Code Live Server, using the Three.js CDN import map. Opening `index.html` as a `file://` URL may be blocked by browser module security; use an HTTP server.

## Playtest build

Every push to `main` is built and published by `.github/workflows/pages.yml` to
https://bruceglez.github.io/RedWest/ (the repository's Pages source must be set to **GitHub Actions**).

Each finished run is recorded in that browser's playtest log: result, pursuit reached, peak Heat, bank or ride-on choice and the Heat at that moment, bounty, score, time, shots, accuracy, kills, damage taken, and its order in the session. Use **COPY** on the start screen or **COPY RUN LOG** on the result screen to copy the rows as tab-separated text for a spreadsheet, and **CLEAR** on the start screen before the next tester.

## Verify

```powershell
npm test
npm run build
npm run test:smoke
npm run test:static
```

The browser smoke tests look for an installed Chrome or Chromium in the usual location for Windows, macOS, or Linux. Set `CHROME_PATH` to use a different Chromium executable. Player feel, balance, and frame pacing still require hands-on playtesting.
