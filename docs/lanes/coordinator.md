# Managing Agent Guide: Multi-Lane Coordination & Model Allocation

**Mission:** Instruct the managing / coordinator agent on how to break down roadmap tasks, enforce lane boundaries, delegate work to specialized lane agents, and select the optimal AI models to maximize performance while preserving token and rate-limit budgets.

---

## 1. The Multi-Lane System: Golden Rules

Red West divides all files across **12 autonomous lanes** (`lanes.json`, `AGENTS.md`). Each lane is owned by a specific domain (art, mine, town, scale, combat, audio, ui, story, money, qa, growth, design).

When managing tasks, the coordinator must enforce four core principles:

1. **One Lane Per Branch & PR:**
   - Every branch must follow the convention `<lane>/<task-slug>` (e.g. `art/saloon-props`, `town/kitchen-wiring`, `ui/shift-hud`).
   - Run `node tools/lanes.mjs diff --strict` to verify no branch touches more than one lane.
2. **Data Contracts Merge First:**
   - If Lane B needs data or a layout from Lane A (e.g. `art` building a 3D scene from `town`'s map layout), **Lane A's PR must merge to `main` first**.
   - Lane B then rebases on `main` and reads the merged contract without guessing or inventing data.
3. **Keep PRs Small and Fast:**
   - Keep pull requests tightly focused (usually 1–3 files).
   - Run tests locally before opening a PR: `npm test`, `npm run build`, and the lane-specific checks.
4. **Docs and Assets Updated in the Same PR:**
   - Any new procedural art or 3D asset must have a row appended to `ASSETS.md` (owned by `art`).
   - Feature PRs do **not** edit `PLAN.md`; `PLAN.md` is updated exclusively by the coordinator.

---

## 2. Model Selection Matrix: Preserving Token Quotas

AI coding agents have different strengths, context windows, and rate-limit profiles. Using high-cost, low-limit models for repo-wide searches burns weekly quotas quickly. Use the right model for the right phase:

| Phase / Task | Recommended Model | Why This Model? | What to Avoid |
|---|---|---|---|
| **Managing Agent & Architecture** | **Gemini (Flash / Pro)** | Huge context window (1M+ tokens), rapid codebase scanning, low token cost. Ideal for auditing 20+ docs and verifying branch state. | Do not use Claude Sonnet for broad repo audits; it drains weekly limits fast. |
| **Deep Feature Implementation** | **Claude 3.7 / 3.5 Sonnet** | Top-tier reasoning and precision. Essential for intricate math, game rules (`combatMath.js`), balance bots, and complex Three.js geometry. | Do not ask Sonnet to "browse around the repo". Feed it only the 2–3 exact target files. |
| **Targeted Code / Scaffolding** | **Codex / Gemini Flash** | Fast, reliable code generation for isolated modules, boilerplate tests, and small single-file additions. | Do not give unbounded multi-step tasks to Codex without explicit file boundaries; it may run out of limit mid-PR. |
| **Log Analysis & CI Verification** | **Gemini Flash / CLI** | Fast parsing of large terminal logs, test failures, and smoke outputs. | Never run automated polling loops in LLM chat; check GitHub web UI or run a single command when alerted. |

---

## 3. How to Pass Tasks to Lane Agents

When handing off a task to a lane agent (whether via subagent invocation or starting a new prompt session), follow this standard handoff template:

### Handoff Prompt Template

```markdown
You are acting as the [LANE_NAME] agent (Lane: `[LANE_ID]`).

### Context & Mission
[Brief description of the task from PLAN.md or docs/design/[topic].md]

### Your Lane Boundaries
- Branch: `[lane]/[task-slug]`
- Files you own: `[exact file paths to edit or create]`
- Data contracts to read (DO NOT MODIFY): `[read-only files from other lanes]`

### Hard Rules
1. Stay in your files. Do NOT touch files outside lane `[LANE_ID]`.
2. Do not invent layout or rules; read from merged contracts.
3. If creating assets, append rows to ASSETS.md.
4. Keep the PR small and green.

### Validation Checklist Before Handing Back
- `node tools/lanes.mjs who [files...]`
- `npm test`
- `npm run build`
- `[lane-specific checks: e.g. npm run test:town / npm run test:characters / node tools/perf.mjs]`
- `node tools/lanes.mjs diff --strict`
```

---

## 4. Token-Saving Best Practices for Developers

To keep user subscriptions from burning out prematurely:

1. **Pre-filter Context:**
   - Before prompting a high-reasoning model like Claude Sonnet, use Gemini or ripgrep/git tools to identify the exact files and line ranges.
   - Provide Sonnet with *only* the specific files needed.
2. **Start Fresh Sessions per PR:**
   - Long conversation transcripts bloat prompt tokens on every turn.
   - Once a PR is merged or a lane task is completed, start a fresh conversation session for the next task.
3. **No Chat Polling on CI:**
   - GitHub Actions take 10–15 minutes to run full browser smoke suites.
   - Do not ask the model to wait and re-check CI every minute in chat.
   - Check the GitHub PR page in your browser. Once green, bring the model back to merge and sync `main`.
4. **Local Checks First:**
   - Always run `npm test` locally. Fixing errors before pushing saves both GitHub Actions runner minutes and agent review cycles.
