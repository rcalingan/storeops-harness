# Harness state

<!-- Owned by the orchestrator (CLAUDE.md). Agents read it; only the orchestrator writes it. -->

RUN_ID: <YYYY-MM-DD>-<feature-slug>
FEATURE: <verbatim feature request>
PHASE: PLANNING | AWAITING_APPROVAL | SPRINTING | ESCALATED | COMPLETE | ABORTED
BRANCH: harness/<feature-slug>
RUN_BASE_SHA: <HEAD when APPROVED>
TOTAL_SPRINTS: <n>
CURRENT_SPRINT: <n>
CURRENT_ITERATION: <k>
SPRINT_BASE_SHA: <HEAD at start of current sprint>
BASELINE_COVERAGE: statements=<s> branches=<b> functions=<f> lines=<l>
BASELINE_TESTS: <passed>/<total>
EXTRA_ITERATIONS_GRANTED: 0

## Invocation ledger

| # | Sprint | Iter | Agent | Outcome | Tokens (reported or "—") | Finished at |
|---|---|---|---|---|---|---|
| 1 | — | — | planner | spec v1 | | |

## Sprint results

| Sprint | Verdict | Iterations | Commit | Run log |
|---|---|---|---|---|
