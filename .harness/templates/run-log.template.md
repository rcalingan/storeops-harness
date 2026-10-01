# Run log: <run-id>, Sprint <N>: <title>

| Field | Value |
|---|---|
| Run ID | <run-id> |
| Sprint | <N> of <total> |
| Final verdict | PASS / CONDITIONAL PASS / FAIL |
| Iterations used | <k> / 3 |
| Escalated | YES / NO (trigger: E-1 / E-2 / E-3 / E-4 / E-5 / —) |
| Sprint commit | <sha or "none (escalated)"> |
| Logged at | <ISO timestamp> |

## Iteration history

| Iter | Generator status | Verdict | BLOCKER | MAJOR | MINOR | ACs MET | Checks failed |
|---|---|---|---|---|---|---|---|
| 1 | COMPLETE | FAIL | 1 | 2 | 0 | 5/8 | C-06 |

## Findings by rule

| Rule ID | Skill file | Count this sprint | Resolved by end? |
|---|---|---|---|
| ARCH-12 | architecture-principles | 1 | yes |

## Estimated token cost

| Iter | Agent | Basis | Tokens |
|---|---|---|---|
| 1 | Generator | reported / ESTIMATED | |
| 1 | Evaluator | reported / ESTIMATED | |
| — | **Sprint total** | | **<n>** |

Method: <"reported by Agent tool" or "ESTIMATED = (bytes read + bytes written) / 4, with an assumed 2× overhead for tool round-trips">

## Coverage trend

| Point | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Run baseline | | | | |
| End of this sprint | | | | |

## Quality trend notes

- <first-pass quality: did iteration 1 pass? Was the same rule violated in an earlier sprint of this run or in recent runs (see reviews/index.md)?>
- <planning defects or Generator skill feedback>

## Skill drift signals

| Skill file | Signal | Suggested refinement |
|---|---|---|
| <skill> | <e.g. ARCH-12 violated on first iteration in 3 of the last 5 sprints> | <e.g. add an assertSameStore example to MOD-02 and a contract-level reminder> |
