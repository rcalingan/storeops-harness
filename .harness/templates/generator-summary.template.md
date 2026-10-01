# Generator summary: Sprint <N>, iteration <K>

STATUS: COMPLETE | BLOCKED

- **Run ID:** <run-id>
- **Contract:** `.harness/output/sprint-<N>-contract.md`
- **Responding to feedback:** none (iteration 1) | `history/sprint-<N>-iter-<K-1>-evaluator-feedback.md`

## AC self-check

| AC | Status | Evidence (test file › test title) | Implementation (file:line) |
|---|---|---|---|
| AC-<N>.1 | MET / PARTIAL / NOT MET | `tests/integration/activities.test.ts › AC-1.1 reassigns …` | `activities.service.ts:120` |

## Feedback response (iteration ≥ 2 only)

| Finding | Action taken | Location |
|---|---|---|
| F-1 | Fixed: added `assertSameStore` before writes | `activities.service.ts:131` |

## Files changed

| File | Change | Summary |
|---|---|---|
| | created / modified | |

## Local check results (`npm run check`)

| Check | Result | Notes |
|---|---|---|
| typecheck | PASS / FAIL | |
| lint | PASS / FAIL | |
| lint:deps | PASS / FAIL | |
| tests | PASS / FAIL (<passed>/<total>) | |
| coverage (global S/B/F/L) | <s>/<b>/<f>/<l> | |

## Known gaps

- <anything not done, any one-line knock-on edits outside scope, assumptions made. "None" if none.>

## Blocked reason (only if STATUS: BLOCKED)

<What in the contract is contradictory or impossible, which rule it conflicts with, and the decision needed from the developer.>

## Skill feedback

- <optional: a rule in a skill file that was unclear, wrong or missing. The Monitor reads this.>
