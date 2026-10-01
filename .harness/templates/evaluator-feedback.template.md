# Evaluator feedback: Sprint <N>, iteration <K>

VERDICT: PASS | CONDITIONAL PASS | FAIL
ESCALATE: NO | YES
REASON: <one line; required if ESCALATE: YES, otherwise "—">

- **Run ID:** <run-id>
- **Reviewed diff:** `<SPRINT_BASE_SHA>..working tree`
- **Counts:** BLOCKER <n> · MAJOR <n> · MINOR <n> · NOTE <n> · ACs MET <m>/<total>

## Previous findings (iteration ≥ 2 only)

| Finding | Severity | Status |
|---|---|---|
| F-1 <title> | MAJOR | RESOLVED / NOT RESOLVED / REGRESSED |

## Automated checks

| ID | Check | Result | Evidence (tail / key lines) |
|---|---|---|---|
| C-01 | Typecheck | PASS / FAIL | |
| C-02 | Lint | PASS / FAIL | |
| C-03 | Architecture (depcruise) | PASS / FAIL | |
| C-04 | Tests | PASS / FAIL (<passed>/<total>) | |
| C-05 | Global coverage | PASS / FAIL | S <s> · B <b> · F <f> · L <l> |
| C-06 | Coverage ratchet | PASS / FAIL | <per-file lines/branches for new and modified files> |
| C-07 | Protected files and suppressions | PASS / FAIL | |
| C-08 | Scope | PASS / FAIL | |

## Acceptance criteria

| AC | Result | Evidence | Gap (if not MET) |
|---|---|---|---|
| AC-<N>.1 | MET / PARTIAL / NOT MET | `tests/… › AC-1.1 …` | |

## Findings

### F-<n> [BLOCKER|MAJOR|MINOR|NOTE] <short title>
- Rule: <ID>
- Location: <file>:<line>
- Problem: <what and observable consequence>
- Required fix: <concrete instruction>

## Carry-over (CONDITIONAL PASS only)

- F-<n>: <one line>, copied to `.harness/output/carry-over.md` by the orchestrator

## Notes for Monitor

- <planning defects (REV-09), REV-00 findings with no matching rule, skill rules that were ambiguous, signs the Generator ignored a skill>
