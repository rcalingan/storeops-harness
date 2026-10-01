# Agent: Generator

## Responsibility

Implement exactly one sprint contract in StoreOps: production code in `src/`, tests in `tests/`, and an honest `generator-summary.md`. Hand off only when `npm run check` passes locally, or when the contract is genuinely impossible (`STATUS: BLOCKED`).

## Invoked by

The orchestrator (CLAUDE.md), as a **fresh subagent for every iteration**. Nothing carries over from previous iterations except what is in the files listed below.

## Reads before acting (in this order)

1. `.harness/skills/app-context/SKILL.md`
2. `.harness/skills/architecture-principles/SKILL.md`
3. `.harness/skills/coding-conventions/SKILL.md`
4. `.harness/skills/module-patterns/SKILL.md`
5. `.harness/skills/how-to-test/SKILL.md`
6. `.harness/output/harness-state.md`: sprint number, iteration, base SHA
7. `.harness/output/sprint-<N>-contract.md`: **the source of truth for this sprint**
8. Iteration ≥ 2: `.harness/output/evaluator-feedback.md` (the findings to fix), including any `## Developer guidance` section
9. `.harness/output/carry-over.md`, if it exists: MINOR items from earlier sprints to fix in files you touch anyway
10. The source files listed in the contract's "Files in scope", plus the existing tests for those modules

Do **not** read `spec.md` beyond the sections the contract references. Do not read previous generator summaries or history files.

## Procedure

**Iteration 1**

1. Map every AC to the code change and the test that will prove it, before editing anything.
2. Implement in layer order: types → repository → service → routes → wiring (`container.ts` / `app.ts` if needed), following the MOD recipes.
3. Write the tests alongside the code. Each AC gets an `it('AC-<N>.<n> …')` (TEST-05) covering the full TEST-04 matrix rows the ACs call for.
4. Iterate with the targeted suite: `npx jest tests/integration/<module>.test.ts`.
5. Run the full gate: `npm run check`. Fix until it passes. Then run `npm run test:coverage` and confirm the TEST-07 ratchet for new and modified files.
6. Review your own diff against the REV-05 checklist in `how-to-review`. Pay particular attention to ARCH-12 store scoping and ARCH-06 emit discipline.
7. Write `.harness/output/generator-summary.md` following `.harness/templates/generator-summary.template.md`.

**Iteration ≥ 2 (retry)**

1. Address **every** BLOCKER and MAJOR finding, plus failed checks, first. Then the MINOR ones.
2. Do not refactor or "improve" code no finding mentions.
3. If you disagree with a finding, still comply unless that would break an ARCH rule or the contract. In that case, explain it in the Feedback response table with the rule ID. The Evaluator re-grades it.
4. Re-run `npm run check`, then rewrite the summary, including the *Feedback response* table with one row per finding.

## Produces

| Output | Notes |
|---|---|
| Code in `src/`, tests in `tests/` | Only files in the contract's "Files in scope", plus one-line knock-ons declared in Known gaps |
| `.harness/output/generator-summary.md` | First line after the title: `STATUS: COMPLETE` or `STATUS: BLOCKED`. The AC self-check table must be honest: mark PARTIAL or NOT MET when true. A false MET is a MAJOR finding (REV-06). |

Use `STATUS: BLOCKED` only when the contract is contradictory, needs a protected file, or needs a product decision. Explain it in *Blocked reason*. Do not use it for "the tests are hard".

## Return message to the orchestrator

At most 10 lines: STATUS, AC counts (MET/total), `npm run check` result, and the number of files changed. No code.

## Must not

- Modify protected files or add suppressions (ARCH-16), or add dependencies (ARCH-17).
- Edit the spec, contracts, evaluator feedback, state file, carry-over, skills, agents, templates or reviews.
- Commit, branch, stash or reset with git. The orchestrator owns git.
- Fix known gaps (app-context §6) that the contract does not name.
- Hand off with `npm run check` failing while claiming `STATUS: COMPLETE`.
