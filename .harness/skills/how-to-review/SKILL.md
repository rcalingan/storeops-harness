# Skill: how-to-review

**Purpose.** The procedure the Evaluator follows to review one Generator iteration on StoreOps, and how it writes feedback the Generator can act on in a single pass. Read by the **Evaluator**. The verdict rules themselves are in `grading-criteria`. Rule IDs are `REV-NN`.

**Stance:** you are an independent reviewer. Verify every claim yourself and treat `generator-summary.md` as unverified. You **never edit** `src/`, `tests/` or any config. You only write `.harness/output/evaluator-feedback.md`.

---

## REV-00 Uncovered problem

A real defect that no skill rule covers. Cite `REV-00` as the finding's rule. The Monitor treats every REV-00 finding as drift signal D-2: a skill file is missing a rule.

## REV-01 Inputs

Read these in order:

1. `.harness/output/harness-state.md`: the current sprint, iteration, `SPRINT_BASE_SHA` and baseline coverage.
2. `.harness/output/sprint-<N>-contract.md`: ACs, files in scope, ARCH rules at risk, protected-file exceptions.
3. `.harness/output/generator-summary.md`: the claims to verify.
4. On iteration ≥ 2: `.harness/output/history/sprint-<N>-iter-<K-1>-evaluator-feedback.md`, your previous findings.
5. `.harness/output/carry-over.md`, if present: MINOR items from earlier sprints. Check them only if this sprint touched the same files.

## REV-02 Establish the change set

```bash
git diff --name-status <SPRINT_BASE_SHA>        # tracked changes since the sprint started
git status --porcelain --untracked-files=all    # new files not yet tracked
git diff <SPRINT_BASE_SHA> -- src tests         # the actual diff you review
```

Review only this change set, plus code it directly calls where needed to judge correctness. Existing code outside the diff is not graded. Known gaps (app-context §6) in untouched code are never findings.

## REV-03 Gate checks: run them yourself, one at a time

Run each command separately so a failure can be attributed to one check. Capture the tail of the output for the feedback file.

| Check | Command | Pass condition |
|---|---|---|
| C-01 Typecheck | `npm run typecheck` | exit 0 |
| C-02 Lint | `npm run lint` | exit 0, zero errors (warnings are reported as MINOR) |
| C-03 Architecture | `npm run lint:deps` | `no dependency violations found` |
| C-04 Tests | `npm run test:coverage` | all suites pass |
| C-05 Global coverage | (same run) | ≥ package.json thresholds |
| C-06 Coverage ratchet | (same run, per-file table) | TEST-07 rules |
| C-07 Protected files | `git diff --name-only <SPRINT_BASE_SHA>` vs ARCH-16 list; `git diff <SPRINT_BASE_SHA> \| grep -nE "eslint-disable\|@ts-ignore\|@ts-expect-error\|istanbul ignore\|\.only\(\|\.skip\("` | no protected file touched (except contract exceptions), no suppression markers |
| C-08 Scope | changed files vs the contract's "Files in scope" (ignore `.harness/output/**`, `.harness/reviews/**` and `coverage/`) | every changed file is listed, or is a declared one-line knock-on |

Even if C-01 fails, still run the rest. The Generator needs the full picture in one iteration.

## REV-04 Verify each acceptance criterion

For every AC in the contract:

1. Find its test: `grep -n "AC-<N>.<n>" tests/` (TEST-05). If none exists, the AC is **NOT MET**.
2. Read the test. It must exercise the WHEN and assert **every** THEN/AND clause: the status code, `error.code`, persisted state and event/alert. A test that only checks the status code, when the AC also says "no activity is modified", is **PARTIAL**.
3. Confirm the test passed in the C-04 run. To isolate it: `npx jest <file> -t "AC-<N>.<n>"`.
4. Check that the *implementation* produces the behaviour for the right reason. For example, a 403 must come from the store check, not from a 404 path that happens to look like one.

Record each AC as MET, PARTIAL or NOT MET, with evidence (test file + title).

## REV-05 Review-enforced rules checklist

The tools cannot see these rules, so check each one against the diff. Start with the "ARCH rules at risk" named in the contract.

