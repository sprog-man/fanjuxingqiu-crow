# Session Handoff

Use this template at the end of a work session so the next session can pick up immediately.

---

## Current Objective

- **Goal:** [What feature/bug is this session working on?]
- **Status:** [In progress / Blocked / Complete]
- **Branch:** yunfuwu
- **Last commit:** `[hash]` — [commit message]

## Completed This Session

- [ ] [Feature/bug implemented — reference file:line or commit hash]

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Syntax check | `node --check project/backend/src/app.js` | ✅ Pass / ❌ Fail |
| Health check | `curl http://localhost:2001/api/health` | ✅ OK / ❌ Fail |
| Seed data | `curl -X POST http://localhost:2001/api/seed/all` | ✅ OK / ❌ Fail |

## Files Changed

- `path/to/file` — [summary of change]

## Decisions Made (if any)

Add to `docs/harness/DECISIONS.md` if this is an architectural decision.

- [Decision] — [brief context]

## Blockers / Risks

- [Blocker] — [description, impact]

## Next Session Startup

1. Read `CLAUDE.md` completely
2. Read `docs/harness/feature_list.json` — see current state
3. Read `docs/harness/progress.md` — see what was done
4. Read this handoff
5. Run `curl http://localhost:2001/api/health` to verify backend is up
6. Check `git log --oneline -5` to confirm branch

## Recommended Next Step

- [Concrete next action]
