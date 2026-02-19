# Red West Release Checklist

## Core Gameplay
- [ ] Run starts, progresses through waves, and ends correctly
- [ ] Enemy scaling feels fair through at least wave 10
- [x] Weapon switching works every run
- [ ] Loot effects are visible and correctly applied

## UX / Menus
- [x] Pause works via keyboard and buttons
- [x] Settings modal opens/closes from pause and hotkey
- [x] Restart run works from game-over and settings
- [x] Game-over report shows complete run stats

## Audio
- [x] Music toggle works and persists
- [x] SFX toggle works and persists
- [ ] No loud clipping or broken looping

## Data / Persistence
- [x] Leaderboard saves and displays correctly
- [x] Same player name updates best score instead of duplicate rows
- [x] Preferred player name persists

## Performance / Stability
- [ ] No syntax/runtime errors in console during normal run
- [ ] No severe frame drops during heavy combat
- [ ] Restarting multiple times does not leak state

## Final Gate
- [ ] Play test complete (3 full runs)
- [ ] Known issues list captured
- [ ] Build marked candidate for release
