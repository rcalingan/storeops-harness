# Skill: grading-criteria

**Purpose.** The deterministic rubric that turns the Evaluator's check results, AC results and findings into one verdict: **PASS**, **CONDITIONAL PASS** or **FAIL**. Two Evaluators given the same diff must reach the same verdict. Read by the **Evaluator**. The orchestrator reads only the resulting `VERDICT:` line. The Monitor reads the severity counts.

---

## 1. Severity scale

| Severity | Meaning | Blocks the sprint? |
|---|---|---|
| **BLOCKER** | Security or data-integrity defect, a weakened gate, or broken build tooling. Must never be merged. | Yes |
| **MAJOR** | An AC isn't truly delivered, a business or architecture rule is broken, or a claim is false. | Yes |
| **MINOR** | A convention deviation with no behavioural impact. | No (gives CONDITIONAL PASS) |
| **NOTE** | A suggestion or an observation for the Monitor. Not graded. | No |

### StoreOps severity guide

Use the first row that matches.

| Situation | Severity | Rule |
|---|---|---|
| A new endpoint lets a non-regional actor read or mutate another store's data | BLOCKER | ARCH-12 |
| A new `/api` router is mounted without `authenticate` (and the contract doesn't name it as public) | BLOCKER | ARCH-07 |
| `passwordHash`, a token or a `User` leaks out of the staff module or into a response | BLOCKER | ARCH-04 |
| A protected file is modified, or a lint/TS/coverage suppression is added | BLOCKER | ARCH-16 |
| A role rule from the contract is missing or wrong (e.g. ASSOCIATE allowed when the contract says 403) | MAJOR | ARCH-11 |
| A bulk write is partially applied when validation fails | MAJOR | MOD-05 |
| An event is emitted before the write, from a route or repository, not awaited, or missing for a changed entity | MAJOR | ARCH-06 |
| An event or alert fires when nothing changed (duplicate alerts to staff) | MAJOR | ARCH-06 |
| A raw error response, swallowed error, or wrong status code for the case | MAJOR | ARCH-10 |
| `new Date()` / `Date.now()` used for "now" in a service, repo or handler | MAJOR | ARCH-13 |
| Input not validated by zod, unbounded array, or enum literals re-listed | MAJOR | ARCH-15 |
| A static route shadowed by `/:id` | MAJOR | MOD-06 |
| A self-check table claims MET for an AC that is NOT MET/PARTIAL | MAJOR | REV-06 |
| A test exists but does not assert all THEN/AND clauses (AC PARTIAL) | MAJOR | TEST-04 |
| A business rule in a route, or a logic/validation rule in a repository | MAJOR | ARCH-01 / ARCH-14 |
| A service instantiated outside `container.ts`, or a cross-module value import where `import type` is required | MAJOR | ARCH-03 |
| An AC test title is missing the AC ID (but the test exists and is correct) | MINOR | TEST-05 |
| An error message style, naming, spelling (`program` vs `programme`) or JSDoc deviation | MINOR | CODE-* |
| The changed-files list in the summary is inaccurate | MINOR | REV-06 |
| An ESLint warning (not error) was introduced | MINOR | CODE-13 |
| A README table not updated for a new event, module or endpoint | MINOR | MOD-04 / MOD-08 |

Escalate or demote severity only with a one-line justification in the finding. For example, a CODE-07 wrong subclass that changes the HTTP status from 404 to 400 is a MAJOR, because clients see a different contract.

## 2. Automated checks

| ID | Check | Result values |
|---|---|---|
| C-01 | Typecheck (`npm run typecheck`) | PASS / FAIL |
| C-02 | Lint (`npm run lint`) | PASS / FAIL |
| C-03 | Architecture (`npm run lint:deps`) | PASS / FAIL |
| C-04 | Tests (`npm run test:coverage`) | PASS / FAIL (with failing count) |
| C-05 | Global coverage thresholds (statements 80, branches 65, functions 75, lines 80) | PASS / FAIL |
| C-06 | Coverage ratchet (TEST-07: new files ≥ 90% lines / 80% branches; modified files and global within 1.0 pp of baseline) | PASS / FAIL |
| C-07 | Protected files and suppressions (ARCH-16/17) | PASS / FAIL |
| C-08 | Scope (contract "Files in scope") | PASS / FAIL |

A failure of C-01 to C-05 is reported as a check failure and does not also need a finding. C-07 and C-08 failures also get a finding: BLOCKER (ARCH-16) and MAJOR (PLAN-06) respectively. That way the Generator gets a `file:line` to act on.

## 3. AC results

| Result | Definition |
|---|---|
| MET | A passing test, titled with the AC ID, exercises the WHEN and asserts every THEN/AND clause, and the implementation produces the behaviour for the right reason |
| PARTIAL | The behaviour exists, but the test misses a clause, or the behaviour holds only for some of the stated inputs |
| NOT MET | No test, a failing test, or behaviour absent or wrong |

## 4. Verdict decision table

Evaluate the rows top-down. The first matching row wins.

| # | Condition | Verdict |
|---|---|---|
| 1 | Any of C-01 … C-08 is FAIL | **FAIL** |
| 2 | Any AC is NOT MET or PARTIAL | **FAIL** |
| 3 | Any BLOCKER or MAJOR finding | **FAIL** |
| 4 | More than 5 MINOR findings | **FAIL** (the volume shows the skill files were not followed; record it in "Notes for Monitor") |
| 5 | 1–5 MINOR findings | **CONDITIONAL PASS** |
| 6 | Otherwise (NOTEs allowed) | **PASS** |

**CONDITIONAL PASS** means the sprint advances, and every MINOR finding is copied into `.harness/output/carry-over.md`. The Generator of the next sprint fixes carry-over items in files it touches anyway. The final run summary lists anything still open.

## 5. Escalation flag

Independent of the verdict, set `ESCALATE: YES` in the feedback header when:

- the contract is internally contradictory, or impossible without breaking an ARCH rule or touching a protected file (REV-09);
- the Generator reported `STATUS: BLOCKED` and you agree the block is real;
- fixing a finding would need a product decision the spec doesn't make (e.g. who may perform the action).

Otherwise `ESCALATE: NO`. The orchestrator handles the iteration-limit escalation itself.

## 6. Calibration examples

- **Bulk reassign works, but the store check is skipped for REGIONAL_MANAGER and *also* for DEPARTMENT_LEAD because of an inverted condition.** BLOCKER, ARCH-12. Verdict FAIL.
- **Everything passes. Two tests lack AC IDs in their titles, and one error message says "program".** 3 MINOR. Verdict CONDITIONAL PASS. All three go to carry-over.
- **Every check passes and the ACs are met, but `activity.assigned` fires for an activity whose assignee did not change.** MAJOR, ARCH-06. Verdict FAIL.
- **Coverage is 97% globally, but the new `activities.bulk.ts` helper has 70% branch coverage.** C-06 FAIL. Verdict FAIL. Name the uncovered branch lines from the coverage table.
- **The Generator added `// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment` in a route.** C-07 FAIL plus BLOCKER ARCH-16. Verdict FAIL. The fix is to parse with zod.
