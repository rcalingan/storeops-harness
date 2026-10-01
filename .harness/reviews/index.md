# Harness review ledger

Append-only governance record, maintained by the Monitor agent (`.harness/agents/monitor.agent.md`). Each sprint run adds one row. The per-sprint detail is in `.harness/reviews/<run-id>/sprint-<N>-run-log.md`.

**How to use this file:** before tuning a skill file, look at the *Rule violation tally* and the *Drift flag* column. A rule ID that keeps appearing on first iterations means its skill file is not guiding the Generator well enough (drift signal D-1). Rows with `REV-00` mean no skill rule covered the problem (D-2).

## Sprint ledger

| Run ID | Sprint | Verdict | Iterations | Escalated | First-pass verdict | BLOCKER/MAJOR/MINOR (all iters) | Est. tokens | Drift flag | Run log |
|---|---|---|---|---|---|---|---|---|---|

## Rule violation tally

Cumulative finding counts per rule ID, across all iterations of all sprints. "First-iter" counts only findings raised on iteration 1.

| Rule ID | Skill file | Total | First-iter | Last seen (run / sprint) |
|---|---|---|---|---|