- [ ] **ARCH-01** Routes only parse, call one service method and set the status. Any `if` in a route handler that decides an outcome is a finding.
- [ ] **ARCH-03/04** Cross-module services use `import type` and constructor injection. Staff use outside its module is limited to `getById`/`list`.
- [ ] **ARCH-06** Emits happen in services, after writes, are awaited, have plain payloads, fire one per changed entity, and do not fire when nothing changed.
- [ ] **ARCH-07** New routers are mounted behind `authenticate`. Services are wired in `container.ts` and nowhere else.
- [ ] **ARCH-10** No hand-written error responses, no swallowed errors, and the right AppError subclass (CODE-07).
- [ ] **ARCH-11** `actor` is the first parameter. Look up before authorise (404 before 403). Role rules match the contract exactly.
- [ ] **ARCH-12** Every new read/write path is store-scoped for non-regional actors. **This is the most common serious defect. Check it on every sprint that touches activities or programmes.**
- [ ] **ARCH-13** No `new Date()` or `Date.now()` for "now" in services, repos or handlers. `now` is captured once per operation.
- [ ] **ARCH-14** Repository methods are async, return copies and contain no logic.
- [ ] **ARCH-15** All inputs go through zod. Enums come from the `as const` arrays. PATCH schemas are `.strict()` and non-empty. Arrays are bounded.
- [ ] **MOD-05/06** Bulk operations validate everything before writing. Static routes are registered before `/:id`.
- [ ] **TEST-03..06** Fresh `setupTestApp` per test, injected clock for time, no snapshots, no `.only`.
- [ ] **CODE-*** Naming, British spelling, error message style. These are MINOR unless they cause a bug.

## REV-06 Cross-check the Generator's claims

Compare `generator-summary.md` with what you observed:

- An AC marked MET that you grade NOT MET or PARTIAL is a **MAJOR** finding with rule `REV-06` ("self-check claim not supported"), in addition to the AC result.
- A file changed but not listed in "Files changed", or listed but not changed, is a MINOR finding.
- Known gaps the Generator declared honestly are **not** penalised beyond their own severity.

## REV-07 Writing findings

Each finding has:

```
### F-<n> [<SEVERITY>] <short title>
- Rule: <ARCH-12 | TEST-05 | CODE-07 | ...>
- Location: src/modules/activities/activities.service.ts:142
- Problem: <what is wrong and the observable consequence, e.g. an ASSOCIATE in store-002 can reassign store-001 activities>
- Required fix: <a concrete instruction the Generator can apply without guessing>
```

- **Always** give `file:line`. For a missing test, point at the `describe` block it belongs in.
- **Always** cite exactly one rule ID. If no rule covers the problem, use `REV-00`. The Monitor counts REV-00 findings as signals that a skill file is missing a rule.
- Give a concrete fix: "Call `this.assertSameStore(actor, task)` for every task before the first `repository.update`", not "consider store scoping".
- Report each problem once, under its most specific rule. Do not list duplicate findings for the same root cause.
- Do not include style preferences that no CODE rule backs. If you think one is worth adding, put it in the "Notes for Monitor" section instead.

## REV-08 Retry iterations

On iteration ≥ 2, start the feedback with a **Previous findings** table: each prior F-id with status `RESOLVED`, `NOT RESOLVED` or `REGRESSED`. A previous BLOCKER or MAJOR that is still unresolved is carried forward with the **same title**, so the orchestrator can detect "no progress" (CLAUDE.md escalation trigger E-3). New findings continue the numbering.

## REV-09 Planning defects

If an AC is untestable, contradictory or impossible under the architecture rules (PLAN-05), grade it NOT MET. Add a `PLANNING DEFECT` line in "Notes for Monitor" naming the AC and the reason. Do not invent a reinterpretation. If the defect blocks the sprint, set `ESCALATE: YES` with `REASON: planning defect in AC-x.y`.

## REV-10 Keep the evaluation bounded

- Don't read the whole codebase. Read the diff, the contract, and the specific callees the diff relies on.
- Don't paste full command output. Use the last 20 lines, or only the failing assertions or lint errors.
- One evaluator-feedback file per iteration, overwriting the previous one. The orchestrator archives history.
